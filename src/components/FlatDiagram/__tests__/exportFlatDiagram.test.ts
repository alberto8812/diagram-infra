/**
 * @jest-environment jsdom
 */

import { DEFAULT_FONT_FAMILY } from 'src/config';
import { downloadFile } from 'src/utils/exportOptions';
import {
  serializeFlatDiagramSvg,
  downloadFlatDiagramSvg,
  downloadFlatDiagramPng,
  FLAT_DIAGRAM_EXPORT_MARGIN
} from '../exportFlatDiagram';

// `downloadFile` (FileSaver under the hood) has nothing useful to observe in
// jsdom — there is no real "save" to happen — so it's mocked at the module
// boundary exportFlatDiagram.ts actually calls, and assertions check what it
// was called with instead.
jest.mock('src/utils/exportOptions', () => {
  const actual = jest.requireActual('src/utils/exportOptions');
  return {
    ...actual,
    downloadFile: jest.fn()
  };
});

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// A small, hand-built <svg> — not FlatDiagram's own output — since these
// tests only care about serializeFlatDiagramSvg's DOM->string transform
// itself, not the flat layout it will actually be given in the app.
const buildSampleSvg = (): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg') as SVGSVGElement;
  svg.setAttribute('width', '120');
  svg.setAttribute('height', '80');
  svg.setAttribute('viewBox', '0 0 120 80');

  const text = document.createElementNS(SVG_NAMESPACE, 'text');
  text.textContent = 'Hello';
  svg.appendChild(text);

  return svg;
};

describe('serializeFlatDiagramSvg', () => {
  test('produces a standalone SVG document with an XML declaration and namespaces', () => {
    const svg = buildSampleSvg();

    const result = serializeFlatDiagramSvg(svg);

    expect(result.startsWith('<?xml version="1.0" encoding="UTF-8"')).toBe(
      true
    );
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(result).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
  });

  test('produces well-formed XML, with each namespace declared once', () => {
    const svg = buildSampleSvg();

    const result = serializeFlatDiagramSvg(svg);
    const doc = new DOMParser().parseFromString(result, 'image/svg+xml');

    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(result.match(/xmlns="/g)).toHaveLength(1);
  });

  test('injects a white background rect and an explicit font-family', () => {
    const svg = buildSampleSvg();

    const result = serializeFlatDiagramSvg(svg);

    expect(result).toContain('fill="#ffffff"');
    expect(result).toContain(`font-family="${DEFAULT_FONT_FAMILY}"`);
  });

  test('adds an even margin on every side, keeping the diagram centred', () => {
    const svg = buildSampleSvg();
    const margin = FLAT_DIAGRAM_EXPORT_MARGIN;

    const result = serializeFlatDiagramSvg(svg);
    const doc = new DOMParser().parseFromString(result, 'image/svg+xml');
    const root = doc.documentElement;
    const background = root.firstElementChild as Element;

    expect(root.getAttribute('width')).toBe(String(120 + margin * 2));
    expect(root.getAttribute('height')).toBe(String(80 + margin * 2));
    expect(root.getAttribute('viewBox')).toBe(
      `${-margin} ${-margin} ${120 + margin * 2} ${80 + margin * 2}`
    );
    expect(background.getAttribute('x')).toBe(String(-margin));
    expect(background.getAttribute('y')).toBe(String(-margin));
    expect(background.getAttribute('width')).toBe(String(120 + margin * 2));
    expect(background.getAttribute('height')).toBe(String(80 + margin * 2));
  });

  test('keeps the original content', () => {
    const svg = buildSampleSvg();

    const result = serializeFlatDiagramSvg(svg);

    expect(result).toContain('Hello');
  });

  test('does not mutate the live SVG element', () => {
    const svg = buildSampleSvg();
    const originalChildCount = svg.children.length;

    serializeFlatDiagramSvg(svg);

    expect(svg.children.length).toBe(originalChildCount);
    expect(svg.getAttribute('font-family')).toBeNull();
    expect(svg.getAttribute('xmlns')).toBeNull();
  });
});

describe('downloadFlatDiagramSvg', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('downloads the serialized SVG as an svg file', () => {
    const svg = buildSampleSvg();

    downloadFlatDiagramSvg(svg);

    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [blob, filename] = (downloadFile as jest.Mock).mock.calls[0];

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/svg+xml;charset=utf-8');
    expect(filename).toMatch(/^flat-diagram-.*\.svg$/);
  });
});

interface StubImageInstance {
  onload: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  src: string;
}

// A stub Image object — a plain object with a defined `src` setter, not a
// class — that fires `onload` or `onerror` as soon as `src` is assigned, so
// downloadFlatDiagramPng's promise settles without any real image decoding.
const createStubImage = (shouldFail: boolean): StubImageInstance => {
  const instance = {
    onload: null,
    onerror: null,
    src: ''
  } as StubImageInstance;

  Object.defineProperty(instance, 'src', {
    set: () => {
      if (shouldFail) {
        instance.onerror?.(new Event('error'));
      } else {
        instance.onload?.();
      }
    }
  });

  return instance;
};

// jsdom has no real image decoding or canvas 2D backend, so the browser
// pieces (Image, HTMLCanvasElement) are stubbed here rather than exercised
// for real — this only proves downloadFlatDiagramPng wires them together
// correctly (load the serialized SVG, draw it at `scale`x, hand the result
// to downloadFile), not that a browser can actually rasterise SVG.
describe('downloadFlatDiagramPng', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalImage = global.Image;

  let drawImage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    URL.createObjectURL = jest.fn(() => {
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = jest.fn();

    drawImage = jest.fn();
    // @ts-expect-error partial 2D context stub — only the calls
    // downloadFlatDiagramPng actually makes are provided.
    HTMLCanvasElement.prototype.getContext = jest.fn(() => {
      return {
        fillStyle: '',
        fillRect: jest.fn(),
        drawImage
      };
    });

    HTMLCanvasElement.prototype.toBlob = jest.fn((callback: BlobCallback) => {
      callback(new Blob(['fake-png'], { type: 'image/png' }));
    });

    // @ts-expect-error test stub, not a full Image implementation
    global.Image = jest.fn(() => {
      return createStubImage(false);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    global.Image = originalImage;
  });

  test('rasterises the SVG onto a canvas at the given scale and downloads a PNG', async () => {
    const svg = buildSampleSvg();

    await downloadFlatDiagramPng(svg, 2);

    // (120 + 2 * 48) x (80 + 2 * 48) at 2x: the export margin is included.
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 432, 352);
    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [blob, filename] = (downloadFile as jest.Mock).mock.calls[0];

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(filename).toMatch(/^flat-diagram-.*\.png$/);
  });

  test('rejects when the image fails to load', async () => {
    // @ts-expect-error test stub, not a full Image implementation
    global.Image = jest.fn(() => {
      return createStubImage(true);
    });

    const svg = buildSampleSvg();

    await expect(downloadFlatDiagramPng(svg)).rejects.toBeDefined();
    expect(downloadFile).not.toHaveBeenCalled();
  });

  test('rejects instead of hanging when drawing onto the canvas throws', async () => {
    drawImage.mockImplementation(() => {
      throw new Error('draw failed');
    });

    const svg = buildSampleSvg();

    await expect(downloadFlatDiagramPng(svg)).rejects.toThrow('draw failed');
    expect(downloadFile).not.toHaveBeenCalled();
  });
});
