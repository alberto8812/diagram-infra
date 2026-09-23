# diagram-infra

An infrastructure design and diagramming tool: model infrastructure with typed
resources and connectors, validate it against architecture rules, estimate
cost, and simulate how requests flow through it — all in the browser.

## Built on Isoflow

`diagram-infra` is a fork of [Isoflow](https://github.com/markmanx/isoflow)
(MIT licensed) by [markmanx](https://github.com/markmanx). Isoflow's isometric
canvas, drag-and-drop editor, and icon system are the foundation; this fork
adds a semantic infrastructure model, validation, cost estimation, Terraform
import, and animated flow simulation on top of it. Full credit to the
original project — see [License](#license).

## What this fork adds

Isoflow draws icons and lines. `diagram-infra` also knows what they represent.

| Area                            | What it does                                                                                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typed resources                 | Nodes carry a `kind` (database, queue, load balancer, runner, service, ...) plus typed metadata: engine, version, port, region, environment, owner.                                                                                                                                        |
| Semantic connectors             | Connections carry protocol (HTTP, gRPC, SQL, SSH), port, sync vs. async, and auth — used by the rule engine and the simulation.                                                                                                                                                            |
| Zones                           | Rectangles become containment zones (VPC, subnet, availability zone) so the model can express "this database is in a private subnet of prod".                                                                                                                                              |
| Validation rules                | A rule engine (`src/rules`) lints the diagram: prod database in a single AZ, datastore in a public zone, public ingress without auth, unencrypted sensitive data flow/datastore, resource without an owner, zone overlap, cross-VPC without a gateway. Results surface in an Issues panel. |
| Security & compliance           | STRIDE-style threat classification (`src/security`) and an indicative mapping to SOC 2 / ISO 27001 / PCI DSS controls (`src/compliance`), shown in a security report dialog.                                                                                                               |
| Cost estimation                 | Offline, local price catalog (`src/cost`) for order-of-magnitude AWS cost estimates — not a quote or a live pricing API.                                                                                                                                                                   |
| Terraform import                | Import a `terraform show -json` state or plan into a diagram, with automatic zone layout (`src/import/terraform`).                                                                                                                                                                         |
| Animated flow simulation        | Define a flow as an ordered sequence of steps between nodes; play, pause, step through, and change speed while packets animate along connectors (`src/hooks/useFlowPlayback.ts`, `FlowControls`).                                                                                          |
| Multiple diagrams & view layers | Manage several diagrams (list, create, duplicate, switch) and use views as layers within one diagram (network, application, data, CI/CD, ...).                                                                                                                                             |
| Autosave                        | The working diagram is saved automatically during development — see [Diagrams & persistence](#diagrams--persistence).                                                                                                                                                                      |
| Custom icons                    | Additional CI/CD icons on top of the bundled Isoflow icon packs.                                                                                                                                                                                                                           |

Everything above is verified against the code on `main`. Items that are
planned but not implemented live in [Roadmap](#roadmap).

## Quick start

Requires Node.js `>=20` (see `engines` in `package.json`).

```bash
npm install
npm start
```

This starts the webpack dev server at `http://localhost:3000` and mounts a
dev-only diagram API (see [Diagrams & persistence](#diagrams--persistence)).

### Docker

```bash
docker build -t diagram-infra .
docker run -p 8080:80 diagram-infra
```

The `Dockerfile` runs `npm run docker:build` and serves the static production
bundle with nginx (no dev-only diagram API in this image).

## Scripts

| Script                 | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `npm start`            | Runs the dev server (webpack, port 3000) with the diagram autosave API. |
| `npm run dev`          | Watches `src/` and rebuilds the library on change (`nodemon`).          |
| `npm run build`        | Builds the distributable library (`dist/`) with type declarations.      |
| `npm test`             | Runs the Jest test suite.                                               |
| `npm run lint`         | Type-checks (`tsc --noEmit`) and runs ESLint over `src/`.               |
| `npm run lint:fix`     | Same as `lint`, applying autofixes.                                     |
| `npm run docker:build` | Builds the standalone app bundle used by the Docker image.              |

## Project structure

```
src/
  components/     UI: canvas, panels, dialogs (Issues, Cost, Security), menus
  hooks/          React hooks, including flow playback (useFlowPlayback)
  stores/         Zustand stores (model, UI state) and reducers
  rules/          Architecture validation rule engine and rule catalog
  security/       STRIDE threat classification
  compliance/     Rule/threat → compliance control mapping
  cost/           Offline cost catalog and estimation
  import/terraform/  Terraform `show -json` import
  schemas/        Zod schemas for the model (resources, connectors, flows, zones)
  examples/       Example apps (BasicEditor, ReadonlyMode) and dev persistence client
webpack/          Dev server config and the dev-only diagram API
diagrams/         Saved diagrams (JSON), e.g. diagrams/infra.json
odd/              Feature docs: roadmap, task write-ups, research notes
```

## Diagrams & persistence

In development, diagrams are saved as JSON files under `diagrams/` (for
example `diagrams/infra.json`) through a dev-only API mounted by
`webpack/dev.config.js` (`webpack/diagram-api.js`, `webpack/diagram-store.js`).
It supports listing, creating, duplicating, and switching between diagrams,
and validates names and payload size before writing. This endpoint only
exists while `npm start` is running — it is never built into the production
bundle or the Docker image.

If you change `webpack/dev.config.js` or the diagram API, restart `npm start`
for the change to take effect.

## Testing

```bash
npm test
```

Tests run under Jest with `ts-jest`, mostly with `testEnvironment: "node"`
(logic-level unit tests for rules, security, cost, Terraform import,
reducers, etc.). A small number of tests opt into `jsdom` per-file (via a
`@jest-environment jsdom` docblock) for hook/component behavior.

## Roadmap

Not implemented yet — see `odd/roadmap/infrastructure-platform.md` for the
full picture:

- Richer simulation: failure branches, parallel steps, GIF/video export.
- CloudFormation and docker-compose import.
- Drift detection (diagram vs. real infrastructure).
- A few known technical-debt items (duplicate flow/step id validation, a
  connector SVG transform workaround, broader DOM/render test coverage).

## License

MIT — see [`LICENSE`](./LICENSE) for the original Isoflow copyright. This
fork's changes are made available under the same license.
