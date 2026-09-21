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
- [x] T5 Playback controls in UiOverlay (editor + readonly) and flow step editor
- [x] T6 Isometric volume for flat icons: wrap non-isometric icons (e.g. Simple
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

### Review 2 (RDD, over d81ef09..c311b8e)
- Lineage: review-f33a222b869d244b
- Range: d81ef09..c311b8e
- Risk: medium
- Consent: granted
- Lenses: 1 (reliability)
- Outcome: approved, acknowledged/burned
- Reviewed boundary: c311b8e

### Review fixes (done)
Route: delegated direct (touched 6 non-trivial files: the two flow-review
findings shared them with T5's own files where noted below).

Changes:
- `src/components/SceneLayers/Connectors/Connector.tsx`: split the old
  single `packet` memo into `tilesKey` (a text key of
  `connector.path.tiles`, since `useConnector`'s return value — and thus
  `connector.path.tiles` — gets a new array reference on *every* model
  change, not just ones touching this connector), `packetPoints` (memoized
  on `tilesKey`/step id/direction/connector id/`drawOffset` only — never on
  `flowPlayback.status` or `.speed`), and `packet` (adds status/speed/color/
  label/destination on top of the now-stable `packetPoints`). This is what
  fixes **WARNING R3-pause-restarts-packet-tween**: PAUSE, a speed change,
  or an unrelated model edit no longer produces a new `points` array
  reference, so `ConnectorPacket`'s tween-creation effect (keyed on
  `[points, baseDurationMs, reducedMotion]`) no longer restarts.
  `getStepDurationMs(currentStep, 1)` now feeds a new `baseDurationMs`
  field (duration at speed 1x) instead of the old speed-scaled
  `durationMs`; a new `speed` field carries the live playback speed.
- `src/components/SceneLayers/Connectors/ConnectorPacket.tsx`: props
  renamed `durationMs` -> `baseDurationMs` + new `speed: number`. The
  tween-creation effect keys off `[points, baseDurationMs, reducedMotion]`
  (was `[points, durationMs, reducedMotion]`) and no longer rebuilds on a
  speed change; a new effect calls `tween.timeScale(speed)` to adjust the
  running tween's rate in place instead. Fixes **SUGGESTION
  R3-stale-onArrive-closure**: added an `onArriveRef` (latest-ref pattern,
  updated via its own effect) and the tween's `arrive()` now calls
  `onArriveRef.current()` instead of the `onArrive` closed over when the
  tween-creation effect last ran.
- `src/hooks/useFlowPlayback.ts`: removed the RECONCILE `useEffect` (this
  hook is called by every rendered `Connector`, so it was
  re-dispatching `actions.reconcile(...)` once per connector on screen per
  relevant model change). `findConnector` now delegates to the new shared
  `findFlowStepConnector` util instead of duplicating the view-search
  logic inline. Fixes **SUGGESTION R3-reconcile-per-consumer**.
- `src/components/FlowPlaybackReconciler/FlowPlaybackReconciler.tsx`
  (new): the RECONCILE effect moved here verbatim (same fact-gathering,
  same `flowPlaybackReducer('RECONCILE', ...)`), rendered as a
  single invisible component.
- `src/Isoflow.tsx`: mounts `<FlowPlaybackReconciler />` once, at the
  `App` root (alongside `<Renderer/>`/`<UiOverlay/>`), so reconciliation
  runs once per relevant model change regardless of how many connectors
  are on screen.
- `src/utils/flow.ts` (new): `findFlowStepConnector(views, step)` — the
  connector-resolution logic shared by `useFlowPlayback.ts` and
  `FlowPlaybackReconciler`. (T5 below adds two more pure functions to this
  same file.)
- `src/utils/index.ts`: exports `./flow`.
- Tests: `src/utils/__tests__/flow.test.ts` (new) — `findFlowStepConnector`
  resolving across views, an undefined step, and no view having the
  connector.

Verification:
- `npx tsc --noEmit`: passed, no errors.
- `npm test`: 10 suites / 81 tests passed (3 new in `flow.test.ts`).
- `npm run lint`: only the known pre-existing issues (`import/no-cycle` in
  `view.ts`/`viewItem.ts`, `no-console`/`no-alert` warnings in
  `ExportImageDialog.tsx`/`useInitialDataManager.ts`).

Commit: `fix(simulation): keep packet tween alive across pause and speed
changes` (f69ffa9).

### T5 Playback controls + flow editor (done)
Route: delegated direct (touched 8 non-trivial files: UI types, config,
UiOverlay wiring, two new components, examples data, and the shared
`flow.ts` util/tests extended from the fix commit above).

Changes:
- `src/components/FlowControls/FlowPlaybackBar.tsx` (new): flow selector
  (`Select` by name), Play/Pause (toggles on `flowPlayback.status`),
  Stop, Prev/Next step, speed `Select` (0.5x/1x/2x, driven by
  `FLOW_PLAYBACK_SPEED_OPTIONS`), and a "Step n / total — label"
  indicator (`useFlowPlayback()`'s `flow`/`steps`/`currentStep`). Visible
  for both `EDITABLE` and `EXPLORABLE_READONLY` editor modes; hidden
  entirely when the model has no flows, except in `EDITABLE` mode, which
  shows a "Create a flow" button that creates an empty flow, selects it
  for playback, and opens the editor dialog.
- `src/components/FlowControls/FlowEditorDialog.tsx` (new, `EDITABLE`
  only): left column lists flows (create/select/delete); right column
  edits the selected flow's name, its steps (connector labelled "from ->
  to" via `getConnectorEndpointLabel`, direction, optional label,
  reorder up/down via `reorderFlowSteps`, delete), an "Add step" form
  (connector `Select` sourced from `useScene().connectors` — the current
  view — direction, optional label, optional duration), and an "Add
  return path" button (disabled when the flow has no REQUEST steps) that
  calls `buildReturnPathSteps` and creates each returned step. Guards
  **R3-useFlow-throws-on-missing**: `selectedFlowId` is only ever resolved
  with `flows.find(...)` (never the throwing `useFlow()` hook) and is
  reset via a `useEffect` whenever it no longer matches a flow in the
  list — deleting the flow currently being edited (from the list in the
  same dialog, or from anywhere else touching the model) falls back to
  another flow or the empty state instead of crashing.
- `src/utils/flow.ts`: added `getConnectorEndpointLabel(connector, items)`
  ("Item A -> Item B", falling back to "?" per endpoint for a tile anchor
  or an unresolved item, "Unnamed connector" with no anchors) and
  `buildReturnPathSteps(steps, makeId)` (pure; filters REQUEST steps,
  reverses them, maps each to a new RESPONSE step carrying over
  `connectorId`/`label`/`durationMs`; `makeId` is injected so it stays
  testable without importing `generateId`).
- `src/types/ui.ts`: `DialogTypeEnum` gained `FLOW_EDITOR` (same pattern as
  the existing `EXPORT_IMAGE`).
- `src/config.ts`: added `FLOW_PLAYBACK_SPEED_OPTIONS = [0.5, 1, 2] as
  const`.
- `src/components/UiOverlay/UiOverlay.tsx`: `ToolsEnum`/
  `EDITOR_MODE_MAPPING` gained `FLOW_CONTROLS` (both `EDITABLE` and
  `EXPLORABLE_READONLY`, not `NON_INTERACTIVE` — that mode intentionally
  renders no UI, used by `ExportImageDialog`'s internal render). Renders
  `<FlowPlaybackBar/>` top-center (clear of `MAIN_MENU`/`TOOL_MENU`/
  `VIEW_TITLE`), and `<FlowEditorDialog/>` when `dialog === 'FLOW_EDITOR'`
  (guarded by `availableTools.includes('FLOW_CONTROLS')` so a stale dialog
  state can't surface the editor in a mode where the tool isn't
  available).
- `src/examples/initialData.ts`: added one sample flow ("Landside
  check-in": a REQUEST + RESPONSE step over the existing
  `2e025225-169c-4609-bf93-a4a7aa602b00` connector, Landside operations ->
  AODB) so `BasicEditor`/`ReadonlyMode` have something to play back out of
  the box. `diagrams/infra.json` was not touched.
- Tests: `src/utils/__tests__/flow.test.ts` — added
  `getConnectorEndpointLabel` (endpoint names, "?" fallback, no-anchors
  fallback) and `buildReturnPathSteps` (reverse order, ignores existing
  RESPONSE steps, empty input, carries `durationMs`) cases.

Verification:
- `npx tsc --noEmit`: passed, no errors.
- `npm test`: 10 suites / 88 tests passed (7 new: `getConnectorEndpointLabel`
  x3, `buildReturnPathSteps` x4).
- `npm run lint`: only the known pre-existing issues (`import/no-cycle` in
  `view.ts`/`viewItem.ts`, `no-console`/`no-alert` warnings in
  `ExportImageDialog.tsx`/`useInitialDataManager.ts`).

Commit: `feat(simulation): add playback controls and flow step editor`
(a8b8b12).

### Follow-ups (not in scope for T5)
- Duplicate ids finding (still unvalidated — flagged since the
  `aea77bd..d81ef09` review, carried through T4 and T5).
- No render/DOM tests for `FlowPlaybackBar`/`FlowEditorDialog`: same
  reasoning as T4's `ConnectorPacket`/`Node` — `jest.config.js` uses
  `testEnvironment: "node"` (no jsdom) and this project has no existing
  RTL/jsdom convention to extend, so the new pure logic
  (`getConnectorEndpointLabel`, `buildReturnPathSteps`) is fully tested
  and the React components stay thin wrappers over it plus the
  already-tested `useScene`/`useFlowPlayback` hooks and reducers.

### T6 Isometric volume for flat icons (done)
Route: delegated direct (touched 7 non-trivial files: schema, types, config,
hook, two components, plus a new pure geometry util/tests). A concurrent
automated review over `c311b8e..37c3eed` was running while this task
executed; none of the files it covers (`SceneLayers/Connectors/*`,
`FlowControls/*`, `FlowPlaybackReconciler/*`, `useFlowPlayback.ts`,
`utils/flow.ts`, `Isoflow.tsx`, `UiOverlay.tsx`, `types/ui.ts`,
`examples/initialData.ts`) were touched.

Projection choice: the logo stays on the top face, reusing — unchanged —
the exact flat-icon isometric transform `NonIsometricIcon` already applies
(`getIsoProjectionCss()`, the same matrix `getIsoMatrix()` in
`src/utils/renderer.ts` uses to project grid tiles), just raised onto the
block's lid by its extrude height. This was picked over clipping the
`<image>` into the top polygon: it keeps the already-working,
already-export-safe `<img>` markup byte-identical to before (same src,
same width, same transform formula — only its `top` offset changes), so
`ExportImageDialog`'s dom-to-image PNG export needed no changes at all. The
tradeoff, called out in the component's own comment, is that the logo
renders as the same CSS-skewed parallelogram approximation
`NonIsometricIcon` already used, not a pixel-exact fit to the true tile
diamond the block's own faces are drawn with — the existing accepted
approximation, just reused rather than replaced.

Changes:
- `src/utils/isometricBlock.ts` (new, pure, React/DOM-free):
  `getIsometricCuboidFaces(footprint, extrudeHeight)` returns the block's
  three visible face polygons (`top`/`left`/`right`) in the same
  anchor-relative coordinate space `Node.tsx` already positions icons in
  (origin = the tile's near/bottom vertex, screen "up" = negative y — see
  `getTilePosition({ origin: 'BOTTOM' })` in `src/utils/renderer.ts`), so
  no translation math is needed where it's consumed. `toSvgPoints(points)`
  formats a `Coords[]` as an SVG `points` string. Exported via
  `src/utils/index.ts`.
- `src/components/SceneLayers/Nodes/Node/IconTypes/IsometricBlockIcon.tsx`
  (new): renders the block as three `<polygon>`s inside a raw-`viewBox`
  `<Svg>` (left/right faces shaded via `getColorVariant(..., 'dark',
  {grade})`, from `ICON_BLOCK_BASE_COLOR`), a small `<ellipse>` ground
  shadow at the near vertex, and the existing flat-icon `<img>` transform
  (see projection choice above) positioned on the lid.
- `src/hooks/useIcon.tsx`: takes an optional second `iconStyle?: IconStyle`
  param. For a non-isometric icon (`!icon.isIsometric`, i.e. `false` or
  unset — same condition the hook already branched on), resolves
  `iconStyle ?? NODE_ICON_STYLE_DEFAULT` and renders `IsometricBlockIcon`
  for `'BLOCK'`, `NonIsometricIcon` for `'FLAT'`. Isometric icons are
  unaffected. `DragAndDrop.tsx`/`NodeControls.tsx` call `useIcon` with only
  one argument (icon preview only, no component style relevant there) and
  needed no changes — the new param is optional.
- `src/schemas/modelItems.ts`: added `iconStyleOptions = ['FLAT', 'BLOCK']
  as const` and `iconStyle: z.enum(iconStyleOptions).optional()` on
  `modelItemSchema` — optional, so `diagrams/infra.json` and every existing
  diagram still validates and loads unchanged (falls back to the config
  default at render time, not at parse time).
- `src/types/model.ts`: re-exported `iconStyleOptions` and added
  `IconStyle = (typeof iconStyleOptions)[number]` (the correct
  `(typeof X)[number]` pattern, matching `FlowStepDirection` from T2, not
  the older `keyof typeof` one `ConnectorStyle`/`ConnectorDirection` use).
- `src/config.ts`: added `NODE_ICON_STYLE_DEFAULT: IconStyle = 'BLOCK'`
  (global opt-out point — flip to `'FLAT'` to restore the pre-T6 default
  for every diagram at once), `ICON_BLOCK_EXTRUDE_HEIGHT` (`= round(
  PROJECTED_TILE_SIZE.height * 0.35)`, so it scales if the tile size config
  ever changes), and `ICON_BLOCK_BASE_COLOR`.
- `src/components/ItemControls/NodeControls/NodeSettings/NodeSettings.tsx`:
  added an "Icon style" section (a `ToggleButtonGroup`, `iconStyleOptions`
  mapped to labels), shown only when the selected node's icon is
  non-isometric — the per-node opt-out. Reads the icon via the same
  `useIcon()` hook (single-arg call, `{ icon }` only) already used
  elsewhere in this file's siblings.
- `src/components/SceneLayers/Nodes/Node/Node.tsx`: `useIcon(modelItem.icon)`
  -> `useIcon(modelItem.icon, modelItem.iconStyle)`. The T4 pulse glow
  needed no changes: it's sized/positioned off `PROJECTED_TILE_SIZE` at the
  node's floor anchor, the same anchor the block also stands on, so it
  still renders correctly around/under the block.
- `src/utils/index.ts`: exports `./isometricBlock`.
- Tests: `src/utils/__tests__/isometricBlock.test.ts` (new) —
  `getIsometricCuboidFaces`: the near/floor vertex sits at the anchor
  origin, the top/left/right face polygons compute correctly for a sample
  footprint+height, and a zero `extrudeHeight` collapses the lid onto the
  floor diamond; `toSvgPoints`: formatting and the empty-input case. No
  component/DOM test for `IsometricBlockIcon` itself — same reasoning as
  T4/T5 (`jest.config.js` uses `testEnvironment: "node"`, no jsdom, no
  existing RTL convention in this project): the geometry is pure and fully
  tested, and the component is a thin render of it plus the
  already-working `NonIsometricIcon` image-transform code path.

Verification:
- `npx tsc --noEmit`: passed, no errors.
- `npm test`: 11 suites / 95 tests passed (7 new in `isometricBlock.test.ts`).
- `npm run lint`: two lint errors introduced by this task's first pass
  (`arrow-body-style` in `isometricBlock.ts`, a `prettier/prettier`
  formatting error in `NodeSettings.tsx`) were both fixed with a scoped
  `eslint --fix` on just those two files, then `tsc --noEmit` and
  `npm test` were re-run clean to confirm the fix changed nothing
  behaviorally. Final `npm run lint` reports only the known pre-existing
  issues (`import/no-cycle` in `view.ts`/`viewItem.ts`, `no-console`/
  `no-alert` warnings in `ExportImageDialog.tsx`/`useInitialDataManager.ts`).

Deviations from the task brief: no isopack-icon or `diagrams/infra.json`
changes (none needed — isometric icons already skip the new code path
entirely); no docs update to
`docs/pages/docs/api/initialData.mdx` (out of the authorized scope for
this task, left for a follow-up if the model-level `iconStyle` field is
considered worth documenting alongside `isIsometric`).

Open questions for user validation: is `BLOCK` the right *default* (vs.
opt-in `FLAT`-by-default with a per-node upgrade)? Is
`ICON_BLOCK_EXTRUDE_HEIGHT`'s proportion (35% of tile height) visually
right, and is `ICON_BLOCK_BASE_COLOR` (`#e7ecf5`) the right neutral base
for brand-colored logos, or should it derive from
`customVars.customPalette.diagramBg` instead for closer visual cohesion
with the canvas background?

## Next step
User validation in browser (`npm start`), then merge decision.
