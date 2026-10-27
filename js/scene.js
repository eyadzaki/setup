// The arcade diorama: a floating room corner with the L desk and every item.
// Units are meters, sized from the real setup (desk 128×128×48 cm, monitor
// riser 10 cm high running the whole L, three flat 27" monitors).
// The corner of the two walls sits at the origin; the left (green) wall is the
// x=0 plane, the blind wall is the z=0 plane, the room grows toward +x / +z.
// Nothing here casts real-time shadows: soft "blob" shadows are transparent
// planes, which keeps phones fast.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createScreens } from './screens.js';

export const PURPLE = 0xc04bff;
const LED = 0xb58cff; // the soft purple of the riser LED

const OFF = 0.04;      // desk gap from the walls
const LEN = 1.28;      // each wing, wall side
const DEP = 0.48;      // desk depth
const DY = 0.75;       // desk top height
const DT = 0.025;      // desk top thickness
const RD = 0.20;       // riser depth
const RT = 0.018;      // riser board thickness
const RY = DY + 0.10;  // riser top
const CH = 0.96;       // riser corner chamfer: front edge is the line x + z = CH
const END = OFF + LEN; // far end of both wings
const FRONT = OFF + DEP;

// Monitors: 27" panels, side ones parallel to their walls, the center one at
// 45° in the corner. Their edges meet with a hair gap and never overlap.
const MW = 0.614, MH = 0.366;
const SIDE_PLANE = 0.17;                                  // side screens' front face, distance from wall
const MC = SIDE_PLANE + (MW / 2) * Math.SQRT1_2;         // center monitor at (MC, MC)
const SIDE_C = MC + (MW / 2) * Math.SQRT1_2 + 0.006 + MW / 2; // side monitors' center along their wing

const USER = new THREE.Vector2(1.2, 1.2); // the recliner

/* ---------- materials & geometry caches ---------- */

const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const matCache = new Map();
function toon(color, extra) {
  const key = color + JSON.stringify(extra || {});
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra }));
  return matCache.get(key);
}
const basic = (color, extra) => new THREE.MeshBasicMaterial({ color, ...extra });

const geoCache = new Map();
function boxGeo(w, h, d, r = 0) {
  const key = [w, h, d, r].join();
  if (!geoCache.has(key)) geoCache.set(key, r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
  return geoCache.get(key);
}

function box(parent, w, h, d, mat, x, y, z, r = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d, r), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function cyl(parent, rt, rb, h, mat, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
// Cylinder spanning two points (used for arms, poles, tripod legs).
function rod(parent, a, b, r, mat, seg = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), seg), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(m);
  return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Turn a group so its local +Z faces the point (tx, tz).
function faceToward(obj, tx, tz) {
  obj.rotation.y = Math.atan2(tx - obj.position.x, tz - obj.position.z);
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
// Flat board from an (x, z) outline; its top sits at height `top`.
function board(parent, pts, top, thick, mats) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); // shape y -> world z, extrusion goes downward
  const m = new THREE.Mesh(geo, mats);
  m.position.y = top;
  parent.add(m);
  return m;
}

const shadowTex = canvasTex(128, 128, (x, w, h) => {
  const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.6, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
function blob(parent, w, d, x, y, z, rot = 0, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity }));
  m.rotation.set(-Math.PI / 2, 0, rot);
  m.position.set(x, y, z);
  m.renderOrder = 1;
  parent.add(m);
  return m;
}

/* ---------- build ---------- */

export function buildScene() {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const items = {};        // id -> group
  const fx = { ledColor: LED, ledOverride: null, ringOverride: null }; // things the modes switch
  const screens = createScreens();

  const item = (id, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.userData.id = id;
    root.add(g);
    items[id] = g;
    return g;
  };

  /* lights */
  fx.hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a3050, 2.2);
  scene.add(fx.hemi);
  fx.sun = new THREE.DirectionalLight(0xffd9a8, 2.2);
  fx.sun.position.set(1.6, 2.6, -1.4);
  fx.sun.target.position.set(1, 0, 1);
  scene.add(fx.sun, fx.sun.target);
  fx.moon = new THREE.DirectionalLight(0x9bb8ff, 0); // night light through the glass door
  fx.moon.position.set(1.6, 2.4, -1.6);
  fx.moon.target.position.set(1, 0, 1);
  scene.add(fx.moon, fx.moon.target);
  fx.fill = new THREE.DirectionalLight(0xd8d4ff, 0.6);
  fx.fill.position.set(3, 3, 3);
  scene.add(fx.fill);
  fx.ledLight = new THREE.PointLight(LED, 0, 1.1, 1.6); // the riser LED on the desk top
  fx.ledLight.position.set(0.42, DY + 0.08, 0.42);
  fx.ringLight = new THREE.PointLight(0xfff0dc, 0, 2.6, 1.4);
  fx.ringLight.position.set(0.45, 1.6, 0.45);
  fx.screenLight = new THREE.PointLight(0x8a7bff, 0, 2.0, 1.4);
  fx.screenLight.position.set(0.7, 1.15, 0.7);
  fx.pcLight = new THREE.PointLight(PURPLE, 0, 1.2, 1.6);
  fx.pcLight.position.set(0.62, 0.3, 1.08);
  scene.add(fx.ledLight, fx.ringLight, fx.screenLight, fx.pcLight);

  buildRoom(root, fx);
  buildDesk(item('desk', 0, 0, 0), fx);
  buildMonitors(item, screens);
  buildPC(item('case', 0.26, 0, 1.08), fx);
  buildHeadphones(item('headphones', 0.40, 0, END + 0.045));
  buildKeyboard(item('keyboard', 0.37, DY, 0.78));
  buildController(item('controller', 0.37, DY, 1.12));
  buildInterface(item('interface', 0.45, DY, 0.45));
  buildBattery(item('battery', 0.62, DY, 0.38));
  buildPads(item('pad-xl', 0.985, DY, 0.38), item('pad-l', 1.06, DY + 0.004, 0.385));
  buildMouse(item('mouse', 1.07, DY + 0.008, 0.40));
  buildMic(item('mic-arm', 0, 0, 0), item('mic', 0, 0, 0));
  buildRingLight(item('ringlight', 0.022, 0, 0.022), fx);
  buildWebcam(item('cam-stand', 0.86, RY, 0.07), item('webcam', 0, 0, 0));
  buildChair(item('chair', USER.x, 0, USER.y));
  buildDecor(root);

  // tag every mesh with its item id so raycasts know what was hit
  for (const [id, g] of Object.entries(items)) g.traverse(o => { if (o.isMesh) o.userData.id = id; });

  return { scene, root, items, fx, screens };
}

function buildRoom(root, fx) {
  const tiles = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#e4d3ab'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#c9b085'; x.lineWidth = 3;
    for (let i = -h; i < w + h; i += 64) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke();
      x.beginPath(); x.moveTo(i + h, 0); x.lineTo(i, h); x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 64, j * 64, 64, 64);
  }, 3);
  const side = toon('#b49a6c');
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.14, 2.48),
    [side, side, new THREE.MeshToonMaterial({ map: tiles, gradientMap: gradient }), side, side, side]);
  slab.position.set(1.16, -0.07, 1.16);
  root.add(slab);
  // darker lip under the slab sells the "floating diorama"
  box(root, 2.4, 0.06, 2.4, toon('#6d5a3e'), 1.18, -0.17, 1.18);

  // Left wall: the light green paint from the photos.
  box(root, 0.08, 2.2, 2.4, toon('#a6c48f'), -0.04, 1.1, 1.24);
  box(root, 0.1, 0.03, 2.42, toon('#d6e6c8'), -0.04, 2.215, 1.24);
  box(root, 0.012, 0.07, 2.4, toon('#86a872'), 0.006, 0.035, 1.24);

  // Right wall: the same green paint, with a big sliding glass door behind a
  // zebra blind that leaves some wall showing on both sides.
  box(root, 2.48, 2.2, 0.08, toon('#a6c48f'), 1.16, 1.1, -0.04);
  box(root, 2.5, 0.03, 0.1, toon('#d6e6c8'), 1.16, 2.215, -0.04);
  const DX0 = 0.32, DX1 = 2.08, DTOP = 2.05, DC = (DX0 + DX1) / 2; // door opening
  box(root, DX0, 0.07, 0.012, toon('#86a872'), DX0 / 2, 0.035, 0.006);
  box(root, 2.4 - DX1, 0.07, 0.012, toon('#86a872'), (DX1 + 2.4) / 2, 0.035, 0.006);

  // What you see through the glass: a warm bright sky by day, a deep blue
  // night with the moon by night.
  const skyTex = night => canvasTex(128, 160, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    if (night) { g.addColorStop(0, '#1c2c5a'); g.addColorStop(1, '#3d5a9a'); }
    else { g.addColorStop(0, '#fff2cf'); g.addColorStop(1, '#ffd79a'); }
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const glow = x.createRadialGradient(w * 0.72, h * 0.22, 0, w * 0.72, h * 0.22, w * 0.45);
    glow.addColorStop(0, night ? 'rgba(220,232,255,.9)' : 'rgba(255,255,240,1)');
    glow.addColorStop(night ? 0.12 : 0.25, night ? 'rgba(200,220,255,.6)' : 'rgba(255,250,220,.8)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = glow; x.fillRect(0, 0, w, h);
    if (night) {
      x.fillStyle = '#f4f6ff'; x.beginPath(); x.arc(w * 0.72, h * 0.22, 9, 0, 7); x.fill();
      x.fillStyle = '#3d5a9a'; x.beginPath(); x.arc(w * 0.72 + 4, h * 0.22 - 3, 8, 0, 7); x.fill(); // crescent
      x.fillStyle = 'rgba(255,255,255,.7)';
      [[14, 20], [40, 12], [60, 40], [22, 60], [96, 70], [110, 18]].forEach(([sx, sy]) => x.fillRect(sx, sy, 1.5, 1.5));
    }
  });
  fx.skyTex = { day: skyTex(false), night: skyTex(true) };
  fx.skyMat = new THREE.MeshBasicMaterial({ map: fx.skyTex.day });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(DX1 - DX0, DTOP), fx.skyMat);
  glass.position.set(DC, DTOP / 2, 0.004);
  root.add(glass);
  const alu = toon('#3a3d46');
  box(root, 0.05, DTOP, 0.05, alu, DX0 - 0.025, DTOP / 2, 0.025);   // frame posts
  box(root, 0.05, DTOP, 0.05, alu, DX1 + 0.025, DTOP / 2, 0.025);
  box(root, DX1 - DX0 + 0.1, 0.06, 0.05, alu, DC, DTOP + 0.03, 0.025); // header
  box(root, DX1 - DX0 + 0.1, 0.025, 0.06, alu, DC, 0.0125, 0.03);      // bottom track
  box(root, 0.04, DTOP, 0.03, alu, DC, DTOP / 2, 0.02);                // where the two panels meet
  box(root, 0.012, 0.18, 0.02, toon('#9aa0ac'), DC - 0.05, 1.0, 0.04); // handle

  // Zebra blind: opaque fabric bands and sheer bands the outside light glows through.
  const blindTex = canvasTex(32, 512, (x, w, h) => {
    for (let i = 0; i < 26; i++) {
      x.fillStyle = i % 2 ? 'rgba(255,255,255,.16)' : '#ece3cf';
      x.fillRect(0, i * (h / 26), w, h / 26 + 1);
    }
  });
  fx.blindMat = new THREE.MeshBasicMaterial({ map: blindTex, color: 0xffffff, transparent: true });
  const BW = DX1 - DX0 + 0.14, BY0 = 0.26, BY1 = DTOP - 0.03;
  const blind = new THREE.Mesh(new THREE.PlaneGeometry(BW, BY1 - BY0), fx.blindMat);
  blind.position.set(DC, (BY0 + BY1) / 2, 0.06);
  root.add(blind);
  box(root, BW + 0.04, 0.07, 0.07, toon('#9a9aa0'), DC, BY1 + 0.035, 0.07, 0.02);       // cassette
  box(root, BW, 0.02, 0.02, toon('#d8d0bd'), DC, BY0 - 0.01, 0.065);                    // bottom rail

  // Light coming in: stripes on the floor and soft shafts in the air.
  // Warm sun by day, pale blue moonlight by night (colors set per mode).
  const stripes = canvasTex(64, 256, (x, w, h) => {
    for (let i = 0; i < 12; i++) {
      const a = 0.4 * (1 - i / 12);
      x.fillStyle = `rgba(255,255,255,${i % 2 ? a : 0})`;
      x.fillRect(0, i * 21, w, 21);
    }
  });
  fx.sunStripes = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.1),
    new THREE.MeshBasicMaterial({ map: stripes, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fx.sunStripes.rotation.set(-Math.PI / 2, 0, 0.3);
  fx.sunStripes.position.set(1.78, 0.003, 0.95);
  fx.sunStripes.renderOrder = 2;
  root.add(fx.sunStripes);
  const shaftTex = canvasTex(64, 128, (x, w, h) => {
    for (let i = 0; i < 8; i++) {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(255,255,255,${i % 2 ? 0.55 : 0.12})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(i * (w / 8), 0, w / 8, h);
    }
  });
  const a = new THREE.Vector3(1.78, 1.85, 0.08), b = new THREE.Vector3(1.78, 0.0, 1.15);
  fx.shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.7, a.distanceTo(b)),
    new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  fx.shaft.position.copy(a).add(b).multiplyScalar(0.5);
  fx.shaft.rotation.set(-Math.atan2(b.z - a.z, a.y - b.y), 0, 0);
  fx.shaft.renderOrder = 3;
  root.add(fx.shaft);

  // Contact shadows for the big pieces.
  blob(root, 0.8, 1.6, 0.3, 0.002, 0.72, 0, 0.9);
  blob(root, 1.6, 0.8, 0.72, 0.002, 0.3, 0, 0.9);
  blob(root, 1.2, 1.25, USER.x + 0.05, 0.002, USER.y + 0.05, Math.PI / 4, 1);
}

function buildDesk(g, fx) {
  // Carbon-fiber twill, tiled in meters (top faces use shape coordinates as UVs).
  const carbon = canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#1e1e25'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      x.fillStyle = (i + j) % 2 ? '#2a2a33' : '#24242c';
      x.fillRect(i * 16, j * 16, 16, 16);
      x.fillStyle = 'rgba(255,255,255,.05)';
      if ((i + j) % 2) x.fillRect(i * 16, j * 16, 16, 3); else x.fillRect(i * 16, j * 16, 3, 16);
    }
  });
  carbon.wrapS = carbon.wrapT = THREE.RepeatWrapping;
  carbon.repeat.set(22, 22);
  const top = new THREE.MeshToonMaterial({ map: carbon, gradientMap: gradient });
  const edge = toon('#15151b');
  const metal = toon('#121217');

  // Desk top: one L board.
  board(g, [[OFF, OFF], [END, OFF], [END, FRONT], [FRONT, FRONT], [FRONT, END], [OFF, END]], DY, DT, [top, edge]);

  // Second level: one continuous L riser along the back of both wings,
  // with a wide chamfered corner that holds the center monitor.
  const cx = CH - (OFF + RD);
  board(g, [[OFF, OFF], [END, OFF], [END, OFF + RD], [cx, OFF + RD], [OFF + RD, cx], [OFF + RD, END], [OFF, END]], RY, RT, [top, edge]);
  const legH = RY - RT - DY;
  const i = 0.016; // legs sit just inside the riser edges
  [[OFF + i, OFF + i], [END - i, OFF + i], [OFF + i, END - i],
   [END - i, OFF + RD - i], [OFF + RD - i, END - i],
   [cx - 0.03, OFF + RD - i], [OFF + RD - i, cx - 0.03],
   [0.72, OFF + i], [OFF + i, 0.72]].forEach(([x, z]) =>
    box(g, 0.022, legH, 0.022, metal, x, DY + legH / 2, z));

  // Soft purple LED stuck under the riser's front edge, washing the desk below.
  fx.ledMat = basic(LED);
  const ly = RY - RT - 0.003, lf = OFF + RD - 0.02;
  box(g, 0.01, 0.004, END - cx, fx.ledMat, lf, ly, (cx + END) / 2);
  box(g, END - cx, 0.004, 0.01, fx.ledMat, (cx + END) / 2, ly, lf);
  const diag = new THREE.Mesh(boxGeo(Math.hypot(cx - lf, cx - lf), 0.004, 0.01), fx.ledMat);
  diag.position.set((cx + lf) / 2, ly, (cx + lf) / 2);
  diag.rotation.y = Math.PI / 4;
  g.add(diag);
  fx.ledGlow = ledGlow(g, cx);

  // X frames at both wing ends: top rail, foot rail and two crossing tubes.
  const under = DY - DT;
  const xFrame = (a, b) => {           // a, b: front/back feet as [x, z]
    const [ax, az] = a, [bx, bz] = b;
    rod(g, V(ax, under - 0.015, az), V(bx, under - 0.015, bz), 0.014, metal, 6);
    rod(g, V(ax, 0.015, az), V(bx, 0.015, bz), 0.016, metal, 6);
    rod(g, V(ax, under - 0.02, az), V(bx, 0.02, bz), 0.013, metal, 6);
    rod(g, V(bx, under - 0.02, bz), V(ax, 0.02, az), 0.013, metal, 6);
  };
  xFrame([END - 0.03, FRONT - 0.03], [END - 0.03, OFF + 0.03]);
  xFrame([FRONT - 0.03, END - 0.03], [OFF + 0.03, END - 0.03]);
  // Splayed A legs under the inner corner.
  const ic = FRONT - 0.04, s = 0.13 * Math.SQRT1_2;
  rod(g, V(ic, under - 0.01, ic), V(ic + s, 0.01, ic - s), 0.013, metal, 6);
  rod(g, V(ic, under - 0.01, ic), V(ic - s, 0.01, ic + s), 0.013, metal, 6);
  rod(g, V(ic + s, 0.015, ic - s), V(ic - s, 0.015, ic + s), 0.015, metal, 6);

  // Cup holder on the right wing's end: a ring, a little floor, and its arm.
  const cup = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 20), metal);
  cup.rotation.x = Math.PI / 2;
  cup.position.set(END + 0.05, DY - 0.05, FRONT - 0.12);
  g.add(cup);
  box(g, 0.02, 0.012, 0.03, metal, END + 0.005, DY - 0.05, FRONT - 0.12);
  cyl(g, 0.036, 0.036, 0.006, metal, END + 0.05, DY - 0.118, FRONT - 0.12, 16);
  rod(g, V(END + 0.015, DY - 0.05, FRONT - 0.12), V(END + 0.02, DY - 0.118, FRONT - 0.12), 0.004, metal, 6);
  // Headphone hook on the left wing's end.
  box(g, 0.02, 0.02, 0.06, metal, 0.40, DY - 0.045, END + 0.02);
  box(g, 0.02, 0.03, 0.012, metal, 0.40, DY - 0.03, END + 0.05);
}

// The LED's light on the desk top: a soft band centered on the riser's front
// edge (wings) and on the chamfer (corner). Additive planes, no real lights.
function ledGlow(g, cx) {
  const band = canvasTex(8, 128, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(180,140,255,.55)');   // under the riser (back)
    gr.addColorStop(0.55, 'rgba(180,140,255,.35)'); // riser front edge
    gr.addColorStop(1, 'rgba(180,140,255,0)');      // fades out toward you
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
  });
  const mat = new THREE.MeshBasicMaterial({ map: band, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const depth = RD + 0.16, y = DY + 0.002;
  const plane = (w, d, x, z, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.set(-Math.PI / 2, 0, rot);
    m.position.set(x, y, z);
    m.renderOrder = 2;
    g.add(m);
  };
  // left wing: band runs along z, fades toward +x; right wing: along x, fades toward +z
  plane(END - cx, depth, OFF + depth / 2, (cx + END) / 2, Math.PI / 2);
  plane(END - cx, depth, (cx + END) / 2, OFF + depth / 2, 0);
  // corner: a band along the chamfer, fading toward the chair
  const len = Math.SQRT2 * (cx - OFF - RD) + 0.06;
  const c = CH / 2 - 0.013;
  plane(len, depth, c, c, Math.PI / 4);
  return mat;
}

/* ---------- monitors ---------- */

// Flat 27" monitor. Origin: on the surface it stands on, under the screen's
// front face; local +Z is where the screen looks.
function monitor(g, tex, kind) {
  const shell = toon('#141419');
  const stand = toon('#1c1c23');
  const bottom = kind === 'center' ? 0.10 : 0.085;
  box(g, MW, MH, 0.016, shell, 0, bottom + MH / 2, -0.008);
  box(g, 0.40, 0.24, 0.03, shell, 0, bottom + MH * 0.46, -0.03, 0.01);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(MW - 0.014, MH - 0.026), basic(0xffffff, { map: tex }));
  screen.position.set(0, bottom + 0.019 + (MH - 0.026) / 2, 0.0006);
  g.add(screen);
  g.userData.screen = screen; // live.js lays the Kick player over it
  box(g, 0.022, 0.006, 0.002, basic(0xc8c8d0), 0, bottom + 0.009, 0.001); // LG badge

  if (kind === 'center') {
    // UltraGear: chunky neck and a V base with red trim.
    box(g, 0.05, bottom + 0.14, 0.03, stand, 0, (bottom + 0.14) / 2, -0.06, 0.008);
    const red = basic(0xe5242b);
    [-1, 1].forEach(sd => {
      const arm = new THREE.Group();
      arm.position.set(0, 0, -0.06);
      arm.rotation.y = sd * 0.6;
      g.add(arm);
      box(arm, 0.032, 0.014, 0.2, stand, 0, 0.007, 0.1, 0.005);
      box(arm, 0.004, 0.002, 0.17, red, 0, 0.015, 0.1);
    });
  } else {
    box(g, 0.034, bottom + 0.12, 0.018, stand, 0, (bottom + 0.12) / 2, -0.045, 0.006);
    box(g, 0.21, 0.012, 0.17, stand, 0, 0.006, -0.03, 0.005);
  }
}

function buildMonitors(item, screens) {
  const left = item('monitor-left', SIDE_PLANE, RY, SIDE_C);
  left.rotation.y = Math.PI / 2;
  monitor(left, screens.textures.left, 'side');

  const center = item('monitor-center', MC, RY, MC);
  center.rotation.y = Math.PI / 4;
  monitor(center, screens.textures.center, 'center');

  const right = item('monitor-right', SIDE_C, RY, SIDE_PLANE);
  monitor(right, screens.textures.right, 'side');
}

/* ---------- items ---------- */

function buildPC(g, fx) {
  // INFINIARC Cube Flow XL: black frame, glass front + room side, 6 RGB fans.
  g.rotation.y = Math.PI / 2;
  const W = 0.30, H = 0.44, D = 0.40;
  const frame = toon('#121218');
  box(g, W, 0.02, D, frame, 0, H - 0.01, 0, 0.008);
  box(g, W, 0.02, D, frame, 0, 0.03, 0, 0.008);
  box(g, 0.02, H, D, frame, -W / 2 + 0.01, H / 2 + 0.01, 0);
  box(g, W, H, 0.02, frame, 0, H / 2 + 0.01, -D / 2 + 0.01);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(g, 0.03, 0.02, 0.03, frame, sx * 0.12, 0.01, sz * 0.16));
  const inner = toon('#24242e');
  box(g, 0.005, H - 0.06, D - 0.06, inner, -W / 2 + 0.03, H / 2 + 0.01, 0);
  box(g, 0.2, 0.05, 0.28, toon('#3a3a46'), 0, 0.2, -0.02);              // GPU
  box(g, 0.2, 0.004, 0.24, basic(PURPLE), 0, 0.174, -0.02);              // GPU light bar
  box(g, 0.08, 0.12, 0.1, toon('#c9c9d2'), 0, 0.33, -0.08);              // AK620 tower
  fx.fanMat = basic(PURPLE);
  [0.12, 0.25, 0.38].forEach(y => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.055, 24), fx.fanMat);
    ring.position.set(0, y + 0.01, D / 2 - 0.03);
    g.add(ring);
    cyl(g, 0.012, 0.012, 0.01, inner, 0, y + 0.01, D / 2 - 0.035).rotation.x = Math.PI / 2;
  });
  const glass = new THREE.MeshBasicMaterial({ color: 0xbfc8ff, transparent: true, opacity: 0.14, depthWrite: false });
  box(g, W, H - 0.02, 0.006, glass, 0, H / 2 + 0.01, D / 2 - 0.003);
  box(g, 0.006, H - 0.02, D, glass, W / 2 - 0.003, H / 2 + 0.01, 0);
  blob(g, 0.5, 0.6, 0, 0.003, 0, 0, 0.8);
}

function buildHeadphones(g) {
  // HD 650: hangs from the hook, cups along X, facing the room (+Z).
  const dark = toon('#2a2a30');
  const silver = toon('#b8bcc8');
  const hy = DY - 0.04;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 24, Math.PI), dark);
  band.position.set(0, hy - 0.085, 0);
  g.add(band);
  [-1, 1].forEach(s => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.034, 20), dark);
    cup.scale.set(1.25, 1, 1);           // oval cups, long side vertical
    cup.rotation.z = Math.PI / 2;
    cup.position.set(s * 0.09, hy - 0.15, 0);
    g.add(cup);
    const grill = cyl(g, 0.036, 0.036, 0.006, silver, s * 0.108, hy - 0.15, 0, 20);
    grill.rotation.z = Math.PI / 2;
    rod(g, V(s * 0.085, hy - 0.085, 0), V(s * 0.09, hy - 0.11, 0), 0.006, silver);
  });
}

function buildKeyboard(g) {
  // E-YOOSO Z99 (1800 layout): light alphas, dark gray modifiers, no lighting.
  g.rotation.y = Math.PI / 2;
  const keys = canvasTex(512, 176, (x, w, h) => {
    x.fillStyle = '#8b8e98'; x.fillRect(0, 0, w, h);
    const rows = 6, cols = 19, kw = (w - 20) / cols, kh = (h - 16) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (r === 5 && c > 3 && c < 10) continue;
      const mod = r === 0 || c === 0 || c >= 15 || (r === 5) || (c === 13 && r > 0 && r < 4);
      x.fillStyle = mod ? '#4d505b' : '#d2d4da';
      x.beginPath(); x.roundRect(10 + c * kw + 2, 8 + r * kh + 2, kw - 4, kh - 4, 4); x.fill();
    }
    x.fillStyle = '#d2d4da'; x.beginPath(); x.roundRect(10 + 4 * kw + 2, 8 + 5 * kh + 2, kw * 6 - 4, kh - 4, 4); x.fill();
  });
  const body = toon('#7c7f8a');
  const m = new THREE.Mesh(boxGeo(0.385, 0.03, 0.135),
    [body, body, new THREE.MeshToonMaterial({ map: keys, gradientMap: gradient }), body, body, body]);
  m.position.y = 0.015;
  g.add(m);
  blob(g, 0.48, 0.2, 0, 0.002, 0, 0, 0.6);
}

function buildPads(xl, l) {
  // QcK XL across the right wing, QcK+ L on top of it.
  box(xl, 0.57, 0.004, 0.26, toon('#1a1a20'), 0, 0.002, 0);
  box(l, 0.34, 0.004, 0.23, toon('#111116'), 0, 0.002, 0);
  const logo = basic(0xf2f2f5);
  cyl(l, 0.012, 0.012, 0.001, logo, -0.13, 0.0045, -0.07);
  box(xl, 0.06, 0.001, 0.008, logo, 0.24, 0.0045, 0.115);   // "steelseries" print on the front edge
}

function buildMouse(g) {
  // Ajazz AJ159 Apex (white) + its charging dock at the back of the big pad.
  g.rotation.y = 0.25;
  const white = toon('#f4f4f6');
  box(g, 0.062, 0.034, 0.12, white, 0, 0.017, 0, 0.016);
  box(g, 0.003, 0.006, 0.03, toon('#2a2a33'), 0, 0.034, 0.03);
  const dock = new THREE.Group();
  dock.position.set(-0.33, -0.004, -0.08);
  dock.rotation.y = 0.5;
  g.add(dock);
  box(dock, 0.06, 0.03, 0.075, white, 0, 0.015, 0, 0.012);
  box(dock, 0.036, 0.022, 0.003, basic(0x6aa8ff), 0, 0.02, 0.038);
}

function buildMic(arm, mic) {
  // FIFINE BM88 low-profile arm clamped on the riser corner; the PD400X
  // hangs past the desk's inner corner, aimed at the chair.
  const black = toon('#30303c');
  const a = V(0.63, RY, 0.29);
  const b = V(0.63, RY + 0.075, 0.29);
  const c = V(0.62, RY + 0.075, 0.55);
  const d = V(0.69, RY + 0.065, 0.69);
  box(arm, 0.05, 0.016, 0.05, black, a.x, RY + 0.008, a.z);
  rod(arm, a, b, 0.012, black);
  rod(arm, b, c, 0.014, black);
  rod(arm, c, d, 0.012, black);
  mic.position.set(d.x, d.y, d.z);
  // Aimed at the mouth of whoever sits in the recliner.
  const mouth = V(1.25, 0.98, 1.25);
  const body = new THREE.Group();
  body.quaternion.setFromUnitVectors(V(0, 1, 0), mouth.sub(d).normalize());
  mic.add(body);
  cyl(body, 0.012, 0.012, 0.03, black, 0, 0.0, 0);
  cyl(body, 0.026, 0.026, 0.12, toon('#1f1f26'), 0, 0.08, 0, 18);
  cyl(body, 0.028, 0.026, 0.05, toon('#3a3a44'), 0, 0.16, 0, 18);
  mic.userData.flash = cyl(body, 0.0265, 0.0265, 0.004, basic(PURPLE), 0, 0.132, 0, 18); // touch-mute ring
}

function buildInterface(g) {
  // MAONO PS22: slim box, big center knob, half tucked under the riser corner.
  faceToward(g, USER.x, USER.y);
  box(g, 0.178, 0.046, 0.125, toon('#26262e'), 0, 0.023, 0, 0.01);
  const knob = toon('#d8d8de');
  cyl(g, 0.022, 0.024, 0.016, knob, 0, 0.054, 0.0, 20);
  [-0.06, 0.06].forEach(x => cyl(g, 0.012, 0.013, 0.012, knob, x, 0.052, 0.02, 14));
  box(g, 0.05, 0.004, 0.003, basic(0x53fc18), 0, 0.03, 0.063);
  blob(g, 0.26, 0.2, 0, 0.002, 0, 0, 0.6);
}

function buildController(g) {
  // White Xbox controller lying on the left wing.
  g.rotation.y = Math.PI / 2 + 0.25;
  const white = toon('#f1f1f4');
  box(g, 0.11, 0.035, 0.07, white, 0, 0.02, 0, 0.016);
  [-1, 1].forEach(s => {
    const grip = box(g, 0.045, 0.034, 0.07, white, s * 0.055, 0.019, -0.022, 0.016);
    grip.rotation.y = s * 0.35;
  });
  const dark = toon('#2a2a33');
  cyl(g, 0.009, 0.009, 0.012, dark, -0.03, 0.042, 0.012, 10);
  cyl(g, 0.009, 0.009, 0.012, dark, 0.015, 0.042, -0.01, 10);
  [[0.035, 0.018], [0.045, 0.006], [0.025, 0.006], [0.035, -0.006]].forEach(([x, z], i) =>
    cyl(g, 0.0045, 0.0045, 0.006, basic([0x53fc18, 0xe5242b, 0x3a7bff, 0xf2b93b][i]), x, 0.04, z, 8));
  blob(g, 0.2, 0.14, 0, 0.002, 0, 0, 0.5);
}

function buildBattery(g) {
  // AOLION-style dock: black base, two batteries with green labels.
  faceToward(g, USER.x, USER.y);
  box(g, 0.13, 0.03, 0.085, toon('#18181e'), 0, 0.015, 0, 0.008);
  const green = basic(0x2fd25a);
  [-0.032, 0.032].forEach(x => {
    box(g, 0.05, 0.03, 0.065, toon('#1f1f27'), x, 0.045, -0.004, 0.006);
    box(g, 0.051, 0.012, 0.04, green, x, 0.05, 0.026);
  });
  box(g, 0.03, 0.004, 0.004, basic(0x2fd25a), 0, 0.022, 0.043);
}

function buildRingLight(g, fx) {
  // Floor tripod tucked in the corner; the ring rides on a short forward
  // bracket above the monitors with an empty phone clip in the middle.
  const black = toon('#1a1a22');
  const top = RY + 0.10 + MH + 0.40; // ring center ~40 cm over the center monitor
  rod(g, V(0, 0.42, 0), V(0, top - 0.17, 0), 0.011, black);
  [0.26, Math.PI / 4, Math.PI / 2 - 0.26].forEach(a =>
    rod(g, V(0, 0.44, 0), V(Math.cos(a) * 0.2, 0.005, Math.sin(a) * 0.2), 0.008, black, 6));
  const fwd = 0.16 * Math.SQRT1_2;
  rod(g, V(0, top - 0.17, 0), V(fwd, top - 0.17, fwd), 0.009, black);  // short arm under the ring
  const head = new THREE.Group();
  head.position.set(fwd, top, fwd);
  g.add(head);
  head.rotation.y = Math.PI / 4;
  fx.ringMat = basic(0xfff4e0);
  head.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 10, 44), fx.ringMat));
  rod(head, V(0, -0.16, 0), V(0, -0.17, 0), 0.012, black);
  rod(head, V(0, -0.15, 0), V(0, -0.03, 0), 0.005, black);
  box(head, 0.075, 0.03, 0.014, black, 0, -0.015, 0, 0.006); // empty phone clamp
}

function buildWebcam(stand, cam) {
  // jusmo pole on the riser behind the right monitor, topping out 10 cm over
  // the monitor; the Kiyo Pro Ultra hangs from its head.
  const black = toon('#1a1a22');
  const top = RY + 0.085 + MH + 0.10;
  box(stand, 0.06, 0.02, 0.06, black, 0, 0.01, 0, 0.006);
  rod(stand, V(0, 0, 0), V(0, top - RY, 0), 0.011, black);
  cyl(stand, 0.016, 0.016, 0.03, black, 0, top - RY + 0.01, 0, 12);       // 360° head
  cam.position.set(stand.position.x, top + 0.065, stand.position.z + 0.01);
  faceToward(cam, USER.x, USER.y);
  const puck = cyl(cam, 0.04, 0.04, 0.055, toon('#26262e'), 0, 0, 0, 24);
  puck.rotation.x = Math.PI / 2;
  const lens = cyl(cam, 0.024, 0.024, 0.004, toon('#0c0c12'), 0, 0, 0.0285, 20);
  lens.rotation.x = Math.PI / 2;
  const ringL = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.03, 24), basic(0x8a8a96));
  ringL.position.z = 0.0292;
  cam.add(ringL);
  cam.userData.flash = ringL; // main.js lights it up when the webcam is clicked
}

function buildChair(g) {
  // Taupe fabric recliner facing the corner: rolled arms, three pillow rolls.
  faceToward(g, 0, 0);
  const main = toon('#8b7f72');
  const soft = toon('#9b8f82');
  const dark = toon('#3b3530');
  box(g, 0.84, 0.36, 0.8, main, 0, 0.22, 0, 0.06);
  box(g, 0.56, 0.12, 0.6, soft, 0, 0.45, 0.06, 0.05);
  [-1, 1].forEach(s => {
    box(g, 0.16, 0.3, 0.8, main, s * 0.34, 0.5, 0.0, 0.07);
    const roll = cyl(g, 0.085, 0.085, 0.78, soft, s * 0.34, 0.63, 0.0, 16);
    roll.rotation.x = Math.PI / 2;
  });
  const back = new THREE.Group();
  back.position.set(0, 0.5, -0.32);
  back.rotation.x = -0.14;
  g.add(back);
  [0.14, 0.34, 0.54].forEach((y, i) => {
    const r = cyl(back, 0.11, 0.11, 0.6 - i * 0.02, soft, 0, y, 0.02, 16);
    r.rotation.z = Math.PI / 2;
  });
  box(back, 0.66, 0.74, 0.14, main, 0, 0.34, -0.1, 0.06);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(g, 0.05, 0.04, 0.05, dark, sx * 0.36, 0.02, sz * 0.34));
}

// Small things in the photos that aren't products: the speaker bar under the
// left riser.
function buildDecor(root) {
  box(root, 0.06, 0.055, 0.4, toon('#141418'), 0.16, DY + 0.0275, 0.9, 0.012);
  box(root, 0.002, 0.03, 0.34, toon('#2a2a33'), 0.191, DY + 0.028, 0.9);

  // 500 ml water bottle (Ø6.5 cm × 21 cm) standing in the desk's cup holder.
  const b = new THREE.Group();
  b.position.set(END + 0.05, DY - 0.115, FRONT - 0.12);
  root.add(b);
  const plastic = new THREE.MeshToonMaterial({ color: 0xd8f0ff, gradientMap: gradient, transparent: true, opacity: 0.45 });
  const water = new THREE.MeshToonMaterial({ color: 0x6fc3ff, gradientMap: gradient, transparent: true, opacity: 0.55 });
  cyl(b, 0.0325, 0.0325, 0.16, plastic, 0, 0.08, 0, 18);
  cyl(b, 0.029, 0.029, 0.13, water, 0, 0.066, 0, 18);
  cyl(b, 0.033, 0.033, 0.055, toon('#1e78d6'), 0, 0.095, 0, 18);          // label
  cyl(b, 0.0332, 0.0332, 0.012, toon('#f4f8fc'), 0, 0.095, 0, 18);       // white stripe on the label
  cyl(b, 0.014, 0.0325, 0.03, plastic, 0, 0.175, 0, 18);                  // shoulder
  cyl(b, 0.0145, 0.0145, 0.02, toon('#1e78d6'), 0, 0.2, 0, 14);           // cap
}

/* ---------- modes ---------- */

export const MODES = {
  // night: moonlight through the door (stream + game); day: sun (work)
  work:   { hemi: 2.3, hemiSky: 0xfff1dc, hemiGround: 0x5a5060, sun: 2.4, moon: 0, night: false, fill: 0.6, blind: 0xffffff, light: 0xffd08a, lightA: 1, led: 0, ring: 0, screen: 0.2, pc: 0.3, bg: 'work' },
  stream: { hemi: 0.9, hemiSky: 0xb9a8ff, hemiGround: 0x241a33, sun: 0, moon: 0.9, night: true, fill: 0.35, blind: 0x8a8fa8, light: 0x7f9fff, lightA: 0.7, led: 0.8, ring: 2.2, screen: 0.9, pc: 0.8, bg: 'stream' },
  game:   { hemi: 0.75, hemiSky: 0x9f8cff, hemiGround: 0x1c1430, sun: 0, moon: 0.7, night: true, fill: 0.3, blind: 0x767b98, light: 0x7f9fff, lightA: 0.55, led: 1.1, ring: 0, screen: 1.3, pc: 1.8, bg: 'game' },
};

export function applyMode(world, name, keepOverrides = false) {
  const m = MODES[name], f = world.fx;
  if (!keepOverrides) f.ledOverride = f.ringOverride = null;
  f.hemi.intensity = m.hemi;
  f.hemi.color.setHex(m.hemiSky);
  f.hemi.groundColor.setHex(m.hemiGround);
  f.sun.intensity = m.sun;
  f.moon.intensity = m.moon;
  f.fill.intensity = m.fill;
  f.blindMat.color.setHex(m.blind);
  f.skyMat.map = m.night ? f.skyTex.night : f.skyTex.day;
  f.skyMat.needsUpdate = true;
  for (const o of [f.sunStripes, f.shaft]) {
    o.material.color.setHex(m.light);
    o.material.opacity = m.lightA * (o === f.shaft ? 0.35 : 1);
  }
  // The cards can switch the LED and the ring light by hand (null = follow the mode).
  const led = f.ledOverride === null ? m.led : (f.ledOverride ? 0.8 : 0);
  f.ledMat.color.setHex(led ? f.ledColor : 0x3a3a48);
  f.ledLight.color.setHex(f.ledColor);
  f.ledLight.intensity = led;
  f.ledGlow.color.setHex(f.ledColor);
  f.ledGlow.opacity = Math.min(1, led * 0.9);
  const ring = f.ringOverride === null ? m.ring : (f.ringOverride ? 2.0 : 0);
  f.ringLight.intensity = ring;
  f.ringMat.color.setHex(ring ? 0xfff4e0 : 0x8d8d96);
  f.screenLight.intensity = m.screen;
  f.pcLight.intensity = m.pc;
  world.screens.setMode(name);
}
