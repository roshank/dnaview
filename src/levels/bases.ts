import * as THREE from 'three';
import { COMPLEMENT, highlightIndices, type TraitData } from '../data';
import { ACCENT, addDiffMarker, BASE_COLORS, collect, label, newLevel, ring, type Level } from './common';
import { H4 } from './gene';

const R = 1.0;
const BP_PER_TURN = 10.5;
/** Angular offset between the two backbones; less than π, which creates major and minor grooves. */
const GROOVE = 2.35;

export interface BasesLevel extends Level {
  /** Indices (into the sequence) that are highlighted. */
  highlight: number[];
  /** Replace the highlighted letters ("+" strand); "-" leaves a gap, as in a deletion. */
  setAllele(bases: string): void;
}

/** Level 4: the double helix itself, 64 base pairs of the real GRCh38 sequence. */
export function buildBasesLevel(t: TraitData, title: string, notes: Record<string, string>): BasesLevel {
  const seq = t.sequence.bases.split('');
  const n = seq.length;
  const rise = H4 / n;
  const level = newLevel(title, n * 17 / H4) as BasesLevel;
  level.highlight = highlightIndices(t);
  const hl = new Set(level.highlight);

  const helix = new THREE.Group();
  level.group.add(helix);
  const yAt = (i: number) => H4 / 2 - (i + 0.5) * rise;
  const angle = (i: number) => (i / BP_PER_TURN) * Math.PI * 2;
  const p1 = (i: number) => new THREE.Vector3(Math.cos(angle(i)) * R, yAt(i), Math.sin(angle(i)) * R);
  const p2 = (i: number) => new THREE.Vector3(Math.cos(angle(i) + GROOVE) * R, yAt(i), Math.sin(angle(i) + GROOVE) * R);

  // Sugar-phosphate backbones.
  const backbone = (pt: (i: number) => THREE.Vector3, color: string) => {
    const pts: THREE.Vector3[] = [];
    for (let i = -1; i <= n; i += 0.25) pts.push(pt(i));
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 14, 0.075, 10, false);
    helix.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.55 })));
  };
  backbone(p1, '#bdb6aa');
  backbone(p2, '#a9b4bd');

  const phosphates = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.14, 20, 14),
    new THREE.MeshStandardMaterial({ color: '#e2dccf', roughness: 0.5 }),
    n * 2,
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    phosphates.setMatrixAt(i * 2, m.makeTranslation(p1(i)));
    phosphates.setMatrixAt(i * 2 + 1, m.makeTranslation(p2(i)));
  }
  helix.add(phosphates);

  // Bases: each half-rung runs from its backbone to the pairing midpoint.
  const rungGeo = new THREE.CylinderGeometry(0.085, 0.085, 1, 12);
  const rungs = new THREE.InstancedMesh(rungGeo, new THREE.MeshStandardMaterial({ roughness: 0.55 }), n * 2);
  const up = new THREE.Vector3(0, 1, 0);
  const halfRung = (a: THREE.Vector3, b: THREE.Vector3) => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const start = a.clone().lerp(mid, 0.14);
    const end = a.clone().lerp(mid, 0.97);
    const dir = end.clone().sub(start);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    return new THREE.Matrix4().compose(start.clone().add(end).multiplyScalar(0.5), q, new THREE.Vector3(1, dir.length(), 1));
  };
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) {
    const a = p1(i);
    const b = p2(i);
    rungs.setMatrixAt(i * 2, hl.has(i) ? hidden : halfRung(a, b));
    rungs.setMatrixAt(i * 2 + 1, hl.has(i) ? hidden : halfRung(b, a));
    rungs.setColorAt(i * 2, new THREE.Color(BASE_COLORS[seq[i]]));
    rungs.setColorAt(i * 2 + 1, new THREE.Color(BASE_COLORS[COMPLEMENT[seq[i]]]));
  }
  helix.add(rungs);

  // Highlighted base pairs get their own glowing meshes so they can change allele.
  const hlMeshes: { i: number; top: THREE.Mesh; bottom: THREE.Mesh }[] = [];
  for (const i of level.highlight) {
    const mk = (a: THREE.Vector3, b: THREE.Vector3) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 1, 16),
        new THREE.MeshStandardMaterial({ roughness: 0.4, emissiveIntensity: 0.25 }),
      );
      halfRung(a, b).decompose(mesh.position, mesh.quaternion, mesh.scale);
      helix.add(mesh);
      return mesh;
    };
    hlMeshes.push({ i, top: mk(p1(i), p2(i)), bottom: mk(p2(i), p1(i)) });
  }

  // Letters near the centre of the view.
  const letters: { el: HTMLElement; obj: THREE.Object3D; i: number; strand: 1 | 2 }[] = [];
  const mid = level.highlight[Math.floor(level.highlight.length / 2)];
  for (let i = Math.max(0, mid - 3); i <= Math.min(n - 1, mid + 3); i++) {
    for (const strand of [1, 2] as const) {
      const l = label('', `base ${hl.has(i) ? 'hl' : ''}`);
      l.position.copy((strand === 1 ? p1(i) : p2(i)).multiply(new THREE.Vector3(1.4, 1, 1.4)));
      helix.add(l);
      letters.push({ el: l.element, obj: l, i, strand });
    }
  }

  const glow = ring(R * 1.5, 0.02, ACCENT);
  const hy = level.highlight.reduce((s, i) => s + yAt(i), 0) / level.highlight.length;
  glow.position.y = hy;
  glow.userData.pulse = true;
  level.group.add(glow);
  const callout = label('', 'callout left', true);
  callout.center.set(1, 0.5);
  callout.position.set(-R * 1.9, hy, 0);
  level.group.add(callout);

  if (t.variant && t.panel?.some((v) => v.id === t.variant!.id)) {
    addDiffMarker(level, level.group, [t.variant.id], new THREE.Vector3(0, hy, 0), R * 1.85, -R * 1.9, -1.3);
  }

  const paint = () => {
    for (const { i, top, bottom } of hlMeshes) {
      const a = new THREE.Color(BASE_COLORS[seq[i]]);
      const b = new THREE.Color(BASE_COLORS[COMPLEMENT[seq[i]]]);
      for (const [mesh, c] of [[top, a], [bottom, b]] as const) {
        // A missing base leaves an empty slot between the backbones.
        mesh.visible = seq[i] !== '-';
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.copy(c);
        mat.emissive.copy(c);
      }
    }
    for (const { el, i, strand } of letters) {
      const ch = strand === 1 ? seq[i] : COMPLEMENT[seq[i]];
      el.textContent = ch === '-' ? '·' : ch;
    }
    const codon = level.highlight.map((i) => seq[i]).join('');
    const head = !t.variant
      ? `Start signal · ${codon}`
      : /^-+$/.test(codon)
        ? `${codon.length > 1 ? `${codon.length} letters` : 'Letter'} missing`
        : `${codon.length > 1 ? 'Letters' : 'Letter'} ${codon}`;
    callout.element.innerHTML = `<b>${head}</b><span>${notes[codon] ?? ''}</span>`;
  };
  level.setAllele = (bases: string) => {
    level.highlight.forEach((i, k) => {
      if (k < bases.length) seq[i] = bases[k];
    });
    paint();
  };
  paint();

  level.anchor.set(0, 0, 0);
  level.childScale = 1;
  collect(level);
  const wp = new THREE.Vector3();
  const center = new THREE.Vector3();
  level.update = (_time, dt) => {
    helix.rotation.y += dt * 0.18;
    // Dim letters on the far side of the helix.
    helix.getWorldPosition(center);
    for (const { el, obj } of letters) {
      obj.getWorldPosition(wp);
      const front = THREE.MathUtils.clamp((wp.z - center.z) / (R * 1.4 * level.group.scale.x) * 0.5 + 0.5, 0, 1);
      el.style.opacity = String(level.opacity * (0.12 + 0.88 * front));
    }
  };
  return level;
}
