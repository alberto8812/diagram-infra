import { constrainedStrings } from 'src/schemas/common';

// Layer presets offered by "Add layer" (roadmap item 3 / T5). Order here is
// the order they're offered in the UI.
export const VIEW_LAYER_PRESETS = [
  'Network',
  'Application',
  'Data',
  'CI/CD'
] as const;

export type ViewLayerPreset = (typeof VIEW_LAYER_PRESETS)[number];

// Mirrors constrainedStrings.name's max length (src/schemas/common.ts) so a
// generated/suffixed name never becomes schema-invalid. Kept as a local
// constant rather than read off the zod schema, since ZodString doesn't
// expose its checks as a plain number.
const VIEW_NAME_MAX_LENGTH = 100;

const normalizeName = (name: string): string => {
  return name.trim().toLowerCase();
};

// A view name is valid when it's non-empty (after trimming) and passes the
// same schema the model is validated against on load/save.
export const isValidViewName = (name: string): boolean => {
  const trimmed = name.trim();

  return (
    trimmed.length > 0 && constrainedStrings.name.safeParse(trimmed).success
  );
};

// Presets not already used by an existing view name (case-insensitive
// comparison), in preset order. Used to disable a preset already in use
// instead of creating a duplicate-named view.
export const getAvailableViewPresets = (
  existingNames: string[]
): ViewLayerPreset[] => {
  const used = new Set(existingNames.map(normalizeName));

  return VIEW_LAYER_PRESETS.filter((preset) => {
    return !used.has(normalizeName(preset));
  });
};

const truncate = (value: string): string => {
  return value.length > VIEW_NAME_MAX_LENGTH
    ? value.slice(0, VIEW_NAME_MAX_LENGTH)
    : value;
};

// Builds "<base, trimmed to leave room> <suffix>", so growing the suffix
// (e.g. " 9" -> " 10") always changes the result instead of being truncated
// away, which would otherwise loop forever on a base already at max length.
const buildSuffixedCandidate = (base: string, suffix: number): string => {
  const suffixText = ` ${suffix}`;
  const maxBaseLength = VIEW_NAME_MAX_LENGTH - suffixText.length;
  const trimmedBase =
    base.length > maxBaseLength ? base.slice(0, maxBaseLength) : base;

  return `${trimmedBase}${suffixText}`;
};

// Returns `name` unchanged if it's not already used (case-insensitive)
// among existingNames, otherwise appends " 2", " 3", ... until unique.
// The result is truncated to stay within the schema's max name length.
export const generateUniqueViewName = (
  name: string,
  existingNames: string[]
): string => {
  const used = new Set(existingNames.map(normalizeName));
  const base = truncate(name.trim());

  if (!used.has(normalizeName(base))) {
    return base;
  }

  let suffix = 2;
  let candidate = buildSuffixedCandidate(base, suffix);

  while (used.has(normalizeName(candidate))) {
    suffix += 1;
    candidate = buildSuffixedCandidate(base, suffix);
  }

  return candidate;
};
