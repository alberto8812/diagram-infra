// Pure helper (P2: threat modeling + compliance mapping). A connector's
// `encryptedInTransit` field (src/schemas/connector.ts) is optional — when
// the user hasn't set it explicitly, this derives a best-effort answer from
// the connector's protocol/auth instead of leaving every reader to
// re-implement the same guesswork.
import { Connector } from 'src/types';

// Protocols that are encrypted in transit by construction, regardless of
// auth. gRPC is deliberately left out: it commonly runs over either
// plaintext HTTP/2 or TLS, so protocol alone isn't a reliable signal.
const ALWAYS_ENCRYPTED_PROTOCOLS: ReadonlySet<Connector['protocol']> = new Set([
  'HTTPS',
  'SSH'
]);

// Protocols that are plaintext by construction, regardless of auth.
const ALWAYS_PLAINTEXT_PROTOCOLS: ReadonlySet<Connector['protocol']> = new Set([
  'HTTP'
]);

// Explicit value wins over any derivation. Otherwise: true for HTTPS/SSH,
// or for any protocol authenticated with mutual TLS (mTLS terminates the
// transport itself, so the channel is encrypted no matter which protocol
// carries it); false for plain HTTP; undefined (unknown) for everything
// else — there isn't enough information to say either way.
export const isEncryptedInTransit = (
  connector: Pick<Connector, 'encryptedInTransit' | 'protocol' | 'auth'>
): boolean | undefined => {
  if (connector.encryptedInTransit !== undefined) {
    return connector.encryptedInTransit;
  }

  if (connector.auth === 'mtls') return true;

  if (
    connector.protocol !== undefined &&
    ALWAYS_ENCRYPTED_PROTOCOLS.has(connector.protocol)
  ) {
    return true;
  }

  if (
    connector.protocol !== undefined &&
    ALWAYS_PLAINTEXT_PROTOCOLS.has(connector.protocol)
  ) {
    return false;
  }

  return undefined;
};
