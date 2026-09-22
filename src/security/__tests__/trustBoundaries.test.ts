import { Connector, Rectangle, View } from 'src/types';
import { getTrustBoundariesCrossed } from '../trustBoundaries';

const rect = (
  overrides: Partial<Rectangle> & Pick<Rectangle, 'id'>
): Rectangle => {
  return { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, ...overrides };
};

const view = (overrides: Partial<View> & Pick<View, 'id'>): View => {
  return { name: 'Test view', items: [], ...overrides };
};

const connector = (
  fromItem: string,
  toItem: string,
  overrides: Partial<Connector> = {}
): Connector => {
  return {
    id: 'c1',
    anchors: [
      { id: 'a1', ref: { item: fromItem } },
      { id: 'a2', ref: { item: toItem } }
    ],
    ...overrides
  };
};

describe('getTrustBoundariesCrossed()', () => {
  test('returns the vpc/subnet boundaries a connector crosses', () => {
    const vpc = rect({
      id: 'vpc1',
      zone: 'vpc',
      from: { x: 0, y: 0 },
      to: { x: 20, y: 20 }
    });
    const subnet = rect({
      id: 'subnet1',
      zone: 'subnet',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });

    const testView = view({
      id: 'v1',
      rectangles: [vpc, subnet],
      items: [
        { id: 'inside', tile: { x: 1, y: 1 } },
        { id: 'outside', tile: { x: 15, y: 15 } }
      ],
      connectors: [connector('inside', 'outside')]
    });

    const crossed = getTrustBoundariesCrossed(
      testView,
      testView.connectors![0]
    );
    const ids = crossed.map((zone) => {
      return zone.id;
    });

    expect(ids.sort()).toStrictEqual(['subnet1']);
  });

  test('excludes region and az zones even when crossed', () => {
    const region = rect({
      id: 'region1',
      zone: 'region',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });
    const az = rect({
      id: 'az1',
      zone: 'az',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });

    const testView = view({
      id: 'v1',
      rectangles: [region, az],
      items: [
        { id: 'inside', tile: { x: 1, y: 1 } },
        { id: 'outside', tile: { x: 15, y: 15 } }
      ],
      connectors: [connector('inside', 'outside')]
    });

    const crossed = getTrustBoundariesCrossed(
      testView,
      testView.connectors![0]
    );

    expect(crossed).toStrictEqual([]);
  });

  test('a connector that never leaves a trust boundary returns no crossings', () => {
    const vpc = rect({
      id: 'vpc1',
      zone: 'vpc',
      from: { x: 0, y: 0 },
      to: { x: 20, y: 20 }
    });

    const testView = view({
      id: 'v1',
      rectangles: [vpc],
      items: [
        { id: 'a', tile: { x: 1, y: 1 } },
        { id: 'b', tile: { x: 2, y: 2 } }
      ],
      connectors: [connector('a', 'b')]
    });

    expect(
      getTrustBoundariesCrossed(testView, testView.connectors![0])
    ).toStrictEqual([]);
  });

  test('a connector with fewer than two anchors crosses no boundary', () => {
    const testView = view({ id: 'v1', items: [] });

    expect(
      getTrustBoundariesCrossed(testView, {
        anchors: [{ id: 'a1', ref: { item: 'a' } }]
      })
    ).toStrictEqual([]);
  });
});
