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

  // The steps currently "in flight", in flow order (see
  // FlowPlayback.activeStepIds, src/types/ui.ts). A list flow never has
  // more than one.
  const activeSteps: FlowStep[] = useMemo(() => {
    return flowPlayback.activeStepIds.reduce<FlowStep[]>((resolved, id) => {
      const step = steps.find((_step) => {
        return _step.id === id;
      });

      return step ? [...resolved, step] : resolved;
    }, []);
  }, [flowPlayback.activeStepIds, steps]);

  // `currentStep`/`currentConnector` are the first active step (and its
  // connector) - every existing consumer (Connector.tsx, FlowPlaybackBar.tsx,
  // FlowPlaybackReconciler.tsx) was written against a single current step,
  // and for a list flow there is never more than one active step, so this
  // is exactly the old behaviour. When `activeSteps` is empty (a run just
  // finished, or a reconcile couldn't reseed - see
  // src/utils/flowPlayback.ts), fall back to the frozen
  // `flowPlayback.stepIndex` so a finished flow keeps showing its last step
  // instead of nothing, matching the pre-T2 ADVANCE behaviour of leaving
  // stepIndex at `stepsCount - 1` rather than clearing it.
  const currentStep: FlowStep | undefined =
    activeSteps[0] ?? steps[flowPlayback.stepIndex];

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
      const targetFlow = flows.find((_flow) => {
        return _flow.id === flowId;
      });

      actions.selectFlow(flowId, targetFlow);
    },
    [actions, flows]
  );

  const play = useCallback(() => {
    actions.play(flow);
  }, [actions, flow]);

  const pause = useCallback(() => {
    actions.pause();
  }, [actions]);

  const stop = useCallback(() => {
    actions.stop(flow);
  }, [actions, flow]);

  const nextStep = useCallback(() => {
    actions.nextStep(flow);
  }, [actions, flow]);

  const prevStep = useCallback(() => {
    actions.prevStep(flow);
  }, [actions, flow]);

  const setSpeed = useCallback(
    (speed: number) => {
      actions.setSpeed(speed);
    },
    [actions]
  );

  // Called by the renderer when the current step's animation completes.
  // Dispatches the id of the first active step, so behaviour is unchanged
  // for a list flow (there is only ever one). T3, which renders a packet
  // per active step rather than gating on a single current one, will pass
  // the real arriving step's id instead.
  const advance = useCallback(() => {
    const arrivedStepId = activeSteps[0]?.id;

    if (arrivedStepId === undefined) return;

    actions.advance(flow, arrivedStepId);
  }, [actions, flow, activeSteps]);

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
    activeSteps,
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
