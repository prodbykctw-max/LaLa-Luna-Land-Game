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
`leafwind` / `leaves` / `farshadow` (the leaf-crown work, with `_leafqa.mjs` as their shared helper): all three run the game on a CONTROLLED CLOCK - `page.clock.install()` before `goto`, `pauseAt` right after it, time moved only by `runFor`. The fake clock moves in whole milliseconds, so a frame is 17, 17, 16 ms (mean 16.667); `clockCheck` prints `performance.now()` across the steps before anything is recorded. Software GL pays per pixel, so a run takes `DPR=0.5` (the page's own `?dpr=`) and draws every `STRIDE`th tick, the ticks between running logic only. `leafwind shoot <old|new>` + `make <hub|palm>` = the sway A/B clip and strip (OLD is `?leafwind=old`); `leaves stats/make/fly/flymake` = tris + calls at three views per island, the OLD|NEW stills, and the fly-in with the twice-drawn-cells log (OLD is `?leaves=old`); `farshadow shoot/make/move` = long views, near/far seam crops and the far map's own timings (OLD is `?farshadow=0`). Scripts read `QA_ROOT` to serve another copy of the game.

Requirements: Node 18+, Playwright with a Chromium (`CHROMIUM_PATH`, default /opt/pw-browsers/chromium),
`PW_PATH` if playwright isn't resolvable. The game must expose test hooks on `window.__T` — the harness makes
`index_test.html` from `index.html` by appending that line; see `_harness.mjs`.
