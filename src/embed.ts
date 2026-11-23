/**
 * Drop-in widget.
 *
 *   <div id="my-tree"></div>
 *   <script src="https://your-site/embed.js?t=aurora&u=https%3A%2F%2Fexample.com" async></script>
 *
 * Finds the placeholder (or appends one), grows the tree from the `u` payload,
 * and swaps to the flat code on a tap. No framework needed on the host page.
 */
import { drawScene } from './lib/scene';
import { lookFor } from './lib/looks';
import { buildLink } from './lib/urlState';

(() => {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    (Array.from(document.querySelectorAll('script[src*="embed.js"]')).pop() as
      | HTMLScriptElement
      | undefined);

  const params = new URLSearchParams(
    script?.src.includes('?') ? script.src.slice(script.src.indexOf('?')) : '',
  );

  const mountId = params.get('mount') ?? 'xmas-tree';
  const kind = params.get('t') ?? params.get('tree') ?? 'classic';
  const hosted = params.get('host') ?? (script ? new URL(script.src).origin : location.origin);
  // what the QR code encodes: a tree page on the host, or the payload itself
  const payload = params.get('u') ?? `${hosted}/?t=${kind}`;
  const look = lookFor(kind);
  const snow = params.get('snow') !== '0';
  const baubles = params.get('baubles') !== '0';
  const requested = Number(params.get('h'));
  const height = Number.isFinite(requested) && requested > 160 ? requested : 520;

  const mount =
    document.getElementById(mountId) ??
    (() => {
      const el = document.createElement('div');
      el.id = mountId;
      document.body.appendChild(el);
      return el;
    })();

  mount.innerHTML = '';
  mount.style.position = 'relative';
  mount.style.width = '100%';
  mount.style.height = `${height}px`;
  mount.style.borderRadius = '18px';
  mount.style.overflow = 'hidden';
  mount.style.cursor = 'pointer';
  mount.style.touchAction = 'manipulation';

  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'QR code tree — tap to show the code');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  mount.appendChild(canvas);

  const caption = document.createElement('div');
  caption.textContent = 'Tap the tree to see the QR code';
  caption.style.cssText =
    'position:absolute;left:0;right:0;bottom:10px;text-align:center;font:500 13px/1.4 ui-sans-serif,system-ui,sans-serif;color:rgba(255,255,255,.78);pointer-events:none;text-shadow:0 1px 8px rgba(0,0,0,.5)';
  mount.appendChild(caption);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = 0;
  let morph = 0;
  let width = 0;
  let heightPx = 0;

  const resize = () => {
    const rect = mount!.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    width = Math.max(1, Math.round(rect.width || mount!.clientWidth || 640));
    heightPx = Math.max(1, Math.round(rect.height || height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(heightPx * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  new ResizeObserver(resize).observe(mount);

  let visible = true;
  new IntersectionObserver(
    (entries) => entries.forEach((entry) => (visible = entry.isIntersecting)),
    { threshold: 0.01 },
  ).observe(mount);

  const tap = () => {
    target = target > 0.5 ? 0 : 1;
    caption.textContent =
      target > 0.5 ? 'Tap the snow to grow the tree back' : 'Tap the tree to see the QR code';
    // a tap might be the start of someone's journey — let the host listen in
    mount.dispatchEvent(new CustomEvent('xmasqr:flip', { detail: { flat: target > 0.5 } }));
  };
  mount.addEventListener('click', tap);
  mount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tap();
    }
  });
  mount.tabIndex = 0;

  let last = performance.now();
  const start = last;
  const frame = (now: number) => {
    const dt = Math.min(64, now - last);
    last = now;
    if (!visible || document.hidden) {
      requestAnimationFrame(frame);
      return;
    }
    if (reduced) {
      morph = target;
    } else if (morph !== target) {
      const dir = Math.sign(target - morph);
      morph += dir * Math.min(Math.abs(target - morph), (dt / 2600) * 1.12);
    }
    drawScene(ctx, width, heightPx, {
      text: payload,
      look,
      morph,
      time: reduced ? 0 : (now - start) / 1000,
      snowfall: reduced || !snow ? 0 : 1,
      baubles,
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // canonical link for anyone who wants to open the full page instead
  canvas.setAttribute('data-tree-link', buildLink({ kind: look.id, payload, embed: true }, hosted + '/'));
})();
