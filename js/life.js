// Life in the room: two cats, Bon Bon (orange) and Abu Farwa (black), who
// wander, now and then run, jump on the desk, sit on the PC case and nap.
// They spend most of their time resting, and only one moves at a time.
// Each is a handful of capsules and spheres; it animates at ~30 fps and
// only asks for frames while something is visible.
import * as THREE from 'three';
import { toon, blob } from './scene.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// A capsule, unit length along Y, scaled to size.
const capGeo = new Map();
function capsule(r, mat) {
  if (!capGeo.has(r)) capGeo.set(r, new THREE.CapsuleGeometry(r, 1, 4, 10));
  return new THREE.Mesh(capGeo.get(r), mat);
}
const sphere = (r, mat) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);

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

function createCat(kind, start, seed, othersBusy) {
  const c = buildCat(kind);
  c.g.position.set(FLOOR[start][0], 0, FLOOR[start][1]);
  let rand = seed;
  const rnd = () => ((rand = (rand * 16807) % 2147483647) / 2147483647);
  const st = { node: start, perch: null, act: 'sit', until: 4 + rnd() * 6, path: [], speed: 0, jump: null, heading: rnd() * 6, phase: 0, pose: 0, poseGoal: 0.6, lieGoal: 0, lie: 0 };

  function plan(now) {
    const wait = () => { st.until = now + 4 + rnd() * 6; };   // the other cat is on the move: stay put a bit longer
    if (st.perch) {                                    // up high: nap, then hop down
      if (st.act !== 'rest') { st.act = 'rest'; st.until = now + 30 + rnd() * 30; st.poseGoal = rnd() < 0.5 ? 1 : 0.6; st.lieGoal = st.poseGoal === 1 ? 1 : 0; return; }
      if (othersBusy()) return wait();
      const p = PERCH[st.perch];
      st.jump = { from: c.g.position.clone(), to: V(FLOOR[p.from][0], 0, FLOOR[p.from][1]), t0: now, dur: 0.55 };
      st.node = p.from; st.perch = null; st.act = 'jump'; st.lieGoal = 0; st.poseGoal = 0;
      return;
    }
    const r = rnd(), still = r >= 0.45;
    if (!still && othersBusy()) return wait();
    st.lieGoal = 0;
    if (r < 0.25) { go(Math.floor(rnd() * FLOOR.length), 0.16); }               // stroll
    else if (r < 0.29) { go(Math.floor(rnd() * FLOOR.length), 0.8); }           // zoomies, now and then
    else if (r < 0.45) { const k = ['case', 'deskL', 'deskR'][Math.floor(rnd() * 3)]; go(PERCH[k].from, 0.18, k); }
    else if (r < 0.7) { st.act = 'sit'; st.poseGoal = 0.6; st.until = now + 15 + rnd() * 15; }
    else { st.act = 'lie'; st.poseGoal = 1; st.lieGoal = 1; st.until = now + 40 + rnd() * 50; }
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
    busy: () => st.act === 'walk' || st.act === 'jump',
    poke(now) { if (st.jump) return; st.act = st.perch ? 'perched' : 'sit'; st.poseGoal = 0.6; st.lieGoal = 0; st.path = []; st.until = now + 8; },
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
          else { st.act = 'sit'; st.until = now + 8 + rnd() * 7; st.poseGoal = 0.6; }
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
            else { st.act = 'sit'; st.poseGoal = 0.6; st.until = now + 8 + rnd() * 7; }
          }
        } else { c.g.position.x += dx / d * step; c.g.position.z += dz / d * step; }
        st.phase += dt * (st.speed > 0.5 ? 16 : 7);
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
  const cats = [];
  for (const [kind, start, seed] of [['orange', 2, 7], ['black', 9, 13]]) {
    const cat = createCat(kind, start, seed, () => cats.some(o => o !== cat && o.busy()));  // one moves at a time
    cats.push(cat);
    world.root.add(cat.group);
  }
  let last = 0;
  return {
    pickables() {
      const out = [];
      cats.forEach(c => c.group.traverse(o => { if (o.isMesh && o.userData.decor) out.push(o); }));
      return out;
    },
    poke(name) { const now = performance.now() / 1000; cats.find(c => c.name === name)?.poke(now); },
    // advance at ~30 fps; returns true when a frame should be drawn
    tick(ms) {
      if (ms - last < 33) return false;
      const now = ms / 1000, dt = Math.min(0.1, (ms - last) / 1000);
      last = ms;
      for (const c of cats) c.tick(now, dt);
      return true;
    },
  };
}
