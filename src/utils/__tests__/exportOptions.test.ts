import { describeExportError } from '../exportOptions';

describe('describeExportError() works correctly', () => {
  test('uses an Error message when there is one', () => {
    expect(describeExportError(new Error('canvas is tainted'))).toBe(
      'canvas is tainted'
    );
  });

  test('uses a string reason as-is', () => {
    expect(describeExportError('stylesheet is unreachable')).toBe(
      'stylesheet is unreachable'
    );
  });

  // The case this helper exists for: dom-to-image rejects an image it cannot
  // load with the DOM error event, not an Error. `String(event)` is
  // "[object Event]", so the failing URL has to be read off its target or it
  // is lost.
  test('names the URL when the rejection is an image error event', () => {
    const event = { target: { src: 'https://cdn.example.com/icon.svg' } };

    expect(describeExportError(event)).toBe(
      'could not load https://cdn.example.com/icon.svg'
    );
  });

  // A data URI carries the whole image. This repo already ships one 5,270
  // characters long, and a diagram with its own icon pack carries megabytes
  // — none of which a reader can act on, and all of which would flood the
  // alert at the moment the message matters most.
  test('names the type of an inline image instead of printing its bytes', () => {
    const src = `data:image/svg+xml;base64,${'A'.repeat(5000)}`;

    expect(describeExportError({ target: { src } })).toBe(
      'could not load an inline image/svg+xml;base64 image'
    );
  });

  test('truncates a URL too long to sit in an alert', () => {
    const src = `https://cdn.example.com/${'a'.repeat(500)}.svg`;
    const message = describeExportError({ target: { src } });

    expect(message.length).toBeLessThan(160);
    expect(message.startsWith('could not load https://cdn.example.com/')).toBe(
      true
    );
    expect(message.endsWith('…')).toBe(true);
  });

  test('says nothing was reported rather than "[object Object]"', () => {
    expect(describeExportError({})).toBe('no reason was reported');
    expect(describeExportError(null)).toBe('no reason was reported');
    expect(describeExportError(undefined)).toBe('no reason was reported');
  });

  // An Error with an empty message is as useless as no Error at all, so it
  // must not shadow the fallback.
  test('falls through when an Error carries no message', () => {
    expect(describeExportError(new Error(''))).toBe('no reason was reported');
  });

  test('falls through when the target has no usable src', () => {
    expect(describeExportError({ target: {} })).toBe('no reason was reported');
    expect(describeExportError({ target: { src: '' } })).toBe(
      'no reason was reported'
    );
  });
});
