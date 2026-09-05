# Lala Luna Land — Handoff

**Owner:** Melvin D. Brown III (KCTW)
**Repo:** github.com/prodbykctw-max/LaLa-Luna-Land-Game
**Local:** `C:\Users\Owner\Documents\LaLa-Luna-Land-Game\game`
**Live:** https://prodbykctw-max.github.io/LaLa-Luna-Land-Game/game/index.html
**Last commit at handoff:** `cce0322` — build stamp `2026-09-05n` (bottom-right in game)

This document relinquishes all game tasks. It is written for whoever picks this up next —
another agent, another developer, or Melvin. Everything below is stated as fact only where it was
measured; where it was not, it says so.

---

## 1. Read this first — how I wasted his time

I was wrong repeatedly in the same way, and the next person should not repeat it.

**The failure pattern: I measured the bug with the bug, then argued with the person who could see it.**

Melvin reported, many times, that NPCs and fans were *floating* and *smaller than Lala*. Each time I
measured in-engine, got "feet at 0.000, height 92–115% of Lala", and told him it was fine.

Those measurements were worthless. They read `geometry.boundingBox` — **the same broken box the
loader was reading**. For a quantized skinned mesh that box spans the normalised `[-1, +1]` range,
not the body. So:

- the loader fitted a **doubled** box to the target height → the body rendered at **~53%** of intended
- the loader put the **box's** floor on the ground → the body sat a **full body-height in the air**

Both of his complaints, from one cause. My check agreed with the bug because it was the same reading.

**What actually cracked it was his sentence: "Lala and the animals aren't floating."** That is an
asset difference, not a physics one — `lala.glb` had been rebuilt un-quantized, and `horse.glb` /
`cow.glb` were never quantized. Every NPC rig still was.

The same shape of error happened with the beach ball. He said "the white part moves, the coloured
ball stays." I read the roll code, saw it rotate the group, and said the physics was fine. The
physics never ran on that ball at all — see §4.

**Rules for the next person:**

1. When the user describes a symptom precisely and repeatedly, the symptom is data. Your measurement
   disagreeing with it means **your measurement is suspect**, not the user.
2. Never verify a transform bug with the same API the transform bug lives in. Verify from **rendered
   pixels**, a **raycast against real surfaces**, or the **file on disk** — an independent path.
3. `Box3.setFromObject` is unreliable for skinned meshes. It reads the bind-pose geometry box and
   ignores skinning. It is the wrong tool for "how tall is this character on screen".
4. A negative result you produced is not proof of correctness. It is proof you did not find it yet.

---

## 2. Current state

### Scale
- `WORLD = 4` (`?world=` overrides). Scales authored **positions** and landform radii; does **not**
  scale characters, trees, buildings or props.
- `DECOR = 1 + (WORLD-1)*0.75` for hand-authored landmark radii (town square rings, crowd rings).
  Needed because `sample()` scales with the island but hardcoded radii do not — see §4.
- Measured island sizes at `WORLD=4` (1 unit = 0.576 m; Lala 2.95 u = 1.70 m):

| island | units | metres | walk across |
|---|---|---|---|
| hub (Providencia) | 534 × 715 | 308 × 412 | — |
| green (Margarita) | 1335 × 676 | 769 × 390 | 155 s |
| gr (Gorgona) | 604 × 809 | 348 × 466 | — |
| sanity (San Andrés) | 383 × 966 | 221 × 557 | — |
| town (Curaçao) | 992 × 829 | 572 × 478 | 115 s |

True 1:1 with the real islands was costed and rejected: Margarita is 67.4 km, **3.8 hours to cross
on foot** at her 4.96 m/s. Melvin chose 4×.

### Character heights (true scale, metres)
Lala 1.70. Moss 1.91, Rafa 1.95, Cass 1.78, Bea 1.64, Wren 1.63, Juno 1.58, Pip 1.60.
Fans span 1.55–1.96. Horse 2.06 hoof-to-poll, cow 1.75, crowd rig 1.74.
`rig.height` is **total model height**, which is what `loadRig` fits — the animals were previously
given *withers* figures, which is why a horse was 1.65 m and shorter than a man.

### Features added this session
- Rideable horses/cows (Interact to mount, 3.2× speed, `?ride=`, `?saddle=`)
- Fast travel — walk to a named place once to unlock, Travel button in the HUD
- Start over — Secrets → Start over (behind a confirm), or `?reset=1` on the URL
- Contact shadow decal on every character and creature, at all distances
- Grass: a 44 u ring that follows the player, 11,000 clumps desktop / 5,200 mobile, recycled a slice
  per frame. `?grass=` scales it.
- Sand texture (the beach previously had **no map at all**)
- Real stream on Green (was `PlaneGeometry(3.2, 70)` laid flat — a floating blue rectangle)

### Useful URL flags
`?world=` `?grass=` `?ride=` `?saddle=` `?hs=` `?hy=` `?reset=1` `?old=1` `?fps=1` `?noink` `?noshadow` `?nobloom` `?dpr=`

---

## 3. Known open items

These are **not** fixed and are the most likely next complaints:

1. **The fan/NPC fix is unverified by an independent method.** The asset-level change is solid
   (`bboxMin.y` −1 → ~0.0006 on all 15 rigs, matching `lala.glb`), but I never confirmed on screen
   that fans now stand correctly, because I ran out of the user's patience first. **Verify this by
   looking, not by measuring a bounding box.**
2. **Asset size.** De-quantizing cost size: the 15 NPC rigs are now ~13 MB total (fans ~700–830 KB
   each, was ~470 KB). If that is too heavy, reduce it with **mesh simplification**, never by
   re-enabling quantize on a rigged character.
3. **Frame rate on real hardware is unmeasured.** The headless harness runs SwiftShader; its fps
   number is meaningless. Only triangle counts and draw calls from it are real. Green went
   700,542 → 858,744 tris at spawn when grass density went up.
4. **Crowd distribution.** The beach crowd on Town still spreads over a 61 u beach radius, so people
   read as distant. Only the *square* crowd was pulled in.
5. **Mobile has not been re-checked** since the 4× scale.
6. **GTA IV-style movement** (momentum, lean into turns, foot placement) — discussed, never started.
7. **Creature refinement** — butterflies and birds are still simple; partially addressed only.
8. **Design maps** in `game/qa/maps/` predate the coastline swap and are stale.

---

## 4. Traps in this codebase

Real mechanisms that caused real bugs here. Check these first.

**Static batching silently freezes things.** `mergeStatics` merges any mesh whose material came from
`toon()` (it carries `userData.patches`) unless the object is in the `skip` set. `I.props` was not in
that set, so beach balls were **baked into the world mesh at spawn**. Their white cap used a raw
`MeshToonMaterial`, which is not batchable, so it stayed a live child — the group rolled, only the
cap moved, the ball stood still. **Anything that moves must be in `skip`.**

**Never quantize a rigged character.** `gltf-transform quantize` renormalises positions and moves a
compensating scale onto the node. Any engine that fits a bounding box or plants the model origin on
the ground will render it half-size and floating. **Always diff `bboxMin.y` before and after any
asset step.** Feet belong at ~0.

**Autosprite exports carry a stray icosphere.** Every export contains a 42-vertex icosphere of radius
1 at the origin, spanning z −1 to +1, beside the real body. three.js does not appear to load it, but
Blender does, and any importer that includes it will double the measured height. The de-quantize
script drops it.

**Hardcoded radii do not scale, but `sample()` does.** `sample()` multiplies by `cfg.spread`, which
includes `WORLD`. Hand-authored radii (town square stalls at 12, lamps at 15.5) do not. After the 4×
scale the square stayed 12 u across while its own crowd was flung past 80 u — half a football pitch
away, which is why everyone looked tiny. **When scaling the world, audit every hardcoded coordinate.**

**Fixed search windows break when the world grows.** The shoreline search was `dock−20 .. dock+40`.
After 4× it missed the coast entirely on two islands — pier left inland, arrival spawn in the sea.

**`height()` returns 0 off the island.** The sea sits at −1.1, so anything stranded outside the
coastline stands *in the air over water*. Looks exactly like floating. `landify` walks hand-placed
content back onto land; **`cfg.places` was missing from it** and its landmarks sat in the sea.

**The QA harness had a hook bug.** It injected `window.__T` at the **first** top-level `})();` but
`index.html` has two, and the first is a different IIFE — so every suite timed out. Fixed in
`qa/_harness.mjs`; it now uses the last one.

---

## 5. Tooling

**QA suites** — `node qa/<name>.mjs [island]`: `traversal, reach, camera, console_load, assets,
mobile, framebudget, codehealth, overhead, scale, float`. Each is standalone. `qa/run_all.sh` runs
them. They need `window.__T`, injected into a generated `index_test.html`.

**Character repair** — the `image-to-3d-character-repair` skill (saved to the account) documents the
full pipeline: diagnose texture vs geometry with unlit/clay/normals renders, reproject the clean 2D
portrait, Taubin-smooth reconstruction noise, and decimate the **body only** with the head vertex
group protected.

**Grass** — the `stylized-grass-field` skill documents the density maths and the frame budget.

**De-quantizing rigs** — `diag/dequant.py` (Blender) bakes node transforms and drops the icosphere.
Follow with `gltf-transform resize` + `webp`, and **never** `quantize`.

---

## 6. What I'd do first

1. Load the live build and **look** at the town square and the beach. Confirm with your eyes whether
   fans stand on the ground and read as adult-sized. Do not open a bounding box to decide this.
2. If they are still wrong, check `loadRig` (`index.html` ~line 622): it computes
   `Box3.setFromObject(gltf.scene)` and derives both scale and ground offset from it. That single box
   is the origin of every scale-and-float bug in this project. Consider replacing it with a box built
   from visible mesh geometry only, so no future asset can poison it.
3. Then work Melvin's list in §3 in his priority order, not yours.

He is a good client to work for: he reports symptoms precisely, he is patient far longer than he
should be, and he is right about his own game. Believe him earlier than I did.
