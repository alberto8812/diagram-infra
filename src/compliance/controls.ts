// Pure compliance mapping (P2: threat modeling + compliance mapping).
//
// IMPORTANT — this mapping is indicative, not authoritative. Control ids,
// titles and applicability below are a best-effort correlation between this
// tool's lint rules / STRIDE categories and publicly documented framework
// controls; they must be verified against the official framework text
// (SOC 2 2017 Trust Services Criteria, ISO/IEC 27001:2022 Annex A, PCI DSS
// v4.0) before being used for an actual audit or attestation.
//
// CIS AWS Foundations Benchmark is deliberately omitted: its control
// numbering differs across published versions (v1.2/v1.4/v1.5/v2.0/v3.0)
// and this module can't name specific control ids for it with confidence.
import { Issue, RuleSeverity } from 'src/rules/types';
import { Threat, ThreatCategory, ThreatTargetType } from 'src/security/threats';

export type ComplianceFramework = 'SOC2' | 'ISO27001' | 'PCI_DSS';

export interface ComplianceControl {
  framework: ComplianceFramework;
  version: string;
  controlId: string;
  title: string;
}

export interface ComplianceFinding {
  source: 'rule' | 'threat';
  // `ruleId` for a rule finding, the STRIDE category letter for a threat
  // finding — kept as a single field so a report can key/group on it
  // without a discriminated-union dance.
  origin: string;
  severity?: RuleSeverity;
  message: string;
  viewId: string;
  targetType: ThreatTargetType;
  targetId: string;
}

export interface ControlMapping {
  control: ComplianceControl;
  findings: ComplianceFinding[];
}

// The full control catalog — every control this module knows about, listed
// even when a diagram currently has zero findings against it (a compliance
// matrix is more useful showing "clean" controls too, not just gaps).
export const CONTROLS: ComplianceControl[] = [
  {
    framework: 'SOC2',
    version: '2017 TSC',
    controlId: 'CC6.1',
    title:
      'Logical access security measures restrict access to authorized users'
  },
  {
    framework: 'SOC2',
    version: '2017 TSC',
    controlId: 'CC6.6',
    title:
      'The entity protects against threats from outside its system boundaries'
  },
  {
    framework: 'SOC2',
    version: '2017 TSC',
    controlId: 'CC6.7',
    title:
      'Transmission, movement and removal of information is restricted to authorized users/processes'
  },
  {
    framework: 'SOC2',
    version: '2017 TSC',
    controlId: 'CC7.2',
    title:
      'The entity monitors system components for anomalies indicative of security events'
  },
  {
    framework: 'SOC2',
    version: '2017 TSC',
    controlId: 'A1.2',
    title:
      'Environmental protections, backup and recovery infrastructure support availability commitments'
  },
  {
    framework: 'ISO27001',
    version: '2022 Annex A',
    controlId: '5.9',
    title: 'Inventory of information and other associated assets'
  },
  {
    framework: 'ISO27001',
    version: '2022 Annex A',
    controlId: '5.12',
    title: 'Classification of information'
  },
  {
    framework: 'ISO27001',
    version: '2022 Annex A',
    controlId: '8.13',
    title: 'Information backup'
  },
  {
    framework: 'ISO27001',
    version: '2022 Annex A',
    controlId: '8.14',
    title: 'Redundancy of information processing facilities'
  },
  {
    framework: 'ISO27001',
    version: '2022 Annex A',
    controlId: '8.20',
    title: 'Networks security'
  },
  {
    framework: 'ISO27001',
    version: '2022 Annex A',
    controlId: '8.22',
    title: 'Segregation of networks'
  },
  {
    framework: 'ISO27001',
    version: '2022 Annex A',
    controlId: '8.24',
    title: 'Use of cryptography'
  },
  {
    framework: 'PCI_DSS',
    version: 'v4.0',
    controlId: '1.3',
    title:
      'Network access to and from the cardholder data environment is restricted'
  },
  {
    framework: 'PCI_DSS',
    version: 'v4.0',
    controlId: '1.4',
    title:
      'Network connections between trusted and untrusted networks are controlled'
  },
  {
    framework: 'PCI_DSS',
    version: 'v4.0',
    controlId: '3.5',
    title: 'Primary account number (PAN) is secured wherever it is stored'
  },
  {
    framework: 'PCI_DSS',
    version: 'v4.0',
    controlId: '4.2',
    title: 'PAN is protected with strong cryptography during transmission'
  },
  {
    framework: 'PCI_DSS',
    version: 'v4.0',
    controlId: '8.3',
    title:
      'Strong authentication for users and administrators is established and managed'
  },
  {
    framework: 'PCI_DSS',
    version: 'v4.0',
    controlId: '10.2',
    title: 'Audit logs support detection of anomalies and suspicious activity'
  }
];

const controlKey = (framework: ComplianceFramework, controlId: string) => {
  return `${framework}:${controlId}`;
};

// Which controls a lint rule (src/rules/catalog.ts) speaks to. A rule id
// missing from this table maps to no control.
const RULE_ID_TO_CONTROLS: Record<string, [ComplianceFramework, string][]> = {
  'zone-partial-overlap': [['ISO27001', '8.22']],
  'datastore-in-public-zone': [
    ['SOC2', 'CC6.1'],
    ['SOC2', 'CC6.6'],
    ['ISO27001', '8.20'],
    ['ISO27001', '8.22'],
    ['PCI_DSS', '1.3']
  ],
  'prod-without-owner': [['ISO27001', '5.9']],
  'prod-database-single-az': [
    ['SOC2', 'A1.2'],
    ['ISO27001', '8.14']
  ],
  'plaintext-across-zones': [
    ['SOC2', 'CC6.7'],
    ['ISO27001', '8.24'],
    ['PCI_DSS', '4.2']
  ],
  'cross-vpc-without-gateway': [
    ['SOC2', 'CC6.6'],
    ['ISO27001', '8.20'],
    ['ISO27001', '8.22'],
    ['PCI_DSS', '1.3'],
    ['PCI_DSS', '1.4']
  ],
  'public-ingress-without-auth': [
    ['SOC2', 'CC6.1'],
    ['PCI_DSS', '8.3']
  ],
  'missing-environment': [['ISO27001', '5.9']],
  'sensitive-datastore-unencrypted': [
    ['SOC2', 'CC6.1'],
    ['ISO27001', '5.12'],
    ['ISO27001', '8.24'],
    ['PCI_DSS', '3.5']
  ],
  'sensitive-flow-unencrypted': [
    ['SOC2', 'CC6.7'],
    ['ISO27001', '8.24'],
    ['PCI_DSS', '4.2']
  ]
};

// Which controls an *open* threat's STRIDE category speaks to. Mitigated
// and unknown-status threats never contribute compliance findings — only a
// confirmed gap does.
const CATEGORY_TO_CONTROLS: Record<
  ThreatCategory,
  [ComplianceFramework, string][]
> = {
  S: [
    ['SOC2', 'CC6.1'],
    ['PCI_DSS', '8.3']
  ],
  T: [
    ['SOC2', 'CC6.7'],
    ['ISO27001', '8.24']
  ],
  R: [
    ['SOC2', 'CC7.2'],
    ['PCI_DSS', '10.2']
  ],
  I: [
    ['SOC2', 'CC6.7'],
    ['ISO27001', '5.12'],
    ['ISO27001', '8.24'],
    ['PCI_DSS', '3.5'],
    ['PCI_DSS', '4.2']
  ],
  D: [
    ['SOC2', 'A1.2'],
    ['ISO27001', '8.14']
  ],
  E: [
    ['SOC2', 'CC6.1'],
    ['PCI_DSS', '8.3']
  ]
};

// Every control in CONTROLS, each with the findings (from lint issues and
// open threats) that speak to it — possibly empty. Order follows CONTROLS.
export const mapFindingsToControls = (
  issues: Issue[],
  threats: Threat[]
): ControlMapping[] => {
  const findingsByKey = new Map<string, ComplianceFinding[]>();

  const addFinding = (
    framework: ComplianceFramework,
    controlId: string,
    finding: ComplianceFinding
  ) => {
    const key = controlKey(framework, controlId);
    const findings = findingsByKey.get(key) ?? [];
    findings.push(finding);
    findingsByKey.set(key, findings);
  };

  issues.forEach((issue) => {
    const controls = RULE_ID_TO_CONTROLS[issue.ruleId] ?? [];
    const primaryTarget = issue.targets[0];

    controls.forEach(([framework, controlId]) => {
      addFinding(framework, controlId, {
        source: 'rule',
        origin: issue.ruleId,
        severity: issue.severity,
        message: issue.message,
        viewId: issue.viewId,
        targetType:
          primaryTarget?.type === 'RECTANGLE'
            ? 'ITEM'
            : (primaryTarget?.type ?? 'ITEM'),
        targetId: primaryTarget?.id ?? ''
      });
    });
  });

  threats
    .filter((threat) => {
      return threat.status === 'open';
    })
    .forEach((threat) => {
      const controls = CATEGORY_TO_CONTROLS[threat.category] ?? [];

      controls.forEach(([framework, controlId]) => {
        addFinding(framework, controlId, {
          source: 'threat',
          origin: threat.category,
          message: threat.title,
          viewId: threat.viewId,
          targetType: threat.targetType,
          targetId: threat.targetId
        });
      });
    });

  return CONTROLS.map((control) => {
    return {
      control,
      findings:
        findingsByKey.get(controlKey(control.framework, control.controlId)) ??
        []
    };
  });
};
