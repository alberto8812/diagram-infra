import { View, ViewItem, Rectangle, Connector } from 'src/types';
import {
  normalizeRectangleBounds,
  getZonesForTile,
  getItemZones,
  getZoneParent,
  buildZoneTree,
  findPartialZoneOverlaps,
  getItemsInZone,
  crossesZoneBoundary
} from '../containment';

const rect = (
  overrides: Partial<Rectangle> & Pick<Rectangle, 'id'>
): Rectangle => {
  return {
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    ...overrides
  };
};

const item = (id: string, x: number, y: number): ViewItem => {
  return { id, tile: { x, y } };
};

const view = (overrides: Partial<View> & Pick<View, 'id'>): View => {
  return {
    name: 'Test view',
    items: [],
    ...overrides
  };
};

describe('normalizeRectangleBounds()', () => {
  test('normalizes corners given in any order', () => {
    expect(
      normalizeRectangleBounds({ from: { x: 5, y: 5 }, to: { x: 0, y: 0 } })
    ).toStrictEqual({ minX: 0, minY: 0, maxX: 5, maxY: 5 });

    expect(
      normalizeRectangleBounds({ from: { x: 0, y: 5 }, to: { x: 5, y: 0 } })
    ).toStrictEqual({ minX: 0, minY: 0, maxX: 5, maxY: 5 });
  });
});

describe('getZonesForTile() / getItemZones()', () => {
  const vpc = rect({
    id: 'vpc1',
    zone: 'vpc',
    from: { x: 10, y: 10 },
    to: { x: 0, y: 0 } // reversed corners on purpose
  });
  const subnet = rect({
    id: 'subnet1',
    zone: 'subnet',
    from: { x: 2, y: 2 },
    to: { x: 5, y: 5 }
  });
  const sg = rect({
    id: 'sg1',
    zone: 'securityGroup',
    from: { x: 3, y: 3 },
    to: { x: 4, y: 4 }
  });
  const plain = rect({
    id: 'plain1',
    from: { x: 0, y: 0 },
    to: { x: 20, y: 20 }
  });

  const testView = view({
    id: 'v1',
    rectangles: [vpc, subnet, sg, plain],
    items: [
      item('nested', 3, 3),
      item('edgeMin', 0, 0),
      item('edgeMax', 10, 10),
      item('outside', 20, 0)
    ]
  });

  test('orders zones innermost (smallest area) to outermost for a tile in all three', () => {
    const zones = getZonesForTile(testView, { x: 3, y: 3 });

    expect(
      zones.map((z) => {
        return z.id;
      })
    ).toStrictEqual(['sg1', 'subnet1', 'vpc1']);
  });

  test('respects reversed from/to corners when testing containment', () => {
    const zones = getZonesForTile(testView, { x: 10, y: 10 });

    expect(
      zones.map((z) => {
        return z.id;
      })
    ).toStrictEqual(['vpc1']);
  });

  test('edge tiles are inclusive on both the min and max corner', () => {
    expect(
      getZonesForTile(testView, { x: 0, y: 0 }).map((z) => {
        return z.id;
      })
    ).toStrictEqual(['vpc1']);
    expect(
      getZonesForTile(testView, { x: 10, y: 10 }).map((z) => {
        return z.id;
      })
    ).toStrictEqual(['vpc1']);
  });

  test('a tile just outside every zone has no zones', () => {
    expect(getZonesForTile(testView, { x: 20, y: 0 })).toStrictEqual([]);
  });

  test('plain (non-zone) rectangles are never returned as zones', () => {
    const zones = getZonesForTile(testView, { x: 3, y: 3 });

    expect(
      zones.some((z) => {
        return z.id === 'plain1';
      })
    ).toBe(false);
  });

  test('getItemZones() resolves a view item to its tile before computing zones', () => {
    expect(
      getItemZones(testView, 'nested').map((z) => {
        return z.id;
      })
    ).toStrictEqual(['sg1', 'subnet1', 'vpc1']);
    expect(getItemZones(testView, 'outside')).toStrictEqual([]);
    expect(getItemZones(testView, 'does-not-exist')).toStrictEqual([]);
  });
});

describe('getZoneParent() / buildZoneTree()', () => {
  const vpc = rect({
    id: 'vpc1',
    zone: 'vpc',
    from: { x: 0, y: 0 },
    to: { x: 10, y: 10 }
  });
  const subnetA = rect({
    id: 'subnetA',
    zone: 'subnet',
    from: { x: 1, y: 1 },
    to: { x: 4, y: 4 }
  });
  const subnetB = rect({
    id: 'subnetB',
    zone: 'subnet',
    from: { x: 6, y: 6 },
    to: { x: 9, y: 9 }
  });
  const sg = rect({
    id: 'sg1',
    zone: 'securityGroup',
    from: { x: 2, y: 2 },
    to: { x: 3, y: 3 }
  });
  const region = rect({
    id: 'region1',
    zone: 'region',
    from: { x: -5, y: -5 },
    to: { x: 15, y: 15 }
  });

  const testView = view({
    id: 'v1',
    rectangles: [vpc, subnetA, subnetB, sg, region]
  });

  test('getZoneParent() returns the immediate (smallest) containing zone', () => {
    expect(getZoneParent(testView, 'sg1')?.id).toBe('subnetA');
    expect(getZoneParent(testView, 'subnetA')?.id).toBe('vpc1');
    expect(getZoneParent(testView, 'vpc1')?.id).toBe('region1');
    expect(getZoneParent(testView, 'region1')).toBeUndefined();
  });

  test('buildZoneTree() nests zones by geometric containment', () => {
    const tree = buildZoneTree(testView);

    expect(tree).toHaveLength(1);
    expect(tree[0].zone.id).toBe('region1');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].zone.id).toBe('vpc1');

    const vpcChildren = tree[0].children[0].children.map((c) => {
      return c.zone.id;
    });
    expect(vpcChildren).toStrictEqual(['subnetA', 'subnetB']);

    const subnetANode = tree[0].children[0].children[0];
    expect(subnetANode.children).toHaveLength(1);
    expect(subnetANode.children[0].zone.id).toBe('sg1');
  });
});

describe('findPartialZoneOverlaps()', () => {
  test('reports zones whose bounds intersect without full containment', () => {
    const a = rect({
      id: 'zoneA',
      zone: 'vpc',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });
    const b = rect({
      id: 'zoneB',
      zone: 'vpc',
      from: { x: 3, y: 3 },
      to: { x: 8, y: 8 }
    });

    const testView = view({ id: 'v1', rectangles: [a, b] });

    const overlaps = findPartialZoneOverlaps(testView);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].a.id).toBe('zoneA');
    expect(overlaps[0].b.id).toBe('zoneB');
  });

  test('fully-nested zones are not reported as a partial overlap', () => {
    const outer = rect({
      id: 'outer',
      zone: 'vpc',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 }
    });
    const inner = rect({
      id: 'inner',
      zone: 'subnet',
      from: { x: 2, y: 2 },
      to: { x: 4, y: 4 }
    });

    const testView = view({ id: 'v1', rectangles: [outer, inner] });

    expect(findPartialZoneOverlaps(testView)).toStrictEqual([]);
  });

  test('non-intersecting zones are not reported', () => {
    const a = rect({
      id: 'zoneA',
      zone: 'vpc',
      from: { x: 0, y: 0 },
      to: { x: 2, y: 2 }
    });
    const b = rect({
      id: 'zoneB',
      zone: 'vpc',
      from: { x: 10, y: 10 },
      to: { x: 12, y: 12 }
    });

    const testView = view({ id: 'v1', rectangles: [a, b] });

    expect(findPartialZoneOverlaps(testView)).toStrictEqual([]);
  });

  test('a plain rectangle overlapping a zone is not reported', () => {
    const zone = rect({
      id: 'zoneA',
      zone: 'vpc',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });
    const plain = rect({
      id: 'plain1',
      from: { x: 3, y: 3 },
      to: { x: 8, y: 8 }
    });

    const testView = view({ id: 'v1', rectangles: [zone, plain] });

    expect(findPartialZoneOverlaps(testView)).toStrictEqual([]);
  });
});

describe('getItemsInZone()', () => {
  const subnet = rect({
    id: 'subnet1',
    zone: 'subnet',
    from: { x: 0, y: 0 },
    to: { x: 5, y: 5 }
  });

  const testView = view({
    id: 'v1',
    rectangles: [subnet],
    items: [
      item('inside1', 1, 1),
      item('inside2', 5, 5),
      item('outside1', 6, 6)
    ]
  });

  test('returns only the items whose tile is inside the zone', () => {
    const items = getItemsInZone(testView, 'subnet1').map((i) => {
      return i.id;
    });

    expect(items.sort()).toStrictEqual(['inside1', 'inside2']);
  });

  test('returns an empty array for an unknown zone id', () => {
    expect(getItemsInZone(testView, 'does-not-exist')).toStrictEqual([]);
  });
});

describe('crossesZoneBoundary()', () => {
  const vpc = rect({
    id: 'vpc1',
    zone: 'vpc',
    from: { x: 0, y: 0 },
    to: { x: 10, y: 10 }
  });
  const subnet = rect({
    id: 'subnet1',
    zone: 'subnet',
    from: { x: 0, y: 0 },
    to: { x: 5, y: 5 }
  });

  const insideItem = item('insideItem', 2, 2);
  const outsideItem = item('outsideItem', 20, 20);

  const testView = view({
    id: 'v1',
    rectangles: [vpc, subnet],
    items: [insideItem, outsideItem]
  });

  test('reports zones left when a connector exits them (item-to-item anchors)', () => {
    const connector: Connector = {
      id: 'c1',
      anchors: [
        { id: 'a1', ref: { item: 'insideItem' } },
        { id: 'a2', ref: { item: 'outsideItem' } }
      ]
    };

    const { entered, left } = crossesZoneBoundary(testView, connector);

    expect(
      left.map((z) => {
        return z.id;
      })
    ).toStrictEqual(['subnet1', 'vpc1']);
    expect(entered).toStrictEqual([]);
  });

  test('reports zones entered when a connector enters them, resolving a tile-ref anchor', () => {
    const connector: Connector = {
      id: 'c2',
      anchors: [
        { id: 'a1', ref: { tile: { x: 20, y: 20 } } },
        { id: 'a2', ref: { item: 'insideItem' } }
      ]
    };

    const { entered, left } = crossesZoneBoundary(testView, connector);

    expect(
      entered.map((z) => {
        return z.id;
      })
    ).toStrictEqual(['subnet1', 'vpc1']);
    expect(left).toStrictEqual([]);
  });

  test('a connector staying within the same zones crosses no boundary', () => {
    const connector: Connector = {
      id: 'c3',
      anchors: [
        { id: 'a1', ref: { item: 'insideItem' } },
        { id: 'a2', ref: { tile: { x: 1, y: 1 } } }
      ]
    };

    const { entered, left } = crossesZoneBoundary(testView, connector);

    expect(entered).toStrictEqual([]);
    expect(left).toStrictEqual([]);
  });

  test('a connector with fewer than two anchors crosses no boundary', () => {
    const connector: Connector = {
      id: 'c4',
      anchors: [{ id: 'a1', ref: { item: 'insideItem' } }]
    };

    expect(crossesZoneBoundary(testView, connector)).toStrictEqual({
      entered: [],
      left: []
    });
  });
});
