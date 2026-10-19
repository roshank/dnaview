import * as THREE from 'three';
import { sequenceCenter, type Gene, type TraitData } from '../data';
import { ACCENT, ACCENT_2, collect, fmtShort, geneColor, label, newLevel, NEUTRAL, ring, type Level } from './common';
import { geneAt, H3 } from './region';

export const H4 = 16;
/** End of pseudoautosomal region 1 on chrY (GRCh38). */
export const PAR1_END = 2_781_479;

function exonNumber(g: Gene, i: number) {
  return g.strand === '+' ? i + 1 : g.exons.length - i;
}

/**
 * Level 3: tens of kilobases of loosened "beads on a string" DNA, with exons, introns and the
 * trait's variant marked.
 */
export function buildGeneLevel(t: TraitData): Level {
  const [w0, w1] = t.geneWindow;
  const len = w1 - w0;
  const level = newLevel(t.focusGenes.join(' · '), (len * 17) / H3);
  const y = (pos: number) => H3 / 2 - ((pos - w0) / len) * H3;
  const posAtY = (yy: number) => w0 + ((H3 / 2 - yy) / H3) * len;
  const inExon = (g: Gene, pos: number) => g.exons.some(([a, b]) => a <= pos && pos < b);
  const strandColor = (pos: number) => {
    const g = geneAt(t.genes, t.focusGenes, pos);
    if (!g) return new THREE.Color(NEUTRAL).multiplyScalar(1.4);
    const c = geneColor(g.name, t.focusGenes);
    return inExon(g, pos) ? c.multiplyScalar(1.3) : c.multiplyScalar(0.6);
  };

  // Two strands loosely twisted around each other.
  const dna = new THREE.Group();
  level.group.add(dna);
  const turns = 22;
  for (const phase of [0, Math.PI]) {
    class Strand extends THREE.Curve<THREE.Vector3> {
      constructor() {
        super();
      }
      getPoint(u: number, out = new THREE.Vector3()) {
        const a = u * turns * Math.PI * 2 + phase;
        const wobble = Math.sin(u * 9.0) * 0.05;
        return out.set(Math.cos(a) * 0.07 + wobble, H3 / 2 - u * H3, Math.sin(a) * 0.07);
      }
    }
    const geo = new THREE.TubeGeometry(new Strand(), 1800, 0.026, 6, false);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) strandColor(posAtY(pos.getY(i))).toArray(col, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    dna.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, emissive: '#151a33' })));
  }

  // Sparse nucleosome beads: active genes are loosely packed.
  const beads = 26;
  const bead = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.12, 18, 12),
    new THREE.MeshPhysicalMaterial({ color: '#c9c2ff', roughness: 0.3, clearcoat: 1, opacity: 0.32 }),
    beads,
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < beads; i++) {
    const yy = H3 / 2 - ((i + 0.5) / beads) * H3 + Math.sin(i * 2.7) * 0.15;
    m.makeScale(1, 0.7, 1).setPosition(Math.sin(i * 1.7) * 0.06, yy, 0);
    bead.setMatrixAt(i, m);
  }
  dna.add(bead);

  // Gene bodies (introns) and exons.
  for (const g of t.genes) {
    const a = Math.max(g.start, w0);
    const b = Math.min(g.end, w1);
    if (b <= a) continue;
    const col = geneColor(g.name, t.focusGenes);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, y(a) - y(b), 32, 1, true),
      new THREE.MeshBasicMaterial({ color: col, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
    );
    body.position.y = (y(a) + y(b)) / 2;
    level.group.add(body);

    const visible: number[] = [];
    g.exons.forEach(([ea, eb], i) => {
      const s = Math.max(ea, w0);
      const e = Math.min(eb, w1);
      if (e <= s) return;
      visible.push(exonNumber(g, i));
      const h = Math.max(y(s) - y(e), 0.05);
      const ex = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, h, 40),
        new THREE.MeshPhysicalMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.55,
          roughness: 0.25,
          clearcoat: 1,
          opacity: 0.6,
          depthWrite: false,
        }),
      );
      ex.position.y = (y(s) + y(e)) / 2;
      level.group.add(ex);
    });

    const arrow = g.strand === '+' ? '↓' : '↑';
    const range = visible.length
      ? visible.length === 1
        ? `exon ${visible[0]}`
        : `exons ${Math.min(...visible)}–${Math.max(...visible)}`
      : 'intron only';
    const l = label(
      `<b style="color:#${col.getHexString()}">${g.name} ${arrow}</b><span>${range} in view · gene is ${fmtShort(g.end - g.start)}</span>`,
      t.focusGenes.includes(g.name) ? 'gene focus' : 'gene',
      true,
    );
    l.center.set(0, 0.5);
    l.position.set(0.62, (y(a) + y(b)) / 2, 0);
    level.group.add(l);

    const tss = g.strand === '+' ? g.start : g.end;
    if (tss > w0 && tss < w1) {
      const s = label(`${g.name} starts here`, 'hint');
      s.center.set(0, 0.5);
      s.position.set(0.42, y(tss), 0);
      level.group.add(s);
    }
  }

  const center = sequenceCenter(t);
  const target = ring(0.44, 0.02, ACCENT);
  target.position.y = y(center);
  target.userData.pulse = true;
  level.group.add(target);
  let text: string;
  if (t.variant) {
    const v = t.variant;
    text = `<b>${v.id}</b><span>${v.gene} intron ${v.intron} · a single letter</span>`;
  } else {
    text = `<b>Start codon</b><span>where the SRY protein begins</span>`;
  }
  const c = label(text, 'callout left', true);
  c.center.set(1, 0.5);
  c.position.set(-0.6, y(center), 0);
  level.group.add(c);

  if (t.chrom === 'Y' && PAR1_END > w0 && PAR1_END < w1) {
    const par = ring(0.6, 0.012, ACCENT_2);
    par.position.y = y(PAR1_END);
    level.group.add(par);
    const pl = label('<b>PAR1 boundary</b><span>above: shared with X · below: Y-only</span>', 'callout left minor', true);
    pl.center.set(1, 0.5);
    pl.position.set(-0.7, y(PAR1_END), 0);
    level.group.add(pl);
  }

  level.anchor.set(0, y(center), 0);
  level.childScale = ((t.sequence.bases.length / len) * H3) / H4;
  level.engulf = 0.3;
  collect(level);
  level.update = (_time, dt) => {
    dna.rotation.y += dt * 0.25;
  };
  return level;
}
