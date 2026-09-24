import { DEFAULT_FONT_FAMILY } from 'src/config';
import { downloadFile } from 'src/utils/exportOptions';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

// A filename dedicated to this view, so a downloaded file is recognisable in
// a Downloads folder next to the isometric export's `isoflow-export-*`
// files, rather than looking like the same kind of export.
export const generateFlatDiagramFilename = (extension: string) => {
  return `flat-diagram-${new Date().toISOString()}.${extension}`;
};

// The live <svg> has no explicit width/height/viewBox fallback logic of its
// own to read back from — FlatDiagram.tsx always sets both width/height
// attributes and a matching viewBox — but this reads defensively in case
// that ever changes, since a PNG canvas with a zero size would silently
// produce nothing.
const readSvgDimensions = (
  svg: SVGSVGElement
): { width: number; height: number } => {
  const widthAttr = svg.getAttribute('width');
  const heightAttr = svg.getAttribute('height');
  const width = widthAttr ? parseFloat(widthAttr) : NaN;
  const height = heightAttr ? parseFloat(heightAttr) : NaN;

  if (width > 0 && height > 0) {
    return { width, height };
  }

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  return { width: 1, height: 1 };
};

// Turns the live, on-screen <svg> into a standalone, self-contained SVG
// document string — safe to write to a file and open outside the app.
//
// Works on a clone rather than the live node, so the dialog's own rendered
// diagram is never touched. Three things the live SVG relies on the
// surrounding page for are made explicit here instead:
//   - the `xmlns`/`xmlns:xlink` declarations a bare inline <svg> doesn't need
//     but a standalone .svg file does, for viewers/browsers to parse it at
//     all and resolve the <image> elements' `href`s;
//   - a white background rect, since the live SVG itself paints nothing
//     behind its content and instead relies on the dialog's own
//     `bgcolor: 'common.white'` wrapper, which an exported file has none of;
//   - an explicit font-family, since the live text inherits the page's font
//     (set globally via MUI/CSS) rather than declaring one itself, and a
//     file opened outside the app has no such page to inherit from.
export const serializeFlatDiagramSvg = (svg: SVGSVGElement): string => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = readSvgDimensions(svg);

  clone.setAttribute('xmlns', SVG_NAMESPACE);
  clone.setAttribute('xmlns:xlink', XLINK_NAMESPACE);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // A presentation attribute on the root, rather than a <style> element:
  // every text/tspan in this diagram sets no font-family of its own (see
  // FlatDiagram.tsx), so this single inherited value covers all of them.
  clone.setAttribute('font-family', DEFAULT_FONT_FAMILY);

  const background = clone.ownerDocument.createElementNS(SVG_NAMESPACE, 'rect');
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', String(width));
  background.setAttribute('height', String(height));
  background.setAttribute('fill', '#ffffff');
  // Inserted first so it paints behind every other element, matching the
  // white backdrop the dialog otherwise provides via `bgcolor`.
  clone.insertBefore(background, clone.firstChild);

  const serialized = new XMLSerializer().serializeToString(clone);

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${serialized}`;
};

export const downloadFlatDiagramSvg = (svg: SVGSVGElement) => {
  const serialized = serializeFlatDiagramSvg(svg);
  const blob = new Blob([serialized], {
    type: 'image/svg+xml;charset=utf-8'
  });

  downloadFile(blob, generateFlatDiagramFilename('svg'));
};

// Rasterises the same serialized SVG onto a canvas and downloads it as a
// PNG. Drawn at `scale`x the SVG's own size (default 2x) so the exported
// file stays crisp on a high-DPI screen instead of matching the diagram's
// often-modest on-screen pixel size exactly.
export const downloadFlatDiagramPng = (
  svg: SVGSVGElement,
  scale = 2
): Promise<void> => {
  const serialized = serializeFlatDiagramSvg(svg);
  const { width, height } = readSvgDimensions(svg);
  const svgBlob = new Blob([serialized], {
    type: 'image/svg+xml;charset=utf-8'
  });
  const objectUrl = URL.createObjectURL(svgBlob);

  return new Promise<void>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not get a 2D canvas context'));
        return;
      }

      // The rasterised <image> content is opaque already (see the
      // serialized background rect), but this guards against a browser
      // that draws a transparent canvas before the image finishes.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Could not generate PNG image data'));
          return;
        }

        downloadFile(blob, generateFlatDiagramFilename('png'));
        resolve();
      }, 'image/png');
    };

    // Mirrors `describeExportError`'s handling of a failed image load: the
    // event itself carries no message, only the `src` that failed on its
    // `target`, so it's passed through as-is rather than wrapped.
    image.onerror = (event) => {
      URL.revokeObjectURL(objectUrl);
      reject(event);
    };

    image.src = objectUrl;
  });
};
