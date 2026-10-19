import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('static hosting: HTTP status/MIME, shipped assets and repository-relative module graph', { timeout: 15000 }, async t => {
  const root = new URL('../', import.meta.url);
  const server = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: fileURLToPath(root), env: { ...process.env, PORT: '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => server.kill());
  const origin = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.stderr.on('data', data => reject(new Error(String(data))));
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) resolve(match[0]); });
  });
  for (const [path, type] of [['/', 'text/html'], ['/styles.css', 'text/css'], ['/js/worker.js', 'text/javascript'], ['/js/image.js', 'text/javascript'], ['/assets/sample-a.svg', 'image/svg+xml'], ['/assets/sample-b.svg', 'image/svg+xml']]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get('content-type').startsWith(type));
    await response.arrayBuffer();
  }
  assert.equal((await stat(new URL('.nojekyll', root))).size, 0);
  const base = 'https://example.github.io/repository/';
  const visited = new Set();
  async function visit(relativePath) {
    if (visited.has(relativePath)) return;
    visited.add(relativePath);
    const text = await readFile(new URL(relativePath, root), 'utf8');
    const moduleURL = new URL(relativePath, base);
    assert.ok(!/\b(?:require\(|process\.|node:)/.test(text), 'Browser modules must not require Node');
    for (const match of text.matchAll(/(?:from\s*|new URL\(\s*)['"]([^'"]+)['"]/g)) {
      const resolved = new URL(match[1], moduleURL);
      assert.ok(resolved.href.startsWith(base), `Escapes repository: ${match[1]}`);
      const local = resolved.href.slice(base.length);
      assert.ok((await stat(new URL(local, root))).isFile(), local);
      if (local.endsWith('.js')) await visit(local);
    }
  }
  await visit('js/app.js');
  assert.ok(visited.has('js/worker.js') && visited.has('js/fft.js') && visited.has('js/image.js'));
  const html = await readFile(new URL('index.html', root), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const resolved = new URL(match[1], base);
    assert.ok(resolved.href.startsWith(base));
    assert.ok((await stat(new URL(resolved.href.slice(base.length), root))).isFile() || match[1] === './');
  }
  t.diagnostic('Local HTTP and repository-relative URL resolution tested. No remote GitHub deployment performed.');
});
