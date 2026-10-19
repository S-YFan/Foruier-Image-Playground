import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { FFT } from '../js/fft.js';
import { IMAGE_SIZE, analyzeRGB } from '../js/fourier.js';
import { partialPhaseSwapRGB, displayPhaseSwap, displayPhaseMask } from '../js/region-swap.js';
import { noise, pixels } from './test-data.js';

test('Phase 4 Worker caches both FFTs, transfers outputs and survives invalid requests/updates', { timeout: 20000 }, async t => {
  const worker = new Worker(new URL('./region-swap-worker-adapter.mjs', import.meta.url));
  t.after(() => worker.terminate());
  const pending = new Map();
  let nextId = 0;
  worker.on('message', message => { pending.get(message.id)?.resolve(message); pending.delete(message.id); });
  worker.on('error', error => { for (const job of pending.values()) job.reject(error); pending.clear(); });
  const send = (type, payload = {}, transfers = []) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, ...payload }, transfers);
  });
  assert.match((await send('reconstruct')).error, /both images/);
  assert.match((await send('unknown')).error, /Unknown/);
  assert.match((await send('image', { slot: 'C' })).error, /slot/);

  const a = noise(IMAGE_SIZE, 5), b = noise(IMAGE_SIZE, 73), transfer = a.slice();
  let response = await send('image', { slot: 'A', rgba: transfer }, [transfer.buffer]);
  assert.equal(transfer.byteLength, 0);
  assert.deepEqual(response.counts, { forwardLines: 1536, inverseLines: 0 });
  assert.match((await send('reconstruct')).error, /both images/);
  assert.match((await send('image', { slot: 'B', rgba: new Uint8ClampedArray(4) })).error, /size/);
  response = await send('image', { slot: 'B', rgba: b });
  assert.equal(response.counts.forwardLines, 3072);

  const fft = new FFT(IMAGE_SIZE), spectrumA = analyzeRGB(a, fft), spectrumB = analyzeRGB(b, fft);
  const cases = [
    { type: 'disk', cutoff: 0.01 }, { type: 'disk', cutoff: 0.30 },
    ...['ul-lr', 'ur-ll', 'both'].map(quadrants => ({ type: 'quadrants', quadrants })),
    ...['vertical', 'horizontal'].flatMap(orientation =>
      [5, 20, 50].map(stripeWidth => ({ type: 'stripes', orientation, stripeWidth }))),
  ];
  let previousInverse = 0, firstRGBA;
  for (const parameters of cases) {
    response = await send('reconstruct', { parameters });
    assert.equal(response.error, undefined);
    assert.equal(response.counts.forwardLines, 3072, 'controls reuse both cached forward transforms');
    assert.equal(response.counts.inverseLines - previousInverse, 1536, 'one genuine RGB IFFT per update');
    const expected = partialPhaseSwapRGB(spectrumA, spectrumB, fft, parameters);
    assert.deepEqual(response.result.rgba, displayPhaseSwap(expected.channels));
    assert.deepEqual(response.result.maskRGBA, displayPhaseMask(expected.mask, IMAGE_SIZE));
    assert.deepEqual(response.result.stats, expected.stats);
    assert.ok(Number.isFinite(response.result.milliseconds) && response.result.milliseconds >= 0);
    if (firstRGBA) assert.notDeepEqual(response.result.rgba, firstRGBA, 'parameter changes produce a new image');
    else firstRGBA = response.result.rgba;
    previousInverse = response.counts.inverseLines;
  }
  const baseline = (await send('reconstruct')).result;
  const previous = response.counts.forwardLines;
  const invalidImage = await send('image', { slot: 'A', rgba: new Uint8ClampedArray(4) });
  assert.match(invalidImage.error, /size/);
  assert.equal(invalidImage.counts.forwardLines, previous);
  const invalidParameters = await send('reconstruct', { parameters: { stripeWidth: 0 } });
  assert.match(invalidParameters.error, /width/);
  const retry = await send('reconstruct');
  assert.deepEqual(retry.result.rgba, baseline.rgba, 'failed image updates retain the prior valid A/B cache');
  assert.deepEqual(retry.result.maskRGBA, baseline.maskRGBA);

  const replacement = pixels(IMAGE_SIZE, (x, y, c) => (x * (17 + c) + y * 29) % 256);
  response = await send('image', { slot: 'B', rgba: replacement });
  assert.equal(response.counts.forwardLines, 4608);
  response = await send('reconstruct');
  assert.notDeepEqual(response.result.rgba, baseline.rgba, 'replacing B updates its cached phase');
  assert.equal(response.counts.forwardLines, 4608);
  await send('image', { slot: 'A', rgba: pixels(IMAGE_SIZE, () => 0) });
  response = await send('reconstruct');
  assert.equal(response.result.stats.energyFraction, null);
  assert.equal(response.result.stats.pass, true);
  assert.ok(response.result.rgba.every((value, i) => value === (i % 4 === 3 ? 255 : 0)));
  assert.equal(pending.size, 0);
});
