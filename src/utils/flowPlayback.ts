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
      // Which of the step ids in `checkedStepIds` still resolve to a real
      // connector. Anything checked but missing from this list is dropped.
      activeConnectorStepIds: string[];
      // The active set `activeConnectorStepIds` was computed from. The caller
      // builds both during a render, so by the time this runs the live active
      // set may already have moved on; an id outside this set was never
      // examined, and its absence above says nothing about its connector.
      // Omitted by callers that have no better answer, which then means
      // "every active id was checked", the pre-T2e behaviour.
      checkedStepIds?: string[];
    };

// No longer used by FlowPlaybackReconciler.tsx as of T2b - it now reconciles
// the whole activeStepIds set against a real Flow instead of clamping a
// single legacy index (see the RECONCILE case below). Kept as a small,
// still-tested utility.
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

// The invariant this whole reducer rests on: whenever the reducer produces
// an active set (activeStepIds, or a snapshot restored from history), every
// id in it must resolve to a step of the `flow` it was handed. A stale or
// foreign id here isn't cosmetic - useFlowPlayback's activeSteps silently
// drops anything that doesn't resolve, so the id keeps sitting in
// activeStepIds forever with nothing rendered for it, ADVANCE is never
// dispatched for it, and playback never leaves PLAYING. Every branch that
// could hand the caller ids sourced from somewhere other than
// resolveNextSteps/getFlowStartSteps (a history snapshot, or an
// approximate "still resolves" list from a caller with a partial view of
// the model) must run them through this before they become the new active
// set. Returns [] when there's no flow to resolve against, since nothing
// can resolve to a flow that doesn't exist.
const resolveKnownStepIds = (
  flow: Flow | undefined,
  stepIds: string[]
): string[] => {
  if (!flow) return [];

  const knownIds = new Set(
    flow.steps.map((step) => {
      return step.id;
    })
  );

  return stepIds.filter((id) => {
    return knownIds.has(id);
  });
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

    case 'PLAY': {
      if (state.activeStepIds.length > 0) {
        return { ...state, status: 'PLAYING' };
      }

      // The active set is empty either because the run finished (ADVANCE
      // emptied it) or because NEXT_STEP stepped past the last step. Restart
      // from the flow's entry points rather than staying a dead button: this
      // is a deliberate improvement over the pre-T2 behaviour, which had no
      // notion of "the run finished" and so replayed only the last step
      // (stepIndex was simply clamped back into range). Restarting from the
      // entry points is what "play again" means for a flow that can now have
      // several entry points and several steps in flight at once, and it
      // matches STOP/RECONCILE's own notion of "the beginning". The history
      // is cleared too - the restarted run is a new run, and leaving stale
      // snapshots around would let PREV_STEP jump into the previous one.
      // Restarting only makes sense for a flow that is actually selected.
      // Without this, a PLAY carrying a flow while `flowId` is still null
      // would start animating steps that belong to no selected flow, leaving
      // `flowId: null` next to a non-empty active set — a state nothing else
      // in the reducer can reach or reconcile.
      if (state.flowId === null) return state;

      const startSteps = flow ? getFlowStartSteps(flow) : [];
      const activeStepIds = startSteps.map((step) => {
        return step.id;
      });

      // No flow, or a flow with no steps: still nothing to play, same as
      // before T2.
      if (activeStepIds.length === 0) return state;

      return {
        ...state,
        status: 'PLAYING',
        activeStepIds,
        stepIndex: stepIndexOf(flow, activeStepIds[0]),
        history: []
      };
    }

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

      const hasFinished = nextActiveStepIds.length === 0;

      return {
        ...state,
        status: 'PAUSED',
        activeStepIds: nextActiveStepIds,
        stepIndex: hasFinished
          ? state.stepIndex
          : stepIndexOf(flow, nextActiveStepIds[0]),
        // Same rule as ADVANCE: a run that just ended still shows its last
        // step, so pushing that step would make the first Prev restore what
        // is already on screen. Stepping past the end is the other way to
        // reach that state, and it needs the same answer.
        history: hasFinished
          ? state.history
          : pushHistory(state.history, state.activeStepIds)
      };
    }

    case 'PREV_STEP': {
      // A history snapshot was captured against whatever flow was selected
      // when it was pushed, which may not be `flow` any more (the flow was
      // edited, or playback was switched to a different flow and back). Pop
      // snapshots until one has a surviving step (resolveKnownStepIds), so
      // a snapshot that no longer resolves at all is skipped rather than
      // restored verbatim - restoring it would violate the invariant above
      // resolveKnownStepIds and could leave playback stuck. If the history
      // runs out before that happens, it's a no-op that pauses, same as
      // when the history was empty to begin with.
      const history = [...state.history];

      while (history.length > 0) {
        const snapshot = history.pop() as string[];
        const survivingStepIds = resolveKnownStepIds(flow, snapshot);

        if (survivingStepIds.length > 0) {
          return {
            ...state,
            status: 'PAUSED',
            activeStepIds: survivingStepIds,
            stepIndex: stepIndexOf(flow, survivingStepIds[0]),
            history
          };
        }
      }

      return { ...state, status: 'PAUSED' };
    }

    case 'SET_SPEED':
      return {
        ...state,
        speed: action.speed > 0 ? action.speed : state.speed
      };

    case 'ADVANCE': {
      // An arrival is only meaningful for a step that's currently active.
      // Without this check, a stale arrival (an animation finishing after
      // the user pressed Next) or a duplicate delivery of the same arrival
      // would run advanceActiveSteps for a step that already left the
      // active set, starting its successors a second time - see the module
      // comment above resolveKnownStepIds for why that's worse than a
      // no-op.
      if (!state.activeStepIds.includes(action.stepId)) {
        return state;
      }

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

      const hasFinished = nextActiveStepIds.length === 0;

      return {
        ...state,
        status: hasFinished ? 'IDLE' : state.status,
        activeStepIds: nextActiveStepIds,
        stepIndex: hasFinished
          ? state.stepIndex
          : stepIndexOf(flow, nextActiveStepIds[0]),
        // A finished run keeps showing its last step, because the active set
        // is empty and `stepIndex` stays where it was. Pushing that same step
        // onto the history would make the first Prev restore what is already
        // on screen, so the button would appear to do nothing until pressed
        // twice. Going back from the end means going back to the step before
        // it, which is what the history already holds.
        history: hasFinished
          ? state.history
          : pushHistory(state.history, state.activeStepIds)
      };
    }

    // Reconciles playback with the model after it changes underneath it
    // (src/components/FlowPlaybackReconciler/FlowPlaybackReconciler.tsx
    // triggers this, passing the Flow it resolved so a step deleted from
    // the model can be dropped and, if needed, entry points can be
    // re-resolved below). Never touches an unselected playback
    // (flowId === null).
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

      // resolveKnownStepIds enforces the invariant above it: a step no
      // longer in `flow` (deleted from the model) never survives, even if
      // the caller's activeConnectorStepIds still lists it. Without a Flow
      // to check against, step existence can't be judged, so it's left to
      // activeConnectorStepIds alone (the best this call site can do).
      const knownStepIds = new Set(
        resolveKnownStepIds(flow, state.activeStepIds)
      );

      // `activeConnectorStepIds` is computed during a render, from the active
      // set of that render, while this runs later against the live state. A
      // playback action landing in between leaves a newly active id absent
      // from the list for a reason that has nothing to do with its connector.
      // So absence only counts against an id the caller actually looked at:
      // `checkedStepIds` says which those were, and anything outside it is
      // left alone until the next pass examines it. Judging an unchecked id
      // by its absence would drop a live step, find no survivors, and restart
      // a running flow out of nowhere.
      const checkedStepIds = action.checkedStepIds
        ? new Set(action.checkedStepIds)
        : undefined;

      const survivingStepIds = state.activeStepIds.filter((id) => {
        const stepStillExists = flow ? knownStepIds.has(id) : true;
        const wasChecked = checkedStepIds ? checkedStepIds.has(id) : true;
        const connectorStillExists =
          !wasChecked || action.activeConnectorStepIds.includes(id);

        return stepStillExists && connectorStillExists;
      });

      if (survivingStepIds.length === state.activeStepIds.length) {
        // The active set survived intact, but `stepIndex` can still be stale:
        // a finished run leaves it frozen at the last step, and deleting
        // steps afterwards can leave it pointing past the end of the array.
        // FlowPlaybackBar reads it straight off the store for its
        // "Step N / total" label, so an unclamped value shows a position the
        // flow does not have. It stays until T3 retires the field.
        const clampedStepIndex = clampStepIndex(
          state.stepIndex,
          flow ? flow.steps.length : 0
        );

        return clampedStepIndex === state.stepIndex
          ? state
          : { ...state, stepIndex: clampedStepIndex };
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
      // the selection outright. Since T2b, FlowPlaybackReconciler.tsx always
      // resolves and hands us a Flow when one is selected, so this only
      // falls back to freezing `stepIndex` at its last value (same as
      // before T2) for a caller with no Flow to give us at all.
      const startSteps = flow ? getFlowStartSteps(flow) : [];
      const activeStepIds = startSteps.map((step) => {
        return step.id;
      });

      // Reseeding has to be idempotent, not just correct. An entry step whose
      // connector was deleted drops out of `survivingStepIds` every time,
      // reseeds to that same entry id every time, and would hand back a new
      // object every time. FlowPlaybackReconciler.tsx derives a memo from
      // `activeStepIds`, so a fresh array on each pass changes the effect's
      // dependencies, which calls reconcile again: effect, store write,
      // re-render, forever. Returning `state` when nothing actually moved is
      // what stops that, and it is the guard the pre-T2 code had.
      const isUnchanged =
        state.status === 'IDLE' &&
        state.history.length === 0 &&
        activeStepIds.length === state.activeStepIds.length &&
        activeStepIds.every((id, index) => {
          return id === state.activeStepIds[index];
        });

      if (isUnchanged) return state;

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
