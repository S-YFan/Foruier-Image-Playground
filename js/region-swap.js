import { reconstructChannel } from './fourier.js';

export const DEFAULT_PARAMETERS = Object.freeze({
  type: 'stripes', cutoff: 0.15, quadrants: 'ul-lr', orientation: 'vertical', stripeWidth: 20,
});

const MAGNITUDE_RTOL = 1e-12;
const MAGNITUDE_ATOL = 1e-9;
const IMAGINARY_RTOL = 1e-10;

// Native FFT order: integer bins are 0,...,+k,-k,...,-1 (even N includes -N/2).
// Widths are actual frequency bins, as in the Python prototype; no size scaling.
export function createPhaseMask(size, parameters = {}) {
  if (!Number.isInteger(size) || size < 2 || size > 16384) {
    throw new RangeError('Mask size must be an integer between 2 and 16384.');
  }
  if (!parameters || typeof parameters !== 'object') throw new RangeError('Invalid mask parameters.');
  const { type, cutoff, quadrants, orientation, stripeWidth } = { ...DEFAULT_PARAMETERS, ...parameters };
  if (!['disk', 'quadrants', 'stripes'].includes(type)) throw new RangeError('Unknown phase mask type.');
  if (type === 'disk' && (!Number.isFinite(cutoff) || cutoff < 0)) {
    throw new RangeError('Disk cutoff must be finite and non-negative.');
  }
  if (type === 'quadrants' && !['ul-lr', 'ur-ll', 'both'].includes(quadrants)) {
    throw new RangeError('Unknown quadrant pair.');
  }
  if (type === 'stripes' && (!['vertical', 'horizontal'].includes(orientation) ||
      !Number.isInteger(stripeWidth) || stripeWidth <= 0)) {
    throw new RangeError('Stripes require a vertical/horizontal orientation and positive integer width.');
  }
  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y < Math.ceil(size / 2) ? y : y - size;
    for (let x = 0; x < size; x++) {
      const u = x < Math.ceil(size / 2) ? x : x - size;
      let selected;
      if (type === 'disk') {
        // Radius in cycles/pixel: DC=0, axial Nyquist=0.5, corner=sqrt(0.5).
        selected = Math.hypot(u / size, v / size) <= cutoff;
      } else if (type === 'quadrants') {
        // In an origin-at-top fftshift display, negative v is the upper half.
        // Keep the coordinate axes and even-N Nyquist row/column on A's phase.
        const interior = u !== 0 && v !== 0 &&
          (size % 2 !== 0 || (Math.abs(u) !== size / 2 && Math.abs(v) !== size / 2));
        const sameSign = (u < 0) === (v < 0);
        selected = interior && (quadrants === 'both' || (quadrants === 'ul-lr' ? sameSign : !sameSign));
      } else {
        selected = Math.floor(Math.abs(orientation === 'vertical' ? u : v) / stripeWidth) % 2 === 0;
      }
      mask[y * size + x] = Number(selected);
    }
  }
  return mask;
}

// Both cached inputs come from analyzeRGB, which projects FFT roundoff onto
// conjugate pairs before extracting phase. Only selected phase values change.
export function partialPhaseSwapRGB(spectrumA, spectrumB, fft, parameters = {}) {
  const size = fft.size, count = size * size;
  for (const spectrum of [spectrumA, spectrumB]) {
    if (!Array.isArray(spectrum) || spectrum.length !== 3 || spectrum.some(channel =>
      channel?.magnitude?.length !== count || channel?.phase?.length !== count)) {
      throw new RangeError('Expected three RGB spectra matching the FFT size.');
    }
  }
  const mask = createPhaseMask(size, parameters);
  let selected = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, partner = ((size - y) % size) * size + (size - x) % size;
    if ((mask[i] !== 0 && mask[i] !== 1) || mask[i] !== mask[partner]) {
      throw new Error('Phase mask must be binary and Hermitian symmetric.');
    }
    selected += mask[i];
  }

  const channels = [];
  let selectedEnergy = 0, totalEnergy = 0, maxImaginary = 0;
  let maxMagnitudeError = 0, maxScaledMagnitudeError = 0;
  let minimum = Infinity, maximum = -Infinity, clipped = 0;
  for (let c = 0; c < 3; c++) {
    const magnitude = spectrumA[c].magnitude;
    const phase = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      if (!Number.isFinite(magnitude[i]) || magnitude[i] < 0 ||
          !Number.isFinite(spectrumB[c].magnitude[i]) || spectrumB[c].magnitude[i] < 0 ||
          !Number.isFinite(spectrumA[c].phase[i]) || !Number.isFinite(spectrumB[c].phase[i])) {
        throw new Error('Non-finite or invalid source spectrum.');
      }
      phase[i] = mask[i] ? spectrumB[c].phase[i] : spectrumA[c].phase[i];
      const x = i % size, y = Math.floor(i / size);
      const selfConjugate = (x === 0 || x === size / 2) && (y === 0 || y === size / 2);
      const re = magnitude[i] * Math.cos(phase[i]);
      const im = selfConjugate ? 0 : magnitude[i] * Math.sin(phase[i]);
      const error = Math.abs(Math.hypot(re, im) - magnitude[i]);
      if (error > MAGNITUDE_ATOL + MAGNITUDE_RTOL * magnitude[i]) {
        throw new Error("Mixed magnitude differs from Image A's magnitude.");
      }
      maxMagnitudeError = Math.max(maxMagnitudeError, error);
      maxScaledMagnitudeError = Math.max(maxScaledMagnitudeError, error / Math.max(1, magnitude[i]));
      const energy = magnitude[i] ** 2;
      totalEnergy += energy;
      if (mask[i]) selectedEnergy += energy;
    }
    const channel = reconstructChannel(magnitude, phase, fft);
    let channelImaginary = 0, scale = 1;
    for (let i = 0; i < count; i++) {
      const value = channel.real[i], imaginary = channel.imag[i];
      if (!Number.isFinite(value) || !Number.isFinite(imaginary)) throw new Error('Non-finite IFFT output.');
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
      scale = Math.max(scale, Math.abs(value));
      channelImaginary = Math.max(channelImaginary, Math.abs(imaginary));
      if (value < 0 || value > 255) clipped++;
    }
    if (channelImaginary > IMAGINARY_RTOL * scale) {
      throw new Error(`Non-negligible imaginary reconstruction residual: ${channelImaginary.toExponential(3)}.`);
    }
    maxImaginary = Math.max(maxImaginary, channelImaginary);
    channels.push(channel);
  }
  return {
    channels, mask,
    stats: {
      selectedFraction: selected / count,
      energyFraction: totalEnergy === 0 ? null : selectedEnergy / totalEnergy,
      maxImaginary, maxMagnitudeError, maxScaledMagnitudeError,
      clippedFraction: clipped / (count * 3), minimum, maximum, maskSymmetric: true, pass: true,
    },
  };
}

// Display-only copy, matching np.uint8(np.clip(..., 0, 255)): truncate, not round.
// Keep signed, floating RGB IFFT arrays intact, with no abs or contrast mapping.
export function displayPhaseSwap(channels) {
  const count = channels?.[0]?.real?.length;
  if (!count || channels.length !== 3 || channels.some(channel =>
    channel?.real?.length !== count || channel?.imag?.length !== count)) {
    throw new RangeError('Expected three equally sized reconstructed RGB channels.');
  }
  const rgba = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) {
      const value = channels[c].real[i];
      if (!Number.isFinite(value) || !Number.isFinite(channels[c].imag[i])) throw new Error('Non-finite IFFT output.');
      rgba[i * 4 + c] = Math.trunc(Math.max(0, Math.min(255, value)));
    }
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

// fftshift applies only to this black/white visualization, never to FFT data.
export function displayPhaseMask(mask, size) {
  if (!Number.isInteger(size) || size < 2 || mask?.length !== size * size) {
    throw new RangeError('Wrong phase mask size.');
  }
  const rgba = new Uint8ClampedArray(mask.length * 4), shift = Math.ceil(size / 2);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = mask[((y + shift) % size) * size + (x + shift) % size];
    if (value !== 0 && value !== 1) throw new RangeError('Phase mask must be binary.');
    const i = (y * size + x) * 4;
    rgba[i] = rgba[i + 1] = rgba[i + 2] = value * 255;
    rgba[i + 3] = 255;
  }
  return rgba;
}
