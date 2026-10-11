# PolyTrack Summer 1 TAS

Browser-devtools input player for https://www.kodub.com/apps/polytrack.

## Status

`inputs/summer1.json` is the real current #1 Summer 1 run (22.114s, leaderboard
entry id 59995962, fetched 2026-10-11), decoded from the game's own leaderboard
recording. Regenerate it any time (needs only Python 3):

    python3 tools/fetch_replay.py 1 inputs/summer1.json   # arg 1 = leaderboard rank

Not yet tested in the live game. Event times are in ms from race start
(1 recording frame = 1 ms).

## Use

1. Open PolyTrack, load Summer 1, paste `tas.js` into the console.
2. `TAS.load(<contents of inputs/summer1.json>)`
3. Call `TAS.play()` right as the countdown ends. `TAS.stop()` aborts.

## Caveats

Browser timers can't hit 1 ms precision, and the game samples keys on its own
physics step, so the replay can drift from the original run and may not
reproduce 22.114s or even finish the track. Synthetic key events may also be
ignored by the game. Treat this as a best-effort replay; a frame-exact version
would need to hook the game's input state instead of dispatching key events.
