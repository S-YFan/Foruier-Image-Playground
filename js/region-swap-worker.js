import { FFT } from './fft.js';
import { IMAGE_SIZE, analyzeRGB } from './fourier.js';
import { partialPhaseSwapRGB, displayPhaseSwap, displayPhaseMask } from './region-swap.js';

const fft = new FFT(IMAGE_SIZE);
const spectra = { A: null, B: null };

self.onmessage = ({ data }) => {
  const { id, type } = data ?? {};
  try {
    if (type === 'image') {
      if (!Object.hasOwn(spectra, data.slot)) throw new Error('Image slot must be A or B.');
      // Commit only after a successful analysis, retaining the last valid image.
      const spectrum = analyzeRGB(data.rgba, fft);
      spectra[data.slot] = spectrum;
      self.postMessage({ id, result: true });
    } else if (type === 'reconstruct') {
      if (!spectra.A || !spectra.B) throw new Error('Please load both images A and B first.');
      const start = performance.now();
      const { channels, mask, stats } = partialPhaseSwapRGB(spectra.A, spectra.B, fft, data.parameters);
      const rgba = displayPhaseSwap(channels), maskRGBA = displayPhaseMask(mask, IMAGE_SIZE);
      self.postMessage({ id, result: { rgba, maskRGBA, stats, milliseconds: performance.now() - start } },
        [rgba.buffer, maskRGBA.buffer]);
    } else {
      throw new Error('Unknown worker request.');
    }
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
