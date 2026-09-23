import { useEffect, useState } from 'react';
import { InitialData } from 'src/Isoflow';
import { initialData, icons } from './initialData';
import {
  loadDiagram,
  loadLocalDiagram,
  readStoredDiagramName
} from './persistence';

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
    const name = readStoredDiagramName();

    // A request that never settles would leave these modes blank for good,
    // which the catch below cannot cover: a hung fetch neither resolves nor
    // rejects. Giving up after a bounded wait shows the example instead of
    // nothing. Safe to do here because neither mode saves, so mounting the
    // example cannot overwrite anything.
    //
    // Giving up has to abandon the result too, not just the wait: Isoflow
    // reads initialData once, at mount. Once the timeout mounts the example,
    // a late resolution can no longer be shown — it would only hand a
    // different object to an already-mounted canvas. So mark the run
    // cancelled here and let the late diagram go.
    const timeout = setTimeout(() => {
      if (cancelled) return;

      cancelled = true;

      // The endpoint never answered, so loadDiagram()'s own localStorage
      // fallback can never run — that fallback only fires once its fetch
      // settles, and a hung request neither resolves nor rejects. Reach for
      // the local copy directly here instead, so a slow or dead dev server
      // does not make the user's own diagram look lost. setRestored(null)
      // is safe: the hook falls back to the bundled example below.
      setRestored(loadLocalDiagram(name, icons));
      setIsLoading(false);
    }, LOAD_TIMEOUT_MS);

    loadDiagram(name, icons)
      .then((data) => {
        if (cancelled) return;

        setRestored(data);
      })
      .catch(() => {
        if (cancelled) return;

        // loadDiagram falls back to localStorage and returns null rather than
        // rejecting, so this only fires if it breaks unexpectedly — possibly
        // before it ever reached that fallback. So try the local copy here
        // for the same reason the timeout does: a broken endpoint should not
        // make the user's own diagram look lost. Reading it is synchronous
        // and cannot throw, so the finally below still clears isLoading.
        setRestored(loadLocalDiagram(name, icons));
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
