# Local isometric brand icons

## Objective
Replace the hot-linked technology icons with locally bundled, professional
isometric icons that are recognizable at a glance and never depend on a CDN.

## Problem
Most custom icons render as broken images in the picker and on the canvas
(NGINX, Docker, Kubernetes, Traefik, ...). Root cause: the `simpleIcon()`
helper in `src/examples/initialData.ts` builds
`https://cdn.simpleicons.org/<slug>.svg`, and that URL shape returns HTTP 404.
The CDN only serves `/<slug>` or `/<slug>/<hex>.svg`. The existing test only
checks the URL prefix, so the 404s went unnoticed.

## Why
- Icons must work offline and must not break when a third-party URL
  contract changes.
- PNG export (dom-to-image) needs CORS-safe images; data URIs avoid it.
- The user asked for icons that are professional, well designed,
  recognizable and not flat.

## Scope
- Generate brand icons locally from the `simple-icons` package (CC0):
  official path and brand color.
- Render each one as an isometric block: brand-colored cuboid with shaded
  side faces and the white logo projected onto the top face. Mark them
  `isIsometric: true`, like the @isoflow/isopacks icons.
- Cover `techIcons` and `cicdIcons` (except the already-bundled `aws-vpc`)
  and the `openai` / `grpc` icons, which are external too.
- Keep ids stable so saved diagrams (for example `diagrams/infra.json`) keep
  resolving their icons.

## Constraints
- Do not change the renderer or other features.
- No runtime network fetches for icons.
- Brands missing from `simple-icons` need a documented fallback, never a
  broken image.

## Tasks
- [x] T1 Isometric brand-icon generator: a pure function from `{path, hex}`
      to an isometric SVG data URI, with unit tests. Route: delegated
      (writer trigger: generator + data + tests, 2+ non-trivial files).
      `src/utils/isometricBrandIcon.ts` +
      `src/utils/__tests__/isometricBrandIcon.test.ts` (14 tests, `npm test`
      green).
- [x] T2 Bundle the icon data locally (generated static module from
      `simple-icons`, devDependency only) and switch `techIcons` /
      `cicdIcons` / `openai` / `grpc` to it. Add a test that fails on any
      external icon URL. Route: delegated (same writer).
      `scripts/generate-brand-icons.mjs` (`npm run icons:generate`) +
      `src/examples/brandIconData.generated.ts` (83 icons) +
      `src/examples/initialData.ts` rewritten to build every icon through
      `brandIcon()` + `src/examples/__tests__/icons.test.ts` and
      `src/examples/__tests__/initialData.test.ts` updated.
- [ ] T3 Verify: full jest suite, typecheck, production build; push the
      branch. Route: inline.

## T1/T2 design notes
- Geometry mirrors the existing runtime-composed block
  (`src/components/SceneLayers/Nodes/Node/IconTypes/IsometricBlockIcon.tsx`,
  `src/utils/isometricBlock.ts`): same footprint/extrude ratio as
  `PROJECTED_TILE_SIZE` / `ICON_BLOCK_EXTRUDE_HEIGHT` (duplicated as literals
  in `isometricBrandIcon.ts` to keep it a small, dependency-light, pure
  module), same isometric shear matrix as `getIsoMatrix()` in
  `src/utils/renderer.ts`. Top face: gradient brand-colour fill + darker
  stroke + a thin light edge highlight; left/right faces: `getColorVariant()`
  dark grades 2/1 (left darker than right), matching the app's existing
  shading convention. Soft ground-shadow ellipse under the block.
- Logo projection: the 24x24 path (or 1-3 letter monogram `<text>`) is
  centred, scaled so the projected width is ~52% of the top face's width,
  then run through the same shear matrix and translated to the top face's
  centre — so it sits on the lid the same way NonIsometricIcon/
  IsometricBlockIcon already project flat icons onto a tile.
- Contrast rule: brand colours with HSL lightness < 0.15 (near-black, e.g.
  GitHub `#181717`, Vercel/Bun/JWT `#000000`) are lifted to lightness 0.22
  (hue-preserving) before use, so the block reads as "dark brand" instead of
  a black blob. The logo itself is white unless the (possibly-lifted) top
  colour's relative luminance exceeds 0.5 (e.g. Linux's yellow `#FCC624`), in
  which case it's a dark slate (`#20242b`).
- Verified visually: rendered nginx, docker, github, vercel, linux,
  kubernetes, and both monogram fallbacks to SVG and PNG (via `sharp-cli`)
  and inspected them — isometric blocks with legible logos, correct
  light/dark logo contrast, near-black brands read as dark grey rather than
  black blobs.
- Monogram fallbacks (Simple Icons v16 has no entry): `openai` → "AI" on
  `#10A37F` (OpenAI/ChatGPT's own brand teal); `grpc` → "RPC" on `#4A90D9`
  (no official gRPC mark in Simple Icons at all).
- Slug correction found while wiring T2: NATS' actual Simple Icons slug is
  `natsdotio`, not `nats.io` — the *id* `nats.io` is kept unchanged (saved
  diagrams reference it), `scripts/generate-brand-icons.mjs` maps
  `{ id: 'nats.io', slug: 'natsdotio' }`.
- `aws-vpc` is untouched (still the hand-authored AWS Architecture Icons data
  URI, not a Simple Icons brand mark, out of scope).

## Acceptance criteria
- No icon URL in `src/examples/initialData.ts` points to an external host.
- Every previously listed icon id still exists.
- The icons render as isometric blocks with a recognizable logo.
- `npm test`, `tsc` and `npm run build` pass.

## TDD
Mode: off (source: prior ODD docs in this repo). Runner: jest (`npm test`).

## Delivery
Branch `fix/local-isometric-icons` from `origin/main@0d836af`. The user asked
to push the branch. PR creation remains the user's decision.

## Progress
- Branch created. Root cause confirmed with curl (`/nginx.svg` returns 404,
  `/nginx` returns 200).

## Next step
T1 + T2 via one delegated writer.
