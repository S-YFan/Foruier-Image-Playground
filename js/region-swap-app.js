import { IMAGE_SIZE } from './fourier.js';
import { prepareImage } from './image.js';
import { DEFAULT_PARAMETERS } from './region-swap.js';

const $ = id => document.getElementById(id);
const parameters = { ...DEFAULT_PARAMETERS };
const ready = { A: false, B: false };
const samples = {
  A: { url: new URL('../assets/sample-a.svg', import.meta.url).href, name: 'Mountain lake' },
  B: { url: new URL('../assets/sample-b.svg', import.meta.url).href, name: 'Coastal lighthouse' },
};
const pending = new Map();
let worker, nextId = 0, revision = 0;
let loading = false, processing = false, dirty = true, failed = false;
let sourceError = null;

function setStatus(message, error = false) {
  $('status').textContent = message;
  $('status').parentElement.classList.toggle('is-error', error);
}

function updateState() {
  for (const slot of ['A', 'B']) {
    $(`upload-${slot}`).disabled = $(`reset-${slot}`).disabled = loading || failed;
  }
  for (const id of ['mask-type', 'cutoff', 'quadrants', 'orientation', 'stripe-width']) $(id).disabled = failed;
  $('comparison').setAttribute('aria-busy', String(!failed &&
    (loading || processing || (dirty && ready.A && ready.B))));
}

function request(type, payload = {}, transfer = []) {
  if (failed) return Promise.reject(new Error('運算程序無法使用，請重新整理頁面。'));
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    try { worker.postMessage({ id, type, ...payload }, transfer); }
    catch (error) { pending.delete(id); reject(error); }
  });
}

function failWorker() {
  failed = true;
  const error = new Error('無法啟動背景運算，請透過 HTTP / HTTPS 開啟並重新整理頁面。');
  for (const job of pending.values()) job.reject(error);
  pending.clear();
  updateState();
  setStatus(error.message, true);
}

function draw(id, rgba) {
  const canvas = $(id);
  canvas.getContext('2d').putImageData(new ImageData(rgba, IMAGE_SIZE, IMAGE_SIZE), 0, 0);
  canvas.hidden = false;
}

function clearResult() {
  for (const id of ['phase-mask', 'reconstruction']) $(id).hidden = true;
  for (const id of ['empty-mask', 'empty-result']) $(id).hidden = false;
  for (const id of ['selected-fraction', 'energy-fraction']) $(id).textContent = '—';
  $('timing').textContent = '2D IFFT';
  $('clipping').textContent = '等待重建';
  $('validation').textContent = '數值檢查會隨每次重建更新。';
  delete $('comparison').dataset.parameters;
}

function maskLabel(state) {
  if (state.type === 'disk') return `Low-frequency disk · r ≤ ${state.cutoff.toFixed(2)}`;
  if (state.type === 'quadrants') return `Quadrants · ${{ 'ul-lr': 'UL + LR', 'ur-ll': 'UR + LL', both: 'Both pairs' }[state.quadrants]}`;
  return `${state.orientation === 'vertical' ? 'Vertical' : 'Horizontal'} stripes · ${state.stripeWidth} bins`;
}

// Keep one reconstruction in flight and only the latest parameter state queued.
// Source and parameter revisions prevent stale responses from being displayed.
async function reconstruct() {
  if (!ready.A || !ready.B || loading || processing || !dirty || failed) return;
  dirty = false;
  processing = true;
  const current = revision, state = { ...parameters };
  updateState();
  if (!sourceError) setStatus('正在選擇相位並計算 RGB IFFT…');
  try {
    const result = await request('reconstruct', { parameters: state });
    if (current !== revision || loading || failed) return;
    draw('phase-mask', result.maskRGBA);
    draw('reconstruction', result.rgba);
    $('empty-mask').hidden = $('empty-result').hidden = true;
    $('mask-caption').textContent = maskLabel(state);
    const { stats } = result;
    $('selected-fraction').textContent = `${(stats.selectedFraction * 100).toFixed(2)}%`;
    $('energy-fraction').textContent = stats.energyFraction === null ? '未定義（A 能量為 0）' : `${(stats.energyFraction * 100).toFixed(2)}%`;
    $('clipping').textContent = `顯示裁切 ${(stats.clippedFraction * 100).toFixed(2)}%`;
    $('clipping').title = `裁切前範圍：${stats.minimum.toFixed(2)} 至 ${stats.maximum.toFixed(2)}`;
    $('timing').textContent = `${Math.round(result.milliseconds)} ms · 2D IFFT`;
    $('validation').textContent = `共軛遮罩檢查通過；最大虛部殘差 ${stats.maxImaginary.toExponential(2)}；最大振幅誤差 ${stats.maxMagnitudeError.toExponential(2)}；依每格 max(1, |F_A|) 縮放的振幅誤差 ${stats.maxScaledMagnitudeError.toExponential(2)}。`;
    $('comparison').dataset.parameters = JSON.stringify(state);
    setStatus(sourceError || '重建完成。調整遮罩或更換圖片會自動更新。', Boolean(sourceError));
  } catch (error) {
    if (current === revision) setStatus(error.message, true);
  } finally {
    processing = false;
    updateState();
    void reconstruct();
  }
}

async function loadSource(slot, url, filename) {
  if (loading || failed) return;
  loading = true;
  revision++;
  dirty = true;
  sourceError = null;
  updateState();
  setStatus(`正在載入 Image ${slot} 並計算 RGB 頻譜…`);
  try {
    const prepared = await prepareImage(url);
    const display = prepared.rgba.slice();
    await request('image', { slot, rgba: prepared.rgba }, [prepared.rgba.buffer]);
    draw(`image-${slot}`, display);
    $(`empty-${slot}`).hidden = true;
    $(`filename-${slot}`).textContent = filename;
    $(`filename-${slot}`).title = filename;
    $(`dimensions-${slot}`).textContent = `${prepared.width} × ${prepared.height}`;
    ready[slot] = true;
    clearResult();
  } catch (error) {
    sourceError = error.message;
    setStatus(sourceError, true);
  } finally {
    loading = false;
    updateState();
  }
  if (!ready.A || !ready.B) {
    if (!sourceError) setStatus('請上傳 Image A 與 Image B，兩張都載入後會自動重建。');
  } else {
    void reconstruct();
  }
}

async function upload(slot, file) {
  if (!file || loading || failed) return;
  if (!(['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    (!file.type && /\.(png|jpe?g|webp)$/i.test(file.name)))) {
    setStatus('請選擇 PNG、JPEG 或 WebP 圖片。', true);
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    setStatus('圖片超過 25 MB，請先縮小檔案再上傳。', true);
    return;
  }
  const url = URL.createObjectURL(file);
  try { await loadSource(slot, url, file.name); }
  finally { URL.revokeObjectURL(url); }
}

for (const slot of ['A', 'B']) {
  const input = $(`upload-${slot}`), card = $(`card-${slot}`);
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = '';
    void upload(slot, file);
  });
  $(`reset-${slot}`).addEventListener('click', () => void loadSource(slot, samples[slot].url, samples[slot].name));
  card.addEventListener('dragover', event => {
    event.preventDefault();
    if (!loading && !failed) card.classList.add('is-dragging');
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
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());

for (const [id, key] of [['mask-type', 'type'], ['cutoff', 'cutoff'], ['quadrants', 'quadrants'],
  ['orientation', 'orientation'], ['stripe-width', 'stripeWidth']]) {
  $(id).addEventListener(id === 'cutoff' || id === 'stripe-width' ? 'input' : 'change', () => {
    parameters[key] = ['cutoff', 'stripeWidth'].includes(key) ? Number($(id).value) : $(id).value;
    for (const type of ['disk', 'quadrants', 'stripes']) $(`${type}-controls`).hidden = type !== parameters.type;
    $('cutoff-value').value = parameters.cutoff.toFixed(2);
    $('stripe-width-value').value = String(parameters.stripeWidth);
    revision++;
    dirty = true;
    sourceError = null;
    updateState();
    void reconstruct();
  });
}

async function start() {
  try {
    worker = new Worker(new URL('./region-swap-worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(data.result);
    });
    worker.addEventListener('error', failWorker);
    worker.addEventListener('messageerror', failWorker);
    for (const slot of ['A', 'B']) await loadSource(slot, samples[slot].url, samples[slot].name);
  } catch { failWorker(); }
}
void start();
