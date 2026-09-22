// Pure Terraform address parsing (P3 Terraform import). A resource address
// looks like `aws_instance.web`, `aws_subnet.public[0]` or, nested inside
// modules, `module.network.module.subnets.aws_subnet.public["a"]`. This
// module never talks to a Terraform JSON document — it only knows strings.
export interface ParsedAddress {
  modulePath: string[];
  type: string;
  name: string;
  index?: string;
}

const MODULE_PREFIX_RE = /^module\.([^.[\]]+)(?:\[[^\]]*\])?\./;
const RESOURCE_RE = /^([a-z0-9_]+)\.([^.[\]]+)(?:\[([^\]]*)\])?$/;

// Undefined for anything that doesn't parse as a resource address (e.g. an
// output reference, or a malformed string) — callers treat that as "skip",
// never throw out of a pure parser.
export const parseAddress = (address: string): ParsedAddress | undefined => {
  let rest = address;
  const modulePath: string[] = [];

  let match = MODULE_PREFIX_RE.exec(rest);
  while (match) {
    modulePath.push(match[1]);
    rest = rest.slice(match[0].length);
    match = MODULE_PREFIX_RE.exec(rest);
  }

  const resourceMatch = RESOURCE_RE.exec(rest);
  if (!resourceMatch) return undefined;

  return {
    modulePath,
    type: resourceMatch[1],
    name: resourceMatch[2],
    index: resourceMatch[3]
  };
};

// Groups resources by (module path, type, name) — the identity of a
// resource *block*, ignoring its count/for_each index. Used to match a
// config-level reference (which never carries an index) back to the
// concrete instance(s) it names.
export const blockKey = (
  modulePath: string[],
  type: string,
  name: string
): string => {
  return `${modulePath.join('/')}|${type}|${name}`;
};

// A reference string from a config expression's `references` (e.g.
// `aws_vpc.main.id`, `aws_security_group.app.id`) resolved down to the
// (type, name) of the resource it names — relative to the referencing
// resource's own module. Cross-module references (`module.x...`) and
// non-resource references (`var.`, `local.`, `data.`, `each.`, `count.`,
// `path.`, `terraform.`) are intentionally not resolved: a cross-module
// reference to a *resource* would have to go through that module's output
// variables, which this importer doesn't trace — staying conservative (no
// invented edges) rather than guessing.
const UNRESOLVED_REFERENCE_PREFIXES = [
  'module.',
  'var.',
  'local.',
  'data.',
  'each.',
  'count.',
  'path.',
  'terraform.'
];

export const parseReferenceToResource = (
  reference: string
): { type: string; name: string } | undefined => {
  if (
    UNRESOLVED_REFERENCE_PREFIXES.some((prefix) => {
      return reference.startsWith(prefix);
    })
  ) {
    return undefined;
  }

  const match = /^([a-z0-9_]+)\.([^.[\]]+)/.exec(reference);
  if (!match) return undefined;

  return { type: match[1], name: match[2] };
};
