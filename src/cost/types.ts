// Types + validation schema for the local, offline cost-estimation catalog
// (P4 cost estimation). The catalog itself (src/cost/catalog.ts) is
// hand-maintained data, never a live price feed — see its header comment
// for the approximation caveat this schema doesn't itself enforce.
import { z } from 'zod';
import { resourceKindOptions } from 'src/types';

export const costCatalogItemSchema = z.object({
  kind: z.enum(resourceKindOptions),
  // Narrows a kind/size match further for the (rare) cases where the same
  // size string prices differently by engine — e.g. an RDS db.t3.medium for
  // mysql vs. postgres. Absent means "applies regardless of engine".
  match: z
    .object({
      engine: z.string().min(1).optional()
    })
    .optional(),
  // A short instance-type/tier string (e.g. "db.t3.medium"), matched
  // against a model item's own `size` field (src/schemas/modelItems.ts).
  size: z.string().min(1),
  monthlyUsd: z.number().nonnegative(),
  // Free-text unit label for display only (e.g. "instance/month") — never
  // parsed, so it carries no pricing logic of its own.
  unit: z.string().min(1)
});

export const costCatalogStorageEntrySchema = z.object({
  kind: z.enum(resourceKindOptions),
  usdPerGbMonth: z.number().nonnegative()
});

export const costCatalogRegionSchema = z.object({
  multiplier: z.number().positive()
});

export const costCatalogSchema = z.object({
  currency: z.string().min(1),
  // YYYY-MM-DD, checked so the "last updated" date the UI shows always
  // parses as a real date instead of silently rendering garbage.
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Free-text note on where the figures came from — surfaced in the Cost
  // dialog next to the approximate/last-updated disclaimer.
  source: z.string().min(1),
  regions: z.record(costCatalogRegionSchema),
  items: z.array(costCatalogItemSchema),
  storage: z.array(costCatalogStorageEntrySchema)
});

export type CostCatalogItem = z.infer<typeof costCatalogItemSchema>;
export type CostCatalogStorageEntry = z.infer<
  typeof costCatalogStorageEntrySchema
>;
export type CostCatalog = z.infer<typeof costCatalogSchema>;

// 'exact-catalog': every requested aspect (size, and storage/region when
// given) matched a catalog entry directly.
// 'approximate': at least one priced component matched, but something had
// to fall back (e.g. no price data for the item's region).
// 'unknown': nothing could be priced at all — never a guessed number.
export type CostConfidence = 'exact-catalog' | 'approximate' | 'unknown';

export interface ItemCostEstimate {
  monthlyUsd: number;
  confidence: CostConfidence;
  // Human-readable notes on anything approximated or left unpriced, e.g.
  // "No catalog price for service size \"d2.mega\"." Empty when nothing
  // needed to be called out.
  reasons: string[];
}

export interface CostGroupTotal {
  id: string;
  label: string;
  monthlyUsd: number;
  // Priced items contributing to this total (unpriced items are excluded —
  // see the top-level `unpriced` list instead).
  itemCount: number;
  // True when at least one contributing item's estimate was 'approximate'
  // rather than 'exact-catalog' — surfaced so a total never looks more
  // precise than it is.
  hasApproximate: boolean;
}

export interface UnpricedItem {
  itemId: string;
  itemName: string;
  reasons: string[];
}

export interface DiagramCostEstimate {
  currency: string;
  lastUpdated: string;
  totalMonthlyUsd: number;
  hasApproximate: boolean;
  perView: CostGroupTotal[];
  perZone: CostGroupTotal[];
  perEnvironment: CostGroupTotal[];
  unpriced: UnpricedItem[];
}
