import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('all four website samples are retained and offered by the image experiments', async () => {
  for (const file of ['js/app.js', 'js/filtering-app.js', 'js/region-swap-app.js', 'phase-swap.html', 'color-phase.html', 'filtering.html', 'region-swap.html']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!/NSYSUlogo|校徽/.test(source), `outdated example in ${file}`);
  }
  for (const name of ['sample-a.svg', 'sample-b.svg']) {
    const source = await readFile(new URL(`../assets/${name}`, import.meta.url), 'utf8');
    assert.match(source, /<svg\b/);
    assert.match(source, /width="960" height="640"/);
    assert.ok(!/<script|<image|https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(source));
  }
  for (const name of ['Monkey.jpg', 'Cat.jpg']) {
    const bytes = await readFile(new URL(`../${name}`, import.meta.url));
    assert.equal(bytes.readUInt16BE(), 0xffd8, `${name} must remain an actual JPEG`);
    assert.ok(bytes.length > 1000);
  }
  for (const file of ['js/samples.js', 'phase-swap.html', 'color-phase.html', 'filtering.html', 'region-swap.html', 'README.md']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const name of ['sample-a.svg', 'sample-b.svg', 'Monkey.jpg', 'Cat.jpg']) {
      assert.ok(source.includes(name), `${name} missing from ${file}`);
    }
  }
  for (const file of ['js/app.js', 'js/filtering-app.js', 'js/region-swap-app.js']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /from '.\/samples.js'/, file);
  }
});
