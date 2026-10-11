/*
 * PolyTrack TAS player/recorder for browser devtools.
 * Paste into the console on https://www.kodub.com/apps/polytrack
 *
 *   TAS.load(inputs)   inputs = [[timeMs, "KeyW"|"KeyA"|"KeyS"|"KeyD", true|false], ...]
 *   TAS.play()         starts replaying; time 0 = the moment you call play()
 *   TAS.stop()         stops and releases all keys
 *   TAS.record()       start capturing your own real key presses
 *   TAS.stopRecord()   stops capture and returns/prints the inputs array
 *
 * Call play() at the instant the race countdown ends (go!) for time 0 to line up.
 */
(() => {
  const KEYS = {
    KeyW: { key: "w", keyCode: 87 },
    KeyA: { key: "a", keyCode: 65 },
    KeyS: { key: "s", keyCode: 83 },
    KeyD: { key: "d", keyCode: 68 },
  };
  let seq = [], raf = 0, held = new Set(), recBuf = null, recT0 = 0, recHandlers = null;

  const fire = (code, down) => {
    const k = KEYS[code];
    if (!k) return;
    const ev = new KeyboardEvent(down ? "keydown" : "keyup", {
      key: k.key, code, keyCode: k.keyCode, which: k.keyCode,
      bubbles: true, cancelable: true,
    });
    (document.activeElement || document.body).dispatchEvent(ev);
    down ? held.add(code) : held.delete(code);
  };
  const releaseAll = () => [...held].forEach(c => fire(c, false));

  const TAS = {
    load(inputs) {
      seq = inputs.map(([t, c, d]) => [t, c, !!d]).sort((a, b) => a[0] - b[0]);
      console.log(`[TAS] loaded ${seq.length} events`);
    },
    play() {
      if (!seq.length) return console.warn("[TAS] nothing loaded");
      TAS.stop();
      const t0 = performance.now();
      // Prefer the game's own timer (stays in sync even if the game runs slow);
      // fall back to wall-clock time if the HUD timer isn't found.
      const hud = document.querySelector(".center .time p");
      const gameMs = () => {
        const m = /(\d+):(\d+)\.(\d+)/.exec(hud.textContent);
        return m ? (+m[1] * 60 + +m[2]) * 1000 + +m[3] : 0;
      };
      let i = 0;
      const tick = () => {
        const t = hud && i > 0 ? gameMs() : performance.now() - t0;
        while (i < seq.length && seq[i][0] <= t) fire(seq[i][1], seq[i++][2]);
        if (i < seq.length) raf = requestAnimationFrame(tick);
        else console.log("[TAS] finished");
      };
      raf = requestAnimationFrame(tick);
      console.log("[TAS] playing");
    },
    stop() {
      cancelAnimationFrame(raf);
      releaseAll();
    },
    record() {
      recBuf = [];
      recT0 = performance.now();
      const h = down => e => {
        if (!KEYS[e.code] || e.repeat) return;
        recBuf.push([Math.round(performance.now() - recT0), e.code, down]);
      };
      recHandlers = [h(true), h(false)];
      addEventListener("keydown", recHandlers[0], true);
      addEventListener("keyup", recHandlers[1], true);
      console.log("[TAS] recording; time 0 = now");
    },
    stopRecord() {
      removeEventListener("keydown", recHandlers[0], true);
      removeEventListener("keyup", recHandlers[1], true);
      console.log(JSON.stringify(recBuf));
      return recBuf;
    },
  };
  window.TAS = TAS;
  console.log("[TAS] ready: TAS.load(inputs); TAS.play()");
})();
