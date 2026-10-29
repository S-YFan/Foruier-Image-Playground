import { FFT } from './fft.js';
import { IMAGE_SIZE, analyzeRGB, reconstructRGB, checkRoundTrip } from './fourier.js';

const fft = new FFT(IMAGE_SIZE);
const cache = { A: null, B: null };

self.onmessage = ({ data }) => {
  const { id, type, slot, rgba, swapChannels = [true, true, true], phaseChannels = [0, 1, 2] } = data;
  try {
    if (type === 'check') {
      self.postMessage({ id, result: checkRoundTrip() });
    } else if (type === 'image') {
      if (slot !== 'A' && slot !== 'B') throw new Error('Unknown image slot.');
      cache[slot] = analyzeRGB(rgba, fft);
      self.postMessage({ id, result: true });
    } else if (type === 'swap') {
      if (!cache.A || !cache.B) throw new Error('Please load both images first.');
      const start = performance.now();
      const first = reconstructRGB(cache.A, cache.B, fft, swapChannels, phaseChannels);
      const second = reconstructRGB(cache.B, cache.A, fft, swapChannels, phaseChannels);
      self.postMessage({ id, result: { first, second, swapChannels: [...swapChannels], phaseChannels: [...phaseChannels], milliseconds: performance.now() - start } },
        [first.rgba.buffer, second.rgba.buffer]);
    } else {
      throw new Error('Unknown worker request.');
    }
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
