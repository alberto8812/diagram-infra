import { ResourceKind } from 'src/types';
import { Issue, RuleDefinition } from './types';

export const RULE_ID = 'datastore-in-public-zone';

const DATASTORE_KINDS: ReadonlySet<ResourceKind> = new Set([
  'database',
  'cache',
  'storage'
]);

export const datastoreInPublicZoneRule: RuleDefinition = {
  id: RULE_ID,
  title: 'Data store in a public zone',
  description:
    'A database, cache or storage node sits in a subnet marked public.',
  severity: 'error',
  rationale:
    'A data store reachable from a public subnet is directly exposed to ' +
    'the internet instead of sitting behind an application tier.',
  check: (ctx): Issue[] => {
    const issues: Issue[] = [];

    ctx.view.items.forEach((viewItem) => {
      const item = ctx.itemsById.get(viewItem.id);
      if (!item || !item.kind || !DATASTORE_KINDS.has(item.kind)) return;

      // The innermost subnet the node sits in — zones are already
      // innermost-to-outermost, and a node can only meaningfully be
      // "public" through the subnet immediately around it.
      const innermostSubnet = ctx.getItemZones(item.id).find((zone) => {
        return zone.zone === 'subnet';
      });

      if (!innermostSubnet || innermostSubnet.visibility !== 'public') return;

      const zoneName = innermostSubnet.name ?? 'subnet';

      issues.push({
        ruleId: RULE_ID,
        severity: 'error',
        message: `"${item.name}" (${item.kind}) sits in public subnet "${zoneName}".`,
        viewId: ctx.view.id,
        targets: [
          { type: 'ITEM', id: item.id },
          { type: 'RECTANGLE', id: innermostSubnet.id }
        ]
      });
    });

    return issues;
  }
};
