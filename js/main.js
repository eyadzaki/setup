import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildScene, applyMode } from './scene.js';
import { SCENE, SCENE_BY_ID, PRODUCTS } from './data.js';
import { initUI } from './ui.js';
import { createLive } from './live.js';
import { createSeat } from './seat.js';
import { createInteractions, play } from './interact.js';

const canvas = document.getElementById('scene');
const loaderBar = document.getElementById('loader-bar');
loaderBar.style.width = '60%'; // three.js is in
const coarse = matchMedia('(pointer: coarse)').matches;
const lowEnd = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse || devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.body.classList.add('no-webgl');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.25 : coarse ? 1.75 : 2));
renderer.setClearColor(0x000000, 0);

const world = buildScene();
const { scene, items } = world;
const live = createLive({
  screenMesh: items['monitor-center'].userData.screen,
  container: canvas.parentElement,
  onChange: () => { dirty = true; ui?.onModeChange(); },
});
const seat = createSeat(canvas);
const interact = createInteractions({ world, getMode: () => mode });
const activeCamera = () => (seat.on ? seat.camera : camera);
// The Kick player shows whenever the center monitor is on the Kick page.
const syncLive = () => live.setMode(world.screens.view('center') === 'kick' ? 'stream' : '');

/* ---------- camera: isometric-ish orthographic, side angle ---------- */
const TARGET = new THREE.Vector3(0.85, 1.0, 0.85);
const AZ0 = Math.PI / 4 - 0.38;
const POLAR0 = 0.92; // high enough to see the desk over the recliner
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
const R = 12;
camera.position.set(
  TARGET.x + R * Math.sin(POLAR0) * Math.sin(AZ0),
  TARGET.y + R * Math.cos(POLAR0),
  TARGET.z + R * Math.sin(POLAR0) * Math.cos(AZ0));
camera.lookAt(TARGET);
camera.zoom = 1.25; // open close on the desk; zoom out to see the whole room

const controls = new OrbitControls(camera, canvas);
controls.target.copy(TARGET);
controls.enablePan = false;
controls.enableDamping = !reduceMotion;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.6;
controls.minAzimuthAngle = 0.08;
controls.maxAzimuthAngle = 1.45;
controls.minPolarAngle = 0.62;
controls.maxPolarAngle = 1.22;
controls.minZoom = 0.85;
controls.maxZoom = 3.2;
// The plain wheel scrolls the page (the parts list is below); Ctrl/⌘ + wheel
// and trackpad pinch (which arrives as ctrl+wheel) zoom the scene.
controls.enableZoom = false;
// ...but phones still pinch to zoom: OrbitControls' own zoom only for touch.
canvas.addEventListener('pointerdown', e => { controls.enableZoom = e.pointerType === 'touch'; });
canvas.addEventListener('wheel', e => {
  if (seat.on || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  tween = null;
  camera.zoom = THREE.MathUtils.clamp(camera.zoom * Math.exp(-e.deltaY * 0.004), controls.minZoom, controls.maxZoom);
  camera.updateProjectionMatrix();
  dirty = true;
}, { passive: false });
// Phones: one finger scrolls the page (to the parts list below), two fingers
// turn and zoom the scene. -1 = no action for a single finger.
controls.touches = { ONE: -1, TWO: THREE.TOUCH.DOLLY_ROTATE };
canvas.style.touchAction = 'pan-y';

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  // Fit the whole diorama: tall phones need more vertical room.
  // Wide screens: push the diorama away from the hero text (which sits on the
  // right in RTL). Narrower screens: lift it above the hero text at the bottom.
  let half, sx = 0, sy;
  if (aspect >= 1.2) { half = Math.max(1.78, 2.0 / aspect); sx = half * aspect * 0.2; sy = -half * 0.02; }
  else if (aspect >= 0.75) { half = Math.max(2.15, 2.1 / aspect); sy = half * 0.1; }
  else { half = 1.55 / aspect; sy = half * 0.05; }
  camera.left = -half * aspect + sx; camera.right = half * aspect + sx;
  camera.top = half - sy; camera.bottom = -half - sy;
  camera.updateProjectionMatrix();
  seat.setAspect(aspect);
  topY = topbar.getBoundingClientRect().bottom;
  dirty = true;
}

/* ---------- anchors: where each hotspot sits on its item ---------- */
const ANCHOR_OVERRIDE = {
  desk: [0.52, 0.74, 1.0],
  'mic-arm': [0.625, 0.95, 0.44],
  'pad-xl': [0.78, 0.76, 0.46],
  'pad-l': [1.17, 0.76, 0.47],
  'cam-stand': [0.86, 1.36, 0.07],
  chair: [1.32, 1.12, 1.32],
  case: [0.42, 0.46, 1.08],
};
const anchors = {};
for (const s of SCENE) {
  const o = ANCHOR_OVERRIDE[s.id];
  if (o) anchors[s.id] = new THREE.Vector3(...o);
  else {
    const b = new THREE.Box3().setFromObject(items[s.id]);
    anchors[s.id] = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.02, (b.min.z + b.max.z) / 2);
  }
}
// Anchors live in the diorama's own space; the parallax tilt moves that space.
const anchorOf = (id, out = new THREE.Vector3()) => out.copy(anchors[id]).applyMatrix4(world.root.matrixWorld);

/* ---------- parallax: the diorama leans a hair toward the pointer / phone tilt ---------- */
const PIVOT = new THREE.Vector3(0.85, 0.9, 0.85);
const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
if (!reduceMotion) {
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tilt.tx = (e.clientX / innerWidth - 0.5) * 2;
    tilt.ty = (e.clientY / innerHeight - 0.5) * 2;
  });
  // Phones that report tilt without asking for permission (Android) lean too.
  addEventListener('deviceorientation', e => {
    if (e.gamma == null) return;
    tilt.tx = THREE.MathUtils.clamp(e.gamma / 25, -1, 1);
    tilt.ty = THREE.MathUtils.clamp((e.beta - 45) / 25, -1, 1);
  });
}
const q = new THREE.Quaternion(), eul = new THREE.Euler();
function stepTilt() {
  const tx = seat.on ? 0 : tilt.tx, ty = seat.on ? 0 : tilt.ty;
  if (Math.abs(tx - tilt.x) + Math.abs(ty - tilt.y) < 0.002) return false;
  tilt.x += (tx - tilt.x) * 0.08;
  tilt.y += (ty - tilt.y) * 0.08;
  // rotate the diorama about PIVOT: position = PIVOT - R * PIVOT
  q.setFromEuler(eul.set(tilt.y * 0.025, tilt.x * 0.045, 0));
  world.root.quaternion.copy(q);
  world.root.position.copy(PIVOT).sub(PIVOT.clone().applyQuaternion(q));
  world.root.updateMatrixWorld();
  return true;
}

/* ---------- render on demand ---------- */
let dirty = true;
let visible = true;
let lastScreen = 0;
let onFrame = () => {};
controls.addEventListener('change', () => { dirty = true; });
controls.addEventListener('start', () => { tween = null; });
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

// Cinematic camera move used when a card focuses an item: slow ease-in-out,
// a gentle orbit arc on the way, and a slight pull-back before pushing in.
let tween = null;
const sph = new THREE.Spherical();
function tweenTo(target, zoom, ms = 1600) {
  sph.setFromVector3(camera.position.clone().sub(controls.target));
  const dist = controls.target.distanceTo(target);
  tween = {
    t0: performance.now(), ms: reduceMotion ? 1 : ms,
    fromT: controls.target.clone(), toT: target, fromZ: camera.zoom, toZ: zoom,
    r: sph.radius, phi: sph.phi, theta: sph.theta,
    arc: Math.min(0.12, dist * 0.18),     // farther jumps swing a little more
    dip: Math.min(0.12, dist * 0.15),     // and breathe out a little more
  };
}
const easeInOut = k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
function stepTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.t0) / tween.ms);
  const e = easeInOut(k);
  const bump = Math.sin(Math.PI * e);   // 0 at both ends, 1 in the middle
  controls.target.lerpVectors(tween.fromT, tween.toT, e);
  const theta = THREE.MathUtils.clamp(tween.theta + bump * tween.arc, controls.minAzimuthAngle, controls.maxAzimuthAngle);
  const phi = THREE.MathUtils.clamp(tween.phi - bump * tween.arc * 0.4, controls.minPolarAngle, controls.maxPolarAngle);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSphericalCoords(tween.r, phi, theta));
  camera.zoom = THREE.MathUtils.lerp(tween.fromZ, tween.toZ, e) * (1 - bump * tween.dip);
  camera.updateProjectionMatrix();
  dirty = true;
  if (k >= 1) tween = null;
}

function loop(t) {
  requestAnimationFrame(loop);
  if (!visible) return;
  stepTween(t);
  if (!seat.on) controls.update();
  if (seat.update(t) | interact.tick(t) | stepTilt() | stepDrop(t)) dirty = true;
  // Screens refresh ~10x a second; that is also the idle frame rate.
  if (t - lastScreen > 100) {
    lastScreen = t;
    world.screens.tick(t);
    dirty = true;
  }
  if (dirty) {
    const cam = activeCamera();
    renderer.render(scene, cam);
    live.place(cam, canvas.clientWidth, canvas.clientHeight);
    onFrame();
    dirty = false;
  }
}

/* ---------- modes ---------- */
let mode = 'stream';
const modeButtons = document.querySelectorAll('[data-mode]');
function setMode(name) {
  mode = name;
  applyMode(world, name);
  syncLive();
  document.documentElement.dataset.mode = name;
  modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === name)));
  dirty = true;
  ui?.onModeChange();
}
modeButtons.forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); play('on'); }));

/* ---------- entrance: the pieces drop onto the desk one after another ---------- */
let drop = null;
function startDrop() {
  if (reduceMotion) { document.body.classList.add('landed'); return; }
  const order = [...SCENE].sort((a, b) => a.num - b.num).map(s => s.id);
  // furniture first, then the rest left to right
  order.sort((a, b) => (b === 'desk' || b === 'chair') - (a === 'desk' || a === 'chair'));
  drop = { t0: performance.now(), list: order.map((id, i) => ({ g: items[id], y: items[id].position.y, delay: i * 55 })) };
  for (const d of drop.list) d.g.position.y = d.y + 0.6;
}
const easeOutBack = k => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;
function stepDrop(now) {
  if (!drop) return false;
  let done = true;
  for (const d of drop.list) {
    const k = THREE.MathUtils.clamp((now - drop.t0 - d.delay) / 520, 0, 1);
    d.g.position.y = d.y + 0.6 * (1 - easeOutBack(k));
    if (k < 1) done = false;
  }
  if (done) { for (const d of drop.list) d.g.position.y = d.y; drop = null; document.body.classList.add('landed'); }
  return true;
}

/* ---------- picking & highlight ---------- */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
const pickables = [];
Object.values(items).forEach(g => g.traverse(o => { if (o.isMesh) pickables.push(o); }));
const label = document.getElementById('hover-label');
const hlCache = new WeakMap();
const lit = new Set();

function highlight(id, on) {
  const g = items[id];
  if (!g || on === lit.has(id)) return;
  on ? lit.add(id) : lit.delete(id);
  g.traverse(o => {
    if (!o.isMesh || !o.material.isMeshToonMaterial) return;
    if (on) {
      o.userData.baseMat = o.material;
      if (!hlCache.has(o.material)) {
        const m = o.material.clone();
        m.emissive.setHex(0x5a1a8a);
        m.emissiveIntensity = 0.55;
        hlCache.set(o.material, m);
      }
      o.material = hlCache.get(o.material);
    } else if (o.userData.baseMat) {
      o.material = o.userData.baseMat;
    }
  });
  dirty = true;
}

function pick(e) {
  const r = canvas.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, activeCamera());
  const hit = ray.intersectObjects(pickables, false)[0];
  return hit ? hit.object.userData.id : null;
}

let hovered = null;
let selected = null;
const nameOf = id => `${SCENE_BY_ID[id].label} · ${PRODUCTS[SCENE_BY_ID[id].product].name}`;

canvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || e.buttons) return;
  const id = pick(e);
  if (id !== hovered) {
    if (hovered && hovered !== selected) highlight(hovered, false);
    hovered = id;
    if (id) highlight(id, true);
  }
  canvas.style.cursor = id ? 'pointer' : 'grab';
  if (id && SCENE_BY_ID[id]) {
    label.textContent = `${SCENE_BY_ID[id].num} · ${nameOf(id)}`;
    label.style.transform = `translate(${e.clientX}px, ${e.clientY - 18}px) translate(-50%, -100%)`;
    label.hidden = false;
  } else label.hidden = true;
});
canvas.addEventListener('pointerleave', () => {
  if (hovered && hovered !== selected) highlight(hovered, false);
  hovered = null;
  label.hidden = true;
});

// A tap opens a card; a drag only turns the scene.
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 600;
  down = null;
  if (moved > 6 || !quick) return;
  const id = pick(e);
  if (id) { interact.react(id); ui.open(id); }
});

/* ---------- hotspots ---------- */
const hotLayer = document.getElementById('hotspots');
const topbar = document.querySelector('.topbar');
let topY = 0; // hotspots never sit under the top bar (measured on resize)
const hotEls = {};
const v = new THREE.Vector3();

function numberItems() {
  // Number left to right as the scene first appears.
  camera.updateMatrixWorld();
  const xs = SCENE.map(s => [s, v.copy(anchors[s.id]).project(camera).x]);
  xs.sort((a, b) => a[1] - b[1]).forEach(([s], i) => { s.num = i + 1; });
}

function buildHotspots() {
  for (const s of SCENE) {
    const b = document.createElement('button');
    b.className = 'hotspot';
    b.type = 'button';
    b.textContent = s.num;
    b.setAttribute('aria-label', `${s.num}: ${nameOf(s.id)}`);
    b.addEventListener('click', () => ui.open(s.id));
    b.addEventListener('mouseenter', () => highlight(s.id, true));
    b.addEventListener('mouseleave', () => { if (s.id !== selected) highlight(s.id, false); });
    hotLayer.appendChild(b);
    hotEls[s.id] = b;
  }
}

function placeHotspots() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const cam = activeCamera();
  for (const s of SCENE) {
    anchorOf(s.id, v).project(cam);
    const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
    const el = hotEls[s.id];
    const off = v.z > 1 || x < -20 || x > w + 20 || y < topY || y > h + 20; // z > 1: behind you
    el.style.translate = `${x}px ${y}px`; // `translate`, so the hover `scale` grows in place
    el.classList.toggle('off', off);
    hotPos[s.id] = [x, y];
  }
  markNear();
}

// Dots grow into numbered badges when the mouse comes near them.
const hotPos = {};
let mouseAt = null;
const NEAR = 70;
function markNear() {
  for (const s of SCENE) {
    const p = hotPos[s.id];
    const near = !!(mouseAt && p && Math.hypot(p[0] - mouseAt[0], p[1] - mouseAt[1]) < NEAR);
    hotEls[s.id].classList.toggle('near', near);
  }
}
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const r = canvas.getBoundingClientRect();
  mouseAt = [e.clientX - r.left, e.clientY - r.top];
  markNear();
});
document.addEventListener('pointerleave', () => { mouseAt = null; markNear(); });
onFrame = placeHotspots;

/* ---------- stage API used by the UI ---------- */
let home = null; // view to return to after closing a card

const stage = {
  get mode() { return mode; },
  get isLive() { return live.isLive; },
  order: () => [...SCENE].sort((a, b) => a.num - b.num).map(s => s.id),
  select(id) {
    if (selected && selected !== id) highlight(selected, false);
    selected = id;
    if (id) highlight(id, true);
    for (const s of SCENE) hotEls[s.id].classList.toggle('active', s.id === id);
    document.body.classList.toggle('has-selection', !!id);
  },
  setFound(ids) { for (const s of SCENE) hotEls[s.id].classList.toggle('found', ids.has(s.product)); },
  // Bring an item to the middle of the area the card leaves free.
  focus(id, insets) {
    if (seat.on) { seat.lookAt(anchorOf(id)); return; }
    if (!home) home = { target: controls.target.clone(), zoom: camera.zoom };
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const gx = insets.left + (w - insets.left - insets.right) / 2;
    const gy = insets.top + (h - insets.top - insets.bottom) / 2;
    const goal = new THREE.Vector2(gx / w * 2 - 1, 1 - gy / h * 2);
    const zoom = Math.max(camera.zoom, coarse ? 1.9 : 1.8);
    // Solve where the target must go so the anchor lands on `goal` at `zoom`.
    const saved = { t: controls.target.clone(), p: camera.position.clone(), z: camera.zoom };
    const offset = camera.position.clone().sub(controls.target);
    const a = anchorOf(id);
    camera.position.copy(a).add(offset);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const ndc = a.clone().project(camera);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const delta = right.multiplyScalar((goal.x - ndc.x) * (camera.right - camera.left) / (2 * zoom))
      .add(up.multiplyScalar((goal.y - ndc.y) * (camera.top - camera.bottom) / (2 * zoom)));
    camera.position.copy(saved.p);
    camera.zoom = saved.z;
    camera.updateProjectionMatrix();
    tweenTo(a.clone().sub(delta), zoom);
  },
  unfocus() {
    if (seat.on) { seat.restore(); return; }
    if (home) tweenTo(home.target, home.zoom);
    home = null;
  },
  // Only the chair has no product photo (it has no link either).
  thumbs: () => ({ chair: snapshot(['chair'], [items.chair], 0.78) }),
  actions: id => interact.actions(id),
  screenView: slot => world.screens.view(slot),
  run(id, key) {
    if (key === 'sit') { stage.sit(); return; }
    interact.run(id, key);
    syncLive();
    dirty = true;
  },
  get seated() { return seat.on; },
  // Into the recliner and back out, through a short fade.
  sit() { switchView(true); },
  stand() { switchView(false); },
};

// A product-shot of one piece, rendered from the scene on its own (for parts
// with no maker photo). Transparent PNG, framed from the room side.
function snapshot(ids, focus, fit = 1, w = 480, h = 360) {
  const keep = ids.map(id => items[id]);
  const hidden = world.root.children.filter(o => !keep.includes(o) && o.visible);
  hidden.forEach(o => { o.visible = false; });
  const box = new THREE.Box3();
  focus.forEach(g => box.expandByObject(g));
  const c = box.getCenter(new THREE.Vector3()), r = box.getBoundingSphere(new THREE.Sphere()).radius;
  const cam = new THREE.PerspectiveCamera(28, w / h, 0.01, 20);
  const dir = new THREE.Vector3(0.9, 0.45, 1).normalize();
  cam.position.copy(c).addScaledVector(dir, r / Math.sin(THREE.MathUtils.degToRad(14)) * fit);
  cam.lookAt(c);
  // studio light for the shot
  const was = [world.fx.hemi.intensity, world.fx.sun.intensity];
  world.fx.hemi.intensity = 3.4; world.fx.sun.intensity = 1.6;
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
  renderer.setRenderTarget(null);
  rt.dispose();
  hidden.forEach(o => { o.visible = true; });
  [world.fx.hemi.intensity, world.fx.sun.intensity] = was;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const img = cv.getContext('2d').createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); // flip rows
  cv.getContext('2d').putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}

const fade = document.getElementById('fade');
let switching = false;
function switchView(sit) {
  if (switching || seat.on === sit) return;
  switching = true;
  fade.classList.add('on');
  setTimeout(() => {
    if (sit) { tween = null; seat.enter(reduceMotion); } else seat.exit();
    controls.enabled = !sit;
    canvas.style.touchAction = sit ? 'none' : 'pan-y'; // in the chair one finger looks around
    document.body.classList.toggle('seated', sit);
    label.hidden = true;
    dirty = true;
    fade.classList.remove('on');
    switching = false;
    ui.onSeatChange(sit);
  }, reduceMotion ? 0 : 280);
}
document.getElementById('seat-btn').addEventListener('click', () => stage.sit());
document.getElementById('stand-btn').addEventListener('click', () => stage.stand());

/* ---------- boot ---------- */
addEventListener('resize', resize);
resize();
numberItems();
buildHotspots();
const ui = initUI(stage);
document.fonts.load("600 16px 'IBM Plex Sans Arabic'").finally(() => {
  loaderBar.style.width = '100%';
  setMode('stream');
  resize(); // the top bar's height settles once the font is in
  startDrop();
  requestAnimationFrame(loop);
  const og = new URLSearchParams(location.search).has('og');
  if (og) { document.body.classList.add('og-shot'); camera.zoom = 1.45; camera.updateProjectionMatrix(); }
  setTimeout(() => { document.body.classList.add('ready'); if (!og) ui.boot(); }, 250);
});
