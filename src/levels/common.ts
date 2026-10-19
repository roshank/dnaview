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
  update?(time: number, dt: number): void;
}

export const BASE_COLORS: Record<string, string> = {
  A: '#4ade80',
  T: '#fb7185',
  G: '#facc15',
  C: '#60a5fa',
  N: '#64748b',
};

export const ACCENT = '#3ee0ff';
export const ACCENT_2 = '#ffb547';
export const NEUTRAL = '#4a5276';

const STAIN: Record<string, string> = {
  gneg: '#dcd6f2',
  gpos25: '#c3bbe6',
  gpos50: '#9a8fd0',
  gpos75: '#7062b4',
  gpos100: '#4b3e8f',
  acen: '#ff5f8f',
  gvar: '#86c2e0',
  stalk: '#9fd8c6',
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
  return { name, group: new THREE.Group(), anchor: new THREE.Vector3(), childScale: 0.1, engulf: 1, span, materials: [], labels: [], pulses: [], opacity: 1,
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
        '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(portalRadius.x, portalRadius.y, distance(gl_FragCoord.xy, portalCenter));',
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
      level.materials.push({ m, base: m.opacity, glow: m.blending === THREE.AdditiveBlending, depth: m.depthWrite });
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
    l.visible = visible && labelA > 0.02;
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

export function glowMaterial(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(2.2),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** A horizontal glowing ring around the vertical axis at height y. */
export function ring(radius: number, tube: number, color: THREE.ColorRepresentation, opacity = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 96), glowMaterial(color, opacity));
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

/** Deterministic hue for non-focus genes. */
export function geneColor(name: string, focus: string[]): THREE.Color {
  const i = focus.indexOf(name);
  if (i === 0) return new THREE.Color(ACCENT_2);
  if (i === 1) return new THREE.Color(ACCENT);
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return new THREE.Color().setHSL(0.6 + ((h % 1000) / 1000) * 0.35, 0.35, 0.58);
}
