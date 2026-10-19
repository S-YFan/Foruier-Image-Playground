import test from 'node:test';
import assert from 'node:assert/strict';
import { FFT } from '../js/fft.js';
import { analyzeRGB } from '../js/fourier.js';
import { gaussianLowPassMask, filterRGB, displayFilteredRGB } from '../js/filtering.js';

const rgbaFixture = n => Uint8ClampedArray.from({ length: n * n * 4 }, (_, i) =>
  i % 4 === 3 ? 255 : (i * 37 + Math.floor(i / (4 * n)) * 19) % 256);
function close(actual, expected, tolerance = 1e-8) {
  assert.equal(actual.length, expected.length);
  let error = 0;
  for (let i = 0; i < actual.length; i++) error = Math.max(error, Math.abs(actual[i] - expected[i]));
  assert.ok(error < tolerance, `Maximum error: ${error}`);
  return error;
}

// Independent tiny direct DFT, centered Gaussian mask + ifftshift, direct IFFT.
// This follows NumPy's equations without using the production FFT or mask.
function reference(input, n, sigma, alpha, type) {
  const spectrum = [];
  const centered = [];
  for (let v = -n / 2; v < n / 2; v++) for (let u = -n / 2; u < n / 2; u++) {
    centered.push(Math.exp(-(u * u + v * v) / (2 * (sigma * n / 1000) ** 2)));
  }
  for (let v = 0; v < n; v++) for (let u = 0; u < n; u++) {
    let re = 0, im = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const angle = -2 * Math.PI * (u * x + v * y) / n;
      re += input[y * n + x] * Math.cos(angle);
      im += input[y * n + x] * Math.sin(angle);
    }
    const low = centered[((v + n / 2) % n) * n + (u + n / 2) % n];
    const gain = type === 'lpf' ? low : type === 'hpf' ? 1 - low : 1 + alpha * (1 - low);
    spectrum.push([re * gain, im * gain]);
  }
  return Float64Array.from({ length: n * n }, (_, i) => {
    let real = 0;
    for (let v = 0; v < n; v++) for (let u = 0; u < n; u++) {
      const angle = 2 * Math.PI * (u * (i % n) + v * Math.floor(i / n)) / n;
      const [re, im] = spectrum[v * n + u];
      real += re * Math.cos(angle) - im * Math.sin(angle);
    }
    return real / (n * n);
  });
}

test('Gaussian mask: native bin layout, DC, Nyquist, conjugate symmetry and resolution convention', () => {
  for (const n of [8, 32, 256]) {
    const mask = gaussianLowPassMask(n);
    assert.equal(mask[0], 1);
    assert.ok(Math.abs(mask[n / 2] / Math.exp(-(500 ** 2) / (2 * 30 ** 2)) - 1) < 1e-12);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      assert.equal(mask[y * n + x], mask[((n - y) % n) * n + (n - x) % n]);
    }
  }
  assert.equal(gaussianLowPassMask(64, 100)[8], gaussianLowPassMask(256, 100)[32]);
  for (const sigma of [0, -1, NaN, Infinity]) assert.throws(() => gaussianLowPassMask(8, sigma), RangeError);
  assert.throws(() => gaussianLowPassMask(7), RangeError);
});

test('all RGB filtered reconstructions match independent centered-mask DFT / IFFT equations', t => {
  const n = 8, fft = new FFT(n), input = rgbaFixture(n);
  const spectrum = analyzeRGB(input, fft);
  const saved = structuredClone(spectrum);
  let maximum = 0;
  for (const [sigma, alpha] of [[30, 1], [120, 2.5], [200, 0]]) {
    const result = filterRGB(spectrum, fft, { sigma, alpha });
    for (const type of ['lpf', 'hpf', 'sharpen']) for (let c = 0; c < 3; c++) {
      const pixels = Float64Array.from({ length: n * n }, (_, i) => input[4 * i + c]);
      maximum = Math.max(maximum, close(result[type][c].real, reference(pixels, n, sigma, alpha, type)));
      close(result[type][c].imag, new Float64Array(n * n));
    }
  }
  assert.deepEqual(spectrum, saved, 'filtering must not modify cached source spectra');
  t.diagnostic(`Independent DFT / centered mask / IFFT maximum error = ${maximum}`);
});

test('LPF attenuates high frequencies and becomes smoother as sigma decreases; HPF removes DC', () => {
  const n = 64, fft = new FFT(n);
  const pixels = Uint8ClampedArray.from({ length: n * n * 4 }, (_, i) => {
    if (i % 4 === 3) return 255;
    const x = Math.floor(i / 4) % n;
    return Math.round(128 + 30 * Math.cos(2 * Math.PI * 2 * x / n) + 30 * Math.cos(2 * Math.PI * 16 * x / n));
  });
  const spectrum = analyzeRGB(pixels, fft);
  const amplitude = (real, k) => Math.abs(real.reduce((sum, value, i) => sum + value * Math.cos(2 * Math.PI * k * (i % n) / n), 0)) * 2 / real.length;
  let previous = -1;
  for (const sigma of [10, 30, 80, 200]) {
    const { lpf, hpf } = filterRGB(spectrum, fft, { sigma });
    const lowAmplitude = amplitude(lpf[0].real, 2), highAmplitude = amplitude(lpf[0].real, 16);
    assert.ok(highAmplitude < lowAmplitude);
    assert.ok(highAmplitude + 1e-10 >= previous, 'allow floating-point dust below the measured response');
    previous = highAmplitude;
    assert.ok(Math.abs(hpf[0].real.reduce((a, b) => a + b, 0) / (n * n)) < 1e-10);
    assert.ok(amplitude(hpf[0].real, 2) < amplitude(hpf[0].real, 16));
  }
  const constant = new Uint8ClampedArray(n * n * 4).fill(96);
  const output = filterRGB(analyzeRGB(constant, fft), fft);
  close(output.lpf[0].real, new Float64Array(n * n).fill(96));
  close(output.hpf[0].real, new Float64Array(n * n));
  assert.ok(displayFilteredRGB(output.hpf, 'hpf').every((value, i) => value === (i % 4 === 3 ? 255 : 128)));
});

test('alpha=0 preserves exact displayed RGB; alpha scales only high-frequency contribution', t => {
  let imaginary = 0, identityError = 0;
  for (const n of [8, 64, 256]) {
    const fft = new FFT(n), pixels = rgbaFixture(n), spectrum = analyzeRGB(pixels, fft);
    const zero = filterRGB(spectrum, fft, { alpha: 0 });
    const one = filterRGB(spectrum, fft, { alpha: 1 });
    const two = filterRGB(spectrum, fft, { alpha: 2 });
    assert.deepEqual(displayFilteredRGB(zero.sharpen, 'sharpen'), pixels);
    for (let c = 0; c < 3; c++) {
      const original = Float64Array.from({ length: n * n }, (_, i) => pixels[4 * i + c]);
      identityError = Math.max(identityError, close(zero.sharpen[c].real, original));
      close(one.sharpen[c].real, original.map((value, i) => value + one.hpf[c].real[i]));
      close(two.sharpen[c].real, original.map((value, i) => value + 2 * two.hpf[c].real[i]));
      close(one.lpf[c].real, two.lpf[c].real);
      close(one.hpf[c].real, two.hpf[c].real);
      close(original, one.lpf[c].real.map((value, i) => value + one.hpf[c].real[i]));
      for (const result of [zero, one, two]) for (const channels of Object.values(result)) {
        for (const value of channels[c].imag) imaginary = Math.max(imaginary, Math.abs(value));
      }
    }
  }
  assert.ok(imaginary < 1e-8);
  t.diagnostic(JSON.stringify({ identityError, maxImaginary: imaginary, displayedIdentityError: 0 }));
});

test('RGB isolation: changing green leaves red and blue filtered channels unchanged', () => {
  const n = 32, fft = new FFT(n), pixels = rgbaFixture(n);
  const changed = pixels.map((value, i) => i % 4 === 1 ? 255 - value : value);
  const a = filterRGB(analyzeRGB(pixels, fft), fft), b = filterRGB(analyzeRGB(changed, fft), fft);
  for (const type of Object.keys(a)) for (const c of [0, 2]) assert.deepEqual(a[type][c], b[type][c]);
  assert.notDeepEqual(a.lpf[1].real, b.lpf[1].real);
});

test('display mapping is fixed, signed, clamped, RGB ordered and leaves numerical arrays intact', () => {
  const channels = [
    { real: Float64Array.of(-200, -20, 0, 10.4, 200), imag: new Float64Array(5) },
    { real: Float64Array.of(1, 2, 3, 4, 5), imag: new Float64Array(5) },
    { real: Float64Array.of(90, 80, 70, 60, 50), imag: new Float64Array(5) },
  ];
  const saved = structuredClone(channels);
  const red = rgba => Array.from(rgba.filter((_, i) => i % 4 === 0));
  assert.deepEqual(red(displayFilteredRGB(channels, 'hpf')), [0, 108, 128, 138, 255]);
  for (const type of ['lpf', 'sharpen']) assert.deepEqual(red(displayFilteredRGB(channels, type)), [0, 0, 0, 10, 200]);
  assert.deepEqual(Array.from(displayFilteredRGB(channels, 'lpf').slice(8, 12)), [0, 3, 70, 255]);
  assert.deepEqual(channels, saved);
  assert.throws(() => displayFilteredRGB(channels, 'unknown'), RangeError);
  channels[0].real[0] = NaN;
  assert.throws(() => displayFilteredRGB(channels, 'hpf'), /Non-finite/);
});

test('invalid filtering parameters and spectrum shapes are rejected', () => {
  const fft = new FFT(8), spectrum = analyzeRGB(rgbaFixture(8), fft);
  for (const alpha of [-1, NaN, Infinity]) assert.throws(() => filterRGB(spectrum, fft, { alpha }), RangeError);
  assert.throws(() => filterRGB(spectrum.slice(1), fft), RangeError);
  assert.throws(() => filterRGB(spectrum, new FFT(16)), RangeError);
  for (const filters of [[], ['unknown'], ['lpf', 'lpf'], null]) {
    assert.throws(() => filterRGB(spectrum, fft, { filters }), RangeError);
  }
});

test('independent selected operations use their own sigma and execute only the requested numerical IFFTs', () => {
  const n = 8, fft = new FFT(n), pixels = rgbaFixture(n), spectrum = analyzeRGB(pixels, fft);
  const original = structuredClone(spectrum);
  const transform = fft.transform;
  let forward = 0, inverse = 0;
  fft.transform = function (real, imag, backwards = false) {
    if (backwards) inverse++; else forward++;
    return transform.call(this, real, imag, backwards);
  };
  const pass = filterRGB(spectrum, fft, { sigma: 20, filters: ['lpf', 'hpf'] });
  assert.deepEqual(Object.keys(pass), ['lpf', 'hpf']);
  assert.equal(inverse, 6 * 2 * n);
  const sharp = filterRGB(spectrum, fft, { sigma: 110, alpha: 1.7, filters: ['sharpen'] });
  assert.deepEqual(Object.keys(sharp), ['sharpen']);
  assert.equal(inverse, 9 * 2 * n);
  assert.equal(forward, 0);
  for (let c = 0; c < 3; c++) {
    const channel = Float64Array.from({ length: n * n }, (_, i) => pixels[4 * i + c]);
    close(pass.lpf[c].real, reference(channel, n, 20, 1, 'lpf'));
    close(pass.hpf[c].real, reference(channel, n, 20, 1, 'hpf'));
    close(sharp.sharpen[c].real, reference(channel, n, 110, 1.7, 'sharpen'));
    close(sharp.sharpen[c].imag, new Float64Array(n * n));
  }
  const savedPass = structuredClone(pass), savedSharp = structuredClone(sharp);
  filterRGB(spectrum, fft, { sigma: 60, filters: ['lpf', 'hpf'] });
  assert.deepEqual(sharp, savedSharp, 'changing sigma1 never modifies the sigma2 reconstruction');
  filterRGB(spectrum, fft, { sigma: 80, alpha: 2, filters: ['sharpen'] });
  assert.deepEqual(pass, savedPass, 'changing sigma2/alpha never modifies the sigma1 reconstructions');
  assert.deepEqual(spectrum, original);
});
