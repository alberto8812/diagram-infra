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

## Known gap carried into T3 — CLOSED by T3
The reducer ignores an arrival for a step that is not active, but the hook’s
`advance()` sent `activeSteps[0]` rather than the step whose animation
actually finished, so the guard never fired through the running app. The same
skip existed before this feature, so it was not a regression — but T3 is what
made it real, since that is where the renderer learns which packet arrived.

Closed in `b8c200a`: `advance(stepId)` now takes the arriving step's id, and
`Connector` passes the id of the packet whose tween completed. The reducer's
no-op on a stale id is now reachable — it covers a step reconciled away
between the packet arriving and the dispatch — so the guard was kept rather
than duplicated in the hook.

## Second open question for T4 — RESOLVED
What does `outcome: FAILURE` mark: the step that failed, or every step on the
failure path? The schema comment says "a step that failed at runtime", but
`flow-pr-failure` in `diagrams/infra.json` marks all five return steps, because
the whole return is what a reader wants to see as the failure. Only one of them
actually failed: the migration. The rest carry the news back.

**Decided by the user on 2026-09-23: `outcome` marks the step it is on, and
nothing else.** A whole path renders as failed by marking each of its steps —
which is exactly what `flow-pr-failure` already does. Reasons:

- It composes. "Mark the step" reproduces "mark the path" with no extra code;
  the reverse does not, since a path-wide meaning leaves no way to mark a
  single step.
- The path-wide reading would make a packet's colour depend on graph traversal,
  coupling rendering to structure, and has no meaning at all in a list flow,
  where there is no failure path to compute.
- It costs nothing. Nothing reads `outcome` today (verified: zero consumers in
  `src/` outside the schema and tests), so there is no behaviour to preserve
  and no migration. The contradiction is settled in favour of the data.

T4 therefore colours a packet by `step.outcome`, in the same place it already
picks a colour from `step.direction`.

## Open question for T4 — MOVED OUT OF T4
`next` alone can only express a fork: a step listing two successors starts
both. The roadmap wants an alternative branch — the check fails, so go back to
the developer — which is a choice, and nothing in the model expresses a
condition.

Investigated on 2026-09-23. Three findings moved this out of T4:

- **The deadlock half was never open.** `advanceActiveSteps`
  (`src/utils/flowPlayback.ts:175-203`) blocks a successor only while another
  predecessor is in flight, and `resolveInFlight` defines in flight as
  "currently active, or forward-reachable from something active" — never
  "declared but not yet arrived". A branch that was never started is absent
  from that set by construction, so it cannot block a join or keep
  `activeStepIds` non-empty. The comment at `flowPlayback.ts:170-174` already
  says so.
- **No shipped diagram uses the graph model.** `"next"` appears zero times in
  `diagrams/infra.json`; all three flows are list flows. Fork-versus-choice is
  entirely theoretical today — nobody has authored a fork.
- **The prior art does not transfer.** BPMN separates a parallel gateway
  (AND-split, take all) from an exclusive gateway (XOR-split, take exactly
  one, each outgoing flow labelled with the answer to the gateway's question);
  UML/Mermaid `alt` does the same for success/failure. But those are STATIC
  diagrams that draw both branches at once inside a labelled frame. Isoflow
  animates, and an animation cannot play "exactly one of two" without someone
  choosing which. There is no runtime here to evaluate a condition: this is a
  diagram, not a workflow engine, and the author already knows the outcome.

So the real question is not how to express a condition, but who picks the
branch at playback time. If the author picks, it is two separate scenarios —
which is what `flow-pr-failure` already is, and matches the "one scenario per
diagram" practice. If the viewer picks, that is interactivity, a much larger
feature that deserves its own decision.

T4 keeps only the rendering. This stays open as its own future question.

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
- [x] T3 Hook and renderer: `useFlowPlayback` exposes the active steps, and
      `Connector` renders a packet per active step on its own connector instead of
      gating on a single current step. Commit `b8c200a`, branch
      `feat/flow-graph-t3-renderer`. New pure helper
      `groupActiveStepsByConnectorId` in `src/utils/flow.ts` (6 tests, both
      mutation-verified: dropping the connector-existence check fails 1,
      `push` to `unshift` fails 2). `advance(stepId)` now takes the arriving
      step, closing the gap below. `ConnectorPacket` unchanged — `Connector`
      wires `onArrive` per packet, so each closure carries its own step id.
      Checks observed: `npm test` 565/565 in 50 suites, `npx tsc --noEmit`
      clean, `npm run lint` at the pre-existing 5 problems.
      Not covered: no component-level test renders `Connector`, so "N packets
      actually appear" is verified by reading the code, not by a test. The
      repo has no jsdom infrastructure for this component (global
      `testEnvironment: "node"`; only `src/examples/__tests__/
      useCurrentDiagram.test.tsx` opts in per-file). Same gap as
      `R3-mode-gating-untested` / `R3-readonly-gating-untested`.
- [x] T4 Failure rendering: a step with `outcome: 'FAILURE'` renders its packet
      distinctly, reusing the existing palette rather than a hardcoded colour.
      Unblocked on 2026-09-23: `outcome` marks its own step (see the resolved
      question above), and branch selection is no longer part of this task.
      Commit `340ec92`, branch `feat/flow-graph-t4-failure-rendering`.
      `getPacketColor(direction, outcome, palette)` in `src/utils/flowPacket.ts`
      decides outcome first, direction second; the caller passes the three
      colours so the rule stays pure and testable without a DOM. 5 tests,
      mutation-verified: letting direction win fails exactly the 2 failure
      tests.
      **The colour needed measuring, not taste.** `error.main` alone would not
      have read as a failure: this theme's RESPONSE colour is already a red
      (`#df004c`) and error red sits 10.1 deltaE from it — and every FAILURE
      step in the shipped diagrams is a RESPONSE step, so the change would have
      been invisible exactly where it matters. Darkened and saturated through
      the existing `getColorVariant` it measures 22.4 from RESPONSE and 49.4
      from REQUEST. User chose this over `warning.main` (30.7 but means
      "warning", not "failure").
      Checks observed: `npm test` 570/570 in 50 suites, `npx tsc --noEmit`
      clean, `npm run lint` at the pre-existing 5 problems.
      Not covered: no component test renders the packet, so the colour reaching
      the DOM is verified by reading the code. Same gap as T3.
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
- [x] T2b Review follow-ups on T2, treated as in-scope defects: one root cause
      (`flowPlaybackReducer` trusted step ids without checking they still
      resolve against the flow it was handed) surfacing as three symptoms.
      ADVANCE now ignores an arrival for a step that isn't currently active
      (a stale or duplicate arrival could otherwise restart an already-finished
      step). PREV_STEP now filters a restored history snapshot against the
      current flow, skipping snapshots that no longer resolve at all instead
      of restoring dangling ids, and keeps popping until one survives or the
      history runs out. RECONCILE's legacy call path (`FlowPlaybackReconciler.tsx`
      via `uiStateStore.tsx`'s `reconcile` action) now passes the resolved
      `Flow` through to the reducer, plus a precise per-step
      `activeConnectorStepIds` list computed against every active step
      instead of the old single-stepIndex-derived boolean, so a step deleted
      from the model is dropped and the active set reseeds from
      `getFlowStartSteps` when it would otherwise empty out while a flow is
      still selected. All three fixes share one helper, `resolveKnownStepIds`
      in `src/utils/flowPlayback.ts`, documented as the invariant the reducer
      rests on. `stepIndex` could not be removed: `FlowPlaybackBar.tsx` (out
      of scope) still reads it directly for its "Step N / total" label.
      7 tests added to `flowPlayback.test.ts` (513 to 520).
- [x] T2c Review follow-ups on T2b, treated as in-scope defects.
      Fix 1 (WARNING, reproduced): PLAY had become a dead button whenever
      `activeStepIds` was empty - which happens both when a list flow's run
      finishes and when NEXT_STEP steps past the last step - regressing the
      most common case, since every existing diagram is a list flow. PLAY now
      restarts the flow from `getFlowStartSteps` (and clears history) when
      the active set is empty and the flow has steps; it stays a no-op only
      when there is no flow, or the flow has no steps. This is a deliberate
      improvement over the pre-T2 behaviour, which replayed only the last
      step (see the updated acceptance criterion below). 6 tests added to
      `flowPlayback.test.ts`.
      Fix 2 (SUGGESTION): `FlowPlaybackReconciler.tsx`'s inline
      `activeConnectorStepIds` filter used no DOM at all despite living in an
      untestable component, so it is now `resolveActiveConnectorStepIds` in
      `src/utils/flow.ts`, next to `findFlowStepConnector` which it already
      uses. The component calls it; 4 tests added to `flow.test.ts`.
      A pre-existing test caught a real gap in Fix 1 rather than
      contradicting it: `PLAY is a no-op when nothing is active` asserts
      that PLAY changes nothing from an idle state, and the first restart
      rule started steps while `flowId` was still null. PLAY now refuses to
      restart with no flow selected, and the test passes untouched.
      `uiStateStore.tsx`’s `play()` was also the only playback action not
      forwarding the selected flow, so the restart could never fire through
      the real button; `play(flow)` and the hook now pass it, matching
      `stop`/`nextStep`/`prevStep`/`advance`.
      Route: delegated direct, finished inline by the parent (the writer
      stopped at the failing test, as instructed, instead of editing it).
- [x] T2d Correction required by review `review-a459f617cf7d7ff5` (BLOCKER
      `R3-reconcile-reseed-not-idempotent`, corrected and then confirmed by
      its targeted validator): RECONCILE’s reseed branch returned a new
      state object on every pass, so an entry step whose connector had been
      deleted reseeded to the same ids forever. The reconciler derives a memo
      from `activeStepIds`, so new identity meant new effect dependencies and
      an endless effect/store/render loop. Reseeding now returns the state
      untouched when nothing moved — the guard the pre-T2 code had and the
      move to an id set dropped. Its test asserts identity across repeated
      reconciles, since equality was exactly what the loop already satisfied.
      Route: direct inline.
- [x] T2e Review follow-ups on T2d, treated as in-scope defects. ADVANCE
      pushed the last step onto the history when the run finished, so the
      first Prev restored the step already on screen and the button appeared
      dead; the finished run no longer pushes, which is what the pre-T2
      behaviour did. RECONCILE stopped clamping `stepIndex`, so a finished
      run whose flow then lost steps could leave it pointing past the end and
      FlowPlaybackBar showing a position the flow does not have; the
      unchanged-survivors branch clamps again, while still returning the same
      object when nothing moved, so T2d’s loop guard holds. One T2-era test
      pinned the history push and was updated, with the reason recorded beside
      the assertion: it documented the deviation this finding named, not a
      behaviour from the base. Route: direct inline.

## Acceptance criteria
- An existing flow with no successor data advances step by step exactly as
  before, with one deliberate change (T2c): pressing Play after the run has
  finished, or after NEXT_STEP has stepped past the last step, restarts the
  flow from its entry points instead of staying a dead button. The pre-T2
  reducer replayed only the last step (`stepIndex` was just clamped back into
  range); T2 made an empty active set a silent no-op, which regressed the
  most common case, since every existing diagram is a list flow. Restarting
  from the entry points is what "play again" means for a flow that can now
  have several entry points and several steps in flight at once, and it
  matches what STOP and RECONCILE already do to mean "the beginning". This
  restart also clears playback history, so PREV_STEP right after it cannot
  jump into the finished run's snapshots.
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
T5, the last task: author successors and outcome in `FlowEditorDialog`, and
make "add return path" generate steps that declare their own successors.

Worth knowing before starting it: the editor is list-shaped today. Every
author-facing verb (add step, up/down, delete, add return path) operates on a
flat array, and there is no control for `next` or `outcome` anywhere. The graph
capability is currently reachable only by hand-editing JSON — no shipped
diagram declares `next` at all. T5 is therefore the largest of the three, and
it is where the branch-selection question above will become concrete.

## Evidence
Measured against the final state of this branch (T1 through T2f), not an
intermediate run:
- `npm test`: 537 tests / 49 suites passing. The baseline on `main` is 480 / 48.
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

## Evidence (T2b)
Measured against the final state of this branch (T1 through T2b):
- `npx jest src/utils/__tests__/flowPlayback.test.ts`: 38 tests passing.
- `npm test`: 520 tests / 49 suites passing (513 / 49 before T2b; 7 tests added,
  no suite added or removed).
- `npx tsc --noEmit`: clean.
- `npm run lint`: the same 5 pre-existing problems as `main` (2 `import/no-cycle`
  errors in `view.ts`/`viewItem.ts`, 3 `no-console`/`no-alert` warnings). None
  added.

Route: delegated direct (writer trigger: touches 4+ files -
`flowPlayback.ts`, `uiStateStore.tsx`, `FlowPlaybackReconciler.tsx`,
`types/ui.ts`, plus the test file).

No test was added for `FlowPlaybackReconciler.tsx` itself: `jest.config.js`
uses `testEnvironment: "node"` (no jsdom), and this project has no existing
component-render test setup, so a DOM-dependent test would not run.
