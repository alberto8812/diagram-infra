import { Flow, FlowPlayback, FlowStep } from 'src/types';
import {
  clampStepIndex,
  getStepDurationMs,
  flowPlaybackReducer
} from '../flowPlayback';

const idleState: FlowPlayback = {
  flowId: null,
  status: 'IDLE',
  activeStepIds: [],
  stepIndex: 0,
  speed: 1,
  history: []
};

// A minimal step, filling in only what the reducer/its helpers look at.
const buildStep = (partial: Partial<FlowStep> & { id: string }): FlowStep => {
  return {
    connectorId: `${partial.id}-connector`,
    direction: 'REQUEST',
    ...partial
  };
};

// Three-step list flow (no step declares `next`): the successor of a step is
// simply the next one in array order, exactly like the pre-T2 model. Used to
// pin every behaviour the old index-based reducer had.
const listFlow: Flow = {
  id: 'flow1',
  name: 'List flow',
  steps: [
    buildStep({ id: 'step0' }),
    buildStep({ id: 'step1' }),
    buildStep({ id: 'step2' })
  ]
};

describe('clampStepIndex() works correctly', () => {
  test('clamps within bounds', () => {
    expect(clampStepIndex(2, 5)).toBe(2);
    expect(clampStepIndex(-1, 5)).toBe(0);
    expect(clampStepIndex(10, 5)).toBe(4);
  });

  test('returns 0 for an empty flow', () => {
    expect(clampStepIndex(3, 0)).toBe(0);
  });
});

describe('getStepDurationMs() works correctly', () => {
  test("uses the step's own duration when set", () => {
    expect(getStepDurationMs({ durationMs: 500 }, 1)).toBe(500);
  });

  test('falls back to the default duration when unset', () => {
    expect(getStepDurationMs(undefined, 1)).toBe(1200);
  });

  test('scales duration down as speed increases', () => {
    expect(getStepDurationMs({ durationMs: 1000 }, 2)).toBe(500);
  });

  test('ignores a non-positive speed instead of dividing oddly', () => {
    expect(getStepDurationMs({ durationMs: 1000 }, 0)).toBe(1000);
    expect(getStepDurationMs({ durationMs: 1000 }, -2)).toBe(1000);
  });
});

describe('flowPlaybackReducer() works correctly', () => {
  test('SELECT_FLOW seeds the entry points and resets to IDLE, keeps speed', () => {
    const state: FlowPlayback = {
      flowId: 'flow1',
      status: 'PLAYING',
      activeStepIds: ['step2'],
      stepIndex: 2,
      speed: 2,
      history: [['step0']]
    };

    const nextFlow: Flow = {
      ...listFlow,
      id: 'flow2'
    };

    const next = flowPlaybackReducer(
      state,
      { type: 'SELECT_FLOW', flowId: 'flow2' },
      nextFlow
    );

    expect(next).toStrictEqual({
      flowId: 'flow2',
      status: 'IDLE',
      activeStepIds: ['step0'],
      stepIndex: 0,
      speed: 2,
      history: []
    });
  });

  test('SELECT_FLOW with no resolvable flow yields an empty active set', () => {
    const next = flowPlaybackReducer(
      idleState,
      { type: 'SELECT_FLOW', flowId: 'flow1' },
      undefined
    );

    expect(next).toStrictEqual({
      flowId: 'flow1',
      status: 'IDLE',
      activeStepIds: [],
      stepIndex: 0,
      speed: 1,
      history: []
    });
  });

  test('PLAY starts playback when there are active steps', () => {
    const state: FlowPlayback = { ...idleState, activeStepIds: ['step0'] };
    const next = flowPlaybackReducer(state, { type: 'PLAY' }, listFlow);

    expect(next.status).toBe('PLAYING');
  });

  test('PLAY is a no-op when nothing is active', () => {
    const next = flowPlaybackReducer(idleState, { type: 'PLAY' }, listFlow);

    expect(next).toBe(idleState);
  });

  test('PAUSE only takes effect while playing', () => {
    const playing: FlowPlayback = { ...idleState, status: 'PLAYING' };

    expect(flowPlaybackReducer(playing, { type: 'PAUSE' }).status).toBe(
      'PAUSED'
    );
    expect(flowPlaybackReducer(idleState, { type: 'PAUSE' })).toStrictEqual(
      idleState
    );
  });

  test('STOP resets to the entry points and IDLE', () => {
    const playing: FlowPlayback = {
      flowId: 'flow1',
      status: 'PLAYING',
      activeStepIds: ['step2'],
      stepIndex: 2,
      speed: 1,
      history: [['step0'], ['step1']]
    };

    const next = flowPlaybackReducer(playing, { type: 'STOP' }, listFlow);

    expect(next).toStrictEqual({
      flowId: 'flow1',
      status: 'IDLE',
      activeStepIds: ['step0'],
      stepIndex: 0,
      speed: 1,
      history: []
    });
  });

  test('NEXT_STEP advances and clamps at the last step', () => {
    const state: FlowPlayback = {
      ...idleState,
      flowId: 'flow1',
      activeStepIds: ['step1'],
      stepIndex: 1
    };

    const next = flowPlaybackReducer(state, { type: 'NEXT_STEP' }, listFlow);
    expect(next.activeStepIds).toStrictEqual(['step2']);
    expect(next.stepIndex).toBe(2);
    expect(next.status).toBe('PAUSED');

    const clamped = flowPlaybackReducer(next, { type: 'NEXT_STEP' }, listFlow);
    expect(clamped.activeStepIds).toStrictEqual([]);
    expect(clamped.stepIndex).toBe(2);
    expect(clamped.status).toBe('PAUSED');
  });

  test('PREV_STEP restores the previous active set', () => {
    const start: FlowPlayback = {
      ...idleState,
      flowId: 'flow1',
      activeStepIds: ['step0'],
      stepIndex: 0
    };

    const afterNext = flowPlaybackReducer(
      start,
      { type: 'NEXT_STEP' },
      listFlow
    );
    expect(afterNext.activeStepIds).toStrictEqual(['step1']);

    const afterPrev = flowPlaybackReducer(
      afterNext,
      { type: 'PREV_STEP' },
      listFlow
    );

    expect(afterPrev.activeStepIds).toStrictEqual(['step0']);
    expect(afterPrev.stepIndex).toBe(0);
    expect(afterPrev.status).toBe('PAUSED');
    expect(afterPrev.history).toStrictEqual([]);
  });

  test('PREV_STEP is a no-op (besides pausing) with empty history', () => {
    const state: FlowPlayback = {
      ...idleState,
      flowId: 'flow1',
      activeStepIds: ['step0'],
      status: 'PLAYING'
    };

    const next = flowPlaybackReducer(state, { type: 'PREV_STEP' }, listFlow);

    expect(next).toStrictEqual({ ...state, status: 'PAUSED' });
  });

  test('SET_SPEED updates speed, ignoring non-positive values', () => {
    expect(
      flowPlaybackReducer(idleState, { type: 'SET_SPEED', speed: 2 }).speed
    ).toBe(2);
    expect(
      flowPlaybackReducer(idleState, { type: 'SET_SPEED', speed: 0 }).speed
    ).toBe(1);
    expect(
      flowPlaybackReducer(idleState, { type: 'SET_SPEED', speed: -1 }).speed
    ).toBe(1);
  });

  test('ADVANCE moves to the next step while mid-flow', () => {
    const playing: FlowPlayback = {
      flowId: 'flow1',
      status: 'PLAYING',
      activeStepIds: ['step0'],
      stepIndex: 0,
      speed: 1,
      history: []
    };

    const next = flowPlaybackReducer(
      playing,
      { type: 'ADVANCE', stepId: 'step0' },
      listFlow
    );

    expect(next.activeStepIds).toStrictEqual(['step1']);
    expect(next.stepIndex).toBe(1);
    expect(next.status).toBe('PLAYING');
    expect(next.history).toStrictEqual([['step0']]);
  });

  test('ADVANCE stops at the last step and keeps its index', () => {
    const playing: FlowPlayback = {
      flowId: 'flow1',
      status: 'PLAYING',
      activeStepIds: ['step2'],
      stepIndex: 2,
      speed: 1,
      history: []
    };

    const next = flowPlaybackReducer(
      playing,
      { type: 'ADVANCE', stepId: 'step2' },
      listFlow
    );

    expect(next).toStrictEqual({
      flowId: 'flow1',
      status: 'IDLE',
      activeStepIds: [],
      stepIndex: 2,
      speed: 1,
      history: [['step2']]
    });
  });

  test('ADVANCE on an empty flow resets to an empty active set and IDLE', () => {
    const playing: FlowPlayback = {
      flowId: 'flow1',
      status: 'PLAYING',
      activeStepIds: ['step0'],
      stepIndex: 0,
      speed: 1,
      history: []
    };

    const emptyFlow: Flow = { ...listFlow, steps: [] };

    const next = flowPlaybackReducer(
      playing,
      { type: 'ADVANCE', stepId: 'step0' },
      emptyFlow
    );

    expect(next).toStrictEqual({
      flowId: 'flow1',
      status: 'IDLE',
      activeStepIds: [],
      stepIndex: 0,
      speed: 1,
      history: []
    });
  });

  describe('a list flow plays start to finish exactly like a single cursor', () => {
    test('one active step at a time, in array order, then stops', () => {
      let state: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        activeStepIds: ['step0'],
        stepIndex: 0,
        speed: 1,
        history: []
      };

      expect(state.activeStepIds).toStrictEqual(['step0']);

      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'step0' },
        listFlow
      );
      expect(state.activeStepIds).toStrictEqual(['step1']);
      expect(state.status).toBe('PLAYING');

      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'step1' },
        listFlow
      );
      expect(state.activeStepIds).toStrictEqual(['step2']);
      expect(state.status).toBe('PLAYING');

      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'step2' },
        listFlow
      );
      expect(state.activeStepIds).toStrictEqual([]);
      expect(state.status).toBe('IDLE');
    });
  });

  describe('graph flows: forks and joins', () => {
    // A -> B, A -> C, B -> D, C -> D
    const diamondFlow: Flow = {
      id: 'diamond',
      name: 'Diamond',
      steps: [
        buildStep({ id: 'A', next: ['B', 'C'] }),
        buildStep({ id: 'B', next: ['D'] }),
        buildStep({ id: 'C', next: ['D'] }),
        buildStep({ id: 'D', next: [] })
      ]
    };

    test('a fork starts both successors', () => {
      const state: FlowPlayback = {
        flowId: 'diamond',
        status: 'PLAYING',
        activeStepIds: ['A'],
        stepIndex: 0,
        speed: 1,
        history: []
      };

      const next = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'A' },
        diamondFlow
      );

      expect(next.activeStepIds).toStrictEqual(['B', 'C']);
      expect(next.status).toBe('PLAYING');
    });

    test('the join starts only once both branches have arrived, and once', () => {
      let state: FlowPlayback = {
        flowId: 'diamond',
        status: 'PLAYING',
        activeStepIds: ['B', 'C'],
        stepIndex: 1,
        speed: 1,
        history: []
      };

      // Only B arrives: C is still in flight, so D must wait.
      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'B' },
        diamondFlow
      );
      expect(state.activeStepIds).toStrictEqual(['C']);

      // Now C arrives too: nothing else can still reach D, so it starts.
      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'C' },
        diamondFlow
      );
      expect(state.activeStepIds).toStrictEqual(['D']);

      // D was started exactly once (not twice, once per branch).
      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'D' },
        diamondFlow
      );
      expect(state.activeStepIds).toStrictEqual([]);
      expect(state.status).toBe('IDLE');
    });

    test('both branches arriving in the same batch (NEXT_STEP) starts the join once', () => {
      const state: FlowPlayback = {
        flowId: 'diamond',
        status: 'PLAYING',
        activeStepIds: ['B', 'C'],
        stepIndex: 1,
        speed: 1,
        history: []
      };

      const next = flowPlaybackReducer(
        state,
        { type: 'NEXT_STEP' },
        diamondFlow
      );

      expect(next.activeStepIds).toStrictEqual(['D']);
    });

    test('a branch that can no longer arrive does not block the join', () => {
      // C was active but its connector vanished, so RECONCILE dropped it;
      // B is still going. B arriving must not wait forever for a C that can
      // never arrive again.
      const afterReconcile = flowPlaybackReducer(
        {
          flowId: 'diamond',
          status: 'PLAYING',
          activeStepIds: ['B', 'C'],
          stepIndex: 1,
          speed: 1,
          history: []
        },
        {
          type: 'RECONCILE',
          flowExists: true,
          stepsCount: diamondFlow.steps.length,
          activeConnectorStepIds: ['B']
        },
        diamondFlow
      );

      expect(afterReconcile.activeStepIds).toStrictEqual(['B']);

      const next = flowPlaybackReducer(
        afterReconcile,
        { type: 'ADVANCE', stepId: 'B' },
        diamondFlow
      );

      expect(next.activeStepIds).toStrictEqual(['D']);
    });
  });

  describe('RECONCILE reconciles playback with a changed model', () => {
    test('is a no-op when no flow is selected', () => {
      const next = flowPlaybackReducer(
        idleState,
        {
          type: 'RECONCILE',
          flowExists: false,
          stepsCount: 0,
          activeConnectorStepIds: []
        },
        undefined
      );

      expect(next).toBe(idleState);
    });

    test('resets to IDLE/null when the selected flow was deleted', () => {
      const playing: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        activeStepIds: ['step2'],
        stepIndex: 2,
        speed: 2,
        history: [['step1']]
      };

      const next = flowPlaybackReducer(
        playing,
        {
          type: 'RECONCILE',
          flowExists: false,
          stepsCount: 0,
          activeConnectorStepIds: []
        },
        undefined
      );

      expect(next).toStrictEqual({
        flowId: null,
        status: 'IDLE',
        activeStepIds: [],
        stepIndex: 0,
        speed: 2,
        history: []
      });
    });

    test('stops and resets when the flow now has no steps', () => {
      const playing: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        activeStepIds: ['step2'],
        stepIndex: 2,
        speed: 1,
        history: [['step1']]
      };

      const next = flowPlaybackReducer(
        playing,
        {
          type: 'RECONCILE',
          flowExists: true,
          stepsCount: 0,
          activeConnectorStepIds: []
        },
        undefined
      );

      expect(next).toStrictEqual({
        flowId: 'flow1',
        status: 'IDLE',
        activeStepIds: [],
        stepIndex: 0,
        speed: 1,
        history: []
      });
    });

    test("stops and freezes stepIndex when the only active step's connector is gone and no Flow is available to reseed", () => {
      const playing: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        activeStepIds: ['step1'],
        stepIndex: 1,
        speed: 1,
        history: [['step0']]
      };

      const next = flowPlaybackReducer(
        playing,
        {
          type: 'RECONCILE',
          flowExists: true,
          stepsCount: 3,
          activeConnectorStepIds: []
        },
        undefined
      );

      expect(next).toStrictEqual({
        flowId: 'flow1',
        status: 'IDLE',
        activeStepIds: [],
        stepIndex: 1,
        speed: 1,
        history: []
      });
    });

    test('drops an active step whose connector vanished and keeps the others', () => {
      const diamondFlow: Flow = {
        id: 'diamond',
        name: 'Diamond',
        steps: [
          buildStep({ id: 'A', next: ['B', 'C'] }),
          buildStep({ id: 'B', next: ['D'] }),
          buildStep({ id: 'C', next: ['D'] }),
          buildStep({ id: 'D', next: [] })
        ]
      };

      const playing: FlowPlayback = {
        flowId: 'diamond',
        status: 'PLAYING',
        activeStepIds: ['B', 'C'],
        stepIndex: 1,
        speed: 1,
        history: [['A']]
      };

      const next = flowPlaybackReducer(
        playing,
        {
          type: 'RECONCILE',
          flowExists: true,
          stepsCount: diamondFlow.steps.length,
          activeConnectorStepIds: ['B']
        },
        diamondFlow
      );

      expect(next.activeStepIds).toStrictEqual(['B']);
      expect(next.status).toBe('PLAYING');
      expect(next.stepIndex).toBe(1);
    });

    test('re-seeds from the entry points when every active step is dropped and a Flow is available', () => {
      const playing: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        activeStepIds: ['step2'],
        stepIndex: 2,
        speed: 1,
        history: [['step1']]
      };

      const next = flowPlaybackReducer(
        playing,
        {
          type: 'RECONCILE',
          flowExists: true,
          stepsCount: listFlow.steps.length,
          activeConnectorStepIds: []
        },
        listFlow
      );

      expect(next).toStrictEqual({
        flowId: 'flow1',
        status: 'IDLE',
        activeStepIds: ['step0'],
        stepIndex: 0,
        speed: 1,
        history: []
      });
    });

    test('is a no-op when nothing changed', () => {
      const playing: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        activeStepIds: ['step1'],
        stepIndex: 1,
        speed: 1,
        history: []
      };

      const next = flowPlaybackReducer(
        playing,
        {
          type: 'RECONCILE',
          flowExists: true,
          stepsCount: 3,
          activeConnectorStepIds: ['step1']
        },
        listFlow
      );

      expect(next).toBe(playing);
    });
  });
});
