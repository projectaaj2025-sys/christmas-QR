import { isTreeKind, TreeKind } from './looks';

export interface Greeting {
  from: string;
  payload: string;
  message: string;
  kind: TreeKind;
  receivedAt: number;
}

const KEY = 'xmasqr.inbox.v1';
export function loadGreetings(): Greeting[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g) => g && typeof g.payload === 'string')
      .map((g) => ({
        from: typeof g.from === 'string' ? g.from : 'a friend',
        payload: g.payload,
        message: typeof g.message === 'string' ? g.message : '',
        kind: isTreeKind(g.kind) ? g.kind : 'classic',
        receivedAt: typeof g.receivedAt === 'number' ? g.receivedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

export function saveGreetings(list: Greeting[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-40)));
  } catch {
    /* storage may be full or blocked — the inbox is a convenience */
  }
}
