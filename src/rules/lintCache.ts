// Single-slot memo over lintDiagram() (P1b, review follow-up of
// review-f544e52e9949c29a). Two components subscribe to lint results
// independently — the ToolMenu badge and the IssuesPanel (both under
// src/components/UiOverlay/UiOverlay.tsx) — and each wraps lintDiagram() in
// its own useMemo (see src/hooks/useIssues.ts). Their useMemo caches are
// per-component, so on every model change both factories still ran the full
// lintDiagram() pass independently, once each.
//
// This module-level cache is keyed on reference equality of `items`/`views`
// (the same array references the model store hands out — they only change
// identity when the model actually changes, see src/stores/modelStore.ts).
// ToolMenu and IssuesPanel are siblings rendered in the same commit, so the
// second call in a render pass hits this cache instead of re-running every
// rule in RULES again.
import { ModelItem, View } from 'src/types';
import { lintDiagram } from './engine';
import { Issue } from './types';

interface LintCacheEntry {
  items: ModelItem[];
  views: View[];
  issues: Issue[];
}

let cache: LintCacheEntry | null = null;

export const getCachedLintDiagram = (
  items: ModelItem[],
  views: View[]
): Issue[] => {
  if (cache !== null && cache.items === items && cache.views === views) {
    return cache.issues;
  }

  const issues = lintDiagram({ items, views });
  cache = { items, views, issues };

  return issues;
};

// Test-only: clears the module-level cache so unrelated test cases don't
// observe a hit/miss left over from another one.
export const resetLintCacheForTests = (): void => {
  cache = null;
};
