import { Issue } from 'src/rules';
import { ControlMapping } from 'src/compliance/controls';
import { Threat } from '../threats';
import {
  buildSecurityReportJson,
  buildSecurityReportMarkdown
} from '../report';

const issue: Issue = {
  ruleId: 'sensitive-datastore-unencrypted',
  severity: 'error',
  message: 'db1 is not encrypted at rest',
  viewId: 'v1',
  targets: [{ type: 'ITEM', id: 'db1' }]
};

const openThreat: Threat = {
  id: 'v1:ITEM:db1:I',
  category: 'I',
  targetType: 'ITEM',
  targetId: 'db1',
  viewId: 'v1',
  title: 'Information disclosure from "db1"',
  description: 'db1 is classified confidential but not encrypted at rest.',
  status: 'open',
  mitigationHint: 'Enable encryption at rest.'
};

const mitigatedThreat: Threat = {
  id: 'v1:CONNECTOR:c1:T',
  category: 'T',
  targetType: 'CONNECTOR',
  targetId: 'c1',
  viewId: 'v1',
  title: 'Tampering with data from "svc1" to "db1"',
  description: 'Encrypted in transit.',
  status: 'mitigated',
  mitigationHint: 'Keep using an encrypted transport.'
};

const controlMappings: ControlMapping[] = [
  {
    control: {
      framework: 'ISO27001',
      version: '2022 Annex A',
      controlId: '8.24',
      title: 'Use of cryptography'
    },
    findings: [
      {
        source: 'threat',
        origin: 'I',
        message: openThreat.title,
        viewId: 'v1',
        targetType: 'ITEM',
        targetId: 'db1'
      }
    ]
  },
  {
    control: {
      framework: 'SOC2',
      version: '2017 TSC',
      controlId: 'CC6.1',
      title: 'Logical access security measures'
    },
    findings: []
  }
];

describe('buildSecurityReportMarkdown()', () => {
  test('includes the diagram title, generated date and summary counts', () => {
    const markdown = buildSecurityReportMarkdown({
      generatedAt: '2026-09-22T00:00:00.000Z',
      diagramTitle: 'Test diagram',
      issues: [issue],
      threats: [openThreat, mitigatedThreat],
      controlMappings
    });

    expect(markdown).toContain('# Security report — Test diagram');
    expect(markdown).toContain('Generated: 2026-09-22T00:00:00.000Z');
    expect(markdown).toContain('Issues: 1 (1 error, 0 warning, 0 info)');
    expect(markdown).toContain('Threats: 2 (1 open, 1 mitigated, 0 unknown)');
  });

  test('groups threats by element and renders the compliance matrix', () => {
    const markdown = buildSecurityReportMarkdown({
      generatedAt: '2026-09-22T00:00:00.000Z',
      issues: [],
      threats: [openThreat],
      controlMappings,
      resolveElementLabel: (targetType, targetId) => {
        return `${targetType}:${targetId}`;
      }
    });

    expect(markdown).toContain('### ITEM:db1 (ITEM, view v1)');
    expect(markdown).toContain('[OPEN] **I**');
    expect(markdown).toContain('### ISO27001 (2022 Annex A)');
    expect(markdown).toContain('| 8.24 | Use of cryptography | 1 |');
    expect(markdown).toContain('### SOC2 (2017 TSC)');
    expect(markdown).toContain(
      '| CC6.1 | Logical access security measures | 0 |'
    );
  });

  test('reports no threats generated when the threat list is empty', () => {
    const markdown = buildSecurityReportMarkdown({
      generatedAt: '2026-09-22T00:00:00.000Z',
      issues: [],
      threats: [],
      controlMappings: []
    });

    expect(markdown).toContain('No threats generated.');
  });

  test('defaults the element label to the raw target id when no resolver is given', () => {
    const markdown = buildSecurityReportMarkdown({
      generatedAt: '2026-09-22T00:00:00.000Z',
      issues: [],
      threats: [openThreat],
      controlMappings: []
    });

    expect(markdown).toContain('### db1 (ITEM, view v1)');
  });
});

describe('buildSecurityReportJson()', () => {
  test('produces parseable JSON with the expected summary and grouping', () => {
    const json = buildSecurityReportJson({
      generatedAt: '2026-09-22T00:00:00.000Z',
      diagramTitle: 'Test diagram',
      issues: [issue],
      threats: [openThreat, mitigatedThreat],
      controlMappings
    });

    const parsed = JSON.parse(json);

    expect(parsed.diagramTitle).toBe('Test diagram');
    expect(parsed.summary.issues.total).toBe(1);
    expect(parsed.summary.threats.total).toBe(2);
    expect(parsed.summary.threats.byStatus).toStrictEqual({
      open: 1,
      mitigated: 1,
      unknown: 0
    });
    expect(parsed.summary.threats.byCategory.I.open).toBe(1);
    expect(parsed.summary.threats.byCategory.T.mitigated).toBe(1);

    expect(parsed.threatsByElement).toHaveLength(2);
    const dbGroup = parsed.threatsByElement.find((g: { targetId: string }) => {
      return g.targetId === 'db1';
    });
    expect(dbGroup.threats).toHaveLength(1);
    expect(dbGroup.threats[0].category).toBe('I');

    expect(parsed.complianceMatrix).toHaveLength(2);
    const iso824 = parsed.complianceMatrix.find((c: { controlId: string }) => {
      return c.controlId === '8.24';
    });
    expect(iso824.findingsCount).toBe(1);
  });

  test('defaults diagramTitle to "Untitled diagram" when not given', () => {
    const parsed = JSON.parse(
      buildSecurityReportJson({
        generatedAt: '2026-09-22T00:00:00.000Z',
        issues: [],
        threats: [],
        controlMappings: []
      })
    );

    expect(parsed.diagramTitle).toBe('Untitled diagram');
  });
});
