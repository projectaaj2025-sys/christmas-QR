import { eccFor, encodeQR } from './qr';

export interface SceneLook {
  bg: [string, string];
  glow: string;
  foliage: string[];
  snow: string;
  baubles: string[];
  codeInk: string;
  structure: string;
}

export interface SceneOptions {
  text: string;
  look: SceneLook;
  /** 0 = tree standing, 1 = code lying flat */
  morph: number;
  /** seconds since mount (sway, twinkle, snowfall) */
  time: number;
  /** 0 stops the snow */
  snowfall: number;
  /** ornaments sitting among the canopy glyphs */
  baubles: boolean;
}

/** deterministic RNG: the same payload always grows the same tree */
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
const pick = <T,>(arr: T[], r: number): T => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];

/** blend two #rrggbb colours */
function lerpColor(a: string, b: string, t2: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const mix = (shift: number) => {
    const ca = (pa >> shift) & 255;
    const cb = (pb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t2);
  };
  return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
}

/**
 * Module ink for the flat code. While the plaza is dark the glyph colours show
 * through; once it is lit they invert, so the modules stay darker than the snow.
 */
function ink(color: string, lit: number): string {
  if (lit < 0.02) return color;
  const dark = color.startsWith('#') ? shade(color, -0.62) : color;
  return lit > 0.98 ? dark : lerpColor(color, dark, lit);
}

/** guaranteed-dark version of a module colour */
function darken(color: string, extra = 0): string {
  const base = color.startsWith('#') ? color : '#888888';
  return shade(base, -0.66 - extra);
}

/** mix a #rrggbb colour toward black (k < 0) or white (k > 0) */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

const CANOPY = ['#', '#', '%', '%', '%', '@', '@', '@', '%', '+', '*'];
const SNOW = ['*', '*', '·', '~', 'o', '+'];
const BULBS = ['●', '○', '♥', '✿', '*'];

/** glyphs keep the drawn size a little tighter than one module cell */
const GLYPH_FIT = 1.52;

interface Glyph {
  /** where it lies once the code is flat */
  gx: number;
  gy: number;
  /** where it hangs on the branch */
  tx: number;
  ty: number;
  /** 0 = far side of the canopy, 1 = front */
  front: number;
  /** colour while the glyph hangs on the branch */
  color: string;
  /** colour once it is a module: always dark enough to read on the snow */
  flat: string;
  glyph: string;
  size: number;
  alpha: number;
  /** 0 → falls first, 1 → falls last */
  delay: number;
  swayPhase: number;
}

/** One draw pass of the tree ⇄ code scene. Safe to call at any size. */
export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, o: SceneOptions) {
  const m = easeInOut(clamp01(o.morph));
  const rand = seeded(o.text || 'xmas');
  const grid = encodeQR(o.text || ' ', eccFor(o.text || ''));
  const n = grid.length;
  const t = o.time;
  const unit = Math.min(w, h);
  const scale = unit / 720;

  // ---- flat code geometry: whole-pixel modules only --------------------
  const cell = Math.max(3, Math.floor(Math.min(w * 0.64, h * 0.74) / n));
  const side = cell * n;
  const left = Math.round((w - side) / 2);
  const top = Math.round((h - side) / 2);

  // ---- tree geometry ---------------------------------------------------
  // A spruce is a cone whose edge scallops in and out once per branch tier.
  // Mapping a module's row to height and its column to ±width (both uniform)
  // fills the silhouette evenly, which is what gives the cloud its body.
  const crownY = h * 0.075;
  const baseY = h * 0.905;
  const treeH = baseY - crownY;
  const radius = Math.min(w, h) * 0.335;
  const tierCount = 5;

  const branchPoint = (fy: number, fx: number): [number, number] => {
    const sway = Math.sin(t * 0.4 + fy * 3.2) * cell * 0.45 * (1 - m);
    // scalloped edge: widest at the bottom of every tier
    const scallop = 0.84 + 0.16 * Math.cos(fy * Math.PI * tierCount * 2);
    const width = radius * Math.pow(fy, 0.94) * scallop;
    return [
      w / 2 + fx * width + sway,
      crownY + fy * treeH,
    ];
  };

  // ---- sky -------------------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, o.look.bg[0]);
  sky.addColorStop(1, o.look.bg[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // distant stars, extinguished as the plaza lights up
  const starRng = seeded(`${o.text}-stars`);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 150; i += 1) {
    const sx = starRng() * w;
    const sy = starRng() * h;
    const twinkle = 0.15 + 0.55 * Math.abs(Math.sin(t * 0.5 + i * 1.7)) ** 2;
    ctx.globalAlpha = twinkle * (1 - m * 0.92);
    ctx.fillStyle = '#ffffff';
    const s = (i % 13 === 0 ? 2.6 : 1.4) * Math.max(0.7, scale);
    ctx.fillRect(sx, sy, s, s);
  }
  ctx.globalAlpha = 1;

  // warm bloom behind the crown, like a crown of light
  const glowX = w / 2;
  const glowY = crownY + treeH * 0.1;
  const bloom = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, unit * 0.42);
  bloom.addColorStop(0, `${o.look.glow}4a`);
  bloom.addColorStop(0.4, `${o.look.glow}1c`);
  bloom.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);

  // A dark code on a dark page only scans in inverted mode, so past the
  // halfway point the plaza floods with light and the modules switch to their
  // inverted colour — the same trick the original plays when it flips.
  const lit = clamp01((m - 0.35) / 0.5);

  // ---- the plaza the code rests on -------------------------------------
  if (m > 0.02) {
    const plaza = ctx.createLinearGradient(0, top - cell * 5, 0, h);
    plaza.addColorStop(0, lerpColor('#0a1410', '#ffffff', lit));
    plaza.addColorStop(1, lerpColor(o.look.bg[1], '#eef6f1', lit));
    const pad = cell * 3.2;
    ctx.globalAlpha = clamp01((m - 0.02) / 0.5);
    ctx.fillStyle = plaza;
    ctx.beginPath();
    ctx.roundRect(left - pad, top - pad, side + pad * 2, side + pad * 2, cell * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- glyphs ----------------------------------------------------------
  const glyphs: Glyph[] = [];
  const total = n * n;
  const delays = [...Array(total).keys()].sort(() => rand() - 0.5);

  // Flat-module ink. Light palettes (silver, lace) would otherwise paint white
  // modules onto white snow, which reads as a missing module to a scanner.
  const flatInk = (row: number, col: number): string => {
    const finder = (r0: number, c0: number) => row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7;
    if (finder(0, 0) || finder(0, n - 7) || finder(n - 7, 0)) return darken(o.look.structure);
    if (row === 6 || col === 6) return darken(o.look.structure);
    // data modules keep a sprinkle of variation, but never leave the dark range
    if (o.baubles && rand() > 0.86) return darken(o.look.codeInk, 0.42);
    return darken(o.look.codeInk);
  };

  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (!grid[row][col]) continue;
      const fy = (row + 0.5) / n;
      const fx = ((col + 0.5) / n) * 2 - 1;
      const [bx, by] = branchPoint(fy, fx);
      // a touch of scatter so the cloud breathes instead of forming a lattice
      const tx = bx + (rand() - 0.5) * cell * 0.7;
      const ty = by + (rand() - 0.5) * cell * 0.5;
      const front = fy;

      const roll = rand();
      let glyph = pick(CANOPY, rand());
      // canopy colour keyed to depth: deep green inside, lit toward the edges
      const edge = Math.abs(fx) * 0.45 + fy * 0.55;
      let color = pick(o.look.foliage, clamp01(0.34 + edge * 0.4 + rand() * 0.42));
      // the crown catches the light: gold flecks in the top fifth of the tree
      if (fy < 0.18 && rand() > 0.55) color = o.look.glow;
      if (roll > 0.93) {
        glyph = '*';
        color = o.look.glow;
      } else if (roll > 0.86) {
        glyph = pick(SNOW, rand());
        color = o.look.snow;
      } else if (o.baubles && roll > 0.72) {
        glyph = pick(BULBS, rand());
        color = pick(o.look.baubles, rand());
      }

      glyphs.push({
        gx: left + (col + 0.5) * cell,
        gy: top + (row + 0.5) * cell,
        tx,
        ty,
        front,
        color,
        flat: flatInk(row, col),
        glyph,
        size: cell * GLYPH_FIT * lerp(0.8, 1.14, front),
        alpha: lerp(0.45, 1, front),
        delay: 0.12 + (delays[row * n + col] / total) * 0.66,
        swayPhase: rand() * Math.PI * 2,
      });
    }
  }

  // ---- snowfall (behind the canopy first) ------------------------------
  const flakes = 74;
  const drawFlake = (i: number, front: boolean) => {
    const seedX = ((i * 97.13) % 1000) / 1000;
    const depth = ((i * 53) % 100) / 100;
    if (depth > 0.62 !== front) return;
    const fall = t * (10 + depth * 26) + seedX * h * 2.2;
    const y = (((fall % (h + 80)) + h + 80) % (h + 80)) - 40;
    const x = seedX * w + Math.sin(t * 0.55 + i * 1.3) * 9;
    const glyph = i % 11 === 0 ? '*' : i % 4 === 0 ? '+' : '·';
    ctx.globalAlpha = (0.1 + depth * 0.3) * o.snowfall * (1 - m * 0.8);
    ctx.fillStyle = i % 9 === 0 ? o.look.glow : '#ffffff';
    ctx.font = `${Math.max(5, cell * (0.35 + depth * 0.55))}px ui-monospace, Menlo, monospace`;
    ctx.fillText(glyph, x, y);
  };
  for (let i = 0; i < flakes; i += 1) drawFlake(i, false);
  ctx.globalAlpha = 1;

  // ---- trunk -----------------------------------------------------------
  const bodyAlpha = 1 - clamp01((m - 0.06) / 0.4);
  if (bodyAlpha > 0.01) {
    ctx.globalAlpha = bodyAlpha * 0.9;
    const trunkW = unit * 0.02;
    ctx.fillStyle = o.look.foliage[0];
    ctx.beginPath();
    ctx.moveTo(w / 2 - trunkW, baseY);
    ctx.lineTo(w / 2 - trunkW * 0.62, crownY + treeH * 0.8);
    ctx.lineTo(w / 2 + trunkW * 0.62, crownY + treeH * 0.8);
    ctx.lineTo(w / 2 + trunkW, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- stars at the crown ---------------------------------------------
  const crownAlpha = 1 - clamp01(m * 1.7);
  if (crownAlpha > 0.02) {
    ctx.globalAlpha = crownAlpha;
    const sparkRng = seeded(`${o.text}-crown`);
    for (let i = 0; i < 7; i += 1) {
      const sx = w / 2 + (sparkRng() - 0.5) * unit * 0.13;
      const sy = crownY + sparkRng() * treeH * 0.12;
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.1 + i));
      ctx.globalAlpha = crownAlpha * pulse;
      ctx.fillStyle = i % 2 ? o.look.glow : '#ffffff';
      ctx.font = `${Math.max(8, cell * (i % 3 === 0 ? 1.9 : 1.2))}px ui-monospace, Menlo, monospace`;
      ctx.fillText(i % 3 === 0 ? '✦' : '*', sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  // ---- the glyphs themselves ------------------------------------------
  const mono = `ui-monospace, Menlo, "SF Mono", monospace`;
  for (const g of glyphs) {
    // each glyph leaves its branch a touch after its neighbours and arrives
    // exactly on its module: the arrival is snapped, never eased
    const p = clamp01((m - g.delay * 0.28) / 0.66);
    const eased = easeInOut(p);
    const landed = p > 0.995;
    const wobble = Math.sin(t * 0.9 + g.swayPhase) * cell * 0.22 * (1 - eased);
    const x = landed ? g.gx : lerp(g.tx, g.gx, eased) + wobble;
    const y = landed
      ? g.gy
      : lerp(g.ty, g.gy, eased) + Math.sin(t * 1.1 + g.swayPhase) * cell * 0.18 * (1 - eased);

    ctx.font = `${g.size.toFixed(2)}px ${mono}`;
    if (landed) {
      // flat code: a solid block of ink, integer-aligned so phones can read it
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink(g.flat, lit);
      ctx.fillRect(
        Math.round(g.gx - cell / 2),
        Math.round(g.gy - cell / 2),
        cell,
        cell,
      );
      continue;
    }

    ctx.globalAlpha = g.alpha * clamp01(0.35 + p * 0.85);
    ctx.fillStyle = g.color;
    // colour deepens as the glyph travels toward the snow
    ctx.fillText(g.glyph, x, y);
  }
  ctx.globalAlpha = 1;

  // ---- foreground flakes ----------------------------------------------
  for (let i = 0; i < flakes; i += 1) drawFlake(i, true);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
