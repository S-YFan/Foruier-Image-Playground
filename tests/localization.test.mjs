import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { build, pageFiles } from '../scripts/build-locales.mjs';
import { messages } from '../js/i18n.js';

test('Chinese static routes are complete and match the current English sources', async () => {
  assert.equal(await build({ check: true }), 6);
  assert.deepEqual((await readdir(new URL('../zh/', import.meta.url))).sort(), [...pageFiles].sort());
  for (const page of pageFiles) {
    const en = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
    const zh = await readFile(new URL(`../zh/${page}`, import.meta.url), 'utf8');
    assert.match(en, /<html lang="en">/);
    assert.ok(!/[\u3400-\u9fff]/.test(en), `English source contains untranslated text: ${page}`);
    assert.match(zh, /<html lang="zh-TW">/);
    assert.match(zh, /[\u3400-\u9fff]/);
    const formulas = html => [...html.matchAll(/<([\w]+)[^>]*\bdata-math\b[^>]*>([\s\S]*?)<\/\1>/g)].map(match => match[2]);
    assert.deepEqual(formulas(en), formulas(zh), `same mathematical definitions: ${page}`);
    const canvases = html => [...html.matchAll(/<canvas\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(canvases(en), canvases(zh), `same experiment surfaces: ${page}`);
    const modules = html => [...html.matchAll(/<script[^>]*src="(?:\.\/|\.\.\/)([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(modules(en), modules(zh), `shared UI and FFT module graph: ${page}`);
  }
});

test('runtime UI translations have matching placeholders in both languages', () => {
  const fields = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [key, translations] of Object.entries(messages)) {
    assert.equal(translations.length, 2, key);
    const [en, zh] = translations;
    assert.ok(en && zh, key);
    assert.ok(!/[\u3400-\u9fff]/.test(en), `English UI text: ${key}`);
    assert.deepEqual(fields(en), fields(zh), key);
  }
});

test('documentation presents three scientific topics and a verifiable textbook source in both languages', async () => {
  for (const prefix of ['', 'zh/']) {
    const html = await readFile(new URL(`../${prefix}documentation.html`, import.meta.url), 'utf8');
    const toc = html.match(/<nav class="docs-toc"[\s\S]*?<\/nav>/)[0];
    assert.deepEqual([...toc.matchAll(/href="#([^"]+)"/g)].map(match => match[1]), ['introduction', 'mathematics', 'experiments']);
    assert.ok(!/id="(?:open-source|credits|getting-started)"/.test(html));
    assert.match(html, /Signals and Systems/);
    assert.match(html, /Alan V\. Oppenheim/);
    assert.match(html, /Alan S\. Willsky/);
    assert.match(html, /S\. Hamid Nawab/);
    assert.match(html, /Time- and Frequency Characterization of Signals and Systems/);
    assert.match(html, /pearson\.com/);
    assert.match(html, /data-site-footer/);
  }
});
