// Derives each item's flat-diagram group from the named rectangles drawn on
// the canvas, instead of relying on the model's `group` field (which nobody
// fills in in practice — see the task this file was built for).
//
// Real diagram data already expresses grouping this way: rectangles like
// "VPC interna (AWS)", "GitHub (SaaS)", "LOCAL" and "Subnet privada - datos"
// are drawn around the items that belong together. This module reads that
// intent geometrically: an item belongs to the smallest named rectangle
// whose area contains its tile.
//
// Deliberately independent of src/utils/containment.ts's zone helpers: those
// only treat a rectangle as meaningful when its `zone` field is set, and
// exist to answer different questions (zone hierarchy, crossing detection).
// Here, only `name` matters — any named rectangle is a candidate group,
// whether or not it is also a typed zone.

interface GroupableViewItem {
  id: string;
  tile: { x: number; y: number };
}

interface GroupableRectangle {
  name?: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface NormalizedRectangle {
  name: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// A rectangle's area in tile-inclusive units (matches the +1 convention
// used elsewhere in this codebase for tile-bounded boxes — a rectangle
// spanning a single tile has area 1, not 0), used only to rank candidates
// by size; the exact unit convention doesn't matter for that ordering.
const area = (rect: NormalizedRectangle): number => {
  return (rect.maxX - rect.minX + 1) * (rect.maxY - rect.minY + 1);
};

const containsTile = (
  rect: NormalizedRectangle,
  tile: { x: number; y: number }
): boolean => {
  return (
    tile.x >= rect.minX &&
    tile.x <= rect.maxX &&
    tile.y >= rect.minY &&
    tile.y <= rect.maxY
  );
};

// Maps each item id to the name of the smallest named rectangle containing
// its tile. `from`/`to` may give a rectangle's corners in any order (the
// real data has at least one rectangle running high-to-low on an axis), so
// each rectangle is normalized with min/max before anything else runs. An
// unnamed rectangle is skipped entirely — it is decoration, not a group.
// An item that falls inside no named rectangle gets no entry in the result.
// Pure and deterministic: neither `viewItems` nor `rectangles` (nor their
// elements) is mutated.
export const resolveItemGroups = (
  viewItems: GroupableViewItem[],
  rectangles: GroupableRectangle[]
): Record<string, string> => {
  const namedRectangles: NormalizedRectangle[] = rectangles.reduce<
    NormalizedRectangle[]
  >((acc, rectangle) => {
    if (!rectangle.name) return acc;

    acc.push({
      name: rectangle.name,
      minX: Math.min(rectangle.from.x, rectangle.to.x),
      maxX: Math.max(rectangle.from.x, rectangle.to.x),
      minY: Math.min(rectangle.from.y, rectangle.to.y),
      maxY: Math.max(rectangle.from.y, rectangle.to.y)
    });

    return acc;
  }, []);

  const groupById: Record<string, string> = {};

  viewItems.forEach((viewItem) => {
    let smallest: NormalizedRectangle | undefined;

    namedRectangles.forEach((rectangle) => {
      if (!containsTile(rectangle, viewItem.tile)) return;
      if (smallest && area(rectangle) >= area(smallest)) return;

      smallest = rectangle;
    });

    if (smallest) {
      groupById[viewItem.id] = smallest.name;
    }
  });

  return groupById;
};
