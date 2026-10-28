// Little reactions when you touch things on the desk, plus the toggles shown in
// their cards (ring light, LED, what a monitor shows...). Sounds are made with
// Web Audio on the spot, short and quiet, and only ever follow a click.
import { applyMode } from './scene.js';


/* ---------- sounds ---------- */
let ac = null;
const audio = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());
function tone(freq, dur, { type = 'sine', gain = 0.04, at = 0, to = freq } = {}) {
  const a = audio(), t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function click(at = 0, gain = 0.07) {
  const a = audio(), t = a.currentTime + at;
  const buf = a.createBuffer(1, a.sampleRate * 0.02, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2600 + Math.random() * 1200; f.Q.value = 0.8;
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}
const SFX = {
  tick: () => tone(1400, 0.05, { gain: 0.03 }),
  type: () => { let at = 0; for (let i = 0; i < 9; i++) { click(at); at += 0.06 + Math.random() * 0.07; } },
  mouse: () => { click(0, 0.05); click(0.09, 0.04); },
  rumble: () => { tone(58, 0.4, { type: 'square', gain: 0.025 }); tone(62, 0.4, { type: 'square', gain: 0.02, at: 0.05 }); },
  meow: () => { tone(520, 0.12, { type: 'triangle', gain: 0.05, to: 880 }); tone(880, 0.22, { type: 'triangle', gain: 0.045, at: 0.11, to: 430 }); },
  on: () => { tone(620, 0.07, { gain: 0.035 }); tone(930, 0.09, { gain: 0.035, at: 0.07 }); },
  off: () => { tone(930, 0.07, { gain: 0.035 }); tone(620, 0.09, { gain: 0.035, at: 0.07 }); },
};
// Sounds are on by default; the top bar's button mutes them (remembered per browser).
let muted = false;
try { muted = localStorage.getItem('ez-muted') === '1'; } catch {}
export const sound = {
  get muted() { return muted; },
  set muted(v) { muted = v; try { localStorage.setItem('ez-muted', v ? '1' : '0'); } catch {} },
};
export const play = name => { if (muted) return; try { SFX[name](); } catch { /* audio not allowed yet */ } };

export function createInteractions({ world, getMode }) {
  const { items, fx, screens } = world;
  const anims = [];
  const animate = (dur, step) => anims.push({ t0: performance.now(), dur, step });

  const press = (g, depth = 0.004, dur = 160) => {
    const y = g.userData.baseY ??= g.position.y;
    animate(dur, k => { g.position.y = y - depth * Math.sin(Math.PI * k); });
  };
  const flash = (mesh, color, dur = 700) => {
    const base = mesh.material.color.getHex();
    animate(dur, k => { mesh.material.color.setHex(k < 1 ? color : base); });
  };

  // What happens the moment you click a piece.
  const REACT = {
    keyboard: () => { press(items.keyboard); play('type'); },
    mouse: () => { press(items.mouse, 0.003, 120); play('mouse'); },
    controller: () => rumble(),
    mic: () => { flash(items.mic.userData.flash, 0xffffff, 600); play('tick'); },
    webcam: () => { flash(items.webcam.userData.flash, 0xffffff, 900); play('tick'); },
    case: () => { flash({ material: fx.fanMat }, 0xf0d0ff, 900); play('tick'); },
    chair: () => { const g = items.chair; animate(380, k => { g.scale.y = 1 - 0.035 * Math.sin(Math.PI * k); }); play('tick'); },
    ringlight: () => toggleRing(),
  };
  function rumble() {
    const g = items.controller, r = g.userData.baseRot ??= g.rotation.y;
    animate(450, k => { g.rotation.y = r + (k < 1 ? Math.sin(k * 60) * 0.06 * (1 - k) : 0); });
    play('rumble');
    navigator.vibrate?.(120);
  }

  const ringOn = () => fx.ringLight.intensity > 0;
  const ledOn = () => fx.ledLight.intensity > 0;
  function toggleRing() {
    fx.ringOverride = !ringOn();
    applyMode(world, getMode(), true);
    play(fx.ringOverride ? 'on' : 'off');
  }
  function toggleLed() {
    fx.ledOverride = !ledOn();
    applyMode(world, getMode(), true);
    play(fx.ledOverride ? 'on' : 'off');
  }

  const MONITOR = { 'monitor-left': 'left', 'monitor-center': 'center', 'monitor-right': 'right' };

  return {
    react(id) { REACT[id]?.(); },
    // Buttons shown in a piece's card.
    actions(id) {
      if (id === 'ringlight') return [{ key: 'ring', label: ringOn() ? '💡 طفّ الرينج لايت' : '💡 شغّل الرينج لايت' }];
      if (id === 'desk') return [{ key: 'led', label: ledOn() ? '💜 طفّ الليد' : '💜 شغّل الليد' }];
      if (MONITOR[id]) return [{ key: 'cycle', label: '🖥️ غيّر اللي على الشاشة' }];
      if (id === 'keyboard') return [{ key: 'type', label: '⌨️ جرّب صوت الكيبورد' }];
      if (id === 'controller') return [{ key: 'rumble', label: '🎮 هزّ اليد' }];
      return [];
    },
    run(id, key) {
      if (key === 'ring') toggleRing();
      else if (key === 'led') toggleLed();
      else if (key === 'cycle') { screens.cycle(MONITOR[id]); play('tick'); }
      else if (key === 'type') REACT.keyboard();
      else if (key === 'rumble') rumble();
    },
    // Advance running animations; true while something moved this frame.
    tick(now) {
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i], k = Math.min(1, (now - a.t0) / a.dur);
        a.step(k);
        if (k >= 1) anims.splice(i, 1);
      }
      return anims.length > 0;
    },
  };
}
