import { useEffect, useState } from 'react';
import { InitialData } from 'src/Isoflow';
import { initialData, icons } from './initialData';
import { loadDiagram, readStoredDiagramName } from './persistence';

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

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
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
