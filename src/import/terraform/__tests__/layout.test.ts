import { View } from 'src/types';
import {
  findPartialZoneOverlaps,
  getItemZones,
  getZoneParent
} from 'src/utils/containment';
import { layoutTerraformZones } from '../layout';
import { MappedItem, MappedZone } from '../resolve';

const zone = (id: string, overrides: Partial<MappedZone> = {}): MappedZone => {
  return { kind: 'zone', id, zoneType: 'vpc', name: id, ...overrides };
};

const item = (id: string, overrides: Partial<MappedItem> = {}): MappedItem => {
  return {
    kind: 'item',
    id,
    resourceKind: 'service',
    name: id,
    description: `Terraform: ${id}`,
    ...overrides
  };
};

// Builds a minimal View from the layout output, exactly like buildModel.ts
// does, so containment.ts (the same utility the app itself uses to answer
// "what zones is this item in") can be exercised against it directly.
const viewFromLayout = (
  zones: MappedZone[],
  items: MappedItem[],
  parentId: Map<string, string>
): View => {
  const { zoneBounds, itemTiles } = layoutTerraformZones(
    zones,
    items,
    parentId
  );

  return {
    id: 'v1',
    name: 'Imported',
    items: items.map((i) => {
      const tile = itemTiles.get(i.id);
      if (!tile) throw new Error(`missing tile for ${i.id}`);
      return { id: i.id, tile };
    }),
    rectangles: zones.map((z) => {
      const bounds = zoneBounds.get(z.id);
      if (!bounds) throw new Error(`missing bounds for ${z.id}`);
      return {
        id: z.id,
        from: bounds.from,
        to: bounds.to,
        zone: z.zoneType,
        name: z.name,
        visibility: z.visibility
      };
    })
  };
};

describe('layoutTerraformZones()', () => {
  test('nests region ⊃ vpc ⊃ az ⊃ subnet ⊃ item, fully containing each level', () => {
    const zones = [
      zone('region1', { zoneType: 'region' }),
      zone('vpc1', { zoneType: 'vpc' }),
      zone('az1', { zoneType: 'az' }),
      zone('subnet1', { zoneType: 'subnet' })
    ];
    const items = [item('svc1')];
    const parentId = new Map([
      ['vpc1', 'region1'],
      ['az1', 'vpc1'],
      ['subnet1', 'az1'],
      ['svc1', 'subnet1']
    ]);

    const view = viewFromLayout(zones, items, parentId);

    // Innermost -> outermost, exactly the nesting resolve.ts intended.
    const itemZoneIds = getItemZones(view, 'svc1').map((z) => {
      return z.id;
    });
    expect(itemZoneIds).toStrictEqual(['subnet1', 'az1', 'vpc1', 'region1']);

    expect(getZoneParent(view, 'subnet1')?.id).toBe('az1');
    expect(getZoneParent(view, 'az1')?.id).toBe('vpc1');
    expect(getZoneParent(view, 'vpc1')?.id).toBe('region1');
    expect(getZoneParent(view, 'region1')).toBeUndefined();

    // No partial (ambiguous) overlaps — every zone here either fully
    // contains, or is fully disjoint from, every other zone.
    expect(findPartialZoneOverlaps(view)).toStrictEqual([]);
  });

  test('places two independent top-level zones without overlapping', () => {
    const zones = [zone('vpcA'), zone('vpcB')];
    const items = [item('a', {}), item('b', {})];
    const parentId = new Map([
      ['a', 'vpcA'],
      ['b', 'vpcB']
    ]);

    const view = viewFromLayout(zones, items, parentId);

    expect(findPartialZoneOverlaps(view)).toStrictEqual([]);
    expect(
      getItemZones(view, 'a').map((z) => {
        return z.id;
      })
    ).toStrictEqual(['vpcA']);
    expect(
      getItemZones(view, 'b').map((z) => {
        return z.id;
      })
    ).toStrictEqual(['vpcB']);
  });

  test('gives a zone with neither child zones nor items a minimal non-empty footprint', () => {
    const zones = [zone('empty1')];
    const { zoneBounds } = layoutTerraformZones(zones, [], new Map());

    const bounds = zoneBounds.get('empty1');
    expect(bounds).toBeDefined();
    expect(bounds!.to.x).toBeGreaterThanOrEqual(bounds!.from.x);
    expect(bounds!.to.y).toBeGreaterThanOrEqual(bounds!.from.y);
  });

  test('rows multiple sibling items inside the same zone without overlapping tiles', () => {
    const zones = [zone('vpc1')];
    const items = [item('a'), item('b'), item('c')];
    const parentId = new Map([
      ['a', 'vpc1'],
      ['b', 'vpc1'],
      ['c', 'vpc1']
    ]);

    const { itemTiles, zoneBounds } = layoutTerraformZones(
      zones,
      items,
      parentId
    );

    const tiles = ['a', 'b', 'c'].map((id) => {
      return itemTiles.get(id)!;
    });
    const uniqueTileKeys = new Set(
      tiles.map((t) => {
        return `${t.x},${t.y}`;
      })
    );
    expect(uniqueTileKeys.size).toBe(3);

    const bounds = zoneBounds.get('vpc1')!;
    tiles.forEach((tile) => {
      expect(tile.x).toBeGreaterThanOrEqual(bounds.from.x);
      expect(tile.x).toBeLessThanOrEqual(bounds.to.x);
      expect(tile.y).toBeGreaterThanOrEqual(bounds.from.y);
      expect(tile.y).toBeLessThanOrEqual(bounds.to.y);
    });
  });
});
