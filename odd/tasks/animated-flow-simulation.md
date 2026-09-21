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
- [ ] T3 Playback engine: uiStateStore playback state (play/pause/step/speed/current step)
- [ ] T4 Packet rendering along connector path + node pulse on arrival
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

Commit: Conventional Commit `feat(ui): add flow playback state`.

## Next step
T4 (packet rendering along the connector path + node pulse on arrival).
