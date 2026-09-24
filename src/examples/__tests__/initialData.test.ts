import { icons } from '../initialData';

// dom-to-image inlines every image before it can rasterise the diagram, and
// for anything it has to fetch over the network it reads the media type from
// the URL's EXTENSION — never from the response's Content-Type header:
//
//   parseExtension(url) -> mimes()[extension] || ''
//   dataAsUrl(content, type) -> 'data:' + type + ';base64,' + content
//
// A `data:image/svg+xml;base64,...` URI sidesteps that hazard entirely (no
// fetch, no extension to parse — the media type is already in the URI
// itself), which is why every bundled icon is now baked as one
// (src/utils/isometricBrandIcon.ts, src/examples/initialData.ts,
// odd/tasks/local-isometric-icons.md T1/T2). This used to matter for a remote
// URL: `https://cdn.simpleicons.org/terraform/844FBA` served a perfectly good
// `image/svg+xml` over CORS and still broke every export, because the path
// ends in a colour rather than a file name — the original bug this repo
// chased before switching to local icons altogether.
// The technology/CI-CD collections this file (src/examples/initialData.ts)
// defines itself, as opposed to the @isoflow/isopacks (aws, azure, gcp,
// kubernetes, isoflow) packs mixed into the same `icons` export. Some
// isopack icons legitimately reuse one image for several ids (e.g. the
// Kubernetes control-plane components) — that is a pre-existing @isoflow/isopacks
// property, not something this task's icons own or should assert about.
const OWN_COLLECTIONS = [
  'cicd',
  'runtimes',
  'frameworks',
  'apis',
  'data',
  'messaging',
  'identity',
  'networking',
  'platform',
  'observability',
  'ai'
];

describe('the bundled icons', () => {
  test('none of them are remote — every icon is a local data URI', () => {
    const remoteIcons = icons.filter((icon) => {
      return /^https?:\/\//.test(icon.url ?? '');
    });

    expect(remoteIcons).toEqual([]);
  });

  // A bad edit to the old URL template once dropped the slug, leaving every
  // one of ~76 icons pointing at the exact same
  // `https://cdn.simpleicons.org/.svg` — the extension survived, so nothing
  // else in this file would have caught it. Uniqueness is the strongest claim
  // that is actually true for baked icons too: two different brands
  // (different id, hex or path) must never collapse onto the same rendered
  // data URI.
  test("no two of this file's own icons share a URL", () => {
    const ownUrls = icons
      .filter((icon) => {
        return OWN_COLLECTIONS.includes(icon.collection ?? '');
      })
      .map((icon) => {
        return icon.url;
      });

    expect(new Set(ownUrls).size).toBe(ownUrls.length);
  });
});
