import { icons } from '../initialData';

// dom-to-image inlines every image before it can rasterise the diagram, and it
// reads the media type from the URL's EXTENSION — never from the response's
// Content-Type header:
//
//   parseExtension(url) -> mimes()[extension] || ''
//   dataAsUrl(content, type) -> 'data:' + type + ';base64,' + content
//
// So an extensionless URL, however correctly the server serves it, becomes
// `data:;base64,...`. That URI cannot load as an image, and dom-to-image
// rejects the whole export — one icon takes down the entire "Export as image".
//
// That is not hypothetical: `https://cdn.simpleicons.org/terraform/844FBA`
// served a perfectly good `image/svg+xml` over CORS and still broke every
// export, because the path ends in a colour rather than a file name.
const EXTENSION_DOM_TO_IMAGE_KNOWS = /\.(svg|png|jpe?g|gif|webp|tiff?|bmp)$/i;

describe('the bundled icons', () => {
  const remoteIcons = icons.filter((icon) => {
    return /^https?:\/\//.test(icon.url ?? '');
  });

  test('there are remote icons to check', () => {
    expect(remoteIcons.length).toBeGreaterThan(0);
  });

  test.each(
    remoteIcons.map((icon) => {
      return [icon.id, icon.url];
    })
  )('%s has a URL extension dom-to-image can resolve', (_id, url) => {
    expect(url).toMatch(EXTENSION_DOM_TO_IMAGE_KNOWS);
  });

  // Checking the extension alone is not enough, and this is not theoretical:
  // a bad edit to the URL template dropped the slug, leaving every one of
  // these icons pointing at the same `https://cdn.simpleicons.org/.svg`. The
  // extension survived, so the test above stayed green while 76 icons were
  // broken.
  //
  // Uniqueness is what catches that, and it is the strongest claim that is
  // actually true here. "The URL must contain the icon's id" was the first
  // attempt and it is wrong: `gh-actions` is our id, `githubactions` is Simple
  // Icons' slug, and neither owes the other a match.
  test('no two icons share a URL', () => {
    const urls = remoteIcons.map((icon) => {
      return icon.url;
    });

    expect(new Set(urls).size).toBe(urls.length);
  });
});
