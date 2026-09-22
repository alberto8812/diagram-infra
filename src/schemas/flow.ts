import { z } from 'zod';
import { id, constrainedStrings } from './common';

export const flowStepDirectionOptions = ['REQUEST', 'RESPONSE'] as const;
export const flowStepOutcomeOptions = ['SUCCESS', 'FAILURE'] as const;

export const flowStepSchema = z.object({
  id,
  connectorId: id,
  direction: z.enum(flowStepDirectionOptions),
  label: constrainedStrings.label.optional(),
  durationMs: z.number().int().positive().optional(),
  // Explicit successor step ids. Absent means "the next step in the array",
  // which is what keeps existing linear flows working (see
  // src/utils/flow.ts resolveNextSteps).
  next: z.array(id).optional(),
  // Semantic marker for a step that failed at runtime. A failure branch is
  // an ordinary step marked FAILURE whose `next` points at the recovery
  // path; no separate branch type is introduced.
  outcome: z.enum(flowStepOutcomeOptions).optional()
});

export const flowSchema = z.object({
  id,
  name: constrainedStrings.name,
  description: constrainedStrings.description.optional(),
  steps: z.array(flowStepSchema)
});

export const flowsSchema = z.array(flowSchema);
