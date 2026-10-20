import { IMAGE_SIZE } from './fourier.js';
import { prepareImage } from './image.js';
import { SAMPLE_IMAGES, DEFAULT_SAMPLES } from './samples.js';

const $ = id => document.getElementById(id);
const inputs = ['A', 'B'].flatMap(slot => [$(`upload-${slot}`), $(`sample-${slot}`)]);
const selected = { ...DEFAULT_SAMPLES };
const ready = { A: false, B: false };
const pending = new Map();
let worker;
let nextId = 0;
let busy = false;
let workerFailed = false;

function setStatus(message, error = false) {
  $('status').textContent = message;
  $('status').parentElement.classList.toggle('is-error', error);
}

function setBusy(value) {
  busy = value;
  document.body.classList.toggle('is-busy', value);
  inputs.forEach(input => { input.disabled = value || workerFailed; });
  $('results').setAttribute('aria-busy', String(value));
}

function request(type, payload = {}, transfer = []) {
  if (workerFailed) return Promise.reject(new Error('運算程序無法使用，請重新整理頁面。'));
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    try {
      worker.postMessage({ id, type, ...payload }, transfer);
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}

function failWorker() {
  workerFailed = true;
  const error = new Error('無法啟動背景運算。請使用本機 HTTP 伺服器或 GitHub Pages 開啟，並重新整理。');
  for (const job of pending.values()) job.reject(error);
  pending.clear();
  setStatus(error.message, true);
  setBusy(false);
}

function draw(id, rgba) {
  const canvas = $(id);
  canvas.getContext('2d').putImageData(new ImageData(rgba, IMAGE_SIZE, IMAGE_SIZE), 0, 0);
  canvas.hidden = false;
}

async function installImage(slot, prepared, filename, selection = 'upload') {
  // Keep a display copy; transfer the other buffer instead of cloning it in transit.
  const displayPixels = prepared.rgba.slice();
  await request('image', { slot, rgba: prepared.rgba }, [prepared.rgba.buffer]);
  draw(`image-${slot}`, displayPixels);
  $(`empty-${slot}`).hidden = true;
  $(`filename-${slot}`).textContent = filename;
  $(`filename-${slot}`).title = filename;
  $(`dimensions-${slot}`).textContent = `${prepared.width} × ${prepared.height}`;
  selected[slot] = selection;
  $(`sample-${slot}`).value = selection;
  ready[slot] = true;
  // Never label old results as the reconstruction of newly loaded inputs.
  for (const result of ['AB', 'BA']) {
    $(`result-${result}`).hidden = true;
    $(`empty-${result}`).hidden = false;
    $(`stats-${result}`).textContent = '等待重建';
  }
  $('timing').textContent = '2D IFFT';
  $('residual').textContent = '虛部殘差將在重建後顯示。';
}

async function swap() {
  if (!ready.A || !ready.B) {
    setStatus('請上傳 Image A 與 Image B，兩張都載入後會自動交換。');
    return;
  }
  setStatus('正在交換三個顏色通道的相位並執行 IFFT…');
  const { first, second, milliseconds } = await request('swap');
  for (const [name, result] of [['AB', first], ['BA', second]]) {
    draw(`result-${name}`, result.rgba);
    $(`empty-${name}`).hidden = true;
    $(`stats-${name}`).textContent = `裁切 ${(result.stats.clippedFraction * 100).toFixed(1)}%`;
    $(`stats-${name}`).title = `裁切前範圍：${result.stats.minimum.toFixed(2)} 至 ${result.stats.maximum.toFixed(2)}`;
  }
  $('timing').textContent = `${Math.round(milliseconds)} ms · 2D IFFT`;
  const residual = Math.max(first.stats.maxImaginary, second.stats.maxImaginary);
  $('residual').textContent = `本次重建最大虛部殘差：${residual.toExponential(2)}（原始 0–255 像素尺度）。`;
  if (residual > 1e-7) {
    setStatus('重建完成，但虛部殘差偏高，請查看計算與顯示方式。', true);
  } else {
    setStatus('交換完成。更換任一圖片會自動重新計算。');
  }
}

async function upload(slot, file) {
  if (busy || workerFailed || !file) return;
  const supported = ['image/png', 'image/jpeg', 'image/webp'];
  if (!(supported.includes(file.type) || (!file.type && /\.(png|jpe?g|webp)$/i.test(file.name)))) {
    setStatus('請選擇 PNG、JPEG 或 WebP 圖片。', true);
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    setStatus('圖片超過 25 MB，請先縮小檔案再上傳。', true);
    return;
  }
  setBusy(true);
  setStatus(`正在載入 Image ${slot}，並計算 RGB 頻譜…`);
  let url;
  try {
    url = URL.createObjectURL(file);
    await installImage(slot, await prepareImage(url), file.name);
    await swap();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    if (url) URL.revokeObjectURL(url);
    setBusy(false);
  }
}

async function loadSample(slot, key) {
  if (busy || workerFailed || !Object.hasOwn(SAMPLE_IMAGES, key)) return;
  setBusy(true);
  const sample = SAMPLE_IMAGES[key];
  setStatus(`正在載入 ${sample.name}，並計算 RGB 頻譜…`);
  try {
    await installImage(slot, await prepareImage(sample.url), sample.name, key);
    await swap();
  } catch (error) {
    $(`sample-${slot}`).value = selected[slot];
    setStatus(error.message, true);
  } finally { setBusy(false); }
}

for (const slot of ['A', 'B']) {
  const input = $(`upload-${slot}`);
  const card = $(`card-${slot}`);
  $(`sample-${slot}`).addEventListener('change', () => void loadSample(slot, $(`sample-${slot}`).value));
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = ''; // Allow selecting the same file again.
    void upload(slot, file);
  });
  card.addEventListener('dragover', event => {
    event.preventDefault();
    if (!busy && !workerFailed) card.classList.add('is-dragging');
  });
  card.addEventListener('dragleave', event => {
    if (!card.contains(event.relatedTarget)) card.classList.remove('is-dragging');
  });
  card.addEventListener('drop', event => {
    event.preventDefault();
    card.classList.remove('is-dragging');
    void upload(slot, event.dataTransfer.files[0]);
  });
}
// A missed drop should not navigate away from the experiment.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());

// Keep the existing source controls beside the first reconstruction on phones.
// Moving the same nodes preserves their labels, listeners and selected values.
const mobileLayout = window.matchMedia('(max-width: 760px)');
const sourceControls = ['A', 'B'].map(slot => {
  const card = $(`card-${slot}`);
  return { slot, card, picker: card.querySelector('.sample-picker'), upload: card.querySelector('.upload-label') };
});
function arrangeSourceControls() {
  $('mobile-source-controls').hidden = !mobileLayout.matches;
  for (const { slot, card, picker, upload } of sourceControls) {
    if (mobileLayout.matches) {
      $(`mobile-control-${slot}`).append(picker, upload);
    } else {
      card.append(picker);
      card.querySelector('.card-heading').insertBefore(upload, $(`upload-${slot}`));
    }
  }
}
mobileLayout.addEventListener('change', arrangeSourceControls);
arrangeSourceControls();

async function start() {
  setBusy(true);
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(data.result);
    });
    worker.addEventListener('error', failWorker);
    worker.addEventListener('messageerror', failWorker);
    const check = await request('check');
    $('validation').textContent = `FFT → IFFT 自我檢查${check.passed ? '通過' : '失敗'}：最大實部誤差 ${check.maxError.toExponential(2)}，最大虛部殘差 ${check.maxImaginary.toExponential(2)}。`;
    if (!check.passed) {
      workerFailed = true;
      throw new Error('FFT 數值檢查未通過，已停止運算。');
    }
    setStatus('正在載入資料夾中的兩張範例圖片…');
    // A failed sample never prevents users from supplying their own images.
    const samples = await Promise.allSettled([
      prepareImage(SAMPLE_IMAGES[DEFAULT_SAMPLES.A].url),
      prepareImage(SAMPLE_IMAGES[DEFAULT_SAMPLES.B].url),
    ]);
    for (const [index, slot] of ['A', 'B'].entries()) {
      if (samples[index].status === 'fulfilled') {
        const key = DEFAULT_SAMPLES[slot];
        await installImage(slot, samples[index].value, SAMPLE_IMAGES[key].name, key);
      }
    }
    await swap();
  } catch (error) {
    if (!worker) workerFailed = true;
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
}

void start();
