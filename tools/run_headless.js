// Runs a TAS userscript in headless Chromium and prints the final time (needs: npm i playwright).
// Leaderboard submission is blocked.
// usage: node tools/run_headless.js [userscript=summer1-replay.user.js] [screenshot=result.png] [track slug, e.g. winter1]
//   With a track slug the userscript must be the menu build (all-tracks.user.js): the track is picked in
//   its menu and started with its Start button. Without one, the default track (Summer 1) is started with W.
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const script = path.resolve(process.argv[2] || path.join(__dirname, '..', 'summer1-replay.user.js')), shot = process.argv[3] || 'result.png';
const slug = process.argv[4];
const index = slug ? JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'sim_assets/tracks/index.json'))) : null;
const name = slug ? index[slug].name : 'Summer 1';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  // never submit TAS runs to the online leaderboard
  await p.route(/vps\.kodub\.com\/.*\/leaderboard(\?|$)/, r => r.request().method() === 'POST' ? r.abort() : r.continue());
  await p.addInitScript({ path: script });
  await p.goto('https://app-polytrack.kodub.com/0.6.3/', { waitUntil: 'load' });
  await p.waitForTimeout(6000);
  const ok = p.getByText('Ok', { exact: true }); if (await ok.count()) await ok.first().click();
  await p.waitForTimeout(2000);
  const txt = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  if (slug) {
    await p.evaluate(s => { window.__tasMenu.select(s); window.__tasMenu.start(); }, slug);
    await p.waitForTimeout(9000);
  } else {
    for (let k = 0; k < 10 && /Current 00:00\.000/.test(await txt()); k++) { // press W until the race starts
      await p.evaluate(() => { const e = t => new KeyboardEvent(t, { key: 'w', code: 'KeyW', keyCode: 87, which: 87, bubbles: true });
        document.body.dispatchEvent(e('keydown')); setTimeout(() => document.body.dispatchEvent(e('keyup')), 400); });
      await p.waitForTimeout(1200);
    }
  }
  // wait until the end screen shows a time for this track (up to 90 s)
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re = new RegExp(esc + ' (\\d\\d:\\d\\d\\.\\d{3})');
  let t = '';
  for (let k = 0; k < 45; k++) { await p.waitForTimeout(2000); t = await txt(); if (re.test(t)) break; }
  // end screen text looks like "... 3/3 271km/h Record --- Current 00:14.911 00:22.067 Difference --- ... Summer 1 00:22.067 -"
  const m = t.match(re) || t.match(/(\d\d:\d\d\.\d{3}) Difference/), cps = (t.match(/(\d+)\/(\d+) \d+ ?km\/h/) || [, '?', '?']);
  console.log('final time:', m ? m[1] : 'not finished', `(checkpoints ${cps[1]}/${cps[2]})`);
  await p.screenshot({ path: shot });
  await b.close();
})();
