#!/usr/bin/env python3
"""Embed inputs/summer1.json into tas-exact.template.js -> tas-exact.user.js"""
import json
KEYS = {"KeyW": "up", "KeyD": "right", "KeyS": "down", "KeyA": "left", "Reset": "reset"}
import sys
ev = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "inputs/summer1.json"))
sched = [[f, KEYS[k], d] for f, k, d in ev]
tpl = open("tas-exact.template.js").read()
open(sys.argv[2] if len(sys.argv) > 2 else "tas-exact.user.js", "w").write(tpl.replace("/*SCHED*/[]", json.dumps(sched, separators=(",", ":"))))
print(f"wrote tas-exact.user.js ({len(sched)} events)")
