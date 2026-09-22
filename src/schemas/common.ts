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

// Shared max length for longer free-text "description"-class fields.
// Exported for the same reason as LABEL_MAX_LENGTH above — e.g. the
// Terraform importer clamps an imported description to this instead of a
// bare number that could silently drift from the schema.
export const DESCRIPTION_MAX_LENGTH = 1000;

export const constrainedStrings = {
  name: z.string().max(100),
  description: z.string().max(DESCRIPTION_MAX_LENGTH),
  label: z.string().max(LABEL_MAX_LENGTH)
};
