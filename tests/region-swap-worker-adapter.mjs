import { parentPort } from 'node:worker_threads';
import { FFT } from '../js/fft.js';

const counts = { forwardLines: 0, inverseLines: 0 };
const transform = FFT.prototype.transform;
FFT.prototype.transform = function (real, imag, inverse = false) {
  counts[inverse ? 'inverseLines' : 'forwardLines']++;
  return transform.call(this, real, imag, inverse);
};
globalThis.self = { postMessage(message, transfer) {
  parentPort.postMessage({ ...message, counts: { ...counts } }, transfer);
} };
await import('../js/region-swap-worker.js');
parentPort.on('message', data => self.onmessage({ data }));
