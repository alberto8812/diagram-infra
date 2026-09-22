// Pure resolution pass (P3 Terraform import): turns a parsed `terraform show
// -json` document into mapped zones/items, their containment (which zone id
// each node sits directly inside, if any) and a conservative connector list.
// No layout, no Isoflow schema types here — see layout.ts/buildModel.ts for
// the next steps. Kept framework-free and side-effect-free so it's cheap to
// unit test against small fixture documents.
import { Environment, ResourceKind, ZoneKind, ZoneVisibility } from 'src/types';
import { blockKey, parseAddress, parseReferenceToResource } from './address';
import {
  deriveEncryptedAtRest,
  deriveEngineVersion,
  deriveEnvironment,
  deriveInternetFacing,
  deriveOwner,
  derivePort,
  deriveRegion,
  readTags,
  TerraformValues
} from './attributes';
import {
  TERRAFORM_RESOURCE_MAP,
  TerraformResourceMapping
} from './resourceMap';
import {
  TerraformConfigModule,
  TerraformConfigResource,
  TerraformModuleRaw,
  TerraformResourceRaw,
  TerraformShowJson
} from './types';

export interface MappedZone {
  kind: 'zone';
  id: string;
  zoneType: ZoneKind;
  name: string;
  visibility?: ZoneVisibility;
}

export interface MappedItem {
  kind: 'item';
  id: string;
  resourceKind: ResourceKind;
  name: string;
  description: string;
  environment?: Environment;
  owner?: string;
  engine?: string;
  version?: string;
  region?: string;
  port?: number;
  encryptedAtRest?: boolean;
  internetFacing?: boolean;
}

export interface MappedConnector {
  id: string;
  fromId: string;
  toId: string;
}

export interface TerraformImportSummary {
  mappedResources: number;
  skippedResources: number;
  skippedTypes: string[];
  dataResources: number;
}

export interface TerraformResolveResult {
  zones: MappedZone[];
  items: MappedItem[];
  // Node id -> the id of the zone it sits directly inside. A node with no
  // entry here is top-level (no containing zone was resolvable).
  parentId: Map<string, string>;
  connectors: MappedConnector[];
  summary: TerraformImportSummary;
}

export class TerraformImportError extends Error {}

interface InternalResource {
  address: string;
  type: string;
  name: string;
  modulePath: string[];
  mapping: TerraformResourceMapping;
  values: TerraformValues;
}

const collectRawResources = (
  rootModule: TerraformModuleRaw | undefined
): TerraformResourceRaw[] => {
  if (!rootModule) return [];

  const result: TerraformResourceRaw[] = [];

  const walk = (mod: TerraformModuleRaw) => {
    (mod.resources ?? []).forEach((resource) => {
      result.push(resource);
    });
    (mod.child_modules ?? []).forEach(walk);
  };

  walk(rootModule);

  return result;
};

interface ConfigEntry {
  modulePath: string[];
  resource: TerraformConfigResource;
}

const collectConfigResources = (
  rootModule: TerraformConfigModule | undefined
): ConfigEntry[] => {
  if (!rootModule) return [];

  const result: ConfigEntry[] = [];

  const walk = (mod: TerraformConfigModule, modulePath: string[]) => {
    (mod.resources ?? []).forEach((resource) => {
      result.push({ modulePath, resource });
    });

    Object.entries(mod.module_calls ?? {}).forEach(([callName, call]) => {
      if (call?.module) walk(call.module, [...modulePath, callName]);
    });
  };

  walk(rootModule, []);

  return result;
};

// Attributes excluded from the generic connector pass because they already
// drive containment (subnet_id/vpc_id/availability_zone/
// db_subnet_group_name) or security-group membership — connecting e.g. an
// instance to every security group it belongs to would model "instance -> db
// via security group rules", which the P3 scope explicitly leaves out.
const CONNECTOR_EXCLUDED_ATTRS = new Set([
  'vpc_id',
  'subnet_id',
  'availability_zone',
  'db_subnet_group_name',
  'vpc_security_group_ids',
  'security_groups',
  'security_group_ids'
]);

export const resolveTerraform = (
  doc: TerraformShowJson
): TerraformResolveResult => {
  const rootModule = doc.values?.root_module ?? doc.planned_values?.root_module;

  if (!rootModule) {
    throw new TerraformImportError(
      'Not a recognized terraform show -json document: no values.root_module or planned_values.root_module found.'
    );
  }

  const rawResources = collectRawResources(rootModule);
  const configEntries = collectConfigResources(doc.configuration?.root_module);
  const configIndex = new Map<string, ConfigEntry>();
  configEntries.forEach((entry) => {
    configIndex.set(
      blockKey(entry.modulePath, entry.resource.type, entry.resource.name),
      entry
    );
  });

  const internal: InternalResource[] = [];
  let dataResources = 0;
  let skippedResources = 0;
  const skippedTypes = new Set<string>();

  rawResources.forEach((raw) => {
    if (raw.mode === 'data') {
      dataResources += 1;
      return;
    }

    const parsed = parseAddress(raw.address);
    if (!parsed) {
      skippedResources += 1;
      return;
    }

    const mapping = TERRAFORM_RESOURCE_MAP[raw.type];
    if (!mapping) {
      skippedResources += 1;
      skippedTypes.add(raw.type);
      return;
    }

    internal.push({
      address: raw.address,
      type: raw.type,
      name: raw.name,
      modulePath: parsed.modulePath,
      mapping,
      values: raw.values ?? {}
    });
  });

  // Lookup indexes used to resolve an attribute reference to another mapped
  // resource: `byBlock` for config-level references (works pre-apply, since
  // it never needs a real AWS id), `byLiteralValue` for state-level literal
  // ids/arns (works post-apply).
  const byBlock = new Map<string, InternalResource[]>();
  const byLiteralValue = new Map<string, InternalResource>();

  internal.forEach((resource) => {
    const key = blockKey(resource.modulePath, resource.type, resource.name);
    const existing = byBlock.get(key) ?? [];
    existing.push(resource);
    byBlock.set(key, existing);

    const idValue = resource.values.id;
    if (typeof idValue === 'string') byLiteralValue.set(idValue, resource);

    const arnValue = resource.values.arn;
    if (typeof arnValue === 'string') byLiteralValue.set(arnValue, resource);
  });

  const configFor = (
    resource: InternalResource
  ): TerraformConfigResource | undefined => {
    return configIndex.get(
      blockKey(resource.modulePath, resource.type, resource.name)
    )?.resource;
  };

  // Resolves a single-valued attribute reference (`vpc_id`, `subnet_id`,
  // ...) to the mapped resource it points at — preferring a config
  // reference (plan, pre-apply) and falling back to matching a literal
  // id/arn against another resource's own id/arn (state, post-apply).
  const resolveSingle = (
    resource: InternalResource,
    attr: string
  ): InternalResource | undefined => {
    const configResource = configFor(resource);
    const refs = configResource?.expressions?.[attr]?.references;

    if (refs && refs.length > 0) {
      const parsedRef = parseReferenceToResource(refs[0]);
      if (parsedRef) {
        const candidates = byBlock.get(
          blockKey(resource.modulePath, parsedRef.type, parsedRef.name)
        );
        if (candidates && candidates.length > 0) return candidates[0];
      }
    }

    const literal = resource.values[attr];
    if (typeof literal === 'string') return byLiteralValue.get(literal);

    return undefined;
  };

  // Same as resolveSingle, but for a list-valued attribute
  // (`vpc_security_group_ids`, ...) — every element that resolves.
  const resolveList = (
    resource: InternalResource,
    attr: string
  ): InternalResource[] => {
    const configResource = configFor(resource);
    const refs = configResource?.expressions?.[attr]?.references;

    if (refs && refs.length > 0) {
      return refs
        .map(parseReferenceToResource)
        .filter((parsedRef): parsedRef is { type: string; name: string } => {
          return parsedRef !== undefined;
        })
        .map((parsedRef) => {
          return byBlock.get(
            blockKey(resource.modulePath, parsedRef.type, parsedRef.name)
          )?.[0];
        })
        .filter((r): r is InternalResource => {
          return r !== undefined;
        });
    }

    const literal = resource.values[attr];
    if (!Array.isArray(literal)) return [];

    return literal
      .filter((v): v is string => {
        return typeof v === 'string';
      })
      .map((v) => {
        return byLiteralValue.get(v);
      })
      .filter((r): r is InternalResource => {
        return r !== undefined;
      });
  };

  const zonesById = new Map<string, MappedZone>();
  const parentId = new Map<string, string>();

  const ensureRegionZone = (region: string): string => {
    const id = `region:${region}`;
    if (!zonesById.has(id)) {
      zonesById.set(id, { kind: 'zone', id, zoneType: 'region', name: region });
    }
    return id;
  };

  // AZ zones are synthesized (no dedicated terraform resource type),
  // scoped per VPC when one is known so "us-east-1a" in two different VPCs
  // doesn't become a single shared zone.
  const ensureAzZone = (vpcId: string | undefined, az: string): string => {
    const id = `${vpcId ?? 'global'}:az:${az}`;
    if (!zonesById.has(id)) {
      zonesById.set(id, { kind: 'zone', id, zoneType: 'az', name: az });
      if (vpcId) parentId.set(id, vpcId);
    }
    return id;
  };

  const vpcResources = internal.filter((r) => {
    return r.mapping.kind === 'zone' && r.mapping.zone === 'vpc';
  });
  const subnetResources = internal.filter((r) => {
    return r.mapping.kind === 'zone' && r.mapping.zone === 'subnet';
  });
  const sgResources = internal.filter((r) => {
    return r.mapping.kind === 'zone' && r.mapping.zone === 'securityGroup';
  });
  const itemResources = internal.filter((r): r is InternalResource => {
    return r.mapping.kind === 'item';
  });

  vpcResources.forEach((vpc) => {
    const name = readTags(vpc.values).Name ?? vpc.name;
    zonesById.set(vpc.address, {
      kind: 'zone',
      id: vpc.address,
      zoneType: 'vpc',
      name
    });

    const region = deriveRegion(vpc.values);
    if (region) parentId.set(vpc.address, ensureRegionZone(region));
  });

  const subnetVisibility = (
    subnet: InternalResource
  ): ZoneVisibility | undefined => {
    if (subnet.values.map_public_ip_on_launch === true) return 'public';
    if (subnet.values.map_public_ip_on_launch === false) return 'private';
    return undefined;
  };

  subnetResources.forEach((subnet) => {
    const name = readTags(subnet.values).Name ?? subnet.name;
    const visibility = subnetVisibility(subnet);

    zonesById.set(subnet.address, {
      kind: 'zone',
      id: subnet.address,
      zoneType: 'subnet',
      name,
      visibility
    });

    const vpcTarget = resolveSingle(subnet, 'vpc_id');
    const az =
      typeof subnet.values.availability_zone === 'string'
        ? subnet.values.availability_zone
        : undefined;

    if (vpcTarget && az) {
      parentId.set(subnet.address, ensureAzZone(vpcTarget.address, az));
    } else if (vpcTarget) {
      parentId.set(subnet.address, vpcTarget.address);
    } else if (az) {
      parentId.set(subnet.address, ensureAzZone(undefined, az));
    }
  });

  sgResources.forEach((sg) => {
    const vpcTarget = resolveSingle(sg, 'vpc_id');
    if (vpcTarget) parentId.set(sg.address, vpcTarget.address);
  });

  const items: MappedItem[] = itemResources.map((resource) => {
    if (resource.mapping.kind !== 'item') {
      throw new TerraformImportError('unreachable: filtered to item mappings');
    }

    const tags = readTags(resource.values);
    const environment = deriveEnvironment(tags, resource.values);
    const owner = deriveOwner(tags);
    const { engine, version } = deriveEngineVersion(resource.values);

    const subnetTarget = resolveSingle(resource, 'subnet_id');
    const vpcTarget = resolveSingle(resource, 'vpc_id');
    const az =
      typeof resource.values.availability_zone === 'string'
        ? resource.values.availability_zone
        : undefined;

    if (subnetTarget) {
      parentId.set(resource.address, subnetTarget.address);
    } else if (vpcTarget) {
      parentId.set(resource.address, vpcTarget.address);
    } else if (az) {
      parentId.set(resource.address, ensureAzZone(undefined, az));
    }

    return {
      kind: 'item',
      id: resource.address,
      resourceKind: resource.mapping.resourceKind,
      name: tags.Name ?? resource.name,
      description: `Terraform: ${resource.address}`,
      environment,
      owner,
      engine,
      version,
      region: deriveRegion(resource.values),
      port: derivePort(resource.values),
      encryptedAtRest: deriveEncryptedAtRest(resource.values),
      internetFacing: deriveInternetFacing(resource.values)
    };
  });

  // Security-group membership only decides whether the SG zone is worth
  // showing (see TERRAFORM_RESOURCE_MAP) — it never drives containment or
  // connectors (an instance<->db relationship implied only via shared
  // security group rules is explicitly out of scope for P3).
  const sgHasMembers = new Set<string>();
  itemResources.forEach((resource) => {
    [
      ...resolveList(resource, 'vpc_security_group_ids'),
      ...resolveList(resource, 'security_groups'),
      ...resolveList(resource, 'security_group_ids')
    ].forEach((sg) => {
      sgHasMembers.add(sg.address);
    });
  });

  sgResources
    .filter((sg) => {
      return sgHasMembers.has(sg.address);
    })
    .forEach((sg) => {
      const name = readTags(sg.values).Name ?? sg.name;
      zonesById.set(sg.address, {
        kind: 'zone',
        id: sg.address,
        zoneType: 'securityGroup',
        name
      });
    });

  // Module-nesting fallback: any zone/item still without a resolved parent
  // (attribute-based containment above found nothing) sits inside a
  // synthetic zone per module path segment instead of floating unplaced.
  const ensureModuleZone = (modulePath: string[]): string => {
    let parent: string | undefined;

    modulePath.forEach((_segment, i) => {
      const path = modulePath.slice(0, i + 1);
      const id = `module:${path.join('/')}`;

      if (!zonesById.has(id)) {
        zonesById.set(id, {
          kind: 'zone',
          id,
          zoneType: 'cluster',
          name: path[path.length - 1]
        });
        if (parent) parentId.set(id, parent);
      }

      parent = id;
    });

    // Non-null: modulePath is always non-empty when this is called.
    return parent as string;
  };

  const fallbackToModuleNesting = (resource: InternalResource) => {
    if (parentId.has(resource.address)) return;
    if (resource.modulePath.length === 0) return;

    parentId.set(resource.address, ensureModuleZone(resource.modulePath));
  };

  vpcResources.forEach(fallbackToModuleNesting);
  subnetResources
    .filter((s) => {
      return zonesById.has(s.address);
    })
    .forEach(fallbackToModuleNesting);
  sgResources
    .filter((sg) => {
      return sgHasMembers.has(sg.address);
    })
    .forEach(fallbackToModuleNesting);
  itemResources.forEach(fallbackToModuleNesting);

  // Connectors: only ever derived from `configuration` (depends_on +
  // attribute references) — a bare state import (no configuration block)
  // produces zero connectors rather than guessing from literal ids, per the
  // "no invented edges" rule. Endpoints are restricted to items: Isoflow
  // connectors join view items, never rectangles, so a reference/dependency
  // resolving to a zone (e.g. a security group) can't become a connector
  // endpoint here.
  const keptIds = new Set<string>(
    items.map((i) => {
      return i.id;
    })
  );

  const connectorPairs = new Map<string, MappedConnector>();

  const addConnector = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    if (!keptIds.has(fromId) || !keptIds.has(toId)) return;

    const key = [fromId, toId].sort().join('|');
    if (connectorPairs.has(key)) return;

    connectorPairs.set(key, { id: `tf-connector:${key}`, fromId, toId });
  };

  if (doc.configuration) {
    internal.forEach((resource) => {
      const configResource = configFor(resource);
      if (!configResource) return;

      (configResource.depends_on ?? []).forEach((dep) => {
        const parsedRef = parseReferenceToResource(dep);
        if (!parsedRef) return;

        const target = byBlock.get(
          blockKey(resource.modulePath, parsedRef.type, parsedRef.name)
        )?.[0];
        if (target) addConnector(resource.address, target.address);
      });

      Object.entries(configResource.expressions ?? {}).forEach(
        ([attr, expression]) => {
          if (CONNECTOR_EXCLUDED_ATTRS.has(attr)) return;

          (expression?.references ?? []).forEach((ref) => {
            const parsedRef = parseReferenceToResource(ref);
            if (!parsedRef) return;

            const target = byBlock.get(
              blockKey(resource.modulePath, parsedRef.type, parsedRef.name)
            )?.[0];
            if (target) addConnector(resource.address, target.address);
          });
        }
      );
    });
  }

  return {
    zones: [...zonesById.values()],
    items,
    parentId,
    connectors: [...connectorPairs.values()],
    summary: {
      mappedResources: zonesById.size + items.length,
      skippedResources,
      skippedTypes: [...skippedTypes].sort(),
      dataResources
    }
  };
};
