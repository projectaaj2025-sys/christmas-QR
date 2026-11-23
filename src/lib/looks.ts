/**
 * Tree looks. Names and mood follow the original site's palette picker:
 * Classic, Silver, Blush, Snowy, Midnight, Fairy, Neon, Lace, Glitch, Pink.
 *
 * A look supplies four separate things:
 *  - the sky gradient and the warm bloom behind the crown,
 *  - glyph colours for the canopy and the baubles,
 *  - the colours the flat QR code uses once the glyphs settle.
 */

export type TreeKind =
  | 'classic'
  | 'silver'
  | 'blush'
  | 'snowy'
  | 'midnight'
  | 'fairy'
  | 'neon'
  | 'lace'
  | 'glitch'
  | 'pink';

export interface Look {
  id: TreeKind;
  name: string;
  /** UI swatch, centre → edge */
  swatch: [string, string];
  /** page sky, top → bottom */
  bg: [string, string];
  /** warm bloom behind the crown */
  glow: string;
  /** canopy glyphs, deep → lit */
  foliage: string[];
  /** snow glyphs resting on the branches */
  snow: string;
  /** bauble / ornament glyphs */
  baubles: string[];
  /** main module colour when the code is flat */
  codeInk: string;
  /** finder + timing modules, so the code still reads as a code */
  structure: string;
  /** UI accent */
  accent: string;
}

export const KINDS: Record<TreeKind, Look> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    swatch: ['#ff5a5f', '#8c1420'],
    bg: ['#050807', '#08120d'],
    glow: '#ffcf7a',
    foliage: ['#0d4a26', '#177a3d', '#25a35a', '#3fd07d', '#8bf0b4'],
    snow: '#eaf7ef',
    baubles: ['#ff3b47', '#ffd166', '#ffffff', '#ff8fa3', '#5ec8ff'],
    codeInk: '#33c46f',
    structure: '#ff4b55',
    accent: '#8b5cf6',
  },
  silver: {
    id: 'silver',
    name: 'Silver',
    swatch: ['#e8eef6', '#6f7d8d'],
    bg: ['#07080b', '#0e1218'],
    glow: '#dfe9f5',
    foliage: ['#4a5563', '#7d8998', '#b3bfcd', '#e2eaf3', '#ffffff'],
    snow: '#ffffff',
    baubles: ['#ffffff', '#dbe6f2', '#a9b8c8', '#f4f8fc'],
    codeInk: '#c9d5e2',
    structure: '#8f9db0',
    accent: '#8b5cf6',
  },
  blush: {
    id: 'blush',
    name: 'Blush',
    swatch: ['#ffd0dc', '#b8456b'],
    bg: ['#0b0609', '#160a10'],
    glow: '#ffc2d4',
    foliage: ['#6b2135', '#a33a5b', '#d9668c', '#f4a3bb', '#ffd6e2'],
    snow: '#fff1f5',
    baubles: ['#ffffff', '#ffd9e2', '#ffe9a8', '#ff87a6'],
    codeInk: '#f099b6',
    structure: '#ffffff',
    accent: '#8b5cf6',
  },
  snowy: {
    id: 'snowy',
    name: 'Snowy',
    swatch: ['#e7f6ff', '#4f86a8'],
    bg: ['#060a10', '#0b1720'],
    glow: '#cfeaff',
    foliage: ['#2a4a63', '#4f7e9c', '#86b4d1', '#bfe0f4', '#ebf8ff'],
    snow: '#ffffff',
    baubles: ['#ffffff', '#bfe4ff', '#d9c7ff', '#a8f0ff'],
    codeInk: '#b6ddf2',
    structure: '#ffffff',
    accent: '#8b5cf6',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    swatch: ['#7f9cf5', '#131c4a'],
    bg: ['#05070f', '#0a1230'],
    glow: '#a5b4fc',
    foliage: ['#16205a', '#26398f', '#3d5bc4', '#6f8cf0', '#b4c6ff'],
    snow: '#e8eeff',
    baubles: ['#ffd166', '#ffffff', '#a5b4fc', '#7ce7d0'],
    codeInk: '#7b95f2',
    structure: '#ffffff',
    accent: '#8b5cf6',
  },
  fairy: {
    id: 'fairy',
    name: 'Fairy',
    swatch: ['#ffe9a8', '#a8741c'],
    bg: ['#0a0805', '#17110a'],
    glow: '#ffe0a3',
    foliage: ['#43300f', '#7a5a1c', '#b58a33', '#e8bf6a', '#fff0c4'],
    snow: '#fff6df',
    baubles: ['#fff3cf', '#ffe6a3', '#ff9db1', '#b7e7c9', '#ffffff'],
    codeInk: '#f0ca82',
    structure: '#fff3cf',
    accent: '#8b5cf6',
  },
  neon: {
    id: 'neon',
    name: 'Neon',
    swatch: ['#c6ff6a', '#12b45f'],
    bg: ['#04070a', '#07130f'],
    glow: '#9dffbe',
    foliage: ['#0b6b3a', '#12b45f', '#39ff88', '#8dffb8', '#d6ffe6'],
    snow: '#eafff1',
    baubles: ['#ff2d95', '#00e5ff', '#ffffff', '#c6ff00'],
    codeInk: '#4dffa0',
    structure: '#ff2d95',
    accent: '#8b5cf6',
  },
  lace: {
    id: 'lace',
    name: 'Lace',
    swatch: ['#f4f9f5', '#8ba79a'],
    bg: ['#07090a', '#0d1412'],
    glow: '#eaf4ee',
    foliage: ['#3f4c45', '#6b8279', '#a2bab0', '#d6e6dd', '#f6fbf7'],
    snow: '#ffffff',
    baubles: ['#ffffff', '#f3e6c8', '#dbe9df', '#fff8e7'],
    codeInk: '#cfe2d7',
    structure: '#f3e6c8',
    accent: '#8b5cf6',
  },
  glitch: {
    id: 'glitch',
    name: 'Glitch',
    swatch: ['#22d3ee', '#0d3b4f'],
    bg: ['#03070c', '#061a26'],
    glow: '#22d3ee',
    foliage: ['#0d3b4f', '#117c8c', '#22d3ee', '#7ce9ff', '#c9f7ff'],
    snow: '#d8fbff',
    baubles: ['#ff2d95', '#a855f7', '#ffffff', '#facc15', '#22d3ee'],
    codeInk: '#3ee3ff',
    structure: '#ff2d95',
    accent: '#8b5cf6',
  },
  pink: {
    id: 'pink',
    name: 'Pink',
    swatch: ['#ff8fc0', '#b8145a'],
    bg: ['#0b0508', '#180711'],
    glow: '#ffb3d1',
    foliage: ['#5e0f2b', '#9c1249', '#d81b60', '#ff5c9d', '#ffb3d1'],
    snow: '#fff0f6',
    baubles: ['#ffffff', '#ffd6e7', '#ffe9a8', '#ff4d94'],
    codeInk: '#ff74aa',
    structure: '#ffffff',
    accent: '#8b5cf6',
  },
};

export const TREE_KINDS = Object.keys(KINDS) as TreeKind[];

export const isTreeKind = (value: unknown): value is TreeKind =>
  typeof value === 'string' && value in KINDS;

export const lookFor = (kind: string | undefined): Look =>
  isTreeKind(kind) ? KINDS[kind] : KINDS.classic;
