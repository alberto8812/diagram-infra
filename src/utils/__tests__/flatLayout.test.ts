import {
  buildFlatLayout,
  FLAT_LAYOUT_COLUMN_GAP,
  FLAT_LAYOUT_CONTAINER_PADDING,
  FLAT_LAYOUT_ITEM_GAP,
  FLAT_LAYOUT_ITEM_HEIGHT,
  FLAT_LAYOUT_ITEM_WIDTH,
  FLAT_LAYOUT_SUBCOLUMN_GAP
} from '../flatLayout';

// True whenever two axis-aligned boxes (x/y/width/height) share any area.
// Touching edges (a.x + a.width === b.x) do not count as overlap.
const boxesOverlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean => {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
};

describe('buildFlatLayout() works correctly', () => {
  test('items of the same group share a column and stack in order', () => {
    const items = [
      { id: 'a', group: 'g1' },
      { id: 'b', group: 'g1' },
      { id: 'c', group: 'g1' }
    ];

    const layout = buildFlatLayout(items);

    expect(layout.groups).toHaveLength(1);
    const [group] = layout.groups;

    expect(group.name).toBe('g1');
    expect(
      group.items.map((item) => {
        return item.id;
      })
    ).toStrictEqual(['a', 'b', 'c']);

    // Same column: every item shares the same x.
    expect(group.items[1].x).toBe(group.items[0].x);
    expect(group.items[2].x).toBe(group.items[0].x);

    // Stacked top to bottom in declared order.
    expect(group.items[1].y).toBe(
      group.items[0].y + FLAT_LAYOUT_ITEM_HEIGHT + FLAT_LAYOUT_ITEM_GAP
    );
    expect(group.items[2].y).toBe(
      group.items[1].y + FLAT_LAYOUT_ITEM_HEIGHT + FLAT_LAYOUT_ITEM_GAP
    );
  });

  test('two groups produce two columns, the second to the right of the first, with no overlap', () => {
    const items = [
      { id: 'a', group: 'g1' },
      { id: 'b', group: 'g2' }
    ];

    const layout = buildFlatLayout(items);

    expect(layout.groups).toHaveLength(2);
    const [g1, g2] = layout.groups;

    expect(g1.name).toBe('g1');
    expect(g2.name).toBe('g2');
    expect(g2.x).toBe(g1.x + g1.width + FLAT_LAYOUT_COLUMN_GAP);
    expect(boxesOverlap(g1, g2)).toBe(false);
  });

  // The property real-diagram measurement showed isometric-position reuse
  // fails: grouping by `environment` overlapped 6 of 6 group boxes.
  test('no two group boxes overlap, for any number of groups', () => {
    const items = [
      { id: 'a', group: 'g1' },
      { id: 'b', group: 'g2' },
      { id: 'c', group: 'g3' },
      { id: 'd', group: 'g4' },
      { id: 'e' } // trailing null group too
    ];

    const layout = buildFlatLayout(items, { itemsPerColumn: 1 });

    for (let i = 0; i < layout.groups.length; i += 1) {
      for (let j = i + 1; j < layout.groups.length; j += 1) {
        expect(boxesOverlap(layout.groups[i], layout.groups[j])).toBe(false);
      }
    }
  });

  test('groupOrder decides column order, and a name in it that nothing uses is skipped', () => {
    const items = [
      { id: 'a', group: 'g1' },
      { id: 'b', group: 'g2' }
    ];

    const layout = buildFlatLayout(items, {
      groupOrder: ['g2', 'unused', 'g1']
    });

    expect(
      layout.groups.map((group) => {
        return group.name;
      })
    ).toStrictEqual(['g2', 'g1']);
  });

  test('a group missing from groupOrder still appears, after the ordered ones', () => {
    const items = [
      { id: 'a', group: 'g1' },
      { id: 'b', group: 'g2' },
      { id: 'c', group: 'g3' }
    ];

    const layout = buildFlatLayout(items, { groupOrder: ['g3'] });

    expect(
      layout.groups.map((group) => {
        return group.name;
      })
    ).toStrictEqual(['g3', 'g1', 'g2']);
  });

  test('ungrouped items land in a trailing column with name: null', () => {
    const items = [{ id: 'a', group: 'g1' }, { id: 'b' }, { id: 'c' }];

    const layout = buildFlatLayout(items);

    expect(layout.groups).toHaveLength(2);
    const [grouped, ungrouped] = layout.groups;

    expect(grouped.name).toBe('g1');
    expect(ungrouped.name).toBeNull();
    expect(
      ungrouped.items.map((item) => {
        return item.id;
      })
    ).toStrictEqual(['b', 'c']);
    // The null column comes after every real group.
    expect(ungrouped.x).toBeGreaterThan(grouped.x);
  });

  test('does not produce a null group when every item is grouped', () => {
    const items = [{ id: 'a', group: 'g1' }];

    const layout = buildFlatLayout(items);

    expect(
      layout.groups.every((group) => {
        return group.name !== null;
      })
    ).toBe(true);
  });

  test('wraps into a new sub-column of the same group once itemsPerColumn is exceeded', () => {
    const items = [
      { id: 'a', group: 'g1' },
      { id: 'b', group: 'g1' },
      { id: 'c', group: 'g1' }
    ];

    const layout = buildFlatLayout(items, { itemsPerColumn: 2 });

    expect(layout.groups).toHaveLength(1);
    const [group] = layout.groups;

    // Still one group, but the third item starts a second sub-column: same
    // starting y as the first item, shifted right by one item width + gap.
    const [itemA, itemB, itemC] = group.items;

    expect(itemB.x).toBe(itemA.x);
    expect(itemC.x).toBe(
      itemA.x + FLAT_LAYOUT_ITEM_WIDTH + FLAT_LAYOUT_SUBCOLUMN_GAP
    );
    expect(itemC.y).toBe(itemA.y);

    // The group's box widens to enclose both sub-columns.
    expect(group.width).toBe(
      2 * FLAT_LAYOUT_ITEM_WIDTH +
        FLAT_LAYOUT_SUBCOLUMN_GAP +
        2 * FLAT_LAYOUT_CONTAINER_PADDING
    );
  });

  test('empty input returns empty groups and zero size', () => {
    const layout = buildFlatLayout([]);

    expect(layout).toStrictEqual({ groups: [], width: 0, height: 0 });
  });

  test('calling it twice with the same input returns deeply equal results', () => {
    const items = [
      { id: 'a', group: 'g1' },
      { id: 'b', group: 'g2' },
      { id: 'c' }
    ];
    const options = { groupOrder: ['g2'], itemsPerColumn: 2 };

    const first = buildFlatLayout(items, options);
    const second = buildFlatLayout(items, options);

    expect(first).toStrictEqual(second);
  });

  test('does not mutate the input array or its item objects', () => {
    const items = [
      { id: 'a', group: 'g1' },
      { id: 'b', group: 'g2' }
    ];
    const snapshot = items.map((item) => {
      return { ...item };
    });

    buildFlatLayout(items, { groupOrder: ['g2'] });

    expect(items).toStrictEqual(snapshot);
    expect(items[0]).not.toHaveProperty('x');
    expect(items[1]).not.toHaveProperty('x');
  });
});
