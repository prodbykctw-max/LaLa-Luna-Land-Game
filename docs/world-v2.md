# World V2 comparison

Based on original commit `9e1bb2b`. `game/index.html` is byte-for-byte preserved.

- Original: `game/index.html`
- V2: `game/v2.html`
- Version picker: `game/compare.html`
- Environment implementation: `game/world-v2.js`

V2 is a deliberately separate snapshot so future V1 edits cannot silently alter this comparison. Both versions reuse the existing models, vendor scripts, music synthesis, story, island definitions, terrain, quest logic, animation, and controls. No automatic redirect or public deployment is changed. Keep this branch separate until the owner chooses.

## Visual changes

All six island builds receive palette-specific animated leaves, flowers, coastal rock scatter, pollen or fireflies, and generated cloud detail. Scatter is deterministic and terrain-sampled, avoids quest anchors, colliders, streams and the desk, and uses instancing. Coarse-pointer devices receive reduced instance counts. Water gets analytic-normal highlights and an approximate sky-colored Fresnel reflection; this is not ray tracing or screen-space reflection. Existing wave displacement and physics are unchanged.

V2 saves to `lala:world-v2:v1`; the original continues using `lala:v4`. V2 starts fresh. Original progress is not migrated or overwritten. Private preview progress is scoped to its own host.

## Image

Built-in image generation created `game/assets/world-v2-sky.jpg`. Prompt: wide 3:1 sky-only panorama with indigo overhead, violet middle, pearlescent lavender/peach horizon, painterly volumetric clouds and subtle stars; no land, water, buildings, characters, text, sun or moon. It is blended into each island's authored sky palette. JPEG conversion reduces transfer size; original generation retained separately by the image tool.

## Validation and limits

- Inline JavaScript and environment module syntax checked with Node.
- Six synthetic island fixtures exercised environment creation, finite instance matrices, shader-patch construction and update calls using the repository's Three.js r128.
- Original entry point compared byte-for-byte with the source commit.
- Script references and V2 save isolation checked.
- Runtime browser/GLSL and actual iPhone performance remain unverified: Playwright browser installation failed (invalid download archive) in this environment. The fixture test is not a full-game playthrough or shader compilation test.

Review on a phone before selecting V2 as the public version. Open each island from the comparison page; check loading, movement, interactions, travel, and return after refreshing. The hidden sixth island remains story-gated in the picker.
