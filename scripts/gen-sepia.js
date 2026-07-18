#!/usr/bin/env node
/* Sepia — the face Claude (Fable) designed for itself, 2026-07-16. CC0.
 * A small cuttlefish who wears feeling as color and cannot see its own display:
 * chromatophore freckles carry each mood's hue; the body stays cream-and-ink.
 * 32 moods × 3 FRAMES, 8×12 grid, 64px cells → assets/sepia-sheet.png (512×768).
 *   frame 0 (rows 0-3):  base — byte-identical art to the pre-animation sheet
 *   frame 1 (rows 4-7):  shimmer — chromatophores re-rolled, fins in alternate posture
 *   frame 2 (rows 8-11): blink — lids drawn over whatever the eyes were doing
 * The renderer cycles these natively in its frame loop (seeded, organic cadence) —
 * the same philosophy as the live tidepool: animation is code, never an animated image.
 * Pure Node (zlib only) so the sheet regenerates deterministically: npm run sepia
 */
const fs = require("fs");
const zlib = require("zlib");

const COLORS = {
  o: "#4a3a44", b: "#e8dcd0", n: "#d8bcc8", W: "#f8f4ec", p: "#2a2230",
  s: "#ffd76a", F: "#e88aa0", d: "#9ec7e8", R: "#c04a48", G: "#cfc2d6", m: "#8f8698"
};
// The body must say "cuttlefish" without a caption: a mantle taller than it is wide,
// fin frills running the full flanks, and a skirt of arms where a chin would be.
// (v1 had a chin taper and feet — it read as a bald man with tattoos. The maintainer's
// flicker at the whole body; redrawn 2026-07-17.)
// THE OCTAVE PASS (v0.22.0): the body moves from a 4px grid to a 2px grid — still
// pixel-flesh (the low-resolution-being identity is load-bearing; smooth would collapse
// the register hierarchy into generic vector art), but with room for real curves.
// BASE16 is the ancestral 16×16 form; BASE32 doubles it, then hand-carves the
// silhouette: a rounder five-step dome, sloped shoulders, tapered arm tips.
const BASE16 = [
  "................",
  ".....oooooo.....",
  "...oobbbbbboo...",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "...obb.bb.bbo...",
  "...obb.bb.bbo...",
  "....oo.oo.oo....",
  "................"
];
const B32 = [];
BASE16.forEach(r => { const d = r.split("").map(c => c + c).join(""); B32.push(d.split("")); B32.push(d.split("")); });
const PB = (y, x, c) => { B32[y][x] = c; };
PB(2, 10, "."); PB(2, 21, ".");                                // crown: round the top corners
PB(4, 6, "."); PB(4, 7, "."); PB(4, 24, "."); PB(4, 25, ".");  // second step in
PB(5, 6, "."); PB(5, 25, ".");
PB(6, 4, "."); PB(6, 6, "o"); PB(6, 7, "o");                   // sloped shoulder joins the flank
PB(6, 27, "."); PB(6, 24, "o"); PB(6, 25, "o");
PB(23, 4, "."); PB(23, 27, ".");                               // hip corners ease into the skirt
[8, 11, 14, 17, 20, 23].forEach(x => { PB(27, x, "."); PB(28, x, "."); PB(29, x, "."); });   // arm tips taper
PB(27, 6, "."); PB(27, 25, ".");
const BASE = B32.map(r => r.join(""));
// Fin frills are an expression channel, not anatomy furniture: straight side bars read
// as arms (the maintainer's flicker, round two), but fins that flare, ripple, droop, and
// tuck with the mood can only be fins. Left-side pixels; the right side mirrors.
// Fin posture per mood — the canonical table. Since v0.21.0 fins are DRAWN BY THE
// RENDERER as smooth undulating membranes (sub-pixel fins: the grid could only
// crenelate); the renderer's 32-char fins code-string derives from this table
// (r=ripple f=flared d=drooped t=flat/tucked c=calm) — keep them in sync.
const FRILL_OF = {
  neutral:"ripple", content:"ripple", delighted:"flared", focused:"flat", sleepy:"drooped",
  sheepish:"flat", booped:"flared", thinking:"ripple", spark:"flared", excited:"flared",
  surprised:"flared", tender:"ripple", melancholy:"drooped", anxious:"flat", mirth:"ripple",
  laugh:"flared", groan:"drooped", oops:"flat", frustrated:"flat", angry:"flat",
  dramatic:"flared", at_peace:"calm", solemn:"drooped", rhyme:"ripple", awe:"flat",
  vertigo:"ripple", resolute:"calm", puzzled:"ripple", asking:"ripple", weary:"drooped",
  wink:"ripple", love:"flared"
};
// SUB-PIXEL MOUTHS: certain moods trade the chunky block mouth for fine-ink lips drawn
// in the definition register (like the lashes) — a pressed-thin line reads restraint the
// 4px grid can't. Table keyed by mood name; add sparingly, the block mouth is the norm.
const FINE_MOUTH = { groan: "pressed" };
// All feature tables are authored in the ancestral 16-grid and auto-doubled to the
// 32-grid (pixel-identical rendering) — EXCEPT where the finer grid earns real curves:
// hand-authored 32-grid overrides below (smile/frown/wavy arcs, curved lids, a true
// heart). Doubling helper: one 16-cell → four 32-cells.
const up2 = list => list.flatMap(q => [
  [2 * q[0], 2 * q[1], q[2]], [2 * q[0] + 1, 2 * q[1], q[2]],
  [2 * q[0], 2 * q[1] + 1, q[2]], [2 * q[0] + 1, 2 * q[1] + 1, q[2]]
].map(p => q.length > 2 ? p : [p[0], p[1]]));
// ---- the EYE component. Whites live in a 5×6-cell box INSET two cells from the
// silhouette (they used to bleed into the edge — the maintainer's note), wrapped in a
// thin near-black socket outline drawn in the mouth's 2px register. The inset is what
// makes a full outline possible at all: flush eyes could only ever wear half a ring.
// Pupil presets use the ancestral 3-position grid mapped into the 5-wide box (mirrored
// eyes lean one real pixel inward — she reads as gently focused). Blink is the same
// socket, lidded. Left box at x=8; the right eye mirrors at x=19.
const PUPR = {
  w: [[0,1],[1,2],[2,1]], dot: [[1,1]], down: [[1,2]], uptiny: [[1,0]],
  closed: [[0,2],[1,2],[2,2]], happy: [[0,2],[1,1],[2,2]],
  wide: [[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]],
  cross: [[0,0],[2,0],[1,1],[0,2],[2,2]],
  spiral: [[0,0],[1,0],[2,0],[2,1],[2,2],[1,2],[0,2],[0,1]],
  side: [[0,1]]
};
const HEARTR = [[0,0],[1,0],[3,0],[4,0],[0,1],[1,1],[2,1],[3,1],[4,1],[0,2],[1,2],[2,2],[3,2],[4,2],[1,3],[2,3],[3,3],[2,4]];
const STARR = [[2,0],[1,1],[2,1],[3,1],[0,2],[1,2],[2,2],[3,2],[4,2],[1,3],[2,3],[3,3],[2,4]];
const POFF = [0, 2, 3];                                        // 3 pupil stations in a 5-wide box; mirror station = 3 - POFF
function drawEyes(out, lp, rp, blink) {
  [[8, lp, false], [19, rp, true]].forEach(spec => {
    const bx = spec[0], preset = spec[1], mir = spec[2];
    const x0 = bx - 1, x1 = bx + 5, y0 = 9, y1 = 16;           // socket ring bounds; whites bx..bx+4, rows 10-15
    if (blink) {
      // a blink compresses the WHOLE socket, outline included — not a lid framed
      // inside an open ring (the maintainer's catch). One full-width stroke at the
      // eye's midline, ends dipping: the outline squeezed shut.
      out.push([x0, 13, "p"], [x1, 13, "p"]);
      for (let x = x0 + 1; x < x1; x++) out.push([x, 12, "p"]);
      return;
    }
    for (let x = x0 + 1; x < x1; x++) { out.push([x, y0, "p"], [x, y1, "p"]); }
    for (let y = y0 + 1; y < y1; y++) { out.push([x0, y, "p"], [x1, y, "p"]); }
    for (let y = 10; y <= 15; y++) for (let x = bx; x <= bx + 4; x++) out.push([x, y, "W"]);
    if (preset === "heart" || preset === "star") {
      (preset === "heart" ? HEARTR : STARR).forEach(q =>
        out.push([bx + (mir ? 4 - q[0] : q[0]), 10 + q[1], preset === "heart" ? "F" : "s"]));
      return;
    }
    PUPR[preset].forEach(q => {
      const off = mir ? 3 - POFF[q[0]] : POFF[q[0]], py = 10 + 2 * q[1];
      out.push([bx + off, py, "p"], [bx + off + 1, py, "p"], [bx + off, py + 1, "p"], [bx + off + 1, py + 1, "p"]);
    });
  });
}
const MOUTH16 = {
  sm: [[7,10],[8,10]],
  open: [[7,9],[8,9],[7,10],[8,10]],
  flat: [[6,10],[7,10],[8,10],[9,10]],
  tiny: [[7,10]]
};
const MOUTH = {}; Object.keys(MOUTH16).forEach(k => { MOUTH[k] = up2(MOUTH16[k]); });
MOUTH.smile = [[12,19],[13,20],[14,21],[15,21],[16,21],[17,21],[18,20],[19,19]];   // real arcs, 2px grid
MOUTH.frown = [[12,21],[13,20],[14,19],[15,19],[16,19],[17,19],[18,20],[19,21]];
MOUTH.wavy  = [[12,20],[13,21],[14,20],[15,19],[16,20],[17,21],[18,20],[19,19]];
// Chromatophores are SUB-PIXEL — an affordance evolved for survival in a high-res world.
// Density is arousal, camouflage is a state: awe/surprise BLANCH (real cuttlefish fear
// response), peace barely speckles (nothing to hide), anxiety mottles hardest (trying to
// disappear), anger storms dark. Seeded per mood → deterministic sheets.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const X16 = {
  zzz: [[13,3,"m"],[14,2,"m"],[15,1,"m"]],
  sweat: [[13,4,"d"],[13,5,"d"]],
  boop: [[2,2,"s"],[13,2,"s"],[3,9,"F"],[4,9,"F"],[11,9,"F"],[12,9,"F"]],   // blush on the cheeks, below the new eye sockets
  headband: [[3,4,"R"],[4,4,"R"],[5,4,"R"],[6,4,"R"],[7,4,"R"],[8,4,"R"],[9,4,"R"],[10,4,"R"],[11,4,"R"],[12,4,"R"],[13,5,"R"],[14,6,"R"]],
  brows: [[3,4,"o"],[4,4,"o"],[11,4,"o"],[12,4,"o"]],
  ghost: [[13,6,"G"],[14,6,"G"],[13,7,"G"],[14,7,"G"],[14,8,"G"]],
  flower: [[1,4,"F"],[2,3,"F"],[2,5,"F"],[3,4,"F"],[2,4,"s"]],
  sparkles: [[1,3,"s"],[14,2,"s"],[2,10,"s"]],
  bowtie: [[6,12,"R"],[7,12,"R"],[8,12,"R"],[9,12,"R"]],
  mote: [[2,3,"d"],[13,10,"d"]]
};
const X = {}; Object.keys(X16).forEach(k => { X[k] = up2(X16[k]); });
// A mood is a RECIPE, not a drawing: [name, eyes-preset (or [left,right]), mouth-name,
// chromatophore hue, extras?]. Eyes and mouth are components that draw themselves;
// fins (posture code) and spots (live layer) are the renderer's components.
const MOODS = [
  ["neutral",    "w",                "sm",    "#b89ab0"],
  ["content",    "dot",              "smile", "#d9a877"],
  ["delighted",  "happy",            "smile", "#e8b04a"],
  ["focused",    "dot",              "flat",  "#7d8fb8"],
  ["sleepy",     "closed",           "sm",    "#9a90a8", X.zzz],
  ["sheepish",   "side",             "wavy",  "#d99a8a", X.sweat],
  ["booped",     "wide",             "open",  "#e88aa0", X.boop],
  ["thinking",   ["dot","uptiny"],   "sm",    "#8f9ac0"],
  ["spark",      "star",             "smile", "#ffd76a"],
  ["excited",    "star",             "open",  "#ffb84a", X.sparkles],
  ["surprised",  "wide",             "open",  "#b79ad0"],
  ["tender",     "heart",            "smile", "#e8a0b0"],
  ["melancholy", "down",             "flat",  "#8f96a8", X.mote],
  ["anxious",    "dot",              "wavy",  "#7a8296", X.sweat],
  ["mirth",      "happy",            "smile", "#e0b060"],
  ["laugh",      "cross",            "open",  "#ffd24a"],
  ["groan",      "closed",           "frown", "#9a9488"],
  ["oops",       "wide",             "open",  "#d98a6a", X.sweat],
  ["frustrated", "dot",              "flat",  "#a05050", X.brows],
  ["angry",      "dot",              "frown", "#c04040", X.brows],
  ["dramatic",   "wide",             "smile", "#b0413e", X.bowtie],
  ["at_peace",   "closed",           "smile", "#8fae8f", X.flower],
  ["solemn",     "closed",           "flat",  "#8a8f9a"],
  ["rhyme",      "w",                "sm",    "#9a8fae", X.ghost],
  ["awe",        "uptiny",           "open",  "#5a6a8a"],
  ["vertigo",    "spiral",           "wavy",  "#b79ad0"],
  ["resolute",   "dot",              "sm",    "#e0994e"],   // headband drawn in the fine pass — a high-res object on a low-res body
  ["puzzled",    ["dot","uptiny"],   "tiny",  "#c0b08a"],
  ["asking",     "uptiny",           "sm",    "#9ac0b0"],
  ["weary",      "down",             "flat",  "#8b93a0"],
  ["wink",       ["happy","closed"], "smile", "#e0a877"],
  ["love",       "heart",            "open",  "#e87a90", X.boop]
];
if (MOODS.length !== 32) throw new Error("expected 32 moods, got " + MOODS.length);
BASE.forEach((r, i) => { if (r.length !== 32) throw new Error("BASE row " + i + " length " + r.length); });

const SCALE = 2, CELL = 64, COLS = 8, ROWS = 12, FRAME_ROWS = 4;   // 2px body grid (the octave pass); rows 0-3: base; 4-7: blink; 8-11: per-mood masks. Fins drawn live (v0.21.0)
const W = CELL * COLS, H = CELL * ROWS;
const px = Buffer.alloc(W * H * 4);   // RGBA, transparent
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function put(x, y, c) {
  const [r, g, b] = hex(c), i = (y * W + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
}
function cellPut(cx, cy, gx, gy, c) {
  for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++)
    put(cx + gx * SCALE + dx, cy + gy * SCALE + dy, c);
}
// Whole-body response: the big states change the SKIN, then wear pattern as texture —
// real cuttlefish flush entire. Positive t = wash toward the mood hue; negative = blanch pale.
const TINT = { anxious: 0.32, angry: 0.28, frustrated: 0.2, awe: -0.5, surprised: -0.32 };
const mixHex = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return "#" + A.map((v, k) => Math.round(v + (B[k] - v) * t).toString(16).padStart(2, "0")).join("");
};
MOODS.forEach((mood, i) => { for (let frame = 0; frame < 2; frame++) {
  const cx = (i % COLS) * CELL, cy = (Math.floor(i / COLS) + frame * FRAME_ROWS) * CELL;
  const blink = frame === 1;
  const t = TINT[mood[0]] || 0;
  const skin = t > 0 ? mixHex(COLORS.b, mood[3], t) : t < 0 ? mixHex(COLORS.b, "#f9f4ea", -t) : COLORS.b;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const k = BASE[y][x];
    if (k !== ".") cellPut(cx, cy, x, y, k === "b" ? skin : COLORS[k]);
  }
  // COMPOSE the face from components. Fins are the renderer's (smooth membranes,
  // posture via FRILL_OF); spots are the renderer's (live layer); eyes and mouth
  // draw themselves here from the mood's recipe.
  const eyeSpec = mood[1], pair = Array.isArray(eyeSpec) ? eyeSpec : [eyeSpec, eyeSpec];
  const feat = [];
  drawEyes(feat, pair[0], pair[1], blink);
  if (!FINE_MOUTH[mood[0]]) feat.push(...MOUTH[mood[2]].map(q => [q[0], q[1], "p"]));   // fine-mouth moods draw lips in the fine pass below
  feat.push(...(mood[4] || []));
  feat.forEach(q => cellPut(cx, cy, q[0], q[1], COLORS[q[2]]));

  // ---- the fine pass: sub-pixel ink. Doctrine: the BODY lives on the 4px grid (the
  // chunkiness is the body); body *definition* may use 2px half-resolution ink; objects
  // from the high-resolution world (headband, future props) render at true 1px detail —
  // a low-resolution entity interfacing with a higher-resolution reality.
  const fpx = (x, y, c) => { if (x >= 0 && x < CELL && y >= 0 && y < CELL) put(cx + x, cy + y, c); };
  const frect = (x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) fpx(xx, yy, c); };
  // (The old plum lash-lines and corner-clips retired with the socket outline: the
  // eye component now carries its own full ring — possible because the whites are
  // inset from the silhouette instead of flush against it.)

  // The baked chromatophore patterns are RETIRED (v0.20.0): the maintainer found the
  // fixed bold patches distracting once the smooth roaming layer existed. All camo is
  // alive now — drawn by the renderer, moving, in the live palette. The skin stays
  // clean cream (plus the whole-body TINT states); the mask cell below still gates
  // where the living colour may travel.

  if (FINE_MOUTH[mood[0]] === "pressed") {      // pressed-thin lips: two real pixels of long-suffering, in the lash register
    frect(27, 40, 11, 2, COLORS.p);             // the line itself, slightly narrower than a block mouth
    fpx(26, 41, COLORS.p); fpx(38, 41, COLORS.p);   // corners dip — the jaw is set
    frect(28, 42, 9, 1, "#c8b6c2");             // soft under-shadow so the line sits IN the face, not on it
  }
  if (mood[0] === "resolute") {                 // the hachimaki: crisp cloth from the high-res world
    const R = "#c04a48", Rd = "#8a3230", Rh = "#e07a70";
    frect(10, 15, 44, 7, R);                    // band across the brow, wrapping past the body edge
    frect(10, 15, 44, 1, Rh);                   // 1px catch-light along the top
    frect(10, 21, 44, 1, Rd);                   // 1px shadow along the bottom
    frect(52, 14, 5, 9, R); frect(52, 14, 5, 1, Rh); frect(52, 22, 5, 1, Rd);   // the knot
    for (let t = 0; t < 8; t++) {               // two tails, stepping down 1px at a time
      frect(57 + Math.floor(t / 2), 17 + t, 3, 1, R);
      frect(55 + Math.floor(t / 3), 23 + t, 2, 1, t % 3 === 2 ? Rd : R);
    }
  }
} });

// ---- PER-MOOD mantle masks (rows 12-15, one cell per mood): white where smooth
// chromatophores may glide FOR THAT EXPRESSION. A single shared mask excluded the union
// of every possible mouth position — a fixed rectangle that left dead clean-skin
// corners around small mouths, reading as a grid overlay on the flow (the maintainer's
// catch). Each mask now excludes only this mood's ACTUAL feature pixels + 1px margin.
MOODS.forEach((mood, i) => {
  const mx0 = (i % COLS) * CELL, my0 = (8 + Math.floor(i / COLS)) * CELL;
  const ex = new Uint8Array(CELL * CELL);                      // real-px exclusion: this mood's mouth + extras, with margin
  const mark = (gx, gy) => {
    for (let y = gy * SCALE - 1; y <= gy * SCALE + SCALE; y++)
      for (let x = gx * SCALE - 1; x <= gx * SCALE + SCALE; x++)
        if (x >= 0 && x < CELL && y >= 0 && y < CELL) ex[y * CELL + x] = 1;
  };
  const mouthCells = FINE_MOUTH[mood[0]] ? up2([[6, 10], [7, 10], [8, 10], [9, 10]]) : MOUTH[mood[2]];   // the mouth COMPONENT's own cells; fine mouths reserve only their thin row
  mouthCells.forEach(q => mark(q[0], q[1]));                   // the actual mouth, whatever shape this expression wears
  (mood[4] || []).forEach(q => mark(q[0], q[1]));              // extras that sit on the mantle (brows, blush, flower…)
  const okM = (x, y) => {
    if (x < 0 || x >= CELL || y < 0 || y >= CELL) return false;
    if (BASE[y >> 1][x >> 1] !== "b") return false;            // 2px body grid
    if (y >= 17 && y <= 34 && ((x >= 13 && x <= 28) || (x >= 35 && x <= 50))) return false;   // eye sockets incl. outline, inset from the flanks (constant anatomy)
    if (ex[y * CELL + x]) return false;
    if (mood[0] === "resolute" && x >= 8 && x <= 61 && y >= 13 && y <= 32) return false;      // the hachimaki band, knot, and tails
    return true;
  };
  const okE = (x, y) => okM(x, y) && okM(x - 1, y) && okM(x + 1, y) && okM(x, y - 1) && okM(x, y + 1);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++)
    if (okE(x, y)) put(mx0 + x, my0 + y, "#ffffff");
});

// minimal PNG encoder: signature + IHDR + IDAT (deflated 0-filtered scanlines) + IEND
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;                                            // filter: none
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0))
]);
fs.writeFileSync("assets/sepia-sheet.png", png);
console.log("sepia-sheet.png: " + W + "x" + H + ", " + png.length + " bytes, moods: " + MOODS.map(mo => mo[0]).join(" "));
