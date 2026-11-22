/* Entry for vendor/eztree.min.js: ez-tree's generator (Tree, presets) as one classic script that sets window.EZTREE.
   Build: sh vendor/build-eztree.sh. three is NOT bundled: three-shim.js hands it the game's own window.THREE. */
import { Tree } from './src/lib/tree';
import { TreePreset } from './src/lib/presets/index';
import { Billboard, TreeType } from './src/lib/enums';
window.EZTREE = { Tree, TreePreset, Billboard, TreeType };
