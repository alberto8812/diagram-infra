import domtoimage from 'dom-to-image';
import FileSaver from 'file-saver';
import { Model, Size } from '../types';

export const generateGenericFilename = (extension: string) => {
  return `isoflow-export-${new Date().toISOString()}.${extension}`;
};

// Turns whatever `dom-to-image` rejected with into something worth showing.
//
// It does not always reject with an `Error`: an image it cannot load rejects
// with the DOM error Event itself, which stringifies to "[object Event]" and
// names nothing. The URL that failed is on that event's target, and it is the
// single most useful fact about the failure — usually an icon the diagram
// points at that the browser could not fetch.
// Long enough to recognise a URL, short enough to stay inside an alert.
const MAX_REPORTED_SRC_LENGTH = 120;

// What to say about the source that failed. A data URI carries the whole
// image inline — thousands of characters here, megabytes in a diagram
// carrying its own icon pack — and none of those bytes tell a reader
// anything they can act on. Naming its type says as much and fits on a line.
const describeSrc = (src: string): string => {
  if (src.startsWith('data:')) {
    const [mediaType] = src.slice('data:'.length).split(',');

    return `an inline ${mediaType || 'data'} image`;
  }

  return src.length > MAX_REPORTED_SRC_LENGTH
    ? `${src.slice(0, MAX_REPORTED_SRC_LENGTH)}…`
    : src;
};

export const describeExportError = (error: unknown): string => {
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }

  if (typeof error === 'string' && error !== '') {
    return error;
  }

  const src = (error as { target?: { src?: unknown } } | null)?.target?.src;

  if (typeof src === 'string' && src !== '') {
    return `could not load ${describeSrc(src)}`;
  }

  return 'no reason was reported';
};

export const base64ToBlob = (
  base64: string,
  contentType: string,
  sliceSize = 512
) => {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });

  return blob;
};

export const downloadFile = (data: Blob, filename: string) => {
  FileSaver.saveAs(data, filename);
};

export const exportAsJSON = (model: Model) => {
  const data = new Blob([JSON.stringify(model)], {
    type: 'application/json;charset=utf-8'
  });

  downloadFile(data, generateGenericFilename('json'));
};

export const exportAsImage = async (el: HTMLDivElement, size?: Size) => {
  const imageData = await domtoimage.toPng(el, {
    ...size,
    cacheBust: true
  });

  return imageData;
};
