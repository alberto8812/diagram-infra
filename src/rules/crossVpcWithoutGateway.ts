import { Issue, RuleDefinition } from './types';

export const RULE_ID = 'cross-vpc-without-gateway';

export const crossVpcWithoutGatewayRule: RuleDefinition = {
  id: RULE_ID,
  title: 'Cross-VPC connector without a gateway',
  description:
    'A connector enters or leaves a VPC zone without either endpoint ' +
    'being a gateway or load balancer.',
  severity: 'warning',
  rationale:
    'Traffic crossing a VPC boundary directly, without a gateway or load ' +
    'balancer fronting it, usually means a missing or misconfigured ' +
    'network edge rather than an intentional peering path.',
  check: (ctx): Issue[] => {
    const issues: Issue[] = [];

    (ctx.view.connectors ?? []).forEach((connector) => {
      const crossing = ctx.crossesZoneBoundary(connector);
      const crossesVpc = [...crossing.entered, ...crossing.left].some(
        (zone) => {
          return zone.zone === 'vpc';
        }
      );
      if (!crossesVpc) return;

      const { from, to } = ctx.connectorEndpoints(connector);
      const hasGatewayEndpoint = [from, to].some((item) => {
        return item?.kind === 'gateway' || item?.kind === 'loadBalancer';
      });
      if (hasGatewayEndpoint) return;

      const fromLabel = from?.name ?? '?';
      const toLabel = to?.name ?? '?';

      issues.push({
        ruleId: RULE_ID,
        severity: 'warning',
        message: `Connection from "${fromLabel}" to "${toLabel}" crosses a VPC boundary without a gateway or load balancer endpoint.`,
        viewId: ctx.view.id,
        targets: [{ type: 'CONNECTOR', id: connector.id }]
      });
    });

    return issues;
  }
};
