# Infrastructure Platform Roadmap

Status: in progress. Captured 2026-09-21 after the animated flow simulation
feature (`odd/tasks/animated-flow-simulation.md`). Status reconciled against
git on 2026-09-22 (see per-item state below).

## Problem
Isoflow is a drawing editor: nodes are icons with a name and free HTML description,
connectors are lines. To serve as a system for designing any kind of infrastructure,
the diagram must know what it represents.

## Recommended order
1 + 2 first (semantic model; unblocks 4, 5, 6), then 3 (most requested day to day).
6 is the long-term horizon. Pay down 7 before growing.

## Items

### 1. Typed resources with metadata (foundation) — DONE
- Add `kind` to model items (e.g. `database`, `queue`, `lb`, `runner`, `service`).
- Typed properties per kind: engine, version, port, region, environment
  (dev/test/prod), owner.
- All new fields optional; existing diagrams keep loading.
- Delivered by `odd/tasks/infrastructure-model.md` (T1, commit `42824d4`),
  merged into `main` at `6dc1a38`.

### 2. Semantic connectors — DONE
- Protocol (HTTP, gRPC, SQL, SSH), port, sync vs async, auth.
- Simulation reads them: packet label from protocol; async steps do not wait for
  a response.
- Delivered by `odd/tasks/infrastructure-model.md` (T2/T2b, commits `6a9059c`,
  `a90e5bf`), merged into `main` at `6dc1a38`.

### 3. Multiple diagrams and environments — DONE
- Today autosave writes a single fixed file (`diagrams/infra.json`).
- Diagram list, new, duplicate, open any file from `diagrams/` (keep server-side
  path guard: client picks by name from a whitelist, never sends a path).
- Use existing multi-`views` support as layers: network, application, data, CI/CD.
- Delivered by `odd/tasks/infrastructure-model.md` (T3-T5b, commits `3e452fd`,
  `5cc6d6f`, `bc971fa`, `dd55a41`, `2101db4`), merged into `main` at `6dc1a38`.

### 4. Richer simulation (builds on flows) — NOT STARTED
- Failure scenarios: failing step (red packet, rollback) and alternative branches
  (e.g. check fails -> back to developer).
- Parallel steps (today playback is strictly linear).
- Export simulation to GIF/video.
- The base playback engine (play/pause/step/speed, packet animation along a
  connector) was delivered by `odd/tasks/animated-flow-simulation.md`, merged
  into `main` at `a882a5a`. The advanced layer above it (failure scenarios,
  parallel steps, GIF/video export) has not been started.

### 5. Architecture rules / validation — DONE
- Infra lints: prod database reachable from a public zone; connector crossing the
  VPC outside the single entry point; resource without owner.
- Cheap once item 1 exists; turns a drawing into a review tool.
- Delivered by `odd/tasks/infra-design-phases.md` phase P1 (rule engine + Issues
  panel, commits `a3ef8b1`, `75f83e8`), merged into `main` at `ef410f5`.

### 6. IaC integration (most ambitious) — PARTIAL
- Import from Terraform state/plan, CloudFormation, docker-compose.
- Drift detection: diagram says A, real infrastructure says B.
- Needs item 1 as the target model.
- Terraform `terraform show -json` import (state and plan) is DONE: delivered by
  `odd/tasks/infra-design-phases.md` phases P3/P3b (commits `b828bf6`, `43c8d43`),
  merged into `main` at `ef410f5`. CloudFormation/docker-compose import and
  drift detection are NOT started — `infra-design-phases.md` explicitly scoped
  drift/live sync out as "phase 5".

### 7. Technical debt to pay first — PARTIAL, still open
- Duplicate flow/step ids are not validated. Still open; see
  `odd/tasks/animated-flow-simulation.md`.
- No DOM/render tests (jest `testEnvironment: node`, no jsdom). Still open across
  `animated-flow-simulation.md`, `infra-design-phases.md`, and
  `infrastructure-model.md`.
- Connector SVG `transform: scale(-1, 1)` hack (TODO in `Connector.tsx`). Status
  unconfirmed — see `odd/tasks/animated-flow-simulation.md`.
- `import/no-cycle` in `src/stores/reducers/view.ts` and `viewItem.ts`. Accepted
  as debt (not fixed) per `odd/tasks/infrastructure-model.md` and
  `odd/tasks/infra-design-phases.md` constraints.
- Open advisory findings from review `review-c2b54bdcae1a87a7`: status
  unconfirmed — see `odd/tasks/animated-flow-simulation.md`.
  - WARNING `getMissingReturnPathSteps` prefix match duplicates steps after an
    edited mirror (`src/utils/flow.ts:119-128`).
  - Block ground shadow clipped by viewBox (`IsometricBlockIcon.tsx:63-80`).
  - Icon style resolution untested (`src/hooks/useIcon.tsx:33-37`).

## Open question
Audience: internal team documentation only, or a product for other teams/clients?
The answer changes priority of 3 (collaboration/multi-diagram) vs 5/6.
