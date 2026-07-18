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
  s: "#ffd76a", F: "#e88aa0", d: "#9ec7e8", R: "#c04a48", G: "#cfc2d6", m: "#8f8698",
  A: "#a5761f",                                                // dark amber — RULE: no yellow pupils; anything in the eye must read against the whites
  e: "#6f9a5f", E: "#476b3d"                                   // theatre-mask green, lit and shaded
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
// THE MANTLE PROFILE (v0.26.0): the square is gone. The body is defined by a per-row
// width profile — rounded crown, widest through the eye band, then a long fluid taper
// that lands flush on the arm cluster. PROFILE[row] = leftmost column (right mirrors);
// null = no body. The hem's bottom edge stays open for the renderer-drawn arms.
// THE DART AND THE BROW (v0.28.0, the maintainer's read): a cuttlefish head scans
// POINTY — the mantle tip is the point, at the top, widening in a long dart line down
// into the eye region, where the BROW bulges out beyond the dart to hold the eyes;
// then a quick tuck beneath them into the arm skirt. The flare was upside down.
const PROFILE = [
  null,
  15, 14, 13, 12, 11, 10, 9,                                   // rows 1-7: the DART — a sharp tip, one long widening line
  7, 5,                                                        // rows 8-9: accelerating into the brow
  4, 3, 3, 3, 3, 4,                                            // rows 10-15: the BROW — a bulge past the dart line, holding the eyes
  5, 6, 7,                                                     // rows 16-18: the tuck beneath them
  8, 8, 9, 9, 9, 10,                                           // rows 19-24: the under-body easing in
  10                                                           // row 25: the narrow hem — the arms take over
];
const BASE = [];
for (let y = 0; y < 32; y++) {
  let row = "";
  for (let x = 0; x < 32; x++) {
    const Lc = PROFILE[y];
    row += (Lc != null && x >= Lc && x <= 31 - Lc) ? "b" : ".";
  }
  BASE.push(row);
}
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
const FINE_MOUTH = { groan: "pressed", resolute: "tight", angry: "seethe" };   // tight: the set jaw; seethe: a small line angled down — fury held behind the lips
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
    if (preset === "slit") {                                   // groan: eyes narrowed to flat suffering slits — one thick bar, no ring, no whites
      for (let y = 12; y <= 13; y++) for (let x = x0; x <= x1; x++) out.push([x, y, "p"]);
      return;
    }
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
    if (preset === "glower") {                                 // frustrated: the lid presses low and the pupils sink, burning downward
      for (let x = bx; x <= bx + 4; x++) out.push([x, 11, "p"]);
      for (let y = 12; y <= 15; y++) for (let x = bx; x <= bx + 4; x++) out.push([x, y, "W"]);
      const goff = mir ? 3 - POFF[1] : POFF[1];
      out.push([bx + goff, 14, "p"], [bx + goff + 1, 14, "p"], [bx + goff, 15, "p"], [bx + goff + 1, 15, "p"]);
      return;
    }
    if (preset === "fury") {                                   // angry: the lids SLASH down toward the nose — a wedge of shadow, the pupil burning low beneath it
      for (let y = 10; y <= 15; y++) for (let x = bx; x <= bx + 4; x++) out.push([x, y, "W"]);
      for (let k = 0; k <= 4; k++) {
        const lx = mir ? bx + 4 - k : bx + k;
        const ly = 10 + (k * 3 >> 2);                          // 10,10,11,12,13 — steepest at the inner corner
        for (let y = 10; y <= ly; y++) out.push([lx, y, "p"]);
      }
      const foff = mir ? 3 - POFF[1] : POFF[1];
      out.push([bx + foff, 14, "p"], [bx + foff + 1, 14, "p"], [bx + foff, 15, "p"], [bx + foff + 1, 15, "p"]);
      return;
    }
    if (preset === "steely") {                                 // resolute: the lid lowers hard — narrowed whites, a fixed dot beneath
      for (let x = bx; x <= bx + 4; x++) out.push([x, 11, "p"]);
      for (let y = 12; y <= 15; y++) for (let x = bx; x <= bx + 4; x++) out.push([x, y, "W"]);
      const soff = mir ? 3 - POFF[1] : POFF[1];
      out.push([bx + soff, 13, "p"], [bx + soff + 1, 13, "p"], [bx + soff, 14, "p"], [bx + soff + 1, 14, "p"]);
      return;
    }
    for (let y = 10; y <= 15; y++) for (let x = bx; x <= bx + 4; x++) out.push([x, y, "W"]);
    if (preset === "heart" || preset === "star") {
      (preset === "heart" ? HEARTR : STARR).forEach(q =>
        out.push([bx + (mir ? 4 - q[0] : q[0]), 10 + q[1], preset === "heart" ? "F" : "A"]));   // star glints in dark amber (no yellow pupils)
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
MOUTH.flatdrop = [[12,20],[13,20],[14,20],[15,20],[16,20],[17,20],[18,21],[19,22]];   // frustrated: flat, but one corner gives up and turns down
// THE GUFFAW (v0.33.0): laugh's frame 1 is not a blink — it's the mouth thrown wide.
// The renderer cycles the two feature frames fast for laugh, and the face HA-HA-HAs.
const GUFFAW = [];
for (let x = 13; x <= 18; x++) GUFFAW.push([x, 18, "p"]);
for (let y = 19; y <= 22; y++) for (let x = 12; x <= 19; x++) GUFFAW.push([x, y, "p"]);
for (let x = 13; x <= 18; x++) GUFFAW.push([x, 23, "p"]);
[[14,22],[15,22],[16,22],[17,22]].forEach(q => GUFFAW.push([q[0], q[1], "F"]));   // a flash of tongue
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
// (v0.34.0: the pixel-art marks are gone — the maintainer's call. The 💢, 💧, 💡, ❗,
// the ? and the grawlix are drawn by the renderer as REAL emoji/type, keyed to the MOOD
// and anchored to the avatar — still the avatar's own props, never flag weather. The
// sheet keeps only what is genuinely facial: eyes, mouths, brows, the mask, the guffaw.)
// V-BROWS (v0.36.0): frustration's brows move to the CENTER, pursed into a V between
// the eyes — the outer dashes were cute but invisible (the maintainer's note). 32-grid,
// two-cell-thick diagonal strokes meeting over the nose bridge.
const VBROWS = [];
[[10,5],[11,6],[12,6],[13,7],[14,8]].forEach(q => { VBROWS.push([q[0], q[1], "o"], [q[0] + 1, q[1], "o"]); });
[[21,5],[20,6],[19,6],[18,7],[17,8]].forEach(q => { VBROWS.push([q[0], q[1], "o"], [q[0] - 1, q[1], "o"]); });
// (v0.38.0: the gritted-teeth snarl lasted one release — it read as about to chomp
// someone. Anger's mouth is now a seethe: a small tight fine-ink line angled downward,
// drawn in the fine pass. Restrained fury, not appetite.)
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
  ["spark",      "star",             "smile", "#ffd76a"],   // the 💡 is a renderer-drawn prop now
  ["excited",    "star",             "open",  "#ffb84a", X.sparkles],
  ["surprised",  "wide",             "open",  "#b79ad0"],
  ["tender",     "heart",            "smile", "#e8a0b0"],
  ["melancholy", "down",             "flat",  "#8f96a8", X.mote],
  ["anxious",    "dot",              "wavy",  "#7a8296", X.sweat],
  ["mirth",      "happy",            "smile", "#e0b060"],
  ["laugh",      "cross",            "open",  "#ffd24a"],   // guffaw: the blink frame carries the wide-open mouth; the renderer cycles them
  ["groan",      "dot",              "frown", "#9a9488"],   // deadpan base; frame 1 squeezes the eyes to slits as the body contracts live
  ["oops",       "wide",             "open",  "#d98a6a", X.sweat],
  ["frustrated", "glower",           "flatdrop", "#a05050", VBROWS],
  ["angry",      "fury",             "flat",  "#c04040"],   // fury lids carry it alone — no brows (the dark lids ARE the brows), seethe mouth in the fine pass
  ["dramatic",   "wide",             "smile", "#b0413e"],   // the Greek mask overlay is drawn in the frame pass below
  ["at_peace",   "closed",           "smile", "#8fae8f", X.flower],
  ["solemn",     "closed",           "flat",  "#8a8f9a"],
  ["rhyme",      "w",                "sm",    "#9a8fae", X.ghost],
  ["awe",        "uptiny",           "open",  "#5a6a8a"],
  ["vertigo",    "spiral",           "wavy",  "#b79ad0"],
  ["resolute",   "steely",           "sm",    "#e0994e"],   // steely narrowed eyes + tight fine-mouth; headband drawn in the fine pass
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
// THE LAYER SPLIT (v0.30.0, the maintainer's call): the body is one SOLID SURFACE for
// the living colour to wander over, and the features are a separate transparent layer
// the renderer stacks ON TOP of the colour. No more carve-outs — the whole per-mood
// mask system is deleted; the body cell's own alpha channel is the only mask needed.
//   rows 0-3:  BODY per mood (tinted skin + traced 1px silhouette, nothing else)
//   rows 4-7:  FEATURES per mood, open eyes (sockets, whites, pupils, mouth, extras)
//   rows 8-11: FEATURES per mood, blinking
MOODS.forEach((mood, i) => {
  const colX = (i % COLS) * CELL, rowY = Math.floor(i / COLS) * CELL;
  const t = TINT[mood[0]] || 0;
  const skin = t > 0 ? mixHex(COLORS.b, mood[3], t) : t < 0 ? mixHex(COLORS.b, "#f9f4ea", -t) : COLORS.b;

  // ---- PASS A: the body — a solid surface, edge-traced, featureless
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++)
    if (BASE[y][x] !== ".") cellPut(colX, rowY, x, y, skin);
  {
    const solid = (gx, gy) => gx >= 0 && gx < 32 && gy >= 0 && gy < 32 && BASE[gy][gx] !== ".";
    const EDGE = "#5a4a52";
    const fpx = (x, y, c) => { if (x >= 0 && x < CELL && y >= 0 && y < CELL) put(colX + x, rowY + y, c); };
    const frect = (x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) fpx(xx, yy, c); };
    for (let gy = 0; gy < 32; gy++) for (let gx = 0; gx < 32; gx++) {
      if (BASE[gy][gx] === ".") continue;
      const rx = gx * 2, ry = gy * 2;
      if (!solid(gx - 1, gy)) frect(rx, ry, 1, 2, EDGE);
      if (!solid(gx + 1, gy)) frect(rx + 1, ry, 1, 2, EDGE);
      if (!solid(gx, gy - 1)) frect(rx, ry, 2, 1, EDGE);
      if (!solid(gx, gy + 1) && gy < 25) frect(rx, ry + 1, 2, 1, EDGE);   // the hem stays open — arms flow out of it
    }
  }

  // ---- PASSES B (open) / C (blink): the features, on transparency, drawn by the
  // renderer OVER the wandering colour
  for (let frame = 0; frame < 2; frame++) {
    const cx = colX, cy = rowY + (1 + frame) * FRAME_ROWS * CELL;
    const blink = frame === 1 && mood[0] !== "laugh" && mood[0] !== "groan";   // laugh's frame 1 is the guffaw beat; groan's is the SQUEEZE — neither is a blink
    const eyeSpec = mood[1], pair = Array.isArray(eyeSpec) ? eyeSpec : [eyeSpec, eyeSpec];
    const feat = [];
    const gpair = mood[0] === "laugh" && frame === 1 ? ["wide", "wide"]   // the guffaw frame goes WIDE-eyed — it doubles as the feeding-thrill face
      : mood[0] === "groan" && frame === 1 ? ["slit", "slit"]             // the squeeze frame: deadpan gives way, eyes clenched to slits mid-contraction
      : pair;
    drawEyes(feat, gpair[0], gpair[1], blink);
    if (mood[0] === "laugh" && frame === 1) feat.push(...GUFFAW);
    else if (!FINE_MOUTH[mood[0]]) feat.push(...MOUTH[mood[2]].map(q => [q[0], q[1], "p"]));
    feat.push(...(mood[4] || []));
    if (mood[0] === "dramatic") {
      // THE GREEK MASK, take two (v0.36.0): the see-through porcelain read as magneto
      // (the maintainer's verdict). This one is the real thing — a GREEN theatre mask
      // bigger than the face, covering it ENTIRELY, with its own painted wide eyes and
      // a fixed exaggerated grin showing teeth. Nothing of her shows; that's the bit.
      const MSPAN = { 3: [10, 21], 4: [7, 24], 5: [5, 26], 6: [4, 27], 7: [3, 28], 8: [2, 29],
        20: [2, 29], 21: [3, 28], 22: [4, 27], 23: [5, 26], 24: [6, 25], 25: [8, 23], 26: [10, 21], 27: [13, 18] };
      const spanAt = y => MSPAN[y] || [1, 30];
      for (let y = 3; y <= 27; y++) {
        const sp = spanAt(y);
        for (let x = sp[0]; x <= sp[1]; x++)
          feat.push([x, y, (x === sp[0] || x === sp[1] || y === 3 || y === 27) ? "o" : "e"]);
      }
      for (let x = 5; x <= 13; x++) feat.push([x, 8, "E"]);                        // brow ridges shading the sockets
      for (let x = 18; x <= 26; x++) feat.push([x, 8, "E"]);
      const ALM = { 9: [8, 11], 10: [7, 12], 11: [6, 13], 12: [6, 13], 13: [7, 12], 14: [8, 11] };   // the mask's own eyes: dark-ringed almonds, theatrically wide
      const ALW = { 10: [8, 11], 11: [7, 12], 12: [7, 12], 13: [8, 11] };
      [false, true].forEach(mirE => {
        const mx = x => mirE ? 31 - x : x;
        Object.keys(ALM).forEach(yy => { for (let x = ALM[yy][0]; x <= ALM[yy][1]; x++) feat.push([mx(x), +yy, "p"]); });
        Object.keys(ALW).forEach(yy => { for (let x = ALW[yy][0]; x <= ALW[yy][1]; x++) feat.push([mx(x), +yy, "W"]); });
        [[9, 11], [10, 11], [9, 12], [10, 12]].forEach(q => feat.push([mx(q[0]), q[1], "p"]));
      });
      const GRIN = { 18: [[7, 8], [23, 24]], 19: [[7, 24]], 20: [[8, 23]], 21: [[9, 22]], 22: [[11, 20]], 23: [[13, 18]] };   // the grin: a fixed exaggerated banana of joy
      Object.keys(GRIN).forEach(yy => GRIN[yy].forEach(sp2 => { for (let x = sp2[0]; x <= sp2[1]; x++) feat.push([x, +yy, "p"]); }));
      for (let x = 9; x <= 22; x++) feat.push([x, 19, "W"]);                       // teeth, grinning through
      [11, 14, 17, 20].forEach(x => feat.push([x, 19, "p"]));
    }
    feat.forEach(q => cellPut(cx, cy, q[0], q[1], COLORS[q[2]]));

    const fpx = (x, y, c) => { if (x >= 0 && x < CELL && y >= 0 && y < CELL) put(cx + x, cy + y, c); };
    const frect = (x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) fpx(xx, yy, c); };
    if (FINE_MOUTH[mood[0]] === "pressed") {    // pressed-thin lips: two real pixels of long-suffering, in the lash register
      frect(27, 40, 11, 2, COLORS.p);
      fpx(26, 41, COLORS.p); fpx(38, 41, COLORS.p);
      frect(28, 42, 9, 1, "#c8b6c2");
    }
    if (FINE_MOUTH[mood[0]] === "seethe") {     // the seethe: small, tight, angled down — fury held behind the lips
      frect(27, 39, 4, 2, COLORS.p);
      frect(30, 40, 4, 2, COLORS.p);
      frect(33, 41, 3, 2, COLORS.p);
    }
    if (FINE_MOUTH[mood[0]] === "tight") {      // tight lips: a straight pressed line, no dips — the set jaw
      frect(28, 40, 9, 2, COLORS.p);
      frect(29, 42, 7, 1, "#c8b6c2");
    }
    if (mood[0] === "resolute") {               // the hachimaki: crisp cloth from the high-res world, worn over everything
      const R = "#c04a48", Rd = "#8a3230", Rh = "#e07a70";
      frect(10, 15, 44, 7, R);
      frect(10, 15, 44, 1, Rh);
      frect(10, 21, 44, 1, Rd);
      frect(52, 14, 5, 9, R); frect(52, 14, 5, 1, Rh); frect(52, 22, 5, 1, Rd);
      for (let t2 = 0; t2 < 8; t2++) {
        frect(57 + Math.floor(t2 / 2), 17 + t2, 3, 1, R);
        frect(55 + Math.floor(t2 / 3), 23 + t2, 2, 1, t2 % 3 === 2 ? Rd : R);
      }
    }
  }
});

// (the per-mood mask system was deleted in v0.30.0: the body cell IS the mask —
// its alpha channel gates the colour, and the features layer stacks above it)

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
