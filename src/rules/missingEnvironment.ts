import { Issue, RuleDefinition } from './types';

export const RULE_ID = 'missing-environment';

export const missingEnvironmentRule: RuleDefinition = {
  id: RULE_ID,
  title: 'Missing environment',
  description: 'A node has a resource kind set but no environment.',
  severity: 'info',
  rationale:
    'Every other environment-scoped rule (prod-without-owner, ' +
    'prod-database-single-az) silently skips a node with no environment, ' +
    'so leaving it unset can hide real findings rather than clearing them.',
  check: (ctx): Issue[] => {
    const issues: Issue[] = [];

    ctx.view.items.forEach((viewItem) => {
      const item = ctx.itemsById.get(viewItem.id);
      if (!item || !item.kind || item.environment) return;

      issues.push({
        ruleId: RULE_ID,
        severity: 'info',
        message: `"${item.name}" (${item.kind}) has no environment set.`,
        viewId: ctx.view.id,
        targets: [{ type: 'ITEM', id: item.id }]
      });
    });

    return issues;
  }
};
