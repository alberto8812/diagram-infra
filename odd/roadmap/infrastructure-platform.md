# Infrastructure Platform Roadmap

Status: backlog (not started). Captured 2026-09-21 after the animated flow simulation
feature (`odd/tasks/animated-flow-simulation.md`).

## Problem
Isoflow is a drawing editor: nodes are icons with a name and free HTML description,
connectors are lines. To serve as a system for designing any kind of infrastructure,
the diagram must know what it represents.

## Recommended order
1 + 2 first (semantic model; unblocks 4, 5, 6), then 3 (most requested day to day).
6 is the long-term horizon. Pay down 7 before growing.

## Items

### 1. Typed resources with metadata (foundation)
- Add `kind` to model items (e.g. `database`, `queue`, `lb`, `runner`, `service`).
- Typed properties per kind: engine, version, port, region, environment
  (dev/test/prod), owner.
- All new fields optional; existing diagrams keep loading.

### 2. Semantic connectors
- Protocol (HTTP, gRPC, SQL, SSH), port, sync vs async, auth.
- Simulation reads them: packet label from protocol; async steps do not wait for
  a response.

### 3. Multiple diagrams and environments
- Today autosave writes a single fixed file (`diagrams/infra.json`).
- Diagram list, new, duplicate, open any file from `diagrams/` (keep server-side
  path guard: client picks by name from a whitelist, never sends a path).
- Use existing multi-`views` support as layers: network, application, data, CI/CD.

### 4. Richer simulation (builds on flows)
- Failure scenarios: failing step (red packet, rollback) and alternative branches
  (e.g. check fails -> back to developer).
- Parallel steps (today playback is strictly linear).
- Export simulation to GIF/video.

### 5. Architecture rules / validation
- Infra lints: prod database reachable from a public zone; connector crossing the
  VPC outside the single entry point; resource without owner.
- Cheap once item 1 exists; turns a drawing into a review tool.

### 6. IaC integration (most ambitious)
- Import from Terraform state/plan, CloudFormation, docker-compose.
- Drift detection: diagram says A, real infrastructure says B.
- Needs item 1 as the target model.

### 7. Technical debt to pay first
- Duplicate flow/step ids are not validated.
- No DOM/render tests (jest `testEnvironment: node`, no jsdom).
- Connector SVG `transform: scale(-1, 1)` hack (TODO in `Connector.tsx`).
- `import/no-cycle` in `src/stores/reducers/view.ts` and `viewItem.ts`.
- Open advisory findings from review `review-c2b54bdcae1a87a7`:
  - WARNING `getMissingReturnPathSteps` prefix match duplicates steps after an
    edited mirror (`src/utils/flow.ts:119-128`).
  - Block ground shadow clipped by viewBox (`IsometricBlockIcon.tsx:63-80`).
  - Icon style resolution untested (`src/hooks/useIcon.tsx:33-37`).

## Open question
Audience: internal team documentation only, or a product for other teams/clients?
The answer changes priority of 3 (collaboration/multi-diagram) vs 5/6.
