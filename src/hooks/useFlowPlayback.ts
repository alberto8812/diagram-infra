import { useCallback, useEffect, useMemo } from 'react';
import { Connector, Flow, FlowStep } from 'src/types';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { clampStepIndex } from 'src/utils';

// Exposes the currently selected flow, its current step and the resolved
// connector for that step, plus the playback actions. It never starts a
// timer itself — a renderer (T4) drives playback forward by calling
// advance() once a step's packet animation finishes.
//
// It also reconciles playback with the model whenever the model changes
// underneath it (e.g. the selected flow or the current step's connector was
// deleted): see the RECONCILE effect below, which drives the pure
// flowPlaybackReducer('RECONCILE', ...) in src/utils/flowPlayback.ts.
export const useFlowPlayback = () => {
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

  const flow: Flow | undefined = useMemo(() => {
    return flows.find((_flow) => {
      return _flow.id === flowPlayback.flowId;
    });
  }, [flows, flowPlayback.flowId]);

  const steps = useMemo(() => {
    return flow?.steps ?? [];
  }, [flow]);

  const currentStep: FlowStep | undefined = steps[flowPlayback.stepIndex];

  const findConnector = useCallback(
    (step: FlowStep | undefined): Connector | undefined => {
      if (!step) return undefined;

      const view = views.find((_view) => {
        return (_view.connectors ?? []).some((connector) => {
          return connector.id === step.connectorId;
        });
      });

      return view?.connectors?.find((connector) => {
        return connector.id === step.connectorId;
      });
    },
    [views]
  );

  const currentConnector: Connector | undefined = useMemo(() => {
    return findConnector(currentStep);
  }, [findConnector, currentStep]);

  const selectFlow = useCallback(
    (flowId: string | null) => {
      actions.selectFlow(flowId);
    },
    [actions]
  );

  const play = useCallback(() => {
    actions.play(steps.length);
  }, [actions, steps.length]);

  const pause = useCallback(() => {
    actions.pause();
  }, [actions]);

  const stop = useCallback(() => {
    actions.stop();
  }, [actions]);

  const nextStep = useCallback(() => {
    actions.nextStep(steps.length);
  }, [actions, steps.length]);

  const prevStep = useCallback(() => {
    actions.prevStep(steps.length);
  }, [actions, steps.length]);

  const setSpeed = useCallback(
    (speed: number) => {
      actions.setSpeed(speed);
    },
    [actions]
  );

  // Called by the renderer when the current step's animation completes.
  const advance = useCallback(() => {
    actions.advance(steps.length);
  }, [actions, steps.length]);

  const activeNodePulse = useUiStateStore((state) => {
    return state.activeNodePulse;
  });

  const setActiveNodePulse = useCallback(
    (pulse: { nodeId: string; token: number } | null) => {
      actions.setActiveNodePulse(pulse);
    },
    [actions]
  );

  // Reconciles playback with the model whenever it changes underneath it.
  // The pure reducer (src/utils/flowPlayback.ts) decides the outcome; this
  // effect only gathers the facts it needs: does the selected flow still
  // exist, and does the step at the (clamped) current index still resolve
  // to a real connector.
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

  return {
    flow,
    steps,
    flowPlayback,
    currentStep,
    currentConnector,
    activeNodePulse,
    selectFlow,
    play,
    pause,
    stop,
    nextStep,
    prevStep,
    setSpeed,
    advance,
    setActiveNodePulse
  };
};
