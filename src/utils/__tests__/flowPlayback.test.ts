import { Flow, FlowPlayback, FlowStep } from 'src/types';
import { MAX_FLOW_PLAYBACK_HISTORY } from 'src/config';
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

  test('PLAY with a non-empty active set leaves the active set alone', () => {
    const state: FlowPlayback = {
      ...idleState,
      flowId: 'flow1',
      activeStepIds: ['step1'],
      history: [['step0']]
    };

    const next = flowPlaybackReducer(state, { type: 'PLAY' }, listFlow);

    expect(next).toStrictEqual({ ...state, status: 'PLAYING' });
  });

  test('PLAY with no flow selected is still a no-op', () => {
    const next = flowPlaybackReducer(idleState, { type: 'PLAY' }, undefined);

    expect(next).toBe(idleState);
  });

  test('PLAY on a flow with no steps is still a no-op', () => {
    const emptyFlow: Flow = { id: 'flow1', name: 'Empty flow', steps: [] };
    const state: FlowPlayback = { ...idleState, flowId: 'flow1' };

    const next = flowPlaybackReducer(state, { type: 'PLAY' }, emptyFlow);

    expect(next).toBe(state);
  });

  test("PLAY after a list flow's run finishes restarts it from the entry points, PLAYING", () => {
    // Run finished: ADVANCE emptied activeStepIds, status went IDLE. History
    // carries the finished run's snapshots.
    const finished: FlowPlayback = {
      flowId: 'flow1',
      status: 'IDLE',
      activeStepIds: [],
      stepIndex: 2,
      speed: 1,
      history: [['step0'], ['step1']]
    };

    const next = flowPlaybackReducer(finished, { type: 'PLAY' }, listFlow);

    expect(next).toStrictEqual({
      flowId: 'flow1',
      status: 'PLAYING',
      activeStepIds: ['step0'],
      stepIndex: 0,
      speed: 1,
      history: []
    });
  });

  test('PLAY after NEXT_STEP moved past the last step restarts it the same way', () => {
    // NEXT_STEP past the last step: activeStepIds emptied, status PAUSED.
    const pastEnd: FlowPlayback = {
      flowId: 'flow1',
      status: 'PAUSED',
      activeStepIds: [],
      stepIndex: 2,
      speed: 1,
      history: [['step0'], ['step1'], ['step2']]
    };

    const next = flowPlaybackReducer(pastEnd, { type: 'PLAY' }, listFlow);

    expect(next).toStrictEqual({
      flowId: 'flow1',
      status: 'PLAYING',
      activeStepIds: ['step0'],
      stepIndex: 0,
      speed: 1,
      history: []
    });
  });

  test('the restart clears history, so PREV_STEP right after it does not jump into the finished run', () => {
    const finished: FlowPlayback = {
      flowId: 'flow1',
      status: 'IDLE',
      activeStepIds: [],
      stepIndex: 2,
      speed: 1,
      history: [['step0'], ['step1']]
    };

    const restarted = flowPlaybackReducer(finished, { type: 'PLAY' }, listFlow);

    const afterPrev = flowPlaybackReducer(
      restarted,
      { type: 'PREV_STEP' },
      listFlow
    );

    // No history to pop into, so PREV_STEP is a no-op that only pauses -
    // it does not jump back into the finished run's ['step1'] snapshot.
    expect(afterPrev).toStrictEqual({ ...restarted, status: 'PAUSED' });
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
      // The finished run keeps showing step2, so pushing step2's snapshot
      // would make the first PREV_STEP restore what is already on screen.
      history: []
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

  describe('ADVANCE ignores an arrival that is not currently active', () => {
    test('a step not in activeStepIds leaves state unchanged, including history', () => {
      const state: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        activeStepIds: ['step1'],
        stepIndex: 1,
        speed: 1,
        history: [['step0']]
      };

      const next = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'step0' },
        listFlow
      );

      expect(next).toBe(state);
      expect(next.history).toBe(state.history);
    });

    // A -> B, A -> C, C -> E. Reproduces a stale or duplicate arrival: C
    // finishes, then finishes again (or its arrival is delivered twice)
    // after E has already run and left the active set. The second arrival
    // for C must not restart E.
    const forkThenBranchFlow: Flow = {
      id: 'fork-then-branch',
      name: 'Fork then branch',
      steps: [
        buildStep({ id: 'A', next: ['B', 'C'] }),
        buildStep({ id: 'B', next: [] }),
        buildStep({ id: 'C', next: ['E'] }),
        buildStep({ id: 'E', next: [] })
      ]
    };

    test('a duplicate arrival does not restart a step that already finished', () => {
      let state: FlowPlayback = {
        flowId: 'fork-then-branch',
        status: 'PLAYING',
        activeStepIds: ['A'],
        stepIndex: 0,
        speed: 1,
        history: []
      };

      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'A' },
        forkThenBranchFlow
      );
      expect(state.activeStepIds).toStrictEqual(['B', 'C']);

      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'C' },
        forkThenBranchFlow
      );
      expect(state.activeStepIds).toStrictEqual(['B', 'E']);

      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'E' },
        forkThenBranchFlow
      );
      expect(state.activeStepIds).toStrictEqual(['B']);

      // A stale/duplicate arrival for C: C is not active any more, so this
      // must be a no-op rather than starting E a second time.
      const beforeDuplicate = state;
      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: 'C' },
        forkThenBranchFlow
      );

      expect(state).toBe(beforeDuplicate);
      expect(state.activeStepIds).toStrictEqual(['B']);
    });
  });

  describe('PREV_STEP skips history snapshots that no longer resolve', () => {
    test('skips a snapshot whose steps no longer exist and restores the next surviving one', () => {
      const state: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        activeStepIds: ['step1'],
        stepIndex: 1,
        speed: 1,
        history: [['step0'], ['ghost']]
      };

      const next = flowPlaybackReducer(state, { type: 'PREV_STEP' }, listFlow);

      expect(next.activeStepIds).toStrictEqual(['step0']);
      expect(next.stepIndex).toBe(0);
      expect(next.status).toBe('PAUSED');
      expect(next.history).toStrictEqual([]);
    });

    test('is a no-op that pauses when nothing in the history survives', () => {
      const state: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        activeStepIds: ['step1'],
        stepIndex: 1,
        speed: 1,
        history: [['ghost1'], ['ghost2']]
      };

      const next = flowPlaybackReducer(state, { type: 'PREV_STEP' }, listFlow);

      expect(next).toStrictEqual({ ...state, status: 'PAUSED' });
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

    // A -> B, B -> D (C was deleted from the model entirely, unlike the
    // "connector vanished" test above where the step is still in the flow).
    // A caller with an incomplete view of the model (T2b's fix in
    // src/stores/uiStateStore.tsx / FlowPlaybackReconciler.tsx makes the
    // real caller precise, but the reducer must not rely on that) might
    // still list the deleted step's id in activeConnectorStepIds - the
    // reducer drops it anyway because it no longer resolves against `flow`.
    const flowAfterStepDeleted: Flow = {
      id: 'diamond',
      name: 'Diamond',
      steps: [
        buildStep({ id: 'A', next: ['B'] }),
        buildStep({ id: 'B', next: ['D'] }),
        buildStep({ id: 'D', next: [] })
      ]
    };

    test('drops an active step deleted from the model and keeps the others', () => {
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
          stepsCount: flowAfterStepDeleted.steps.length,
          activeConnectorStepIds: ['B', 'C']
        },
        flowAfterStepDeleted
      );

      expect(next.activeStepIds).toStrictEqual(['B']);
      expect(next.status).toBe('PLAYING');
    });

    test('reseeds from the entry points when every active step was deleted from the model', () => {
      const playing: FlowPlayback = {
        flowId: 'diamond',
        status: 'PLAYING',
        activeStepIds: ['C'],
        stepIndex: 1,
        speed: 1,
        history: [['A']]
      };

      const next = flowPlaybackReducer(
        playing,
        {
          type: 'RECONCILE',
          flowExists: true,
          stepsCount: flowAfterStepDeleted.steps.length,
          activeConnectorStepIds: ['C']
        },
        flowAfterStepDeleted
      );

      expect(next).toStrictEqual({
        flowId: 'diamond',
        status: 'IDLE',
        activeStepIds: ['A'],
        stepIndex: 0,
        speed: 1,
        history: []
      });
    });

    // Identity, not just value: FlowPlaybackReconciler derives a memo from
    // activeStepIds, so a fresh array for an unchanged reconcile changes the
    // effect's dependencies and calls reconcile again, forever. An entry step
    // whose connector was deleted reproduces it, because it drops out of the
    // survivors on every pass and reseeds to the same id every pass.
    test('reseeding the same entry points returns the same state object', () => {
      const entryFlow: Flow = {
        id: 'entry-flow',
        name: 'Entry flow',
        steps: [
          buildStep({ id: 'A', next: ['B'] }),
          buildStep({ id: 'B', next: [] })
        ]
      };
      const idle: FlowPlayback = {
        flowId: 'entry-flow',
        status: 'IDLE',
        activeStepIds: ['A'],
        stepIndex: 0,
        speed: 1,
        history: []
      };
      // The entry step is still in the model, but its connector is gone, so
      // it survives nothing and reseeds right back to itself on every pass.
      const reconcileWithNoSurvivors = {
        type: 'RECONCILE' as const,
        flowExists: true,
        stepsCount: entryFlow.steps.length,
        activeConnectorStepIds: []
      };

      const first = flowPlaybackReducer(
        idle,
        reconcileWithNoSurvivors,
        entryFlow
      );
      const second = flowPlaybackReducer(
        first,
        reconcileWithNoSurvivors,
        entryFlow
      );

      expect(first).toBe(idle);
      expect(second).toBe(first);
    });
  });
});

describe('flowPlaybackReducer() caps history at MAX_FLOW_PLAYBACK_HISTORY', () => {
  test('keeps only the newest entries, oldest first', () => {
    // A 2-step cycle: X -> Y -> X. Cycle-safe traversal (resolveInFlight/
    // resolveNextSteps) lets forward transitions run indefinitely, which is
    // what's needed to push past the cap.
    const cycleFlow: Flow = {
      id: 'cycle',
      name: 'Cycle',
      steps: [
        buildStep({ id: 'X', next: ['Y'] }),
        buildStep({ id: 'Y', next: ['X'] })
      ]
    };

    let state: FlowPlayback = {
      flowId: 'cycle',
      status: 'PLAYING',
      activeStepIds: ['X'],
      stepIndex: 0,
      speed: 1,
      history: []
    };

    const totalTransitions = MAX_FLOW_PLAYBACK_HISTORY + 10;
    const pushedSnapshots: string[][] = [];

    for (let i = 0; i < totalTransitions; i += 1) {
      pushedSnapshots.push(state.activeStepIds);

      const [arrivedStepId] = state.activeStepIds;
      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId: arrivedStepId },
        cycleFlow
      );
    }

    const expectedHistory = pushedSnapshots.slice(
      pushedSnapshots.length - MAX_FLOW_PLAYBACK_HISTORY
    );

    expect(state.history).toHaveLength(MAX_FLOW_PLAYBACK_HISTORY);
    expect(state.history).toStrictEqual(expectedHistory);
  });
});

describe('flowPlaybackReducer() keeps a finished run coherent', () => {
  const finishedRunFlow: Flow = {
    id: 'list',
    name: 'List',
    steps: [
      buildStep({ id: 'a' }),
      buildStep({ id: 'b' }),
      buildStep({ id: 'c' })
    ]
  };

  // A finished run still shows its last step, because the active set is empty
  // and stepIndex stays put. Pushing that same step onto the history would
  // make the first Prev restore what is already on screen.
  test('PREV_STEP after the run finished moves back a visible step', () => {
    let state: FlowPlayback = {
      flowId: 'list',
      status: 'PLAYING',
      activeStepIds: ['a'],
      stepIndex: 0,
      speed: 1,
      history: []
    };

    ['a', 'b', 'c'].forEach((stepId) => {
      state = flowPlaybackReducer(
        state,
        { type: 'ADVANCE', stepId },
        finishedRunFlow
      );
    });

    expect(state.activeStepIds).toStrictEqual([]);
    expect(state.history).toStrictEqual([['a'], ['b']]);

    const previous = flowPlaybackReducer(
      state,
      { type: 'PREV_STEP' },
      finishedRunFlow
    );

    expect(previous.activeStepIds).toStrictEqual(['b']);
  });

  // stepIndex is frozen at the last step once a run finishes, so deleting
  // steps afterwards can leave it pointing past the end. FlowPlaybackBar
  // reads it for its "Step N / total" label.
  test('RECONCILE clamps a stepIndex left past the end of a shrunken flow', () => {
    const finished: FlowPlayback = {
      flowId: 'list',
      status: 'IDLE',
      activeStepIds: [],
      stepIndex: 2,
      speed: 1,
      history: []
    };
    const shrunken: Flow = {
      id: 'list',
      name: 'List',
      steps: [buildStep({ id: 'a' })]
    };

    const next = flowPlaybackReducer(
      finished,
      {
        type: 'RECONCILE',
        flowExists: true,
        stepsCount: shrunken.steps.length,
        activeConnectorStepIds: []
      },
      shrunken
    );

    expect(next.stepIndex).toBe(0);
  });

  // The clamp must not cost the idempotence T2d restored: an unchanged
  // reconcile has to hand back the same object, or the reconciler's effect
  // loops on a new identity.
  test('RECONCILE with an in-range stepIndex still returns the same object', () => {
    const idle: FlowPlayback = {
      flowId: 'list',
      status: 'IDLE',
      activeStepIds: ['a'],
      stepIndex: 0,
      speed: 1,
      history: []
    };

    const next = flowPlaybackReducer(
      idle,
      {
        type: 'RECONCILE',
        flowExists: true,
        stepsCount: finishedRunFlow.steps.length,
        activeConnectorStepIds: ['a']
      },
      finishedRunFlow
    );

    expect(next).toBe(idle);
  });
});
