#!/usr/bin/env python3
"""Embed inputs/summer1.json into tas-exact.template.js -> tas-exact.user.js"""
import json
KEYS = {"KeyW": "up", "KeyD": "right", "KeyS": "down", "KeyA": "left", "Reset": "reset"}
ev = json.load(open("inputs/summer1.json"))
sched = [[f, KEYS[k], d] for f, k, d in ev]
tpl = open("tas-exact.template.js").read()
open("tas-exact.user.js", "w").write(tpl.replace("/*SCHED*/[]", json.dumps(sched, separators=(",", ":"))))
print(f"wrote tas-exact.user.js ({len(sched)} events)")
