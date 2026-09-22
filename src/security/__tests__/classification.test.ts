import {
  DATA_STORE_KINDS,
  SENSITIVE_CLASSIFICATIONS,
  isDataStoreKind,
  isSensitiveClassification
} from '../classification';

describe('DATA_STORE_KINDS', () => {
  test('includes database, cache, storage and queue', () => {
    expect([...DATA_STORE_KINDS].sort()).toStrictEqual(
      ['cache', 'database', 'queue', 'storage'].sort()
    );
  });
});

describe('SENSITIVE_CLASSIFICATIONS', () => {
  test('includes confidential and restricted', () => {
    expect([...SENSITIVE_CLASSIFICATIONS].sort()).toStrictEqual(
      ['confidential', 'restricted'].sort()
    );
  });
});

describe('isDataStoreKind()', () => {
  test('is true for a data store kind', () => {
    expect(isDataStoreKind('database')).toBe(true);
    expect(isDataStoreKind('cache')).toBe(true);
    expect(isDataStoreKind('storage')).toBe(true);
    expect(isDataStoreKind('queue')).toBe(true);
  });

  test('is false for a non-data-store kind', () => {
    expect(isDataStoreKind('service')).toBe(false);
  });

  test('is false for undefined', () => {
    expect(isDataStoreKind(undefined)).toBe(false);
  });
});

describe('isSensitiveClassification()', () => {
  test('is true for confidential and restricted', () => {
    expect(isSensitiveClassification('confidential')).toBe(true);
    expect(isSensitiveClassification('restricted')).toBe(true);
  });

  test('is false for a non-sensitive classification', () => {
    expect(isSensitiveClassification('internal')).toBe(false);
    expect(isSensitiveClassification('public')).toBe(false);
  });

  test('is false for undefined', () => {
    expect(isSensitiveClassification(undefined)).toBe(false);
  });
});
