// The embeddable widget: embed.html must parse a shared ?link=&tree= URL,
// cycle the camera by itself and never show the page furniture.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

let fail = 0;
const check = (ok, label, extra = '') => {
  if (!ok) fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
};

const html = readFileSync('embed.html', 'utf8');
const engineSrc = readFileSync('js/tree-engine.js', 'utf8');

function run(query) {
  const dom = new JSDOM(html, { url: 'https://example.test/embed.html' + query, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const calls = [];
  window.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : (...args) => { if (typeof k === 'string') calls.push([k, args.length]); return { width: 0 }; }),
      set: (t, k, v) => { t[k] = v; return true; },
    });
  };
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  const frames = [];
  window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  window.eval(engineSrc);
  const script = [...dom.window.document.querySelectorAll('script')].map((s) => s.textContent).join('\n');
  window.eval(script);
  const tick = (n) => { for (let i = 0; i < n; i++) { const cb = frames.shift(); if (!cb) break; cb(1000 + i * 16.7); } };
  tick(3);
  return { window, calls, tick, frames };
}

const shared = run('?link=' + encodeURIComponent('https://hh.kz/vacancy/1') + '&tree=neon&embed=1');
check(shared.calls.some(([k]) => k === 'fillText'), 'embed.html paints glyphs');
check(shared.window.QRTree && shared.window.QRTree.V.neon, 'engine available inside the widget');
const painted = shared.calls.length;
check(painted > 500, 'widget draws a full frame', `${painted} canvas calls`);

// cycle(): code, tilt, tree, back — the widget must reach all of it
const { cam: cam0 } = shared.window.QRTree.cycle(0, 24);
const { cam: camMid } = shared.window.QRTree.cycle(24 * 0.5, 24);
const { cam: camTilt } = shared.window.QRTree.cycle(24 * 0.25, 24);
check(cam0 === 0 && camMid === 1, 'cycle covers code and tree', `${cam0} → ${camMid}`);
check(camTilt > 0.05 && camTilt < 0.95, 'cycle passes through the tilt', camTilt.toFixed(2));

// an unknown tree falls back to classic instead of blanking the canvas
const bad = run('?link=https%3A%2F%2Fexample.com&tree=nope');
check(bad.calls.some(([k]) => k === 'fillText'), 'unknown tree still renders');

const noLink = run('');
check(noLink.calls.some(([k]) => k === 'fillText'), 'widget without a link still paints');

console.log(fail ? `\n${fail} check(s) failed` : '\nembed widget OK');
process.exit(fail ? 1 : 0);
