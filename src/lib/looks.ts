/** Tree "kinds" — a kind is a full palette plus a silhouette flavour. */

export type TreeKind = 'classic' | 'aurora' | 'candy' | 'gold';

export interface Look {
  id: TreeKind;
  name: string;
  blurb: string;
  /** page/sky gradient, top → bottom */
  sky: [string, string];
  /** snow panel gradient, far edge → near edge */
  snow: [string, string];
  /** colour of a dark QR module once it lays flat */
  module: string;
  /** canopy gradient, deep → lit tips */
  foliage: [string, string];
  /** snow resting on branch tips */
  trim: string;
  trunk: string;
  ornaments: string[];
  star: string;
  garland: string[];
  /** draw slow northern lights behind the tree */
  auroraRibbon?: boolean;
  /** number of branch tiers */
  tiers: number;
  /** page accent, used by the UI */
  accent: string;
}

export const KINDS: Record<TreeKind, Look> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    blurb: 'Deep pine, warm bulbs and a snow-dusted star.',
    sky: ['#05121c', '#0b2434'],
    snow: ['#dfeaf2', '#f7fbff'],
    module: '#10222f',
    foliage: ['#14503a', '#57c98a'],
    trim: '#f4fbff',
    trunk: '#5b3a26',
    ornaments: ['#ff4d5e', '#ffd166', '#ffffff', '#ff8fa3'],
    star: '#ffe9a8',
    garland: ['#ffd166', '#ff7b6b', '#9be8b1'],
    tiers: 4,
    accent: '#57c98a',
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    blurb: 'Violet night sky, teal ribbons, icy lights.',
    sky: ['#0a0a1f', '#182a4d'],
    snow: ['#dbe6f7', '#eef6ff'],
    module: '#111a34',
    foliage: ['#1f5f6e', '#7ce7d0'],
    trim: '#eafffb',
    trunk: '#403a56',
    ornaments: ['#a78bfa', '#7ce7d0', '#ffffff', '#93c5fd'],
    star: '#d8ccff',
    garland: ['#a78bfa', '#7ce7d0', '#f0abfc'],
    auroraRibbon: true,
    tiers: 4,
    accent: '#7ce7d0',
  },
  candy: {
    id: 'candy',
    name: 'Candy',
    blurb: 'Crimson branches, cream icing, peppermint bulbs.',
    sky: ['#160a12', '#3a1220'],
    snow: ['#f6e9ee', '#fffafc'],
    module: '#2a0f1a',
    foliage: ['#8e1d33', '#f2687a'],
    trim: '#fff4f6',
    trunk: '#6b3b2b',
    ornaments: ['#ffffff', '#ffd9e0', '#ffe9a8', '#ff6b81'],
    star: '#ffe9a8',
    garland: ['#ffffff', '#ffd9e0', '#ffb3c1'],
    tiers: 4,
    accent: '#f2687a',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    blurb: 'Burnished brass, candlelight, quiet luxury.',
    sky: ['#0d0a05', '#2a2011'],
    snow: ['#f2ebdc', '#fffdf6'],
    module: '#241a0d',
    foliage: ['#7a5518', '#f0c264'],
    trim: '#fff6df',
    trunk: '#4a3320',
    ornaments: ['#fff3cf', '#ffe6a3', '#ffd166', '#ffffff'],
    star: '#fff0b8',
    garland: ['#ffe6a3', '#f7c873', '#fff6df'],
    tiers: 4,
    accent: '#f0c264',
  },
};

export const TREE_KINDS = Object.keys(KINDS) as TreeKind[];

export const isTreeKind = (value: unknown): value is TreeKind =>
  typeof value === 'string' && value in KINDS;

export const lookFor = (kind: string | undefined): Look =>
  isTreeKind(kind) ? KINDS[kind] : KINDS.classic;
