import * as THREE from 'three';
import { COMPLEMENT, type TraitData } from '../data';
import { ACCENT, BASE_COLORS, collect, label, newLevel, ring, type Level } from './common';
import { H4 } from './gene';

const R = 1.0;
const BP_PER_TURN = 10.5;
/** Angular offset between the two backbones; less than π, which creates major and minor grooves. */
const GROOVE = 2.35;

export interface BasesLevel extends Level {
  /** Indices (into the sequence) that are highlighted. */
  highlight: number[];
  setAllele(base: string): void;
}

/** Level 4: the double helix itself, 64 base pairs of the real GRCh38 sequence. */
export function buildBasesLevel(t: TraitData, title: string, notes: Record<string, string>): BasesLevel {
  const seq = t.sequence.bases.split('');
  const n = seq.length;
  const rise = H4 / n;
  const level = newLevel(title, n * 17 / H4) as BasesLevel;
  level.highlight = t.variant
    ? [t.variant.pos - t.sequence.start]
    : [t.startCodon![0] - t.sequence.start, t.startCodon![0] - t.sequence.start + 1, t.startCodon![0] - t.sequence.start + 2];
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
    helix.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, sheen: 0.4 })));
  };
  backbone(p1, '#c7bfff');
  backbone(p2, '#a5c8ff');

  const phosphates = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.14, 20, 14),
    new THREE.MeshPhysicalMaterial({ color: '#e7e3ff', roughness: 0.25, clearcoat: 1 }),
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
  const rungs = new THREE.InstancedMesh(rungGeo, new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.6 }), n * 2);
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
        new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, emissiveIntensity: 0.9 }),
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
  const ends: [string, THREE.Vector3][] = [
    ['5′', p1(-1.2)],
    ['3′', p1(n + 0.2)],
    ['3′', p2(-1.2)],
    ['5′', p2(n + 0.2)],
  ];
  for (const [text, p] of ends) {
    const l = label(text, 'end');
    l.position.copy(p);
    helix.add(l);
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

  const paint = () => {
    for (const { i, top, bottom } of hlMeshes) {
      const a = new THREE.Color(BASE_COLORS[seq[i]]);
      const b = new THREE.Color(BASE_COLORS[COMPLEMENT[seq[i]]]);
      for (const [mesh, c] of [[top, a], [bottom, b]] as const) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.color.copy(c);
        mat.emissive.copy(c);
      }
    }
    for (const { el, i, strand } of letters) el.textContent = strand === 1 ? seq[i] : COMPLEMENT[seq[i]];
    const codon = level.highlight.map((i) => seq[i]).join('');
    const head = t.variant ? t.variant.id : 'SRY start codon';
    callout.element.innerHTML = `<b>${head} · ${codon}</b><span>${notes[codon] ?? ''}</span>`;
  };
  level.setAllele = (base: string) => {
    seq[level.highlight[0]] = base;
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
