# PolyTrack Summer 1 TAS

Browser-devtools input player for https://www.kodub.com/apps/polytrack.

## Status

`tas.js` (player + recorder) works as a framework. **`inputs/summer1.json` is a
placeholder (hold W only), not the #1 player's run.** I could not obtain the
real top-1 inputs: the leaderboard replay data isn't publicly reachable, and the
only record info I found (unverified third-party pages) was ~22.07s. Don't treat
any time in this repo as confirmed.

## Use

1. Open PolyTrack, load Summer 1, paste `tas.js` into the console.
2. `TAS.load(<contents of inputs/summer1.json>)`
3. Call `TAS.play()` right as the countdown ends. `TAS.stop()` aborts.

## Getting the real inputs

Watch the #1 replay and transcribe presses as `[ms, "KeyW|KeyA|KeyS|KeyD", true|false]`
(true = press, false = release), or drive the track yourself with `TAS.record()` /
`TAS.stopRecord()` to capture a run in the same format.

Caveat: PolyTrack runs a fixed-step physics sim and may ignore or time-quantise
synthetic events; real-time dispatch also can't match frame-perfect inputs.
