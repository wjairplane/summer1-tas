// Captures, for each official track, what the offline simulator needs (the physics worker's track
// message: track data + mountain mesh) and the track's leaderboard id, by driving the real game menu.
// usage: node tools/capture_tracks.js [outDir=sim_assets/tracks] [track names...]  (needs playwright)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'sim_assets/tracks';
const NAMES = process.argv.slice(3).length ? process.argv.slice(3)
  : ['Summer 1', 'Summer 2', 'Summer 3', 'Summer 4', 'Summer 5', 'Summer 6', 'Winter 1', 'Winter 2', 'Winter 3', 'Winter 4', 'Winter 5', 'Desert 1', 'Desert 2', 'Desert 3', 'Desert 4', 'Desert 5'];
const slug = n => n.toLowerCase().replace(/\s+/g, '');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.route(/vps\.kodub\.com/, r => r.request().method() === 'POST' ? r.abort() : r.continue());
  let lastTrackId = null; const created = [];
  p.on('request', r => { const m = r.url().match(/leaderboard\?.*trackId=([0-9a-f]{64})/); if (m) lastTrackId = m[1]; });
  await p.exposeFunction('__cap', s => created.push(s));
  await p.addInitScript(() => {
    const enc = v => {
      if (ArrayBuffer.isView(v)) { let s = ''; const u = new Uint8Array(v.buffer, v.byteOffset, v.byteLength); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return { __t: v.constructor.name, b64: btoa(s) }; }
      if (Array.isArray(v)) return v.map(enc);
      if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = enc(v[k]); return o; }
      return v;
    };
    const W = window.Worker;
    window.Worker = function (u, o) { const w = new W(u, o); const pm = w.postMessage.bind(w);
      w.postMessage = (m, t) => { try { if (m && m.messageType === 3 && m.trackData) window.__cap(JSON.stringify(enc(m))); } catch (e) {} return pm(m, t); }; return w; };
  });
  await p.goto('https://app-polytrack.kodub.com/0.6.3/', { waitUntil: 'load' });
  await p.waitForTimeout(7000);
  const ok = p.getByText('Ok', { exact: true }); if (await ok.count()) await ok.first().click();
  await p.waitForTimeout(1000);
  const index = fs.existsSync(path.join(OUT, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'))) : {};
  for (const name of NAMES) {
    // back to the track list (from a race: Exit; from a track panel: Back)
    for (const t of ['Exit', 'Back']) { const x = p.getByText(t, { exact: true }); if (await x.count() && await x.first().isVisible()) { await x.first().click(); await p.waitForTimeout(1500); break; } }
    lastTrackId = null;
    const btn = p.locator('button').filter({ hasText: new RegExp('^\\s*' + name + '(\\s|No|$)') }).first();
    await btn.click(); await p.waitForTimeout(2500);
    const n0 = created.length;
    await p.locator('button:visible').filter({ hasText: /^\s*Play\s*$/ }).first().click(); await p.waitForTimeout(4000);
    if (created.length === n0 || !lastTrackId) { console.log(`${name}: FAILED (track msg ${created.length - n0}, id ${lastTrackId})`); continue; }
    const msg = JSON.parse(created[created.length - 1]);
    fs.writeFileSync(path.join(OUT, slug(name) + '.json'), JSON.stringify({ name, trackId: lastTrackId, create: msg }));
    index[slug(name)] = { name, trackId: lastTrackId };
    console.log(`${name}: ${lastTrackId}, trackData ${msg.trackData.length} chars`);
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
  await b.close();
})();
