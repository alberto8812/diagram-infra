import { produce } from 'immer';
import { Flow, FlowStep } from 'src/types';
import { getItemByIdOrThrow, clamp } from 'src/utils';
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
  const step = getItemByIdOrThrow(flow.value.steps, stepId);

  return produce(state, (draft) => {
    const flows = draft.model.flows ?? [];
    flows[flow.index].steps.splice(step.index, 1);
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
