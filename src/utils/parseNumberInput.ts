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

  // `Number.isFinite` rather than `!Number.isNaN`: `Number("1e400")` is
  // `Infinity`, not `NaN`, so a NaN-only check would accept it (and
  // `-Infinity`) and serialize as `null` downstream instead of being
  // rejected like other out-of-range input.
  if (!Number.isFinite(parsed)) return { action: 'ignore' };
  if (integer && !Number.isInteger(parsed)) return { action: 'ignore' };
  if (parsed < min) return { action: 'ignore' };
  if (max !== undefined && parsed > max) return { action: 'ignore' };

  return { action: 'set', value: parsed };
};

export type BufferedNumberInputDecision =
  { commit: true; value: number | undefined } | { commit: false };

/**
 * Pure decision logic shared by every buffered `<input type="number">`
 * field backed by `parseNumberInput` (e.g. NodeSettings.tsx's Count and
 * Storage fields): given the raw text change and the value currently
 * stored on the model, decides whether the model should be updated, and to
 * what. The caller still owns updating its own local text buffer — this
 * only decides the model-side commit, and never commits a no-op (ignored
 * input, or a parsed value that already matches what's stored).
 */
export const decideBufferedNumberInput = (
  text: string,
  badInput: boolean,
  options: ParseNumberInputOptions,
  currentValue: number | undefined
): BufferedNumberInputDecision => {
  const result = parseNumberInput(text, badInput, options);

  if (result.action === 'ignore') return { commit: false };

  const nextValue = result.action === 'clear' ? undefined : result.value;
  if (nextValue === currentValue) return { commit: false };

  return { commit: true, value: nextValue };
};
