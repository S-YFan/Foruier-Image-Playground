import test from 'node:test';
import assert from 'node:assert/strict';
import { FFT, fft2 } from '../js/fft.js';
import { analyzeRGB, reconstructChannel, reconstructRGB } from '../js/fourier.js';
import { fixtures, pixels, maxDifference } from './test-data.js';

const n = 256;
const fft = new FFT(n);
const cases = fixtures(n);
const spectra = Object.fromEntries(Object.entries(cases).map(([name, rgba]) => [name, analyzeRGB(rgba, fft)]));

test('regression: sparse diagonal/cosine phase donors must give real reconstructions', t => {
  let maximum = 0;
  for (const name of ['diagonal', 'cosine']) {
    const result = reconstructRGB(spectra.rgb, spectra[name], fft);
    maximum = Math.max(maximum, result.stats.maxImaginary);
  }
  t.diagnostic(`maximum sparse-spectrum imaginary residual = ${maximum}`);
  assert.ok(maximum < 1e-8, `Sparse phase donor imaginary residual: ${maximum}`);
});

test('all 256×256 fixture channels: FFT round-trip and magnitude+own-phase before clipping', t => {
  let roundTrip = 0, polar = 0, imaginary = 0, displayed = 0;
  for (const [name, rgba] of Object.entries(cases)) {
    for (let channel = 0; channel < 3; channel++) {
      const original = Float64Array.from({ length: n * n }, (_, i) => rgba[i * 4 + channel]);
      const real = original.slice();
      const imag = new Float64Array(n * n);
      fft2(real, imag, fft);
      fft2(real, imag, fft, true);
      roundTrip = Math.max(roundTrip, maxDifference(real, original));
      imaginary = Math.max(imaginary, maxDifference(imag, new Float64Array(n * n)));
      const reconstructed = reconstructChannel(spectra[name][channel].magnitude, spectra[name][channel].phase, fft);
      polar = Math.max(polar, maxDifference(reconstructed.real, original));
      imaginary = Math.max(imaginary, maxDifference(reconstructed.imag, new Float64Array(n * n)));
    }
    const displayedResult = reconstructRGB(spectra[name], spectra[name], fft);
    displayed = Math.max(displayed, maxDifference(displayedResult.rgba, rgba));
    assert.equal(displayedResult.stats.clippedFraction, 0, name);
  }
  t.diagnostic(JSON.stringify({ roundTrip, polar, imaginary, displayed }));
  assert.ok(roundTrip < 1e-8 && polar < 1e-8 && imaginary < 1e-8);
  assert.equal(displayed, 0);
});

test('all fixture pairs: finite two-way output and bounded imaginary residual', t => {
  let maximum = 0;
  for (const [a, sa] of Object.entries(spectra)) {
    for (const [b, sb] of Object.entries(spectra)) {
      const output = reconstructRGB(sa, sb, fft);
      assert.ok(Number.isFinite(output.stats.minimum) && Number.isFinite(output.stats.maximum), `${a}/${b}`);
      maximum = Math.max(maximum, output.stats.maxImaginary);
      assert.ok(output.stats.maxImaginary < 1e-8, `${a}/${b}: ${output.stats.maxImaginary}`);
      assert.ok(output.rgba.every((value, i) => i % 4 !== 3 || value === 255));
    }
  }
  t.diagnostic(`81 ordered pairs, maximum imaginary residual = ${maximum}`);
});

test('polar spectra have matching conjugate magnitudes and opposite phases, including tiny bins', () => {
  for (const [name, spectrum] of Object.entries(spectra)) {
    for (const { magnitude, phase } of spectrum) {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x, j = ((n - y) % n) * n + (n - x) % n;
        assert.ok(Math.abs(magnitude[i] - magnitude[j]) < 1e-7, `${name}: magnitude`);
        if (i !== j) assert.ok(Math.abs(Math.sin((phase[i] + phase[j]) / 2)) < 1e-12, `${name}: phase`);
        else assert.ok(phase[i] === 0 || Math.abs(phase[i]) === Math.PI, `${name}: self-conjugate`);
        if (magnitude[i] === 0) assert.equal(phase[i], 0);
      }
    }
  }
});

test('normalization is independently verified by DC, inverse DC and Parseval energy', t => {
  let relativeEnergyError = 0;
  for (let channel = 0; channel < 3; channel++) {
    const original = Float64Array.from({ length: n * n }, (_, i) => cases.rgb[i * 4 + channel]);
    const real = original.slice(), imag = new Float64Array(n * n);
    fft2(real, imag, fft);
    assert.equal(real[0], original.reduce((sum, value) => sum + value, 0));
    const spatial = original.reduce((sum, value) => sum + value * value, 0);
    const spectral = real.reduce((sum, value, i) => sum + value * value + imag[i] * imag[i], 0) / (n * n);
    relativeEnergyError = Math.max(relativeEnergyError, Math.abs(spatial - spectral) / spatial);
  }
  const real = new Float64Array(n * n), imag = new Float64Array(n * n);
  real[0] = n * n * 37;
  fft2(real, imag, fft, true);
  assert.ok(real.every(value => value === 37));
  assert.ok(imag.every(value => value === 0));
  assert.ok(relativeEnergyError < 1e-12);
  t.diagnostic(`Parseval relative energy error = ${relativeEnergyError}`);
});

test('black/white and grayscale behavior: no mixing or contrast stretching', () => {
  assert.deepEqual(reconstructRGB(spectra.black, spectra.white, fft).rgba, cases.black);
  assert.deepEqual(reconstructRGB(spectra.white, spectra.black, fft).rgba, cases.white);
  const gray = reconstructRGB(spectra.gray, spectra.cosine, fft).rgba;
  for (let i = 0; i < gray.length; i += 4) assert.ok(gray[i] === gray[i + 1] && gray[i] === gray[i + 2]);
  const lowContrast = pixels(n, (x, y, c) => 80 + c * 30 + (x + y) % 8);
  const lowSpectrum = analyzeRGB(lowContrast, fft);
  assert.deepEqual(reconstructRGB(lowSpectrum, lowSpectrum, fft).rgba, lowContrast);
});

test('changing only green leaves red and blue spectra and outputs unchanged', () => {
  const modified = cases.rgb.slice();
  for (let i = 0; i < modified.length; i += 4) modified[i + 1] = 255 - modified[i + 1];
  const spectrum = analyzeRGB(modified, fft);
  for (const c of [0, 2]) assert.deepEqual(spectrum[c], spectra.rgb[c]);
  const before = reconstructRGB(spectra.rgb, spectra.differentRGB, fft).rgba;
  const after = reconstructRGB(spectrum, spectra.differentRGB, fft).rgba;
  for (let i = 0; i < before.length; i += 4) {
    assert.equal(before[i], after[i]);
    assert.equal(before[i + 2], after[i + 2]);
  }
});
