// Pure state-transition logic for flow playback. Kept free of React and the
// stores so it can be unit tested in isolation; src/stores/uiStateStore.tsx
// calls flowPlaybackReducer from its actions, and
// src/hooks/useFlowPlayback.ts is the React-facing wrapper.
import { Flow, FlowPlayback, FlowStep } from 'src/types';
import {
  DEFAULT_FLOW_STEP_DURATION_MS,
  MAX_FLOW_PLAYBACK_HISTORY
} from 'src/config';
import { clamp } from './common';
import { getFlowStartSteps, resolveNextSteps } from './flow';

export type FlowPlaybackAction =
  | { type: 'SELECT_FLOW'; flowId: string | null }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'ADVANCE'; stepId: string }
  | {
      type: 'RECONCILE';
      flowExists: boolean;
      stepsCount: number;
      // Which of the *currently active* step ids still resolve to a real
      // connector. Anything active but missing from this list is dropped.
      // See the `reconcile` action in src/stores/uiStateStore.tsx for why
      // this can't always be a precise per-step answer.
      activeConnectorStepIds: string[];
    };

// Kept for src/components/FlowPlaybackReconciler/FlowPlaybackReconciler.tsx,
// which still clamps a plain index (it predates T2's active-step-id set and
// is out of scope for this change).
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

// Backward-compat projection of a step id's position in `flow.steps`, for
// FlowPlayback.stepIndex (see src/types/ui.ts). Returns 0 when it can't be
// resolved (no flow, or the id isn't a step of it) rather than -1, so a
// legacy consumer indexing `steps[stepIndex]` never goes out of bounds.
const stepIndexOf = (
  flow: Flow | undefined,
  stepId: string | undefined
): number => {
  if (!flow || stepId === undefined) return 0;

  const index = flow.steps.findIndex((step) => {
    return step.id === stepId;
  });

  return index === -1 ? 0 : index;
};

// Orders a set of step ids the way FlowPlayback.activeStepIds promises to:
// array order of the flow's steps, not insertion/Set-iteration order. This
// is also what makes "the first active step" (useFlowPlayback's
// backward-compat `currentStep`) a stable, meaningful notion.
const orderByFlow = (flow: Flow, ids: Set<string>): string[] => {
  return flow.steps
    .filter((step) => {
      return ids.has(step.id);
    })
    .map((step) => {
      return step.id;
    });
};

// Every step reachable (via resolveNextSteps) from `originIds`, plus the
// origins themselves. Iterative and cycle-safe (a `seen` guard), since a
// failure branch can retry by pointing back at an earlier step.
const resolveInFlight = (flow: Flow, originIds: string[]): Set<string> => {
  const seen = new Set<string>();
  const pending = [...originIds];

  while (pending.length > 0) {
    const id = pending.pop() as string;

    if (!seen.has(id)) {
      seen.add(id);

      resolveNextSteps(flow, id).forEach((step) => {
        if (!seen.has(step.id)) pending.push(step.id);
      });
    }
  }

  return seen;
};

// Every step that lists `stepId` as a successor (works for both graph and
// list flows, since resolveNextSteps already knows the array-order fallback
// for a list flow).
const predecessorsOf = (flow: Flow, stepId: string): string[] => {
  return flow.steps
    .filter((step) => {
      return resolveNextSteps(flow, step.id).some((successor) => {
        return successor.id === stepId;
      });
    })
    .map((step) => {
      return step.id;
    });
};

// The join at the heart of ADVANCE/NEXT_STEP: given the steps still active
// and the ones that just arrived, returns the new active set.
//
// A step arrives, leaves the active set, and its successors (resolveNextSteps)
// are candidates to start. A successor starts unless some OTHER predecessor
// of it can still reach it - that's the join: a diamond (A -> B and C, both
// -> D) only starts D once both B and C have arrived, because until then the
// other branch is still "in flight" and could still feed D.
//
// "Still in flight" is deliberately narrower than "every other predecessor,
// full stop": it's the steps still active (after removing every step
// arriving in this same batch) plus everything reachable forward from them.
// `next` alone can only express a fork, not a condition, so a branch that
// was never actually taken (its predecessor already left the active set, or
// was dropped by RECONCILE, and nothing else can still reach it) is not "in
// flight" and must never block a join - otherwise playback would hang
// forever waiting for an arrival that can no longer happen.
const advanceActiveSteps = (
  flow: Flow,
  activeStepIds: string[],
  arrivedStepIds: string[]
): string[] => {
  const arrived = new Set(arrivedStepIds);
  const remaining = activeStepIds.filter((id) => {
    return !arrived.has(id);
  });
  const inFlight = resolveInFlight(flow, remaining);

  const nextActive = new Set(remaining);

  arrivedStepIds.forEach((arrivedId) => {
    resolveNextSteps(flow, arrivedId).forEach((successor) => {
      const isBlocked = predecessorsOf(flow, successor.id).some(
        (predecessorId) => {
          return predecessorId !== arrivedId && inFlight.has(predecessorId);
        }
      );

      if (!isBlocked) {
        nextActive.add(successor.id);
      }
    });
  });

  return orderByFlow(flow, nextActive);
};

const pushHistory = (
  history: string[][],
  activeStepIds: string[]
): string[][] => {
  const next = [...history, activeStepIds];

  if (next.length > MAX_FLOW_PLAYBACK_HISTORY) {
    return next.slice(next.length - MAX_FLOW_PLAYBACK_HISTORY);
  }

  return next;
};

// Given the current playback state, an action and the currently selected
// flow (undefined when none is selected, or when the caller has no way to
// resolve it - see the RECONCILE case and src/stores/uiStateStore.tsx),
// returns the next playback state.
export const flowPlaybackReducer = (
  state: FlowPlayback,
  action: FlowPlaybackAction,
  flow: Flow | undefined = undefined
): FlowPlayback => {
  switch (action.type) {
    case 'SELECT_FLOW': {
      const startSteps = flow ? getFlowStartSteps(flow) : [];
      const activeStepIds = startSteps.map((step) => {
        return step.id;
      });

      return {
        flowId: action.flowId,
        status: 'IDLE',
        activeStepIds,
        stepIndex: stepIndexOf(flow, activeStepIds[0]),
        speed: state.speed,
        history: []
      };
    }

    case 'PLAY':
      if (state.activeStepIds.length === 0) return state;

      return { ...state, status: 'PLAYING' };

    case 'PAUSE':
      if (state.status !== 'PLAYING') return state;

      return { ...state, status: 'PAUSED' };

    case 'STOP': {
      const startSteps = flow ? getFlowStartSteps(flow) : [];
      const activeStepIds = startSteps.map((step) => {
        return step.id;
      });

      return {
        ...state,
        status: 'IDLE',
        activeStepIds,
        stepIndex: stepIndexOf(flow, activeStepIds[0]),
        history: []
      };
    }

    case 'NEXT_STEP': {
      if (!flow || state.activeStepIds.length === 0) {
        return { ...state, status: 'PAUSED' };
      }

      const nextActiveStepIds = advanceActiveSteps(
        flow,
        state.activeStepIds,
        state.activeStepIds
      );

      return {
        ...state,
        status: 'PAUSED',
        activeStepIds: nextActiveStepIds,
        stepIndex:
          nextActiveStepIds.length > 0
            ? stepIndexOf(flow, nextActiveStepIds[0])
            : state.stepIndex,
        history: pushHistory(state.history, state.activeStepIds)
      };
    }

    case 'PREV_STEP': {
      if (state.history.length === 0) {
        return { ...state, status: 'PAUSED' };
      }

      const history = [...state.history];
      const previousActiveStepIds = history.pop() as string[];

      return {
        ...state,
        status: 'PAUSED',
        activeStepIds: previousActiveStepIds,
        stepIndex: stepIndexOf(flow, previousActiveStepIds[0]),
        history
      };
    }

    case 'SET_SPEED':
      return {
        ...state,
        speed: action.speed > 0 ? action.speed : state.speed
      };

    case 'ADVANCE': {
      if (!flow || flow.steps.length === 0) {
        return {
          ...state,
          status: 'IDLE',
          activeStepIds: [],
          stepIndex: 0,
          history: []
        };
      }

      const nextActiveStepIds = advanceActiveSteps(flow, state.activeStepIds, [
        action.stepId
      ]);

      return {
        ...state,
        status: nextActiveStepIds.length === 0 ? 'IDLE' : state.status,
        activeStepIds: nextActiveStepIds,
        stepIndex:
          nextActiveStepIds.length > 0
            ? stepIndexOf(flow, nextActiveStepIds[0])
            : state.stepIndex,
        history: pushHistory(state.history, state.activeStepIds)
      };
    }

    // Reconciles playback with the model after it changes underneath it
    // (src/hooks/useFlowPlayback.ts and
    // src/components/FlowPlaybackReconciler/FlowPlaybackReconciler.tsx
    // trigger this). Never touches an unselected playback (flowId === null).
    case 'RECONCILE': {
      if (state.flowId === null) return state;

      if (!action.flowExists) {
        return {
          flowId: null,
          status: 'IDLE',
          activeStepIds: [],
          stepIndex: 0,
          speed: state.speed,
          history: []
        };
      }

      if (action.stepsCount === 0) {
        if (state.status === 'IDLE' && state.activeStepIds.length === 0) {
          return state;
        }

        return {
          ...state,
          status: 'IDLE',
          activeStepIds: [],
          stepIndex: 0,
          history: []
        };
      }

      const stepsById = flow
        ? new Map(
            flow.steps.map((step) => {
              return [step.id, step];
            })
          )
        : null;

      const survivingStepIds = state.activeStepIds.filter((id) => {
        const stepStillExists = stepsById ? stepsById.has(id) : true;
        const connectorStillExists = action.activeConnectorStepIds.includes(id);

        return stepStillExists && connectorStillExists;
      });

      if (survivingStepIds.length === state.activeStepIds.length) {
        return state;
      }

      if (survivingStepIds.length > 0) {
        const activeStepIds = flow
          ? orderByFlow(flow, new Set(survivingStepIds))
          : survivingStepIds;

        return {
          ...state,
          activeStepIds,
          stepIndex: stepIndexOf(flow, activeStepIds[0]),
          history: []
        };
      }

      // Every active step was dropped. Re-seed from the flow's entry points
      // when we can resolve them; the flow is still selected, so this is
      // "restart from the beginning", the same as STOP, rather than losing
      // the selection outright. Without a Flow to resolve entry points from
      // (the legacy FlowPlaybackReconciler.tsx call path - see the
      // `reconcile` action in src/stores/uiStateStore.tsx) this can only go
      // IDLE and freeze `stepIndex` at its last value, same as before T2.
      const startSteps = flow ? getFlowStartSteps(flow) : [];
      const activeStepIds = startSteps.map((step) => {
        return step.id;
      });

      return {
        ...state,
        status: 'IDLE',
        activeStepIds,
        stepIndex:
          activeStepIds.length > 0
            ? stepIndexOf(flow, activeStepIds[0])
            : state.stepIndex,
        history: []
      };
    }

    default:
      return state;
  }
};
