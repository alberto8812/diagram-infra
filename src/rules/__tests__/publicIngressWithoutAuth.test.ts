import { Connector, ModelItem, Rectangle, View } from 'src/types';
import { lintView } from '../engine';
import { RULE_ID } from '../publicIngressWithoutAuth';

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

const connectorBetween = (
  from: string,
  to: string,
  extra: Partial<Connector> = {}
): Connector => {
  return {
    id: 'c1',
    anchors: [
      { id: 'a1', ref: { item: from } },
      { id: 'a2', ref: { item: to } }
    ],
    ...extra
  };
};

describe('public-ingress-without-auth', () => {
  test('flags an unauthenticated connector from a user node', () => {
    const user = item({ id: 'user1', kind: 'user' });
    const api = item({ id: 'api1', kind: 'service' });
    const connector = connectorBetween('user1', 'api1', { auth: 'none' });

    const testView = view({
      id: 'v1',
      items: [
        { id: 'user1', tile: { x: 0, y: 0 } },
        { id: 'api1', tile: { x: 1, y: 1 } }
      ],
      connectors: [connector]
    });

    const issues = ruleIssues([user, api], testView);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: RULE_ID,
      severity: 'warning',
      viewId: 'v1',
      targets: [{ type: 'CONNECTOR', id: 'c1' }]
    });
    expect(issues[0].message).toBe(
      'Unauthenticated connection into "api1" from "user1".'
    );
  });

  test('flags an unauthenticated connector from an external node', () => {
    const external = item({ id: 'ext1', kind: 'external' });
    const api = item({ id: 'api1', kind: 'service' });
    const connector = connectorBetween('ext1', 'api1', { auth: 'none' });

    const testView = view({
      id: 'v1',
      items: [
        { id: 'ext1', tile: { x: 0, y: 0 } },
        { id: 'api1', tile: { x: 1, y: 1 } }
      ],
      connectors: [connector]
    });

    expect(ruleIssues([external, api], testView)).toHaveLength(1);
  });

  test('flags an unauthenticated connector entering a zone from outside every zone', () => {
    const subnet = rect({
      id: 'subnet1',
      zone: 'subnet',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });
    const outside = item({ id: 'outside1', kind: 'service' });
    const api = item({ id: 'api1', kind: 'service' });
    const connector = connectorBetween('outside1', 'api1', { auth: 'none' });

    const testView = view({
      id: 'v1',
      rectangles: [subnet],
      items: [
        { id: 'outside1', tile: { x: 20, y: 20 } },
        { id: 'api1', tile: { x: 1, y: 1 } }
      ],
      connectors: [connector]
    });

    const issues = ruleIssues([outside, api], testView);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe(
      'Unauthenticated connection into "api1" from outside all zones.'
    );
  });

  test('an authenticated connector from a user node is not flagged', () => {
    const user = item({ id: 'user1', kind: 'user' });
    const api = item({ id: 'api1', kind: 'service' });
    const connector = connectorBetween('user1', 'api1', { auth: 'token' });

    const testView = view({
      id: 'v1',
      items: [
        { id: 'user1', tile: { x: 0, y: 0 } },
        { id: 'api1', tile: { x: 1, y: 1 } }
      ],
      connectors: [connector]
    });

    expect(ruleIssues([user, api], testView)).toStrictEqual([]);
  });

  test('an unauthenticated connector between two internal service nodes is not flagged', () => {
    const svcA = item({ id: 'svcA', kind: 'service' });
    const svcB = item({ id: 'svcB', kind: 'service' });
    const connector = connectorBetween('svcA', 'svcB', { auth: 'none' });

    const testView = view({
      id: 'v1',
      items: [
        { id: 'svcA', tile: { x: 0, y: 0 } },
        { id: 'svcB', tile: { x: 1, y: 1 } }
      ],
      connectors: [connector]
    });

    expect(ruleIssues([svcA, svcB], testView)).toStrictEqual([]);
  });
});
