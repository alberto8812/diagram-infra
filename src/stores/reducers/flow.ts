import { produce } from 'immer';
import { Flow, FlowStep } from 'src/types';
import {
  getItemByIdOrThrow,
  clamp,
  hasExplicitSuccessors,
  withExplicitSuccessors,
  removeStepFromFlow
} from 'src/utils';
import { State } from './types';

export const createFlow = (newFlow: Flow, state: State): State => {
  return produce(state, (draft) => {
    if (!draft.model.flows) {
      draft.model.flows = [];
    }

    draft.model.flows.push(newFlow);
  });
};

export const updateFlow = (
  id: string,
  updates: Partial<Omit<Flow, 'id' | 'steps'>>,
  state: State
): State => {
  const flow = getItemByIdOrThrow(state.model.flows ?? [], id);

  return produce(state, (draft) => {
    const flows = draft.model.flows ?? [];
    flows[flow.index] = { ...flow.value, ...updates };
  });
};

export const deleteFlow = (id: string, state: State): State => {
  const flow = getItemByIdOrThrow(state.model.flows ?? [], id);

  return produce(state, (draft) => {
    draft.model.flows?.splice(flow.index, 1);
  });
};

export const createFlowStep = (
  { flowId, step }: { flowId: string; step: FlowStep },
  state: State
): State => {
  const flow = getItemByIdOrThrow(state.model.flows ?? [], flowId);

  return produce(state, (draft) => {
    const flows = draft.model.flows ?? [];
    flows[flow.index].steps.push(step);
  });
};

export const updateFlowStep = (
  {
    flowId,
    stepId,
    updates
  }: { flowId: string; stepId: string; updates: Partial<Omit<FlowStep, 'id'>> },
  state: State
): State => {
  const flow = getItemByIdOrThrow(state.model.flows ?? [], flowId);
  const step = getItemByIdOrThrow(flow.value.steps, stepId);

  return produce(state, (draft) => {
    const flows = draft.model.flows ?? [];
    flows[flow.index].steps[step.index] = { ...step.value, ...updates };
  });
};

export const deleteFlowStep = (
  { flowId, stepId }: { flowId: string; stepId: string },
  state: State
): State => {
  const flow = getItemByIdOrThrow(state.model.flows ?? [], flowId);
  // Only used to preserve the existing "missing step" throw behaviour — the
  // actual removal (and closing the chain around the gap) is delegated to
  // removeStepFromFlow below.
  getItemByIdOrThrow(flow.value.steps, stepId);

  return produce(state, (draft) => {
    const flows = draft.model.flows ?? [];
    flows[flow.index].steps = removeStepFromFlow(
      flows[flow.index].steps,
      stepId
    );
  });
};

// Sets one step's successors. If the flow is still a pure list (see
// hasExplicitSuccessors, src/utils/flow.ts), every other step is backfilled
// first via withExplicitSuccessors so they keep chaining in their existing
// array order instead of becoming dead ends the instant this step opts into
// `next` — see withExplicitSuccessors' own comment for why that backfill is
// mandatory the moment any one step gets an explicit successor. If the flow
// already declares successors anywhere, no backfill happens: only the named
// step is touched, so a step some other step already left terminal (no
// `next`, deliberately) stays terminal instead of being silently rewired.
export const setFlowStepSuccessors = (
  { flowId, stepId, next }: { flowId: string; stepId: string; next: string[] },
  state: State
): State => {
  const flow = getItemByIdOrThrow(state.model.flows ?? [], flowId);
  getItemByIdOrThrow(flow.value.steps, stepId);

  return produce(state, (draft) => {
    const flows = draft.model.flows ?? [];
    const currentSteps = flows[flow.index].steps;

    // Decided against the flow's steps as they are BEFORE this edit — never
    // against a version that already has `stepId`'s `next` applied — so an
    // already-graph flow is never mistaken for a list just because the step
    // being edited happens to be the one that still lacked `next`.
    const baseSteps = hasExplicitSuccessors(currentSteps)
      ? currentSteps
      : withExplicitSuccessors(currentSteps);

    flows[flow.index].steps = baseSteps.map((step) => {
      return step.id === stepId ? { ...step, next } : step;
    });
  });
};

export const reorderFlowSteps = (
  {
    flowId,
    stepId,
    toIndex
  }: { flowId: string; stepId: string; toIndex: number },
  state: State
): State => {
  const flow = getItemByIdOrThrow(state.model.flows ?? [], flowId);
  const step = getItemByIdOrThrow(flow.value.steps, stepId);

  return produce(state, (draft) => {
    const flows = draft.model.flows ?? [];
    const { steps } = flows[flow.index];
    const clampedIndex = clamp(toIndex, 0, steps.length - 1);

    steps.splice(step.index, 1);
    steps.splice(clampedIndex, 0, step.value);
  });
};
