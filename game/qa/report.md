# Lala Luna Land — QA audit (2026-09-04)

Scope: `index.html` @ 2053 lines (read-only), test build `index_test.html`, headless Chromium + SwiftShader via Playwright.
All scripts live in `qa/`, all raw output in `qa/out/`. Every number below was produced by a script named in the finding; re-run with `node qa/<name>.mjs [island]`.

## Executive summary

1. **No blockers found in traversal**: 6,451 grid cells across 5 islands, 0 trap cells, 0 pockets, 0 stalls / buried / out-of-bounds in 136 real-key runs (`traversal.mjs`).
2. **Camera (baseline for the rewrite)**: holding **S** makes the camera spin at 16°/frame and the player pirouette in place (heading and camYaw chase each other, `index.html:1684,1732`); holding **A/D** spins 8°/frame and turns a strafe into an orbit (`camera.mjs`). This is the single biggest feel problem.
3. **Camera clips into terrain**: `cameraCollide` (378-398) only tests cylinder colliders, never `I.height()` — 87 grid samples on Green put the camera inside Horse Hill; mesa/lighthouse walls likewise (`traversal.mjs`).
4. **Stuck keys after alt-tab**: no `blur`/`visibilitychange` handler (703-709); a key held while focus is lost keeps the player walking indefinitely — 8.4 units/s measured (`camera.mjs`).
5. **Two notes are shadowed by higher-priority prompts**: hub "Pinned to the keep door" (castle wins inside r<14, 1849) and Town "Pinned to a beach umbrella" (NPC Rafa homes 2.8 units away, 1850). Both are reachable only from one side (`reach.mjs`).
6. **Every island downloads every rig**: 13.6 MB / 45 requests before you can move, on all five islands including the hub; 12 fan GLBs (6 MB) load even on islands with no crowd (`assets.mjs`). `lala-raw.glb` (18.5 MB) and `lala-polished.glb` sit unreferenced in `assets/`.
7. **Skinned characters dominate the frame**: player rig alone = 60k tris + 60k ink twin; Town crowd = 465k skinned tris (76% of the scene), shadow-mapped twice (`framebudget.mjs`). Sanity has 16 lights vs 4 elsewhere.
8. **Mobile HUD**: portrait prompt overlaps the Secrets button (198 px²), landscape Sound/Secrets buttons overlap each other, top buttons are 23-26 px tall (<44), no `safe-area-inset` despite `viewport-fit=cover` (`mobile.mjs`).
9. **Console is clean**: no page errors, no shader errors, no NaN state on any island; only Google Fonts (no network here) and a favicon 404 (`console_load.mjs`).
10. **World layout is non-deterministic**: 88 `Math.random()` calls, decor placement unseeded (1262) — tree/rock coordinates change every reload, so stuck-spot repros need a seed. Named objects (notes, NPCs, features) are fixed.

Severity key: **blocker** = can't progress / crash · **major** = most players will hit it and it hurts · **minor** = noticeable, workaround exists · **polish** = cosmetic / code quality.

---

## Suite 1 — Traversal & stuck spots (`qa/traversal.mjs`, output `qa/out/traversal_all.json`)

Method. Phase A replicates `tryMove` + collider slide (`index.html:1689-1700`) exactly, using the game's own `I.inside`, `I.height`, `__T.canStand`, `I.colliders`, on a 3-unit grid over every lobe, 8 directions per cell; camera goal replicates `cameraCollide` + `walkerUpdate` constants (378-398, 1733-1736) and is raycast against every solid mesh in `I.scene` (excluding player, sky, sea, moon, instanced grass, transparent, ink shells). Phase B teleports to spawn + candidates + 6 random standable spots, dispatches real `keydown` for W/S/A/D for 1.8 s each with rendering stubbed (60 fps rAF), and checks displacement, `W.y < height` (buried) and leaving `I.inside` without `canStand`.

| island | cells | standable | traps | pockets | real runs | stalls | buried | outside | cam samples | cam hits | non-canopy kinds |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hub | 1107 | 1062 | 0 | 0 | 28 | 0 | 0 | 0 | 2214 | 529 (24%) | stone 50, trunk 10, ink* 113 |
| green | 1880 | 1880 | 0 | 0 | 28 | 0 | 0 | 0 | 3760 | 835 (22%) | **hill 87**, stone 24, trunk 15, ink* 146 |
| gr | 1210 | 1210 | 0 | 0 | 28 | 0 | 0 | 0 | 2420 | 254 (10%) | trunk 67, other 54 |
| sanity | 972 | 972 | 0 | 0 | 24 | 0 | 0 | 0 | 1944 | 238 (12%) | stone 6 (lighthouse rock), ink* 70 |
| town | 1282 | 1249 | 0 | 0 | 28 | 0 | 0 | 0 | 2564 | 200 (8%) | trunk 52, other 57 |

\* "unknown" in `traversal_all.json` = `I.staticInk` (merged outline shell, identified with `qa/probe_hit.mjs`; its thickness is a vertex attribute so the uniform filter missed it — the current script excludes it). The 45 non-standable hub cells are the locked keep (r<11, `canStand` 1667) — intended.

### Findings

**T1 · major · Camera goes inside hills, mesas and the lighthouse rock.**
Evidence: `traversal_all.json` green `camera.nonCanopy` → e.g. player at (-46.9,-16.9) yaw -1.57: ray hits `LatheGeometry` at (-26,0,-18) (Horse Hill) 10.2 units out of an 11.7-unit camera arm, hit y=4.6. Arithmetic: camera goal x≈-35.4 is 9.5 from the hill centre, hill height there = 15·(1-9.5/19)^1.35 = 5.8, camera y = 0+4.9 → 0.9 units under the surface. Same on sanity around Lighthouse Rock (stone hits at (-35.1,-26.1), (-32.1,-23.1), hit y 9-9.6) and the hub keep mesa (50 stone hits).
Cause: `cameraCollide` (378-398) checks only `I.colliders` cylinders; `walkerUpdate` sets `desired.y = W.y + camH` (1735) with no terrain test.
Fix: after computing `goal`, clamp `goal.y = max(goal.y, I.height(goal.x, goal.z) + 1.2)` and/or shorten the arm until the sample is above ground.

**T2 · minor · Camera passes through tree canopies and trunks (22-24% of samples on hub/green).**
Evidence: `byKind.canopy` 541 on green, 338 hub; trunk hits with no collider within reach on gr/town (`colliderNear:false` in `traversal_green2.json`). Only colliders with `r ≥ .9` grab the camera (386); palms on gr/town appear to have thinner radii.
Fix: give trees a `camR` ≥ 1 (the field already exists, 386) or accept canopy pass-through as style and only fix trunks.

**T3 · polish · Layout is unseeded.** 88 `Math.random()` calls; decor sampler at 1262. Any coordinate-based repro for trees/rocks is invalid on the next reload (demonstrated: `probe_hit.mjs` at the green coordinates above found no hit on a fresh load).
Fix: a 20-line mulberry32 seeded from `?seed=` (default constant) used by `sample()`/decor; keep `Math.random` for FX.

No traps, pockets, stalls, burials or escapes were found — traversal is **clean** with a fresh save. Not verified: traversal with abilities granted (lantern stones, open gate, glide over water) — this run used a fresh save only.

## Suite 2 — Interaction reachability (`qa/reach.mjs`, `qa/out/reach.json`)

Method. For each note/pickup/letter/NPC/dock/castle: find the nearest `canStand` spot on a ring 1.2-3.6 units out (granting the island ability if none), teleport, call `__T.nearest(I)` (1841-1858), compare. If shadowed, sweep 216 positions within 5 units and count where the target wins.

Result: 38/40 targets OK on first try. Letters on Green/GR/Sanity/Town are reachable from the ground at their mesa/stack top (walker y equals letter y there). Sea-stack note needs the lantern (expected: `canStand` 1670-1671).

**R1 · major · Hub note "Pinned to the keep door" (0,12) is hidden by the castle prompt.**
`nearest` at (1.2,12): returns `castle:Try the doors`. Castle candidate has pri 2 vs note pri 3 (1843) and fires for 6 < d < 14 from origin (1849); the note sits at d=12. Reachable only from z ≥ 14 (51 of 216 sweep positions, e.g. (0,14.5)) — i.e. standing 2.5+ units away from the note. First-time players will read the door prompt and never see the note.
Fix: exclude castle when an unread note is within 3 units, or move the note to z=15.5.

**R2 · major · Town note "Pinned to a beach umbrella" (-40,20) is hidden by NPC Rafa.**
Rafa homes at (-38,22) (dist 2.8, wander 8); NPC pri 2.5 beats note pri 3 whenever both are in range (1850-1853). At spawn state `nearest` at (-38.8,20) = `npc:Talk to Rafa`. Reachable from the west side only (100/216 positions, e.g. (-41.5,20)) or after Rafa wanders off.
Fix: give notes priority over NPCs when the note is closer, or move Rafa's home 6 units east.

**R3 · minor · Intermittent shadowing** (same mechanism, depends on wander): hub Moss ↔ dock-post note (5.9 apart, wander 9); green Wren ↔ stream note (5.0), Juno ↔ arch note (5.0); town Bea ↔ gate note (6.0). Listed in `npcNoteOverlaps`.
Fix: same as R2, or sort by distance first when both are within 3 units.

## Suite 3 — Camera behaviour baseline (`qa/camera.mjs`, `qa/out/camera.json`)

Method. Real key events, rendering stubbed (60 fps rAF ⇒ `dt≈1/60`, the regime the lerps at 1732/1737 assume). Segments of 3 s: W → A → D → idle, then A-from-rest, S-from-rest, W through the densest collider cluster, idle after `goIsland`, and a blur-without-keyup probe. Per frame: `W.heading`, `W.camYaw`, camera yaw actual, camera distance. Metrics: net yaw drift, total yaw path, max per-frame step, distance min/max, pops (>0.8 units/frame), settle time.

| island | A: yaw path / net / moved | S: yaw path / max step / moved | idle settle | arrive dolly | blur → moved in 1 s |
|---|---|---|---|---|---|
| hub | 477° / +117° / 5.2 u | 952° / 16.2°/f / 2.8 u | 1.53 s | 13.3→11.5 | 8.37 |
| green | 314° / -46° / 2.4 u | 594° / 16.2°/f / 1.4 u | 1.88 s | 13.1→11.5 | 4.81 |
| gr | 474° / +114° / 5.1 u | 929° / 16.2°/f / 1.2 u | 1.55 s | 13.1→11.5 | 8.29 |
| sanity | 479° / +119° / 5.2 u | 954° / 16.2°/f / 1.7 u | 1.51 s | 13.1→11.5 | 8.61 |
| town | 481° / +121° / 5.3 u | 940° / 16.2°/f / 3.0 u | 1.57 s | 13.1→11.5 | 8.51 |

(W for 3 s moves 25.5 u with 0° drift on every island — the reference.)

**C1 · major · Walking toward the camera (S) is a pirouette.** `heading = atan2(-ix,-iz) + camYaw` (1684) puts heading 180° from camYaw; `camYaw` lerps toward heading at `dt*1.8` (1732); next frame heading is again camYaw+180°, so the difference never shrinks: the camera turns 16.2°/frame for as long as S is held (950° in 3 s) and the walker, whose move vector follows heading, walks a tight circle (1.2-3 units net in 3 s vs 25.5 for W). Path samples in `camera.json` `S-from-rest.path` show x oscillating ±3 around spawn.

**C2 · major · Strafing (A/D) is an orbit.** Same loop with a 90° offset: 8.1°/frame, ~480° of yaw in 3 s, walker covers 5.2 u instead of 25.5 and ends facing 120° from where it started. There is no dead-band and `lookHold` only protects manual drags (739).
Fix for C1/C2 (for the rewrite): follow the *velocity direction* only when `|Δ| < ~100°` and with a rate that decreases as |Δ| grows, or follow position (orbit-behind with damping on the walker's displacement) instead of heading; never feed camYaw into heading and heading into camYaw in the same frame.

**C3 · minor · Arrival dolly.** `goIsland` places the camera 13.5 back / 7.4 up (1951-1953), `walkerUpdate` wants 11.5 / 4.9 landscape (1733); every island entry starts with a ~0.5 s dolly-in (13.1→11.5 over ~30 frames in `arrive-idle.path`).
Fix: use the same constants (hoist `CAM_D/CAM_H`).

**C4 · minor · Collision pops of 0.8-1.1 u/frame** near trunks (hub D frames 45/59-60, gr idle 50-51, sanity A/D). `cameraCollide` returns a hard clamp; only the 4.2/s position lerp smooths it. Closest approach seen: 4.48 u (hub D).
Fix: smooth the clamped distance separately (e.g. fast-in 12/s, slow-out 2/s).

**C5 · major · Stuck keys on focus loss.** `keys[]` is never cleared (691-709); dispatching `blur` while W is held leaves the walker moving 8.4 u/s indefinitely. Real-world trigger: alt-tab / notification / iOS app switch while walking.
Fix: `addEventListener('blur', () => { for (k in keys) keys[k] = false; jumpHeld = false; })` and the same on `visibilitychange`.

Not verified: portrait camera constants (15 / 6.2, 1733) were not exercised by this suite (it runs landscape); touch drag-to-look (738-739) was not simulated.

## Suite 4 — Console & load (`qa/console_load.mjs`, `qa/out/console_load.json`)

All five islands: **0 page errors, 0 shader messages, 0 NaN** in walker/camera state or bounding spheres, player and all NPC rigs attached (`playerModel:true`, 27/27 town NPCs with models). Readouts at spawn: hub 485k tris/314 calls, green 672k/588, gr 407k/337, sanity 346k/410, town 726k/695 — consistent with the known Intel numbers.

**L1 · minor · External font dependency.** `fonts.googleapis.com` CSS (line 9) fails here (`ERR_CONNECTION_RESET`, sandbox has no egress); fallbacks are `ui-monospace, monospace` and `serif` (15, 31, 107), so the page renders but the look changes offline / on blocked networks.
Fix: self-host the two woff2 files in `vendor/`.

**L2 · polish · `favicon.ico` 404** — no `<link rel="icon">` (0 matches). The 404 is the console's only error. Not verified by response event (browser-initiated fetch), inferred from the absence of any other 4xx in 45 recorded responses.

Time-to-first-frame under SwiftShader (27-116 s) is dominated by software shader compilation and is not representative; use the asset totals below for real-network estimates.

## Suite 5 — Assets & bundle (`qa/assets.mjs`, `qa/out/assets.json`)

Inventory (on disk): 33 files, 39.7 MB. Referenced by `index.html`: 9 vendor JS (736 KB raw / 181 KB gzip), `index.html` 154 KB (49 KB gzip), 8 named GLBs + 12 fan GLBs.

Live, identical on **every** island (`?go=` or hub): **45 requests, 13.57 MB** — lala.glb 2.9 MB, npc-fan 1.08, npc-green 0.95, npc-dock 0.80, 12× fans 6.0 MB, horse/cow/dino 0.56, three.min.js 0.6, index 0.15, + 16 blob: URLs (GLB textures, ~1 MB).

**A1 · major · No lazy loading per island.** `ISLANDS.forEach(buildIsland)` at 1935 builds all five scenes at startup and each `wantRig` (585) kicks off its GLB immediately, so the Sanity player (one character on screen) still downloads the 12-fan Town crowd. First playable frame requires ~13.6 MB; on a 10 Mbps connection ≈ 11 s of pure download before the title button does anything.
Fix: load rigs in `goIsland` (`wantRig` on demand) and prefetch the *next* island during the sail; or at minimum defer `fan01-12` until Town.

**A2 · minor · Dead weight in `assets/`.** `lala-raw.glb` 18.5 MB and `lala-polished.glb` 2.7 MB are never referenced (`unreferencedOnDisk`); `npc-crowd.glb` 1.5 MB is referenced (542, fallback rig) but never requested. If the folder is deployed as-is that's 21 MB of hosting for nothing.
Fix: move the two to `blender/` (source) and delete or use `npc-crowd`.

**A3 · polish · `lala.glb` is 2.9 MB / 60k tris for a toon character** (see budget). A Draco/meshopt pass and a 20k decimation would cut download and skinning cost together. Not verified: whether the GLB already uses quantization.

## Suite 6 — Mobile layout (`qa/mobile.mjs`, `qa/out/mobile.json`, screenshots `qa/out/mobile_<island>_<view>.png`)

Touch emulation (`pointer:coarse` ⇒ `body.touch`, `pk="TAP"`), prompt + toast forced on, bounding boxes measured for stick/act/jmp/prompt/HUD text/top buttons/toast.

| view | overlap | offscreen | <44 px targets | elements inside the joystick touch zone (x<50%, y>35%) |
|---|---|---|---|---|
| 390×844 portrait | `#prompt` × `#secretsBtn` 198 px² (all 4 islands with a live prompt) | none | mute 75×23, secrets 69×23 | prompt, mute, secretsBtn |
| 844×390 landscape | `#mute` × `#secretsBtn` 78 px² | none | mute 88×26, secrets 81×26 | prompt |

**M1 · minor · Portrait: the interaction prompt sits on the Secrets button.** Prompt box y 582-612, Secrets y 609-632 (CSS: `#prompt{margin-bottom:214px}` and `.topbtn{bottom:212px}` at ≤640 px, lines 95-97). Visually the "TAP Talk to Juno" pill touches "SECRETS" (`mobile_green_portrait.png`).
Fix: `.topbtn{bottom:252px}` or move Sound/Secrets to the top-left under the place name.

**M2 · minor · Landscape: Sound and Secrets overlap by 3 px** (x 368-456 vs 453-534); both are 26 px tall — under the 44 px touch guideline, as are the portrait ones (23 px).
Fix: min-height 40 px, gap 8 px.

**M3 · minor · Taps on Sound/Secrets also start the joystick in portrait.** `joyStart` (712-721) accepts any pointerdown with `clientX < innerWidth*.5 && clientY > innerHeight*.35` and, unlike `lookStart` (736), does not check `e.target.closest("button,.card,.ov")`. Both buttons and the prompt lie in that zone in portrait. Verified by code inspection and box geometry; not verified at runtime (would need a real pointer sequence — add to the suite if the fix is disputed).
Fix: add the same `closest("button,.card,.ov")` guard to `joyStart`.

**M4 · polish · No safe-area handling.** `viewport-fit=cover` (line 5) but zero `env(safe-area-inset-*)` uses; in landscape the stick is at `left:22px` and the Jump button at `right:26px`, i.e. under the notch / home indicator on notched phones. Not verified on a notched device.

**M5 · polish · Landscape prompt covers the player.** `#prompt` at y 222-252 of 390 is exactly where the character is drawn (`mobile_green_landscape.png`).

Nothing important is off-screen in either orientation; the letters tray, place name, weather label and toast all fit.

## Suite 7 — Frame budget (`qa/framebudget.mjs`, `qa/out/framebudget.json`)

`?fps=1` readout (renderer.info averages — real tris/calls, fps meaningless under SwiftShader) at spawn + 3 places, and a visible-mesh breakdown by material class.

| island | readout range (tris / calls) | scene tris | meshes / materials | skinned tris (share) | lights | top-3 costs |
|---|---|---|---|---|---|---|
| hub | 444-455k / 150-284 | 339k | 328 / 229 | 179k (53%) | 4 | player+2 NPC skinned 99k, their ink twins 80k, staticMesh 40k |
| green | 645-694k / 397-575 | 469k | 652 / 438 | 219k (47%) | 4 | 48 skinned meshes 129k (9 horses + rigs), ink twins 90k, staticMesh 79k + ink 74k |
| gr | 357-378k / 201-385 | 279k | 399 / 276 | 132k (47%) | 5 | skinned 66k + ink 66k (2 dinos + player), grass 40k |
| sanity | 344-373k / 164-402 | 268k | 459 / 298 | 120k (45%) | **16** | player 60k + ink 60k, staticMesh 37k + ink 37k |
| town | 712-**880k** / 311-689 | 608k | 730 / 560 | **465k (76%)** | 4 | crowd skinned 388k, ink twins 77k, grass 40k |

Readout > scene tris because of the shadow-map pass (315-339 casters) and bloom.

**F1 · major · Skinned characters are half to three quarters of every frame.** The player alone is 59,836 tris plus a 59,836-tri `MeshBasicMaterial` ink twin (sanity row: exactly one of each). Town's crowd (24 crowd + 3 named fans, 53 skinned meshes) is 388k tris, and skinned meshes are also shadow casters, so they're skinned twice per frame. On the UHD 620 this is the 26 fps.
Fix: decimate `lala.glb` to ≤20k, crowd fans to ≤8k each; drop `castShadow` on crowd beyond 20 u (the LOD at 1780 already toggles it at 42 u — halve it); render ink twins only for the player and named NPCs.

**F2 · minor · The Beach (Town) is the worst spot: 880k tris / 434 calls** (`samples` "The Beach"), 23% over the spawn number the Intel measurement was taken at.

**F3 · minor · Sanity has 16 lights** (4 elsewhere): every extra `PointLight` adds a per-fragment loop for every `MeshToonMaterial`. Not verified which lights (likely lantern, stones, lighthouse beam, storm key); list them with `I.scene.traverse(o=>o.isLight)`.
Fix: bake stone glow into emissive, keep ≤6 lights.

**F4 · polish · 81-104 individual `SphereGeometry` meshes and 229-560 unique materials per island** survive the static batch (`plainToon` filter at 1168 excludes textured / transparent / double-sided). Draw calls 150-690 track this.

## Suite 8 — Code health (`qa/codehealth.mjs`, `qa/out/codehealth.json`)

Stats: 1,819 script lines, 69 functions, 50 lines > 200 chars (longest 416), 18 event listeners, 0 TODO/FIXME, 9 `DBG(`/console calls (533-582, 1204, 1935), 4 empty `catch{}` (657-668, localStorage — acceptable), 0 unused top-level identifiers found by the reference-count heuristic.

**H1 · polish · Camera/movement magic numbers** (all in `codehealth.json → magicNumbers`): `cameraCollide` buffer 1.5 / grab radius .9 / minDist 5.0 (383-396); `walkerUpdate` dead-zone .08 (1683, repeated 1714), glide boost 1.35, step limit 1.5 (1691), body radius .5 (1698), jog threshold .62, follow rate 1.8 (1732), camera lerp 4.2 (1737), camD/camH 11.5/4.9/15/6.2 (1733); look sensitivity .0085 and hold 2.2 s (739); joystick MAXR 62 / half-size 78 (711, 720); `goIsland` camera 13.5/7.4/2.4 (1952-1953, disagrees with 1733 → C3). Hoist into a `CAM = {...}` / `MOVE = {...}` block so the rewrite has one place to tune.

**H2 · polish · Duplicated logic.** Touch-zone test `clientX < innerWidth*.5 && clientY > innerHeight*.35` appears in both `joyStart` (716) and `lookStart` (737); the angle-wrap `while(da > Math.PI)...` loop appears at 373, 1712 and 1777 (three copies of `lerpAngle`'s body); the fragment shader string at 326 and 1154; instanced-mesh flush at 821/835.

**H3 · polish · `W.heading` is unbounded** — it reached +755° / -632° in `camera.json`. Harmless today (consumers wrap), but any future `heading - camYaw` comparison without wrap will break.

**H4 · polish · Constants scattered as literals** — `.5` used 88 times, `1.5` 33, `1.6` 33 (mostly FX; not a bug, but grep-ability suffers).

---

## What a reusable game-QA pipeline should look like

The scripts in `qa/` are already island-agnostic; what made them possible is a handful of hooks. Generalising:

### Hooks a game must expose (the `window.__T` contract)

| hook | used by | why |
|---|---|---|
| `__T.ISL` / list of levels with `cfg` (spawn, interactables, bounds) | all | enumerate levels and targets without parsing source |
| `__T.CUR` + `goIsland(level, skipFade)` | all | jump between levels without UI |
| `I.W` walker object with writable `x/y/z/vy/grounded/heading/camYaw/active` | 1, 2, 3 | teleport and read state per frame |
| `I.height(x,z)`, `I.inside(x,z)`, `canStand(I,x,z)`, `I.colliders` | 1, 2 | analytic sweeps run 1000× faster than key simulation |
| `nearest(I)` (interaction resolver) | 2 | reachability without pressing keys |
| `camera`, `renderer`, `composer` | 3, 7 | camera metrics; stub `composer.render` to run logic at 60 fps under SwiftShader |
| `I.scene` | 1, 7 | raycasts and material breakdowns |
| `G` (save state) | 2 | grant abilities / flags |
| `?go=<level>`, `?fps=1`, and ideally `?seed=N` | all | deterministic entry, real tris/calls, reproducible layout |
| keyboard-driven input through `window` events + a `keys` map | 1, 3 | Playwright can hold keys; also test `blur` reset |

Rule of thumb: everything the update loop *reads* should be reachable from `__T`, and nothing in the render path should be required to advance the simulation.

### Suites that generalise to any Three.js / HTML game

1. **Traversal sweep** (grid + real-input confirmation) — needs height/inside/canStand + walker. Add "with each ability granted" as a matrix.
2. **Interaction reachability** — needs an interactable list and the resolver. Always include the "who shadows whom" scan; it found both real bugs here.
3. **Camera baseline** — needs camera + walker + input. Keep the same segments (W/A/D/idle/S-from-rest/through-colliders/arrive/blur) so before/after rewrites are comparable; report yaw path, max step, distance range, pops, settle.
4. **Console/load** — generic. Assert 0 pageerror, 0 shader messages, 0 non-finite state, all rigs attached.
5. **Assets** — generic (inventory + live request log per level). Gate on "MB before first input".
6. **Mobile layout** — generic (bounding boxes + overlap + <44 px + safe-area grep + screenshots at 390×844 / 844×390). Force every HUD element visible before measuring.
7. **Frame budget** — needs `renderer.info` and the scene. Sample spawn + N landmarks; break down by material class; track over time in CI.
8. **Code health** — generic static scan; most valuable as a diff between commits.

### Process

- One `_harness.mjs` per project (server + browser + log capture + `noRender`), one script per suite, every script prints JSON and writes `qa/out/<suite>.json`; run suites **sequentially** (parallel SwiftShader browsers starve each other — first-frame went from 32 s to 116 s with three in flight).
- Load with `waitUntil:'domcontentloaded'` and poll for `__T.CUR`; never wait for `load` (GLBs).
- Seeded world + fixed save state ⇒ coordinates in findings stay valid; without a seed, findings must carry enough context (object type, nearest fixed landmark) to re-find them.
- Severity by player impact; every finding = script + numbers + line numbers + one-line fix; "not verified" stated explicitly.
- Keep suites read-only against the game; the only build step is the `sed` that produces `index_test.html`.

### Outputs in this run

`qa/_harness.mjs`, `qa/traversal.mjs`, `qa/reach.mjs`, `qa/camera.mjs`, `qa/console_load.mjs`, `qa/assets.mjs`, `qa/mobile.mjs`, `qa/framebudget.mjs`, `qa/codehealth.mjs`, `qa/probe_hit.mjs` (helper), `qa/out/*.json|.png|.log`.
