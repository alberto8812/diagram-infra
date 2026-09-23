import { Model } from 'src/Isoflow';
import {
  isValidDiagramName,
  diagramStorageKey,
  parseDiagramListResponse,
  parseErrorBody,
  debounce,
  createRequestGuard,
  DEFAULT_DIAGRAM_NAME,
  CURRENT_DIAGRAM_STORAGE_KEY,
  listDiagrams,
  createDiagram,
  duplicateDiagram,
  saveDiagram,
  loadDiagram,
  readStoredDiagramName,
  writeStoredDiagramName,
  DiagramApiError
} from '../persistence';

const mockFetch = (impl: (input: unknown, init?: unknown) => unknown) => {
  // jest's testEnvironment is "node": there is no global `fetch` or
  // `window` unless a test provides one, so each fetch-wrapper test stubs
  // exactly what it needs.
  (global as unknown as { fetch: unknown }).fetch = jest.fn(impl);
};

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 400) => {
  return {
    ok,
    status,
    json: async () => {
      return body;
    }
  };
};

describe('isValidDiagramName()', () => {
  test('accepts names matching the server pattern', () => {
    expect(isValidDiagramName('infra')).toBe(true);
    expect(isValidDiagramName('infra-2')).toBe(true);
    expect(isValidDiagramName('a')).toBe(true);
    expect(isValidDiagramName('a'.repeat(64))).toBe(true);
  });

  test('rejects names the server would reject', () => {
    expect(isValidDiagramName('')).toBe(false);
    expect(isValidDiagramName('-infra')).toBe(false);
    expect(isValidDiagramName('Infra')).toBe(false);
    expect(isValidDiagramName('../x')).toBe(false);
    expect(isValidDiagramName('infra.json')).toBe(false);
    expect(isValidDiagramName('infra_1')).toBe(false);
    expect(isValidDiagramName('a'.repeat(65))).toBe(false);
  });
});

describe('diagramStorageKey()', () => {
  test('namespaces the key by diagram name', () => {
    expect(diagramStorageKey('infra')).toBe('isoflow:diagram:infra');
    expect(diagramStorageKey('network')).toBe('isoflow:diagram:network');
  });
});

describe('parseDiagramListResponse()', () => {
  test('extracts valid entries', () => {
    const result = parseDiagramListResponse({
      diagrams: [
        { name: 'infra', updatedAt: '2026-01-01T00:00:00.000Z' },
        { name: 'network', updatedAt: '2026-01-02T00:00:00.000Z' }
      ]
    });

    expect(result).toEqual([
      { name: 'infra', updatedAt: '2026-01-01T00:00:00.000Z' },
      { name: 'network', updatedAt: '2026-01-02T00:00:00.000Z' }
    ]);
  });

  test('drops malformed entries instead of throwing', () => {
    const result = parseDiagramListResponse({
      diagrams: [
        { name: 'infra', updatedAt: '2026-01-01T00:00:00.000Z' },
        { name: 42, updatedAt: '2026-01-02T00:00:00.000Z' },
        { name: 'no-date' },
        null
      ]
    });

    expect(result).toEqual([
      { name: 'infra', updatedAt: '2026-01-01T00:00:00.000Z' }
    ]);
  });

  test('returns an empty list for an unexpected shape', () => {
    expect(parseDiagramListResponse(null)).toEqual([]);
    expect(parseDiagramListResponse({})).toEqual([]);
    expect(parseDiagramListResponse({ diagrams: 'nope' })).toEqual([]);
    expect(parseDiagramListResponse('nope')).toEqual([]);
  });
});

describe('parseErrorBody()', () => {
  test('extracts the server error message', () => {
    expect(parseErrorBody({ error: 'Invalid diagram name' }, 'fallback')).toBe(
      'Invalid diagram name'
    );
  });

  test('falls back when the body does not match the expected shape', () => {
    expect(parseErrorBody(null, 'fallback')).toBe('fallback');
    expect(parseErrorBody({}, 'fallback')).toBe('fallback');
    expect(parseErrorBody({ error: 42 }, 'fallback')).toBe('fallback');
    expect(parseErrorBody('nope', 'fallback')).toBe('fallback');
  });
});

describe('debounce()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('coalesces calls within the wait window into the last one', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('a');
    debounced('b');
    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  test('cancel() drops a pending call', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('a');
    debounced.cancel();
    jest.advanceTimersByTime(1000);

    expect(fn).not.toHaveBeenCalled();
  });

  test('flush() runs a pending call immediately and cancels the timer', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('a');
    debounced.flush();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');

    jest.advanceTimersByTime(1000);
    // No second call from the timer that flush() already cleared.
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('flush() is a no-op when nothing is pending', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced.flush();

    expect(fn).not.toHaveBeenCalled();
  });

  test("flush() returns a promise that resolves with the flushed call's result", async () => {
    const fn = jest.fn(async (value: string) => {
      return `saved:${value}`;
    });
    const debounced = debounce(fn, 100);

    debounced('a');
    const result = await debounced.flush();

    expect(result).toBe('saved:a');
  });

  test('flush() with nothing pending resolves immediately with undefined', async () => {
    const fn = jest.fn(async () => {
      return 'never called';
    });
    const debounced = debounce(fn, 100);

    const result = await debounced.flush();

    expect(result).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  // Regression coverage for a BasicEditor bug (T5b): a caller closing over
  // mutable state (e.g. "which diagram is being edited") and reading it
  // *inside* the debounced callback would read whatever that state became by
  // the time the timer fires, not what it was when the call was scheduled.
  // debounce() itself already avoids this: `args` is captured synchronously
  // inside the returned `debounced()` function, before the timer is even
  // set, so passing the mutable value as an explicit argument at the call
  // site binds it correctly regardless of what happens before the timer
  // fires.
  test("captures each call's arguments at call time, not when the timer fires", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);
    let target = 'a';

    debounced(target, 'first');
    target = 'b'; // mutated after scheduling, before the timer fires
    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a', 'first');
  });
});

describe('createRequestGuard()', () => {
  test('each request gets a distinct, increasing id', () => {
    const guard = createRequestGuard();

    expect(guard.next()).toBe(1);
    expect(guard.next()).toBe(2);
    expect(guard.next()).toBe(3);
  });

  test('only the most recently issued id is reported as latest', () => {
    const guard = createRequestGuard();

    const first = guard.next();
    const second = guard.next();

    expect(guard.isLatest(first)).toBe(false);
    expect(guard.isLatest(second)).toBe(true);
  });

  test('an id checked before any request exists is not latest', () => {
    const guard = createRequestGuard();

    expect(guard.isLatest(1)).toBe(false);
  });

  test('that same id becomes latest once next() actually issues it', () => {
    const guard = createRequestGuard();

    expect(guard.isLatest(1)).toBe(false);

    guard.next();

    expect(guard.isLatest(1)).toBe(true);
  });
});

describe('fetch wrappers', () => {
  afterEach(() => {
    delete (global as unknown as { fetch?: unknown }).fetch;
  });

  test('listDiagrams() returns the parsed list on success', async () => {
    mockFetch(() => {
      return jsonResponse({
        diagrams: [{ name: DEFAULT_DIAGRAM_NAME, updatedAt: 'now' }]
      });
    });

    const result = await listDiagrams();

    expect(result).toEqual([{ name: DEFAULT_DIAGRAM_NAME, updatedAt: 'now' }]);
  });

  test('listDiagrams() degrades to an empty list when the endpoint is unreachable', async () => {
    mockFetch(() => {
      throw new Error('network error');
    });

    const result = await listDiagrams();

    expect(result).toEqual([]);
  });

  test('createDiagram() resolves on success', async () => {
    mockFetch(() => {
      return jsonResponse({ ok: true });
    });

    await expect(createDiagram('network')).resolves.toBeUndefined();
  });

  test('createDiagram() throws a DiagramApiError with the server message on conflict', async () => {
    mockFetch(() => {
      return jsonResponse({ error: 'Diagram already exists' }, false, 409);
    });

    await expect(createDiagram('infra')).rejects.toMatchObject({
      message: 'Diagram already exists',
      status: 409
    });
    await expect(createDiagram('infra')).rejects.toBeInstanceOf(
      DiagramApiError
    );
  });

  test('createDiagram() sends the model in the same request when provided, atomically', async () => {
    let capturedBody: unknown;

    mockFetch((_input: unknown, init: unknown) => {
      capturedBody = JSON.parse((init as { body: string }).body);
      return jsonResponse({ ok: true });
    });

    const model = {
      title: 'imported',
      items: [],
      views: [],
      colors: [],
      icons: [{ id: 'icon-1' }]
    } as unknown as Model;

    await createDiagram('imported', model);

    // Icons are stripped, same as saveDiagram() — the point is one request
    // carries both the name and the content, not the icon-stripping detail.
    expect(capturedBody).toStrictEqual({
      name: 'imported',
      model: { title: 'imported', items: [], views: [], colors: [], icons: [] }
    });
  });

  test('createDiagram() sends only the name when no model is given', async () => {
    let capturedBody: unknown;

    mockFetch((_input: unknown, init: unknown) => {
      capturedBody = JSON.parse((init as { body: string }).body);
      return jsonResponse({ ok: true });
    });

    await createDiagram('empty');

    expect(capturedBody).toStrictEqual({ name: 'empty' });
  });

  test('duplicateDiagram() throws a DiagramApiError on failure', async () => {
    mockFetch(() => {
      return jsonResponse({ error: 'No such diagram' }, false, 404);
    });

    await expect(duplicateDiagram('missing', 'copy')).rejects.toMatchObject({
      message: 'No such diagram',
      status: 404
    });
  });

  test('saveDiagram() does not throw when the endpoint is unreachable', async () => {
    mockFetch(() => {
      throw new Error('network error');
    });

    await expect(
      saveDiagram('infra', {
        title: 'infra',
        items: [],
        views: [],
        icons: [],
        colors: []
      })
    ).resolves.toBeUndefined();
  });

  test('loadDiagram() returns the server model when found', async () => {
    mockFetch(() => {
      return jsonResponse({
        title: 'infra',
        items: [{ id: '1' }],
        views: [],
        colors: []
      });
    });

    const result = await loadDiagram('infra', []);

    expect(result).toMatchObject({ title: 'infra', items: [{ id: '1' }] });
  });

  test('loadDiagram() returns null when nothing is stored anywhere', async () => {
    mockFetch(() => {
      return jsonResponse({ error: 'No such diagram' }, false, 404);
    });

    const result = await loadDiagram('network', []);

    expect(result).toBeNull();
  });
});

describe('readStoredDiagramName() / writeStoredDiagramName()', () => {
  // jest's testEnvironment is "node": there is no global `window` unless a
  // test provides one, so each test stubs exactly the localStorage it needs
  // (same approach as mockFetch() above).
  const mockLocalStorage = (impl: {
    getItem: (key: string) => string | null;
    setItem?: (key: string, value: string) => void;
  }) => {
    (global as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: jest.fn(impl.getItem),
        setItem: jest.fn(impl.setItem ?? (() => {}))
      }
    };
  };

  afterEach(() => {
    delete (global as unknown as { window?: unknown }).window;
  });

  test('readStoredDiagramName() returns the stored name when it is valid', () => {
    mockLocalStorage({
      getItem: (key) => {
        return key === CURRENT_DIAGRAM_STORAGE_KEY ? 'network' : null;
      }
    });

    expect(readStoredDiagramName()).toBe('network');
  });

  test('readStoredDiagramName() falls back to DEFAULT_DIAGRAM_NAME for an invalid stored name', () => {
    mockLocalStorage({
      getItem: () => {
        return 'Not Valid!';
      }
    });

    expect(readStoredDiagramName()).toBe(DEFAULT_DIAGRAM_NAME);
  });

  test('readStoredDiagramName() falls back to DEFAULT_DIAGRAM_NAME when nothing is stored', () => {
    mockLocalStorage({
      getItem: () => {
        return null;
      }
    });

    expect(readStoredDiagramName()).toBe(DEFAULT_DIAGRAM_NAME);
  });

  test('readStoredDiagramName() falls back to DEFAULT_DIAGRAM_NAME when localStorage throws', () => {
    mockLocalStorage({
      getItem: () => {
        throw new Error('blocked storage');
      }
    });

    expect(readStoredDiagramName()).toBe(DEFAULT_DIAGRAM_NAME);
  });

  test('writeStoredDiagramName() writes under the expected key', () => {
    const setItem = jest.fn();
    mockLocalStorage({
      getItem: () => {
        return null;
      },
      setItem
    });

    writeStoredDiagramName('network');

    expect(setItem).toHaveBeenCalledWith(
      CURRENT_DIAGRAM_STORAGE_KEY,
      'network'
    );
  });
});
