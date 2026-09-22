// Pure, testable pieces of the dev-only multi-diagram store: name validation,
// path resolution, the `diagrams/` directory listing filter, the shallow model
// validator and the empty-model factory. Kept separate from diagram-api.js
// (which owns HTTP wiring and body reading) so this module can be unit tested
// with an injected directory instead of the real `diagrams/` folder.

const fs = require('fs');
const path = require('path');

// Diagram names are used to build a filesystem path, so they are restricted to
// a closed character set with no `.`, `/`, `\` or leading dash. This is the
// only thing standing between a client-supplied name and the filesystem.
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const isValidName = (name) => {
  return typeof name === 'string' && NAME_PATTERN.test(name);
};

// Resolves `name` to a file path inside `dir`. Throws if the name fails the
// pattern, or — as defense in depth against a future regex mistake — if the
// resolved path does not end up directly inside `dir`.
const resolveDiagramPath = (dir, name) => {
  if (!isValidName(name)) {
    throw new Error(`Invalid diagram name: ${JSON.stringify(name)}`);
  }

  const resolvedDir = path.resolve(dir);
  const filePath = path.join(resolvedDir, `${name}.json`);

  if (path.dirname(filePath) !== resolvedDir) {
    throw new Error(`Resolved path escapes diagram directory: ${filePath}`);
  }

  return filePath;
};

// Lists the diagrams in `dir`: every `*.json` file whose basename passes the
// name pattern (so `.tmp` files, dotfiles and anything else are ignored),
// sorted by name.
const listDiagrams = (dir) => {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => fileName.slice(0, -'.json'.length))
    .filter(isValidName)
    .map((name) => {
      const stat = fs.statSync(path.join(dir, `${name}.json`));

      return { name, updatedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
};

// Structural validation only. The full zod schema lives in TypeScript under
// src/ and cannot be required from this CommonJS config, so this checks the
// shape that matters: enough to reject anything that is not a diagram before
// touching disk.
const validateModel = (model) => {
  if (typeof model !== 'object' || model === null || Array.isArray(model)) {
    return 'body must be a JSON object';
  }

  if (typeof model.title !== 'string') return 'title must be a string';

  const arrayFields = ['items', 'views', 'colors'];

  for (const field of arrayFields) {
    if (!Array.isArray(model[field])) return `${field} must be an array`;
  }

  if (model.icons !== undefined && !Array.isArray(model.icons)) {
    return 'icons must be an array when present';
  }

  return null;
};

// A minimal model that passes both `validateModel` above and the zod
// `modelSchema` (empty `items`/`views`/`icons`/`colors` are all valid; the
// app itself creates a first view on load when `views` is empty — see
// `useInitialDataManager`).
const emptyModel = (name) => {
  return {
    title: name,
    items: [],
    views: [],
    icons: [],
    colors: []
  };
};

const diagramExists = (dir, name) => {
  return fs.existsSync(resolveDiagramPath(dir, name));
};

const readDiagram = (dir, name) => {
  return fs.readFileSync(resolveDiagramPath(dir, name), 'utf8');
};

// Atomic write: write to a `.tmp` sibling, then rename over the target. A
// process crash or interrupted request during the write cannot leave a
// half-written diagram behind.
const writeDiagram = (dir, name, model) => {
  fs.mkdirSync(dir, { recursive: true });

  const target = resolveDiagramPath(dir, name);
  const tmp = `${target}.tmp`;

  fs.writeFileSync(tmp, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, target);
};

module.exports = {
  NAME_PATTERN,
  isValidName,
  resolveDiagramPath,
  listDiagrams,
  validateModel,
  emptyModel,
  diagramExists,
  readDiagram,
  writeDiagram
};
