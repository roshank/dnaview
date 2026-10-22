import { COMPLEMENT, genome, highlightIndices, type TraitKey } from './data';
import { PROFILES, type Change, type EyeColor } from './eyeColor';
import { createEyeStudio } from './eyePanel';
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

/** A five-step scale with the first `n` steps filled. */
const scaleDots = (n: number) => `<span class="dots">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

const LEVEL_KINDS = ['Genome', 'Chromosome', 'Region', 'Gene', 'DNA letters'];

/** A span of DNA in everyday words: "3.1 billion letters", "68 letters". */
function letters(bp: number): string {
  if (bp >= 1e9) return `${(bp / 1e9).toFixed(1)} billion letters`;
  if (bp >= 1e6) return `${Math.round(bp / 1e6)} million letters`;
  if (bp >= 1e3) return `${Math.round(bp / 1e3).toLocaleString('en-US')} thousand letters`;
  return `${Math.round(bp)} letters`;
}

export function createUI(h: Handlers) {
  const root = document.createElement('div');
  root.className = 'ui';
  root.innerHTML = `
    <header class="top">
      <div class="brand">DNAView</div>
      <nav class="traits" aria-label="Choose a trait"></nav>
    </header>
    <aside class="panel" aria-live="polite">
      <div class="panel-inner">
        <div class="eyebrow"></div>
        <h1></h1>
        <p class="lead"></p>
        <div class="influence"></div>
        <div class="alleles" hidden><span class="label-sm">Try each letter</span><div class="opts"></div></div>
        <details class="science">
          <summary>The science</summary>
          <p class="body"></p>
          <dl class="facts"></dl>
          <div class="seq" hidden></div>
        </details>
        <button class="next"></button>
      </div>
    </aside>
    <footer class="zoom">
      <ol class="crumbs"><div class="track"><div class="fill"></div></div></ol>
      <div class="meta"><span class="scale"></span><span class="hint">Scroll or pinch to zoom · drag to turn</span></div>
    </footer>
    <div class="disclaimer">Real human genome data (GRCh38) · for learning, not medical advice</div>`;
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
  let pickedAllele = '';
  const studio = createEyeStudio(h.onEyeColor);
  const picker = createPickerPanel(h.onPick);
  $('.influence').after(studio.el, picker.el);

  for (const t of Object.values(TRAITS)) {
    const b = document.createElement('button');
    b.dataset.key = t.key;
    b.title = t.tagline;
    b.textContent = t.name;
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
    // Name each step in plain words; IDs and band codes stay in "The science".
    const names = [LEVEL_KINDS[0], t.crumbs[1], LEVEL_KINDS[2], t.crumbs[3], LEVEL_KINDS[4]];
    names.forEach((n, i) => (crumbButtons[i].textContent = n));
    allele = t.alleles?.[0].base ?? '';
    render();
  }

  function sequenceStrip() {
    const data = genome.traits[trait.key];
    const bases = data.sequence.bases.split('');
    const hl = highlightIndices(data);
    const shownAllele = trait.key === 'eye' || trait.picker ? pickedAllele : allele;
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
    return `<div class="row">${row(false)}</div><div class="row">${row(true)}</div><small>Both strands, chr${data.chrom}:${pos}</small>`;
  }

  function render() {
    const text = trait.levels[level];
    panel.classList.remove('in');
    void panel.offsetWidth; // restart the fade-in animation
    panel.classList.add('in');
    $('.eyebrow').textContent = `${trait.name} · ${level + 1} of 5`;
    $('h1').textContent = text.title;
    $('.lead').textContent = text.lead;
    const inf = trait.influence;
    $('.influence').innerHTML = `
      <div class="row"><span>How much DNA decides it</span>${scaleDots(inf.decides)}<b>${DECIDES[inf.decides]}</b></div>
      <div class="row"><span>Power of a single letter</span>${scaleDots(inf.letter)}<b>${LETTER[inf.letter]}</b></div>
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
    const next = $('.next');
    next.hidden = level === 4;
    next.textContent = `Zoom in: ${LEVEL_KINDS[level + 1] ?? ''} →`;
    next.onclick = () => h.onLevel(level + 1);
    crumbButtons.forEach((b, i) => b.classList.toggle('on', i === level));
  }

  return {
    setTrait,
    markTrait,
    setPick(spec: PickerSpec, panel: PanelSnp[], current: string, previous: string | null, changes: Map<string, Change>) {
      picker.set(spec, panel, current, previous, changes);
      pickedAllele = spec.profiles[current][spec.helix][0];
      if (level === 4) $('.seq').innerHTML = sequenceStrip();
    },
    setEye(current: EyeColor, previous: EyeColor | null, changes: Map<string, Change>) {
      studio.set(current, previous, changes);
      pickedAllele = PROFILES[current].rs12913832[0];
      if (trait.key === 'eye' && level === 4) $('.seq').innerHTML = sequenceStrip();
    },
    setLevel(i: number) {
      level = i;
      render();
    },
    setProgress(t: number, span: number) {
      fill.style.width = `${(t / 4) * 100}%`;
      scale.textContent = `In view: about ${letters(span)}`;
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
