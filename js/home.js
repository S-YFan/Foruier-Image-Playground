import { t } from './i18n.js';
import { prepareImage } from './image.js';
import { analyzeGray, renderSpectra, grayRGBA } from './spectrum.js';

// A single fixed example, using the lab's existing FFT and display functions.
// This illustrates the representation; interactive controls live in the labs.
try {
  const { rgba } = await prepareImage(new URL('../Monkey.jpg', import.meta.url).href);
  const red = Uint8Array.from({ length: 256 * 256 }, (_, i) => rgba[4 * i]);
  const spectra = renderSpectra(analyzeGray(red));
  for (const [id, data] of [['home-source', grayRGBA(red)], ['home-magnitude', spectra.magnitude], ['home-phase', spectra.phase]]) {
    const canvas = document.getElementById(id);
    canvas.getContext('2d').putImageData(new ImageData(data, 256, 256), 0, 0);
  }
  document.querySelector('[data-spectrum-status]').textContent = t('homeSpectrum');
} catch {
  document.querySelector('[data-spectrum-status]').textContent = t('homeFailure');
}
