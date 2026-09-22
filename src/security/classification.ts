// Single source of truth for two business sets used across the rule engine
// and the threat model (P2b review follow-up): which resource `kind`s count
// as data stores, and which `dataClassification`s count as sensitive.
// Previously duplicated in src/rules/sensitiveDatastoreUnencrypted.ts,
// src/rules/sensitiveFlowUnencrypted.ts and src/security/threats.ts — kept
// here so a change to either set only needs to happen once.
//
// src/rules/datastoreInPublicZone.ts intentionally keeps its own narrower
// set (no `queue`): a queue doesn't sit "in a subnet" the way the public-zone
// rule reasons about, so it isn't included there on purpose.
import { DataClassification, ResourceKind } from 'src/types';

export const DATA_STORE_KINDS: ReadonlySet<ResourceKind> = new Set([
  'database',
  'cache',
  'storage',
  'queue'
]);

export const SENSITIVE_CLASSIFICATIONS: ReadonlySet<DataClassification> =
  new Set(['confidential', 'restricted']);

export const isDataStoreKind = (kind: ResourceKind | undefined): boolean => {
  return kind !== undefined && DATA_STORE_KINDS.has(kind);
};

export const isSensitiveClassification = (
  classification: DataClassification | undefined
): boolean => {
  return (
    classification !== undefined &&
    SENSITIVE_CLASSIFICATIONS.has(classification)
  );
};
