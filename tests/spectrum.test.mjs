import test from 'node:test';
import assert from 'node:assert/strict';
import { FFT, fft2 } from '../js/fft.js';
import { SIZE, SHIFT, PRESETS, SQUARE_SIDE, STRIPE_PERIOD, PHASE_RELATIVE_THRESHOLD,
  createPreset, circularShift, analyzeGray, fftshift, phaseColor, renderSpectra, compareShift } from '../js/spectrum.js';

const fft = new FFT(SIZE);
const spectra = new Map();
for (const preset of PRESETS) {
  test(`${preset.name}: 256² binary geometry, finite FFT and faithful log/phase display`, () => {
    const pixels = createPreset(preset.id);
    assert.equal(pixels.length, SIZE ** 2);
    let black = 0, total = 0;
    for (const value of pixels) { assert.ok(value === 0 || value === 255); black += value === 0; total += value; }
    if (preset.id.includes('square')) assert.equal(black, SQUARE_SIDE ** 2);
    if (preset.id === 'circle') {
      assert.ok(Math.abs(black - Math.PI * 40 ** 2) < 100);
      assert.equal(pixels[128 * SIZE + 128], 0);
      assert.equal(pixels[128 * SIZE + 87], 255);
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        assert.equal(pixels[y * SIZE + x], pixels[x * SIZE + SIZE - 1 - y], 'quarter-turn symmetry');
      }
    }
    if (preset.id === 'stripes') {
      assert.equal(black, SIZE ** 2 / 2);
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        assert.equal(pixels[y * SIZE + x], pixels[(x + STRIPE_PERIOD) % SIZE]);
      }
    }
    const original = pixels.slice();
    const spectrum = analyzeGray(pixels, fft);
    spectra.set(preset.id, spectrum);
    assert.deepEqual(pixels, original);
    assert.equal(spectrum.real[0], total, 'unscaled forward DC equals pixel sum');
    const saved = structuredClone(spectrum);
    const display = renderSpectra(spectrum);
    for (const field of ['real', 'imag', 'magnitude', 'phase']) assert.ok(spectrum[field].every(Number.isFinite));
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const source = ((y + SIZE / 2) % SIZE) * SIZE + (x + SIZE / 2) % SIZE;
      const i = y * SIZE + x;
      const value = 255 * Math.log1p(spectrum.magnitude[source]) / Math.log1p(spectrum.maxMagnitude);
      assert.ok(Number.isFinite(value));
      assert.equal(display.magnitude[4 * i], Math.round(value));
      const color = spectrum.magnitude[source] <= display.threshold ? [70, 76, 72] : phaseColor(Math.atan2(spectrum.imag[source], spectrum.real[source]));
      assert.deepEqual([...display.phase.subarray(4 * i, 4 * i + 3)], color);
      assert.equal(display.phase[4 * i + 3], 255);
    }
    assert.ok(display.magnitude.every(Number.isFinite) && display.phase.every(Number.isFinite));
    assert.deepEqual(spectrum, saved, 'rendering never changes cached coefficients or indices');
    const real = spectrum.real.slice(), imag = spectrum.imag.slice();
    fft2(real, imag, fft, true);
    for (let i = 0; i < pixels.length; i++) assert.ok(Math.abs(real[i] - pixels[i]) < 1e-8 && Math.abs(imag[i]) < 1e-8);
  });
}

test('Square boundaries and Shifted Square are exact translated pixels, without clipping', () => {
  const square = createPreset('square'), shifted = createPreset('shifted-square');
  const start = (SIZE - SQUARE_SIDE) / 2;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = y * SIZE + x;
    assert.equal(square[i], x >= start && x < start + SQUARE_SIDE && y >= start && y < start + SQUARE_SIDE ? 0 : 255);
    assert.equal(shifted[i], square[((y - SHIFT.y + SIZE) % SIZE) * SIZE + (x - SHIFT.x + SIZE) % SIZE]);
    if (shifted[i] === 0) assert.ok(x >= start + SHIFT.x && x < start + SHIFT.x + SQUARE_SIDE && y >= start + SHIFT.y && y < start + SHIFT.y + SQUARE_SIDE);
    if (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1) assert.equal(shifted[i], 255);
  }
  assert.deepEqual(circularShift(shifted, SIZE, -SHIFT.x, -SHIFT.y), square);
  assert.deepEqual(circularShift(square, SIZE, SIZE, -SIZE), square);
  assert.throws(() => circularShift(square, SIZE, .5, 0), RangeError);
  assert.throws(() => createPreset('unknown'), RangeError);
});

test('fftshift moves DC and all quadrants into a fresh array; is reversible for even size', () => {
  const source = Float64Array.from({ length: 16 }, (_, i) => i);
  const before = source.slice();
  const result = fftshift(source, 4);
  assert.deepEqual([...result], [10, 11, 8, 9, 14, 15, 12, 13, 2, 3, 0, 1, 6, 7, 4, 5]);
  assert.equal(result[2 * 4 + 2], source[0]);
  assert.deepEqual(fftshift(result, 4), source);
  assert.deepEqual(source, before);
  result[0] = -1;
  assert.deepEqual(source, before, 'no aliased storage');
  assert.throws(() => fftshift(new Float64Array(9), 3), RangeError);
});

test('Fourier Shift Theorem holds at every complex bin, including zeros and Nyquist', t => {
  const a = spectra.get('square'), b = spectra.get('shifted-square');
  const result = compareShift(a, b);
  assert.ok(result.maxMagnitudeDifference < 1e-7, JSON.stringify(result));
  assert.ok(result.relativeMagnitudeDifference < 1e-12);
  assert.ok(result.maxCoefficientError < 1e-7, JSON.stringify(result));
  let phaseChange = 0;
  for (let i = 0; i < SIZE ** 2; i++) {
    if (a.magnitude[i] > a.maxMagnitude * PHASE_RELATIVE_THRESHOLD) {
      const u = i % SIZE, v = Math.floor(i / SIZE);
      const delta = b.phase[i] - a.phase[i];
      const expected = -2 * Math.PI * (u * SHIFT.x + v * SHIFT.y) / SIZE;
      assert.ok(Math.abs(Math.sin(delta) - Math.sin(expected)) < 1e-10);
      assert.ok(Math.abs(Math.cos(delta) - Math.cos(expected)) < 1e-10);
      phaseChange = Math.max(phaseChange, Math.abs(Math.sin(delta)));
    }
  }
  assert.ok(phaseChange > .5, 'phase must actually change');
  assert.ok(compareShift(a, b, SIZE, { x: -SHIFT.x, y: -SHIFT.y }).maxCoefficientError > 1e6, 'wrong shift sign cannot pass');
  t.diagnostic(JSON.stringify(result));
});

test('selected FFT coefficients match independent direct DFT, not just a second FFT', () => {
  for (const preset of PRESETS) {
    const pixels = createPreset(preset.id), spectrum = spectra.get(preset.id);
    for (const [u, v] of [[0, 0], [1, 0], [0, 3], [7, 5], [8, 0], [128, 128]]) {
      let real = 0, imag = 0;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const angle = -2 * Math.PI * (u * x + v * y) / SIZE;
        real += pixels[y * SIZE + x] * Math.cos(angle);
        imag += pixels[y * SIZE + x] * Math.sin(angle);
      }
      assert.ok(Math.hypot(real - spectrum.real[v * SIZE + u], imag - spectrum.imag[v * SIZE + u]) < 1e-6, `${preset.id} (${u},${v})`);
    }
  }
});

test('vertical stripes concentrate energy at DC and horizontal odd harmonics of 8 bins', () => {
  const { magnitude, maxMagnitude } = spectra.get('stripes');
  const fundamental = SIZE / STRIPE_PERIOD;
  assert.ok(magnitude[fundamental] > 1e6 && magnitude[SIZE - fundamental] > 1e6);
  for (let v = 0; v < SIZE; v++) for (let u = 0; u < SIZE; u++) {
    const allowed = v === 0 && (u === 0 || (u % fundamental === 0 && (u / fundamental) % 2 === 1));
    if (!allowed) assert.ok(magnitude[v * SIZE + u] <= maxMagnitude * 1e-12);
  }
});

test('cyclic phase color has periodic endpoints and wraps across multiple turns', () => {
  assert.deepEqual(phaseColor(-Math.PI), phaseColor(Math.PI));
  assert.deepEqual(phaseColor(0), [0, 255, 255]);
  assert.deepEqual(phaseColor(Math.PI), [255, 0, 0]);
  for (const angle of [-3.1, -1, .3, 1.8, 3]) for (const turns of [-5, -1, 1, 7]) {
    assert.deepEqual(phaseColor(angle), phaseColor(angle + turns * 2 * Math.PI));
  }
  const a = phaseColor(-Math.PI + 1e-7), b = phaseColor(Math.PI - 1e-7);
  assert.ok(a.every((value, i) => Math.abs(value - b[i]) <= 1));
});

test('zero/near-zero phase is neutral only in display; raw coefficients remain intact', () => {
  const spectrum = analyzeGray(new Float64Array([1, 0, 0, 0]), new FFT(2));
  spectrum.magnitude.set([1, 0, .5e-10, 2e-10]);
  spectrum.phase.fill(.7);
  const before = structuredClone(spectrum);
  const result = renderSpectra(spectrum, 2);
  assert.equal(result.threshold, 1e-10);
  assert.equal(result.maskedBins, 2);
  assert.deepEqual([...result.phase.subarray(0, 3)], phaseColor(.7));
  assert.deepEqual([...result.phase.subarray(4, 7)], [70, 76, 72]);
  assert.deepEqual(spectrum, before);
  const black = renderSpectra(analyzeGray(new Uint8Array(SIZE ** 2)));
  assert.equal(black.maskedBins, SIZE ** 2);
  for (let i = 0; i < SIZE ** 2; i++) {
    assert.equal(black.magnitude[i * 4], 0);
    assert.deepEqual([...black.phase.subarray(i * 4, i * 4 + 3)], [70, 76, 72]);
  }
});
