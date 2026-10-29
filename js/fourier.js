import { FFT, fft2 } from './fft.js';

export const IMAGE_SIZE = 256;

// Convert each channel to polar form once. Keep native FFT order (DC at [0,0]).
export function analyzeRGB(rgba, fft) {
  const count = fft.size ** 2;
  if (rgba.length !== count * 4) throw new RangeError('Wrong RGBA image size.');
  return Array.from({ length: 3 }, (_, channel) => {
    const real = Float64Array.from({ length: count }, (_, i) => rgba[i * 4 + channel]);
    const imag = new Float64Array(count);
    fft2(real, imag, fft);
    const magnitude = new Float64Array(count);
    const phase = new Float64Array(count);
    for (let y = 0; y < fft.size; y++) for (let x = 0; x < fft.size; x++) {
      const i = y * fft.size + x;
      const j = ((fft.size - y) % fft.size) * fft.size + (fft.size - x) % fft.size;
      if (i > j) continue;
      // Project roundoff back onto the Hermitian symmetry of a REAL input.
      // Near spectral zeros, independently taking atan2 of each partner can
      // amplify tiny asymmetric FFT errors into a large imaginary swap result.
      const re = (real[i] + real[j]) / 2;
      const im = i === j ? 0 : (imag[i] - imag[j]) / 2;
      const amplitude = Math.hypot(re, im);
      const angle = amplitude === 0 ? 0 : Math.atan2(im, re);
      magnitude[i] = magnitude[j] = amplitude;
      phase[i] = angle;
      if (i !== j) phase[j] = angle === 0 ? 0 : -angle;
    }
    return { magnitude, phase };
  });
}

// No fftshift, normalization of contrast, abs(IFFT), or early integer conversion.
export function reconstructChannel(magnitude, phase, fft) {
  const count = fft.size ** 2;
  if (magnitude.length !== count || phase.length !== count) throw new RangeError('Wrong spectrum size.');
  const real = new Float64Array(count);
  const imag = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    real[i] = magnitude[i] * Math.cos(phase[i]);
    // DC and the three other self-conjugate bins must stay exactly real.
    const y = Math.floor(i / fft.size), x = i % fft.size;
    const selfConjugate = (x === 0 || x === fft.size / 2) && (y === 0 || y === fft.size / 2);
    imag[i] = selfConjugate ? 0 : magnitude[i] * Math.sin(phase[i]);
  }
  fft2(real, imag, fft, true);
  return { real, imag };
}

export function reconstructRGB(magnitudeSource, phaseSource, fft, swapChannels = [true, true, true], phaseChannels = [0, 1, 2]) {
  if (!Array.isArray(swapChannels) || swapChannels.length !== 3 ||
      [0, 1, 2].some(channel => typeof swapChannels[channel] !== 'boolean')) {
    throw new RangeError('Swap channels must be an array of three booleans (R, G, B).');
  }
  if (!Array.isArray(phaseChannels) || phaseChannels.length !== 3 ||
      [0, 1, 2].some(channel => !Number.isInteger(phaseChannels[channel]) || phaseChannels[channel] < 0 || phaseChannels[channel] > 2)) {
    throw new RangeError('Phase channels must be an array of three integers from 0 to 2 (R, G, B).');
  }
  const count = fft.size ** 2;
  const rgba = new Uint8ClampedArray(count * 4);
  let minimum = Infinity;
  let maximum = -Infinity;
  let maxImaginary = 0;
  let clipped = 0;
  for (let channel = 0; channel < 3; channel++) {
    const { real, imag } = reconstructChannel(
      magnitudeSource[channel].magnitude,
      // Only phase can cross colors. Magnitude and output RGB positions stay fixed.
      swapChannels[channel] ? phaseSource[phaseChannels[channel]].phase : magnitudeSource[channel].phase, fft,
    );
    for (let i = 0; i < count; i++) {
      const value = real[i];
      if (!Number.isFinite(value) || !Number.isFinite(imag[i])) throw new Error('Non-finite IFFT output.');
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
      maxImaginary = Math.max(maxImaginary, Math.abs(imag[i]));
      // Exclude floating-point dust from the displayed clipping statistic.
      if (value < -1e-7 || value > 255 + 1e-7) clipped++;
      rgba[i * 4 + channel] = Math.round(Math.max(0, Math.min(255, value)));
    }
  }
  for (let i = 0; i < count; i++) rgba[i * 4 + 3] = 255;
  return {
    rgba,
    stats: { minimum, maximum, maxImaginary, clippedFraction: clipped / (count * 3) },
  };
}

// A deterministic numerical check, runnable in both the browser Worker and Node.
export function checkRoundTrip(size = IMAGE_SIZE) {
  const fft = new FFT(size);
  const input = Float64Array.from({ length: size * size }, (_, i) =>
    (i * 37 + Math.floor(i / size) * 19) % 256);
  const real = input.slice();
  const imag = new Float64Array(input.length);
  fft2(real, imag, fft);
  fft2(real, imag, fft, true);
  let maxError = 0;
  let maxImaginary = 0;
  for (let i = 0; i < input.length; i++) {
    maxError = Math.max(maxError, Math.abs(real[i] - input[i]));
    maxImaginary = Math.max(maxImaginary, Math.abs(imag[i]));
  }
  return { maxError, maxImaginary, passed: maxError < 1e-8 && maxImaginary < 1e-8 };
}
