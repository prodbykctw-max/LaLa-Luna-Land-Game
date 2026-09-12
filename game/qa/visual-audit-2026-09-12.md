# Visual audit — 2026-09-12, build 2026-09-11k

Method: `qa/vaudit.mjs` (new) drives the **real gameplay camera** with the HUD on and teleports her
to spawn, three NPCs, three creatures and three named features per island, 960×600, and screenshots
each. `qa/vmat.mjs` and `qa/vgeo.mjs` (new) then measure what a screenshot cannot show. Every number
below came out of this run. Three things I thought I saw turned out not to be defects and are listed
at the bottom rather than quietly dropped.

---

## Tier 1 — obvious. A player meets these in the first ten seconds.

**1. The touch joystick and the JUMP / INTERACT buttons render on desktop.**
`:134` — `body.walk .rbtn{display:grid} body.walk #stick{display:block}`. No `.touch` qualifier, so
a keyboard-and-mouse player gets a 156 px glass joystick nailed over the bottom-left of the frame
and two 100 px buttons over the bottom-right, forever. They appear in all 34 screenshots. The
adjacent rules (`:135` `body.desktop #recenter{display:none}`, `:179` `body.walk.desktop #khint`)
show the gate exists and was simply not applied here.
*Fix:* `body.walk.touch #stick`, `body.walk.touch .rbtn`.

**2. The keyboard hint block sits in the middle of the picture.**
`:177` — `#khint{position:fixed;left:26px;bottom:200px}`. 200 px off the bottom clears the joystick
from item 1; with the joystick correctly gone it is just floating in the play area. At 960×600 it
lands at y≈355–390, dead centre-left, over the meadow. Same root cause as item 1.
*Fix:* once the stick is touch-only, `bottom:26px`.

**3. ~~The hat is about double scale.~~ WITHDRAWN — I was wrong. The real finding is her head.**

*Original claim (2026-09-12, first pass):* that `W.brim` at 1.339 u = 0.77 m and `W.hatTop` at
0.702 u = 0.40 m made the hat roughly twice life size, against a ~0.16 m human head.

*What was wrong:* I converted the hat to metres through the body scale (3.00 u = 5'8") and compared
the result to a real hat on a real head. That silently assumed her head is human-proportioned. It is
not. Measured against her ACTUAL head — head-bone-dominated vertices read through
`SkinnedMesh.boneTransform` and `localToWorld`, same run, hub and Good Riddance agreeing to 0.001:

| measure | hub | gr |
|---|---|---|
| head width (world) | 0.907 | 0.906 |
| head depth (world) | 0.763 | 0.802 |
| `W.brim` width | 1.344 | 1.339 |
| **brim ÷ head width** | **1.48** | **1.48** |
| **crown ÷ head width** | **0.78** | **0.77** |
| **head ÷ body height** | **0.295** | **0.295** |

A real Stetson is brim ≈ 0.38 m over a head ≈ 0.155 m = ratio 2.45. Her brim is 1.48× her head —
**narrower relative to her head than a real hat**, not double. The crown at 0.78 is narrower than her
widest head row, which is hair volume at the temples, so it sits on the skull as intended. The hat is
correctly proportioned to the head it is on and needs no change.

*The finding that survives:* **her head is 0.295 of her body height** — 3.4 heads tall, against about
7.5 for a human. That is a stylisation choice and may well be deliberate, but it is the reason the hat
reads large in every screenshot, and it is what to argue about. Nothing about the hat's own geometry
is wrong.

*The rule this earned:* see HANDOFF 4.9 — a ratio is only evidence against a body that shares the
reference's proportions.

**4. A mown ring follows her.** `:2327` — `transformed *= 1.0 - smoothstep(31.0, 44.0, camd)`
collapses each clump to zero past 44 u, but nothing takes over at that distance, so there is a hard
circle of bare ground around her in every single shot, on every island, at y≈200 px. The comment
says "the ground texture carries the far meadow"; it does not — `TEX.meadow` at `repeat 30×WORLD` is
sub-pixel by then and reads as flat colour.

**5. The lantern globes emit nothing.** `qa/vgeo.mjs`: Good Riddance 9 globes / **9 unlit**, The
Meadow 9 / **9**, Sanity 10 / **10** — zero have any point or spot light within 2.5 u. They are
`MeshBasicMaterial` spheres (`:4451`). On Sanity, which is a night island, the lantern path is the
navigation aid and it casts nothing on the grass, on her, or on the posts holding it.

**6. Every island is the same meadow below the horizon.** The per-island palettes do differ
(`pal.grass` 0x7CC79A / 0x86CC9E / 0x5E9A5A / 0x3C5E6E / 0x9ED49A), but they share one `TEX.meadow`
texture, one `CLUMP` geometry, one density, the same two lantern posts and the same writing desk at
the same relative spot. "Ash Landing — ASH AND EMBERS" is a lush green meadow. "Town Square —
Harbor Landing" is a lush green meadow with rocks in it. Only the sky tells the islands apart.

**7. Clouds have green bellies and visible seams.** The underside takes the HemisphereLight's ground
colour at full strength, so every cloud is lit olive-green from below against an orange sky. The
spheres inside one cloud are separate opaque meshes, so their intersections draw as hard creases,
and the silhouette is heavily stair-stepped against the sky.

**8. Every coastline is a straight diagonal.** The sand band is a constant width, the water edge is a
soft airbrushed blur rather than a shore, and the sand has no texture variation. Same on all five.

---

## Tier 2 — obscure. These need instrumentation, and they are the expensive ones.

**9. Half the scene is unlit.** Sanity material census: **341 MeshBasicMaterial vs 369
MeshStandardMaterial** (plus 12 ShaderMaterial, 3 Points, 4 LineBasic). 48% of the island ignores
the lighting rig entirely. The rig is real and good — 9 lights, hemisphere 0x112557, a cool key
0x84a6ff, a warm rim 0xffe6c1, three point lights — and none of it reaches half the objects. This is
why the night island's set pieces keep their daylight albedo and why nothing on Sanity picks up the
moon. It is also the ceiling on any future lighting work: tuning lights cannot change what 341
materials do not read.

**10. 174 materials are transparent with `depthWrite:true` and no `alphaTest`.** 146 of them
cylinders. They all go into the sorted transparent pass, ordered by object centre distance, which is
the mechanism behind pop-through at oblique angles. Anything that is actually opaque should not be
`transparent:true`; anything cut-out should use `alphaTest` and stay in the opaque pass.

**11. The guide jellyfish reads as a lampshade.** `guideJelly()` `:3425` — the bell is a hemisphere
at opacity .62 `depthWrite:false`, and a *second* hemisphere `cap` at opacity .30 `side:BackSide`,
`depthWrite:false`, on `renderOrder 3`. With depth writing off, the backside cap sorts over the bell
and paints a flat dark disc across its top; the torus rim closes the outline. The result is a table
with a skirt. Separately, the "four ribbons" in the comment are four rigid `CylinderGeometry` tubes
at fixed local positions with no per-frame motion — they hang dead straight while the bell pulses.

**12. The guide arrow reads as a house.** Past about 15 u the chevron's flat base plus the rainbow
fill makes a little tent, not a direction. It only resolves as an arrow when she is nearly on top of
it — which is exactly when she does not need it.

**13. Sea sparkle has no distance attenuation, and it is the same sprite as the stars.** The specks
are the same screen size at the horizon as at her feet, so the far ocean looks like dust on the lens.
On Sanity the sea and the night sky carry identical speckle, so the waterline stops reading as water.

**14. The ocean bands and stops short of the horizon.** At grazing angles the water normal repeats
into horizontal stripes (no anisotropy / no mip fade), and the sea plane terminates before the
horizon line, leaving a haze band between water and sky that reads as smog.

**15. Windows are holes.** The dome on Sanity has pale rectangles at roughly sand albedo standing in
for windows. At night the only thing in a building that should emit is its windows; these are the
one element guaranteed to look wrong.

**16. Tree canopies are outside the shadow system.** 29 large sphere meshes per island carry
`castShadow === false && receiveShadow === false` with a footprint over 30 m² and height over 1.2 u.
The ground under a tree is exactly as bright as open meadow, which is most of why the terrain reads
as flat paper on a slope.

---

## Checked, and NOT defects

Recording these so nobody re-files them.

- **Grass height.** It looks chest-high in near-field shots. Measured from the instance matrices:
  blade geometry 0.99–1.04 u, instance Y scale 0.38–0.68, giving **max 0.71 u, mean 0.55 u** against
  her 3.00 u — knee height, as designed. The wall effect is the low follow camera plus the 44 u
  density ring, not the blade scale. Fixing item 4 will fix the look.
- **Jellyfish on the green and ash islands.** They are `guideJelly()` scouts, not Sanity fauna
  leaking across islands.
- **"Floating" and "buried" objects.** The detector flagged 91 floating and 10 buried on Good
  Riddance. Every floater is a cloud or the moon (gaps of 44–86 u, far outside the island); every
  buried object is `polySlab()` — the island's own base slab, which belongs under the terrain mesh.
  No real floaters or sunken props were found on any island.

## Not yet confirmed

- Her ground shadow appeared offset to her right on the Overgrowth hillside (`va_gr_07_feat0.png`).
  On flat ground it is centred. Needs a dedicated slope test before it is called a defect.

## Files

Screenshots: `qa/out/va_<island>_<nn>_<tag>.png` (34). Tools: `qa/vaudit.mjs`, `qa/vmat.mjs`,
`qa/vgeo.mjs`.


---

## Appendix — the nightly sweep's five findings, verified 2026-09-12

Relayed from the scheduled QA agent after its run on build `ab362f2`. Each checked against the code
and the running game rather than accepted.

**1. Hub `setHex` page error at `:5400` — NOT REPRODUCED.** Hub run for 36 s with the frame loop
live: `I.castleLamps` holds **4 lamps, 0 with a missing material**, all `MeshBasicMaterial`,
`G.letters.every` present, and **zero page errors** (the two console lines are a connection reset and
the Google Fonts 404 the sandbox always shows). The suggested cause is also wrong on its face: commit
`ab362f2` changed two lines, both `loadProxy`, nothing near castle or hub meshes. No guard added — a
defensive `if(l.material && l.material.color)` around a line that does not throw would hide the next
real fault here.

**2. Camera clipping on Hub and GR — CONFIRMED, cause not as described.** The arm collapses to its
3.5 floor on strafe, both islands, both directions. It is not new GR content: hub shows it identically
and hub's content is unchanged. I attempted a fix and reverted it. See HANDOFF 4.10 — and note that
**`qa/camera.mjs` cannot A/B a camera change at all** until the world is seeded, because decor is
placed with unseeded `Math.random()` and every load builds a different island.

**3. Every island's lights +2 — CONFIRMED, and both are accounted for.** Baseline in `qa/report.md`
is 4 per island / 16 on Sanity. Now: hub 6, GR 7, Sanity 9. Sanity is a large improvement already
banked. The two additions on every island are `:3096` — the writing desk's candle `PointLight`
(intensity 1.0), which travels with the desk that appears on every island — and `:942` — her own
lantern, held at intensity 0 until she earns it and raised to 1.6 at `:5002`. GR's seventh is `:4187`,
the volcano ember light. **Neither of the two is avoidable by baking to emissive**: one is a real
gameplay light and the other is already off. The report's own "keep ≤6" target is met on hub and
missed by one on GR.

**4. `lala.glb` at 6.65 MB — TRUE, but not new.** 6,974,652 bytes, mtime 2026-09-10 20:03 — it is the
v2 rebuild, two days before this run, not a change in this window. The compression recommendation
stands on its merits.

**5. `HEAD_EAR` / `HEAD_CROWN` dead — TRUE, and `HEAD_SIDE` with them.** All three unreferenced
anywhere in the file. `HEAD_CROWN`'s own comment claimed it was "kept so the physics clamp below still
reads in the old names"; the clamp no longer uses it, so the comment was stale too. All three removed,
the measured constants they were derived from (`HEAD_HALF_X`, `HEAD_HALF_Z`, `HEAD_TOP`) kept.

Scorecard: two of five confirmed as stated, one true but misdated, one true with the right fix
identified, one not reproduced.
