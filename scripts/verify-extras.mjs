// Extras: the corner credit to the original, the licence sheet, the
// "link with a tree" button and the animation recorder.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

let fail = 0;
const check = (ok, label, extra = '') => {
  if (!ok) fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
};

const dom = new JSDOM(readFileSync('index.html', 'utf8'), {
  url: 'https://example.test/?link=https%3A%2F%2Fhh.kz%2Fvacancy%2F1&tree=neon',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
const doc = window.document;
if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.HTMLCanvasElement.prototype.getContext = function () {
  return new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => { t[k] = v; return true; } });
};
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

// MediaRecorder + captureStream are absent in jsdom: install small fakes so the
// recorder path can be exercised end to end.
const recs = [];
window.HTMLCanvasElement.prototype.captureStream = function () { return { fake: true }; };
window.MediaRecorder = class {
  static isTypeSupported(m) { return m.startsWith('video/webm'); }
  constructor(stream) { this.stream = stream; this.state = 'inactive'; this.ondataavailable = null; this.onstop = null; recs.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; if (this.ondataavailable) this.ondataavailable({ data: new window.Blob(['x'], { type: 'video/webm' }) }); if (this.onstop) this.onstop(); }
};
window.URL.createObjectURL = () => 'blob:fake';
window.URL.revokeObjectURL = () => {};
window.HTMLAnchorElement.prototype.click = function () { this.__clicked = true; (window.__downloads = window.__downloads || []).push(this.download); };

const frames = [];
window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
window.eval(readFileSync('js/tree-engine.js', 'utf8'));
window.eval(readFileSync('js/app.js', 'utf8'));
const api = window.__qrTree;

// --- карточка оригинала и лицензия
const origin = doc.querySelector('a.origin');
check(!!origin, 'ссылка на оригинал есть');
check(origin.href.includes('xmasqr.vercel.app'), 'ведёт на оригинальный сайт', origin.href);
check(origin.target === '_blank' && /noopener/.test(origin.rel), 'открывается в новой вкладке и безопасно');
check(/оригинал/i.test(origin.textContent), 'подписана как оригинал');

const lic = doc.getElementById('licence');
check(lic.hidden === true, 'окно лицензии спрятано при загрузке');
doc.getElementById('licence-open').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check(lic.hidden === false, 'кнопка «лицензия» открывает окно');
check(/xmasqr/.test(lic.textContent) && /лиценз/i.test(lic.textContent), 'в окне есть ссылка на оригинал и пояснение о лицензии');
doc.getElementById('licence-close').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check(lic.hidden === true, 'окно закрывается');

// --- ссылка, которая открывается ёлкой
const treeLink = doc.getElementById('tree-link');
check(!!treeLink, 'подсказка про ссылку с ёлкой есть');
let copied = null;
window.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
treeLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await Promise.resolve();
check(copied === api.shareURL(), 'кнопка копирует ссылку с ёлкой', String(copied));
check(copied.includes('tree=neon') && copied.includes('link='), 'в ссылке есть и ссылка, и палитра');

// --- запись анимации
const menu = doc.getElementById('menu');
doc.getElementById('share').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const record = menu.querySelector('[data-action="record"]');
check(!!record, 'в меню есть «Скачать анимацию»');

api.downloadAnimation();
check(recs.length === 1, 'запись началась', `${recs.length} recorder(s)`);
check(recs[0].state === 'recording', 'MediaRecorder в состоянии записи');
check(doc.querySelector('body').classList.contains('is-recording'), 'состояние записи отмечено');
check(api.recordDuration() >= 5 && api.recordDuration() <= 12, 'длительность разумная', api.recordDuration() + ' c');

// прокручиваем кадры анимации: сначала ёлка, в конце — код
const drawn = [];
const realDraw = window.QRTree.draw;
window.QRTree.draw = function (ctx, w, h, text, key, o) { drawn.push(o.cam); return realDraw.apply(this, arguments); };
for (let i = 0; i < 8 && frames.length; i++) { const cb = frames.shift(); cb(performance.now() + i * 300); }
check(drawn.length > 0, 'кадры анимации рисуются', `${drawn.length}`);
check(drawn[0] > 0.9, 'начинается со стоящей ёлки', String(drawn[0]));
window.QRTree.draw = realDraw;

recs[0].stop();
await new Promise((r) => setTimeout(r, 10));
check((window.__downloads || []).some((n) => /^christmas-qr\.(webm|mp4)$/.test(n)), 'файл анимации скачивается', JSON.stringify(window.__downloads));

console.log(fail ? `\n${fail} check(s) failed` : '\nдополнения OK');
process.exit(fail ? 1 : 0);
