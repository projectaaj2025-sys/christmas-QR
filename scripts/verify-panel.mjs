// The foldable panel: tab, corner chip and the H key all fold and unfold it,
// the choice is remembered, and while folded the URL row is out of the way.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

let fail = 0;
const check = (ok, label, extra = '') => { if (!ok) fail += 1; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); };

function boot(query = '', storage = {}) {
  const dom = new JSDOM(readFileSync('index.html', 'utf8'), { url: 'https://example.test/' + query, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => { t[k] = v; return true; } });
  };
  for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
  window.requestAnimationFrame = () => 1;
  window.eval(readFileSync('js/tree-engine.js', 'utf8'));
  window.eval(readFileSync('js/app.js', 'utf8'));
  return { window, doc: window.document, api: window.__qrTree };
}

const { window, doc, api } = boot();
const app = doc.querySelector('.app');
const toggle = doc.getElementById('panel-toggle');
const openChip = doc.getElementById('panel-open');

check(!!toggle && !!openChip, 'кнопки сворачивания на месте');
check(!app.classList.contains('panel-hidden'), 'по умолчанию панель открыта');
check(openChip.hidden === true, 'уголковая кнопка спрятана');
check(toggle.getAttribute('aria-expanded') === 'true', 'tab сообщает, что панель открыта');

toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check(app.classList.contains('panel-hidden'), 'язычок сворачивает панель');
check(openChip.hidden === false, 'появилась кнопка «Ссылка и ёлки»');
check(doc.getElementById('panel-body').getAttribute('aria-hidden') === 'true', 'тело панели помечено скрытым');
check(toggle.getAttribute('aria-expanded') === 'false', 'tab переключил aria-expanded');
check(window.localStorage.getItem('xmasqr:panel') === '0', 'выбор запомнен');

openChip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check(!app.classList.contains('panel-hidden'), 'кнопка в углу возвращает панель');
check(window.localStorage.getItem('xmasqr:panel') === '1', 'возврат тоже запомнен');

// клавиша H, но не внутри поля ввода
const key = (target, k = 'h') => target.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
key(doc.body);
check(app.classList.contains('panel-hidden'), 'клавиша H сворачивает панель');
key(doc.body, 'H');
check(!app.classList.contains('panel-hidden'), 'H повторно возвращает');
key(doc.getElementById('url'), 'h');
check(!app.classList.contains('panel-hidden'), 'в поле ввода H не перехватывается');

// запомненное состояние применяется при загрузке
const folded = boot('', { 'xmasqr:panel': '0' });
check(folded.api.isPanelHidden(), 'сохранённое «скрыто» применяется при загрузке');
const reopened = boot('?panel=0');
check(reopened.api.isPanelHidden(), '?panel=0 в ссылке тоже сворачивает');

// если панель спрятана, меню шаринга не остаётся висеть
const withMenu = boot('');
withMenu.doc.getElementById('share').dispatchEvent(new withMenu.window.MouseEvent('click', { bubbles: true }));
withMenu.api.setPanel(true, false);
check(withMenu.doc.getElementById('menu').hidden === true, 'при сворачивании меню закрывается');

// сама страница по-прежнему работает после сворачивания
check(withMenu.api.state.tree === 'classic', 'движок продолжает работать');

console.log(fail ? `\n${fail} check(s) failed` : '\nпанель сворачивается OK');
process.exit(fail ? 1 : 0);
