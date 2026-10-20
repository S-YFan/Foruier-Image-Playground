import { SIZE, PERIODS, NEUTRAL, createPreset, grayRGBA, analyzeGray, renderSpectra, phaseChangeColor } from '../js/spectrum.js';
import { FFT } from '../js/fft.js';
import { createTranslationReference, displayTranslation } from '../js/translation.js';

const assert = (condition, message = 'Assertion failed') => { if (!condition) throw new Error(message); };
const results = [], metrics = { magnitude: 0, coefficient: 0, reconstruction: 0, imaginary: 0, displayed: 0 };
async function test(name, callback) {
  const li = document.createElement('li');
  try { await callback(); li.className = 'pass'; li.textContent = 'PASS — ' + name; results.push({ name, passed: true }); }
  catch (error) { li.className = 'fail'; li.textContent = 'FAIL — ' + name + ': ' + error.message; results.push({ name, passed: false, error: error.message }); }
  document.getElementById('results').append(li);
}
async function waitFor(condition, label, timeout = 15000) {
  const deadline = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error('Timeout: ' + label);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
function identical(a, b) {
  assert(a.length === b.length);
  for (let i = 0; i < a.length; i++) assert(a[i] === b[i], 'Pixel mismatch at ' + i + ': ' + a[i] + ' / ' + b[i]);
}
const frame = document.getElementById('lab');
frame.src = new URL('../spectrum.html', import.meta.url).href;
let doc, win;
await test('初始 Translation Experiment 為 (0,0)，七張圖與真正 IFFT 就緒', async () => {
  await waitFor(() => frame.contentDocument?.getElementById('lab-images')?.dataset.preset === 'shifted-square', 'initial translation');
  doc = frame.contentDocument; win = frame.contentWindow;
  assert(doc.getElementById('shift-x').value === '0' && doc.getElementById('shift-y').value === '0');
  assert(doc.querySelectorAll('.preset-list [data-preset]').length === 4, 'exactly four experiment buttons');
});
const get = id => doc.getElementById(id);
const pixels = id => get(id).getContext('2d').getImageData(0, 0, SIZE, SIZE).data;
const ready = () => get('lab-images').getAttribute('aria-busy') === 'false' && get('lab-images').dataset.revision === get('lab-images').dataset.requestRevision;
async function settle(label) { await waitFor(ready, label); }
async function select(id) {
  doc.querySelector('[data-preset="' + id + '"]').click();
  await settle(id);
  assert(get('lab-images').dataset.preset === id);
}
function input(id, value) {
  get(id).value = value;
  get(id).dispatchEvent(new win.Event('input', { bubbles: true }));
}
async function translate(dx, dy) {
  input('shift-x', dx); input('shift-y', dy);
  await settle('translation ' + dx + ',' + dy);
}
const fft = new FFT(SIZE), reference = createTranslationReference(fft);
const translationCanvases = { 'translation-original': 'original', 'translation-shifted': 'shifted', 'translation-reconstructed': 'reconstructed', 'original-magnitude': 'originalMagnitude', 'shifted-magnitude': 'shiftedMagnitude', 'phase-difference': 'phaseDifference', 'phase-change': 'phaseChange' };
function verifyTranslation(dx, dy) {
  const expected = displayTranslation(dx, dy, reference, fft);
  for (const [id, key] of Object.entries(translationCanvases)) identical(pixels(id), expected[key]);
  assert(Number(get('magnitude-difference').dataset.value) === expected.stats.maxMagnitudeDifference);
  assert(Number(get('reconstruction-error').dataset.value) === expected.stats.maxError);
  metrics.magnitude = Math.max(metrics.magnitude, expected.stats.maxMagnitudeDifference);
  metrics.coefficient = Math.max(metrics.coefficient, expected.stats.maxCoefficientError);
  metrics.reconstruction = Math.max(metrics.reconstruction, expected.stats.maxError);
  metrics.imaginary = Math.max(metrics.imaginary, expected.stats.maxImaginary);
  metrics.displayed = Math.max(metrics.displayed, expected.stats.displayedError);
}
function verifyGeometry(id, params) {
  const input = createPreset(id, params), spectrum = analyzeGray(input), display = renderSpectra(spectrum);
  identical(pixels('lab-spatial'), grayRGBA(input));
  identical(pixels('lab-magnitude'), display.magnitude);
  identical(pixels('lab-phase'), display.phase);
  assert(doc.querySelectorAll('[data-preset][aria-pressed="true"]').length === 1);
  assert(doc.querySelector('[data-preset="' + id + '"]').getAttribute('aria-pressed') === 'true');
  assert(pixels('lab-magnitude')[(128 * SIZE + 128) * 4] === 255);
}
await test('零位移：有效 Phase Change 為暗色 0，灰色遮罩與 0 明確不同', async () => {
  await settle('initial'); verifyTranslation(0, 0);
  const rgba = pixels('phase-change'), center = (128 * SIZE + 128) * 4;
  identical(rgba.subarray(center, center + 3), phaseChangeColor(0));
  let neutral = 0, zero = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (NEUTRAL.every((v, c) => rgba[i + c] === v)) neutral++;
    else if (phaseChangeColor(0).every((v, c) => rgba[i + c] === v)) zero++;
  }
  assert(neutral > 0 && zero > 0 && neutral + zero === SIZE ** 2);
});
for (const [id, params] of [['square', { side: 64 }], ['circle', { radius: 40 }], ['stripes', { period: 32 }]]) {
  await test('切換 ' + id + '：三張 Canvas 逐像素比對真正 FFT 與 DC 置中', async () => {
    await select(id); verifyGeometry(id, params);
  });
}
await test('Shifted Square 保留為第四種實驗，從零位移切換後結果一致', async () => {
  await select('shifted-square'); verifyTranslation(0, 0);
});
await test('循環相位圖例兩端相同，固定 Phase Change 圖例 0 與 2 不同', () => {
  for (const id of ['phase-legend', 'difference-legend']) {
    const legend = get(id).getContext('2d').getImageData(0, 0, SIZE, 12).data;
    identical(legend.subarray(0, 4), legend.subarray(255 * 4, 256 * 4));
  }
  const legend = get('change-legend').getContext('2d').getImageData(0, 0, SIZE, 12).data;
  identical(legend.subarray(0, 3), phaseChangeColor(0));
  identical(legend.subarray(255 * 4, 255 * 4 + 3), phaseChangeColor(2));
});
await test('X/Y 滑桿：正負與邊界位移同步更新七張 Canvas、原始振幅差與 IFFT', async () => {
  for (const [dx, dy] of [[1, 0], [0, -1], [32, 24], [-96, 96], [96, -96], [-17, 31]]) {
    await translate(dx, dy); verifyTranslation(dx, dy);
    assert(get('lab-images').dataset.dx === String(dx) && get('lab-images').dataset.dy === String(dy));
    identical(pixels('translation-reconstructed'), pixels('translation-shifted'));
  }
  assert(metrics.magnitude < 1e-7 && metrics.reconstruction < 1e-8 && metrics.displayed === 0);
});
await test('重複切換保留各實驗參數，原始方形保持不變', async () => {
  const original = pixels('translation-original').slice();
  await select('circle'); await select('shifted-square');
  verifyTranslation(-17, 31); identical(pixels('translation-original'), original);
});
for (const [id, control, key, values] of [['square', 'side-length', 'side', [16, 96, 160]], ['circle', 'circle-radius', 'radius', [8, 64, 96]], ['stripes', 'stripe-period', 'period', [0, 1, 3, 4]]]) {
  await test(id + ' 參數滑桿：空間域與 Magnitude / Phase 同步逐像素更新', async () => {
    await select(id);
    for (const value of values) {
      input(control, value); await settle(id + ' parameter');
      const actual = id === 'stripes' ? PERIODS[value] : value;
      verifyGeometry(id, { [key]: actual });
    }
  });
}
await test('連續拖動只提交最新結果；刻意延遲舊 Worker 回應也不覆蓋新位置', async () => {
  await select('shifted-square'); await translate(0, 0);
  const post = win.Worker.prototype.postMessage, paint = win.CanvasRenderingContext2D.prototype.putImageData;
  let sends = 0, paints = 0;
  win.Worker.prototype.postMessage = function (...args) {
    sends++;
    if (sends === 1) { const instance = this; win.setTimeout(() => post.apply(instance, args), 120); }
    else post.apply(this, args);
  };
  win.CanvasRenderingContext2D.prototype.putImageData = function (...args) { paints++; return paint.apply(this, args); };
  try {
    input('shift-x', 1);
    for (let i = 2; i <= 40; i++) { input('shift-x', i); input('shift-y', -i); }
    await settle('latest only');
    verifyTranslation(40, -40);
    assert(sends === 2, 'one in-flight + one latest request, actual ' + sends);
    assert(paints === 7, 'stale response must not paint any canvas, actual ' + paints);
    metrics.coalescedInputEvents = 79; metrics.workerRequests = sends; metrics.committedCanvases = paints;
  } finally { win.Worker.prototype.postMessage = post; win.CanvasRenderingContext2D.prototype.putImageData = paint; }
});
await test('計算期間切換實驗並修改尺寸，最後選擇優先', async () => {
  input('shift-x', 41);
  doc.querySelector('[data-preset="square"]').click();
  input('side-length', 80);
  doc.querySelector('[data-preset="circle"]').click();
  input('circle-radius', 52);
  await settle('final experiment');
  assert(get('lab-images').dataset.preset === 'circle');
  verifyGeometry('circle', { radius: 52 });
});
await test('桌面 1040px：空間三圖同排、頻譜兩欄且保持足夠大小', async () => {
  await select('shifted-square');
  const rects = [...doc.querySelectorAll('.spatial-triptych .lab-card')].map(item => item.getBoundingClientRect());
  assert(rects.every(rect => Math.abs(rect.top - rects[0].top) < 1));
  assert(get('translation-original').getBoundingClientRect().width >= 260);
  const spectral = [...doc.querySelectorAll('.phase-pair .lab-card')].map(item => item.getBoundingClientRect());
  assert(Math.abs(spectral[0].top - spectral[1].top) < 1);
  assert(get('phase-change').getBoundingClientRect().width >= 320);
  metrics.desktopWidth = win.innerWidth;
});
await test('手機 375 / 390 / 320px：重建優先、滑桿緊鄰主結果、所有實驗無水平溢出', async () => {
  for (const width of [375, 390, 320]) {
    frame.style.width = width + 'px';
    await waitFor(() => win.innerWidth <= width, 'resize');
    await select('shifted-square');
    const rects = [...doc.querySelectorAll('.spatial-triptych .lab-card')].map(item => item.getBoundingClientRect());
    assert(rects[0].top >= rects[2].bottom && rects[1].top >= rects[0].bottom, 'reconstruction first, followed by original and shifted');
    assert(get('translation-reconstructed').getBoundingClientRect().width >= 240, 'reconstruction canvas too small at ' + width);
    assert(get('lab-controls').parentElement === get('translation-controls-host'), 'translation controls beside main reconstruction');
    const preview = get('translation-reconstructed').getBoundingClientRect(), controls = get('lab-controls').getBoundingClientRect();
    assert(controls.top >= preview.bottom && controls.top - preview.bottom < 20, 'controls immediately below preview without overlap');
    assert(controls.bottom - preview.top < 650, 'canvas and both sliders fit together in a phone viewport');
    for (const preset of ['shifted-square', 'square', 'circle', 'stripes']) {
      await select(preset);
      assert(doc.documentElement.scrollWidth <= win.innerWidth + 1, 'overflow ' + width + '/' + preset);
      if (preset !== 'shifted-square') assert(get('lab-controls').parentElement === get('geometry-controls-host'), 'basic shape controls beside Fourier Magnitude');
    }
    metrics['mobile' + width] = { viewport: win.innerWidth, scroll: doc.documentElement.scrollWidth };
  }
  frame.style.width = '1040px'; await select('shifted-square');
  await waitFor(() => get('lab-controls').parentElement === get('controls-home'), 'desktop control position restored');
});
await test('手機跨模式傳送失敗：新模式滑桿保持可見，保留舊結果並可重試', async () => {
  frame.style.width = '375px';
  await waitFor(() => win.innerWidth <= 375, 'mobile failure recovery resize');
  const post = win.Worker.prototype.postMessage;
  try {
    for (const preset of ['circle', 'shifted-square']) {
      const previousPreset = get('lab-images').dataset.preset;
      const previousCanvas = previousPreset === 'shifted-square' ? 'translation-reconstructed' : 'lab-magnitude';
      const before = pixels(previousCanvas).slice();
      win.Worker.prototype.postMessage = () => { throw new Error('Injected mobile mode-switch failure'); };
      doc.querySelector('[data-preset="' + preset + '"]').click();
      await waitFor(() => get('lab-images').getAttribute('aria-busy') === 'false', 'mobile cross-mode failure');
      assert(get('lab-status').textContent.includes('Injected mobile mode-switch failure'));
      assert(get('lab-images').dataset.preset === previousPreset, 'failed mode must not relabel old results');
      identical(pixels(previousCanvas), before);
      assert(get('lab-controls').parentElement === get('controls-home'), 'controls stay outside the still-hidden target view');
      assert(get('lab-controls').getBoundingClientRect().height > 0, 'retry controls remain visible');
      assert(doc.querySelector('[data-controls="' + preset + '"]').getBoundingClientRect().height > 0);
      win.Worker.prototype.postMessage = post;
      if (preset === 'circle') {
        input('circle-radius', 43); await settle('retry circle after failed mode switch');
        verifyGeometry('circle', { radius: 43 });
        assert(get('lab-controls').parentElement === get('geometry-controls-host'));
      } else {
        await translate(23, -14); verifyTranslation(23, -14);
        assert(get('lab-controls').parentElement === get('translation-controls-host'));
      }
    }
  } finally {
    win.Worker.prototype.postMessage = post;
    frame.style.width = '1040px';
    await waitFor(() => get('lab-controls').parentElement === get('controls-home'), 'restore desktop after recovery check');
  }
});
await test('Worker 傳送失敗保留七張圖，控制項仍可用並可重試', async () => {
  const before = pixels('translation-shifted').slice(), post = win.Worker.prototype.postMessage;
  win.Worker.prototype.postMessage = () => { throw new Error('Injected spectrum postMessage failure'); };
  try {
    input('shift-x', 12);
    await waitFor(() => get('lab-images').getAttribute('aria-busy') === 'false', 'failure recovery');
    assert(get('lab-status').textContent.includes('Injected spectrum postMessage failure'));
    identical(pixels('translation-shifted'), before);
    assert(!get('shift-x').disabled);
  } finally { win.Worker.prototype.postMessage = post; }
  await translate(12, -9); verifyTranslation(12, -9);
});
await test('兩頁實際導航與 Playground 預設重建在 repository 子路徑正常運作', async () => {
  const base = new URL('../', import.meta.url).href; metrics.baseURL = base;
  doc.querySelector('.page-nav a[href="./index.html"]').click();
  await waitFor(() => frame.contentDocument?.getElementById('status')?.textContent.includes('交換完成') && frame.contentDocument?.getElementById('results')?.getAttribute('aria-busy') === 'false', 'Playground navigation');
  doc = frame.contentDocument;
  assert(frame.contentWindow.location.href === new URL('index.html', base).href);
  assert(doc.getElementById('status').textContent.includes('交換完成'));
  assert(!doc.getElementById('result-AB').hidden && !doc.getElementById('result-BA').hidden);
  doc.querySelector('.page-nav a[href="./spectrum.html"]').click();
  await waitFor(() => frame.contentDocument?.getElementById('lab-images')?.dataset.preset === 'shifted-square', 'Spectrum return');
  doc = frame.contentDocument; win = frame.contentWindow;
  await settle('return initialization');
  verifyTranslation(0, 0);
  assert(win.location.href === new URL('spectrum.html', base).href);
  assert(doc.querySelector('.page-nav [aria-current="page"]').textContent.trim() === '002 Spectrum Lab');
});
await test('樣式、ES module 與 Worker 的實際資源載入均保留 repository 前綴', () => {
  const base = new URL('../', import.meta.url).href;
  const resources = win.performance.getEntriesByType('resource').map(entry => entry.name);
  assert(resources.some(url => url.endsWith('/js/spectrum-worker.js')));
  assert(resources.some(url => url.endsWith('/spectrum.css')));
  assert(resources.every(url => url.startsWith(base)), resources.join('\n'));
  metrics.resources = resources;
});
const passed = results.filter(result => result.passed).length;
document.getElementById('summary').textContent = passed + '/' + results.length + ' 通過，' + (results.length - passed) + ' 失敗';
document.getElementById('metrics').textContent = JSON.stringify({ browser: navigator.userAgent, metrics, results }, null, 2);
const rerun = document.getElementById('rerun'); rerun.disabled = false; rerun.onclick = () => location.reload();
