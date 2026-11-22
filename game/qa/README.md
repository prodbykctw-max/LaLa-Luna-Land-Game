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

`sanityperf_census` (per island: main vs shadow-pass draw calls/tris, attributed to Lala / NPC / creature / other via a `renderBufferDirect` hook), `sanityperf_play` (JS ms per frame p50/p95/max idle/walk/jump, 20 s renderer-stubbed walk hitch count, CDP CPU profile, heap allocation profile; `--tag --frames --flags`), `sanityperf_load` (per-step build and warm timings from `window.__STEPLOG`, sync blocks over 50/100/250 ms), `sanityperf_probe` (visible meshes grouped by shared material). Use `QA_ROOT=<dir>` to point them at an old build for A/B. Results go to `qa/out/sanityperf_*_<tag>_<island>.json`. Only meaningful on an otherwise idle machine: under SwiftShader with other sessions running, the play run stalled for 36 min.

Requirements: Node 18+, Playwright with a Chromium (`CHROMIUM_PATH`, default /opt/pw-browsers/chromium),
`PW_PATH` if playwright isn't resolvable. The game must expose test hooks on `window.__T` — the harness makes
`index_test.html` from `index.html` by appending that line; see `_harness.mjs`.
