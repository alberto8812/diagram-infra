// Pure types for the architecture rule engine (P1). A RuleDefinition's
// check() receives a precomputed RuleContext (see src/rules/engine.ts) and
// returns the Issues it finds; nothing here depends on React or the stores.
import { Connector, ConnectorAnchor, ModelItem, View } from 'src/types';
import {
  ZoneCrossing,
  ZoneOverlap,
  ZoneRectangle
} from 'src/utils/containment';

export type RuleSeverity = 'error' | 'warning' | 'info';

export type IssueTargetType = 'ITEM' | 'CONNECTOR' | 'RECTANGLE';

export interface IssueTarget {
  type: IssueTargetType;
  id: string;
}

export interface Issue {
  ruleId: string;
  severity: RuleSeverity;
  message: string;
  viewId: string;
  targets: IssueTarget[];
}

// The rule engine only ever reads a model's items and views — never icons,
// colors, title or flows — so it takes this narrower shape instead of the
// full Model type. A full Model (e.g. src/fixtures/model.ts, or the model
// held by the model store) satisfies this structurally, no conversion
// needed.
export interface LintableModel {
  items: ModelItem[];
  views: View[];
}

export interface ConnectorEndpoints {
  from?: ModelItem;
  to?: ModelItem;
}

export interface ConnectorZones {
  from: ZoneRectangle[];
  to: ZoneRectangle[];
}

// Precomputed per-view context handed to every rule's check(). Wraps
// src/utils/containment.ts (and the anchor resolution src/utils/renderer.ts
// already provides) so individual rules never re-derive containment or
// anchor chains themselves.
export interface RuleContext {
  model: LintableModel;
  view: View;
  // Zone rectangles of this view only (src/utils/containment.ts).
  zones: ZoneRectangle[];
  itemsById: Map<string, ModelItem>;
  // Zones containing a view item's tile, innermost to outermost.
  getItemZones: (itemId: string) => ZoneRectangle[];
  getZoneParent: (zoneId: string) => ZoneRectangle | undefined;
  // Every partially-overlapping zone pair in this view (computed once).
  partialOverlaps: ZoneOverlap[];
  // Zones entered/left between a connector's first and last anchor.
  crossesZoneBoundary: (connector: Pick<Connector, 'anchors'>) => ZoneCrossing;
  // The zones containing each endpoint's tile directly (not just the
  // entered/left diff) — needed to tell "outside every zone" apart from
  // "inside a zone that also contains the other endpoint".
  connectorZones: (
    connector: Pick<Connector, 'anchors'>
  ) => ConnectorZones | undefined;
  // Resolves a connector anchor to the model item it ultimately points at,
  // following anchor-to-anchor chains. Undefined for a free-floating tile
  // anchor, a dangling reference, or a reference that never resolves.
  resolveAnchorItem: (anchor: ConnectorAnchor) => ModelItem | undefined;
  // Convenience over resolveAnchorItem for a connector's first/last anchor.
  connectorEndpoints: (connector: Connector) => ConnectorEndpoints;
}

export interface RuleDefinition {
  id: string;
  title: string;
  description: string;
  severity: RuleSeverity;
  rationale: string;
  check: (ctx: RuleContext) => Issue[];
}
