import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('both pages, navigation, CSS and complete module/worker graph load under a repository subpath', { timeout: 15000 }, async t => {
  const root = new URL('../', import.meta.url);
  const basePath = '/fourier-phase-swap-playground/';
  const server = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: fileURLToPath(root), env: { ...process.env, PORT: '0', BASE_PATH: basePath }, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => server.kill());
  const origin = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.stderr.on('data', data => reject(new Error(String(data))));
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) resolve(match[0]); });
  });
  const base = new URL(basePath, origin);
  const visited = new Set();
  async function visit(path) {
    const url = new URL(path, base);
    assert.ok(url.href.startsWith(base.href), `resource escapes repository: ${url}`);
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const response = await fetch(url);
    assert.equal(response.status, 200, url.href);
    if (url.pathname.endsWith('.js')) assert.match(response.headers.get('content-type'), /^text\/javascript/);
    const text = await response.text();
    if (url.pathname.endsWith('.js')) {
      assert.ok(!/\b(?:require\(|process\.|node:)/.test(text));
      for (const match of text.matchAll(/(?:from\s*|new URL\(\s*)['"]([^'"]+)['"]/g)) await visit(new URL(match[1], url).href);
    }
    if (url.pathname.endsWith('.html')) {
      for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) await visit(new URL(match[1], url).href);
      assert.match(text, /<nav class="page-nav"/);
      assert.match(text, /href="\.\/index.html"/);
      assert.match(text, /href="\.\/spectrum.html"/);
      assert.equal((text.match(/aria-current="page"/g) || []).length, 1);
    }
  }
  await visit('index.html');
  await visit('spectrum.html');
  assert.ok(visited.has(new URL('js/fft.js', base).href));
  assert.ok(visited.has(new URL('js/spectrum-worker.js', base).href));
  assert.ok(visited.has(new URL('js/worker.js', base).href));
  assert.equal((await fetch(origin + '/spectrum.html')).status, 404, 'root resources deliberately unavailable at this mount');
  assert.equal((await stat(new URL('.nojekyll', root))).size, 0);
  const css = await readFile(new URL('spectrum.css', root), 'utf8');
  assert.ok(!/https?:|url\(\s*['"]?\//.test(css), 'no external or root-relative CSS dependency');
  t.diagnostic(`${visited.size} resources tested over HTTP under ${basePath}; no remote deployment.`);
});
