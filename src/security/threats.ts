// Pure STRIDE threat generator (P2: threat modeling + compliance mapping).
// Classifies each modeled element into a STRIDE element type, then applies
// a small rule table per (element type, category) to decide a status:
// - 'open': a modeled attribute indicates the risk applies and isn't
//   mitigated.
// - 'mitigated': a modeled attribute indicates the risk is addressed.
// - 'unknown': no rule in the table can decide either way from what's
//   modeled — this is the default for anything not explicitly covered
//   below, and is itself a meaningful, honest answer (not noise): it tells
//   the report "add more model detail to get a verdict here" rather than
//   silently assuming safe.
//
// Elements without a `kind` are skipped entirely (nothing to classify them
// by) — connectors are the one exception, since they never carry a `kind`
// but are always meaningful as STRIDE data flows.
import {
  Connector,
  DataClassification,
  ModelItem,
  ResourceKind,
  View
} from 'src/types';
import { buildRuleContext } from 'src/rules/engine';
import { LintableModel } from 'src/rules/types';
import { isEncryptedInTransit } from './encryption';
import { getTrustBoundariesCrossed } from './trustBoundaries';

export type ThreatCategory = 'S' | 'T' | 'R' | 'I' | 'D' | 'E';
export type ThreatStatus = 'mitigated' | 'open' | 'unknown';
export type ThreatTargetType = 'ITEM' | 'CONNECTOR';

export interface Threat {
  // Deterministic: `${viewId}:${targetType}:${targetId}:${category}`.
  id: string;
  category: ThreatCategory;
  targetType: ThreatTargetType;
  targetId: string;
  viewId: string;
  title: string;
  description: string;
  status: ThreatStatus;
  mitigationHint: string;
}

interface CategoryFinding {
  category: ThreatCategory;
  status: ThreatStatus;
  title: string;
  description: string;
  mitigationHint: string;
}

type ElementClass = 'externalEntity' | 'process' | 'dataStore';

const EXTERNAL_ENTITY_KINDS: ReadonlySet<ResourceKind> = new Set([
  'user',
  'external'
]);

const DATA_STORE_KINDS: ReadonlySet<ResourceKind> = new Set([
  'database',
  'cache',
  'storage',
  'queue'
]);

const SENSITIVE_CLASSIFICATIONS: ReadonlySet<DataClassification> = new Set([
  'confidential',
  'restricted'
]);

// STRIDE-per-element: which categories are even meaningful for each
// element/flow type. Kept here as a comment for readability — the concrete
// finding builders below (externalEntityFindings/dataStoreFindings/
// processFindings/dataFlowFindings) are the actual rule table, each one
// only ever emitting from its own fixed category set:
// external entity S,R; process S,T,R,I,D,E; data store T,R,I,D; data flow T,I,D.

const classifyItem = (item: ModelItem): ElementClass | undefined => {
  if (!item.kind) return undefined;
  if (EXTERNAL_ENTITY_KINDS.has(item.kind)) return 'externalEntity';
  if (DATA_STORE_KINDS.has(item.kind)) return 'dataStore';
  return 'process';
};

const externalEntityFindings = (item: ModelItem): CategoryFinding[] => {
  return [
    {
      category: 'S',
      status: 'unknown',
      title: `Spoofing "${item.name}"`,
      description: `"${item.name}" represents an external actor. Nothing in the model records how the systems it talks to verify its identity.`,
      mitigationHint:
        'Confirm the systems this actor talks to authenticate it (see the connector auth setting), and document how.'
    },
    {
      category: 'R',
      status: 'unknown',
      title: `Repudiation by "${item.name}"`,
      description: `Actions taken by "${item.name}" aren't traceable from this model alone.`,
      mitigationHint:
        'Ensure actions by this actor are logged with enough detail to attribute them after the fact.'
    }
  ];
};

// Resolves the data store's Information disclosure (I) status/description:
// unknown when there's no confidential/restricted classification to judge
// by, otherwise mitigated/open depending on encryptedAtRest.
const dataStoreIStatus = (
  isSensitive: boolean,
  encrypted: boolean
): ThreatStatus => {
  if (!isSensitive) return 'unknown';
  return encrypted ? 'mitigated' : 'open';
};

const dataStoreIDescription = (
  item: ModelItem,
  isSensitive: boolean,
  encrypted: boolean
): string => {
  if (!isSensitive) {
    return `"${item.name}" has no confidential/restricted data classification set, so exposure risk can't be assessed.`;
  }

  if (encrypted) {
    return `"${item.name}" is classified "${item.dataClassification}" and is marked as encrypted at rest.`;
  }

  return `"${item.name}" is classified "${item.dataClassification}" but is not marked as encrypted at rest.`;
};

const dataStoreFindings = (item: ModelItem): CategoryFinding[] => {
  const isSensitive =
    item.dataClassification !== undefined &&
    SENSITIVE_CLASSIFICATIONS.has(item.dataClassification);
  const encrypted = item.encryptedAtRest === true;

  const iStatus = dataStoreIStatus(isSensitive, encrypted);
  const iDescription = dataStoreIDescription(item, isSensitive, encrypted);

  return [
    {
      category: 'T',
      status: 'unknown',
      title: `Tampering with data in "${item.name}"`,
      description: `Integrity controls (write access restrictions, checksums) for "${item.name}" aren't modeled.`,
      mitigationHint:
        'Restrict write access and consider integrity checks for stored data.'
    },
    {
      category: 'R',
      status: 'unknown',
      title: `Repudiation of access to "${item.name}"`,
      description: `Access/audit logging for "${item.name}" isn't modeled.`,
      mitigationHint:
        'Enable and retain access logs/audit trails for this data store.'
    },
    {
      category: 'I',
      status: iStatus,
      title: `Information disclosure from "${item.name}"`,
      description: iDescription,
      mitigationHint:
        'Classify the data and enable encryption at rest for confidential/restricted data stores.'
    },
    {
      category: 'D',
      status: 'unknown',
      title: `Denial of service against "${item.name}"`,
      description: `Availability controls (backups, redundancy, rate limiting) for "${item.name}" aren't modeled.`,
      mitigationHint:
        'Document backup/redundancy and any throttling in front of this data store.'
    }
  ];
};

// Resolves the process's Spoofing (S) / Elevation of privilege (E)
// status/description, both driven by the same internetFacing + inbound-auth
// signal (see the spec comment on processFindings below).
const processSEStatus = (
  hasOpenAuthGap: boolean,
  hasAuthenticatedInbound: boolean
): ThreatStatus => {
  if (hasOpenAuthGap) return 'open';
  if (hasAuthenticatedInbound) return 'mitigated';
  return 'unknown';
};

const processSEDescription = (
  item: ModelItem,
  hasOpenAuthGap: boolean,
  hasAuthenticatedInbound: boolean
): string => {
  if (hasOpenAuthGap) {
    return `"${item.name}" is internet-facing and accepts at least one inbound connection with no authentication across a trust boundary.`;
  }

  if (hasAuthenticatedInbound) {
    return `"${item.name}" is internet-facing, but every inbound connection crossing a trust boundary requires authentication.`;
  }

  return `Whether "${item.name}"'s inbound connections are authenticated isn't fully modeled.`;
};

const processFindings = (
  item: ModelItem,
  inboundConnectors: Connector[],
  view: View
): CategoryFinding[] => {
  const relevantInbound = inboundConnectors.filter((connector) => {
    return getTrustBoundariesCrossed(view, connector).length > 0;
  });

  const hasOpenAuthGap =
    item.internetFacing === true &&
    relevantInbound.some((connector) => {
      return connector.auth === 'none';
    });

  const hasAuthenticatedInbound =
    item.internetFacing === true &&
    relevantInbound.length > 0 &&
    relevantInbound.every((connector) => {
      return connector.auth !== undefined && connector.auth !== 'none';
    });

  const seStatus = processSEStatus(hasOpenAuthGap, hasAuthenticatedInbound);
  const seDescription = processSEDescription(
    item,
    hasOpenAuthGap,
    hasAuthenticatedInbound
  );

  return [
    {
      category: 'S',
      status: seStatus,
      title: `Spoofing "${item.name}"`,
      description: seDescription,
      mitigationHint:
        'Require authentication (token/mTLS/IAM) on every inbound connector that crosses a trust boundary.'
    },
    {
      category: 'T',
      status: 'unknown',
      title: `Tampering with "${item.name}"`,
      description: `Input validation/integrity controls for "${item.name}" aren't modeled.`,
      mitigationHint:
        'Validate and sanitize inputs; document integrity controls.'
    },
    {
      category: 'R',
      status: 'unknown',
      title: `Repudiation of actions on "${item.name}"`,
      description: `Audit logging for "${item.name}" isn't modeled.`,
      mitigationHint:
        'Log security-relevant actions with enough context to attribute them.'
    },
    {
      category: 'I',
      status: 'unknown',
      title: `Information disclosure from "${item.name}"`,
      description: `The sensitivity of data handled by "${item.name}" isn't recorded beyond its own attributes.`,
      mitigationHint:
        'Classify the data this service handles and restrict its exposure accordingly.'
    },
    {
      category: 'D',
      status: 'unknown',
      title: `Denial of service against "${item.name}"`,
      description: `Rate limiting/scaling controls for "${item.name}" aren't modeled.`,
      mitigationHint:
        'Document rate limiting, autoscaling or redundancy in front of this service.'
    },
    {
      category: 'E',
      status: seStatus,
      title: `Elevation of privilege via "${item.name}"`,
      description: seDescription,
      mitigationHint:
        'Require authentication and least-privilege authorization on every inbound connector that crosses a trust boundary.'
    }
  ];
};

// Tri-state -> ThreatStatus: undefined (no signal) is always 'unknown'.
const statusFromTriState = (
  value: boolean | undefined,
  whenTrue: ThreatStatus,
  whenFalse: ThreatStatus
): ThreatStatus => {
  if (value === undefined) return 'unknown';
  return value ? whenTrue : whenFalse;
};

const dataFlowDescription = (
  encrypted: boolean | undefined,
  fromLabel: string,
  toLabel: string
): string => {
  if (encrypted === undefined) {
    return `The connection from "${fromLabel}" to "${toLabel}" crosses a trust boundary and its transit encryption isn't determined from the modeled protocol/auth.`;
  }

  if (encrypted) {
    return `The connection from "${fromLabel}" to "${toLabel}" crosses a trust boundary and is encrypted in transit.`;
  }

  return `The connection from "${fromLabel}" to "${toLabel}" crosses a trust boundary and is not encrypted in transit.`;
};

// undefined when the connector never crosses a trust boundary — a flow
// that stays inside one perimeter isn't in-scope for these findings.
const dataFlowFindings = (
  connector: Connector,
  view: View,
  fromLabel: string,
  toLabel: string
): CategoryFinding[] | undefined => {
  const boundaries = getTrustBoundariesCrossed(view, connector);
  if (boundaries.length === 0) return undefined;

  const encrypted = isEncryptedInTransit(connector);
  const status = statusFromTriState(encrypted, 'mitigated', 'open');
  const description = dataFlowDescription(encrypted, fromLabel, toLabel);

  return [
    {
      category: 'T',
      status,
      title: `Tampering with data from "${fromLabel}" to "${toLabel}"`,
      description,
      mitigationHint:
        'Use an encrypted transport (HTTPS, mTLS) for any connector crossing a trust boundary.'
    },
    {
      category: 'I',
      status,
      title: `Information disclosure on the flow from "${fromLabel}" to "${toLabel}"`,
      description,
      mitigationHint:
        'Use an encrypted transport (HTTPS, mTLS) for any connector crossing a trust boundary.'
    },
    {
      category: 'D',
      status: 'unknown',
      title: `Denial of service against the flow from "${fromLabel}" to "${toLabel}"`,
      description: `Rate limiting/backpressure for this connector isn't modeled.`,
      mitigationHint:
        'Document rate limiting/backpressure for connectors crossing a trust boundary.'
    }
  ];
};

const toThreat = (
  finding: CategoryFinding,
  viewId: string,
  targetType: ThreatTargetType,
  targetId: string
): Threat => {
  return {
    id: `${viewId}:${targetType}:${targetId}:${finding.category}`,
    category: finding.category,
    targetType,
    targetId,
    viewId,
    title: finding.title,
    description: finding.description,
    status: finding.status,
    mitigationHint: finding.mitigationHint
  };
};

// All threats for one view, items in view.items order then connectors in
// view.connectors order — a fixed input order, so this is deterministic.
export const generateThreatsForView = (
  model: LintableModel,
  view: View
): Threat[] => {
  const ctx = buildRuleContext(model, view);
  const threats: Threat[] = [];

  const inboundByItemId = new Map<string, Connector[]>();
  (view.connectors ?? []).forEach((connector) => {
    const { to } = ctx.connectorEndpoints(connector);
    if (!to) return;

    const inbound = inboundByItemId.get(to.id) ?? [];
    inbound.push(connector);
    inboundByItemId.set(to.id, inbound);
  });

  view.items.forEach((viewItem) => {
    const item = ctx.itemsById.get(viewItem.id);
    if (!item) return;

    const elementClass = classifyItem(item);
    if (!elementClass) return;

    let findings: CategoryFinding[];
    if (elementClass === 'externalEntity') {
      findings = externalEntityFindings(item);
    } else if (elementClass === 'dataStore') {
      findings = dataStoreFindings(item);
    } else {
      findings = processFindings(
        item,
        inboundByItemId.get(item.id) ?? [],
        view
      );
    }

    findings.forEach((finding) => {
      threats.push(toThreat(finding, view.id, 'ITEM', item.id));
    });
  });

  (view.connectors ?? []).forEach((connector) => {
    const { from, to } = ctx.connectorEndpoints(connector);
    const findings = dataFlowFindings(
      connector,
      view,
      from?.name ?? '?',
      to?.name ?? '?'
    );
    if (!findings) return;

    findings.forEach((finding) => {
      threats.push(toThreat(finding, view.id, 'CONNECTOR', connector.id));
    });
  });

  return threats;
};

// All threats across every view of the model — view order (as given in
// model.views), then within-view order above. Both are fixed inputs, so
// this is deterministic for a given model.
export const generateThreats = (model: LintableModel): Threat[] => {
  return model.views.flatMap((view) => {
    return generateThreatsForView(model, view);
  });
};
