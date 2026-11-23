import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stage } from './components/Stage';
import { ShareDialog } from './components/ShareDialog';
import { EmbedDialog } from './components/EmbedDialog';
import { KINDS, TREE_KINDS, TreeKind } from './lib/looks';
import { buildLink, readState, DEFAULT_URL } from './lib/urlState';
import { loadGreetings, saveGreetings, Greeting } from './lib/store';

const SAMPLES = [
  { label: 'Vacancy', value: 'https://hh.kz/vacancy/12345678' },
  { label: 'Instagram', value: 'https://instagram.com/your.handle' },
  { label: 'Wi-Fi', value: 'WIFI:T:WPA;S:Home_5G;P:merry-christmas;;' },
  { label: 'Gift note', value: 'С Новым годом! 🎄 Спасибо, что были рядом весь год.' },
];

export default function App() {
  const initial = useMemo(() => readState(), []);
  const [payload, setPayload] = useState(initial.url);
  const [message, setMessage] = useState(initial.message);
  const [kind, setKind] = useState<TreeKind>(initial.kind);
  const [shareOpen, setShareOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [incoming, setIncoming] = useState<Greeting[]>(() => loadGreetings());
  const [notice, setNotice] = useState('');
  const [celebrate, setCelebrate] = useState(false);

  const look = KINDS[kind];

  // keep the address bar in step so any state can be shared by copying the URL
  useEffect(() => {
    const link = buildLink({
      kind,
      payload: payload === DEFAULT_URL ? undefined : payload,
      message,
      view: undefined,
    });
    window.history.replaceState(null, '', link);
  }, [kind, payload, message]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', look.accent);
  }, [look.accent]);

  const addGreeting = useCallback((g: Greeting) => {
    setIncoming((prev) => {
      const next = [...prev.filter((item) => item.payload !== g.payload), g].slice(-40);
      saveGreetings(next);
      return next;
    });
  }, []);

  const receiveFromUrl = useCallback(
    (url: string, note: string, nextKind?: TreeKind) => {
      setPayload(url);
      setMessage(note);
      if (nextKind) setKind(nextKind);
      setShareOpen(false);
      setCelebrate(true);
      setNotice('Your tree is ready — tap it to see the code.');
      setTimeout(() => setNotice(''), 4200);
    },
    [],
  );

  const stageText = useMemo(
    () => buildLink({ kind, payload, message }),
    [kind, payload, message],
  );

  if (initial.embed) {
    return (
      <main className="embed-shell">
        <Stage text={stageText} look={look} caption className="stage-embed" />
        <a
          className="embed-credit"
          href={buildLink({ kind, payload, message })}
          target="_blank"
          rel="noreferrer"
        >
          grown with christmas qr
        </a>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            ✦
          </span>
          christmas qr
        </a>
        <nav className="topbar-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setEmbedOpen(true)}>
            Embed
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShareOpen(true)}>
            Send a tree
          </button>
        </nav>
      </header>

      <main className="layout">
        <section className="hero">
          <h1>
            Your link, <em>grown</em> into a tree.
          </h1>
          <p className="lede">
            Every branch is a module of a real, scannable QR code. Tap the tree, the ornaments fall
            into the code, and any phone can read it.
          </p>

          <div className="controls">
            <label className="field">
              <span>Link or text behind the code</span>
              <input
                value={payload}
                spellCheck={false}
                maxLength={300}
                onChange={(e) => setPayload(e.target.value || ' ')}
                placeholder="https://…"
              />
            </label>
            <div className="samples">
              {SAMPLES.map((s) => (
                <button key={s.label} type="button" className="chip" onClick={() => setPayload(s.value)}>
                  {s.label}
                </button>
              ))}
            </div>

            <label className="field">
              <span>Greeting (optional)</span>
              <input
                value={message}
                maxLength={140}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="С Новым годом! 🎄"
              />
            </label>

            <div className="trees" role="radiogroup" aria-label="Tree style">
              {TREE_KINDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={kind === id}
                  className={kind === id ? 'tree-chip is-active' : 'tree-chip'}
                  onClick={() => setKind(id)}
                  style={{ '--swatch': KINDS[id].accent } as React.CSSProperties}
                >
                  <span className="swatch" aria-hidden="true" />
                  <span>
                    <strong>{KINDS[id].name}</strong>
                    <small>{KINDS[id].blurb}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setShareOpen(true)}>
                Send my tree
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => setEmbedOpen(true)}>
                Put it on my site
              </button>
            </div>
            {notice && <p className="toast inline">{notice}</p>}
          </div>

          <ul className="facts">
            <li>
              <strong>Scan-tested.</strong> Modules are pixel aligned, so phones lock on instantly.
            </li>
            <li>
              <strong>Deterministic.</strong> The same link always grows the same tree.
            </li>
            <li>
              <strong>Shareable.</strong> Send the tree itself, or invite a friend to grow one for
              you.
            </li>
          </ul>
        </section>

        <section className="stage-column">
          <Stage
            text={stageText}
            look={look}
            startFlat={initial.startFlat}
            caption
            celebrate={celebrate}
          />
          <div className="under-stage">
            <code className="mono">{stageText}</code>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(stageText);
                  setNotice('Link copied');
                } catch {
                  setNotice('Copy failed — the link is printed on the left');
                }
                setTimeout(() => setNotice(''), 2500);
              }}
            >
              Copy link
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Built in the spirit of the original christmas qr tree. No tracking, no account — every
          tree is drawn in your browser.
        </p>
        <p className="muted small">
          Inbox: {incoming.length === 0 ? 'no trees received yet' : `${incoming.length} tree(s) received`}
        </p>
      </footer>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        look={look}
        payload={payload}
        message={message}
        onSend={receiveFromUrl}
        incoming={incoming}
        addGreeting={addGreeting}
      />
      <EmbedDialog
        open={embedOpen}
        onClose={() => setEmbedOpen(false)}
        look={look}
        payload={payload}
        message={message}
      />
    </div>
  );
}
