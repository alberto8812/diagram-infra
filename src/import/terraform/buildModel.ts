// Assembles a full Isoflow Model from a parsed terraform show -json document
// (P3 Terraform import): resolve.ts maps resources and containment, then
// layout.ts places everything on the tile grid, and this module turns the
// result into schema-valid Model items/rectangles/connectors — clamping the
// handful of string fields that carry a max length in modelSchema
// (name/label-class fields), since a Terraform tag or attribute is
// unconstrained free text.
import { generateId } from 'src/utils';
import { Connector, Model, Rectangle, View, ViewItem } from 'src/types';
import { DESCRIPTION_MAX_LENGTH } from 'src/schemas/common';
import { resolveTerraform, TerraformImportSummary } from './resolve';
import { layoutTerraformZones } from './layout';
import { TerraformShowJson } from './types';

export interface TerraformImportResult {
  model: Model;
  summary: TerraformImportSummary;
}

const NAME_MAX = 100;
const LABEL_MAX = 60;

const clamp = (
  value: string | undefined,
  maxLength: number
): string | undefined => {
  if (value === undefined) return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

export const buildTerraformModel = (
  doc: TerraformShowJson,
  diagramTitle: string
): TerraformImportResult => {
  const { zones, items, parentId, connectors, summary } = resolveTerraform(doc);
  const { zoneBounds, itemTiles } = layoutTerraformZones(
    zones,
    items,
    parentId
  );

  const modelItems: Model['items'] = items.map((item) => {
    return {
      id: item.id,
      name: clamp(item.name, NAME_MAX) ?? item.id,
      description: clamp(item.description, DESCRIPTION_MAX_LENGTH),
      kind: item.resourceKind,
      environment: item.environment,
      engine: clamp(item.engine, LABEL_MAX),
      version: clamp(item.version, LABEL_MAX),
      region: clamp(item.region, LABEL_MAX),
      owner: clamp(item.owner, LABEL_MAX),
      port: item.port,
      encryptedAtRest: item.encryptedAtRest,
      internetFacing: item.internetFacing
    };
  });

  const viewItems: ViewItem[] = items.map((item) => {
    // Every item was placed by layoutTerraformZones — a missing tile would
    // be a bug in that pass, not a recoverable input problem.
    const tile = itemTiles.get(item.id);
    if (!tile) {
      throw new Error(`Terraform import: no computed tile for item ${item.id}`);
    }

    return { id: item.id, tile };
  });

  const rectangles: Rectangle[] = zones.map((zone) => {
    const bounds = zoneBounds.get(zone.id);
    if (!bounds) {
      throw new Error(
        `Terraform import: no computed bounds for zone ${zone.id}`
      );
    }

    return {
      id: zone.id,
      from: bounds.from,
      to: bounds.to,
      zone: zone.zoneType,
      name: clamp(zone.name, LABEL_MAX),
      visibility: zone.visibility
    };
  });

  const modelConnectors: Connector[] = connectors.map((connector) => {
    return {
      id: connector.id,
      anchors: [
        { id: generateId(), ref: { item: connector.fromId } },
        { id: generateId(), ref: { item: connector.toId } }
      ]
    };
  });

  const view: View = {
    id: generateId(),
    name: diagramTitle,
    items: viewItems,
    rectangles,
    connectors: modelConnectors
  };

  const model: Model = {
    title: diagramTitle,
    items: modelItems,
    views: [view],
    icons: [],
    colors: []
  };

  return { model, summary };
};
