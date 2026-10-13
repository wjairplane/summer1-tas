# PolyTrack Summer 1 TAS

Tool-assisted runs of **Summer 1** in [PolyTrack](https://www.kodub.com/apps/polytrack) (game version 0.6.3).

| Run | Time | Files |
|---|---|---|
| Optimized TAS | **22.064 s** | `summer1.user.js`, `inputs/summer1_opt.json` |
| Previous best | 22.067 s | `inputs/summer1_opt_22067.json` |
| Human #1 replay (leaderboard entry 59995962) | 22.114 s | `summer1-replay.user.js`, `inputs/summer1.json` |

All three are verified in the real game (headless Chromium, 3/3 checkpoints).

## Playing a run

The userscripts patch PolyTrack's physics worker so the inputs are applied on exact 1 ms
physics frames (synthetic key events can't be timed that precisely). They must run before
the game loads, so they can't be pasted into the console of an open page.

- **Browser:** install the `.user.js` file in Tampermonkey or Violentmonkey (desktop, or
  Firefox for Android). It runs at document-start on `app-polytrack.kodub.com`. Open
  Summer 1 and press W once to start; the TAS drives the rest.
- **Headless:** `npm i playwright && node tools/run_headless.js [userscript] [screenshot]`
  prints the final time and checkpoint count. Leaderboard submission is blocked there.
- **Leaderboard:** the userscript itself does not block submission, so a finished run is
  submitted as usual when you are online.
- If the game updates past 0.6.3, the script warns `patch anchor not found` and does nothing.

Rebuild a userscript from an input file:
`python3 tools/build_userscript.py inputs/summer1_opt.json summer1.user.js`.

## Input format

`inputs/*.json` is a list of `[frame_ms, key, pressed]` with keys `KeyW`, `KeyA`, `KeyS`, `KeyD`.
The game's own recording format (zlib + base64url of five toggle-frame lists) is decoded by
`tools/fetch_replay.py` and encoded by `encodeRecording` in `tools/sim.js`.

## Offline simulator

`tools/sim.js` runs the game's own physics worker and wasm in Node, frame-exact with the
browser (about 70-90k frames/s per core, so a full run takes about 0.4 s). It keeps heap
snapshots so a changed run only re-simulates from just before the change.

Setup (downloads the worker and wasm and captures the track messages; needs playwright):

```sh
tools/fetch_sim_assets.sh      # -> sim_assets/ (not committed)
```

## Search tools

| Tool | What it does |
|---|---|
| `tools/evolve.js` | Evolutionary search (population, mutation, crossover) over input timings, scored by lead over the reference at the finish. Options: `WIN=a,b` (edit window), `THROTTLE=1` (W lifts), `SEED=file`, `NK=processes`. |
| `tools/beam.js` | Beam search that grows lines forward in 5-25 ms action blocks, scored by projection onto the reference line. Options: `CONFIGS`, `BSTART`/`BSEED` (start from a frame / another run), `BACTIONS` (action set, incl. brake+steer), `BDEAD` (allow wide lines after a frame), `NFIN` (several finishing lines). |
| `tools/finclimb.js` | Exact-finish search on the last seconds: maximizes how far the car is toward the finish on the frame before it finishes (sweeps plus simulated annealing, dense snapshots, optional `SHARE` dir for parallel runs). Found 22.066, 22.065 and 22.064. |
| `tools/longrun.sh` | Endless finclimb slots that restart from, and promote gains to, a shared best run. |
| `tools/fetch_replay.py` | Downloads a leaderboard recording and converts it to an input file. |

## How the time came down

| Time | How |
|---|---|
| 22.114 | Human #1 replay, reproduced frame-exact |
| 22.102 → 22.101 | Hill-climb on key timings |
| 22.084 | Evolutionary search |
| 22.081 | Evolutionary polish |
| 22.077 | Fine beam over the last 8 s (a new finish line) |
| 22.067 | Evolutionary polish of that line |
| 22.066 → 22.064 | `finclimb.js` exact-finish search |

All of the gain came after 10.7 s; the first 10.7 s are identical to the human run.

## What we learned about the track

- **Physics:** Bullet raycast vehicle in wasm, deterministic, 1 ms steps. The car is
  acceleration-limited everywhere (no top speed in reach). Steering is a rate-limited servo,
  so taps set an in-between angle; holding steer at speed makes the rear wheels slide and
  costs engine thrust.
- **In the air** only S does anything (nose-up pitch); W, A and D are ignored. Holding S
  through the big jump after checkpoint 3 is optimal.
- **Wall-ride at checkpoint 1:** only one timing works (A at 4.059 s). Softer kerb hits,
  other approach angles and the old jump-over-the-ramp line all crash or lose time.
- **Climbing spiral after checkpoint 2:** its brakes are required; beams with brake+steer
  actions found nothing faster.
- **Scoring traps:** checkpoint times and plane crossings reward lines that crash right
  after; short-horizon leads don't predict the finish. Score after a landing or at the finish.
- **Route:** no shortcuts off the track; the finish line is already clipped as early as possible.
- Sub-22.000 would need a different line in the first 10 s; none was found.

## Other files

- `tas-exact.template.js`: the userscript template (worker patch + input player).
- `tas.js`: an older console player/recorder using synthetic key events. Not frame-exact;
  kept only as a recorder (`TAS.record()`).
