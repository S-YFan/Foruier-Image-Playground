import { FFT } from './fft.js';
import { IMAGE_SIZE, analyzeRGB } from './fourier.js';
import { filterRGB, displayFilteredRGB } from './filtering.js';

const fft = new FFT(IMAGE_SIZE);
let spectrum = null;
const groups = { all: ['lpf', 'hpf', 'sharpen'], pass: ['lpf', 'hpf'], sharpen: ['sharpen'] };

self.onmessage = ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'image') {
      // Commit only after a successful analysis, retaining the last valid image.
      spectrum = analyzeRGB(data.rgba, fft);
      self.postMessage({ id, result: true });
    } else if (type === 'filter') {
      if (!spectrum) throw new Error('Please load an image first.');
      const group = data.group ?? 'all';
      if (!Object.hasOwn(groups, group)) throw new Error('Unknown filter group.');
      const start = performance.now();
      const numerical = filterRGB(spectrum, fft, {
        sigma: data.sigma, alpha: group === 'pass' ? undefined : data.alpha, filters: groups[group],
      });
      const result = Object.fromEntries(Object.entries(numerical).map(([name, channels]) =>
        [name, displayFilteredRGB(channels, name)]));
      const transfer = Object.values(result).map(rgba => rgba.buffer);
      result.milliseconds = performance.now() - start;
      self.postMessage({ id, result }, transfer);
    } else {
      throw new Error('Unknown worker request.');
    }
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
