import { Connector, FlowStep, View } from 'src/types';
import { findFlowStepConnector } from '../flow';

const connector = (id: string, anchors: Connector['anchors']): Connector => {
  return { id, anchors };
};

describe('findFlowStepConnector() works correctly', () => {
  const conn = connector('conn1', []);
  const views = [
    { id: 'view1', name: 'View 1', connectors: [conn] }
  ] as unknown as View[];

  test('resolves a step to its connector across views', () => {
    const step: FlowStep = {
      id: 's1',
      connectorId: 'conn1',
      direction: 'REQUEST'
    };

    expect(findFlowStepConnector(views, step)).toBe(conn);
  });

  test('returns undefined for an undefined step', () => {
    expect(findFlowStepConnector(views, undefined)).toBeUndefined();
  });

  test('returns undefined when no view has the connector', () => {
    const step: FlowStep = {
      id: 's1',
      connectorId: 'missing',
      direction: 'REQUEST'
    };

    expect(findFlowStepConnector(views, step)).toBeUndefined();
  });
});
