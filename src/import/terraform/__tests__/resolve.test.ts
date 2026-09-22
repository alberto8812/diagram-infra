import * as fs from 'fs';
import * as path from 'path';
import { resolveTerraform, TerraformImportError } from '../resolve';
import { TerraformShowJson } from '../types';

const loadFixture = (name: string): TerraformShowJson => {
  const raw = fs.readFileSync(
    path.join(__dirname, '..', '__fixtures__', name),
    'utf8'
  );
  return JSON.parse(raw) as TerraformShowJson;
};

describe('resolveTerraform() — state (vpc + 2 subnets + instance + db + s3 + alb)', () => {
  const doc = loadFixture('state-basic.json');
  const result = resolveTerraform(doc);

  const zoneById = (id: string) => {
    return result.zones.find((z) => {
      return z.id === id;
    });
  };
  const itemById = (id: string) => {
    return result.items.find((i) => {
      return i.id === id;
    });
  };

  test('maps aws_vpc/aws_subnet to vpc/subnet zones', () => {
    expect(zoneById('aws_vpc.main')).toMatchObject({
      zoneType: 'vpc',
      name: 'main-vpc'
    });
    expect(zoneById('aws_subnet.public')).toMatchObject({
      zoneType: 'subnet',
      name: 'public-1',
      visibility: 'public'
    });
    expect(zoneById('aws_subnet.private')).toMatchObject({
      zoneType: 'subnet',
      name: 'private-1',
      visibility: 'private'
    });
  });

  test('synthesizes one shared, vpc-scoped AZ zone for both subnets', () => {
    const azZone = zoneById('aws_vpc.main:az:us-east-1a');
    expect(azZone).toMatchObject({ zoneType: 'az', name: 'us-east-1a' });
    expect(result.parentId.get('aws_vpc.main:az:us-east-1a')).toBe(
      'aws_vpc.main'
    );
    expect(result.parentId.get('aws_subnet.public')).toBe(
      'aws_vpc.main:az:us-east-1a'
    );
    expect(result.parentId.get('aws_subnet.private')).toBe(
      'aws_vpc.main:az:us-east-1a'
    );
  });

  test('resolves subnet_id containment for the instance via the literal id', () => {
    expect(result.parentId.get('aws_instance.web')).toBe('aws_subnet.public');
  });

  test('maps items to their resource kinds with derived attributes', () => {
    expect(itemById('aws_instance.web')).toMatchObject({
      resourceKind: 'service',
      name: 'web',
      owner: 'team-a',
      environment: 'prod',
      description: 'Terraform: aws_instance.web'
    });

    expect(itemById('aws_db_instance.main')).toMatchObject({
      resourceKind: 'database',
      name: 'main-db',
      engine: 'mysql',
      version: '8.0.33',
      port: 3306,
      encryptedAtRest: true,
      internetFacing: false,
      environment: 'prod'
    });

    expect(itemById('aws_s3_bucket.assets')).toMatchObject({
      resourceKind: 'storage',
      encryptedAtRest: true
    });

    expect(itemById('aws_lb.main')).toMatchObject({
      resourceKind: 'loadBalancer'
    });
  });

  test('leaves a resource with no resolvable containment attribute top-level', () => {
    expect(result.parentId.has('aws_db_instance.main')).toBe(false);
    expect(result.parentId.has('aws_s3_bucket.assets')).toBe(false);
    expect(result.parentId.has('aws_lb.main')).toBe(false);
  });

  test('skips an unsupported resource type and a data source', () => {
    expect(result.summary.skippedTypes).toStrictEqual(['aws_iam_role']);
    expect(result.summary.skippedResources).toBe(1);
    expect(result.summary.dataResources).toBe(1);
    expect(
      result.items.some((i) => {
        return i.id === 'aws_iam_role.app';
      })
    ).toBe(false);
  });

  test('produces no connectors without a configuration block', () => {
    expect(result.connectors).toStrictEqual([]);
  });

  test('reports the mapped resource count', () => {
    // 4 zones (vpc, 2 subnets, 1 shared az) + 4 items (instance, db, s3, alb)
    expect(result.summary.mappedResources).toBe(8);
  });
});

describe('resolveTerraform() — plan (module nesting + connectors)', () => {
  const doc = loadFixture('plan-modules.json');
  const result = resolveTerraform(doc);

  test('resolves subnet -> vpc containment via a configuration reference', () => {
    const vpcZoneId = 'module.network.aws_vpc.main';
    const azZoneId = `${vpcZoneId}:az:us-east-1b`;

    expect(result.parentId.get('module.network.aws_subnet.public')).toBe(
      azZoneId
    );
    expect(result.parentId.get(azZoneId)).toBe(vpcZoneId);
  });

  test('falls back to module nesting for a vpc and an item with no resolvable attribute containment', () => {
    expect(result.parentId.get('module.network.aws_vpc.main')).toBe(
      'module:network'
    );
    expect(result.parentId.get('module.network.aws_instance.bastion')).toBe(
      'module:network'
    );
  });

  test('leaves root-level resources with no containment attributes top-level', () => {
    expect(result.parentId.has('aws_lambda_function.api')).toBe(false);
    expect(result.parentId.has('aws_db_instance.main')).toBe(false);
  });

  test('normalizes tag aliases (env: staging -> test, Environment: dev -> dev)', () => {
    const db = result.items.find((i) => {
      return i.id === 'aws_db_instance.main';
    });
    const lambda = result.items.find((i) => {
      return i.id === 'aws_lambda_function.api';
    });

    expect(db?.environment).toBe('test');
    expect(lambda?.environment).toBe('dev');
  });

  test('creates one connector from a depends_on reference between two root items', () => {
    expect(result.connectors).toHaveLength(1);
    expect(result.connectors[0]).toMatchObject({
      fromId: 'aws_lambda_function.api',
      toId: 'aws_db_instance.main'
    });
  });

  test('skips an unsupported resource type nested inside a module', () => {
    expect(result.summary.skippedTypes).toStrictEqual([
      'aws_cloudwatch_log_group'
    ]);
    expect(result.summary.skippedResources).toBe(1);
  });
});

describe('resolveTerraform() — malformed input', () => {
  test('throws TerraformImportError when neither values nor planned_values is present', () => {
    expect(() => {
      resolveTerraform({});
    }).toThrow(TerraformImportError);
  });
});
