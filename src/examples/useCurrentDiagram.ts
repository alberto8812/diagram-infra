import { useEffect, useState } from 'react';
import { InitialData } from 'src/Isoflow';
import { initialData, icons } from './initialData';
import { loadDiagram, readStoredDiagramName } from './persistence';

// How long to wait for the saved diagram before showing the example instead.
// Generous on purpose: this only has to beat a request that will never
// answer, not a slow one.
const LOAD_TIMEOUT_MS = 5000;

export interface UseCurrentDiagramResult {
  initialData: InitialData;
  isLoading: boolean;
}

// Loads the diagram currently selected in BasicEditor's picker (stored under
// CURRENT_DIAGRAM_STORAGE_KEY, see persistence.ts), so a mode switch shows the
// user's own diagram instead of always mounting the bundled airport example.
//
// This is intentionally NOT used by BasicEditor itself: BasicEditor owns
// extra state this hook does not model — the diagram picker, create/
// duplicate/import, and the debounced autosave — and folding that in here
// would put the autosave path at risk for a change that is only about the
// other, simpler modes (debug tools, read-only). BasicEditor keeps its own
// load effect.
export const useCurrentDiagram = (): UseCurrentDiagramResult => {
  const [restored, setRestored] = useState<InitialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Local to this effect run rather than a ref: a shared ref is set by one
    // run's cleanup and then cleared by the next run's setup, which is
    // exactly the mount/unmount/remount StrictMode performs, so a stale
    // promise could still apply its result. A local flag belongs to its own
    // run and cannot be reset by another.
    let cancelled = false;

    // A request that never settles would leave these modes blank for good,
    // which the catch below cannot cover: a hung fetch neither resolves nor
    // rejects. Giving up after a bounded wait shows the example instead of
    // nothing. Safe to do here because neither mode saves, so mounting the
    // example cannot overwrite anything.
    const timeout = setTimeout(() => {
      if (cancelled) return;

      setIsLoading(false);
    }, LOAD_TIMEOUT_MS);

    loadDiagram(readStoredDiagramName(), icons)
      .then((data) => {
        if (cancelled) return;

        setRestored(data);
      })
      .catch(() => {
        // loadDiagram falls back to localStorage and returns null rather than
        // rejecting, so this only fires if it breaks unexpectedly. Leaving
        // isLoading true would strand these modes on a blank screen forever,
        // so fall through to the example instead.
      })
      .finally(() => {
        if (cancelled) return;

        clearTimeout(timeout);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  // Both modes opened fitted to the view before they loaded a saved diagram,
  // so a restored one keeps that too. Read-only mode especially: a viewer who
  // cannot rearrange the canvas should not open off-centre.
  return {
    initialData: { ...(restored ?? initialData), fitToView: true },
    isLoading
  };
};
