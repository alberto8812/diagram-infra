import { parsePortInput, PORT_MIN, PORT_MAX } from '../parsePortInput';

describe('parsePortInput()', () => {
  test('accepts a valid port in range', () => {
    expect(parsePortInput('8080', false)).toEqual({
      action: 'set',
      value: 8080
    });
  });

  test('accepts the boundary values', () => {
    expect(parsePortInput(String(PORT_MIN), false)).toEqual({
      action: 'set',
      value: PORT_MIN
    });
    expect(parsePortInput(String(PORT_MAX), false)).toEqual({
      action: 'set',
      value: PORT_MAX
    });
  });

  test('clears on a truly empty value', () => {
    expect(parsePortInput('', false)).toEqual({ action: 'clear' });
  });

  test('ignores an empty value reported for invalid/partial input (badInput)', () => {
    expect(parsePortInput('', true)).toEqual({ action: 'ignore' });
  });

  test('ignores an out-of-range value', () => {
    expect(parsePortInput('0', false)).toEqual({ action: 'ignore' });
    expect(parsePortInput('70000', false)).toEqual({ action: 'ignore' });
    expect(parsePortInput('-5', false)).toEqual({ action: 'ignore' });
  });

  test('ignores a non-integer value', () => {
    expect(parsePortInput('8080.5', false)).toEqual({ action: 'ignore' });
  });

  test('ignores garbage that somehow bypassed badInput', () => {
    expect(parsePortInput('abc', false)).toEqual({ action: 'ignore' });
  });

  test('respects custom min/max bounds', () => {
    expect(parsePortInput('10', false, 20, 30)).toEqual({ action: 'ignore' });
    expect(parsePortInput('25', false, 20, 30)).toEqual({
      action: 'set',
      value: 25
    });
  });
});
