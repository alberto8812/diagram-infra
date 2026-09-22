import { useMemo } from 'react';
import { useModelStore } from 'src/stores/modelStore';
import { Issue, lintDiagram } from 'src/rules';

// Subscribes to `items` and `views` individually (never `state => state`,
// a fresh object on every store update — see the ViewSwitcher fix this
// mirrors, src/components/ViewSwitcher/ViewSwitcher.tsx) so this hook only
// recomputes/re-renders when the model actually changes in a way that can
// affect lint results, not on unrelated ui/scene churn.
export const useIssues = (): Issue[] => {
  const items = useModelStore((state) => {
    return state.items;
  });
  const views = useModelStore((state) => {
    return state.views;
  });

  return useMemo(() => {
    return lintDiagram({ items, views });
  }, [items, views]);
};
