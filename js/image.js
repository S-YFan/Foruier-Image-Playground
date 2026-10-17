import { IMAGE_SIZE } from './fourier.js';

// Shared by the UI and browser tests; no alternative test-only resizing path.
export async function prepareImage(url) {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error('圖片無法解碼，請選擇有效的 PNG、JPEG 或 WebP 檔案。');
  }
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error('這張圖片沒有有效的尺寸。');
  const side = Math.min(width, height);
  // Crop BEFORE resizing. A single drawImage(source rectangle, destination)
  // can sample pixels outside the source rectangle at the smoothing boundary.
  // For odd excess dimensions, leave the extra pixel on the right/bottom.
  const bitmap = await createImageBitmap(image,
    Math.floor((width - side) / 2), Math.floor((height - side) / 2), side, side,
    { resizeWidth: IMAGE_SIZE, resizeHeight: IMAGE_SIZE, resizeQuality: 'high' });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = IMAGE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  try {
    context.drawImage(bitmap, 0, 0);
  } finally {
    bitmap.close();
  }
  return { rgba: context.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data, width, height };
}
