import {
  deriveEncryptedAtRest,
  deriveEngineVersion,
  deriveEnvironment,
  deriveInternetFacing,
  deriveOwner,
  derivePort,
  deriveRegion,
  readTags
} from '../attributes';

describe('readTags()', () => {
  test('returns string tag values only', () => {
    expect(
      readTags({ tags: { Name: 'x', Count: 3, Flag: true } })
    ).toStrictEqual({ Name: 'x' });
  });

  test('returns {} when tags is missing or not an object', () => {
    expect(readTags(undefined)).toStrictEqual({});
    expect(readTags({})).toStrictEqual({});
    expect(readTags({ tags: null })).toStrictEqual({});
  });
});

describe('deriveOwner()', () => {
  test('reads Owner, falling back to owner', () => {
    expect(deriveOwner({ Owner: 'team-a' })).toBe('team-a');
    expect(deriveOwner({ owner: 'team-b' })).toBe('team-b');
    expect(deriveOwner({})).toBeUndefined();
  });
});

describe('deriveEnvironment()', () => {
  test('normalizes common aliases from Environment/env tags', () => {
    expect(deriveEnvironment({ Environment: 'production' }, undefined)).toBe(
      'prod'
    );
    expect(deriveEnvironment({ env: 'staging' }, undefined)).toBe('test');
    expect(deriveEnvironment({ env: 'development' }, undefined)).toBe('dev');
  });

  test('falls back to a values.environment attribute', () => {
    expect(deriveEnvironment({}, { environment: 'qa' })).toBe('test');
  });

  test('is undefined for an unrecognized or missing value', () => {
    expect(
      deriveEnvironment({ Environment: 'sandbox' }, undefined)
    ).toBeUndefined();
    expect(deriveEnvironment({}, undefined)).toBeUndefined();
  });
});

describe('deriveEncryptedAtRest()', () => {
  test('reads storage_encrypted', () => {
    expect(deriveEncryptedAtRest({ storage_encrypted: true })).toBe(true);
    expect(deriveEncryptedAtRest({ storage_encrypted: false })).toBe(false);
  });

  test('reads encrypted when storage_encrypted is absent', () => {
    expect(deriveEncryptedAtRest({ encrypted: true })).toBe(true);
  });

  test('treats a present SSE configuration as encrypted', () => {
    expect(
      deriveEncryptedAtRest({ server_side_encryption_configuration: {} })
    ).toBe(true);
  });

  test('is undefined when nothing indicates encryption either way', () => {
    expect(deriveEncryptedAtRest({})).toBeUndefined();
    expect(deriveEncryptedAtRest(undefined)).toBeUndefined();
  });
});

describe('deriveInternetFacing()', () => {
  test('reads publicly_accessible', () => {
    expect(deriveInternetFacing({ publicly_accessible: true })).toBe(true);
    expect(deriveInternetFacing({ publicly_accessible: false })).toBe(false);
  });

  test('is undefined when publicly_accessible is absent', () => {
    expect(deriveInternetFacing({})).toBeUndefined();
  });
});

describe('deriveEngineVersion()', () => {
  test('reads engine and engine_version', () => {
    expect(
      deriveEngineVersion({ engine: 'mysql', engine_version: '8.0.33' })
    ).toStrictEqual({ engine: 'mysql', version: '8.0.33' });
  });

  test('is undefined for missing fields', () => {
    expect(deriveEngineVersion({})).toStrictEqual({
      engine: undefined,
      version: undefined
    });
  });
});

describe('derivePort()', () => {
  test('reads a valid port number', () => {
    expect(derivePort({ port: 3306 })).toBe(3306);
  });

  test('rejects an out-of-range or non-integer port', () => {
    expect(derivePort({ port: 0 })).toBeUndefined();
    expect(derivePort({ port: 70000 })).toBeUndefined();
    expect(derivePort({ port: 80.5 })).toBeUndefined();
    expect(derivePort({})).toBeUndefined();
  });
});

describe('deriveRegion()', () => {
  test('reads a values.region attribute directly', () => {
    expect(deriveRegion({ region: 'us-east-1' })).toBe('us-east-1');
  });

  test('falls back to the region segment of an arn', () => {
    expect(
      deriveRegion({ arn: 'arn:aws:ec2:us-west-2:123456789012:vpc/vpc-001' })
    ).toBe('us-west-2');
  });

  test('is undefined when neither is present/parseable', () => {
    expect(deriveRegion({})).toBeUndefined();
    expect(deriveRegion({ arn: 'not-an-arn' })).toBeUndefined();
  });
});
