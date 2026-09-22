# Infrastructure Design Phases 0-4

Locator: `odd/tasks/infra-design-phases.md` · Engram mirror: `odd/infra-design-phases/tasks`
Branch: `feat/infra-design-phases` (from `main` @ `3ae0c2e`)
Source: research report `../reports/Diseño de infraestructura en Isoflow.md` (outer repo), phases 0-4.

## Objective
Turn the typed diagram into a verifiable infrastructure design: containment zones,
architecture rules, threat modeling + compliance mapping, Terraform import, and
design-time cost estimation.

## Problem / why
Typed metadata (T1/T2 of `infrastructure-model`) is display-only. Rectangles are
decoration (`src/schemas/rectangle.ts`), so the model cannot say "DB is in a private
subnet of VPC prod in AZ a". Without containment there are no rules, no trust
boundaries, no IaC hierarchy, and no redundancy-aware cost.

## Scope
- In: phases 0-4 of the research roadmap.
- Out: phase 5 (drift/live sync), 6 (richer simulation), 7 (tech debt), 8 (collaboration).

## Constraints
- All new fields optional; existing diagrams (`diagrams/infra.json`) must load unchanged.
- Containment is **geometric** (user decision 2026-09-22): a rectangle becomes a typed
  zone; a node belongs to every zone whose tile area contains its tile; zone nesting is
  derived from rectangle containment. Containment is per view.
- Pure logic (containment, rules, threats, import, cost) lives in `src/utils/` (or a
  dedicated folder) with unit tests; jest env is node (no DOM tests).
- Never touch `diagrams/` (user-owned). Restart `npm start` after `webpack/` changes.
- Pre-existing `import/no-cycle` in `view.ts`/`viewItem.ts` is accepted debt.

## Design decisions
- P0: optional rectangle fields `zone` kind (`account|region|vpc|az|subnet|securityGroup|
  cluster|onPrem`), `name`, `visibility` (`public|private`, meaningful for subnets).
  Partially overlapping zones are allowed by the schema and reported by a rule (P1).
- P1: pure rule engine `lintDiagram(model) -> Issue[]` (rule id, severity, message,
  target ids, view id), rules as data + functions; issues panel in the UI.
- P2: node `dataClassification`, `encryptedAtRest`, `internetFacing`; connector
  `encryptedInTransit` (derived from protocol/auth when unset). STRIDE generator per
  element/flow; rule→control mapping (CIS AWS, SOC 2, ISO 27001, PCI DSS); Markdown/JSON report.
- P3: Terraform `terraform show -json` (state and plan) import for AWS core resources,
  containment via `vpc_id`/`subnet_id`/`availability_zone`, auto-layout into nested zones.
- P4: cost source = **local catalog** (user decision 2026-09-22): editable JSON price
  table in the repo for common AWS resources by region and size; offline, no
  credentials; prices are approximate and carry a "last updated" date.

## TDD
Mode: off (source: prior ODD docs in this repo). Runner: jest (`npm test`).

## Checks per task
`timeout 300 npm test -- --ci --watchAll=false`, `npx tsc --noEmit`, `npm run lint`.

## Delivery
Strategy: ask-on-risk. Forecast: ~3000-4000 authored changed lines (> 400 budget).
Chain strategy: `stacked-to-main` (user choice 2026-09-22): one PR per phase (P0..P4),
merged to main in order. Slice branches `feat/design-0X-*` cut from phase commits at PR
time. Push/PR remain user decisions (gh CLI not authenticated on this machine).

## Tasks
- [x] P0 Containment zones: rectangle zone schema + containment utils + RectangleControls + zone labels + tests. Route: delegated direct. Commit `28df261`.
- [x] P0b (commit `8e8b2d0`) Review follow-ups of `review-6af0a9abb2f334f4`: consistent tie-break for identical-bounds zones; clear `visibility` when zone kind changes away from subnet; tests. Route: delegated direct (same writer as P1, separate commit).
- [x] P1 Architecture rules: rule engine + rule set + issues panel + tests. Route: delegated direct. Commit `a3ef8b1` (`src/rules/`, 8 rules, Issues button in ToolMenu).
- [x] P1b (commit `75f83e8`, src/rules/lintCache.ts) Review follow-up of `review-f544e52e9949c29a`: lint computed once and shared by ToolMenu badge and IssuesPanel. Route: delegated direct (with P2 writer, separate commit).
- [x] P2 Threat modeling + compliance: security attributes + STRIDE generator + control mapping + report + tests. Route: delegated direct. Commit `31dd4c7` (SOC 2 / ISO 27001:2022 / PCI DSS 4.0; CIS AWS omitted on purpose — version-dependent control ids).
- [x] P2b (commit `f6c86d3`) Review follow-ups of `review-e44ccdfbe7df6f1e` (4 lenses): unique React keys + reuse report grouping in SecurityReportDialog; single source for data-store kinds and sensitive classifications; keep RECTANGLE target type in compliance findings; import RULE_ID constants in the mapping; filename without colons. Route: delegated direct (with P3 writer, separate commit).
- [x] P3 Terraform import: parser + resource mapping + nested auto-layout + import UI + tests. Route: delegated direct. Commit `b828bf6` (`src/import/terraform/`).
- [x] P3b (commit `43c8d43`) Review follow-ups of `review-d0b0ef7eacc7ffeb` (4 lenses): encryptedAtRest false positive on empty/null SSE config; count/for_each instances collapsing to the first candidate; atomic diagram creation on import; mappedResources counting synthetic zones; prototype-safe environment alias lookup; literal parent match must check zone kind; test name, stale comment, magic 1000, unused entrypoint, parse-error tests. Route: delegated direct (with P4 writer, separate commit).
- [x] P4 Cost estimation: sizing attributes + local catalog + per-node/zone/environment totals + Cost dialog + tests. Route: delegated direct. Commit `648e967`.
- [x] P4b (commit `e0e5c37`) Review follow-ups of `review-274959b5eb3e20e0`: prototype-safe region lookup; reject non-finite numeric input; shared buffered-input helper. Server-side concern verified instead: `POST /api/diagrams` does store the posted model (`webpack/diagram-api.js:241-253`).

## Acceptance criteria
- A node's zones (innermost→outermost) are computed from the drawing; existing diagrams unchanged.
- Rules flag at least: data store in a public zone, prod resource without owner, prod database in a single AZ, plaintext protocol crossing a zone boundary, cross-VPC connector not through a gateway/load balancer, partially overlapping zones.
- A threat/compliance report lists STRIDE threats per element/flow and the controls each finding maps to.
- A Terraform JSON (state or plan) imports into a new diagram with nested zones.
- Each costed node shows a monthly estimate; totals per zone and per diagram.

## Progress / evidence
| Task | Commit | Evidence | Review |
|------|--------|----------|--------|
| P0 | `28df261` (+1004/-18, 11 files) | npm test 19 suites/253 passed; tsc clean; parent spot check containment+rectangle 25 passed; lint only pre-existing | medium, due (1022 lines since `3ae0c2e`) → granted → `review-6af0a9abb2f334f4` **approved**, acknowledged, burned. Boundary → `28df261`. 2 WARNING → P0b; UI untested informational |
| P3b+P4 | `43c8d43` (+496/-45), `648e967` (+1478/-3, 17 files) | npm test 47 suites/461 passed; tsc clean (parent spot check); cost+import 89 passed | medium, due (2022 lines since `b828bf6`) → granted → `review-274959b5eb3e20e0` **approved**, acknowledged, burned. Boundary → `648e967`. Findings → P4b; server-contract warning verified false |
| P4b | `e0e5c37` (+127/-32, 5 files) | npm test 47 suites/472 passed; tsc clean; cost+parseNumberInput 38 passed | medium, `review_due=false` (`under_budget`, 159 lines) — unreviewed tail |
| P2b+P3 | `f6c86d3` (+242/-96), `b828bf6` (+2444, 16 files) | npm test 42 suites/418 passed; tsc clean (parent spot check); src/import 56 passed | **high** risk, due (2782 lines since `31dd4c7`) → granted → `review-d0b0ef7eacc7ffeb` 4 lenses **approved**, acknowledged, burned. Boundary → `b828bf6`. 13 findings (4 substantive) → P3b |
| P1b+P2 | `75f83e8` (+100/-2), `31dd4c7` (+2895/-19, 25 files) | npm test 36 suites/350 passed; tsc clean (parent spot check); security+compliance+rules 94 passed | **high** risk (security code), due (3016 lines since `a3ef8b1`) → granted → `review-e44ccdfbe7df6f1e` 4 lenses (risk/resilience/readability/reliability) **approved**, acknowledged, burned. Boundary → `31dd4c7`. 5 findings → P2b |
| P0b+P1 | `8e8b2d0` (+117/-22), `a3ef8b1` (+1989/-3, 26 files) | npm test 28 suites/293 passed; tsc clean (parent spot check); src/rules 37 passed | medium, due (2131 lines since `28df261`) → granted → `review-f544e52e9949c29a` **approved**, acknowledged, burned. Boundary → `a3ef8b1`. Duplicate full lint → P1b; changeView does not reset itemControls (verified `uiStateStore.setView`), untested UI informational |

Branch total vs `main@3ae0c2e`: 90 files, +10692/-40, 10 commits.

Final PR slices (stacked-to-main, one per phase):
- PR1: P0 + P0b (`28df261`, `8e8b2d0`) — containment zones
- PR2: P1 + P1b (`a3ef8b1`, `75f83e8`) — architecture rules + Issues panel
- PR3: P2 + P2b (`31dd4c7`, `f6c86d3`) — threats + compliance report
- PR4: P3 + P3b (`b828bf6`, `43c8d43`) — Terraform import
- PR5: P4 + P4b (`648e967`, `e0e5c37`) — cost estimation

Known limitations: no DOM/component tests (roadmap item 7); compliance mapping is indicative (CIS AWS omitted on purpose); cost catalog is approximate list pricing with a lastUpdated date; Lambda intentionally unpriced.

## Next step
All phases done. Push and PR creation pending user decision (gh CLI not authenticated).
