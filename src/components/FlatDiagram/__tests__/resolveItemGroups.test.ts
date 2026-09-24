import { resolveItemGroups } from '../resolveItemGroups';

describe('resolveItemGroups()', () => {
  test("an item inside one named rectangle resolves to that rectangle's name", () => {
    const items = [{ id: 'a', tile: { x: 1, y: 1 } }];
    const rectangles = [
      { name: 'VPC', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }
    ];

    expect(resolveItemGroups(items, rectangles)).toStrictEqual({ a: 'VPC' });
  });

  test('a nested pair of rectangles: the smallest containing rectangle wins', () => {
    const items = [{ id: 'a', tile: { x: 0, y: 0 } }];
    const rectangles = [
      { name: 'VPC', from: { x: -10, y: -10 }, to: { x: 10, y: 10 } },
      { name: 'Subnet', from: { x: -2, y: -2 }, to: { x: 2, y: 2 } }
    ];

    expect(resolveItemGroups(items, rectangles)).toStrictEqual({
      a: 'Subnet'
    });

    // Order in the input array must not matter — same result reversed.
    expect(resolveItemGroups(items, [...rectangles].reverse())).toStrictEqual({
      a: 'Subnet'
    });
  });

  test('a rectangle whose corners run high-to-low on both axes still contains correctly', () => {
    const items = [{ id: 'a', tile: { x: 1, y: -2 } }];
    // Real data has a rectangle running from y 5 to y -3 (from is not
    // guaranteed to be the lower corner).
    const rectangles = [
      { name: 'Reversed', from: { x: 5, y: -3 }, to: { x: -5, y: 3 } }
    ];

    expect(resolveItemGroups(items, rectangles)).toStrictEqual({
      a: 'Reversed'
    });
  });

  test('an unnamed rectangle is skipped entirely, even when it would otherwise contain the item', () => {
    const items = [{ id: 'a', tile: { x: 0, y: 0 } }];
    const rectangles = [{ from: { x: -5, y: -5 }, to: { x: 5, y: 5 } }];

    expect(resolveItemGroups(items, rectangles)).toStrictEqual({});
  });

  test('an item outside every rectangle gets no entry', () => {
    const items = [{ id: 'a', tile: { x: 100, y: 100 } }];
    const rectangles = [
      { name: 'VPC', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }
    ];

    expect(resolveItemGroups(items, rectangles)).toStrictEqual({});
  });

  test('an item exactly on a rectangle edge is included (bounds inclusive)', () => {
    const items = [{ id: 'a', tile: { x: 5, y: 5 } }];
    const rectangles = [
      { name: 'VPC', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }
    ];

    expect(resolveItemGroups(items, rectangles)).toStrictEqual({ a: 'VPC' });
  });

  test('multiple items resolve independently, some inside, some outside', () => {
    const items = [
      { id: 'inside', tile: { x: 1, y: 1 } },
      { id: 'outside', tile: { x: 50, y: 50 } }
    ];
    const rectangles = [
      { name: 'VPC', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }
    ];

    expect(resolveItemGroups(items, rectangles)).toStrictEqual({
      inside: 'VPC'
    });
  });

  test('does not mutate its inputs', () => {
    const items = [{ id: 'a', tile: { x: 1, y: 1 } }];
    const rectangles = [
      { name: 'VPC', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }
    ];

    const itemsSnapshot = JSON.parse(JSON.stringify(items));
    const rectanglesSnapshot = JSON.parse(JSON.stringify(rectangles));

    resolveItemGroups(items, rectangles);

    expect(items).toStrictEqual(itemsSnapshot);
    expect(rectangles).toStrictEqual(rectanglesSnapshot);
  });

  test('is deterministic: same input produces the same output every call', () => {
    const items = [
      { id: 'a', tile: { x: 1, y: 1 } },
      { id: 'b', tile: { x: -3, y: -11 } }
    ];
    const rectangles = [
      { name: 'VPC', from: { x: -7, y: 6 }, to: { x: 6, y: -15 } },
      { name: 'Subnet', from: { x: -5, y: -13 }, to: { x: 1, y: -9 } }
    ];

    const first = resolveItemGroups(items, rectangles);
    const second = resolveItemGroups(items, rectangles);

    expect(first).toStrictEqual(second);
  });
});
