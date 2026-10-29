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

test('all eight same-color phase selections match an independent DFT in both directions', () => {
  const n = 8, count = n * n, fft = new FFT(n);
  const a = fixture(n, 22), b = fixture(n, 97);
  const spectrumA = analyzeRGB(a, fft), spectrumB = analyzeRGB(b, fft);
  const before = structuredClone([spectrumA, spectrumB]);
  const independentSpectra = pixels => Array.from({ length: 3 }, (_, channel) =>
    directDFT(Float64Array.from({ length: count }, (_, i) => pixels[4 * i + channel]), new Float64Array(count), n));
  const directA = independentSpectra(a), directB = independentSpectra(b);
  for (let bits = 0; bits < 8; bits++) {
    const swapChannels = Object.freeze([0, 1, 2].map(channel => Boolean(bits & (1 << channel))));
    for (const [base, other, directBase, directOther] of [
      [spectrumA, spectrumB, directA, directB], [spectrumB, spectrumA, directB, directA],
    ]) {
      const expected = new Uint8ClampedArray(count * 4);
      for (let channel = 0; channel < 3; channel++) {
        const magnitudeSpectrum = directBase[channel];
        const phaseSpectrum = (swapChannels[channel] ? directOther : directBase)[channel];
        const mixedReal = new Float64Array(count), mixedImag = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          const magnitude = Math.hypot(magnitudeSpectrum.real[i], magnitudeSpectrum.imag[i]);
          const phase = Math.atan2(phaseSpectrum.imag[i], phaseSpectrum.real[i]);
          mixedReal[i] = magnitude * Math.cos(phase);
          mixedImag[i] = magnitude * Math.sin(phase);
        }
        const reconstructed = directDFT(mixedReal, mixedImag, n, true);
        assert.ok(reconstructed.imag.every(value => Math.abs(value) < 1e-8));
        for (let i = 0; i < count; i++) {
          expected[4 * i + channel] = Math.round(Math.max(0, Math.min(255, reconstructed.real[i])));
          expected[4 * i + 3] = 255;
        }
      }
      const actual = reconstructRGB(base, other, fft, swapChannels);
      assert.deepEqual(actual.rgba, expected, `R/G/B flags ${swapChannels}`);
      assert.ok(actual.stats.maxImaginary < 1e-8, `real reconstruction for ${swapChannels}`);
    }
  }
  assert.deepEqual([spectrumA, spectrumB], before, 'channel selection never mutates cached spectra');
});

test('no selected phases preserve both original 256×256 images; omitted flags retain full swap', () => {
  const fft = new FFT(256), a = fixture(256, 22), b = fixture(256, 97);
  const spectrumA = analyzeRGB(a, fft), spectrumB = analyzeRGB(b, fft);
  for (const [base, other, pixels] of [[spectrumA, spectrumB, a], [spectrumB, spectrumA, b]]) {
    const unchanged = reconstructRGB(base, other, fft, [false, false, false]);
    assert.deepEqual(unchanged.rgba, pixels);
    assert.equal(unchanged.stats.clippedFraction, 0);
    assert.ok(unchanged.stats.maxImaginary < 1e-8);
    assert.deepEqual(reconstructRGB(base, other, fft), reconstructRGB(base, other, fft, [true, true, true]));
  }
});

test('phase channel selection accepts exactly three booleans', () => {
  const fft = new FFT(2), spectrum = analyzeRGB(fixture(2), fft);
  for (const invalid of [null, true, 'RGB', {}, new Uint8Array([1, 1, 1]), [], [true, true],
    [true, true, true, false], [true, 1, false], [true, false, undefined], new Array(3)]) {
    assert.throws(() => reconstructRGB(spectrum, spectrum, fft, invalid), /three booleans/);
  }
});

test('all 27 color mappings × eight masks match independent DFT/IFFT in both directions', t => {
  const n = 8, count = n * n, fft = new FFT(n);
  const a = fixture(n, 22), b = fixture(n, 97);
  const sa = analyzeRGB(a, fft), sb = analyzeRGB(b, fft);
  const saved = structuredClone([sa, sb]);
  const direct = pixels => [0, 1, 2].map(c => directDFT(
    Float64Array.from({ length: count }, (_, i) => pixels[4 * i + c]), new Float64Array(count), n));
  const da = direct(a), db = direct(b);
  let maxError = 0;
  for (const [base, other, directBase, directOther, original] of [[sa, sb, da, db, a], [sb, sa, db, da, b]]) {
    // Independent expected reconstructions for each output-color / donor-color pair.
    const expected = [0, 1, 2].map(c => [0, 1, 2].map(d => {
      const real = new Float64Array(count), imag = new Float64Array(count);
      for (let i = 0; i < count; i++) {
        const amplitude = Math.hypot(directBase[c].real[i], directBase[c].imag[i]);
        const phase = Math.atan2(directOther[d].imag[i], directOther[d].real[i]);
        real[i] = amplitude * Math.cos(phase); imag[i] = amplitude * Math.sin(phase);
      }
      const reference = directDFT(real, imag, n, true);
      const actual = reconstructChannel(base[c].magnitude, other[d].phase, fft);
      maxError = Math.max(maxError, close(actual.real, reference.real), close(actual.imag, reference.imag));
      // Re-transform the unrounded reconstruction to check that magnitude stays in c.
      fft2(actual.real, actual.imag, fft);
      close(Float64Array.from(actual.real, (r, i) => Math.hypot(r, actual.imag[i])), base[c].magnitude);
      return Uint8ClampedArray.from(reference.real, value => Math.round(Math.max(0, Math.min(255, value))));
    }));
    for (let code = 0; code < 27; code++) {
      const mapping = Object.freeze([Math.floor(code / 9), Math.floor(code / 3) % 3, code % 3]);
      for (let bits = 0; bits < 8; bits++) {
        const mask = Object.freeze([0, 1, 2].map(c => Boolean(bits & (1 << c))));
        const pixels = original.slice();
        for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) if (mask[c]) pixels[i * 4 + c] = expected[c][mapping[c]][i];
        const actual = reconstructRGB(base, other, fft, mask, mapping);
        assert.deepEqual(actual.rgba, pixels, `mapping ${mapping}, mask ${mask}`);
        assert.ok(actual.stats.maxImaginary < 1e-8);
      }
    }
    assert.deepEqual(reconstructRGB(base, other, fft), reconstructRGB(base, other, fft, [true, true, true], [0, 1, 2]));
  }
  assert.deepEqual([sa, sb], saved, 'routing never modifies cached spectra');
  t.diagnostic(`432 reconstructions checked; independent floating-point error ${maxError}`);
});

test('cross-color phase changes only outputs using that donor; unchecked channels keep their own phase', () => {
  const fft = new FFT(8), a = fixture(8, 22), b = fixture(8, 97), changed = fixture(8, 315);
  const alteredB = b.map((value, i) => i % 4 === 1 ? changed[i] : value);
  const sa = analyzeRGB(a, fft), sb = analyzeRGB(b, fft), altered = analyzeRGB(alteredB, fft);
  const mask = [true, true, false], mapping = [1, 2, 1];
  const before = reconstructRGB(sa, sb, fft, mask, mapping).rgba;
  const after = reconstructRGB(sa, altered, fft, mask, mapping).rgba;
  assert.ok(before.some((value, i) => i % 4 === 0 && value !== after[i]));
  for (let i = 0; i < before.length; i++) if (i % 4 !== 0) assert.equal(before[i], after[i]);
  for (let i = 2; i < before.length; i += 4) assert.equal(before[i], a[i]);
  assert.deepEqual(reconstructRGB(sa, sa, fft).rgba, a);
  assert.notDeepEqual(reconstructRGB(sa, sa, fft, [true, true, true], [1, 2, 0]).rgba, a, 'same image with cross-color phases need not reproduce itself');
});

test('cross-color sparse, zero, constant and Nyquist donors preserve real outputs and base magnitudes', t => {
  const n = 16, fft = new FFT(n), base = analyzeRGB(fixture(n, 16), fft);
  let maxImaginary = 0;
  for (const kind of ['black', 'white', 'cosine', 'nyquist']) {
    const rgba = Float64Array.from({ length: n * n * 4 }, (_, i) => {
      const c = i % 4, x = Math.floor(i / 4) % n, y = Math.floor(i / (4 * n));
      if (c === 3) return 255;
      if (kind === 'black') return 0;
      if (kind === 'white') return 255;
      return 128 + 100 * (kind === 'nyquist' ? (-1) ** (c === 0 ? x : c === 1 ? y : x + y) : Math.cos(2 * Math.PI * ((c + 1) * x + y) / n));
    });
    const donor = analyzeRGB(rgba, fft);
    for (let code = 0; code < 27; code++) {
      const mapping = [Math.floor(code / 9), Math.floor(code / 3) % 3, code % 3];
      for (const [m, p] of [[base, donor], [donor, base]]) {
        const result = reconstructRGB(m, p, fft, [true, true, true], mapping);
        maxImaginary = Math.max(maxImaginary, result.stats.maxImaginary);
        for (let c = 0; c < 3; c++) {
          const raw = reconstructChannel(m[c].magnitude, p[mapping[c]].phase, fft);
          assert.ok(raw.imag.every(value => Math.abs(value) < 1e-8));
          fft2(raw.real, raw.imag, fft);
          close(Float64Array.from(raw.real, (r, i) => Math.hypot(r, raw.imag[i])), m[c].magnitude);
        }
      }
    }
  }
  assert.ok(maxImaginary < 1e-8);
  t.diagnostic(`Sparse cross-color imaginary residual ${maxImaginary}`);
});

test('color mappings validate all three integers before any inverse transform', () => {
  const fft = new FFT(2), spectrum = analyzeRGB(fixture(2), fft);
  fft.transform = () => { assert.fail('invalid mapping must not execute a transform'); };
  for (const mapping of [null, true, '012', {}, [], [0, 1], [0, 1, 2, 0], [0, 1, -1], [0, 3, 2], [0, 1, 1.5],
    [0, NaN, 2], [0, Infinity, 2], ['0', 1, 2], [0, undefined, 2], new Array(3), new Uint8Array([0, 1, 2])]) {
    for (const mask of [[true, true, true], [false, false, false]]) {
      assert.throws(() => reconstructRGB(spectrum, spectrum, fft, mask, mapping), /three integers from 0 to 2/);
    }
  }
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
