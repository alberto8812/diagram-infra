import { z } from 'zod';
import { id, constrainedStrings } from './common';

// How a non-isometric (flat) icon renders on the tile (T6). Optional so
// existing diagrams without it keep loading and fall back to the app's
// default (see NODE_ICON_STYLE_DEFAULT in src/config.ts). Isometric icons
// (icon.isIsometric !== false) ignore this — they already render as-is.
export const iconStyleOptions = ['FLAT', 'BLOCK'] as const;

export const modelItemSchema = z.object({
  id,
  name: constrainedStrings.name,
  description: constrainedStrings.description.optional(),
  icon: id.optional(),
  iconStyle: z.enum(iconStyleOptions).optional()
});

export const modelItemsSchema = z.array(modelItemSchema);
