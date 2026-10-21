import { chromosome, genome, type TraitKey } from './data';
import { PAR1_END } from './levels/gene';

export interface LevelText {
  title: string;
  body: string;
  facts: [string, string][];
}

export interface Allele {
  base: string;
  label: string;
  note: string;
}

export interface Trait {
  key: TraitKey;
  name: string;
  tagline: string;
  crumbs: string[];
  levels: LevelText[];
  alleles?: Allele[];
  /** Short note shown beside the highlighted base(s) in 3D, keyed by the highlighted bases. */
  notes: Record<string, string>;
}

const mb = (n: number) => `${(n / 1e6).toFixed(0)} million`;
const kb = (n: number) => `${Math.round(n / 1000).toLocaleString('en-US')} thousand`;
const gene = (key: TraitKey, name: string) => genome.traits[key].genes.find((g) => g.name === name)!;

const GENOME_FACTS: [string, string][] = [
  ['Genome', '3.1 billion base pairs'],
  ['Chromosomes', '23 pairs (46)'],
  ['Stretched out', '≈ 2 m of DNA per cell'],
];

function eye(): Trait {
  const t = genome.traits.eye;
  const chr = chromosome('15');
  const oca2 = gene('eye', 'OCA2');
  const herc2 = gene('eye', 'HERC2');
  const v = t.variant!;
  return {
    key: 'eye',
    name: 'Eye color',
    tagline: 'Why eyes are brown, blue, or in between',
    crumbs: ['Genome', 'Chromosome 15', `15${t.bandAt}`, 'HERC2 → OCA2', v.id],
    levels: [
      {
        title: 'Eye color is written in a handful of places',
        body: `Eye color comes down to how much <b>melanin</b> pigment sits in the front of the iris. Several genes affect it, highlighted here, but the biggest single effect is on <b>chromosome 15</b>.`,
        facts: [...GENOME_FACTS, ['Other eye-color genes', t.related.map((r) => r.name).join(', ')]],
      },
      {
        title: 'Chromosome 15',
        body: `This chromosome holds ${mb(chr.length)} base pairs. Like every chromosome before cell division, it is two identical copies (sister chromatids) joined at the centromere. The stripes are the Giemsa-stain bands geneticists use as map coordinates. We're heading to band <b>15q${t.bandAt.slice(1)}</b>.`,
        facts: [
          ['Length', `${mb(chr.length)} bp`],
          ['Shape', 'acrocentric: a tiny p arm'],
          ['Target band', `15${t.bandAt}`],
        ],
      },
      {
        title: 'Two neighbouring genes: OCA2 and HERC2',
        body: `Zoomed in, the chromosome is a <b>chromatin fiber</b>: DNA wrapped around histone proteins (each bead is a nucleosome) and coiled. <b style="color:var(--amber)">OCA2</b> makes the P protein, which melanin-producing cells need. Its neighbour <b style="color:var(--cyan)">HERC2</b> doesn't make pigment, but it contains the switch for OCA2.`,
        facts: [
          ['OCA2', `${kb(oca2.end - oca2.start)} bases`],
          ['HERC2', `${kb(herc2.end - herc2.start)} bases, ${herc2.exons.length} exons`],
          ['Genes in view', String(t.genes.length)],
        ],
      },
      {
        title: 'A switch inside the wrong gene',
        body: `Glowing blocks are <b>exons</b>, the parts copied into protein. Deep inside HERC2 intron ${v.intron} sits an <b>enhancer</b>: DNA that loops over to turn up OCA2, about ${kb(v.pos - oca2.end)} bases away. One letter in that enhancer, <b>${v.id}</b>, sets how strong the switch is.`,
        facts: [
          ['Variant', v.id],
          ['Location', `HERC2 intron ${v.intron}`],
          ['Distance to OCA2 start', `${(v.pos - oca2.end).toLocaleString('en-US')} bp`],
        ],
      },
      {
        title: 'One base pair',
        body: `This is the double helix: two sugar-phosphate backbones with paired bases (A–T, C–G) between them. The highlighted pair is <b>${v.id}</b>. With <b>A</b> the enhancer stays active, giving more OCA2 and more melanin, which usually means brown eyes. With <b>G</b> the switch is weaker; people with two G copies most often have blue eyes. Other genes fine-tune green, hazel and grey.`,
        facts: [
          ['Position', `chr15:${(v.pos + 1).toLocaleString('en-US')}`],
          ['Reference (GRCh38)', v.ref],
          ['Common alleles', 'A (brown) · G (blue)'],
        ],
      },
    ],
    notes: { A: 'enhancer on → more melanin', G: 'weaker enhancer → blue eyes (if two copies)' },
  };
}

function lactose(): Trait {
  const t = genome.traits.lactose;
  const chr = chromosome('2');
  const lct = gene('lactose', 'LCT');
  const v = t.variant!;
  const upstream = v.pos - lct.end;
  return {
    key: 'lactose',
    name: 'Lactose tolerance',
    tagline: 'Digesting milk as an adult',
    crumbs: ['Genome', 'Chromosome 2', `2${t.bandAt}`, 'LCT · MCM6', v.id],
    levels: [
      {
        title: 'Can adults digest milk?',
        body: `Most mammals, and most people, stop making lactase, the enzyme that breaks down milk sugar, after childhood. Keeping it into adulthood is called <b>lactase persistence</b>, and in many people it traces to one spot on <b>chromosome 2</b>.`,
        facts: GENOME_FACTS,
      },
      {
        title: 'Chromosome 2',
        body: `Chromosome 2 is the second-largest at ${mb(chr.length)} base pairs. It formed when two ancestral ape chromosomes fused, which is why humans have 23 pairs while chimpanzees have 24. We're heading to band <b>2${t.bandAt}</b>.`,
        facts: [
          ['Length', `${mb(chr.length)} bp`],
          ['Origin', 'fusion of two ape chromosomes'],
          ['Target band', `2${t.bandAt}`],
        ],
      },
      {
        title: 'LCT, the lactase gene',
        body: `This stretch of chromatin fiber carries <b style="color:var(--amber)">LCT</b>, which encodes lactase, the enzyme made in the lining of the small intestine. Right next to it is <b style="color:var(--cyan)">MCM6</b>, a gene for DNA copying that has nothing to do with milk, except that it holds LCT's switch.`,
        facts: [
          ['LCT', `${kb(lct.end - lct.start)} bases, ${lct.exons.length} exons`],
          ['Enzyme', 'lactase-phlorizin hydrolase'],
          ['Genes in view', String(t.genes.length)],
        ],
      },
      {
        title: 'The switch is in the neighbour',
        body: `About ${kb(upstream)} bases upstream of where LCT starts, inside <b>intron ${v.intron} of MCM6</b>, sits an enhancer that keeps LCT running in intestinal cells. The variant <b>${v.id}</b> is famous enough to have its own nickname: <b>−13910 C&gt;T</b>, after its distance from LCT.`,
        facts: [
          ['Variant', `${v.id} (−13910)`],
          ['Location', `MCM6 intron ${v.intron}`],
          ['Distance to LCT start', `${upstream.toLocaleString('en-US')} bp`],
        ],
      },
      {
        title: 'One base pair',
        body: `Shown on the chromosome's “+” strand, the ancestral letter is <b>G</b>, which is the <b>C</b> of −13910 C&gt;T when read on LCT's strand. The <b>A</b> version (T on LCT's strand) keeps lactase on into adulthood. It is common in people of northern European ancestry. Other variants nearby arose independently in East African and Middle Eastern populations, a textbook case of convergent evolution.`,
        facts: [
          ['Position', `chr2:${(v.pos + 1).toLocaleString('en-US')}`],
          ['Reference (GRCh38)', `${v.ref} (ancestral)`],
          ['Persistence allele', 'A on + strand (T on LCT strand)'],
        ],
      },
    ],
    alleles: [
      { base: 'G', label: 'G', note: 'lactase turns off' },
      { base: 'A', label: 'A', note: 'lactase stays on' },
    ],
    notes: { G: 'ancestral → lactase fades after childhood', A: 'lactase persists into adulthood' },
  };
}

function sex(): Trait {
  const t = genome.traits.sex;
  const y = chromosome('Y');
  const x = chromosome('X');
  const sry = gene('sex', 'SRY');
  const aa = (sry.cdsEnd - sry.cdsStart) / 3 - 1;
  return {
    key: 'sex',
    name: 'Biological sex',
    tagline: 'XX, XY and the SRY switch',
    crumbs: ['Genome', 'Chromosome Y', `Y${t.bandAt}`, 'SRY', 'Start codon'],
    levels: [
      {
        title: 'The 23rd pair',
        body: `22 of our chromosome pairs match regardless of sex. The 23rd is the sex chromosomes: usually <b>XX</b> or <b>XY</b>. The X is large and gene-rich. The Y is small, and its most important job comes down to a single gene. Genes determine <b>biological sex</b>, not gender identity, and natural variations exist (XXY, X, XX with SRY, and more).`,
        facts: [...GENOME_FACTS, ['X vs Y', `${mb(x.length)} vs ${mb(y.length)} bp`]],
      },
      {
        title: 'Chromosome Y',
        body: `At ${mb(y.length)} base pairs, Y is one of the smallest chromosomes and carries only a few dozen protein-coding genes. Its tips are <b>pseudoautosomal regions</b> (PARs) that match the X, so X and Y can pair up when sperm are made. Much of the long arm is repetitive DNA that is hard even to sequence. We're heading to <b>Y${t.bandAt}</b>, on the short arm.`,
        facts: [
          ['Length', `${mb(y.length)} bp`],
          ['X, for comparison', `${mb(x.length)} bp`],
          ['Target band', `Y${t.bandAt}`],
        ],
      },
      {
        title: 'Right at the edge of the shared zone',
        body: `This fiber spans the end of <b>PAR1</b>, the region X and Y share. Genes above it (like CD99) exist on both. Just past the boundary, on Y-only DNA, sits <b style="color:var(--amber)">SRY</b>, the sex-determining region Y gene.`,
        facts: [
          ['PAR1 ends at', `chrY:${PAR1_END.toLocaleString('en-US')}`],
          ['SRY starts', `${(sry.start - PAR1_END).toLocaleString('en-US')} bp later`],
          ['Genes in view', String(t.genes.length)],
        ],
      },
      {
        title: 'SRY: one small gene, one big decision',
        body: `SRY is a single exon of just ${(sry.end - sry.start).toLocaleString('en-US')} bases, and it reads upward here because it sits on the minus strand. Around week 7 of development, its protein switches the early gonads onto the testis pathway. Without SRY, they develop as ovaries. Because it sits so close to PAR1, SRY occasionally crosses onto an X during sperm formation.`,
        facts: [
          ['Gene size', `${(sry.end - sry.start).toLocaleString('en-US')} bp, 1 exon`],
          ['Protein', `${aa} amino acids`],
          ['Key part', 'HMG box: binds and bends DNA'],
        ],
      },
      {
        title: 'Where SRY begins',
        body: `These three glowing base pairs are SRY's <b>start codon</b>, where the protein-making machinery begins reading. SRY is on the minus strand, so on the “+” strand shown here it reads <b>CAT</b>, which is <b>ATG</b> on SRY's own strand. Changes in SRY can cause XY female development (Swyer syndrome), and an SRY moved onto an X can lead to XX male development.`,
        facts: [
          ['Start codon', `chrY:${(t.startCodon![0] + 1).toLocaleString('en-US')}–${t.startCodon![1].toLocaleString('en-US')}`],
          ['Reads as', 'ATG (Met) on SRY strand'],
          ['Strand', 'minus (−)'],
        ],
      },
    ],
    notes: { CAT: 'reads ATG on SRY’s strand: “start”' },
  };
}

export const TRAITS: Record<TraitKey, Trait> = { eye: eye(), lactose: lactose(), sex: sex() };
