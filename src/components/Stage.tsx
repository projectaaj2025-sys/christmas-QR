import { useCallback, useEffect, useRef, useState } from 'react';
import { drawScene, SceneLook } from '../lib/scene';
import { chime, confetti } from '../lib/celebrate';

interface StageProps {
  text: string;
  look: SceneLook;
  /** falling snow in the scene */
  snow?: boolean;
  /** ornaments among the canopy glyphs */
  baubles?: boolean;
  /** force the flat code (used while exporting / deep links) */
  startFlat?: boolean;
  caption?: boolean;
  className?: string;
  onFlip?: (flat: boolean) => void;
  /** play the unwrap moment the first time a shared tree is revealed */
  celebrate?: boolean;
}

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TWEEN_MS = 2600;

/**
 * The canvas stage. A tap sends every blossom falling onto its QR module,
 * a second tap grows the tree back — both directions are reversible mid-flight.
 */
export function Stage({
  text,
  look,
  snow = true,
  baubles = true,
  startFlat,
  caption = true,
  className,
  onFlip,
  celebrate,
}: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // target and rendered morph are separate so taps can reverse smoothly
  const target = useRef(startFlat ? 1 : 0);
  const current = useRef(startFlat ? 1 : 0);
  const [flat, setFlat] = useState(Boolean(startFlat));
  const [reduced, setReduced] = useState(prefersReduced);
  const flatRef = useRef(flat);
  flatRef.current = flat;
  const celebrated = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    target.current = startFlat ? 1 : 0;
    setFlat(Boolean(startFlat));
  }, [startFlat]);

  const toggle = useCallback(() => {
    const next = !flatRef.current;
    target.current = next ? 1 : 0;
    setFlat(next);
    onFlip?.(next);
    if (next && celebrate && !celebrated.current) {
      celebrated.current = true;
      chime();
      confetti(wrapRef.current);
    }
  }, [onFlip, celebrate]);

  // drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let visible = true;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => (visible = entry.isIntersecting)),
      { threshold: 0.01 },
    );
    io.observe(wrap);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();
    const start = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const time = (now - start) / 1000;

      if (!visible || document.hidden) {
        raf = requestAnimationFrame(frame);
        return;
      }

      if (reduced) {
        current.current = target.current;
      } else if (Math.abs(current.current - target.current) > 0.0005) {
        // ease toward the target over ~2.6s, direction agnostic
        const stepSize = (dt / TWEEN_MS) * 1.12;
        const dir = Math.sign(target.current - current.current);
        const distance = Math.abs(target.current - current.current);
        current.current += dir * Math.min(distance, stepSize);
      }
      ctx.clearRect(0, 0, width, height);
      drawScene(ctx, width, height, {
        text,
        look,
        morph: current.current,
        time: reduced ? 0 : time,
        snowfall: reduced || !snow ? 0 : 1,
        baubles,
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [text, look, reduced, snow, baubles]);

  const hint = flat ? 'Tap the snow to grow the tree back' : 'Tap the tree to see the QR code';

  return (
    <div className={`stage-wrap ${className ?? ''}`} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="stage-canvas"
        role="button"
        tabIndex={0}
        aria-label={hint}
        aria-pressed={flat}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      />
      {caption && (
        <p className="stage-caption" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  );
}
