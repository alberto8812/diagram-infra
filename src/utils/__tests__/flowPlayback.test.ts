import { FlowPlayback } from 'src/types';
import {
  clampStepIndex,
  getStepDurationMs,
  flowPlaybackReducer
} from '../flowPlayback';

const idleState: FlowPlayback = {
  flowId: null,
  status: 'IDLE',
  stepIndex: 0,
  speed: 1
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
  test('SELECT_FLOW resets to step 0 and IDLE, keeps speed', () => {
    const state: FlowPlayback = {
      flowId: 'flow1',
      status: 'PLAYING',
      stepIndex: 3,
      speed: 2
    };

    const next = flowPlaybackReducer(state, {
      type: 'SELECT_FLOW',
      flowId: 'flow2'
    });

    expect(next).toStrictEqual({
      flowId: 'flow2',
      status: 'IDLE',
      stepIndex: 0,
      speed: 2
    });
  });

  test('PLAY starts playback when there are steps', () => {
    const next = flowPlaybackReducer(idleState, { type: 'PLAY' }, 3);

    expect(next.status).toBe('PLAYING');
  });

  test('PLAY is a no-op for an empty flow', () => {
    const next = flowPlaybackReducer(idleState, { type: 'PLAY' }, 0);

    expect(next).toStrictEqual(idleState);
  });

  test('PAUSE only takes effect while playing', () => {
    const playing: FlowPlayback = { ...idleState, status: 'PLAYING' };

    expect(flowPlaybackReducer(playing, { type: 'PAUSE' }, 3).status).toBe(
      'PAUSED'
    );
    expect(flowPlaybackReducer(idleState, { type: 'PAUSE' }, 3)).toStrictEqual(
      idleState
    );
  });

  test('STOP resets to step 0 and IDLE', () => {
    const playing: FlowPlayback = {
      flowId: 'flow1',
      status: 'PLAYING',
      stepIndex: 2,
      speed: 1
    };

    const next = flowPlaybackReducer(playing, { type: 'STOP' }, 3);

    expect(next).toStrictEqual({
      flowId: 'flow1',
      status: 'IDLE',
      stepIndex: 0,
      speed: 1
    });
  });

  test('NEXT_STEP advances and clamps at the last step', () => {
    const state: FlowPlayback = { ...idleState, stepIndex: 1 };

    const next = flowPlaybackReducer(state, { type: 'NEXT_STEP' }, 3);
    expect(next.stepIndex).toBe(2);
    expect(next.status).toBe('PAUSED');

    const clamped = flowPlaybackReducer(next, { type: 'NEXT_STEP' }, 3);
    expect(clamped.stepIndex).toBe(2);
  });

  test('PREV_STEP retreats and clamps at 0', () => {
    const state: FlowPlayback = { ...idleState, stepIndex: 1 };

    const next = flowPlaybackReducer(state, { type: 'PREV_STEP' }, 3);
    expect(next.stepIndex).toBe(0);
    expect(next.status).toBe('PAUSED');

    const clamped = flowPlaybackReducer(next, { type: 'PREV_STEP' }, 3);
    expect(clamped.stepIndex).toBe(0);
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
      stepIndex: 0,
      speed: 1
    };

    const next = flowPlaybackReducer(playing, { type: 'ADVANCE' }, 3);

    expect(next.stepIndex).toBe(1);
    expect(next.status).toBe('PLAYING');
  });

  test('ADVANCE stops at the last step and keeps its index', () => {
    const playing: FlowPlayback = {
      flowId: 'flow1',
      status: 'PLAYING',
      stepIndex: 2,
      speed: 1
    };

    const next = flowPlaybackReducer(playing, { type: 'ADVANCE' }, 3);

    expect(next).toStrictEqual({
      flowId: 'flow1',
      status: 'IDLE',
      stepIndex: 2,
      speed: 1
    });
  });

  test('ADVANCE on an empty flow resets to step 0 and IDLE', () => {
    const playing: FlowPlayback = {
      flowId: 'flow1',
      status: 'PLAYING',
      stepIndex: 0,
      speed: 1
    };

    const next = flowPlaybackReducer(playing, { type: 'ADVANCE' }, 0);

    expect(next).toStrictEqual({
      flowId: 'flow1',
      status: 'IDLE',
      stepIndex: 0,
      speed: 1
    });
  });

  describe('RECONCILE reconciles playback with a changed model', () => {
    test('is a no-op when no flow is selected', () => {
      const next = flowPlaybackReducer(
        idleState,
        { type: 'RECONCILE', flowExists: false, connectorExists: false },
        0
      );

      expect(next).toBe(idleState);
    });

    test('resets to IDLE/null when the selected flow was deleted', () => {
      const playing: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        stepIndex: 2,
        speed: 2
      };

      const next = flowPlaybackReducer(
        playing,
        { type: 'RECONCILE', flowExists: false, connectorExists: false },
        0
      );

      expect(next).toStrictEqual({
        flowId: null,
        status: 'IDLE',
        stepIndex: 0,
        speed: 2
      });
    });

    test('stops and resets to step 0 when the flow now has no steps', () => {
      const playing: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        stepIndex: 2,
        speed: 1
      };

      const next = flowPlaybackReducer(
        playing,
        { type: 'RECONCILE', flowExists: true, connectorExists: false },
        0
      );

      expect(next).toStrictEqual({
        flowId: 'flow1',
        status: 'IDLE',
        stepIndex: 0,
        speed: 1
      });
    });

    test('clamps stepIndex when the steps array has shrunk', () => {
      const paused: FlowPlayback = {
        flowId: 'flow1',
        status: 'PAUSED',
        stepIndex: 4,
        speed: 1
      };

      const next = flowPlaybackReducer(
        paused,
        { type: 'RECONCILE', flowExists: true, connectorExists: true },
        2
      );

      expect(next).toStrictEqual({
        flowId: 'flow1',
        status: 'PAUSED',
        stepIndex: 1,
        speed: 1
      });
    });

    test("stops when the current step's connector no longer exists", () => {
      const playing: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        stepIndex: 1,
        speed: 1
      };

      const next = flowPlaybackReducer(
        playing,
        { type: 'RECONCILE', flowExists: true, connectorExists: false },
        3
      );

      expect(next).toStrictEqual({
        flowId: 'flow1',
        status: 'IDLE',
        stepIndex: 1,
        speed: 1
      });
    });

    test('is a no-op when nothing changed', () => {
      const playing: FlowPlayback = {
        flowId: 'flow1',
        status: 'PLAYING',
        stepIndex: 1,
        speed: 1
      };

      const next = flowPlaybackReducer(
        playing,
        { type: 'RECONCILE', flowExists: true, connectorExists: true },
        3
      );

      expect(next).toBe(playing);
    });
  });
});
