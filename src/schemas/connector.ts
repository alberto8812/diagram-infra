import { z } from 'zod';
import { coords, id, constrainedStrings } from './common';

export const connectorStyleOptions = ['SOLID', 'DOTTED', 'DASHED'] as const;

export const connectorDirectionOptions = [
  'FORWARD',
  'REVERSE',
  'BOTH'
] as const;

// Infrastructure roadmap item 2: semantic metadata on a connector. Every
// field is optional so existing diagrams (including diagrams/infra.json)
// keep loading through modelSchema.safeParse unchanged.
export const connectorProtocolOptions = [
  'HTTP',
  'HTTPS',
  'gRPC',
  'SQL',
  'SSH',
  'TCP',
  'AMQP'
] as const;

export const connectorModeOptions = ['sync', 'async'] as const;

export const connectorAuthOptions = [
  'none',
  'basic',
  'token',
  'mtls',
  'iam'
] as const;

export const anchorSchema = z.object({
  id,
  ref: z
    .object({
      item: id,
      anchor: id,
      tile: coords
    })
    .partial()
});

export const connectorSchema = z.object({
  id,
  description: constrainedStrings.description.optional(),
  color: id.optional(),
  width: z.number().optional(),
  style: z.enum(connectorStyleOptions).optional(),
  animated: z.boolean().optional(),
  direction: z.enum(connectorDirectionOptions).optional(),
  anchors: z.array(anchorSchema),
  protocol: z.enum(connectorProtocolOptions).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  mode: z.enum(connectorModeOptions).optional(),
  auth: z.enum(connectorAuthOptions).optional()
});
