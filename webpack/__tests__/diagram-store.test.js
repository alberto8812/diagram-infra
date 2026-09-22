const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../diagram-store');

describe('diagram-store: name validation', () => {
  const validNames = ['infra', 'a', 'a1', 'a-b-c', 'a'.repeat(64)];
  const invalidNames = [
    '../x',
    'a/b',
    'A',
    '',
    'a'.repeat(65),
    '-a',
    'Infra',
    'a.b',
    'a b',
    null,
    undefined,
    42,
    {}
  ];

  test.each(validNames)('accepts %j', (name) => {
    expect(store.isValidName(name)).toBe(true);
  });

  test.each(invalidNames)('rejects %j', (name) => {
    expect(store.isValidName(name)).toBe(false);
  });

  test('the well-known "infra" name is valid (legacy alias target)', () => {
    expect(store.isValidName('infra')).toBe(true);
  });
});

describe('diagram-store: path resolution', () => {
  const dir = path.join(os.tmpdir(), 'isoflow-diagram-store-path-test');

  test('resolves a valid name to a path inside the directory', () => {
    const resolved = store.resolveDiagramPath(dir, 'infra');

    expect(resolved).toBe(path.join(path.resolve(dir), 'infra.json'));
    expect(path.dirname(resolved)).toBe(path.resolve(dir));
  });

  test('throws for an invalid name instead of resolving a path', () => {
    expect(() => {
      return store.resolveDiagramPath(dir, '../x');
    }).toThrow(/Invalid diagram name/);
  });

  test('throws instead of resolving a path that escapes the directory', () => {
    // Even if a future regex mistake let a traversal-shaped name through, the
    // dirname assertion in resolveDiagramPath is a second, independent gate.
    expect(() => {
      return store.resolveDiagramPath(dir, '..');
    }).toThrow();
  });
});

describe('diagram-store: listing filter', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'isoflow-diagram-store-list-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('returns an empty list for a directory that does not exist yet', () => {
    expect(store.listDiagrams(path.join(dir, 'missing'))).toEqual([]);
  });

  test('lists valid diagrams and ignores .tmp files and invalid names', () => {
    fs.writeFileSync(path.join(dir, 'infra.json'), '{}');
    fs.writeFileSync(path.join(dir, 'network.json'), '{}');
    fs.writeFileSync(path.join(dir, 'staging.json.tmp'), '{}');
    fs.writeFileSync(path.join(dir, 'Invalid.json'), '{}');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'hello');

    const names = store.listDiagrams(dir).map((entry) => {
      return entry.name;
    });

    expect(names).toEqual(['infra', 'network']);
  });

  test('sorts by name', () => {
    fs.writeFileSync(path.join(dir, 'zebra.json'), '{}');
    fs.writeFileSync(path.join(dir, 'apple.json'), '{}');

    const names = store.listDiagrams(dir).map((entry) => {
      return entry.name;
    });

    expect(names).toEqual(['apple', 'zebra']);
  });

  test('each entry carries an ISO updatedAt timestamp', () => {
    fs.writeFileSync(path.join(dir, 'infra.json'), '{}');

    const [entry] = store.listDiagrams(dir);

    expect(entry.name).toBe('infra');
    expect(() => {
      return new Date(entry.updatedAt).toISOString();
    }).not.toThrow();
  });
});

describe('diagram-store: empty model factory', () => {
  test('produces a model that passes the shallow validator', () => {
    const model = store.emptyModel('network');

    expect(store.validateModel(model)).toBeNull();
  });

  test('uses the diagram name as the title', () => {
    expect(store.emptyModel('network').title).toBe('network');
  });

  test('has empty items, views, icons and colors', () => {
    const model = store.emptyModel('network');

    expect(model.items).toEqual([]);
    expect(model.views).toEqual([]);
    expect(model.icons).toEqual([]);
    expect(model.colors).toEqual([]);
  });
});

describe('diagram-store: shallow model validator', () => {
  test('rejects a non-object body', () => {
    expect(store.validateModel(null)).toMatch(/JSON object/);
    expect(store.validateModel([])).toMatch(/JSON object/);
    expect(store.validateModel('x')).toMatch(/JSON object/);
  });

  test('rejects a missing title', () => {
    expect(store.validateModel({ items: [], views: [], colors: [] })).toMatch(
      /title/
    );
  });

  test('rejects a non-array required field', () => {
    const invalid = store.validateModel({
      title: 't',
      items: 'x',
      views: [],
      colors: []
    });

    expect(invalid).toMatch(/items must be an array/);
  });

  test('rejects a non-array icons field when present', () => {
    const invalid = store.validateModel({
      title: 't',
      items: [],
      views: [],
      colors: [],
      icons: 'x'
    });

    expect(invalid).toMatch(/icons must be an array/);
  });

  test('accepts a minimal valid model with no icons field', () => {
    expect(
      store.validateModel({ title: 't', items: [], views: [], colors: [] })
    ).toBeNull();
  });
});

describe('diagram-store: read/write round-trip (temp directory only)', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'isoflow-diagram-store-rw-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('writeDiagram then readDiagram round-trips the model', () => {
    const model = store.emptyModel('infra');

    store.writeDiagram(dir, 'infra', model);

    const raw = store.readDiagram(dir, 'infra');

    expect(JSON.parse(raw)).toEqual(model);
  });

  test('diagramExists reflects a written file', () => {
    expect(store.diagramExists(dir, 'infra')).toBe(false);

    store.writeDiagram(dir, 'infra', store.emptyModel('infra'));

    expect(store.diagramExists(dir, 'infra')).toBe(true);
  });

  test('write is atomic: no leftover .tmp file after a write', () => {
    store.writeDiagram(dir, 'infra', store.emptyModel('infra'));

    const files = fs.readdirSync(dir);

    expect(files).toEqual(['infra.json']);
  });

  test('write creates the directory if missing', () => {
    const nested = path.join(dir, 'nested');

    store.writeDiagram(nested, 'infra', store.emptyModel('infra'));

    expect(fs.existsSync(path.join(nested, 'infra.json'))).toBe(true);
  });
});
