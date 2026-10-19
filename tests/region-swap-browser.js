import { FFT } from '../js/fft.js';
import { analyzeRGB } from '../js/fourier.js';
import { prepareImage } from '../js/image.js';
import { DEFAULT_PARAMETERS, partialPhaseSwapRGB, displayPhaseSwap, displayPhaseMask } from '../js/region-swap.js';
import { maxDifference } from './test-data.js';

const assert = (condition, message = 'Assertion failed') => { if (!condition) throw new Error(message); };
const results = [], metrics = { displayedError: 0, maskError: 0, createdURLs: 0, revokedURLs: 0, decodes: 0, requests: [], sourceRenders: 0 };
async function test(name, callback) {
  const li = document.createElement('li');
  try { await callback(); li.className = 'pass'; li.textContent = `PASS — ${name}`; results.push({ name, passed: true }); }
  catch (error) { li.className = 'fail'; li.textContent = `FAIL — ${name}: ${error.message}`; results.push({ name, passed: false, error: error.message }); }
  document.getElementById('results').append(li);
}
async function waitFor(condition, label, timeout = 20000) {
  const deadline = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timeout: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
const frame = document.getElementById('app'), fft = new FFT(256);
let win, doc, originals;
const get = id => doc.getElementById(id);
const pixels = id => get(id).getContext('2d').getImageData(0, 0, 256, 256).data;
const settled = () => get('comparison').getAttribute('aria-busy') === 'false' && !get('upload-A').disabled;
const state = () => JSON.parse(get('comparison').dataset.parameters);
function change(id, value) {
  get(id).value = String(value);
  get(id).dispatchEvent(new win.Event(['cutoff', 'stripe-width'].includes(id) ? 'input' : 'change', { bubbles: true }));
}
async function choose(type, id, value) {
  change('mask-type', type); change(id, value);
  await waitFor(() => settled() && state().type === type && state()[{ cutoff: 'cutoff', quadrants: 'quadrants', 'stripe-width': 'stripeWidth' }[id]] === value, `${type}/${value}`);
}
function compareCurrent() {
  assert(!get('phase-mask').hidden && !get('reconstruction').hidden, 'Missing current outputs');
  const expected = partialPhaseSwapRGB(analyzeRGB(pixels('image-A'), fft), analyzeRGB(pixels('image-B'), fft), fft, state());
  const error = maxDifference(pixels('reconstruction'), displayPhaseSwap(expected.channels));
  const maskError = maxDifference(pixels('phase-mask'), displayPhaseMask(expected.mask, 256));
  metrics.displayedError = Math.max(metrics.displayedError, error); metrics.maskError = Math.max(metrics.maskError, maskError);
  assert(error === 0 && maskError === 0, `Displayed image/mask error ${error}/${maskError}`);
  assert(get('selected-fraction').textContent === `${(expected.stats.selectedFraction * 100).toFixed(2)}%`);
  assert(get('validation').textContent.includes('共軛遮罩檢查通過'));
}
async function fixture(name) {
  const response = await fetch(new URL(`./fixtures/${name}`, import.meta.url));
  assert(response.ok, `Missing fixture ${name}`);
  return new win.File([await response.blob()], name, { type: response.headers.get('content-type').split(';')[0] });
}
async function upload(slot, file) {
  const transfer = new win.DataTransfer(); if (file) transfer.items.add(file);
  get(`upload-${slot}`).files = transfer.files;
  get(`upload-${slot}`).dispatchEvent(new win.Event('change', { bubbles: true }));
  await waitFor(() => settled() && metrics.createdURLs === metrics.revokedURLs, `upload ${slot}`);
}
frame.src = new URL('../region-swap.html', import.meta.url).href;
await test('SVG 預設圖片、初始參數與完整重建一致', async () => {
  await waitFor(() => frame.contentDocument?.getElementById('comparison')?.dataset.parameters &&
    frame.contentDocument.getElementById('comparison').getAttribute('aria-busy') === 'false', 'startup');
  win = frame.contentWindow; doc = frame.contentDocument;
  assert(JSON.stringify(state()) === JSON.stringify(DEFAULT_PARAMETERS), 'Stale initial parameter state');
  assert(get('filename-A').textContent === 'Mountain lake' && get('filename-B').textContent === 'Coastal lighthouse');
  for (const [slot, name] of [['A', 'sample-a.svg'], ['B', 'sample-b.svg']]) {
    const prepared = await prepareImage(new URL(`../assets/${name}`, import.meta.url).href);
    assert(maxDifference(pixels(`image-${slot}`), prepared.rgba) === 0, `Default ${slot} pixels`);
    assert(get(`dimensions-${slot}`).textContent === `${prepared.width} × ${prepared.height}`);
  }
  compareCurrent();
  for (const slot of ['A', 'B']) {
    for (const [key, name] of [['sample-a.svg', 'Mountain lake'], ['sample-b.svg', 'Coastal lighthouse'], ['Monkey.jpg', 'Monkey.jpg'], ['Cat.jpg', 'Cat.jpg']]) {
      change(`sample-${slot}`, key);
      await waitFor(() => settled() && get(`filename-${slot}`).textContent === name, `sample ${slot}/${key}`);
      const path = key.endsWith('.svg') ? `../assets/${key}` : `../${key}`;
      const prepared = await prepareImage(new URL(path, import.meta.url).href);
      assert(maxDifference(pixels(`image-${slot}`), prepared.rgba) === 0);
      compareCurrent();
    }
    get(`reset-${slot}`).click();
    const name = slot === 'A' ? 'Mountain lake' : 'Coastal lighthouse';
    await waitFor(() => settled() && get(`filename-${slot}`).textContent === name, `reset ${slot}`);
  }
  originals = { create: win.URL.createObjectURL, revoke: win.URL.revokeObjectURL, decode: win.HTMLImageElement.prototype.decode,
    post: win.Worker.prototype.postMessage, put: win.CanvasRenderingContext2D.prototype.putImageData };
  win.URL.createObjectURL = file => { metrics.createdURLs++; return originals.create.call(win.URL, file); };
  win.URL.revokeObjectURL = url => { metrics.revokedURLs++; return originals.revoke.call(win.URL, url); };
  win.HTMLImageElement.prototype.decode = function (...args) { metrics.decodes++; return originals.decode.apply(this, args); };
  win.Worker.prototype.postMessage = function (data, ...args) { metrics.requests.push({ type: data.type, slot: data.slot }); return originals.post.call(this, data, ...args); };
  win.CanvasRenderingContext2D.prototype.putImageData = function (...args) {
    if (['image-A', 'image-B'].includes(this.canvas.id)) metrics.sourceRenders++;
    return originals.put.apply(this, args);
  };
});
await test('低頻圓盤 0.01 / 0.05 / 0.15 / 0.30 更新真實遮罩與重建', async () => {
  for (const cutoff of [0.01, 0.05, 0.15, 0.30]) {
    await choose('disk', 'cutoff', cutoff); assert(get('cutoff-value').value === cutoff.toFixed(2)); compareCurrent();
  }
});
await test('兩種象限配對與兩組皆選符合原生頻率索引', async () => {
  for (const pair of ['ul-lr', 'ur-ll', 'both']) { await choose('quadrants', 'quadrants', pair); compareCurrent(); }
});
await test('水平／垂直條紋 5 / 20 / 50；參數更新不重載來源', async () => {
  const outputs = new Set();
  for (const orientation of ['vertical', 'horizontal']) {
    change('orientation', orientation);
    for (const width of [5, 20, 50]) {
      await choose('stripes', 'stripe-width', width); assert(state().orientation === orientation); compareCurrent();
      outputs.add(Array.from(pixels('reconstruction').filter((_, i) => i % 131 === 0)).join(','));
    }
  }
  assert(outputs.size > 1, 'Parameter changes never changed reconstruction');
  assert(metrics.decodes === 0 && metrics.sourceRenders === 0 && metrics.requests.every(request => request.type === 'reconstruct'));
});
await test('PNG 與 JPEG 上傳共用裁切與縮放，兩張來源都可更換', async () => {
  for (const [slot, name] of [['A', 'rgb.png'], ['B', 'rgb.jpg']]) {
    await upload(slot, await fixture(name));
    const prepared = await prepareImage(new URL(`./fixtures/${name}`, import.meta.url).href);
    assert(maxDifference(pixels(`image-${slot}`), prepared.rgba) === 0, name);
    assert(get(`filename-${slot}`).textContent === name); compareCurrent();
  }
});
await test('損壞／不支援／取消上傳保留有效來源與結果並釋放 Blob URL', async () => {
  const before = pixels('image-A'), result = pixels('reconstruction');
  await upload('A', new win.File(['unsupported'], 'invalid.txt', { type: 'text/plain' }));
  assert(get('status').textContent.includes('PNG'));
  await upload('A', await fixture('broken.png')); assert(get('status').textContent.includes('無法解碼'));
  await upload('A', null);
  assert(maxDifference(before, pixels('image-A')) === 0 && maxDifference(result, pixels('reconstruction')) === 0);
  assert(metrics.createdURLs === metrics.revokedURLs); compareCurrent();
});
await test('連續參數只顯示最新狀態；運算中還原圖片與再調參可恢復', async () => {
  const start = metrics.requests.length;
  for (let width = 1; width <= 60; width++) change('stripe-width', width);
  await waitFor(() => settled() && state().stripeWidth === 60, 'latest parameter revision');
  const burst = metrics.requests.slice(start); assert(burst.length <= 2 && burst.every(request => request.type === 'reconstruct'), `Queued ${burst.length} requests`);
  metrics.burstRequests = burst.length; compareCurrent();
  change('stripe-width', 5); get('reset-A').click(); change('stripe-width', 20);
  await waitFor(() => settled() && get('filename-A').textContent === 'Mountain lake' && state().stripeWidth === 20, 'source revision');
  get('reset-B').click(); await waitFor(() => settled() && get('filename-B').textContent === 'Coastal lighthouse', 'reset B');
  compareCurrent(); assert(metrics.createdURLs === metrics.revokedURLs);
});
await test('1040 / 390 / 320px 無橫向溢出，三種控制與四頁導航可操作', async () => {
  for (const width of [1040, 390, 320]) {
    frame.style.width = `${width}px`;
    await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
    assert(doc.documentElement.scrollWidth <= width, `Overflow ${width}: ${doc.documentElement.scrollWidth}`);
    for (const [type, id] of [['disk', 'cutoff'], ['quadrants', 'quadrants'], ['stripes', 'stripe-width']]) {
      change('mask-type', type); await waitFor(() => settled() && state().type === type, `mobile ${type}`);
      for (const control of [get('mask-type'), get(id)]) {
        const box = control.getBoundingClientRect(); assert(box.width > 0 && box.left >= 0 && box.right <= width && !control.disabled, `${id} outside ${width}`);
      }
    }
    for (const link of doc.querySelectorAll('.page-nav a')) {
      const box = link.getBoundingClientRect(); assert(box.width > 0 && box.left >= 0 && box.right <= width, `Navigation outside ${width}`);
    }
  }
  assert(doc.querySelectorAll('.page-nav a').length === 4);
  const base = new URL('../', import.meta.url).href;
  assert(win.performance.getEntriesByType('resource').every(entry => entry.name.startsWith(base) || entry.name.startsWith('blob:')));
  frame.style.width = '1040px'; compareCurrent();
});
if (originals) {
  win.URL.createObjectURL = originals.create; win.URL.revokeObjectURL = originals.revoke;
  win.HTMLImageElement.prototype.decode = originals.decode; win.Worker.prototype.postMessage = originals.post;
  win.CanvasRenderingContext2D.prototype.putImageData = originals.put;
}
const passed = results.filter(result => result.passed).length;
document.getElementById('summary').textContent = `${passed}/${results.length} 通過，${results.length - passed} 失敗`;
document.getElementById('metrics').textContent = JSON.stringify({ browser: navigator.userAgent, metrics, results }, null, 2);
const rerun = document.getElementById('rerun'); rerun.disabled = false; rerun.onclick = () => location.reload();
