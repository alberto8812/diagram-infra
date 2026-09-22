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

// Packet label shown while a flow step plays: the step's own label when set,
// otherwise a fallback derived from the step's connector protocol (roadmap
// item 2) — "HTTPS:443" when a port is set, "HTTPS" otherwise. Returns
// undefined when neither is available, same as an unlabeled step today.
export const getPacketLabel = (
  step: Pick<FlowStep, 'label'> | undefined,
  connector: Pick<Connector, 'protocol' | 'port'> | undefined
): string | undefined => {
  if (step?.label) return step.label;
  if (!connector?.protocol) return undefined;

  return connector.port !== undefined
    ? `${connector.protocol}:${connector.port}`
    : connector.protocol;
};

// "Add return path": appends a RESPONSE step for every existing REQUEST step
// of the flow, in reverse order (the request travels to the final node, the
// response returns the way it came). Each existing step's connector and
// label carry over; `makeId` is injected so this stays pure/testable.
// `views` (optional, default none) resolves each step's connector so a
// connector with `mode: 'async'` (roadmap item 2, fire-and-forget) can be
// skipped — no response is expected for it. Omitting `views` preserves
// existing (sync) behavior for every step.
export const buildReturnPathSteps = (
  steps: FlowStep[],
  makeId: () => string,
  views: View[] = []
): FlowStep[] => {
  return steps
    .filter((step) => {
      if (step.direction !== 'REQUEST') return false;

      const connector = findFlowStepConnector(views, step);
      return connector?.mode !== 'async';
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

// Two return-path steps are "the same" when everything but their `id`
// matches — a fresh id is generated per build, so `id` is deliberately
// excluded from the comparison.
const isSameStepContent = (a: FlowStep, b: FlowStep): boolean => {
  return (
    a.connectorId === b.connectorId &&
    a.direction === b.direction &&
    a.label === b.label &&
    a.durationMs === b.durationMs
  );
};

// Idempotent version of "add return path": `buildReturnPathSteps` always
// returns a full copy of the mirrored RESPONSE steps, so calling it again
// after they were already appended would duplicate them
// (R3-return-path-not-idempotent). This compares the full candidate list
// against the steps that already sit after the last REQUEST step (i.e. the
// existing return path, if any) and only returns the candidates that don't
// already have a matching counterpart there, in order — so re-running it
// once the return path is already fully mirrored yields an empty array, and
// re-running it after a partial/edited mirror only fills in what's missing.
export const getMissingReturnPathSteps = (
  steps: FlowStep[],
  makeId: () => string,
  views: View[] = []
): FlowStep[] => {
  const candidates = buildReturnPathSteps(
    steps,
    () => {
      return '';
    },
    views
  );

  if (candidates.length === 0) return [];

  const lastRequestIndex = steps.reduce((lastIndex, step, index) => {
    return step.direction === 'REQUEST' ? index : lastIndex;
  }, -1);

  const existingTail = steps.slice(lastRequestIndex + 1);

  let matchCount = 0;
  while (
    matchCount < candidates.length &&
    matchCount < existingTail.length &&
    isSameStepContent(candidates[matchCount], existingTail[matchCount])
  ) {
    matchCount += 1;
  }

  return candidates.slice(matchCount).map((step) => {
    return { ...step, id: makeId() };
  });
};
