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
# Second patch: r163+ ignores a material's own envMapIntensity when the scene supplies the environment
# (scene.environmentIntensity wins, 1.0). r128 used each material's value, and Lambert/Phong took no scene environment
# at all. With window.__THREE_ENV_MAT true the r128 rule applies.
k=$(grep -c "m_uniforms.envMapIntensity.value = scene.environmentIntensity;" "$F" || true)
[ "$k" = 1 ] || { echo "env patch site not found ($k)"; exit 1; }
sed -i 's/m_uniforms.envMapIntensity.value = scene.environmentIntensity;/m_uniforms.envMapIntensity.value = globalThis.__THREE_ENV_MAT === true ? ( material.isMeshStandardMaterial ? material.envMapIntensity : 0 ) : scene.environmentIntensity;/' "$F"
# Third patch: r138+ gives every texture's inner Source object its own UUID, which draws four Math.random() values that
# r128 never drew. The islands are scattered from a seeded Math.random stream, so those extra draws moved every tree,
# umbrella and horse. The Source UUID is made from its own counter instead, so r187 draws exactly what r128 drew.
C="$W/package/build/three.core.js"
perl -0pi -e 's/(Object\.defineProperty\( this, .id., \{ value: _sourceId \+\+ \} \);(?:(?!this\.uuid)[\s\S])*?)this\.uuid = generateUUID\(\);/$1this.uuid = "5c0e0000-0000-4000-8000-" + ( "000000000000" + this.id.toString( 16 ) ).slice( -12 );/' "$C"
grep -q '5c0e0000-0000-4000-8000-' "$C" || { echo "source uuid patch not applied"; exit 1; }
# Fourth patch: r151+ culls an InstancedMesh / SkinnedMesh by its own cached bounding sphere (all instances, or the
# posed skeleton); r128 used the geometry's sphere with the object matrix. With window.__THREE_LEGACY_CULL true the r128
# test is used, so batches the game culls (or deliberately leaves uncullable) behave exactly as before.
j=$(grep -c "		if ( object.boundingSphere !== undefined ) {" "$C" || true)
[ "$j" -ge 1 ] || { echo "cull patch site not found"; exit 1; }
sed -i 's/		if ( object.boundingSphere !== undefined ) {/		if ( object.boundingSphere !== undefined \&\& globalThis.__THREE_LEGACY_CULL !== true ) {/' "$C"
sed "s#'./package/#'$W/package/#g" "$HERE/three187-entry.js" > "$W/entry.js"
npx -y esbuild@0.24.0 "$W/entry.js" --bundle --minify --format=iife --target=es2019 --legal-comments=eof --outfile="$HERE/three187.min.js"
rm -rf "$W"
