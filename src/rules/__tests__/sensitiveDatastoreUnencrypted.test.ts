import { ModelItem, View } from 'src/types';
import { lintView } from '../engine';
import { RULE_ID } from '../sensitiveDatastoreUnencrypted';

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

describe('sensitive-datastore-unencrypted', () => {
  test('flags a confidential database with no encryptedAtRest set', () => {
    const db = item({
      id: 'db1',
      kind: 'database',
      dataClassification: 'confidential'
    });

    const testView = view({
      id: 'v1',
      items: [{ id: 'db1', tile: { x: 0, y: 0 } }]
    });

    const issues = ruleIssues([db], testView);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: RULE_ID,
      severity: 'error',
      viewId: 'v1',
      targets: [{ type: 'ITEM', id: 'db1' }]
    });
  });

  test('flags a restricted cache with encryptedAtRest explicitly false', () => {
    const cache = item({
      id: 'cache1',
      kind: 'cache',
      dataClassification: 'restricted',
      encryptedAtRest: false
    });

    const testView = view({
      id: 'v1',
      items: [{ id: 'cache1', tile: { x: 0, y: 0 } }]
    });

    expect(ruleIssues([cache], testView)).toHaveLength(1);
  });

  test('a confidential storage with encryptedAtRest true is not flagged', () => {
    const storage = item({
      id: 'storage1',
      kind: 'storage',
      dataClassification: 'confidential',
      encryptedAtRest: true
    });

    const testView = view({
      id: 'v1',
      items: [{ id: 'storage1', tile: { x: 0, y: 0 } }]
    });

    expect(ruleIssues([storage], testView)).toStrictEqual([]);
  });

  test('a public/internal-classified queue is not flagged even when unencrypted', () => {
    const queue = item({
      id: 'queue1',
      kind: 'queue',
      dataClassification: 'internal'
    });

    const testView = view({
      id: 'v1',
      items: [{ id: 'queue1', tile: { x: 0, y: 0 } }]
    });

    expect(ruleIssues([queue], testView)).toStrictEqual([]);
  });

  test('a confidential service (not a data store kind) is not flagged', () => {
    const svc = item({
      id: 'svc1',
      kind: 'service',
      dataClassification: 'confidential'
    });

    const testView = view({
      id: 'v1',
      items: [{ id: 'svc1', tile: { x: 0, y: 0 } }]
    });

    expect(ruleIssues([svc], testView)).toStrictEqual([]);
  });

  test('a data store with no classification is not flagged', () => {
    const db = item({ id: 'db1', kind: 'database' });

    const testView = view({
      id: 'v1',
      items: [{ id: 'db1', tile: { x: 0, y: 0 } }]
    });

    expect(ruleIssues([db], testView)).toStrictEqual([]);
  });
});
