// Spectrum Lab: one grayscale channel, using the unchanged Phase 1 FFT core.
import { FFT, fft2 } from './fft.js';
import { IMAGE_SIZE, analyzeRGB, reconstructChannel } from './fourier.js';

export const SIZE = IMAGE_SIZE;
export const SHIFT = Object.freeze({ x: 32, y: 24 });
export const SQUARE_SIDE = 64;
export const STRIPE_PERIOD = 32;
export const PHASE_RELATIVE_THRESHOLD = 1e-10;
export const PERIODS = Object.freeze([8, 16, 32, 64, 128]);
export const SHIFT_LIMIT = (SIZE - SQUARE_SIDE) / 2;
export const NEUTRAL = Object.freeze([70, 76, 72]);
export const PRESETS = Object.freeze([
  Object.freeze({ id: 'square', name: 'Square', description: '水平與垂直邊界形成沿頻率軸延伸的 sinc 型振幅結構；兩軸之間也有旁瓣。' }),
  Object.freeze({ id: 'circle', name: 'Circle', description: '圓的旋轉對稱性對應近似同心環狀的振幅；像素網格使離散頻譜不會完全旋轉對稱。' }),
  Object.freeze({ id: 'stripes', name: 'Vertical Stripes', description: '每 32 像素重複一次，沿水平方向變化：峰值出現在水平頻率軸，每隔 8 bins，含方波的奇次諧波。' }),
  Object.freeze({ id: 'shifted-square', name: 'Shifted Square', description: '同一份 Square 像素向右 32、向下 24 像素循環平移；振幅保持相同，相位依頻率產生線性斜坡（以 2π 包裹）。' }),
]);

export function circularShift(pixels, size, dx, dy) {
  if (pixels.length !== size * size || !Number.isInteger(dx) || !Number.isInteger(dy)) {
    throw new RangeError('Invalid circular shift.');
  }
  const result = new pixels.constructor(pixels.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = ((x - dx) % size + size) % size;
    const sy = ((y - dy) % size + size) % size;
    result[y * size + x] = pixels[sy * size + sx];
  }
  return result;
}

export function createPreset(id, options = {}) {
  if (!PRESETS.some(preset => preset.id === id)) throw new RangeError('Unknown preset.');
  const side = options.side ?? SQUARE_SIDE, radius = options.radius ?? 40, period = options.period ?? STRIPE_PERIOD;
  if (!Number.isInteger(side) || side < 16 || side > 160 || side % 2 || !Number.isInteger(radius) || radius < 8 || radius > 96 || !PERIODS.includes(period)) {
    throw new RangeError('Invalid geometry parameter.');
  }
  // A shifted image MUST come from the original pixels, never a second drawing.
  if (id === 'shifted-square') return circularShift(createPreset('square', options), SIZE, options.dx ?? SHIFT.x, options.dy ?? SHIFT.y);
  const pixels = new Uint8Array(SIZE * SIZE).fill(255);
  const start = (SIZE - side) / 2;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const inside = id === 'square' ? x >= start && x < start + side && y >= start && y < start + side
      : id === 'circle' ? (x - (SIZE - 1) / 2) ** 2 + (y - (SIZE - 1) / 2) ** 2 <= radius ** 2
      : x % period < period / 2;
    if (inside) pixels[y * SIZE + x] = 0;
  }
  return pixels;
}

export function analyzeGray(pixels, fft = new FFT(SIZE)) {
  if (pixels.length !== fft.size ** 2) throw new RangeError('Wrong grayscale image size.');
  const real = Float64Array.from(pixels);
  const imag = new Float64Array(pixels.length);
  fft2(real, imag, fft);
  const magnitude = new Float64Array(pixels.length);
  const phase = new Float64Array(pixels.length);
  let maxMagnitude = 0;
  for (let i = 0; i < pixels.length; i++) {
    magnitude[i] = Math.hypot(real[i], imag[i]);
    // Zero phase is only a storage convention; the renderer masks undefined phase.
    phase[i] = magnitude[i] === 0 ? 0 : Math.atan2(imag[i], real[i]);
    maxMagnitude = Math.max(maxMagnitude, magnitude[i]);
  }
  return { real, imag, magnitude, phase, maxMagnitude };
}

// Display copy only. Native FFT indices and cached coefficients never move.
export function fftshift(values, size) {
  if (values.length !== size * size || size % 2) throw new RangeError('fftshift requires an even square.');
  return circularShift(values, size, size / 2, size / 2);
}

// HSV: full saturation/value; -π and +π share red, 0 is cyan.
export function phaseColor(angle) {
  const hue = ((((angle + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1) * 6;
  const sector = Math.floor(hue);
  const fraction = hue - sector;
  const up = Math.round(255 * fraction), down = 255 - up;
  return [[255, up, 0], [down, 255, 0], [0, 255, up], [0, down, 255], [up, 0, 255], [255, 0, down]][sector];
}

export function grayRGBA(pixels) {
  const rgba = new Uint8ClampedArray(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) {
    rgba[4 * i] = rgba[4 * i + 1] = rgba[4 * i + 2] = pixels[i];
    rgba[4 * i + 3] = 255;
  }
  return rgba;
}

export function renderSpectra(spectrum, size = SIZE, magnitudeScale = spectrum.maxMagnitude) {
  const shiftedMagnitude = fftshift(spectrum.magnitude, size);
  const shiftedPhase = fftshift(spectrum.phase, size);
  const magnitude = new Uint8ClampedArray(size * size * 4);
  const phase = new Uint8ClampedArray(magnitude.length);
  const denominator = Math.log1p(magnitudeScale);
  const threshold = spectrum.maxMagnitude * PHASE_RELATIVE_THRESHOLD;
  let maskedBins = 0;
  for (let i = 0; i < shiftedMagnitude.length; i++) {
    const value = denominator === 0 ? 0 : Math.round(255 * Math.log1p(shiftedMagnitude[i]) / denominator);
    magnitude[4 * i] = magnitude[4 * i + 1] = magnitude[4 * i + 2] = value;
    magnitude[4 * i + 3] = phase[4 * i + 3] = 255;
    const masked = shiftedMagnitude[i] <= threshold;
    const color = masked ? [70, 76, 72] : phaseColor(shiftedPhase[i]);
    if (masked) maskedBins++;
    phase.set(color, 4 * i);
  }
  return { magnitude, phase, threshold, maskedBins };
}

// arg(G * conjugate(F)) uses the actual complex coefficients, modulo 2π.
// A single joint display mask is shared by both phase-difference visualizations.
export function phaseDifference(original, shifted) {
  const count = original.real.length;
  const difference = new Float64Array(count), change = new Float64Array(count), valid = new Uint8Array(count);
  const threshold = Math.max(original.maxMagnitude, shifted.maxMagnitude) * PHASE_RELATIVE_THRESHOLD;
  let validBins = 0, maxChange = 0;
  for (let i = 0; i < count; i++) {
    if (original.magnitude[i] <= threshold || shifted.magnitude[i] <= threshold) continue;
    valid[i] = 1;
    validBins++;
    const re = shifted.real[i] * original.real[i] + shifted.imag[i] * original.imag[i];
    const im = shifted.imag[i] * original.real[i] - shifted.real[i] * original.imag[i];
    difference[i] = Math.atan2(im, re);
    change[i] = 2 * Math.abs(Math.sin(difference[i] / 2));
    maxChange = Math.max(maxChange, change[i]);
  }
  return { difference, change, valid, threshold, validBins, maxChange };
}

// Fixed 0–2 scale: 0 is near-black, 2 is warm white. Never min-max normalized.
export function phaseChangeColor(value) {
  const t = Math.max(0, Math.min(1, value / 2));
  return [Math.round(12 + 243 * t), Math.round(19 + 222 * t), Math.round(16 + 178 * t)];
}

export function renderPhaseDifference(data, size = SIZE) {
  const angles = fftshift(data.difference, size), changes = fftshift(data.change, size), valid = fftshift(data.valid, size);
  const difference = new Uint8ClampedArray(size * size * 4), change = new Uint8ClampedArray(difference.length);
  for (let i = 0; i < valid.length; i++) {
    difference.set(valid[i] ? phaseColor(angles[i]) : NEUTRAL, i * 4);
    change.set(valid[i] ? phaseChangeColor(changes[i]) : NEUTRAL, i * 4);
    difference[i * 4 + 3] = change[i * 4 + 3] = 255;
  }
  return { difference, change };
}

// Use Phase 1's unchanged Hermitian projection, zero-phase convention and IFFT.
// Only one grayscale channel is reconstructed; display uses its clamp + round rule.
export function reconstructionPolar(pixels, fft) {
  return analyzeRGB(grayRGBA(pixels), fft)[0];
}

export function reconstructPosition(originalPolar, shiftedPolar, targetPixels, fft) {
  const { real, imag } = reconstructChannel(originalPolar.magnitude, shiftedPolar.phase, fft);
  const display = new Uint8Array(real.length);
  let maxError = 0, maxImaginary = 0, displayedError = 0;
  for (let i = 0; i < real.length; i++) {
    if (!Number.isFinite(real[i]) || !Number.isFinite(imag[i])) throw new Error('Non-finite translation reconstruction.');
    display[i] = Math.round(Math.max(0, Math.min(255, real[i])));
    maxError = Math.max(maxError, Math.abs(real[i] - targetPixels[i]));
    maxImaginary = Math.max(maxImaginary, Math.abs(imag[i]));
    displayedError = Math.max(displayedError, Math.abs(display[i] - targetPixels[i]));
  }
  return { real, imag, rgba: grayRGBA(display), stats: { maxError, maxImaginary, displayedError } };
}

export function validateTranslation(dx, dy) {
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) > SHIFT_LIMIT || Math.abs(dy) > SHIFT_LIMIT) {
    throw new RangeError('Translation must use integer pixels between -96 and 96.');
  }
}

export function compareShift(original, shifted, size = SIZE, shift = SHIFT) {
  let maxMagnitudeDifference = 0, maxCoefficientError = 0;
  for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) {
    const i = v * size + u;
    // Integer shifts are periodic in N: reduce before sin/cos to avoid large-angle roundoff.
    const angle = -2 * Math.PI * ((u * shift.x + v * shift.y) % size) / size;
    const c = Math.cos(angle), s = Math.sin(angle);
    const expectedReal = original.real[i] * c - original.imag[i] * s;
    const expectedImag = original.real[i] * s + original.imag[i] * c;
    maxCoefficientError = Math.max(maxCoefficientError, Math.hypot(shifted.real[i] - expectedReal, shifted.imag[i] - expectedImag));
    maxMagnitudeDifference = Math.max(maxMagnitudeDifference, Math.abs(original.magnitude[i] - shifted.magnitude[i]));
  }
  return { maxMagnitudeDifference, relativeMagnitudeDifference: maxMagnitudeDifference / (original.maxMagnitude || 1), maxCoefficientError };
}
