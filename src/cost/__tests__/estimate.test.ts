import { ModelItem, Model } from 'src/types';
import { estimateDiagramCost, estimateItemCost } from '../estimate';
import { CostCatalog } from '../types';

const testCatalog: CostCatalog = {
  currency: 'USD',
  lastUpdated: '2026-01-01',
  source: 'test fixture',
  regions: {
    'us-east-1': { multiplier: 1 },
    'eu-west-1': { multiplier: 1.1 }
  },
  items: [
    {
      kind: 'service',
      size: 't3.medium',
      monthlyUsd: 30,
      unit: 'instance/month'
    },
    {
      kind: 'database',
      size: 'db.t3.medium',
      match: { engine: 'mysql' },
      monthlyUsd: 50,
      unit: 'instance/month'
    }
  ],
  storage: [
    { kind: 'storage', usdPerGbMonth: 0.02 },
    { kind: 'database', usdPerGbMonth: 0.1 }
  ]
};

const item = (overrides: Partial<ModelItem> = {}): ModelItem => {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'Item 1',
    ...overrides
  };
};

describe('estimateItemCost()', () => {
  test('exact match: a known kind/size with no region resolves to exact-catalog', () => {
    const result = estimateItemCost(
      item({ kind: 'service', size: 't3.medium' }),
      testCatalog
    );

    expect(result).toStrictEqual({
      monthlyUsd: 30,
      confidence: 'exact-catalog',
      reasons: []
    });
  });

  test('a known region multiplies the price and stays exact-catalog', () => {
    const result = estimateItemCost(
      item({ kind: 'service', size: 't3.medium', region: 'eu-west-1' }),
      testCatalog
    );

    expect(result.confidence).toBe('exact-catalog');
    expect(result.monthlyUsd).toBeCloseTo(33);
  });

  test('region fallback: an unrecognized region uses the base price and is reported approximate', () => {
    const result = estimateItemCost(
      item({ kind: 'service', size: 't3.medium', region: 'mars-1' }),
      testCatalog
    );

    expect(result.monthlyUsd).toBe(30);
    expect(result.confidence).toBe('approximate');
    expect(result.reasons.join(' ')).toMatch(/mars-1/);
  });

  test.each(['__proto__', 'constructor', 'toString'])(
    'region fallback: a prototype-property region name (%s) is never treated as known',
    (region) => {
      const result = estimateItemCost(
        item({ kind: 'service', size: 't3.medium', region }),
        testCatalog
      );

      expect(result.monthlyUsd).toBe(30);
      expect(result.confidence).toBe('approximate');
      expect(result.reasons.join(' ')).toMatch(region);
    }
  );

  test('storage: a storageGb-only item prices from the storage table', () => {
    const result = estimateItemCost(
      item({ kind: 'storage', storageGb: 100 }),
      testCatalog
    );

    expect(result).toStrictEqual({
      monthlyUsd: 2,
      confidence: 'exact-catalog',
      reasons: []
    });
  });

  test('instance + storage combine (e.g. an RDS instance with allocated storage)', () => {
    const result = estimateItemCost(
      item({
        kind: 'database',
        size: 'db.t3.medium',
        engine: 'mysql',
        storageGb: 50
      }),
      testCatalog
    );

    // 50 (instance) + 50 * 0.1 (storage) = 55
    expect(result.monthlyUsd).toBeCloseTo(55);
    expect(result.confidence).toBe('exact-catalog');
  });

  test('count multiplier: count scales both the instance and the storage price', () => {
    const result = estimateItemCost(
      item({ kind: 'service', size: 't3.medium', storageGb: 20, count: 3 }),
      testCatalog
    );

    // (30 + 20 * 0 [no service storage rate in this fixture]) * 3, but
    // service has no storage entry in the test catalog, so only the
    // instance price is priced; storage is unmatched.
    expect(result.monthlyUsd).toBeCloseTo(90);
    expect(result.confidence).toBe('approximate');
    expect(result.reasons.join(' ')).toMatch(/storage/i);
  });

  test('unknown kind/size: no catalog match returns unknown, never a guessed number', () => {
    const result = estimateItemCost(
      item({ kind: 'service', size: 'd2.mega' }),
      testCatalog
    );

    expect(result.monthlyUsd).toBe(0);
    expect(result.confidence).toBe('unknown');
    expect(result.reasons.join(' ')).toMatch(/d2\.mega/);
  });

  test('unknown: an item with no size/kind/storage set is never priced', () => {
    const result = estimateItemCost(item(), testCatalog);

    expect(result.monthlyUsd).toBe(0);
    expect(result.confidence).toBe('unknown');
  });

  test('an unmatched engine on an engine-specific catalog entry is unknown', () => {
    const result = estimateItemCost(
      item({ kind: 'database', size: 'db.t3.medium', engine: 'postgres' }),
      testCatalog
    );

    expect(result.confidence).toBe('unknown');
  });
});

const modelWith = (items: ModelItem[], views: Model['views']): Model => {
  return { title: 'test', items, views, icons: [], colors: [] };
};

describe('estimateDiagramCost() — aggregation', () => {
  test('aggregates totals by zone (via containment) and by environment', () => {
    const priced = item({
      id: 'db-1',
      name: 'DB',
      kind: 'database',
      size: 'db.t3.medium',
      engine: 'mysql',
      environment: 'prod'
    });
    const unpricedItem = item({
      id: 'svc-1',
      name: 'Unknown service',
      kind: 'service',
      size: 'unknown-size',
      environment: 'prod'
    });

    const view: Model['views'][number] = {
      id: 'view-1',
      name: 'Main',
      items: [
        { id: 'db-1', tile: { x: 1, y: 1 } },
        { id: 'svc-1', tile: { x: 10, y: 10 } }
      ],
      rectangles: [
        {
          id: 'zone-vpc',
          from: { x: 0, y: 0 },
          to: { x: 5, y: 5 },
          zone: 'vpc',
          name: 'main-vpc'
        }
      ],
      connectors: []
    };

    const model = modelWith([priced, unpricedItem], [view]);
    const result = estimateDiagramCost(model, testCatalog);

    expect(result.totalMonthlyUsd).toBeCloseTo(50);
    expect(result.unpriced).toHaveLength(1);
    expect(result.unpriced[0]).toMatchObject({ itemId: 'svc-1' });

    const zoneTotal = result.perZone.find((z) => {
      return z.id === 'zone-vpc';
    });
    expect(zoneTotal).toMatchObject({ label: 'main-vpc', itemCount: 1 });
    expect(zoneTotal?.monthlyUsd).toBeCloseTo(50);

    const envTotal = result.perEnvironment.find((e) => {
      return e.id === 'prod';
    });
    expect(envTotal?.monthlyUsd).toBeCloseTo(50);
    expect(envTotal?.itemCount).toBe(1);

    const viewTotal = result.perView.find((v) => {
      return v.id === 'view-1';
    });
    expect(viewTotal?.monthlyUsd).toBeCloseTo(50);
  });

  test('an item outside every zone contributes only to the view/environment totals', () => {
    const priced = item({
      id: 'svc-1',
      name: 'Service',
      kind: 'service',
      size: 't3.medium'
    });

    const view: Model['views'][number] = {
      id: 'view-1',
      name: 'Main',
      items: [{ id: 'svc-1', tile: { x: 0, y: 0 } }],
      rectangles: [],
      connectors: []
    };

    const model = modelWith([priced], [view]);
    const result = estimateDiagramCost(model, testCatalog);

    expect(result.perZone).toStrictEqual([]);
    expect(result.perView).toHaveLength(1);
    expect(result.perEnvironment[0]).toMatchObject({ id: 'unspecified' });
  });
});
