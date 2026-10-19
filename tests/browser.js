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
frame.src = new URL('../index.html', import.meta.url).href;
await waitFor(() => frame.contentDocument?.getElementById('swap-button')?.disabled === false, 'app initialization');
const win = frame.contentWindow, doc = frame.contentDocument;
const get = id => doc.getElementById(id);
const canvasPixels = id => get(id).getContext('2d').getImageData(0, 0, 256, 256).data;
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
await test('實際頁面：預設兩張不同圖片自動完成', () => {
  assert(get('filename-A').textContent === 'Mountain lake' && get('filename-B').textContent === 'Coastal lighthouse');
  assert(maxDifference(canvasPixels('image-A'), canvasPixels('image-B')) > 0);
  assert(!get('result-AB').hidden && !get('result-BA').hidden);
  assert(get('status').textContent.includes('交換完成'));
});
await test('上傳 PNG／JPEG／WebP：同圖結果與畫面來源逐像素相同', async () => {
  for (const file of ['rgb.png', 'rgb.jpg', 'rgb.webp']) {
    await upload('A', file); await upload('B', file);
    const expected = decoded[file].rgba;
    for (const id of ['image-A', 'image-B', 'result-AB', 'result-BA']) assert(maxDifference(canvasPixels(id), expected) === 0, `${file}/${id}`);
    assert(get('stats-AB').textContent === '裁切 0.0%');
  }
});
await test('純黑／純白、拖放與重複 Swap 保留預期亮度', async () => {
  await upload('A', 'black.png', 'drop'); await upload('B', 'white.png');
  assert(maxDifference(canvasPixels('result-AB'), decoded['black.png'].rgba) === 0);
  assert(maxDifference(canvasPixels('result-BA'), decoded['white.png'].rgba) === 0);
  for (let i = 0; i < 3; i++) { get('swap-button').click(); await waitFor(() => !get('swap-button').disabled, 'repeat swap'); }
  assert(maxDifference(canvasPixels('result-BA'), decoded['white.png'].rgba) === 0);
});
await test('損壞圖片與取消選擇保留現有結果；釋放 Blob URL', async () => {
  const before = canvasPixels('result-BA');
  await upload('A', 'broken.png');
  assert(get('status').textContent.includes('無法解碼'));
  assert(maxDifference(canvasPixels('result-BA'), before) === 0);
  const input = get('upload-A'); input.value = ''; input.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert(!get('swap-button').disabled);
  assert(metrics.blobURLsCreated === metrics.blobURLsRevoked);
});
await test('回歸測試：建立 Blob URL 拋錯後，操作仍恢復可用', async () => {
  const original = win.URL.createObjectURL;
  win.URL.createObjectURL = () => { throw new Error('Injected object URL failure'); };
  try {
    await upload('A', 'rgb.png');
    assert(get('status').textContent.includes('Injected object URL failure'));
    assert(!get('swap-button').disabled && !get('upload-A').disabled);
  } finally { win.URL.createObjectURL = original; }
});
await test('Worker postMessage 拋錯後可重試；不破壞既有結果', async () => {
  const original = win.Worker.prototype.postMessage;
  win.Worker.prototype.postMessage = () => { throw new Error('Injected postMessage failure'); };
  try {
    get('swap-button').click();
    await waitFor(() => !get('swap-button').disabled, 'postMessage recovery');
    assert(get('status').textContent.includes('Injected postMessage failure'));
  } finally { win.Worker.prototype.postMessage = original; }
  get('swap-button').click(); await waitFor(() => !get('swap-button').disabled, 'retry');
  assert(get('status').textContent.includes('交換完成'));
});
win.URL.createObjectURL = createURL; win.URL.revokeObjectURL = revokeURL;

const passed = results.filter(result => result.passed).length;
document.getElementById('summary').textContent = `${passed}/${results.length} 通過，${results.length - passed} 失敗`;
document.getElementById('metrics').textContent = JSON.stringify({ browser: navigator.userAgent, metrics, results }, null, 2);
const rerun = document.getElementById('rerun'); rerun.disabled = false; rerun.onclick = () => location.reload();
