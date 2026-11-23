import { eccFor, encodeQR, qrSvg } from './qr';
import { drawScene } from './scene';
import type { SceneLook } from './scene';

const SVG_NS = 'http://www.w3.org/2000/svg';

function download(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

const slug = (text: string) =>
  text
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'qr-tree';

/** A "scan me" card: the tree on the left, a plain code on the right. */
export async function renderCard(opts: {
  look: SceneLook;
  text: string;
  message?: string;
  size?: number;
}): Promise<Blob> {
  const size = opts.size ?? 1600;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  // Draw the scene on a canvas wider than the card and shift it left, so the
  // sky covers the whole card with no visible seam and the tree sits off-centre.
  const sceneW = size * 1.5;
  ctx.save();
  ctx.translate(size * 0.3 - sceneW / 2, 0);
  drawScene(ctx, sceneW, size, {
    text: opts.text,
    look: opts.look,
    morph: 0,
    time: 2.5,
    snowfall: 1,
  });
  ctx.restore();

  // a soft scrim so the code tile reads against the sky
  const scrim = ctx.createLinearGradient(size * 0.42, 0, size, 0);
  scrim.addColorStop(0, 'rgba(4,16,26,0)');
  scrim.addColorStop(0.45, 'rgba(4,16,26,0.55)');
  scrim.addColorStop(1, 'rgba(4,16,26,0.8)');
  ctx.fillStyle = scrim;
  ctx.fillRect(size * 0.4, 0, size * 0.6, size);

  // the code itself: integer pixels, generous quiet zone
  const grid = encodeQR(opts.text, eccFor(opts.text));
  const n = grid.length;
  const tile = size * 0.42;
  const tileX = size * 0.53;
  const tileY = size * 0.24;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = size * 0.03;
  ctx.shadowOffsetY = size * 0.008;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(tileX, tileY, tile, tile, tile * 0.055);
  ctx.fill();
  ctx.restore();

  const cell = Math.max(1, Math.floor((tile * 0.84) / n));
  const codeSize = cell * n;
  const codeX = Math.round(tileX + (tile - codeSize) / 2);
  const codeY = Math.round(tileY + (tile - codeSize) / 2);
  ctx.fillStyle = opts.look.module;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (grid[r][c]) ctx.fillRect(codeX + c * cell, codeY + r * cell, cell, cell);
    }
  }

  // captions
  const centre = tileX + tile / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.round(size * 0.026)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('scan me', centre, tileY + tile + size * 0.052);

  if (opts.message) {
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = `400 ${Math.round(size * 0.024)}px ui-sans-serif, system-ui, sans-serif`;
    const words = opts.message.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      if ((line + word).length > 26) {
        lines.push(line.trim());
        line = '';
      }
      line += `${word} `;
    }
    if (line.trim()) lines.push(line.trim());
    lines.slice(0, 4).forEach((text, i) => {
      ctx.fillText(text, centre, tileY + tile + size * (0.105 + i * 0.032));
    });
  }

  // wordmark sits in the sky corner, where it stays legible on every palette
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `500 ${Math.round(size * 0.019)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('christmas qr — tap the tree to see the code', size * 0.055, size * 0.075);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('export failed'))), 'image/png'),
  );
}

export function downloadPng(text: string, look: SceneLook, filename: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 1050;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawScene(ctx, canvas.width, canvas.height, {
    text,
    look,
    morph: 1,
    time: 3,
    snowfall: 0,
  });
  canvas.toBlob((blob) => blob && download(blob, `${slug(filename)}-qr.png`), 'image/png');
}

export async function downloadCard(text: string, look: SceneLook, message: string, filename: string) {
  const blob = await renderCard({ look, text, message });
  download(blob, `${slug(filename)}-card.png`);
}

export function downloadSvg(text: string, filename: string) {
  const markup = `<?xml version="1.0" encoding="UTF-8"?>\n${qrSvg(text, eccFor(text))}`;
  download(new Blob([markup], { type: 'image/svg+xml' }), `${slug(filename)}.svg`);
}

/** A react-free snippet the user can paste into any site. */
export function embedSnippet(src: string, height = 640): string {
  return `<div style="max-width:720px;margin:0 auto">
  <iframe
    src="${src}"
    title="Christmas QR tree"
    loading="lazy"
    allow="fullscreen"
    style="width:100%;height:${height}px;border:0;border-radius:18px;overflow:hidden"
  ></iframe>
</div>`;
}

/** A tiny inline widget: grows the same tree straight into any page. */
export function scriptSnippet(mountId: string, src: string): string {
  return `<div id="${mountId}"></div>
<script src="${src}" async></script>`;
}

/** SVG with the tree drawn from the code — sized for print / email. */
export function treeSvg(text: string): string {
  const grid = encodeQR(text, eccFor(text));
  const n = grid.length;
  const size = 640;
  const cell = size / n;
  const dots: string[] = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!grid[r][c]) continue;
      dots.push(
        `<circle cx="${((c + 0.5) * cell).toFixed(1)}" cy="${((r + 0.5) * cell).toFixed(1)}" r="${(cell * 0.42).toFixed(1)}"/>`,
      );
    }
  }
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<rect width="${size}" height="${size}" fill="#ffffff"/>
<g fill="#10222f">${dots.join('')}</g>
</svg>`;
}
