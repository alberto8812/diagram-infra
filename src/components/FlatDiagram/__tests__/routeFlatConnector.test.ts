import {
  routeFlatConnector,
  FlatConnectorBox,
  FlatConnectorPoint
} from '../routeFlatConnector';

// True when `point` lies somewhere on `box`'s perimeter (any of its four
// edges, corners included) — used to assert a path starts/ends on an edge
// rather than the box's centre.
const isOnBoxEdge = (
  box: FlatConnectorBox,
  point: FlatConnectorPoint
): boolean => {
  const onVerticalEdge =
    (point.x === box.x || point.x === box.x + box.width) &&
    point.y >= box.y &&
    point.y <= box.y + box.height;

  const onHorizontalEdge =
    (point.y === box.y || point.y === box.y + box.height) &&
    point.x >= box.x &&
    point.x <= box.x + box.width;

  return onVerticalEdge || onHorizontalEdge;
};

const boxCenter = (box: FlatConnectorBox): FlatConnectorPoint => {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// Asserts every consecutive pair of points in the path is either a purely
// horizontal or purely vertical segment (no diagonals).
const expectOnlyRightAngleSegments = (points: FlatConnectorPoint[]) => {
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const isHorizontal = a.y === b.y;
    const isVertical = a.x === b.x;

    expect(isHorizontal || isVertical).toBe(true);
  }
};

describe('routeFlatConnector()', () => {
  test('every segment is horizontal or vertical, never diagonal', () => {
    const from: FlatConnectorBox = { x: 0, y: 0, width: 120, height: 80 };
    const to: FlatConnectorBox = { x: 400, y: 300, width: 120, height: 80 };

    const points = routeFlatConnector(from, to);

    expect(points.length).toBeGreaterThanOrEqual(2);
    expectOnlyRightAngleSegments(points);
  });

  test('the path starts on the source edge and ends on the destination edge, not either centre', () => {
    const from: FlatConnectorBox = { x: 0, y: 0, width: 120, height: 80 };
    const to: FlatConnectorBox = { x: 400, y: 300, width: 120, height: 80 };

    const points = routeFlatConnector(from, to);
    const start = points[0];
    const end = points[points.length - 1];

    expect(isOnBoxEdge(from, start)).toBe(true);
    expect(isOnBoxEdge(to, end)).toBe(true);
    expect(start).not.toStrictEqual(boxCenter(from));
    expect(end).not.toStrictEqual(boxCenter(to));
  });

  test('two items aligned horizontally (same vertical centre) get a straight horizontal run', () => {
    const from: FlatConnectorBox = { x: 0, y: 0, width: 120, height: 80 };
    const to: FlatConnectorBox = { x: 300, y: 0, width: 120, height: 80 };

    const points = routeFlatConnector(from, to);

    expect(points).toHaveLength(2);
    expect(points[0].y).toBe(points[1].y);
    expect(points[0].x).not.toBe(points[1].x);
    // Leaves from the right edge of `from`, arrives at the left edge of `to`.
    expect(points[0]).toStrictEqual({ x: 120, y: 40 });
    expect(points[1]).toStrictEqual({ x: 300, y: 40 });
  });

  test('two items aligned vertically (same horizontal centre) get a straight vertical run', () => {
    const from: FlatConnectorBox = { x: 0, y: 0, width: 120, height: 80 };
    const to: FlatConnectorBox = { x: 0, y: 300, width: 120, height: 80 };

    const points = routeFlatConnector(from, to);

    expect(points).toHaveLength(2);
    expect(points[0].x).toBe(points[1].x);
    expect(points[0].y).not.toBe(points[1].y);
    // Leaves from the bottom edge of `from`, arrives at the top edge of `to`.
    expect(points[0]).toStrictEqual({ x: 60, y: 80 });
    expect(points[1]).toStrictEqual({ x: 60, y: 300 });
  });

  test('unaligned items (diagonal placement) get a bent, still-orthogonal path with a midpoint elbow', () => {
    const from: FlatConnectorBox = { x: 0, y: 0, width: 100, height: 50 };
    const to: FlatConnectorBox = { x: 300, y: 200, width: 100, height: 50 };

    const points = routeFlatConnector(from, to);

    expect(points.length).toBeGreaterThan(2);
    expectOnlyRightAngleSegments(points);
    expect(isOnBoxEdge(from, points[0])).toBe(true);
    expect(isOnBoxEdge(to, points[points.length - 1])).toBe(true);
  });

  test('routes the reverse direction (destination to the left/above) with edges facing each other', () => {
    const from: FlatConnectorBox = { x: 300, y: 0, width: 120, height: 80 };
    const to: FlatConnectorBox = { x: 0, y: 0, width: 120, height: 80 };

    const points = routeFlatConnector(from, to);

    expect(points).toHaveLength(2);
    // Leaves from the left edge of `from`, arrives at the right edge of `to`.
    expect(points[0]).toStrictEqual({ x: 300, y: 40 });
    expect(points[1]).toStrictEqual({ x: 120, y: 40 });
  });

  test('is deterministic: same input produces deeply equal output every call', () => {
    const from: FlatConnectorBox = { x: 10, y: 20, width: 120, height: 80 };
    const to: FlatConnectorBox = { x: 500, y: 5, width: 120, height: 80 };

    const first = routeFlatConnector(from, to);
    const second = routeFlatConnector(from, to);

    expect(first).toStrictEqual(second);
  });

  test('does not mutate its inputs', () => {
    const from: FlatConnectorBox = { x: 0, y: 0, width: 120, height: 80 };
    const to: FlatConnectorBox = { x: 400, y: 300, width: 120, height: 80 };
    const fromSnapshot = { ...from };
    const toSnapshot = { ...to };

    routeFlatConnector(from, to);

    expect(from).toStrictEqual(fromSnapshot);
    expect(to).toStrictEqual(toSnapshot);
  });
});
