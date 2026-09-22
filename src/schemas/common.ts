import { z } from 'zod';

export const coords = z.object({
  x: z.number(),
  y: z.number()
});

export const id = z.string();
export const color = z.string();

// Shared max length for short free-text "label"-class fields (e.g. resource
// engine/version/region/owner). Exported so UI inputs can enforce the same
// limit the schema validates on load, instead of duplicating the number.
export const LABEL_MAX_LENGTH = 60;

export const constrainedStrings = {
  name: z.string().max(100),
  description: z.string().max(1000),
  label: z.string().max(LABEL_MAX_LENGTH)
};
