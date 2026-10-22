import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * One zoom level, built in its own native units (roughly a 16-unit-tall box centred on the origin).
 * The next level's origin sits at `anchor` and is `childScale` times as large as this level.
 */
export interface Level {
  name: string;
  group: THREE.Group;
  anchor: THREE.Vector3;
  childScale: number;
  /** Radius of the geometry around the anchor; once magnified past the view it must be faded out. */
  engulf: number;
  /**
   * Native half-width of a thin level. When set, the level is widened while it is still small during
   * a zoom so it doesn't shrink to a hairline, easing back to true proportions as it arrives.
   */
  radius?: number;
  /** Number of base pairs spanned by the level's natural view height, for the scale readout. */
  span: number;
  materials: { m: THREE.Material; base: number; glow: boolean; depth: boolean }[];
  labels: CSS2DObject[];
  /** Objects flagged with userData.pulse, animated by the render loop. */
  pulses: THREE.Object3D[];
  /** Current fade, 0..1, set by setLevelOpacity. */
  opacity: number;
  /** Shader uniforms for the dissolve circle; radius (-2, -1) disables it. */
  portal: { center: { value: THREE.Vector2 }; radius: { value: THREE.Vector2 } };
  /** Markers that light up while one of their SNPs differs from the previous selection. */
  diffs: DiffMarker[];
  update?(time: number, dt: number): void;
  /** Called every frame with the global zoom position (0 = genome … 4 = letters). */
  onZoom?(t: number): void;
}

export const BASE_COLORS: Record<string, string> = {
  A: '#5e9e6e',
  T: '#d06b5f',
  G: '#d9a441',
  C: '#5b88c2',
  N: '#b9b4aa',
  '-': '#b9b4aa',
};

/** The thing to look at: the zoom target and the trait's main gene. */
export const ACCENT = '#2f6f73';
/** Secondary emphasis: the trait's other genes and related spots. */
export const ACCENT_2 = '#b7793f';
export const NEUTRAL = '#c9c2b6';
/** Colour for DNA that changed in the current comparison. */
export const DIFF = '#d2553f';

const STAIN: Record<string, string> = {
  gneg: '#e7e1d6',
  gpos25: '#cfc7ba',
  gpos50: '#ada496',
  gpos75: '#857c71',
  gpos100: '#5c564f',
  acen: '#c98a78',
  gvar: '#a9bcc4',
  stalk: '#bfc9b4',
};

export function stainColor(stain: string): THREE.Color {
  return new THREE.Color(STAIN[stain] ?? STAIN.gneg);
}

/** Relative darkness of a Giemsa stain, used for a subtle band relief. */
export function stainWeight(stain: string): number {
  if (stain.startsWith('gpos')) return Number(stain.slice(4)) / 100;
  return stain === 'gvar' ? 0.6 : 0;
}

export function newLevel(name: string, span: number): Level {
  return { name, group: new THREE.Group(), anchor: new THREE.Vector3(), childScale: 0.1, engulf: 1, span, materials: [], labels: [], pulses: [], opacity: 1, diffs: [],
    portal: { center: { value: new THREE.Vector2() }, radius: { value: new THREE.Vector2(-2, -1) } } };
}

/**
 * Dissolve a level inside a soft circle (in drawing-buffer pixels) around the zoom target, so the
 * next level appears to emerge from within it.
 */
function addPortal(m: THREE.Material, level: Level) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.portalCenter = level.portal.center;
    shader.uniforms.portalRadius = level.portal.radius;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec2 portalCenter;\nuniform vec2 portalRadius;\nvoid main() {')
      .replace(
        '#include <dithering_fragment>',
        // Discard (not just hide) dissolved fragments so they don't write depth over the next level.
        '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(portalRadius.x, portalRadius.y, distance(gl_FragCoord.xy, portalCenter));\nif (gl_FragColor.a < 0.02) discard;',
      );
  };
}

/** Register every material under the level so it can be faded as a unit. */
export function collect(level: Level): void {
  const seen = new Set<THREE.Material>();
  level.group.traverse((o) => {
    if (o.userData.pulse) level.pulses.push(o);
    if (o instanceof CSS2DObject) {
      level.labels.push(o);
      return;
    }
    const mats = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      if (seen.has(m)) continue;
      seen.add(m);
      m.transparent = true;
      addPortal(m, level);
      level.materials.push({ m, base: m.opacity, glow: m.userData.marker === true, depth: m.depthWrite });
    }
  });
}

/**
 * Fade a level. Glows and labels get their own (usually earlier) fade, because they don't read
 * well when blown up during a zoom.
 */
export function setLevelOpacity(level: Level, a: number, glowA = a, labelA = a): void {
  const visible = a > 0.003;
  level.opacity = labelA;
  level.group.visible = visible;
  for (const { m, base, glow, depth } of level.materials) {
    m.opacity = base * (glow ? glowA : a);
    // A fading level must not hide the next level, which sits inside it.
    m.depthWrite = depth && a > 0.97;
  }
  for (const l of level.labels) {
    l.visible = visible && labelA > 0.02 && !l.userData.hidden;
    l.element.style.opacity = String(Math.min(1, labelA));
  }
}

export function label(text: string, cls = '', html = false): CSS2DObject {
  const el = document.createElement('div');
  el.className = `label ${cls}`;
  if (html) el.innerHTML = text;
  else el.textContent = text;
  return new CSS2DObject(el);
}

/** Flat, unlit colour for markers (rings, highlight sleeves) that should read clearly at any angle. */
export function markMaterial(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
  m.userData.marker = true;
  return m;
}

/** A horizontal glowing ring around the vertical axis at height y. */
export function ring(radius: number, tube: number, color: THREE.ColorRepresentation, opacity = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 96), markMaterial(color, opacity));
  m.rotation.x = Math.PI / 2;
  return m;
}

export function fmtBp(bp: number): string {
  if (bp >= 1e9) return `${(bp / 1e9).toFixed(2)} billion bp`;
  if (bp >= 1e6) return `${(bp / 1e6).toFixed(bp >= 1e8 ? 0 : 1)} million bp`;
  if (bp >= 1e4) return `${Math.round(bp / 1e3)},${String(Math.round(bp) % 1000).padStart(3, '0')} bp`;
  return `${Math.round(bp).toLocaleString('en-US')} bp`;
}

export function fmtShort(bp: number): string {
  if (bp >= 1e9) return `${(bp / 1e9).toFixed(1)} Gb`;
  if (bp >= 1e6) return `${(bp / 1e6).toFixed(bp >= 1e7 ? 0 : 1)} Mb`;
  if (bp >= 1e3) return `${(bp / 1e3).toFixed(bp >= 1e4 ? 0 : 1)} kb`;
  return `${Math.round(bp)} bp`;
}

/** A gene's length in everyday words: "211,000 letters". */
export function lettersLong(bp: number): string {
  const n = bp >= 1e4 ? Math.round(bp / 1e3) * 1e3 : bp;
  return `${n.toLocaleString('en-US')} letters`;
}

/** Deterministic hue for non-focus genes. */
export function geneColor(name: string, focus: string[]): THREE.Color {
  const i = focus.indexOf(name);
  if (i === 0) return new THREE.Color(ACCENT_2);
  if (i === 1) return new THREE.Color(ACCENT);
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return new THREE.Color().setHSL(0.55 + ((h % 1000) / 1000) * 0.2, 0.12, 0.64);
}

export interface DiffMarker {
  ids: string[];
  ring: THREE.Object3D;
  label: CSS2DObject;
}

/**
 * Add a hidden diff marker (a pulsing ring plus a label) for one or more SNPs at `pos` under `parent`.
 * The label sits `dx` to the side of the ring; a negative dx right-aligns it on the left.
 */
export function addDiffMarker(level: Level, parent: THREE.Object3D, ids: string[], pos: THREE.Vector3, radius: number, dx: number, dy = 0): void {
  const r = ring(radius, Math.max(0.012, radius * 0.06), DIFF);
  r.position.copy(pos);
  r.userData.pulse = true;
  r.visible = false;
  parent.add(r);
  const l = label('', 'callout diff', true);
  l.center.set(dx < 0 ? 1 : 0, 0.5);
  l.position.copy(pos).add(new THREE.Vector3(dx, dy, 0));
  l.userData.hidden = true;
  parent.add(l);
  level.diffs.push({ ids, ring: r, label: l });
}

export interface DiffLabel {
  gene: string;
  html: string;
}

/**
 * Show markers whose SNPs are in `changes` and hide the rest. A marker covering several changed
 * SNPs in one gene shows a count instead of every letter.
 */
export function setLevelDiff(level: Level, changes: Map<string, DiffLabel>): void {
  for (const d of level.diffs) {
    const byGene = new Map<string, DiffLabel[]>();
    for (const id of d.ids) {
      const c = changes.get(id);
      if (c) byGene.set(c.gene, [...(byGene.get(c.gene) ?? []), c]);
    }
    const html = [...byGene.entries()]
      .map(([gene, cs]) => (cs.length > 1 ? `<b>${gene}</b><span>${cs.length} letters change</span>` : cs[0].html))
      .join('');
    d.ring.visible = html !== '';
    d.label.userData.hidden = html === '';
    d.label.element.innerHTML = html;
  }
}

/**
 * Group SNPs whose markers would sit within `gap` units of each other (`y` maps position to height),
 * so close neighbours share one marker and label.
 */
export function clusterSnps<T extends { id: string; pos: number }>(snps: T[], y: (pos: number) => number, gap: number): T[][] {
  const sorted = [...snps].sort((a, b) => y(b.pos) - y(a.pos));
  const groups: T[][] = [];
  for (const s of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(y(last[0].pos) - y(s.pos)) < gap) last.push(s);
    else groups.push([s]);
  }
  return groups;
}
