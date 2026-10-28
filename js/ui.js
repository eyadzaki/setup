// Everything on top of the 3D scene: product card, tour, search, deep links
// and the discovery counter. Talks to the scene only through `stage`.
import {
  PRODUCTS, SCENE, SCENE_BY_ID, INSIDE, CATS, TOTAL, CHANNELS,
  CLOSE_NOTE, SUPPORT_LINE, productLink,
} from './data.js';
import { play, sound } from './interact.js';
import { track } from './track.js';

const CAT_ICON = { monitors: '🖥️', pc: '💻', audio: '🎧', stream: '🎥', input: '⌨️', furniture: '🪑' };
const shortOpinion = s => s.split(/(?<=[.؟!])\s/)[0];

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TOUR_MS = 4000;
const STORE_KEY = 'ez-found';
const VISIT_KEY = 'ez-visited';

// Which channel a monitor is showing in each mode (for "شوف القناة").
const VIEW_CHANNEL = { 'yt-ez': 'youtube', 'yt-bro': 'bro', kick: 'kick', chat: 'kick' };
const MONITOR_SLOT = { 'monitor-left': 'left', 'monitor-center': 'center', 'monitor-right': 'right' };

function badge(p) {
  if (!p.store) return ['none', 'بدون رابط'];
  if (p.close) return ['close', 'نسخة قريبة من اللي عندي'];
  if (p.store === 'amazon') return ['exact', 'نفس اللي عندي'];
  if (p.store === 'noon') return ['noon', 'من نون'];
  return ['official', 'الموقع الرسمي'];
}

function compareTable(p) {
  if (!p.compare) return '';
  return `<p class="note">⚠️ ${CLOSE_NOTE}</p>
    <div class="table-wrap"><table class="compare">
      <thead><tr><th></th><th>حقي</th><th>اللي في الرابط</th></tr></thead>
      <tbody>${p.compare.map(([k, a, b]) => `<tr><th>${esc(k)}</th><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

function buyBlock(p, key) {
  const l = productLink(p);
  if (!l) return '';
  const rel = l.sponsored ? 'sponsored noopener' : 'noopener';
  return `<a class="btn primary" href="${l.url}" target="_blank" rel="${rel}" data-track="buy" data-item="${key}" data-store="${p.store}" data-where="card">${l.label}<span aria-hidden="true">↗</span></a>
    ${l.sponsored ? `<div class="support-box"><b>💜 اشترِ من هذا الرابط وادعمني</b><span>${SUPPORT_LINE}</span></div>` : ''}
    ${p.extra ? `<a class="btn ghost" href="${p.extra.url}" target="_blank" rel="noopener">${esc(p.extra.label)}<span aria-hidden="true">↗</span></a>` : ''}`;
}

function insideList(found) {
  return `<h3 class="sub">اللي داخل الجهاز</h3>
    <ul class="inside">${INSIDE.map(k => {
      const p = PRODUCTS[k];
      return `<li><details data-key="${k}">
        <summary><span class="part">${esc(p.part)}</span><span class="pname">${esc(p.name)}</span>
          <span class="tick" ${found.has(k) ? '' : 'hidden'} aria-label="مكتشفة">✓</span></summary>
        <div class="inner">
          <p>${esc(p.desc)}</p>
          <blockquote><b>رأيي</b>${esc(p.opinion)}</blockquote>
          ${compareTable(p)}
          <div class="actions">${buyBlock(p, k)}</div>
        </div>
      </details></li>`;
    }).join('')}</ul>`;
}

export function initUI(stage) {
  /* ---------- discovery state (per visitor, browser only) ---------- */
  let found = new Set();
  try { found = new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]').filter(k => PRODUCTS[k])); } catch {}
  const counter = $('#counter');
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify([...found])); } catch {} };
  function paintCounter(pulse) {
    counter.querySelector('b').textContent = found.size;
    counter.querySelector('i').style.width = `${found.size / TOTAL * 100}%`;
    const done = found.size === TOTAL;
    counter.classList.toggle('done', done);
    // Everything found: the numbers step aside so the setup can be seen clean.
    document.body.classList.toggle('all-found', done);
    counter.setAttribute('aria-label', `اكتشفت ${found.size} من ${TOTAL} قطعة${done ? '، اضغط تشوف الإنجاز' : '، اضغط تشوف القائمة'}`);
    if (pulse) { counter.classList.remove('pulse'); void counter.offsetWidth; counter.classList.add('pulse'); }
    stage.setFound(found);
  }
  function discover(key) {
    if (found.has(key)) return;
    found.add(key);
    save();
    paintCounter(true);
    if (found.size === 1) toast(`🔍 اكتشفت أول قطعة! باقي ${TOTAL - 1}`);
    if (found.size === TOTAL) setTimeout(showAchievement, 700);
  }

  /* ---------- share ---------- */
  // Phones get their own share sheet (WhatsApp, Snapchat, Instagram...);
  // desktops get a small menu. Every share is counted in the stats.
  const SITE = 'https://eyadzaki.github.io/setup/';
  const shareDlg = $('#share');
  const canNativeShare = !!navigator.share && matchMedia('(pointer: coarse)').matches;
  async function share(hash, text, where) {
    const url = SITE + (hash ? '#' + hash : '');
    track('share-open', { where });
    if (canNativeShare) {
      try { await navigator.share({ title: 'EYAD ZAKI — كل اللي على مكتبي', text, url }); track('share', { via: 'system', where }); }
      catch { /* closed the sheet */ }
      return;
    }
    const msg = `${text} ${url}`;
    $('#share-wa').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    $('#share-x').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    $('#share-url').value = url;
    shareDlg.querySelectorAll('[data-track]').forEach(a => { a.dataset.where = where; });
    shareDlg.showModal();
  }
  $('#share-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#share-url').value); toast('✓ انسخ الرابط'); } catch { $('#share-url').select(); }
    shareDlg.close();
  });
  shareDlg.addEventListener('click', e => { if (e.target === shareDlg || e.target.closest('[data-close]')) shareDlg.close(); });
  document.querySelectorAll('[data-share-site]').forEach(b => b.addEventListener('click', () =>
    share('', 'شوف السيت أب حق إياد زكي ثلاثي الأبعاد، كل قطعة مع رأيه ورابطها 🎮', b.dataset.shareSite)));

  /* ---------- toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  /* ---------- card ---------- */
  const card = $('#card');
  const body = $('#card-body');
  let current = null;

  function cardInsets() {
    const r = card.getBoundingClientRect();
    const wide = innerWidth > 760;
    const top = $('.topbar').getBoundingClientRect().bottom;
    return wide ? { left: r.right + 8, right: 0, top, bottom: 0 } : { left: 0, right: 0, top, bottom: innerHeight - r.top };
  }

  function render(id, innerKey) {
    const s = SCENE_BY_ID[id], p = PRODUCTS[s.product];
    const [bk, bl] = badge(p);
    const slot = MONITOR_SLOT[id];
    const ch = slot && CHANNELS[VIEW_CHANNEL[stage.screenView(slot)]];
    const pic = p.img || thumbs[id];
    body.innerHTML = `
      ${pic ? `<div class="card-img"><img src="${pic}" alt="${esc(p.name)}"></div>` : ''}
      <p class="eyebrow"><span class="num">${String(s.num).padStart(2, '0')}</span>${esc(CATS[p.cat])} · ${esc(s.label)}</p>
      <h2 id="card-title">${esc(p.name)}</h2>
      <span class="badge ${bk}">${bl}</span>
      <p class="desc">${esc(p.desc)}</p>
      <blockquote><b>رأيي</b>${esc(p.opinion)}</blockquote>
      ${compareTable(p)}
      ${tryBlock(id)}
      <div class="actions">
        ${buyBlock(p, s.product)}
        ${ch ? (ch === CHANNELS.kick && stage.isLive
          ? `<a class="btn live-btn" href="${ch.url}" target="_blank" rel="noopener" data-track="channel" data-via="kick-live"><i aria-hidden="true"></i>مباشر الحين · شوف البث<span aria-hidden="true">↗</span></a>`
          : `<a class="btn ghost" href="${ch.url}" target="_blank" rel="noopener" data-track="channel" data-via="${esc(ch.label)}">شوف القناة · ${esc(ch.label)}<span aria-hidden="true">↗</span></a>`) : ''}
      </div>
      ${id === 'case' ? insideList(found) : ''}
      <div class="share-row"><button class="copy" type="button" data-share-item>📤 شارك القطعة</button><button class="copy" type="button" data-copy>🔗 انسخ الرابط</button></div>
      ${p.store === 'amazon' || id === 'case' ? '<p class="disclose">بعض الروابط روابط تسويق بالعمولة من أمازون، وقد أحصل على عمولة من المشتريات المؤهلة.</p>' : ''}`;
    body.scrollTop = 0;
    if (id === 'case') {
      body.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => {
        if (!d.open) return;
        const k = d.dataset.key;
        discover(k);
        d.querySelector('.tick').hidden = false;
        history.replaceState(null, '', '#' + k);
        stopTour();
      }));
      if (innerKey) {
        const d = body.querySelector(`details[data-key="${innerKey}"]`);
        d.open = true;
        requestAnimationFrame(() => d.scrollIntoView({ block: 'nearest' }));
      }
    }
  }

  // "جرّبه" buttons: things you can switch or play with from the card.
  function tryBlock(id) {
    const acts = [...stage.actions(id)];
    if (id === 'chair' && !stage.seated) acts.push({ key: 'sit', label: '🪑 اقعد على الكرسي' });
    if (!acts.length) return '';
    const swatches = acts.filter(a => a.swatch), buttons = acts.filter(a => !a.swatch);
    return `<div class="try">
      ${buttons.map(a => `<button class="btn ghost" type="button" data-act="${a.key}">${esc(a.label)}</button>`).join('')}
      ${swatches.length ? `<div class="swatches" role="group" aria-label="لون الليد">${swatches.map(a =>
        `<button type="button" data-act="${a.key}" style="--c:${a.swatch}" aria-pressed="${a.on}" aria-label="${esc(a.label)}"></button>`).join('')}</div>` : ''}
    </div>`;
  }

  function open(id, opts = {}) {
    if (!SCENE_BY_ID[id]) return;
    if (!opts.fromTour) stopTour();
    current = id;
    render(id, opts.inner);
    card.hidden = false;
    requestAnimationFrame(() => {
      card.classList.add('open');
      document.body.classList.add('card-open');
      stage.focus(id, cardInsets());
    });
    stage.select(id);
    play('tick');
    if (!opts.fromTour) track('open', { item: opts.inner || id });
    discover(SCENE_BY_ID[id].product);
    history.replaceState(null, '', '#' + (opts.inner || id));
    if (!opts.fromTour && !opts.silentFocus) $('#card-close').focus({ preventScroll: true });
  }

  function close() {
    if (!current) return;
    stopTour();
    current = null;
    card.classList.remove('open');
    document.body.classList.remove('card-open');
    stage.select(null);
    stage.unfocus();
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => { if (!current) card.hidden = true; }, 300);
  }

  function step(dir) {
    const order = stage.order();
    const i = order.indexOf(current);
    open(order[(i + dir + order.length) % order.length], { fromTour: !!tour });
    if (tour) restartTourTimer();
  }

  $('#card-close').addEventListener('click', close);
  $('#card-prev').addEventListener('click', () => step(-1));
  $('#card-next').addEventListener('click', () => step(1));
  body.addEventListener('click', async e => {
    const act = e.target.closest('[data-act]');
    if (act && current) {
      const id = current, key = act.dataset.act;
      stopTour();
      stage.run(id, key);
      if (key !== 'sit') {
        // re-render to refresh labels, keeping the scroll position
        const top = body.scrollTop;
        render(id);
        body.scrollTop = top;
        body.querySelector(`[data-act="${key}"]`)?.focus({ preventScroll: true });
      }
      track('try', { item: id, via: key });
      return;
    }
    const hash = location.hash.slice(1) || current;
    if (e.target.closest('[data-share-item]')) {
      share(hash, `شوف ${PRODUCTS[SCENE_BY_ID[current].product].name} في سيت أب إياد زكي 👀`, 'item:' + hash);
      return;
    }
    if (!e.target.closest('[data-copy]')) return;
    const url = SITE + '#' + hash;
    track('copy-link', { item: hash });
    try { await navigator.clipboard.writeText(url); toast('✓ انسخ الرابط'); }
    catch { toast(url); }
  });

  // Swipe the sheet down to close it (phones).
  let drag = null;
  $('#card-grab').addEventListener('pointerdown', e => { drag = { y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); });
  $('#card-grab').addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = Math.max(0, e.clientY - drag.y);
    card.style.transform = `translateY(${dy}px)`;
  });
  $('#card-grab').addEventListener('pointerup', e => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    drag = null;
    card.style.transform = '';
    if (dy > 70) close();
  });
  $('#card-grab').addEventListener('click', () => { if (!drag) close(); });

  /* ---------- tour ---------- */
  let tour = null;
  const tourBar = $('#tour');
  const tourFill = $('#tour i');
  const tourPause = $('#tour-pause');
  function restartTourTimer() {
    clearTimeout(tour.timer);
    tourFill.style.transition = 'none';
    tourFill.style.width = '0%';
    if (tour.paused) return;
    requestAnimationFrame(() => {
      tourFill.style.transition = `width ${TOUR_MS}ms linear`;
      tourFill.style.width = '100%';
    });
    tour.timer = setTimeout(() => {
      const order = stage.order();
      const i = order.indexOf(current);
      if (i === order.length - 1) { stopTour(); close(); setTimeout(gestureHint, 600); return; }
      open(order[i + 1], { fromTour: true });
      restartTourTimer();
    }, TOUR_MS);
  }
  function startTour() {
    track('tour');
    tour = { paused: false, timer: 0 };
    tourBar.hidden = false;
    document.body.classList.add('touring');
    tourPause.textContent = '⏸ إيقاف مؤقت';
    open(stage.order()[0], { fromTour: true });
    restartTourTimer();
  }
  function stopTour() {
    if (!tour) return;
    clearTimeout(tour.timer);
    tour = null;
    tourBar.hidden = true;
    document.body.classList.remove('touring');
  }
  tourPause.addEventListener('click', () => {
    tour.paused = !tour.paused;
    tourPause.textContent = tour.paused ? '▶ كمّل' : '⏸ إيقاف مؤقت';
    restartTourTimer();
  });
  $('#tour-stop').addEventListener('click', stopTour);
  $('#start-tour').addEventListener('click', startTour);

  /* ---------- search (⌘K) ---------- */
  const dlg = $('#search');
  const input = $('#search-input');
  const list = $('#search-list');
  const norm = s => s.toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  // One row per product (both side monitors share one), internals included.
  const rows = [];
  const seen = new Set();
  for (const s of SCENE) {
    if (seen.has(s.product)) continue;
    seen.add(s.product);
    rows.push({ key: s.product, id: s.id, label: s.label });
  }
  for (const k of INSIDE) rows.push({ key: k, id: 'case', inner: k, label: PRODUCTS[k].part });
  for (const r of rows) {
    const p = PRODUCTS[r.key];
    r.cat = p.cat;
    r.hay = norm([p.name, r.label, CATS[p.cat], p.desc].join(' '));
  }
  let active = 0, shown = [];
  function paintList() {
    const q = norm(input.value.trim());
    shown = rows.filter(r => !q || q.split(/\s+/).every(w => r.hay.includes(w)));
    active = Math.min(active, Math.max(0, shown.length - 1));
    let html = '', lastCat = null;
    const sorted = Object.keys(CATS).flatMap(c => shown.filter(r => r.cat === c));
    shown = sorted;
    sorted.forEach((r, i) => {
      if (r.cat !== lastCat) { html += `<li class="group" role="presentation">${CATS[r.cat]}</li>`; lastCat = r.cat; }
      const p = PRODUCTS[r.key];
      html += `<li role="option" id="opt-${i}" aria-selected="${i === active}" data-i="${i}">
        <span class="pname">${esc(p.name)}</span><span class="part">${esc(r.label)}</span>
        ${found.has(r.key) ? '<span class="tick" aria-label="مكتشفة">✓</span>' : ''}</li>`;
    });
    list.innerHTML = html || '<li class="empty">ما لقيت شي بهالاسم</li>';
    input.setAttribute('aria-activedescendant', shown.length ? `opt-${active}` : '');
  }
  function openSearch() {
    track('search');
    stopTour();
    input.value = '';
    active = 0;
    paintList();
    dlg.showModal();
    input.focus();
  }
  function choose(i) {
    const r = shown[i];
    if (!r) return;
    dlg.close();
    open(r.id, { inner: r.inner });
  }
  input.addEventListener('input', () => { active = 0; paintList(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(1, shown.length);
      paintList();
      list.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
  });
  list.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) choose(+li.dataset.i); });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  document.querySelectorAll('[data-search]').forEach(b => b.addEventListener('click', openSearch));

  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? dlg.close() : openSearch(); return; }
    if (dlg.open || e.target.closest('input, textarea')) return;
    if (e.key === '/') { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape' && current) close();
    else if (e.key === 'Escape' && stage.seated) stage.stand();
    else if (current && e.key === 'ArrowLeft') step(1);   // RTL: left is "next"
    else if (current && e.key === 'ArrowRight') step(-1);
  });

  /* ---------- achievement ---------- */
  const ach = $('#achievement');
  function showAchievement() { stopTour(); ach.showModal(); track('achievement'); }
  ach.addEventListener('click', e => { if (e.target === ach || e.target.closest('[data-close]')) ach.close(); });

  /* ---------- deep links ---------- */
  function fromHash() {
    const key = decodeURIComponent(location.hash.slice(1));
    if (!key) return false;
    if (SCENE_BY_ID[key]) open(key, { silentFocus: true });
    else if (INSIDE.includes(key)) open('case', { inner: key, silentFocus: true });
    else return false;
    return true;
  }
  addEventListener('hashchange', fromHash);

  // First visit (no deep link): ask once whether they want the tour, then
  // show how to move around.
  const ask = $('#tour-ask');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const gestureHint = () => toast(coarse ? '✌️ إصبعين عشان تلف المكتب، وإصبع واحد تنزل للقطع' : '🖱️ اسحب عشان تلف المكتب، و Ctrl + العجلة تقرّب');
  function closeAsk(tour) {
    ask.hidden = true;
    document.body.classList.remove('asking');
    if (tour) startTour(); else gestureHint();
  }
  $('#tour-yes').addEventListener('click', () => closeAsk(true));
  $('#tour-no').addEventListener('click', () => closeAsk(false));
  function boot() {
    let first = false;
    try { first = !localStorage.getItem(VISIT_KEY); localStorage.setItem(VISIT_KEY, '1'); } catch {}
    if (fromHash() || !first) return;
    setTimeout(() => {
      if (current || dlg.open) return;
      ask.hidden = false;
      document.body.classList.add('asking');
      $('#tour-yes').focus({ preventScroll: true });
    }, 1600);
  }

  /* ---------- mute ---------- */
  const muteBtn = $('#mute-btn');
  const paintMute = () => {
    muteBtn.setAttribute('aria-pressed', String(sound.muted));
    muteBtn.setAttribute('aria-label', sound.muted ? 'شغّل الأصوات' : 'كتم الأصوات');
  };
  muteBtn.addEventListener('click', () => { sound.muted = !sound.muted; paintMute(); play('tick'); });
  paintMute();

  /* ---------- all parts, below the scene ---------- */
  // Products that sit in more than one spot in the scene.
  const WHERE = { 'lg-side': 'الشاشة اليسرى واليمنى · ×2' };
  function partCard(key, sceneId, inner) {
    const p = PRODUCTS[key];
    const l = productLink(p);
    const [bk, bl] = badge(p);
    const where = inner ? p.part : (WHERE[key] || SCENE_BY_ID[sceneId].label);
    const pic = p.img || (!inner && thumbs[sceneId]);
    return `<article class="pcard" data-cat="${p.cat}">
      <div class="thumb${p.img ? ' photo' : ''}">${pic ? `<img src="${pic}" alt="${esc(p.name)}" loading="lazy">` : `<span aria-hidden="true">${CAT_ICON[p.cat]}</span>`}</div>
      <p class="meta">${esc(where)} <span class="badge ${bk}">${bl}</span></p>
      <h4>${esc(p.name)}</h4>
      <p class="quote">${esc(shortOpinion(p.opinion))}</p>
      ${l?.sponsored ? '<p class="mini-support">💜 الشراء من الزر يدعمني، وسعرك نفسه</p>' : ''}
      <div class="row">
        ${l ? `<a class="btn primary" href="${l.url}" target="_blank" rel="${l.sponsored ? "sponsored noopener" : "noopener"}" data-track="buy" data-item="${key}" data-store="${p.store}" data-where="grid">${l.label}</a>` : ''}
        <button class="btn ghost" type="button" data-goto="${sceneId}" ${inner ? `data-inner="${inner}"` : ''}>شوفها في المكتب</button>
      </div>
    </article>`;
  }
  function buildParts() {
    const seen = new Set();
    const byCat = Object.fromEntries(Object.keys(CATS).map(c => [c, []]));
    for (const id of stage.order()) {
      const s = SCENE_BY_ID[id];
      if (seen.has(s.product)) continue;
      seen.add(s.product);
      byCat[PRODUCTS[s.product].cat].push(partCard(s.product, id));
    }
    for (const k of INSIDE) byCat.pc.push(partCard(k, 'case', k));
    $('#parts-list').innerHTML = Object.entries(byCat).map(([c, cards]) =>
      `<section class="cat" data-cat="${c}"><h3>${CAT_ICON[c]} ${CATS[c]} <span>${cards.length === 2 ? 'قطعتين' : `${cards.length} قطع`}</span></h3><div class="grid">${cards.join('')}</div></section>`).join('');
  }
  // Pictures for the pieces that have no maker photo come from the 3D scene itself.
  const thumbs = stage.thumbs();
  buildParts();
  // Category filter chips above the list.
  const chips = $('#part-filters');
  chips.innerHTML = [['all', 'الكل'], ...Object.entries(CATS)].map(([c, l], i) =>
    `<button type="button" data-filter="${c}" aria-pressed="${i === 0}">${c === 'all' ? '' : CAT_ICON[c] + ' '}${l}</button>`).join('');
  chips.addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    chips.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    document.querySelectorAll('#parts-list .cat').forEach(s => { s.hidden = b.dataset.filter !== 'all' && s.dataset.cat !== b.dataset.filter; });
    play('tick');
  });
  $('#parts-list').addEventListener('click', e => {
    const b = e.target.closest('[data-goto]');
    if (!b) return;
    scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setTimeout(() => open(b.dataset.goto, { inner: b.dataset.inner }), 450);
  });
  // The top bar gets a backdrop once the page scrolls past the scene.
  const onScroll = () => document.body.classList.toggle('scrolled', scrollY > innerHeight * 0.6);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  document.querySelectorAll('[data-scroll]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    stopTour();
    $(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
  }));

  // The counter: the trophy message once everything is found, else the list.
  counter.addEventListener('click', () => (found.size === TOTAL ? showAchievement() : openSearch()));

  paintCounter(false);

  return {
    open,
    close,
    say: toast,
    onModeChange() { if (current) render(current); },
    onSeatChange(sat) {
      if (sat) { if (current) close(); toast('اسحب عشان تلف راسك، والعجلة تقرّب 👀'); }
      else if (current) render(current);
    },
    boot,
  };
}
