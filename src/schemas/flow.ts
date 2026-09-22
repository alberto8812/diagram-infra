import { z } from 'zod';
import { id, constrainedStrings } from './common';

export const flowStepDirectionOptions = ['REQUEST', 'RESPONSE'] as const;

export const flowStepSchema = z.object({
  id,
  connectorId: id,
  direction: z.enum(flowStepDirectionOptions),
  label: constrainedStrings.label.optional(),
  durationMs: z.number().int().positive().optional()
});

export const flowSchema = z.object({
  id,
  name: constrainedStrings.name,
  description: constrainedStrings.description.optional(),
  steps: z.array(flowStepSchema)
});

export const flowsSchema = z.array(flowSchema);
