import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('owner photographs replace every active example reference, including Python and documentation', async () => {
  for (const file of ['js/app.js', 'js/filtering-app.js', 'index.html', 'filtering.html', 'Graph_Experiment_FT_IFT.py', 'README.md']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!/NSYSUlogo|校徽/.test(source), `outdated example in ${file}`);
  }
  for (const name of ['Monkey.jpg', 'Cat.jpg']) {
    const bytes = await readFile(new URL(`../${name}`, import.meta.url));
    assert.equal(bytes.readUInt16BE(), 0xffd8, `${name} must be an actual JPEG`);
    assert.ok(bytes.length > 1000);
  }
  for (const file of ['js/app.js', 'filtering.html', 'Graph_Experiment_FT_IFT.py', 'README.md']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(source.includes('Monkey.jpg') && source.includes('Cat.jpg'), file);
  }
});
