/* Suite 8 — Code-health scan (static).  node qa/codehealth.mjs
   - TODO/FIXME/HACK/XXX markers
   - numeric literals in the camera + movement code (walkerUpdate, cameraCollide, look/joy handlers, goIsland camera)
   - duplicated numeric constants across the file (same literal used ≥4 times outside palettes/cfg)
   - declared-but-unused top-level identifiers (const/let/function declared once, referenced nowhere else)
   - duplicated code fragments (identical lines ≥ 60 chars appearing more than once)
   - console.log / DBG leftovers and empty catch blocks */
import { readFileSync, writeFileSync } from 'fs';
import { ROOT, OUT } from './_harness.mjs';

const src = readFileSync(ROOT + '/index.html', 'utf8'); const lines = src.split('\n');
const script0 = lines.findIndex(l => /<script>/.test(l) && !/src=/.test(l));
const find = (re) => lines.map((l, i) => ({ line: i + 1, text: l.trim().slice(0, 140) })).filter(o => re.test(o.text));
const fnRange = name => { const s = lines.findIndex(l => new RegExp('^function ' + name + '\\b|^const ' + name + ' = ').test(l)); if (s < 0) return null; let e = s + 1; while (e < lines.length && !/^}/.test(lines[e]) && !/^function |^const \w+ = \(/.test(lines[e])) e++; return [s + 1, e + 1]; };

const todo = find(/\b(TODO|FIXME|HACK|XXX|TEMP)\b/);
// magic numbers in camera/movement code
const ranges = { cameraCollide: fnRange('cameraCollide'), walkerUpdate: fnRange('walkerUpdate'), lookHandlers: [lines.findIndex(l => /^let look = /.test(l)) + 1, lines.findIndex(l => /^function lookEnd/.test(l)) + 1], joyHandlers: [lines.findIndex(l => /^let joy = /.test(l)) + 1, lines.findIndex(l => /^function joyEnd/.test(l)) + 3], goIslandCam: [lines.findIndex(l => /^async function goIsland/.test(l)) + 1, lines.findIndex(l => /^async function goIsland/.test(l)) + 8] };
const magic = {};
for (const [k, r] of Object.entries(ranges)) { if (!r) continue; magic[k] = { lines: r, numbers: [] };
  for (let i = r[0]; i <= r[1]; i++) { const l = lines[i - 1]; const code = l.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, ''); const nums = [...code.matchAll(/(?<![\w.])(\d+\.\d+|\.\d+|\d{2,})(?![\w])/g)].map(m => m[1]); if (nums.length) magic[k].numbers.push({ line: i, nums: [...new Set(nums)], text: l.trim().slice(0, 110) }); } }
// duplicated literals across file (excluding palette hex and cfg arrays)
const counts = {}; lines.forEach((l, i) => { if (i < script0) return; if (/pal:|0x[0-9A-F]{6}|notes:|places:|lobes:|features:/.test(l)) return; const code = l.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '');
  for (const m of code.matchAll(/(?<![\w.])(\d*\.\d+|\d{2,})(?![\w])/g)) { const n = m[1]; if (['10', '100', '16', '32', '24', '48', '64', '12', '20', '15', '50', '30', '60'].includes(n)) continue; (counts[n] = counts[n] || []).push(i + 1); } });
const dupLiterals = Object.entries(counts).filter(([, v]) => v.length >= 4).sort((a, b) => b[1].length - a[1].length).slice(0, 25).map(([n, v]) => ({ literal: n, uses: v.length, lines: v.slice(0, 12) }));
// unused top-level identifiers
const js = lines.slice(script0).join('\n');
const decl = [...js.matchAll(/^(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
const declMulti = [...js.matchAll(/^(?:const|let)\s+([^=;]+?)\s*=/gm)].flatMap(m => m[1].split(',').map(s => s.trim().split(/\s|=/)[0]).filter(s => /^[A-Za-z_$][\w$]*$/.test(s)));
const unused = [...new Set([...decl, ...declMulti])].filter(id => { const re = new RegExp('(?<![\\w$.])' + id.replace(/\$/g, '\\$') + '(?![\\w$])', 'g'); const n = (js.match(re) || []).length; return n <= 1; });
// duplicated long lines
const seen = {}; lines.forEach((l, i) => { const t = l.trim(); if (t.length < 60 || /^[\/*]/.test(t)) return; (seen[t] = seen[t] || []).push(i + 1); });
const dupLines = Object.entries(seen).filter(([, v]) => v.length > 1).map(([t, v]) => ({ lines: v, text: t.slice(0, 120) })).slice(0, 20);
const logs = find(/console\.(log|warn)\(|\bDBG\(/), emptyCatch = find(/catch\s*\([^)]*\)\s*\{\s*\}/);
const listeners = find(/addEventListener\(/).length, globals = { keysObj: !!/^const keys = \{\}/m.test(js) };
const stats = { totalLines: lines.length, scriptLines: lines.length - script0, longestLine: Math.max(...lines.map(l => l.length)), linesOver200: lines.filter(l => l.length > 200).length, functions: (js.match(/^(?:async )?function /gm) || []).length, listeners };
const res = { stats, todo, magicNumbers: magic, duplicatedLiterals: dupLiterals, possiblyUnused: unused, duplicatedLines: dupLines, debugLogging: { count: logs.length, sample: logs.slice(0, 8) }, emptyCatch };
writeFileSync(OUT + '/codehealth.json', JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
