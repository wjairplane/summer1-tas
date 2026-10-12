# PolyTrack Summer 1 TAS

Replays the current #1 Summer 1 run (22.114s, leaderboard entry 59995962,
fetched 2026-10-11) in https://www.kodub.com/apps/polytrack.

**Verified:** in headless Chromium this reproduces exactly 00:22.114, 3/3 checkpoints.

## Use (frame-exact)

`tas-exact.user.js` patches PolyTrack's physics worker so the recorded inputs
are applied on exact 1 ms simulation frames (browser timing can't do that).
It must run before the game loads, so it can't be pasted into the console
after the page is open.

- **Browser:** install it as a userscript (Tampermonkey/Violentmonkey, runs at
  document-start on `app-polytrack.kodub.com`), open Summer 1, press W once to
  start. The TAS takes over from there.
- **Headless:** `npm i playwright && node tools/run_headless.js [userscript]` (default
  `tas-exact.user.js`; prints the final time and checkpoints, saves `result.png`;
  leaderboard submission is blocked).

## Optimized run (22.065s)

`inputs/summer1_opt.json` / `tas-exact-opt.user.js` finish in **22.065s**, 49 ms faster than
the replayed #1 (22.114s). Verified in the real game in headless Chromium. Found with
`tools/optimize.js`, `tools/optimize2.js` and mostly `tools/evolve.js`
(an evolutionary search: population, selection, mutation, crossover; hill-climb over tap timings using the game's own physics worker run
offline in Node, with snapshot-and-resume so late-run edits cost ~18 ms instead of ~400 ms).
Setup: `tools/fetch_sim_assets.sh`, then `node tools/optimize.js [minutes] [in] [out]`.

## Files

- `tools/fetch_replay.py [rank] [out]` – downloads a leaderboard recording and
  decodes it to `inputs/summer1.json` (`[frame_ms, key, pressed]`).
- `tools/build_userscript.py` – embeds the inputs into `tas-exact.user.js`
  (generated from `tas-exact.template.js`). Rerun after refetching.
- `tas.js` – older console player/recorder using synthetic key events. Not
  exact: it drifts and crashes. Kept only as a recorder (`TAS.record()`).

## Notes

- Tied times: ranks 1 and 2 are both 22.114s; the first listed is used.
- Patching depends on the game's current version (0.6.3). If the game updates,
  the script warns `patch anchor not found` and runs unpatched.
- **Leaderboard:** the game submits finished runs as usual. During development my
  test runs of the replay and the optimized run were not blocked from submitting,
  so a TAS score may have been posted under an anonymous account. `run_headless.js`
  now blocks submission, but the userscript does not: use it only where you accept that.
