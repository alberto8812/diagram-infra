import { DataClassification } from 'src/types';
import { isEncryptedInTransit } from 'src/security/encryption';
import { Issue, RuleDefinition } from './types';

export const RULE_ID = 'sensitive-flow-unencrypted';

const SENSITIVE_CLASSIFICATIONS: ReadonlySet<DataClassification> = new Set([
  'confidential',
  'restricted'
]);

export const sensitiveFlowUnencryptedRule: RuleDefinition = {
  id: RULE_ID,
  title: 'Flow carrying sensitive data is not encrypted in transit',
  description:
    'A connector with an endpoint classified confidential or restricted ' +
    'is not encrypted in transit (isEncryptedInTransit is false or unknown).',
  severity: 'warning',
  rationale:
    'A flow that touches confidential or restricted data but has no ' +
    'confirmed transit encryption can leak that data to anything ' +
    'positioned on the network path.',
  check: (ctx): Issue[] => {
    const issues: Issue[] = [];

    (ctx.view.connectors ?? []).forEach((connector) => {
      if (isEncryptedInTransit(connector) === true) return;

      const { from, to } = ctx.connectorEndpoints(connector);
      const touchesSensitiveData = [from, to].some((endpoint) => {
        return (
          endpoint?.dataClassification !== undefined &&
          SENSITIVE_CLASSIFICATIONS.has(endpoint.dataClassification)
        );
      });

      if (!touchesSensitiveData) return;

      const fromLabel = from?.name ?? '?';
      const toLabel = to?.name ?? '?';

      issues.push({
        ruleId: RULE_ID,
        severity: 'warning',
        message: `Connection from "${fromLabel}" to "${toLabel}" touches sensitive data but is not confirmed encrypted in transit.`,
        viewId: ctx.view.id,
        targets: [{ type: 'CONNECTOR', id: connector.id }]
      });
    });

    return issues;
  }
};
