#!/bin/bash
# Endless search slot: repeatedly runs tools/finclimb.js from the current best run for a window, and
# promotes any clean-verified frame gain to $DIR/best.json (shared by all slots).
# usage: DIR=<work dir> tools/longrun.sh <slot-name> <W0> <minutes per round> [SNAP ms]
cd "$(dirname "$0")/.."
SLOT=$1 W0=$2 MIN=$3 SNAPMS=${4:-50}
mkdir -p "$DIR/$SLOT"
[ -f "$DIR/best.json" ] || cp inputs/summer1_opt.json "$DIR/best.json"
finish() { node -e "const fs=require('fs');const {createSim,encodeRecording}=require('./tools/sim.js');const K={KeyW:'up',KeyD:'right',KeyS:'down',KeyA:'left'};(async()=>{const s=await createSim();const L={up:[],right:[],down:[],left:[],reset:[]};for(const [f,k] of JSON.parse(fs.readFileSync('$1')))L[K[k]].push(f);for(const k in L)L[k].sort((a,b)=>a-b);const v=await s.run(encodeRecording(L),30000);console.log(v.frames);process.exit(0)})()" 2>/dev/null | tail -1; }
i=0
while [ ! -f "$DIR/STOP" ]; do
  i=$((i+1)); START="$DIR/$SLOT/start_$i.json"; cp "$DIR/best.json" "$START"
  OUT="$DIR/$SLOT/gain_$i.json"
  SNAP=$SNAPMS node tools/finclimb.js "$START" "$OUT" "$MIN" "$W0" $((RANDOM*7+i)) > "$DIR/$SLOT/round_$i.log" 2>&1
  if [ -f "$OUT" ]; then
    NEW=$(finish "$OUT"); CUR=$(finish "$DIR/best.json")
    if [ -n "$NEW" ] && [ "$NEW" -lt "$CUR" ]; then
      ( flock 9; CUR=$(finish "$DIR/best.json"); if [ "$NEW" -lt "$CUR" ]; then cp "$OUT" "$DIR/best.json"; echo "$(date -u +%FT%TZ) $SLOT round $i: $CUR -> $NEW" >> "$DIR/gains.log"; fi ) 9>"$DIR/.lock"
    fi
  fi
done
