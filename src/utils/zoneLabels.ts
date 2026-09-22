// Display labels for zone kind/visibility (P0 containment zones). Shared by
// RectangleControls (the "Zone" section), the canvas zone label
// (SceneLayers/Rectangles/Rectangle.tsx) and NodeSettings' "Located in" line
// so all three read the same copy instead of drifting.
import { ZoneKind, ZoneVisibility } from 'src/types';

export const ZONE_KIND_LABELS: Record<ZoneKind, string> = {
  account: 'Account',
  region: 'Region',
  vpc: 'VPC',
  az: 'Availability zone',
  subnet: 'Subnet',
  securityGroup: 'Security group',
  cluster: 'Cluster',
  onPrem: 'On-prem'
};

export const ZONE_VISIBILITY_LABELS: Record<ZoneVisibility, string> = {
  public: 'Public',
  private: 'Private'
};
