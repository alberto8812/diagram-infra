import { Connector } from 'src/types';
import { isEncryptedInTransit } from '../encryption';

const connector = (overrides: Partial<Connector> = {}): Connector => {
  return { id: 'c1', anchors: [], ...overrides };
};

describe('isEncryptedInTransit()', () => {
  test('an explicit true value wins over protocol/auth', () => {
    expect(
      isEncryptedInTransit(
        connector({ encryptedInTransit: true, protocol: 'HTTP' })
      )
    ).toBe(true);
  });

  test('an explicit false value wins over protocol/auth', () => {
    expect(
      isEncryptedInTransit(
        connector({ encryptedInTransit: false, protocol: 'HTTPS' })
      )
    ).toBe(false);
  });

  test('HTTPS is encrypted when unset', () => {
    expect(isEncryptedInTransit(connector({ protocol: 'HTTPS' }))).toBe(true);
  });

  test('SSH is encrypted when unset', () => {
    expect(isEncryptedInTransit(connector({ protocol: 'SSH' }))).toBe(true);
  });

  test('mTLS auth is encrypted regardless of protocol', () => {
    expect(
      isEncryptedInTransit(connector({ protocol: 'TCP', auth: 'mtls' }))
    ).toBe(true);
  });

  test('HTTP is not encrypted when unset', () => {
    expect(isEncryptedInTransit(connector({ protocol: 'HTTP' }))).toBe(false);
  });

  test('HTTP stays plaintext even with a non-mtls auth set', () => {
    expect(
      isEncryptedInTransit(connector({ protocol: 'HTTP', auth: 'token' }))
    ).toBe(false);
  });

  test('an ambiguous protocol (e.g. gRPC) with no explicit value is unknown', () => {
    expect(
      isEncryptedInTransit(connector({ protocol: 'gRPC' }))
    ).toBeUndefined();
  });

  test('no protocol, no auth, no explicit value is unknown', () => {
    expect(isEncryptedInTransit(connector())).toBeUndefined();
  });

  test('SQL/TCP with no auth is unknown (not automatically plaintext)', () => {
    expect(
      isEncryptedInTransit(connector({ protocol: 'SQL', auth: 'none' }))
    ).toBeUndefined();
  });
});
