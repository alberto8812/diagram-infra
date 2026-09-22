// Development-only persistence endpoint for the diagram(s) being edited.
//
// This is mounted by webpack/dev.config.js and exists ONLY while `npm start` is
// running. It is never part of the production bundle or the Docker image.
//
// Security notes — the dev server binds 0.0.0.0, so anything on the local network
// can reach it:
//   * Diagram names are validated against a closed pattern (see
//     webpack/diagram-store.js) and resolved to a path only inside `diagrams/`.
//     The client sends a name, never a path — that closes the path-traversal
//     hole. Route params are re-validated here even though Express already
//     decodes `:name` as a single path segment, because a client could still
//     send something like `..` that is a single segment but an invalid name.
//   * The request body is capped, so a large POST/PUT cannot exhaust memory.
//   * The payload must look like an Isoflow model before anything is written.
//   * Writes go to a temp file and are then renamed, so an interrupted request
//     cannot leave a half-written diagram behind.

const fs = require('fs');
const path = require('path');
const store = require('./diagram-store');

// Fixed server-side, never derived from a request — that is what closes the
// path-traversal hole (see the module comment above). The env override exists
// only so tests can point this at a temp directory instead of the real
// `diagrams/`; it is not read from, or influenced by, any HTTP request.
const DIAGRAM_DIR = process.env.ISOFLOW_TEST_DIAGRAM_DIR
  ? path.resolve(process.env.ISOFLOW_TEST_DIAGRAM_DIR)
  : path.resolve(__dirname, '../diagrams');
// Name the legacy single-file endpoint aliases to. `infra` is also the
// project's default diagram (see `diagrams/infra.json`).
const LEGACY_DIAGRAM_NAME = 'infra';
const DIAGRAM_FILE = path.join(DIAGRAM_DIR, `${LEGACY_DIAGRAM_NAME}.json`);
const MAX_BODY_BYTES = 5 * 1024 * 1024;
// Past the cap the rest of the body is drained and discarded so the 413 can
// reach the client. A sender that keeps going far beyond the cap is cut off.
const MAX_DRAIN_BYTES = 4 * MAX_BODY_BYTES;

const readBody = (req) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on('data', (chunk) => {
      size += chunk.length;

      if (size > MAX_BODY_BYTES) {
        // Stop accumulating, but keep draining the stream. Destroying the
        // request here would tear down the socket before the 413 response could
        // be written, and the client would see a broken connection instead of
        // the error. The caller responds with `Connection: close`.
        if (!tooLarge) {
          tooLarge = true;
          chunks.length = 0;
          reject(new Error('Payload too large'));
        }

        if (size > MAX_DRAIN_BYTES) req.destroy();

        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (tooLarge) return;

      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
};

// Answers an oversized body. The socket is closed once the response is sent and
// the remaining upload has been drained, instead of being destroyed mid-upload.
const rejectTooLarge = (res, err) => {
  res.set('Connection', 'close');
  res.status(413).json({ error: err.message });
};

// Reads and JSON-parses the request body, applying the size cap and the
// shallow model validator. Sends the appropriate error response itself and
// returns `null` when the request should stop; otherwise returns the parsed
// model.
const readModelBody = async (req, res) => {
  let raw;

  try {
    raw = await readBody(req);
  } catch (err) {
    rejectTooLarge(res, err);
    return null;
  }

  let model;

  try {
    model = JSON.parse(raw);
  } catch (err) {
    res.status(400).json({ error: 'Body is not valid JSON' });
    return null;
  }

  const invalid = store.validateModel(model);

  if (invalid) {
    res.status(400).json({ error: invalid });
    return null;
  }

  return model;
};

const setupDiagramApi = (devServer) => {
  const { app } = devServer;

  // --- Legacy single-diagram endpoints, kept as an alias for `infra` -------
  app.get('/api/diagram', (req, res) => {
    if (!fs.existsSync(DIAGRAM_FILE)) {
      res.status(404).json({ error: 'No saved diagram yet' });
      return;
    }

    try {
      const raw = store.readDiagram(DIAGRAM_DIR, LEGACY_DIAGRAM_NAME);

      res.type('application/json').send(raw);
    } catch (err) {
      res.status(500).json({ error: `Could not read diagram: ${err.message}` });
    }
  });

  app.post('/api/diagram', async (req, res) => {
    const model = await readModelBody(req, res);

    if (model === null) return;

    try {
      store.writeDiagram(DIAGRAM_DIR, LEGACY_DIAGRAM_NAME, model);
      res.json({ ok: true, savedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: `Could not write diagram: ${err.message}` });
    }
  });

  // --- Multi-diagram endpoints ----------------------------------------------
  app.get('/api/diagrams', (req, res) => {
    try {
      res.json({ diagrams: store.listDiagrams(DIAGRAM_DIR) });
    } catch (err) {
      res.status(500).json({ error: `Could not list diagrams: ${err.message}` });
    }
  });

  app.get('/api/diagrams/:name', (req, res) => {
    const { name } = req.params;

    if (!store.isValidName(name)) {
      res.status(400).json({ error: 'Invalid diagram name' });
      return;
    }

    if (!store.diagramExists(DIAGRAM_DIR, name)) {
      res.status(404).json({ error: 'No such diagram' });
      return;
    }

    try {
      const raw = store.readDiagram(DIAGRAM_DIR, name);

      res.type('application/json').send(raw);
    } catch (err) {
      res.status(500).json({ error: `Could not read diagram: ${err.message}` });
    }
  });

  app.put('/api/diagrams/:name', async (req, res) => {
    const { name } = req.params;

    if (!store.isValidName(name)) {
      res.status(400).json({ error: 'Invalid diagram name' });
      return;
    }

    const model = await readModelBody(req, res);

    if (model === null) return;

    try {
      const created = !store.diagramExists(DIAGRAM_DIR, name);

      store.writeDiagram(DIAGRAM_DIR, name, model);
      res.status(created ? 201 : 200).json({
        ok: true,
        created,
        savedAt: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).json({ error: `Could not write diagram: ${err.message}` });
    }
  });

  app.post('/api/diagrams', async (req, res) => {
    let raw;

    try {
      raw = await readBody(req);
    } catch (err) {
      rejectTooLarge(res, err);
      return;
    }

    let body;

    try {
      body = JSON.parse(raw);
    } catch (err) {
      res.status(400).json({ error: 'Body is not valid JSON' });
      return;
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      res.status(400).json({ error: 'body must be a JSON object' });
      return;
    }

    const { name, model } = body;

    if (!store.isValidName(name)) {
      res.status(400).json({ error: 'Invalid diagram name' });
      return;
    }

    if (store.diagramExists(DIAGRAM_DIR, name)) {
      res.status(409).json({ error: 'Diagram already exists' });
      return;
    }

    const diagramModel = model === undefined ? store.emptyModel(name) : model;

    if (model !== undefined) {
      const invalid = store.validateModel(diagramModel);

      if (invalid) {
        res.status(400).json({ error: invalid });
        return;
      }
    }

    try {
      store.writeDiagram(DIAGRAM_DIR, name, diagramModel);
      res.status(201).json({ ok: true, savedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: `Could not create diagram: ${err.message}` });
    }
  });

  app.post('/api/diagrams/:name/duplicate', async (req, res) => {
    const { name } = req.params;

    if (!store.isValidName(name)) {
      res.status(400).json({ error: 'Invalid diagram name' });
      return;
    }

    let raw;

    try {
      raw = await readBody(req);
    } catch (err) {
      rejectTooLarge(res, err);
      return;
    }

    let body;

    try {
      body = JSON.parse(raw);
    } catch (err) {
      res.status(400).json({ error: 'Body is not valid JSON' });
      return;
    }

    const newName = body && body.name;

    if (!store.isValidName(newName)) {
      res.status(400).json({ error: 'Invalid diagram name' });
      return;
    }

    if (!store.diagramExists(DIAGRAM_DIR, name)) {
      res.status(404).json({ error: 'No such diagram' });
      return;
    }

    if (store.diagramExists(DIAGRAM_DIR, newName)) {
      res.status(409).json({ error: 'Diagram already exists' });
      return;
    }

    try {
      const raw2 = store.readDiagram(DIAGRAM_DIR, name);
      const model = JSON.parse(raw2);

      store.writeDiagram(DIAGRAM_DIR, newName, model);
      res.status(201).json({ ok: true, savedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: `Could not duplicate diagram: ${err.message}` });
    }
  });
};

module.exports = { setupDiagramApi, DIAGRAM_FILE, DIAGRAM_DIR };
