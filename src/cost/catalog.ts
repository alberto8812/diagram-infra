// Local, offline price catalog for design-time cost estimation (P4 cost
// estimation — user decision 2026-09-22: prices come from an editable local
// catalog, not a live API; offline, no credentials required).
//
// These are APPROXIMATE US East (N. Virginia) on-demand LIST prices for a
// handful of common AWS shapes, hand-checked against AWS's public pricing
// pages as of `lastUpdated` below. They are not a quote, not
// reserved/spot/savings-plan pricing, not region-exact beyond the rough
// multipliers in `regions`, and not kept in sync with AWS automatically.
// Re-check `lastUpdated` (and the figures themselves) before relying on this
// for real budgeting — treat every estimate as an order of magnitude, not a
// bill. Edit this file directly to update a price or add a shape.
//
// Sources: https://aws.amazon.com/ec2/pricing/on-demand/
//          https://aws.amazon.com/rds/pricing/
//          https://aws.amazon.com/elasticache/pricing/
//          https://aws.amazon.com/s3/pricing/
//          https://aws.amazon.com/ebs/pricing/
//          https://aws.amazon.com/elasticloadbalancing/pricing/
//          https://aws.amazon.com/vpc/pricing/ (NAT Gateway)
//
// AWS Lambda is deliberately NOT priced here: it bills per-invocation and
// per-GB-second of duration, not a flat monthly instance price, so it has no
// honest place in a `size -> monthlyUsd` table. A Lambda node (Terraform
// import maps `aws_lambda_function` to kind "service" — see
// src/import/terraform/resourceMap.ts) simply matches no catalog entry and
// is reported as `unknown` by the estimator, never given a made-up number.
import { CostCatalog } from './types';

export const catalog: CostCatalog = {
  currency: 'USD',
  lastUpdated: '2026-09-22',
  source:
    'Approximate US East (N. Virginia) on-demand list prices, hand-checked against AWS public pricing pages — not a live feed.',
  regions: {
    'us-east-1': { multiplier: 1 },
    'us-east-2': { multiplier: 1 },
    'us-west-2': { multiplier: 1.02 },
    'eu-west-1': { multiplier: 1.09 },
    'eu-central-1': { multiplier: 1.14 },
    'ap-southeast-1': { multiplier: 1.18 },
    'ap-northeast-1': { multiplier: 1.2 }
  },
  items: [
    // EC2 (kind: service) — on-demand, Linux.
    {
      kind: 'service',
      size: 't3.micro',
      monthlyUsd: 7.59,
      unit: 'instance/month'
    },
    {
      kind: 'service',
      size: 't3.small',
      monthlyUsd: 15.18,
      unit: 'instance/month'
    },
    {
      kind: 'service',
      size: 't3.medium',
      monthlyUsd: 30.37,
      unit: 'instance/month'
    },
    {
      kind: 'service',
      size: 't3.large',
      monthlyUsd: 60.74,
      unit: 'instance/month'
    },
    {
      kind: 'service',
      size: 'm5.large',
      monthlyUsd: 70.08,
      unit: 'instance/month'
    },
    {
      kind: 'service',
      size: 'm5.xlarge',
      monthlyUsd: 140.16,
      unit: 'instance/month'
    },

    // RDS (kind: database) — Single-AZ, on-demand. Priced per engine: the
    // list price differs by engine even for the same instance class (these
    // two happen to match today for mysql/postgres, but are kept as
    // separate entries since that isn't true for every engine/class).
    {
      kind: 'database',
      size: 'db.t3.micro',
      match: { engine: 'mysql' },
      monthlyUsd: 12.41,
      unit: 'instance/month'
    },
    {
      kind: 'database',
      size: 'db.t3.medium',
      match: { engine: 'mysql' },
      monthlyUsd: 49.64,
      unit: 'instance/month'
    },
    {
      kind: 'database',
      size: 'db.m5.large',
      match: { engine: 'mysql' },
      monthlyUsd: 127.75,
      unit: 'instance/month'
    },
    {
      kind: 'database',
      size: 'db.t3.micro',
      match: { engine: 'postgres' },
      monthlyUsd: 12.41,
      unit: 'instance/month'
    },
    {
      kind: 'database',
      size: 'db.t3.medium',
      match: { engine: 'postgres' },
      monthlyUsd: 49.64,
      unit: 'instance/month'
    },
    {
      kind: 'database',
      size: 'db.m5.large',
      match: { engine: 'postgres' },
      monthlyUsd: 127.75,
      unit: 'instance/month'
    },

    // ElastiCache (kind: cache) — on-demand.
    {
      kind: 'cache',
      size: 'cache.t3.micro',
      monthlyUsd: 12.41,
      unit: 'instance/month'
    },
    {
      kind: 'cache',
      size: 'cache.t3.medium',
      monthlyUsd: 49.64,
      unit: 'instance/month'
    },
    {
      kind: 'cache',
      size: 'cache.m5.large',
      monthlyUsd: 124.1,
      unit: 'instance/month'
    },

    // Load balancer (kind: loadBalancer) — hourly charge only, no
    // LCU/data-processing estimate.
    {
      kind: 'loadBalancer',
      size: 'application',
      monthlyUsd: 16.43,
      unit: 'balancer/month'
    },
    {
      kind: 'loadBalancer',
      size: 'network',
      monthlyUsd: 16.43,
      unit: 'balancer/month'
    },

    // NAT Gateway (kind: gateway) — hourly charge only, no
    // data-processing estimate. An Internet Gateway or API Gateway node
    // (also kind "gateway") has no entry here and is reported as unknown
    // rather than assumed to be a NAT Gateway.
    {
      kind: 'gateway',
      size: 'nat',
      monthlyUsd: 32.85,
      unit: 'gateway/month'
    }
  ],
  storage: [
    // S3 Standard, first 50 TB/month tier.
    { kind: 'storage', usdPerGbMonth: 0.023 },
    // RDS gp3 storage.
    { kind: 'database', usdPerGbMonth: 0.115 },
    // EBS gp3, attached to an EC2 instance.
    { kind: 'service', usdPerGbMonth: 0.08 }
  ]
};
