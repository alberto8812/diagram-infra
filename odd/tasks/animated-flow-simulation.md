# Animated Flow Simulation

## Objective
Make diagrams explain runtime behavior: connectors show animated flow, and a
simulation plays requests travelling node to node until they reach the final
node, then the response travelling back.

## Problem
Connectors are static SVG polylines (`src/components/SceneLayers/Connectors/Connector.tsx`)
and icons are flat `<img>` tiles. A diagram shows topology but not the order in
which requests and responses move through it.

## Key findings
- GSAP is already a dependency (used by `Grid`, `SceneLayer`); no new animation lib.
- Connector path order comes from `connector.path.tiles` (anchor[0] -> last).
- `Connector.tsx` renders its SVG with `transform: scale(-1, 1)` (known TODO).
  Any packet drawn along the path must live inside that same `<Svg>` or its
  coordinates come out mirrored.
- Model is validated by zod (`src/schemas`); new fields must be optional so
  existing diagrams (`diagrams/infra.json`) keep loading.

## Scope
Authorized: connector schema/rendering/controls, a new `flows` model entity,
playback state in `uiStateStore`, packet rendering, node highlight, playback UI.
Out of scope: real 3D renderer (three.js). Decision (user, 2026-09-21): T6 uses
isometric icons with volume inside the current 2.5D engine.

## Constraints
- Backward compatible model: all new fields optional.
- Playback state is UI state, never persisted in the model.
- Respect `prefers-reduced-motion`.
- ~400 authored lines per task is a planning heuristic only.

## Tasks
- [x] T1 Connector animation: `animated` + `direction` on connectorSchema,
      dash-offset flow animation, toggle in ConnectorControls
- [x] T2 Flow model: `flows` schema (steps: connectorId, direction request|response,
      label, durationMs), reducers, types, tests
- [x] T3 Playback engine: uiStateStore playback state (play/pause/step/speed/current step)
- [x] T4 Packet rendering along connector path + node pulse on arrival
- [ ] T5 Playback controls in UiOverlay (editor + readonly) and flow step editor
- [ ] T6 Isometric volume for flat icons: wrap non-isometric icons (e.g. Simple
      Icons CI/CD set) in an extruded isometric block (shaded side faces, logo
      projected on top); isopack icons stay unchanged

## Route per task
| Task | Route | Trigger evidence |
|---|---|---|
| T1-T5 | delegated direct | touch 2+ non-trivial files each |

## TDD
Mode: off (source: prior ODD docs in this repo). Runner: jest (`npm test`).
Functional checks per task: `npm test`, `npx tsc --noEmit`, `npm run lint`.

## Delivery
Branch `feat/animated-flow-simulation` from `chore/dependency-security-update`
(aea77bd). Strategy: ask-on-risk. Merge to main only after user validation.

## Progress / Evidence

### T1 Connector animation (done)
Route: delegated direct (touched 5 non-trivial files: schema, config, types,
Connector.tsx, ConnectorControls.tsx).

Changes:
- `src/schemas/connector.ts`: added `animated: z.boolean().optional()` and
  `direction: z.enum(connectorDirectionOptions).optional()`, plus exported
  `connectorDirectionOptions = ['FORWARD', 'REVERSE', 'BOTH']`.
- `src/types/model.ts`: re-exported `connectorDirectionOptions` and added
  `ConnectorDirection` type (mirrors existing `ConnectorStyle` pattern).
- `src/config.ts`: `CONNECTOR_DEFAULTS` gained `animated: false` and
  `direction: 'FORWARD'` so `Required<Omit<Connector, ...>>` still compiles
  and existing diagrams without the fields render as non-animated.
- `src/components/SceneLayers/Connectors/Connector.tsx`: when
  `connector.animated` is true, renders one or two extra `<polyline>`
  overlays (via MUI `Box component="polyline"` + `sx`) with a dash pattern
  animated through `stroke-dashoffset` using `@emotion/react` `keyframes`.
  Negative offset = flow follows `connector.path.tiles` order (start->end,
  FORWARD); positive = REVERSE. BOTH renders both overlays, the reverse one
  dimmed (opacity 0.35 vs 0.85) and phase-shifted via a negative
  `animation-delay` so both streams read distinctly. Animation is disabled
  under `@media (prefers-reduced-motion: reduce)`. Overlays live inside the
  same `<Svg>` that already has `transform: scale(-1, 1)`, so no extra
  mirroring logic was needed (direction only depends on tile order, not
  screen x). When `animated` is false, output is byte-identical to before.
- `src/components/ItemControls/ConnectorControls/ConnectorControls.tsx`:
  added a "Flow" section with an "Animated flow" `Switch` and a direction
  `Select` (Forward / Reverse / Both) that is disabled when not animated,
  following the existing style/width control pattern.
- `src/schemas/__tests__/validation.test.ts`: added 3 cases directly against
  `connectorSchema` — animated+direction validates, an invalid direction
  value fails, and a connector without either field still validates
  (backward compatibility).

Verification:
- `npx tsc --noEmit`: passed, no errors.
- `npm test`: 6 suites / 26 tests passed (incl. the 3 new schema cases).
- `npm run lint`: reports only pre-existing issues in files not touched by
  this task (`import/no-cycle` in `src/stores/reducers/view.ts` and
  `viewItem.ts`, `no-console`/`no-alert` warnings in
  `ExportImageDialog.tsx` and `useInitialDataManager.ts`), confirmed via
  `git stash` + targeted eslint run on those two files before this change.
  A scoped eslint run on only the 6 files changed by T1 reports 0 problems.

Commit: see `git log` on this branch, Conventional Commit
`feat(connectors): add animated flow with direction`.

### T2 Flow model (done)
Route: delegated direct (touched 10+ non-trivial files: schema, model,
validation, types, model util, reducers, hooks).

Changes:
- `src/schemas/common.ts`: added `label: z.string().max(60)` to
  `constrainedStrings` for short, user-facing step labels.
- `src/schemas/flow.ts` (new): `flowStepDirectionOptions = ['REQUEST',
  'RESPONSE']`, `flowStepSchema` (`id`, `connectorId`, `direction`,
  optional `label`/`durationMs` (positive int)), `flowSchema` (`id`, `name`,
  optional `description`, `steps: array(flowStepSchema)`), and
  `flowsSchema = z.array(flowSchema)`.
- `src/schemas/model.ts`: added `flows: flowsSchema.optional()` to
  `modelSchema` — existing diagrams without `flows` still validate.
- `src/schemas/index.ts`: re-exports `./flow`.
- `src/schemas/validation.ts`: added `INVALID_FLOW_STEP_CONNECTOR_REF` issue
  type and `validateFlow`, which checks every step's `connectorId` exists in
  some view's connectors; wired into `validateModel` over `model.flows ?? []`.
- `src/types/model.ts`: added `Flow`, `FlowStep`, `Flows` inferred types and
  `FlowStepDirection = (typeof flowStepDirectionOptions)[number]`. Deviation
  from the `ConnectorStyle`/`ConnectorDirection` precedent: those use
  `keyof typeof <readonly tuple>`, which resolves to array index/method keys,
  not the literal union — an existing, currently-unused quirk. `FlowStepDirection`
  uses the correct `(typeof X)[number]` extraction instead, to keep the new
  type actually usable.
- `src/utils/model.ts`: `modelFromModelStore` now carries `flows` through, so
  autosave (`Isoflow.tsx`), JSON export (`MainMenu.tsx`) and PNG export
  (`ExportImageDialog.tsx`) keep flows — `persistence.ts`'s `stripIcons`
  already spreads `...rest`, so no change needed there.
- `src/stores/reducers/flow.ts` (new): model-level reducers, following the
  `modelItem.ts` pattern (no `viewId`, since flows aren't view-scoped):
  `createFlow`, `updateFlow`, `deleteFlow`, `createFlowStep`, `updateFlowStep`,
  `deleteFlowStep`, `reorderFlowSteps` (clamps the target index with the
  existing `clamp` util).
- `src/stores/reducers/index.ts`: re-exports `./flow`.
- `src/stores/reducers/connector.ts`: `deleteConnector` now also strips any
  flow step whose `connectorId` matches the deleted connector, across all
  flows.
- `src/hooks/useFlow.ts` (new): reads one flow by id, mirrors `useModelItem`.
- `src/hooks/useScene.ts`: wired `createFlow`/`updateFlow`/`deleteFlow`/
  `createFlowStep`/`updateFlowStep`/`deleteFlowStep`/`reorderFlowSteps`
  callbacks (same `getState`/`setState` plumbing as the existing model-item
  and view actions) and added them to the returned object.
- Tests: `src/schemas/__tests__/validation.test.ts` — valid flow, invalid
  step direction, model without `flows` still validates, a flow step with a
  dangling `connectorId` fails model validation with
  `INVALID_FLOW_STEP_CONNECTOR_REF`, and a flow whose steps reference real
  connectors passes. `src/stores/reducers/__tests__/flow.test.ts` (new) —
  create/update/delete a flow, create/update/delete/reorder a step, and
  deleting a connector (via `reducers.view({ action: 'DELETE_CONNECTOR' })`)
  removes the flow steps that referenced it.

Verification:
- `npx tsc --noEmit`: passed, no errors.
- `npm test`: 7 suites / 39 tests passed (incl. the 9 new cases across the
  two files above).
- `npm run lint`: only the known pre-existing issues (`import/no-cycle` in
  `view.ts`/`viewItem.ts`, `no-console`/`no-alert` warnings in
  `ExportImageDialog.tsx`/`useInitialDataManager.ts`). A scoped eslint run on
  every file this task touched reports 0 problems (after one `--fix` pass
  for prettier formatting).

Commit: Conventional Commit `feat(model): add flows for request/response
simulation` (13b329e).

### T3 Playback engine state (done)
Route: delegated direct (touched 7 non-trivial files: ui types, config,
pure util, utils barrel, uiStateStore, hook, plus a new test file).

Changes:
- `src/types/ui.ts`: added `FlowPlaybackStatusOptions`
  (`IDLE`/`PLAYING`/`PAUSED`), `FlowPlaybackStatus` type, and the
  `FlowPlayback` interface (`flowId`, `status`, `stepIndex`, `speed`).
  Added `flowPlayback: FlowPlayback` to `UiState` and
  `selectFlow`/`play`/`pause`/`stop`/`nextStep`/`prevStep`/`setSpeed`/
  `advance` to `UiStateActions`. This is UI state only — the model store is
  untouched.
- `src/config.ts`: added `DEFAULT_FLOW_STEP_DURATION_MS = 1200` and
  `INITIAL_FLOW_PLAYBACK` (`{ flowId: null, status: 'IDLE', stepIndex: 0,
  speed: 1 }`), wired into `INITIAL_UI_STATE.flowPlayback`.
- `src/utils/flowPlayback.ts` (new): pure, React-free step-sequencing logic
  — `flowPlaybackReducer(state, action, stepsCount = 0)`, `clampStepIndex`,
  and `getStepDurationMs(step, speed)` (`= (step.durationMs ??
  DEFAULT_FLOW_STEP_DURATION_MS) / speed`, ignoring a non-positive speed).
  Documented playback-end behavior: `advance()` at the last step sets
  `status: 'IDLE'` and **keeps** `stepIndex = stepsCount - 1` (does not loop
  or reset to 0), so the finished diagram stays visible until the user
  replays or picks another flow. `SELECT_FLOW` always resets to step 0/IDLE
  but keeps the current speed. Exported via `src/utils/index.ts` (same
  config-import pattern already used by `renderer.ts`, so no new
  `import/no-cycle` finding).
- `src/stores/uiStateStore.tsx`: added `flowPlayback` to the store's initial
  state (from `INITIAL_UI_STATE.flowPlayback`) and the eight actions, each
  calling `flowPlaybackReducer` and `set()`-ing the result — same pattern as
  the existing zoom/scroll actions. `play`/`nextStep`/`prevStep`/`advance`
  take a `stepsLength` the caller supplies (the store has no access to the
  model store to look up a flow's steps itself).
- `src/hooks/useFlowPlayback.ts` (new): resolves the selected `Flow` from
  the model store, the `currentStep` (`steps[stepIndex]`), and the
  `currentConnector` by searching every view's connectors for the step's
  `connectorId` (same reference shape the model validator checks in T2).
  Wraps each store action, supplying `steps.length` where needed. Starts no
  timers — `advance()` is only called externally by whatever drives the
  animation loop (T4's renderer).
- Tests: `src/utils/__tests__/flowPlayback.test.ts` (new) — `clampStepIndex`
  bounds and empty-flow case, `getStepDurationMs` (own duration, default
  fallback, speed scaling, non-positive speed guard), and
  `flowPlaybackReducer` for every action including the empty-flow and
  last-step edge cases for `PLAY`/`ADVANCE`.

Verification:
- `npx tsc --noEmit`: passed, no errors.
- `npm test`: 8 suites / 56 tests passed (17 new: 14 for
  `flowPlaybackReducer`/`clampStepIndex`/`getStepDurationMs`).
- `npm run lint`: only the known pre-existing issues (`import/no-cycle` in
  `view.ts`/`viewItem.ts`, `no-console`/`no-alert` warnings in
  `ExportImageDialog.tsx`/`useInitialDataManager.ts`) — confirmed no new
  cycle finding from the `utils/flowPlayback.ts` -> `src/config` import. A
  scoped eslint run on every file this task touched reports 0 problems.

Commit: Conventional Commit `feat(ui): add flow playback state` (d81ef09).

### T4 Packet rendering + node pulse (done)
Route: delegated direct (touched 10+ non-trivial files: pure geometry util,
hook, store, types, config, three components, plus new test files).

Changes:
- `src/utils/flowPacket.ts` (new, pure, React/DOM-free): `getPacketPathPoints`
  (REQUEST keeps `connector.path.tiles` order start->end, RESPONSE reverses
  it), `getPolylineLength`/`getPointAtProgress` (pure point-at-progress along
  a polyline, the fallback used where `SVGGeometryElement` isn't available —
  e.g. jsdom in tests), and `getPacketDestinationItemId` (resolves the
  connector's end anchor's `ref.item` for REQUEST, start anchor's for
  RESPONSE; `null` when that anchor has no item ref). Exported via
  `src/utils/index.ts`.
- `src/hooks/useReducedMotion.ts` (new): small hook mirroring the
  `@media (prefers-reduced-motion: reduce)` query used elsewhere, for the one
  place (`ConnectorPacket`) that has to branch in JS instead of CSS.
- `src/components/SceneLayers/Connectors/ConnectorPacket.tsx` (new): renders
  one packet (a small `<circle>` + optional label `<text>`, counter-flipped
  via `scale(-1, 1)` on its own group so the label reads normally despite the
  parent `<Svg>`'s mirror) travelling along `points`. Motion is a GSAP tween
  over a plain `{ value: 0..1 }` progress object; on each update it resolves
  the point either via the connector's own `<polyline>`'s
  `getTotalLength()`/`getPointAtLength()` (guarded with a `typeof` check +
  try/catch, since jsdom/older browsers don't implement them) or, falling
  back, via the pure `getPointAtProgress()` util. A second effect
  play()s/pause()s the *same* tween instance when `status` changes, so
  PAUSED freezes the packet exactly where it is and PLAY resumes from there
  — it never restarts the tween. Reduced motion reuses the same tween
  mechanism (rather than a bare `setTimeout`) with the packet already placed
  at the destination and a capped `min(durationMs, 400)` duration, so pause
  still freezes it there instead of silently auto-advancing. The travel
  effect keys off `[points, durationMs, reducedMotion]`; `advance()` is
  called through `onArrive` exactly once (guarded by a ref flag), and the
  tween is always `.kill()`ed on cleanup (step change or unmount), so no
  tween is ever leaked.
- `src/components/SceneLayers/Connectors/Connector.tsx`: added a `packet`
  memo that is `null` unless `flowPlayback.status !== 'IDLE'` and the
  playback's `currentConnector.id` matches this connector — i.e. it renders
  for both PLAYING (per the task's literal condition) and PAUSED (needed so
  a paused packet stays visible/frozen instead of disappearing). Points are
  computed with the same tile->pixel formula already used for `pathString`,
  ordered by `getPacketPathPoints(connector.path.tiles, currentStep.direction)`,
  and colored `theme.palette.primary.main` (REQUEST) or
  `theme.palette.secondary.main` (RESPONSE) — both theme-derived. The
  `<ConnectorPacket>` is keyed by `currentStep.id` so React remounts (and
  thus fully resets) it on every step change, and is rendered last inside
  the same `<Svg>` that has `transform: scale(-1, 1)` (per the constraint —
  drawing outside it would mirror the coordinates). `onArrive` sets
  `activeNodePulse` (when the destination anchor resolved to an item) and
  then calls `advance()`.
- `src/components/SceneLayers/Nodes/Node/Node.tsx`: reads
  `activeNodePulse` from `uiStateStore` and, when it matches `node.id`,
  renders a keyframe-animated (`opacity`/`scale`, 600ms, `forwards` fill so
  it stays hidden after) circular glow behind the icon, sized/positioned off
  `PROJECTED_TILE_SIZE` to roughly match where `IsometricIcon`/
  `NonIsometricIcon` render. Keyed by `activeNodePulse.token` so the same
  node can re-trigger the animation on consecutive arrivals. Disabled (kept
  at `opacity: 0`) under `prefers-reduced-motion: reduce`.
- `src/types/ui.ts`: added `NodePulse` (`nodeId`, `token`) and
  `activeNodePulse: NodePulse | null` to `UiState`; `reconcile` and
  `setActiveNodePulse` to `UiStateActions` (see the RECONCILE fix below for
  `reconcile`).
- `src/config.ts` / `src/stores/uiStateStore.tsx`: `activeNodePulse: null` in
  `INITIAL_UI_STATE`; store gained the `setActiveNodePulse` action and now
  also resets `flowPlayback`/`activeNodePulse` in `resetUiState()` (also
  part of the RECONCILE fix below).
- Tests: `src/utils/__tests__/flowPacket.test.ts` (new) — direction ordering
  (incl. non-mutation of the input array), polyline length, point-at-progress
  (single/multi-segment interpolation, clamping, 0/1-point edge cases), and
  destination-item resolution (REQUEST/RESPONSE, no-item anchor, no anchors).
  No component/DOM tests were added for `ConnectorPacket`/`Node`: this
  project's `jest.config.js` uses `testEnvironment: "node"` (no jsdom, no
  `SVGGeometryElement`) and has no existing RTL/jsdom test convention to
  extend — per the task's own guidance, the DOM-dependent motion code is
  guarded at the call site and the actual point-at-progress logic lives in
  the pure, fully-tested `flowPacket.ts` util instead.

Verification:
- `npx tsc --noEmit`: passed, no errors.
- `npm test`: 9 suites / 78 tests passed (14 new in `flowPacket.test.ts`).
- `npm run lint`: only the known pre-existing issues (`import/no-cycle` in
  `view.ts`/`viewItem.ts`, `no-console`/`no-alert` warnings in
  `ExportImageDialog.tsx`/`useInitialDataManager.ts`). A scoped eslint run on
  every file T4 touched (including the two review-fix files below) reports 0
  problems.

#### Review fixes included in this task
1. **WARNING `R3-stale-playback-after-model-edit`**
   (`src/hooks/useFlowPlayback.ts:37`): added a `RECONCILE` action to the
   pure `flowPlaybackReducer` (`src/utils/flowPlayback.ts`) — no-op when no
   flow is selected; resets to `{ flowId: null, status: 'IDLE', stepIndex: 0
   }` when the selected flow was deleted; clamps `stepIndex` when the steps
   array shrank; sets `status: 'IDLE'` (clamped index kept) when the step at
   the current index no longer resolves to a real connector; otherwise a
   true no-op (returns the same object reference, so no needless re-renders).
   `useFlowPlayback.ts` gained a `useEffect` that gathers the facts
   (`flowExists`, `connectorExists` at the clamped index, via a shared
   `findConnector` helper factored out of the existing `currentConnector`
   memo) and dispatches `actions.reconcile(...)` on every relevant model
   change. `src/stores/uiStateStore.tsx` gained the `reconcile` action
   (mirrors the existing `play`/`advance`/etc. pattern) and now resets
   `flowPlayback` (and `activeNodePulse`) inside `resetUiState()`. Tests:
   6 new `RECONCILE` cases in `src/utils/__tests__/flowPlayback.test.ts`
   (no-op when unselected, flow deleted, steps emptied, stepIndex clamped,
   connector missing, and a true no-op when nothing changed).
2. **SUGGESTION `R3-missing-menuitem-key`**
   (`src/components/ItemControls/ConnectorControls/ConnectorControls.tsx:113`):
   added `key={direction}` to the mapped direction `MenuItem`s.

#### Follow-ups from review (not in scope for T4)
- Duplicate ids finding (not investigated as part of T3/T4).
- Render coverage finding (not investigated as part of T3/T4).
- `useFlow` throwing finding (not investigated as part of T3/T4).

These were flagged by the RDD review over `aea77bd..d81ef09` but explicitly
excluded from T4's scope; they still need triage before/alongside T5-T6.

Commit: Conventional Commit
`feat(simulation): animate flow packets along connectors` (includes both
review fixes above — kept in the same commit rather than split out, since
the fix and the feature share the same files (`uiStateStore.tsx`,
`useFlowPlayback.ts`, `types/ui.ts`, `config.ts`) with interleaved hunks;
splitting risked a broken intermediate commit for no real benefit here).

### Review (RDD, over aea77bd..d81ef09)
- Lineage: review-88b3c4817011ef57
- Range: aea77bd..d81ef09
- Risk: medium
- Consent: granted
- Lenses: 1 (reliability)
- Outcome: approved, acknowledged/burned
- Reviewed boundary: d81ef09

## Next step
T5 (playback controls in UiOverlay — editor + readonly — and the flow step
editor).
