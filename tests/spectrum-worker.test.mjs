import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

test('Spectrum Worker uses the shared FFT, caches four presets and retains raw arrays after transfers', { timeout: 15000 }, async t => {
  const worker = new Worker(new URL('./spectrum-worker-adapter.mjs', import.meta.url));
  t.after(() => worker.terminate());
  let id = 0;
  const jobs = new Map();
  worker.on('message', data => { jobs.get(data.id).resolve(data); jobs.delete(data.id); });
  worker.on('error', error => { for (const job of jobs.values()) job.reject(error); jobs.clear(); });
  const send = (type, preset) => new Promise((resolve, reject) => { jobs.set(++id, { resolve, reject }); worker.postMessage({ id, type, preset }); });
  const square = await send('preset', 'square');
  assert.equal(square.forwardLines, 512, 'one single-channel 2D FFT');
  for (const preset of ['circle', 'stripes', 'shifted-square']) assert.ok((await send('preset', preset)).result.spatial.length === 256 ** 2 * 4);
  const comparison = await send('compare');
  assert.equal(comparison.forwardLines, 2048, 'four cached FFTs, no second transform for comparison');
  assert.ok(comparison.result.maxMagnitudeDifference < 1e-7);
  assert.ok(comparison.result.maxCoefficientError < 1e-7);
  assert.deepEqual(comparison.result.square.magnitude, square.result.magnitude);
  assert.deepEqual(comparison.result.square.phase, square.result.phase);
  assert.match((await send('preset', 'invalid')).error, /Unknown/);
  assert.match((await send('invalid')).error, /Unknown/);
  const again = await send('preset', 'square');
  assert.equal(again.forwardLines, 2048);
  assert.deepEqual(again.result, square.result, 'transferred display buffers do not detach or modify cached raw data');
});
