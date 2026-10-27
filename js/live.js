// Live stream on the center monitor. When Eyad is live on Kick, the real Kick
// player is laid over the center screen and a "مباشر الحين" badge shows in the
// top bar. The camera is orthographic, so the screen always lands on the page
// as a parallelogram: three projected corners give the CSS matrix for the iframe.
// The iframe exists only while live and in stream mode, so idle visitors pay nothing.
import * as THREE from 'three';

const CHANNEL = 'eyadzaki';
const API = `https://kick.com/api/v2/channels/${CHANNEL}`;
const PLAYER = `https://player.kick.com/${CHANNEL}?autoplay=true&muted=true`;
const POLL_MS = 2 * 60 * 1000;
const PX_W = 960; // iframe drawn at this CSS size, then mapped onto the screen

export function createLive({ screenMesh, container, onChange }) {
  const { width: gw, height: gh } = screenMesh.geometry.parameters;
  const PX_H = Math.round(PX_W * gh / gw);
  const holder = document.createElement('div');
  holder.className = 'live-screen';
  holder.style.width = `${PX_W}px`;
  holder.style.height = `${PX_H}px`;
  holder.hidden = true;
  container.appendChild(holder);

  // Screen corners in the mesh's own space: top-left, top-right, bottom-left.
  const corners = [V(-gw / 2, gh / 2), V(gw / 2, gh / 2), V(-gw / 2, -gh / 2)];
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  const badge = document.getElementById('live-badge');
  const banner = document.getElementById('live-banner');
  let live = null;       // { title } while live
  let wanted = false;    // stream mode is on
  let iframe = null;

  function sync() {
    const show = !!live && wanted;
    if (show && !iframe) {
      iframe = document.createElement('iframe');
      iframe.src = PLAYER;
      iframe.title = 'بث إياد المباشر على Kick';
      iframe.allow = 'autoplay; fullscreen';
      holder.appendChild(iframe);
    } else if (!show && iframe) {
      iframe.remove();
      iframe = null;
    }
    holder.hidden = !show;
    badge.hidden = !live;
    banner.hidden = !live;
    document.body.classList.toggle('is-live', !!live);
    if (live) { badge.title = live.title; document.getElementById('live-title').textContent = live.title; }
    onChange();
  }

  // `?livetest` in the URL fakes a live state, to preview the layout offline.
  const fake = new URLSearchParams(location.search).has('livetest');

  async function check() {
    if (fake) { if (!live) { live = { title: 'تجربة البث' }; sync(); } return; }
    try {
      const r = await fetch(API, { headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const j = await r.json();
      const was = !!live;
      live = j.livestream ? { title: j.livestream.session_title || 'مباشر على Kick' } : null;
      if (was !== !!live) sync();
    } catch { /* blocked or offline: keep the drawn screen */ }
  }

  setTimeout(check, 0); // after the caller has finished setting up
  setInterval(() => { if (!document.hidden) check(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });

  return {
    get isLive() { return !!live; },
    setMode(mode) { wanted = mode === 'stream'; sync(); },
    // Map the iframe onto the screen's projected corners (call after rendering).
    place(camera, w, h) {
      if (holder.hidden) return;
      screenMesh.updateWorldMatrix(true, false);
      corners.forEach((c, i) => {
        p[i].copy(c).applyMatrix4(screenMesh.matrixWorld).project(camera);
        p[i].set((p[i].x + 1) / 2 * w, (1 - p[i].y) / 2 * h, 0);
      });
      const a = (p[1].x - p[0].x) / PX_W, b = (p[1].y - p[0].y) / PX_W;
      const c = (p[2].x - p[0].x) / PX_H, d = (p[2].y - p[0].y) / PX_H;
      holder.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${p[0].x}, ${p[0].y})`;
    },
  };
}

function V(x, y) { return new THREE.Vector3(x, y, 0.001); }
