import { Connector, ModelItem, View } from 'src/types';
import { lintView } from '../engine';
import { RULE_ID } from '../sensitiveFlowUnencrypted';

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

const sensitiveDb = item({
  id: 'db1',
  kind: 'database',
  dataClassification: 'confidential'
});
const svc = item({ id: 'svc1', kind: 'service' });

const baseView = (connector: Connector): View => {
  return view({
    id: 'v1',
    items: [
      { id: 'db1', tile: { x: 0, y: 0 } },
      { id: 'svc1', tile: { x: 5, y: 5 } }
    ],
    connectors: [connector]
  });
};

describe('sensitive-flow-unencrypted', () => {
  test('flags a flow to a confidential node with no encryption signal at all', () => {
    const connector: Connector = {
      id: 'c1',
      anchors: [
        { id: 'a1', ref: { item: 'svc1' } },
        { id: 'a2', ref: { item: 'db1' } }
      ]
    };

    const issues = ruleIssues([sensitiveDb, svc], baseView(connector));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: RULE_ID,
      severity: 'warning',
      viewId: 'v1',
      targets: [{ type: 'CONNECTOR', id: 'c1' }]
    });
  });

  test('flags an explicitly unencrypted flow to a restricted node', () => {
    const restricted = item({
      id: 'db1',
      kind: 'database',
      dataClassification: 'restricted'
    });
    const connector: Connector = {
      id: 'c1',
      encryptedInTransit: false,
      anchors: [
        { id: 'a1', ref: { item: 'svc1' } },
        { id: 'a2', ref: { item: 'db1' } }
      ]
    };

    expect(ruleIssues([restricted, svc], baseView(connector))).toHaveLength(1);
  });

  test('an HTTPS flow to a confidential node (encrypted) is not flagged', () => {
    const connector: Connector = {
      id: 'c1',
      protocol: 'HTTPS',
      anchors: [
        { id: 'a1', ref: { item: 'svc1' } },
        { id: 'a2', ref: { item: 'db1' } }
      ]
    };

    expect(ruleIssues([sensitiveDb, svc], baseView(connector))).toStrictEqual(
      []
    );
  });

  test('a flow between two non-sensitive nodes is not flagged', () => {
    const svc2 = item({ id: 'db1', kind: 'service' });
    const connector: Connector = {
      id: 'c1',
      anchors: [
        { id: 'a1', ref: { item: 'svc1' } },
        { id: 'a2', ref: { item: 'db1' } }
      ]
    };

    expect(ruleIssues([svc2, svc], baseView(connector))).toStrictEqual([]);
  });
});
