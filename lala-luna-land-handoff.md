# Lala Luna Land — Repo Handoff

Context for picking up this project and pushing changes on the user's behalf.

## Repo

- **GitHub:** https://github.com/prodbykctw-max/LaLa-Luna-Land-Game
- **Local path (Windows desktop):** `C:\Users\Owner\documents\LaLa-Luna-Land-Game`
- **Default branch:** `main`
- **Remote name:** `origin`
- **Status as of last push:** clean, `main` pushed and tracking `origin/main`, no pending changes.

## What the project is

A browser-based 3D fan world for the artist Lala Luna, built around her EP
*4 Letters*. Cel-shaded Three.js, single self-contained HTML files, no build
step, no npm dependencies beyond a CDN script tag for Three.js r128.

## Repo structure

```
LaLa-Luna-Land-Game/
├── README.md              — project overview, how to run
├── .gitignore
├── game/
│   └── index.html         — current full build (play this one)
├── archive/                — five earlier prototypes, in build order
│   ├── 01-runner-prototype.html
│   ├── 02-pitch-site.html
│   ├── 03-home-island-only.html
│   ├── 04-merged-runner-app.html
│   └── 05-exploration-no-runner.html
└── docs/
    └── reference-scan.md  — design analysis of reference games
                              (Infinity Nikki, Moonlight Peaks, Teddy's Haven)
                              that shaped the current design direction
```

`game/index.html` is the only file that matters for playtesting — it's the
current, complete build. Everything in `archive/` is historical and should
generally be left alone unless the user asks to revisit an older mechanic.

## How to run it

No build step. Either:
- Open `game/index.html` directly in a browser, or
- Serve it locally: `cd game && python3 -m http.server 8000`, then visit
  `http://localhost:8000`

## Git workflow for this repo

Standard pull → work → push. Nothing unusual about this repo's setup.

```powershell
git pull
# ...make changes...
git add -A
git commit -m "describe what changed"
git push
```

The user also works from this repo on desktop via PowerShell directly, so
whichever side pushes last should pull first to avoid divergent history.

## Design summary (for context on any changes)

- **Engine:** one data-driven island builder in `game/index.html`. Each
  island (Green, Good Riddance, Sanity, Town Square, plus the Home Island
  hub) is defined as a config object — palette, coastline, terrain,
  weather, creatures, outfit, letter-gate mechanic, notes/lore text. Adding
  a new island means adding a config block, not rebuilding the engine.
- **Core loop:** walk, read lore notes, find the island's outfit piece, use
  the traversal ability it grants (glide, higher jump, see hidden stepping
  stones, open a gate) to reach that island's hidden letter. Four letters
  spell LUNA and unlock the castle on the Home Island, which leads to a
  bubble-pop finale scene.
- **No fail state, no combat** — this was a deliberate pivot after
  reviewing the reference games the artist provided (see
  `docs/reference-scan.md`); the original concept was an endless runner and
  was reworked into pure exploration to match the references' tone.
- **Progress persistence:** uses the Claude Artifacts `window.storage` API
  (letters found, outfits unlocked, notes read, moons collected). This is
  specific to running as a Claude artifact — if this ever gets deployed
  outside that environment (e.g. plain GitHub Pages), this storage call
  will silently fail and progress just won't persist. Worth flagging to the
  user if that migration ever comes up.
- **Audio:** fully synthesized in-browser via Web Audio API — no audio
  asset files exist or are referenced anywhere in the repo.

## Known open items

- Islands are functionally complete but light on incidental
  things-to-do beyond the core find-outfit-find-letter loop.
- Only one terrain/weather pass has been done per island — no caves,
  coves, or secondary hidden paths yet.
- Primitive Three.js geometry throughout (cones, boxes, spheres) rather
  than real modeled/rigged characters or creatures.
- No mobile performance pass has been done; likely fine now given low
  geometry count, but will need attention if art density increases.
