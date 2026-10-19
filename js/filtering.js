import { reconstructChannel } from './fourier.js';

export const DEFAULT_SIGMA = 30;
export const DEFAULT_ALPHA = 1;
export const REFERENCE_SIZE = 1000;

export function validateParameters(sigma, alpha) {
  if (!Number.isFinite(sigma) || sigma <= 0) throw new RangeError('Sigma must be finite and positive.');
  if (!Number.isFinite(alpha) || alpha < 0) throw new RangeError('Alpha must be finite and non-negative.');
}

// Native FFT order: DC at [0,0], negative frequencies wrap at N/2.
// Sigma is in bins of a 1000×1000 reference: sigmaBins = sigma * N/1000.
// Scaling each actual bin by 1000/N keeps the same relative cutoff at any N.
export function gaussianLowPassMask(size, sigma = DEFAULT_SIGMA) {
  validateParameters(sigma, 0);
  if (!Number.isInteger(size) || size < 2 || size > 16384 || (size & (size - 1))) {
    throw new RangeError('Mask size must match a supported FFT size.');
  }
  const mask = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = (y < size / 2 ? y : y - size) * REFERENCE_SIZE / size;
    for (let x = 0; x < size; x++) {
      const u = (x < size / 2 ? x : x - size) * REFERENCE_SIZE / size;
      mask[y * size + x] = Math.exp(-0.5 * ((u / sigma) ** 2 + (v / sigma) ** 2));
    }
  }
  return mask;
}

// All three outputs are genuine filtered spectra followed by IFFT, in Float64.
// A real, non-negative, even transfer function preserves conjugate symmetry.
// Source magnitude/phase and numerical results never undergo display mapping.
export function filterRGB(spectrum, fft, {
  sigma = DEFAULT_SIGMA, alpha = DEFAULT_ALPHA, filters = ['lpf', 'hpf', 'sharpen'],
} = {}) {
  validateParameters(sigma, alpha);
  if (!Array.isArray(filters) || !filters.length || new Set(filters).size !== filters.length ||
    filters.some(type => !['lpf', 'hpf', 'sharpen'].includes(type))) {
    throw new RangeError('Unknown or duplicate filter selection.');
  }
  const count = fft.size ** 2;
  if (!Array.isArray(spectrum) || spectrum.length !== 3 || spectrum.some(channel =>
    channel?.magnitude?.length !== count || channel?.phase?.length !== count)) {
    throw new RangeError('Expected three RGB spectra matching the FFT size.');
  }
  const mask = gaussianLowPassMask(fft.size, sigma);
  // Only allocate and reconstruct requested outputs; the two UI sections share
  // the source spectrum but submit their own sigma and selected operations.
  const result = Object.fromEntries(filters.map(type => [type, []]));
  for (const channel of spectrum) {
    for (const type of filters) {
      const magnitude = Float64Array.from(channel.magnitude, (value, i) => {
        const high = 1 - mask[i];
        const gain = type === 'lpf' ? mask[i] : type === 'hpf' ? high : 1 + alpha * high;
        return value * gain;
      });
      result[type].push(reconstructChannel(magnitude, channel.phase, fft));
    }
  }
  return result;
}

// Display-only copy: HPF zero → 128; LPF and Sharpening receive no offset.
// No absolute value, min-max normalization, or edits to Float64 IFFT arrays.
export function displayFilteredRGB(channels, type) {
  if (!['lpf', 'hpf', 'sharpen'].includes(type)) throw new RangeError('Unknown filter type.');
  const count = channels[0]?.real?.length;
  if (!count || channels.length !== 3 || channels.some(channel =>
    channel.real.length !== count || channel.imag.length !== count)) {
    throw new RangeError('Expected three equally sized reconstructed RGB channels.');
  }
  const rgba = new Uint8ClampedArray(count * 4);
  const offset = type === 'hpf' ? 128 : 0;
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) {
      const value = channels[c].real[i];
      if (!Number.isFinite(value) || !Number.isFinite(channels[c].imag[i])) throw new Error('Non-finite IFFT output.');
      rgba[i * 4 + c] = Math.round(Math.max(0, Math.min(255, value + offset)));
    }
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
