import { z } from 'zod';
import { id, coords, constrainedStrings } from './common';

// P0 (containment zones): a rectangle becomes a typed zone when `zone` is
// set. Every field below is optional so existing diagrams (including
// diagrams/infra.json) keep loading through modelSchema.safeParse unchanged,
// and a plain (undecorated) rectangle stays decoration-only — see
// src/utils/containment.ts, which only treats a rectangle with `zone` set as
// a zone.
export const zoneKindOptions = [
  'account',
  'region',
  'vpc',
  'az',
  'subnet',
  'securityGroup',
  'cluster',
  'onPrem'
] as const;

export const zoneVisibilityOptions = ['public', 'private'] as const;

export const rectangleSchema = z.object({
  id,
  color: id.optional(),
  from: coords,
  to: coords,
  zone: z.enum(zoneKindOptions).optional(),
  // Reuses the existing 60-char constrained "label" string (see
  // src/schemas/common.ts) — no new string constraint needed here.
  name: constrainedStrings.label.optional(),
  visibility: z.enum(zoneVisibilityOptions).optional()
});
