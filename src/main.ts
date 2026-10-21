import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { genome, type TraitKey } from './data';
import { setLevelOpacity, type Level } from './levels/common';
import { buildChromosomeLevel, buildGenomeLevel } from './levels/chromosome';
import { buildRegionLevel } from './levels/region';
import { buildGeneLevel } from './levels/gene';
import { buildBasesLevel, type BasesLevel } from './levels/bases';
import { TRAITS } from './traits';
import { createUI } from './ui';

const MAX_T = 4;
const app = document.getElementById('app')!;

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
app.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = backgroundTexture();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 5000);
camera.position.set(0, 0, 26);

const key = new THREE.DirectionalLight('#ffffff', 2.0);
key.position.set(6, 9, 12);
const rim = new THREE.DirectionalLight('#7c6cff', 2.4);
rim.position.set(-10, -3, -8);
scene.add(key, rim, new THREE.HemisphereLight('#a8b4ff', '#0b0d1f', 0.5));

const world = new THREE.Group();
scene.add(world);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function backgroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(220, 230, 20, 256, 256, 380);
  grad.addColorStop(0, '#171d44');
  grad.addColorStop(0.55, '#0a0d24');
  grad.addColorStop(1, '#040510');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- Drifting particles that stream past while zooming ----------
const PARTICLES = 1100;
const pPos = new Float32Array(PARTICLES * 3);
const tmp = new THREE.Vector3();
function spawn(i: number, rMin: number, rMax: number) {
  const r = rMin * Math.pow(rMax / rMin, Math.random());
  tmp.randomDirection().multiplyScalar(r);
  if (tmp.z > 12) tmp.z = -tmp.z;
  tmp.toArray(pPos, i * 3);
}
for (let i = 0; i < PARTICLES; i++) spawn(i, 1.5, 90);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({
    size: 0.09,
    map: dotTexture(),
    color: '#93a4ff',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
world.add(particles);

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function flowParticles(dLog: number) {
  if (dLog === 0) return;
  const k = Math.exp(dLog);
  for (let i = 0; i < PARTICLES; i++) {
    tmp.fromArray(pPos, i * 3).multiplyScalar(k);
    const r = tmp.length();
    if (r > 95 || tmp.z > 18) spawn(i, 1.2, 4);
    else if (r < 1.0) spawn(i, 60, 95);
    else tmp.toArray(pPos, i * 3);
  }
  pGeo.attributes.position.needsUpdate = true;
}

// ---------- Levels ----------
let traitKey: TraitKey = 'eye';
let levels: Level[] = [];

function buildLevels(k: TraitKey): Level[] {
  const t = genome.traits[k];
  const trait = TRAITS[k];
  const l0 = buildGenomeLevel(k, t);
  const l1 = buildChromosomeLevel(t, l0.childScale);
  const l2 = buildRegionLevel(t);
  const l3 = buildGeneLevel(t);
  const l4 = buildBasesLevel(t, trait.crumbs[4], trait.notes);
  return [l0, l1, l2, l3, l4];
}

function disposeLevels() {
  for (const l of levels) {
    world.remove(l.group);
    for (const lab of l.labels) lab.element.remove();
    l.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    for (const { m } of l.materials) m.dispose();
  }
}

function setTrait(k: TraitKey) {
  disposeLevels();
  traitKey = k;
  levels = buildLevels(k);
  for (const l of levels) world.add(l.group);
  prevLog = logZoom(t);
  ui.setTrait(TRAITS[k]);
  shownLevel = -1;
}

/** Log of the total magnification at zoom position t. */
function logZoom(tz: number) {
  let g = 0;
  for (let i = 0; i < MAX_T; i++) {
    const f = THREE.MathUtils.clamp(tz - i, 0, 1);
    g += -Math.log(levels[i].childScale) * f;
  }
  return g;
}

const smooth = THREE.MathUtils.smoothstep;
function layout(tz: number) {
  const k = Math.min(Math.floor(tz), MAX_T - 1);
  const f = tz - k;
  levels.forEach((l, i) => {
    if (i !== k && i !== k + 1) setLevelOpacity(l, 0);
  });
  const parent = levels[k];
  const child = levels[k + 1];
  const s = parent.childScale;
  const S = Math.pow(1 / s, f);
  // Zoom about the fixed point q, chosen so the anchor lands on the origin exactly when f = 1.
  const q = parent.anchor.clone().divideScalar(1 - s);
  parent.group.scale.setScalar(S);
  parent.group.position.copy(q).multiplyScalar(1 - S);
  // The child follows the anchor exactly, but its own growth starts from at most 1/12 scale. Huge
  // ratios (e.g. 780x from gene to helix) would otherwise leave it a sliver until the very end.
  const sc = Math.max(s, 1 / 12);
  const ca = Math.pow(sc, 1 - f);
  child.group.scale.setScalar(ca);
  if (child.radius) {
    const widen = Math.min(4, Math.max(1, MIN_APPARENT_RADIUS / (child.radius * ca)));
    const w = THREE.MathUtils.lerp(widen, 1, smooth(ca, 0.4, 1));
    child.group.scale.x = child.group.scale.z = ca * w;
  }
  child.group.position.copy(parent.anchor).sub(q).multiplyScalar(S).add(q);
  // Open a dissolving portal in the parent around the child, sized to the child's apparent height,
  // and fade the child in once it is big enough to read.
  const into = smooth(f, 0.12, 0.6);
  const out = Math.max(smooth(f, 0.6, 0.95), smooth(Math.log(S), Math.log(8 / parent.engulf), Math.log(32 / parent.engulf)));
  setLevelOpacity(parent, 1 - out, 1 - smooth(f, 0.04, 0.3), 1 - smooth(f, 0.12, 0.4));
  setLevelOpacity(child, into, into * smooth(f, 0.6, 0.95), into * smooth(f, 0.72, 0.98));
  for (const l of levels) l.portal.radius.value.set(-2, -1);
  world.updateMatrixWorld();
  const c = child.group.getWorldPosition(scratch.a).project(camera);
  const top = scratch.b.set(0, (H_CHILD / 2) * ca, 0).add(child.group.position).applyMatrix4(world.matrixWorld).project(camera);
  const px = renderer.getPixelRatio();
  const cx = (c.x * 0.5 + 0.5) * window.innerWidth * px;
  const cy = (c.y * 0.5 + 0.5) * window.innerHeight * px;
  const half = Math.abs(top.y - c.y) * 0.5 * window.innerHeight * px;
  parent.portal.center.value.set(cx, cy);
  const diag = Math.hypot(window.innerWidth, window.innerHeight) * px;
  const outer = Math.max(half * 1.6 * into, diag * 0.75 * smooth(f, 0.12, 0.85)) + 1;
  parent.portal.radius.value.set(outer * 0.4, outer);
}

const H_CHILD = 16;
/** Smallest apparent half-width (world units) a thin level keeps while zooming in. */
const MIN_APPARENT_RADIUS = 0.45;
const scratch = { a: new THREE.Vector3(), b: new THREE.Vector3() };

function spanAt(tz: number) {
  const k = Math.min(Math.floor(tz), MAX_T - 1);
  const f = tz - k;
  return Math.exp(Math.log(levels[k].span) * (1 - f) + Math.log(levels[k + 1].span) * f);
}

// ---------- Interaction ----------
let t = 0;
let target = 0;
let pendingTrait: TraitKey | null = null;
let shownLevel = -1;
let lastInput = 0;
let yaw = 0;
let pitch = 0;
let yawT = 0;
let pitchT = 0;
let prevLog = 0;

const ui = createUI({
  onTrait(k) {
    if (k === traitKey && !pendingTrait) return;
    pendingTrait = k;
    target = 0;
    ui.markTrait(k);
  },
  onLevel(i) {
    target = i;
    lastInput = performance.now();
  },
  onAllele(b) {
    (levels[4] as BasesLevel).setAllele(b);
  },
});

const clampT = (v: number) => THREE.MathUtils.clamp(v, 0, MAX_T);
function nudge(d: number) {
  if (pendingTrait) return;
  target = clampT(target + d);
  lastInput = performance.now();
}

renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.0016;
    nudge(-e.deltaY * unit * (e.ctrlKey ? 2.5 : 1));
  },
  { passive: false },
);

const pointers = new Map<number, { x: number; y: number }>();
let pinch = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  renderer.domElement.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) pinch = pinchDist();
});
renderer.domElement.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (pointers.size === 1) {
    yawT = THREE.MathUtils.clamp(yawT + (e.clientX - p.x) * 0.005, -1.1, 1.1);
    pitchT = THREE.MathUtils.clamp(pitchT + (e.clientY - p.y) * 0.004, -0.6, 0.6);
  }
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 2) {
    const d = pinchDist();
    nudge(Math.log(d / pinch) * 1.6);
    pinch = d;
  }
});
const release = (e: PointerEvent) => pointers.delete(e.pointerId);
renderer.domElement.addEventListener('pointerup', release);
renderer.domElement.addEventListener('pointercancel', release);
renderer.domElement.addEventListener('dblclick', () => nudge(Math.floor(target + 1) - target));
function pinchDist() {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y) || 1;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === '+' || e.key === '=') nudge(Math.floor(target + 1) - target);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === '-') nudge(Math.ceil(target - 1) - target);
  else if (e.key === 'r') yawT = pitchT = 0;
});

// ---------- Layout ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);

  // Fit the content box into the area not covered by the UI, and centre it there.
  const free = ui.freeArea(w, h);
  const cx = (free.left + free.right) / 2;
  const cy = (free.top + free.bottom) / 2;
  const unitsPerPx = Math.max(18.5 / (free.right - free.left), 16.8 / (free.bottom - free.top));
  const dx = w / 2 - cx;
  const dy = h / 2 - cy;
  const fw = w + 2 * Math.abs(dx);
  const fh = h + 2 * Math.abs(dy);
  // The vertical field of view spans the full (offset) frame, not just the canvas.
  const fov = THREE.MathUtils.degToRad(camera.fov);
  camera.position.z = (unitsPerPx * fh) / (2 * Math.tan(fov / 2));
  camera.aspect = fw / fh;
  camera.setViewOffset(fw, fh, dx > 0 ? 2 * dx : 0, dy > 0 ? 2 * dy : 0, w, h);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// Test hook: jump straight to a zoom position, e.g. __dnaview.jump(2.5).
Object.assign(window, {
  __dnaview: {
    jump(v: number) {
      t = target = clampT(v);
      lastInput = performance.now() + 1e9;
    },
  },
});

// ---------- Loop ----------
setTrait('eye');
resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.25);
  const time = clock.elapsedTime;
  const now = performance.now();

  // Soft snap to the nearest level after the user stops zooming.
  if (!pendingTrait && pointers.size < 2 && now - lastInput > 750) {
    const r = Math.round(target);
    if (Math.abs(target - r) < 0.3) target += (r - target) * (1 - Math.exp(-dt * 6));
  }
  const speed = pendingTrait ? 3.2 : 4.5;
  t += (target - t) * (1 - Math.exp(-dt * speed));
  if (Math.abs(target - t) < 1e-4) t = target;

  if (pendingTrait && t < 0.01) {
    t = target = 0;
    setTrait(pendingTrait);
    pendingTrait = null;
  }

  yaw += (yawT - yaw) * (1 - Math.exp(-dt * 6));
  pitch += (pitchT - pitch) * (1 - Math.exp(-dt * 6));
  world.rotation.set(pitch, yaw + Math.sin(time * 0.15) * 0.06, 0);

  layout(t);
  const g = logZoom(t);
  flowParticles(g - prevLog);
  prevLog = g;
  particles.rotation.y = time * 0.004;

  for (const l of levels) {
    if (!l.group.visible) continue;
    l.update?.(time, dt);
    const pulse = 1 + 0.07 * Math.sin(time * 3.2);
    for (const p of l.pulses) p.scale.setScalar(pulse);
  }

  const idx = Math.round(t);
  if (idx !== shownLevel) {
    shownLevel = idx;
    ui.setLevel(idx);
  }
  ui.setProgress(t, spanAt(t));

  composer.render();
  labelRenderer.render(scene, camera);
});
