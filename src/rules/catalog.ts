// The architecture rule catalog (P1). Order here is the deterministic rule
// order lintView()/lintDiagram() run in (src/rules/engine.ts) — keep new
// rules appended, never reordered, so issue ordering stays stable release
// to release.
import { RuleDefinition } from './types';
import { zonePartialOverlapRule } from './zonePartialOverlap';
import { datastoreInPublicZoneRule } from './datastoreInPublicZone';
import { prodWithoutOwnerRule } from './prodWithoutOwner';
import { prodDatabaseSingleAzRule } from './prodDatabaseSingleAz';
import { plaintextAcrossZonesRule } from './plaintextAcrossZones';
import { crossVpcWithoutGatewayRule } from './crossVpcWithoutGateway';
import { publicIngressWithoutAuthRule } from './publicIngressWithoutAuth';
import { missingEnvironmentRule } from './missingEnvironment';
import { sensitiveDatastoreUnencryptedRule } from './sensitiveDatastoreUnencrypted';
import { sensitiveFlowUnencryptedRule } from './sensitiveFlowUnencrypted';

export const RULES: RuleDefinition[] = [
  zonePartialOverlapRule,
  datastoreInPublicZoneRule,
  prodWithoutOwnerRule,
  prodDatabaseSingleAzRule,
  plaintextAcrossZonesRule,
  crossVpcWithoutGatewayRule,
  publicIngressWithoutAuthRule,
  missingEnvironmentRule,
  sensitiveDatastoreUnencryptedRule,
  sensitiveFlowUnencryptedRule
];
