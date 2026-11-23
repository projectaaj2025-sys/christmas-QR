import { readState } from './urlState';
import { imageToData, scanImageData } from './scanQr';
import type { Greeting } from './store';

export { readState };

/** newest first */
export const sortGreetings = (list: Greeting[]) =>
  [...list].sort((a, b) => b.receivedAt - a.receivedAt);

async function scanBitmap(bitmap: ImageBitmap | HTMLImageElement): Promise<string | null> {
  try {
    return scanImageData(imageToData(bitmap, 1200));
  } catch {
    return null;
  }
}

/** Read a QR code out of a photo or screenshot. Null when nothing decodes. */
export async function decodeImageFile(file: File): Promise<string | null> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    const hit = await scanBitmap(bitmap);
    bitmap.close?.();
    return hit;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    return await scanBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Same, for images pasted out of a clipboard or dropped onto the dialog. */
export async function decodeImageBlob(blob: Blob): Promise<string | null> {
  const file = blob instanceof File ? blob : new File([blob], 'pasted.png', { type: blob.type });
  return decodeImageFile(file);
}
