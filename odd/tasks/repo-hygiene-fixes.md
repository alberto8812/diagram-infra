# Repo Hygiene Fixes

## Objective
Fix three pre-existing repository defects found while updating dependencies:
phantom jest failures, an unusable lint run on Windows, and three conflicting
Node version pins.

## Problem
1. **jest runs emitted declarations.** `jest.config.js` had no
   `testPathIgnorePatterns`, so after any build the emitted `dist/**/*.test.d.ts`
   files matched jest's default `testMatch` and failed to run. Observed: 6 phantom
   suite failures alongside 23/23 actual tests passing.
2. **Lint was unusable on Windows.** The repo had no `.gitattributes` and local git
   has `core.autocrlf=true`, so checkout wrote CRLF into 159 tracked files while the
   committed blobs are LF. `prettier/prettier` then reported `Delete CR` on every
   line: 10276 of 10281 lint errors were this.
3. **Three conflicting Node pins.** `.nvmrc` 16.19.0 (EOL), `.circleci/config.yml`
   cimg/node:19.7.0 (EOL), `Dockerfile` node:21 (EOL). Local runtime is v24.21.0.

## Scope
Authorized: `jest.config.js`, `.gitattributes` (new), `.nvmrc`,
`.circleci/config.yml`, `Dockerfile`, `package.json` (engines + lint script), and
CRLF->LF normalization of working-tree copies of already-LF blobs.
Out of scope: source logic, dependency changes, and the 5 real pre-existing lint
findings (no-console x2, import/no-cycle x2, no-alert x1).

## Constraints
- `.gitattributes` must not produce an index diff. Blobs were already LF
  (`git show HEAD:src/utils/common.ts | tr -cd '\r' | wc -c` -> 0), so
  normalization only rewrites working-tree copies. **Held:** after
  `git add --renormalize .`, `git diff --name-only HEAD` lists only the files with
  genuine content changes.
- Did not run `git reset --hard`: `package.json` / `package-lock.json` carried
  uncommitted verified work from the dependency update.

## Decisions
- **Node target: 24.21.0.** Node 24 is an active LTS line, and it is the runtime
  that actually ran this session's full check suite green. Pinning 22 would have
  been the more conservative label, but nothing here was executed on 22 — pinning a
  version nobody ran is a guess dressed as rigor.
- `package.json` declares `"engines": { "node": ">=20" }` — a floor, not an exact
  pin, so consumers on 20 or 22 are not broken by a published package.
- Dockerfile build stage uses `node:24` (Debian), not `node:24-alpine`, matching the
  previous `node:21` base. Alpine would change the toolchain available to any native
  dependency, which is unrelated risk for a version-pin fix.

## Tasks
- [x] H1 Add `testPathIgnorePatterns` for `dist/` to `jest.config.js` — inline
- [x] H2 Add `.gitattributes` and normalize 193 CRLF working-tree files — inline
- [x] H2b Fix the `lint` / `lint:fix` scripts — inline. `./src/**/*` expanded to every
      file including `.svg` and `.html`, which `--ext` does not filter, producing 2
      bogus `Parsing error` entries. Changed to `./src` and let eslint apply `--ext`.
- [x] H3 Unify the Node pin across `.nvmrc`, `.circleci/config.yml`, `Dockerfile`,
      plus `engines` in `package.json` — inline
- [x] H4 Verification pass — see Evidence

## Evidence
| Check | Before | After |
|---|---|---|
| `npm run build` then `npm test` (no dist cleanup) | 6 failed + 6 passed suites (phantoms) | **6/6 passed, 23/23 tests**, with 6 `.test.d.ts` present in `dist/` |
| `npm run lint` | 10281 problems (10276 `Delete CR`, 2 bogus parse errors) | **5 problems** (2 errors, 3 warnings) — all pre-existing in untouched source |
| `git diff --name-only HEAD` after normalization | — | only genuinely-changed files; the 193 normalized files produced **zero** content diff |
| CRLF bytes across tracked files | 159 files | **0** |
| `tsc --noEmit` | clean | clean |
| `npx webpack --config ./webpack/dev.config.js` | compiled | compiled successfully |
| `npm run build` | compiled | compiled, 3 pre-existing bundle-size warnings |

### NOT verified
- **`docker build` was not verified.** Docker Desktop is installed (v29.8.0) but its
  daemon is not running on this machine: the build returned
  `500 Internal Server Error ... /_ping`. The `Dockerfile` change from `node:21` to
  `node:24` is therefore **unverified**. Run `docker build -t isoflow .` once Docker
  Desktop is up to confirm it before relying on the image.
- CircleCI `cimg/node:24.21.0` was not exercised; CI only runs on `v*` tags.

## Remaining pre-existing lint findings (out of scope, untouched source)
- `src/stores/reducers/view.ts:8` — `import/no-cycle`
- `src/stores/reducers/viewItem.ts:6` — `import/no-cycle`
- `src/hooks/useInitialDataManager.ts:42,43` — `no-console`, `no-alert`
- one further `no-console`
Note `npm run lint` still exits 1 because of the two `import/no-cycle` errors. That
is a real code issue, not a tooling one.

## Delivery
Branch `chore/dependency-security-update`, commit `570802f` (`chore: normalize
line endings, align node pins and ignore emitted test declarations`), merged
into `main`; `main` == `origin/main`. No further push or PR action pending.

## Next step
`docker build` is still NOT verified: Docker Desktop's daemon was not running
on this machine when this work was done. Run `docker build -t isoflow .` once
the daemon is up to confirm the `node:24` Dockerfile change before relying on
the image.

Status reconciled against git on 2026-09-22.
