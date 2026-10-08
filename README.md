# Lala Luna Land

A browser-based 3D fan world built around Lala Luna's EP *4 Letters*. It uses cel-shaded
Three.js (r128) and runs as one HTML file with no build step and no npm dependencies. Three.js
and its add-ons are vendored in `game/vendor/`, and the characters and creatures are `.glb` models
in `game/assets/`.

Live: https://prodbykctw-max.github.io/LaLa-Luna-Land-Game/ (the root page redirects to
`game/index.html`)

## Play it

Serve the `game` folder locally:

```
cd game
python3 -m http.server 8000
```

then visit `http://localhost:8000`. No install, no npm, no build.

Serving over HTTP matters because the game loads its `.glb` models with network requests. If a
model fails to load, the game falls back to a simpler figure.

### Controls

- **Keyboard and mouse:** WASD or the arrow keys to walk, Space to jump (hold it to glide once you
  have the fans), E to interact, Q/E to turn the camera, R/F to tilt it, C to recenter it. Drag the
  mouse to look and use the wheel to zoom.
- **Touch:** an on-screen stick to move, a second stick for the camera, plus Jump, Interact and
  camera-recenter buttons.
- **Top buttons:** Sound on/off, Secrets (what you've found, plus "Start over"), and Travel (go
  back to an island you've already visited).

## How the game plays

1. **Home Island (Luna's Keep).** The keep is locked until you have all four letters, L-U-N-A. You
   can read notes on the grounds, then take the boat from the dock.
2. **Four song-islands:** Green, Good Riddance, Sanity and Town Square. Each one has:
   - **An outfit piece that gives you an ability:** her fans on Green (glide), her boots on Good
     Riddance (a much higher jump), her lantern on Sanity (reveals stepping stones), and her crown
     on Town Square (opens the gate on the east road).
   - **A letter quest:** find her pen and the paper, write the letter at the writing desk, then
     give it to Ollie the postman. The letter counts once he takes it.
   - **Extras:** lore notes, collectible moons, a hidden secret note that changes her outfit, NPCs
     to talk to, and creatures. On Green you can tame and ride a horse by finding a carrot and
     offering it.
3. **The keep finale.** With all four letters the keep opens. Read the red book, pop the 24
   bubbles, then step through the way out. That takes you to a fifth, hidden island called Lala
   Luna Land. Climb Morro do Pico and take the fifth letter for the ending.

There is no fail state and no combat.

## What's here

- **`game/index.html`**: the game, and the only live game file. The build stamp in the
  bottom-right corner comes from the `BUILD` constant.
- **`game/vendor/`**: Three.js r128 with GLTFLoader, SkeletonUtils, and the post-processing passes
  for bloom (EffectComposer, RenderPass, ShaderPass, UnrealBloomPass and their shaders).
- **`game/assets/`**: `.glb` models for Lala, NPCs, fans (full and proxy versions), horse, cow,
  dino and flora.
- **`game/blender/`, `game/tools/`, `blender/`, `tools/`**: Blender/Python and Node scripts used to
  build and repair those assets. These are offline tools, not part of the shipped page.
- **`game/coast.mjs`**: turns real coastlines from Natural Earth into the game's island outlines.
  Each island is shaped after a real one (for example, Green after Cumberland Island, Georgia).
- **`game/qa/`**: headless Playwright audit suites. See `game/qa/README.md`.
- **`game/HANDOFF.md`** and **`lala-luna-land-handoff.md`**: handoff notes for whoever works on
  the project next.
- **`archive/`**: five earlier prototypes, kept in order (runner prototype, pitch site, home
  island only, merged runner app, exploration without the runner).
- **`docs/reference-scan.md`**: the design analysis of the three reference games Lala sent
  (Infinity Nikki, Moonlight Peaks, Teddy's Haven).
- **Root `index.html`, `llms.txt`, `llms-full.txt`, `robots.txt`, `sitemap.xml`**: the redirect
  page and the files for search engines and AI crawlers.

## Design summary

- **Engine:** one data-driven island builder. Each island is a config object in the `ISLANDS`
  list with its palette, terrain features, weather, creatures, NPCs, outfit, ability, letter,
  notes and moons. Adding an island means adding a config block. Each island is built from a
  seeded random generator, so it comes out the same every time.
- **Core loop:** walk, read the lore notes, find the island's outfit piece and use its ability,
  then carry the letter through pen, paper, desk and postman.
- **Progress:** saved to `localStorage` under the key `lala:v4`. When the page runs inside a
  Claude artifact, it also uses `window.storage`. The save holds letters, abilities, notes,
  moons, quest steps, secret outfits and visited islands. "Start over" or `?reset=1` clears it.
- **Audio:** synthesized in the browser with the Web Audio API, with no audio files. That covers
  the ambient sound (surf, wind, rain, footsteps, birdsong, thunder, chimes) and a generated music
  score for each island. `?music=0` turns the music off, and `?music=0.5` or `?music=2` changes
  its volume.

## Deployment

The site is published with GitHub Pages, directly from the repository's files. There is no build
step and no workflow. The root `index.html` redirects to `game/index.html`. GitHub Pages ignores
`_headers` files, so the Content-Security-Policy is set with a meta tag in `game/index.html`. It
allows only this site plus Google Fonts.

## Roadmap

- More incidental collectibles and small interactions per island
- Second pass on terrain variety (coves, caves, hidden paths)
- Mobile performance pass as art density increases
