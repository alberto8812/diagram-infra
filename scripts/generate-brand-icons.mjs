#!/usr/bin/env node
// Reads brand metadata (title, hex, path) for a fixed list of slugs out of the
// `simple-icons` devDependency and writes them into a small, static,
// commit-ready TS module. `simple-icons` (v13+) is ESM-only and ships ~3,500
// icons; importing it at runtime would pull that whole package into the
// webpack bundle. Reading its `data/simple-icons.json` + `icons/<slug>.svg`
// files at build time, and writing only the ~85 slugs this project actually
// uses, keeps it out of the shipped bundle entirely — see
// src/examples/initialData.ts and odd/tasks/local-isometric-icons.md (T2).
//
// Run with `npm run icons:generate` after bumping the `simple-icons`
// devDependency, or after editing SLUGS below.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const simpleIconsDataPath = path.join(
  repoRoot,
  'node_modules/simple-icons/data/simple-icons.json'
);
const simpleIconsIconsDir = path.join(repoRoot, 'node_modules/simple-icons/icons');
const outputPath = path.join(
  repoRoot,
  'src/examples/brandIconData.generated.ts'
);

// The exact set of Simple Icons slugs this project bundles, one entry per
// icon `src/examples/initialData.ts` needs — not a full mirror of the
// package. `id` is the id `initialData.ts` uses (which existing saved
// diagrams, e.g. diagrams/infra.json, reference and which must stay stable);
// `slug` is the Simple Icons slug when it differs from `id`.
const SLUGS = [
  // Languages and runtimes
  { id: 'nodedotjs' },
  { id: 'bun' },
  { id: 'deno' },
  { id: 'typescript' },
  { id: 'python' },
  { id: 'openjdk' },
  { id: 'go' },
  { id: 'rust' },
  { id: 'dotnet' },

  // Frameworks
  { id: 'nestjs' },
  { id: 'nextdotjs' },
  { id: 'react' },
  { id: 'angular' },
  { id: 'vuedotjs' },
  { id: 'express' },
  { id: 'spring' },
  { id: 'springboot' },
  { id: 'fastapi' },
  { id: 'django' },
  { id: 'laravel' },

  // APIs and contracts (grpc has no Simple Icons entry — monogram fallback,
  // see FALLBACK_IDS in src/examples/initialData.ts)
  { id: 'graphql' },
  { id: 'openapiinitiative' },
  { id: 'swagger' },

  // Data stores
  { id: 'redis' },
  { id: 'postgresql' },
  { id: 'mariadb' },
  { id: 'mongodb' },
  { id: 'sqlite' },
  { id: 'apachecassandra' },
  { id: 'neo4j' },
  { id: 'elasticsearch' },
  { id: 'minio' },
  { id: 'qdrant' },
  { id: 'supabase' },
  { id: 'firebase' },

  // Messaging and streaming
  { id: 'apachekafka' },
  { id: 'rabbitmq' },
  { id: 'nats.io', slug: 'natsdotio' },
  { id: 'apachespark' },
  { id: 'apacheairflow' },

  // Identity and security
  { id: 'keycloak' },
  { id: 'auth0' },
  { id: 'okta' },
  { id: 'jsonwebtokens' },
  { id: 'vault' },

  // Networking and edge
  { id: 'nginx' },
  { id: 'traefikproxy' },
  { id: 'kong' },
  { id: 'envoyproxy' },
  { id: 'istio' },
  { id: 'cloudflare' },
  { id: 'vercel' },

  // Containers, platform and delivery
  { id: 'docker' },
  { id: 'kubernetes' },
  { id: 'helm' },
  { id: 'argo' },
  { id: 'ansible' },
  { id: 'jenkins' },
  { id: 'gitlab' },
  { id: 'linux' },
  { id: 'ubuntu' },

  // Observability
  { id: 'prometheus' },
  { id: 'grafana' },
  { id: 'opentelemetry' },
  { id: 'jaeger' },
  { id: 'datadog' },
  { id: 'sentry' },

  // AI and LLM tooling (openai has no Simple Icons entry — monogram
  // fallback, see FALLBACK_IDS in src/examples/initialData.ts)
  { id: 'anthropic' },
  { id: 'claude' },
  { id: 'googlegemini' },
  { id: 'mistralai' },
  { id: 'meta' },
  { id: 'ollama' },
  { id: 'huggingface' },
  { id: 'modelcontextprotocol' },
  { id: 'langchain' },
  { id: 'perplexity' },

  // CI/CD (gh-actions uses the "githubactions" slug; mysql/terraform also
  // appear here for the Flyway + GitHub Actions + MySQL diagram; aws-vpc
  // stays a hand-authored data URI, see initialData.ts)
  { id: 'git' },
  { id: 'github' },
  { id: 'gh-actions', slug: 'githubactions' },
  { id: 'flyway' },
  { id: 'mysql' },
  { id: 'terraform' }
];

const iconsData = JSON.parse(readFileSync(simpleIconsDataPath, 'utf8'));
const bySlug = new Map(iconsData.map((icon) => [icon.slug, icon]));

const PATH_REGEX = /<path\s+d="([^"]+)"/;

const entries = [];
const missing = [];

for (const { id, slug = id } of SLUGS) {
  const meta = bySlug.get(slug);
  const svgPath = path.join(simpleIconsIconsDir, `${slug}.svg`);

  if (!meta) {
    missing.push(`${id} (slug "${slug}" not found in simple-icons data)`);
    continue;
  }

  let svgSource;
  try {
    svgSource = readFileSync(svgPath, 'utf8');
  } catch {
    missing.push(`${id} (no ${slug}.svg in simple-icons/icons)`);
    continue;
  }

  const match = svgSource.match(PATH_REGEX);
  if (!match) {
    missing.push(`${id} (could not extract a <path d="..."> from ${slug}.svg)`);
    continue;
  }

  entries.push({ id, title: meta.title, hex: `#${meta.hex}`, path: match[1] });
}

if (missing.length > 0) {
  process.stderr.write(
    `generate-brand-icons: ${missing.length} slug(s) had no usable Simple Icons data (expected — they get a monogram fallback in initialData.ts):\n${missing
      .map((line) => `  - ${line}`)
      .join('\n')}\n`
  );
}

const escapeTsString = (value) => {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
};

// Matches this project's Prettier config (quoteProps left at its default,
// "as-needed"): quote an object key only when it isn't already a valid bare
// identifier (e.g. `gh-actions`, `nats.io`).
const VALID_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const formatKey = (key) => {
  return VALID_IDENTIFIER.test(key) ? key : `'${escapeTsString(key)}'`;
};

const body = entries
  .map(({ id, title, hex, path: d }) => {
    return `  ${formatKey(id)}: {\n    title: '${escapeTsString(
      title
    )}',\n    hex: '${escapeTsString(hex)}',\n    path: '${escapeTsString(
      d
    )}'\n  }`;
  })
  .join(',\n');

const output = `// GENERATED FILE — do not edit by hand.
// Source: the \`simple-icons\` devDependency (CC0-1.0 license), regenerated with
// \`npm run icons:generate\` (scripts/generate-brand-icons.mjs). Holds only the
// icons src/examples/initialData.ts bundles, keyed by the id initialData.ts
// uses. Slugs with no Simple Icons entry (openai, grpc) are intentionally
// absent here — initialData.ts falls back to a generated monogram for those.

export interface BrandIconData {
  title: string;
  hex: string;
  path: string;
}

export const brandIconData: Record<string, BrandIconData> = {
${body}
};
`;

writeFileSync(outputPath, output, 'utf8');

process.stdout.write(
  `generate-brand-icons: wrote ${entries.length} icon(s) to ${path.relative(
    repoRoot,
    outputPath
  )}\n`
);
