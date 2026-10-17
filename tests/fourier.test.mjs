import test from 'node:test';
import assert from 'node:assert/strict';
import { FFT, fft2 } from '../js/fft.js';
import { analyzeRGB, reconstructChannel, reconstructRGB, checkRoundTrip } from '../js/fourier.js';

function close(actual, expected, tolerance = 1e-8) {
  assert.equal(actual.length, expected.length);
  let maximum = 0;
  for (let i = 0; i < actual.length; i++) maximum = Math.max(maximum, Math.abs(actual[i] - expected[i]));
  assert.ok(maximum < tolerance, `Maximum error ${maximum} exceeds ${tolerance}`);
  return maximum;
}

// Independent O(N^4) definition of the complex 2D DFT, only for tiny fixtures.
// This catches sign, index, and scaling bugs that a round-trip alone could miss.
function directDFT(real, imag, n, inverse = false) {
  const outReal = new Float64Array(n * n);
  const outImag = new Float64Array(n * n);
  for (let v = 0; v < n; v++) {
    for (let u = 0; u < n; u++) {
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const angle = (inverse ? 1 : -1) * 2 * Math.PI * (u * x + v * y) / n;
          const index = y * n + x;
          outReal[v * n + u] += real[index] * Math.cos(angle) - imag[index] * Math.sin(angle);
          outImag[v * n + u] += real[index] * Math.sin(angle) + imag[index] * Math.cos(angle);
        }
      }
      if (inverse) {
        outReal[v * n + u] /= n * n;
        outImag[v * n + u] /= n * n;
      }
    }
  }
  return { real: outReal, imag: outImag };
}

function fixture(n, seed = 1) {
  let state = seed;
  return Uint8ClampedArray.from({ length: n * n * 4 }, (_, i) => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return i % 4 === 3 ? 255 : state >>> 24;
  });
}

test('radix-2 FFT validates dimensions', () => {
  assert.throws(() => new FFT(3), RangeError);
  assert.throws(() => new FFT(0), RangeError);
  assert.throws(() => fft2(new Float64Array(5), new Float64Array(5), new FFT(2)), RangeError);
});

test('complex forward and inverse 2D FFT match independent DFT', t => {
  const n = 8;
  const inputReal = Float64Array.from({ length: n * n }, (_, i) => Math.sin(i * 1.7) * 180);
  const inputImag = Float64Array.from({ length: n * n }, (_, i) => Math.cos(i * .8) * 90);
  let maximum = 0;
  for (const inverse of [false, true]) {
    const expected = directDFT(inputReal, inputImag, n, inverse);
    const real = inputReal.slice();
    const imag = inputImag.slice();
    fft2(real, imag, new FFT(n), inverse);
    maximum = Math.max(maximum, close(real, expected.real), close(imag, expected.imag));
  }
  t.diagnostic(`Complex FFT/IFFT vs direct DFT maximum absolute difference = ${maximum}`);
});

test('256×256 FFT → IFFT reconstructs real pixels', context => {
  const result = checkRoundTrip(256);
  assert.ok(result.passed, JSON.stringify(result));
  context.diagnostic(JSON.stringify(result));
});

test('constant input has only DC; offset impulse has the expected phase ramp', () => {
  const n = 8;
  const fft = new FFT(n);
  const constant = new Float64Array(n * n).fill(37);
  const imaginary = new Float64Array(n * n);
  fft2(constant, imaginary, fft);
  assert.equal(constant[0], 37 * n * n);
  assert.ok(constant.slice(1).every(value => Math.abs(value) < 1e-10));
  const impulse = new Float64Array(n * n);
  impulse[2 * n + 3] = 1;
  imaginary.fill(0);
  fft2(impulse, imaginary, fft);
  for (let v = 0; v < n; v++) {
    for (let u = 0; u < n; u++) {
      const phase = -2 * Math.PI * (u * 3 + v * 2) / n;
      assert.ok(Math.abs(impulse[v * n + u] - Math.cos(phase)) < 1e-10);
      assert.ok(Math.abs(imaginary[v * n + u] - Math.sin(phase)) < 1e-10);
    }
  }
});

test('RGB channels remain independent and same-image swap reproduces exact bytes', () => {
  const fft = new FFT(256);
  const input = fixture(256);
  const spectrum = analyzeRGB(input, fft);
  const output = reconstructRGB(spectrum, spectrum, fft);
  assert.deepEqual(output.rgba, input);
  assert.equal(output.stats.clippedFraction, 0);
  assert.ok(output.stats.maxImaginary < 1e-8);
});

test('both swap directions match independent DFT and IFFT for all RGB channels', t => {
  const n = 8;
  const fft = new FFT(n);
  const a = fixture(n, 22);
  const b = fixture(n, 97);
  const spectrumA = analyzeRGB(a, fft);
  const spectrumB = analyzeRGB(b, fft);
  let maximum = 0;
  for (const [magnitudePixels, phasePixels, magSource, phaseSource] of [
    [a, b, spectrumA, spectrumB], [b, a, spectrumB, spectrumA],
  ]) {
    for (let channel = 0; channel < 3; channel++) {
      const extract = pixels => Float64Array.from({ length: n * n }, (_, i) => pixels[4 * i + channel]);
      const zero = new Float64Array(n * n);
      const m = directDFT(extract(magnitudePixels), zero, n);
      const p = directDFT(extract(phasePixels), zero, n);
      const mixedReal = new Float64Array(n * n);
      const mixedImag = new Float64Array(n * n);
      for (let i = 0; i < mixedReal.length; i++) {
        const magnitude = Math.hypot(m.real[i], m.imag[i]);
        const phase = Math.atan2(p.imag[i], p.real[i]);
        mixedReal[i] = magnitude * Math.cos(phase);
        mixedImag[i] = magnitude * Math.sin(phase);
      }
      const expected = directDFT(mixedReal, mixedImag, n, true);
      const actual = reconstructChannel(magSource[channel].magnitude, phaseSource[channel].phase, fft);
      maximum = Math.max(maximum, close(actual.real, expected.real), close(actual.imag, expected.imag));
    }
  }
  t.diagnostic(`RGB swap vs direct DFT/IFFT maximum absolute difference = ${maximum}`);
});

test('real-image spectra preserve conjugate pairs, including Nyquist bins', () => {
  const n = 256;
  const fft = new FFT(n);
  const input = fixture(n, 3);
  const real = Float64Array.from({ length: n * n }, (_, i) => input[i * 4]);
  const imag = new Float64Array(n * n);
  fft2(real, imag, fft);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const j = ((n - y) % n) * n + (n - x) % n;
      assert.ok(Math.abs(real[i] - real[j]) < 1e-7);
      assert.ok(Math.abs(imag[i] + imag[j]) < 1e-7);
    }
  }
  const a = analyzeRGB(input, fft);
  const b = analyzeRGB(fixture(n, 5), fft);
  assert.ok(reconstructRGB(a, b, fft).stats.maxImaginary < 1e-8);
  assert.ok(reconstructRGB(b, a, fft).stats.maxImaginary < 1e-8);
});

test('zero magnitudes have phase zero; black and constant images remain finite', () => {
  const fft = new FFT(8);
  const black = fixture(8).map((_, i) => i % 4 === 3 ? 255 : 0);
  const constant = black.map((_, i) => i % 4 === 3 ? 255 : 96);
  const a = analyzeRGB(black, fft);
  const b = analyzeRGB(constant, fft);
  assert.ok(a.every(channel => channel.phase.every(value => value === 0)));
  assert.deepEqual(reconstructRGB(a, b, fft).rgba, black);
  assert.deepEqual(reconstructRGB(b, a, fft).rgba, constant);
});

test('display clips and rounds real values without abs, wraparound, or contrast stretching', () => {
  const fft = new FFT(2);
  const desired = Float64Array.of(-20, 10.3, 270, 80.7);
  const real = desired.slice();
  const imag = new Float64Array(4);
  fft2(real, imag, fft);
  const channel = {
    magnitude: Float64Array.from(real, (r, i) => Math.hypot(r, imag[i])),
    phase: Float64Array.from(real, (r, i) => Math.atan2(imag[i], r)),
  };
  const result = reconstructRGB([channel, channel, channel], [channel, channel, channel], fft);
  assert.deepEqual(Array.from(result.rgba.filter((_, i) => i % 4 === 0)), [0, 10, 255, 81]);
  assert.equal(result.stats.clippedFraction, .5);
  assert.ok(Math.abs(result.stats.minimum + 20) < 1e-8);
  assert.ok(Math.abs(result.stats.maximum - 270) < 1e-8);
});
