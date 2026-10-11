// Runs the TAS in headless Chromium (needs: npm i playwright). usage: node tools/run_headless.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  // never submit TAS runs to the online leaderboard
  await p.route(/vps\.kodub\.com\/.*\/leaderboard(\?|$)/, r => r.request().method() === 'POST' ? r.abort() : r.continue());
  await p.addInitScript({ path: __dirname + '/../tas-exact.user.js' });
  await p.goto('https://app-polytrack.kodub.com/0.6.3/', { waitUntil: 'load' });
  await p.waitForTimeout(6000);
  const ok = p.getByText('Ok', { exact: true }); if (await ok.count()) await ok.first().click();
  await p.waitForTimeout(2000);
  const txt = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  for (let k = 0; k < 10 && /Current 00:00\.000/.test(await txt()); k++) { // press W until the race starts
    await p.evaluate(() => { const e = t => new KeyboardEvent(t, { key: 'w', code: 'KeyW', keyCode: 87, which: 87, bubbles: true });
      document.body.dispatchEvent(e('keydown')); setTimeout(() => document.body.dispatchEvent(e('keyup')), 400); });
    await p.waitForTimeout(1200);
  }
  await p.waitForTimeout(32000);
  const t = await txt();
  console.log('final time:', (t.match(/\d\d:\d\d\.\d{3}(?= \S \d)/) || ['not finished'])[0]);
  await p.screenshot({ path: 'result.png' });
  await b.close();
})();
