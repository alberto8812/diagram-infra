export type NumberInputResult =
  { action: 'set'; value: number } | { action: 'clear' } | { action: 'ignore' };

export interface ParseNumberInputOptions {
  min: number;
  max?: number;
  // Whole numbers only (e.g. an instance count) vs. any finite number (e.g.
  // storage in GB). Defaults to false.
  integer?: boolean;
}

/**
 * Decides what a `<input type="number">` change should do to a stored
 * number value. Generalizes parsePortInput.ts's min/max/badInput contract
 * (see there) to an arbitrary range and to non-integer values — a browser
 * number input reports an empty `value` both when the field is genuinely
 * empty and when it holds text that can't be parsed yet (e.g. "-", "1."),
 * so `badInput` (from the input's ValidityState) is what tells those apart;
 * only a genuinely empty field should clear a stored value.
 */
export const parseNumberInput = (
  text: string,
  badInput: boolean,
  { min, max, integer = false }: ParseNumberInputOptions
): NumberInputResult => {
  if (badInput) return { action: 'ignore' };
  if (text === '') return { action: 'clear' };

  const parsed = Number(text);

  if (Number.isNaN(parsed)) return { action: 'ignore' };
  if (integer && !Number.isInteger(parsed)) return { action: 'ignore' };
  if (parsed < min) return { action: 'ignore' };
  if (max !== undefined && parsed > max) return { action: 'ignore' };

  return { action: 'set', value: parsed };
};
