// Monitor contents drawn on small canvases, under a thin Windows taskbar so the
// screens look in use. The YouTube screens draw each channel page with its real
// latest uploads (data/videos.json); the screenshots in assets/screens are the
// fallback and the source of the banner and avatar.
// Only animated bits are redrawn, ~10 times a second from main.js.
import * as THREE from 'three';

const FONT = "'IBM Plex Sans Arabic', system-ui, sans-serif";
const PURPLE = '#c04bff';
const KICK = '#53fc18';
const W = 512, H = 288, TB = 16; // canvas size and taskbar height

// Real names from Eyad's Kick chat this week; the lines are short, neutral
// reactions so nobody is quoted saying something they didn't.
const CHAT = [
  ['ROCK41A', 'يا هلا 👋'], ['ZRAR112', 'GG'], ['Yu0Gi', '😂😂'],
  ['iM_7m9', 'كمّل كمّل'], ['0gagoshxx', 'امين'], ['abood21323', '🔥🔥'],
  ['Aboodbabawy', 'ههههههه'], ['DARK5S0ULS', 'GG 💜'], ['ROCK41A', 'ايوه'],
  ['ZRAR112', 'يلا يلا'], ['Yu0Gi', '👀'], ['iM_7m9', 'سلام'],
];
let STREAM = null; // data/stream.json: game + title of the stream the frame comes from

const IMG = {};
let FEED = null;            // data/videos.json, refreshed every 6h by a GitHub Action
const THUMBS = {};          // video id -> loaded thumbnail
const ytCache = {};         // channel -> pre-drawn page (cursor goes on top)
function loadImages(onLoad) {
  const done = () => { for (const k in ytCache) delete ytCache[k]; onLoad(); };
  const load = (name, v = '') => {
    const im = new Image();
    im.onload = () => { IMG[name] = im; done(); };
    im.src = `assets/screens/${name}.jpg${v}`;
  };
  for (const name of ['yt-ez', 'yt-bro', 'game']) load(name);
  // The Kick frame is refreshed by the GitHub Action after each stream.
  fetch('data/stream.json', { cache: 'no-cache' }).then(r => r.json())
    .then(s => { STREAM = s; load('kick-stream', '?v=' + encodeURIComponent(s.updated)); })
    .catch(() => load('kick-stream'));
  const logo = new Image();
  logo.onload = () => { IMG.ez = logo; done(); };
  logo.src = 'assets/ez-64.png';
  fetch('data/videos.json', { cache: 'no-cache' }).then(r => r.json()).then(feed => {
    FEED = feed;
    for (const ch of Object.values(feed.channels)) for (const v of ch.videos) {
      const im = new Image();
      im.crossOrigin = 'anonymous'; // keeps the canvas usable as a WebGL texture
      im.onload = () => { THUMBS[v.id] = im; done(); };
      im.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
    }
    done();
  }).catch(() => {}); // no feed: the channel screenshots stay
}

// What each monitor shows in each mode.
export const LAYOUT = {
  work:   { left: 'obs', center: 'edit', right: 'yt-ez' },
  stream: { left: 'yt-ez',   center: 'kick',   right: 'yt-bro' },
  game:   { left: 'discord', center: 'game',   right: 'yt-bro' },
};
const CYCLE = ['yt-ez', 'kick', 'yt-bro', 'game', 'discord', 'chat', 'edit', 'obs'];
const ANIMATED = new Set(['obs', 'edit', 'kick', 'chat', 'discord', 'yt-ez', 'yt-bro']);

// Discord voice room: who's in it, and the text channel beside it.
const VOICE = [
  { name: 'Eyad', color: PURPLE, me: true }, { name: 'أبو فهد', color: '#e8a33d' },
  { name: 'نواف', color: '#3ba55d' }, { name: 'بندر', color: '#5865f2' }, { name: 'سعود', color: '#eb459e' },
];
const DCHAT = [
  ['أبو فهد', 'وراك وراك 😂'], ['نواف', 'خذ الجهة اليمين'], ['بندر', 'GG يا شباب'],
  ['سعود', 'مين بيجيب الذخيرة؟'], ['Eyad', 'لحظة أشحن اليد 🎮'], ['أبو فهد', 'الماب ذي حلوة'],
  ['نواف', 'ريستارت؟'], ['بندر', 'وش رأيكم نكمل بكرة'], ['سعود', 'ههههههه'],
];
// Someone talks for a moment, then someone else; a couple can overlap.
const talking = (i, t) => Math.sin(t / (700 + i * 230) + i * 2.1) + Math.sin(t / (1900 + i * 410) + i) > 0.9;

export function createScreens() {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { ctx: c.getContext('2d'), tex };
  };
  const s = { left: make(), center: make(), right: make() };
  let mode = 'stream';
  const override = {};   // slot -> view picked from the monitor's card
  const viewOf = key => override[key] || LAYOUT[mode][key];

  function draw(key, t) {
    const S = s[key], view = viewOf(key);
    DRAW[view](S.ctx, t);
    taskbar(S.ctx);
    S.tex.needsUpdate = true;
  }
  const drawAll = t => ['left', 'center', 'right'].forEach(k => draw(k, t));
  loadImages(() => drawAll(performance.now()));

  return {
    textures: { left: s.left.tex, center: s.center.tex, right: s.right.tex },
    setMode(m) { mode = m; for (const k in override) delete override[k]; drawAll(performance.now()); },
    view: viewOf,
    // Step a monitor to the next thing it can show.
    cycle(key) {
      const i = CYCLE.indexOf(viewOf(key));
      override[key] = CYCLE[(i + 1) % CYCLE.length];
      draw(key, performance.now());
      return override[key];
    },
    tick(t) {
      for (const k of ['left', 'center', 'right']) if (ANIMATED.has(viewOf(k))) draw(k, t);
    },
  };
}

/* ---------- pieces ---------- */

function bg(ctx, c) { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); }
function rr(ctx, x, y, w, h, r, fill) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
}
function text(ctx, str, x, y, size, color, weight = 600, align = 'right') {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.direction = align === 'right' ? 'rtl' : 'ltr';
  ctx.fillText(str, x, y);
}
function image(ctx, name, x = 0, y = 0, w = W, h = H - TB) {
  if (IMG[name]) ctx.drawImage(IMG[name], x, y, w, h);
  else { ctx.fillStyle = '#111'; ctx.fillRect(x, y, w, h); }
}

function taskbar(ctx) {
  ctx.fillStyle = '#1b1b22'; ctx.fillRect(0, H - TB, W, TB);
  const icons = ['#3a7bff', '#f2b93b', '#e5242b', KICK, PURPLE, '#7ad7ff'];
  icons.forEach((c, i) => rr(ctx, W / 2 - 54 + i * 18, H - TB + 3, 10, 10, 2, c));
  ctx.fillStyle = '#c9c9d2'; ctx.fillRect(W - 40, H - TB + 6, 28, 4);
}

/* ---------- YouTube channel page with the real latest uploads ---------- */

// Thumbnail grid: 4 columns; the second row runs off the bottom like a scrolled page.
const GX = 12, GY = 140, GW = 116, GH = 65, GAP = 8, ROW = 96;
const cell = i => [GX + (i % 4) * (GW + GAP), GY + Math.floor(i / 4) * ROW];

function ago(iso) {
  const d = (Date.now() - new Date(iso)) / 864e5;
  if (d < 1) { const h = Math.max(1, Math.round(d * 24)); return `${h} hour${h > 1 ? 's' : ''} ago`; }
  if (d < 30) { const n = Math.round(d); return `${n} day${n > 1 ? 's' : ''} ago`; }
  const m = Math.round(d / 30);
  return m < 12 ? `${m} month${m > 1 ? 's' : ''} ago` : `${Math.round(m / 12)} year ago`;
}
function fit(ctx, str, max) {
  if (ctx.measureText(str).width <= max) return str;
  while (str.length && ctx.measureText(str + '…').width > max) str = str.slice(0, -1);
  return str + '…';
}

function buildYtPage(key) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const shot = IMG[`yt-${key}`];
  const ch = FEED?.channels[key];
  if (!ch) { if (shot) ctx.drawImage(shot, 0, 0, W, H - TB); return c; }

  bg(ctx, '#0f0f0f');
  // top bar: logo, search, account
  rr(ctx, 10, 5, 17, 12, 3, '#ff0033');
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(16, 8); ctx.lineTo(16, 14); ctx.lineTo(21, 11); ctx.fill();
  text(ctx, 'YouTube', 31, 11, 11, '#fff', 700, 'left');
  rr(ctx, 160, 4, 200, 14, 7, '#222');
  ctx.beginPath(); ctx.arc(W - 16, 11, 6, 0, 7); ctx.fillStyle = '#3a3a3a'; ctx.fill();
  // banner and avatar, cropped from the channel screenshot
  if (shot) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(12, 24, W - 24, 46, 8); ctx.clip();
    ctx.drawImage(shot, 68, 44, 534, 50, 12, 24, W - 24, 46);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(40, 98, 22, 0, 7); ctx.clip();
    ctx.drawImage(shot, 66, 126, 80, 80, 18, 76, 44, 44);
    ctx.restore();
  }
  text(ctx, ch.name, 72, 90, 15, '#fff', 700, 'left');
  text(ctx, `${ch.handle} • ${ch.subs ?? ''} subscribers`, 72, 108, 9, '#aaa', 500, 'left');
  rr(ctx, 72, 116, 52, 14, 7, '#f1f1f1');
  text(ctx, 'Subscribe', 98, 123.5, 8, '#0f0f0f', 700, 'center');
  ['Home', 'Videos', 'Shorts', 'Live'].forEach((tab, i) => text(ctx, tab, 300 + i * 50, 122, 9, i === 1 ? '#fff' : '#aaa', 600, 'left'));
  ctx.fillStyle = '#fff'; ctx.fillRect(350, 131, 30, 2);
  ctx.fillStyle = '#272727'; ctx.fillRect(12, 134, W - 24, 1);

  ch.videos.forEach((v, i) => {
    const [x, y] = cell(i);
    const im = THUMBS[v.id];
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, GW, GH, 5); ctx.clip();
    if (im) ctx.drawImage(im, x, y, GW, GH); else { ctx.fillStyle = '#222'; ctx.fillRect(x, y, GW, GH); }
    ctx.restore();
    if ((Date.now() - new Date(v.published)) / 864e5 < 3) { rr(ctx, x + 4, y + 4, 26, 11, 2, '#cc0000'); text(ctx, 'NEW', x + 17, y + 9.5, 7, '#fff', 700, 'center'); }
    ctx.font = `600 9px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = '#f1f1f1'; ctx.textBaseline = 'middle';
    ctx.fillText(fit(ctx, v.title, GW), x + GW, y + GH + 9);
    text(ctx, ago(v.published), x, y + GH + 21, 7.5, '#aaa', 500, 'left');
  });
  return c;
}

// The pointer drifts from one video to the next and hovers on it.
function ytPage(ctx, key, t) {
  ytCache[key] ||= buildYtPage(key);
  ctx.drawImage(ytCache[key], 0, 0);
  const n = FEED?.channels[key]?.videos.length;
  if (!n) return;
  const slot = Math.floor(t / 2600), k = Math.min(1, (t % 2600) / 900), e = k * k * (3 - 2 * k);
  const order = i => (i * 5 + (key === 'bro' ? 2 : 0)) % Math.min(n, 4);
  const [ax, ay] = cell(order(slot)), [bx, by] = cell(order(slot + 1));
  const px = ax + (bx - ax) * e + GW * 0.55, py = ay + (by - ay) * e + GH * 0.6;
  if (k === 1) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(bx - 1, by - 1, GW + 2, GH + 2, 6); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + 13); ctx.lineTo(px + 3.5, py + 9.5); ctx.lineTo(px + 8.5, py + 9.5); ctx.closePath(); ctx.fill(); ctx.stroke();
}

const DRAW = {
  'yt-ez': (ctx, t) => ytPage(ctx, 'ez', t),
  'yt-bro': (ctx, t) => ytPage(ctx, 'bro', t),

  game(ctx) { image(ctx, 'game'); },

  // OBS Studio getting the stream ready: preview, scenes, sources, live audio meters.
  obs(ctx, t) {
    bg(ctx, '#1f1e24');
    ctx.fillStyle = '#2b2a31'; ctx.fillRect(0, 0, W, 14);
    text(ctx, 'OBS 31.0 - Profile: EZ - Scenes: البث', 8, 7, 8, '#c9c9d2', 500, 'left');
    // preview with the webcam box in its corner
    const pw = 300, ph = 169, px = (W - pw) / 2, py = 20;
    image(ctx, 'game', px, py, pw, ph);
    rr(ctx, px + 6, py + 6, 70, 42, 4, PURPLE);
    if (IMG['kick-stream']) ctx.drawImage(IMG['kick-stream'], 2, 84, 134, 76, px + 8, py + 8, 66, 38); // the webcam corner of the stream frame
    // docks
    const dy = py + ph + 6, dh = H - TB - dy - 4;
    const dock = (x, w, title) => { rr(ctx, x, dy, w, dh, 3, '#28272e'); text(ctx, title, x + 6, dy + 8, 8, '#9b9aa5', 600, 'left'); };
    dock(4, 110, 'Scenes');
    ['بث القيمنق', 'البداية', 'استراحة', 'النهاية'].forEach((s, i) => {
      if (!i) rr(ctx, 8, dy + 16, 102, 13, 2, '#4b3a78');
      text(ctx, s, 104, dy + 22.5 + i * 15, 9, '#e8e8ee', 500);
    });
    dock(118, 120, 'Sources');
    ['Game Capture', 'Webcam · Kiyo Pro', 'Chat Overlay', 'Alerts'].forEach((s, i) => text(ctx, s, 124, dy + 22 + i * 15, 8.5, '#d4d4dc', 500, 'left'));
    dock(242, 186, 'Audio Mixer');
    ['Mic · PD400X', 'Desktop', 'Discord'].forEach((s, i) => {
      const y = dy + 20 + i * 18;
      text(ctx, s, 248, y, 7.5, '#bdbdc6', 500, 'left');
      const lvl = 0.35 + 0.5 * Math.abs(Math.sin(t / (260 + i * 90) + i)) * (i === 2 ? 0.4 : 1);
      ctx.fillStyle = '#3a3942'; ctx.fillRect(248, y + 5, 172, 4);
      const gr = ctx.createLinearGradient(248, 0, 420, 0);
      gr.addColorStop(0, '#3ccf6a'); gr.addColorStop(0.7, '#e8d24a'); gr.addColorStop(1, '#e5484d');
      ctx.fillStyle = gr; ctx.fillRect(248, y + 5, 172 * lvl, 4);
    });
    dock(432, 76, 'Controls');
    rr(ctx, 436, dy + 16, 68, 14, 2, '#e5484d');
    text(ctx, 'Start Streaming', 470, dy + 23, 7, '#fff', 700, 'center');
    rr(ctx, 436, dy + 34, 68, 14, 2, '#3a3942');
    text(ctx, 'Start Recording', 470, dy + 41, 7, '#e8e8ee', 600, 'center');
  },

  // Editing the next YouTube video: preview, media bin and a timeline with a moving playhead.
  edit(ctx, t) {
    bg(ctx, '#17161b');
    ctx.fillStyle = '#232229'; ctx.fillRect(0, 0, W, 14);
    text(ctx, 'المونتاج · مقطع البروبريل الجاي.prproj', W - 8, 7, 8, '#c9c9d2', 500);
    // media bin
    rr(ctx, 4, 18, 150, 140, 3, '#1f1e25');
    for (let i = 0; i < 6; i++) {
      const x = 10 + (i % 2) * 72, y = 24 + Math.floor(i / 2) * 44;
      if (IMG.game) ctx.drawImage(IMG.game, (i * 97) % 400, (i * 53) % 200, 240, 135, x, y, 66, 37);
    }
    // program monitor
    rr(ctx, 160, 18, 348, 140, 3, '#0d0d10');
    image(ctx, 'kick-stream', 220, 22, 228, 128);
    // timeline
    const ty = 164, th = H - TB - ty - 4;
    rr(ctx, 4, ty, W - 8, th, 3, '#1f1e25');
    for (let i = 0; i < 24; i++) { ctx.fillStyle = '#3a3942'; ctx.fillRect(40 + i * 19.5, ty + 4, 1, 4); }
    const tracks = [['V2', '#c46bd8', [[60, 70], [210, 40], [330, 90]]], ['V1', '#4f8de0', [[40, 160], [205, 120], [330, 170]]],
      ['A1', '#3ccf6a', [[40, 290], [335, 165]]], ['A2', '#2fa58e', [[120, 120], [300, 80]]]];
    tracks.forEach(([name, c, clips], i) => {
      const y = ty + 12 + i * ((th - 16) / 4);
      text(ctx, name, 12, y + 7, 8, '#9b9aa5', 700, 'left');
      clips.forEach(([x, w]) => rr(ctx, x, y + 1, w, (th - 16) / 4 - 3, 2, c));
    });
    const ph = 40 + ((t / 40) % 460);
    ctx.fillStyle = '#e5484d'; ctx.fillRect(ph, ty + 2, 1.5, th - 4);
  },

  // Kick player: real stream frame + live badge, viewer count and channel bar.
  kick(ctx, t) {
    bg(ctx, '#0b0b0e');
    ctx.fillStyle = '#141418'; ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = KICK; ctx.font = `900 14px monospace`; ctx.textAlign = 'left'; ctx.direction = 'ltr'; ctx.textBaseline = 'middle';
    ctx.fillText('KICK', 10, 12);
    const vh = H - TB - 22 - 30;
    image(ctx, 'kick-stream', 0, 22, Math.round(vh * 16 / 9), vh);
    const on = Math.floor(t / 600) % 2;
    rr(ctx, 8, 30, 54, 18, 4, '#e5242b');
    ctx.fillStyle = on ? '#fff' : '#ffb3b3'; ctx.beginPath(); ctx.arc(18, 39, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 11px monospace`; ctx.fillText('LIVE', 26, 40);
    rr(ctx, 68, 30, 50, 18, 4, 'rgba(0,0,0,.6)');
    ctx.fillStyle = '#fff'; ctx.fillText(`👁 ${240 + Math.floor(t / 4000) % 30}`, 74, 40);
    // chat column beside the player
    const cx = Math.round(vh * 16 / 9);
    ctx.fillStyle = '#121216'; ctx.fillRect(cx, 22, W - cx, vh);
    chatLines(ctx, cx + 4, 26, W - cx - 8, vh - 8, t, 10);
    ctx.fillStyle = '#18181d'; ctx.fillRect(0, H - TB - 30, W, 30);
    ctx.save(); ctx.beginPath(); ctx.rect(70, H - TB - 30, W - 80, 30); ctx.clip();
    text(ctx, `eyadzaki · ${STREAM?.title || 'بث طويل من البروبريل'}`, W - 12, H - TB - 20, 11, '#fff', 700);
    if (STREAM?.game) text(ctx, STREAM.game, W - 12, H - TB - 8, 9, KICK, 600);
    ctx.restore();
    rr(ctx, 10, H - TB - 24, 54, 18, 4, KICK);
    ctx.fillStyle = '#0b0b0e'; ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText('Follow', 37, H - TB - 15);
  },

  discord(ctx, t) {
    bg(ctx, '#313338');
    // server rail + channel list (Discord keeps its LTR layout)
    ctx.fillStyle = '#1e1f22'; ctx.fillRect(0, 0, 38, H - TB);
    ['#5865f2', PURPLE, '#3ba55d', '#e8a33d'].forEach((c, i) => {
      ctx.beginPath(); ctx.arc(19, 20 + i * 34, 13, 0, 7); ctx.fillStyle = c; ctx.fill();
    });
    if (IMG.ez) { ctx.save(); ctx.beginPath(); ctx.arc(19, 54, 13, 0, 7); ctx.clip(); ctx.drawImage(IMG.ez, 6, 41, 26, 26); ctx.restore(); }
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 46, 3, 16);
    ctx.fillStyle = '#2b2d31'; ctx.fillRect(38, 0, 112, H - TB);
    text(ctx, 'EZ Squad', 46, 12, 10, '#f2f3f5', 700, 'left');
    ctx.fillStyle = '#1f2023'; ctx.fillRect(38, 22, 112, 1);
    text(ctx, '# الشات', 140, 34, 9, '#949ba4', 500);
    text(ctx, '# المقاطع', 140, 50, 9, '#949ba4', 500);
    text(ctx, '🔊 روم القيمنق', 140, 68, 9, '#f2f3f5', 600);
    VOICE.forEach((v, i) => {
      const y = 84 + i * 15, on = talking(i, t);
      ctx.beginPath(); ctx.arc(60, y, 5.5, 0, 7); ctx.fillStyle = v.color; ctx.fill();
      if (on) { ctx.strokeStyle = '#23a55a'; ctx.lineWidth = 1.6; ctx.stroke(); }
      text(ctx, v.name, 70, y, 8.5, on ? '#f2f3f5' : '#b5bac1', 500, 'left');
    });
    // voice tiles
    const gx = 156, gw = W - gx - 128, tw = (gw - 8) / 2, th = 62;
    VOICE.slice(0, 4).forEach((v, i) => {
      const x = gx + (i % 2) * (tw + 6), y = 8 + Math.floor(i / 2) * (th + 6), on = talking(i, t);
      rr(ctx, x, y, tw, th, 6, '#1e1f22');
      const cx = x + tw / 2, cy = y + th / 2 - 6;
      if (on) { ctx.beginPath(); ctx.arc(cx, cy, 19, 0, 7); ctx.strokeStyle = '#23a55a'; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.fillStyle = v.color; ctx.fill(); ctx.clip();
      if (v.me && IMG.ez) ctx.drawImage(IMG.ez, cx - 16, cy - 16, 32, 32);
      else text(ctx, v.name[0], cx, cy + 1, 15, '#fff', 700, 'center');
      ctx.restore();
      text(ctx, v.name, x + tw / 2, y + th - 9, 8.5, '#f2f3f5', 600, 'center');
      if (on) rr(ctx, x, y, tw, th, 6, 'rgba(35,165,90,.08)');
    });
    // call controls
    const by = 8 + 2 * (th + 6) + 4;
    [['#4e5058', '🎤'], ['#4e5058', '🎧'], ['#da373c', '✕']].forEach(([c, s], i) => {
      ctx.beginPath(); ctx.arc(gx + gw / 2 - 28 + i * 28, by + 12, 11, 0, 7); ctx.fillStyle = c; ctx.fill();
      text(ctx, s, gx + gw / 2 - 28 + i * 28, by + 12.5, 9, '#fff', 700, 'center');
    });
    // text chat on the right
    const cx0 = W - 124;
    ctx.fillStyle = '#2b2d31'; ctx.fillRect(cx0, 0, 124, H - TB);
    text(ctx, '# الشات', W - 8, 12, 9, '#f2f3f5', 700);
    const shift = Math.floor(t / 1600), rows = 8;
    ctx.save(); ctx.beginPath(); ctx.rect(cx0, 24, 124, H - TB - 52); ctx.clip();
    for (let i = 0; i < rows; i++) {
      const [who, msg] = DCHAT[(shift + i) % DCHAT.length];
      const v = VOICE.find(p => p.name === who) || VOICE[1];
      const y = 34 + i * 26;
      ctx.beginPath(); ctx.arc(W - 14, y + 4, 6, 0, 7); ctx.fillStyle = v.color; ctx.fill();
      text(ctx, who, W - 24, y, 8, v.color === PURPLE ? '#d9a6ff' : '#f2f3f5', 700);
      text(ctx, msg, W - 24, y + 11, 8, '#dbdee1', 500);
    }
    ctx.restore();
    rr(ctx, cx0 + 6, H - TB - 24, 112, 18, 5, '#383a40');
    text(ctx, 'اكتب رسالة…', W - 14, H - TB - 15, 8, '#6d6f78', 500);
  },

  chat(ctx, t) {
    bg(ctx, '#0b0b0e');
    ctx.fillStyle = '#16161c'; ctx.fillRect(0, 0, W, 26);
    text(ctx, 'شات البث', W - 12, 13, 14, '#fff', 700);
    ctx.fillStyle = KICK; ctx.font = `900 12px monospace`; ctx.textAlign = 'left'; ctx.direction = 'ltr';
    ctx.fillText('KICK', 10, 14);
    chatLines(ctx, 10, 32, W - 20, H - TB - 40, t, 16);
  },
};

function chatLines(ctx, x, y, w, h, t, size) {
  const step = size * 1.7;
  const rows = Math.floor(h / step);
  const shift = Math.floor(t / 1400);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let i = 0; i < rows; i++) {
    const [user, msg] = CHAT[(shift + i) % CHAT.length];
    const yy = y + i * step + step / 2;
    ctx.font = `700 ${size}px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = [PURPLE, KICK, '#f2b93b', '#7ad7ff'][(shift + i) % 4];
    ctx.fillText(user + ':', x + w, yy);
    const uw = ctx.measureText(user + ': ').width;
    ctx.font = `500 ${size}px ${FONT}`; ctx.fillStyle = '#e8e8ee';
    ctx.fillText(msg, x + w - uw, yy);
  }
  ctx.restore();
}
