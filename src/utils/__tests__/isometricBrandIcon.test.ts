import chroma from 'chroma-js';
import { isometricBrandIcon } from '../isometricBrandIcon';

// A tiny, deterministic stand-in path (not a real brand mark) — the
// projection logic doesn't care what the path draws.
const SAMPLE_PATH = 'M12 2 L22 12 L12 22 L2 12 Z';

const decode = (dataUri: string): string => {
  const [, base64] = dataUri.split(',');
  return Buffer.from(base64, 'base64').toString('utf-8');
};

describe('isometricBrandIcon()', () => {
  it('returns an SVG data URI', () => {
    const { dataUri } = isometricBrandIcon({
      hex: '#009639',
      path: SAMPLE_PATH
    });

    expect(dataUri).toMatch(/^data:image\/svg\+xml;base64,/);

    const svg = decode(dataUri);
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('the returned `svg` string matches the decoded data URI', () => {
    const { svg, dataUri } = isometricBrandIcon({
      hex: '#009639',
      path: SAMPLE_PATH
    });

    expect(decode(dataUri)).toBe(svg);
  });

  it('draws three cuboid faces (top, left, right) as polygons', () => {
    const { svg } = isometricBrandIcon({ hex: '#009639', path: SAMPLE_PATH });

    const polygonCount = (svg.match(/<polygon /g) ?? []).length;
    expect(polygonCount).toBe(3);
  });

  it('embeds the brand logo path', () => {
    const { svg } = isometricBrandIcon({ hex: '#009639', path: SAMPLE_PATH });

    expect(svg).toContain(`<path d="${SAMPLE_PATH}"`);
  });

  it('projects a monogram as <text> when no path is given', () => {
    const { svg } = isometricBrandIcon({ hex: '#4B0082', monogram: 'MC' });

    expect(svg).toContain('<text');
    expect(svg).toContain('>MC<');
  });

  it('uppercases and caps the monogram at 3 characters', () => {
    const { svg } = isometricBrandIcon({ hex: '#4B0082', monogram: 'abcd' });

    expect(svg).toContain('>ABC<');
  });

  it('throws when neither `path` nor `monogram` is given', () => {
    expect(() => {
      isometricBrandIcon({ hex: '#4B0082' });
    }).toThrow(/requires either `path` or `monogram`/);
  });

  it('gives a light brand colour a dark logo fill', () => {
    // Linux's yellow (#FCC624) is well above the light/dark threshold.
    const { svg } = isometricBrandIcon({ hex: '#FCC624', path: SAMPLE_PATH });

    expect(svg).toContain('fill="#20242b"');
    expect(svg).not.toContain('fill="#ffffff"');
  });

  it('gives a dark brand colour a white logo fill', () => {
    const { svg } = isometricBrandIcon({ hex: '#2088FF', path: SAMPLE_PATH });

    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain('fill="#20242b"');
  });

  it('lifts a near-black brand colour instead of rendering a black blob', () => {
    const { svg: black } = isometricBrandIcon({
      hex: '#000000',
      path: SAMPLE_PATH
    });
    const { svg: near } = isometricBrandIcon({
      hex: '#181717',
      path: SAMPLE_PATH
    });

    // The top-face gradient's darkest stop should never be true black.
    const gradientStop = black.match(
      /stop-color="(#[0-9a-f]{6})" \/>\s*<\/linearGradient>/i
    );
    expect(gradientStop).not.toBeNull();
    const liftedColor = chroma(gradientStop![1]);
    expect(liftedColor.get('hsl.l')).toBeGreaterThan(0.15);

    expect(near).toBeTruthy();
  });

  it('is deterministic for the same input', () => {
    const first = isometricBrandIcon({ hex: '#009639', path: SAMPLE_PATH });
    const second = isometricBrandIcon({ hex: '#009639', path: SAMPLE_PATH });

    expect(first.svg).toBe(second.svg);
    expect(first.dataUri).toBe(second.dataUri);
  });

  it('produces a different result for a different brand colour', () => {
    const green = isometricBrandIcon({ hex: '#009639', path: SAMPLE_PATH });
    const blue = isometricBrandIcon({ hex: '#2088FF', path: SAMPLE_PATH });

    expect(green.svg).not.toBe(blue.svg);
  });

  it('accepts a hex without a leading #', () => {
    const withHash = isometricBrandIcon({ hex: '#009639', path: SAMPLE_PATH });
    const withoutHash = isometricBrandIcon({
      hex: '009639',
      path: SAMPLE_PATH
    });

    expect(withHash.svg).toBe(withoutHash.svg);
  });

  it('escapes unsafe XML characters in a monogram', () => {
    const { svg } = isometricBrandIcon({ hex: '#4B0082', monogram: '<&>' });

    expect(svg).not.toContain('<&>');
    expect(svg).toContain('&lt;&amp;&gt;');
  });
});
