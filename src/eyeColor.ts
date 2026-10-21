import { genome } from './data';
import { diff as diffPanel, type Change, type Genotype } from './picker';

export type { Change, Genotype };

/**
 * Eye colour from the six IrisPlex SNPs.
 *
 * Per-allele effects are the published regression coefficients on a 7-point blue (1) to brown (7)
 * scale from Eriksson et al. 2010, "Web-based, participant-driven studies yield novel genetic
 * associations for common traits", PLoS Genetics 6(6): e1000993, Table 4 (~4,400 people). Each
 * coefficient is per copy of `counted`; positive pushes toward brown. All alleles are given on the
 * GRCh38 "+" strand, which matches the paper's orientation for these six SNPs.
 *
 * The genotypes per colour are illustrative examples, not the only way to get each colour. These six
 * SNPs separate blue from brown well but explain little of green and hazel.
 */
export const EFFECTS: Record<string, { counted: string; beta: number }> = {
  rs12913832: { counted: 'A', beta: 2.491 },
  rs1800407: { counted: 'T', beta: 0.823 },
  rs12896399: { counted: 'T', beta: -0.343 },
  rs16891982: { counted: 'C', beta: 0.84 },
  rs1393350: { counted: 'A', beta: -0.278 },
  rs12203592: { counted: 'T', beta: -0.424 },
};

export type EyeColor = 'blue' | 'green' | 'hazel' | 'brown';

export const EYE_COLORS: EyeColor[] = ['blue', 'green', 'hazel', 'brown'];

export const PROFILES: Record<EyeColor, Genotype> = {
  // Identical to the GRCh38 reference genome at all six SNPs.
  brown: {
    rs12913832: ['A', 'A'],
    rs1800407: ['C', 'C'],
    rs12896399: ['G', 'G'],
    rs16891982: ['C', 'C'],
    rs1393350: ['G', 'G'],
    rs12203592: ['C', 'C'],
  },
  hazel: {
    rs12913832: ['G', 'A'],
    rs1800407: ['T', 'C'],
    rs12896399: ['G', 'G'],
    rs16891982: ['G', 'G'],
    rs1393350: ['G', 'G'],
    rs12203592: ['C', 'C'],
  },
  green: {
    rs12913832: ['G', 'G'],
    rs1800407: ['T', 'C'],
    rs12896399: ['G', 'G'],
    rs16891982: ['G', 'G'],
    rs1393350: ['G', 'G'],
    rs12203592: ['C', 'C'],
  },
  blue: {
    rs12913832: ['G', 'G'],
    rs1800407: ['C', 'C'],
    rs12896399: ['T', 'T'],
    rs16891982: ['G', 'G'],
    rs1393350: ['A', 'G'],
    rs12203592: ['T', 'C'],
  },
};

export const LABELS: Record<EyeColor, string> = { blue: 'Blue', green: 'Green', hazel: 'Hazel', brown: 'Brown' };

/** Iris palette: limbal ring, outer iris, mid iris, and the collarette around the pupil. */
export const IRIS: Record<EyeColor, [string, string, string, string]> = {
  blue: ['#1d2f4a', '#4a7fb5', '#86b4dd', '#c4d6e4'],
  green: ['#22301d', '#4f7a45', '#83ab6c', '#c9a650'],
  hazel: ['#2a2414', '#5f6f37', '#99803d', '#7a4a1e'],
  brown: ['#160e08', '#4a2c16', '#6e4325', '#3a2010'],
};

export const PANEL = genome.traits.eye.panel ?? [];

export function score(g: Genotype): number {
  let s = 0;
  for (const [id, copies] of Object.entries(g)) {
    const e = EFFECTS[id];
    for (const a of copies) if (a === e.counted) s += e.beta;
  }
  return s;
}

/** Lowest and highest possible scores, for placing a score on a lighter-to-darker bar. */
export const SCORE_RANGE: [number, number] = Object.values(EFFECTS).reduce(
  ([lo, hi], { beta }) => [lo + Math.min(0, 2 * beta), hi + Math.max(0, 2 * beta)],
  [0, 0],
);

export function diff(from: Genotype, to: Genotype): Map<string, Change> {
  return diffPanel(PANEL, from, to);
}
