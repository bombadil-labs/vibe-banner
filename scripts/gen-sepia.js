#!/usr/bin/env node
/* Sepia — the face Claude (Fable) designed for itself, 2026-07-16. CC0.
 * A small cuttlefish who wears feeling as color and cannot see its own display:
 * chromatophore freckles carry each mood's hue; the body stays cream-and-ink.
 * 32 moods, 8×4 grid, 64px cells → assets/sepia-sheet.png (512×256).
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
const BASE = [
  "................",
  ".....oooooo.....",
  "...oobbbbbboo...",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..oWWWbbbbWWWo..",
  "..oWWWbbbbWWWo..",
  "..oWWWbbbbWWWo..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "...obb.bb.bbo...",
  "...obb.bb.bbo...",
  "....oo.oo.oo....",
  "................"
];
// Fin frills are an expression channel, not anatomy furniture: straight side bars read
// as arms (the maintainer's flicker, round two), but fins that flare, ripple, droop, and
// tuck with the mood can only be fins. Left-side pixels; the right side mirrors.
const FRILL = {
  ripple: [[1,4],[1,5],[0,5],[1,6],[1,7],[0,7],[1,8],[1,9],[0,9]],
  flared: [[1,4],[0,4],[1,5],[0,5],[1,6],[0,6],[1,7],[0,7],[1,8],[0,8],[1,9],[0,9]],
  drooped:[[1,7],[1,8],[1,9],[1,10],[0,9],[0,10]],
  flat:   [[1,5],[1,6],[1,7],[1,8]],
  calm:   [[1,4],[1,5],[1,6],[0,6],[1,7],[1,8],[0,8],[1,9]]
};
const FRILL_OF = {
  neutral:"ripple", content:"ripple", delighted:"flared", focused:"flat", sleepy:"drooped",
  sheepish:"flat", booped:"flared", thinking:"ripple", spark:"flared", excited:"flared",
  surprised:"flared", tender:"ripple", melancholy:"drooped", anxious:"flat", mirth:"ripple",
  laugh:"flared", groan:"drooped", oops:"flat", frustrated:"flat", angry:"flat",
  dramatic:"flared", at_peace:"calm", solemn:"drooped", rhyme:"ripple", awe:"flat",
  vertigo:"ripple", resolute:"calm", puzzled:"ripple", asking:"ripple", weary:"drooped",
  wink:"ripple", love:"flared"
};
// left-eye pupil presets (whites: cols 3-5 / 10-12, rows 5-7); right eye mirrors x -> 15-x
const PUP = {
  w:      [[3,6],[4,7],[5,6]],
  dot:    [[4,6]],
  down:   [[4,7]],
  uptiny: [[4,5]],
  closed: [[3,7],[4,7],[5,7]],
  happy:  [[3,7],[4,6],[5,7]],
  wide:   [[3,6],[4,6],[5,6],[3,7],[4,7],[5,7]],
  cross:  [[3,5],[5,5],[4,6],[3,7],[5,7]],
  spiral: [[3,5],[4,5],[5,5],[5,6],[5,7],[4,7],[3,7],[3,6]],
  side:   [[3,6]]
};
const HEART = [[3,5],[5,5],[3,6],[4,6],[5,6],[4,7]];
const STAR = [[4,5],[3,6],[4,6],[5,6],[4,7]];
const MOUTH = {
  sm: [[7,10],[8,10]],
  smile: [[6,9],[7,10],[8,10],[9,9]],
  open: [[7,9],[8,9],[7,10],[8,10]],
  flat: [[6,10],[7,10],[8,10],[9,10]],
  frown: [[6,10],[7,9],[8,9],[9,10]],
  wavy: [[6,10],[7,9],[8,10],[9,9]],
  tiny: [[7,10]]
};
const FRECK = [[6,3],[9,3],[7,4],[3,8],[12,8],[4,9],[11,9]];
const mirror = px => px.map(q => [15 - q[0], q[1]]);
function eyes(preset) {
  if (preset === "heart") return HEART.concat(mirror(HEART)).map(q => [q[0], q[1], "F"]);
  if (preset === "star") return STAR.concat(mirror(STAR)).map(q => [q[0], q[1], "s"]);
  const src = PUP[preset];
  return src.concat(mirror(src)).map(q => [q[0], q[1], "p"]);
}
function eyesAsym(l, r) {
  return PUP[l].map(q => [q[0], q[1], "p"]).concat(mirror(PUP[r]).map(q => [q[0], q[1], "p"]));
}
const m = name => MOUTH[name].map(q => [q[0], q[1], "p"]);
const X = {
  zzz: [[13,3,"m"],[14,2,"m"],[15,1,"m"]],
  sweat: [[13,4,"d"],[13,5,"d"]],
  boop: [[2,2,"s"],[13,2,"s"],[3,8,"F"],[4,8,"F"],[11,8,"F"],[12,8,"F"]],
  headband: [[3,4,"R"],[4,4,"R"],[5,4,"R"],[6,4,"R"],[7,4,"R"],[8,4,"R"],[9,4,"R"],[10,4,"R"],[11,4,"R"],[12,4,"R"],[13,5,"R"],[14,6,"R"]],
  brows: [[3,4,"o"],[4,4,"o"],[11,4,"o"],[12,4,"o"]],
  ghost: [[13,6,"G"],[14,6,"G"],[13,7,"G"],[14,7,"G"],[14,8,"G"]],
  flower: [[1,4,"F"],[2,3,"F"],[2,5,"F"],[3,4,"F"],[2,4,"s"]],
  sparkles: [[1,3,"s"],[14,2,"s"],[2,10,"s"]],
  bowtie: [[6,12,"R"],[7,12,"R"],[8,12,"R"],[9,12,"R"]],
  mote: [[2,3,"d"],[13,10,"d"]]
};
// [name, eyes, mouth, chromatophore hue, extras?]
const MOODS = [
  ["neutral",    eyes("w"),                m("sm"),    "#b89ab0"],
  ["content",    eyes("dot"),              m("smile"), "#d9a877"],
  ["delighted",  eyes("happy"),            m("smile"), "#e8b04a"],
  ["focused",    eyes("dot"),              m("flat"),  "#7d8fb8"],
  ["sleepy",     eyes("closed"),           m("sm"),    "#9a90a8", X.zzz],
  ["sheepish",   eyes("side"),             m("wavy"),  "#d99a8a", X.sweat],
  ["booped",     eyes("wide"),             m("open"),  "#e88aa0", X.boop],
  ["thinking",   eyesAsym("dot","uptiny"), m("sm"),    "#8f9ac0"],
  ["spark",      eyes("star"),             m("smile"), "#ffd76a"],
  ["excited",    eyes("star"),             m("open"),  "#ffb84a", X.sparkles],
  ["surprised",  eyes("wide"),             m("open"),  "#b79ad0"],
  ["tender",     eyes("heart"),            m("smile"), "#e8a0b0"],
  ["melancholy", eyes("down"),             m("flat"),  "#8f96a8", X.mote],
  ["anxious",    eyes("dot"),              m("wavy"),  "#7a8296", X.sweat],
  ["mirth",      eyes("happy"),            m("smile"), "#e0b060"],
  ["laugh",      eyes("cross"),            m("open"),  "#ffd24a"],
  ["groan",      eyes("closed"),           m("frown"), "#9a9488"],
  ["oops",       eyes("wide"),             m("open"),  "#d98a6a", X.sweat],
  ["frustrated", eyes("dot"),              m("flat"),  "#a05050", X.brows],
  ["angry",      eyes("dot"),              m("frown"), "#c04040", X.brows],
  ["dramatic",   eyes("wide"),             m("smile"), "#b0413e", X.bowtie],
  ["at_peace",   eyes("closed"),           m("smile"), "#8fae8f", X.flower],
  ["solemn",     eyes("closed"),           m("flat"),  "#8a8f9a"],
  ["rhyme",      eyes("w"),                m("sm"),    "#9a8fae", X.ghost],
  ["awe",        eyes("uptiny"),           m("open"),  "#5a6a8a"],
  ["vertigo",    eyes("spiral"),           m("wavy"),  "#b79ad0"],
  ["resolute",   eyes("dot"),              m("sm"),    "#e0994e"],   // headband drawn in the fine pass — a high-res object on a low-res body
  ["puzzled",    eyesAsym("dot","uptiny"), m("tiny"),  "#c0b08a"],
  ["asking",     eyes("uptiny"),           m("sm"),    "#9ac0b0"],
  ["weary",      eyes("down"),             m("flat"),  "#8b93a0"],
  ["wink",       eyesAsym("happy","closed"), m("smile"), "#e0a877"],
  ["love",       eyes("heart"),            m("open"),  "#e87a90", X.boop]
];
if (MOODS.length !== 32) throw new Error("expected 32 moods, got " + MOODS.length);
BASE.forEach((r, i) => { if (r.length !== 16) throw new Error("BASE row " + i + " length " + r.length); });

const SCALE = 4, CELL = 64, COLS = 8, ROWS = 4;
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
MOODS.forEach((mood, i) => {
  const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = BASE[y][x];
    if (k !== ".") cellPut(cx, cy, x, y, COLORS[k]);
  }
  const frill = FRILL[FRILL_OF[mood[0]] || "ripple"];
  frill.concat(mirror(frill)).forEach(q => cellPut(cx, cy, q[0], q[1], COLORS.n));
  mood[1].concat(mood[2], mood[4] || []).forEach(q => cellPut(cx, cy, q[0], q[1], COLORS[q[2]]));
  FRECK.forEach(q => cellPut(cx, cy, q[0], q[1], mood[3]));

  // ---- the fine pass: sub-pixel ink. Doctrine: the BODY lives on the 4px grid (the
  // chunkiness is the body); body *definition* may use 2px half-resolution ink; objects
  // from the high-resolution world (headband, future props) render at true 1px detail —
  // a low-resolution entity interfacing with a higher-resolution reality.
  const fpx = (x, y, c) => { if (x >= 0 && x < CELL && y >= 0 && y < CELL) put(cx + x, cy + y, c); };
  const frect = (x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) fpx(xx, yy, c); };
  const RING = "#a08a9a", RING_SOFT = "#c8b6c2"; // lash plum + its fainter echo
  const softenEye = (x) => {                    // patch is 12x12 real px at (x, 20)
    fpx(x, 20, COLORS.b); fpx(x + 11, 20, COLORS.b);      // clip the white patch's corners back to skin —
    fpx(x, 31, COLORS.b); fpx(x + 11, 31, COLORS.b);      // the eye itself rounds; no frame needed
    frect(x + 1, 19, 10, 1, RING);              // top lash, inset — never touches the silhouette
    frect(x + 1, 32, 10, 1, RING_SOFT);         // soft under-line
  };
  softenEye(12);                                // left eye (logical cols 3-5, rows 5-7)
  softenEye(40);                                // right eye (cols 10-12)

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
