import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

test('refined Worker: true inverse transforms, parameter updates, invalid input recovery and transferred reference reuse', { timeout: 20000 }, async t => {
  const worker = new Worker(new URL('./spectrum-worker-adapter.mjs', import.meta.url));
  t.after(() => worker.terminate());
  let nextId = 0;
  const jobs = new Map();
  worker.on('message', data => { jobs.get(data.id).resolve(data); jobs.delete(data.id); });
  worker.on('error', error => { for (const job of jobs.values()) job.reject(error); jobs.clear(); });
  const send = (preset, params) => new Promise((resolve, reject) => { const id = ++nextId; jobs.set(id, { resolve, reject }); worker.postMessage({ id, type: 'experiment', preset, params }); });
  const zero = await send('shifted-square', { dx: 0, dy: 0 });
  assert.equal(zero.inverseLines, 512, 'one real 2D IFFT is required');
  assert.equal(zero.result.stats.maxChange, 0);
  const moved = await send('shifted-square', { dx: 37, dy: -25 });
  assert.equal(moved.inverseLines, 1024);
  assert.deepEqual(moved.result.reconstructed, moved.result.shifted);
  assert.deepEqual(moved.result.original, zero.result.original, 'cached baseline survives transfer');
  assert.ok(moved.result.stats.maxError < 1e-8 && moved.result.stats.maxChange > 1);
  assert.match((await send('shifted-square', { dx: 97, dy: 0 })).error, /integer/);
  const again = await send('shifted-square', { dx: 0, dy: 0 });
  assert.deepEqual(again.result, zero.result);
  for (const [preset, params] of [['square', { side: 96 }], ['circle', { radius: 64 }], ['stripes', { period: 16 }]]) {
    const result = await send(preset, params);
    assert.deepEqual(result.result.params, params);
    assert.equal(result.result.spatial.length, 256 ** 2 * 4);
  }
  assert.match((await send('stripes', { period: 30 })).error, /Invalid/);
  assert.ok((await send('stripes', { period: 16 })).result.spatial.length > 0);
});
