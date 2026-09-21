/* eslint-disable no-console */
// Diagram persistence for the development editor.
//
// Two layers, on purpose:
//   1. The dev server endpoint (webpack/diagram-api.js) writes diagrams/infra.json,
//      which is the file meant to be committed to the repository.
//   2. localStorage, as a safety net for when that endpoint is unreachable — a
//      production build, the Docker image, or a dev server that is not running.
//      Losing work because a fetch failed would defeat the point.
//
// Icons are stripped on write and re-injected on read. The isopacks serialize to
// ~2.44 MB of base64 that never changes, which would blow the localStorage quota
// and turn every git diff into megabytes of noise.

import { Model, Icons, InitialData } from 'src/Isoflow';

const ENDPOINT = '/api/diagram';
const STORAGE_KEY = 'isoflow:diagram';

type StoredModel = Omit<Model, 'icons'> & { icons?: Icons };

export const stripIcons = (model: Model): StoredModel => {
  const { icons, ...rest } = model;

  return { ...rest, icons: [] };
};

const readLocal = (): StoredModel | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    return raw ? (JSON.parse(raw) as StoredModel) : null;
  } catch (err) {
    // Private mode, blocked storage, or corrupt JSON. Never fatal.
    return null;
  }
};

const writeLocal = (model: StoredModel) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch (err) {
    console.warn('[persistence] could not write to localStorage', err);
  }
};

export const saveDiagram = async (model: Model) => {
  const payload = stripIcons(model);

  // Write locally first: it is synchronous and cannot fail the way a fetch can.
  writeLocal(payload);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
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
  icons: Icons
): Promise<InitialData | null> => {
  let stored: StoredModel | null = null;

  try {
    const res = await fetch(ENDPOINT);

    if (res.ok) {
      stored = (await res.json()) as StoredModel;
    }
  } catch (err) {
    // Fall through to localStorage.
  }

  if (!stored) {
    stored = readLocal();
  }

  if (!stored) return null;

  // A saved file with no items and no views is an empty shell; treat it as absent
  // so the user gets the example instead of a blank canvas.
  if (!stored.items?.length && !stored.views?.length) return null;

  return { ...stored, icons } as InitialData;
};

export const debounce = <T extends (...args: never[]) => unknown>(
  fn: T,
  waitMs: number
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      fn(...args);
    }, waitMs);
  };
};
