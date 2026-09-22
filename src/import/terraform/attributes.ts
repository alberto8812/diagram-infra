// Pure derivation of Isoflow item attributes from a Terraform resource's
// `values` (P3 Terraform import). Every function here is best-effort and
// defensive about shape — Terraform attribute sets differ by resource type
// and provider version, so an attribute that isn't a string/boolean where
// expected is treated as absent, never thrown on.
import { Environment } from 'src/types';

export type TerraformValues = Record<string, unknown>;

const ENVIRONMENT_ALIASES: Record<string, Environment> = {
  dev: 'dev',
  development: 'dev',
  test: 'test',
  testing: 'test',
  staging: 'test',
  stage: 'test',
  qa: 'test',
  prod: 'prod',
  production: 'prod'
};

export const readTags = (
  values: TerraformValues | undefined
): Record<string, string> => {
  const tags = values?.tags;
  if (typeof tags !== 'object' || tags === null) return {};

  const out: Record<string, string> = {};
  Object.entries(tags as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value === 'string') out[key] = value;
  });

  return out;
};

export const deriveOwner = (
  tags: Record<string, string>
): string | undefined => {
  return tags.Owner ?? tags.owner;
};

export const deriveEnvironment = (
  tags: Record<string, string>,
  values: TerraformValues | undefined
): Environment | undefined => {
  const raw =
    tags.Environment ??
    tags.env ??
    (typeof values?.environment === 'string'
      ? (values.environment as string)
      : undefined);

  if (!raw) return undefined;

  return ENVIRONMENT_ALIASES[raw.toLowerCase()];
};

// `storage_encrypted` (RDS), `encrypted` (EBS/EFS/SQS/etc.) or the presence
// of an S3 server-side-encryption configuration block.
export const deriveEncryptedAtRest = (
  values: TerraformValues | undefined
): boolean | undefined => {
  if (!values) return undefined;

  if (typeof values.storage_encrypted === 'boolean') {
    return values.storage_encrypted;
  }
  if (typeof values.encrypted === 'boolean') {
    return values.encrypted;
  }
  if (values.server_side_encryption_configuration !== undefined) {
    return true;
  }

  return undefined;
};

export const deriveInternetFacing = (
  values: TerraformValues | undefined
): boolean | undefined => {
  if (typeof values?.publicly_accessible === 'boolean') {
    return values.publicly_accessible;
  }

  return undefined;
};

export const deriveEngineVersion = (
  values: TerraformValues | undefined
): { engine?: string; version?: string } => {
  return {
    engine: typeof values?.engine === 'string' ? values.engine : undefined,
    version:
      typeof values?.engine_version === 'string'
        ? values.engine_version
        : undefined
  };
};

export const derivePort = (
  values: TerraformValues | undefined
): number | undefined => {
  const port = values?.port;

  return typeof port === 'number' &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535
    ? port
    : undefined;
};

// `region` (recent AWS provider versions accept a per-resource `region`
// argument) or, failing that, the region segment of an `arn`
// (`arn:aws:<service>:<region>:<account>:<resource>`).
export const deriveRegion = (
  values: TerraformValues | undefined
): string | undefined => {
  if (typeof values?.region === 'string' && values.region) {
    return values.region;
  }

  const arn = values?.arn;
  if (typeof arn !== 'string') return undefined;

  const parts = arn.split(':');
  return parts.length > 3 && parts[3] ? parts[3] : undefined;
};
