import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { fixtures, maxDifference } from './test-data.js';
import { FFT } from '../js/fft.js';
import { analyzeRGB, reconstructRGB } from '../js/fourier.js';

test('real worker: cross-color mappings preserve both caches, output direction and validation recovery', { timeout: 20000 }, async t => {
  const worker = new Worker(new URL('./worker-adapter.mjs', import.meta.url));
  t.after(() => worker.terminate());
  let nextId = 0;
  const pending = new Map();
  worker.on('message', message => { pending.get(message.id)?.resolve(message); pending.delete(message.id); });
  worker.on('error', error => { for (const job of pending.values()) job.reject(error); pending.clear(); });
  const send = (type, payload = {}, transfers = []) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject }); worker.postMessage({ id, type, ...payload }, transfers);
  });
  const input = fixtures(256), fft = new FFT(256);
  const a = analyzeRGB(input.rgb, fft), b = analyzeRGB(input.differentRGB, fft);
  for (const [slot, pixels] of [['A', input.rgb], ['B', input.differentRGB]]) {
    const rgba = pixels.slice(); await send('image', { slot, rgba }, [rgba.buffer]); assert.equal(rgba.byteLength, 0);
  }
  let inverseLines = 0;
  for (const phaseChannels of [[1, 2, 0], [2, 2, 2], [0, 1, 2]]) for (const swapChannels of [[true, true, true], [true, false, true], [false, false, false]]) {
    const reply = await send('swap', { phaseChannels, swapChannels }); inverseLines += 3072;
    assert.deepEqual(reply.counts, { forwardLines: 3072, inverseLines });
    assert.deepEqual(reply.result.phaseChannels, phaseChannels);
    assert.deepEqual(reply.result.swapChannels, swapChannels);
    assert.deepEqual(reply.result.first.rgba, reconstructRGB(a, b, fft, swapChannels, phaseChannels).rgba);
    assert.deepEqual(reply.result.second.rgba, reconstructRGB(b, a, fft, swapChannels, phaseChannels).rgba);
    assert.notEqual(reply.result.first.rgba.buffer, reply.result.second.rgba.buffer);
    // Transferred output can be modified without touching cached spectra.
    reply.result.first.rgba.fill(0); reply.result.phaseChannels.fill(0);
  }
  for (const phaseChannels of [null, [], [0, 1], [0, 1, 2, 0], [0, -1, 2], [0, 3, 2], [0, 1.5, 2], ['0', 1, 2], new Array(3), new Uint8Array([0, 1, 2])]) {
    const reply = await send('swap', { phaseChannels });
    assert.match(reply.error, /three integers from 0 to 2/);
    assert.deepEqual(reply.counts, { forwardLines: 3072, inverseLines });
  }
  const recovered = await send('swap', { phaseChannels: [1, 2, 0] });
  assert.deepEqual(recovered.result.first.rgba, reconstructRGB(a, b, fft, [true, true, true], [1, 2, 0]).rgba);
  assert.deepEqual(recovered.result.second.rgba, reconstructRGB(b, a, fft, [true, true, true], [1, 2, 0]).rgba);
  assert.deepEqual(recovered.counts, { forwardLines: 3072, inverseLines: inverseLines + 3072 });
  assert.equal(pending.size, 0);
});

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

test('real worker: RGB phase flags select same-color channels in both directions without invalidating cache', { timeout: 20000 }, async t => {
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
  const input = fixtures(256), originals = [input.rgb, input.differentRGB];
  for (const [index, slot] of ['A', 'B'].entries()) {
    const rgba = originals[index].slice();
    await send('image', { slot, rgba }, [rgba.buffer]);
    assert.equal(rgba.byteLength, 0, `${slot} input buffer transferred`);
  }
  const baseline = await send('swap');
  assert.deepEqual(baseline.result.swapChannels, [true, true, true], 'omitted selection preserves full swap');
  let inverseLines = 3072;
  for (let bits = 0; bits < 8; bits++) {
    const swapChannels = [0, 1, 2].map(channel => Boolean(bits & (1 << channel)));
    const selected = [...swapChannels];
    const response = send('swap', { swapChannels });
    swapChannels.fill(false);
    const reply = await response;
    inverseLines += 3072;
    assert.deepEqual(reply.result.swapChannels, selected, 'reply records submitted selection');
    assert.deepEqual(reply.counts, { forwardLines: 3072, inverseLines }, 'selection reuses both FFT caches');
    for (const [direction, key] of ['first', 'second'].entries()) {
      const output = reply.result[key];
      const expected = Uint8ClampedArray.from(originals[direction], (value, i) =>
        i % 4 < 3 && selected[i % 4] ? baseline.result[key].rgba[i] : value);
      assert.deepEqual(output.rgba, expected, `${key}: R/G/B ${selected}`);
      assert.equal(output.rgba.byteLength, 256 * 256 * 4);
      assert.ok(output.stats.maxImaginary < 1e-8);
    }
    assert.notEqual(reply.result.first.rgba.buffer, reply.result.second.rgba.buffer);
  }
  const validCounts = { forwardLines: 3072, inverseLines };
  for (const swapChannels of [null, [], [true, true], [true, true, true, false], [true, 1, false],
    [true, false, undefined], new Array(3), new Uint8Array([1, 1, 1]), 'RGB']) {
    const reply = await send('swap', { swapChannels });
    assert.match(reply.error, /three booleans/);
    assert.deepEqual(reply.counts, validCounts, 'invalid selections perform no FFT or IFFT');
  }
  const recovered = await send('swap', { swapChannels: [true, false, true] });
  assert.equal(recovered.counts.forwardLines, 3072, 'worker survives invalid selections and retains cache');
  for (const [direction, key] of ['first', 'second'].entries()) {
    const expected = Uint8ClampedArray.from(originals[direction], (value, i) =>
      i % 4 === 0 || i % 4 === 2 ? baseline.result[key].rgba[i] : value);
    assert.deepEqual(recovered.result[key].rgba, expected);
  }
  assert.equal(pending.size, 0);
  t.diagnostic('All eight RGB selections verified in both directions; invalid selections leave both FFT caches intact.');
});
