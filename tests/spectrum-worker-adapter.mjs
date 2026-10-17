import { parentPort } from 'node:worker_threads';
import { FFT } from '../js/fft.js';
let forwardLines = 0;
let inverseLines = 0;
const transform = FFT.prototype.transform;
FFT.prototype.transform = function (...args) { args[2] ? inverseLines++ : forwardLines++; return transform.apply(this, args); };
globalThis.self = { postMessage(message, transfer) { parentPort.postMessage({ ...message, forwardLines, inverseLines }, transfer); } };
await import('../js/spectrum-worker.js');
parentPort.on('message', data => self.onmessage({ data }));
