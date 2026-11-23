import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from './Stage';
import { Look, KINDS } from '../lib/looks';
import { buildLink } from '../lib/urlState';
import { downloadCard, downloadPng, downloadSvg } from '../lib/export';
import { decodeImageBlob, readState, sortGreetings } from '../lib/sender';
import { Greeting } from '../lib/store';

interface Props {
  open: boolean;
  onClose: () => void;
  look: Look;
  payload: string;
  message: string;
  onSend: (payload: string, message: string, kind?: Look['id']) => void;
  snow?: boolean;
  baubles?: boolean;
  incoming: Greeting[];
  addGreeting: (g: Greeting) => void;
}

type Tab = 'send' | 'invite' | 'receive';

const TABS: { id: Tab; label: string }[] = [
  { id: 'send', label: 'Share my tree' },
  { id: 'invite', label: 'Invite a friend' },
  { id: 'receive', label: 'Receive a tree' },
];

export function ShareDialog({
  open,
  onClose,
  look,
  payload,
  message,
  onSend,
  incoming,
  addGreeting,
  snow = true,
  baubles = true,
}: Props) {
  const [tab, setTab] = useState<Tab>('send');
  const [note, setNote] = useState(message);
  const [from, setFrom] = useState('a friend');
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('');
  const [importLink, setImportLink] = useState('');
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setNote(message);
      setStatus('');
    }
  }, [open, message]);

  // paste a screenshot straight into the dialog — the usual way people get a
  // tree from a chat app
  useEffect(() => {
    if (!open) return undefined;
    const onPaste = async (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      if (!item) return;
      const blob = item.getAsFile();
      if (!blob) return;
      e.preventDefault();
      setTab('receive');
      await plantImage(blob);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  // the shared tree encodes its own address so a scan lands back on the tree,
  // while the `u` payload stays the thing the sender wanted to share
  const treeLink = useMemo(
    () =>
      buildLink({
        kind: look.id,
        payload,
        message: note,
        from: from.trim() && from !== 'a friend' ? from.trim() : undefined,
        snow,
        baubles,
      }),
    [look.id, payload, note, from, snow, baubles],
  );

  // a friend's link is just this URL with their payload in it
  const inviteLink = useMemo(() => {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}/?t=${look.id}`;
  }, [look.id]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${what} copied`);
    } catch {
      setStatus('Copy failed — select the text and copy it by hand');
    }
    setTimeout(() => setStatus(''), 3200);
  };

  const nativeShare = async () => {
    const data = {
      title: 'A tree for you',
      text: note || 'Tap the tree to see my QR code',
      url: treeLink,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    void copy(treeLink, 'Link');
  };

  const applyImport = (raw: string) => {
    if (!raw) {
      setImportError('Paste a link or drop a picture of a QR code.');
      return;
    }
    const state = readState(raw.startsWith('http') ? new URL(raw).search : raw);
    if (!state.url) {
      setImportError('That link has no code in it.');
      return;
    }
    setImportError('');
    onSend(state.url, state.message, state.kind);
    addGreeting({
      from: state.from || 'a friend',
      payload: state.url,
      message: state.message,
      kind: state.kind,
      receivedAt: Date.now(),
    });
    setStatus('Your tree has been planted');
  };

  const plantImage = async (blob: Blob) => {
    setImportError('');
    setStatus('Reading the picture…');
    try {
      const text = await decodeImageBlob(blob);
      setStatus('');
      if (!text) {
        setImportError('No QR code found in that picture. Try a sharper, closer shot.');
        return;
      }
      applyImport(text);
    } catch {
      setStatus('');
      setImportError('That picture could not be read.');
    }
  };

  const onPickFile = async (file: File | undefined) => {
    if (file) await plantImage(file);
  };

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Share">
      <div className="dialog">
        <header className="dialog-head">
          <h2>Send a tree</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'tab is-active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'send' && (
          <section className="tab-panel">
            <div className="dialog-preview">
              <Stage
                text={treeLink}
                look={look}
                caption={false}
                className="stage-sm"
                snow={snow}
                baubles={baubles}
              />
            </div>
            <label className="field">
              <span>Your name (optional)</span>
              <input value={from} maxLength={40} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              <span>Greeting on the card (optional)</span>
              <input
                value={note}
                maxLength={140}
                onChange={(e) => setNote(e.target.value)}
                placeholder="С Новым годом! 🎄"
              />
            </label>
            <label className="field">
              <span>Link to send</span>
              <div className="field-row">
                <input
                  readOnly
                  value={treeLink}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                />
                <button type="button" className="btn btn-ghost" onClick={() => copy(treeLink, 'Link')}>
                  Copy
                </button>
              </div>
            </label>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={nativeShare}>
                {'share' in navigator ? 'Share…' : 'Copy link'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  copy(
                    `С Новым годом! Я вырастил тебе ёлку из QR-кода: ${treeLink}`,
                    'Message',
                  )
                }
              >
                Copy message
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => downloadCard(treeLink, look, note, payload)}
              >
                Card PNG
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => downloadPng(treeLink, look, payload)}
              >
                Code PNG
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => downloadSvg(treeLink, payload)}
              >
                SVG
              </button>
            </div>
            <p className="muted small">
              The tree you share is grown from your own link, so the other person scans it and
              lands where you want them to.
            </p>
          </section>
        )}

        {tab === 'invite' && (
          <section className="tab-panel">
            <p>
              Send this to a friend. They grow a tree from their own code, then send the tree back
              to you — you will find it under <strong>Receive a tree</strong>.
            </p>
            <div className="field-row">
              <input readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn btn-ghost" onClick={() => copy(inviteLink, 'Invite')}>
                Copy
              </button>
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const text = encodeURIComponent(
                    `Собери мне ёлку из своего QR-кода: ${inviteLink}`,
                  );
                  window.open(`https://t.me/share/url?url=${text}`, '_blank', 'noopener');
                }}
              >
                Telegram
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(`Grow me a QR tree: ${inviteLink}`)}`,
                    '_blank',
                    'noopener',
                  )
                }
              >
                WhatsApp
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  window.open(
                    `mailto:?subject=${encodeURIComponent('A tree for you')}&body=${encodeURIComponent(inviteLink)}`,
                    '_self',
                  )
                }
              >
                Email
              </button>
            </div>
          </section>
        )}

        {tab === 'receive' && (
          <section className="tab-panel">
            <label className="field">
              <span>Paste the link a friend sent you</span>
              <div className="field-row">
                <input
                  value={importLink}
                  onChange={(e) => setImportLink(e.target.value)}
                  placeholder="https://xmasqr.vercel.app/?u=…"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => applyImport(importLink.trim())}
                  disabled={!importLink.trim()}
                >
                  Plant it
                </button>
              </div>
            </label>
            <div
              className={dragging ? 'drop-zone is-dragging' : 'drop-zone'}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragging(false);
                const blob = e.dataTransfer.files?.[0];
                if (blob) await plantImage(blob);
              }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
              }}
            >
              <strong>Drop a picture of the QR code here</strong>
              <span>or click to choose a file · paste with ⌘/Ctrl + V</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
            {importError && <p className="error small">{importError}</p>}

            <h3 className="inbox-head">Trees people sent you</h3>
            {incoming.length === 0 ? (
              <p className="muted small">
                Nothing yet. Ask a friend to open your invite link and grow you a tree.
              </p>
            ) : (
              <ul className="inbox">
                {sortGreetings(incoming).map((g) => (
                  <li key={`${g.receivedAt}-${g.payload}`}>
                    <div>
                      <p className="inbox-msg">{g.message || 'A tree for you'}</p>
                      <p className="muted small">
                        {g.from} · {lookFor(g.kind).name} ·{' '}
                        {new Date(g.receivedAt).toLocaleDateString()}
                      </p>
                      <p className="mono small">{g.payload}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        onSend(g.payload, g.message, g.kind);
                        onClose();
                      }}
                    >
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {status && <p className="toast">{status}</p>}
      </div>
    </div>
  );
}

const lookFor = (id: Look['id']) => KINDS[id];
