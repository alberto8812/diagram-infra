import { TerraformImportError } from './resolve';
import { buildTerraformModel, TerraformImportResult } from './buildModel';
import { TerraformShowJson } from './types';

export { TERRAFORM_RESOURCE_MAP } from './resourceMap';
export type {
  TerraformResourceMapping,
  TerraformZoneMapping,
  TerraformItemMapping
} from './resourceMap';
export { resolveTerraform, TerraformImportError } from './resolve';
export type {
  MappedZone,
  MappedItem,
  MappedConnector,
  TerraformResolveResult,
  TerraformImportSummary
} from './resolve';
export { layoutTerraformZones } from './layout';
export type { TerraformLayoutResult, ZoneBounds } from './layout';
export { buildTerraformModel } from './buildModel';
export type { TerraformImportResult } from './buildModel';
export type {
  TerraformShowJson,
  TerraformModuleRaw,
  TerraformResourceRaw,
  TerraformConfigResource,
  TerraformConfigModule,
  TerraformExpression
} from './types';

// Top-level entry point for the UI (BasicEditor's "Import" action): parses
// raw JSON text, throwing TerraformImportError (see resolve.ts) for
// anything that isn't shaped like a `terraform show -json` document rather
// than silently producing an empty diagram.
export const parseTerraformImportSource = (
  source: string
): TerraformShowJson => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch (err) {
    throw new TerraformImportError('The file is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TerraformImportError(
      'The file does not look like a `terraform show -json` document.'
    );
  }

  return parsed as TerraformShowJson;
};

export const importTerraform = (
  source: string,
  diagramTitle: string
): TerraformImportResult => {
  const doc = parseTerraformImportSource(source);
  return buildTerraformModel(doc, diagramTitle);
};
