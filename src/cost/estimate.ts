// Pure design-time cost estimation (P4 cost estimation): looks up a rough
// monthly price for a model item in the local catalog (src/cost/catalog.ts)
// and rolls per-item estimates up into diagram-wide totals. Never invents a
// number for a kind/size the catalog doesn't cover — see CostConfidence in
// ./types for what 'exact-catalog' / 'approximate' / 'unknown' mean.
import { ModelItem, View } from 'src/types';
import { LintableModel } from 'src/rules/types';
import { getItemZones } from 'src/utils/containment';
import { ZONE_KIND_LABELS } from 'src/utils/zoneLabels';
import {
  CostCatalog,
  CostCatalogItem,
  CostCatalogStorageEntry,
  CostGroupTotal,
  DiagramCostEstimate,
  ItemCostEstimate,
  UnpricedItem
} from './types';

const findInstancePrice = (
  item: ModelItem,
  catalog: CostCatalog
): CostCatalogItem | undefined => {
  if (!item.kind || !item.size) return undefined;

  return catalog.items.find((entry) => {
    if (entry.kind !== item.kind || entry.size !== item.size) return false;
    if (
      entry.match?.engine !== undefined &&
      entry.match.engine !== item.engine
    ) {
      return false;
    }
    return true;
  });
};

const findStorageRate = (
  item: ModelItem,
  catalog: CostCatalog
): CostCatalogStorageEntry | undefined => {
  if (!item.kind || item.storageGb === undefined) return undefined;

  return catalog.storage.find((entry) => {
    return entry.kind === item.kind;
  });
};

// No region set is not an approximation (there is nothing to fall back
// from); an unrecognized region falls back to the catalog's base
// (unadjusted) price and is reported as such.
const regionMultiplier = (
  region: string | undefined,
  catalog: CostCatalog
): { multiplier: number; known: boolean } => {
  if (!region) return { multiplier: 1, known: true };

  const entry = catalog.regions[region];
  return entry
    ? { multiplier: entry.multiplier, known: true }
    : { multiplier: 1, known: false };
};

export const estimateItemCost = (
  item: ModelItem,
  catalog: CostCatalog
): ItemCostEstimate => {
  const count = item.count ?? 1;
  const reasons: string[] = [];

  const wantsInstance = item.kind !== undefined && item.size !== undefined;
  const wantsStorage = item.kind !== undefined && item.storageGb !== undefined;

  if (!wantsInstance && !wantsStorage) {
    return {
      monthlyUsd: 0,
      confidence: 'unknown',
      reasons: ['No size or storage set to estimate a cost from.']
    };
  }

  let monthlyUsd = 0;
  let anyPriced = false;
  let approximate = false;

  if (wantsInstance) {
    const instancePrice = findInstancePrice(item, catalog);

    if (!instancePrice) {
      const engineNote = item.engine ? ` (engine "${item.engine}")` : '';
      reasons.push(
        `No catalog price for ${item.kind} size "${item.size}"${engineNote}.`
      );
    } else {
      const { multiplier, known } = regionMultiplier(item.region, catalog);

      if (!known) {
        approximate = true;
        reasons.push(
          `No price data for region "${item.region}"; using the base (unadjusted) price.`
        );
      }

      monthlyUsd += instancePrice.monthlyUsd * multiplier * count;
      anyPriced = true;
    }
  }

  if (wantsStorage) {
    const storageRate = findStorageRate(item, catalog);

    if (!storageRate) {
      reasons.push(`No catalog storage price for kind "${item.kind}".`);
    } else {
      // Each of `count` instances is assumed to carry its own volume of
      // `storageGb` — the same "one size, N instances" reading `count`
      // already has for the instance price above.
      monthlyUsd +=
        storageRate.usdPerGbMonth * (item.storageGb as number) * count;
      anyPriced = true;
    }
  }

  if (!anyPriced) {
    return { monthlyUsd: 0, confidence: 'unknown', reasons };
  }

  return {
    monthlyUsd,
    confidence:
      approximate || reasons.length > 0 ? 'approximate' : 'exact-catalog',
    reasons
  };
};

const addToGroup = (
  groups: Map<string, CostGroupTotal>,
  id: string,
  label: string,
  estimate: ItemCostEstimate
): void => {
  const existing = groups.get(id) ?? {
    id,
    label,
    monthlyUsd: 0,
    itemCount: 0,
    hasApproximate: false
  };

  existing.monthlyUsd += estimate.monthlyUsd;
  existing.itemCount += 1;
  if (estimate.confidence === 'approximate') existing.hasApproximate = true;

  groups.set(id, existing);
};

export const estimateDiagramCost = (
  model: LintableModel,
  catalog: CostCatalog
): DiagramCostEstimate => {
  const itemsById = new Map(
    model.items.map((item) => {
      return [item.id, item] as const;
    })
  );

  const estimates = new Map<string, ItemCostEstimate>(
    model.items.map((item) => {
      return [item.id, estimateItemCost(item, catalog)] as const;
    })
  );

  const unpriced: UnpricedItem[] = [];
  let totalMonthlyUsd = 0;
  let hasApproximate = false;

  const environmentGroups = new Map<string, CostGroupTotal>();

  model.items.forEach((item) => {
    const estimate = estimates.get(item.id) as ItemCostEstimate;

    if (estimate.confidence === 'unknown') {
      unpriced.push({
        itemId: item.id,
        itemName: item.name,
        reasons: estimate.reasons
      });
      return;
    }

    totalMonthlyUsd += estimate.monthlyUsd;
    if (estimate.confidence === 'approximate') hasApproximate = true;

    const environmentKey = item.environment ?? 'unspecified';
    addToGroup(environmentGroups, environmentKey, environmentKey, estimate);
  });

  const viewGroups = new Map<string, CostGroupTotal>();
  const zoneGroups = new Map<string, CostGroupTotal>();

  model.views.forEach((view: View) => {
    view.items.forEach((viewItem) => {
      const item = itemsById.get(viewItem.id);
      if (!item) return;

      const estimate = estimates.get(item.id) as ItemCostEstimate;
      if (estimate.confidence === 'unknown') return;

      addToGroup(viewGroups, view.id, view.name, estimate);

      getItemZones(view, viewItem.id).forEach((zone) => {
        const label = zone.name ?? ZONE_KIND_LABELS[zone.zone];
        addToGroup(zoneGroups, zone.id, label, estimate);
      });
    });
  });

  return {
    currency: catalog.currency,
    lastUpdated: catalog.lastUpdated,
    totalMonthlyUsd,
    hasApproximate,
    perView: [...viewGroups.values()],
    perZone: [...zoneGroups.values()],
    perEnvironment: [...environmentGroups.values()],
    unpriced
  };
};
