import { useCallback, useEffect, useMemo } from 'react';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { clampStepIndex, findFlowStepConnector } from 'src/utils';

// Reconciles flow playback with the model whenever the model changes
// underneath it (e.g. the selected flow, or the current step's connector,
// was deleted). Mounted exactly once, at the Isoflow root (src/Isoflow.tsx),
// so this runs once per relevant model change rather than once per rendered
// Connector — src/hooks/useFlowPlayback.ts is used by every Connector on
// screen and previously ran this same effect from there
// (R3-reconcile-per-consumer). The pure reducer
// (flowPlaybackReducer('RECONCILE', ...) in src/utils/flowPlayback.ts)
// decides the outcome; this component only gathers the facts it needs and
// renders nothing.
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
    (step: (typeof steps)[number] | undefined) => {
      return findFlowStepConnector(views, step);
    },
    [views]
  );

  useEffect(() => {
    if (flowPlayback.flowId === null) return;

    const flowExists = flow !== undefined;
    const stepsCount = steps.length;
    const connectorExists =
      !flowExists || stepsCount === 0
        ? true
        : findConnector(
            steps[clampStepIndex(flowPlayback.stepIndex, stepsCount)]
          ) !== undefined;

    actions.reconcile(stepsCount, flowExists, connectorExists);
  }, [
    actions,
    flow,
    steps,
    flowPlayback.flowId,
    flowPlayback.stepIndex,
    findConnector
  ]);

  return null;
};
