// Life in the room: a streamer sitting cross-legged on the recliner (stream
// mode only) and two cats, Bon Bon (orange) and Abu Farwa (black), who wander,
// run, jump on the desk, sit on the PC case and nap.
// Everything is a handful of capsules and spheres; it animates at ~30 fps and
// only asks for frames while something is visible.
import * as THREE from 'three';
import { toon, blob } from './scene.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// A capsule (unit length along Y) we can stretch between two points each frame.
const capGeo = new Map();
function capsule(r, mat) {
  if (!capGeo.has(r)) capGeo.set(r, new THREE.CapsuleGeometry(r, 1, 4, 10));
  const m = new THREE.Mesh(capGeo.get(r), mat);
  m.userData.r = r;
  return m;
}
function span(m, a, b) {
  const d = b.clone().sub(a), len = d.length();
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.scale.set(1, Math.max(0.001, len - m.userData.r * 2), 1);
}
const sphere = (r, mat) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);

// Two-bone arm: where the elbow goes for shoulder s, hand h, bending toward `pole`.
function elbow(s, h, l1, l2, pole) {
  const d = h.clone().sub(s), dist = Math.min(d.length(), l1 + l2 - 1e-4);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const hgt = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const dir = d.normalize();
  const side = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return s.clone().addScaledVector(dir, a).addScaledVector(side, hgt);
}

/* ---------------- the streamer ---------------- */

function createStreamer(chair) {
  const g = new THREE.Group();
  g.position.copy(chair.position);
  g.rotation.y = chair.rotation.y;          // local +Z faces the monitors, like the chair
  g.visible = false;

  const hoodie = toon('#3d3f52'), pants = toon('#262833'), skin = toon('#c68b62');
  const hair = toon('#221a16'), sock = toon('#e8e8ee'), dark = toon('#24242c');
  const part = (m) => { m.userData.decor = 'streamer'; g.add(m); return m; };

  // cross-legged on the seat: thighs out to the knees, shins crossing back in
  for (const s of [-1, 1]) {
    const hip = V(s * 0.09, 0.57, -0.04), knee = V(s * 0.215, 0.59, 0.2), ankle = V(-s * 0.06, 0.555, 0.15);
    span(part(capsule(0.065, pants)), hip, knee);
    span(part(capsule(0.05, pants)), knee, ankle);
    const foot = part(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.1), sock));
    foot.position.copy(ankle).add(V(-s * 0.03, -0.005, 0.02));
    foot.rotation.y = s * 0.6;
  }
  const pelvis = part(sphere(0.12, pants));
  pelvis.scale.set(1.25, 0.6, 1); pelvis.position.set(0, 0.6, -0.06);

  const torso = part(capsule(0.13, hoodie));
  torso.scale.set(1.3, 1, 0.85);
  const neck = part(capsule(0.04, skin));
  const head = new THREE.Group(); g.add(head);
  const face = sphere(0.1, skin); face.scale.set(0.92, 1.08, 0.95); face.userData.decor = 'streamer'; head.add(face);
  const cap = sphere(0.104, hair); cap.scale.set(0.95, 0.7, 1); cap.position.set(0, 0.035, -0.01); cap.userData.decor = 'streamer'; head.add(cap);
  const hood = part(capsule(0.07, hoodie)); // hood bunched behind the neck

  const L1 = 0.27, L2 = 0.25;
  const arms = [-1, 1].map(s => ({ s, up: part(capsule(0.045, hoodie)), fore: part(capsule(0.04, hoodie)), hand: part(sphere(0.035, skin)) }));

  // keyboard on the lap, mouse on the right armrest
  const kb = part(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.022, 0.115), toon('#7c7f8a')));
  kb.position.set(0.02, 0.668, 0.17); kb.rotation.x = -0.12;
  const keys = part(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.006, 0.095), toon('#d2d4da')));
  keys.position.copy(kb.position).add(V(0, 0.013, 0)); keys.rotation.x = -0.12;
  const mouse = part(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.028, 0.1), toon('#f4f4f6')));
  const mousePad = part(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.16), dark));
  mousePad.position.set(-0.32, 0.718, 0.14);

  const kbBase = V(0.1, 0.705, 0.17), mBase = V(-0.32, 0.738, 0.13);
  return {
    group: g,
    tick(t) {
      const breathe = Math.sin(t * 1.6) * 0.006;
      const pelvisTop = V(0, 0.64, -0.07), chest = V(0, 1.0 + breathe, -0.05);
      span(torso, pelvisTop, chest);
      span(hood, V(0, 1.02, -0.13), V(0, 1.05, -0.11));
      const neckTop = V(0, 1.09 + breathe, -0.03);
      span(neck, chest, neckTop);
      head.position.copy(neckTop).add(V(0, 0.08, 0.01));
      head.rotation.set(-0.12 + Math.sin(t * 0.9) * 0.03, Math.sin(t * 0.37) * 0.14, Math.sin(t * 0.5) * 0.03);
      // typing (left hand) and small mouse moves + clicks (right hand)
      const type = V(Math.sin(t * 11) * 0.012, Math.abs(Math.sin(t * 13)) * 0.01, Math.cos(t * 7) * 0.006);
      const flick = V(Math.sin(t * 1.9) * 0.014 + Math.sin(t * 5.3) * 0.004, Math.max(0, Math.sin(t * 6)) * 0.004, Math.cos(t * 2.4) * 0.012);
      mouse.position.copy(mBase).add(V(flick.x, -0.012, flick.z));
      for (const a of arms) {
        const sh = V(a.s * 0.185, 0.97 + breathe, -0.06);
        const hand = a.s > 0 ? kbBase.clone().add(type) : mBase.clone().add(flick);
        const el = elbow(sh, hand, L1, L2, V(a.s * 0.6, -1, -0.4).normalize());
        span(a.up, sh, el);
        span(a.fore, el, hand);
        a.hand.position.copy(hand);
      }
    },
  };
}

/* ---------------- the cats ---------------- */

// Where cats can be. Floor nodes form a little walkable graph around the chair;
// perches are reached with a jump from their floor approach point.
const FLOOR = [
  [0.72, 0.64], [1.1, 0.62], [1.6, 0.62], [2.08, 0.66], [2.1, 1.2], [2.08, 1.8],
  [1.6, 2.02], [1.05, 2.05], [0.55, 2.02], [0.3, 1.6], [0.62, 1.42], [0.66, 0.96],
  [0.3, 0.72], [0.62, 1.85], [1.85, 1.3], [1.9, 1.95],
];
const PERCH = {
  case: { at: V(0.26, 0.455, 1.06), from: 10, look: Math.PI / 2 },        // on the PC case
  deskL: { at: V(0.45, 0.752, 1.26), from: 10, look: Math.PI / 2 },       // left wing, by the controller
  deskR: { at: V(1.22, 0.756, 0.45), from: 2, look: 0 },                 // right wing, on the mouse pad
};
const CHAIR = new THREE.Vector2(1.2, 1.2), CHAIR_R = 0.6;
const CASE = { x0: 0.0, x1: 0.52, z0: 0.88, z1: 1.28 };

function clear(a, b) {
  // segment a-b keeps clear of the recliner and the PC case
  const ab = new THREE.Vector2(b[0] - a[0], b[1] - a[1]), ac = new THREE.Vector2(CHAIR.x - a[0], CHAIR.y - a[1]);
  const t = THREE.MathUtils.clamp(ac.dot(ab) / ab.lengthSq(), 0, 1);
  if (Math.hypot(a[0] + ab.x * t - CHAIR.x, a[1] + ab.y * t - CHAIR.y) < CHAIR_R) return false;
  for (let i = 0; i <= 10; i++) {
    const x = a[0] + ab.x * i / 10, z = a[1] + ab.y * i / 10;
    if (x > CASE.x0 && x < CASE.x1 && z > CASE.z0 && z < CASE.z1) return false;
  }
  return true;
}
const EDGES = FLOOR.map((a, i) => FLOOR.map((b, j) => j).filter(j => j !== i && clear(a, FLOOR[j])));
function route(from, to) {
  const prev = new Map([[from, -1]]), q = [from];
  while (q.length) {
    const n = q.shift();
    if (n === to) break;
    for (const m of EDGES[n]) if (!prev.has(m)) { prev.set(m, n); q.push(m); }
  }
  const path = [];
  for (let n = to; n !== -1 && n !== undefined; n = prev.get(n)) path.unshift(n);
  return path[0] === from ? path.slice(1) : [];
}

function buildCat(kind) {
  const fur = toon(kind === 'orange' ? '#e8913a' : '#1d1d24');
  const fur2 = toon(kind === 'orange' ? '#f6d2a2' : '#2c2c36');
  const eye = new THREE.MeshBasicMaterial({ color: kind === 'orange' ? 0x3a2a12 : 0x9be36a });
  const nose = toon(kind === 'orange' ? '#d9737a' : '#3b3340');
  const name = kind === 'orange' ? 'bonbon' : 'abufarwa';
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);                 // tilts for sitting
  const tag = m => { m.userData.decor = name; return m; };

  const torso = tag(capsule(0.055, fur)); torso.rotation.x = Math.PI / 2; torso.scale.set(1, 0.17, 1);
  torso.position.set(0, 0.13, 0); body.add(torso);
  const belly = tag(capsule(0.045, fur2)); belly.rotation.x = Math.PI / 2; belly.scale.set(1, 0.14, 1);
  belly.position.set(0, 0.11, 0.01); body.add(belly);
  if (kind === 'orange') [-0.04, 0.02, 0.08].forEach(z => {           // tabby stripes
    const s = tag(new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.008, 6, 14, Math.PI), toon('#c96f22')));
    s.position.set(0, 0.13, z); s.rotation.set(0, Math.PI / 2, 0); body.add(s);
  });

  const head = new THREE.Group(); head.position.set(0, 0.19, 0.13); body.add(head);
  const skull = tag(sphere(0.06, fur)); skull.scale.set(1.08, 0.95, 1); head.add(skull);
  const muzzle = tag(sphere(0.03, fur2)); muzzle.position.set(0, -0.018, 0.045); muzzle.scale.set(1.3, 0.8, 0.9); head.add(muzzle);
  const n = tag(sphere(0.008, nose)); n.position.set(0, -0.005, 0.07); head.add(n);
  for (const s of [-1, 1]) {
    const ear = tag(new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.05, 4), fur));
    ear.position.set(s * 0.035, 0.055, -0.005); ear.rotation.set(-0.1, 0, -s * 0.25); head.add(ear);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), eye);
    e.position.set(s * 0.024, 0.008, 0.052); e.userData.decor = name; head.add(e);
  }

  const legs = [];
  for (const [x, z, front] of [[-0.035, 0.08, 1], [0.035, 0.08, 1], [-0.035, -0.08, 0], [0.035, -0.08, 0]]) {
    const hip = new THREE.Group(); hip.position.set(x, 0.12, z); body.add(hip);
    const leg = tag(capsule(0.016, fur)); leg.scale.set(1, 0.075, 1); leg.position.y = -0.055; hip.add(leg);
    const paw = tag(sphere(0.018, fur2)); paw.position.y = -0.11; paw.scale.set(1, 0.6, 1.2); hip.add(paw);
    legs.push({ hip, front });
  }

  const tail = [];
  let parent = new THREE.Group(); parent.position.set(0, 0.15, -0.14); body.add(parent);
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group(); seg.position.z = i ? -0.035 : 0; parent.add(seg);
    const m = tag(capsule(0.014 - i * 0.0012, i === 5 && kind === 'orange' ? fur2 : fur));
    m.rotation.x = Math.PI / 2; m.scale.set(1, 0.022, 1); m.position.z = -0.018; seg.add(m);
    tail.push(seg); parent = seg;
  }
  const shadow = blob(g, 0.3, 0.22, 0, 0.003, 0, 0, 0.5);
  return { g, body, head, legs, tail, shadow, name };
}

function createCat(kind, start, seed) {
  const c = buildCat(kind);
  c.g.position.set(FLOOR[start][0], 0, FLOOR[start][1]);
  let rand = seed;
  const rnd = () => ((rand = (rand * 16807) % 2147483647) / 2147483647);
  const st = { node: start, perch: null, act: 'sit', until: 1 + rnd() * 2, path: [], speed: 0, jump: null, heading: rnd() * 6, phase: 0, pose: 0, poseGoal: 0.6, lieGoal: 0, lie: 0 };

  function plan(now) {
    if (st.perch) {                                    // up high: nap, then hop down
      if (st.act !== 'rest') { st.act = 'rest'; st.until = now + 6 + rnd() * 10; st.poseGoal = rnd() < 0.5 ? 1 : 0.6; st.lieGoal = st.poseGoal === 1 ? 1 : 0; return; }
      const p = PERCH[st.perch];
      st.jump = { from: c.g.position.clone(), to: V(FLOOR[p.from][0], 0, FLOOR[p.from][1]), t0: now, dur: 0.55 };
      st.node = p.from; st.perch = null; st.act = 'jump'; st.lieGoal = 0; st.poseGoal = 0;
      return;
    }
    const r = rnd();
    st.lieGoal = 0;
    if (r < 0.34) { go(Math.floor(rnd() * FLOOR.length), 0.22); }               // stroll
    else if (r < 0.48) { go(Math.floor(rnd() * FLOOR.length), 0.85); }          // zoomies
    else if (r < 0.68) { const k = ['case', 'deskL', 'deskR'][Math.floor(rnd() * 3)]; go(PERCH[k].from, 0.25, k); }
    else if (r < 0.84) { st.act = 'sit'; st.poseGoal = 0.6; st.until = now + 3 + rnd() * 4; }
    else { st.act = 'lie'; st.poseGoal = 1; st.lieGoal = 1; st.until = now + 6 + rnd() * 8; }
  }
  function go(to, speed, perch) {
    st.path = to === st.node ? [] : route(st.node, to);
    st.speed = speed; st.act = 'walk'; st.poseGoal = 0; st.target = perch || null;
    if (!st.path.length) { st.act = 'sit'; st.until = 0; if (perch) startPerch(perch, performance.now() / 1000); }
  }
  function startPerch(k, now) {
    const p = PERCH[k];
    st.jump = { from: c.g.position.clone(), to: p.at.clone(), t0: now, dur: 0.6, perch: k };
    st.act = 'jump';
  }

  return {
    group: c.g,
    name: c.name,
    poke(now) { if (st.jump) return; st.act = st.perch ? 'perched' : 'sit'; st.poseGoal = 0.6; st.lieGoal = 0; st.path = []; st.until = now + 3; },
    tick(now, dt) {
      if (st.jump) {
        const k = Math.min(1, (now - st.jump.t0) / st.jump.dur), j = st.jump;
        const p = j.from.clone().lerp(j.to, k);
        p.y += Math.sin(Math.PI * k) * (0.18 + Math.abs(j.to.y - j.from.y) * 0.35);
        c.g.position.copy(p);
        st.heading = Math.atan2(j.to.x - j.from.x, j.to.z - j.from.z);
        c.body.rotation.x = -0.5 * Math.cos(Math.PI * k);
        if (k >= 1) {
          c.body.rotation.x = 0; st.jump = null;
          if (j.perch) { st.perch = j.perch; st.act = 'perched'; st.until = now; st.heading = PERCH[j.perch].look; }
          else { st.act = 'sit'; st.until = now + 1 + rnd() * 2; st.poseGoal = 0.6; }
        }
      } else if (st.act === 'walk') {
        const n = st.path[0], tx = FLOOR[n][0], tz = FLOOR[n][1];
        const dx = tx - c.g.position.x, dz = tz - c.g.position.z, d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let diff = THREE.MathUtils.euclideanModulo(want - st.heading + Math.PI, Math.PI * 2) - Math.PI;
        st.heading += diff * Math.min(1, dt * 8);
        const step = st.speed * dt * (Math.abs(diff) > 1 ? 0.3 : 1);
        if (d <= step) {
          c.g.position.x = tx; c.g.position.z = tz; st.node = n; st.path.shift();
          if (!st.path.length) {
            if (st.target) startPerch(st.target, now);
            else { st.act = 'sit'; st.poseGoal = 0.6; st.until = now + 1 + rnd() * 3; }
          }
        } else { c.g.position.x += dx / d * step; c.g.position.z += dz / d * step; }
        st.phase += dt * (st.speed > 0.5 ? 16 : 9);
      } else if (now > st.until) plan(now);

      // pose blending: 0 = standing, 0.6 = sitting, 1 = lying
      st.pose += (st.poseGoal - st.pose) * Math.min(1, dt * 5);
      st.lie += (st.lieGoal - st.lie) * Math.min(1, dt * 4);
      const moving = st.act === 'walk';
      const sit = Math.min(1, st.pose / 0.6) * (1 - st.lie);
      if (!st.jump) {
        c.body.rotation.x = -0.55 * sit;                          // front up when sitting
        c.body.position.y = -0.035 * sit - 0.075 * st.lie + (moving ? Math.abs(Math.sin(st.phase)) * 0.008 : 0);
        c.body.position.z = -0.03 * sit;
      }
      c.g.rotation.y = st.heading;
      c.legs.forEach((l, i) => {
        const swing = moving ? Math.sin(st.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * (st.speed > 0.5 ? 0.9 : 0.55) : 0;
        const sitFold = l.front ? 0.55 * sit : -1.2 * sit;      // hind legs tuck under when sitting
        l.hip.rotation.x = swing + sitFold - (st.lie * (l.front ? -1.3 : 1.3));
      });
      c.head.rotation.set(0.5 * sit + 0.25 * st.lie + Math.sin(now * 0.8) * 0.05, Math.sin(now * 0.6 + seed) * 0.35 * (1 - st.lie), 0);
      if (st.lie > 0.5) c.head.rotation.z = 0.3 * st.lie;          // napping head tilt
      const wag = moving ? 0.25 : 0.12, lift = moving ? 0.9 : 0.25 - st.lie * 0.4;
      c.tail.forEach((s, i) => {
        s.rotation.y = Math.sin(now * (moving ? 6 : 1.8) - i * 0.7 + seed) * wag;
        s.rotation.x = i === 0 ? lift : (moving ? -0.12 : 0.08);
        if (st.lie > 0.5) s.rotation.y += 0.32;                    // tail curls round when lying
      });
      c.shadow.position.y = 0.003 - c.g.position.y + (st.perch ? PERCH[st.perch].at.y : 0);
    },
  };
}

export function createLife({ world }) {
  const streamer = createStreamer(world.items.chair);
  world.root.add(streamer.group);
  const cats = [createCat('orange', 2, 7), createCat('black', 9, 13)];
  cats.forEach(c => world.root.add(c.group));
  let last = 0, showStreamer = false;
  return {
    pickables() {
      const out = [];
      [streamer.group, ...cats.map(c => c.group)].forEach(g => g.traverse(o => { if (o.isMesh && o.userData.decor) out.push(o); }));
      return out;
    },
    poke(name) { const now = performance.now() / 1000; cats.find(c => c.name === name)?.poke(now); },
    setStreamer(on) { showStreamer = on; streamer.group.visible = on; },
    // advance at ~30 fps; returns true when a frame should be drawn
    tick(ms) {
      if (ms - last < 33) return false;
      const now = ms / 1000, dt = Math.min(0.1, (ms - last) / 1000);
      last = ms;
      for (const c of cats) c.tick(now, dt);
      if (showStreamer) streamer.tick(now);
      return true;
    },
  };
}
