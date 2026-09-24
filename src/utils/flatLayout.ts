// Deterministic grid layout for the flat "architecture diagram" view (dashed
// containers per logical group, flat icons, read left to right) — an
// entirely separate layout pipeline from the isometric one. Nothing already
// implemented is touched by this module.
//
// Reusing the isometric positions was tried and rejected: grouping the real
// diagram by `environment` makes every one of its 6 group bounding boxes
// overlap, and by `kind` 6 of 21 still do. The isometric layout was chosen
// to make the FLOW read well, which is a different objective from keeping
// same-group nodes spatially cohesive, so this view computes its own
// positions instead of reusing them.
//
// This is NOT general auto-layout: no force simulation, no crossing
// minimisation, nothing iterative or random. It is a deterministic grid —
// same input, same output, every time — which is the whole point: an
// architect only has to learn the reading order once.

export interface FlatLayoutItem {
  id: string;
  x: number;
  y: number;
}

export interface FlatLayoutGroup {
  // null marks the trailing column of items that declare no group. It is
  // not a group — the renderer uses this to decide whether to draw the
  // dashed container around the column.
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  items: FlatLayoutItem[];
}

export interface FlatLayout {
  groups: FlatLayoutGroup[];
  width: number;
  height: number;
}

export interface FlatLayoutOptions {
  groupOrder?: string[];
  itemsPerColumn?: number;
}

// The function deliberately takes this minimal shape rather than ModelItem:
// it has no business knowing about the rest of the model, which keeps it
// independent of wherever the `group` field lands in the schema.
interface FlatLayoutInputItem {
  id: string;
  group?: string;
}

// Geometry constants. Plain unitless numbers — the renderer scales them into
// whatever coordinate space it draws in. Deliberately independent of
// UNPROJECTED_TILE_SIZE or anything else from the isometric pipeline.
export const FLAT_LAYOUT_ITEM_WIDTH = 120;
export const FLAT_LAYOUT_ITEM_HEIGHT = 80;
// Vertical gap between two items stacked in the same (sub-)column.
export const FLAT_LAYOUT_ITEM_GAP = 24;
// Horizontal gap between two sub-columns of the same group, once wrapping
// kicks in.
export const FLAT_LAYOUT_SUBCOLUMN_GAP = 24;
// Horizontal gap between two different groups' columns.
export const FLAT_LAYOUT_COLUMN_GAP = 80;
// Padding between a group's dashed border and the items it encloses.
export const FLAT_LAYOUT_CONTAINER_PADDING = 32;

// Default items-per-column before a column wraps into a new sub-column of
// the same group. 8 keeps a full column's content height around
// 8 * 80 + 7 * 24 = 808 units before padding — tall enough that most real
// groups fit in a single column, short enough to stay readable without the
// column itself needing to scroll in a typical viewport.
const DEFAULT_ITEMS_PER_COLUMN = 8;

// Column order: `groupOrder` names first (skipping any name nothing uses),
// then every group not named in `groupOrder`, in first-appearance order.
// Without `groupOrder`, first-appearance order decides everything.
const resolveColumnOrder = (
  items: FlatLayoutInputItem[],
  groupOrder: string[] | undefined
): string[] => {
  const firstAppearance: string[] = [];
  const seenNames = new Set<string>();

  items.forEach((item) => {
    if (item.group === undefined) return;
    if (seenNames.has(item.group)) return;

    seenNames.add(item.group);
    firstAppearance.push(item.group);
  });

  if (!groupOrder) return firstAppearance;

  const usedNames = new Set(firstAppearance);
  const placedNames = new Set<string>();
  const ordered: string[] = [];

  groupOrder.forEach((name) => {
    if (!usedNames.has(name)) return;
    if (placedNames.has(name)) return;

    placedNames.add(name);
    ordered.push(name);
  });

  firstAppearance.forEach((name) => {
    if (placedNames.has(name)) return;

    placedNames.add(name);
    ordered.push(name);
  });

  return ordered;
};

// Splits an ordered item list into itemsPerColumn-sized chunks, each chunk
// becoming one sub-column of the same group once the group wraps.
const chunkItems = (
  groupItems: FlatLayoutInputItem[],
  itemsPerColumn: number
): FlatLayoutInputItem[][] => {
  const chunks: FlatLayoutInputItem[][] = [];

  for (let start = 0; start < groupItems.length; start += itemsPerColumn) {
    chunks.push(groupItems.slice(start, start + itemsPerColumn));
  }

  return chunks;
};

// Builds one group's column (or set of wrapped sub-columns) starting at
// `x`. Every group is top-aligned at y: 0 — the overall layout height is
// just the tallest group's height, not a running vertical offset.
const buildGroup = (
  name: string | null,
  groupItems: FlatLayoutInputItem[],
  x: number,
  itemsPerColumn: number
): FlatLayoutGroup => {
  const subColumns = chunkItems(groupItems, itemsPerColumn);

  const tallestSubColumnLength = subColumns.reduce((max, subColumn) => {
    return Math.max(max, subColumn.length);
  }, 0);

  const contentWidth =
    subColumns.length * FLAT_LAYOUT_ITEM_WIDTH +
    (subColumns.length - 1) * FLAT_LAYOUT_SUBCOLUMN_GAP;

  const contentHeight =
    tallestSubColumnLength * FLAT_LAYOUT_ITEM_HEIGHT +
    (tallestSubColumnLength - 1) * FLAT_LAYOUT_ITEM_GAP;

  const width = contentWidth + FLAT_LAYOUT_CONTAINER_PADDING * 2;
  const height = contentHeight + FLAT_LAYOUT_CONTAINER_PADDING * 2;

  const items: FlatLayoutItem[] = [];

  subColumns.forEach((subColumn, subColumnIndex) => {
    subColumn.forEach((item, itemIndex) => {
      items.push({
        id: item.id,
        x:
          x +
          FLAT_LAYOUT_CONTAINER_PADDING +
          subColumnIndex * (FLAT_LAYOUT_ITEM_WIDTH + FLAT_LAYOUT_SUBCOLUMN_GAP),
        y:
          FLAT_LAYOUT_CONTAINER_PADDING +
          itemIndex * (FLAT_LAYOUT_ITEM_HEIGHT + FLAT_LAYOUT_ITEM_GAP)
      });
    });
  });

  return { name, x, y: 0, width, height, items };
};

// Builds a deterministic left-to-right grid layout for the flat architecture
// diagram: one column per group, items stacked top to bottom within their
// group (wrapping into a new sub-column of the same group once
// itemsPerColumn is exceeded), and a trailing name: null column for items
// that declare no group. Calling this twice with the same input always
// produces deeply equal output, and neither `items` nor its objects are
// mutated.
export const buildFlatLayout = (
  items: { id: string; group?: string }[],
  options?: FlatLayoutOptions
): FlatLayout => {
  const itemsPerColumn = options?.itemsPerColumn ?? DEFAULT_ITEMS_PER_COLUMN;
  const columnOrder = resolveColumnOrder(items, options?.groupOrder);

  const ungroupedItems = items.filter((item) => {
    return item.group === undefined;
  });

  const groups: FlatLayoutGroup[] = [];
  let cursorX = 0;

  columnOrder.forEach((name) => {
    const groupItems = items.filter((item) => {
      return item.group === name;
    });

    const group = buildGroup(name, groupItems, cursorX, itemsPerColumn);
    groups.push(group);
    cursorX += group.width + FLAT_LAYOUT_COLUMN_GAP;
  });

  if (ungroupedItems.length > 0) {
    const group = buildGroup(null, ungroupedItems, cursorX, itemsPerColumn);
    groups.push(group);
  }

  if (groups.length === 0) {
    return { groups: [], width: 0, height: 0 };
  }

  const width = groups.reduce((max, group) => {
    return Math.max(max, group.x + group.width);
  }, 0);

  const height = groups.reduce((max, group) => {
    return Math.max(max, group.y + group.height);
  }, 0);

  return { groups, width, height };
};
