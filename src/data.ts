import raw from './data/genome.json';

/** [start, end, name, giemsaStain], 0-based half-open GRCh38 coordinates. */
export type Band = [number, number, string, string];

export interface Chromosome {
  name: string;
  length: number;
  centromere: [number, number];
  bands: Band[];
}

export interface Gene {
  name: string;
  strand: '+' | '-';
  start: number;
  end: number;
  cdsStart: number;
  cdsEnd: number;
  coding: boolean;
  exons: [number, number][];
}

export interface Variant {
  id: string;
  /** First highlighted base; `len` bases are highlighted. For an insertion, the gap slot. */
  pos: number;
  len: number;
  gene: string;
  /** Reference letters at the highlighted bases ("-" where GRCh38 has no base). */
  ref: string;
  alts: string[];
  intron: number | null;
  /** e.g. "exon 6", "intron 86", "3′ UTR". */
  location: string;
}

export interface TraitData {
  chrom: string;
  region: [number, number];
  geneWindow: [number, number];
  focusGenes: string[];
  genes: Gene[];
  related: { name: string; chrom: string; start: number; end: number }[];
  variant?: Variant;
  /** Extra SNPs that act together on the trait (the eye-colour panel). */
  panel?: { id: string; gene: string; chrom: string; pos: number; ref: string; alts: string[] }[];
  startCodon?: [number, number];
  /** Genome-wide GWAS Catalog hits for the trait, as distinct-SNP counts per bin. */
  gwas?: { trait: string; binSize: number; snps: number; bins: Record<string, [number, number][]> };
  sequence: { start: number; bases: string };
  bandAt: string;
}

export interface GenomeData {
  assembly: string;
  source: string;
  chromosomes: Chromosome[];
  chrM: number;
  traits: Record<TraitKey, TraitData>;
}

export type TraitKey = 'blood' | 'sickle' | 'sex' | 'lactose' | 'eye' | 'brca' | 'height';

export const genome = raw as unknown as GenomeData;

export function chromosome(name: string): Chromosome {
  return genome.chromosomes.find((c) => c.name === name)!;
}

export function bandAt(chr: Chromosome, pos: number): Band {
  return chr.bands.find((b) => b[0] <= pos && pos < b[1]) ?? chr.bands[chr.bands.length - 1];
}

/** Base pair index at the center of the base-pair view; the view spans sequence.start .. +64. */
export function sequenceCenter(t: TraitData): number {
  return t.sequence.start + t.sequence.bases.length / 2;
}

export const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C', N: 'N', '-': '-' };

/** Sequence indices highlighted in the base-pair view: the variant's bases, or SRY's start codon. */
export function highlightIndices(t: TraitData): number[] {
  const [start, len] = t.variant ? [t.variant.pos, t.variant.len] : [t.startCodon![0], 3];
  return Array.from({ length: len }, (_, i) => start - t.sequence.start + i);
}
