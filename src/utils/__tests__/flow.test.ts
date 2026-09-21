import { Connector, FlowStep, ModelItem, View } from 'src/types';
import {
  findFlowStepConnector,
  getConnectorEndpointLabel,
  buildReturnPathSteps,
  getMissingReturnPathSteps
} from '../flow';

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

describe('getConnectorEndpointLabel() works correctly', () => {
  const items: Pick<ModelItem, 'id' | 'name'>[] = [
    { id: 'item1', name: 'Client' },
    { id: 'item2', name: 'Server' }
  ];

  test('labels a connector by its endpoint item names', () => {
    const conn = connector('conn1', [
      { id: 'a1', ref: { item: 'item1' } },
      { id: 'a2', ref: { item: 'item2' } }
    ]);

    expect(getConnectorEndpointLabel(conn, items)).toBe('Client -> Server');
  });

  test('falls back to "?" for a tile anchor or an unresolved item', () => {
    const conn = connector('conn1', [
      { id: 'a1', ref: { tile: { x: 0, y: 0 } } },
      { id: 'a2', ref: { item: 'missing' } }
    ]);

    expect(getConnectorEndpointLabel(conn, items)).toBe('? -> ?');
  });

  test('returns a fallback label when the connector has no anchors', () => {
    expect(getConnectorEndpointLabel(connector('conn1', []), items)).toBe(
      'Unnamed connector'
    );
  });
});

describe('buildReturnPathSteps() works correctly', () => {
  const makeCounter = () => {
    let n = 0;
    return () => {
      n += 1;
      return `generated-${n}`;
    };
  };

  test('appends a RESPONSE step per REQUEST step, in reverse order', () => {
    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST' },
      { id: 's2', connectorId: 'conn2', direction: 'REQUEST', label: 'call' }
    ];

    expect(buildReturnPathSteps(steps, makeCounter())).toStrictEqual([
      {
        id: 'generated-1',
        connectorId: 'conn2',
        direction: 'RESPONSE',
        label: 'call'
      },
      { id: 'generated-2', connectorId: 'conn1', direction: 'RESPONSE' }
    ]);
  });

  test('ignores existing RESPONSE steps', () => {
    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST' },
      { id: 's2', connectorId: 'conn1', direction: 'RESPONSE' }
    ];

    expect(buildReturnPathSteps(steps, makeCounter())).toStrictEqual([
      { id: 'generated-1', connectorId: 'conn1', direction: 'RESPONSE' }
    ]);
  });

  test('returns an empty array when there are no REQUEST steps', () => {
    expect(buildReturnPathSteps([], makeCounter())).toStrictEqual([]);
  });

  test('carries over durationMs when present', () => {
    const steps: FlowStep[] = [
      {
        id: 's1',
        connectorId: 'conn1',
        direction: 'REQUEST',
        durationMs: 500
      }
    ];

    expect(buildReturnPathSteps(steps, makeCounter())).toStrictEqual([
      {
        id: 'generated-1',
        connectorId: 'conn1',
        direction: 'RESPONSE',
        durationMs: 500
      }
    ]);
  });
});

describe('getMissingReturnPathSteps() works correctly', () => {
  const makeCounter = () => {
    let n = 0;
    return () => {
      n += 1;
      return `generated-${n}`;
    };
  };

  test('returns the full return path when none exists yet', () => {
    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST' },
      { id: 's2', connectorId: 'conn2', direction: 'REQUEST', label: 'call' }
    ];

    expect(getMissingReturnPathSteps(steps, makeCounter())).toStrictEqual(
      buildReturnPathSteps(steps, makeCounter())
    );
  });

  test('returns nothing once the return path is already fully mirrored (idempotent)', () => {
    const requestSteps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST' },
      { id: 's2', connectorId: 'conn2', direction: 'REQUEST', label: 'call' }
    ];
    const firstReturnPath = buildReturnPathSteps(requestSteps, makeCounter());
    const steps = [...requestSteps, ...firstReturnPath];

    expect(getMissingReturnPathSteps(steps, makeCounter())).toStrictEqual([]);
  });

  test('adds only the still-missing steps when the return path is partial', () => {
    const requestSteps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST' },
      { id: 's2', connectorId: 'conn2', direction: 'REQUEST' }
    ];
    // Only the first mirrored step (for conn2, mirrored first since steps
    // are reversed) was added so far.
    const steps: FlowStep[] = [
      ...requestSteps,
      { id: 's3', connectorId: 'conn2', direction: 'RESPONSE' }
    ];

    expect(getMissingReturnPathSteps(steps, makeCounter())).toStrictEqual([
      { id: 'generated-1', connectorId: 'conn1', direction: 'RESPONSE' }
    ]);
  });

  test('returns an empty array when there are no REQUEST steps', () => {
    expect(getMissingReturnPathSteps([], makeCounter())).toStrictEqual([]);
  });
});
