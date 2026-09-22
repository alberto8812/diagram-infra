// Pure report generators (P2: threat modeling + compliance mapping). Take
// already-computed issues/threats/compliance mappings and render them as
// Markdown or JSON — no DOM, no download mechanics (that lives in
// SecurityReportDialog, which owns the Blob + object URL download).
import { RuleSeverity } from 'src/rules/types';
import { Issue } from 'src/rules';
import { ControlMapping } from 'src/compliance/controls';
import {
  Threat,
  ThreatCategory,
  ThreatStatus,
  ThreatTargetType
} from './threats';

export interface SecurityReportInput {
  // Caller-supplied so output is deterministic/testable — this module never
  // reads the clock itself.
  generatedAt: string;
  diagramTitle?: string;
  issues: Issue[];
  threats: Threat[];
  controlMappings: ControlMapping[];
  // Threats only carry a targetType/targetId/viewId — their title/description
  // already embed a human-readable name, but grouping needs one on its own.
  // Defaults to the raw targetId when the caller doesn't supply a resolver
  // (e.g. from the model's itemsById/connectors).
  resolveElementLabel?: (
    targetType: ThreatTargetType,
    targetId: string,
    viewId: string
  ) => string;
}

const SEVERITIES: RuleSeverity[] = ['error', 'warning', 'info'];
const STATUSES: ThreatStatus[] = ['open', 'mitigated', 'unknown'];
const CATEGORIES: ThreatCategory[] = ['S', 'T', 'R', 'I', 'D', 'E'];

export interface ElementGroup {
  targetType: ThreatTargetType;
  targetId: string;
  viewId: string;
  label: string;
  threats: Threat[];
}

// Groups threats by (viewId, targetType, targetId) — the same element can
// appear in more than one view, and two different elements can share a
// display label, so grouping (and any React key derived from a group) must
// use this triple, never the label alone. Exported so SecurityReportDialog
// reuses this exact grouping instead of re-implementing it (P2b review
// follow-up).
export const groupThreatsByElement = (
  threats: Threat[],
  resolveElementLabel: NonNullable<SecurityReportInput['resolveElementLabel']>
): ElementGroup[] => {
  const groups = new Map<string, ElementGroup>();

  threats.forEach((threat) => {
    const key = `${threat.viewId}:${threat.targetType}:${threat.targetId}`;
    const existing = groups.get(key);

    if (existing) {
      existing.threats.push(threat);
      return;
    }

    groups.set(key, {
      targetType: threat.targetType,
      targetId: threat.targetId,
      viewId: threat.viewId,
      label: resolveElementLabel(
        threat.targetType,
        threat.targetId,
        threat.viewId
      ),
      threats: [threat]
    });
  });

  return [...groups.values()];
};

const countBy = <T extends string>(
  values: T[],
  keys: readonly T[]
): Record<T, number> => {
  const counts = keys.reduce(
    (acc, key) => {
      return { ...acc, [key]: 0 };
    },
    {} as Record<T, number>
  );

  values.forEach((value) => {
    counts[value] += 1;
  });

  return counts;
};

const buildSummary = (issues: Issue[], threats: Threat[]) => {
  return {
    issues: {
      total: issues.length,
      bySeverity: countBy(
        issues.map((issue) => {
          return issue.severity;
        }),
        SEVERITIES
      )
    },
    threats: {
      total: threats.length,
      byStatus: countBy(
        threats.map((threat) => {
          return threat.status;
        }),
        STATUSES
      ),
      byCategory: CATEGORIES.reduce(
        (acc, category) => {
          const categoryThreats = threats.filter((threat) => {
            return threat.category === category;
          });

          return {
            ...acc,
            [category]: countBy(
              categoryThreats.map((threat) => {
                return threat.status;
              }),
              STATUSES
            )
          };
        },
        {} as Record<ThreatCategory, Record<ThreatStatus, number>>
      )
    }
  };
};

const defaultResolveElementLabel: NonNullable<
  SecurityReportInput['resolveElementLabel']
> = (_targetType, targetId) => {
  return targetId;
};

export const buildSecurityReportMarkdown = (
  input: SecurityReportInput
): string => {
  const resolveElementLabel =
    input.resolveElementLabel ?? defaultResolveElementLabel;
  const summary = buildSummary(input.issues, input.threats);
  const elementGroups = groupThreatsByElement(
    input.threats,
    resolveElementLabel
  );

  const lines: string[] = [];

  lines.push(`# Security report — ${input.diagramTitle ?? 'Untitled diagram'}`);
  lines.push('');
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(
    `- Issues: ${summary.issues.total} (${summary.issues.bySeverity.error} error, ${summary.issues.bySeverity.warning} warning, ${summary.issues.bySeverity.info} info)`
  );
  lines.push(
    `- Threats: ${summary.threats.total} (${summary.threats.byStatus.open} open, ${summary.threats.byStatus.mitigated} mitigated, ${summary.threats.byStatus.unknown} unknown)`
  );
  lines.push('');

  lines.push('### Threats by STRIDE category and status');
  lines.push('');
  lines.push('| Category | Open | Mitigated | Unknown |');
  lines.push('|---|---|---|---|');
  CATEGORIES.forEach((category) => {
    const counts = summary.threats.byCategory[category];
    lines.push(
      `| ${category} | ${counts.open} | ${counts.mitigated} | ${counts.unknown} |`
    );
  });
  lines.push('');

  lines.push('## Threats by element');
  lines.push('');
  if (elementGroups.length === 0) {
    lines.push('No threats generated.');
    lines.push('');
  }
  elementGroups.forEach((group) => {
    lines.push(
      `### ${group.label} (${group.targetType}, view ${group.viewId})`
    );
    lines.push('');
    group.threats.forEach((threat) => {
      lines.push(
        `- [${threat.status.toUpperCase()}] **${threat.category}** — ${threat.title}: ${threat.description} _Mitigation: ${threat.mitigationHint}_`
      );
    });
    lines.push('');
  });

  lines.push('## Compliance matrix');
  lines.push('');
  const byFramework = new Map<string, ControlMapping[]>();
  input.controlMappings.forEach((mapping) => {
    const key = `${mapping.control.framework} (${mapping.control.version})`;
    const list = byFramework.get(key) ?? [];
    list.push(mapping);
    byFramework.set(key, list);
  });

  [...byFramework.entries()].forEach(([frameworkLabel, mappings]) => {
    lines.push(`### ${frameworkLabel}`);
    lines.push('');
    lines.push('| Control | Title | Findings |');
    lines.push('|---|---|---|');
    mappings.forEach((mapping) => {
      lines.push(
        `| ${mapping.control.controlId} | ${mapping.control.title} | ${mapping.findings.length} |`
      );
    });
    lines.push('');
  });

  return lines.join('\n');
};

export const buildSecurityReportJson = (input: SecurityReportInput): string => {
  const resolveElementLabel =
    input.resolveElementLabel ?? defaultResolveElementLabel;
  const summary = buildSummary(input.issues, input.threats);
  const elementGroups = groupThreatsByElement(
    input.threats,
    resolveElementLabel
  );

  const report = {
    generatedAt: input.generatedAt,
    diagramTitle: input.diagramTitle ?? 'Untitled diagram',
    summary,
    threatsByElement: elementGroups.map((group) => {
      return {
        targetType: group.targetType,
        targetId: group.targetId,
        viewId: group.viewId,
        label: group.label,
        threats: group.threats.map((threat) => {
          return {
            id: threat.id,
            category: threat.category,
            status: threat.status,
            title: threat.title,
            description: threat.description,
            mitigationHint: threat.mitigationHint
          };
        })
      };
    }),
    complianceMatrix: input.controlMappings.map((mapping) => {
      return {
        framework: mapping.control.framework,
        version: mapping.control.version,
        controlId: mapping.control.controlId,
        title: mapping.control.title,
        findingsCount: mapping.findings.length,
        findings: mapping.findings
      };
    })
  };

  return JSON.stringify(report, null, 2);
};
