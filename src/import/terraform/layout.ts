// Pure nested auto-layout (P3 Terraform import): places every zone as a
// tile-grid rectangle that fully contains its child zones and items, sized
// bottom-up so a parent is always at least as large as what it holds —
// region ⊃ vpc ⊃ az ⊃ subnet ⊃ items, or any other containment chain
// resolve.ts produced. No Isoflow schema types here; see buildModel.ts for
// the final assembly into a Model.
import { Coords } from 'src/types';
import { MappedItem, MappedZone } from './resolve';

export interface ZoneBounds {
  from: Coords;
  to: Coords;
}

export interface TerraformLayoutResult {
  zoneBounds: Map<string, ZoneBounds>;
  itemTiles: Map<string, Coords>;
}

// Tile-grid padding between a zone's own edge and whatever it contains, and
// spacing between siblings laid out in the same row.
const PADDING = 1;
const SPACING = 1;
const ITEM_SIZE = 1;

interface SizedContainer {
  width: number;
  height: number;
  // Offsets are LOCAL to this container's own top-left (0,0) — turned into
  // absolute tile coordinates by the placement pass below.
  childZoneOffsets: Map<string, Coords>;
  itemOffsets: Map<string, Coords>;
}

export const layoutTerraformZones = (
  zones: MappedZone[],
  items: MappedItem[],
  parentId: Map<string, string>
): TerraformLayoutResult => {
  const childZonesOf = new Map<string, string[]>();
  const itemsOf = new Map<string, string[]>();
  const rootZoneIds: string[] = [];
  const rootItemIds: string[] = [];

  zones.forEach((zone) => {
    const parent = parentId.get(zone.id);
    if (!parent) {
      rootZoneIds.push(zone.id);
      return;
    }

    const siblings = childZonesOf.get(parent) ?? [];
    siblings.push(zone.id);
    childZonesOf.set(parent, siblings);
  });

  items.forEach((item) => {
    const parent = parentId.get(item.id);
    if (!parent) {
      rootItemIds.push(item.id);
      return;
    }

    const siblings = itemsOf.get(parent) ?? [];
    siblings.push(item.id);
    itemsOf.set(parent, siblings);
  });

  const sizeOf = new Map<string, SizedContainer>();

  // A single left-to-right row of child zones, then (below it) a single
  // left-to-right row of direct items — either row may be empty. Bottom-up:
  // every child zone's own size must already be in `sizeOf` before this
  // runs for its parent (see the post-order `visit` below).
  const computeSize = (
    childZoneIds: string[],
    itemIds: string[]
  ): SizedContainer => {
    const childZoneOffsets = new Map<string, Coords>();
    const itemOffsets = new Map<string, Coords>();

    let cursorX = PADDING;
    let childRowHeight = 0;

    childZoneIds.forEach((zoneId) => {
      const size = sizeOf.get(zoneId) as SizedContainer;
      childZoneOffsets.set(zoneId, { x: cursorX, y: PADDING });
      cursorX += size.width + SPACING;
      childRowHeight = Math.max(childRowHeight, size.height);
    });
    const childRowWidth =
      childZoneIds.length > 0 ? cursorX - SPACING + PADDING : 0;

    const itemsRowY =
      childZoneIds.length > 0 ? PADDING + childRowHeight + PADDING : PADDING;

    let itemCursorX = PADDING;
    itemIds.forEach((itemId) => {
      itemOffsets.set(itemId, { x: itemCursorX, y: itemsRowY });
      itemCursorX += ITEM_SIZE + SPACING;
    });
    const itemsRowWidth =
      itemIds.length > 0 ? itemCursorX - SPACING + PADDING : 0;

    const width = Math.max(childRowWidth, itemsRowWidth, PADDING * 2 + 1);
    let height: number;
    if (itemIds.length > 0) {
      height = itemsRowY + ITEM_SIZE + PADDING;
    } else if (childZoneIds.length > 0) {
      height = PADDING + childRowHeight + PADDING;
    } else {
      height = PADDING * 2 + 1;
    }

    return { width, height, childZoneOffsets, itemOffsets };
  };

  const visited = new Set<string>();
  const visit = (zoneId: string) => {
    if (visited.has(zoneId)) return;
    visited.add(zoneId);

    (childZonesOf.get(zoneId) ?? []).forEach(visit);

    sizeOf.set(
      zoneId,
      computeSize(childZonesOf.get(zoneId) ?? [], itemsOf.get(zoneId) ?? [])
    );
  };
  zones.forEach((zone) => {
    visit(zone.id);
  });

  const rootSize = computeSize(rootZoneIds, rootItemIds);

  const zoneBounds = new Map<string, ZoneBounds>();
  const itemTiles = new Map<string, Coords>();

  // Pre-order: walks down from the root (origin (0,0)), turning each local
  // offset into an absolute tile position by accumulating the running
  // origin of every ancestor.
  const place = (
    container: SizedContainer,
    originX: number,
    originY: number
  ) => {
    container.childZoneOffsets.forEach((offset, zoneId) => {
      const absX = originX + offset.x;
      const absY = originY + offset.y;
      const childSize = sizeOf.get(zoneId) as SizedContainer;

      zoneBounds.set(zoneId, {
        from: { x: absX, y: absY },
        to: { x: absX + childSize.width - 1, y: absY + childSize.height - 1 }
      });

      place(childSize, absX, absY);
    });

    container.itemOffsets.forEach((offset, itemId) => {
      itemTiles.set(itemId, {
        x: originX + offset.x,
        y: originY + offset.y
      });
    });
  };

  place(rootSize, 0, 0);

  return { zoneBounds, itemTiles };
};
