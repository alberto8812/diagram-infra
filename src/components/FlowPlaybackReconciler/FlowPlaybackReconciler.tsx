import { useCallback, useEffect, useMemo } from 'react';
import { FlowStep } from 'src/types';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { findFlowStepConnector } from 'src/utils';

// Reconciles flow playback with the model whenever the model changes
// underneath it (e.g. the selected flow, or an active step or its
// connector, was deleted). Mounted exactly once, at the Isoflow root
// (src/Isoflow.tsx), so this runs once per relevant model change rather
// than once per rendered Connector — src/hooks/useFlowPlayback.ts is used
// by every Connector on screen and previously ran this same effect from
// there (R3-reconcile-per-consumer). The pure reducer
// (flowPlaybackReducer('RECONCILE', ...) in src/utils/flowPlayback.ts)
// decides the outcome; this component only gathers the facts it needs
// (including, since T2b, the resolved Flow itself, so the reducer can
// validate a graph flow's whole active set rather than a single legacy
// stepIndex cursor) and renders nothing.
export const FlowPlaybackReconciler = () => {
  const flows = useModelStore((state) => {
    return state.flows ?? [];
  });

  const views = useModelStore((state) => {
    return state.views;
  });

  const flowPlayback = useUiStateStore((state) => {
    return state.flowPlayback;
  });

  const actions = useUiStateStore((state) => {
    return state.actions;
  });

  const flow = useMemo(() => {
    return flows.find((_flow) => {
      return _flow.id === flowPlayback.flowId;
    });
  }, [flows, flowPlayback.flowId]);

  const steps = useMemo(() => {
    return flow?.steps ?? [];
  }, [flow]);

  const findConnector = useCallback(
    (step: FlowStep | undefined) => {
      return findFlowStepConnector(views, step);
    },
    [views]
  );

  // Every currently active step id whose step still exists in the flow and
  // whose connector still resolves. Precise per id (unlike the pre-T2b
  // single stepIndex-derived boolean), which matters now that a graph flow
  // can have more than one step active at once.
  const activeConnectorStepIds = useMemo(() => {
    if (flow === undefined) return [];

    return flowPlayback.activeStepIds.filter((id) => {
      const step = steps.find((_step) => {
        return _step.id === id;
      });

      return step !== undefined && findConnector(step) !== undefined;
    });
  }, [flow, steps, flowPlayback.activeStepIds, findConnector]);

  useEffect(() => {
    if (flowPlayback.flowId === null) return;

    const flowExists = flow !== undefined;
    const stepsCount = steps.length;

    actions.reconcile(stepsCount, flowExists, activeConnectorStepIds, flow);
  }, [actions, flow, steps, flowPlayback.flowId, activeConnectorStepIds]);

  return null;
};
