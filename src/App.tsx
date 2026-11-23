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
  const [snow, setSnow] = useState(initial.snow);
  const [baubles, setBaubles] = useState(initial.baubles);
  const [shareOpen, setShareOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [incoming, setIncoming] = useState<Greeting[]>(() => loadGreetings());
  const [notice, setNotice] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const [draft, setDraft] = useState('');

  const look = KINDS[kind];

  // keep the address bar in step so any state can be shared by copying the URL
  useEffect(() => {
    const link = buildLink({
      kind,
      payload: payload === DEFAULT_URL ? undefined : payload,
      message,
      snow,
      baubles,
    });
    window.history.replaceState(null, '', link);
  }, [kind, payload, message, snow, baubles]);

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

  const receiveFromUrl = useCallback((url: string, note: string, nextKind?: TreeKind) => {
    setPayload(url);
    setMessage(note);
    if (nextKind) setKind(nextKind);
    setShareOpen(false);
    setCelebrate(true);
    setNotice('Your tree is ready — tap it to see the code.');
    setTimeout(() => setNotice(''), 4200);
  }, []);

  const stageText = useMemo(
    () => buildLink({ kind, payload, message, snow, baubles }),
    [kind, payload, message, snow, baubles],
  );

  const applyLink = () => {
    const value = draft.trim();
    if (!value) return;
    setPayload(value);
    setDraft('');
  };

  if (initial.embed) {
    return (
      <main className="embed-shell">
        <Stage
          text={stageText}
          look={look}
          caption
          snow={snow}
          baubles={baubles}
          className="stage-embed"
        />
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
            ✳
          </span>
          christmas qr
        </a>
        <div className="topbar-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setShareOpen(true)}>
            Share
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEmbedOpen(true)}>
            Embed
          </button>
        </div>
      </header>

      <main className="stage-area">
        <Stage
          text={stageText}
          look={look}
          snow={snow}
          baubles={baubles}
          startFlat={initial.startFlat}
          caption
          celebrate={celebrate}
          className="stage-main"
        />
        {notice && <p className="toast floating">{notice}</p>}
      </main>

      <aside className="panel">
        <div className="panel-block">
          <div className="link-row">
            <input
              value={draft}
              spellCheck={false}
              maxLength={300}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyLink()}
              placeholder="Paste a link"
              aria-label="Link behind the QR code"
            />
            <button type="button" className="btn-send" onClick={applyLink} aria-label="Grow the tree">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="samples">
            {SAMPLES.map((s) => (
              <button key={s.label} type="button" className="chip" onClick={() => setPayload(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
          <code className="payload mono" title={payload}>
            {payload}
          </code>
        </div>

        <div className="panel-block">
          <p className="panel-label">Tree</p>
          <div className="palettes" role="radiogroup" aria-label="Tree palette">
            {TREE_KINDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={kind === id}
                aria-label={KINDS[id].name}
                className={kind === id ? 'palette is-active' : 'palette'}
                onClick={() => setKind(id)}
              >
                <span
                  className="palette-dot"
                  aria-hidden="true"
                  style={{
                    background: `radial-gradient(circle at 32% 28%, ${KINDS[id].swatch[0]}, ${KINDS[id].swatch[1]} 70%)`,
                  }}
                />
                <span className="palette-name">{KINDS[id].name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel-block toggles">
          <Toggle label="Snow" checked={snow} onChange={setSnow} glyph="❄" />
          <Toggle label="Baubles" checked={baubles} onChange={setBaubles} glyph="●" />
        </div>

        <div className="panel-block">
          <label className="field tight">
            <span>Greeting</span>
            <input
              value={message}
              maxLength={140}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="С Новым годом! 🎄"
            />
          </label>
        </div>

        <div className="panel-foot">
          <span className="credit">
            made with <strong>christmas qr</strong>
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setShareOpen(true)}>
            Send a tree
          </button>
        </div>
      </aside>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        look={look}
        payload={payload}
        message={message}
        onSend={receiveFromUrl}
        incoming={incoming}
        addGreeting={addGreeting}
        snow={snow}
        baubles={baubles}
      />
      <EmbedDialog
        open={embedOpen}
        onClose={() => setEmbedOpen(false)}
        look={look}
        payload={payload}
        message={message}
        snow={snow}
        baubles={baubles}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  glyph,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  glyph: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={checked ? 'toggle is-on' : 'toggle'}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-knob" />
      </span>
      <span className="toggle-glyph" aria-hidden="true">
        {glyph}
      </span>
      {label}
    </button>
  );
}
