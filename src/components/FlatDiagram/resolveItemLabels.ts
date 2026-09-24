// Turns each item's raw model `name` into a display label that is always
// readable and never collides with another item's label in the same flat
// diagram.
//
// Two cases the real data already exercises (see the task this file was
// built for): several items literally named "Untitled", and items with no
// name at all. Both are treated as the same problem: a blank/whitespace-only
// name falls back to the literal string "Untitled" *before* dedup runs, so
// a nameless item and an item someone actually typed "Untitled" into are
// indistinguishable to a viewer either way, and get the same numbering
// treatment.
//
// Any label (real or fallen-back) that occurs more than once in the given
// item list gets a stable "(n)" suffix, numbered in the order the items are
// passed in. Callers pass items already in the flat layout's left-to-right,
// top-to-bottom reading order, so "(1)", "(2)", ... reads the same order a
// viewer scans the diagram in. A label that is already unique is left
// exactly as the author wrote it — no noise for the common case.
export const resolveItemLabels = (
  items: { id: string; name: string }[]
): Map<string, string> => {
  const baseNameById = new Map<string, string>();
  const occurrences = new Map<string, number>();

  items.forEach(({ id, name }) => {
    const trimmed = name.trim();
    const base = trimmed.length > 0 ? trimmed : 'Untitled';

    baseNameById.set(id, base);
    occurrences.set(base, (occurrences.get(base) ?? 0) + 1);
  });

  const seenSoFar = new Map<string, number>();
  const labelById = new Map<string, string>();

  items.forEach(({ id }) => {
    const base = baseNameById.get(id) as string;
    const totalOccurrences = occurrences.get(base) ?? 0;

    if (totalOccurrences <= 1) {
      labelById.set(id, base);
      return;
    }

    const instanceNumber = (seenSoFar.get(base) ?? 0) + 1;
    seenSoFar.set(base, instanceNumber);
    labelById.set(id, `${base} (${instanceNumber})`);
  });

  return labelById;
};
