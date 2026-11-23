// Boots the real page (scripts inline, DOM from disk) and exercises the controls
// the way a visitor would: paste a link, pick a tree, open the share menu, open the embed sheet.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

let fail = 0;
const check = (ok, label, extra = '') => {
  if (!ok) fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
};

const dom = new JSDOM(readFileSync('index.html', 'utf8'), {
  url: 'https://example.test/?link=https%3A%2F%2Fhh.kz%2Fvacancy%2F1&tree=classic',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  resources: undefined,
});
const { window } = dom;
window.HTMLCanvasElement.prototype.getContext = function () {
  return new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })),
    set: (t, k, v) => { t[k] = v; return true; },
  });
};
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

// the two <script src> tags are not fetched in jsdom: run the files by hand
const doc = window.document;
for (const src of ['js/tree-engine.js', 'js/app.js']) {
  const el = doc.createElement('script');
  el.textContent = readFileSync(src, 'utf8');
  doc.body.appendChild(el);
}

const api = window.__qrTree;
check(!!api, 'page boots');
check(doc.querySelectorAll('#trees .chip').length === 10, 'ten chips in the DOM');

// paste a link -> the code assembles under the tree
const input = doc.getElementById('url');
input.value = 'https://example.com/hello';
input.dispatchEvent(new window.Event('change'));
check(api.state.link === 'https://example.com/hello', 'typed link lands in state');
check(window.location.search.includes('link=https%3A%2F%2Fexample.com%2Fhello'), 'typed link lands in the URL');

// pick a tree from the picker
doc.querySelector('#trees .chip[data-tree="fairy"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check(api.state.tree === 'fairy', 'clicking a chip picks that tree');
check(doc.getElementById('tree-name').textContent === 'Сказочная', 'the tree name is shown');

// share menu opens and offers every action
const share = doc.getElementById('share');
share.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const menu = doc.getElementById('menu');
check(!menu.hidden, 'share menu opens');
check([...menu.querySelectorAll('[data-action]')].map((b) => b.dataset.action).join(',') === 'copy,download,record,embed,x,facebook,whatsapp', 'menu has copy, download, animation, embed, X, Facebook, WhatsApp');

// embed sheet
api.state.link = 'https://example.com/hello';
menu.querySelector('[data-action="embed"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const sheet = doc.getElementById('embed');
const code = doc.getElementById('embed-code').value;
check(!sheet.hidden, 'embed sheet opens');
check(code.startsWith('<iframe') && code.includes('embed=1'), 'embed sheet shows a snippet', code.slice(0, 60));
check(code.includes('tree=fairy'), 'snippet keeps the chosen tree');

// toggles are reflected in the URL
const snow = doc.getElementById('snow');
snow.checked = false;
snow.dispatchEvent(new window.Event('change'));
check(window.location.search.includes('snow=0'), 'turning snow off is remembered');

// the tap target flips the camera
const before = api.state.camTarget;
doc.getElementById('stage').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check(api.state.camTarget !== before, 'tapping the stage flips the camera');

// the download action runs without throwing
window.HTMLAnchorElement.prototype.click = function () { this.__clicked = true; };
let threw = null;
try { menu.querySelector('[data-action="download"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); } catch (e) { threw = e; }
check(!threw, 'Download QR runs', threw ? String(threw) : '');

console.log(fail ? `\n${fail} check(s) failed` : '\npage smoke OK');
process.exit(fail ? 1 : 0);
