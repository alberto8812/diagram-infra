// Pure rule engine (P1): builds the per-view RuleContext every rule checks
// against, and runs the RULES catalog over a model's views in deterministic
// order. See src/rules/types.ts for the shapes and src/rules/catalog.ts for
// the concrete rule set.
import { Connector, ConnectorAnchor, ModelItem, View } from 'src/types';
import {
  crossesZoneBoundary as crossesZoneBoundaryInView,
  findPartialZoneOverlaps,
  getItemZones as getItemZonesInView,
  getZoneParent as getZoneParentInView,
  getZoneRectangles,
  getZonesForTile
} from 'src/utils/containment';
import { getAllAnchors, getAnchorTile } from 'src/utils/renderer';
import { RULES } from './catalog';
import { Issue, LintableModel, RuleContext } from './types';

// Follows an anchor's ref.anchor chain to the item it ultimately points at.
// `visited` guards against a malformed model chaining anchors into a cycle
// — bail instead of recursing forever, matching the "never throw out of a
// pure query helper" stance crossesZoneBoundary already takes.
const resolveAnchorItemInView = (
  anchor: ConnectorAnchor,
  view: View,
  itemsById: Map<string, ModelItem>,
  visited: Set<string>
): ModelItem | undefined => {
  if (anchor.ref.item) {
    return itemsById.get(anchor.ref.item);
  }

  if (anchor.ref.anchor) {
    if (visited.has(anchor.id)) return undefined;
    visited.add(anchor.id);

    const nextAnchor = getAllAnchors(view.connectors ?? []).find(
      (candidate) => {
        return candidate.id === anchor.ref.anchor;
      }
    );

    if (!nextAnchor) return undefined;

    return resolveAnchorItemInView(nextAnchor, view, itemsById, visited);
  }

  return undefined;
};

export const buildRuleContext = (
  model: LintableModel,
  view: View
): RuleContext => {
  const itemsById = new Map(
    model.items.map((item) => {
      return [item.id, item] as const;
    })
  );
  const zones = getZoneRectangles(view);
  const partialOverlaps = findPartialZoneOverlaps(view);

  const resolveAnchorItem = (anchor: ConnectorAnchor) => {
    return resolveAnchorItemInView(anchor, view, itemsById, new Set());
  };

  const connectorEndpoints = (connector: Connector) => {
    if (connector.anchors.length < 2) return {};

    return {
      from: resolveAnchorItem(connector.anchors[0]),
      to: resolveAnchorItem(connector.anchors[connector.anchors.length - 1])
    };
  };

  const connectorZones = (connector: Pick<Connector, 'anchors'>) => {
    if (connector.anchors.length < 2) return undefined;

    const fromAnchor = connector.anchors[0];
    const toAnchor = connector.anchors[connector.anchors.length - 1];

    try {
      const fromTile = getAnchorTile(fromAnchor, view);
      const toTile = getAnchorTile(toAnchor, view);

      return {
        from: getZonesForTile(view, fromTile),
        to: getZonesForTile(view, toTile)
      };
    } catch {
      // A dangling anchor reference resolves to no zones on either side
      // rather than throwing out of a pure query helper.
      return undefined;
    }
  };

  return {
    model,
    view,
    zones,
    itemsById,
    getItemZones: (itemId) => {
      return getItemZonesInView(view, itemId);
    },
    getZoneParent: (zoneId) => {
      return getZoneParentInView(view, zoneId);
    },
    partialOverlaps,
    crossesZoneBoundary: (connector) => {
      return crossesZoneBoundaryInView(view, connector);
    },
    connectorZones,
    resolveAnchorItem,
    connectorEndpoints
  };
};

// All issues for one view, rules run in catalog order.
export const lintView = (model: LintableModel, view: View): Issue[] => {
  const ctx = buildRuleContext(model, view);

  return RULES.flatMap((rule) => {
    return rule.check(ctx);
  });
};

// All issues across every view of the model — view order (as given in
// model.views), then rule order (as given in RULES) within each view. Both
// orders are fixed inputs, so this is deterministic for a given model.
export const lintDiagram = (model: LintableModel): Issue[] => {
  return model.views.flatMap((view) => {
    return lintView(model, view);
  });
};
