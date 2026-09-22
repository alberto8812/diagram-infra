import { parseNumberInput } from '../parseNumberInput';

describe('parseNumberInput()', () => {
  test('accepts a valid integer in range', () => {
    expect(parseNumberInput('3', false, { min: 1, integer: true })).toEqual({
      action: 'set',
      value: 3
    });
  });

  test('accepts a valid decimal when integer is not required', () => {
    expect(parseNumberInput('12.5', false, { min: 0 })).toEqual({
      action: 'set',
      value: 12.5
    });
  });

  test('clears on a truly empty value', () => {
    expect(parseNumberInput('', false, { min: 0 })).toEqual({
      action: 'clear'
    });
  });

  test('ignores an empty value reported for invalid/partial input (badInput)', () => {
    expect(parseNumberInput('', true, { min: 0 })).toEqual({
      action: 'ignore'
    });
  });

  test('ignores a value below min', () => {
    expect(parseNumberInput('-1', false, { min: 0 })).toEqual({
      action: 'ignore'
    });
    expect(parseNumberInput('0', false, { min: 1, integer: true })).toEqual({
      action: 'ignore'
    });
  });

  test('ignores a value above max when max is set', () => {
    expect(parseNumberInput('101', false, { min: 0, max: 100 })).toEqual({
      action: 'ignore'
    });
    expect(parseNumberInput('100', false, { min: 0, max: 100 })).toEqual({
      action: 'set',
      value: 100
    });
  });

  test('ignores a non-integer value when integer is required', () => {
    expect(parseNumberInput('3.5', false, { min: 1, integer: true })).toEqual({
      action: 'ignore'
    });
  });

  test('ignores garbage that somehow bypassed badInput', () => {
    expect(parseNumberInput('abc', false, { min: 0 })).toEqual({
      action: 'ignore'
    });
  });
});
