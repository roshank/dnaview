/** Two copies per SNP, on the GRCh38 "+" strand: [copy 1, copy 2]. A "-" is a missing base. */
export type Genotype = Record<string, [string, string]>;

export interface PanelSnp {
  id: string;
  gene: string;
}

export interface Change {
  id: string;
  gene: string;
  from: [string, string];
  to: [string, string];
}

/** SNPs whose genotype differs between two profiles. */
export function diff(panel: PanelSnp[], from: Genotype, to: Genotype): Map<string, Change> {
  const out = new Map<string, Change>();
  for (const v of panel) {
    const a = from[v.id];
    const b = to[v.id];
    if (a[0] !== b[0] || a[1] !== b[1]) out.set(v.id, { id: v.id, gene: v.gene, from: a, to: b });
  }
  return out;
}

/** One option of a trait's picker, such as a blood type, with the example genotype that gives it. */
export interface PickOption {
  key: string;
  label: string;
  /** Swatch colour for the option button. */
  color: string;
  /** What this genotype means, shown under the picker. */
  outcome: string;
}

export interface PickerSpec {
  title: string;
  subtitle: string;
  options: PickOption[];
  profiles: Record<string, Genotype>;
  /** The option matching the GRCh38 reference genome, shown first. */
  start: string;
  /** SNP whose copy-1 letters the double helix shows. */
  helix: string;
  note: string;
}
