import { getIsometricCuboidFaces, toSvgPoints } from '../isometricBlock';

describe('getIsometricCuboidFaces() works correctly', () => {
  test('places the near (floor) vertex at the anchor origin', () => {
    const faces = getIsometricCuboidFaces({ width: 100, height: 60 }, 20);

    // `left`/`right` both start their un-raised edge from `near`, which is
    // always the origin — the node's own anchor point.
    expect(faces.left[1]).toStrictEqual({ x: 0, y: 0 });
    expect(faces.right[1]).toStrictEqual({ x: 0, y: 0 });
  });

  test('computes the top face as the footprint diamond raised by extrudeHeight', () => {
    const faces = getIsometricCuboidFaces({ width: 100, height: 60 }, 20);

    expect(faces.top).toStrictEqual([
      { x: 0, y: -80 }, // far
      { x: 50, y: -50 }, // right
      { x: 0, y: -20 }, // near
      { x: -50, y: -50 } // left
    ]);
  });

  test('computes the left face as a quad between the left/near floor and lid vertices', () => {
    const faces = getIsometricCuboidFaces({ width: 100, height: 60 }, 20);

    expect(faces.left).toStrictEqual([
      { x: -50, y: -30 }, // left (floor)
      { x: 0, y: 0 }, // near (floor)
      { x: 0, y: -20 }, // near (lid)
      { x: -50, y: -50 } // left (lid)
    ]);
  });

  test('computes the right face as a quad between the right/near floor and lid vertices', () => {
    const faces = getIsometricCuboidFaces({ width: 100, height: 60 }, 20);

    expect(faces.right).toStrictEqual([
      { x: 50, y: -30 }, // right (floor)
      { x: 0, y: 0 }, // near (floor)
      { x: 0, y: -20 }, // near (lid)
      { x: 50, y: -50 } // right (lid)
    ]);
  });

  test('a zero extrudeHeight collapses the lid onto the floor diamond', () => {
    const faces = getIsometricCuboidFaces({ width: 100, height: 60 }, 0);

    expect(faces.top).toStrictEqual([
      { x: 0, y: -60 },
      { x: 50, y: -30 },
      { x: 0, y: 0 },
      { x: -50, y: -30 }
    ]);
  });
});

describe('toSvgPoints() works correctly', () => {
  test('formats coordinates as an SVG points string', () => {
    expect(
      toSvgPoints([
        { x: 0, y: 0 },
        { x: 10, y: -5 }
      ])
    ).toBe('0,0 10,-5');
  });

  test('returns an empty string for no points', () => {
    expect(toSvgPoints([])).toBe('');
  });
});
