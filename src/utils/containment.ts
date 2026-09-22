// Pure, React-free geometric containment helpers (P0). A rectangle becomes a
// typed "zone" only when its `zone` field is set (src/schemas/rectangle.ts);
// a plain rectangle stays decoration and is ignored by every helper here. A
// node belongs to every zone whose tile area contains the node's tile
// (inclusive of the zone's edge tiles, matching the grid math
// src/hooks/useIsoProjection.ts already uses to size a rectangle). All of
// this is computed per view: containment never crosses view boundaries.
import {
  Coords,
  View,
  ViewItem,
  Connector,
  Rectangle,
  ZoneKind
} from 'src/types';
import { getAnchorTile } from './renderer';

export type ZoneRectangle = Rectangle & { zone: ZoneKind };

export interface RectangleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ZoneCrossing {
  entered: ZoneRectangle[];
  left: ZoneRectangle[];
}

export interface ZoneOverlap {
  a: ZoneRectangle;
  b: ZoneRectangle;
}

export interface ZoneTreeNode {
  zone: ZoneRectangle;
  children: ZoneTreeNode[];
}

// Normalises a rectangle's `from`/`to` corners (which may be given in any
// corner order — e.g. `from` bottom-right of `to`) into an axis-aligned
// {minX, minY, maxX, maxY} box.
export const normalizeRectangleBounds = (
  rectangle: Pick<Rectangle, 'from' | 'to'>
): RectangleBounds => {
  return {
    minX: Math.min(rectangle.from.x, rectangle.to.x),
    maxX: Math.max(rectangle.from.x, rectangle.to.x),
    minY: Math.min(rectangle.from.y, rectangle.to.y),
    maxY: Math.max(rectangle.from.y, rectangle.to.y)
  };
};

// Tile-inclusive area, matching useIsoProjection's gridSize math (+1 on each
// axis so a rectangle spanning a single tile has area 1, not 0).
const boundsArea = (bounds: RectangleBounds): number => {
  return (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1);
};

const tileInBounds = (tile: Coords, bounds: RectangleBounds): boolean => {
  return (
    tile.x >= bounds.minX &&
    tile.x <= bounds.maxX &&
    tile.y >= bounds.minY &&
    tile.y <= bounds.maxY
  );
};

// Whether `outer` fully contains `inner` (inclusive on all edges — a zone
// contains another zone whose bounds exactly match its own).
const boundsFullyContain = (
  outer: RectangleBounds,
  inner: RectangleBounds
): boolean => {
  return (
    outer.minX <= inner.minX &&
    outer.maxX >= inner.maxX &&
    outer.minY <= inner.minY &&
    outer.maxY >= inner.maxY
  );
};

const boundsIntersect = (a: RectangleBounds, b: RectangleBounds): boolean => {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
  );
};

const isZoneRectangle = (rectangle: Rectangle): rectangle is ZoneRectangle => {
  return rectangle.zone !== undefined;
};

// Smallest area first (innermost), stable tie-break by id so equal-area
// zones always sort the same way regardless of input order.
const sortByAreaThenId = (a: Rectangle, b: Rectangle): number => {
  const areaA = boundsArea(normalizeRectangleBounds(a));
  const areaB = boundsArea(normalizeRectangleBounds(b));

  if (areaA !== areaB) return areaA - areaB;

  return a.id.localeCompare(b.id);
};

// Only rectangles with `zone` set count as zones — plain (decoration-only)
// rectangles are excluded here so every helper below ignores them.
export const getZoneRectangles = (view: View): ZoneRectangle[] => {
  return (view.rectangles ?? []).filter(isZoneRectangle);
};

// Zones (of this view) whose area contains `tile`, ordered innermost
// (smallest area) to outermost.
export const getZonesForTile = (view: View, tile: Coords): ZoneRectangle[] => {
  return getZoneRectangles(view)
    .filter((zone) => {
      return tileInBounds(tile, normalizeRectangleBounds(zone));
    })
    .sort(sortByAreaThenId);
};

// Zones containing a view item's tile, innermost to outermost. Returns an
// empty array when the item isn't in this view.
export const getItemZones = (view: View, itemId: string): ZoneRectangle[] => {
  const item = view.items.find((viewItem) => {
    return viewItem.id === itemId;
  });

  if (!item) return [];

  return getZonesForTile(view, item.tile);
};

// The immediate containing zone (smallest zone that fully contains this
// zone, excluding itself), or undefined when the zone is a root.
//
// Uses the same total order as getZonesForTile/getItemZones (area
// ascending, then id — see sortByAreaThenId) and walks forward from the
// target's own position in that order, returning the first zone that fully
// contains it. Equal-area containment only holds between identical bounds
// (a smaller-or-equal-area zone can only fully contain another by being
// exactly the same rectangle), so this makes N identical-bounds zones chain
// in that single order — each one's parent is the next zone outward —
// instead of every zone independently picking the same one "outermost"
// sibling via two tie-breaks that disagreed on which id was inner and which
// was outer.
export const getZoneParent = (
  view: View,
  zoneId: string
): ZoneRectangle | undefined => {
  const orderedZones = [...getZoneRectangles(view)].sort(sortByAreaThenId);
  const targetIndex = orderedZones.findIndex((zone) => {
    return zone.id === zoneId;
  });

  if (targetIndex === -1) return undefined;

  const targetBounds = normalizeRectangleBounds(orderedZones[targetIndex]);

  for (let i = targetIndex + 1; i < orderedZones.length; i += 1) {
    const candidate = orderedZones[i];

    if (boundsFullyContain(normalizeRectangleBounds(candidate), targetBounds)) {
      return candidate;
    }
  }

  return undefined;
};

// The full zone hierarchy for a view, built from geometric containment.
// Root nodes are zones with no containing zone.
export const buildZoneTree = (view: View): ZoneTreeNode[] => {
  const zones = getZoneRectangles(view);
  const childrenByParentId = new Map<string, ZoneRectangle[]>();
  const roots: ZoneRectangle[] = [];

  zones.forEach((zone) => {
    const parent = getZoneParent(view, zone.id);

    if (!parent) {
      roots.push(zone);
      return;
    }

    const siblings = childrenByParentId.get(parent.id) ?? [];
    siblings.push(zone);
    childrenByParentId.set(parent.id, siblings);
  });

  const buildNode = (zone: ZoneRectangle): ZoneTreeNode => {
    const children = (childrenByParentId.get(zone.id) ?? []).sort(
      sortByAreaThenId
    );

    return { zone, children: children.map(buildNode) };
  };

  return [...roots].sort(sortByAreaThenId).map(buildNode);
};

// Zone pairs whose bounds intersect without one fully containing the other
// — the schema allows this (a rectangle's bounds are unconstrained), so
// these are reported here for a rule (P1) rather than rejected at parse
// time. Each pair is reported once, ordered a.id < b.id.
export const findPartialZoneOverlaps = (view: View): ZoneOverlap[] => {
  const zones = [...getZoneRectangles(view)].sort((a, b) => {
    return a.id.localeCompare(b.id);
  });

  const overlaps: ZoneOverlap[] = [];

  zones.forEach((a, i) => {
    const boundsA = normalizeRectangleBounds(a);

    zones.slice(i + 1).forEach((b) => {
      const boundsB = normalizeRectangleBounds(b);
      const isPartialOverlap =
        boundsIntersect(boundsA, boundsB) &&
        !boundsFullyContain(boundsA, boundsB) &&
        !boundsFullyContain(boundsB, boundsA);

      if (isPartialOverlap) {
        overlaps.push({ a, b });
      }
    });
  });

  return overlaps;
};

// View items whose tile falls within a zone's bounds.
export const getItemsInZone = (view: View, zoneId: string): ViewItem[] => {
  const zone = getZoneRectangles(view).find((z) => {
    return z.id === zoneId;
  });

  if (!zone) return [];

  const bounds = normalizeRectangleBounds(zone);

  return view.items.filter((item) => {
    return tileInBounds(item.tile, bounds);
  });
};

// Zones entered/left crossing from a connector's first endpoint to its last
// endpoint. An anchor may resolve to an item's tile, a chained anchor, or a
// free-floating tile (see anchorSchema, src/schemas/connector.ts) —
// getAnchorTile (src/utils/renderer.ts) already resolves all three per view,
// so it's reused here instead of re-implementing anchor resolution.
export const crossesZoneBoundary = (
  view: View,
  connector: Pick<Connector, 'anchors'>
): ZoneCrossing => {
  if (connector.anchors.length < 2) {
    return { entered: [], left: [] };
  }

  const fromAnchor = connector.anchors[0];
  const toAnchor = connector.anchors[connector.anchors.length - 1];

  let fromTile: Coords;
  let toTile: Coords;

  try {
    fromTile = getAnchorTile(fromAnchor, view);
    toTile = getAnchorTile(toAnchor, view);
  } catch {
    // An anchor that can't be resolved (e.g. a dangling ref) crosses no
    // zone boundary rather than throwing out of a pure query helper.
    return { entered: [], left: [] };
  }

  const fromZones = getZonesForTile(view, fromTile);
  const toZones = getZonesForTile(view, toTile);

  const fromIds = new Set(
    fromZones.map((zone) => {
      return zone.id;
    })
  );
  const toIds = new Set(
    toZones.map((zone) => {
      return zone.id;
    })
  );

  const entered = toZones.filter((zone) => {
    return !fromIds.has(zone.id);
  });
  const left = fromZones.filter((zone) => {
    return !toIds.has(zone.id);
  });

  return { entered, left };
};
