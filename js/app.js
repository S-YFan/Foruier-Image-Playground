import { t, sampleName, errorMessage } from './i18n.js';
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
  $('status').textContent = error ? errorMessage(message) : message;
  $('status').parentElement.classList.toggle('is-error', error);
}

function setBusy(value) {
  busy = value;
  document.body.classList.toggle('is-busy', value);
  inputs.forEach(input => { input.disabled = value || workerFailed; });
  $('results').setAttribute('aria-busy', String(value));
}

function request(type, payload = {}, transfer = []) {
  if (workerFailed) return Promise.reject(new Error(t('workerUnavailable')));
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
  const error = new Error(t('workerStart'));
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
    $(`stats-${result}`).textContent = t('waitingReconstruction');
  }
  $('timing').textContent = '2D IFFT';
  $('residual').textContent = t('residualWaiting');
}

async function swap() {
  if (!ready.A || !ready.B) {
    setStatus(t('needSwapInputs'));
    return;
  }
  setStatus(t('swapping'));
  const { first, second, milliseconds } = await request('swap');
  for (const [name, result] of [['AB', first], ['BA', second]]) {
    draw(`result-${name}`, result.rgba);
    $(`empty-${name}`).hidden = true;
    $(`stats-${name}`).textContent = t('clipped', { percent: (result.stats.clippedFraction * 100).toFixed(1) });
    $(`stats-${name}`).title = t('range', { min: result.stats.minimum.toFixed(2), max: result.stats.maximum.toFixed(2) });
  }
  $('timing').textContent = `${Math.round(milliseconds)} ms · 2D IFFT`;
  const residual = Math.max(first.stats.maxImaginary, second.stats.maxImaginary);
  $('residual').textContent = t('residual', { value: residual.toExponential(2) });
  if (residual > 1e-7) {
    setStatus(t('highResidual'), true);
  } else {
    setStatus(t('swapComplete'));
  }
}

async function upload(slot, file) {
  if (busy || workerFailed || !file) return;
  const supported = ['image/png', 'image/jpeg', 'image/webp'];
  if (!(supported.includes(file.type) || (!file.type && /\.(png|jpe?g|webp)$/i.test(file.name)))) {
    setStatus(t('chooseFormat'), true);
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    setStatus(t('tooLarge'), true);
    return;
  }
  setBusy(true);
  setStatus(t('loadingSlot', { slot }));
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
  setStatus(t('loadingName', { name: sampleName(sample) }));
  try {
    await installImage(slot, await prepareImage(sample.url), sampleName(sample), key);
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
    $('validation').textContent = t('check', { result: t(check.passed ? 'passed' : 'failed'), real: check.maxError.toExponential(2), imag: check.maxImaginary.toExponential(2) });
    if (!check.passed) {
      workerFailed = true;
      throw new Error(t('checkFailed'));
    }
    setStatus(t('loadingSamples'));
    // A failed sample never prevents users from supplying their own images.
    const samples = await Promise.allSettled([
      prepareImage(SAMPLE_IMAGES[DEFAULT_SAMPLES.A].url),
      prepareImage(SAMPLE_IMAGES[DEFAULT_SAMPLES.B].url),
    ]);
    for (const [index, slot] of ['A', 'B'].entries()) {
      if (samples[index].status === 'fulfilled') {
        const key = DEFAULT_SAMPLES[slot];
        await installImage(slot, samples[index].value, sampleName(SAMPLE_IMAGES[key]), key);
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
