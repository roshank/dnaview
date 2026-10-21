import * as THREE from 'three';
import { bandAt, chromosome, genome, type Chromosome, type TraitData, type TraitKey } from '../data';
import {
  ACCENT,
  ACCENT_2,
  addDiffMarker,
  collect,
  glowMaterial,
  label,
  newLevel,
  ring,
  stainColor,
  stainWeight,
  type Level,
} from './common';

const VIEW_H = 17;
const MAX_LEN = Math.max(...genome.chromosomes.map((c) => c.length));
/** Height of a chromosome in the genome (karyotype) view. */
export const karyoHeight = (c: Chromosome) => (c.length / MAX_LEN) * 6.2;
const R0 = 0.17;
export const H1 = 14;
export const H2 = 15;

interface ChromosomeObject {
  obj: THREE.Group;
  /** A point on the right chromatid's axis at genomic position pos, in obj coordinates. */
  axisPoint(pos: number): THREE.Vector3;
  /** Centre line (between the chromatids) at genomic position pos. */
  centerPoint(pos: number): THREE.Vector3;
}

function chromatidGeometry(chr: Chromosome, h: number, R: number, samples: number, segments: number) {
  const len = chr.length;
  const [c0, c1] = chr.centromere;
  const c = (c0 + c1) / 2;
  const w = Math.max((c1 - c0) / 2, len * 0.014);
  const cap = R * 1.05;

  const set = new Set<number>();
  for (let i = 0; i <= samples; i++) set.add((i / samples) * len);
  const eps = len * 1e-5;
  for (const b of chr.bands) {
    if (b[0] > eps) set.add(b[0] + eps);
    if (b[1] < len - eps) set.add(b[1] - eps);
  }
  const positions = [...set].sort((a, b) => b - a); // bottom (q-ter) to top (p-ter)

  const pts: THREE.Vector2[] = [];
  const cols: THREE.Color[] = [];
  for (const pos of positions) {
    const band = bandAt(chr, Math.min(pos, len - 1));
    let r = R * (1 - 0.45 * Math.exp(-(((pos - c) / w) ** 2)));
    r *= 1 + 0.05 * stainWeight(band[3]);
    const d = (Math.min(pos, len - pos) / len) * h;
    if (d < cap) r *= Math.sqrt(Math.max(0, 1 - (1 - d / cap) ** 2));
    pts.push(new THREE.Vector2(Math.max(r, 1e-4), h / 2 - (pos / len) * h));
    cols.push(stainColor(band[3]));
  }
  const geo = new THREE.LatheGeometry(pts, segments);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j < pts.length; j++) cols[j].toArray(colors, (i * pts.length + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function chromosomeMaterial(opacity: number) {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.48,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    sheen: 0.7,
    sheenColor: new THREE.Color('#b9a8ff'),
    sheenRoughness: 0.45,
    transparent: true,
    opacity,
  });
}

function makeChromosome(chr: Chromosome, h: number, R: number, samples: number, segments: number, opacity = 1): ChromosomeObject {
  const obj = new THREE.Group();
  const geo = chromatidGeometry(chr, h, R, samples, segments);
  const mat = chromosomeMaterial(opacity);
  const yc = h / 2 - ((chr.centromere[0] + chr.centromere[1]) / 2 / chr.length) * h;
  const splay = 0.012 + 0.02 * (R / h);
  const meshes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, yc, 0);
    pivot.rotation.z = -side * splay;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(side * R * 0.88, -yc, 0);
    pivot.add(mesh);
    obj.add(pivot);
    meshes.push(mesh);
  }
  obj.updateMatrixWorld(true);
  const y = (pos: number) => h / 2 - (pos / chr.length) * h;
  return {
    obj,
    axisPoint(pos) {
      meshes[1].updateWorldMatrix(true, false);
      return obj.worldToLocal(meshes[1].localToWorld(new THREE.Vector3(0, y(pos), 0)));
    },
    centerPoint: (pos) => new THREE.Vector3(0, y(pos), 0),
  };
}

function regionCenter(t: TraitData) {
  return (t.region[0] + t.region[1]) / 2;
}

const RELATED_KEYS: Record<TraitKey, string[]> = { blood: [], sickle: [], sex: ['X', 'Y'], lactose: [], eye: [], brca: [], height: [] };

/**
 * Glowing bands at every GWAS hit bin on a chromosome, brighter where more distinct SNPs were found.
 * `point` maps a genomic position to the chromosome's centre line; `unitsPerBp` sizes each band.
 */
function addGwasBands(parent: THREE.Object3D, t: TraitData, chr: Chromosome, point: (pos: number) => THREE.Vector3, radius: number, unitsPerBp: number) {
  const bins = t.gwas?.bins[chr.name];
  if (!bins?.length) return;
  const size = t.gwas!.binSize;
  const bands = new THREE.InstancedMesh(
    // Half-height bands leave dark gaps, so the chromosome stays visible under thousands of hits.
    new THREE.CylinderGeometry(radius, radius, Math.max(size * unitsPerBp * 0.5, 0.006), 24, 1, true),
    glowMaterial(ACCENT_2, 0.7),
    bins.length,
  );
  const base = new THREE.Color(ACCENT_2);
  bins.forEach(([bin, count], i) => {
    bands.setMatrixAt(i, new THREE.Matrix4().setPosition(point((bin + 0.5) * size)));
    bands.setColorAt(i, base.clone().multiplyScalar(Math.min(1, 0.12 + count / 28)));
  });
  parent.add(bands);
}

/** Level 0: the whole karyotype, centromeres aligned in two rows. */
export function buildGenomeLevel(key: TraitKey, t: TraitData): Level {
  const level = newLevel('Genome', 3.1e9);
  // A trait with genome-wide hits involves every chromosome, so none are dimmed.
  const primary = new Set(t.gwas ? genome.chromosomes.map((c) => c.name) : [t.chrom, ...RELATED_KEYS[key]]);
  const related = new Set(t.related.map((r) => r.chrom));
  let anchorObj: ChromosomeObject | null = null;

  genome.chromosomes.forEach((chr, i) => {
    const row = i < 12 ? 0 : 1;
    const col = i % 12;
    const h = karyoHeight(chr);
    const cenY = row === 0 ? 2.9 : -3.25;
    const top = cenY + ((chr.centromere[0] + chr.centromere[1]) / 2 / chr.length) * h;
    const opacity = primary.has(chr.name) ? 1 : related.has(chr.name) ? 0.8 : 0.28;
    const c = makeChromosome(chr, h, R0, 150, 28, opacity);
    c.obj.position.set((col - 5.5) * 1.42, top - h / 2, 0);
    level.group.add(c.obj);

    const num = label(chr.name, `chr ${primary.has(chr.name) ? 'on' : ''}`);
    num.position.set(0, (row === 0 ? -0.62 : -6.15) - c.obj.position.y, 0);
    c.obj.add(num);

    if (chr.name === t.chrom) {
      anchorObj = c;
      level.anchor.copy(c.obj.position);
      level.childScale = h / H1;
      level.engulf = R0;
      const p = c.centerPoint(regionCenter(t));
      const r = ring(R0 * 2.6, 0.022, ACCENT);
      r.position.copy(p);
      r.userData.pulse = true;
      c.obj.add(r);
      const l = label(t.focusGenes.join(' · '), 'callout');
      l.center.set(0, 0.5);
      l.position.copy(p).add(new THREE.Vector3(0.62, 0, 0));
      c.obj.add(l);
    }
    for (const g of t.related.filter((r) => r.chrom === chr.name)) {
      const p = c.centerPoint(g.start);
      const r = ring(R0 * 2.1, 0.016, ACCENT_2, 0.9);
      r.position.copy(p);
      c.obj.add(r);
      const l = label(g.name, 'minor');
      l.center.set(0, 0.5);
      l.position.copy(p).add(new THREE.Vector3(0.48, 0, 0));
      c.obj.add(l);
    }
    addGwasBands(c.obj, t, chr, c.centerPoint, R0 * 2.05, h / chr.length);
    const snps = (t.panel ?? []).filter((v) => v.chrom === chr.name);
    if (snps.length) addDiffMarker(level, c.obj, snps.map((v) => v.id), c.centerPoint(snps[0].pos), R0 * 3.4, -0.45);
  });

  // Mitochondrial DNA: a separate 16.6 kb circle, outside the nucleus.
  const mt = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.055, 16, 64),
    new THREE.MeshPhysicalMaterial({ color: '#9fd8c6', roughness: 0.4, clearcoat: 0.5, transparent: true, opacity: 0.45 }),
  );
  mt.position.set(9.4, -4.4, 0);
  level.group.add(mt);
  const mtl = label('mtDNA', 'chr');
  mtl.position.set(9.4, -6.15, 0);
  level.group.add(mtl);

  if (!anchorObj) throw new Error(`no chromosome ${t.chrom}`);
  collect(level);
  level.update = (time) => {
    mt.rotation.y = time * 0.4;
  };
  return level;
}

/** Level 1: a single metaphase chromosome with its Giemsa bands. */
export function buildChromosomeLevel(t: TraitData, parentScale: number): Level {
  const chr = chromosome(t.chrom);
  const level = newLevel(`Chromosome ${chr.name}`, (chr.length * VIEW_H) / H1);
  // Match the apparent thickness of the karyotype view where possible, so the cross-fade is seamless.
  const R = THREE.MathUtils.clamp(R0 / parentScale, 0.42, 0.95);
  const c = makeChromosome(chr, H1, R, 900, 56);
  level.group.add(c.obj);

  const y = (pos: number) => H1 / 2 - (pos / chr.length) * H1;
  const [c0, c1] = chr.centromere;
  const arms: [string, number][] = [
    ['p arm', c0 / 2],
    ['q arm', (c1 + chr.length) / 2],
  ];
  for (const [text, pos] of arms) {
    if (pos / chr.length < 0.04) continue; // acrocentric p arms are too short to label
    const l = label(text, 'arm');
    l.center.set(1, 0.5);
    l.position.set(-R * 2.4, y(pos), 0);
    level.group.add(l);
  }
  const cen = label('centromere', 'arm');
  cen.center.set(1, 0.5);
  cen.position.set(-R * 2.4, y((c0 + c1) / 2), 0);
  level.group.add(cen);

  const target = t.bandAt;
  const rc = (t.region[0] + t.region[1]) / 2;
  const ty = y(rc);
  let lastY = Infinity;
  for (const b of chr.bands) {
    const by = y((b[0] + b[1]) / 2);
    if (b[2] === target) continue;
    if ((b[1] - b[0]) / chr.length < 0.014 || Math.abs(by - ty) < 0.75 || lastY - by < 0.34) continue;
    const l = label(`${chr.name}${b[2]}`, 'band');
    l.center.set(0, 0.5);
    l.position.set(R * 2.3, by, 0);
    level.group.add(l);
    lastY = by;
  }

  const anchor = c.axisPoint(rc);
  const r = ring(R * 1.35, 0.03, ACCENT);
  r.position.copy(anchor);
  r.userData.pulse = true;
  level.group.add(r);
  const callout = label(`<b>${chr.name}${target}</b><span>${t.focusGenes.join(' · ')}</span>`, 'callout', true);
  callout.center.set(0, 0.5);
  callout.position.set(R * 2.3, ty, 0);
  level.group.add(callout);

  addGwasBands(level.group, t, chr, c.centerPoint, R * 2.05, H1 / chr.length);
  const snps = (t.panel ?? []).filter((v) => v.chrom === chr.name);
  if (snps.length) {
    const p = c.axisPoint(snps[0].pos);
    addDiffMarker(level, level.group, snps.map((v) => v.id), p, R * 1.7, -p.x - R * 2.4, -0.6);
  }

  level.anchor.copy(anchor);
  level.childScale = ((t.region[1] - t.region[0]) / chr.length) * H1 / H2;
  level.engulf = R;
  collect(level);
  return level;
}
