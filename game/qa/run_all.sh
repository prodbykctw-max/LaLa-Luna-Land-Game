#!/bin/bash
# Runs every QA suite sequentially (parallel SwiftShader browsers starve each other). ~35 min.
cd "$(dirname "$0")/.."
sed 's|^})();$|window.__T = {ISL, goIsland, nearest, get CUR(){return CUR;}, G, camera, toon, TEX, renderer, composer, present, GRAD, canStand, sRider, sBoat};\n})();|' index.html > index_test.html
for s in codehealth console_load assets reach traversal camera framebudget mobile; do
  echo "== $s"; timeout 1500 node qa/$s.mjs > qa/out/$s.out 2> qa/out/$s.log; tail -5 qa/out/$s.log
done
