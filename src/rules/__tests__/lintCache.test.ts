import { ModelItem, View } from 'src/types';
import { getCachedLintDiagram, resetLintCacheForTests } from '../lintCache';

const items: ModelItem[] = [];
const views: View[] = [];

describe('getCachedLintDiagram()', () => {
  beforeEach(() => {
    resetLintCacheForTests();
  });

  test('returns the same array reference for repeated calls with the same items/views references', () => {
    const first = getCachedLintDiagram(items, views);
    const second = getCachedLintDiagram(items, views);

    expect(second).toBe(first);
  });

  test('recomputes (new reference, same content) when the items reference changes', () => {
    const first = getCachedLintDiagram(items, views);
    const second = getCachedLintDiagram([...items], views);

    expect(second).not.toBe(first);
    expect(second).toStrictEqual(first);
  });

  test('recomputes (new reference, same content) when the views reference changes', () => {
    const first = getCachedLintDiagram(items, views);
    const second = getCachedLintDiagram(items, [...views]);

    expect(second).not.toBe(first);
    expect(second).toStrictEqual(first);
  });

  test('is a single-slot cache: a call for a different pair evicts the previous entry', () => {
    const itemsB: ModelItem[] = [];
    const viewsB: View[] = [];

    const a1 = getCachedLintDiagram(items, views);
    getCachedLintDiagram(itemsB, viewsB);
    const a2 = getCachedLintDiagram(items, views);

    expect(a2).not.toBe(a1);
    expect(a2).toStrictEqual(a1);
  });
});
