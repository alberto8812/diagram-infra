// Smoke-tests the real HTTP endpoints against a real (temp) express app and
// server, never against the repository's `diagrams/` directory. The server is
// started and closed within a single test run — nothing is left listening.
//
// `ISOFLOW_TEST_DIAGRAM_DIR` redirects diagram-api's fixed server-side
// DIAGRAM_DIR to a temp folder for this process only; it is set before
// diagram-api.js is first required (module-level constant), and is never
// read from a request.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

let tmpDir;
let server;
let baseUrl;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isoflow-diagram-api-smoke-'));
  process.env.ISOFLOW_TEST_DIAGRAM_DIR = tmpDir;

  // eslint-disable-next-line global-require
  const express = require('express');
  // eslint-disable-next-line global-require
  const { setupDiagramApi } = require('../diagram-api');

  const app = express();

  setupDiagramApi({ app });

  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

afterAll(() => {
  delete process.env.ISOFLOW_TEST_DIAGRAM_DIR;

  return new Promise((resolve) => {
    server.close(resolve);
  });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('diagram API smoke test (temp directory)', () => {
  test('GET /api/diagrams starts empty', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ diagrams: [] });
  });

  test('POST /api/diagrams creates a new diagram with an empty model', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'network' })
    });

    expect(res.status).toBe(201);

    const listRes = await fetch(`${baseUrl}/api/diagrams`);
    const { diagrams } = await listRes.json();

    expect(diagrams.map((d) => d.name)).toEqual(['network']);
  });

  test('POST /api/diagrams rejects an invalid name', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '../evil' })
    });

    expect(res.status).toBe(400);
  });

  test('POST /api/diagrams returns 409 for an existing name', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'network' })
    });

    expect(res.status).toBe(409);
  });

  test('GET /api/diagrams/:name returns the created diagram', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams/network`);

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body.title).toBe('network');
  });

  test('GET /api/diagrams/:name is 404 for a missing diagram', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams/missing`);

    expect(res.status).toBe(404);
  });

  test('GET /api/diagrams/:name rejects a path-traversal-shaped name', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams/..%2f..%2fetc`);

    expect([400, 404]).toContain(res.status);
    expect(
      fs.existsSync(path.join(tmpDir, '..', '..', 'etc.json'))
    ).toBe(false);
  });

  test('PUT /api/diagrams/:name updates the diagram', async () => {
    const current = await (await fetch(`${baseUrl}/api/diagrams/network`)).json();

    current.description = 'updated';

    const res = await fetch(`${baseUrl}/api/diagrams/network`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current)
    });

    expect(res.status).toBe(200);

    const updated = await (await fetch(`${baseUrl}/api/diagrams/network`)).json();

    expect(updated.description).toBe('updated');
  });

  test('PUT /api/diagrams/:name creates when missing', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams/fresh`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'fresh', items: [], views: [], colors: [] })
    });

    expect(res.status).toBe(201);
  });

  test('POST /api/diagrams/:name/duplicate copies a diagram', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams/network/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'network-copy' })
    });

    expect(res.status).toBe(201);

    const copy = await (await fetch(`${baseUrl}/api/diagrams/network-copy`)).json();

    expect(copy.description).toBe('updated');
  });

  test('POST /api/diagrams/:name/duplicate is 404 for a missing source', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams/missing/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'whatever' })
    });

    expect(res.status).toBe(404);
  });

  test('POST /api/diagrams/:name/duplicate is 409 when the target exists', async () => {
    const res = await fetch(`${baseUrl}/api/diagrams/network/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'network-copy' })
    });

    expect(res.status).toBe(409);
  });

  test('legacy GET/POST /api/diagram still works and aliases "infra"', async () => {
    const missing = await fetch(`${baseUrl}/api/diagram`);

    expect(missing.status).toBe(404);

    const post = await fetch(`${baseUrl}/api/diagram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'infra', items: [], views: [], colors: [] })
    });

    expect(post.status).toBe(200);

    const viaLegacy = await (await fetch(`${baseUrl}/api/diagram`)).json();
    const viaNamed = await (await fetch(`${baseUrl}/api/diagrams/infra`)).json();

    expect(viaLegacy).toEqual(viaNamed);
  });

  test('POST /api/diagram (legacy) over the size cap returns 413 without a crash', async () => {
    const res = await fetch(`${baseUrl}/api/diagram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'infra',
        items: [],
        views: [],
        colors: [],
        padding: 'x'.repeat(6 * 1024 * 1024)
      })
    });

    expect(res.status).toBe(413);
  });
});
