import { icons } from '../initialData';

// Every id that existed before the icons were rebuilt as local isometric
// blocks (src/utils/isometricBrandIcon.ts, src/examples/initialData.ts,
// odd/tasks/local-isometric-icons.md T1/T2) — saved diagrams (e.g.
// diagrams/infra.json) reference icons by these ids, so none may disappear.
const PREVIOUSLY_EXISTING_IDS = [
  // cicd
  'git',
  'github',
  'gh-actions',
  'flyway',
  'mysql',
  'terraform',
  'aws-vpc',
  // runtimes
  'nodedotjs',
  'bun',
  'deno',
  'typescript',
  'python',
  'openjdk',
  'go',
  'rust',
  'dotnet',
  // frameworks
  'nestjs',
  'nextdotjs',
  'react',
  'angular',
  'vuedotjs',
  'express',
  'spring',
  'springboot',
  'fastapi',
  'django',
  'laravel',
  // apis
  'graphql',
  'grpc',
  'openapiinitiative',
  'swagger',
  // data
  'redis',
  'postgresql',
  'mariadb',
  'mongodb',
  'sqlite',
  'apachecassandra',
  'neo4j',
  'elasticsearch',
  'minio',
  'qdrant',
  'supabase',
  'firebase',
  // messaging
  'apachekafka',
  'rabbitmq',
  'nats.io',
  'apachespark',
  'apacheairflow',
  // identity
  'keycloak',
  'auth0',
  'okta',
  'jsonwebtokens',
  'vault',
  // networking
  'nginx',
  'traefikproxy',
  'kong',
  'envoyproxy',
  'istio',
  'cloudflare',
  'vercel',
  // platform
  'docker',
  'kubernetes',
  'helm',
  'argo',
  'ansible',
  'jenkins',
  'gitlab',
  'linux',
  'ubuntu',
  // observability
  'prometheus',
  'grafana',
  'opentelemetry',
  'jaeger',
  'datadog',
  'sentry',
  // ai
  'anthropic',
  'claude',
  'openai',
  'googlegemini',
  'mistralai',
  'meta',
  'ollama',
  'huggingface',
  'modelcontextprotocol',
  'langchain',
  'perplexity'
];

const PREVIOUSLY_EXISTING_COLLECTIONS = [
  'cicd',
  'runtimes',
  'frameworks',
  'apis',
  'data',
  'messaging',
  'identity',
  'networking',
  'platform',
  'observability',
  'ai'
];

describe('example icon set', () => {
  it('gives every icon a unique id', () => {
    const ids = icons.map((icon) => {
      return icon.id;
    });
    const duplicates = ids.filter((id, index) => {
      return ids.indexOf(id) !== index;
    });

    expect(duplicates).toEqual([]);
  });

  it('only loads icons over https or inline data URIs', () => {
    const insecure = icons.filter((icon) => {
      return !/^(https:|data:image\/)/.test(icon.url);
    });

    expect(insecure).toEqual([]);
  });

  it('bundles every icon as a local data URI — none depend on an external host', () => {
    const external = icons.filter((icon) => {
      return !icon.url.startsWith('data:image/');
    });

    expect(external).toEqual([]);
  });

  it('includes the technology collections', () => {
    const collections = new Set(
      icons.map((icon) => {
        return icon.collection;
      })
    );

    expect([...collections]).toEqual(
      expect.arrayContaining(PREVIOUSLY_EXISTING_COLLECTIONS)
    );
  });

  it('keeps every previously existing icon id (saved diagrams reference them)', () => {
    const ids = new Set(
      icons.map((icon) => {
        return icon.id;
      })
    );

    const missing = PREVIOUSLY_EXISTING_IDS.filter((id) => {
      return !ids.has(id);
    });

    expect(missing).toEqual([]);
  });

  it('marks every brand icon as isometric, like the bundled isopacks', () => {
    const brandIds = PREVIOUSLY_EXISTING_IDS.filter((id) => {
      return id !== 'aws-vpc';
    });

    const nonIsometric = icons.filter((icon) => {
      return brandIds.includes(icon.id) && !icon.isIsometric;
    });

    expect(nonIsometric).toEqual([]);
  });
});
