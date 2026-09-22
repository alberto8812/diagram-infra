import { Issue, RuleDefinition } from './types';

export const RULE_ID = 'prod-without-owner';

export const prodWithoutOwnerRule: RuleDefinition = {
  id: RULE_ID,
  title: 'Prod resource without an owner',
  description: 'A node marked as the prod environment has no owner set.',
  severity: 'warning',
  rationale:
    'A prod resource with nobody accountable for it is slower to triage ' +
    'during an incident and easier to leave forgotten.',
  check: (ctx): Issue[] => {
    const issues: Issue[] = [];

    ctx.view.items.forEach((viewItem) => {
      const item = ctx.itemsById.get(viewItem.id);
      if (!item) return;
      if (item.environment !== 'prod') return;
      if (item.owner) return;

      issues.push({
        ruleId: RULE_ID,
        severity: 'warning',
        message: `"${item.name}" is a prod resource with no owner set.`,
        viewId: ctx.view.id,
        targets: [{ type: 'ITEM', id: item.id }]
      });
    });

    return issues;
  }
};
