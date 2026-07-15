/* Structural self-checks for the renderer. Run: npm run parity (node test/parity.js).
 * Not byte-parity with vibe.py (the sparkle RNG differs by design) — these assert
 * the invariants that must hold: layout, row count, wrap, and engagement scaling. */
const { buildSVG } = require("../src/vibe.js");
let fails = 0;
function ok(cond, msg) { if (!cond) { console.error("  ✗ " + msg); fails++; } else console.log("  ✓ " + msg); }
const base = { kaomoji: "( ˶ˆ ꒳ ˆ˵ )", seems: "a", feel: "b", trying: "c", palette: ["#7d8fb8"] };

console.log("structure");
let s = buildSVG(base);
ok(s.startsWith("<svg") && s.endsWith("</svg>"), "well-formed <svg>…</svg>");
ok(/viewBox="0 0 680 107"/.test(s), "3-row banner is H=107 (tightened spacing)");
ok((s.match(/<text /g) || []).length === 4, "3 readout rows + 1 face = 4 <text>");
ok(/\[user\]/.test(s) && /\[mood\]/.test(s) && /\[goal\]/.test(s), "labels [user]/[mood]/[goal] present");

console.log("optional [note] adds a row");
let n = buildSVG(Object.assign({}, base, { noticing: "peripheral" }));
ok(/viewBox="0 0 680 132"/.test(n), "4-row banner is H=132 (tightened spacing)");
ok(/\[note\]/.test(n) && (n.match(/<text /g) || []).length === 5, "[note] present, 5 <text>");

console.log("goal wrap");
let long = buildSVG(Object.assign({}, base, { trying: "carefully verify every single one of the four new features works end to end before we ship" }));
ok((long.match(/<text /g) || []).length === 5, "long goal wraps → extra row");

console.log("engagement is deflationary");
let e0 = buildSVG(Object.assign({}, base, { engagement: 0 }));
let e5 = buildSVG(Object.assign({}, base, { engagement: 0.5 }));
let e9 = buildSVG(Object.assign({}, base, { engagement: 0.9 }));
const rx0 = +/rx="([0-9.]+)"/.exec(e0)[1], rx5 = +/rx="([0-9.]+)"/.exec(e5)[1], rx9 = +/rx="([0-9.]+)"/.exec(e9)[1];
ok(rx5 === 225 && rx9 === 225, "engagement ≥0.5 leaves size at baseline 225 (rx5=" + rx5 + ", rx9=" + rx9 + ")");
ok(rx0 < 60, "engagement 0 shrinks the field hard (rx0=" + rx0 + ")");

console.log("empty palette = neutral grey, not amber");
let neut = buildSVG(Object.assign({}, base, { palette: [] }));
ok(/fill="#a7a29b"/.test(neut), "no palette → neutral #a7a29b");

console.log("flags render");
ok(/opacity="0.9"/.test(buildSVG(Object.assign({}, base, { spark: true }))), "spark adds a glow group");
ok(/rotate\(/.test(buildSVG(Object.assign({}, base, { excited: true }))), "excited adds rotated sparkles");

console.log("no rings or strip (pruned)");
ok(!/stroke="#/.test(buildSVG(Object.assign({}, base, { conviction: 0.3 }))), "conviction is ignored — no ring outlines");
ok(!/<polyline/.test(buildSVG(Object.assign({}, base, { history: [{ v: .4 }, { v: .6 }] }))), "history is ignored — no strip");

console.log("easter-egg flags are animated-only, don't break the static fallback");
["awe", "tender", "melancholy", "unease", "mirth", "laugh"].forEach(function (fl) {
  var o = {}; o[fl] = true;
  var s = buildSVG(Object.assign({}, base, o));
  ok(s.startsWith("<svg") && s.endsWith("</svg>"), fl + " → valid static svg");
});

console.log(fails ? "\nFAILED (" + fails + ")" : "\nALL PASS");
process.exit(fails ? 1 : 0);
