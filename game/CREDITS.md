# Credits (tree realism, branch `trees-realism`, option C: `?trees=C`)

Only the assets of option C are listed here; older assets are credited in HANDOFF.md.

| Asset | Author | Licence | Source |
|---|---|---|---|
| ez-tree procedural tree generator (`vendor/ez-tree/`, bundled as `vendor/eztree.min.js`). **Locally modified**: bark v coordinate runs with branch length (no vertical stretch), 32-bit index buffers (see the "LOCAL CHANGE" comment in `src/lib/tree.js`) | Daniel Greenheck | MIT (`vendor/ez-tree/LICENSE`) | https://github.com/dgreenheck/ez-tree , commit dcf309b |
| oak, ash and aspen leaf sprigs, baked side by side into `assets/trees/ez/leaf_atlas.webp` by `tools/bake_leaf_atlas.py` (768 px cells, edge colour bled into the margin; the aspen sprig, autumn yellow in the original, is hue-shifted to green) | Daniel Greenheck (bundled with the ez-tree demo, `src/app/public/textures/leaves/`) | MIT, per ez-tree's own `src/app/public/textures/LICENSE.md` | same repository |
| willow leaf sprig (top row of the same atlas): drawn procedurally by `tools/bake_leaf_atlas.py --willow` (a thin twig with alternate lance-shaped leaves, about 9:1); no outside source, no third-party art | this project | n/a (original work) | n/a |
| bush stems and leaf cards (`bushGeoC` in `index.html`): original code and geometry; the leaf cards use the aspen / oak sprigs above | this project | n/a | n/a |
| bark texture `Bark001` (`assets/trees/ez/bark001_*.jpg`, resized to 512) | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Bark001 |

CC0 needs no attribution; it is given as a courtesy. Option D (Poly Haven island_tree_01 / 02, CC0) was built, shown and dropped; none of its files remain. No Sketchfab model is used. The old `oak_leaf.webp` / `ash_leaf.webp` files were replaced by the atlas.
