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
Out of scope: real 3D renderer (three.js). Icon work (T6) waits on a product
decision: isometric icons with volume vs real 3D.

## Constraints
- Backward compatible model: all new fields optional.
- Playback state is UI state, never persisted in the model.
- Respect `prefers-reduced-motion`.
- ~400 authored lines per task is a planning heuristic only.

## Tasks
- [x] T1 Connector animation: `animated` + `direction` on connectorSchema,
      dash-offset flow animation, toggle in ConnectorControls
- [ ] T2 Flow model: `flows` schema (steps: connectorId, direction request|response,
      label, durationMs), reducers, types, tests
- [ ] T3 Playback engine: uiStateStore playback state (play/pause/step/speed/current step)
- [ ] T4 Packet rendering along connector path + node pulse on arrival
- [ ] T5 Playback controls in UiOverlay (editor + readonly) and flow step editor
- [ ] T6 Icons "3D" (blocked: pending product decision)

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

## Next step
T2 (flows schema).
