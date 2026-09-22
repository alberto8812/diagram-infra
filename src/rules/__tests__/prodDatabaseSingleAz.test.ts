import { ModelItem, Rectangle, View } from 'src/types';
import { lintView } from '../engine';
import { RULE_ID } from '../prodDatabaseSingleAz';

const rect = (
  overrides: Partial<Rectangle> & Pick<Rectangle, 'id'>
): Rectangle => {
  return {
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    ...overrides
  };
};

const item = (
  overrides: Partial<ModelItem> & Pick<ModelItem, 'id'>
): ModelItem => {
  return { name: overrides.id, owner: 'team', ...overrides };
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

describe('prod-database-single-az', () => {
  test('flags prod databases that all sit in the same az', () => {
    const azA = rect({
      id: 'azA',
      zone: 'az',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 }
    });
    const db1 = item({ id: 'db1', kind: 'database', environment: 'prod' });
    const db2 = item({ id: 'db2', kind: 'database', environment: 'prod' });

    const testView = view({
      id: 'v1',
      rectangles: [azA],
      items: [
        { id: 'db1', tile: { x: 1, y: 1 } },
        { id: 'db2', tile: { x: 2, y: 2 } }
      ]
    });

    const issues = ruleIssues([db1, db2], testView);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: RULE_ID,
      severity: 'warning',
      viewId: 'v1',
      targets: [
        { type: 'ITEM', id: 'db1' },
        { type: 'ITEM', id: 'db2' }
      ]
    });
  });

  test('flags prod databases with az zones present but none of them in an az', () => {
    const azA = rect({
      id: 'azA',
      zone: 'az',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });
    const db1 = item({ id: 'db1', kind: 'database', environment: 'prod' });

    const testView = view({
      id: 'v1',
      rectangles: [azA],
      items: [{ id: 'db1', tile: { x: 20, y: 20 } }]
    });

    expect(ruleIssues([db1], testView)).toHaveLength(1);
  });

  test('does not flag prod databases spread across distinct azs', () => {
    const azA = rect({
      id: 'azA',
      zone: 'az',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });
    const azB = rect({
      id: 'azB',
      zone: 'az',
      from: { x: 10, y: 10 },
      to: { x: 15, y: 15 }
    });
    const db1 = item({ id: 'db1', kind: 'database', environment: 'prod' });
    const db2 = item({ id: 'db2', kind: 'database', environment: 'prod' });

    const testView = view({
      id: 'v1',
      rectangles: [azA, azB],
      items: [
        { id: 'db1', tile: { x: 1, y: 1 } },
        { id: 'db2', tile: { x: 11, y: 11 } }
      ]
    });

    expect(ruleIssues([db1, db2], testView)).toStrictEqual([]);
  });

  test('does nothing in a view with no az zones', () => {
    const db1 = item({ id: 'db1', kind: 'database', environment: 'prod' });

    const testView = view({
      id: 'v1',
      items: [{ id: 'db1', tile: { x: 1, y: 1 } }]
    });

    expect(ruleIssues([db1], testView)).toStrictEqual([]);
  });

  test('does nothing when there are no prod databases', () => {
    const azA = rect({
      id: 'azA',
      zone: 'az',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });
    const devDb = item({ id: 'db1', kind: 'database', environment: 'dev' });

    const testView = view({
      id: 'v1',
      rectangles: [azA],
      items: [{ id: 'db1', tile: { x: 1, y: 1 } }]
    });

    expect(ruleIssues([devDb], testView)).toStrictEqual([]);
  });
});
