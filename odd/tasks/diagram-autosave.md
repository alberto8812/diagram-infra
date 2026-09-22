# Diagram Autosave

## Objective
Stop losing the working diagram on page refresh, and persist it to a JSON file in
the repository so it can be versioned instead of exported by hand.

## Problem
1. A refresh drops all work: `initialData` is read once on mount and nothing is
   persisted. Editing `src/examples/initialData.ts` (hot reload) also resets it.
2. Saving today means menu -> Export JSON -> a download, then moving the file by
   hand. Nothing writes back to the repo.

## Key findings (verified before design)
- **The hook already exists.** `src/Isoflow.tsx:51-55` calls `onModelUpdated(model)`
  on every model change. It fires on every frame of a drag, so it needs debouncing.
- **The model is 2.44 MB and almost all of it is constant.** `modelFromModelStore`
  (`src/utils/model.ts:62`) includes `icons`, and the 1068 isopack icons serialize
  to 2.44 MB against a ~5 MB localStorage quota. Those icons never change — they
  come from the isopacks. Persisting them would blow the quota and make every git
  diff two megabytes of base64.
  => **Strip `icons` on write, re-inject from isopacks on read.**
- `webpack-dev-server@6` still defaults to Express 5 (`express@^5.2.1`), and
  `setupMiddlewares(middlewares, devServer) => Middleware[]` exposes `devServer.app`.
- No `localStorage` or `indexedDB` usage anywhere in the repo today.

## Scope
Authorized: `webpack/dev.config.js`, a new autosave hook/util under `src/`, the dev
entry (`src/index.tsx` / `src/examples/`), and a new `diagrams/` directory.
Out of scope: `prod.config.js`, `Dockerfile`, the published library API, and the
existing Export/Open menu actions (they keep working unchanged).

## Security constraints (the dev server listens on 0.0.0.0)
- The destination path is **fixed server-side**. The client sends content only,
  never a path. This is the path-traversal guard.
- Validate the payload against the existing zod `modelSchema` before writing; 400
  on failure.
- Cap the request body size.
- Dev config only. The endpoint must not exist in the production build or image.

## Tasks
- [x] P1 `POST /api/diagram` + `GET /api/diagram` in `webpack/dev.config.js`
      (fixed path, manual body read, size cap, zod validation)
- [x] P2 Autosave hook: debounced `onModelUpdated` -> strip icons -> POST
- [x] P3 Load on mount: GET the file, re-inject icons, fall back to the example
- [x] P4 localStorage as a second safety net when the endpoint is unreachable
- [x] P5 Verification: refresh keeps work, file lands in `diagrams/`, diff is small

## Verification (TDD: off — integration behavior; functional checks)
- edit -> refresh -> the diagram is still there
- `diagrams/infra.json` exists and contains no base64 icon payload
- `git diff` on that file after moving one node is a handful of lines
- `npm test`, `tsc --noEmit`, `npm run lint` unchanged
- prod build has no `/api/diagram` reference

## Evidence
| Check | Result |
|---|---|
| GET with no file | 404 |
| POST invalid JSON | 400 `Body is not valid JSON` |
| POST missing title | 400 `title must be a string` |
| POST items not array | 400 `items must be an array` |
| POST icons not array | 400 `icons must be an array when present` |
| POST valid model | 200, file written |
| POST 6 MB body | 413, existing file left intact |
| Leftover `.tmp` files | none |
| Cold load with no file | `diagrams/infra.json` created automatically |
| Saved file size | 32.9 KB vs 2440 KB with icons |
| base64 in saved file | 0 occurrences |
| Restore after edit | title and item count survived reload (verified in a screenshot: breadcrumb read "PRUEBA RESTAURACION") |
| `/api/diagram` in production build | 0 occurrences in dist/index.js and dist/standaloneExports.js |
| `npm test` | 6/6 suites, 23/23 |
| `tsc --noEmit` | clean |
| `npm run lint` | 5 pre-existing problems, unchanged |

## Bug found and fixed during verification
The first implementation called `req.destroy()` as soon as the body exceeded the
cap. That tore down the socket before the 413 could be written, so the client saw
HTTP 100 and a broken connection instead of the error. Fixed by draining the
stream without accumulating, rejecting once, and destroying only after the
response has been sent.

## Files
- `webpack/diagram-api.js` (new) — dev-only GET/POST endpoint, fixed path, size cap, structural validation, atomic write
- `webpack/dev.config.js` — mounts it via `setupMiddlewares`
- `src/examples/persistence.ts` (new) — strip/re-inject icons, debounce, endpoint + localStorage layers
- `src/examples/BasicEditor/BasicEditor.tsx` — async restore on mount, debounced save
- `.gitignore` — ignores `diagrams/*.tmp`
- `diagrams/` (new) — holds the committed diagram

## Delivery
Branch `chore/dependency-security-update`. Commits still BLOCKED: git has no
`user.name` / `user.email` on this machine.

## Next step
Commit once git identity is configured.
