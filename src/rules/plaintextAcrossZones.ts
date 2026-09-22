import { Connector } from 'src/types';
import { Issue, RuleDefinition } from './types';

export const RULE_ID = 'plaintext-across-zones';

const isPlaintext = (connector: Connector): boolean => {
  if (connector.protocol === 'HTTP') return true;

  if (
    (connector.protocol === 'SQL' || connector.protocol === 'TCP') &&
    connector.auth === 'none'
  ) {
    return true;
  }

  return false;
};

export const plaintextAcrossZonesRule: RuleDefinition = {
  id: RULE_ID,
  title: 'Plaintext protocol crossing a zone boundary',
  description:
    'An HTTP connector (or an unauthenticated SQL/TCP connector) has ' +
    'endpoints in different zones.',
  severity: 'warning',
  rationale:
    'Unencrypted traffic that leaves a zone boundary — a subnet, a VPC, an ' +
    'account — is readable by anything positioned on the path between them.',
  check: (ctx): Issue[] => {
    const issues: Issue[] = [];

    (ctx.view.connectors ?? []).forEach((connector) => {
      if (!isPlaintext(connector)) return;

      const crossing = ctx.crossesZoneBoundary(connector);
      if (crossing.entered.length === 0 && crossing.left.length === 0) return;

      const { from, to } = ctx.connectorEndpoints(connector);
      const fromLabel = from?.name ?? '?';
      const toLabel = to?.name ?? '?';

      issues.push({
        ruleId: RULE_ID,
        severity: 'warning',
        message: `Plaintext ${connector.protocol} connection from "${fromLabel}" to "${toLabel}" crosses a zone boundary.`,
        viewId: ctx.view.id,
        targets: [{ type: 'CONNECTOR', id: connector.id }]
      });
    });

    return issues;
  }
};
