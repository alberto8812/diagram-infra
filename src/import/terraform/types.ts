// Minimal, loose types for `terraform show -json` output (P3 Terraform
// import). Deliberately not exhaustive of the real schema — only the shape
// this importer actually reads. `values` stays `unknown`-typed per field:
// Terraform's per-resource attribute set differs by provider/type, and this
// importer only ever reads a handful of named attributes off it (see
// attributes.ts), never assumes the full shape.
export interface TerraformResourceRaw {
  address: string;
  mode?: string; // 'managed' | 'data'
  type: string;
  name: string;
  values?: Record<string, unknown>;
}

export interface TerraformModuleRaw {
  address?: string;
  resources?: TerraformResourceRaw[];
  child_modules?: TerraformModuleRaw[];
}

// A config "expression" as terraform show -json represents it: either a
// literal (`constant_value`) or one or more references to other addresses
// (`references`) — e.g. `{"references": ["aws_vpc.main.id"]}` for
// `vpc_id = aws_vpc.main.id`. Only `references` matters here; a constant
// value carries no relationship to resolve.
export interface TerraformExpression {
  constant_value?: unknown;
  references?: string[];
}

export interface TerraformConfigResource {
  address: string;
  type: string;
  name: string;
  expressions?: Record<string, TerraformExpression | undefined>;
  depends_on?: string[];
}

export interface TerraformConfigModule {
  resources?: TerraformConfigResource[];
  module_calls?: Record<string, { module?: TerraformConfigModule } | undefined>;
}

// Accepts both `terraform show -json` shapes:
// - state: `values.root_module...`
// - plan: `planned_values.root_module...`, optionally with `configuration`
//   for reference-based containment/connectors that a plan's `values` alone
//   can't carry (computed attributes are still unknown before apply).
export interface TerraformShowJson {
  format_version?: string;
  values?: { root_module?: TerraformModuleRaw };
  planned_values?: { root_module?: TerraformModuleRaw };
  configuration?: { root_module?: TerraformConfigModule };
}
