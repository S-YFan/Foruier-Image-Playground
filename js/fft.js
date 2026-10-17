// Radix-2 Cooley-Tukey FFT. No dependencies; Float64 throughout.
// Forward: exp(-i*2*pi*k*n/N), unscaled. Inverse: exp(+i*...), divided by N.
export class FFT {
  constructor(size) {
    if (!Number.isInteger(size) || size < 2 || size > 16384 || (size & (size - 1))) {
      throw new RangeError('FFT size must be a power of two between 2 and 16384.');
    }
    this.size = size;
    this.reverse = new Uint32Array(size);
    this.cos = new Float64Array(size / 2);
    this.sin = new Float64Array(size / 2);
    const bits = Math.log2(size);
    for (let i = 0; i < size; i++) {
      let value = i;
      let reversed = 0;
      for (let bit = 0; bit < bits; bit++) {
        reversed = (reversed << 1) | (value & 1);
        value >>>= 1;
      }
      this.reverse[i] = reversed;
    }
    for (let k = 0; k < size / 2; k++) {
      this.cos[k] = Math.cos(2 * Math.PI * k / size);
      this.sin[k] = Math.sin(2 * Math.PI * k / size);
    }
  }

  transform(real, imag, inverse = false) {
    const n = this.size;
    if (real.length !== n || imag.length !== n) throw new RangeError('Wrong FFT length.');
    for (let i = 0; i < n; i++) {
      const j = this.reverse[i];
      if (j > i) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
    for (let width = 2; width <= n; width *= 2) {
      const half = width / 2;
      const step = n / width;
      for (let start = 0; start < n; start += width) {
        for (let j = 0; j < half; j++) {
          const c = this.cos[j * step];
          const s = (inverse ? 1 : -1) * this.sin[j * step];
          const even = start + j;
          const odd = even + half;
          const tr = c * real[odd] - s * imag[odd];
          const ti = s * real[odd] + c * imag[odd];
          real[odd] = real[even] - tr;
          imag[odd] = imag[even] - ti;
          real[even] += tr;
          imag[even] += ti;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) {
        real[i] /= n;
        imag[i] /= n;
      }
    }
  }
}

// Row-major indexing: index = y * size + x. Transform rows, then columns.
// The two inverse passes divide by size twice: total normalization 1/size².
export function fft2(real, imag, fft, inverse = false) {
  const n = fft.size;
  if (real.length !== n * n || imag.length !== n * n) throw new RangeError('Wrong 2D FFT shape.');
  const lineReal = new Float64Array(n);
  const lineImag = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    fft.transform(real.subarray(y * n, (y + 1) * n), imag.subarray(y * n, (y + 1) * n), inverse);
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      lineReal[y] = real[y * n + x];
      lineImag[y] = imag[y * n + x];
    }
    fft.transform(lineReal, lineImag, inverse);
    for (let y = 0; y < n; y++) {
      real[y * n + x] = lineReal[y];
      imag[y * n + x] = lineImag[y];
    }
  }
}
