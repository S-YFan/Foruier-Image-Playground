import { SIZE, SQUARE_SIDE, createPreset, circularShift, analyzeGray, reconstructionPolar,
  reconstructPosition, phaseDifference, renderPhaseDifference, renderSpectra, grayRGBA,
  compareShift, validateTranslation } from './spectrum.js';

export function createTranslationReference(fft) {
  const pixels = createPreset('square');
  return { pixels, spectrum: analyzeGray(pixels, fft), polar: reconstructionPolar(pixels, fft) };
}

export function analyzeTranslation(dx, dy, reference, fft) {
  validateTranslation(dx, dy);
  const pixels = circularShift(reference.pixels, SIZE, dx, dy);
  const spectrum = analyzeGray(pixels, fft);
  const delta = phaseDifference(reference.spectrum, spectrum);
  const reconstruction = reconstructPosition(reference.polar, reconstructionPolar(pixels, fft), pixels, fft);
  return { pixels, spectrum, delta, reconstruction,
    metrics: compareShift(reference.spectrum, spectrum, SIZE, { x: dx, y: dy }) };
}

export function displayTranslation(dx, dy, reference, fft) {
  const result = analyzeTranslation(dx, dy, reference, fft);
  // One shared scale for both magnitude images, anchored to the fixed reference.
  const scale = reference.spectrum.maxMagnitude;
  const original = renderSpectra(reference.spectrum, SIZE, scale);
  const shifted = renderSpectra(result.spectrum, SIZE, scale);
  const delta = renderPhaseDifference(result.delta);
  return { kind: 'translation', preset: 'shifted-square', params: { dx, dy }, side: SQUARE_SIDE,
    original: grayRGBA(reference.pixels), shifted: grayRGBA(result.pixels), reconstructed: result.reconstruction.rgba,
    originalMagnitude: original.magnitude, shiftedMagnitude: shifted.magnitude,
    phaseDifference: delta.difference, phaseChange: delta.change,
    stats: { ...result.metrics, ...result.reconstruction.stats, magnitudeScale: scale,
      threshold: result.delta.threshold, validBins: result.delta.validBins, maxChange: result.delta.maxChange } };
}
