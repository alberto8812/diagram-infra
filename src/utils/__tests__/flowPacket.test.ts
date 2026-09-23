import { ConnectorAnchor, Coords } from 'src/types';
import {
  getPacketPathPoints,
  getPolylineLength,
  getPointAtProgress,
  getPacketDestinationItemId,
  getPacketColor
} from '../flowPacket';

const straightLine: Coords[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 }
];

const bentLine: Coords[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 }
];

describe('getPacketPathPoints() works correctly', () => {
  test('REQUEST keeps the tiles in their stored (start -> end) order', () => {
    expect(getPacketPathPoints(straightLine, 'REQUEST')).toStrictEqual(
      straightLine
    );
  });

  test('RESPONSE reverses the tile order (end -> start)', () => {
    expect(getPacketPathPoints(straightLine, 'RESPONSE')).toStrictEqual([
      { x: 10, y: 0 },
      { x: 0, y: 0 }
    ]);
  });

  test('does not mutate the input array', () => {
    const original = [...straightLine];
    getPacketPathPoints(straightLine, 'RESPONSE');

    expect(straightLine).toStrictEqual(original);
  });
});

describe('getPolylineLength() works correctly', () => {
  test('sums the length of every segment', () => {
    expect(getPolylineLength(straightLine)).toBe(10);
    expect(getPolylineLength(bentLine)).toBe(20);
  });

  test('returns 0 for fewer than two points', () => {
    expect(getPolylineLength([])).toBe(0);
    expect(getPolylineLength([{ x: 5, y: 5 }])).toBe(0);
  });
});

describe('getPointAtProgress() works correctly', () => {
  test('returns the start point at progress 0', () => {
    expect(getPointAtProgress(straightLine, 0)).toStrictEqual({ x: 0, y: 0 });
  });

  test('returns the end point at progress 1', () => {
    expect(getPointAtProgress(straightLine, 1)).toStrictEqual({
      x: 10,
      y: 0
    });
  });

  test('interpolates along a single segment', () => {
    expect(getPointAtProgress(straightLine, 0.5)).toStrictEqual({
      x: 5,
      y: 0
    });
  });

  test('interpolates across multiple segments', () => {
    // Total length 20: progress 0.75 -> 15 units in -> 5 units into the
    // second (vertical) segment.
    expect(getPointAtProgress(bentLine, 0.75)).toStrictEqual({
      x: 10,
      y: 5
    });
  });

  test('clamps out-of-range progress', () => {
    expect(getPointAtProgress(straightLine, -1)).toStrictEqual({
      x: 0,
      y: 0
    });
    expect(getPointAtProgress(straightLine, 2)).toStrictEqual({
      x: 10,
      y: 0
    });
  });

  test('handles a single point', () => {
    expect(getPointAtProgress([{ x: 3, y: 4 }], 0.5)).toStrictEqual({
      x: 3,
      y: 4
    });
  });

  test('handles no points', () => {
    expect(getPointAtProgress([], 0.5)).toStrictEqual({ x: 0, y: 0 });
  });
});

describe('getPacketDestinationItemId() works correctly', () => {
  const itemAnchor = (item: string): ConnectorAnchor => {
    return { id: `anchor-${item}`, ref: { item } };
  };

  const tileAnchor: ConnectorAnchor = {
    id: 'anchor-tile',
    ref: { tile: { x: 0, y: 0 } }
  };

  test('REQUEST resolves to the end anchor item', () => {
    const anchors = [itemAnchor('start'), itemAnchor('end')];

    expect(getPacketDestinationItemId(anchors, 'REQUEST')).toBe('end');
  });

  test('RESPONSE resolves to the start anchor item', () => {
    const anchors = [itemAnchor('start'), itemAnchor('end')];

    expect(getPacketDestinationItemId(anchors, 'RESPONSE')).toBe('start');
  });

  test('returns null when the destination anchor has no item ref', () => {
    const anchors = [itemAnchor('start'), tileAnchor];

    expect(getPacketDestinationItemId(anchors, 'REQUEST')).toBeNull();
  });

  test('returns null when there are no anchors', () => {
    expect(getPacketDestinationItemId([], 'REQUEST')).toBeNull();
  });
});

describe('getPacketColor()', () => {
  // Distinct, obviously fake values: an assertion that passes for the wrong
  // reason is harder to hide when the colours cannot be confused.
  const palette = {
    request: 'REQUEST_COLOR',
    response: 'RESPONSE_COLOR',
    failure: 'FAILURE_COLOR'
  };

  test('a REQUEST step travels in the request colour', () => {
    expect(getPacketColor('REQUEST', undefined, palette)).toBe('REQUEST_COLOR');
  });

  test('a RESPONSE step travels in the response colour', () => {
    expect(getPacketColor('RESPONSE', undefined, palette)).toBe(
      'RESPONSE_COLOR'
    );
  });

  // The whole point of T4: the five FAILURE steps in the shipped diagrams are
  // all RESPONSE steps, so if direction won they would be indistinguishable
  // from a successful reply.
  test('a failed RESPONSE step reads as a failure, not as a response', () => {
    expect(getPacketColor('RESPONSE', 'FAILURE', palette)).toBe(
      'FAILURE_COLOR'
    );
  });

  test('a failed REQUEST step also reads as a failure', () => {
    expect(getPacketColor('REQUEST', 'FAILURE', palette)).toBe('FAILURE_COLOR');
  });

  test('SUCCESS changes nothing, so it looks the same as an unmarked step', () => {
    expect(getPacketColor('REQUEST', 'SUCCESS', palette)).toBe(
      getPacketColor('REQUEST', undefined, palette)
    );
    expect(getPacketColor('RESPONSE', 'SUCCESS', palette)).toBe(
      getPacketColor('RESPONSE', undefined, palette)
    );
  });
});
