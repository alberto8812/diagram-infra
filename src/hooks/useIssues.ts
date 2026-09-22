import { useMemo } from 'react';
import { useModelStore } from 'src/stores/modelStore';
import { Issue } from 'src/rules';
import { getCachedLintDiagram } from 'src/rules/lintCache';

// Subscribes to `items` and `views` individually (never `state => state`,
// a fresh object on every store update — see the ViewSwitcher fix this
// mirrors, src/components/ViewSwitcher/ViewSwitcher.tsx) so this hook only
// recomputes/re-renders when the model actually changes in a way that can
// affect lint results, not on unrelated ui/scene churn.
//
// Both ToolMenu (always mounted) and IssuesPanel call this hook, so every
// model change would otherwise run the full lintDiagram() pass twice in the
// same commit. getCachedLintDiagram (src/rules/lintCache.ts) shares that
// single computation between them via a module-level cache keyed on the
// same items/views references.
export const useIssues = (): Issue[] => {
  const items = useModelStore((state) => {
    return state.items;
  });
  const views = useModelStore((state) => {
    return state.views;
  });

  return useMemo(() => {
    return getCachedLintDiagram(items, views);
  }, [items, views]);
};
