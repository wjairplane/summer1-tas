// Exact-finish search for the last part of the run: pushes the car further toward the finish face on the
// frame before it currently finishes, so the run eventually finishes a frame earlier.
//  - dense heap snapshots (every 50 ms from W0) so each test only re-simulates from just before its edit
//  - systematic sweeps: every toggle in the window shifted by +-1..5 ms, then every tap moved as a whole
//  - simulated annealing with random edits between sweeps (accepts slightly worse lines to leave plateaus)
// A test that finishes a frame earlier is verified with a clean simulation and becomes the new start.
// usage: node tools/finclimb.js <in.json> <out.json> [minutes=60] [W0=20000] [seed=1]
const fs = require('fs');
const { createSim, encodeRecording } = require('./sim.js');
const KEY = { KeyW: 'up', KeyD: 'right', KeyS: 'down', KeyA: 'left', Reset: 'reset' };
const NAME = { up: 'KeyW', right: 'KeyD', down: 'KeyS', left: 'KeyA' };
const [inF, outF, minArg, wArg, seedArg] = process.argv.slice(2);
const MIN = +(minArg || 60), W0 = +(wArg || 20000), SNAP = +(process.env.SNAP || 50);
let seed = +(seedArg || 1); const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648, ri = n => Math.floor(rnd() * n);
const load = f => { const L = { up: [], right: [], down: [], left: [], reset: [] }; for (const [fr, k] of JSON.parse(fs.readFileSync(f))) L[KEY[k]].push(fr); for (const k in L) L[k].sort((a, b) => a - b); return L; };
const toEv = L => { const ev = []; for (const k in NAME) L[k].forEach((f, i) => ev.push([f, NAME[k], i % 2 === 0])); return ev.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])); };
const clone = L => Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.slice()]));
const valid = L => Object.keys(NAME).every(k => L[k].every((f, i) => i === 0 ? f >= (k === 'up' ? 0 : 1) : f > L[k][i - 1]));
const firstDiff = (A, B) => { let m = 1e9; for (const k in NAME) { const a = A[k], b = B[k], n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) { m = Math.min(m, a[i] ?? 1e9, b[i] ?? 1e9); break; } } return m; };
(async () => {
  const sim = await createSim(); await sim.initFast();
  let best = load(inF), base, F, refZ;
  const rebase = async () => { base = await sim.setBase(best, 30000, SNAP, W0 - 1000); F = base.frames; refZ = base.P[3 * (F - 1) + 2]; };
  await rebase();
  const evalL = async (L, ref) => {
    const from = Math.min(firstDiff(ref, L), F - 2);
    const e = await sim.evalFrom(L, from, F - 1);
    if (e.err) return { s: -1e9 };
    if (e.fin) return { s: 1e6, fin: e.frames };
    return { s: -e.pos[0] - 4 * Math.max(0, e.pos[2] - refZ) };
  };
  const t0 = Date.now(), left = () => Date.now() - t0 < MIN * 60000;
  let bestS = (await evalL(best, best)).s, s0 = bestS, n = 0;
  console.log(`start finish ${F}`);
  const found = async L => {                       // a frame gain: verify cleanly and restart from it
    const v = await sim.run(encodeRecording(L), 30000);
    console.log(`*** finishes at ${v.frames} (clean)`);
    if (v.frames < F) { best = L; fs.writeFileSync(outF, JSON.stringify(toEv(best))); await rebase(); bestS = s0 = (await evalL(best, best)).s; console.log(`new best finish ${F}`); return true; }
    return false;
  };
  const seen = new Set(), keyOf = L => Object.keys(NAME).map(k => L[k].join(',')).join('|');
  const tryL = async L => { if (!valid(L)) return null; const kk = keyOf(L); if (seen.has(kk)) return null; seen.add(kk); n++; const c = await evalL(L, best); if (c.fin && await found(L)) return 'gain'; return c; };
  let sweepDry = false;
  while (left()) {
    // 1) sweep (skipped after a sweep that found nothing, until annealing moves the line)
    let improved = false;
    if (!sweepDry) {
    // sweep: every toggle in the window, shifted +-1..5
    for (const k in NAME) for (let i = 0; i < best[k].length && left(); i++) {
      if (best[k][i] < W0 || best[k][i] >= F) continue;
      for (const d of [-1, 1, -2, 2, -3, 3, -5, 5]) {
        const L = clone(best); L[k][i] += d; const c = await tryL(L);
        if (c === 'gain') { improved = true; break; }
        if (c && c.s > bestS + 1e-6) { best = L; bestS = c.s; improved = true; break; }
      }
    }
    // 2) sweep: move whole taps (on/off pair) by +-1..5
    for (const k in NAME) for (let i = 0; i + 1 < best[k].length && left(); i += 2) {
      if (best[k][i] < W0 || best[k][i] >= F) continue;
      for (const d of [-1, 1, -2, 2, -3, 3, -5, 5]) {
        const L = clone(best); L[k][i] += d; L[k][i + 1] += d; const c = await tryL(L);
        if (c === 'gain') { improved = true; break; }
        if (c && c.s > bestS + 1e-6) { best = L; bestS = c.s; improved = true; break; }
      }
    }
    console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] sweep done, ${n} tests, ${((bestS - s0) * 1000).toFixed(1)} mm gained (1 frame ~ 84 mm)`);
    if (improved) continue;
    sweepDry = true;
    }
    const before = bestS;
    // 3) annealing from the best line with random edits, then back to sweeping
    let cur = clone(best), curS = bestS, T = +(process.env.T0 || 0.004);
    for (let it = 0; it < 8000 && left(); it++, T *= 0.9995) {
      const L = clone(cur), k = ['right', 'right', 'right', 'left', 'up', 'down'][ri(6)], l = L[k], r = rnd();
      const idx = []; l.forEach((f, i) => { if (f >= W0 && f < F) idx.push(i); });
      const d = [-3, -2, -1, 1, 2, 3, -6, 6][ri(8)];
      if (r < 0.5 && idx.length) l[idx[ri(idx.length)]] += d;
      else if (r < 0.75 && idx.length) { const i = idx[ri(idx.length)], j = i ^ 1; l[i] += d; if (j < l.length) l[j] += d; }
      else if (r < 0.9) { const a = W0 + ri(F - W0 - 20), w = 1 + ri(20); l.push(a, a + w); l.sort((x, y) => x - y); }
      else if (idx.length >= 2) { const i = idx[ri(idx.length)]; l.splice(i - (i % 2), 2); }
      if (!valid(L)) continue;
      n++; const c = await evalL(L, best);
      if (c.fin) { if (await found(L)) { cur = clone(best); curS = bestS; } continue; }
      if (c.s > curS || rnd() < Math.exp((c.s - curS) / T)) { cur = L; curS = c.s; }
      if (curS > bestS + 1e-6) { best = clone(cur); bestS = curS; }
    }
    if (bestS > before + 1e-6) sweepDry = false;
    // SHARE=<dir>: parallel searches post their best line there and adopt a better one (same start line)
    if (process.env.SHARE) {
      const dir = process.env.SHARE, me = `${dir}/${process.pid}.json`;
      fs.writeFileSync(me + '.tmp', JSON.stringify({ s: bestS, F, ev: toEv(best) })); fs.renameSync(me + '.tmp', me);
      for (const f of fs.readdirSync(dir)) { if (!f.endsWith('.json') || `${dir}/${f}` === me) continue;
        try { const o = JSON.parse(fs.readFileSync(`${dir}/${f}`)); if (o.F === F && o.s > bestS + 0.001) {
          const L = { up: [], right: [], down: [], left: [], reset: [] }; for (const [fr, k] of o.ev) L[KEY[k]].push(fr); for (const k in L) L[k].sort((a, b) => a - b);
          best = L; bestS = o.s; sweepDry = false; console.log(`adopted ${f} (+${((o.s - before) * 1000).toFixed(1)} mm)`); } } catch (e) {} }
    }
    console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] annealing done, ${n} tests, ${((bestS - s0) * 1000).toFixed(1)} mm gained`);
  }
  fs.writeFileSync(outF.replace(/\.json$/, '_last.json'), JSON.stringify(toEv(best)));
  console.log(`done: ${n} tests, finish ${F}, ${((bestS - s0) * 1000).toFixed(1)} mm gained`);
  process.exit(0);
})();
