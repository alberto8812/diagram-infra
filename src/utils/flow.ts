// Pure, React-free helpers for flows: resolving a step's connector across
// views, labelling a connector by its endpoints for the flow editor UI, and
// building the "add return path" convenience (RESPONSE steps mirroring the
// existing REQUEST steps, in reverse order).
import { Connector, FlowStep, ModelItem, View } from 'src/types';

// A flow step only stores a `connectorId`; the connector itself lives in
// whichever view still has it. Shared by src/hooks/useFlowPlayback.ts (per
// rendered Connector) and src/components/FlowPlaybackReconciler (the single
// owner of the RECONCILE effect), so both resolve a step's connector the
// same way.
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

// Labels a connector by its endpoint item names ("Item A -> Item B") for the
// flow editor's connector picker. Anchors that reference a tile rather than
// an item (or an item that no longer resolves) fall back to "?".
export const getConnectorEndpointLabel = (
  connector: Pick<Connector, 'anchors'>,
  items: Pick<ModelItem, 'id' | 'name'>[]
): string => {
  const nameForAnchorIndex = (index: number): string => {
    const anchor = connector.anchors[index];
    const itemId = anchor?.ref.item;

    if (!itemId) return '?';

    return (
      items.find((item) => {
        return item.id === itemId;
      })?.name ?? '?'
    );
  };

  if (connector.anchors.length === 0) return 'Unnamed connector';

  const from = nameForAnchorIndex(0);
  const to = nameForAnchorIndex(connector.anchors.length - 1);

  return `${from} -> ${to}`;
};

// "Add return path": appends a RESPONSE step for every existing REQUEST step
// of the flow, in reverse order (the request travels to the final node, the
// response returns the way it came). Each existing step's connector and
// label carry over; `makeId` is injected so this stays pure/testable.
export const buildReturnPathSteps = (
  steps: FlowStep[],
  makeId: () => string
): FlowStep[] => {
  return steps
    .filter((step) => {
      return step.direction === 'REQUEST';
    })
    .slice()
    .reverse()
    .map((step) => {
      return {
        id: makeId(),
        connectorId: step.connectorId,
        direction: 'RESPONSE' as const,
        ...(step.label !== undefined ? { label: step.label } : {}),
        ...(step.durationMs !== undefined
          ? { durationMs: step.durationMs }
          : {})
      };
    });
};
