import { useEffect, useRef, useState } from 'react';
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

  // Guards against an unmount (or, in principle, a re-run) racing the load:
  // only apply the result while this effect instance is still current.
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    loadDiagram(readStoredDiagramName(), icons).then((data) => {
      if (cancelledRef.current) return;

      setRestored(data);
      setIsLoading(false);
    });

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return {
    initialData: restored ?? { ...initialData, fitToView: true },
    isLoading
  };
};
