// Pure, React/DOM-free geometry helpers for the flow playback packet
// (src/components/SceneLayers/Connectors/ConnectorPacket.tsx) and its
// destination-node resolution for the pulse effect. Kept separate from
// flowPlayback.ts (playback lifecycle) since this is purely spatial math.
import {
  Coords,
  ConnectorAnchor,
  FlowStepDirection,
  FlowStepOutcome
} from 'src/types';

export interface PacketPalette {
  request: string;
  response: string;
  failure: string;
}

// Which colour a packet travels in. A failed step reads as a failure first:
// `outcome` overrides `direction`, because a failed RESPONSE is a failure,
// not an ordinary reply. SUCCESS is the default appearance and changes
// nothing, so marking a step SUCCESS looks the same as leaving it unmarked.
//
// The caller supplies the three colours rather than this module reaching for
// a theme, so the rule stays pure and testable without a DOM.
export const getPacketColor = (
  direction: FlowStepDirection,
  outcome: FlowStepOutcome | undefined,
  palette: PacketPalette
): string => {
  if (outcome === 'FAILURE') return palette.failure;

  return direction === 'RESPONSE' ? palette.response : palette.request;
};

// A connector's tiles are stored start -> end. A REQUEST step travels that
// same order; a RESPONSE step travels it in reverse (end -> start).
export const getPacketPathPoints = (
  tiles: Coords[],
  direction: FlowStepDirection
): Coords[] => {
  if (direction === 'RESPONSE') {
    return [...tiles].reverse();
  }

  return tiles;
};

const getSegmentLength = (from: Coords, to: Coords) => {
  return Math.hypot(to.x - from.x, to.y - from.y);
};

// Total length of the polyline described by `points`, summing each segment.
// Used as the pure fallback when SVGGeometryElement.getTotalLength() is not
// available (e.g. jsdom in tests).
export const getPolylineLength = (points: Coords[]): number => {
  if (points.length < 2) return 0;

  return points.slice(1).reduce((total, point, i) => {
    return total + getSegmentLength(points[i], point);
  }, 0);
};

// Point at normalised progress [0, 1] along the polyline described by
// `points`. Pure fallback for SVGGeometryElement.getPointAtLength().
export const getPointAtProgress = (
  points: Coords[],
  progress: number
): Coords => {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const totalLength = getPolylineLength(points);

  if (totalLength === 0) return points[0];

  const targetLength = clampedProgress * totalLength;

  let coveredLength = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    const segmentLength = getSegmentLength(from, to);

    if (segmentLength > 0 && coveredLength + segmentLength >= targetLength) {
      const segmentProgress = (targetLength - coveredLength) / segmentLength;

      return {
        x: from.x + (to.x - from.x) * segmentProgress,
        y: from.y + (to.y - from.y) * segmentProgress
      };
    }

    coveredLength += segmentLength;
  }

  return points[points.length - 1];
};

// Resolves the item id (view item, i.e. node) that should pulse when a
// packet arrives: the connector's end anchor for a REQUEST step, its start
// anchor for a RESPONSE step. Anchors that reference a tile or another
// anchor (rather than an item) have no node to pulse.
export const getPacketDestinationItemId = (
  anchors: ConnectorAnchor[],
  direction: FlowStepDirection
): string | null => {
  if (anchors.length === 0) return null;

  const anchor =
    direction === 'RESPONSE' ? anchors[0] : anchors[anchors.length - 1];

  return anchor.ref.item ?? null;
};
