import { COMPLEMENT, genome, type TraitKey } from './data';
import { PROFILES, type Change, type EyeColor } from './eyeColor';
import { createEyeStudio } from './eyePanel';
import { fmtShort } from './levels/common';
import { TRAITS, type Trait } from './traits';

interface Handlers {
  onTrait(k: TraitKey): void;
  onLevel(i: number): void;
  onAllele(base: string): void;
  onEyeColor(c: EyeColor): void;
}

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

  for (const t of Object.values(TRAITS)) {
    const b = document.createElement('button');
    b.dataset.key = t.key;
    b.innerHTML = `<b>${t.name}</b><span>${t.tagline}</span>`;
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
    const hl = data.variant
      ? [data.variant.pos - data.sequence.start]
      : [0, 1, 2].map((i) => data.startCodon![0] - data.sequence.start + i);
    const shownAllele = trait.key === 'eye' ? eyeAllele : allele;
    if (shownAllele) bases[hl[0]] = shownAllele;
    const from = 14;
    const to = 50;
    const row = (comp: boolean) =>
      bases
        .slice(from, to)
        .map((b, j) => {
          const ch = comp ? COMPLEMENT[b] : b;
          return `<i class="b-${ch}${hl.includes(j + from) ? ' hl' : ''}">${ch}</i>`;
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
