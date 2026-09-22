import { Rectangle, View } from 'src/types';
import { lintView } from '../engine';

const rect = (
  overrides: Partial<Rectangle> & Pick<Rectangle, 'id'>
): Rectangle => {
  return {
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    ...overrides
  };
};

const view = (overrides: Partial<View> & Pick<View, 'id'>): View => {
  return {
    name: 'Test view',
    items: [],
    ...overrides
  };
};

describe('zone-partial-overlap', () => {
  test('flags two zones whose bounds intersect without full containment', () => {
    const a = rect({
      id: 'zoneA',
      zone: 'vpc',
      name: 'VPC A',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });
    const b = rect({
      id: 'zoneB',
      zone: 'vpc',
      name: 'VPC B',
      from: { x: 3, y: 3 },
      to: { x: 8, y: 8 }
    });

    const testView = view({ id: 'v1', rectangles: [a, b] });
    const issues = lintView({ items: [], views: [testView] }, testView);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: 'zone-partial-overlap',
      severity: 'warning',
      viewId: 'v1',
      targets: [
        { type: 'RECTANGLE', id: 'zoneA' },
        { type: 'RECTANGLE', id: 'zoneB' }
      ]
    });
    expect(issues[0].message).toBe(
      'Zone "VPC A" and zone "VPC B" partially overlap.'
    );
  });

  test('fully-nested zones are not flagged', () => {
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
    const issues = lintView({ items: [], views: [testView] }, testView);

    expect(issues).toStrictEqual([]);
  });
});
