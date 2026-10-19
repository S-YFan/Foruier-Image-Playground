import { FFT } from '../js/fft.js';
import { analyzeRGB } from '../js/fourier.js';
import { prepareImage } from '../js/image.js';
import { filterRGB, displayFilteredRGB } from '../js/filtering.js';
import { maxDifference } from './test-data.js';

const assert = (condition, message = 'Assertion failed') => { if (!condition) throw new Error(message); };
const results = [], metrics = {
  displayedError: 0, createdURLs: 0, revokedURLs: 0, decodes: 0, requests: [],
  renders: Object.fromEntries(['original', 'original-sharpen', 'lpf', 'hpf', 'sharpen'].map(id => [id, 0])),
};
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
const frame = document.getElementById('app');
frame.src = new URL('../filtering.html', import.meta.url).href;
await waitFor(() => frame.contentDocument?.getElementById('pass-results')?.dataset.sigma === '30' &&
  frame.contentDocument?.getElementById('sharpen-results')?.dataset.sigma === '30' &&
  frame.contentDocument?.getElementById('results')?.getAttribute('aria-busy') === 'false', 'default filtering');
const win = frame.contentWindow, doc = frame.contentDocument;
const get = id => doc.getElementById(id);
const pixels = id => get(id).getContext('2d').getImageData(0, 0, 256, 256).data;
const settled = () => get('results').getAttribute('aria-busy') === 'false' && !get('example').disabled;
function input(id, value) {
  get(id).value = String(value);
  get(id).dispatchEvent(new win.Event('input', { bubbles: true }));
}
async function select(name) {
  get('example').value = name;
  get('example').dispatchEvent(new win.Event('change', { bubbles: true }));
  await waitFor(settled, `select ${name}`);
}
function compareCurrent() {
  const fft = new FFT(256);
  const spectrum = analyzeRGB(pixels('original'), fft);
  const expected = {
    ...filterRGB(spectrum, fft, { sigma: Number(get('sigma').value), filters: ['lpf', 'hpf'] }),
    ...filterRGB(spectrum, fft, {
      sigma: Number(get('sharpen-sigma').value), alpha: Number(get('alpha').value), filters: ['sharpen'],
    }),
  };
  assert(!get('original-sharpen').hidden);
  assert(maxDifference(pixels('original'), pixels('original-sharpen')) === 0, 'Original previews differ');
  assert(get('dimensions').textContent === get('sharpen-dimensions').textContent);
  for (const type of ['lpf', 'hpf', 'sharpen']) {
    assert(!get(type).hidden, `${type} hidden`);
    const error = maxDifference(pixels(type), displayFilteredRGB(expected[type], type));
    metrics.displayedError = Math.max(metrics.displayedError, error);
    assert(error === 0, `${type}: ${error}`);
  }
}
const createURL = win.URL.createObjectURL.bind(win.URL), revokeURL = win.URL.revokeObjectURL.bind(win.URL);
win.URL.createObjectURL = file => { metrics.createdURLs++; return createURL(file); };
win.URL.revokeObjectURL = url => { metrics.revokedURLs++; return revokeURL(url); };
const decode = win.HTMLImageElement.prototype.decode;
win.HTMLImageElement.prototype.decode = function (...args) { metrics.decodes++; return decode.apply(this, args); };
const postMessage = win.Worker.prototype.postMessage;
win.Worker.prototype.postMessage = function (data, ...args) {
  metrics.requests.push({ type: data.type, group: data.group, sigma: data.sigma, alpha: data.alpha });
  return postMessage.call(this, data, ...args);
};
const putImageData = win.CanvasRenderingContext2D.prototype.putImageData;
win.CanvasRenderingContext2D.prototype.putImageData = function (...args) {
  if (Object.hasOwn(metrics.renders, this.canvas.id)) metrics.renders[this.canvas.id]++;
  return putImageData.apply(this, args);
};
async function upload(file) {
  const transfer = new win.DataTransfer();
  if (file) transfer.items.add(file);
  get('upload').files = transfer.files;
  get('upload').dispatchEvent(new win.Event('change', { bubbles: true }));
  await waitFor(settled, 'upload');
}
async function fixture(name) {
  const response = await fetch(new URL(`./fixtures/${name}`, import.meta.url));
  return new win.File([await response.blob()], name, { type: response.headers.get('content-type') });
}

await test('Monkey 預設照片、原始尺寸與三個實際 IFFT 結果', async () => {
  assert(get('filename').textContent === 'Monkey.jpg');
  assert(get('sigma').value === '30' && get('sharpen-sigma').value === '30' && get('alpha').value === '1');
  assert(get('sigma').closest('section') !== get('alpha').closest('section'));
  assert(!get('sigma').closest('section').querySelector('#alpha'));
  assert(get('sharpen-sigma').closest('section') === get('alpha').closest('section'));
  assert(get('sigma').labels[0].textContent.includes('Sigma (σ₁)'));
  assert(get('sharpen-sigma').labels[0].textContent.includes('Sigma (σ₂)'));
  assert(get('alpha').labels[0].textContent.includes('Alpha (α)'));
  assert(get('sharpen').getAttribute('aria-describedby').includes('sharpen-sigma-scope'));
  assert(Array.from(get('pass-results').querySelectorAll('canvas')).map(canvas => canvas.id).join() === 'original,lpf,hpf');
  assert(Array.from(get('sharpen-results').querySelectorAll('canvas')).map(canvas => canvas.id).join() === 'original-sharpen,sharpen');
  const image = await prepareImage(new URL('../Monkey.jpg', import.meta.url).href);
  assert(maxDifference(pixels('original'), image.rgba) === 0);
  assert(get('dimensions').textContent === `${image.width} × ${image.height}`);
  metrics.monkeyDimensions = [image.width, image.height];
  compareCurrent();
});
await test('Cat 範例切換、保留原始比例的裁切與重建', async () => {
  const before = pixels('original');
  const decodesBefore = metrics.decodes, requestsBefore = metrics.requests.length;
  await select('Cat.jpg');
  assert(metrics.decodes === decodesBefore + 1, 'both previews must share one decode');
  const requests = metrics.requests.slice(requestsBefore);
  assert(requests.filter(request => request.type === 'image').length === 1, 'one source FFT request');
  assert(requests.filter(request => request.type === 'filter').map(request => request.group).sort().join() === 'pass,sharpen');
  const image = await prepareImage(new URL('../Cat.jpg', import.meta.url).href);
  assert(get('filename').textContent === 'Cat.jpg');
  assert(maxDifference(before, pixels('original')) > 0);
  assert(maxDifference(pixels('original'), image.rgba) === 0);
  metrics.catDimensions = [image.width, image.height];
  compareCurrent();
});
await test('alpha = 0 精確重現來源；alpha 只影響 Sharpening', async () => {
  const low = pixels('lpf'), high = pixels('hpf');
  const requestsBefore = metrics.requests.length, decodesBefore = metrics.decodes, renders = { ...metrics.renders };
  input('alpha', 0);
  await waitFor(settled, 'alpha zero');
  assert(maxDifference(pixels('original'), pixels('sharpen')) === 0);
  assert(maxDifference(low, pixels('lpf')) === 0 && maxDifference(high, pixels('hpf')) === 0);
  input('alpha', 3);
  await waitFor(settled, 'alpha boost');
  assert(maxDifference(pixels('original'), pixels('sharpen')) > 0);
  assert(maxDifference(low, pixels('lpf')) === 0 && maxDifference(high, pixels('hpf')) === 0);
  assert(get('alpha-value').value === '3.0');
  assert(metrics.requests.slice(requestsBefore).every(request => request.type === 'filter' && request.group === 'sharpen'));
  assert(metrics.decodes === decodesBefore && metrics.renders.lpf === renders.lpf && metrics.renders.hpf === renders.hpf);
  assert(metrics.renders.original === renders.original && metrics.renders['original-sharpen'] === renders['original-sharpen']);
  compareCurrent();
});
await test('LPF / HPF Sigma 僅更新低／高通，Sharpening Sigma 與結果不變', async () => {
  const sharp = pixels('sharpen'), sharpSigma = get('sharpen-sigma').value;
  const requestsBefore = metrics.requests.length, renders = { ...metrics.renders }, decodesBefore = metrics.decodes;
  input('sigma', 1); await waitFor(settled, 'sigma minimum');
  const before = Object.fromEntries(['lpf', 'hpf'].map(type => [type, pixels(type)]));
  compareCurrent();
  input('sigma', 200); await waitFor(settled, 'sigma maximum');
  for (const type of ['lpf', 'hpf']) assert(maxDifference(before[type], pixels(type)) > 0, `${type} must respond to sigma1`);
  assert(maxDifference(sharp, pixels('sharpen')) === 0 && get('sharpen-sigma').value === sharpSigma);
  assert(metrics.requests.slice(requestsBefore).every(request => request.type === 'filter' && request.group === 'pass'));
  assert(metrics.renders.sharpen === renders.sharpen && metrics.decodes === decodesBefore);
  assert(get('sigma-value').value === '200');
  compareCurrent();
});
await test('Sharpening Sigma 僅更新 Sharpening，LPF / HPF Sigma 與結果不變', async () => {
  const low = pixels('lpf'), high = pixels('hpf'), sigma = get('sigma').value;
  const requestsBefore = metrics.requests.length, renders = { ...metrics.renders }, decodesBefore = metrics.decodes;
  input('sharpen-sigma', 1); await waitFor(settled, 'sharpen sigma minimum');
  const before = pixels('sharpen'); compareCurrent();
  input('sharpen-sigma', 80); await waitFor(settled, 'sharpen sigma update');
  assert(maxDifference(before, pixels('sharpen')) > 0);
  assert(maxDifference(low, pixels('lpf')) === 0 && maxDifference(high, pixels('hpf')) === 0);
  assert(get('sigma').value === sigma && get('sigma').value !== get('sharpen-sigma').value);
  assert(get('sharpen-sigma-value').value === '80');
  assert(metrics.requests.slice(requestsBefore).every(request => request.type === 'filter' && request.group === 'sharpen'));
  assert(metrics.renders.lpf === renders.lpf && metrics.renders.hpf === renders.hpf && metrics.decodes === decodesBefore);
  compareCurrent();
});
await test('連續滑桿輸入只保留最新目標，不排隊過期結果', async () => {
  const post = win.Worker.prototype.postMessage;
  let requests = 0;
  win.Worker.prototype.postMessage = function (data, ...rest) {
    if (data.type === 'filter') requests++;
    return post.call(this, data, ...rest);
  };
  try {
    for (let i = 10; i <= 50; i++) { input('sigma', i); input('sharpen-sigma', i + 40); input('alpha', (i % 31) / 10); }
    await waitFor(settled, 'latest sliders');
    assert(get('pass-results').dataset.sigma === '50' && get('sharpen-results').dataset.sigma === '90' &&
      get('sharpen-results').dataset.alpha === '1.9');
    assert(requests <= 3, `queued ${requests} requests`);
    metrics.burstRequests = requests;
    compareCurrent();
  } finally { win.Worker.prototype.postMessage = post; }
});
await test('另一區的輸入不使進行中的重建失效，兩區各運算一次', async () => {
  const start = metrics.requests.length, renders = { ...metrics.renders };
  input('sigma', 61); input('sharpen-sigma', 83); input('alpha', 1.3);
  await waitFor(settled, 'independent in-flight revisions');
  const requests = metrics.requests.slice(start);
  assert(requests.length === 2 && requests.map(request => request.group).sort().join() === 'pass,sharpen');
  for (const type of ['lpf', 'hpf', 'sharpen']) assert(metrics.renders[type] === renders[type] + 1, type);
  compareCurrent();
});
await test('濾波期間更換來源與參數，不顯示前一張照片的過期結果', async () => {
  input('sigma', 40);
  get('example').value = 'Monkey.jpg';
  get('example').dispatchEvent(new win.Event('change', { bubbles: true }));
  input('sigma', 60); input('sharpen-sigma', 70); input('alpha', 1);
  await waitFor(settled, 'source race');
  assert(get('filename').textContent === 'Monkey.jpg');
  assert(get('pass-results').dataset.sigma === '60' && get('sharpen-results').dataset.sigma === '70');
  compareCurrent();
});
await test('PNG / JPEG / WebP、長寬圖與透明圖片沿用共同前處理', async () => {
  for (const name of ['rgb.png', 'rgb.jpg', 'rgb.webp', 'wide.png', 'tall.png', 'alpha.png']) {
    await upload(await fixture(name));
    const image = await prepareImage(new URL(`./fixtures/${name}`, import.meta.url).href);
    assert(maxDifference(pixels('original'), image.rgba) === 0, name);
    assert(get('filename').textContent === name && get('example').value === 'upload');
    compareCurrent();
  }
});
await test('常數圖片的 HPF 為灰色 128；Sharpening 保留來源亮度', async () => {
  for (const name of ['black.png', 'white.png']) {
    await upload(await fixture(name));
    assert(pixels('hpf').every((value, i) => value === (i % 4 === 3 ? 255 : 128)), name);
    assert(maxDifference(pixels('original'), pixels('sharpen')) === 0, name);
  }
});
await test('格式／大小／損壞圖片與取消選擇保留來源，Blob URL 均釋放', async () => {
  const original = pixels('original'), result = pixels('sharpen');
  await upload(new win.File(['text'], 'bad.txt', { type: 'text/plain' }));
  assert(get('status').textContent.includes('PNG'));
  await upload(new win.File([new Uint8Array(25 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
  assert(get('status').textContent.includes('25 MB'));
  await upload(await fixture('broken.png'));
  assert(get('status').textContent.includes('無法解碼'));
  await upload(null);
  assert(maxDifference(original, pixels('original')) === 0 && maxDifference(result, pixels('sharpen')) === 0);
  assert(metrics.createdURLs === metrics.revokedURLs);
  const broken = await fixture('broken.png');
  const recovery = upload(broken);
  input('sigma', 55); input('alpha', 0.8);
  await recovery;
  assert(get('pass-results').dataset.sigma === '55' && get('sharpen-results').dataset.alpha === '0.8');
  assert(get('status').textContent.includes('無法解碼'));
  assert(metrics.createdURLs === metrics.revokedURLs);
  compareCurrent();
  input('alpha', 0.7); await waitFor(settled, 'recover upload'); compareCurrent();
});
await test('一區 postMessage 失敗不阻擋另一區，錯誤保留且可獨立重試', async () => {
  const post = win.Worker.prototype.postMessage;
  const before = pixels('lpf');
  win.Worker.prototype.postMessage = function (data, ...rest) {
    if (data.group === 'pass') throw new Error('Injected filtering failure');
    return post.call(this, data, ...rest);
  };
  try {
    input('sigma', 45); input('sharpen-sigma', 75);
    await waitFor(settled, 'post failure');
    assert(get('status').textContent.includes('Injected filtering failure'));
    assert(maxDifference(before, pixels('lpf')) === 0);
    assert(get('sharpen-results').dataset.sigma === '75');
  } finally { win.Worker.prototype.postMessage = post; }
  input('sigma', 30); await waitFor(settled, 'retry filter'); compareCurrent();
});
await test('1040 / 390 / 320px 無溢出，寬螢幕為 Original | LPF | HPF 與 Original | Sharpening', async () => {
  for (const width of [1040, 390, 320]) {
    frame.style.width = `${width}px`;
    await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
    assert(doc.documentElement.scrollWidth <= width, `overflow at ${width}: ${doc.documentElement.scrollWidth}`);
    const boxes = ['original', 'lpf', 'hpf', 'original-sharpen', 'sharpen'].map(id => get(id).getBoundingClientRect());
    assert(boxes.every(box => box.width > 0 && Math.abs(box.width - box.height) < 1));
    if (width === 1040) {
      assert(Math.abs(boxes[0].top - boxes[1].top) < 1 && Math.abs(boxes[1].top - boxes[2].top) < 1);
      assert(boxes[0].left < boxes[1].left && boxes[1].left < boxes[2].left);
      assert(Math.abs(boxes[3].top - boxes[4].top) < 1 && boxes[3].left < boxes[4].left);
    }
  }
  frame.style.width = '1040px';
});
await test('相對資源與三頁導航適用 repository 子路徑', () => {
  const base = new URL('../', import.meta.url).href;
  const resources = win.performance.getEntriesByType('resource').map(entry => entry.name).filter(url => !url.startsWith('blob:'));
  assert(resources.some(url => url.endsWith('/js/filtering-worker.js')));
  assert(resources.some(url => url.endsWith('/Cat.jpg')));
  assert(resources.every(url => url.startsWith(base)));
  for (const page of ['index.html', 'spectrum.html', 'filtering.html']) assert(doc.querySelector(`.page-nav a[href="./${page}"]`));
  assert(doc.querySelector('.page-nav [aria-current="page"]').textContent.trim() === '003 Gaussian Filtering');
});

win.URL.createObjectURL = createURL; win.URL.revokeObjectURL = revokeURL;
win.HTMLImageElement.prototype.decode = decode;
win.Worker.prototype.postMessage = postMessage;
win.CanvasRenderingContext2D.prototype.putImageData = putImageData;
await test('三個 Experiment 的六個方向實際導航、公開命名與窄螢幕連結', async () => {
  const base = new URL('../', import.meta.url);
  const experiments = [
    ['index.html', '001', 'RGB Fourier Phase Swap'],
    ['spectrum.html', '002', 'Spectrum Lab'],
    ['filtering.html', '003', 'Gaussian Filtering'],
  ];
  const inspected = new Set();
  metrics.navigation = [];
  async function inspect(page) {
    const current = frame.contentDocument;
    const [, number, name] = experiments.find(([file]) => file === page);
    assert(current.title === `Experiment ${number} — ${name} — FOURIER IMAGE LAB`);
    assert(current.querySelector('.brand').textContent.includes('FOURIER IMAGE LAB'));
    assert(current.querySelector('footer').textContent.includes('FOURIER IMAGE LAB'));
    assert(current.querySelector('meta[name="application-name"]').content === 'FOURIER IMAGE LAB');
    assert(!/FOURIER LAB|Fourier Lab|IMAGIE/.test(current.body.textContent));
    assert(current.querySelector('.eyebrow > span').textContent === `EXPERIMENT ${number}`);
    assert(!/EXPERIMENT 003A|PHASE 3A|Phase 3A/.test(current.body.textContent));
    const links = Array.from(current.querySelectorAll('.page-nav a'));
    assert(links.length === 3);
    for (const [i, [file, id, title]] of experiments.entries()) {
      assert(links[i].href === new URL(file, base).href);
      assert(links[i].textContent.trim() === `${id} ${title}`);
    }
    assert(current.querySelector('.page-nav [aria-current="page"]').href === new URL(page, base).href);
    if (inspected.has(page)) return;
    for (const width of [1040, 390, 320]) {
      frame.style.width = `${width}px`;
      await new Promise(resolve => frame.contentWindow.requestAnimationFrame(() => frame.contentWindow.requestAnimationFrame(resolve)));
      assert(current.documentElement.scrollWidth <= width, `${page} overflows ${width}`);
      for (const link of links) {
        const box = link.getBoundingClientRect();
        assert(box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= width, `${page}: navigation outside ${width}`);
      }
    }
    frame.style.width = '1040px';
    inspected.add(page);
  }
  let from = 'filtering.html';
  await inspect(from);
  for (const page of ['index.html', 'spectrum.html', 'filtering.html', 'spectrum.html', 'index.html', 'filtering.html']) {
    frame.contentDocument.querySelector(`.page-nav a[href="./${page}"]`).click();
    await waitFor(() => {
      if (frame.contentWindow.location.href !== new URL(page, base).href) return false;
      const current = frame.contentDocument;
      if (page === 'index.html') return current.getElementById('swap-button')?.disabled === false;
      if (page === 'spectrum.html') return current.getElementById('lab-images')?.dataset.preset === 'shifted-square' &&
        current.getElementById('lab-images').getAttribute('aria-busy') === 'false';
      return current.getElementById('pass-results')?.dataset.sigma === '30' &&
        current.getElementById('sharpen-results')?.dataset.sigma === '30' &&
        current.getElementById('results').getAttribute('aria-busy') === 'false';
    }, `${from} → ${page}`);
    metrics.navigation.push(`${from} → ${page}`);
    await inspect(page);
    from = page;
  }
});
const passed = results.filter(result => result.passed).length;
document.getElementById('summary').textContent = `${passed}/${results.length} 通過，${results.length - passed} 失敗`;
document.getElementById('metrics').textContent = JSON.stringify({ browser: navigator.userAgent, metrics, results }, null, 2);
const rerun = document.getElementById('rerun'); rerun.disabled = false; rerun.onclick = () => location.reload();
