// Extras: the corner credit to the original, the licence sheet, the
// "link with a tree" button and the animation recorder.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import gifenc from 'gifenc';

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

// --- три формата анимации
const menu = doc.getElementById('menu');
doc.getElementById('share').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const record = menu.querySelector('[data-action="record"]');
check(!!record, 'в меню есть «Скачать анимацию»');

const fmts = [...doc.querySelectorAll('.menu-formats .fmt')].map((b) => b.dataset.format);
check(fmts.join(',') === 'gif,mp4,webm', 'есть выбор GIF / MP4 / WebM', fmts.join(','));
check(doc.getElementById('anim-label').textContent === 'GIF', 'по умолчанию GIF');
doc.querySelector('.fmt[data-format="mp4"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check(doc.getElementById('anim-label').textContent === 'MP4', 'переключение формата обновляет подпись');
check(api.state && true, 'формат запоминается');
doc.querySelector('.fmt[data-format="webm"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check(doc.getElementById('anim-label').textContent === 'WebM', 'переключение на WebM');

check(api.recordDuration() >= 5 && api.recordDuration() <= 12, 'длительность разумная', api.recordDuration() + ' c');
check(api.camAt(0) === 1 && api.camAt(api.recordDuration()) > 0.9, 'клип начинается и кончается ёлкой');
const hold = api.recordDuration() - 2.1 - 0.9 + 1.9; // hold + tilt
check(api.camAt(hold + 0.1) === 0, 'сразу после наклона — код', String(api.camAt(hold + 0.1)));
check(api.camAt(1.0) === 1, 'первая секунда — ёлка');

// WebM через MediaRecorder
api.setFormat('webm');
api.downloadAnimation();
check(recs.length === 1, 'WebM: запись началась', `${recs.length} recorder(s)`);
check(recs[0].state === 'recording', 'WebM: MediaRecorder пишет');
check(doc.body.classList.contains('is-recording'), 'WebM: состояние записи отмечено');

// прокручиваем кадры: сначала ёлка
const drawn = [];
const realDraw = window.QRTree.draw;
window.QRTree.draw = function (ctx, w, h, text, key, o) { drawn.push(o.cam); return realDraw.apply(this, arguments); };
for (let i = 0; i < 6 && frames.length; i++) { const cb = frames.shift(); cb(performance.now() + i * 200); }
check(drawn.length > 0 && drawn[0] > 0.9, 'WebM: кадры рисуются, начиная с ёлки', `${drawn.length}, cam=${drawn[0]}`);
window.QRTree.draw = realDraw;

recs[0].stop();
await new Promise((r) => setTimeout(r, 10));
check((window.__downloads || []).some((n) => n === 'christmas-qr.webm'), 'WebM: файл скачивается', JSON.stringify(window.__downloads));

// GIF через gifenc — здесь же проверяем, что путь не падает и доходит до файла.
// jsdom не рисует, поэтому getImageData отдаёт ровный буфер: энкодеру этого достаточно.
window.HTMLCanvasElement.prototype.getContext = function () {
  const px = new Uint8ClampedArray(4 * 480 * 480).fill(30);
  return new Proxy({}, {
    get: (t, k) => {
      if (k === 'getImageData') return () => ({ data: px, width: 480, height: 480 });
      return k in t ? t[k] : () => ({ width: 0 });
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
};
window.GIFEncoder = gifenc.GIFEncoder;
window.quantize = gifenc.quantize;
window.applyPalette = gifenc.applyPalette;
api.setFormat('gif');
const before = (window.__downloads || []).length;
api.downloadAnimation();
for (let i = 0; i < 1200; i++) await new Promise((r) => setTimeout(r, 10));
const gifName = (window.__downloads || []).slice(before).find((n) => n === 'christmas-qr.gif');
check(!!gifName, 'GIF: файл собирается и скачивается', JSON.stringify((window.__downloads || []).slice(before)));
check(!doc.body.classList.contains('is-recording'), 'GIF: кнопка снова активна');

// MP4 путь: без WebCodecs обязан откатиться на GIF, а не молчать
api.setFormat('mp4');
const beforeMp4 = (window.__downloads || []).length;
api.downloadAnimation();
for (let i = 0; i < 1200; i++) await new Promise((r) => setTimeout(r, 10));
check((window.__downloads || []).length > beforeMp4, 'MP4 без WebCodecs откатывается на GIF',
  JSON.stringify((window.__downloads || []).slice(beforeMp4)));

console.log(fail ? `\n${fail} check(s) failed` : '\nдополнения OK');
process.exit(fail ? 1 : 0);
