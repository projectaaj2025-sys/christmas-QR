// "Send a tree": a link shared from the page opens the receiver's page with the
// tree already standing, in the sender's palette, with snow/baubles kept.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

let fail = 0;
const check = (ok, label, extra = '') => {
  if (!ok) fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
};

const html = readFileSync('index.html', 'utf8');
const engineSrc = readFileSync('js/tree-engine.js', 'utf8');
const appSrc = readFileSync('js/app.js', 'utf8');

function boot(query) {
  const dom = new JSDOM(html, { url: 'https://example.test/' + query, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })),
      set: (t, k, v) => { t[k] = v; return true; },
    });
  };
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  const frames = [];
  window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  window.open = () => ({});
  window.eval(engineSrc);
  window.eval(appSrc);
  return { window, doc: window.document, frames, api: window.__qrTree };
}

const shared = '?link=' + encodeURIComponent('https://hh.kz/vacancy/1') + '&tree=neon&snow=0';
const r = boot(shared);
const { api, doc } = r;

check(!!api, 'page logic runs (window.__qrTree)');
check(api.state.link === 'https://hh.kz/vacancy/1', 'shared link is loaded', api.state.link);
check(api.state.tree === 'neon', 'shared palette is loaded', api.state.tree);
check(api.state.cam === 1 && api.state.grown === 1, 'receiver opens on the standing tree', `cam=${api.state.cam} grow=${api.state.grown}`);
check(doc.getElementById('snow').checked === false, 'snow preference travels with the link');
check(doc.getElementById('url').value === 'https://hh.kz/vacancy/1', 'the input shows the link');

const chips = [...doc.querySelectorAll('#trees .chip')];
check(chips.length === 10, 'the picker has all ten trees', String(chips.length));
check(chips.map((c) => c.dataset.tree).join(',') === 'classic,dots,blush,snow,blue,fairy,neon,lace,glitch,ribbon', 'picker order matches the original');
check(doc.querySelector('#trees .chip[data-tree="neon"]').getAttribute('aria-pressed') === 'true', 'selected chip is pressed');

// the share URL round-trips: opening it reproduces the same tree
const url = api.shareURL();
check(url.includes('link=https%3A%2F%2Fhh.kz%2Fvacancy%2F1'), 'share URL carries the link', url);
check(url.includes('tree=neon'), 'share URL carries the palette');
check(url.includes('snow=0'), 'share URL carries the snow switch');

const next = boot('?' + url.split('?')[1]);
check(next.api.state.tree === 'neon' && next.api.state.cam === 1, 'reopening a shared URL reproduces the tree');

// embed snippet is a real iframe pointing at embed mode
const snippet = api.embedSnippet();
check(/^<iframe .*src="https:\/\/example\.test\/\?embed=1&/.test(snippet), 'embed snippet is an iframe in embed mode');
check(snippet.includes('embed=1'), 'embed snippet asks for the widget');
check(/width:360px;height:480px/.test(snippet), 'embed snippet has a size');

// tap flips between the code and the tree
api.flip();
check(api.state.camTarget === 0, 'tap tilts the camera down to the code');
api.flip();
check(api.state.camTarget === 1, 'tap again stands the tree back up');

// picking a tree in a fresh session tilts up and writes the URL
const fresh = boot('');
check(fresh.api.state.tree === 'classic', 'arrival without state shows the classic tree');
fresh.api.pickTree('ribbon');
check(fresh.api.state.tree === 'ribbon' && fresh.api.state.camTarget === 1, 'picking a tree tilts the camera up');
check(fresh.window.location.search.includes('tree=ribbon'), 'picking a tree updates the address bar', fresh.window.location.search);

// a plain link (no tree) still produces a scannable frame with the default tree
const plainLink = boot('?link=https%3A%2F%2Fexample.com');
check(plainLink.api.state.tree === 'classic' && plainLink.api.state.link === 'https://example.com', 'bare ?link= falls back to classic');

console.log(fail ? `\n${fail} check(s) failed` : '\nreceive / share flow OK');
process.exit(fail ? 1 : 0);
