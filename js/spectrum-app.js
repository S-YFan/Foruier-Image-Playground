import { t, errorMessage, language } from './i18n.js';
import { SIZE, PERIODS, phaseColor, phaseChangeColor } from './spectrum.js';

const get = id => document.getElementById(id);
const buttons = [...document.querySelectorAll('[data-preset]')];
const state = { preset: 'shifted-square', square: { side: 64 }, circle: { radius: 40 }, stripes: { period: 32 }, 'shifted-square': { dx: 0, dy: 0 } };
let worker, nextId = 0, revision = 0, running = false;
const pending = new Map();
const signed = value => value > 0 ? '+' + value : String(value);
const mobileLayout = window.matchMedia('(max-width: 760px)');

// Move the existing controls beside the main result on phones; keep all inputs,
// listeners and rendered canvases intact when switching modes or resizing.
function placeControls() {
  let host = mobileLayout.matches
    ? get(state.preset === 'shifted-square' ? 'translation-controls-host' : 'geometry-controls-host')
    : get('controls-home');
  // A mode change may fail before its view is rendered. Keep its controls
  // visible in the original position so the user can adjust and retry.
  if (host.closest('[hidden]')) host = get('controls-home');
  const panel = get('lab-controls');
  if (panel.parentElement !== host) host.append(panel);
}
mobileLayout.addEventListener('change', placeControls);

function status(message, error = false) {
  get('lab-status').textContent = error ? errorMessage(message) : message;
  get('lab-status').parentElement.classList.toggle('is-error', error);
}
function request(preset, params) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(t('timeout'))); }, 15000);
    pending.set(id, { resolve, reject, timer });
    try { worker.postMessage({ id, type: 'experiment', preset, params }); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}
function paint(id, rgba) {
  get(id).getContext('2d').putImageData(new ImageData(rgba, SIZE, SIZE), 0, 0);
}
function controls() {
  placeControls();
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.preset === state.preset));
  for (const panel of document.querySelectorAll('[data-controls]')) panel.hidden = panel.dataset.controls !== state.preset;
  get('shift-x-value').textContent = signed(state['shifted-square'].dx) + ' px';
  get('shift-y-value').textContent = signed(state['shifted-square'].dy) + ' px';
  get('side-value').textContent = state.square.side + ' px';
  get('radius-value').textContent = state.circle.radius + ' px';
  get('period-value').textContent = t('period', { pixels: state.stripes.period, cycles: SIZE / state.stripes.period });
}
function render(result, renderedRevision) {
  const translation = result.kind === 'translation';
  get('translation-view').hidden = !translation;
  get('geometry-view').hidden = translation;
  placeControls();
  if (translation) {
    for (const [id, key] of Object.entries({
      'translation-original': 'original', 'translation-shifted': 'shifted', 'translation-reconstructed': 'reconstructed',
      'original-magnitude': 'originalMagnitude', 'shifted-magnitude': 'shiftedMagnitude',
      'phase-difference': 'phaseDifference', 'phase-change': 'phaseChange',
    })) paint(id, result[key]);
    get('rendered-shift').textContent = '(' + signed(result.params.dx) + ', ' + signed(result.params.dy) + ') px';
    get('magnitude-difference').textContent = result.stats.maxMagnitudeDifference.toExponential(3);
    get('magnitude-difference').dataset.value = result.stats.maxMagnitudeDifference;
    get('reconstruction-error').textContent = result.stats.maxError.toExponential(3);
    get('reconstruction-error').dataset.value = result.stats.maxError;
    get('pixel-error').textContent = result.stats.displayedError + ' / 255';
    get('phase-mask').textContent = t('phaseMask', { bins: result.stats.validBins.toLocaleString(language), threshold: result.stats.threshold.toExponential(3) });
    get('translation-numerics').textContent = t('translationNumerics', { magnitude: result.stats.relativeMagnitudeDifference.toExponential(3), coefficient: result.stats.maxCoefficientError.toExponential(3), imag: result.stats.maxImaginary.toExponential(3) });
    get('lab-images').dataset.dx = result.params.dx;
    get('lab-images').dataset.dy = result.params.dy;
    status(t('shiftReady', { x: signed(result.params.dx), y: signed(result.params.dy) }));
  } else {
    for (const key of ['spatial', 'magnitude', 'phase']) paint('lab-' + key, result[key]);
    const descriptions = {
      square: [t('squareName', { side: result.params.side }), t('squareNote')],
      circle: [t('circleName', { radius: result.params.radius }), t('circleNote')],
      stripes: [t('stripesName', { period: result.params.period }), t('stripesNote', { cycles: SIZE / result.params.period })],
    };
    const [name, note] = descriptions[result.preset];
    get('preset-name').textContent = name;
    get('preset-note').textContent = note;
    get('dc-value').textContent = 'DC = ' + result.stats.dc.toLocaleString();
    get('geometry-mask').textContent = t('geometryMask', { threshold: result.stats.threshold.toExponential(3), bins: result.stats.maskedBins.toLocaleString(language) });
    status(t('geometryReady', { name }));
  }
  get('lab-images').dataset.preset = result.preset;
  get('lab-images').dataset.params = JSON.stringify(result.params);
  get('lab-images').dataset.revision = renderedRevision;
}

// One in-flight request + the latest desired state. Sliders stay interactive.
// Superseded responses are discarded before any canvas or number is painted.
async function pump() {
  if (running) return;
  running = true;
  const current = revision, preset = state.preset, params = { ...state[preset] };
  try {
    const result = await request(preset, params);
    if (current === revision) render(result, current);
  } catch (error) { if (current === revision) status(error.message, true); }
  finally {
    running = false;
    if (current !== revision) void pump();
    else get('lab-images').setAttribute('aria-busy', 'false');
  }
}
function update() {
  controls();
  revision++;
  get('lab-images').dataset.requestRevision = revision;
  get('lab-images').setAttribute('aria-busy', 'true');
  status(t('updating'));
  void pump();
}
for (const button of buttons) button.addEventListener('click', () => { state.preset = button.dataset.preset; update(); });
for (const [id, preset, key] of [['shift-x', 'shifted-square', 'dx'], ['shift-y', 'shifted-square', 'dy'], ['side-length', 'square', 'side'], ['circle-radius', 'circle', 'radius'], ['stripe-period', 'stripes', 'period']]) {
  get(id).addEventListener('input', event => {
    const value = Number(event.target.value);
    state[preset][key] = id === 'stripe-period' ? PERIODS[value] : value;
    update();
  });
}
for (const id of ['phase-legend', 'difference-legend', 'change-legend']) {
  const context = get(id).getContext('2d');
  for (let x = 0; x < 256; x++) {
    const color = id === 'change-legend' ? phaseChangeColor(2 * x / 255) : phaseColor(-Math.PI + 2 * Math.PI * x / 255);
    context.fillStyle = 'rgb(' + color.join(',') + ')';
    context.fillRect(x, 0, 1, 12);
  }
}
try {
  worker = new Worker(new URL('./spectrum-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const job = pending.get(data.id);
    if (!job) return;
    clearTimeout(job.timer);
    pending.delete(data.id);
    data.error ? job.reject(new Error(data.error)) : job.resolve(data.result);
  };
  worker.onerror = event => {
    event.preventDefault();
    const error = new Error(t('workerSpectrum'));
    for (const job of pending.values()) { clearTimeout(job.timer); job.reject(error); }
    pending.clear();
    status(error.message, true);
  };
  update();
} catch (error) { status(error.message, true); }
