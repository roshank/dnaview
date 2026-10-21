import type { Change, PanelSnp, PickerSpec } from './picker';

export interface PickerPanel {
  el: HTMLElement;
  /** Show `spec` with `current` selected, diffed against `previous` (null on first view). */
  set(spec: PickerSpec, panel: PanelSnp[], current: string, previous: string | null, changes: Map<string, Change>): void;
}

/** Render one copy's letters, highlighting those that differ from `other`; "-" shows as a gap. */
function letters(copy: string, other?: string): string {
  return copy
    .split('')
    .map((a, i) => {
      const changed = other !== undefined && other[i] !== a;
      return `<i class="b-${a === '-' ? 'gap' : a}${changed ? ' changed' : ''}">${a === '-' ? '–' : a}</i>`;
    })
    .join('');
}

/** A picker for any trait: option swatches, what the choice means, and the per-SNP diff. */
export function createPickerPanel(onPick: (key: string) => void): PickerPanel {
  const el = document.createElement('section');
  el.className = 'eye-studio picker';
  el.innerHTML = `
    <header><b></b><span></span></header>
    <div class="es-picks" role="radiogroup"></div>
    <div class="pk-outcome" aria-live="polite"><div class="pk-summary"></div><p></p></div>
    <table class="es-snps"><tbody></tbody></table>
    <p class="es-note"></p>`;
  const $ = <T extends HTMLElement>(sel: string) => el.querySelector(sel) as T;
  let built: PickerSpec | null = null;

  return {
    el,
    set(spec, panel, current, previous, changes) {
      if (built !== spec) {
        built = spec;
        $('header b').textContent = spec.title;
        $('header span').textContent = spec.subtitle;
        $('.es-note').textContent = spec.note;
        const picks = $('.es-picks');
        picks.setAttribute('aria-label', spec.title);
        picks.innerHTML = '';
        for (const o of spec.options) {
          const b = document.createElement('button');
          b.setAttribute('role', 'radio');
          b.dataset.key = o.key;
          b.innerHTML = `<i style="--c:${o.color};--d:${o.color}"></i>${o.label}`;
          b.onclick = () => onPick(o.key);
          picks.appendChild(b);
        }
      }
      for (const b of el.querySelectorAll<HTMLButtonElement>('.es-picks button')) {
        const on = b.dataset.key === current;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      }
      const label = (key: string) => spec.options.find((o) => o.key === key)!.label;
      $('.pk-summary').innerHTML = previous
        ? `<b>${label(previous)} → ${label(current)}</b> · ${changes.size} of ${panel.length} variant${panel.length > 1 ? 's' : ''} change`
        : `<b>${label(current)}</b> · matches the reference genome`;
      $('.pk-outcome p').textContent = spec.options.find((o) => o.key === current)!.outcome;

      $('tbody').innerHTML = panel
        .map((v) => {
          const now = spec.profiles[current][v.id];
          const ch = changes.get(v.id);
          const pair = (p: [string, string], other?: [string, string]) =>
            p.map((c, i) => letters(c, other?.[i])).join('<em>/</em>');
          const cell = ch ? `<s>${pair(ch.from)}</s> → ${pair(ch.to, ch.from)}` : pair(now);
          return `<tr class="${ch ? 'changed' : ''}"><th>${v.gene}</th><td class="rs">${v.id}</td><td class="gt">${cell}</td></tr>`;
        })
        .join('');
    },
  };
}
