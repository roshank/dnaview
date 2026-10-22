# DNAView

A GPU-accelerated browser explorer for the human genome. Pick a trait and zoom continuously from the whole karyotype down to individual base pairs, with no page transitions:

**Genome → Chromosome → Chromatin region → Gene → Double helix**

Each level is a 3D structure nested inside its parent. As you zoom, the parent dissolves around the target and the next structure grows out of it. The aim is intuition, not expertise: every step leads with one plain-language idea, and the full science (IDs, coordinates, sequences, sources) sits under "The science".

Prototype traits:

Traits run from "DNA fully decides it" to "thousands of tiny effects". Each shows a **DNA influence** rating: how much DNA decides the trait, and how much one letter can move it.

| Trait | Path | Influence |
|---|---|---|
| Blood type | chr9 → 9q34.2 → ABO → rs8176719 (the missing letter that makes O); picker O/A/B/AB | fully / decisive |
| Sickle cell | chr11 → 11p15.4 → HBB exon 1 → rs334 (GAG→GTG); picker typical/trait/disease | fully / decisive |
| Biological sex | chrY → Yp11.2 → SRY, just past the PAR1 boundary → SRY start codon | fully / decisive |
| Lactose tolerance | chr2 → 2q21.3 → MCM6 intron 13, upstream of LCT → rs4988235 (−13910 C>T) | mostly / large |
| Eye color | chr15 → 15q13.1 → HERC2 intron 86 enhancer of OCA2 → rs12913832; six-SNP color picker | fully / large |
| BRCA1 | chr17 → 17q21.31 → BRCA1 exon 2 → 185delAG; picker typical/carrier | a little / large |
| Height | 21,858 GWAS Catalog hits genome-wide → chr12 → HMGA2 3′ UTR → rs1042725 | mostly / tiny |

Pickers swap in example genotypes and light up every letter that changes, at every zoom level.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

Every push to `main` is built and published to GitHub Pages at https://roshank.github.io/dnaview/ by `.github/workflows/deploy.yml`. Pull requests are built but not published. Pages must be enabled once under **Settings → Pages → Source: GitHub Actions**.

Controls: scroll or pinch to zoom, drag to rotate, ←/→ to step between levels. You can also click the level track.

## Data

All coordinates, bands, genes, exons, variants and sequence are real GRCh38 (hg38) data, baked into `src/data/genome.json` from the [UCSC Genome Browser API](https://api.genome.ucsc.edu/) (cytoBand, ncbiRefSeqSelect, dbSnp155, gwasCatalog, sequence). To regenerate:

```bash
npm run data     # python3 scripts/fetch_data.py
```

Trait regions are configured at the top of `scripts/fetch_data.py`. The explanation text for each zoom level lives in `src/traits.ts`.

## Code map

- `src/main.ts`: renderer, nested-zoom transform, portal dissolve, input
- `src/levels/`: one builder per zoom level (`chromosome.ts` covers the genome and chromosome levels)
- `src/ui.ts`, `src/style.css`: overlay panel, trait picker, level track

Educational prototype. Not medical or ancestry advice.
