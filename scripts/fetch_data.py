#!/usr/bin/env python3
"""Bake real GRCh38 (hg38) data from the UCSC Genome Browser API into src/data/genome.json.

Run: python3 scripts/fetch_data.py
"""
import json
import pathlib
import time
import urllib.request

API = "https://api.genome.ucsc.edu"
OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "data" / "genome.json"
CHROMS = [str(i) for i in range(1, 23)] + ["X", "Y"]

# Each trait zooms: genome -> chromosome -> region (band level) -> gene window -> base pairs.
TRAITS = {
    "eye": {
        "chrom": "15",
        "region": (27_400_000, 28_900_000),
        "geneWindow": (28_085_000, 28_135_000),
        "focusGenes": ["OCA2", "HERC2"],
        "variant": {"id": "rs12913832", "pos": 28_120_471, "gene": "HERC2"},  # 0-based
        "relatedGenes": ["IRF4", "SLC24A4", "TYR", "SLC45A2", "TYRP1"],
        # The six IrisPlex eye-colour SNPs: (id, gene, chrom, 0-based position).
        "panel": [
            ("rs12913832", "HERC2", "15", 28_120_471),
            ("rs1800407", "OCA2", "15", 27_985_171),
            ("rs12896399", "SLC24A4", "14", 92_307_318),
            ("rs16891982", "SLC45A2", "5", 33_951_587),
            ("rs1393350", "TYR", "11", 89_277_877),
            ("rs12203592", "IRF4", "6", 396_320),
        ],
    },
    "lactose": {
        "chrom": "2",
        "region": (135_200_000, 136_500_000),
        "geneWindow": (135_825_000, 135_860_000),
        "focusGenes": ["LCT", "MCM6"],
        "variant": {"id": "rs4988235", "pos": 135_851_075, "gene": "MCM6"},
        "relatedGenes": [],
    },
    "sex": {
        "chrom": "Y",
        "region": (2_000_000, 3_600_000),
        "geneWindow": (2_779_000, 2_792_000),
        "focusGenes": ["SRY"],
        "variant": None,  # base-pair view centers on the SRY start codon instead
        "relatedGenes": [],
    },
}


def get(path):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(API + path, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            print(f"  retry {attempt + 1} for {path}: {e}")
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError(path)


def track(name, chrom, start=None, end=None):
    q = f"/getData/track?genome=hg38;track={name};chrom=chr{chrom}"
    if start is not None:
        q += f";start={start};end={end}"
    return get(q)[name]


def sequence(chrom, start, end):
    return get(f"/getData/sequence?genome=hg38;chrom=chr{chrom};start={start};end={end}")["dna"].upper()


def ints(csv):
    return [int(x) for x in csv.split(",") if x]


def genes_in(chrom, start, end):
    seen = {}
    for g in track("ncbiRefSeqSelect", chrom, start, end):
        name = g["name2"]
        if name in seen:
            continue
        seen[name] = {
            "name": name,
            "strand": g["strand"],
            "start": g["txStart"],
            "end": g["txEnd"],
            "cdsStart": g["cdsStart"],
            "cdsEnd": g["cdsEnd"],
            "coding": g["name"].startswith("NM_"),
            "exons": list(zip(ints(g["exonStarts"]), ints(g["exonEnds"]))),
        }
    return sorted(seen.values(), key=lambda g: g["start"])


def intron_of(gene, pos):
    """1-based intron number (counted 5'->3' on the gene's strand) containing pos, or None."""
    ex = gene["exons"]
    for i in range(len(ex) - 1):
        if ex[i][1] <= pos < ex[i + 1][0]:
            n = i + 1
            return n if gene["strand"] == "+" else len(ex) - n
    return None


def locate(symbol):
    d = get(f"/search?search={symbol};genome=hg38")
    for m in d["positionMatches"]:
        if m["name"] != "hgnc":
            continue
        for hit in m["matches"]:
            if hit["posName"] == symbol:
                chrom, rng = hit["position"].split(":")
                s, e = (int(x) for x in rng.split("-"))
                return {"name": symbol, "chrom": chrom.removeprefix("chr"), "start": s, "end": e}
    raise RuntimeError(symbol)


def main():
    sizes = get("/list/chromosomes?genome=hg38")["chromosomes"]
    chromosomes = []
    for c in CHROMS:
        print("chr", c)
        bands = [
            [b["chromStart"], b["chromEnd"], b["name"], b["gieStain"]]
            for b in track("cytoBand", c)
        ]
        acen = [b for b in bands if b[3] == "acen"]
        chromosomes.append({
            "name": c,
            "length": sizes[f"chr{c}"],
            "centromere": [acen[0][0], acen[-1][1]] if acen else None,
            "bands": bands,
        })

    traits = {}
    for key, t in TRAITS.items():
        print("trait", key)
        c = t["chrom"]
        genes = genes_in(c, *t["region"])
        out = {
            "chrom": c,
            "region": list(t["region"]),
            "geneWindow": list(t["geneWindow"]),
            "focusGenes": t["focusGenes"],
            "genes": genes,
            "related": [locate(s) for s in t["relatedGenes"]],
        }
        if t.get("panel"):
            out["panel"] = []
            for rs, gene_name, pc, pos in t["panel"]:
                snp = next(x for x in track("dbSnp155Common", pc, pos, pos + 1) if x["name"] == rs)
                out["panel"].append({"id": rs, "gene": gene_name, "chrom": pc, "pos": snp["chromStart"],
                                     "ref": snp["ref"], "alts": [a for a in snp["alts"].split(",") if a]})
        if t["variant"]:
            v = dict(t["variant"])
            center = v["pos"]
            snp = track("dbSnp155Common", c, v["pos"], v["pos"] + 1)
            snp = next(s for s in snp if s["name"] == v["id"])
            v["ref"] = snp["ref"]
            v["alts"] = [a for a in snp["alts"].split(",") if a]
            g = next(g for g in genes if g["name"] == v["gene"])
            v["intron"] = intron_of(g, v["pos"])
            out["variant"] = v
        else:
            g = next(g for g in genes if g["name"] == "SRY")
            # Minus strand: the ATG start codon occupies the last 3 bases of the CDS.
            center = g["cdsEnd"] - 2
            out["startCodon"] = [g["cdsEnd"] - 3, g["cdsEnd"]]
        seq_start = center - 32
        out["sequence"] = {"start": seq_start, "bases": sequence(c, seq_start, seq_start + 64)}
        out["bandAt"] = next(b[2] for b in next(x for x in chromosomes if x["name"] == c)["bands"]
                             if b[0] <= center < b[1])
        traits[key] = out

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"assembly": "GRCh38", "source": "UCSC Genome Browser API",
                               "chromosomes": chromosomes, "chrM": sizes["chrM"], "traits": traits},
                              separators=(",", ":")))
    print("wrote", OUT, OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
