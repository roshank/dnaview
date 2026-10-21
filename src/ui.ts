import { COMPLEMENT, genome, highlightIndices, type TraitKey } from './data';
import { PROFILES, type Change, type EyeColor } from './eyeColor';
import { createEyeStudio } from './eyePanel';
import { fmtShort } from './levels/common';
import type { PanelSnp, PickerSpec } from './picker';
import { createPickerPanel } from './pickerPanel';
import { DECIDES, LETTER, TRAITS, type Trait } from './traits';

interface Handlers {
  onTrait(k: TraitKey): void;
  onLevel(i: number): void;
  onAllele(base: string): void;
  onEyeColor(c: EyeColor): void;
  onPick(key: string): void;
}

/** Five pips, the first `n` lit. */
const pips = (n: number) => `<span class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

const LEVEL_KINDS = ['Genome', 'Chromosome', 'Region', 'Gene', 'Base pairs'];

export function createUI(h: Handlers) {
  const root = document.createElement('div');
  root.className = 'ui';
  root.innerHTML = `
    <header class="top">
      <div class="brand"><span class="logo" aria-hidden="true"></span>DNAView<small>${genome.assembly} · real data</small></div>
      <nav class="traits" aria-label="Explore a trait"></nav>
    </header>
    <aside class="panel" aria-live="polite">
      <div class="panel-inner">
        <div class="eyebrow"></div>
        <h1></h1>
        <div class="influence"></div>
        <p class="body"></p>
        <dl class="facts"></dl>
        <div class="alleles" hidden><span>Try each version:</span><div class="opts"></div></div>
        <div class="seq" hidden></div>
        <div class="next"></div>
      </div>
    </aside>
    <footer class="zoom">
      <ol class="crumbs"><div class="track"><div class="fill"></div></div></ol>
      <div class="meta"><span class="scale"></span><span class="hint">Scroll or pinch to zoom · drag to rotate · ← → keys</span></div>
    </footer>
    <div class="disclaimer">Educational prototype · not medical or ancestry advice</div>`;
  document.body.appendChild(root);

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const nav = $('.traits');
  const panel = $('.panel-inner');
  const crumbs = $('.crumbs');
  const fill = $('.fill');
  const scale = $('.scale');
  let trait: Trait = TRAITS.eye;
  let level = 0;
  let allele = '';
  let eyeAllele = '';
  const studio = createEyeStudio(h.onEyeColor);
  $('.facts').after(studio.el);
  const picker = createPickerPanel(h.onPick);
  studio.el.after(picker.el);

  for (const t of Object.values(TRAITS)) {
    const b = document.createElement('button');
    b.dataset.key = t.key;
    b.title = `${t.tagline}. DNA decides it: ${DECIDES[t.influence.decides]}.`;
    b.innerHTML = `<b>${t.name}</b>${pips(t.influence.decides)}`;
    b.onclick = () => h.onTrait(t.key);
    nav.appendChild(b);
  }

  const crumbButtons: HTMLButtonElement[] = [];
  for (let i = 0; i < 5; i++) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.onclick = () => h.onLevel(i);
    li.appendChild(b);
    crumbs.appendChild(li);
    crumbButtons.push(b);
  }

  function markTrait(k: TraitKey) {
    for (const b of nav.querySelectorAll('button')) b.classList.toggle('on', b.dataset.key === k);
  }

  function setTrait(t: Trait) {
    trait = t;
    markTrait(t.key);
    t.crumbs.forEach((c, i) => (crumbButtons[i].innerHTML = `<small>${LEVEL_KINDS[i]}</small>${c}`));
    allele = t.alleles?.[0].base ?? '';
    render();
  }

  function sequenceStrip() {
    const data = genome.traits[trait.key];
    const bases = data.sequence.bases.split('');
    const hl = highlightIndices(data);
    const shownAllele = trait.key === 'eye' || trait.picker ? eyeAllele : allele;
    if (shownAllele) hl.forEach((i, k) => k < shownAllele.length && (bases[i] = shownAllele[k]));
    const from = 14;
    const to = 50;
    const row = (comp: boolean) =>
      bases
        .slice(from, to)
        .map((b, j) => {
          const ch = comp ? COMPLEMENT[b] : b;
          return `<i class="b-${ch === '-' ? 'gap' : ch}${hl.includes(j + from) ? ' hl' : ''}">${ch === '-' ? '–' : ch}</i>`;
        })
        .join('');
    const pos = (data.sequence.start + from + 1).toLocaleString('en-US');
    return `<div class="row"><em>5′</em>${row(false)}<em>3′</em></div><div class="row"><em>3′</em>${row(true)}<em>5′</em></div><small>chr${data.chrom}:${pos} · + strand on top</small>`;
  }

  function render() {
    const text = trait.levels[level];
    panel.classList.remove('in');
    void panel.offsetWidth; // restart the fade-in animation
    panel.classList.add('in');
    $('.eyebrow').textContent = `${level + 1} / 5 · ${LEVEL_KINDS[level]} · ${trait.name}`;
    $('h1').textContent = text.title;
    const inf = trait.influence;
    $('.influence').innerHTML = `
      <div><span>DNA decides it</span>${pips(inf.decides)}<b>${DECIDES[inf.decides]}</b></div>
      <div><span>Effect of one letter</span>${pips(inf.letter)}<b>${LETTER[inf.letter]}</b></div>
      ${level === 0 ? `<p>${inf.summary}</p>` : ''}`;
    $('.body').innerHTML = text.body;
    $('.facts').innerHTML = text.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    const showAlleles = level === 4 && !!trait.alleles;
    const al = $('.alleles');
    al.hidden = !showAlleles;
    if (showAlleles) {
      $('.opts').innerHTML = trait
        .alleles!.map(
          (a) => `<button data-b="${a.base}" class="${a.base === allele ? 'on' : ''}"><i class="b-${a.base}">${a.label}</i>${a.note}</button>`,
        )
        .join('');
      for (const b of al.querySelectorAll('button')) {
        b.addEventListener('click', () => {
          allele = (b as HTMLElement).dataset.b!;
          h.onAllele(allele);
          render();
        });
      }
    }
    studio.el.hidden = trait.key !== 'eye';
    picker.el.hidden = !trait.picker;
    const seq = $('.seq');
    seq.hidden = level !== 4;
    if (level === 4) seq.innerHTML = sequenceStrip();
    $('.next').textContent = level < 4 ? `Zoom in to ${trait.crumbs[level + 1]} →` : '';
    $('.next').onclick = () => h.onLevel(level + 1);
    crumbButtons.forEach((b, i) => b.classList.toggle('on', i === level));
  }

  return {
    setTrait,
    markTrait,
    setPick(spec: PickerSpec, panel: PanelSnp[], current: string, previous: string | null, changes: Map<string, Change>) {
      picker.set(spec, panel, current, previous, changes);
      eyeAllele = spec.profiles[current][spec.helix][0];
      if (level === 4) $('.seq').innerHTML = sequenceStrip();
    },
    setEye(current: EyeColor, previous: EyeColor | null, changes: Map<string, Change>) {
      studio.set(current, previous, changes);
      eyeAllele = PROFILES[current].rs12913832[0];
      if (trait.key === 'eye' && level === 4) $('.seq').innerHTML = sequenceStrip();
    },
    setLevel(i: number) {
      level = i;
      render();
    },
    setProgress(t: number, span: number) {
      fill.style.width = `${(t / 4) * 100}%`;
      scale.textContent = `View height ≈ ${fmtShort(span)}`;
    },
    /** Screen rectangle (px) the 3D content should fit into. */
    freeArea(w: number, hgt: number) {
      const top = $('.top').getBoundingClientRect().bottom + 8;
      const bottom = $('.zoom').getBoundingClientRect().top - 8;
      if (w > 860) {
        const p = $('.panel').getBoundingClientRect();
        return { left: 16, right: p.left - 16, top, bottom };
      }
      const p = $('.panel').getBoundingClientRect();
      return { left: 8, right: w - 8, top, bottom: Math.min(bottom, p.top - 8, hgt) };
    },
  };
}
