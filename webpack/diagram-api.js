// Development-only persistence endpoint for the diagram being edited.
//
// This is mounted by webpack/dev.config.js and exists ONLY while `npm start` is
// running. It is never part of the production bundle or the Docker image.
//
// Security notes — the dev server binds 0.0.0.0, so anything on the local network
// can reach it:
//   * The destination path is fixed here, server-side. The client sends content
//     only and can never influence where the bytes land, which is what closes the
//     path-traversal hole.
//   * The request body is capped, so a large POST cannot exhaust memory.
//   * The payload must look like an Isoflow model before anything is written.
//   * Writes go to a temp file and are then renamed, so an interrupted request
//     cannot leave a half-written diagram behind.

const fs = require('fs');
const path = require('path');

const DIAGRAM_DIR = path.resolve(__dirname, '../diagrams');
const DIAGRAM_FILE = path.join(DIAGRAM_DIR, 'infra.json');
const MAX_BODY_BYTES = 5 * 1024 * 1024;

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
        // the error. The caller destroys it after responding.
        if (!tooLarge) {
          tooLarge = true;
          chunks.length = 0;
          reject(new Error('Payload too large'));
        }

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

// Structural validation only. The full zod schema lives in TypeScript under src/
// and cannot be required from this CommonJS config, so this checks the shape that
// matters: enough to reject anything that is not a diagram before touching disk.
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

const writeDiagram = (model) => {
  fs.mkdirSync(DIAGRAM_DIR, { recursive: true });

  const tmp = `${DIAGRAM_FILE}.tmp`;

  fs.writeFileSync(tmp, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, DIAGRAM_FILE);
};

const setupDiagramApi = (devServer) => {
  const { app } = devServer;

  app.get('/api/diagram', (req, res) => {
    if (!fs.existsSync(DIAGRAM_FILE)) {
      res.status(404).json({ error: 'No saved diagram yet' });
      return;
    }

    try {
      const raw = fs.readFileSync(DIAGRAM_FILE, 'utf8');

      res.type('application/json').send(raw);
    } catch (err) {
      res.status(500).json({ error: `Could not read diagram: ${err.message}` });
    }
  });

  app.post('/api/diagram', async (req, res) => {
    let raw;

    try {
      raw = await readBody(req);
    } catch (err) {
      res.status(413).json({ error: err.message });
      req.destroy();
      return;
    }

    let model;

    try {
      model = JSON.parse(raw);
    } catch (err) {
      res.status(400).json({ error: 'Body is not valid JSON' });
      return;
    }

    const invalid = validateModel(model);

    if (invalid) {
      res.status(400).json({ error: invalid });
      return;
    }

    try {
      writeDiagram(model);
      res.json({ ok: true, savedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: `Could not write diagram: ${err.message}` });
    }
  });
};

module.exports = { setupDiagramApi, DIAGRAM_FILE };
