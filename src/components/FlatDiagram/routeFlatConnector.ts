// Orthogonal (right-angle-only) routing between two laid-out flat-diagram
// items, replacing a straight centre-to-centre diagonal — see the task this
// file was built for: a diagonal line crosses the whole diagram and runs
// straight through unrelated icons, which this avoids by leaving from and
// arriving at an item EDGE (never the centre) and only ever moving
// horizontally or vertically.
//
// This is deliberately simple "L/Z" manhattan routing, not a general
// obstacle-avoiding router: it picks one dominant axis (whichever of dx/dy
// is larger) to decide which pair of edges faces the other item, exits/
// enters through the edge midpoint on that axis, and bends once through a
// midpoint on the other axis when the two items aren't already aligned. Two
// items sharing a centre coordinate on the dominant axis get a single
// straight run instead of a needless bend.

export interface FlatConnectorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FlatConnectorPoint = { x: number; y: number };

const center = (box: FlatConnectorBox): FlatConnectorPoint => {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// Builds the orthogonal path between two boxes' edges for one axis pair.
// `primary`/`secondary` name the coordinate that drives edge selection
// (e.g. "x" when routing left/right-facing edges) versus the one used only
// for the exit/entry height along that edge (e.g. "y"). Kept generic so the
// same logic serves both the horizontal-primary and vertical-primary cases
// below without duplicating the branching.
const buildPath = (
  fromBox: FlatConnectorBox,
  toBox: FlatConnectorBox,
  primaryAxis: 'x' | 'y'
): FlatConnectorPoint[] => {
  const secondaryAxis = primaryAxis === 'x' ? 'y' : 'x';
  const fromCenter = center(fromBox);
  const toCenter = center(toBox);

  const fromLow = fromBox[primaryAxis];
  const fromHigh =
    fromBox[primaryAxis] +
    (primaryAxis === 'x' ? fromBox.width : fromBox.height);
  const toLow = toBox[primaryAxis];
  const toHigh =
    toBox[primaryAxis] + (primaryAxis === 'x' ? toBox.width : toBox.height);

  // `to` sits at-or-after `from` on the primary axis: exit through the
  // "high" edge (right/bottom) and enter through the other box's "low"
  // edge (left/top). Otherwise it's the mirror image.
  const toIsAhead = toCenter[primaryAxis] >= fromCenter[primaryAxis];

  const exitPrimary = toIsAhead ? fromHigh : fromLow;
  const entryPrimary = toIsAhead ? toLow : toHigh;

  const exit: FlatConnectorPoint = {
    [primaryAxis]: exitPrimary,
    [secondaryAxis]: fromCenter[secondaryAxis]
  } as FlatConnectorPoint;

  const entry: FlatConnectorPoint = {
    [primaryAxis]: entryPrimary,
    [secondaryAxis]: toCenter[secondaryAxis]
  } as FlatConnectorPoint;

  // Already aligned on the secondary axis: a single straight run, no bend.
  if (exit[secondaryAxis] === entry[secondaryAxis]) {
    return [exit, entry];
  }

  // Otherwise bend once, at the midpoint between the two edges on the
  // primary axis — a sensible, deterministic elbow between the boxes.
  const bendPrimary = (exitPrimary + entryPrimary) / 2;

  const bendNearExit: FlatConnectorPoint = {
    [primaryAxis]: bendPrimary,
    [secondaryAxis]: exit[secondaryAxis]
  } as FlatConnectorPoint;

  const bendNearEntry: FlatConnectorPoint = {
    [primaryAxis]: bendPrimary,
    [secondaryAxis]: entry[secondaryAxis]
  } as FlatConnectorPoint;

  return [exit, bendNearExit, bendNearEntry, entry];
};

// Returns an orthogonal (horizontal/vertical segments only) polyline from
// `from`'s edge to `to`'s edge, choosing whichever pair of facing edges
// (left/right or top/bottom) matches the two boxes' dominant separation
// axis. Pure and deterministic: neither box is mutated, and calling this
// twice with the same input always returns deeply equal output.
export const routeFlatConnector = (
  from: FlatConnectorBox,
  to: FlatConnectorBox
): FlatConnectorPoint[] => {
  const fromCenter = center(from);
  const toCenter = center(to);

  const dx = Math.abs(toCenter.x - fromCenter.x);
  const dy = Math.abs(toCenter.y - fromCenter.y);

  const primaryAxis = dx >= dy ? 'x' : 'y';

  return buildPath(from, to, primaryAxis);
};
