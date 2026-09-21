// Pure state-transition logic for flow playback. Kept free of React and the
// stores so it can be unit tested in isolation; src/stores/uiStateStore.tsx
// calls flowPlaybackReducer from its actions, and
// src/hooks/useFlowPlayback.ts is the React-facing wrapper.
import { FlowPlayback, FlowStep } from 'src/types';
import { DEFAULT_FLOW_STEP_DURATION_MS } from 'src/config';
import { clamp } from './common';

export type FlowPlaybackAction =
  | { type: 'SELECT_FLOW'; flowId: string | null }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'ADVANCE' };

export const clampStepIndex = (stepIndex: number, stepsCount: number) => {
  if (stepsCount <= 0) return 0;

  return clamp(stepIndex, 0, stepsCount - 1);
};

// Effective duration a renderer should animate a step for: the step's own
// durationMs (falling back to the default) scaled by the playback speed.
export const getStepDurationMs = (
  step: Pick<FlowStep, 'durationMs'> | undefined,
  speed: number
) => {
  const baseDuration = step?.durationMs ?? DEFAULT_FLOW_STEP_DURATION_MS;
  const effectiveSpeed = speed > 0 ? speed : 1;

  return baseDuration / effectiveSpeed;
};

// Given the current playback state, an action and the step count of the
// currently selected flow, returns the next playback state. `advance()` is
// the transition the renderer triggers when a step's animation completes:
// at the last step it stops playback and leaves stepIndex at
// stepsCount - 1 (rather than looping or resetting to 0), so the finished
// diagram stays visible until the user replays or picks another flow.
export const flowPlaybackReducer = (
  state: FlowPlayback,
  action: FlowPlaybackAction,
  stepsCount = 0
): FlowPlayback => {
  switch (action.type) {
    case 'SELECT_FLOW':
      return {
        flowId: action.flowId,
        status: 'IDLE',
        stepIndex: 0,
        speed: state.speed
      };

    case 'PLAY':
      if (stepsCount === 0) return state;

      return { ...state, status: 'PLAYING' };

    case 'PAUSE':
      if (state.status !== 'PLAYING') return state;

      return { ...state, status: 'PAUSED' };

    case 'STOP':
      return { ...state, status: 'IDLE', stepIndex: 0 };

    case 'NEXT_STEP':
      return {
        ...state,
        status: 'PAUSED',
        stepIndex: clampStepIndex(state.stepIndex + 1, stepsCount)
      };

    case 'PREV_STEP':
      return {
        ...state,
        status: 'PAUSED',
        stepIndex: clampStepIndex(state.stepIndex - 1, stepsCount)
      };

    case 'SET_SPEED':
      return {
        ...state,
        speed: action.speed > 0 ? action.speed : state.speed
      };

    case 'ADVANCE': {
      if (stepsCount === 0) {
        return { ...state, status: 'IDLE', stepIndex: 0 };
      }

      const isLastStep = state.stepIndex >= stepsCount - 1;

      if (isLastStep) {
        return { ...state, status: 'IDLE', stepIndex: stepsCount - 1 };
      }

      return { ...state, stepIndex: state.stepIndex + 1 };
    }

    default:
      return state;
  }
};
