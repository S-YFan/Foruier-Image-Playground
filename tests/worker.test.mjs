import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { fixtures, maxDifference } from './test-data.js';
import { FFT } from '../js/fft.js';
import { analyzeRGB, reconstructRGB } from '../js/fourier.js';

test('real worker: transfers, errors, exact FFT call counts, cache reuse and replacement', { timeout: 20000 }, async t => {
  const worker = new Worker(new URL('./worker-adapter.mjs', import.meta.url));
  t.after(() => worker.terminate());
  const pending = new Map();
  let id = 0;
  worker.on('message', message => { pending.get(message.id)?.resolve(message); pending.delete(message.id); });
  worker.on('error', error => { for (const job of pending.values()) job.reject(error); pending.clear(); });
  function send(type, payload = {}, transfers = []) {
    return new Promise((resolve, reject) => {
      const key = ++id;
      pending.set(key, { resolve, reject });
      worker.postMessage({ id: key, type, ...payload }, transfers);
    });
  }
  assert.match((await send('swap')).error, /both images/);
  assert.match((await send('invalid')).error, /Unknown/);
  const input = fixtures(256);
  let rgba = input.rgb.slice();
  let reply = await send('image', { slot: 'A', rgba }, [rgba.buffer]);
  assert.equal(rgba.byteLength, 0, 'input buffer transfers ownership');
  assert.deepEqual(reply.counts, { forwardLines: 1536, inverseLines: 0 });
  reply = await send('image', { slot: 'B', rgba: input.differentRGB });
  assert.deepEqual(reply.counts, { forwardLines: 3072, inverseLines: 0 });
  const baseline = await send('swap');
  assert.deepEqual(baseline.counts, { forwardLines: 3072, inverseLines: 3072 });
  for (let run = 0; run < 10; run++) {
    reply = await send('swap');
    assert.equal(maxDifference(reply.result.first.rgba, baseline.result.first.rgba), 0);
    assert.equal(maxDifference(reply.result.second.rgba, baseline.result.second.rgba), 0);
    assert.equal(reply.counts.forwardLines, 3072, 'Swap must not repeat forward FFT');
  }
  assert.equal(reply.counts.inverseLines, 11 * 3072);
  assert.match((await send('image', { slot: 'A', rgba: new Uint8ClampedArray(4) })).error, /size/);
  assert.match((await send('image', { slot: 'Z', rgba: input.black })).error, /slot/);
  reply = await send('swap');
  assert.deepEqual(reply.result.first.rgba, baseline.result.first.rgba, 'invalid update retains cache');
  reply = await send('image', { slot: 'A', rgba: input.gray });
  assert.equal(reply.counts.forwardLines, 4608, 'replacing A transforms only A');
  const result = (await send('swap')).result;
  const fft = new FFT(256);
  const gray = analyzeRGB(input.gray, fft), b = analyzeRGB(input.differentRGB, fft);
  assert.deepEqual(result.first.rgba, reconstructRGB(gray, b, fft).rgba);
  assert.deepEqual(result.second.rgba, reconstructRGB(b, gray, fft).rgba);
  assert.equal(pending.size, 0);
  t.diagnostic('Initial A/B: 6 FFT2; each Swap: 6 IFFT2, 0 FFT2; replace A: 3 FFT2. Ten repeated swaps identical.');
});
