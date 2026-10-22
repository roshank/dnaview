import * as THREE from 'three';
import { type Gene, type TraitData } from '../data';
import { ACCENT, addDiffMarker, clusterSnps, collect, geneColor, lettersLong, label, markMaterial, newLevel, NEUTRAL, ring, type Level } from './common';
import { H2 } from './chromosome';

export const H3 = 15;
const TURNS = 46;
const COIL_R = 0.5;
const PER_TURN = 6;
/** Packed shape: loops of fiber around a short axis, about as wide as the chromosome. */
const LOOPS = 18;
const PACKED_R = 3.6;
const PACKED_H = 5;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

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
  /**
   * The same fiber as it sits inside the chromosome: folded into loops around a short central axis
   * (a rosette as wide as the chromosome), still coiled along its length.
   */
  class Packed extends THREE.Curve<THREE.Vector3> {
    constructor() {
      super();
    }
    getPoint(u: number, out = new THREE.Vector3()) {
      const k = Math.min(Math.floor(u * LOOPS), LOOPS - 1);
      const v = u * LOOPS - k;
      const phi = k * GOLDEN + 0.6 * (v - 0.5);
      const r = 0.15 + PACKED_R * Math.sin(Math.PI * v);
      const a = u * TURNS * Math.PI * 2;
      return out.set(
        Math.cos(phi) * r + Math.cos(a) * 0.22,
        PACKED_H / 2 - u * PACKED_H + 0.35 * Math.sin(2 * Math.PI * v),
        Math.sin(phi) * r + Math.sin(a) * 0.22,
      );
    }
  }
  const curve = new Coil();
  const packed = new Packed();
  const fiber = new THREE.Group();
  level.group.add(fiber);
  // Gene brackets and the zoom window only make sense once the fiber is straight.
  const annot = new THREE.Group();
  level.group.add(annot);

  // Linker DNA running between the nucleosomes. The straight tube carries the packed shape as a
  // morph target, so unfolding is a single GPU blend.
  const tube = new THREE.TubeGeometry(curve, TURNS * 48, 0.04, 6, false);
  const packedTube = new THREE.TubeGeometry(packed, TURNS * 48, 0.04, 6, false);
  tube.morphAttributes.position = [packedTube.attributes.position];
  tube.morphAttributes.normal = [packedTube.attributes.normal];
  const tc = new Float32Array(tube.attributes.position.count * 3);
  const tp = tube.attributes.position;
  for (let i = 0; i < tp.count; i++) colorAt(posAt((H2 / 2 - tp.getY(i)) / H2)).toArray(tc, i * 3);
  tube.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  const linker = new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  fiber.add(linker);

  // Nucleosomes: DNA wrapped around histone octamers, stacked into a ~30 nm fiber.
  const count = TURNS * PER_TURN;
  const nuc = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.17, 20, 14),
    new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    count,
  );
  const m = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const squash = new THREE.Vector3(1, 0.62, 1);
  // Each nucleosome's place and tilt in both shapes, blended per frame while unfolding.
  const straightPose: { p: THREE.Vector3; q: THREE.Quaternion }[] = [];
  const packedPose: { p: THREE.Vector3; q: THREE.Quaternion }[] = [];
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count;
    for (const [c, poses] of [[curve, straightPose], [packed, packedPose]] as const) {
      poses.push({ p: c.getPoint(u), q: new THREE.Quaternion().setFromUnitVectors(up, c.getTangent(u)) });
    }
    m.compose(straightPose[i].p, straightPose[i].q, squash);
    nuc.setMatrixAt(i, m);
    const g = geneAt(t.genes, t.focusGenes, posAt(u));
    const col = colorAt(posAt(u));
    nuc.setColorAt(i, g ? col : col.clone().multiplyScalar(1.15));
  }
  fiber.add(nuc);

  // Gene extents as brackets with labels on the right.
  const shown = [...t.genes].sort((a, b) => {
    // Focus genes in the trait's own order (the variant's gene first), then the rest by size.
    const rank = (g: Gene) => (t.focusGenes.includes(g.name) ? t.focusGenes.indexOf(g.name) : t.focusGenes.length);
    const fa = rank(a);
    const fb = rank(b);
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
    annot.add(bracket);

    const ly = (y(a) + y(b)) / 2;
    // Only the trait's own genes are named; the rest stay as quiet brackets.
    if (!focus || usedY.some((u) => Math.abs(u - ly) < 0.6)) return;
    usedY.push(ly);
    const l = label(
      `<b style="color:#${col.getHexString()}">${g.name}</b><span>${lettersLong(g.end - g.start)}</span>`,
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
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, Math.max(wh, 0.05), 48, 1, true), markMaterial(ACCENT, 0.1));
  const wc = (y(w0) + y(w1)) / 2;
  sleeve.position.y = wc;
  annot.add(sleeve);
  for (const yy of [y(w0), y(w1)]) {
    const rr = ring(0.84, 0.014, ACCENT);
    rr.position.y = yy;
    annot.add(rr);
  }
  const zoomHint = label('zooming in here', 'hint');
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
  // Unfold from the packed rosette to the straight fiber while zooming in from the chromosome.
  let unfolded = -1;
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  level.onZoom = (tz) => {
    const k = THREE.MathUtils.smoothstep(tz, 1.35, 2);
    if (k === unfolded) return;
    unfolded = k;
    linker.morphTargetInfluences![0] = 1 - k;
    for (let i = 0; i < count; i++) {
      pos.lerpVectors(packedPose[i].p, straightPose[i].p, k);
      rot.slerpQuaternions(packedPose[i].q, straightPose[i].q, k);
      nuc.setMatrixAt(i, m.compose(pos, rot, squash));
    }
    nuc.instanceMatrix.needsUpdate = true;
    nuc.computeBoundingSphere();
    annot.visible = k > 0.97;
  };
  return level;
}
