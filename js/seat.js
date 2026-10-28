// "اقعد على الكرسي": a first-person view from the recliner. A perspective
// camera sits at your eye height; drag to turn your head, wheel / pinch to
// lean in. Getting in is a slow dolly from behind the backrest.
import * as THREE from 'three';

const EYE = new THREE.Vector3(1.29, 1.08, 1.29);  // head against the pillow rolls
const LOOK = new THREE.Vector3(0.42, 1.0, 0.42);  // straight at the center monitor
const BASE_YAW = Math.atan2(LOOK.x - EYE.x, LOOK.z - EYE.z);
const BASE_PITCH = Math.atan2(LOOK.y - EYE.y, Math.hypot(LOOK.x - EYE.x, LOOK.z - EYE.z));
const YAW = 0.6, PITCH_UP = 0.3, PITCH_DOWN = 0.6;   // how far your head turns (stays inside the room)
const FOV_MIN = 30, FOV_MAX = 90;
let FOV = 62; // vertical; wider on portrait phones so the three monitors fit

export function createSeat(canvas) {
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.03, 20);
  let on = false;
  let yaw = 0, pitch = 0, fov = FOV;        // current, relative to straight ahead
  let goal = null;                           // { yaw, pitch, fov, t0, ms, from } while easing
  let saved = null;                          // view to return to after a card
  let entering = null;                       // dolly-in on the way into the seat
  let drag = null;
  const pinch = new Map();

  function apply() {
    const yw = BASE_YAW + yaw, pt = BASE_PITCH + pitch;
    const dir = new THREE.Vector3(Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt));
    camera.lookAt(camera.position.clone().add(dir));
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  function easeTo(y, p, f, ms = 1100) {
    goal = { yaw: y, pitch: p, fov: f, t0: performance.now(), ms, from: { yaw, pitch, fov } };
  }
  const clampView = () => {
    yaw = THREE.MathUtils.clamp(yaw, -YAW, YAW);
    pitch = THREE.MathUtils.clamp(pitch, -PITCH_DOWN, PITCH_UP);
    fov = THREE.MathUtils.clamp(fov, FOV_MIN, FOV_MAX);
  };

  // Look controls (only while seated).
  canvas.addEventListener('pointerdown', e => {
    if (!on) return;
    pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = { x: e.clientX, y: e.clientY };
    goal = null;
  });
  addEventListener('pointermove', e => {
    if (!on || !drag) return;
    if (pinch.has(e.pointerId)) {
      const prev = pinch.get(e.pointerId);
      if (pinch.size === 2) {
        const [a, b] = [...pinch.values()];
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        prev.x = e.clientX; prev.y = e.clientY;
        const [c, d] = [...pinch.values()];
        fov *= before / Math.max(1, Math.hypot(c.x - d.x, c.y - d.y));
        clampView();
        return;
      }
      prev.x = e.clientX; prev.y = e.clientY;
    }
    const k = (fov / FOV) * 0.003;
    yaw += (e.clientX - drag.x) * k;     // drag right = look right
    pitch += (e.clientY - drag.y) * k;
    drag = { x: e.clientX, y: e.clientY };
    clampView();
  });
  const up = e => { pinch.delete(e.pointerId); if (!pinch.size) drag = null; };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => {
    if (!on) return;
    e.preventDefault();
    fov *= Math.exp(e.deltaY * 0.001);
    clampView();
  }, { passive: false });

  return {
    camera,
    get on() { return on; },
    get dragging() { return !!drag; },
    setAspect(a) {
      const was = FOV;
      FOV = a < 1 ? 84 : 62;
      if (on) { fov += FOV - was; clampView(); }
      camera.aspect = a;
      camera.updateProjectionMatrix();
    },
    enter(reduceMotion) {
      on = true;
      yaw = 0; pitch = -0.05; fov = FOV + 8;
      goal = null; saved = null;
      entering = { t0: performance.now(), ms: reduceMotion ? 700 : 1500 };
      camera.position.copy(EYE);
      if (entering) camera.position.add(new THREE.Vector3(0.28, 0.16, 0.28));
      easeTo(0, 0, FOV, reduceMotion ? 700 : 1500);
      apply();
    },
    exit() { on = false; drag = null; pinch.clear(); },
    // Turn your head toward a point (a card opening) and remember where you were.
    lookAt(p) {
      if (!saved) saved = { yaw, pitch, fov };
      const d = p.clone().sub(EYE);
      const y = THREE.MathUtils.euclideanModulo(Math.atan2(d.x, d.z) - BASE_YAW + Math.PI, Math.PI * 2) - Math.PI;
      const pt = Math.atan2(d.y, Math.hypot(d.x, d.z)) - BASE_PITCH;
      easeTo(THREE.MathUtils.clamp(y, -YAW, YAW), THREE.MathUtils.clamp(pt, -PITCH_DOWN, PITCH_UP), 44);
    },
    restore() { if (saved) easeTo(saved.yaw, saved.pitch, saved.fov); saved = null; },
    // Returns true while the view is still moving.
    update(now) {
      if (!on) return false;
      let moving = !!drag;
      if (entering) {
        const k = Math.min(1, (now - entering.t0) / entering.ms), e = 1 - (1 - k) ** 3;
        camera.position.copy(EYE).add(new THREE.Vector3(0.28, 0.16, 0.28).multiplyScalar(1 - e));
        if (k >= 1) entering = null;
        moving = true;
      }
      if (goal) {
        const k = Math.min(1, (now - goal.t0) / goal.ms), e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
        yaw = THREE.MathUtils.lerp(goal.from.yaw, goal.yaw, e);
        pitch = THREE.MathUtils.lerp(goal.from.pitch, goal.pitch, e);
        fov = THREE.MathUtils.lerp(goal.from.fov, goal.fov, e);
        if (k >= 1) goal = null;
        moving = true;
      }
      apply();
      return moving;
    },
  };
}
