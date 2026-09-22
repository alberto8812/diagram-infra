// Pure, React-free helpers for flows: resolving a step's connector across
// views, labelling a connector by its endpoints for the flow editor UI,
// resolving a step's successors in the flow graph, and building the "add
// return path" convenience (RESPONSE steps mirroring the existing REQUEST
// steps, in reverse order).
import { Connector, Flow, FlowStep, ModelItem, View } from 'src/types';

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

// A flow is a graph, or it is a list — never half. It is a graph as soon as
// any of its steps declares `next`, even an empty one: that step's author
// has opted into explicit successors, and from then on array position is no
// longer a valid stand-in for "what runs next" anywhere in the flow. A flow
// where no step declares `next` is a list, which is exactly what every
// existing (pre-graph) flow looks like, so it keeps the old array-order
// behaviour unchanged.
const isGraphFlow = (flow: Flow): boolean => {
  return flow.steps.some((step) => {
    return step.next !== undefined;
  });
};

// Resolves the step(s) that run after `stepId`.
//
// In a graph flow (see `isGraphFlow`), a step's successors are exactly its
// resolved `next`: dangling ids are skipped rather than thrown on, a
// duplicated id resolves to the same step only once, and declared order is
// preserved. Array position is never consulted. An absent or empty `next`
// means the branch ends there — it resolves to `[]`, not to "whatever comes
// next in the array". Falling back to array order here would make a branch
// unable to end: a step that finishes a short path would silently continue
// into whatever another branch happens to place after it in the array,
// which is exactly the bug this rule fixes (a `next: []` success leaf
// falling through into the next branch's first step).
//
// In a list flow, nothing declares `next`, so the only meaningful order is
// the array's: the successor is the single following step, or none if it is
// the last one. This is the backward-compatibility fallback existing linear
// flows rely on.
export const resolveNextSteps = (flow: Flow, stepId: string): FlowStep[] => {
  const index = flow.steps.findIndex((step) => {
    return step.id === stepId;
  });

  if (index === -1) return [];

  const step = flow.steps[index];

  if (isGraphFlow(flow)) {
    const seen = new Set<string>();

    return (step.next ?? []).reduce<FlowStep[]>((resolved, nextId) => {
      if (seen.has(nextId)) return resolved;

      const nextStep = flow.steps.find((candidate) => {
        return candidate.id === nextId;
      });

      if (!nextStep) return resolved;

      seen.add(nextId);
      return [...resolved, nextStep];
    }, []);
  }

  // List flow: no step declares `next`, so the successor is whatever comes
  // next in the array — this is the array-order behaviour existing
  // (pre-graph) flows rely on.
  const nextStep = flow.steps[index + 1];
  return nextStep ? [nextStep] : [];
};

// Entry point(s) of a flow: the first step of the array, if there is one.
// T2 will use this to seed the initial active step set; for a flow with no
// steps at all, there is nothing to start.
export const getFlowStartSteps = (flow: Flow): FlowStep[] => {
  const [firstStep] = flow.steps;
  return firstStep ? [firstStep] : [];
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

// Two return-path steps are "the same hop" when they cover the same
// connector in the same direction — `connectorId` and `direction` are the
// only structural facts a mirrored step and a user-edited one are
// guaranteed to share. `label` and `durationMs` are deliberately excluded
// (along with `id`, a fresh one generated per build): `buildReturnPathSteps`
// only seeds them from the mirrored REQUEST step as a starting point, and a
// user is expected to rewrite a response's label/duration to say something
// different from its request (e.g. "Migration OK" instead of "run
// migration"). Comparing them would treat that normal edit as a mismatch
// and re-append the whole hop as a duplicate.
const isSameReturnHop = (a: FlowStep, b: FlowStep): boolean => {
  return a.connectorId === b.connectorId && a.direction === b.direction;
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
// The match is structural (`isSameReturnHop`, connector + direction) rather
// than content-based: a RESPONSE step's label/duration are user content that
// is expected to diverge from the mirrored default, and comparing them
// would make an ordinary edit look like a missing hop, duplicating it.
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
    isSameReturnHop(candidates[matchCount], existingTail[matchCount])
  ) {
    matchCount += 1;
  }

  return candidates.slice(matchCount).map((step) => {
    return { ...step, id: makeId() };
  });
};
