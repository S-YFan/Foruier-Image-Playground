import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const pages = [
  ['index.html', 'home', 'FOURIER IMAGE LAB'],
  ['phase-swap.html', 'phase-swap', 'Experiment 001 — RGB Fourier Phase Swap — FOURIER IMAGE LAB'],
  ['color-phase.html', 'color-phase', 'Experiment 002 — Different Color, Different Phase — FOURIER IMAGE LAB'],
  ['filtering.html', 'filtering', 'Experiment 003 — Gaussian Filtering — FOURIER IMAGE LAB'],
  ['region-swap.html', 'region-swap', 'Experiment 004 — Partial Phase Region Swap — FOURIER IMAGE LAB'],
  ['spectrum.html', 'spectrum', 'Experiment 005 — Spectrum Lab — FOURIER IMAGE LAB'],
  ['documentation.html', 'documentation', 'Documentation'],
];

test('Home, documentation and all five experiments load with their resource graphs under the GitHub Pages subpath', { timeout: 15000 }, async t => {
  const root = new URL('../', import.meta.url);
  const basePath = '/Foruier-Image-Playground/';
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
  const visited = new Map();
  const anchors = [];
  async function visit(path) {
    const url = new URL(path, base);
    if (url.origin !== base.origin || ['data:', 'blob:', 'mailto:'].includes(url.protocol)) return;
    assert.ok(url.pathname.startsWith(base.pathname), `resource escapes repository: ${url}`);
    if (url.hash) anchors.push(new URL(url));
    url.hash = '';
    if (visited.has(url.href)) return visited.get(url.href);
    const response = await fetch(url);
    assert.equal(response.status, 200, url.href);
    const contentType = response.headers.get('content-type');
    if (url.pathname.endsWith('.js')) assert.match(contentType, /^text\/javascript/);
    const text = /text\/|javascript|json|svg/.test(contentType) ? await response.text() : '';
    visited.set(url.href, text);
    if (url.pathname.endsWith('.js') && !url.pathname.includes('/assets/katex/')) {
      assert.ok(!/\b(?:require\(|process\.|node:)/.test(text), 'browser modules cannot depend on Node');
      for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]|new URL\(\s*['"]([^'"]+)['"],\s*import\.meta\.url/g)) await visit(new URL(match[1] ?? match[2], url).href);
    }
    if (/^text\/html/.test(contentType)) {
      for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) await visit(new URL(match[1], url).href);
    }
    if (/^text\/css/.test(contentType)) {
      for (const match of text.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) await visit(new URL(match[1], url).href);
    }
    return text;
  }
  const rootHTML = await visit('./');
  assert.match(rootHTML, /data-page="home"/, 'repository root is Home');
  for (const [page, key, title] of pages) {
    const html = await visit(page);
    assert.ok(html.includes(`<title>${title}`), `page title: ${page}`);
    assert.match(html, new RegExp(`data-page="${key}"`));
    assert.match(html, /data-site-header/);
    assert.match(html, /data-site-footer/);
    assert.match(html, /src="\.\/js\/site\.js"/);
    assert.match(html, /name="application-name" content="FOURIER IMAGE LAB"/);
    assert.ok(!/FOURIER LAB|Fourier Lab|IMAGIE/.test(html), 'consistent site brand');
    const chinese = await visit(`zh/${page}`);
    assert.match(chinese, /<html lang="zh-TW">/);
    assert.match(chinese, new RegExp(`data-page="${key}"`));
    assert.match(chinese, /src="\.\.\/js\/site\.js"/);
  }
  assert.match(await visit('zh/'), /data-page="home"/);
  for (const anchor of anchors) {
    const id = decodeURIComponent(anchor.hash.slice(1));
    anchor.hash = '';
    const html = visited.get(anchor.href);
    assert.ok(!html || !html.includes('<html') || html.includes(`id="${id}"`), `missing anchor #${id} on ${anchor.pathname}`);
  }
  for (const file of ['js/fft.js', 'js/worker.js', 'js/spectrum-worker.js', 'js/filtering-worker.js', 'js/region-swap-worker.js', 'js/site.js', 'js/math.js']) {
    assert.ok(visited.has(new URL(file, base).href), `resource graph includes ${file}`);
  }
  const license = await (await fetch(new URL('LICENSE', base))).text();
  assert.match(license, /^MIT License/);
  assert.match(license, /Copyright \(c\) \d{4} Sheng-Yang Fan/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.equal((await fetch(origin + '/spectrum.html')).status, 404, 'root resources unavailable at repository mount');
  assert.equal((await stat(new URL('.nojekyll', root))).size, 0);
  t.diagnostic(`${visited.size} resources tested over HTTP under ${basePath}; no remote deployment.`);
});

test('Home and documentation use the same local math renderer with no remote runtime dependencies', async () => {
  const root = new URL('../', import.meta.url);
  for (const file of ['index.html', 'documentation.html']) {
    const html = await readFile(new URL(file, root), 'utf8');
    assert.match(html, /data-math/);
    assert.match(html, /assets\/katex\/katex\.min\.css/);
    assert.match(html, /assets\/katex\/katex\.min\.js/);
    assert.match(html, /js\/math\.js/);
    assert.ok(!/<script[^>]+src="https?:/.test(html), `no external executable dependency in ${file}`);
  }
});
