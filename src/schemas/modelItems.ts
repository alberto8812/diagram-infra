import { z } from 'zod';
import { id, constrainedStrings } from './common';

// How a non-isometric (flat) icon renders on the tile (T6). Optional so
// existing diagrams without it keep loading and fall back to the app's
// default (see NODE_ICON_STYLE_DEFAULT in src/config.ts). Isometric icons
// (icon.isIsometric !== false) ignore this — they already render as-is.
export const iconStyleOptions = ['FLAT', 'BLOCK'] as const;

// Infrastructure roadmap item 1: typed resource metadata on a model item.
// Every field is optional so existing diagrams (including diagrams/infra.json)
// keep loading through modelSchema.safeParse unchanged.
export const resourceKindOptions = [
  'service',
  'database',
  'cache',
  'queue',
  'loadBalancer',
  'gateway',
  'storage',
  'runner',
  'network',
  'user',
  'external'
] as const;

export const environmentOptions = ['dev', 'test', 'prod'] as const;

export const modelItemSchema = z.object({
  id,
  name: constrainedStrings.name,
  description: constrainedStrings.description.optional(),
  icon: id.optional(),
  iconStyle: z.enum(iconStyleOptions).optional(),
  kind: z.enum(resourceKindOptions).optional(),
  environment: z.enum(environmentOptions).optional(),
  // Reuses the existing 60-char constrained string helper (see
  // src/schemas/common.ts) — no new string constraint needed for these.
  engine: constrainedStrings.label.optional(),
  version: constrainedStrings.label.optional(),
  region: constrainedStrings.label.optional(),
  owner: constrainedStrings.label.optional(),
  port: z.number().int().min(1).max(65535).optional()
});

export const modelItemsSchema = z.array(modelItemSchema);
