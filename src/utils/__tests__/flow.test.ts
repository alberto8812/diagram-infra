import { Connector, Flow, FlowStep, ModelItem, View } from 'src/types';
import {
  findFlowStepConnector,
  getConnectorEndpointLabel,
  buildReturnPathSteps,
  getMissingReturnPathSteps,
  getPacketLabel,
  resolveNextSteps,
  getFlowStartSteps
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

describe('getPacketLabel() works correctly', () => {
  test('returns the step label when it is set, ignoring the connector', () => {
    const step: Pick<FlowStep, 'label'> = { label: 'Get users' };
    const conn: Pick<Connector, 'protocol' | 'port'> = {
      protocol: 'HTTPS',
      port: 443
    };

    expect(getPacketLabel(step, conn)).toBe('Get users');
  });

  test('falls back to "protocol:port" when the step has no label', () => {
    const step: Pick<FlowStep, 'label'> = {};
    const conn: Pick<Connector, 'protocol' | 'port'> = {
      protocol: 'HTTPS',
      port: 443
    };

    expect(getPacketLabel(step, conn)).toBe('HTTPS:443');
  });

  test('falls back to just the protocol when the connector has no port', () => {
    const step: Pick<FlowStep, 'label'> = {};
    const conn: Pick<Connector, 'protocol' | 'port'> = { protocol: 'gRPC' };

    expect(getPacketLabel(step, conn)).toBe('gRPC');
  });

  test('returns undefined when neither a label nor a protocol is set', () => {
    expect(getPacketLabel({}, {})).toBeUndefined();
    expect(getPacketLabel(undefined, undefined)).toBeUndefined();
  });
});

describe('resolveNextSteps() works correctly', () => {
  const makeFlow = (steps: FlowStep[]): Flow => {
    return { id: 'flow1', name: 'Flow 1', steps };
  };

  test('a pure list flow (no step declares next) falls back to array order — backward compatibility', () => {
    const step1: FlowStep = {
      id: 's1',
      connectorId: 'conn1',
      direction: 'REQUEST'
    };
    const step2: FlowStep = {
      id: 's2',
      connectorId: 'conn2',
      direction: 'REQUEST'
    };
    const step3: FlowStep = {
      id: 's3',
      connectorId: 'conn3',
      direction: 'REQUEST'
    };
    const flow = makeFlow([step1, step2, step3]);

    expect(resolveNextSteps(flow, 's1')).toStrictEqual([step2]);
    expect(resolveNextSteps(flow, 's2')).toStrictEqual([step3]);
    expect(resolveNextSteps(flow, 's3')).toStrictEqual([]);
  });

  test('an explicit single successor overrides array order', () => {
    const step1: FlowStep = {
      id: 's1',
      connectorId: 'conn1',
      direction: 'REQUEST',
      next: ['s3']
    };
    const step2: FlowStep = {
      id: 's2',
      connectorId: 'conn2',
      direction: 'REQUEST'
    };
    const step3: FlowStep = {
      id: 's3',
      connectorId: 'conn3',
      direction: 'REQUEST'
    };
    const flow = makeFlow([step1, step2, step3]);

    expect(resolveNextSteps(flow, 's1')).toStrictEqual([step3]);
  });

  test('two declared successors are both returned, in the declared order', () => {
    const step1: FlowStep = {
      id: 's1',
      connectorId: 'conn1',
      direction: 'REQUEST',
      next: ['s3', 's2']
    };
    const step2: FlowStep = {
      id: 's2',
      connectorId: 'conn2',
      direction: 'REQUEST'
    };
    const step3: FlowStep = {
      id: 's3',
      connectorId: 'conn3',
      direction: 'REQUEST'
    };
    const flow = makeFlow([step1, step2, step3]);

    expect(resolveNextSteps(flow, 's1')).toStrictEqual([step3, step2]);
  });

  test('a dangling id in next is skipped, without throwing', () => {
    const step1: FlowStep = {
      id: 's1',
      connectorId: 'conn1',
      direction: 'REQUEST',
      next: ['missing', 's2']
    };
    const step2: FlowStep = {
      id: 's2',
      connectorId: 'conn2',
      direction: 'REQUEST'
    };
    const flow = makeFlow([step1, step2]);

    expect(resolveNextSteps(flow, 's1')).toStrictEqual([step2]);
  });

  test('returns an empty array when every id in next is dangling', () => {
    const step1: FlowStep = {
      id: 's1',
      connectorId: 'conn1',
      direction: 'REQUEST',
      next: ['missing1', 'missing2']
    };
    const flow = makeFlow([step1]);

    expect(resolveNextSteps(flow, 's1')).toStrictEqual([]);
  });

  test('a duplicated id in next resolves to the same step only once', () => {
    const step1: FlowStep = {
      id: 's1',
      connectorId: 'conn1',
      direction: 'REQUEST',
      next: ['s2', 's2']
    };
    const step2: FlowStep = {
      id: 's2',
      connectorId: 'conn2',
      direction: 'REQUEST'
    };
    const flow = makeFlow([step1, step2]);

    expect(resolveNextSteps(flow, 's1')).toStrictEqual([step2]);
  });

  test('returns an empty array for an unknown stepId', () => {
    const flow = makeFlow([
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST' }
    ]);

    expect(resolveNextSteps(flow, 'unknown')).toStrictEqual([]);
  });

  test('a cycle does not hang: resolving is one hop, not a traversal', () => {
    const stepA: FlowStep = {
      id: 'a',
      connectorId: 'conn1',
      direction: 'REQUEST',
      next: ['b']
    };
    const stepB: FlowStep = {
      id: 'b',
      connectorId: 'conn2',
      direction: 'REQUEST',
      next: ['a']
    };
    const flow = makeFlow([stepA, stepB]);

    expect(resolveNextSteps(flow, 'a')).toStrictEqual([stepB]);
    expect(resolveNextSteps(flow, 'b')).toStrictEqual([stepA]);
  });

  test('a branch can end: a success leaf with no next does not fall into another branch (reproduction)', () => {
    const req: FlowStep = {
      id: 'req',
      connectorId: 'conn1',
      direction: 'REQUEST',
      next: ['ok', 'fail']
    };
    const ok: FlowStep = {
      id: 'ok',
      connectorId: 'conn2',
      direction: 'RESPONSE'
    };
    const fail: FlowStep = {
      id: 'fail',
      connectorId: 'conn3',
      direction: 'RESPONSE',
      outcome: 'FAILURE'
    };
    const rollback: FlowStep = {
      id: 'rollback',
      connectorId: 'conn4',
      direction: 'RESPONSE'
    };
    const flow = makeFlow([req, ok, fail, rollback]);

    expect(resolveNextSteps(flow, 'ok')).toStrictEqual([]);
  });

  test('an explicit empty next in a graph flow is terminal', () => {
    const step1: FlowStep = {
      id: 's1',
      connectorId: 'conn1',
      direction: 'REQUEST',
      next: []
    };
    const step2: FlowStep = {
      id: 's2',
      connectorId: 'conn2',
      direction: 'REQUEST',
      next: ['s1']
    };
    const flow = makeFlow([step1, step2]);

    expect(resolveNextSteps(flow, 's1')).toStrictEqual([]);
  });

  test('a step with no next in a graph flow is terminal, and does not fall through to the array', () => {
    const step1: FlowStep = {
      id: 's1',
      connectorId: 'conn1',
      direction: 'REQUEST'
    };
    const step2: FlowStep = {
      id: 's2',
      connectorId: 'conn2',
      direction: 'REQUEST',
      next: ['s1']
    };
    const flow = makeFlow([step1, step2]);

    expect(resolveNextSteps(flow, 's1')).toStrictEqual([]);
  });
});

describe('getFlowStartSteps() works correctly', () => {
  const makeFlow = (steps: FlowStep[]): Flow => {
    return { id: 'flow1', name: 'Flow 1', steps };
  };

  test('returns the first step of the array', () => {
    const step1: FlowStep = {
      id: 's1',
      connectorId: 'conn1',
      direction: 'REQUEST'
    };
    const step2: FlowStep = {
      id: 's2',
      connectorId: 'conn2',
      direction: 'REQUEST'
    };
    const flow = makeFlow([step1, step2]);

    expect(getFlowStartSteps(flow)).toStrictEqual([step1]);
  });

  test('returns an empty array for a flow with no steps', () => {
    expect(getFlowStartSteps(makeFlow([]))).toStrictEqual([]);
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

  test('skips REQUEST steps whose connector is async (fire-and-forget)', () => {
    const asyncConn = connector('conn1', []);
    asyncConn.mode = 'async';
    const syncConn = connector('conn2', []);

    const views = [
      {
        id: 'view1',
        name: 'View 1',
        connectors: [asyncConn, syncConn]
      }
    ] as unknown as View[];

    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST' },
      { id: 's2', connectorId: 'conn2', direction: 'REQUEST' }
    ];

    expect(buildReturnPathSteps(steps, makeCounter(), views)).toStrictEqual([
      { id: 'generated-1', connectorId: 'conn2', direction: 'RESPONSE' }
    ]);
  });

  test('keeps existing (sync) behavior for a step whose connector has no mode', () => {
    const undefinedModeConn = connector('conn1', []);

    const views = [
      { id: 'view1', name: 'View 1', connectors: [undefinedModeConn] }
    ] as unknown as View[];

    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST' }
    ];

    expect(buildReturnPathSteps(steps, makeCounter(), views)).toStrictEqual([
      { id: 'generated-1', connectorId: 'conn1', direction: 'RESPONSE' }
    ]);
  });

  test('keeps existing (sync) behavior when views are omitted', () => {
    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST' }
    ];

    expect(buildReturnPathSteps(steps, makeCounter())).toStrictEqual([
      { id: 'generated-1', connectorId: 'conn1', direction: 'RESPONSE' }
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

  test('skips an async connector request when adding the missing return path', () => {
    const asyncConn = connector('conn1', []);
    asyncConn.mode = 'async';
    const syncConn = connector('conn2', []);

    const views = [
      {
        id: 'view1',
        name: 'View 1',
        connectors: [asyncConn, syncConn]
      }
    ] as unknown as View[];

    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST' },
      { id: 's2', connectorId: 'conn2', direction: 'REQUEST' }
    ];

    expect(
      getMissingReturnPathSteps(steps, makeCounter(), views)
    ).toStrictEqual([
      { id: 'generated-1', connectorId: 'conn2', direction: 'RESPONSE' }
    ]);
  });

  test('does not duplicate a hop whose response label was edited by the user', () => {
    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST', label: 'Edita' },
      { id: 's2', connectorId: 'conn2', direction: 'REQUEST', label: 'Push' },
      {
        id: 's3',
        connectorId: 'conn3',
        direction: 'REQUEST',
        label: 'Migra'
      },
      {
        id: 's4',
        connectorId: 'conn3',
        direction: 'RESPONSE',
        label: 'Migracion OK'
      }
    ];

    const result = getMissingReturnPathSteps(steps, makeCounter());

    expect(
      result.map((step) => {
        return step.connectorId;
      })
    ).toStrictEqual(['conn2', 'conn1']);
    expect(result).toStrictEqual([
      {
        id: 'generated-1',
        connectorId: 'conn2',
        direction: 'RESPONSE',
        label: 'Push'
      },
      {
        id: 'generated-2',
        connectorId: 'conn1',
        direction: 'RESPONSE',
        label: 'Edita'
      }
    ]);
  });

  test('stays idempotent when every mirrored response label was edited by the user', () => {
    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST', label: 'Edita' },
      { id: 's2', connectorId: 'conn2', direction: 'REQUEST', label: 'Push' },
      {
        id: 's3',
        connectorId: 'conn2',
        direction: 'RESPONSE',
        label: 'Push aceptado'
      },
      {
        id: 's4',
        connectorId: 'conn1',
        direction: 'RESPONSE',
        label: 'Edicion guardada'
      }
    ];

    expect(getMissingReturnPathSteps(steps, makeCounter())).toStrictEqual([]);
  });

  test('fills in only the missing tail hops of a partial, edited return path', () => {
    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST', label: 'Edita' },
      { id: 's2', connectorId: 'conn2', direction: 'REQUEST', label: 'Push' },
      {
        id: 's3',
        connectorId: 'conn3',
        direction: 'REQUEST',
        label: 'Migra'
      },
      {
        id: 's4',
        connectorId: 'conn3',
        direction: 'RESPONSE',
        label: 'Migracion OK'
      },
      {
        id: 's5',
        connectorId: 'conn2',
        direction: 'RESPONSE',
        label: 'Push aceptado'
      }
    ];

    expect(getMissingReturnPathSteps(steps, makeCounter())).toStrictEqual([
      {
        id: 'generated-1',
        connectorId: 'conn1',
        direction: 'RESPONSE',
        label: 'Edita'
      }
    ]);
  });

  // `durationMs` is excluded from the hop match for the same reason `label`
  // is, and without this the exclusion would be untested: every other case
  // here differs by label alone, so putting `durationMs` back into the
  // comparison would still leave them green.
  test('stays idempotent when a mirrored response duration was edited by the user', () => {
    const steps: FlowStep[] = [
      {
        id: 's1',
        connectorId: 'conn1',
        direction: 'REQUEST',
        durationMs: 1600
      },
      {
        id: 's2',
        connectorId: 'conn2',
        direction: 'REQUEST',
        durationMs: 1800
      },
      {
        id: 's3',
        connectorId: 'conn2',
        direction: 'RESPONSE',
        durationMs: 400
      },
      {
        id: 's4',
        connectorId: 'conn1',
        direction: 'RESPONSE',
        durationMs: 500
      }
    ];

    expect(getMissingReturnPathSteps(steps, makeCounter())).toStrictEqual([]);
  });

  // The negative case for the structural match: matching on connector and
  // direction must still reject a hop on another connector, otherwise any
  // trailing RESPONSE would be mistaken for the start of the return path.
  // A tail step always sits after the last REQUEST, so it is always a
  // RESPONSE — only the connector half can be exercised from here.
  test('does not treat a response on an unrelated connector as a mirrored hop', () => {
    const steps: FlowStep[] = [
      { id: 's1', connectorId: 'conn1', direction: 'REQUEST', label: 'Edita' },
      { id: 's2', connectorId: 'conn2', direction: 'REQUEST', label: 'Push' },
      {
        id: 's3',
        connectorId: 'conn9',
        direction: 'RESPONSE',
        label: 'Aviso aparte'
      }
    ];

    expect(getMissingReturnPathSteps(steps, makeCounter())).toStrictEqual([
      {
        id: 'generated-1',
        connectorId: 'conn2',
        direction: 'RESPONSE',
        label: 'Push'
      },
      {
        id: 'generated-2',
        connectorId: 'conn1',
        direction: 'RESPONSE',
        label: 'Edita'
      }
    ]);
  });
});
