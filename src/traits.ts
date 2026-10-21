import { chromosome, genome, type TraitKey } from './data';
import { PAR1_END } from './levels/gene';
import type { PickerSpec } from './picker';

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
  influence: Influence;
  /** Options that swap in example genotypes and light up what changes (eye colour has its own). */
  picker?: PickerSpec;
}

/**
 * How tightly DNA is linked to the trait, on two 1-5 scales: how much DNA overall decides the
 * outcome, and how much a single changed letter can move it.
 */
export interface Influence {
  decides: number;
  letter: number;
  summary: string;
}

export const DECIDES = ['', 'barely', 'a little', 'partly', 'mostly', 'fully'];
export const LETTER = ['', 'tiny', 'small', 'moderate', 'large', 'decisive'];

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
    influence: {
      decides: 5,
      letter: 4,
      summary: 'Almost entirely genetic. One HERC2 letter does most of the blue-versus-brown work; other genes fine-tune green and hazel.',
    },
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
    influence: {
      decides: 4,
      letter: 4,
      summary: 'Mostly one switch near LCT decides whether lactase stays on. Symptoms also depend on gut bacteria and how much milk you have.',
    },
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
    influence: {
      decides: 5,
      letter: 5,
      summary: 'XX or XY, and above all the SRY gene, sets the developmental path. Rare variations show it’s a switch, not the whole story.',
    },
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


function blood(): Trait {
  const t = genome.traits.blood;
  const chr = chromosome('9');
  const abo = gene('blood', 'ABO');
  const v = t.variant!;
  const A = ['C', 'G', 'C', 'G', 'C'];
  const B = ['C', 'C', 'T', 'T', 'G'];
  const O = ['-', 'G', 'C', 'G', 'C'];
  const ids = ['rs8176719', 'rs7853989', 'rs8176743', 'rs8176746', 'rs8176747'];
  const profile = (one: string[], two: string[]) =>
    Object.fromEntries(ids.map((id, i) => [id, [one[i], two[i]] as [string, string]]));
  return {
    key: 'blood',
    name: 'Blood type',
    tagline: 'A, B, AB or O',
    crumbs: ['Genome', 'Chromosome 9', `9${t.bandAt}`, 'ABO', v.id],
    influence: {
      decides: 5,
      letter: 5,
      summary: 'Fully genetic. Your two copies of one gene decide your type, and a single missing letter separates O from A.',
    },
    levels: [
      {
        title: 'One gene decides your blood type',
        body: `Your ABO blood type is set by a single gene, <b>ABO</b>, on <b>chromosome 9</b>. Your two copies, one from each parent, fully decide whether you are A, B, AB or O. (The + or − is a different gene, RHD, on chromosome 1.)`,
        facts: [...GENOME_FACTS, ['Genes involved', '1 (ABO)']],
      },
      {
        title: 'Chromosome 9',
        body: `Chromosome 9 holds ${mb(chr.length)} base pairs. ABO sits near the tip of its long arm, in band <b>9${t.bandAt}</b>.`,
        facts: [
          ['Length', `${mb(chr.length)} bp`],
          ['Target band', `9${t.bandAt}`],
          ['Other genes here', String(t.genes.length - 1)],
        ],
      },
      {
        title: 'ABO makes a sugar-adding enzyme',
        body: `<b style="color:var(--amber)">ABO</b> builds an enzyme that adds one sugar to the surface of red blood cells. The <b>A</b> version adds one sugar (N-acetylgalactosamine), the <b>B</b> version a different one (galactose). <b>O</b> makes no working enzyme, so neither sugar is added. Your immune system reacts to whichever sugars you lack, which is why transfusions must match.`,
        facts: [
          ['ABO gene', `${kb(abo.end - abo.start)} bases, ${abo.exons.length} exons`],
          ['A adds', 'N-acetylgalactosamine'],
          ['B adds', 'galactose'],
        ],
      },
      {
        title: 'Every difference sits in the last two exons',
        body: `The letter that makes O sits in <b>exon 6</b>. The four letters that turn the A enzyme into the B enzyme are all in <b>exon 7</b>. Fun fact: the reference genome itself carries the O version, so RefSeq even labels ABO here as non-coding.`,
        facts: [
          ['O letter', `${v.gene} ${v.location}`],
          ['A vs B', '4 letters in exon 7'],
          ['Reference genome', 'type O'],
        ],
      },
      {
        title: 'One missing letter makes type O',
        body: `The glowing gap is where the A and B versions have one more letter (a G on ABO's own strand, C on the "+" strand shown). Without it, the reading frame shifts and the enzyme stops after <b>117</b> of its <b>354</b> amino acids, so no sugar is added: type <b>O</b>. O is recessive: one working copy is enough for A or B.`,
        facts: [
          ['Position', `chr9:${(v.pos).toLocaleString('en-US')}–${(v.pos + 1).toLocaleString('en-US')}`],
          ['Reference (GRCh38)', 'missing (O)'],
          ['Effect', 'protein stops at 117 of 354'],
        ],
      },
    ],
    notes: { '-': 'missing → enzyme cut short (type O)', C: 'present → working enzyme (A or B)' },
    picker: {
      title: 'Pick a blood type',
      subtitle: 'Glowing DNA shows what would change',
      options: [
        { key: 'O', label: 'O', color: '#cbd5e1', outcome: 'Two broken copies: no enzyme, so neither A nor B sugar.' },
        { key: 'A', label: 'A', color: '#f87171', outcome: 'One working A copy is enough; the other copy here is O.' },
        { key: 'B', label: 'B', color: '#60a5fa', outcome: 'One working B copy, with its four B letters; the other copy is O.' },
        { key: 'AB', label: 'AB', color: '#c084fc', outcome: 'One A copy and one B copy: both enzymes work, so both sugars appear.' },
      ],
      profiles: { O: profile(O, O), A: profile(A, O), B: profile(B, O), AB: profile(A, B) },
      start: 'O',
      helix: 'rs8176719',
      note: 'Letters are shown on the genome’s “+” strand; ABO itself reads the opposite strand. A “-” is a missing letter. These are the most common A, B and O versions; rarer ones exist.',
    },
  };
}

function sickle(): Trait {
  const t = genome.traits.sickle;
  const chr = chromosome('11');
  const hbb = gene('sickle', 'HBB');
  const v = t.variant!;
  return {
    key: 'sickle',
    name: 'Sickle cell',
    tagline: 'One letter in hemoglobin',
    crumbs: ['Genome', 'Chromosome 11', `11${t.bandAt}`, 'HBB', v.id],
    influence: {
      decides: 5,
      letter: 5,
      summary: 'One letter, in two copies, causes the disease. How severe it is still varies with other genes and with care.',
    },
    levels: [
      {
        title: 'One letter, a whole-body disease',
        body: `Hemoglobin carries oxygen inside red blood cells. A single letter in its <b>beta-globin</b> gene, <b>HBB</b> on <b>chromosome 11</b>, is behind sickle cell disease.`,
        facts: [...GENOME_FACTS, ['Letters involved', '1']],
      },
      {
        title: 'Chromosome 11',
        body: `Chromosome 11 holds ${mb(chr.length)} base pairs. HBB sits near the tip of the short arm, in band <b>11${t.bandAt}</b>.`,
        facts: [
          ['Length', `${mb(chr.length)} bp`],
          ['Target band', `11${t.bandAt}`],
          ['Genes in this region', String(t.genes.length)],
        ],
      },
      {
        title: 'The globin family',
        body: `HBB sits in the <b>beta-globin cluster</b>: embryonic, fetal (<b>HBG1</b>, <b>HBG2</b>) and adult (<b>HBD</b>, <b style="color:var(--amber)">HBB</b>) globin genes, lined up in roughly the order they switch on during development. Around them are dozens of smell-receptor (OR) genes.`,
        facts: [
          ['HBB', `${hbb.end - hbb.start} bases, ${hbb.exons.length} exons`],
          ['Fetal globins', 'HBG1, HBG2'],
          ['Genes in view', String(t.genes.length)],
        ],
      },
      {
        title: 'A small gene with a big job',
        body: `HBB is only about ${(hbb.end - hbb.start).toLocaleString('en-US')} bases long, in three exons. The variant <b>${v.id}</b> sits in <b>${v.location}</b>, in the codon for the sixth amino acid of beta-globin.`,
        facts: [
          ['Variant', v.id],
          ['Location', `HBB ${v.location}`],
          ['Protein', '147 amino acids'],
        ],
      },
      {
        title: 'GAG → GTG',
        body: `On HBB's own strand the sixth codon changes from <b>GAG</b> (glutamic acid) to <b>GTG</b> (valine); on the "+" strand shown here that is <b>T → A</b>. The new valine is sticky: when oxygen is low, hemoglobin clumps into fibers that bend red cells into sickles. <b>One copy</b> (sickle cell trait) is usually harmless and partly protects against severe malaria, which is why the variant is common where malaria is. <b>Two copies</b> cause sickle cell disease.`,
        facts: [
          ['Position', `chr11:${(v.pos + 1).toLocaleString('en-US')}`],
          ['Codon', 'GAG → GTG (Glu → Val)'],
          ['Reference (GRCh38)', `${v.ref} (typical)`],
        ],
      },
    ],
    notes: { T: 'typical: GAG → glutamic acid', A: 'sickle: GTG → valine' },
    picker: {
      title: 'Pick a hemoglobin type',
      subtitle: 'Glowing DNA shows what would change',
      options: [
        { key: 'typical', label: 'Typical', color: '#ef4444', outcome: 'Two typical copies: normal hemoglobin (HbAA).' },
        { key: 'trait', label: 'Trait', color: '#f59e0b', outcome: 'Sickle cell trait (HbAS): one copy. Usually no symptoms, and some protection from severe malaria.' },
        { key: 'disease', label: 'Disease', color: '#a855f7', outcome: 'Sickle cell disease (HbSS): two copies. Red cells can sickle, block blood flow and break down early.' },
      ],
      profiles: {
        typical: { rs334: ['T', 'T'] },
        trait: { rs334: ['A', 'T'] },
        disease: { rs334: ['A', 'A'] },
      },
      start: 'typical',
      helix: 'rs334',
      note: 'Letters are shown on the genome’s “+” strand; HBB reads the opposite strand, where this is A → T.',
    },
  };
}

function brca(): Trait {
  const t = genome.traits.brca;
  const chr = chromosome('17');
  const b1 = gene('brca', 'BRCA1');
  const v = t.variant!;
  return {
    key: 'brca',
    name: 'BRCA1',
    tagline: 'Cancer risk, not destiny',
    crumbs: ['Genome', 'Chromosome 17', `17${t.bandAt}`, 'BRCA1', '185delAG'],
    influence: {
      decides: 2,
      letter: 4,
      summary: 'A harmful BRCA1 variant raises cancer risk a lot, but most breast cancers aren’t inherited, and many carriers never get cancer.',
    },
    levels: [
      {
        title: 'A risk gene, not a fate',
        body: `<b>BRCA1</b>, on <b>chromosome 17</b>, helps repair broken DNA. Harmful variants in it sharply raise the risk of breast and ovarian cancer. Even so, only about <b>5–10%</b> of breast cancers are linked to inherited variants like these. <b style="color:var(--amber)">BRCA2</b>, on chromosome 13, plays a similar role.`,
        facts: [...GENOME_FACTS, ['Main genes', 'BRCA1, BRCA2']],
      },
      {
        title: 'Chromosome 17',
        body: `Chromosome 17 holds ${mb(chr.length)} base pairs and is one of the most gene-dense chromosomes. BRCA1 sits on the long arm, in band <b>17${t.bandAt}</b>.`,
        facts: [
          ['Length', `${mb(chr.length)} bp`],
          ['Target band', `17${t.bandAt}`],
          ['Genes in this region', String(t.genes.length)],
        ],
      },
      {
        title: 'A DNA repair gene',
        body: `<b style="color:var(--amber)">BRCA1</b>'s protein helps fix the most dangerous kind of DNA damage, a break through both strands, by copying the matching sequence from the cell's other copy. Cells that can't do this pile up errors that can lead to cancer.`,
        facts: [
          ['BRCA1', `${kb(b1.end - b1.start)} bases, ${b1.exons.length} exons`],
          ['Protein', '1,863 amino acids'],
          ['Genes in view', String(t.genes.length)],
        ],
      },
      {
        title: 'Right at the start of the gene',
        body: `The variant <b>185delAG</b> (c.68_69del) sits in <b>${v.location}</b>, just after the start of the protein-coding sequence. A change this early wrecks almost the entire protein.`,
        facts: [
          ['Variant', `185delAG (${v.id})`],
          ['Location', `BRCA1 ${v.location}`],
          ['Kind', '2-letter deletion'],
        ],
      },
      {
        title: 'Two missing letters',
        body: `Deleting <b>AG</b> (shown here as CT on the "+" strand) shifts the reading frame, so the protein stops after <b>38</b> of its <b>1,863</b> amino acids. Carriers still have one working copy; cancer usually begins when a cell loses that one too. Women who carry a harmful BRCA1 variant have about a <b>72%</b> chance of breast cancer and <b>44%</b> of ovarian cancer by age 80, versus about 13% for breast cancer overall. About 1% of Ashkenazi Jewish people carry this exact variant.`,
        facts: [
          ['Position', `chr17:${(v.pos + 1).toLocaleString('en-US')}–${(v.pos + 2).toLocaleString('en-US')}`],
          ['Protein', 'stops at 38 of 1,863'],
          ['Breast cancer by 80', '≈ 72% vs ≈ 13%'],
        ],
      },
    ],
    notes: { CT: 'typical: both letters present', '--': 'deleted → protein cut short' },
    picker: {
      title: 'Pick a BRCA1 status',
      subtitle: 'Glowing DNA shows what would change',
      options: [
        { key: 'typical', label: 'No variant', color: '#34d399', outcome: 'Typical BRCA1: average risk. For women, about 1 in 8 (13%) lifetime risk of breast cancer.' },
        {
          key: 'carrier',
          label: 'Carrier',
          color: '#fb7185',
          outcome: 'One copy carries 185delAG: for women, about 72% risk of breast cancer and 44% of ovarian cancer by age 80. Screening and preventive options lower this a lot.',
        },
      ],
      profiles: {
        typical: { rs80357914: ['CT', 'CT'] },
        carrier: { rs80357914: ['--', 'CT'] },
      },
      start: 'typical',
      helix: 'rs80357914',
      note: 'Educational only. Risks are averages for women from Kuchenbaecker et al. 2017 (JAMA); a genetic counselor can interpret real results.',
    },
  };
}

function height(): Trait {
  const t = genome.traits.height;
  const chr = chromosome('12');
  const hmga2 = gene('height', 'HMGA2');
  const v = t.variant!;
  const hits = t.gwas!.snps.toLocaleString('en-US');
  const chrHits = (t.gwas!.bins['12'] ?? []).reduce((s, [, n]) => s + n, 0).toLocaleString('en-US');
  return {
    key: 'height',
    name: 'Height',
    tagline: 'Thousands of tiny pushes',
    crumbs: ['Genome', 'Chromosome 12', `12${t.bandAt}`, 'HMGA2', v.id],
    influence: {
      decides: 4,
      letter: 1,
      summary: 'Mostly genetic (about 80% heritable), but spread across thousands of variants that each move height by millimeters. Nutrition and health matter too.',
    },
    levels: [
      {
        title: 'Height is written everywhere',
        body: `Every glowing band marks DNA where studies found variants linked to height: <b>${hits}</b> distinct variants in the GWAS Catalog, spread over every chromosome. Height is about 80% heritable, yet no single gene decides it.`,
        facts: [...GENOME_FACTS, ['Height variants (GWAS Catalog)', hits]],
      },
      {
        title: 'Chromosome 12',
        body: `Chromosome 12 alone has ${chrHits} height-linked variants. We're heading to band <b>12${t.bandAt}</b> and <b>HMGA2</b>, one of the first height genes ever found (2007).`,
        facts: [
          ['Length', `${mb(chr.length)} bp`],
          ['Height variants here', chrHits],
          ['Target band', `12${t.bandAt}`],
        ],
      },
      {
        title: 'HMGA2, a growth regulator',
        body: `<b style="color:var(--amber)">HMGA2</b> helps control how cells grow and divide during development. Rare mutations that wreck it can change stature a lot, but the common variant we're zooming into has only a small effect.`,
        facts: [
          ['HMGA2', `${kb(hmga2.end - hmga2.start)} bases, ${hmga2.exons.length} exons`],
          ['Role', 'growth during development'],
          ['Genes in view', String(t.genes.length)],
        ],
      },
      {
        title: 'Outside the protein code',
        body: `The variant <b>${v.id}</b> sits in HMGA2's <b>${v.location}</b>, a tail of the gene's message that helps control how much protein is made, not the protein's shape. Most height variants are like this: small tweaks to how much, not what.`,
        facts: [
          ['Variant', v.id],
          ['Location', `HMGA2 ${v.location}`],
          ['Found in', 'Weedon et al. 2007'],
        ],
      },
      {
        title: 'One letter ≈ 4 millimeters',
        body: `Each <b>C</b> copy here adds about <b>0.4 cm</b> on average compared with T. That is one of the largest effects of any common height variant. To explain most of the genetic part of height, a 2022 study of 5.4 million people needed <b>12,111</b> independent variants. The same letter is also linked to birth weight and head size.`,
        facts: [
          ['Position', `chr12:${(v.pos + 1).toLocaleString('en-US')}`],
          ['Effect', '≈ +0.4 cm per C'],
          ['Variants for height', '12,111 (Yengo 2022)'],
        ],
      },
    ],
    alleles: [
      { base: 'C', label: 'C', note: '≈ +0.4 cm per copy' },
      { base: 'T', label: 'T', note: '≈ 0.4 cm shorter' },
    ],
    notes: { C: 'about +0.4 cm per copy', T: 'about 0.4 cm shorter per copy' },
  };
}

export const TRAITS: Record<TraitKey, Trait> = {
  blood: blood(),
  sickle: sickle(),
  sex: sex(),
  lactose: lactose(),
  eye: eye(),
  brca: brca(),
  height: height(),
};
