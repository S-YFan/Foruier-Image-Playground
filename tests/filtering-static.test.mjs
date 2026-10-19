import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('website samples use public SVG scenes without bundling private reference photographs', async () => {
  for (const file of ['js/app.js', 'js/filtering-app.js', 'js/region-swap-app.js', 'index.html', 'filtering.html', 'region-swap.html']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!/NSYSUlogo|校徽/.test(source), `outdated example in ${file}`);
    assert.ok(!/Monkey\.jpg|Cat\.jpg/.test(source), `private reference photograph in ${file}`);
  }
  for (const name of ['sample-a.svg', 'sample-b.svg']) {
    const source = await readFile(new URL(`../assets/${name}`, import.meta.url), 'utf8');
    assert.match(source, /<svg\b/);
    assert.match(source, /width="960" height="640"/);
    assert.ok(!/<script|<image|https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(source));
  }
  for (const file of ['js/app.js', 'filtering.html', 'README.md']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(source.includes('sample-a.svg') && source.includes('sample-b.svg'), file);
  }
});
