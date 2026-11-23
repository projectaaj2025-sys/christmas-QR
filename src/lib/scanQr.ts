import jsQR from 'jsqr';

type Pixels = (data: Uint8ClampedArray, width: number, height: number) => string | null;

const decode: Pixels = (data, width, height) => {
  const found = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return found?.data ?? null;
};

/** Nearest-neighbour upscale: phones like big crisp modules, and so does jsQR. */
function upscale(src: ImageData, factor: number): ImageData {
  if (factor <= 1) return src;
  const { width, height, data } = src;
  const out = new ImageData(width * factor, height * factor);
  for (let y = 0; y < height * factor; y += 1) {
    const sy = (y / factor) | 0;
    for (let x = 0; x < width * factor; x += 1) {
      const sx = (x / factor) | 0;
      const from = (sy * width + sx) * 4;
      const to = (y * width * factor + x) * 4;
      out.data[to] = data[from];
      out.data[to + 1] = data[from + 1];
      out.data[to + 2] = data[from + 2];
      out.data[to + 3] = data[from + 3];
    }
  }
  return out;
}

/** Boost contrast: screenshots of dark trees on snow often scan near 50% grey. */
function contrast(src: ImageData, amount = 1.6, bias = 8): ImageData {
  const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) lut[i] = Math.max(0, Math.min(255, (i - 128) * amount + 128 + bias));
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = lut[out.data[i]];
    out.data[i + 1] = lut[out.data[i + 1]];
    out.data[i + 2] = lut[out.data[i + 2]];
  }
  return out;
}

/**
 * Read a QR code out of an image. Tries the picture as-is first, then an
 * upscaled and a contrast-boosted pass — screenshots of a tree mid-flip are
 * exactly the kind of input a single jsQR call gives up on.
 */
export function scanImageData(image: ImageData): string | null {
  const direct = decode(image.data, image.width, image.height);
  if (direct) return direct;

  const big = upscale(image, 2);
  const boosted = decode(big.data, big.width, big.height);
  if (boosted) return boosted;

  for (const amount of [1.4, 2.2]) {
    const tweaked = contrast(big, amount);
    const hit = decode(tweaked.data, tweaked.width, tweaked.height);
    if (hit) return hit;
  }
  return null;
}

/** Draw a source image onto a canvas, capped so scanning stays responsive. */
export function imageToData(source: ImageBitmap | HTMLImageElement, maxSide = 1200): ImageData {
  const width = 'width' in source ? source.width : 0;
  const height = 'height' in source ? source.height : 0;
  const scale = Math.min(1, maxSide / Math.max(width, height || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
