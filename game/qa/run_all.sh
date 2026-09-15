#!/bin/bash
# Runs every QA suite sequentially (parallel SwiftShader browsers starve each other). ~35 min.
# Run from anywhere: everything resolves off this script's own folder.
cd "$(dirname "$0")/.."

# NOTE: this script used to sed its own window.__T hook into index_test.html here. That hook was a
# much smaller one written before qa/_harness.mjs existed — no tryJump, canStand, hatPhysics,
# PROXIES, RIGS. And because ensureTestBuild() only regenerates when index.html is NEWER than
# index_test.html, writing it here made every suite below run against the stale hook instead of the
# real one. The harness owns the test build. Do not re-add it.

mkdir -p qa/out
# The visual suites (vgeo, vaudit, vmat, vcheck) were never in this list. vgeo is the one that
# measures whether an object is sitting ON the ground, and it is the suite that would have caught
# Luna's Keep sitting 30 u inside its own hill — the island's namesake landmark, invisible, with
# its door still firing an interact prompt. It existed for days and nothing ran it.
# A check nobody runs is not a check.
for s in determinism codehealth console_load assets reach traversal camera framebudget mobile float overhead scale vgeo vcheck vmat vaudit; do
  [ -f "qa/$s.mjs" ] || { echo "== $s  (missing, skipped)"; continue; }
  echo "== $s"; timeout 1800 node qa/$s.mjs > qa/out/$s.out 2> qa/out/$s.log; tail -5 qa/out/$s.log
done
