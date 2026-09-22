# Dependency Security Update

## Objective
Remove the 50 npm audit vulnerabilities (7 low, 16 moderate, 23 high, 4 critical)
while keeping the project building and its test suite green.

## Problem
`npm audit` reported 50 advisories: 6 on direct dependencies, 44 transitive.
A previous blind bulk upgrade (uncommitted `package.json` / `package-lock.json`)
downgraded `react-quill` from `^2.0.0` to `^0.0.2` and added `isoflow` as a
dependency of itself, which broke the webpack build with:
- `react-quill/dist/quill.snow.css doesn't exist`
- `TS7016: Could not find a declaration file for module 'react-quill'`

That change was reverted to `HEAD`. This feature redoes the upgrade in a
targeted way instead of `npm audit fix --force`.

## Scope
Authorized: `package.json`, `package-lock.json`, and any source or webpack
config change strictly required by a version bump.
Out of scope: feature work, refactors, unrelated dependency churn.

## Constraints
- No `npm audit fix --force`.
- Every major bump is verified against actual source usage before applying.
- Local Node is v24.21.0 while `.nvmrc` pins 16.19.0 (CI: 19.7.0, Docker: node:21).

## Applied changes
| Dependency | Before | After | Kind |
|---|---|---|---|
| webpack | ^5.76.2 | ^5.76.2 (lock -> 5.111.1) | lockfile only |
| react-router-dom | ^6.8.1 | **removed** | unused, no imports anywhere |
| recharts | ^2.7.2 | **removed** | unused, no imports anywhere |
| zod | 3.22.2 (pinned) | ^3.25.76 | range widen |
| uuid | ^9.0.0 | ^11.1.1 | major |
| webpack-dev-server | ^4.15.1 | ^6.0.0 | major |
| @typescript-eslint/* | ^6.x | ^6.x (lock patched) | lockfile only |
| react-quill | ^2.0.0 | ^2.0.0 (unchanged) | open decision |

## Verification (TDD: off — no behavior change; functional checks only)
Runner: npm / jest.

## Tasks
- [x] T1 Refresh transitive deps within existing semver ranges (`npm update`) — inline; 50 -> 14 advisories
- [x] T1b Remove unused `react-router-dom` and `recharts` (no imports anywhere) — inline; 14 -> 12 advisories
- [x] T2 Widen `zod` from pinned `3.22.2` to `^3.25.76` — inline
- [x] T3 Bump `uuid` ^9 -> **^11.1.1** (not ^14) — inline. uuid@14 is ESM-only and breaks the
      CommonJS jest runner (`Jest encountered an unexpected token`). uuid@11 ships dual
      CJS/ESM exports, clears the advisory, and needs no source change.
- [x] T4 Bump `webpack-dev-server` ^4 -> ^6 — inline. 5.x has no patched release (all of
      `<=5.2.6` are vulnerable). `webpack/dev.config.js` needed no change.
- [x] T4b `npm audit fix` (no `--force`) cleared 6 high @typescript-eslint / minimatch advisories
- [x] T5 Full verification pass — see Evidence
- [x] T6 react-quill / quill advisory — **accepted risk**, decided by the user (see Accepted risk)

## Evidence
| Check | Result |
|---|---|
| `npm audit` | 50 advisories -> **2** (both quill/react-quill, moderate) |
| `npx webpack --config ./webpack/dev.config.js` | compiled successfully |
| `npm run build` | compiled; 3 pre-existing bundle-size warnings |
| `npm start` | webpack-dev-server 6 boots on :3000; `GET /` -> 200, `GET /main.js` -> 200 (17.5 MB) |
| `npm test` | 6/6 suites, 23/23 tests pass |
| `tsc --noEmit` | clean |
| `eslint ./src` | 10281 problems — 10276 are `Delete CR` (Windows CRLF checkout), 5 pre-existing (no-console x2, import/no-cycle x2, no-alert x1). `src/` was never modified. |

## Accepted risk
**T6 — react-quill / quill: 2 moderate advisories, GHSA-4943-9vgg-gr5r (XSS in quill <=1.3.7).**
Status: **accepted**, decided by the repository owner.

react-quill 2.0.0 is the last published release; it pins quill ^1.3.7, which is
unmaintained. There is no upgrade path within the package.

Rationale for accepting: the advisory is exploited through pasted or injected
markup. In Isoflow, `MarkdownEditor` edits text authored by the person editing the
diagram, not untrusted third-party content, so the exposure is low in this usage.

**Re-evaluate this decision if** the app starts rendering diagrams or node
descriptions supplied by untrusted users — at that point the XSS becomes reachable
and migration to quill 2.x (option below) is required.

Migration path if that happens: replace react-quill with a maintained wrapper
(e.g. react-quilljs) or use quill 2.x directly. Affected source:
`src/components/MarkdownEditor/MarkdownEditor.tsx`, `src/styles/GlobalStyles.tsx`.

### Do NOT run `npm audit fix --force`
npm's proposed "fix" for this advisory is react-quill@0.0.2 — a 2014 stub with no
`dist/quill.snow.css` and no type declarations. Applying it breaks the build with
`react-quill/dist/quill.snow.css doesn't exist` and `TS7016`. That is exactly what
the earlier blind `--force` run did to this repository.

## Known non-blocking issues (out of scope)
- `jest.config.js` has no `testPathIgnorePatterns` for `dist/`, so running a build
  before a test run makes jest try to execute the emitted `.test.d.ts` files and
  report phantom suite failures.
- The repo has no `.gitattributes`, so a Windows checkout produces CRLF and prettier
  flags every line of every file.
- Version pins disagree: `.nvmrc` 16.19.0, CircleCI 19.7.0, Dockerfile node:21.

## Delivery
Branch `chore/dependency-security-update` created. Commits are BLOCKED: git has no
`user.name` / `user.email` configured on this machine. Changes are verified and
present in the working tree (`package.json`, `package-lock.json`).

## Next step
User decision on T6, and git identity in order to commit.
