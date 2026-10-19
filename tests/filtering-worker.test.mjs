import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { FFT } from '../js/fft.js';
import { IMAGE_SIZE, analyzeRGB } from '../js/fourier.js';
import { filterRGB, displayFilteredRGB } from '../js/filtering.js';
import { fixtures } from './test-data.js';

test('Gaussian Worker: real IFFT, transfer ownership, cached forward FFT and invalid update recovery', { timeout: 20000 }, async t => {
  const worker = new Worker(new URL('./filtering-worker-adapter.mjs', import.meta.url));
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
  assert.match((await send('filter')).error, /load an image/);
  assert.match((await send('unknown')).error, /Unknown/);
  const pixels = fixtures(IMAGE_SIZE).rgb;
  const transfer = pixels.slice();
  let response = await send('image', { rgba: transfer }, [transfer.buffer]);
  assert.equal(transfer.byteLength, 0);
  assert.deepEqual(response.counts, { forwardLines: 1536, inverseLines: 0 });
  for (const [sigma, alpha] of [[30, 1], [10, 3], [100, 0]]) {
    response = await send('filter', { sigma, alpha });
    assert.equal(response.counts.forwardLines, 1536, 'sliders never recompute source FFT');
    const expected = filterRGB(analyzeRGB(pixels, new FFT(IMAGE_SIZE)), new FFT(IMAGE_SIZE), { sigma, alpha });
    for (const type of ['lpf', 'hpf', 'sharpen']) assert.deepEqual(response.result[type], displayFilteredRGB(expected[type], type));
  }
  assert.equal(response.counts.inverseLines, 3 * 9 * 512, 'each result comes from three actual channel IFFTs');
  const baseline = (await send('filter')).result;
  assert.match((await send('image', { rgba: new Uint8ClampedArray(4) })).error, /size/);
  assert.match((await send('filter', { sigma: 0 })).error, /Sigma/);
  assert.match((await send('filter', { alpha: -1 })).error, /Alpha/);
  const retry = (await send('filter')).result;
  for (const type of ['lpf', 'hpf', 'sharpen']) assert.deepEqual(retry[type], baseline[type]);
  let previous = (await send('filter')).counts;
  const expectedSpectrum = analyzeRGB(pixels, new FFT(IMAGE_SIZE));
  for (const [group, sigma, alpha, types] of [
    ['pass', 10, NaN, ['lpf', 'hpf']],
    ['sharpen', 90, 1.7, ['sharpen']],
    ['pass', 60, NaN, ['lpf', 'hpf']],
    ['sharpen', 140, 0, ['sharpen']],
    ['sharpen', 140, 2.5, ['sharpen']],
  ]) {
    response = await send('filter', { group, sigma, alpha });
    assert.deepEqual(Object.keys(response.result).filter(key => key !== 'milliseconds'), types);
    assert.equal(response.counts.forwardLines, 1536, 'both sections share the same source FFT cache');
    assert.equal(response.counts.inverseLines - previous.inverseLines, types.length * 3 * 512,
      'only selected outputs execute actual RGB IFFT2');
    const expected = filterRGB(expectedSpectrum, new FFT(IMAGE_SIZE), {
      sigma, alpha: group === 'pass' ? 1 : alpha, filters: types,
    });
    for (const type of types) assert.deepEqual(response.result[type], displayFilteredRGB(expected[type], type));
    previous = response.counts;
  }
  const invalid = await send('filter', { group: 'unknown' });
  assert.match(invalid.error, /group/);
  assert.deepEqual(invalid.counts, previous, 'invalid groups execute no FFT or IFFT');
  response = await send('image', { rgba: fixtures(IMAGE_SIZE).black });
  assert.equal(response.counts.forwardLines, 3072);
  response = await send('filter');
  assert.ok(response.result.lpf.every((value, i) => value === (i % 4 === 3 ? 255 : 0)));
  assert.ok(response.result.hpf.every((value, i) => value === (i % 4 === 3 ? 255 : 128)));
  assert.equal(pending.size, 0);
});
