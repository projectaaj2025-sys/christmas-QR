import { eccFor, encodeQR } from './qr';

export interface SceneLook {
  sky: [string, string];
  snow: [string, string];
  module: string;
  foliage: [string, string];
  trim: string;
  trunk: string;
  ornaments: string[];
  star: string;
  garland: string[];
  auroraRibbon?: boolean;
  tiers: number;
}

export interface SceneOptions {
  /** the QR payload; the shape of the tree is seeded from it */
  text: string;
  look: SceneLook;
  /** 0 = tree standing, 1 = code lying flat on the snow */
  morph: number;
  /** seconds since mount, drives sway and twinkle */
  time: number;
  /** 0 turns the snow off, 1 is a gentle flurry */
  snowfall: number;
}

/** deterministic RNG so the same payload always grows the same tree */
function seeded(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** mix a #rrggbb colour toward black (k < 0) or white (k > 0) */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}

interface Blossom {
  gx: number;
  gy: number;
  tx: number;
  ty: number;
  /** 0 = on the far side of the tree, 1 = front and centre */
  front: number;
  radius: number;
  color: string;
  phase: number;
  fall: number;
  spin: number;
}

interface Tier {
  top: number;
  bottom: number;
  radius: number;
  sway: number;
}

/** One draw pass of the tree → code scene. Safe to call at any size. */
export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, o: SceneOptions) {
  const m = easeInOut(clamp01(o.morph));
  const rand = seeded(o.text);
  const grid = encodeQR(o.text || ' ', eccFor(o.text));
  const n = grid.length;
  const t = o.time;

  const unit = Math.min(w, h);
  const scale = unit / 720;

  // ---- flat-code layout: a plaza seen from straight above --------------
  // whole-pixel modules only: fractional module edges are what make phone
  // scanners give up, even when the code looks perfectly fine to the eye
  const cell = Math.max(3, Math.floor(Math.min(w * 0.78, h * 0.66) / n));
  const side = cell * n;
  const left = Math.round((w - side) / 2);
  const top = Math.round((h - side) / 2 + h * 0.02);

  // ---- tree geometry ---------------------------------------------------
  const baseY = h * 0.82;
  const treeTop = h * 0.19;
  const treeH = baseY - treeTop;
  const tierCount = Math.max(3, o.look.tiers + 1);
  const step = (treeH * 0.68) / (tierCount - 1);
  const maxRadius = unit * 0.3;

  const tiers: Tier[] = [];
  for (let i = 0; i < tierCount; i += 1) {
    const f = i / (tierCount - 1);
    tiers.push({
      top: treeTop + i * step,
      bottom: treeTop + i * step + step * 1.45,
      radius: maxRadius * (0.18 + 0.82 * Math.pow(f, 0.85)),
      sway: Math.sin(t * 0.5 + i * 0.8) * cell * 0.45 * (1 - m),
    });
  }

  /**
   * A point on the front skirt of tier `i`.
   * u: −1 left edge … 1 right edge, v: 0 hem line … 1 where the tier starts.
   */
  const skirtPoint = (i: number, u: number, v: number): [number, number] => {
    const tier = tiers[i];
    const width = tier.radius * lerp(0.18, 1, Math.pow(v, 0.78));
    const sink = 1 - m * 0.16;
    const hemY = tier.bottom * sink;
    const bodyY = tier.top * sink;
    const bulge = Math.cos((u * Math.PI) / 2) * step * 0.42 * v;
    return [
      w / 2 + u * width + tier.sway * (1 - v * 0.35),
      lerp(hemY, bodyY, v) + bulge,
    ];
  };

  // ---- sky -------------------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, o.look.sky[0]);
  sky.addColorStop(1, o.look.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // stars
  const starRng = seeded(`${o.text}stars`);
  for (let i = 0; i < 140; i += 1) {
    const sx = starRng() * w;
    const sy = starRng() * h * 0.8;
    ctx.globalAlpha = (0.2 + 0.6 * Math.abs(Math.sin(t * 0.5 + i * 1.7))) * (1 - m * 0.9);
    ctx.fillStyle = i % 7 === 0 ? o.look.star : '#ffffff';
    const s = (i % 11 === 0 ? 2.4 : 1.3) * Math.max(0.7, scale);
    ctx.fillRect(sx, sy, s, s);
  }
  ctx.globalAlpha = 1;

  // aurora ribbons: two sine curves filled as a band, fading at both ends
  if (o.look.auroraRibbon) {
    for (let i = 0; i < 2; i += 1) {
      const rgb = i ? '167,139,250' : '124,231,208';
      const base = h * (0.3 + i * 0.08);
      const amp = h * (0.055 + i * 0.015);
      const thick = h * (0.1 + i * 0.03);
      const grad = ctx.createLinearGradient(0, base - thick, 0, base + thick * 2);
      grad.addColorStop(0, `rgba(${rgb},0)`);
      grad.addColorStop(0.45, `rgba(${rgb},${0.3 * (1 - m)})`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const y = base + Math.sin(x / 190 + t * 0.24 + i * 2.1) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let x = w; x >= 0; x -= 16) {
        const y =
          base +
          thick +
          Math.sin(x / 150 + t * 0.18 + i * 2.1 + 1.2) * amp * 1.35;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  // moon
  const moonX = w * 0.84;
  const moonY = h * 0.14;
  const halo = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, unit * 0.19);
  halo.addColorStop(0, `rgba(255,255,255,${0.16 * (1 - m)})`);
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1 - m * 0.85;
  ctx.beginPath();
  ctx.arc(moonX, moonY, unit * 0.032, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,250,235,0.9)';
  ctx.fill();
  ctx.globalAlpha = 1;

  // ---- snow ground -----------------------------------------------------
  const snow = ctx.createLinearGradient(0, baseY - unit * 0.1, 0, h);
  snow.addColorStop(0, o.look.snow[0]);
  snow.addColorStop(1, o.look.snow[1]);
  ctx.beginPath();
  ctx.moveTo(-20, baseY);
  for (let x = -20; x <= w + 20; x += 16) {
    ctx.lineTo(x, baseY + Math.sin(x / 130 + 1.4) * 5 - 2);
  }
  ctx.lineTo(w + 20, h + 20);
  ctx.lineTo(-20, h + 20);
  ctx.closePath();
  ctx.fillStyle = snow;
  ctx.fill();

  // the plaza the code lays down on: a bright slab that covers the frame
  if (m > 0.02) {
    const pad = cell * 4.4;
    const plazaTop = top - pad;
    const plazaBottom = top + side + pad;
    const plaza = ctx.createLinearGradient(0, plazaTop, 0, h);
    plaza.addColorStop(0, '#ffffff');
    plaza.addColorStop(0.55, o.look.snow[1]);
    plaza.addColorStop(1, o.look.snow[0]);
    const grow = clamp01((m - 0.08) / 0.62);
    const edge = lerp(w * 0.36, -w * 0.08, grow);
    ctx.globalAlpha = clamp01((m - 0.05) / 0.55);
    ctx.fillStyle = plaza;
    ctx.beginPath();
    ctx.moveTo(edge, plazaTop);
    ctx.lineTo(w - edge, plazaTop);
    ctx.quadraticCurveTo(w - edge * 0.15, plazaBottom, w + 4, h + 4);
    ctx.lineTo(-4, h + 4);
    ctx.quadraticCurveTo(edge * 0.15, plazaBottom, edge, plazaTop);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- blossoms --------------------------------------------------------
  const blossoms: Blossom[] = [];
  const total = n * n;
  const ranks = [...Array(total).keys()].sort(() => rand() - 0.5);
  const palette = o.look.ornaments;

  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (!grid[row][col]) continue;
      // rows map onto tiers, so the code's own pattern decides where leaves bulk up
      const tierIndex = Math.min(tierCount - 1, Math.floor(((row + 0.5) / n) * tierCount));
      const u = ((col + 0.5) / n) * 2 - 1;
      const v = clamp01(1 - (((row + 0.5) / n) * tierCount) % 1 * 0.9 - 0.05);
      const [tx, ty] = skirtPoint(tierIndex, u * 0.96, clamp01(v * 0.85 + rand() * 0.15));

      const roll = rand();
      const lit = v > 0.45 ? o.look.foliage[1] : o.look.foliage[0];
      let color = lit;
      if (roll < 0.075) color = palette[Math.floor(rand() * palette.length)];
      else if (roll < 0.11) color = o.look.trim;
      else if (roll < 0.6) color = o.look.foliage[0];
      color = shade(color, lerp(-0.45, 0.12, v));

      blossoms.push({
        gx: left + (col + 0.5) * cell,
        gy: top + (row + 0.5) * cell,
        tx,
        ty,
        front: v,
        radius: cell * (0.52 + rand() * 0.22) * lerp(0.8, 1.05, v),
        color,
        phase: rand() * Math.PI * 2,
        fall: 0.32 + (ranks[row * n + col] / total) * 0.48,
        spin: (rand() - 0.5) * 2.4,
      });
    }
  }

  // ---- trunk + branch skirts ------------------------------------------
  const bodyAlpha = 1 - clamp01((m - 0.04) / 0.34);
  if (bodyAlpha > 0.01) {
    const sink = 1 - m * 0.16;
    ctx.globalAlpha = bodyAlpha;

    // trunk
    const trunkW = unit * 0.036;
    const trunkTop = tiers[tierCount - 1].top + step * 0.55;
    ctx.fillStyle = o.look.trunk;
    ctx.beginPath();
    ctx.moveTo(w / 2 - trunkW * 0.6, baseY + 10);
    ctx.lineTo(w / 2 - trunkW * 0.34, trunkTop * sink);
    ctx.lineTo(w / 2 + trunkW * 0.34, trunkTop * sink);
    ctx.lineTo(w / 2 + trunkW * 0.6, baseY + 10);
    ctx.closePath();
    ctx.fill();

    // skirts, top tier first so each lower tier overlaps the one above
    for (let i = 0; i < tierCount; i += 1) {
      const tier = tiers[i];
      const foliage = ctx.createLinearGradient(w / 2, tier.top * sink, w / 2, tier.bottom * sink);
      foliage.addColorStop(0, o.look.foliage[1]);
      foliage.addColorStop(0.45, o.look.foliage[0]);
      foliage.addColorStop(1, o.look.foliage[0]);
      ctx.fillStyle = foliage;

      ctx.beginPath();
      ctx.moveTo(w / 2 + tier.sway * 0.2, tier.top * sink - step * 0.35);
      const segs = 22;
      for (let s = 0; s <= segs; s += 1) {
        const u = s / segs;
        const [px, py] = skirtPoint(i, u, 0.02);
        ctx.lineTo(px, py);
      }
      for (let s = segs; s >= 0; s -= 1) {
        const u = -s / segs;
        const [px, py] = skirtPoint(i, u, 0.02);
        const scallop = Math.abs(Math.sin((s / segs) * Math.PI * 4)) * step * 0.16;
        ctx.lineTo(px, py + scallop);
      }
      ctx.closePath();
      ctx.fill();

      // snow resting on the hem: soft specks rather than a hard outline
      ctx.fillStyle = o.look.trim;
      ctx.globalAlpha = bodyAlpha * 0.38;
      for (let s = 0; s <= 16; s += 1) {
        const u = -0.94 + (s / 16) * 1.88;
        const [px, py] = skirtPoint(i, u, 0.06 + (s % 2) * 0.04);
        const r = step * (0.07 + ((s * 7) % 5) * 0.012);
        ctx.beginPath();
        ctx.ellipse(px, py, r * 1.5, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = bodyAlpha;
    }

    // garland strands: a sagging string of little bulbs across each skirt
    for (let i = 1; i < tierCount; i += 1) {
      const [lx, ly] = skirtPoint(i, -0.86, 0.55);
      const [rx, ry] = skirtPoint(i, 0.86, 0.55);
      const sag = Math.max(ly, ry) + step * 0.42;
      const bulbs = 9;
      for (let b = 0; b <= bulbs; b += 1) {
        const s = b / bulbs;
        const inv = 1 - s;
        const px = inv * inv * lx + 2 * inv * s * (w / 2) + s * s * rx;
        const py = inv * inv * ly + 2 * inv * s * sag + s * s * ry;
        const on = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.4 + b * 0.9 + i));
        ctx.globalAlpha = bodyAlpha * on * 0.9;
        ctx.fillStyle = o.look.garland[(b + i) % o.look.garland.length];
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.2, cell * 0.34), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- blowing snow, far side -----------------------------------------
  const flakes = 90;
  const drawFlake = (i: number, front: boolean) => {
    const seedX = ((i * 97.13) % 1000) / 1000;
    const depth = ((i * 53) % 100) / 100;
    if (depth > 0.55 !== front) return;
    const fall = t * (16 + depth * 52) + seedX * h * 2.4;
    const y = (((fall % (h + 90)) + h + 90) % (h + 90)) - 45;
    const x = seedX * w + Math.sin(t * 0.8 + i * 1.3) * 16 * o.snowfall;
    const r = (0.7 + depth * 2.1) * Math.max(0.6, scale) * 1.7;
    ctx.globalAlpha = (0.1 + depth * 0.5) * o.snowfall * (1 - m * 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let i = 0; i < flakes; i += 1) drawFlake(i, false);
  ctx.globalAlpha = 1;

  // ---- blossoms: ornaments fall off the branches onto their modules ----
  blossoms.forEach((b, i) => {
    const progress = easeInOut(clamp01((m - b.fall * 0.12) / 0.74));
    const flutter = Math.sin(t * 1.5 + b.phase) * cell * 0.45 * (1 - progress);
    // the moment a blossom settles it must sit *exactly* on its module,
    // otherwise the code stops decoding even though it looks right
    const landed = progress > 0.985;
    const x = landed ? b.gx : lerp(b.tx, b.gx, progress) + flutter * 0.5;
    const y = landed
      ? b.gy
      : lerp(b.ty, b.gy, progress) + flutter - Math.sin(progress * Math.PI) * cell * 1.2;

    if (landed) {
      ctx.fillStyle = o.look.module;
      ctx.fillRect(Math.round(b.gx - cell / 2), Math.round(b.gy - cell / 2), cell, cell);
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(b.spin * (1 - progress) + Math.sin(t * 0.8 + b.phase) * 0.07);
    ctx.globalAlpha = clamp01((0.55 + 0.45 * b.front) * (0.65 + 0.35 * (1 - progress)));
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.1, b.radius), 0, Math.PI * 2);
    ctx.fill();

    if (i % 13 === 0 && b.front > 0.5) {
      const flare = 0.16 + 0.28 * Math.abs(Math.sin(t * 1.8 + b.phase));
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, b.radius * 3.4);
      glow.addColorStop(0, `rgba(255,255,255,${flare})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius * 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
  ctx.globalAlpha = 1;

  // ---- star ------------------------------------------------------------
  const starAlpha = 1 - clamp01(m * 1.5);
  if (starAlpha > 0.02) {
    const sx = w / 2;
    const sy = treeTop - step * 0.1;
    const outer = unit * 0.034;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, outer * 5);
    glow.addColorStop(0, `${o.look.star}70`);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = starAlpha;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, outer * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.look.star;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? outer : outer * 0.42;
      const a = (i * Math.PI) / 5 - Math.PI / 2 + Math.sin(t * 0.35) * 0.05;
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- foreground flakes ----------------------------------------------
  for (let i = 0; i < flakes; i += 1) drawFlake(i, true);
  ctx.globalAlpha = 1;
}
