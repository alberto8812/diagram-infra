import { ModelItem, View } from 'src/types';
import { lintView } from '../engine';
import { RULE_ID } from '../prodWithoutOwner';

const item = (
  overrides: Partial<ModelItem> & Pick<ModelItem, 'id'>
): ModelItem => {
  return { name: overrides.id, ...overrides };
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

describe('prod-without-owner', () => {
  test('flags a prod node with no owner', () => {
    const svc = item({ id: 'svc1', kind: 'service', environment: 'prod' });
    const testView = view({
      id: 'v1',
      items: [{ id: 'svc1', tile: { x: 0, y: 0 } }]
    });

    const issues = ruleIssues([svc], testView);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: RULE_ID,
      severity: 'warning',
      viewId: 'v1',
      targets: [{ type: 'ITEM', id: 'svc1' }]
    });
    expect(issues[0].message).toBe(
      '"svc1" is a prod resource with no owner set.'
    );
  });

  test('a prod node with an owner is not flagged', () => {
    const svc = item({
      id: 'svc1',
      kind: 'service',
      environment: 'prod',
      owner: 'platform-team'
    });
    const testView = view({
      id: 'v1',
      items: [{ id: 'svc1', tile: { x: 0, y: 0 } }]
    });

    expect(ruleIssues([svc], testView)).toStrictEqual([]);
  });

  test('a dev/test node with no owner is not flagged', () => {
    const dev = item({ id: 'svc1', kind: 'service', environment: 'dev' });
    const test = item({ id: 'svc2', kind: 'service', environment: 'test' });
    const testView = view({
      id: 'v1',
      items: [
        { id: 'svc1', tile: { x: 0, y: 0 } },
        { id: 'svc2', tile: { x: 1, y: 1 } }
      ]
    });

    expect(ruleIssues([dev, test], testView)).toStrictEqual([]);
  });
});
