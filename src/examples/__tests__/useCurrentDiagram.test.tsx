/**
 * @jest-environment jsdom
 */
// A namespace import, not `import React from 'react'`: tsconfig sets
// allowSyntheticDefaultImports without esModuleInterop, so the default import
// type-checks but is undefined in ts-jest's CommonJS output. The rest of the
// repo gets away with it because `jsx: react-jsx` never needs React in scope,
// so nothing there actually dereferences it — this file does, for StrictMode.
import * as React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { InitialData } from 'src/Isoflow';
import { useCurrentDiagram } from '../useCurrentDiagram';
import {
  loadDiagram,
  loadLocalDiagram,
  readStoredDiagramName
} from '../persistence';
import { initialData } from '../initialData';

// The hook only calls these three, so mocking the module (rather than fetch
// and localStorage, as persistence.test.ts does for persistence.ts itself)
// keeps this suite about the hook's own load/timeout/cancellation behaviour.
jest.mock('../persistence', () => {
  return {
    loadDiagram: jest.fn(),
    loadLocalDiagram: jest.fn(),
    readStoredDiagramName: jest.fn()
  };
});

const mockLoadDiagram = loadDiagram as jest.MockedFunction<typeof loadDiagram>;
const mockLoadLocalDiagram = loadLocalDiagram as jest.MockedFunction<
  typeof loadLocalDiagram
>;
const mockReadStoredDiagramName = readStoredDiagramName as jest.MockedFunction<
  typeof readStoredDiagramName
>;

// A minimal but distinct restored diagram, so assertions can tell it apart
// from `initialData` (the bundled example). `fitToView` is deliberately
// omitted: the hook is responsible for forcing it, not the stored data.
const restoredDiagram = {
  title: 'Restored diagram',
  icons: [],
  colors: [],
  items: [{ id: 'restored-item' }],
  views: []
} as unknown as InitialData;

describe('useCurrentDiagram()', () => {
  beforeEach(() => {
    mockReadStoredDiagramName.mockReturnValue('infra');
    // Explicit default so a test that forgets to stub it stays honest about
    // "no local copy" instead of silently getting `undefined`, which would
    // make `restored ?? initialData` fall back to the example for the wrong
    // reason.
    mockLoadLocalDiagram.mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('resolves with the restored diagram and clears isLoading', async () => {
    mockLoadDiagram.mockResolvedValue(restoredDiagram);

    const { result } = renderHook(() => {
      return useCurrentDiagram();
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.initialData.title).toBe('Restored diagram');
    expect(result.current.initialData.items).toEqual([{ id: 'restored-item' }]);
  });

  test('forces fitToView on the restored diagram even though it was not stored', async () => {
    mockLoadDiagram.mockResolvedValue(restoredDiagram);

    const { result } = renderHook(() => {
      return useCurrentDiagram();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.initialData.fitToView).toBe(true);
  });

  test('falls back to the bundled example when loadDiagram resolves null', async () => {
    mockLoadDiagram.mockResolvedValue(null);

    const { result } = renderHook(() => {
      return useCurrentDiagram();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.initialData.title).toBe(initialData.title);
    expect(result.current.initialData.fitToView).toBe(true);
  });

  test('falls back to the bundled example when loadDiagram rejects, never stranding the caller loading forever', async () => {
    mockLoadDiagram.mockRejectedValue(new Error('unexpected failure'));

    const { result } = renderHook(() => {
      return useCurrentDiagram();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.initialData.title).toBe(initialData.title);
  });

  test('gives up after LOAD_TIMEOUT_MS and shows the example when loadDiagram never settles', async () => {
    jest.useFakeTimers();
    // Never resolves or rejects within this test.
    mockLoadDiagram.mockReturnValue(new Promise<InitialData | null>(() => {}));

    const { result } = renderHook(() => {
      return useCurrentDiagram();
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.initialData.title).toBe(initialData.title);
  });

  test('falls back to the local copy when the timeout fires and one exists, instead of the bundled example', () => {
    jest.useFakeTimers();
    // Never resolves or rejects within this test.
    mockLoadDiagram.mockReturnValue(new Promise<InitialData | null>(() => {}));
    mockLoadLocalDiagram.mockReturnValue(restoredDiagram);

    const { result } = renderHook(() => {
      return useCurrentDiagram();
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockLoadLocalDiagram).toHaveBeenCalledWith(
      'infra',
      expect.anything()
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.initialData.title).toBe('Restored diagram');
    expect(result.current.initialData.items).toEqual([{ id: 'restored-item' }]);
  });

  test('falls back to the bundled example when the timeout fires and there is no local copy', () => {
    jest.useFakeTimers();
    // Never resolves or rejects within this test.
    mockLoadDiagram.mockReturnValue(new Promise<InitialData | null>(() => {}));
    mockLoadLocalDiagram.mockReturnValue(null);

    const { result } = renderHook(() => {
      return useCurrentDiagram();
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.initialData.title).toBe(initialData.title);
  });

  test('drops a late resolution that arrives after the timeout, keeping the example already shown', async () => {
    jest.useFakeTimers();

    let resolveLoad: (data: InitialData | null) => void = () => {};
    mockLoadDiagram.mockReturnValue(
      new Promise<InitialData | null>((resolve) => {
        resolveLoad = resolve;
      })
    );

    const { result } = renderHook(() => {
      return useCurrentDiagram();
    });

    // Time out first: the example is now showing.
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.initialData.title).toBe(initialData.title);

    // The stored diagram finally shows up, too late — Isoflow already
    // mounted with the example, so this must not change what the hook
    // returns.
    await act(async () => {
      resolveLoad(restoredDiagram);
      // Let the resolved promise's .then/.finally handlers run.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.initialData.title).toBe(initialData.title);
  });

  // The hook keeps its cancellation flag local to each effect run instead of in
  // a shared ref, so StrictMode's setup/cleanup/setup cycle cannot let a stale
  // run apply its result. Resolving the FIRST run LAST is what makes that
  // observable: a shared flag would be set by the first run's cleanup and then
  // cleared again by the second run's setup, leaving the stale diagram free to
  // overwrite the live one. A per-run flag belongs to its own run and stays set.
  test('ignores a stale StrictMode run even when it resolves last', async () => {
    let resolveStale: (data: InitialData | null) => void = () => {};
    let resolveLive: (data: InitialData | null) => void = () => {};

    mockLoadDiagram
      .mockReturnValueOnce(
        new Promise<InitialData | null>((resolve) => {
          resolveStale = resolve;
        })
      )
      .mockReturnValueOnce(
        new Promise<InitialData | null>((resolve) => {
          resolveLive = resolve;
        })
      );

    const { result } = renderHook(
      () => {
        return useCurrentDiagram();
      },
      {
        wrapper: ({ children }: { children?: React.ReactNode }) => {
          return <React.StrictMode>{children}</React.StrictMode>;
        }
      }
    );

    // StrictMode mounts, unmounts and remounts the effect, so the load runs
    // twice. Without this the rest of the test would prove nothing.
    expect(mockLoadDiagram).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveLive({ ...restoredDiagram, title: 'Live diagram' } as InitialData);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.initialData.title).toBe('Live diagram');

    await act(async () => {
      resolveStale({
        ...restoredDiagram,
        title: 'Stale diagram'
      } as InitialData);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.initialData.title).toBe('Live diagram');
  });
});
