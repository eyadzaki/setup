// Grabs a gameplay frame from Eyad's latest Kick stream for the center monitor
// (stream mode). Skips "Just Chatting"-type streams, samples several points in
// the middle of the VOD (never the start screen), and keeps the most detailed
// frame — the start/cam-only scenes compress small, busy gameplay compresses big.
// Runs in GitHub Actions (ffmpeg is preinstalled there). Node 20+, no deps.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync, mkdirSync, rmSync } from 'node:fs';

const CHANNEL = 'eyadzaki';
const NOT_GAMES = /just chatting|irl|talk|music|art|asmr/i;
const OUT_IMG = 'assets/screens/kick-stream.jpg';
const OUT_META = 'data/stream.json';
const POINTS = [0.3, 0.42, 0.54, 0.66, 0.78]; // fractions of the VOD

const res = await fetch(`https://kick.com/api/v2/channels/${CHANNEL}/videos`, {
  headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; eyadzaki-setup-site)' },
});
if (!res.ok) { console.log(`Kick answered ${res.status}; keeping the current frame.`); process.exit(0); }
const vods = await res.json();
const vod = vods.find(v => v.source && v.duration > 20 * 60 * 1000 && !NOT_GAMES.test(v.categories?.[0]?.name || ''));
if (!vod) { console.log('No recent gameplay stream; keeping the current frame.'); process.exit(0); }

let prev = {};
try { prev = JSON.parse(readFileSync(OUT_META, 'utf8')); } catch {}
if (prev.id === vod.id) { console.log('Already have a frame from this stream.'); process.exit(0); }

mkdirSync('tmp-frames', { recursive: true });
const frames = [];
for (const [i, p] of POINTS.entries()) {
  const at = ((vod.duration / 1000) * p).toFixed(0);
  const file = `tmp-frames/f${i}.jpg`;
  try {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', at, '-i', vod.source, '-frames:v', '1',
      '-vf', 'scale=640:360:force_original_aspect_ratio=increase,crop=640:360', '-q:v', '4', file], { timeout: 90000 });
    frames.push({ file, size: statSync(file).size });
  } catch (e) { console.log(`frame at ${at}s failed: ${e.message.split('\n')[0]}`); }
}
if (!frames.length) { console.log('Could not read the stream video; keeping the current frame.'); process.exit(0); }
frames.sort((a, b) => b.size - a.size);
writeFileSync(OUT_IMG, readFileSync(frames[0].file));
rmSync('tmp-frames', { recursive: true, force: true });

const meta = {
  id: vod.id,
  game: vod.categories?.[0]?.name || '',
  title: vod.session_title || '',
  date: vod.start_time,
  updated: new Date().toISOString(),
};
writeFileSync(OUT_META, JSON.stringify(meta, null, 2) + '\n');
console.log('New stream frame:', meta.game, '-', meta.title);
