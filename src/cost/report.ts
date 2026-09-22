// Pure Markdown/JSON report generation for an already-computed
// DiagramCostEstimate (P4 cost estimation). Mirrors src/security/report.ts's
// split: no DOM, no download mechanics — that stays in CostReportDialog,
// which owns the Blob + object URL download (same pattern as
// SecurityReportDialog).
import { CostGroupTotal, DiagramCostEstimate } from './types';

export interface CostReportInput {
  // Caller-supplied so output is deterministic/testable — this module never
  // reads the clock itself.
  generatedAt: string;
  diagramTitle?: string;
  estimate: DiagramCostEstimate;
}

const money = (value: number, currency: string): string => {
  return `${currency} ${value.toFixed(2)}`;
};

const groupTableRows = (
  groups: CostGroupTotal[],
  currency: string
): string[] => {
  return groups.map((group) => {
    return `| ${group.label} | ${money(group.monthlyUsd, currency)} | ${group.itemCount} | ${group.hasApproximate ? 'yes' : 'no'} |`;
  });
};

const groupSection = (
  lines: string[],
  title: string,
  groups: CostGroupTotal[],
  currency: string
): void => {
  lines.push(`## ${title}`);
  lines.push('');

  if (groups.length === 0) {
    lines.push('No priced items.');
    lines.push('');
    return;
  }

  lines.push('| | Monthly | Items | Includes approximate |');
  lines.push('|---|---|---|---|');
  lines.push(...groupTableRows(groups, currency));
  lines.push('');
};

export const buildCostReportMarkdown = (input: CostReportInput): string => {
  const { estimate } = input;
  const lines: string[] = [];

  lines.push(`# Cost report — ${input.diagramTitle ?? 'Untitled diagram'}`);
  lines.push('');
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push(
    `Catalog last updated: ${estimate.lastUpdated}. Figures are approximate on-demand list prices — never a quote.`
  );
  lines.push('');
  lines.push(
    `**Total: ${money(estimate.totalMonthlyUsd, estimate.currency)}/month${
      estimate.hasApproximate ? ' (includes approximate figures)' : ''
    }**`
  );
  lines.push('');

  groupSection(lines, 'By view', estimate.perView, estimate.currency);
  groupSection(lines, 'By zone', estimate.perZone, estimate.currency);
  groupSection(
    lines,
    'By environment',
    estimate.perEnvironment,
    estimate.currency
  );

  lines.push('## Unpriced nodes');
  lines.push('');
  if (estimate.unpriced.length === 0) {
    lines.push('None.');
    lines.push('');
  } else {
    estimate.unpriced.forEach((node) => {
      lines.push(`- **${node.itemName}**: ${node.reasons.join(' ')}`);
    });
    lines.push('');
  }

  return lines.join('\n');
};

export const buildCostReportJson = (input: CostReportInput): string => {
  return JSON.stringify(
    {
      generatedAt: input.generatedAt,
      diagramTitle: input.diagramTitle ?? 'Untitled diagram',
      ...input.estimate
    },
    null,
    2
  );
};
