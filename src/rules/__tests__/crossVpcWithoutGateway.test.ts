import { Connector, ModelItem, Rectangle, View } from 'src/types';
import { lintView } from '../engine';
import { RULE_ID } from '../crossVpcWithoutGateway';

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

const vpc = rect({
  id: 'vpc1',
  zone: 'vpc',
  from: { x: 0, y: 0 },
  to: { x: 5, y: 5 }
});
const inVpc = item({ id: 'inVpc', kind: 'service' });
const outsideVpc = item({ id: 'outsideVpc', kind: 'service' });

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

describe('cross-vpc-without-gateway', () => {
  test('flags a plain connector crossing a VPC boundary', () => {
    const connector = connectorBetween('outsideVpc', 'inVpc');
    const testView = view({
      id: 'v1',
      rectangles: [vpc],
      items: [
        { id: 'inVpc', tile: { x: 1, y: 1 } },
        { id: 'outsideVpc', tile: { x: 20, y: 20 } }
      ],
      connectors: [connector]
    });

    const issues = ruleIssues([inVpc, outsideVpc], testView);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: RULE_ID,
      severity: 'warning',
      viewId: 'v1',
      targets: [{ type: 'CONNECTOR', id: 'c1' }]
    });
  });

  test('a connector with a gateway endpoint is not flagged', () => {
    const gateway = item({ id: 'gw1', kind: 'gateway' });
    const connector = connectorBetween('outsideVpc', 'gw1');
    const testView = view({
      id: 'v1',
      rectangles: [vpc],
      items: [
        { id: 'gw1', tile: { x: 1, y: 1 } },
        { id: 'outsideVpc', tile: { x: 20, y: 20 } }
      ],
      connectors: [connector]
    });

    expect(ruleIssues([gateway, outsideVpc], testView)).toStrictEqual([]);
  });

  test('a connector with a load balancer endpoint is not flagged', () => {
    const lb = item({ id: 'lb1', kind: 'loadBalancer' });
    const connector = connectorBetween('lb1', 'inVpc');
    const testView = view({
      id: 'v1',
      rectangles: [vpc],
      items: [
        { id: 'inVpc', tile: { x: 1, y: 1 } },
        { id: 'lb1', tile: { x: 20, y: 20 } }
      ],
      connectors: [connector]
    });

    expect(ruleIssues([lb, inVpc], testView)).toStrictEqual([]);
  });

  test('a connector staying inside the VPC is not flagged', () => {
    const inVpcB = item({ id: 'inVpcB', kind: 'service' });
    const connector = connectorBetween('inVpc', 'inVpcB');
    const testView = view({
      id: 'v1',
      rectangles: [vpc],
      items: [
        { id: 'inVpc', tile: { x: 1, y: 1 } },
        { id: 'inVpcB', tile: { x: 2, y: 2 } }
      ],
      connectors: [connector]
    });

    expect(ruleIssues([inVpc, inVpcB], testView)).toStrictEqual([]);
  });

  test('a connector crossing a non-VPC zone boundary is not flagged', () => {
    const subnet = rect({
      id: 'subnet1',
      zone: 'subnet',
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 }
    });
    const connector = connectorBetween('outsideVpc', 'inVpc');
    const testView = view({
      id: 'v1',
      rectangles: [subnet],
      items: [
        { id: 'inVpc', tile: { x: 1, y: 1 } },
        { id: 'outsideVpc', tile: { x: 20, y: 20 } }
      ],
      connectors: [connector]
    });

    expect(ruleIssues([inVpc, outsideVpc], testView)).toStrictEqual([]);
  });
});
