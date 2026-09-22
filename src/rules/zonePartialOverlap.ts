import { Issue, RuleDefinition } from './types';

export const RULE_ID = 'zone-partial-overlap';

export const zonePartialOverlapRule: RuleDefinition = {
  id: RULE_ID,
  title: 'Zones partially overlap',
  description:
    'Two zone rectangles intersect without either fully containing the other.',
  severity: 'warning',
  rationale:
    'A node in the overlapping area belongs to both zones with no clear ' +
    'nesting between them, so "located in" and every containment-based ' +
    'rule become ambiguous for it.',
  check: (ctx): Issue[] => {
    return ctx.partialOverlaps.map(({ a, b }) => {
      const nameA = a.name ?? a.zone;
      const nameB = b.name ?? b.zone;

      return {
        ruleId: RULE_ID,
        severity: 'warning',
        message: `Zone "${nameA}" and zone "${nameB}" partially overlap.`,
        viewId: ctx.view.id,
        targets: [
          { type: 'RECTANGLE', id: a.id },
          { type: 'RECTANGLE', id: b.id }
        ]
      };
    });
  }
};
