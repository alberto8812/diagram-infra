# Infrastructure Model (roadmap items 1-3)

Locator: `odd/tasks/infrastructure-model.md` · Engram mirror: `odd/infrastructure-model/tasks`
Branch: `feat/infrastructure-model` (from `main` @ `d271ebc`)
Source plan: `odd/roadmap/infrastructure-platform.md` items 1, 2, 3.

## Objective
Make the diagram know what it represents: typed resources, semantic connectors, and
multiple diagrams with views used as layers.

## Problem / why
Nodes are icons with a name and free HTML; connectors are lines; autosave writes one
fixed file (`diagrams/infra.json`). That blocks lint rules, IaC import and richer
simulation (items 4-6), and forces one diagram per repo.

## Scope
- In: items 1, 2, 3 of the roadmap.
- Out: items 4-7 (richer simulation, lint rules, IaC import, tech debt).

## Constraints
- Every new field is optional; `diagrams/infra.json` and existing diagrams must keep
  loading through `modelSchema.safeParse` unchanged.
- New connector fields need a `CONNECTOR_DEFAULTS` entry (`src/config.ts`).
- New top-level model fields must be added to `modelFromModelStore` (`src/utils/model.ts`).
- Server keeps a path guard: client sends a diagram name, never a path; the server
  resolves it only against a validated name pattern inside `diagrams/`.
- Pre-existing `import/no-cycle` in `view.ts`/`viewItem.ts` is accepted debt; do not fix here.

## Design decisions (accepted interpretations)
- Item 1: flat optional fields on `modelItemSchema`: `kind` (enum), `environment`
  (`dev|test|prod`), `engine`, `version`, `region`, `owner` (strings), `port` (int 1-65535).
- Item 2: optional connector fields: `protocol` (`HTTP|HTTPS|gRPC|SQL|SSH|TCP|AMQP`),
  `port` (int 1-65535), `mode` (`sync|async`), `auth` (`none|basic|token|mtls|iam`).
  Simulation: packet label falls back to protocol when the step has no label; async
  connectors are skipped when building return-path steps (no response expected).
- Item 3: diagram name pattern `^[a-z0-9][a-z0-9-]{0,63}$`; `infra` stays the default.
  Views as layers: a view switcher plus preset layer names (Network, Application,
  Data, CI/CD) when creating a view.

## TDD
Mode: off (source: prior ODD docs in this repo). Runner: jest (`npm test`).

## Checks per task
`npm test`, `npx tsc --noEmit`, `npm run lint` (pre-existing `import/no-cycle` warnings allowed).

## Delivery
Strategy: ask-on-risk. Forecast: ~900-1200 authored changed lines (> 400 budget).
Chain strategy: `stacked-to-main` (user choice, 2026-09-22).
Planned slices: PR1 = T1 (item 1), PR2 = T2 (item 2), PR3 = T3-T5 (item 3; split
further if it exceeds the budget). Work continues on `feat/infrastructure-model`;
slice branches are cut from the work-unit commits at PR time. Push/PR remain user decisions.

## Tasks
- [x] T1 Typed resources: schema + types + validation tests + NodeSettings controls. Route: delegated direct (writer trigger: 2+ non-trivial files). Commit `42824d4`.
- [x] T2 Semantic connectors: schema + defaults + ConnectorControls + packet label fallback + async skip in return path + tests. Route: delegated direct. Commit `6a9059c`.
- [x] T2b (commit `a90e5bf`) Review follow-ups (advisory findings of `review-bd95525d4a0a1ce8`, accepted as in-scope defects of T1/T2): cap free-text resource fields at the schema limit; port inputs must not clear the stored value on partial numeric input; drop `mode` from `CONNECTOR_DEFAULTS` so untouched connectors are not rewritten. Route: delegated direct.
- [x] T3 Multi-diagram server API in `webpack/diagram-api.js`: list, get/save by name, create, duplicate; legacy `/api/diagram` keeps working; name guard tested. Route: delegated direct (two writer runs stalled on stream watchdog; parent finished inline: 413 drain fix + checks + commit). Commit `3e452fd`.
- [x] T4 Multi-diagram client: `persistence.ts` by name + diagram picker (list/new/duplicate/open) in `BasicEditor`; port buffer re-sync (advisory from `review-0633656cbf8f242a`). Route: delegated direct. Commit `5cc6d6f`.
- [x] T4b (commit `bc971fa`; 208 tests, tsc clean; assess medium under_budget 158 lines — pending in slice) Review follow-ups of `review-541678370bd89ac4` (in-scope defects of T4): await pending save before duplicate; latest-wins diagram switch and await the flushed save before loading. Route: delegated direct.
- [x] T5 Views as layers: view switcher UI + create view with layer presets. Route: delegated direct. Commit `dd55a41` (also fixed pre-existing no-op `updateView` reducer; no callers outside tests).
- [x] T5b (commit `2101db4`; 228 tests, tsc clean; assess medium under_budget 84 lines — last commit, not separately reviewed) Review follow-ups of `review-43abbce6d58d4728`: bind the diagram name when a save is scheduled (no old model under new name); ViewSwitcher reads model via getState instead of a fresh-object selector; restore title pointer-events pass-through; fix misnamed guard test. Route: delegated direct.

## Acceptance criteria
- Existing `diagrams/infra.json` loads with no validation alert.
- Kind/props and connector semantics editable in the UI and persisted through autosave.
- Simulation shows protocol label when step label is empty; async connectors get no return step.
- User can list, create, duplicate and open diagrams by name; a name like `../x` is rejected.
- User can switch views and create a layer view from presets.

## Progress / evidence
| Task | Commit | Evidence | Review assess |
|------|--------|----------|---------------|
| T1 | `42824d4` (+289/-4, 5 files) | npm test 11 suites/107 passed; tsc clean (writer + parent spot check); lint only pre-existing no-cycle/no-console/no-alert | medium, `review_due=false` (`under_budget`, 293 lines since `d271ebc`) — pending in slice |
| T2 | `6a9059c` (+437/-21, 9 files) | npm test 11 suites/123 passed; tsc clean; parent spot check flow.test.ts 22 passed; lint only pre-existing | medium, `review_due=true` (`slice_budget_reached`, 749 lines since `d271ebc`) → consent granted → lineage `review-bd95525d4a0a1ce8` 1 lens (reliability) **approved**, acknowledged, authority burned. Reviewed boundary advances to `6a9059c`. 3 advisory findings → T2b |
| T2b | `a90e5bf` (+151/-50, 7 files) | npm test 12 suites/131 passed; tsc clean; parent spot check parsePortInput 8 passed; lint only pre-existing | medium, `review_due=false` (`under_budget`, 201 lines since `6a9059c`) — pending in slice |

Slices update: PR1 = T1 (`42824d4`), PR2 = T2 + T2b (`6a9059c`, `a90e5bf`; T2b also touches T1's NodeSettings, so PR2 stacks on PR1).

| T3 | `3e452fd` (+779/-42, 4 files) | npm test 14 suites/183 passed; webpack tests 3x consecutive 52 passed (flaky 413 ECONNRESET fixed: respond with Connection: close and keep draining, hard cut past 4x cap); tsc clean; src lint only pre-existing; `eslint webpack` not configured (tsconfig excludes webpack/) — informational | medium, `review_due=true` (1022 lines since `6a9059c`) → consent granted → lineage `review-0633656cbf8f242a` **approved**, acknowledged, burned. Boundary → `3e452fd`. Advisory: port buffer not re-synced on external change (id change covered by `key={id}` remount) → fold into T4; smoke tests order-dependent (informational) |

| T4 | `5cc6d6f` (+790/-38, 5 files) | npm test 15 suites/203 passed; tsc clean; parent spot check src/examples 20 passed; lint only pre-existing | medium, `review_due=true` (828 lines since `3e452fd`) → consent granted → lineage `review-541678370bd89ac4` **approved**, acknowledged, burned. Boundary → `5cc6d6f`. 2 WARNING advisory (duplicate stale source, switch race) → T4b; untested editor switch/localStorage/port resync → informational (no DOM test env, roadmap item 7) |

| T4b+T5 | `bc971fa`, `dd55a41` | 226 tests; tsc clean; spot check views+view reducer 18 passed | medium, review_due (740 lines since `5cc6d6f`) → granted → `review-43abbce6d58d4728` **approved**, acknowledged, burned. Boundary → `dd55a41`. Findings → T5b; untested components informational (no DOM env, roadmap 7) |
| T5b | `2101db4` (+72/-12) | 228 tests; tsc clean; lint only pre-existing | medium, under_budget (84 lines) — unreviewed tail |

Final PR slices (stacked-to-main; PR3 split because T3-T5b is ~2400 lines):
- PR1: T1 `42824d4`
- PR2: T2 + T2b `6a9059c`, `a90e5bf`
- PR3: T3 `3e452fd` (server API)
- PR4: T4 + T4b `5cc6d6f`, `bc971fa` (diagram picker)
- PR5: T5 + T5b `dd55a41`, `2101db4` (view layers)

Known limitations / follow-ups: no DOM render tests for new controls (roadmap item 7); `eslint webpack` not configured; webpack smoke tests order-dependent.

## Next step
All tasks done. All work-unit commits merged into `main` (closing commit
`6dc1a38`); `main` == `origin/main`. No further push or PR action pending.

Status reconciled against git on 2026-09-22.
