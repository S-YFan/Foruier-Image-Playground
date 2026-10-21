import { prepareImage } from '../js/image.js';
import { FFT, fft2 } from '../js/fft.js';
import { analyzeRGB, reconstructChannel, reconstructRGB } from '../js/fourier.js';
import { maxDifference } from './test-data.js';

const assert = (condition, message = 'Assertion failed') => { if (!condition) throw new Error(message); };
const metrics = { decodedRoundTrip: 0, decodedOwnPhase: 0, maxImaginary: 0, displayedSameImageError: 0, blobURLsCreated: 0, blobURLsRevoked: 0 };
const results = [];
const fft = new FFT(256);
async function test(name, callback) {
  const li = document.createElement('li');
  try { await callback(); li.textContent = `PASS — ${name}`; li.className = 'pass'; results.push({ name, passed: true }); }
  catch (error) { li.textContent = `FAIL — ${name}: ${error.message}`; li.className = 'fail'; results.push({ name, passed: false, error: error.message }); }
  document.getElementById('results').append(li);
}
async function waitFor(condition, label, timeout = 15000) {
  const deadline = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timeout: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
const decoded = {};
for (const file of ['black.png', 'white.png', 'gray.png', 'rgb.png', 'rgb.jpg', 'rgb.webp', 'wide.png', 'tall.png', 'odd.png', 'alpha.png']) {
  await test(`真實解碼與同圖 FFT / 振幅相位重建：${file}`, async () => {
    const image = await prepareImage(new URL(`./fixtures/${file}`, import.meta.url).href);
    decoded[file] = image;
    assert(image.rgba.length === 256 * 256 * 4);
    const spectrum = analyzeRGB(image.rgba, fft);
    for (let c = 0; c < 3; c++) {
      const original = Float64Array.from({ length: 65536 }, (_, i) => image.rgba[4 * i + c]);
      const real = original.slice(), imag = new Float64Array(65536);
      fft2(real, imag, fft); fft2(real, imag, fft, true);
      metrics.decodedRoundTrip = Math.max(metrics.decodedRoundTrip, maxDifference(real, original));
      const own = reconstructChannel(spectrum[c].magnitude, spectrum[c].phase, fft);
      metrics.decodedOwnPhase = Math.max(metrics.decodedOwnPhase, maxDifference(own.real, original));
      metrics.maxImaginary = Math.max(metrics.maxImaginary, maxDifference(own.imag, new Float64Array(65536)));
    }
    const result = reconstructRGB(spectrum, spectrum, fft);
    const error = maxDifference(result.rgba, image.rgba);
    metrics.displayedSameImageError = Math.max(metrics.displayedSameImageError, error);
    assert(error === 0 && result.stats.clippedFraction === 0, 'Same-image displayed pixels differ');
    assert(metrics.decodedRoundTrip < 1e-8 && metrics.decodedOwnPhase < 1e-8);
  });
}
await test('寬圖／高圖／奇數邊界裁切，包含全部邊緣像素', () => {
  const dimensions = { 'wide.png': [96, 32], 'tall.png': [32, 96], 'odd.png': [33, 32] };
  for (const [file, [width, height]] of Object.entries(dimensions)) {
    const data = decoded[file].rgba;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      assert(data[i] === 20 && data[i + 1] === 160 && data[i + 2] === 70, file);
    }
    assert(decoded[file].width === width && decoded[file].height === height);
  }
});
await test('透明 PNG 以白底合成，alpha 固定為 255', () => {
  const expected = [20, 100, 220].map(v => Math.round(v * 128 / 255 + 255 * 127 / 255));
  const data = decoded['alpha.png'].rgba;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) assert(Math.abs(data[i + c] - expected[c]) <= 1);
    assert(data[i + 3] === 255);
  }
});
await test('灰階解碼後三通道相等；PNG／lossless WebP 內容一致', () => {
  const gray = decoded['gray.png'].rgba;
  for (let i = 0; i < gray.length; i += 4) assert(gray[i] === gray[i + 1] && gray[i] === gray[i + 2]);
  assert(maxDifference(decoded['rgb.png'].rgba, decoded['rgb.webp'].rgba) === 0);
});

const worker = new Worker(new URL('../js/worker.js', import.meta.url), { type: 'module' });
let nextID = 0;
const jobs = new Map();
worker.onmessage = ({ data }) => {
  const job = jobs.get(data.id);
  if (job) { clearTimeout(job.timer); jobs.delete(data.id); data.error ? job.reject(new Error(data.error)) : job.resolve(data.result); }
};
function rpc(type, payload = {}, transfer = []) {
  return new Promise((resolve, reject) => {
    const id = ++nextID;
    const timer = setTimeout(() => { jobs.delete(id); reject(new Error('Worker timeout')); }, 10000);
    jobs.set(id, { resolve, reject, timer });
    worker.postMessage({ id, type, ...payload }, transfer);
  });
}
await test('真實 Web Worker：圖片解碼後的兩方向結果與直接核心一致', async () => {
  const a = decoded['rgb.jpg'].rgba.slice(), b = decoded['gray.png'].rgba.slice();
  await rpc('image', { slot: 'A', rgba: a }, [a.buffer]);
  assert(a.byteLength === 0, 'Transferred input must detach');
  await rpc('image', { slot: 'B', rgba: b }, [b.buffer]);
  const result = await rpc('swap');
  const sa = analyzeRGB(decoded['rgb.jpg'].rgba, fft), sb = analyzeRGB(decoded['gray.png'].rgba, fft);
  assert(maxDifference(result.first.rgba, reconstructRGB(sa, sb, fft).rgba) === 0);
  assert(maxDifference(result.second.rgba, reconstructRGB(sb, sa, fft).rgba) === 0);
  metrics.maxImaginary = Math.max(metrics.maxImaginary, result.first.stats.maxImaginary, result.second.stats.maxImaginary);
});
worker.terminate();

const frame = document.getElementById('app');
frame.src = new URL('../phase-swap.html', import.meta.url).href;
await waitFor(() => {
  const app = frame.contentDocument;
  return app?.getElementById('result-AB')?.hidden === false
    && app.getElementById('result-BA')?.hidden === false
    && !app.body.classList.contains('is-busy')
    && app.getElementById('upload-A')?.disabled === false
    && app.getElementById('sample-B')?.disabled === false;
}, 'automatic app initialization');
const win = frame.contentWindow, doc = frame.contentDocument;
const get = id => doc.getElementById(id);
const canvasPixels = id => get(id).getContext('2d').getImageData(0, 0, 256, 256).data;
const controlsReady = () => ['upload-A', 'upload-B', 'sample-A', 'sample-B'].every(id => !get(id).disabled);
function assertAutomaticReconstruction() {
  const a = analyzeRGB(canvasPixels('image-A'), fft), b = analyzeRGB(canvasPixels('image-B'), fft);
  assert(!get('result-AB').hidden && !get('result-BA').hidden);
  assert(maxDifference(canvasPixels('result-AB'), reconstructRGB(a, b, fft).rgba) === 0, 'Automatic A magnitude + B phase differs');
  assert(maxDifference(canvasPixels('result-BA'), reconstructRGB(b, a, fft).rgba) === 0, 'Automatic B magnitude + A phase differs');
}
const createURL = win.URL.createObjectURL.bind(win.URL), revokeURL = win.URL.revokeObjectURL.bind(win.URL);
win.URL.createObjectURL = file => { metrics.blobURLsCreated++; return createURL(file); };
win.URL.revokeObjectURL = url => { metrics.blobURLsRevoked++; revokeURL(url); };
async function upload(slot, fileName, eventType = 'change') {
  const response = await fetch(new URL(`./fixtures/${fileName}`, import.meta.url));
  const blob = await response.blob();
  const file = new win.File([blob], fileName, { type: blob.type });
  const transfer = new win.DataTransfer(); transfer.items.add(file);
  if (eventType === 'drop') get(`card-${slot}`).dispatchEvent(new win.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  else {
    const input = get(`upload-${slot}`); input.files = transfer.files;
    input.dispatchEvent(new win.Event('change', { bubbles: true }));
  }
  await waitFor(() => !doc.body.classList.contains('is-busy'), `upload ${fileName}`);
}
await test('實際頁面：預設兩張不同圖片自動完成，四張範例皆可切換', async () => {
  assert(!get('swap-button'), 'Redundant Swap phases button must be removed');
  assert(get('filename-A').textContent === 'Mountain lake' && get('filename-B').textContent === 'Coastal lighthouse');
  assert(maxDifference(canvasPixels('image-A'), canvasPixels('image-B')) > 0);
  assert(!get('result-AB').hidden && !get('result-BA').hidden);
  assert(get('status').textContent.includes('Swap complete'));
  assertAutomaticReconstruction();
  for (const slot of ['A', 'B']) {
    for (const [key, name] of [['sample-a.svg', 'Mountain lake'], ['sample-b.svg', 'Coastal lighthouse'], ['Monkey.jpg', 'Monkey.jpg'], ['Cat.jpg', 'Cat.jpg']]) {
      get(`sample-${slot}`).value = key;
      get(`sample-${slot}`).dispatchEvent(new win.Event('change', { bubbles: true }));
      await waitFor(() => !doc.body.classList.contains('is-busy'), `sample ${slot}/${key}`);
      assert(get(`filename-${slot}`).textContent === name);
      assertAutomaticReconstruction();
    }
  }
});
await test('上傳 PNG／JPEG／WebP：同圖結果與畫面來源逐像素相同', async () => {
  for (const file of ['rgb.png', 'rgb.jpg', 'rgb.webp']) {
    await upload('A', file); await upload('B', file);
    const expected = decoded[file].rgba;
    for (const id of ['image-A', 'image-B', 'result-AB', 'result-BA']) assert(maxDifference(canvasPixels(id), expected) === 0, `${file}/${id}`);
    assert(get('stats-AB').textContent === 'Clipped 0.0%');
  }
});
await test('純黑／純白、拖放與重複上傳皆自動重建並保留預期亮度', async () => {
  await upload('A', 'black.png', 'drop'); await upload('B', 'white.png');
  assert(maxDifference(canvasPixels('result-AB'), decoded['black.png'].rgba) === 0);
  assert(maxDifference(canvasPixels('result-BA'), decoded['white.png'].rgba) === 0);
  for (let i = 0; i < 3; i++) {
    await upload('A', 'black.png', i % 2 === 0 ? 'drop' : 'change');
    await upload('B', 'white.png');
    assert(maxDifference(canvasPixels('result-AB'), decoded['black.png'].rgba) === 0);
    assert(maxDifference(canvasPixels('result-BA'), decoded['white.png'].rgba) === 0);
    assert(get('status').textContent.includes('Swap complete') && controlsReady());
  }
});
await test('損壞圖片與取消選擇保留現有結果；釋放 Blob URL', async () => {
  const before = canvasPixels('result-BA');
  await upload('A', 'broken.png');
  assert(get('status').textContent.includes('Unable to decode'));
  assert(maxDifference(canvasPixels('result-BA'), before) === 0);
  const input = get('upload-A'); input.value = ''; input.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert(controlsReady() && !doc.body.classList.contains('is-busy'));
  assert(metrics.blobURLsCreated === metrics.blobURLsRevoked);
});
await test('回歸測試：建立 Blob URL 拋錯後，操作仍恢復可用', async () => {
  const original = win.URL.createObjectURL;
  win.URL.createObjectURL = () => { throw new Error('Injected object URL failure'); };
  try {
    await upload('A', 'rgb.png');
    assert(get('status').textContent.includes('Injected object URL failure'));
    assert(controlsReady() && !doc.body.classList.contains('is-busy'));
  } finally { win.URL.createObjectURL = original; }
});
await test('Worker postMessage 拋錯後可重試；不破壞既有結果', async () => {
  const before = Object.fromEntries(['image-A', 'image-B', 'result-AB', 'result-BA'].map(id => [id, canvasPixels(id)]));
  const original = win.Worker.prototype.postMessage;
  win.Worker.prototype.postMessage = () => { throw new Error('Injected postMessage failure'); };
  try {
    await upload('A', 'rgb.png');
    assert(get('status').textContent.includes('Injected postMessage failure'));
    assert(controlsReady() && !doc.body.classList.contains('is-busy'));
    for (const [id, pixels] of Object.entries(before)) {
      assert(!get(id).hidden && maxDifference(canvasPixels(id), pixels) === 0, `Failed postMessage changed ${id}`);
    }
  } finally { win.Worker.prototype.postMessage = original; }
  await upload('A', 'rgb.png');
  assert(get('status').textContent.includes('Swap complete'));
  assert(maxDifference(canvasPixels('image-A'), decoded['rgb.png'].rgba) === 0);
  assertAutomaticReconstruction();
  assert(metrics.blobURLsCreated === metrics.blobURLsRevoked);
});
await test('001 響應式操作：375/390 控制與重建同屏，768/1280 保留桌面比較', async () => {
  const originalStyle = frame.getAttribute('style');
  const originalNodes = Object.fromEntries(['A', 'B'].map(slot => [slot, {
    select: get(`sample-${slot}`),
    input: get(`upload-${slot}`),
    label: doc.querySelector(`.upload-label[for="upload-${slot}"]`),
  }]));
  const resultNodes = [get('result-AB'), get('result-BA')];
  try {
    for (const width of [375, 390, 768, 1280]) {
      frame.style.cssText = `width:${width}px;height:812px;border:0;max-width:none`;
      await waitFor(() => win.innerWidth === width, `viewport ${width}`);
      await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
      const mobile = width <= 760, panel = get('mobile-source-controls');
      await waitFor(() => panel.hidden === !mobile, `responsive controls ${width}`);
      assert(doc.documentElement.scrollWidth <= win.innerWidth + 1, `${width}: unexpected horizontal scrolling`);
      for (const slot of ['A', 'B']) {
        const { select, input, label } = originalNodes[slot];
        assert(get(`sample-${slot}`) === select && get(`upload-${slot}`) === input, `${width}: controls were duplicated`);
        assert(doc.querySelectorAll(`#sample-${slot}`).length === 1 && doc.querySelectorAll(`#upload-${slot}`).length === 1);
        assert(doc.querySelectorAll(`.upload-label[for="upload-${slot}"]`).length === 1);
        assert(label.control === input, `${width}: upload label lost its input`);
        const home = mobile ? get(`mobile-control-${slot}`) : get(`card-${slot}`);
        assert(home.contains(select) && home.contains(label), `${width}: source controls are in the wrong location`);
      }
      for (const id of ['image-A', 'image-B', 'result-AB', 'result-BA']) {
        const canvas = get(id), rect = canvas.getBoundingClientRect(), surface = canvas.parentElement.getBoundingClientRect();
        assert(rect.width > 0 && rect.height > 0, `${width}: ${id} is not visible`);
        assert(rect.left >= surface.left - 1 && rect.right <= surface.right + 1
          && rect.top >= surface.top - 1 && rect.bottom <= surface.bottom + 1, `${width}: ${id} exceeds its container`);
      }
      assert(get('result-AB') === resultNodes[0] && get('result-BA') === resultNodes[1], `${width}: result canvases were replaced`);
      const ab = get('result-AB').getBoundingClientRect(), ba = get('result-BA').getBoundingClientRect();
      if (mobile) {
        assert(ba.top > ab.bottom, `${width}: results need a full-width single column`);
        panel.scrollIntoView({ block: 'start' });
        const controlsRect = panel.getBoundingClientRect(), resultRect = get('result-AB').getBoundingClientRect();
        assert(controlsRect.top >= -1 && controlsRect.bottom <= win.innerHeight
          && resultRect.top >= 0 && resultRect.bottom <= win.innerHeight, `${width}: source controls and reconstruction cannot be viewed together`);
        assert(resultRect.width >= 240, `${width}: reconstruction is too small to inspect`);
        if (width === 375) {
          get('sample-B').value = 'sample-a.svg';
          get('sample-B').dispatchEvent(new win.Event('change', { bubbles: true }));
          await waitFor(() => !doc.body.classList.contains('is-busy'), 'mobile sample auto reconstruction');
          assert(get('filename-B').textContent === 'Mountain lake' && controlsReady());
        } else {
          await upload('A', 'rgb.png');
          assert(get('filename-A').textContent === 'rgb.png' && controlsReady());
        }
        assertAutomaticReconstruction();
      } else {
        assert(Math.abs(ab.top - ba.top) < 1 && ba.left >= ab.right, `${width}: desktop results should remain side by side`);
      }
    }
  } finally {
    if (originalStyle === null) frame.removeAttribute('style');
    else frame.setAttribute('style', originalStyle);
    win.scrollTo(0, 0);
  }
});
win.URL.createObjectURL = createURL; win.URL.revokeObjectURL = revokeURL;

const passed = results.filter(result => result.passed).length;
document.getElementById('summary').textContent = `${passed}/${results.length} 通過，${results.length - passed} 失敗`;
document.getElementById('metrics').textContent = JSON.stringify({ browser: navigator.userAgent, metrics, results }, null, 2);
const rerun = document.getElementById('rerun'); rerun.disabled = false; rerun.onclick = () => location.reload();
