import { IMAGE_SIZE } from './fourier.js';
import { DEFAULT_SIGMA, DEFAULT_ALPHA } from './filtering.js';
import { prepareImage } from './image.js';

const $ = id => document.getElementById(id);
const pending = new Map();
const groups = {
  pass: { sigma: DEFAULT_SIGMA, revision: 0, dirty: true, error: null, outputs: ['lpf', 'hpf'] },
  sharpen: { sigma: DEFAULT_SIGMA, alpha: DEFAULT_ALPHA, revision: 0, dirty: true, error: null, outputs: ['sharpen'] },
};
let worker;
let nextId = 0;
let sourceRevision = 0;
let ready = false;
let loading = false;
let processing = null;
let lastGroup = 'sharpen';
let failed = false;
let sourceError = null;
let selected = 'Monkey.jpg';

function setStatus(message, error = false) {
  $('status').textContent = message;
  $('status').parentElement.classList.toggle('is-error', error);
}

function sourceControls() {
  $('example').disabled = $('upload').disabled = loading || failed;
  for (const id of ['sigma', 'sharpen-sigma', 'alpha']) $(id).disabled = failed;
}

function updateBusy() {
  for (const [name, group] of Object.entries(groups)) {
    $(`${name}-results`).setAttribute('aria-busy', String(!failed &&
      (loading || (ready && (group.dirty || processing === name)))));
  }
  $('results').setAttribute('aria-busy', String(!failed &&
    (loading || (ready && (processing !== null || Object.values(groups).some(group => group.dirty))))));
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
  updateBusy();
  sourceControls();
  setStatus(error.message, true);
}

function draw(id, rgba) {
  const canvas = $(id);
  canvas.getContext('2d').putImageData(new ImageData(rgba, IMAGE_SIZE, IMAGE_SIZE), 0, 0);
  canvas.hidden = false;
}

// One request in flight, one latest state per section. Alternate dirty sections
// so a rapidly moving slider cannot starve the other section. Source and section
// revisions independently reject stale responses without invalidating its peer.
async function filter() {
  if (!ready || loading || processing || failed) return;
  const order = lastGroup === 'pass' ? ['sharpen', 'pass'] : ['pass', 'sharpen'];
  const name = order.find(name => groups[name].dirty);
  if (!name) return;
  const group = groups[name];
  const current = group.revision, source = sourceRevision;
  const parameters = { sigma: group.sigma, ...(name === 'sharpen' ? { alpha: group.alpha } : {}) };
  group.dirty = false;
  processing = lastGroup = name;
  updateBusy();
  if (!sourceError) setStatus(`正在計算 ${name === 'pass' ? 'LPF / HPF' : 'Sharpening'} 的 RGB IFFT…`);
  try {
    const result = await request('filter', { group: name, ...parameters });
    if (source !== sourceRevision || current !== group.revision || loading || failed) return;
    for (const type of group.outputs) draw(type, result[type]);
    $(`${name}-timing`).textContent = `${Math.round(result.milliseconds)} ms · 2D IFFT`;
    const container = $(`${name}-results`);
    container.dataset.sigma = String(parameters.sigma);
    if (name === 'sharpen') container.dataset.alpha = String(parameters.alpha);
    group.error = null;
    if (!Object.values(groups).some(group => group.dirty)) {
      const error = sourceError || Object.values(groups).find(group => group.error)?.error;
      setStatus(error || '重建完成。兩個區段的參數可獨立調整。', Boolean(error));
    }
  } catch (error) {
    if (source === sourceRevision && current === group.revision) {
      group.error = error.message;
      setStatus(error.message, true);
    }
  } finally {
    processing = null;
    updateBusy();
    void filter();
  }
}

async function loadSource(url, filename, selection) {
  if (loading || failed) return;
  loading = true;
  sourceRevision++;
  sourceError = null;
  for (const group of Object.values(groups)) { group.dirty = true; group.error = null; }
  sourceControls();
  updateBusy();
  setStatus(`正在載入 ${filename} 並計算 RGB 頻譜…`);
  try {
    const prepared = await prepareImage(url);
    // Decode once; use the same display pixels for both Original canvases.
    const display = prepared.rgba.slice();
    await request('image', { rgba: prepared.rgba }, [prepared.rgba.buffer]);
    draw('original', display);
    draw('original-sharpen', display);
    $('filename').textContent = filename;
    for (const id of ['dimensions', 'sharpen-dimensions']) $(id).textContent = `${prepared.width} × ${prepared.height}`;
    for (const [name, group] of Object.entries(groups)) {
      for (const type of group.outputs) $(type).hidden = true;
      const container = $(`${name}-results`);
      delete container.dataset.sigma;
      delete container.dataset.alpha;
      $(`${name}-timing`).textContent = '2D IFFT';
    }
    selected = selection;
    $('example').value = selection;
    ready = true;
  } catch (error) {
    $('example').value = selected;
    sourceError = error.message;
    setStatus(sourceError, true);
  } finally {
    loading = false;
    sourceControls();
    updateBusy();
  }
  // Failed decoding retains the old spectrum and still applies any slider
  // changes made during loading. The decode error remains visible afterward.
  void filter();
}

for (const [id, name, parameter] of [
  ['sigma', 'pass', 'sigma'], ['sharpen-sigma', 'sharpen', 'sigma'], ['alpha', 'sharpen', 'alpha'],
]) {
  $(id).addEventListener('input', () => {
    const group = groups[name];
    group[parameter] = Number($(id).value);
    $(`${id}-value`).value = parameter === 'alpha' ? group.alpha.toFixed(1) : String(group.sigma);
    group.revision++;
    group.dirty = true;
    group.error = null;
    sourceError = null;
    updateBusy();
    void filter();
  });
}

$('example').addEventListener('change', () => {
  const name = $('example').value;
  if (name !== 'Monkey.jpg' && name !== 'Cat.jpg') return;
  void loadSource(new URL(`../${name}`, import.meta.url).href, name, name);
});

$('upload').addEventListener('change', async () => {
  const file = $('upload').files[0];
  $('upload').value = '';
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
  try { await loadSource(url, file.name, 'upload'); }
  finally { URL.revokeObjectURL(url); }
});

try {
  worker = new Worker(new URL('./filtering-worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', ({ data }) => {
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id);
    if (data.error) job.reject(new Error(data.error));
    else job.resolve(data.result);
  });
  worker.addEventListener('error', failWorker);
  worker.addEventListener('messageerror', failWorker);
  void loadSource(new URL('../Monkey.jpg', import.meta.url).href, 'Monkey.jpg', 'Monkey.jpg');
} catch { failWorker(); }
