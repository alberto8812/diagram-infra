import chroma from 'chroma-js';
import { getIsometricCuboidFaces, toSvgPoints } from 'src/utils/isometricBlock';
import { getColorVariant } from 'src/utils/common';

// Bakes a brand's flat logo (a Simple Icons style 24x24 path, or a monogram
// fallback) into a standalone isometric block SVG — a brand-coloured cuboid
// with shaded side faces and the logo projected onto the top face — so it
// renders in the picker/on the canvas exactly like the bundled
// @isoflow/isopacks icons (see node_modules/@isoflow/isopacks/dist/isoflow.js)
// instead of depending on a CDN. Pure string building, no DOM: this runs both
// at build/import time (src/examples/initialData.ts, browser + jest) and in
// unit tests, so it must not touch `document`/`window`.
//
// The block's footprint/extrude ratio mirrors PROJECTED_TILE_SIZE /
// ICON_BLOCK_EXTRUDE_HEIGHT in src/config.ts — the same proportions the
// runtime-composed IsometricBlockIcon
// (src/components/SceneLayers/Nodes/Node/IconTypes/IsometricBlockIcon.tsx)
// already uses for other flat icons — so a baked icon sits on a diagram tile
// at the same size. The values are duplicated as literals rather than
// imported from src/config to keep this module small and dependency-light
// (src/config pulls in the MUI theme).
const FOOTPRINT = { width: 141.5, height: 81.9 };
const EXTRUDE_HEIGHT = Math.round(FOOTPRINT.height * 0.35);
const TOTAL_HEIGHT = FOOTPRINT.height + EXTRUDE_HEIGHT;

// Same isometric shear/rotate matrix as `getIsoMatrix()` (ProjectionOrientationEnum.X)
// in src/utils/renderer.ts — duplicated as a literal for the same reason as
// FOOTPRINT above. It is what NonIsometricIcon/IsometricBlockIcon already use
// to project a flat icon onto a tile, so reusing it here keeps a baked logo's
// skew identical to the rest of the app's isometric icons.
const ISO_MATRIX = { a: 0.707, b: -0.409, c: 0.707, d: 0.409 };

// A brand logo path ships in a 24x24 viewBox (the Simple Icons convention).
const LOGO_VIEWBOX = 24;

// Colours darker than this (HSL lightness) read as a near-black blob once
// rendered as a solid-filled block, so they get lifted to a dark grey first
// (hue-preserving) instead of being used as-is.
const NEAR_BLACK_LIGHTNESS = 0.15;
const LIFTED_LIGHTNESS = 0.22;

// Above this (relative) luminance the top face reads as light enough that a
// white logo loses contrast, so a dark logo is used instead.
const LIGHT_TOP_LUMINANCE_THRESHOLD = 0.5;

const WHITE_LOGO_COLOR = '#ffffff';
const DARK_LOGO_COLOR = '#20242b';

const DEFAULT_PADDING = 0.52;

export interface IsometricBrandIconInput {
  /** Brand colour, with or without a leading `#`. */
  hex: string;
  /** A 24x24-viewBox SVG path `d` (Simple Icons convention). */
  path?: string;
  /** 1-3 letter fallback glyph, used when no brand path is available. */
  monogram?: string;
}

export interface IsometricBrandIconOptions {
  /** Fraction of the top face's width the projected logo should span. */
  padding?: number;
}

export interface IsometricBrandIconResult {
  svg: string;
  dataUri: string;
}

const normalizeHex = (hex: string): string => {
  return hex.startsWith('#') ? hex : `#${hex}`;
};

// Lifts a near-black brand colour to a dark grey, preserving its hue, so the
// block reads as "dark brand" instead of a flat black silhouette.
const getEffectiveTopColor = (hex: string): string => {
  const color = chroma(normalizeHex(hex));

  if (color.get('hsl.l') >= NEAR_BLACK_LIGHTNESS) {
    return color.hex();
  }

  return color.set('hsl.l', LIFTED_LIGHTNESS).hex();
};

const getLogoColor = (topColor: string): string => {
  return chroma(topColor).luminance() > LIGHT_TOP_LUMINANCE_THRESHOLD
    ? DARK_LOGO_COLOR
    : WHITE_LOGO_COLOR;
};

const escapeXml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

// Works in both jest (Node, `testEnvironment: 'node'` — Buffer is global) and
// the webpack browser bundle (no Buffer polyfill — falls back to `btoa`,
// UTF-8-escaped the way MDN documents for non-Latin1 input).
const toBase64 = (input: string): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf-8').toString('base64');
  }

  return btoa(unescape(encodeURIComponent(input)));
};

// Centre of the top face diamond, in the same anchor-relative coordinates
// `getIsometricCuboidFaces()` uses (the node's own floor point is (0, 0),
// "up" is negative y).
const getTopFaceCenter = () => {
  return { x: 0, y: -(EXTRUDE_HEIGHT + FOOTPRINT.height / 2) };
};

// A 24-unit-wide logo projected through ISO_MATRIX (at scale 1) lands in a
// diamond `2 * 12 * (a + c)` wide — see src/utils/__tests__/isometricBrandIcon.test.ts
// for the worked numbers. Scaling that to `padding` of the top face's own
// width keeps the logo consistently sized and centred regardless of padding.
const getLogoScale = (padding: number): number => {
  const half = LOGO_VIEWBOX / 2;
  const naturalWidth = 2 * half * (ISO_MATRIX.a + ISO_MATRIX.c);

  return (FOOTPRINT.width * padding) / naturalWidth;
};

const getLogoTransform = (scale: number, preCenter: boolean): string => {
  const center = getTopFaceCenter();
  const { a, b, c, d } = ISO_MATRIX;
  const half = LOGO_VIEWBOX / 2;

  const parts = [
    `translate(${center.x} ${center.y})`,
    `matrix(${a} ${b} ${c} ${d} 0 0)`,
    `scale(${scale})`
  ];

  if (preCenter) {
    // Path data is in 0..24 space (top-left origin); recentre it on (0, 0)
    // before the shared scale/matrix/translate pipeline above.
    parts.push(`translate(${-half} ${-half})`);
  }

  return parts.join(' ');
};

export const isometricBrandIcon = (
  input: IsometricBrandIconInput,
  options: IsometricBrandIconOptions = {}
): IsometricBrandIconResult => {
  const { hex, path, monogram } = input;
  const padding = options.padding ?? DEFAULT_PADDING;

  if (!path && !monogram) {
    throw new Error(
      'isometricBrandIcon() requires either `path` or `monogram`'
    );
  }

  const topColor = getEffectiveTopColor(hex);
  const topColorLight = chroma(topColor).brighten(0.6).hex();
  const leftColor = getColorVariant(topColor, 'dark', { grade: 2 });
  const rightColor = getColorVariant(topColor, 'dark', { grade: 1 });
  const topStrokeColor = getColorVariant(topColor, 'dark', { grade: 2.5 });
  const highlightColor = chroma(topColor).brighten(1.4).hex();
  const logoColor = getLogoColor(topColor);
  const gradientId = `isoBrandTop-${normalizeHex(hex).slice(1)}`;

  const faces = getIsometricCuboidFaces(FOOTPRINT, EXTRUDE_HEIGHT);
  const scale = getLogoScale(padding);

  const shadowRy = FOOTPRINT.height * 0.14;
  const shadowRx = FOOTPRINT.width * 0.26;

  const viewBoxX = -FOOTPRINT.width / 2 - 4;
  const viewBoxY = -TOTAL_HEIGHT - 4;
  const viewBoxWidth = FOOTPRINT.width + 8;
  const viewBoxHeight = TOTAL_HEIGHT + shadowRy + 8;

  const logo = path
    ? `<path d="${escapeXml(path)}" fill="${logoColor}" transform="${getLogoTransform(scale, true)}" />`
    : `<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${monogram && monogram.length > 2 ? 9 : 12}" fill="${logoColor}" transform="${getLogoTransform(scale, false)}">${escapeXml((monogram ?? '').slice(0, 3).toUpperCase())}</text>`;

  // Highlight: a thin light line tracing the top face's back-left edge
  // (far -> left), the edge that faces the "light source" this shading
  // scheme implies (top face lighter than the left/right walls).
  const [far, , , left] = faces.top;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}">`,
    '<defs>',
    `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `<stop offset="0%" stop-color="${topColorLight}" />`,
    `<stop offset="100%" stop-color="${topColor}" />`,
    '</linearGradient>',
    '</defs>',
    `<ellipse cx="0" cy="0" rx="${shadowRx}" ry="${shadowRy}" fill="rgba(0,0,0,0.22)" />`,
    `<polygon points="${toSvgPoints(faces.left)}" fill="${leftColor}" />`,
    `<polygon points="${toSvgPoints(faces.right)}" fill="${rightColor}" />`,
    `<polygon points="${toSvgPoints(faces.top)}" fill="url(#${gradientId})" stroke="${topStrokeColor}" stroke-width="1" stroke-linejoin="round" />`,
    `<line x1="${far.x}" y1="${far.y}" x2="${left.x}" y2="${left.y}" stroke="${highlightColor}" stroke-width="1.2" stroke-linecap="round" opacity="0.55" />`,
    logo,
    '</svg>'
  ].join('');

  return {
    svg,
    dataUri: `data:image/svg+xml;base64,${toBase64(svg)}`
  };
};
