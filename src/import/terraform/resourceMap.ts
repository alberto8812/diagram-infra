// Terraform resource type -> Isoflow element mapping (P3 Terraform import).
// One exported table. A resource type missing here is skipped gracefully
// (counted in the import summary, never guessed at) — extend by adding an
// entry, nothing else needs to change.
import { ResourceKind, ZoneKind } from 'src/types';

export interface TerraformZoneMapping {
  kind: 'zone';
  zone: ZoneKind;
}

export interface TerraformItemMapping {
  kind: 'item';
  resourceKind: ResourceKind;
}

export type TerraformResourceMapping =
  TerraformZoneMapping | TerraformItemMapping;

export const TERRAFORM_RESOURCE_MAP: Record<string, TerraformResourceMapping> =
  {
    aws_vpc: { kind: 'zone', zone: 'vpc' },
    aws_subnet: { kind: 'zone', zone: 'subnet' },
    // Only rendered when at least one mapped item references it — see
    // resolve.ts (`sgHasMembers`).
    aws_security_group: { kind: 'zone', zone: 'securityGroup' },

    aws_instance: { kind: 'item', resourceKind: 'service' },
    aws_ecs_service: { kind: 'item', resourceKind: 'service' },
    aws_lambda_function: { kind: 'item', resourceKind: 'service' },
    aws_ecs_task_definition: { kind: 'item', resourceKind: 'service' },

    aws_db_instance: { kind: 'item', resourceKind: 'database' },
    aws_rds_cluster: { kind: 'item', resourceKind: 'database' },

    aws_elasticache_cluster: { kind: 'item', resourceKind: 'cache' },
    aws_elasticache_replication_group: { kind: 'item', resourceKind: 'cache' },

    aws_s3_bucket: { kind: 'item', resourceKind: 'storage' },
    aws_efs_file_system: { kind: 'item', resourceKind: 'storage' },

    aws_sqs_queue: { kind: 'item', resourceKind: 'queue' },
    aws_sns_topic: { kind: 'item', resourceKind: 'queue' },

    aws_lb: { kind: 'item', resourceKind: 'loadBalancer' },
    aws_alb: { kind: 'item', resourceKind: 'loadBalancer' },
    aws_elb: { kind: 'item', resourceKind: 'loadBalancer' },

    aws_internet_gateway: { kind: 'item', resourceKind: 'gateway' },
    aws_nat_gateway: { kind: 'item', resourceKind: 'gateway' },
    aws_api_gateway_rest_api: { kind: 'item', resourceKind: 'gateway' }
  };
