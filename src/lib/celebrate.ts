/** Tiny, dependency-free "unwrap" moment: a chime plus a burst of confetti. */

let audio: AudioContext | null = null;

const context = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audio ??= new Ctor();
  if (audio.state === 'suspended') void audio.resume();
  return audio;
};

/** Four rising bell notes — a sleigh-bell arpeggio, not a melody file. */
export function chime(volume = 0.14) {
  const ctx = context();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [1318.5, 1760, 2093, 2637];
  notes.forEach((freq, i) => {
    const at = now + i * 0.085;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 1);
  });
}

const COLORS = ['#ffd166', '#ff5c72', '#9be8b1', '#ffffff', '#7ce7d0', '#f0a6ca'];

/** Paper confetti burst from the middle of `host`. */
export function confetti(host: HTMLElement | null, count = 54) {
  if (!host) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = host.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.style.cssText = `position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5`;
  host.appendChild(layer);

  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('span');
    const size = 5 + Math.random() * 7;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const speed = 160 + Math.random() * 240;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    piece.style.cssText = `
      position:absolute;left:${rect.width / 2}px;top:${rect.height * 0.45}px;
      width:${size}px;height:${size * 0.6}px;border-radius:2px;
      background:${COLORS[i % COLORS.length]};opacity:.95;
      transform:translate(-50%,-50%) rotate(${Math.random() * 180}deg);`;
    layer.appendChild(piece);
    const spin = (Math.random() - 0.5) * 720;
    piece.animate(
      [
        { transform: `translate(-50%,-50%) rotate(0deg)`, offset: 0 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin * 0.4}deg)`,
          offset: 0.35,
        },
        {
          transform: `translate(calc(-50% + ${dx * 1.25}px), calc(-50% + ${dy + rect.height * 0.7}px)) rotate(${spin}deg)`,
          offset: 1,
        },
      ],
      {
        duration: 1400 + Math.random() * 900,
        easing: 'cubic-bezier(.2,.6,.3,1)',
        fill: 'forwards',
      },
    ).onfinish = () => piece.remove();
  }
  setTimeout(() => layer.remove(), 2800);
}
