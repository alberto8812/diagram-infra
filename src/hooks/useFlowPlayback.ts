import { useCallback, useMemo } from 'react';
import { Connector, Flow, FlowStep } from 'src/types';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { findFlowStepConnector } from 'src/utils';

// Exposes the currently selected flow, its current step and the resolved
// connector for that step, plus the playback actions. It never starts a
// timer itself — a renderer (T4) drives playback forward by calling
// advance() once a step's packet animation finishes.
//
// Model <-> playback reconciliation (e.g. the selected flow or the current
// step's connector was deleted) is *not* done here: this hook is used by
// every rendered Connector, so doing it here would re-dispatch the RECONCILE
// action once per connector on screen. See
// src/components/FlowPlaybackReconciler/FlowPlaybackReconciler.tsx, mounted
// once at the Isoflow root, for that (R3-reconcile-per-consumer).
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
      return findFlowStepConnector(views, step);
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
