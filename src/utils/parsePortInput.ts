export const PORT_MIN = 1;
export const PORT_MAX = 65535;

export type PortInputResult =
  { action: 'set'; value: number } | { action: 'clear' } | { action: 'ignore' };

/**
 * Decides what a port `<input type="number">` change should do to a stored
 * port value.
 *
 * A browser `type="number"` input reports an empty string `value` both when
 * the field is genuinely empty AND when it holds text the browser can't
 * parse as a number yet (e.g. "-", "e", "1e"). Only the former should clear
 * a stored port; the latter must be ignored, otherwise an in-progress
 * keystroke silently deletes a previously valid port. `badInput` (read from
 * the input's `ValidityState`) distinguishes the two cases.
 */
export const parsePortInput = (
  text: string,
  badInput: boolean,
  min: number = PORT_MIN,
  max: number = PORT_MAX
): PortInputResult => {
  if (badInput) return { action: 'ignore' };
  if (text === '') return { action: 'clear' };

  const parsed = Number(text);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { action: 'ignore' };
  }

  return { action: 'set', value: parsed };
};
