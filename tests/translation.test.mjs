import test from 'node:test';
import assert from 'node:assert/strict';
import { FFT } from '../js/fft.js';
import { SIZE, SHIFT_LIMIT, PERIODS, NEUTRAL, createPreset, circularShift, analyzeGray, phaseDifference,
  renderPhaseDifference, phaseColor, phaseChangeColor, renderSpectra, validateTranslation } from '../js/spectrum.js';
import { createTranslationReference, analyzeTranslation, displayTranslation } from '../js/translation.js';

const fft = new FFT(SIZE);
const reference = createTranslationReference(fft);

test('translation: all legal axis values, signs, parity and corner shifts preserve magnitude and reconstruct position', { timeout: 60000 }, t => {
  const samples = new Map();
  for (let x = -SHIFT_LIMIT; x <= SHIFT_LIMIT; x++) {
    const y = ((x + SHIFT_LIMIT) * 37 % (2 * SHIFT_LIMIT + 1)) - SHIFT_LIMIT;
    samples.set(`${x},${y}`, [x, y]);
  }
  for (const pair of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [32, 24], [-96, -96], [-96, 96], [96, -96], [96, 96]]) samples.set(pair.join(','), pair);
  const metrics = { samples: samples.size, magnitude: 0, relativeMagnitude: 0, coefficient: 0, reconstruction: 0, imaginary: 0, displayed: 0, phaseUnitCircle: 0 };
  for (const [dx, dy] of samples.values()) {
    const result = analyzeTranslation(dx, dy, reference, fft);
    metrics.magnitude = Math.max(metrics.magnitude, result.metrics.maxMagnitudeDifference);
    metrics.relativeMagnitude = Math.max(metrics.relativeMagnitude, result.metrics.relativeMagnitudeDifference);
    metrics.coefficient = Math.max(metrics.coefficient, result.metrics.maxCoefficientError);
    metrics.reconstruction = Math.max(metrics.reconstruction, result.reconstruction.stats.maxError);
    metrics.imaginary = Math.max(metrics.imaginary, result.reconstruction.stats.maxImaginary);
    metrics.displayed = Math.max(metrics.displayed, result.reconstruction.stats.displayedError);
    for (let i = 0; i < SIZE ** 2; i++) {
      const x = i % SIZE, y = Math.floor(i / SIZE);
      assert.equal(result.pixels[i], reference.pixels[((y - dy + SIZE) % SIZE) * SIZE + (x - dx + SIZE) % SIZE]);
      if (!result.delta.valid[i]) continue;
      const expected = -2 * Math.PI * (x * dx + y * dy) / SIZE;
      const actual = result.delta.difference[i];
      metrics.phaseUnitCircle = Math.max(metrics.phaseUnitCircle, Math.hypot(Math.cos(actual) - Math.cos(expected), Math.sin(actual) - Math.sin(expected)));
      assert.ok(result.delta.change[i] >= 0 && result.delta.change[i] <= 2);
    }
  }
  t.diagnostic(JSON.stringify(metrics));
  assert.ok(metrics.magnitude < 1e-7, JSON.stringify(metrics));
  assert.ok(metrics.relativeMagnitude < 1e-12);
  assert.ok(metrics.coefficient < 1e-7);
  assert.ok(metrics.reconstruction < 1e-8);
  assert.ok(metrics.imaginary < 1e-8);
  assert.equal(metrics.displayed, 0);
  assert.ok(metrics.phaseUnitCircle < 1e-10);
});

test('translation: zero shift has exactly zero phase change on valid bins, distinct from the joint neutral mask', () => {
  const result = analyzeTranslation(0, 0, reference, fft);
  const saved = structuredClone(result.delta);
  const rendered = renderPhaseDifference(result.delta);
  assert.ok(result.delta.validBins > 0 && result.delta.validBins < SIZE ** 2);
  for (let i = 0; i < SIZE ** 2; i++) if (result.delta.valid[i]) {
    assert.equal(result.delta.difference[i], 0);
    assert.equal(result.delta.change[i], 0);
  }
  // DC moves to the center in both maps; an off-axis exact zero is neutral.
  const center = (128 * SIZE + 128) * 4;
  assert.deepEqual([...rendered.change.subarray(center, center + 3)], phaseChangeColor(0));
  assert.notDeepEqual(phaseChangeColor(0), NEUTRAL);
  assert.deepEqual(result.delta, saved, 'visualization does not mutate raw phase differences');
});

test('translation: arg(G conjugate(F)) handles ±π, full turns and asymmetric near-zero magnitudes', () => {
  const make = (angles, magnitudes) => ({ real: Float64Array.from(angles, (a, i) => magnitudes[i] * Math.cos(a)), imag: Float64Array.from(angles, (a, i) => magnitudes[i] * Math.sin(a)), magnitude: Float64Array.from(magnitudes), maxMagnitude: 1 });
  const original = make([Math.PI - .01, 0, .7, 0], [1, 0, 1, 1e-12]);
  const shifted = make([-Math.PI + .01, 1, .7 + 8 * Math.PI, 1], [1, 1, 1e-12, 1]);
  const before = structuredClone([original, shifted]);
  const delta = phaseDifference(original, shifted);
  assert.ok(Math.abs(delta.difference[0] - .02) < 1e-14);
  assert.deepEqual([...delta.valid], [1, 0, 0, 0], 'either input below threshold masks both maps');
  const rendered = renderPhaseDifference(delta, 2);
  let masked = 0;
  for (let i = 0; i < 4; i++) {
    const a = [...rendered.difference.subarray(i * 4, i * 4 + 3)], b = [...rendered.change.subarray(i * 4, i * 4 + 3)];
    if (a.every((v, c) => v === NEUTRAL[c])) { assert.deepEqual(b, NEUTRAL); masked++; }
  }
  assert.equal(masked, 3);
  assert.deepEqual([original, shifted], before);
  const unit = phaseDifference(make([.4, 0, 0, 0], [1, 1, 1, 1]), make([.4 + 10 * Math.PI, Math.PI, 0, -Math.PI], [1, 1, 1, 1]));
  assert.ok(unit.change[0] < 1e-14);
  assert.equal(unit.change[1], 2);
  assert.equal(unit.change[2], 0);
  assert.equal(unit.change[3], 2);
  assert.deepEqual(phaseColor(-Math.PI), phaseColor(Math.PI));
});

test('translation: phase-change display uses the absolute 0–2 scale, not per-frame normalization', () => {
  const input = { difference: Float64Array.from([0, .01, 1, Math.PI]), change: Float64Array.from([0, .01, 1, 2]), valid: new Uint8Array(4).fill(1) };
  const rendered = renderPhaseDifference(input, 2);
  assert.deepEqual([...rendered.change.subarray(0, 3)], phaseChangeColor(2));
  assert.deepEqual([...rendered.change.subarray(8, 11)], phaseChangeColor(.01));
  const next = { ...input, change: Float64Array.from([0, .01, .02, .03]) };
  assert.deepEqual([...renderPhaseDifference(next, 2).change.subarray(8, 11)], phaseChangeColor(.01));
  assert.ok(phaseChangeColor(.01)[0] < 20, 'tiny values must stay near black');
});

test('translation: magnitude displays share the fixed reference scale; all seven buffers are real calculated results', () => {
  const result = displayTranslation(31, -17, reference, fft);
  assert.equal(result.stats.magnitudeScale, reference.spectrum.maxMagnitude);
  assert.deepEqual(result.originalMagnitude, renderSpectra(reference.spectrum).magnitude);
  const moved = circularShift(reference.pixels, SIZE, 31, -17);
  assert.deepEqual(result.shiftedMagnitude, renderSpectra(analyzeGray(moved, fft), SIZE, reference.spectrum.maxMagnitude).magnitude);
  assert.deepEqual(result.reconstructed, result.shifted);
  assert.notDeepEqual(result.reconstructed, result.original);
  assert.notEqual(result.reconstructed.buffer, result.shifted.buffer, 'separate IFFT display allocation');
  for (const value of Object.values(result)) if (ArrayBuffer.isView(value)) assert.ok(value.every(Number.isFinite));
  for (const [x, y] of [[.5, 0], [0, NaN], [97, 0], [0, -97]]) assert.throws(() => validateTranslation(x, y), RangeError);
});

test('geometry controls: full legal side/radius ranges and discrete stripe periods produce changing spectra', () => {
  let last = null;
  for (const side of [16, 32, 64, 96, 160]) {
    const pixels = createPreset('square', { side });
    assert.equal(pixels.reduce((n, v) => n + (v === 0), 0), side ** 2);
    const spectrum = analyzeGray(pixels, fft);
    assert.equal(spectrum.real[0], (SIZE ** 2 - side ** 2) * 255);
    if (last) assert.notDeepEqual(spectrum.magnitude, last);
    last = spectrum.magnitude;
  }
  let previousCount = 0;
  for (const radius of [8, 20, 40, 64, 96]) {
    const pixels = createPreset('circle', { radius });
    const black = pixels.reduce((n, v) => n + (v === 0), 0);
    assert.ok(black > previousCount && Math.abs(black - Math.PI * radius ** 2) < 2 * Math.PI * radius);
    previousCount = black;
    assert.ok(analyzeGray(pixels, fft).magnitude.every(Number.isFinite));
  }
  for (const period of PERIODS) {
    assert.equal(SIZE % period, 0);
    const pixels = createPreset('stripes', { period }), spectrum = analyzeGray(pixels, fft), k = SIZE / period;
    assert.ok(spectrum.magnitude[k] > 1e6 && spectrum.magnitude[SIZE - k] > 1e6);
    for (let i = 1; i < SIZE ** 2; i++) {
      if (i < SIZE && i % k === 0 && (i / k) % 2 === 1) continue;
      assert.ok(spectrum.magnitude[i] < 1e-7);
    }
  }
  assert.throws(() => createPreset('square', { side: 65 }), RangeError);
  assert.throws(() => createPreset('circle', { radius: 97 }), RangeError);
  assert.throws(() => createPreset('stripes', { period: 30 }), RangeError);
});
