/* eslint-disable no-console */
// Diagram persistence for the development editor.
//
// Two layers, on purpose:
//   1. The dev server endpoint (webpack/diagram-api.js) writes diagrams/<name>.json,
//      which is the file meant to be committed to the repository.
//   2. localStorage, as a safety net for when that endpoint is unreachable — a
//      production build, the Docker image, or a dev server that is not running.
//      Losing work because a fetch failed would defeat the point.
//
// Diagrams are named (see webpack/diagram-store.js for the server-side name
// pattern this mirrors) so the editor is no longer limited to a single file.
//
// Icons are stripped on write and re-injected on read. The isopacks serialize to
// ~2.44 MB of base64 that never changes, which would blow the localStorage quota
// and turn every git diff into megabytes of noise.

import { Model, Icons, InitialData } from 'src/Isoflow';

export const DEFAULT_DIAGRAM_NAME = 'infra';

// Mirrors NAME_PATTERN in webpack/diagram-store.js. Kept in sync by hand: the
// server module is CommonJS and cannot be imported from this TypeScript file.
export const DIAGRAM_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

// The pre-multi-diagram storage key, kept only so a diagram saved under the
// old scheme is not silently lost. Read as a fallback for the default
// diagram's name only; nothing writes to it any more.
const LEGACY_STORAGE_KEY = 'isoflow:diagram';

export type StoredModel = Omit<Model, 'icons'> & { icons?: Icons };

export interface DiagramSummary {
  name: string;
  updatedAt: string;
}

export class DiagramApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DiagramApiError';
    this.status = status;
  }
}

export const isValidDiagramName = (name: string): boolean => {
  return DIAGRAM_NAME_PATTERN.test(name);
};

export const diagramStorageKey = (name: string): string => {
  return `isoflow:diagram:${name}`;
};

// Pure parsing of the `GET /api/diagrams` response body. Anything that isn't
// shaped like `{ diagrams: [{ name, updatedAt }] }` is treated as empty
// rather than thrown, since a malformed listing should degrade to "no
// diagrams found" instead of breaking the picker.
export const parseDiagramListResponse = (data: unknown): DiagramSummary[] => {
  if (typeof data !== 'object' || data === null) return [];

  const { diagrams } = data as { diagrams?: unknown };

  if (!Array.isArray(diagrams)) return [];

  return diagrams.filter((entry): entry is DiagramSummary => {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { name?: unknown }).name === 'string' &&
      typeof (entry as { updatedAt?: unknown }).updatedAt === 'string'
    );
  });
};

// Pure extraction of the `{ error: string }` shape the API error responses
// use, falling back when the body doesn't match (or wasn't JSON at all).
export const parseErrorBody = (data: unknown, fallback: string): string => {
  if (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
  ) {
    return (data as { error: string }).error;
  }

  return fallback;
};

const readErrorMessage = async (
  res: Response,
  fallback: string
): Promise<string> => {
  try {
    const body: unknown = await res.json();

    return parseErrorBody(body, fallback);
  } catch (err) {
    return fallback;
  }
};

const readLocal = (name: string): StoredModel | null => {
  try {
    let raw = window.localStorage.getItem(diagramStorageKey(name));

    if (!raw && name === DEFAULT_DIAGRAM_NAME) {
      // Migrate transparently from the single-diagram key used before
      // diagrams were named.
      raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    }

    return raw ? (JSON.parse(raw) as StoredModel) : null;
  } catch (err) {
    // Private mode, blocked storage, or corrupt JSON. Never fatal.
    return null;
  }
};

const writeLocal = (name: string, model: StoredModel) => {
  try {
    window.localStorage.setItem(diagramStorageKey(name), JSON.stringify(model));
  } catch (err) {
    console.warn('[persistence] could not write to localStorage', err);
  }
};

export const stripIcons = (model: Model): StoredModel => {
  const { icons, ...rest } = model;

  return { ...rest, icons: [] };
};

export const listDiagrams = async (): Promise<DiagramSummary[]> => {
  try {
    const res = await fetch('/api/diagrams');

    if (!res.ok) return [];

    const data: unknown = await res.json();

    return parseDiagramListResponse(data);
  } catch (err) {
    // No dev server endpoint (production build, Docker). The picker will
    // just show the current diagram.
    console.warn('[persistence] could not list diagrams', err);
    return [];
  }
};

export const saveDiagram = async (name: string, model: Model) => {
  const payload = stripIcons(model);

  // Write locally first: it is synchronous and cannot fail the way a fetch can.
  writeLocal(name, payload);

  try {
    const res = await fetch(`/api/diagrams/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn(`[persistence] save failed: HTTP ${res.status}`);
    }
  } catch (err) {
    // No dev server endpoint (production build, Docker). localStorage already has it.
    console.warn('[persistence] endpoint unreachable, kept local copy only');
  }
};

export const loadDiagram = async (
  name: string,
  icons: Icons
): Promise<InitialData | null> => {
  let stored: StoredModel | null = null;

  try {
    const res = await fetch(`/api/diagrams/${encodeURIComponent(name)}`);

    if (res.ok) {
      stored = (await res.json()) as StoredModel;
    }
  } catch (err) {
    // Fall through to localStorage.
  }

  if (!stored) {
    stored = readLocal(name);
  }

  if (!stored) return null;

  // A saved file with no items and no views is an empty shell; treat it as absent
  // so the user gets the example instead of a blank canvas.
  if (!stored.items?.length && !stored.views?.length) return null;

  return { ...stored, icons } as InitialData;
};

// Creates an empty diagram server-side. Throws a DiagramApiError (e.g. 409
// when the name is already taken, 400 for an invalid name) so callers can
// show the server's message.
export const createDiagram = async (name: string): Promise<void> => {
  const res = await fetch('/api/diagrams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  if (!res.ok) {
    const message = await readErrorMessage(
      res,
      `Could not create diagram (HTTP ${res.status})`
    );

    throw new DiagramApiError(message, res.status);
  }
};

// Duplicates `source` into a new diagram named `target` server-side. Throws
// a DiagramApiError on failure (404 if `source` doesn't exist, 409 if
// `target` already does).
export const duplicateDiagram = async (
  source: string,
  target: string
): Promise<void> => {
  const res = await fetch(
    `/api/diagrams/${encodeURIComponent(source)}/duplicate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: target })
    }
  );

  if (!res.ok) {
    const message = await readErrorMessage(
      res,
      `Could not duplicate diagram (HTTP ${res.status})`
    );

    throw new DiagramApiError(message, res.status);
  }
};

export interface Debounced<T extends (...args: never[]) => unknown> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  // Resolves once the flushed call (if any) settles, so callers can await
  // the save it triggers instead of racing it. Resolves immediately with
  // `undefined` when nothing was pending.
  flush: () => Promise<Awaited<ReturnType<T>> | undefined>;
}

export const debounce = <T extends (...args: never[]) => unknown>(
  fn: T,
  waitMs: number
): Debounced<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingArgs: Parameters<T> | undefined;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const debounced = (...args: Parameters<T>) => {
    clear();
    pendingArgs = args;

    timer = setTimeout(() => {
      timer = undefined;
      const runArgs = pendingArgs;
      pendingArgs = undefined;
      if (runArgs) fn(...runArgs);
    }, waitMs);
  };

  debounced.cancel = () => {
    clear();
    pendingArgs = undefined;
  };

  // Runs a pending call immediately (if any) instead of waiting out the
  // timer, then cancels it. Used when switching diagrams: the pending save
  // for the diagram being left must land before it is abandoned. Returns a
  // promise for that call so callers can await it rather than assuming it
  // has already landed by the time flush() returns.
  debounced.flush = () => {
    const runArgs = pendingArgs;
    clear();
    pendingArgs = undefined;
    if (runArgs) {
      return Promise.resolve(fn(...runArgs)) as Promise<
        Awaited<ReturnType<T>> | undefined
      >;
    }
    return Promise.resolve(undefined);
  };

  return debounced;
};

// Hands out monotonically increasing request ids and reports whether one is
// still the most recent. Used so that overlapping async operations (e.g. two
// diagram switches started in quick succession) can tell whether their own
// result is still the one that should be applied, and drop it otherwise.
export interface RequestGuard {
  next: () => number;
  isLatest: (id: number) => boolean;
}

export const createRequestGuard = (): RequestGuard => {
  let current = 0;

  return {
    next: () => {
      current += 1;
      return current;
    },
    isLatest: (id: number) => {
      return id === current;
    }
  };
};
