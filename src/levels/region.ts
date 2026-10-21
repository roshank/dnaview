import * as THREE from 'three';
import { type Gene, type TraitData } from '../data';
import { ACCENT, addDiffMarker, clusterSnps, collect, fmtShort, geneColor, glowMaterial, label, newLevel, NEUTRAL, ring, type Level } from './common';
import { H2 } from './chromosome';

export const H3 = 15;
const TURNS = 46;
const COIL_R = 0.5;
const PER_TURN = 6;

/** Gene covering pos, preferring the trait's focus genes. */
export function geneAt(genes: Gene[], focus: string[], pos: number): Gene | undefined {
  const hits = genes.filter((g) => g.start <= pos && pos < g.end);
  return hits.find((g) => focus.includes(g.name)) ?? hits[0];
}

/**
 * Level 2: a ~1.5 Mb stretch of the chromosome shown as a coiled chromatin fiber
 * (nucleosomes stacked into a solenoid), coloured by the genes it carries.
 */
export function buildRegionLevel(t: TraitData): Level {
  const [r0, r1] = t.region;
  const len = r1 - r0;
  const level = newLevel(`Band ${t.chrom}${t.bandAt}`, (len * 17) / H2);
  const y = (pos: number) => H2 / 2 - ((pos - r0) / len) * H2;
  const posAt = (u: number) => r0 + u * len;
  const colorAt = (pos: number) => {
    const g = geneAt(t.genes, t.focusGenes, pos);
    return g ? geneColor(g.name, t.focusGenes) : new THREE.Color(NEUTRAL);
  };

  class Coil extends THREE.Curve<THREE.Vector3> {
    constructor() {
      super();
    }
    getPoint(u: number, out = new THREE.Vector3()) {
      const a = u * TURNS * Math.PI * 2;
      return out.set(Math.cos(a) * COIL_R, H2 / 2 - u * H2, Math.sin(a) * COIL_R);
    }
  }
  const curve = new Coil();
  const fiber = new THREE.Group();
  level.group.add(fiber);

  // Linker DNA running between the nucleosomes.
  const tube = new THREE.TubeGeometry(curve, TURNS * 48, 0.04, 6, false);
  const tc = new Float32Array(tube.attributes.position.count * 3);
  const tp = tube.attributes.position;
  for (let i = 0; i < tp.count; i++) colorAt(posAt((H2 / 2 - tp.getY(i)) / H2)).toArray(tc, i * 3);
  tube.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  fiber.add(new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: '#1a1f3a' })));

  // Nucleosomes: DNA wrapped around histone octamers, stacked into a ~30 nm fiber.
  const count = TURNS * PER_TURN;
  const nuc = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.17, 20, 14),
    new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.5 }),
    count,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count;
    const p = curve.getPoint(u);
    const tangent = curve.getTangent(u);
    q.setFromUnitVectors(up, tangent);
    m.compose(p, q, new THREE.Vector3(1, 0.62, 1));
    nuc.setMatrixAt(i, m);
    const g = geneAt(t.genes, t.focusGenes, posAt(u));
    const col = colorAt(posAt(u));
    nuc.setColorAt(i, g ? col : col.clone().multiplyScalar(1.15));
  }
  fiber.add(nuc);

  // Gene extents as brackets with labels on the right.
  const shown = [...t.genes].sort((a, b) => {
    const fa = t.focusGenes.includes(a.name) ? 0 : 1;
    const fb = t.focusGenes.includes(b.name) ? 0 : 1;
    return fa - fb || b.end - b.start - (a.end - a.start);
  });
  const usedY: number[] = [];
  shown.forEach((g, i) => {
    const a = Math.max(g.start, r0);
    const b = Math.min(g.end, r1);
    if (b <= a) return;
    const focus = t.focusGenes.includes(g.name);
    const col = geneColor(g.name, t.focusGenes);
    const x = 1.0 + (focus ? 0 : 0.14 * (i % 3));
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(focus ? 0.05 : 0.025, Math.max(y(a) - y(b), 0.03), focus ? 0.05 : 0.025),
      new THREE.MeshBasicMaterial({ color: col, toneMapped: false, opacity: focus ? 1 : 0.6 }),
    );
    bracket.position.set(x, (y(a) + y(b)) / 2, 0);
    level.group.add(bracket);

    const ly = (y(a) + y(b)) / 2;
    if (!focus && usedY.some((u) => Math.abs(u - ly) < 0.6)) return;
    usedY.push(ly);
    const kb = fmtShort(g.end - g.start);
    const l = label(
      `<b style="color:#${col.getHexString()}">${g.name}</b><span>${kb}${g.coding ? '' : ' · non-coding'}</span>`,
      focus ? 'gene focus' : 'gene',
      true,
    );
    l.center.set(0, 0.5);
    l.position.set(1.35, ly, 0);
    level.group.add(l);
  });

  // The window the next level zooms into.
  const [w0, w1] = t.geneWindow;
  const wh = y(w0) - y(w1);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, Math.max(wh, 0.05), 48, 1, true), glowMaterial(ACCENT, 0.16));
  const wc = (y(w0) + y(w1)) / 2;
  sleeve.position.y = wc;
  level.group.add(sleeve);
  for (const yy of [y(w0), y(w1)]) {
    const rr = ring(0.84, 0.014, ACCENT);
    rr.position.y = yy;
    level.group.add(rr);
  }
  const zoomHint = label('zoom target', 'hint');
  zoomHint.center.set(1, 0.5);
  zoomHint.position.set(-1.1, wc, 0);
  level.group.add(zoomHint);

  const inRegion = (t.panel ?? []).filter((v) => v.chrom === t.chrom && v.pos >= r0 && v.pos < r1);
  for (const g of clusterSnps(inRegion, y, 0.9)) {
    addDiffMarker(level, level.group, g.map((v) => v.id), new THREE.Vector3(0, y(g[0].pos), 0), 0.95, -1.1, 0.75);
  }

  level.anchor.set(0, wc, 0);
  level.childScale = wh / H3;
  level.engulf = COIL_R + 0.17;
  collect(level);
  level.update = (_time, dt) => {
    fiber.rotation.y += dt * 0.12;
  };
  return level;
}
