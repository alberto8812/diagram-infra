import { ModelItem, Rectangle, View } from 'src/types';
import { lintView } from '../engine';
import { RULE_ID } from '../datastoreInPublicZone';

const rect = (
  overrides: Partial<Rectangle> & Pick<Rectangle, 'id'>
): Rectangle => {
  return {
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    ...overrides
  };
};

// `environment: 'dev'` on every item keeps missing-environment and
// prod-without-owner from also firing, so each test only has to reason
// about datastore-in-public-zone.
const item = (
  overrides: Partial<ModelItem> & Pick<ModelItem, 'id'>
): ModelItem => {
  return { name: overrides.id, environment: 'dev', ...overrides };
};

const view = (overrides: Partial<View> & Pick<View, 'id'>): View => {
  return { name: 'Test view', items: [], ...overrides };
};

const ruleIssues = (
  items: ModelItem[],
  testView: View
): ReturnType<typeof lintView> => {
  return lintView({ items, views: [testView] }, testView).filter((issue) => {
    return issue.ruleId === RULE_ID;
  });
};

describe('datastore-in-public-zone', () => {
  test('flags a database in a public subnet', () => {
    const subnet = rect({
      id: 'subnet1',
      zone: 'subnet',
      name: 'Public subnet',
      visibility: 'public',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 }
    });
    const db = item({ id: 'db1', kind: 'database' });

    const testView = view({
      id: 'v1',
      rectangles: [subnet],
      items: [{ id: 'db1', tile: { x: 5, y: 5 } }]
    });

    const issues = ruleIssues([db], testView);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: RULE_ID,
      severity: 'error',
      viewId: 'v1',
      targets: [
        { type: 'ITEM', id: 'db1' },
        { type: 'RECTANGLE', id: 'subnet1' }
      ]
    });
  });

  test('cache and storage kinds are flagged the same as database', () => {
    const subnet = rect({
      id: 'subnet1',
      zone: 'subnet',
      visibility: 'public',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 }
    });
    const cache = item({ id: 'cache1', kind: 'cache' });
    const storage = item({ id: 'storage1', kind: 'storage' });

    const testView = view({
      id: 'v1',
      rectangles: [subnet],
      items: [
        { id: 'cache1', tile: { x: 1, y: 1 } },
        { id: 'storage1', tile: { x: 2, y: 2 } }
      ]
    });

    const issues = ruleIssues([cache, storage], testView);

    expect(
      issues.map((issue) => {
        return issue.targets[0].id;
      })
    ).toStrictEqual(['cache1', 'storage1']);
  });

  test('a database in a private subnet is not flagged', () => {
    const subnet = rect({
      id: 'subnet1',
      zone: 'subnet',
      visibility: 'private',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 }
    });
    const db = item({ id: 'db1', kind: 'database' });

    const testView = view({
      id: 'v1',
      rectangles: [subnet],
      items: [{ id: 'db1', tile: { x: 5, y: 5 } }]
    });

    expect(ruleIssues([db], testView)).toStrictEqual([]);
  });

  test('a database in a subnet with no visibility set is not flagged', () => {
    const subnet = rect({
      id: 'subnet1',
      zone: 'subnet',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 }
    });
    const db = item({ id: 'db1', kind: 'database' });

    const testView = view({
      id: 'v1',
      rectangles: [subnet],
      items: [{ id: 'db1', tile: { x: 5, y: 5 } }]
    });

    expect(ruleIssues([db], testView)).toStrictEqual([]);
  });

  test('a service node in a public subnet is not flagged (not a data store)', () => {
    const subnet = rect({
      id: 'subnet1',
      zone: 'subnet',
      visibility: 'public',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 }
    });
    const svc = item({ id: 'svc1', kind: 'service' });

    const testView = view({
      id: 'v1',
      rectangles: [subnet],
      items: [{ id: 'svc1', tile: { x: 5, y: 5 } }]
    });

    expect(ruleIssues([svc], testView)).toStrictEqual([]);
  });
});
