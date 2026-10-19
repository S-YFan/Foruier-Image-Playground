// Shared website samples. Keep the original photographs and both illustrations.
export const SAMPLE_IMAGES = Object.freeze({
  'sample-a.svg': { url: new URL('../assets/sample-a.svg', import.meta.url).href, name: 'Mountain lake' },
  'sample-b.svg': { url: new URL('../assets/sample-b.svg', import.meta.url).href, name: 'Coastal lighthouse' },
  'Monkey.jpg': { url: new URL('../Monkey.jpg', import.meta.url).href, name: 'Monkey.jpg' },
  'Cat.jpg': { url: new URL('../Cat.jpg', import.meta.url).href, name: 'Cat.jpg' },
});

export const DEFAULT_SAMPLES = Object.freeze({ A: 'sample-a.svg', B: 'sample-b.svg' });
