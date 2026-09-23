# Isoflow — Current State (Code Audit)

Repo: `C:\Users\soporteqa\Documents\carlos\diagramas\isoflow` (branch `main`, read-only audit, no files modified). Fact = read directly from source, cited `file:line`. Inference = explicitly marked.

## Data model: what fields exist for nodes, connectors, rectangles, text boxes, views, flows

### Takeaway
The model (`src/schemas/model.ts`) is a zod-validated tree: `title/description/items/views/icons/colors/flows`. Model items (nodes) and connectors got a "typed resource metadata" layer added by a recent in-repo feature (`odd/tasks/infrastructure-model.md`), but every semantic field is optional free-form/enum metadata with **no computed behavior** beyond display and one packet-label fallback — nothing validates or enforces the semantics. Rectangles/zones are pure decoration (id, color, `from`/`to` coords) with **no type, no containment, no nesting**. There is no VPC/subnet/AZ/region/account hierarchy or trust-boundary concept anywhere in the schema or types.

### Cited Findings — Model items (nodes)
- `modelItemSchema`: `id`, `name` (≤100 chars), `description` (≤1000 chars, optional), `icon` (id, optional), `iconStyle` (`FLAT|BLOCK`, optional), `kind` (enum, optional), `environment` (`dev|test|prod`, optional), `engine`/`version`/`region`/`owner` (free strings ≤60 chars, optional), `port` (int 1–65535, optional) — [src/schemas/modelItems.ts:29-44](../../../src/schemas/modelItems.ts)
- `resourceKindOptions = ['service','database','cache','queue','loadBalancer','gateway','storage','runner','network','user','external']` — a fixed enum, not extensible at runtime — [src/schemas/modelItems.ts:13-25](../../../src/schemas/modelItems.ts)
- All these fields are optional specifically so `diagrams/infra.json` and pre-existing diagrams keep loading through `modelSchema.safeParse` unchanged — [src/schemas/modelItems.ts:10-12](../../../src/schemas/modelItems.ts)
- `description` is free-form HTML/Markdown via a rich-text editor (`react-quill`), not a typed field — [src/components/MarkdownEditor/MarkdownEditor.tsx], referenced in [src/components/ItemControls/NodeControls/NodeSettings/NodeSettings.tsx:112-119]
- `kind`/`environment`/`engine`/`version`/`port`/`region`/`owner` are editable in the "Resource" section of `NodeSettings.tsx` — [src/components/ItemControls/NodeControls/NodeSettings/NodeSettings.tsx:157-278]

### Cited Findings — Connectors
- `connectorSchema`: `id`, `description` (≤1000, optional), `color` (id, optional), `width`, `style` (`SOLID|DOTTED|DASHED`), `animated` (bool), `direction` (`FORWARD|REVERSE|BOTH`), `anchors` (array, required), `protocol` (`HTTP|HTTPS|gRPC|SQL|SSH|TCP|AMQP`, optional), `port` (int 1–65535, optional), `mode` (`sync|async`, optional), `auth` (`none|basic|token|mtls|iam`, optional) — [src/schemas/connector.ts:46-59](../../../src/schemas/connector.ts)
- An anchor references at most one of `{item, anchor, tile}` — a connector endpoint is either a model item, another connector's anchor, or a raw tile coordinate — [src/schemas/connector.ts:35-44](../../../src/schemas/connector.ts)
- A connector must have ≥2 anchors, enforced by `validateConnector` — [src/schemas/validation.ts:182-192](../../../src/schemas/validation.ts)
- Editable in `ConnectorControls.tsx`: description, color, width, style, animated flow + direction, and a "Semantics" section for protocol/port/mode/auth — [src/components/ItemControls/ConnectorControls/ConnectorControls.tsx:85-267]

### Cited Findings — Rectangles / zones
- `rectangleSchema = { id, color?, from: coords, to: coords }` — that's the entire schema; no `kind`, `name`, `label`, or parent/child reference — [src/schemas/rectangle.ts:1-9](../../../src/schemas/rectangle.ts)
- `RectangleControls.tsx` only exposes color and delete — no naming, no typing, no nesting UI — [src/components/ItemControls/RectangleControls/RectangleControls.tsx:1-44]
- Confirmed by grep: no `parent`/`nested`/`contain`/`hierarch`/`group` field exists anywhere in `src/schemas` or `src/types/model.ts`/`scene.ts` (one unrelated hit is a test literal `kind: 'container'` used as an invalid-enum test case, not a feature) — verified via ripgrep over `src/schemas src/types/model.ts src/types/scene.ts`.
- A VPC concept exists only as a **node icon** (a data-URI SVG of the AWS VPC icon, `id: 'aws-vpc'`), not as a semantic zone/boundary — [src/examples/initialData.ts:95-105]

### Cited Findings — Text boxes
- `textBoxSchema = { id, tile: coords, content (≤100 chars), fontSize?, orientation? (X|Y) }` — [src/schemas/textBox.ts:5-16](../../../src/schemas/textBox.ts)
- Content is plain text (not markdown/HTML) with an orientation toggle for iso projection — [src/components/ItemControls/TextBoxControls/TextBoxControls.tsx:23-87]

### Cited Findings — Views
- `viewSchema = { id, lastUpdated?, name (≤100), description? (≤1000), items: viewItem[], rectangles?, connectors?, textBoxes? }` — connectors/rectangles/textBoxes are **view-scoped**, model items are **model-scoped** and referenced by id per view — [src/schemas/views.ts:7-24](../../../src/schemas/views.ts)
- `viewItemSchema = { id, tile: coords, labelHeight? }` — a view only stores an item's tile position and label height, everything else about the item lives in `model.items` — [src/schemas/views.ts:7-11]
- Multiple views ("layers") are supported by the schema (`viewsSchema = z.array(viewSchema)`) and are now used as network/application/data/CI-CD layers via a preset picker in `ViewSwitcher.tsx` — [src/schemas/views.ts:24], [src/components/ViewSwitcher/ViewSwitcher.tsx:35-130]
- Connectors can reference anchors on other connectors' anchors (branch points), not only model items — [src/schemas/connector.ts:35-44]

### Cited Findings — Flows / steps
- `flowStepSchema = { id, connectorId, direction (REQUEST|RESPONSE), label? (≤60), durationMs? (positive int) }`, `flowSchema = { id, name, description?, steps: flowStep[] }` — [src/schemas/flow.ts:6-19](../../../src/schemas/flow.ts)
- A flow is **model-level**, not view-scoped, and steps reference a `connectorId` that must exist in some view's connectors (`validateFlow`) — [src/schemas/validation.ts:309-331]
- `flows` is an optional top-level array on `modelSchema` (`flows: flowsSchema.optional()`) — [src/schemas/model.ts:20]

### Inferences
- The schema is intentionally additive/optional at every step (explicit backward-compatibility comments throughout), which is a design constraint for any future gap-closing work: new fields must stay optional to keep `diagrams/infra.json` loading.
- The absence of any parent/child or grouping primitive means "putting a node inside a VPC rectangle" today is purely visual overlap on the canvas — there is no data relationship an importer, linter, or simulation could use to know a node is "inside" a zone. Any lint like "prod database reachable from a public zone" (roadmap item 5) would need either (a) geometric containment inferred from `rectangle.from/to` vs. `viewItem.tile`, or (b) a new explicit containment field — neither exists today.

### Gaps
- None — schema files were read in full; this section is comprehensive for the current commit.

---

## Semantics: resource kinds, environments, owner, protocol/port/auth — used beyond display?

### Takeaway
All new semantic fields (kind, environment, engine/version/region/owner, protocol/port/mode/auth) are **display/editing-only metadata** with exactly one behavioral consequence: the flow simulation's packet label falls back to `protocol[:port]` when a step has no explicit label, and `async` connectors are skipped when auto-building a "return path" (no response step generated). There is no other semantic reasoning (no security, cost, compliance, or topology logic) reading these fields.

### Cited Findings
- Packet label fallback: `getPacketLabel` returns the step's own label, else `HTTPS:443`-style string derived from `connector.protocol`/`connector.port`, else `undefined` — [src/utils/flow.ts:57-71]
- Async skip in return-path building: `buildReturnPathSteps`/`getMissingReturnPathSteps` filter out `REQUEST` steps whose connector has `mode === 'async'` before mirroring them into `RESPONSE` steps — [src/utils/flow.ts:81-92, 129-162]
- `validateModel` (the only "rule engine" in the codebase) checks purely referential integrity: dangling icon refs, dangling color refs, connector anchor refs, view-item-to-model-item refs, flow-step-to-connector refs, and "connector needs ≥2 anchors." It does **not** check `kind`, `environment`, `owner`, `port` collisions, public/private zone crossing, or anything resembling an architecture rule — [src/schemas/validation.ts:1-353] (full file read)
- Roadmap item 5 ("Architecture rules / validation" — e.g. "prod database reachable from a public zone", "connector crossing the VPC outside the single entry point", "resource without owner") is explicitly **not implemented yet**: "Cheap once item 1 exists; turns a drawing into a review tool" — [odd/roadmap/infrastructure-platform.md:40-43]

### Inferences
- The semantic fields exist as a foundation (roadmap item 1+2, explicitly framed as "unblocks 4, 5, 6" in `odd/roadmap/infrastructure-platform.md:12`) but no lint/validation/simulation logic consumes `kind`, `environment`, `owner`, `auth`, or `region` yet. A gap analysis can treat "typed metadata capture" as done and "semantic reasoning over that metadata" as fully open.

### Gaps
- None; `validation.ts` and `utils/flow.ts` were read in full.

---

## Views/layers, multi-diagram persistence, export/import formats, read-only/explorable modes

### Takeaway
Isoflow supports multiple views per model (used as manually-created "layers" with 4 presets), multiple named diagrams persisted as separate JSON files via a **dev-only** HTTP API with a localStorage fallback, JSON export/import (full fidelity) and PNG export (via `dom-to-image`) — no SVG export, no import of any format other than the tool's own JSON, and three editor modes: fully editable, read-only-but-explorable (pan/zoom/flow playback, no editing), and non-interactive (used internally for image export).

### Cited Findings
- Editor modes: `EditorModeEnum = { NON_INTERACTIVE, EXPLORABLE_READONLY, EDITABLE }`, each mapped to a different set of available UI tools — [src/types/common.ts:28-32], [src/components/UiOverlay/UiOverlay.tsx:22-56]
- `ReadonlyMode` example component exists as the explorable read-only entry point — [src/examples/ReadonlyMode/ReadonlyMode.tsx] (present in dir listing; mode wiring confirmed via `EditorModeEnum` usage)
- Export: JSON via `exportAsJSON(model)` (full model, browser download) and PNG via `exportAsImage` + `dom-to-image` + `file-saver`, both triggered from `MainMenu` and `ExportImageDialog` — [src/components/MainMenu/MainMenu.tsx:77-93], [src/components/ExportImageDialog/ExportImageDialog.tsx:1-238]. No SVG export path found.
- Import: "Open" in `MainMenu` reads a local `.json` file, `JSON.parse`s it, and calls `load(modelData)` (goes through `modelSchema` validation via the initial-data manager) — [src/components/MainMenu/MainMenu.tsx:50-75]. No importer for Terraform/CloudFormation/docker-compose/etc. exists (confirmed absent; roadmap item 6 explicitly proposes this as future work).
- Multi-diagram dev server API: `GET/PUT /api/diagrams/:name`, `GET /api/diagrams`, `POST /api/diagrams` (create), `POST /api/diagrams/:name/duplicate`, plus a legacy `GET/POST /api/diagram` alias for the `infra` diagram — [webpack/diagram-api.js:116-313]
- Diagram names are restricted to `^[a-z0-9][a-z0-9-]{0,63}$` and resolved server-side only inside `diagrams/`, with atomic tmp-then-rename writes — [webpack/diagram-store.js:13-35, 107-115]
- This API is **dev-only**: mounted by `webpack/dev.config.js` and explicitly excluded from the production build/Docker image — [webpack/diagram-api.js:1-4], confirmed no `/api/diagram` string in `dist/index.js`/`dist/standaloneExports.js` per `odd/tasks/diagram-autosave.md:70`
- Client persistence layer (`src/examples/persistence.ts`) does two things: strips the 2.44 MB of icon payload before saving (re-injected from the in-memory isopacks on load) and falls back to `localStorage` when the dev API is unreachable — [src/examples/persistence.ts:129-221]
- `BasicEditor.tsx` provides a diagram picker (Select + New + Duplicate) wired to the above API, with request-guarded async switching to avoid races — [src/examples/BasicEditor/BasicEditor.tsx:144-377]
- Views-as-layers: `ViewSwitcher.tsx` offers 4 layer presets (`VIEW_LAYER_PRESETS`, referenced as "Network, Application, Data, CI/CD" in the roadmap) plus custom names, and switches the active view by id — [src/components/ViewSwitcher/ViewSwitcher.tsx:1-299], preset names per [odd/tasks/infrastructure-model.md:38-39]

### Inferences
- "Multi-diagram" and "views as layers" are both real, shipped features (per `odd/tasks/infrastructure-model.md`, marked done for T3-T5b), not aspirational roadmap items — the roadmap doc predates them (dated 2026-09-21, "backlog (not started)") while the task doc (updated 2026-09-22) shows them completed. A gap analysis should treat roadmap item 3 as **already delivered**, not open.
- Production/embedded usage (outside the dev server) has **no server-backed persistence at all** — only the host application's own `onModelUpdated` callback and manual JSON export/import. This matters for any "the tool must persist infra designs long-term" requirement in production contexts.

### Gaps
- Did not verify `src/examples/ReadonlyMode/ReadonlyMode.tsx` contents directly (only confirmed its existence and the `EDITOR_MODE_MAPPING` it must use); unlikely to change the picture since the mapping table is authoritative and already read in full.
- Did not check `src/standaloneExports.ts` contents (library's public API surface) — noted as a file that exists but not opened in this pass.

---

## Simulation/flows: what can be animated, limits

### Takeaway
The simulation plays one flow's steps strictly in array order (REQUEST/RESPONSE) as a single moving packet per active connector, with play/pause/stop/step/speed controls; there is no branching, no parallelism, no failure/rollback visualization, and no export of the simulation to video/GIF — all four are explicitly named as future roadmap item 4.

### Cited Findings
- Playback state machine: `IDLE|PLAYING|PAUSED`, `stepIndex`, `speed`, driven by `flowPlaybackReducer` (pure) — [src/types/ui.ts:135-151], `src/utils/flowPlayback.ts` (per `odd/tasks/animated-flow-simulation.md:173-228`)
- One packet renders per connector matching the current step, animated via GSAP tween along the connector's tile path, with a destination-node "pulse" on arrival that advances to the next step — [odd/tasks/animated-flow-simulation.md:230-353] (T4 implementation notes), component `src/components/SceneLayers/Connectors/ConnectorPacket.tsx`
- Controls: flow selector, Play/Pause/Stop/Prev/Next step, speed `0.5x/1x/2x` (`FLOW_PLAYBACK_SPEED_OPTIONS`), step indicator — [odd/tasks/animated-flow-simulation.md:441-449]
- Flow editor dialog: create/select/delete flows, add/reorder/delete steps, "Add return path" convenience (idempotent) — [odd/tasks/animated-flow-simulation.md:450-464, 541-566]
- Explicitly linear playback, no failure branches, no parallel steps: roadmap item 4 lists these as *not yet built* — "Failure scenarios: failing step (red packet, rollback) and alternative branches... Parallel steps (today playback is strictly linear). Export simulation to GIF/video." — [odd/roadmap/infrastructure-platform.md:34-38]
- Playback state is explicitly UI-only, never persisted in the model — [src/types/ui.ts:143-145]
- Reduced-motion respected (`prefers-reduced-motion`) — [odd/tasks/animated-flow-simulation.md:31, 82, 243-244]

### Inferences
- The simulation is a linear request/response walkthrough tool for explaining a known-good path through the architecture, not a what-if/incident simulator. Any gap analysis targeting "simulate an outage" or "simulate concurrent load" should treat that as fully greenfield (roadmap item 4, not started).

### Gaps
- None for this section; the animated-flow-simulation task doc was read in full and is authoritative for what shipped.

---

## Validation: what validation.ts checks today; architecture rules/lints

### Takeaway
`src/schemas/validation.ts` (353 lines, read in full) is purely a **referential-integrity checker** — every check is "does this id reference something that exists" — plus one structural rule ("connector needs ≥2 anchors"). There are zero architecture/security/ops lints (no public/private zone rule, no orphan-resource rule, no owner-required rule); these are explicitly future work (roadmap item 5).

### Cited Findings
- Full list of checks in `validateModel`: `INVALID_MODEL_TO_ICON_REF`, `INVALID_ANCHOR_TO_VIEW_ITEM_REF`, `INVALID_CONNECTOR_COLOR_REF`, `INVALID_RECTANGLE_COLOR_REF`, `INVALID_ANCHOR_TO_ANCHOR_REF`, `INVALID_VIEW_ITEM_TO_MODEL_ITEM_REF`, `INVALID_ANCHOR_REF` (anchor references more than one item), `CONNECTOR_TOO_FEW_ANCHORS`, `INVALID_FLOW_STEP_CONNECTOR_REF` — [src/schemas/validation.ts:12-352]
- `fixModel()` auto-repairs three of these issue types by dropping the offending reference (icon ref cleared, connector removed if <2 anchors, dangling anchor-to-anchor ref spliced out) — [src/utils/model.ts:6-54]
- Validation runs inside the zod schema itself via `.superRefine` on `modelSchema`, so any load/import goes through it — [src/schemas/model.ts:22-31]
- Roadmap item 5 frames future lints explicitly as new work built on top of item 1 (typed resources): "prod database reachable from a public zone; connector crossing the VPC outside the single entry point; resource without owner" — [odd/roadmap/infrastructure-platform.md:40-43]
- Known validation gap (tech debt, not yet fixed): "Duplicate flow/step ids are not validated" — [odd/roadmap/infrastructure-platform.md:51], tracked again as an open follow-up through the animated-flow-simulation task ("Duplicate ids finding (still unvalidated...)") — [odd/tasks/animated-flow-simulation.md:507-508, 587-588]

### Inferences
- Because containment (VPC/subnet nesting) doesn't exist as data (see Data Model section), any "public zone" or "VPC boundary" lint from roadmap item 5 would first need a containment/zone-type primitive, not just a validation function — the roadmap item may be under-scoped relative to what item 1 actually delivered (flat metadata, not zones).

### Gaps
- None; file read in full.

---

## Icons: which collections, custom icons

### Takeaway
Icons come from five bundled "isopack" collections (Isoflow's own, AWS, Azure, GCP, Kubernetes) via the `@isoflow/isopacks` npm package, plus a small hand-authored "cicd" collection of flat brand logos (Git, GitHub, GitHub Actions, Flyway, MySQL, Terraform, AWS VPC) added specifically for the example diagram. No CI/CD-vendor isopack exists as a bundled collection — the "cicd" set is custom, ad hoc, and lives only in `src/examples/initialData.ts`. Icon search is by name only (no tag/category full-text beyond that).

### Cited Findings
- Bundled isopacks used: `isoflow`, `aws`, `gcp`, `azure`, `kubernetes` — [src/examples/initialData.ts:3-16]
- `@isoflow/isopacks` package version `0.0.10`, described as "Icons for popular cloud services and networking hardware" — [package.json:12] (dependency), confirmed installed at `node_modules/@isoflow/isopacks`
- Custom `cicdIcons` (7 icons: git, github, gh-actions, flyway, mysql, terraform, aws-vpc), all `isIsometric: false`, `collection: 'cicd'` — [src/examples/initialData.ts:52-106]. Comment notes the bundled AWS isopack "has 320 icons but no VPC," hence the hand-added AWS VPC icon as an inlined data-URI SVG — [src/examples/initialData.ts:95-98]
- Non-isometric ("flat") icons can render either as a flat 2D image (`FLAT`) or wrapped in an extruded isometric block (`BLOCK`, the default since roadmap task T6) — per-node override in `NodeSettings.tsx`, global default `NODE_ICON_STYLE_DEFAULT` in `src/config.ts` — [src/schemas/modelItems.ts:4-9,34], [odd/tasks/animated-flow-simulation.md:596-716]
- Icon search filters by name via a simple text field (`Searchbox.tsx`), no tag or full-text search beyond name matching — [src/components/ItemControls/IconSelectionControls/Searchbox.tsx:1-29]
- Icon schema allows arbitrary custom icons: `{ id, name, url, collection?, isIsometric? }`, `url` is any string (including data URIs) — [src/schemas/icons.ts:4-10] — so host applications can register their own icon sets; this is a documented extensibility point per README ("Extensible icon system... Create your own icon library") — [README.md:27]

### Inferences
- The "cicd" set being custom/example-only (not a shipped, reusable isopack) means any real infra-design use case needing CI/CD, observability, or other non-cloud-vendor icon sets would need to hand-roll them the same way, per-project — there's no general mechanism/registry for extra icon packs beyond manually building an array like `cicdIcons` and concatenating it into `icons`.

### Gaps
- Did not enumerate the exact icon counts inside each isopack (e.g. exact AWS/GCP/Azure/K8s icon totals) — package is a compiled dependency, out of scope for a source-code audit of the isoflow repo itself.

---

## Collaboration, versioning/history, undo/redo, comments, search, deep links

### Takeaway
None of these exist. There is no undo/redo, no multi-user collaboration/websocket layer, no comment feature, no version history beyond git (the diagram JSON files are meant to be committed), no full-text/cross-diagram search, and no deep-link/permalink mechanism into a specific view or item.

### Cited Findings
- Repo-wide search for `undo|redo` only matches unrelated UI copy in `ConnectorControls.tsx`/`NodeSettings.tsx` (not an actual undo/redo feature) — verified via ripgrep over `src`.
- Repo-wide search for `websocket|collab|realtime|socket.io` returns no hits in `src` except a docstring reference inside a persistence test file's comments, not an implementation — verified via ripgrep.
- No "comment" feature: a search hit only matches JS/JSX code comments, not a user-facing comment thread — verified via ripgrep.
- No hits at all for `history|versioning` as a feature — verified via ripgrep (search returned nothing in `src`).
- The only "search" in the product is the icon-picker `Searchbox` (name-only filter) — [src/components/ItemControls/IconSelectionControls/Searchbox.tsx] — no hits for a diagram-content or cross-diagram search.
- No hits for `deep.?link|permalink|share` in `src` — verified via ripgrep.
- "Versioning" in practice = committing `diagrams/*.json` files to git, by design (the autosave feature's stated goal: "persist it to a JSON file in the repository so it can be versioned instead of exported by hand") — [odd/tasks/diagram-autosave.md:1-4]

### Inferences
- All of collaboration, undo/redo, comments, and deep links are fully open gaps with zero existing scaffolding — no partial data model support to build on (e.g. no `history` array on the model, no `authorId`/`revision` fields anywhere in schemas).

### Gaps
- None; exhaustive greps run across `src` for each concept.

---

## Tests/quality: test env, coverage areas, known tech debt (roadmap item 7)

### Takeaway
Jest runs under `testEnvironment: "node"` (no jsdom), so **all tests are of pure logic/reducers/schemas — there are zero component/DOM render tests** in the entire codebase. Coverage is strong for schema validation, reducers, and the newer pure utils (flow, flowPlayback, flowPacket, isometricBlock, parsePortInput), and explicitly absent for every new UI component built in the last two features. Known tech debt is enumerated in the roadmap as item 7.

### Cited Findings
- `jest.config.js`: `preset: 'ts-jest'`, `testEnvironment: 'node'`, `testPathIgnorePatterns` for `node_modules`/`dist` (added to fix phantom failures from emitted `.d.ts` test files) — [jest.config.js:1-10]
- 15 test files exist, all under `__tests__` folders: `src/examples/__tests__/persistence.test.ts`, `src/schemas/__tests__/validation.test.ts`, `src/stores/reducers/__tests__/{flow,layerOrdering,modelItem,view}.test.ts`, `src/utils/__tests__/{common,flow,flowPacket,flowPlayback,immer,isometricBlock,parsePortInput,renderer,views}.test.ts` — from repo listing.
- No DOM/render tests anywhere: repeated, explicit statements across the animated-flow-simulation task for every new component (`ConnectorPacket`, `Node` pulse, `FlowPlaybackBar`, `FlowEditorDialog`, `IsometricBlockIcon`) — "this project's `jest.config.js` uses `testEnvironment: 'node'` (no jsdom)... this project has no existing RTL/jsdom convention to extend" — [odd/tasks/animated-flow-simulation.md:296-305, 509-515, 589-594, 675-680]
- Roadmap item 7 (tech debt to pay first) lists: duplicate flow/step ids not validated; no DOM/render tests (`testEnvironment: node`, no jsdom); a `Connector.tsx` SVG `transform: scale(-1, 1)` hack (TODO); `import/no-cycle` ESLint findings in `src/stores/reducers/view.ts` and `viewItem.ts`; plus three specific open advisory findings from a prior review: a `getMissingReturnPathSteps` prefix-match edge case, a clipped ground shadow on `IsometricBlockIcon.tsx`, and untested icon-style resolution in `src/hooks/useIcon.tsx:33-37` — [odd/roadmap/infrastructure-platform.md:50-59]
- `odd/tasks/repo-hygiene-fixes.md` separately documents and fixes three unrelated repo hygiene defects (phantom jest failures from built `.d.ts` files, CRLF-breaking lint on Windows via missing `.gitattributes`, three conflicting Node version pins) — all confirmed fixed with before/after evidence tables — [odd/tasks/repo-hygiene-fixes.md:1-107]
- Remaining pre-existing lint findings, still open: `import/no-cycle` in `view.ts`/`viewItem.ts`, `no-console`/`no-alert` in `useInitialDataManager.ts` — [odd/tasks/repo-hygiene-fixes.md:76-82]
- Dependency security: `npm audit` reduced from 50 to 2 advisories; the 2 remaining (react-quill/quill XSS, GHSA-4943-9vgg-gr5r) are an **accepted risk** since `MarkdownEditor` only ever renders content authored by the diagram's own editor, not third-party input — explicitly flagged to re-evaluate "if the app starts rendering diagrams or node descriptions supplied by untrusted users" — [odd/tasks/dependency-security-update.md:67-84]

### Inferences
- Given zero component tests exist, any gap-analysis-driven feature work touching UI (e.g. new zone/containment controls) inherits the same testing gap by convention — there's no existing RTL/jsdom pattern to extend, so introducing one would itself be new infrastructure work, not incidental.
- The XSS-accepted-risk note is a real security caveat relevant to any "multi-tenant" or "shared/public diagram" requirement in a gap analysis — the accepted-risk rationale explicitly breaks if untrusted users can author node descriptions.

### Gaps
- Did not run `npm test`/`npm run lint` myself (read-only audit); all coverage/tech-debt facts are taken from the ODD task docs' own verification tables, which is documentation of prior work, not independently re-verified in this pass.

---

## What the roadmap (odd/roadmap/infrastructure-platform.md) already plans, to avoid duplicating it

### Takeaway
The roadmap has 7 items. Items 1 and 2 (typed resources, semantic connectors) and item 3 (multi-diagram + views-as-layers) are **already implemented** per `odd/tasks/infrastructure-model.md` (dated one day after the roadmap, all tasks checked off). Items 4 (richer simulation), 5 (architecture rules/lints), 6 (IaC integration), and 7 (tech debt) remain **open** and are the roadmap's own stated priorities for what comes next. An open product question in the roadmap itself — "internal team documentation only, or a product for other teams/clients?" — is unresolved and explicitly said to change the relative priority of item 3 (already done) vs. 5/6.

### Cited Findings
- Roadmap recommended order: "1 + 2 first (semantic model; unblocks 4, 5, 6), then 3 (most requested day to day). 6 is the long-term horizon. Pay down 7 before growing." — [odd/roadmap/infrastructure-platform.md:12-13]
- Item 1 (typed resources), item 2 (semantic connectors), item 3 (multi-diagram + views-as-layers): all tasks T1-T5b marked `[x]` done with commits, tests, and review evidence in `odd/tasks/infrastructure-model.md:54-61` (see also progress table lines 70-93).
- Item 4 (richer simulation: failure/rollback branches, parallel steps, GIF/video export) — not started; only the linear playback from the separate animated-flow-simulation feature exists — [odd/roadmap/infrastructure-platform.md:34-38]
- Item 5 (architecture rules/validation/lints) — not started; `validation.ts` only does referential integrity today (see Validation section above) — [odd/roadmap/infrastructure-platform.md:40-43]
- Item 6 (IaC integration: Terraform/CloudFormation/docker-compose import, drift detection) — not started, explicitly called "most ambitious," needs item 1 (now done) "as the target model" — [odd/roadmap/infrastructure-platform.md:45-48]
- Item 7 (tech debt) — partially addressed: repo-hygiene-fixes.md and dependency-security-update.md closed several items (jest phantom failures, CRLF/lint, Node pin), but the roadmap's own item-7 list (duplicate flow/step ids, no DOM tests, `Connector.tsx` mirror hack, `import/no-cycle`, 3 specific advisory findings) remains open as of the roadmap doc — [odd/roadmap/infrastructure-platform.md:50-59]
- Open product question, unresolved: "Audience: internal team documentation only, or a product for other teams/clients? The answer changes priority of 3 (collaboration/multi-diagram) vs 5/6." — [odd/roadmap/infrastructure-platform.md:61-63]

### Inferences
- A gap analysis for "infrastructure design requirements" should focus new-ground analysis on: (a) containment/zone/trust-boundary modeling (not in the roadmap at all as currently worded — item 5 assumes zones exist, but nothing in items 1-3 created them), (b) architecture lint rules (roadmap item 5, open), (c) IaC import/drift (roadmap item 6, open), (d) richer simulation with failure branches (roadmap item 4, open), and (e) anything outside the roadmap's 7 items entirely — collaboration, undo/redo, comments, versioning/audit trail, deep links, access control, multi-tenant sharing safety (given the accepted quill XSS risk) — none of which the roadmap mentions at all.

### Gaps
- The roadmap doc's "Status: backlog (not started)" header is stale relative to the task doc — it predates items 1-3 being completed by one day; no updated roadmap doc exists yet reflecting that 1-3 are done. This should be flagged to whoever owns `odd/roadmap/infrastructure-platform.md` rather than silently treated as authoritative.
