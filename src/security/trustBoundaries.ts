// Pure helper (P2: threat modeling + compliance mapping). Not every typed
// zone (src/schemas/rectangle.ts) is a meaningful security perimeter: a
// `region` or `az` groups resources geographically/for redundancy, but
// doesn't gate network reachability the way an account, VPC, subnet,
// security group, cluster boundary or on-prem/cloud split does. This
// narrows crossesZoneBoundary() (src/utils/containment.ts) down to the zone
// kinds that count as trust boundaries for STRIDE purposes.
import { Connector, View, ZoneKind } from 'src/types';
import { crossesZoneBoundary, ZoneRectangle } from 'src/utils/containment';

export const TRUST_BOUNDARY_ZONE_KINDS: ReadonlySet<ZoneKind> = new Set([
  'account',
  'vpc',
  'subnet',
  'securityGroup',
  'cluster',
  'onPrem'
]);

const dedupeById = (zones: ZoneRectangle[]): ZoneRectangle[] => {
  const seen = new Set<string>();

  return zones.filter((zone) => {
    if (seen.has(zone.id)) return false;
    seen.add(zone.id);
    return true;
  });
};

// The trust-boundary zones a connector crosses between its first and last
// anchor (entered and left, deduplicated) — the subset of
// crossesZoneBoundary()'s result whose zone kind is a trust boundary. An
// empty array means the connector never leaves a trust boundary (or both
// endpoints fall outside every trust-boundary zone).
export const getTrustBoundariesCrossed = (
  view: View,
  connector: Pick<Connector, 'anchors'>
): ZoneRectangle[] => {
  const crossing = crossesZoneBoundary(view, connector);

  return dedupeById([...crossing.entered, ...crossing.left]).filter((zone) => {
    return TRUST_BOUNDARY_ZONE_KINDS.has(zone.zone);
  });
};
