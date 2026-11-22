#!/bin/sh
# Rebuild vendor/eztree.min.js from vendor/ez-tree (ez-tree by Daniel Greenheck, MIT, commit dcf309b).
# Needs esbuild. `three` is aliased to the game's global THREE, so the bundle is only ez-tree's own generator.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
esbuild "$HERE/ez-tree/entry.js" --bundle --minify --format=iife --alias:three="$HERE/ez-tree/three-shim.js" --loader:.json=json --outfile="$HERE/eztree.min.js" --log-level=warning
ls -l "$HERE/eztree.min.js"
