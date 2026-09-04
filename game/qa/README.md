# Game QA suite

Headless, reproducible audits for the game in the folder above this one. Every script prints JSON and writes
`qa/out/<name>.json`; `report.md` is the last full audit.

    node qa/<suite>.mjs [island ...]      # one suite
    bash qa/run_all.sh                    # all suites (~35 min on SwiftShader)

Suites: `traversal` (stuck spots, burial, camera-in-geometry), `reach` (every interactable reachable, priority shadowing),
`camera` (yaw drift, distance pops, stuck keys after blur), `console_load` (errors, 404s, NaNs), `assets` (download budget),
`mobile` (HUD overlap / off-screen / touch-size at 390×844 and 844×390), `framebudget` (tris + draw calls per island),
`codehealth` (TODOs, duplicated constants, dead code).

Requirements: Node 18+, Playwright with a Chromium (`CHROMIUM_PATH`, default /opt/pw-browsers/chromium),
`PW_PATH` if playwright isn't resolvable. The game must expose test hooks on `window.__T` — the harness makes
`index_test.html` from `index.html` by appending that line; see `_harness.mjs`.
