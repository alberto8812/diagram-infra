// Pure, React-free helper for resolving a flow step's connector across
// views. Shared by src/hooks/useFlowPlayback.ts (per rendered Connector) and
// src/components/FlowPlaybackReconciler (the single owner of the RECONCILE
// effect), so both resolve a step's connector the same way.
import { Connector, FlowStep, View } from 'src/types';

export const findFlowStepConnector = (
  views: View[],
  step: FlowStep | undefined
): Connector | undefined => {
  if (!step) return undefined;

  const view = views.find((_view) => {
    return (_view.connectors ?? []).some((connector) => {
      return connector.id === step.connectorId;
    });
  });

  return view?.connectors?.find((connector) => {
    return connector.id === step.connectorId;
  });
};
