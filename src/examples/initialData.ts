/* eslint-disable import/no-extraneous-dependencies */
import { Colors, Icons, InitialData } from 'src/Isoflow';
import { flattenCollections } from '@isoflow/isopacks/dist/utils';
import isoflowIsopack from '@isoflow/isopacks/dist/isoflow';
import awsIsopack from '@isoflow/isopacks/dist/aws';
import gcpIsopack from '@isoflow/isopacks/dist/gcp';
import azureIsopack from '@isoflow/isopacks/dist/azure';
import kubernetesIsopack from '@isoflow/isopacks/dist/kubernetes';

const isopacks = flattenCollections([
  isoflowIsopack,
  awsIsopack,
  azureIsopack,
  gcpIsopack,
  kubernetesIsopack
]);

export const colors: Colors = [
  {
    id: 'color1',
    value: '#a5b8f3'
  },
  {
    id: 'color2',
    value: '#bbadfb'
  },
  {
    id: 'color3',
    value: '#f4eb8e'
  },
  {
    id: 'color4',
    value: '#f0aca9'
  },
  {
    id: 'color5',
    value: '#fad6ac'
  },
  {
    id: 'color6',
    value: '#a8dc9d'
  },
  {
    id: 'color7',
    value: '#b3e5e3'
  }
];

// CI/CD logos for the Flyway + GitHub Actions + MySQL infrastructure diagram.
// Sourced from Simple Icons (CC0). isIsometric is false so flat brand logos are
// not projected as 3D blocks.
const cicdIcons: Icons = [
  {
    id: 'git',
    name: 'Git',
    url: 'https://cdn.simpleicons.org/git/F05032',
    isIsometric: false,
    collection: 'cicd'
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://cdn.simpleicons.org/github/181717',
    isIsometric: false,
    collection: 'cicd'
  },
  {
    id: 'gh-actions',
    name: 'GitHub Actions',
    url: 'https://cdn.simpleicons.org/githubactions/2088FF',
    isIsometric: false,
    collection: 'cicd'
  },
  {
    id: 'flyway',
    name: 'Flyway',
    url: 'https://cdn.simpleicons.org/flyway/CC0000',
    isIsometric: false,
    collection: 'cicd'
  },
  {
    id: 'mysql',
    name: 'MySQL',
    url: 'https://cdn.simpleicons.org/mysql/4479A1',
    isIsometric: false,
    collection: 'cicd'
  },
  {
    id: 'terraform',
    name: 'Terraform',
    url: 'https://cdn.simpleicons.org/terraform/844FBA',
    isIsometric: false,
    collection: 'cicd'
  },
  // The bundled aws isopack has 320 icons but no VPC, so this one is the official
  // AWS Architecture Icons SVG, inlined. It must stay a data URI: dom-to-image
  // fetches every external image over XHR when exporting a PNG, and one host that
  // omits Access-Control-Allow-Origin fails the whole export.
  {
    id: 'aws-vpc',
    name: 'Amazon VPC',
    url: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iODBweCIgaGVpZ2h0PSI4MHB4IiB2aWV3Qm94PSIwIDAgODAgODAiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDY0ICg5MzUzNykgLSBodHRwczovL3NrZXRjaC5jb20gLS0+CiAgICA8dGl0bGU+SWNvbi1BcmNoaXRlY3R1cmUvNjQvQXJjaF9BbWF6b24tVmlydHVhbC1Qcml2YXRlLUNsb3VkXzY0PC90aXRsZT4KICAgIDxkZXNjPkNyZWF0ZWQgd2l0aCBTa2V0Y2guPC9kZXNjPgogICAgPGRlZnM+CiAgICAgICAgPGxpbmVhckdyYWRpZW50IHgxPSIwJSIgeTE9IjEwMCUiIHgyPSIxMDAlIiB5Mj0iMCUiIGlkPSJsaW5lYXJHcmFkaWVudC0xIj4KICAgICAgICAgICAgPHN0b3Agc3RvcC1jb2xvcj0iIzREMjdBOCIgb2Zmc2V0PSIwJSI+PC9zdG9wPgogICAgICAgICAgICA8c3RvcCBzdG9wLWNvbG9yPSIjQTE2NkZGIiBvZmZzZXQ9IjEwMCUiPjwvc3RvcD4KICAgICAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPC9kZWZzPgogICAgPGcgaWQ9Ikljb24tQXJjaGl0ZWN0dXJlLzY0L0FyY2hfQW1hem9uLVZpcnR1YWwtUHJpdmF0ZS1DbG91ZF82NCIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+CiAgICAgICAgPGcgaWQ9Ikljb24tQXJjaGl0ZWN0dXJlLUJHLzY0L05ldHdvcmtpbmctQ29udGVudC1EZWxpdmVyeSIgZmlsbD0idXJsKCNsaW5lYXJHcmFkaWVudC0xKSI+CiAgICAgICAgICAgIDxyZWN0IGlkPSJSZWN0YW5nbGUiIHg9IjAiIHk9IjAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCI+PC9yZWN0PgogICAgICAgIDwvZz4KICAgICAgICA8cGF0aCBkPSJNNjEsNDEuMzcxNzAyNSBMNTUuNSwzOS4xNzE3MDI1IEw1NS41LDU5LjEyMjcwMjUgQzU3LjEwNiw1OC45NjI3MDI1IDU4LjQwMSw1OC40MzQ3MDI1IDU5LjMyMSw1Ny41MDA3MDI1IEM2MS4wMjEsNTUuNzcyNzAyNSA2MS4wMDEsNTMuMjM5NzAyNSA2MSw1My4yMTQ3MDI1IEw2MSw0MS4zNzE3MDI1IFogTTUzLjUsNTkuMTM1NzAyNSBMNTMuNSwzOS4xNzE3MDI1IEw0OCw0MS4zNzE3MDI1IEw0OCw1My4xOTQ3MDI1IEM0OC4wMDcsNTMuNDAxNzAyNSA0OC4yMzQsNTguNTUxNzAyNSA1My41LDU5LjEzNTcwMjUgTDUzLjUsNTkuMTM1NzAyNSBaIE02Myw1My4xOTQ3MDI1IEM2My4wMDMsNTMuMzA3NzAyNSA2My4wNTMsNTYuNTQxNzAyNSA2MC43NjUsNTguODg0NzAyNSBDNTkuMjY5LDYwLjQxNzcwMjUgNTcuMTYsNjEuMTk0NzAyNSA1NC41LDYxLjE5NDcwMjUgQzQ3LjkyNyw2MS4xOTQ3MDI1IDQ2LjA2NSw1NS45NzY3MDI1IDQ2LDUzLjIxODcwMjUgTDQ2LDQwLjY5NDcwMjUgQzQ2LDQwLjI4NTcwMjUgNDYuMjQ5LDM5LjkxNzcwMjUgNDYuNjI5LDM5Ljc2NTcwMjUgTDU0LjEyOSwzNi43NjU3MDI1IEM1NC4zNjcsMzYuNjcwNzAyNSA1NC42MzMsMzYuNjcwNzAyNSA1NC44NzEsMzYuNzY1NzAyNSBMNjIuMzcxLDM5Ljc2NTcwMjUgQzYyLjc1MSwzOS45MTc3MDI1IDYzLDQwLjI4NTcwMjUgNjMsNDAuNjk0NzAyNSBMNjMsNTMuMTk0NzAyNSBaIE02Ni4wMDEsNTEuMjI4NzAyNSBMNjYsMzcuODcxNzAyNSBMNTQuNSwzMy4yNzE3MDI1IEw0MywzNy44NzE3MDI1IEw0Myw1MS4xOTQ3MDI1IEM0Mi45OTgsNTEuMjg1NzAyNSA0Mi44NjUsNTcuNDIyNzAyNSA0Ni41MzQsNjEuMTk4NzAyNSBDNDguNDY2LDYzLjE4NjcwMjUgNTEuMTQ2LDY0LjE5NDcwMjUgNTQuNSw2NC4xOTQ3MDI1IEM1Ny44NzcsNjQuMTk0NzAyNSA2MC41Nyw2My4xNzk3MDI1IDYyLjUwNCw2MS4xNzg3MDI1IEM2Ni4xNjgsNTcuMzg2NzAyNSA2Ni4wMDMsNTEuMjg5NzAyNSA2Ni4wMDEsNTEuMjI4NzAyNSBMNjYuMDAxLDUxLjIyODcwMjUgWiBNNjMuOTQyLDYyLjU2NzcwMjUgQzYxLjYxNyw2NC45NzQ3MDI1IDU4LjQ0LDY2LjE5NDcwMjUgNTQuNSw2Ni4xOTQ3MDI1IEM1MC41NzksNjYuMTk0NzAyNSA0Ny40MTMsNjQuOTc4NzAyNSA0NS4wOSw2Mi41ODA3MDI1IEM0MC44MzEsNTguMTg3NzAyNSA0MC45OTEsNTEuNDQ3NzAyNSA0MSw1MS4xNjM3MDI1IEw0MSwzNy4xOTQ3MDI1IEM0MSwzNi43ODU3MDI1IDQxLjI0OSwzNi40MTc3MDI1IDQxLjYyOSwzNi4yNjU3MDI1IEw1NC4xMjksMzEuMjY1NzAyNSBDNTQuMzY3LDMxLjE3MDcwMjUgNTQuNjMzLDMxLjE3MDcwMjUgNTQuODcxLDMxLjI2NTcwMjUgTDY3LjM3MSwzNi4yNjU3MDI1IEM2Ny43NTEsMzYuNDE3NzAyNSA2OCwzNi43ODU3MDI1IDY4LDM3LjE5NDcwMjUgTDY4LDUxLjE5NDcwMjUgQzY4LjAwOSw1MS40NDQ3MDI1IDY4LjE4OSw1OC4xNzI3MDI1IDYzLjk0Miw2Mi41Njc3MDI1IEw2My45NDIsNjIuNTY3NzAyNSBaIE0yMy4wNTUsNDcuMTk0NzAyNSBMMzgsNDcuMTk0NzAyNSBMMzgsNDkuMTk0NzAyNSBMMjMuMDU1LDQ5LjE5NDcwMjUgQzE2Ljk3Nyw0OS4xOTQ3MDI1IDEyLjMzNyw0NS4xNDI3MDI1IDEyLjAyNCwzOS41NTk3MDI1IEMxMi4wMDIsMzkuMzMxNzAyNSAxMiwzOS4wNjU3MDI1IDEyLDM4Ljc5OTcwMjUgQzEyLDMxLjkzMDcwMjUgMTYuODAzLDI5LjQwMTcwMjUgMTkuNjA0LDI4LjUxMTcwMjUgQzE5LjU4NCwyOC4xOTA3MDI1IDE5LjU3NCwyNy44NjU3MDI1IDE5LjU3NCwyNy41Mzg3MDI1IEMxOS41NzQsMjIuMDg1NzAyNSAyMy40NjQsMTYuMzgwNzAyNSAyOC42MjEsMTQuMjY4NzAyNSBDMzQuNjc3LDExLjc4ODcwMjUgNDEuMDYyLDEyLjk4OTcwMjUgNDUuNjk1LDE3LjQ3NTcwMjUgQzQ3LjI1NiwxOC45OTY3MDI1IDQ4LjQ0NiwyMC42MjA3MDI1IDQ5LjMwNywyMi40MDk3MDI1IEM1MC41MTMsMjEuMzc0NzAyNSA1MS45NjksMjAuODE4NzAyNSA1My41MjksMjAuODE4NzAyNSBDNTYuODM0LDIwLjgxODcwMjUgNjAuMzMsMjMuNDEyNzAyNSA2MC45MzEsMjguMzgxNzAyNSBDNjMuMTE0LDI4LjkzMTcwMjUgNjUuODU0LDMwLjA5OTcwMjUgNjcuNzg4LDMyLjU3OTcwMjUgTDY2LjIxMiwzMy44MDk3MDI1IEM2NC40MywzMS41MjM3MDI1IDYxLjc0MSwzMC41NzE3MDI1IDU5LjgsMzAuMTczNzAyNSBDNTkuMzU1LDMwLjA4MzcwMjUgNTkuMDI4LDI5LjcwNTcwMjUgNTkuMDAyLDI5LjI1MzcwMjUgQzU4Ljc0MSwyNC44MzI3MDI1IDU1Ljk4MiwyMi44MTg3MDI1IDUzLjUyOSwyMi44MTg3MDI1IEM1Mi4wNjcsMjIuODE4NzAyNSA1MC43NzEsMjMuNTA4NzAyNSA0OS43OCwyNC44MTM3MDI1IEM0OS41NTksMjUuMTA1NzAyNSA0OS4xOTksMjUuMjU2NzAyNSA0OC44MzUsMjUuMTk4NzAyNSBDNDguNDc0LDI1LjE0MzcwMjUgNDguMTcsMjQuODk2NzAyNSA0OC4wNDUsMjQuNTUzNzAyNSBDNDcuMjc4LDIyLjQ2MzcwMjUgNDYuMDU0LDIwLjYxNzcwMjUgNDQuMzAyLDE4LjkxMDcwMjUgQzQwLjI1OCwxNC45OTY3MDI1IDM0LjY3NiwxMy45NTE3MDI1IDI5LjM3OSwxNi4xMTk3MDI1IEMyNC45MywxNy45NDE3MDI1IDIxLjU3NCwyMi44NTA3MDI1IDIxLjU3NCwyNy41Mzg3MDI1IEMyMS41NzQsMjguMDc5NzAyNSAyMS42MDUsMjguNjE0NzAyNSAyMS42NjgsMjkuMTI3NzAyNSBDMjEuNzI5LDI5LjYyODcwMjUgMjEuNDA1LDMwLjA5NjcwMjUgMjAuOTE1LDMwLjIxODcwMjUgQzE4LjMzMywzMC44NTc3MDI1IDE0LDMyLjgyMzcwMjUgMTQsMzguNzk5NzAyNSBDMTQsMzkuMDAxNzAyNSAxMy45OTgsMzkuMjA0NzAyNSAxNC4wMTgsMzkuNDA3NzAyNSBDMTQuMjcyLDQzLjkzNTcwMjUgMTguMDcyLDQ3LjE5NDcwMjUgMjMuMDU1LDQ3LjE5NDcwMjUgTDIzLjA1NSw0Ny4xOTQ3MDI1IFoiIGlkPSJBbWF6b24tVmlydHVhbC1Qcml2YXRlLUNsb3VkX0ljb25fNjRfU3F1aWQiIGZpbGw9IiNGRkZGRkYiPjwvcGF0aD4KICAgIDwvZz4KPC9zdmc+',
    isIsometric: false,
    collection: 'cicd'
  }
];

// Technology logos for software and infrastructure design, grouped by
// collection so the icon picker shows them as separate sections. Every host
// below sends Access-Control-Allow-Origin: *, which PNG export depends on (see
// the aws-vpc note above). Most come from Simple Icons (CC0) in their default
// brand colour; the few Simple Icons no longer ships use a pinned alternative.
const simpleIcon = (
  slug: string,
  name: string,
  collection: string
): Icons[number] => {
  return {
    id: slug,
    name,
    url: `https://cdn.simpleicons.org/${slug}`,
    isIsometric: false,
    collection
  };
};

const techIcons: Icons = [
  // Languages and runtimes
  simpleIcon('nodedotjs', 'Node.js', 'runtimes'),
  simpleIcon('bun', 'Bun', 'runtimes'),
  simpleIcon('deno', 'Deno', 'runtimes'),
  simpleIcon('typescript', 'TypeScript', 'runtimes'),
  simpleIcon('python', 'Python', 'runtimes'),
  simpleIcon('openjdk', 'Java (OpenJDK)', 'runtimes'),
  simpleIcon('go', 'Go', 'runtimes'),
  simpleIcon('rust', 'Rust', 'runtimes'),
  simpleIcon('dotnet', '.NET', 'runtimes'),

  // Frameworks
  simpleIcon('nestjs', 'NestJS', 'frameworks'),
  simpleIcon('nextdotjs', 'Next.js', 'frameworks'),
  simpleIcon('react', 'React', 'frameworks'),
  simpleIcon('angular', 'Angular', 'frameworks'),
  simpleIcon('vuedotjs', 'Vue.js', 'frameworks'),
  simpleIcon('express', 'Express', 'frameworks'),
  simpleIcon('spring', 'Spring', 'frameworks'),
  simpleIcon('springboot', 'Spring Boot', 'frameworks'),
  simpleIcon('fastapi', 'FastAPI', 'frameworks'),
  simpleIcon('django', 'Django', 'frameworks'),
  simpleIcon('laravel', 'Laravel', 'frameworks'),

  // APIs and contracts
  simpleIcon('graphql', 'GraphQL', 'apis'),
  {
    id: 'grpc',
    name: 'gRPC',
    url: 'https://raw.githubusercontent.com/cncf/artwork/831f27a0cf4227b1b76a28ff51a9f4127a2195ec/projects/grpc/icon/color/grpc-icon-color.svg',
    isIsometric: false,
    collection: 'apis'
  },
  simpleIcon('openapiinitiative', 'OpenAPI', 'apis'),
  simpleIcon('swagger', 'Swagger', 'apis'),

  // Data stores
  simpleIcon('redis', 'Redis', 'data'),
  simpleIcon('postgresql', 'PostgreSQL', 'data'),
  simpleIcon('mariadb', 'MariaDB', 'data'),
  simpleIcon('mongodb', 'MongoDB', 'data'),
  simpleIcon('sqlite', 'SQLite', 'data'),
  simpleIcon('apachecassandra', 'Apache Cassandra', 'data'),
  simpleIcon('neo4j', 'Neo4j', 'data'),
  simpleIcon('elasticsearch', 'Elasticsearch', 'data'),
  simpleIcon('minio', 'MinIO', 'data'),
  simpleIcon('qdrant', 'Qdrant', 'data'),
  simpleIcon('supabase', 'Supabase', 'data'),
  simpleIcon('firebase', 'Firebase', 'data'),

  // Messaging and streaming
  simpleIcon('apachekafka', 'Apache Kafka', 'messaging'),
  simpleIcon('rabbitmq', 'RabbitMQ', 'messaging'),
  simpleIcon('nats.io', 'NATS', 'messaging'),
  simpleIcon('apachespark', 'Apache Spark', 'messaging'),
  simpleIcon('apacheairflow', 'Apache Airflow', 'messaging'),

  // Identity and security
  simpleIcon('keycloak', 'Keycloak', 'identity'),
  simpleIcon('auth0', 'Auth0', 'identity'),
  simpleIcon('okta', 'Okta', 'identity'),
  simpleIcon('jsonwebtokens', 'JWT', 'identity'),
  simpleIcon('vault', 'HashiCorp Vault', 'identity'),

  // Networking and edge
  simpleIcon('nginx', 'NGINX', 'networking'),
  simpleIcon('traefikproxy', 'Traefik Proxy', 'networking'),
  simpleIcon('kong', 'Kong', 'networking'),
  simpleIcon('envoyproxy', 'Envoy', 'networking'),
  simpleIcon('istio', 'Istio', 'networking'),
  simpleIcon('cloudflare', 'Cloudflare', 'networking'),
  simpleIcon('vercel', 'Vercel', 'networking'),

  // Containers, platform and delivery
  simpleIcon('docker', 'Docker', 'platform'),
  simpleIcon('kubernetes', 'Kubernetes', 'platform'),
  simpleIcon('helm', 'Helm', 'platform'),
  simpleIcon('argo', 'Argo', 'platform'),
  simpleIcon('ansible', 'Ansible', 'platform'),
  simpleIcon('jenkins', 'Jenkins', 'platform'),
  simpleIcon('gitlab', 'GitLab', 'platform'),
  simpleIcon('linux', 'Linux', 'platform'),
  simpleIcon('ubuntu', 'Ubuntu', 'platform'),

  // Observability
  simpleIcon('prometheus', 'Prometheus', 'observability'),
  simpleIcon('grafana', 'Grafana', 'observability'),
  simpleIcon('opentelemetry', 'OpenTelemetry', 'observability'),
  simpleIcon('jaeger', 'Jaeger', 'observability'),
  simpleIcon('datadog', 'Datadog', 'observability'),
  simpleIcon('sentry', 'Sentry', 'observability'),

  // AI and LLM tooling
  simpleIcon('anthropic', 'Anthropic', 'ai'),
  simpleIcon('claude', 'Claude', 'ai'),
  {
    id: 'openai',
    name: 'OpenAI',
    url: 'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.95.1/icons/openai.svg',
    isIsometric: false,
    collection: 'ai'
  },
  simpleIcon('googlegemini', 'Google Gemini', 'ai'),
  simpleIcon('mistralai', 'Mistral AI', 'ai'),
  simpleIcon('meta', 'Meta (Llama)', 'ai'),
  simpleIcon('ollama', 'Ollama', 'ai'),
  simpleIcon('huggingface', 'Hugging Face', 'ai'),
  simpleIcon('modelcontextprotocol', 'Model Context Protocol (MCP)', 'ai'),
  simpleIcon('langchain', 'LangChain', 'ai'),
  simpleIcon('perplexity', 'Perplexity', 'ai')
];

export const icons: Icons = [...isopacks, ...cicdIcons, ...techIcons];

// Sample flow for the playback controls/flow editor (T5): a landside
// check-in request reaching the central database, and its response
// travelling back over the same connector.
const sampleFlows: InitialData['flows'] = [
  {
    id: 'flow-landside-aodb-checkin',
    name: 'Landside check-in',
    description:
      'A landside operations request reaching the central database (AODB), and the response returning.',
    steps: [
      {
        id: 'flow-step-checkin-request',
        connectorId: '2e025225-169c-4609-bf93-a4a7aa602b00',
        direction: 'REQUEST',
        label: 'Request'
      },
      {
        id: 'flow-step-checkin-response',
        connectorId: '2e025225-169c-4609-bf93-a4a7aa602b00',
        direction: 'RESPONSE',
        label: 'Response'
      }
    ]
  }
];

export const initialData: InitialData = {
  title: 'Airport management software system',
  icons,
  colors,
  flows: sampleFlows,
  items: [
    {
      id: 'item1',
      name: 'Airport Operational Database',
      icon: 'storage',
      description:
        '<p>Each airport has its own central database that stores and updates all necessary data regarding daily flights, seasonal schedules, available resources, and other flight-related information, like billing data and flight fees. AODB is a key feature for the functioning of an airport.</p><p><br></p><p>This database is connected to the rest of the airport modules: <em>airport information systems, revenue management systems, and air traffic management</em>.</p><p><br></p><p>The system can supply different information for different segments of users: passengers, airport staff, crew, or members of specific departments, authorities, business partners, or police.</p><p><br></p><p>AODB represents the information on a graphical display.</p><p><br></p><p><strong>AODB functions include:</strong></p><p>- Reference-data processing</p><p>- Seasonal scheduling</p><p>- Daily flight schedule processing</p><p>- Processing of payments</p>'
    },
    {
      id: 'bc6fdded-a090-4eae-b1fe-fe0ee0fd1c92',
      name: 'Landside operations',
      icon: 'office',
      description:
        '<p>This subsystem is aimed at serving passengers and maintenance of terminal buildings, parking facilities, and vehicular traffic circular drives. Passenger operations include baggage handling and tagging.</p>'
    },
    {
      id: 'e0462e01-8acd-461c-89a2-42c6a04d5f7f',
      name: 'Passenger facilitation services',
      icon: 'user',
      description:
        '<p>Includes passenger processing (check-in, boarding, border control) and baggage handling (tagging, dropping and handling). They follow passengers to the shuttle buses to carry them to their flights. Arrival operations include boarding control and baggage handling.</p>'
    },
    {
      id: 'a147b06a-324a-47ab-9e16-ac9101aa3d28',
      name: 'Border control (customs and security services)',
      icon: 'block',
      description:
        '<p>In airports, security services usually unite perimeter security, terminal security, and border controls. These services require biometric authentication and integration into government systems to allow a customs officer to view the status of a passenger.</p>'
    },
    {
      id: '4a27ed88-abf2-448b-af07-5d2b6ebdb67f',
      name: 'Common use services (self-service check-in systems)',
      icon: 'block',
      description:
        '<p>An airport must ensure smooth passenger flow. Various&nbsp;digital self-services, like check-in kiosks or automated self-service gates, make it happen. Self-service options, especially check-in kiosks, remain popular. Worldwide in 2018, passengers used kiosks to check themselves in&nbsp;88 percent of the time.</p>'
    },
    {
      id: 'c54ab120-44d2-46d2-9fc1-efd83ab67307',
      name: 'Baggage handling',
      icon: 'block',
      description:
        '<p>A passenger must check a bag before it’s loaded on the aircraft. The time the baggage is loaded is displayed and tracked until the destination is reached and the bag is returned to the owners.</p>'
    },
    {
      id: 'a2d5f2c4-ea64-4b3c-8c82-d50be88adb05',
      name: 'Terminal management systems',
      icon: 'function-module',
      description:
        '<p>Includes maintenance and monitoring of management systems for assets, buildings, electrical grids, environmental systems, and vertical transportation organization. It also facilitates staff communications and management.</p>'
    },
    {
      id: '040dfb11-f920-48cf-bf96-64234db1b7e8',
      name: 'Maintenance and monitoring',
      icon: 'block'
    },
    {
      id: 'a71d7911-261d-4b6e-895a-27765baf0403',
      name: 'Resource management',
      icon: 'block'
    },
    {
      id: '67895813-ac6f-4dd4-9ae2-e994e9a5aa09',
      name: 'Staff management',
      icon: 'block',
      description:
        '<p>Staff modules provide the necessary information about ongoing processes in the airport, such as data on flights (in ICAO or UTC formats) and other important events to keep responsible staff members updated. Information is distributed through the airport radio system, or displayed on a PC connected via the airport LAN or on mobile devices.</p>'
    },
    {
      id: 'cf6b6e6e-f491-4547-b4ac-c5eecba8464a',
      name: 'Information management',
      icon: 'queue',
      description:
        '<p>This subsystem is responsible for the collection and distribution of daily flight information, storing of seasonal and arrival/departure information, as well as the connection with airlines.</p>'
    },
    {
      id: '00ff4dc0-09f9-4932-aa90-6c207da2989b',
      name: 'Public address (PA) systems',
      icon: 'block',
      description:
        '<p>Informs passengers and airport staff about any changes and processes of importance, for instance, gates, times of arrival, calls, and alerts. Also, information can be communicated to pilots, aircraft staff, crew, etc. PA systems usually include voice messages broadcasted through loudspeakers.</p>'
    },
    {
      id: '791abb72-5481-4713-88a8-a9fe51cb5408',
      name: 'Flight Information Display Systems (FIDS)',
      icon: 'block',
      description:
        '<p>Exhibits the status of boarding, gates, aircraft, flight number, and other flight details.&nbsp;A computer controls the screens that are connected to the data management systems and displays up-to-date information about flights in real time. Some airports have a digital FIDS in the form of apps or on their websites. Also, the displays may show other public information such as the weather, news, safety messages, menus, and advertising. Airports can choose the type, languages, and means of entering the information, whether it be manually or loaded from a central database.</p>'
    },
    {
      id: 'fe621de2-793b-42f9-968e-4cac33b8d5fe',
      name: 'Automatic Terminal Information Service (ATIS)',
      icon: 'block',
      description:
        '<p>Broadcasts the weather reports, the condition of the runway, or other local information for pilots and crews.</p><p><br></p><p>Some airport software vendors offer off-the-shelf solutions to facilitate particular tasks, like maintenance, or airport operations. However, most of them provide integrated systems that comprise modules for several operations.</p>'
    },
    {
      id: '24d4a8b3-6056-4c3f-8f0b-143683509438',
      name: 'Airside operations',
      icon: 'plane',
      description:
        '<p>Includes systems to handle aircraft landing and navigation, airport traffic management, runway management, and ground handling safety.</p>'
    },
    {
      id: '2ac34480-95cc-4b01-8efd-683ec46fcd68',
      name: 'Apron handling',
      icon: 'block',
      description:
        '<p>Apron (or ground handling) deals with aircraft servicing. This includes passenger boarding and guidance, cargo and mail loading, and apron services. Apron services include aircraft guiding, cleaning, drainage, deicing, catering, and fueling. At this stage, the software facilitates dealing with information about the weight of the baggage and cargo load, number of passengers, boarding bridges parking, and the ground services that must be supplied to the aircraft. By entering this information into the system, their costs can be calculated and invoiced through the billing system.</p>'
    },
    {
      id: '9172d115-93ae-4e89-bd75-4979b7f8a49a',
      name: 'ATC Tower',
      icon: 'block',
      description:
        '<p>The Air Traffic Control Tower is a structure that delivers air and ground control of the aircraft. It ensures safety by guiding and navigating the vehicles and aircraft. It is performed by way of visual signaling, radar, and radio communication in the air and on the ground. The main focus of the tower is to make sure that all aircraft have been assigned to the right place, that passengers aren’t at risk, and that the aircraft will have a suitable passenger boarding bridge allocated on the apron.</p><p><br></p><p>The ATC tower has a control room that serves as a channel between landside (terminal) and airside operations in airports. The control room personnel are tasked with ensuring the security and safety of the passengers as well as ground handling. Usually, a control room has CCTV monitors and air traffic control systems that maintain the order in the terminal and on the apron.</p>'
    },
    {
      id: '2db4a232-2cf3-4277-9cd4-e2c0a35a4eac',
      name: 'Aeronautical Fixed Telecommunication Network (AFTN) Systems',
      icon: 'block',
      description:
        '<p>AFTN systems handle communication and exchange of data including navigation services. Usually, airports exchange traffic environment messages, safety messages, information about the weather, geographic material, disruptions, etc. They serve as communication between airports and aircraft.</p><p><br></p><p>Software for aeronautical telecommunications stores flight plans and flight information, entered in ICAO format and UTC. The information stored can be used for planning and statistical purposes. For airports, it’s important to understand the aircraft type and its weight to assign it to the right place on the runway. AFTN systems hold the following information:</p><p><br></p><p>- Aircraft registration</p><p>- Runway used</p><p>- Actual time of landing and departure</p><p>- Number of circuits</p><p>- Number and type of approaches</p><p>- New estimates of arrival and departure</p><p>- New flight information</p><p><br></p><p>Air traffic management is performed from an ATC tower.</p>'
    },
    {
      id: 'b46088d6-7bd4-4ccf-9d35-cf56a891d869',
      name: 'Invoicing and billing',
      icon: 'paymentcard',
      description:
        '<p>Each flight an airport handles generates a defined revenue for the airport paid by the airline operating the aircraft. Aeronautical invoicing systems make payment possible for any type and size of aircraft. It accepts payments in cash and credit in multiple currencies. The billing also extends to ATC services.</p><p><br></p><p>Depending on the aircraft type and weight and ground services provided, an airport can calculate the aeronautical fee and issue an invoice with a bill.&nbsp;It is calculated using the following data:</p><p><br></p><p>- Aircraft registration</p><p>- Parking time at the airport</p><p>- Airport point of departure and/or landing</p><p>- Times at the different points of entry or departure</p><p><br></p><p>The data is entered or integrated from ATC. Based on this information, the airport calculates the charges and sends the bills.</p>'
    },
    {
      id: 'afa7b887-8aff-45a6-86fa-7a896626e920',
      name: 'ATC Tower Billing',
      icon: 'block'
    },
    {
      id: 'd917b7d7-a5c4-479e-a366-da8d22ea8ebb',
      name: 'Non Aeronautical revenue',
      icon: 'block'
    }
  ],
  views: [
    {
      id: 'overview',
      name: 'Overview',
      items: [
        {
          labelHeight: 80,
          id: 'd917b7d7-a5c4-479e-a366-da8d22ea8ebb',
          tile: { x: 5, y: -11 }
        },
        {
          labelHeight: 80,
          id: 'afa7b887-8aff-45a6-86fa-7a896626e920',
          tile: { x: 2, y: -11 }
        },
        {
          labelHeight: 80,
          id: 'b46088d6-7bd4-4ccf-9d35-cf56a891d869',
          tile: { x: 4, y: -7 }
        },
        {
          labelHeight: 80,
          id: '2db4a232-2cf3-4277-9cd4-e2c0a35a4eac',
          tile: { x: 16, y: -3 }
        },
        {
          labelHeight: 80,
          id: '9172d115-93ae-4e89-bd75-4979b7f8a49a',
          tile: { x: 16, y: 0 }
        },
        {
          labelHeight: 80,
          id: '2ac34480-95cc-4b01-8efd-683ec46fcd68',
          tile: { x: 16, y: 3 }
        },
        {
          labelHeight: 80,
          id: '24d4a8b3-6056-4c3f-8f0b-143683509438',
          tile: { x: 11, y: 0 }
        },
        {
          labelHeight: 80,
          id: 'fe621de2-793b-42f9-968e-4cac33b8d5fe',
          tile: { x: 7, y: 12 }
        },
        {
          labelHeight: 80,
          id: '791abb72-5481-4713-88a8-a9fe51cb5408',
          tile: { x: 4, y: 12 }
        },
        {
          labelHeight: 80,
          id: '00ff4dc0-09f9-4932-aa90-6c207da2989b',
          tile: { x: 1, y: 12 }
        },
        {
          labelHeight: 80,
          id: 'cf6b6e6e-f491-4547-b4ac-c5eecba8464a',
          tile: { x: 4, y: 6 }
        },
        {
          labelHeight: 80,
          id: '67895813-ac6f-4dd4-9ae2-e994e9a5aa09',
          tile: { x: -11, y: 8 }
        },
        {
          labelHeight: 80,
          id: 'a71d7911-261d-4b6e-895a-27765baf0403',
          tile: { x: -8, y: 8 }
        },
        {
          labelHeight: 80,
          id: '040dfb11-f920-48cf-bf96-64234db1b7e8',
          tile: { x: -5, y: 8 }
        },
        {
          labelHeight: 80,
          id: 'a2d5f2c4-ea64-4b3c-8c82-d50be88adb05',
          tile: { x: -5, y: 4 }
        },
        {
          labelHeight: 80,
          id: 'c54ab120-44d2-46d2-9fc1-efd83ab67307',
          tile: { x: -11, y: -9 }
        },
        {
          labelHeight: 80,
          id: '4a27ed88-abf2-448b-af07-5d2b6ebdb67f',
          tile: { x: -8, y: -9 }
        },
        {
          labelHeight: 80,
          id: 'a147b06a-324a-47ab-9e16-ac9101aa3d28',
          tile: { x: -5, y: -9 }
        },
        {
          labelHeight: 180,
          id: 'e0462e01-8acd-461c-89a2-42c6a04d5f7f',
          tile: { x: -5, y: -4 }
        },
        {
          labelHeight: 180,
          id: 'bc6fdded-a090-4eae-b1fe-fe0ee0fd1c92',
          tile: { x: -4, y: 0 }
        },
        { id: 'item1', tile: { x: 4, y: 0 }, labelHeight: 140 }
      ],
      connectors: [
        {
          id: '527b88f3-4b50-4639-9802-cfc475cd08aa',
          color: 'color6',
          anchors: [
            {
              id: 'abe857f8-6219-4030-b5cf-6a7de2bff9be',
              ref: { item: 'd917b7d7-a5c4-479e-a366-da8d22ea8ebb' }
            },
            {
              id: '21b9d415-1429-4e68-9b35-46705c32e8a4',
              ref: { tile: { x: 5, y: -10 } }
            },
            {
              id: '0e768e42-228d-44c5-bc30-c8d40ebb69c6',
              ref: { tile: { x: 4, y: -10 } }
            },
            {
              id: 'c9d4b849-a044-4c43-9e8a-ec370cac7dd6',
              ref: { item: 'b46088d6-7bd4-4ccf-9d35-cf56a891d869' }
            }
          ],
          width: 10,
          description: '',
          style: 'SOLID'
        },
        {
          id: '073ecd08-0bff-4274-81e7-2fe35b0ac085',
          color: 'color6',
          anchors: [
            {
              id: 'aed7740d-75e5-471e-a9a0-01bbfb751a2c',
              ref: { item: 'afa7b887-8aff-45a6-86fa-7a896626e920' }
            },
            {
              id: 'eccb2e42-64cd-446c-a23a-74b8f759fdd1',
              ref: { tile: { x: 2, y: -10 } }
            },
            {
              id: 'd0f7054b-54e7-45f5-9e20-2ce766611477',
              ref: { tile: { x: 4, y: -10 } }
            },
            {
              id: 'c6fa8a43-722a-49a9-84f4-b76114322b0d',
              ref: { item: 'b46088d6-7bd4-4ccf-9d35-cf56a891d869' }
            }
          ],
          width: 10,
          description: '',
          style: 'SOLID'
        },
        {
          id: '170009dd-b855-4b91-ba49-07a998cf0485',
          color: 'color6',
          anchors: [
            {
              id: '24f16db1-6a3c-44b4-978d-6aa66f0b049f',
              ref: { item: 'b46088d6-7bd4-4ccf-9d35-cf56a891d869' }
            },
            {
              id: '034ffa18-b55b-4941-acd8-02dbd8c47bfb',
              ref: { item: 'item1' }
            }
          ]
        },
        {
          id: 'ae8f457f-df03-4582-925d-4c81131608fa',
          color: 'color2',
          anchors: [
            {
              id: '39a462b8-bc96-490b-849a-1199e44cfa8a',
              ref: { item: '2db4a232-2cf3-4277-9cd4-e2c0a35a4eac' }
            },
            {
              id: 'f4d0339b-45c8-4eb7-a3be-94616a4969a5',
              ref: { tile: { x: 15, y: -3 } }
            },
            {
              id: '3b1bc55b-ceb2-416d-8f1d-722273180e83',
              ref: { tile: { x: 15, y: 0 } }
            },
            {
              id: '072adfbc-9888-434a-bae4-9639fff026a4',
              ref: { item: '24d4a8b3-6056-4c3f-8f0b-143683509438' }
            }
          ],
          width: 10,
          description: '',
          style: 'SOLID'
        },
        {
          id: '4aba5eaf-e2b3-4b64-9af0-98cebafef64a',
          color: 'color2',
          anchors: [
            {
              id: '2410836d-4820-4492-8c64-d89b069ce9ec',
              ref: { item: '9172d115-93ae-4e89-bd75-4979b7f8a49a' }
            },
            {
              id: 'f583f42d-2eec-47a5-9d45-6dfd0603cb69',
              ref: { item: '24d4a8b3-6056-4c3f-8f0b-143683509438' }
            }
          ]
        },
        {
          id: '5cfb2816-10cd-4c90-b584-f045c26074c8',
          color: 'color2',
          anchors: [
            {
              id: '66854e7d-e46c-49b0-8f26-186742369158',
              ref: { item: '2ac34480-95cc-4b01-8efd-683ec46fcd68' }
            },
            {
              id: 'ffc7345f-854c-41ef-96ed-fd1cbeb4b3d6',
              ref: { tile: { x: 15, y: 3 } }
            },
            {
              id: '93e5620a-8d94-464e-bcc4-a4b20da4b6e7',
              ref: { tile: { x: 15, y: 0 } }
            },
            {
              id: 'd97de77f-ac92-42a9-892b-3e30485817ff',
              ref: { item: '24d4a8b3-6056-4c3f-8f0b-143683509438' }
            }
          ],
          width: 10,
          description: '',
          style: 'SOLID'
        },
        {
          id: '7392a711-e861-4c85-b394-49e47f2dd874',
          color: 'color2',
          anchors: [
            {
              id: 'bd8d118a-f676-4ca0-bfbd-b993625aece7',
              ref: { item: '24d4a8b3-6056-4c3f-8f0b-143683509438' }
            },
            {
              id: '613866b0-e6dd-4d8a-9a67-d8ce443273ec',
              ref: { item: 'item1' }
            }
          ]
        },
        {
          id: '1e329a8d-3fc9-40ea-8e82-67b478b35f16',
          color: 'color7',
          anchors: [
            {
              id: 'dd31d564-3b3a-4428-b05c-88b243173d21',
              ref: { item: 'fe621de2-793b-42f9-968e-4cac33b8d5fe' }
            },
            {
              id: '8b9dec3b-59e3-4ddf-9a2b-12e7e6092916',
              ref: { tile: { x: 7, y: 11 } }
            },
            {
              id: '5728c55e-03b6-4faa-b801-7a342a0b7650',
              ref: { tile: { x: 4, y: 11 } }
            },
            {
              id: '3678c2f1-4c13-4959-8aaf-8d27611b6ea7',
              ref: { item: 'cf6b6e6e-f491-4547-b4ac-c5eecba8464a' }
            }
          ],
          width: 10,
          description: '',
          style: 'SOLID'
        },
        {
          id: 'ff1c44f2-83f8-4596-a27f-54914b7da562',
          color: 'color7',
          anchors: [
            {
              id: '30064e8e-7894-4b83-833b-a171c10327e6',
              ref: { item: '791abb72-5481-4713-88a8-a9fe51cb5408' }
            },
            {
              id: 'b5aabbda-2802-4cf8-90c2-adfbc5bc5b5c',
              ref: { item: 'cf6b6e6e-f491-4547-b4ac-c5eecba8464a' }
            }
          ]
        },
        {
          id: '8c1f03c8-351a-4a39-9570-5fd4959f0272',
          color: 'color7',
          anchors: [
            {
              id: 'e8e8c135-3852-4475-96bc-6d6ec3eef8f0',
              ref: { item: '00ff4dc0-09f9-4932-aa90-6c207da2989b' }
            },
            {
              id: '56b0d80b-31b5-4960-bf01-47c2d2a9e90a',
              ref: { tile: { x: 1, y: 11 } }
            },
            {
              id: 'c42d6159-e6b8-447e-a197-0b7c761f2516',
              ref: { tile: { x: 4, y: 11 } }
            },
            {
              id: 'c858062e-faa9-410d-9a35-5090c3b42af5',
              ref: { item: 'cf6b6e6e-f491-4547-b4ac-c5eecba8464a' }
            }
          ],
          width: 10,
          description: '',
          style: 'SOLID'
        },
        {
          id: '630f5788-9f0b-44df-83f9-c60e40928617',
          color: 'color7',
          anchors: [
            {
              id: 'c258cf27-4d97-4814-8438-96c7f9fa50c0',
              ref: { item: 'cf6b6e6e-f491-4547-b4ac-c5eecba8464a' }
            },
            {
              id: '3bdd5f99-0fc8-4b35-b2be-fa5473a51bfa',
              ref: { item: 'item1' }
            }
          ]
        },
        {
          id: '2f251ef8-d35e-4b57-ad48-dcd6f81325bc',
          color: 'color1',
          anchors: [
            {
              id: '3d0c51d0-0b90-4062-90e5-306e2aa2f633',
              ref: { item: '040dfb11-f920-48cf-bf96-64234db1b7e8' }
            },
            {
              id: '46d83bb9-30a5-4856-afb2-0e91076fce62',
              ref: { item: 'a2d5f2c4-ea64-4b3c-8c82-d50be88adb05' }
            }
          ]
        },
        {
          id: '965ff8f1-59e9-45ae-b484-ba6ec4f546d0',
          color: 'color1',
          anchors: [
            {
              id: 'e031f407-88d7-4606-9d0d-99ffd12662d7',
              ref: { item: 'a71d7911-261d-4b6e-895a-27765baf0403' }
            },
            {
              id: '6bffb346-eb7e-45b7-a68f-23b49eed30c2',
              ref: { tile: { x: -8, y: 6 } }
            },
            {
              id: 'bb0fb0a7-492a-411b-8f74-9218ef607259',
              ref: { tile: { x: -5, y: 6 } }
            },
            {
              id: '4992ecf1-26bc-47bf-a781-4e5267cd0c02',
              ref: { item: 'a2d5f2c4-ea64-4b3c-8c82-d50be88adb05' }
            }
          ],
          width: 10,
          description: '',
          style: 'SOLID'
        },
        {
          id: '3b09e7aa-97f9-40b7-81e8-84e5e610d1e2',
          color: 'color1',
          anchors: [
            {
              id: '760ef8a7-b619-41bc-a61f-3d63fa1c2879',
              ref: { item: '67895813-ac6f-4dd4-9ae2-e994e9a5aa09' }
            },
            {
              id: 'd03b1bea-d63f-4960-b186-ccc582a0da1b',
              ref: { tile: { x: -11, y: 6 } }
            },
            {
              id: 'a2c1583d-667e-481c-9ddc-e1fd13a39203',
              ref: { tile: { x: -5, y: 6 } }
            },
            {
              id: 'bc60ae76-c0f1-4c7f-8ec1-acdec06a9250',
              ref: { item: 'a2d5f2c4-ea64-4b3c-8c82-d50be88adb05' }
            }
          ],
          width: 10,
          description: '',
          style: 'SOLID'
        },
        {
          id: '7180a187-4254-46af-806f-4184250d9609',
          color: 'color1',
          anchors: [
            {
              id: 'cb98ae3b-f88d-45ab-9dd8-0ced127e0ee1',
              ref: { item: 'a2d5f2c4-ea64-4b3c-8c82-d50be88adb05' }
            },
            {
              id: '8a9f4c57-0685-4624-bf30-f5b27f34662a',
              ref: { item: 'bc6fdded-a090-4eae-b1fe-fe0ee0fd1c92' }
            }
          ]
        },
        {
          id: '2bbf530c-5b0a-4405-a6ef-9df4784ba49b',
          color: 'color1',
          anchors: [
            {
              id: '4072b959-8f00-4cef-9888-98b6faa5671b',
              ref: { item: 'c54ab120-44d2-46d2-9fc1-efd83ab67307' }
            },
            {
              id: '020bc704-e25f-4a3a-a613-6fb7ce800f7e',
              ref: { tile: { x: -11, y: -6 } }
            },
            {
              id: '6febf444-92b1-42ac-b6f3-afd71c3ee452',
              ref: { tile: { x: -5, y: -6 } }
            },
            {
              id: '237f901a-d01d-4d9b-8bd1-eb11efedaa1b',
              ref: { item: 'e0462e01-8acd-461c-89a2-42c6a04d5f7f' }
            }
          ],
          width: 10,
          description: '',
          style: 'SOLID'
        },
        {
          id: '1074fc66-d2ff-49ed-85d3-87a0ded7f54b',
          color: 'color1',
          anchors: [
            {
              id: 'b2db4f0d-59e7-4715-9d28-ea43887ae8c8',
              ref: { item: '4a27ed88-abf2-448b-af07-5d2b6ebdb67f' }
            },
            {
              id: 'e742a2df-8911-40d8-9227-3d5f391f3beb',
              ref: { tile: { x: -8, y: -6 } }
            },
            {
              id: 'e1ddafc5-0f79-41af-a9f6-e8f9007accb6',
              ref: { tile: { x: -5, y: -6 } }
            },
            {
              id: '03cb17bd-34cb-4c80-989d-f299aa1a2915',
              ref: { item: 'e0462e01-8acd-461c-89a2-42c6a04d5f7f' }
            }
          ],
          width: 10,
          description: '',
          style: 'SOLID'
        },
        {
          id: '120566e0-c0df-4d85-81b3-d6b224484668',
          color: 'color1',
          anchors: [
            {
              id: '433e4f1f-0bf9-44f5-ab9f-d98861206b59',
              ref: { item: 'a147b06a-324a-47ab-9e16-ac9101aa3d28' }
            },
            {
              id: '1affa818-d601-4ab3-b507-d71ece11920c',
              ref: { item: 'e0462e01-8acd-461c-89a2-42c6a04d5f7f' }
            }
          ]
        },
        {
          id: '2185c84e-5277-40f1-82b9-774dd9f64e2a',
          color: 'color1',
          anchors: [
            {
              id: 'aa663458-6df7-4bb2-946b-c8cc6ab29957',
              ref: { item: 'e0462e01-8acd-461c-89a2-42c6a04d5f7f' }
            },
            {
              id: '77530d07-6183-420c-affe-91a99b685db0',
              ref: { item: 'bc6fdded-a090-4eae-b1fe-fe0ee0fd1c92' }
            }
          ]
        },
        {
          id: '2e025225-169c-4609-bf93-a4a7aa602b00',
          color: 'color1',
          anchors: [
            {
              id: '5870d75a-066c-422e-a517-c44417961809',
              ref: { item: 'bc6fdded-a090-4eae-b1fe-fe0ee0fd1c92' }
            },
            {
              id: '0fdeeb60-9820-41dc-a73b-96196e035331',
              ref: { item: 'item1' }
            }
          ]
        }
      ],
      rectangles: [
        {
          id: '75637566-6d10-49fb-b3ec-85584250475d',
          color: 'color6',
          from: { x: 1, y: -10 },
          to: { x: 6, y: -12 }
        },
        {
          id: '35cbdf0d-daa1-4939-9901-dd9aee36903f',
          color: 'color2',
          from: { x: 15, y: 4 },
          to: { x: 17, y: -4 }
        },
        {
          id: 'ae50ce7d-7b3e-49ec-8fe0-e2e09c4f2dfa',
          color: 'color7',
          from: { x: 0, y: 13 },
          to: { x: 8, y: 11 }
        },
        {
          id: 'e35ec239-f1eb-4e83-9112-d3b6b3f01f2c',
          color: 'color1',
          from: { x: -4, y: 9 },
          to: { x: -12, y: 6 }
        },
        {
          id: '27bea545-8505-4ebe-ae72-01de85833465',
          color: 'color1',
          from: { x: -4, y: -6 },
          to: { x: -12, y: -10 }
        },
        {
          id: '0a74d0a7-b987-480f-ada1-f5a575eae0b9',
          color: 'color5',
          from: { x: 3, y: 1 },
          to: { x: 5, y: -1 }
        }
      ],
      textBoxes: [
        {
          orientation: 'Y',
          fontSize: 0.6,
          content: 'Airside operations',
          id: 'f19b5d77-733e-48be-93a0-a0b0cae276d4',
          tile: { x: 14, y: -1 }
        },
        {
          orientation: 'X',
          fontSize: 0.6,
          content: 'Information management',
          id: 'a15c0d88-1682-4fc8-9678-62e029df4574',
          tile: { x: 0, y: 10 }
        },
        {
          orientation: 'X',
          fontSize: 0.6,
          content: 'Terminal management',
          id: 'e8ae777d-2c29-4c8e-8f61-0c63fac32d11',
          tile: { x: -12, y: 5 }
        },
        {
          orientation: 'X',
          fontSize: 0.6,
          content: 'Passenger facilitation',
          id: '82132c7f-704e-49f1-86e7-e4f072e56779',
          tile: { x: -12, y: -11 }
        },
        {
          orientation: 'X',
          fontSize: 0.6,
          content: 'AODB',
          id: '52070439-245d-45ab-974a-615427c1c3d1',
          tile: { x: 2, y: -2 }
        }
      ]
    }
  ]
};
