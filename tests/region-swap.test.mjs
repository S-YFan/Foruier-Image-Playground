import test from 'node:test';
import assert from 'node:assert/strict';
import { FFT } from '../js/fft.js';
import { analyzeRGB } from '../js/fourier.js';
import {
  DEFAULT_PARAMETERS, createPhaseMask, partialPhaseSwapRGB, displayPhaseSwap, displayPhaseMask,
} from '../js/region-swap.js';
import { fixtures, noise, maxDifference } from './test-data.js';

const configurations = [
  ...[0.01, 0.05, 0.15, 0.30].map(cutoff => ({ type: 'disk', cutoff })),
  ...['ul-lr', 'ur-ll', 'both'].map(quadrants => ({ type: 'quadrants', quadrants })),
  ...['vertical', 'horizontal'].flatMap(orientation =>
    [5, 20, 50].map(stripeWidth => ({ type: 'stripes', orientation, stripeWidth }))),
];

// Independent equations: direct DFT/IFFT, without the production FFT or masks.
function directDFT(values, n, inverse = false) {
  return Array.from({ length: n * n }, (_, k) => {
    let re = 0, im = 0;
    const u = k % n, v = Math.floor(k / n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const angle = (inverse ? 1 : -1) * 2 * Math.PI * (u * x + v * y) / n;
      const value = values[y * n + x];
      re += value[0] * Math.cos(angle) - value[1] * Math.sin(angle);
      im += value[0] * Math.sin(angle) + value[1] * Math.cos(angle);
    }
    const scale = inverse ? n * n : 1;
    return [re / scale, im / scale];
  });
}

function referenceSelected(x, y, n, parameters) {
  const p = { ...DEFAULT_PARAMETERS, ...parameters };
  const centered = coordinate => ((coordinate + Math.floor(n / 2)) % n) - Math.floor(n / 2);
  const u = centered(x), v = centered(y);
  if (p.type === 'disk') return u * u + v * v <= (p.cutoff * n) ** 2;
  if (p.type === 'stripes') {
    return Math.floor(Math.abs(p.orientation === 'vertical' ? u : v) / p.stripeWidth) % 2 === 0;
  }
  if (u === 0 || v === 0 || (n % 2 === 0 && (x === n / 2 || y === n / 2))) return false;
  return p.quadrants === 'both' || ((u * v > 0) === (p.quadrants === 'ul-lr'));
}

function directReference(rgbaA, rgbaB, n, channel, parameters) {
  const forward = rgba => directDFT(Array.from({ length: n * n }, (_, i) => [rgba[4 * i + channel], 0]), n);
  // A real input's exact coefficients form conjugate pairs. Remove only the
  // direct DFT's own roundoff before extracting a phase near spectral zeros.
  const project = spectrum => spectrum.map((value, i) => {
    const partner = ((n - Math.floor(i / n)) % n) * n + (n - i % n) % n;
    return [(value[0] + spectrum[partner][0]) / 2, (value[1] - spectrum[partner][1]) / 2];
  });
  const a = project(forward(rgbaA)), b = project(forward(rgbaB));
  const mixed = a.map((value, i) => {
    const source = referenceSelected(i % n, Math.floor(i / n), n, parameters) ? b[i] : value;
    const angle = Math.atan2(source[1], source[0]);
    const magnitude = Math.hypot(...value);
    return [magnitude * Math.cos(angle), magnitude * Math.sin(angle)];
  });
  return directDFT(mixed, n, true);
}

test('all masks preserve exact modular symmetry at odd/even sizes, including DC and Nyquist', () => {
  for (const n of [9, 10, 256]) for (const parameters of configurations) {
    const mask = createPhaseMask(n, parameters);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x;
      assert.equal(mask[i], mask[((n - y) % n) * n + (n - x) % n]);
      assert.equal(Boolean(mask[i]), referenceSelected(x, y, n, parameters));
      if (parameters.type === 'quadrants' && (x === 0 || y === 0 ||
          (n % 2 === 0 && (x === n / 2 || y === n / 2)))) assert.equal(mask[i], 0);
    }
    assert.equal(mask[0], parameters.type === 'quadrants' ? 0 : 1);
  }
});

test('stripe widths stay in native integer bins and horizontal masks transpose vertical masks', () => {
  for (const width of [5, 20, 50]) {
    const vertical = createPhaseMask(256, { stripeWidth: width });
    const horizontal = createPhaseMask(256, { stripeWidth: width, orientation: 'horizontal' });
    assert.equal(vertical[width - 1], 1);
    assert.equal(vertical[width], 0);
    assert.equal(vertical[2 * width], 1);
    assert.equal(vertical[256 - width], 0);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      assert.equal(vertical[y * 256 + x], horizontal[x * 256 + y]);
    }
  }
  const disk = createPhaseMask(1000, { type: 'disk', cutoff: 0.30 });
  assert.equal(disk[300], 1);
  assert.equal(disk[301], 0);
  assert.equal(disk[180 * 1000 + 240], 1);
  assert.equal(disk[500], 0, 'axial Nyquist is radius 0.5');
});

test('partial RGB phase substitution matches independent tiny DFT/IFFT and retains A magnitude', t => {
  const n = 8, fft = new FFT(n), a = noise(n, 11), b = noise(n, 29);
  const spectrumA = analyzeRGB(a, fft), spectrumB = analyzeRGB(b, fft);
  const savedA = structuredClone(spectrumA), savedB = structuredClone(spectrumB);
  const cases = [
    { type: 'disk', cutoff: 0.15 }, { type: 'disk', cutoff: 0.30 },
    ...['ul-lr', 'ur-ll', 'both'].map(quadrants => ({ type: 'quadrants', quadrants })),
    { type: 'stripes', orientation: 'vertical', stripeWidth: 1 },
    { type: 'stripes', orientation: 'horizontal', stripeWidth: 2 },
  ];
  let reconstructionError = 0, magnitudeError = 0;
  for (const parameters of cases) {
    const { channels, mask, stats } = partialPhaseSwapRGB(spectrumA, spectrumB, fft, parameters);
    assert.equal(stats.maskSymmetric, true);
    assert.equal(stats.pass, true);
    assert.equal(stats.selectedFraction, mask.reduce((sum, value) => sum + value, 0) / (n * n));
    let selectedEnergy = 0, totalEnergy = 0;
    for (let c = 0; c < 3; c++) {
      const expected = directReference(a, b, n, c, parameters);
      reconstructionError = Math.max(reconstructionError,
        maxDifference(channels[c].real, expected.map(value => value[0])),
        maxDifference(channels[c].imag, expected.map(value => value[1])));
      const transformed = directDFT(Array.from(channels[c].real, (value, i) => [value, channels[c].imag[i]]), n);
      for (let i = 0; i < n * n; i++) {
        magnitudeError = Math.max(magnitudeError, Math.abs(Math.hypot(...transformed[i]) - spectrumA[c].magnitude[i]));
        totalEnergy += spectrumA[c].magnitude[i] ** 2;
        if (mask[i]) selectedEnergy += spectrumA[c].magnitude[i] ** 2;
      }
    }
    assert.ok(Math.abs(stats.energyFraction - selectedEnergy / totalEnergy) < 1e-14);
    assert.ok(stats.maxImaginary < 1e-8);
    assert.ok(stats.maxScaledMagnitudeError < 1e-12);
  }
  assert.ok(reconstructionError < 1e-8, `Independent reconstruction error ${reconstructionError}`);
  assert.ok(magnitudeError < 1e-8, `Independent magnitude error ${magnitudeError}`);
  assert.deepEqual(spectrumA, savedA);
  assert.deepEqual(spectrumB, savedB);
  t.diagnostic(JSON.stringify({ reconstructionError, magnitudeError }));
});

test('same-image identity, zero donors, Nyquist donors and zero-energy A reconstruct as real RGB', () => {
  const n = 64, fft = new FFT(n), data = fixtures(n), a = analyzeRGB(data.rgb, fft);
  for (const parameters of configurations) {
    const result = partialPhaseSwapRGB(a, a, fft, parameters);
    for (let c = 0; c < 3; c++) {
      assert.ok(maxDifference(result.channels[c].real,
        Float64Array.from({ length: n * n }, (_, i) => data.rgb[4 * i + c])) < 1e-8);
    }
  }
  for (const donor of [data.black, data.white, data.nyquist]) {
    for (const parameters of [{ type: 'disk', cutoff: 1 }, { stripeWidth: 5 }, { orientation: 'horizontal', stripeWidth: 20 }]) {
      const result = partialPhaseSwapRGB(a, analyzeRGB(donor, fft), fft, parameters);
      assert.ok(result.stats.maxImaginary < 1e-8);
      assert.equal(result.stats.pass, true);
    }
  }
  const zero = partialPhaseSwapRGB(analyzeRGB(data.black, fft), a, fft);
  assert.equal(zero.stats.energyFraction, null);
  assert.ok(displayPhaseSwap(zero.channels).every((value, i) => value === (i % 4 === 3 ? 255 : 0)));
});

test('RGB isolation and independent position/energy fractions remain intact', () => {
  const n = 32, fft = new FFT(n), data = fixtures(n);
  const a = analyzeRGB(data.rgb, fft), b = analyzeRGB(data.differentRGB, fft);
  const changed = structuredClone(b);
  changed[1] = analyzeRGB(data.impulse, fft)[1];
  const first = partialPhaseSwapRGB(a, b, fft), second = partialPhaseSwapRGB(a, changed, fft);
  for (const c of [0, 2]) assert.deepEqual(first.channels[c], second.channels[c]);
  assert.notDeepEqual(first.channels[1].real, second.channels[1].real);
  const disk = partialPhaseSwapRGB(a, b, fft, { type: 'disk', cutoff: 0.01 });
  assert.ok(disk.stats.energyFraction > 0.5);
  assert.equal(disk.stats.selectedFraction, 1 / (n * n));
});

test('final display preserves signed floats, clips once, truncates and keeps RGB ordering', () => {
  const channels = [
    { real: Float64Array.of(-80, 0, 10.99, 254.99, 300), imag: new Float64Array(5) },
    { real: Float64Array.of(1, 2, 3, 4, 5), imag: new Float64Array(5) },
    { real: Float64Array.of(90, 80, 70, 60, 50), imag: new Float64Array(5) },
  ];
  const saved = structuredClone(channels), rgba = displayPhaseSwap(channels);
  assert.deepEqual(Array.from(rgba.filter((_, i) => i % 4 === 0)), [0, 0, 10, 254, 255]);
  assert.deepEqual(Array.from(rgba.slice(8, 12)), [10, 3, 70, 255]);
  assert.deepEqual(channels, saved);
  for (const n of [8, 9]) {
    const mask = new Uint8Array(n * n);
    mask[0] = 1;
    const shifted = displayPhaseMask(mask, n);
    const center = Math.floor(n / 2);
    assert.deepEqual(Array.from(shifted.slice((center * n + center) * 4, (center * n + center) * 4 + 4)), [255, 255, 255, 255]);
    assert.equal(shifted.filter((value, i) => i % 4 === 0 && value === 255).length, 1);
    assert.equal(mask[0], 1, 'display shifting never moves the numerical mask');
  }
  channels[0].real[0] = NaN;
  assert.throws(() => displayPhaseSwap(channels), /Non-finite/);
  assert.throws(() => displayPhaseSwap(channels.slice(1)), RangeError);
  assert.throws(() => displayPhaseMask(Uint8Array.of(2, 0, 0, 0), 2), /binary/);
  assert.throws(() => displayPhaseMask(new Uint8Array(4), 3), /size/);
});

test('invalid parameters, spectrum shapes and broken real-spectrum symmetry fail clearly', () => {
  for (const size of [0, 1, -2, 2.5, Infinity]) assert.throws(() => createPhaseMask(size), RangeError);
  for (const parameters of [null, { type: 'unknown' }, { type: 'disk', cutoff: -1 },
    { type: 'disk', cutoff: NaN }, { type: 'quadrants', quadrants: 'ul' },
    { orientation: 'diagonal' }, { stripeWidth: 0 }, { stripeWidth: 2.5 }]) {
    assert.throws(() => createPhaseMask(8, parameters), RangeError);
  }
  const fft = new FFT(8), a = analyzeRGB(noise(8, 5), fft), b = analyzeRGB(noise(8, 11), fft);
  assert.throws(() => partialPhaseSwapRGB(a.slice(1), b, fft), /spectra/);
  assert.throws(() => partialPhaseSwapRGB(a, b, new FFT(16)), /spectra/);
  const corrupt = structuredClone(b);
  corrupt[0].phase[1] += Math.PI / 2;
  assert.throws(() => partialPhaseSwapRGB(a, corrupt, fft, { stripeWidth: 50 }), /imaginary/);
  corrupt[0].phase[1] = NaN;
  assert.throws(() => partialPhaseSwapRGB(a, corrupt, fft), /invalid source/);
  const self = structuredClone(b);
  self[0].phase[0] = Math.PI / 3;
  assert.throws(() => partialPhaseSwapRGB(a, self, fft), /magnitude/);
});
