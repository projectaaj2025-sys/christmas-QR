import { useMemo, useState } from 'react';
import { Stage } from './Stage';
import { Look } from '../lib/looks';
import { embedSnippet, scriptSnippet } from '../lib/export';
import { buildLink } from '../lib/urlState';

interface Props {
  open: boolean;
  onClose: () => void;
  look: Look;
  payload: string;
  message: string;
  snow?: boolean;
  baubles?: boolean;
}

const SIZES = [
  { label: 'Card 720×640', w: 720, h: 640 },
  { label: 'Banner 1080×520', w: 1080, h: 520 },
  { label: 'Full page', w: 0, h: 0 },
];

/** Everything needed to drop the tree into somebody else's site. */
export function EmbedDialog({ open, onClose, look, payload, message, snow, baubles }: Props) {
  const [sizeIndex, setSizeIndex] = useState(0);
  const [tab, setTab] = useState<'iframe' | 'script' | 'data-uri'>('iframe');
  const [status, setStatus] = useState('');

  const size = SIZES[sizeIndex];
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const embedUrl = useMemo(
    () => buildLink({ kind: look.id, payload, message, embed: true, snow, baubles }),
    [look.id, payload, message, snow, baubles],
  );

  const snippet = useMemo(() => {
    if (tab === 'script') {
      return scriptSnippet('xmas-tree', `${origin}/embed.js?${new URL(embedUrl).searchParams.toString()}`);
    }
    if (tab === 'data-uri') {
      // a plain link: paste it in a chat, a QR code, or a bio
      return embedUrl;
    }
    const height = size.h || 640;
    return embedSnippet(embedUrl, height);
  }, [tab, embedUrl, origin, size]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setStatus('Copied — paste it into your page');
    } catch {
      setStatus('Copy failed, select the code below');
    }
    setTimeout(() => setStatus(''), 3000);
  };

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Embed">
      <div className="dialog dialog-wide">
        <header className="dialog-head">
          <h2>Put this tree on any site</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="embed-grid">
          <div className="embed-preview">
            <Stage
              text={embedUrl}
              look={look}
              caption
              className="stage-sm"
              snow={snow}
              baubles={baubles}
            />
            <p className="muted small">
              This is exactly what visitors see inside the frame — they can tap it too.
            </p>
          </div>

          <div className="embed-controls">
            <nav className="tabs" role="tablist">
              {(['iframe', 'script', 'data-uri'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? 'tab is-active' : 'tab'}
                  onClick={() => setTab(id)}
                >
                  {id === 'iframe' ? 'iframe' : id === 'script' ? 'script tag' : 'direct link'}
                </button>
              ))}
            </nav>

            {tab === 'iframe' && (
              <label className="field">
                <span>Frame size</span>
                <select
                  value={sizeIndex}
                  onChange={(e) => setSizeIndex(Number(e.target.value))}
                >
                  {SIZES.map((s, i) => (
                    <option key={s.label} value={i}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <pre className="code-block">
              <code>{snippet}</code>
            </pre>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={copy}>
                {tab === 'data-uri' ? 'Copy link' : 'Copy snippet'}
              </button>
              <a className="btn btn-ghost" href={embedUrl} target="_blank" rel="noreferrer">
                Open preview
              </a>
            </div>
            {status && <p className="toast">{status}</p>}

            <ul className="notes small muted">
              <li>
                The frame is responsive: width 100%, height is whatever you set — 640px reads well
                on desktop and mobile.
              </li>
              <li>
                <code>?embed=1</code> hides the site chrome, so only the tree and its caption show.
              </li>
              <li>Works in Notion, WordPress (custom HTML), Framer, Webflow, Ghost and plain HTML.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
