# Game QA suite

Headless, reproducible audits for the game in the folder above this one. Every script prints JSON and writes
`qa/out/<name>.json`; `report.md` is the last full audit.

    node qa/<suite>.mjs [island ...]      # one suite
    bash qa/run_all.sh                    # all suites (~35 min on SwiftShader)

Suites: `traversal` (stuck spots, burial, camera-in-geometry), `reach` (every interactable reachable, priority shadowing),
`camera` (yaw drift, distance pops, stuck keys after blur), `console_load` (errors, 404s, NaNs), `assets` (download budget),
`mobile` (HUD overlap / off-screen / touch-size at 390×844 and 844×390), `framebudget` (tris + draw calls per island),
`codehealth` (TODOs, duplicated constants, dead code).
`questpath` (every objective in quest order is physically reachable from the spawn with only the abilities held at that point - a lattice search over the walker's own rules, then replayed with `walkerUpdate` driven by the stick and jump button only; `--cues` audits the jump/glide cues instead), `keepwalk` (the keep played with the stick: book, 24 bubbles, orb, exit to the moon island).

`sanityperf_census` (per island: main vs shadow-pass draw calls/tris, attributed to Lala / NPC / creature / other via a `renderBufferDirect` hook), `sanityperf_play` (JS ms per frame p50/p95/max idle/walk/jump, 20 s renderer-stubbed walk hitch count, CDP CPU profile, heap allocation profile; `--tag --frames --flags`), `sanityperf_load` (per-step build and warm timings from `window.__STEPLOG`, sync blocks over 50/100/250 ms), `sanityperf_probe` (visible meshes grouped by shared material). `sanityperf_ab` (controlled-clock A/B capture: same scripted pose sequence, run, jump and camera pan on every island, `--tag --islands --query --frames --video=1`) with `sanityperf_diff <tagA> <tagB>` (per-frame mean absolute difference and % pixels over 8; set `AB_DIR`/`AB_SUB`), and `sanityperf_jump` (jump apex at 60/30/20 fps and mixed dt). Use `QA_ROOT=<dir>` to point them at an old build for A/B, and capture BOTH sides in the same session: a run-to-run noise pair (old vs old2) is part of the proof. Results go to `qa/out/sanityperf_*_<tag>_<island>.json`. Heavy runs go through the QA farm (/home/claude/scripts/qafarm.sh), not this box.
`crowdfade` (`node qa/crowdfade.mjs [old|new|report]`, ~1 h on SwiftShader): proves the Town crowd's timed dither cross-fade for the two LOD swaps (rig <-> proxy at 46 u, ink outline at 26 u). Runs one scripted walk against `?lodfade=0` (OLD, instant swap) and the default (NEW) on Playwright's controlled clock (`clock.install()` / `pauseAt()` / `runFor()` only - the island is built on the running clock first, then paused), saves 30-frame PNG windows around every crossing to `qa/out/crowdfade/{old,new}/`, and `report` (python3 + PIL + ffmpeg) builds `qa/out/crowdfade_strip_far.jpg`, `crowdfade_strip_ink.jpg`, `crowdfade_strip_pair.jpg` and `crowdfade_ab.mp4`. Checks: no holes at p=0.5, outgoing version not drawn once faded, two fans of one variant fading opposite ways at once, nothing stuck half-faded, `?lodfade=0` swaps in one tick; plus fans-drawn-twice and draw calls/triangles over a walk, OLD vs NEW. `window.__LODFADE` ({on, twice, fading, rows, now}) is the in-game counter it reads. `_harness.mjs` now also steps onto a non-hub island itself (`enterIsland`): islands are no longer built at boot, so `?go=town` alone left every non-hub suite measuring the hub.

Requirements: Node 18+, Playwright with a Chromium (`CHROMIUM_PATH`, default /opt/pw-browsers/chromium),
`PW_PATH` if playwright isn't resolvable. The game must expose test hooks on `window.__T` — the harness makes
`index_test.html` from `index.html` by appending that line; see `_harness.mjs`.
