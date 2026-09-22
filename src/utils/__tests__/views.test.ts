import {
  VIEW_LAYER_PRESETS,
  isValidViewName,
  getAvailableViewPresets,
  generateUniqueViewName
} from '../views';

describe('isValidViewName() works correctly', () => {
  test('rejects an empty string', () => {
    expect(isValidViewName('')).toBe(false);
  });

  test('rejects a whitespace-only string', () => {
    expect(isValidViewName('   ')).toBe(false);
  });

  test('accepts a normal name', () => {
    expect(isValidViewName('Network')).toBe(true);
  });

  test('rejects a name over the schema max length', () => {
    expect(isValidViewName('a'.repeat(101))).toBe(false);
  });

  test('accepts a name at the schema max length', () => {
    expect(isValidViewName('a'.repeat(100))).toBe(true);
  });
});

describe('getAvailableViewPresets() works correctly', () => {
  test('returns all presets when no view uses them', () => {
    expect(getAvailableViewPresets(['Untitled view'])).toStrictEqual([
      ...VIEW_LAYER_PRESETS
    ]);
  });

  test('excludes a preset already used by an existing view name', () => {
    expect(getAvailableViewPresets(['Network'])).toStrictEqual([
      'Application',
      'Data',
      'CI/CD'
    ]);
  });

  test('comparison is case-insensitive', () => {
    expect(getAvailableViewPresets(['network', 'DATA'])).toStrictEqual([
      'Application',
      'CI/CD'
    ]);
  });

  test('returns an empty array when every preset is used', () => {
    expect(getAvailableViewPresets([...VIEW_LAYER_PRESETS])).toStrictEqual([]);
  });
});

describe('generateUniqueViewName() works correctly', () => {
  test('returns the name unchanged when unused', () => {
    expect(generateUniqueViewName('Network', [])).toBe('Network');
  });

  test('appends a numeric suffix when the name is taken', () => {
    expect(generateUniqueViewName('Network', ['Network'])).toBe('Network 2');
  });

  test('increments the suffix until a free name is found', () => {
    expect(
      generateUniqueViewName('Network', ['Network', 'Network 2', 'Network 3'])
    ).toBe('Network 4');
  });

  test('comparison is case-insensitive', () => {
    expect(generateUniqueViewName('network', ['NETWORK'])).toBe('network 2');
  });

  test('truncates a generated name to the schema max length', () => {
    const longBase = 'a'.repeat(100);
    const result = generateUniqueViewName(longBase, [longBase]);

    expect(result.length).toBeLessThanOrEqual(100);
    expect(isValidViewName(result)).toBe(true);
  });
});
