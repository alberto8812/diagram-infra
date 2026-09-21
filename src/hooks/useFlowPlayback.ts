import { useCallback, useMemo } from 'react';
import { Connector, Flow, FlowStep } from 'src/types';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';

// Exposes the currently selected flow, its current step and the resolved
// connector for that step, plus the playback actions. It never starts a
// timer itself — a renderer (T4) drives playback forward by calling
// advance() once a step's packet animation finishes.
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

  const currentConnector: Connector | undefined = useMemo(() => {
    if (!currentStep) return undefined;

    const view = views.find((_view) => {
      return (_view.connectors ?? []).some((connector) => {
        return connector.id === currentStep.connectorId;
      });
    });

    return view?.connectors?.find((connector) => {
      return connector.id === currentStep.connectorId;
    });
  }, [views, currentStep]);

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

  return {
    flow,
    steps,
    flowPlayback,
    currentStep,
    currentConnector,
    selectFlow,
    play,
    pause,
    stop,
    nextStep,
    prevStep,
    setSpeed,
    advance
  };
};
