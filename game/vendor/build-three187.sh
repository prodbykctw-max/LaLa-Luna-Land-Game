#!/bin/sh
# Rebuild vendor/three187.min.js: Three.js r187 + the add-ons the game uses, as one classic script that sets window.THREE.
# One engine patch: when window.__THREE_TONEMAP_RT is true, materials are tone-mapped into render targets too (r128's
# behaviour; r153+ only tone-maps the final draw to the screen). The game renders through an EffectComposer, so without
# it the bloom and the colour grade would see un-tone-mapped light.
set -e
V=0.187.0; W=$(mktemp -d); HERE=$(cd "$(dirname "$0")" && pwd)
( cd "$W" && npm pack "three@$V" -q >/dev/null && tar xzf "three-$V.tgz" )
F="$W/package/build/three.module.js"
n=$(grep -c "currentRenderTarget === null || currentRenderTarget.isXRRenderTarget === true ) {" "$F" || true)
m=$(grep -c "_currentRenderTarget === null || _currentRenderTarget.isXRRenderTarget === true ) {" "$F" || true)
[ "$n" = 1 ] && [ "$m" = 1 ] || { echo "tone-map patch site not found ($n/$m)"; exit 1; }
sed -i 's/if ( currentRenderTarget === null || currentRenderTarget.isXRRenderTarget === true ) {/if ( globalThis.__THREE_TONEMAP_RT === true || currentRenderTarget === null || currentRenderTarget.isXRRenderTarget === true ) {/; s/if ( _currentRenderTarget === null || _currentRenderTarget.isXRRenderTarget === true ) {/if ( globalThis.__THREE_TONEMAP_RT === true || _currentRenderTarget === null || _currentRenderTarget.isXRRenderTarget === true ) {/' "$F"
sed "s#'./package/#'$W/package/#g" "$HERE/three187-entry.js" > "$W/entry.js"
npx -y esbuild@0.24.0 "$W/entry.js" --bundle --minify --format=iife --target=es2019 --legal-comments=eof --outfile="$HERE/three187.min.js"
rm -rf "$W"
