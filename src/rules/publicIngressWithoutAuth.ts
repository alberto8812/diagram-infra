import { Issue, RuleDefinition } from './types';

export const RULE_ID = 'public-ingress-without-auth';

export const publicIngressWithoutAuthRule: RuleDefinition = {
  id: RULE_ID,
  title: 'Public ingress without authentication',
  description:
    'A connector from a user/external node — or from outside every zone — ' +
    'into a node has no authentication.',
  severity: 'warning',
  rationale:
    'Ingress from outside the diagram (a user, an external system, or ' +
    'anything not placed inside a zone) that reaches a node with no auth ' +
    'is open to anyone who can reach it.',
  check: (ctx): Issue[] => {
    const issues: Issue[] = [];

    (ctx.view.connectors ?? []).forEach((connector) => {
      if (connector.auth !== 'none') return;

      const { from, to } = ctx.connectorEndpoints(connector);
      const fromIsExternalKind =
        from?.kind === 'user' || from?.kind === 'external';

      const zones = ctx.connectorZones(connector);
      const fromOutsideIntoZone =
        !!zones && zones.from.length === 0 && zones.to.length > 0;

      if (!fromIsExternalKind && !fromOutsideIntoZone) return;

      const toLabel = to?.name ?? '?';
      const originLabel = fromIsExternalKind
        ? `"${from?.name ?? '?'}"`
        : 'outside all zones';

      issues.push({
        ruleId: RULE_ID,
        severity: 'warning',
        message: `Unauthenticated connection into "${toLabel}" from ${originLabel}.`,
        viewId: ctx.view.id,
        targets: [{ type: 'CONNECTOR', id: connector.id }]
      });
    });

    return issues;
  }
};
