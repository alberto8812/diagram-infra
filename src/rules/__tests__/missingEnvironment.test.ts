import { ModelItem, View } from 'src/types';
import { lintView } from '../engine';
import { RULE_ID } from '../missingEnvironment';

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

describe('missing-environment', () => {
  test('flags a node with a kind but no environment', () => {
    const svc = item({ id: 'svc1', kind: 'service' });
    const testView = view({
      id: 'v1',
      items: [{ id: 'svc1', tile: { x: 0, y: 0 } }]
    });

    const issues = ruleIssues([svc], testView);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: RULE_ID,
      severity: 'info',
      viewId: 'v1',
      targets: [{ type: 'ITEM', id: 'svc1' }]
    });
  });

  test('a node with kind and environment is not flagged', () => {
    const svc = item({ id: 'svc1', kind: 'service', environment: 'dev' });
    const testView = view({
      id: 'v1',
      items: [{ id: 'svc1', tile: { x: 0, y: 0 } }]
    });

    expect(ruleIssues([svc], testView)).toStrictEqual([]);
  });

  test('a node with no kind at all is not flagged', () => {
    const plain = item({ id: 'plain1' });
    const testView = view({
      id: 'v1',
      items: [{ id: 'plain1', tile: { x: 0, y: 0 } }]
    });

    expect(ruleIssues([plain], testView)).toStrictEqual([]);
  });
});
