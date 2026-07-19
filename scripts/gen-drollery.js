#!/usr/bin/env node
/* Drollery — a marginalia grotesque, 2026-07-19. CC0.
 *
 * A "drollery" is the real art-historical term for the small hybrid creatures medieval
 * scribes drew in the MARGINS of manuscripts: irreverent, commenting on a text they are not
 * part of, growing out of the vine-work at the edge of the page. Which is exactly what this
 * project is — a mood annotation in the margin of a conversation. The repo is still called
 * vibe-annotation-renderer.
 *
 * TWO THINGS MAKE IT VISUALLY NOVEL, and both are structural rather than decorative:
 *
 * 1. IT IS NOT PIXEL ART. Sepia is a 32-grid, Kip a 16-grid; both are drawn pixel by pixel.
 *    This one is drawn ANALYTICALLY — discs, ellipses, capsules, polygons — and rasterised
 *    with 4x4 supersampling, so the strokes come out smooth and bold at any size. First
 *    non-pixel face in the roster. Rich flat fills inside heavy iron-gall outlines, which is
 *    how the source material actually looks.
 *
 * 2. IT BOILS. A drawing that is alive doesn't MOVE — it gets RE-DRAWN. Three frames per
 *    mood, each rasterised with every control point jittered by a fraction of a pixel on its
 *    own seed, cycled a few times a second: the classic hand-drawn "boiling line". Sepia
 *    flows, Kip snaps, Motes swarms, and Drollery quivers like ink that hasn't decided to be
 *    still. Nothing else here animates by redrawing itself.
 *
 * Palette is a real illuminator's: lapis ultramarine, vermilion, gold leaf, verdigris, over
 * iron-gall ink on parchment.
 *
 * 33 moods x 3 FRAMES, 8x15 grid, 64px cells -> assets/drollery-sheet.png (512x960).
 * Pure Node (zlib only), deterministic: npm run drollery
 */
const fs = require("fs");
const zlib = require("zlib");

const C = {
  ink:    [26, 20, 16, 255],      // iron gall — warm near-black, the outline of everything
  lapis:  [44, 74, 154, 255],     // ultramarine body
  lapisL: [74, 107, 196, 255],    // its lit side
  verm:   [200, 52, 42, 255],     // vermilion — mouth, tongue, accents
  vermD:  [150, 34, 30, 255],
  gold:   [212, 165, 42, 255],    // gold leaf — horns, vine
  goldL:  [240, 216, 120, 255],
  verd:   [63, 122, 92, 255],     // verdigris — leaves
  parch:  [239, 227, 200, 255],   // parchment — eye whites, highlights
  rose:   [216, 138, 150, 255]    // a blush the illuminator could not resist
};

const CELL = 64, SS = 4;                       // 4x4 supersampling -> smooth bold strokes
const COLS = 8, FRAMES = 3;

const MOODS = ["neutral", "content", "delighted", "focused", "sleepy", "sheepish", "booped", "thinking",
  "spark", "excited", "surprised", "tender", "melancholy", "anxious", "mirth", "laugh",
  "groan", "oops", "frustrated", "angry", "dramatic", "at_peace", "solemn", "rhyme",
  "awe", "vertigo", "resolute", "puzzled", "asking", "weary", "wink", "love", "working"];
const RPF = Math.ceil(MOODS.length / COLS);    // 5
const W = COLS * CELL, H = RPF * FRAMES * CELL;

// ── deterministic noise, for the boil ───────────────────────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return function () { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── shapes ──────────────────────────────────────────────────────────────────────────
// Each is {hit(x,y) -> bool, col}. Painter's algorithm: later entries sit on top.
function disc(x, y, r, col) { const r2 = r * r; return { col, hit: (px, py) => (px - x) * (px - x) + (py - y) * (py - y) <= r2 }; }
function ell(x, y, rx, ry, rot, col) {
  const c = Math.cos(-rot), s = Math.sin(-rot);
  return { col, hit: (px, py) => {
    const dx = px - x, dy = py - y, u = dx * c - dy * s, v = dx * s + dy * c;
    return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
  } };
}
function capsule(x1, y1, x2, y2, w, col) {          // a thick stroke with round caps
  const r = w / 2, dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1e-6;
  return { col, hit: (px, py) => {
    let t = ((px - x1) * dx + (py - y1) * dy) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = px - (x1 + dx * t), qy = py - (y1 + dy * t);
    return qx * qx + qy * qy <= r * r;
  } };
}
function poly(pts, col) {
  return { col, hit: (px, py) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
    }
    return inside;
  } };
}
// an arc drawn as a chain of capsules — vines, brows, mouths
function arcStroke(cx, cy, r, a0, a1, w, col, out, squash) {
  const n = Math.max(3, Math.round(Math.abs(a1 - a0) * 7));
  let px = null, py = null;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * (squash == null ? 1 : squash);
    if (px !== null) out.push(capsule(px, py, x, y, w, col));
    px = x; py = y;
  }
}

// ── the creature ────────────────────────────────────────────────────────────────────
// Built as a shape list per mood+frame. Every coordinate passes through jit() first, which
// is the boil: a sub-pixel wobble on this frame's own seed. The drawing is redrawn, not moved.
const HEAD = { x: 32, y: 27, r: 16.5 };

const EYES = {
  open:   { rx: 4.6, ry: 5.0, pupil: 2.2, py: 0.4 },
  wide:   { rx: 5.4, ry: 6.2, pupil: 2.0, py: 0 },
  narrow: { rx: 4.6, ry: 2.4, pupil: 1.9, py: 0 },
  shut:   { lid: true },
  droop:  { rx: 4.4, ry: 3.6, pupil: 2.0, py: 1.2, lidTop: true },
  up:     { rx: 4.6, ry: 5.0, pupil: 2.1, py: -1.6 },
  side:   { rx: 4.6, ry: 5.0, pupil: 2.1, px: 1.8 },
  cross:  { rx: 4.6, ry: 5.0, pupil: 2.1, px: 1.9, inward: true },
  spiral: { rx: 5.0, ry: 5.2, spiral: true },
  heart:  { heart: true },
  wink:   { winkL: true, rx: 4.6, ry: 5.0, pupil: 2.2 },
  glare:  { rx: 4.8, ry: 3.0, pupil: 2.3, py: -0.4, brow: 1 }
};
const MOUTHS = {
  line:   { kind: "arc", w: 1.9, span: 0.30, bend: 0.0 },
  smile:  { kind: "arc", w: 2.0, span: 0.46, bend: 0.85 },
  grin:   { kind: "open", rx: 5.6, ry: 3.4, teeth: true },
  frown:  { kind: "arc", w: 2.0, span: 0.42, bend: -0.8 },
  open:   { kind: "open", rx: 3.4, ry: 4.0 },
  wide:   { kind: "open", rx: 6.2, ry: 5.4, teeth: true, tongue: true },
  small:  { kind: "arc", w: 1.8, span: 0.16, bend: 0.2 },
  wave:   { kind: "wave", w: 1.8 },
  flat:   { kind: "arc", w: 2.2, span: 0.40, bend: 0.0 },
  pucker: { kind: "open", rx: 2.2, ry: 2.6 }
};

// [eyes, mouth, browTilt, vineCurl, headTilt, blush, gild]
const M = {
  neutral:    ["open", "line", 0, 0.0, 0, 0, 0],
  content:    ["narrow", "smile", 0.1, 0.2, 0, 1, 0],
  delighted:  ["wide", "grin", 0.3, 0.7, -0.06, 1, 1],
  focused:    ["narrow", "flat", -0.3, -0.2, 0, 0, 0],
  sleepy:     ["shut", "small", 0.2, -0.4, 0.09, 0, 0],
  sheepish:   ["side", "small", 0.25, -0.2, 0.08, 1, 0],
  booped:     ["wide", "open", 0.4, 0.5, -0.04, 1, 0],
  thinking:   ["up", "line", -0.15, 0.3, -0.07, 0, 0],
  spark:      ["wide", "smile", 0.35, 0.8, -0.05, 0, 1],
  excited:    ["wide", "grin", 0.3, 0.9, 0, 1, 1],
  surprised:  ["wide", "open", 0.45, 0.4, 0, 0, 0],
  tender:     ["narrow", "smile", 0.15, 0.25, 0.05, 1, 0],
  melancholy: ["droop", "frown", 0.3, -0.5, 0.10, 0, 0],
  anxious:    ["wide", "wave", 0.4, -0.3, 0.04, 0, 0],
  mirth:      ["narrow", "grin", 0.2, 0.5, -0.04, 1, 0],
  laugh:      ["shut", "wide", 0.3, 0.8, -0.07, 1, 1],
  groan:      ["shut", "wave", 0.35, -0.5, 0.11, 0, 0],
  oops:       ["wide", "open", 0.4, 0.3, 0.06, 1, 0],
  frustrated: ["glare", "flat", -0.5, -0.3, 0, 0, 0],
  angry:      ["glare", "frown", -0.7, -0.4, 0, 0, 0],
  dramatic:   ["side", "open", -0.2, 0.9, -0.08, 0, 1],
  at_peace:   ["shut", "smile", 0.1, 0.3, 0, 0, 1],
  solemn:     ["narrow", "flat", -0.1, -0.1, 0, 0, 0],
  rhyme:      ["side", "smile", 0.1, 0.6, -0.05, 0, 1],
  awe:        ["wide", "open", 0.35, 0.7, -0.06, 0, 1],
  vertigo:    ["spiral", "wave", 0.2, -0.6, 0.12, 0, 0],
  resolute:   ["narrow", "flat", -0.35, 0.4, 0, 0, 0],
  puzzled:    ["side", "wave", -0.25, 0.1, 0.07, 0, 0],
  asking:     ["up", "small", -0.2, 0.35, -0.06, 0, 0],
  weary:      ["droop", "flat", 0.3, -0.55, 0.09, 0, 0],
  wink:       ["wink", "grin", 0.2, 0.55, -0.05, 1, 0],
  love:       ["heart", "smile", 0.2, 0.6, -0.04, 1, 1],
  working:    ["narrow", "line", -0.25, 0.15, 0, 0, 0]
};

function build(mood, frame) {
  const [eyeK, mouthK, brow, vine, tilt, blush, gild] = M[mood];
  const R = rng(mood.length * 9173 + frame * 7717 + mood.charCodeAt(0) * 131);
  const J = 0.55;                                          // the boil: sub-pixel wobble, per frame
  const jx = () => (R() - 0.5) * J, jy = () => (R() - 0.5) * J;
  const S = [];
  const hx = HEAD.x + jx(), hy = HEAD.y + jy();
  const rot = (px, py, a) => {                             // head tilt, about the head centre
    const dx = px - hx, dy = py - hy, c = Math.cos(a), s = Math.sin(a);
    return [hx + dx * c - dy * s, hy + dx * s + dy * c];
  };
  const P = (px, py) => rot(px + jx(), py + jy(), tilt);

  // ── the vine: the creature grows out of the margin's foliage, always
  const vDir = vine >= 0 ? 1 : -1, vMag = 5 + Math.abs(vine) * 7;
  arcStroke(hx + vDir * 6, 52 + jy(), 11 + Math.abs(vine) * 3, vine >= 0 ? 2.6 : 0.5,
            vine >= 0 ? 5.4 : 3.3, 3.4, C.ink, S, 0.75);
  arcStroke(hx + vDir * 6, 52 + jy(), 11 + Math.abs(vine) * 3, vine >= 0 ? 2.6 : 0.5,
            vine >= 0 ? 5.4 : 3.3, 2.0, C.gold, S, 0.75);
  const lf = [hx + vDir * (13 + vMag * 0.3) + jx(), 46 + jy()];
  S.push(ell(lf[0], lf[1], 5.4, 3.0, vDir * 0.5, C.ink));
  S.push(ell(lf[0], lf[1], 4.2, 2.1, vDir * 0.5, C.verd));

  // ── body: a small bulb under the head, dissolving into the vine
  S.push(ell(hx, 45 + jy(), 11.5, 10.0, 0, C.ink));
  S.push(ell(hx, 45 + jy(), 9.6, 8.2, 0, C.lapis));
  S.push(ell(hx - 3.4, 42.4 + jy(), 4.4, 3.4, -0.4, C.lapisL));

  // ── horns: gold curls, the grotesque's hybrid tell
  [-1, 1].forEach((sd) => {
    const b = P(hx + sd * 11, hy - 12.5), tp = P(hx + sd * 15.5, hy - 19);
    S.push(capsule(b[0], b[1], tp[0], tp[1], 5.0, C.ink));
    S.push(capsule(b[0], b[1], tp[0], tp[1], 3.0, C.gold));
    S.push(disc(tp[0], tp[1], 2.6, C.ink));
    S.push(disc(tp[0], tp[1], 1.6, C.goldL));
  });

  // ── head
  S.push(disc(hx, hy, HEAD.r + 1.9, C.ink));
  S.push(disc(hx, hy, HEAD.r, C.lapis));
  S.push(ell(hx - 5.5, hy - 5.5, 7.5, 6.0, -0.5, C.lapisL));   // the lit side
  if (gild) { arcStroke(hx, hy, HEAD.r - 1.2, 3.5, 5.9, 1.6, C.goldL, S, 1); }

  // ── leaf-ears: the grotesque is half foliage, so its ears are leaves. (v1 gave it solid
  // vermilion slabs wider than its own face — the loudest shape in the frame, saying nothing.)
  [-1, 1].forEach((sd) => {
    const e = P(hx + sd * 13.6, hy + 3.5);
    S.push(ell(e[0], e[1], 5.6, 3.0, sd * -0.75, C.ink));
    S.push(ell(e[0], e[1], 4.4, 2.0, sd * -0.75, C.verd));
    const t1 = P(hx + sd * 9.5, hy + 5.5), t2 = P(hx + sd * 17.5, hy + 1.5);
    S.push(capsule(t1[0], t1[1], t2[0], t2[1], 1.0, C.ink));   // the midrib
  });

  // ── eyes
  const E = EYES[eyeK], ey = hy - 1.5;
  [-1, 1].forEach((sd) => {
    const c = P(hx + sd * 6.6, ey);
    const winking = E.winkL && sd === -1;
    if (E.shut || E.lid || winking) {
      const a = P(hx + sd * 6.6 - 4.6, ey), b = P(hx + sd * 6.6 + 4.6, ey);
      S.push(capsule(a[0], a[1], b[0], b[1], 2.3, C.ink));
      return;
    }
    if (E.heart) {
      S.push(disc(c[0] - 2.0, c[1] - 1.4, 3.0, C.ink)); S.push(disc(c[0] + 2.0, c[1] - 1.4, 3.0, C.ink));
      S.push(poly([[c[0] - 4.7, c[1] - 1.0], [c[0] + 4.7, c[1] - 1.0], [c[0], c[1] + 5.2]], C.ink));
      S.push(disc(c[0] - 1.8, c[1] - 1.5, 2.1, C.verm)); S.push(disc(c[0] + 1.8, c[1] - 1.5, 2.1, C.verm));
      S.push(poly([[c[0] - 3.6, c[1] - 1.1], [c[0] + 3.6, c[1] - 1.1], [c[0], c[1] + 3.7]], C.verm));
      return;
    }
    S.push(ell(c[0], c[1], E.rx + 1.4, E.ry + 1.4, 0, C.ink));
    S.push(ell(c[0], c[1], E.rx, E.ry, 0, C.parch));
    if (E.spiral) {                                        // a drawn spiral, not a pupil
      for (let i = 0; i < 14; i++) {
        const a = i * 0.62, rr = 0.5 + i * 0.30;
        S.push(disc(c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, 0.85, C.ink));
      }
      return;
    }
    const pxo = (E.px || 0) * (E.inward ? -sd : 1), pyo = E.py || 0;
    S.push(disc(c[0] + pxo, c[1] + pyo, E.pupil, C.ink));
    S.push(disc(c[0] + pxo - 0.9, c[1] + pyo - 1.0, 0.75, C.parch));   // the glint
    if (E.lidTop) {
      const a = P(hx + sd * 6.6 - 5.2, ey - 2.6), b = P(hx + sd * 6.6 + 5.2, ey - 1.4);
      S.push(capsule(a[0], a[1], b[0], b[1], 2.4, C.ink));
    }
  });

  // ── brows: bold ink strokes, the loudest expression channel at this size
  if (brow !== 0 || EYES[eyeK].brow) {
    [-1, 1].forEach((sd) => {
      const inner = P(hx + sd * 2.6, ey - 7.4 + brow * 3.2 * sd * -1);
      const outer = P(hx + sd * 11.0, ey - 8.6 - brow * 2.2 * sd * -1);
      S.push(capsule(inner[0], inner[1], outer[0], outer[1], 2.5, C.ink));
    });
  }

  // ── the snout: gives the profile something to be, and the mouth something to sit on
  const sn = P(hx, hy + 7.8);
  S.push(ell(sn[0], sn[1], 8.6, 6.6, 0, C.ink));
  S.push(ell(sn[0], sn[1], 7.2, 5.4, 0, C.lapisL));
  const nb = P(hx, hy + 3.4);
  S.push(ell(nb[0], nb[1], 2.6, 1.9, 0, C.ink));               // a small dark nose where it meets the brow

  // ── mouth
  const mo = MOUTHS[mouthK], my = hy + 9.4;
  if (mo.kind === "arc") {
    const n = 9, pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = hx + (u - 0.5) * (HEAD.r * 2 * mo.span * 2);
      const y = my + Math.sin(u * Math.PI) * -mo.bend * 3.4;
      pts.push(P(x, y));
    }
    for (let i = 1; i < pts.length; i++) S.push(capsule(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], mo.w, C.ink));
  } else if (mo.kind === "wave") {
    const n = 12, pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push(P(hx + (u - 0.5) * 13, my + Math.sin(u * Math.PI * 3) * 1.7));
    }
    for (let i = 1; i < pts.length; i++) S.push(capsule(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], mo.w, C.ink));
  } else {
    const c = P(hx, my);
    S.push(ell(c[0], c[1], mo.rx + 1.5, mo.ry + 1.5, 0, C.ink));
    S.push(ell(c[0], c[1], mo.rx, mo.ry, 0, C.vermD));
    if (mo.tongue) S.push(ell(c[0], c[1] + mo.ry * 0.42, mo.rx * 0.55, mo.ry * 0.42, 0, C.verm));
    if (mo.teeth) S.push(ell(c[0], c[1] - mo.ry * 0.62, mo.rx * 0.78, mo.ry * 0.26, 0, C.parch));
  }

  if (blush) [-1, 1].forEach((sd) => { const b = P(hx + sd * 11.5, hy + 5.5); S.push(ell(b[0], b[1], 3.2, 2.0, 0, C.rose)); });
  return S;
}

// ── raster ──────────────────────────────────────────────────────────────────────────
const px = Buffer.alloc(W * H * 4);
function drawCell(shapes, ox, oy) {
  const inv = 1 / (SS * SS);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS, fy = y + (sy + 0.5) / SS;
          let hit = null;
          for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i].hit(fx, fy)) { hit = shapes[i].col; break; }
          if (hit) { r += hit[0]; g += hit[1]; b += hit[2]; a += 255; }
        }
      }
      if (!a) continue;
      const cov = a * inv / 255, n = a / 255;
      const i2 = ((oy + y) * W + (ox + x)) * 4;
      px[i2] = Math.round(r / n); px[i2 + 1] = Math.round(g / n); px[i2 + 2] = Math.round(b / n);
      px[i2 + 3] = Math.round(cov * 255);
    }
  }
}
MOODS.forEach((mood, idx) => {
  for (let f = 0; f < FRAMES; f++) {
    drawCell(build(mood, f), (idx % COLS) * CELL, (Math.floor(idx / COLS) + f * RPF) * CELL);
  }
});

const CRC = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
fs.writeFileSync("assets/drollery-sheet.png", Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))
]));
console.log("drollery-sheet.png: " + W + "x" + H + " (" + COLS + "x" + (RPF * FRAMES) + " cells of " + CELL + "), "
  + MOODS.length + " moods x " + FRAMES + " boil frames");
