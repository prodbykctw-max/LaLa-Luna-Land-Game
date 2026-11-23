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

`skylightab` (the baked sky light, same camera pose with `?sky=old` and with the bake on, three spots per island - open meadow, under trees, by walls - written as `qa/out/sky_<island>.jpg`, plus the baked map itself as `qa/out/skymap_<island>.png`; `SKYN=32` bakes with fewer directions, `MOBILE=1` is the 390x844 run).

`sky3ab` (three-way: OLD `?skylight=old` | FIRST `?skylight=v1` | STRONGER, the same spots as `skylightab`, written as `qa/out/sky3_<island>.jpg`, `sky3_green_mobile.jpg` with `MOBILE=1`, and a close shot of her in the hub's deepest shade pool as `sky3_lala.jpg`; `VARIANT=new|old|v1` runs one column, `COMPOSE=1` builds the sheets from the files on disk; `qa/sky3metrics.py` prints the shade-pool luma numbers). Run it through `/home/claude/scripts/qarun.sh` on the shared machine.

`crowdfade` (`node qa/crowdfade.mjs [old|new|report]`, ~1 h on SwiftShader): proves the Town crowd's timed dither cross-fade for the two LOD swaps (rig <-> proxy at 46 u, ink outline at 26 u). Runs one scripted walk against `?lodfade=0` (OLD, instant swap) and the default (NEW) on Playwright's controlled clock (`clock.install()` / `pauseAt()` / `runFor()` only - the island is built on the running clock first, then paused), saves 30-frame PNG windows around every crossing to `qa/out/crowdfade/{old,new}/`, and `report` (python3 + PIL + ffmpeg) builds `qa/out/crowdfade_strip_far.jpg`, `crowdfade_strip_ink.jpg`, `crowdfade_strip_pair.jpg` and `crowdfade_ab.mp4`. Checks: no holes at p=0.5, outgoing version not drawn once faded, two fans of one variant fading opposite ways at once, nothing stuck half-faded, `?lodfade=0` swaps in one tick; plus fans-drawn-twice and draw calls/triangles over a walk, OLD vs NEW. `window.__LODFADE` ({on, twice, fading, rows, now}) is the in-game counter it reads. `_harness.mjs` now also steps onto a non-hub island itself (`enterIsland`): islands are no longer built at boot, so `?go=town` alone left every non-hub suite measuring the hub.

Requirements: Node 18+, Playwright with a Chromium (`CHROMIUM_PATH`, default /opt/pw-browsers/chromium),
`PW_PATH` if playwright isn't resolvable. The game must expose test hooks on `window.__T` — the harness makes
`index_test.html` from `index.html` by appending that line; see `_harness.mjs`.
