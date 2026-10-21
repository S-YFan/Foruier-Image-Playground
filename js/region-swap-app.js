import { t, sampleName, errorMessage } from './i18n.js';
import { IMAGE_SIZE } from './fourier.js';
import { prepareImage } from './image.js';
import { DEFAULT_PARAMETERS } from './region-swap.js';
import { SAMPLE_IMAGES, DEFAULT_SAMPLES } from './samples.js';

const $ = id => document.getElementById(id);
const parameters = { ...DEFAULT_PARAMETERS };
const ready = { A: false, B: false };
const selected = { ...DEFAULT_SAMPLES };
const pending = new Map();
let worker, nextId = 0, revision = 0;
let loading = false, processing = false, dirty = true, failed = false;
let sourceError = null;

function setStatus(message, error = false) {
  $('status').textContent = error ? errorMessage(message) : message;
  $('status').parentElement.classList.toggle('is-error', error);
}

function updateState() {
  for (const slot of ['A', 'B']) {
    $(`upload-${slot}`).disabled = $(`reset-${slot}`).disabled = loading || failed;
    $(`sample-${slot}`).disabled = loading || failed;
  }
  for (const id of ['mask-type', 'cutoff', 'quadrants', 'orientation', 'stripe-width']) $(id).disabled = failed;
  $('comparison').setAttribute('aria-busy', String(!failed &&
    (loading || processing || (dirty && ready.A && ready.B))));
}

function request(type, payload = {}, transfer = []) {
  if (failed) return Promise.reject(new Error(t('workerUnavailable')));
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    try { worker.postMessage({ id, type, ...payload }, transfer); }
    catch (error) { pending.delete(id); reject(error); }
  });
}

function failWorker() {
  failed = true;
  const error = new Error(t('workerStart'));
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
  $('clipping').textContent = t('waitingReconstruction');
  $('validation').textContent = t('numericalWaiting');
  delete $('comparison').dataset.parameters;
}

function maskLabel(state) {
  if (state.type === 'disk') return t('diskLabel', { radius: state.cutoff.toFixed(2) });
  if (state.type === 'quadrants') return t('quadrantsLabel', { pair: t({ 'ul-lr': 'ulLr', 'ur-ll': 'urLl', both: 'bothPairs' }[state.quadrants]) });
  return t('stripesLabel', { orientation: t(state.orientation), width: state.stripeWidth });
}

// Keep one reconstruction in flight and only the latest parameter state queued.
// Source and parameter revisions prevent stale responses from being displayed.
async function reconstruct() {
  if (!ready.A || !ready.B || loading || processing || !dirty || failed) return;
  dirty = false;
  processing = true;
  const current = revision, state = { ...parameters };
  updateState();
  if (!sourceError) setStatus(t('reconstructing'));
  try {
    const result = await request('reconstruct', { parameters: state });
    if (current !== revision || loading || failed) return;
    draw('phase-mask', result.maskRGBA);
    draw('reconstruction', result.rgba);
    $('empty-mask').hidden = $('empty-result').hidden = true;
    $('mask-caption').textContent = maskLabel(state);
    const { stats } = result;
    $('selected-fraction').textContent = `${(stats.selectedFraction * 100).toFixed(2)}%`;
    $('energy-fraction').textContent = stats.energyFraction === null ? t('energyUndefined') : `${(stats.energyFraction * 100).toFixed(2)}%`;
    $('clipping').textContent = t('displayClipped', { percent: (stats.clippedFraction * 100).toFixed(2) });
    $('clipping').title = t('range', { min: stats.minimum.toFixed(2), max: stats.maximum.toFixed(2) });
    $('timing').textContent = `${Math.round(result.milliseconds)} ms · 2D IFFT`;
    $('validation').textContent = t('regionCheck', { imag: stats.maxImaginary.toExponential(2), magnitude: stats.maxMagnitudeError.toExponential(2), scaled: stats.maxScaledMagnitudeError.toExponential(2) });
    $('comparison').dataset.parameters = JSON.stringify(state);
    setStatus(sourceError || t('regionReady'), Boolean(sourceError));
  } catch (error) {
    if (current === revision) setStatus(error.message, true);
  } finally {
    processing = false;
    updateState();
    void reconstruct();
  }
}

async function loadSource(slot, url, filename, selection = 'upload') {
  if (loading || failed) return;
  loading = true;
  revision++;
  dirty = true;
  sourceError = null;
  updateState();
  setStatus(t('loadingSlot', { slot }));
  try {
    const prepared = await prepareImage(url);
    const display = prepared.rgba.slice();
    await request('image', { slot, rgba: prepared.rgba }, [prepared.rgba.buffer]);
    draw(`image-${slot}`, display);
    $(`empty-${slot}`).hidden = true;
    $(`filename-${slot}`).textContent = filename;
    $(`filename-${slot}`).title = filename;
    $(`dimensions-${slot}`).textContent = `${prepared.width} × ${prepared.height}`;
    selected[slot] = selection;
    $(`sample-${slot}`).value = selection;
    ready[slot] = true;
    clearResult();
  } catch (error) {
    $(`sample-${slot}`).value = selected[slot];
    sourceError = error.message;
    setStatus(sourceError, true);
  } finally {
    loading = false;
    updateState();
  }
  if (!ready.A || !ready.B) {
    if (!sourceError) setStatus(t('needRegionInputs'));
  } else {
    void reconstruct();
  }
}

async function upload(slot, file) {
  if (!file || loading || failed) return;
  if (!(['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    (!file.type && /\.(png|jpe?g|webp)$/i.test(file.name)))) {
    setStatus(t('chooseFormat'), true);
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    setStatus(t('tooLarge'), true);
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
  $(`sample-${slot}`).addEventListener('change', () => {
    const key = $(`sample-${slot}`).value;
    if (!Object.hasOwn(SAMPLE_IMAGES, key)) return;
    const sample = SAMPLE_IMAGES[key];
    void loadSource(slot, sample.url, sampleName(sample), key);
  });
  $(`reset-${slot}`).addEventListener('click', () => {
    const key = DEFAULT_SAMPLES[slot], sample = SAMPLE_IMAGES[key];
    void loadSource(slot, sample.url, sampleName(sample), key);
  });
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
    for (const slot of ['A', 'B']) {
      const key = DEFAULT_SAMPLES[slot], sample = SAMPLE_IMAGES[key];
      await loadSource(slot, sample.url, sampleName(sample), key);
    }
  } catch { failWorker(); }
}
void start();
