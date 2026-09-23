# Flow Graph Model (roadmap item 4, parts 1-2)

Created 2026-09-22. Covers the failure-branch and parallel-step halves of roadmap
item 4 (`odd/roadmap/infrastructure-platform.md`). GIF/video export is explicitly
out of scope here — see "Out of scope" below for why it has to come after.

## Objective
Let a flow describe what actually happens at runtime: a step can fail and route to
an alternative path, and several steps can run at the same time. Today a flow can
only say "this, then this, then this".

## Problem / why
Playback is a single cursor over a flat list. `Flow.steps` is a plain array
(`src/schemas/flow.ts:14-19`), the playback cursor is one number
(`FlowPlayback.stepIndex`, `src/types/ui.ts:149-154`), and advancing is literally
`stepIndex + 1` (`src/utils/flowPlayback.ts:91-103`). One step, one packet, one
connector at a time (`Connector.tsx:190-233`).

Failure branches and parallel steps look like two features but are one change:
both need "what runs next" to stop being arithmetic over a list position and
become a lookup over a graph. Building them separately means building the graph
twice, then reconciling two different notions of "next".

## Scope
- Successors declared per step, so a flow is a graph instead of a list.
- Several steps active at once when a step declares more than one successor.
- A step can carry a failure outcome, which routes to its own successors and
  renders differently.
- Backward compatibility: a flow whose steps declare no successors keeps playing
  exactly as it does today, in array order.

## Out of scope
- GIF/video export (roadmap item 4, third part). A recording needs a settled
  timeline; branching and parallelism are what settle it, so export comes after,
  not before. There is also no capture pipeline in the repo today — only
  single-frame PNG via dom-to-image (`src/utils/exportOptions.ts:47-54`), no
  MediaRecorder and no encoder — so it is a subsystem of its own.
- Drift detection (roadmap item 6).

## Constraints
- Existing diagrams must keep loading and playing unchanged. `diagrams/infra.json`
  has two flows with no successor data.
- `flowPlaybackReducer` is pure and covered by 309 lines of tests
  (`src/utils/__tests__/flowPlayback.test.ts`). Those tests are the safety net for
  this change; they get extended, never weakened to fit.
- The packet tween is driven by GSAP and advances on a single `onArrive` callback
  (`ConnectorPacket.tsx:135-160`, `Connector.tsx:330-349`). Concurrency means more
  than one tween can be in flight, so "the step finished" stops being "the step".
- Zod strips undeclared keys, so any new field must be declared in the schema or
  it is silently dropped on load and save (see `src/schemas/__tests__/diagrams.test.ts`).

## Design decisions
- `FlowStep.next?: string[]` — explicit successor step ids. A flow is a graph or a
  list, never half: it is a graph as soon as any of its steps declares `next`
  (present, even empty), and in a graph flow a step's successors are exactly its
  resolved `next` — dangling ids skipped, repeats deduped, declared order
  preserved — with an absent or empty `next` meaning the branch ends (`[]`).
  Array order is never consulted in a graph flow. A flow where no step declares
  `next` is a list flow and keeps the old array-order fallback, which is what
  keeps every existing (pre-graph) flow working unchanged. More than one entry
  means those steps start together.
- `FlowStep.outcome?: 'SUCCESS' | 'FAILURE'` — the semantic marker a failing step
  needs. A failure branch is then an ordinary step marked FAILURE whose `next`
  points at the recovery path; no separate branch type is introduced.
- The playback cursor moves from `stepIndex: number` to a set of active step ids.
  A flow with no successor data yields exactly one active step at a time, so the
  existing behaviour falls out of the general case rather than being special-cased.
- Graph traversal lives in a pure helper so it can be tested without React, GSAP
  or the DOM, which the render layer cannot be.
- A flow's entry points are its roots, plus the earliest step of each group the
  roots never reach, until every step is reachable. Roots alone cannot say where
  a cyclic flow begins, and a failure branch that retries by pointing back at the
  opening step is exactly how a cycle appears here. Array order breaks the tie
  inside an unreachable group, because the step the author wrote first is the
  only record the model keeps of where they meant to begin.

## Open question for T4
`next` alone can only express a fork: a step listing two successors starts
both. The roadmap wants an alternative branch — the check fails, so go back to
the developer — which is a choice, and nothing in the model expresses a
condition. T4 has to decide how `outcome` selects a branch rather than running
every branch. T2 must not assume a dead branch will ever arrive, or a join
would wait forever for a path that was never taken.

## TDD
Mode: off (source: prior ODD docs in this repo). Runner: jest (`npm test`).

## Checks per task
`npm test`, `npx tsc --noEmit`, `npm run lint`.

## Delivery
Strategy: ask-on-risk. The forecast is above the ~400 authored-line budget, so the
user chose the chain strategy on 2026-09-22: stacked-to-main. Each task ships as
its own pull request against `main`, in order, merged before the next one starts.

## Tasks
- [x] T1 Schema and pure traversal: add `next` and `outcome` to `flowStepSchema`,
      and a pure `resolveNextSteps(flow, stepId)` helper that falls back to array
      order when `next` is absent. Unit tests including cycles and dangling ids.
      No playback behaviour change yet.
- [x] T2 Reducer: `FlowPlayback` moves from `stepIndex` to an active step-id set,
      advancing through the T1 helper. Extend `flowPlayback.test.ts`; every
      existing assertion must still hold for linear flows.
- [ ] T3 Hook and renderer: `useFlowPlayback` exposes the active steps, and
      `Connector` renders a packet per active step on its own connector instead of
      gating on a single current step.
- [ ] T4 Failure rendering: a step with `outcome: 'FAILURE'` renders its packet
      distinctly, reusing the existing palette rather than a hardcoded colour.
- [ ] T5 Editor UI: author successors and outcome in `FlowEditorDialog`, keeping
      the current linear add/reorder flow usable for simple cases. Must also
      make "add return path" (`buildReturnPathSteps` / `getMissingReturnPathSteps`
      in `src/utils/flow.ts`) generate steps that declare their own successors:
      today those steps have no `next`, so in a graph flow every generated step
      would resolve as terminal and the return path would not chain.
- [x] T1b Review follow-ups on T1, treated as in-scope T1 defects: fixed the
      graph-vs-list asymmetry in `resolveNextSteps` (an absent or empty `next`
      in a graph flow now ends the branch instead of falling back to array
      order) and added a round-trip test for the `next`/`outcome` schema
      fields.
- [x] T1c Review follow-ups on T1b, treated as in-scope defects: corrected the
      `next` comment in `src/schemas/flow.ts`, which still described the array
      fallthrough T1b removed and would have misled T2 and T5; refreshed the
      Evidence section, which still carried T1's numbers; and made
      `getFlowStartSteps` return the real roots of a graph flow — every step no
      step lists as a successor — instead of always the first array element.
      A pure cycle has no root, so it falls back to the first step: without
      that, a flow whose failure branch returns to an earlier step could never
      start.
- [x] T1d Review follow-up on T1c, treated as an in-scope defect: entry points
      are now the roots plus the earliest step of each group the roots never
      reach. Falling back to the first step only when a flow had no root at all
      meant that a retry cycle plus one stray step handed the entry to the
      stray step and never ran the opening step. Route: direct inline (small
      and fully specified; the T1c writer had stalled, so the parent finished
      it).
- [x] T1e Review follow-ups on T1d, treated as in-scope defects: an entry that
      another entry already leads into is now dropped, because the earliest
      unreached step can be a sink sitting before the rootless cycle that feeds
      it, which started it twice; the walk became iterative over an id-to-step
      Map, since T2 will call this on every playback; and the entry comment
      still carried a paragraph describing the rule T1d replaced, contradicting
      the paragraph below it.

## Acceptance criteria
- An existing flow with no successor data plays exactly as before, step by step.
- A step declaring two successors starts both, and the flow continues only once
  both have arrived.
- A FAILURE step routes to its own successors and is visually distinguishable.
- `diagrams/infra.json` still parses and plays; `diagrams.test.ts` stays green.
- A flow with a dangling successor id or a cycle does not hang playback.

## Progress / evidence
- Exploration done (delegated mapper): playback is strictly index-based, one
  packet at a time; no capture/export pipeline exists.
- Scope chosen by the user: graph model, not a narrow failure-only cut.

## Next step
T2: move the playback cursor from `stepIndex` to an active step-id set,
advancing through `resolveNextSteps`.

## Evidence
Measured against the final state of this branch (T1 through T2), not an
intermediate run:
- `npm test`: 513 tests / 49 suites passing. The baseline on `main` is 480 / 48.
- `npx tsc --noEmit`: clean.
- `npm run lint`: the same 5 pre-existing problems as `main` (2 `import/no-cycle`
  errors in `view.ts`/`viewItem.ts`, 3 `no-console`/`no-alert` warnings). None
  added, verified by stashing the change and re-running.

Route: delegated direct (writer trigger: 4+ non-trivial files). The T1c writer
stalled partway through; the parent verified its partial work and finished the
remaining follow-up inline.

An earlier revision of this section recorded T1's numbers after T1b had already
changed the behaviour. Verification evidence names the state it was measured
against, or it is worse than no evidence at all.
