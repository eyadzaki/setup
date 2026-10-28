// Private site stats with Umami (umami.is). Only Eyad sees the dashboard.
// Paste the Website ID from Umami below; until then nothing is sent.
// Tracks only on the live site, so local testing never pollutes the numbers.
export const UMAMI_ID = '';
const LIVE_HOST = 'eyadzaki.github.io';

if (UMAMI_ID && location.hostname === LIVE_HOST) {
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://cloud.umami.is/script.js';
  s.dataset.websiteId = UMAMI_ID;
  s.dataset.domains = LIVE_HOST;
  document.head.appendChild(s);
}

// track('buy', { item: 'mouse', store: 'amazon' })
export function track(name, data) {
  try { window.umami?.track(name, data); } catch { /* stats must never break the page */ }
}

// Anything with data-track="event" (and optional data-item / data-store / data-via)
// reports itself when clicked.
document.addEventListener('click', e => {
  const el = e.target.closest('[data-track]');
  if (!el) return;
  const d = {};
  for (const k of ['item', 'store', 'via', 'where']) if (el.dataset[k]) d[k] = el.dataset[k];
  track(el.dataset.track, d);
}, true);
