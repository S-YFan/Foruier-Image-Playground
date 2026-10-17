import { FFT } from './fft.js';
import { SIZE, createPreset, analyzeGray, grayRGBA, renderSpectra, compareShift } from './spectrum.js';
import { createTranslationReference, displayTranslation } from './translation.js';

const fft = new FFT(SIZE);
// At most four fixed presets; display buffers are fresh transferable copies.
const cache = new Map();
let translationReference, geometryCache;
function get(id) {
  if (!cache.has(id)) {
    const pixels = createPreset(id);
    cache.set(id, { pixels, spectrum: analyzeGray(pixels, fft) });
  }
  return cache.get(id);
}
function display(id) {
  const { pixels, spectrum } = get(id);
  const { magnitude, phase, threshold, maskedBins } = renderSpectra(spectrum);
  return { id, spatial: grayRGBA(pixels), magnitude, phase,
    stats: { dc: spectrum.real[0], maxMagnitude: spectrum.maxMagnitude, threshold, maskedBins } };
}

self.onmessage = ({ data }) => {
  const { id, type, preset, params = {} } = data;
  try {
    let result;
    if (type === 'preset') result = display(preset);
    else if (type === 'compare') result = {
      square: display('square'), shifted: display('shifted-square'),
      ...compareShift(get('square').spectrum, get('shifted-square').spectrum),
    };
    else if (type === 'experiment') {
      if (preset === 'shifted-square') {
        translationReference ??= createTranslationReference(fft);
        result = displayTranslation(params.dx ?? 0, params.dy ?? 0, translationReference, fft);
      } else {
        const key = JSON.stringify([preset, params]);
        if (geometryCache?.key !== key) {
          const pixels = createPreset(preset, params);
          geometryCache = { key, pixels, spectrum: analyzeGray(pixels, fft) };
        }
        const { pixels, spectrum } = geometryCache;
        const rendered = renderSpectra(spectrum);
        result = { kind: 'geometry', preset, params, spatial: grayRGBA(pixels), magnitude: rendered.magnitude, phase: rendered.phase,
          stats: { dc: spectrum.real[0], threshold: rendered.threshold, maskedBins: rendered.maskedBins } };
      }
    } else throw new Error('Unknown spectrum request.');
    const transfers = [];
    if (type === 'compare') {
      for (const item of [result.square, result.shifted]) transfers.push(item.spatial.buffer, item.magnitude.buffer, item.phase.buffer);
    } else {
      for (const value of Object.values(result)) if (ArrayBuffer.isView(value)) transfers.push(value.buffer);
    }
    self.postMessage({ id, result }, transfers);
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
