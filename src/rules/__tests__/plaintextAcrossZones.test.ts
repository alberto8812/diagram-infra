import { Connector, ModelItem, Rectangle, View } from 'src/types';
import { lintView } from '../engine';
import { RULE_ID } from '../plaintextAcrossZones';

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

// Two zones (in1, out1) with a node inside and a node outside, so a
// connector between them always crosses a zone boundary.
const zone = rect({
  id: 'zone1',
  zone: 'subnet',
  from: { x: 0, y: 0 },
  to: { x: 5, y: 5 }
});
const inside = item({ id: 'inside', kind: 'service' });
const outside = item({ id: 'outside', kind: 'service' });

const baseView = (connector: Connector): View => {
  return view({
    id: 'v1',
    rectangles: [zone],
    items: [
      { id: 'inside', tile: { x: 1, y: 1 } },
      { id: 'outside', tile: { x: 20, y: 20 } }
    ],
    connectors: [connector]
  });
};

describe('plaintext-across-zones', () => {
  test('flags an HTTP connector crossing a zone boundary', () => {
    const connector: Connector = {
      id: 'c1',
      protocol: 'HTTP',
      anchors: [
        { id: 'a1', ref: { item: 'outside' } },
        { id: 'a2', ref: { item: 'inside' } }
      ]
    };

    const testView = baseView(connector);
    const issues = ruleIssues([inside, outside], testView);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: RULE_ID,
      severity: 'warning',
      viewId: 'v1',
      targets: [{ type: 'CONNECTOR', id: 'c1' }]
    });
  });

  test('flags an unauthenticated SQL connector crossing a zone boundary', () => {
    const connector: Connector = {
      id: 'c1',
      protocol: 'SQL',
      auth: 'none',
      anchors: [
        { id: 'a1', ref: { item: 'outside' } },
        { id: 'a2', ref: { item: 'inside' } }
      ]
    };

    const testView = baseView(connector);
    expect(ruleIssues([inside, outside], testView)).toHaveLength(1);
  });

  test('flags an unauthenticated TCP connector crossing a zone boundary', () => {
    const connector: Connector = {
      id: 'c1',
      protocol: 'TCP',
      auth: 'none',
      anchors: [
        { id: 'a1', ref: { item: 'outside' } },
        { id: 'a2', ref: { item: 'inside' } }
      ]
    };

    const testView = baseView(connector);
    expect(ruleIssues([inside, outside], testView)).toHaveLength(1);
  });

  test('an authenticated SQL connector crossing a zone boundary is not flagged', () => {
    const connector: Connector = {
      id: 'c1',
      protocol: 'SQL',
      auth: 'iam',
      anchors: [
        { id: 'a1', ref: { item: 'outside' } },
        { id: 'a2', ref: { item: 'inside' } }
      ]
    };

    const testView = baseView(connector);
    expect(ruleIssues([inside, outside], testView)).toStrictEqual([]);
  });

  test('HTTPS crossing a zone boundary is not flagged', () => {
    const connector: Connector = {
      id: 'c1',
      protocol: 'HTTPS',
      anchors: [
        { id: 'a1', ref: { item: 'outside' } },
        { id: 'a2', ref: { item: 'inside' } }
      ]
    };

    const testView = baseView(connector);
    expect(ruleIssues([inside, outside], testView)).toStrictEqual([]);
  });

  test('an HTTP connector staying within the same zone is not flagged', () => {
    const insideB = item({ id: 'insideB', kind: 'service' });
    const connector: Connector = {
      id: 'c1',
      protocol: 'HTTP',
      anchors: [
        { id: 'a1', ref: { item: 'inside' } },
        { id: 'a2', ref: { item: 'insideB' } }
      ]
    };

    const testView = view({
      id: 'v1',
      rectangles: [zone],
      items: [
        { id: 'inside', tile: { x: 1, y: 1 } },
        { id: 'insideB', tile: { x: 2, y: 2 } }
      ],
      connectors: [connector]
    });

    expect(ruleIssues([inside, insideB], testView)).toStrictEqual([]);
  });
});
