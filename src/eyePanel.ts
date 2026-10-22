import {
  EYE_COLORS,
  IRIS,
  LABELS,
  PANEL,
  PROFILES,
  score,
  SCORE_RANGE,
  type Change,
  type EyeColor,
} from './eyeColor';

const IRIS_PX = 112;
const FIBERS = 260;

/** Deterministic random numbers, so the iris texture is the same on every redraw. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(7);
const fibers = Array.from({ length: FIBERS }, () => ({
  a: rand() * Math.PI * 2,
  r1: 0.62 + rand() * 0.34,
  wave: (rand() - 0.5) * 0.12,
  light: rand() < 0.55,
  alpha: 0.05 + rand() * 0.12,
}));

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${f(r1, r2)}${f(g1, g2)}${f(b1, b2)}`;
}

function drawIris(ctx: CanvasRenderingContext2D, size: number, [limbal, outer, mid, inner]: string[]) {
  const c = size / 2;
  const R = c - 2;
  const pupil = R * 0.3;
  ctx.clearRect(0, 0, size, size);

  const base = ctx.createRadialGradient(c, c, pupil, c, c, R);
  base.addColorStop(0, inner);
  base.addColorStop(0.25, inner);
  base.addColorStop(0.45, mid);
  base.addColorStop(0.85, outer);
  base.addColorStop(1, limbal);
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fill();

  // Radial stroma fibres.
  ctx.lineCap = 'round';
  for (const f of fibers) {
    ctx.strokeStyle = f.light ? `rgba(255,255,255,${f.alpha})` : `rgba(0,0,0,${f.alpha * 1.4})`;
    ctx.lineWidth = size / 160;
    ctx.beginPath();
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const r = pupil + ((R * f.r1 - pupil) * i) / steps;
      const a = f.a + Math.sin(i * 1.3) * f.wave;
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Collarette: the wavy ring that divides the pupillary and ciliary zones.
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = size / 90;
  ctx.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r = R * (0.47 + 0.025 * Math.sin(i * 1.7));
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.strokeStyle = limbal;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = R * 0.09;
  ctx.beginPath();
  ctx.arc(c, c, R * 0.955, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.arc(c, c, pupil, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(c - R * 0.33, c - R * 0.36, R * 0.11, R * 0.07, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

export interface EyeStudio {
  el: HTMLElement;
  set(current: EyeColor, previous: EyeColor | null, changes: Map<string, Change>): void;
}

/** The eye-colour picker: swatches, an iris, a lighter-to-darker score, and the per-SNP diff. */
export function createEyeStudio(onPick: (c: EyeColor) => void): EyeStudio {
  const el = document.createElement('section');
  el.className = 'eye-studio';
  el.innerHTML = `
    <header><b>Pick an eye color</b><span>The DNA that would change is highlighted</span></header>
    <div class="es-top">
      <canvas class="iris" width="${IRIS_PX * 2}" height="${IRIS_PX * 2}" aria-hidden="true"></canvas>
      <div class="es-right">
        <div class="es-picks" role="radiogroup" aria-label="Eye color"></div>
        <div class="es-summary" aria-live="polite"></div>
        <div class="es-scale"><div class="bar"><i></i></div><div class="ends"><span>lighter</span><span>darker</span></div></div>
      </div>
    </div>
    <details class="more">
      <summary>Which letters changed?</summary>
      <table class="es-snps"><tbody></tbody></table>
      <p class="es-note">Example genotypes: many letter combinations give each color. These six variants separate blue from brown well, green and hazel much less so. Per-letter effects from Eriksson et al. 2010 (PLoS Genetics).</p>
    </details>`;

  const canvas = el.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const picks = el.querySelector<HTMLElement>('.es-picks')!;
  const buttons = new Map<EyeColor, HTMLButtonElement>();
  for (const c of EYE_COLORS) {
    const b = document.createElement('button');
    b.setAttribute('role', 'radio');
    b.innerHTML = `<i style="--c:${IRIS[c][2]};--d:${IRIS[c][1]}"></i>${LABELS[c]}`;
    b.onclick = () => onPick(c);
    picks.appendChild(b);
    buttons.set(c, b);
  }

  let shown = IRIS.brown.slice();
  let anim = 0;
  const animateTo = (to: string[]) => {
    const from = shown.slice();
    const t0 = performance.now();
    cancelAnimationFrame(anim);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      const e = k * k * (3 - 2 * k);
      shown = from.map((f, i) => mix(f, to[i], e));
      drawIris(ctx, canvas.width, shown);
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };
  drawIris(ctx, canvas.width, shown);

  const [lo, hi] = SCORE_RANGE;
  return {
    el,
    set(current, previous, changes) {
      for (const [c, b] of buttons) {
        b.classList.toggle('on', c === current);
        b.setAttribute('aria-checked', String(c === current));
      }
      if (previous && previous !== current) animateTo(IRIS[current]);
      else {
        cancelAnimationFrame(anim);
        drawIris(ctx, canvas.width, (shown = IRIS[current].slice()));
      }

      const s = score(PROFILES[current]);
      el.querySelector<HTMLElement>('.bar i')!.style.left = `${((s - lo) / (hi - lo)) * 100}%`;
      el.querySelector('.es-summary')!.innerHTML = previous
        ? `<b>${LABELS[previous]} → ${LABELS[current]}</b> <span class="chg">${changes.size} of ${PANEL.length} spots changed, now highlighted</span>`
        : `<b>${LABELS[current]}</b> <span>the reference genome’s version</span>`;

      el.querySelector('tbody')!.innerHTML = PANEL.map((v) => {
        const now = PROFILES[current][v.id];
        const ch = changes.get(v.id);
        const letters = (pair: [string, string], other?: [string, string]) =>
          pair.map((a, i) => `<i class="b-${a}${other && other[i] !== a ? ' changed' : ''}">${a}</i>`).join('');
        const cell = ch ? `<s>${letters(ch.from)}</s> → ${letters(ch.to, ch.from)}` : letters(now);
        return `<tr class="${ch ? 'changed' : ''}"><th>${v.gene}</th><td class="rs">${v.id}</td><td class="gt">${cell}</td></tr>`;
      }).join('');
    },
  };
}
