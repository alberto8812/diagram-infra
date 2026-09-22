import { ModelItem } from 'src/types';
import { Issue, RuleDefinition } from './types';

export const RULE_ID = 'prod-database-single-az';

// A sentinel distinct from any real zone id, standing for "not located in
// any az zone" — so a view where every prod database sits outside all az
// zones (despite az zones existing) also counts as a single "location" and
// is flagged, same as every prod database sharing one literal az.
const NO_AZ = '__no-az__';

export const prodDatabaseSingleAzRule: RuleDefinition = {
  id: RULE_ID,
  title: 'Prod database not spread across availability zones',
  description:
    'In a view with availability-zone zones, every prod database node ' +
    'sits in the same one (or none at all).',
  severity: 'warning',
  rationale:
    'A prod database confined to a single availability zone loses ' +
    'redundancy the moment that AZ has an outage.',
  check: (ctx): Issue[] => {
    const hasAzZones = ctx.zones.some((zone) => {
      return zone.zone === 'az';
    });
    if (!hasAzZones) return [];

    const prodDatabaseItems = ctx.view.items.reduce<ModelItem[]>(
      (acc, viewItem) => {
        const item = ctx.itemsById.get(viewItem.id);

        if (item && item.kind === 'database' && item.environment === 'prod') {
          acc.push(item);
        }

        return acc;
      },
      []
    );

    if (prodDatabaseItems.length === 0) return [];

    const distinctAzIds = new Set<string>();
    prodDatabaseItems.forEach((item) => {
      const az = ctx.getItemZones(item.id).find((zone) => {
        return zone.zone === 'az';
      });

      distinctAzIds.add(az?.id ?? NO_AZ);
    });

    if (distinctAzIds.size > 1) return [];

    const names = prodDatabaseItems
      .map((item) => {
        return `"${item.name}"`;
      })
      .join(', ');
    const verb = prodDatabaseItems.length > 1 ? 'are' : 'is';

    return [
      {
        ruleId: RULE_ID,
        severity: 'warning',
        message: `Prod database ${names} ${verb} not spread across multiple availability zones.`,
        viewId: ctx.view.id,
        targets: prodDatabaseItems.map((item) => {
          return { type: 'ITEM' as const, id: item.id };
        })
      }
    ];
  }
};
