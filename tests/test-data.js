// Deterministic fixtures shared by the Node and browser verification suites.
export function pixels(size, value) {
  return Uint8ClampedArray.from({ length: size * size * 4 }, (_, i) => {
    const pixel = Math.floor(i / 4);
    return i % 4 === 3 ? 255 : value(pixel % size, Math.floor(pixel / size), i % 4);
  });
}

export function noise(size, seed = 5) {
  let state = seed;
  return pixels(size, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state >>> 24;
  });
}

export function fixtures(size) {
  return {
    black: pixels(size, () => 0),
    white: pixels(size, () => 255),
    gray: pixels(size, (x, y) => (x * 17 + y * 23) % 256),
    rgb: noise(size),
    differentRGB: noise(size, 997),
    diagonal: pixels(size, (x, y) => (x + y) % 256),
    cosine: pixels(size, (x, y) => Math.round(127 + 100 * Math.cos(2 * Math.PI * (3 * x + 5 * y) / size))),
    nyquist: pixels(size, (x, y, c) => (c === 0 ? x % 2 : c === 1 ? y % 2 : (x + y) % 2) * 255),
    impulse: pixels(size, (x, y, c) => x === 3 + c && y === 2 + c ? 255 : 0),
  };
}

export function maxDifference(a, b) {
  if (a.length !== b.length) throw new Error('Different lengths');
  let error = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return Infinity;
    error = Math.max(error, Math.abs(a[i] - b[i]));
  }
  return error;
}
