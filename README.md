# Lala Luna Land

A browser-based 3D fan world built around Lala Luna's EP *4 Letters*. Cel-shaded
Three.js, single HTML files, no build step, no dependencies beyond a CDN script tag.

## Play it

Open `game/index.html` in any browser — double-click the file, or serve the
folder locally:

```
cd game
python3 -m http.server 8000
```

then visit `http://localhost:8000`. No install, no npm, no build.

## What's here

- **`game/index.html`** — the current build. Home Island hub with a locked
  castle, four walkable song-islands (Green, Good Riddance, Sanity, Town
  Square), one outfit-gated letter per island, and the castle finale.
- **`archive/`** — every earlier prototype, kept in order, in case a piece of
  an old build (the endless-runner mechanics, the standalone pitch site) is
  useful again.
- **`docs/reference-scan.md`** — the design analysis of the three reference
  games Lala sent (Infinity Nikki, Moonlight Peaks, Teddy's Haven), and how
  they shaped the current design.

## Design summary

- **Engine:** one data-driven island builder. Each island is a config object
  — palette, coastline, terrain, weather, creatures, outfit, letter gate,
  notes. Adding an island for a new single means adding a config block, not
  rebuilding the game.
- **Core loop:** walk, read lore notes, find the island's outfit piece, use
  the ability it grants to reach the letter. No fail state, no combat —
  built to match the cozy-exploration tone of the references, not the
  original endless-runner concept.
- **Progress:** saved via the artifact storage API (letters, outfits found,
  notes read, moons collected) so it persists across sessions.
- **Audio:** fully synthesized in-browser (Web Audio API) — surf, wind,
  rain, footsteps, birdsong, thunder, chimes. No audio files to host.

## Status

Green, Good Riddance, Sanity, and Town Square are all built and walkable.
The castle finale (bubble pop → fifth song) is functional. Known rough
edges: islands are still light on incidental things to do beyond the core
loop, and only one weather-and-terrain pass has been done per island.

## Roadmap

- Real character/creature models in place of primitive geometry
- More incidental collectibles and small interactions per island
- Second pass on terrain variety (coves, caves, hidden paths)
- Mobile performance pass once art density increases
