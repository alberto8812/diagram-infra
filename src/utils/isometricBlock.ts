// Pure, React/DOM-free geometry for the isometric "block" a non-isometric
// (flat) icon is extruded onto (T6 — see IconTypes/IsometricBlockIcon.tsx).
//
// Coordinates are relative to the node's own anchor point, the same origin
// `Node.tsx` positions the icon at (the tile's near/bottom vertex, see
// `getTilePosition({ origin: 'BOTTOM' })` in src/utils/renderer.ts). Screen
// "up" is negative y, matching that same convention.
//
// `footprint` is the block's top-face diamond, sized the same as a
// projected tile (see PROJECTED_TILE_SIZE in src/config.ts) so the block
// fills the tile it stands on: `near` (front-bottom vertex, at the anchor),
// `right`/`left` (the two side vertices, half the footprint height above
// the anchor) and `far` (the back vertex, a full footprint height above).
// Extruding by `extrudeHeight` raises a copy of the diamond by that amount
// to form the lid, and the three raised/un-raised vertex pairs (excluding
// the hidden `far` corner) form the two visible side faces.
import { Coords, Size } from 'src/types';

export interface IsometricCuboidFaces {
  top: Coords[];
  left: Coords[];
  right: Coords[];
}

export const getIsometricCuboidFaces = (
  footprint: Size,
  extrudeHeight: number
): IsometricCuboidFaces => {
  const halfW = footprint.width / 2;
  const halfH = footprint.height / 2;

  const near: Coords = { x: 0, y: 0 };
  const right: Coords = { x: halfW, y: -halfH };
  const far: Coords = { x: 0, y: -footprint.height };
  const left: Coords = { x: -halfW, y: -halfH };

  const raise = (point: Coords): Coords => {
    return { x: point.x, y: point.y - extrudeHeight };
  };

  return {
    top: [raise(far), raise(right), raise(near), raise(left)],
    left: [left, near, raise(near), raise(left)],
    right: [right, near, raise(near), raise(right)]
  };
};

// SVG <polygon points="..."> expects "x,y x,y ..." — kept as a small pure
// helper so IsometricBlockIcon stays a thin render of already-tested data.
export const toSvgPoints = (points: Coords[]): string => {
  return points
    .map(({ x, y }) => {
      return `${x},${y}`;
    })
    .join(' ');
};
