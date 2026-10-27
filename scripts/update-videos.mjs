// Refreshes data/videos.json with the latest uploads of both YouTube channels.
// Runs in GitHub Actions on a schedule (see .github/workflows/update-videos.yml);
// the site reads the JSON and draws the real thumbnails on the side monitors.
// Node 20+, no dependencies.
import { writeFile, mkdir } from 'node:fs/promises';

const CHANNELS = {
  ez: { id: 'UC3N9ZzTryBrCNU9OvzCziiw', handle: '@Eyadzaki', name: 'Eyad Zaki' },
  bro: { id: 'UCFdkl6sc_1Dpzjpx6QOIJLw', handle: '@brobrayal', name: 'البروبريل' },
};
const PER_CHANNEL = 8;

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function latest(id) {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
  if (!res.ok) throw new Error(`feed ${id}: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, PER_CHANNEL).map(([, e]) => ({
    id: e.match(/<yt:videoId>([^<]+)/)[1],
    title: decode(e.match(/<title>([^<]*)/)[1]),
    published: e.match(/<published>([^<]+)/)[1],
  }));
}

async function subscribers(handle) {
  try {
    const html = await (await fetch(`https://www.youtube.com/${handle}`, { headers: { 'Accept-Language': 'en' } })).text();
    // The channel's own header ("@handle • 114K subscribers"), not featured channels.
    return html.match(/⁨([\d.,]+[KM]?) subscribers⁩/)?.[1] ?? null;
  } catch { return null; }
}

const out = { updated: new Date().toISOString(), channels: {} };
for (const [key, c] of Object.entries(CHANNELS)) {
  out.channels[key] = { name: c.name, handle: c.handle, subs: await subscribers(c.handle), videos: await latest(c.id) };
}
await mkdir('data', { recursive: true });
await writeFile('data/videos.json', JSON.stringify(out, null, 2) + '\n');
console.log('videos.json updated', Object.fromEntries(Object.entries(out.channels).map(([k, v]) => [k, v.videos.length])));
