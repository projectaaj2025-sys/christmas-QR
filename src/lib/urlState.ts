import { isTreeKind, KINDS, TreeKind } from './looks';

export interface AppState {
  /** the payload the tree's QR code encodes */
  url: string;
  /** optional greeting shown on the card */
  message: string;
  kind: TreeKind;
  /** chromeless view for iframes */
  embed: boolean;
  /** open on the flat code instead of the tree */
  startFlat: boolean;
  /** who sent this tree */
  from: string;
}

export const DEFAULT_URL = 'https://xmasqr.vercel.app/';

const first = (params: URLSearchParams, ...keys: string[]): string => {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value;
  }
  return '';
};

export function readState(search = window.location.search): AppState {
  const params = new URLSearchParams(search);
  const shared = first(params, 'u', 'url', 'to', 'link').trim();
  const message = first(params, 'm', 'msg', 'message').slice(0, 140);
  const kindParam = first(params, 't', 'tree', 'look');
  return {
    url: shared ? shared.slice(0, 300) : DEFAULT_URL,
    message,
    kind: isTreeKind(kindParam) ? kindParam : 'classic',
    embed: params.get('embed') === '1' || params.get('embed') === 'true',
    startFlat: params.get('view') === 'code' || params.get('flat') === '1',
    from: first(params, 'from', 'f').slice(0, 40),
  };
}

export interface LinkOptions {
  kind: TreeKind;
  message?: string;
  embed?: boolean;
  view?: 'code' | 'tree';
  /** the payload to encode; omitted when it is the site itself */
  payload?: string;
  /** sender's name, shown to whoever opens the tree */
  from?: string;
}

/** Canonical tree link. Short keys keep the QR payload small. */
export function buildLink(o: LinkOptions, base?: string): string {
  const origin =
    base ?? (typeof window === 'undefined' ? 'https://xmasqr.vercel.app/' : `${window.location.origin}/`);
  const params = new URLSearchParams();
  params.set('t', o.kind);
  if (o.payload) params.set('u', o.payload);
  if (o.message?.trim()) params.set('m', o.message.trim());
  if (o.embed) params.set('embed', '1');
  if (o.view === 'code') params.set('view', 'code');
  if (o.from?.trim()) params.set('from', o.from.trim());
  return `${origin.replace(/\/+$/, '/')}?${params.toString()}`;
}

export const kindLabel = (kind: TreeKind) => KINDS[kind].name;
