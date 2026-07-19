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
  body:   [193, 58, 44, 255],     // vermilion — the BODY now, not an accent
  bodyL:  [224, 96, 74, 255],     // its lit side
  bodyD:  [140, 34, 26, 255],     // its shade
  wing:   [44, 74, 154, 255],     // lapis — wings and ear-backs only
  wingL:  [74, 107, 196, 255],
  gold:   [212, 165, 42, 255],    // gold leaf — horns, claws, tail
  goldL:  [240, 216, 120, 255],
  verd:   [63, 122, 92, 255],     // verdigris — the tail tuft
  parch:  [239, 227, 200, 255],   // parchment — eye whites, fangs
  rose:   [216, 138, 150, 255]
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
  glare:  { rx: 4.8, ry: 3.0, pupil: 2.3, py: -0.4, brow: 1 },
  wrath:  { rx: 5.6, ry: 4.2, pupil: 1.5, wedge: 1, brow: 1 }   // angular, not round: the whole point
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
  pucker: { kind: "open", rx: 2.2, ry: 2.6 },
  snarl:  { kind: "snarl", w: 13.5, h: 7.5 }
};

// THE BOIL IS THE EXPRESSION (v3). Every other face here animates per mood; this one only
// had one animation — the re-inking — applied at a flat rate to all 33. But a boiling line
// is not a fixed effect, it is a hand: an anxious hand shakes and a settled hand doesn't. So
// the WOBBLE AMPLITUDE is now per-mood, and the renderer varies the RATE to match. at_peace
// barely quivers at 4fps; surprised judders at 11. Same mechanism, 33 different nerves.
//
// [eyes, mouth, brow, tail, tilt, blush, gild, boil, wing, hand, prop]
//   boil: multiplier on the jitter — 0.3 nearly still, 2.4 shaking
//   wing: fold | spread | raise | droop      hand: grip | one | up | cover
const M = {
  neutral:    ["open", "line", 0, 0.0, 0, 0, 0, 1.0, "fold", "grip", 0],
  content:    ["narrow", "smile", 0.1, 0.2, 0, 1, 0, 0.7, "fold", "grip", 0],
  delighted:  ["wide", "grin", 0.3, 0.7, -0.06, 1, 1, 1.3, "spread", "up", 0],
  focused:    ["narrow", "flat", -0.3, -0.2, 0, 0, 0, 0.45, "fold", "one", "quill"],
  sleepy:     ["shut", "small", 0.2, -0.4, 0.09, 0, 0, 0.35, "droop", "grip", 0],
  sheepish:   ["side", "small", 0.25, -0.2, 0.08, 1, 0, 0.9, "droop", "cover", 0],
  booped:     ["wide", "open", 0.4, 0.5, -0.04, 1, 0, 1.8, "spread", "up", 0],
  thinking:   ["up", "line", -0.15, 0.3, -0.07, 0, 0, 0.8, "fold", "one", "quill"],
  spark:      ["wide", "smile", 0.35, 0.8, -0.05, 0, 1, 1.4, "raise", "up", "flame"],
  excited:    ["wide", "grin", 0.3, 0.9, 0, 1, 1, 2.0, "spread", "up", 0],
  surprised:  ["wide", "open", 0.45, 0.4, 0, 0, 0, 2.2, "spread", "up", 0],
  tender:     ["narrow", "smile", 0.15, 0.25, 0.05, 1, 0, 0.6, "fold", "one", 0],
  melancholy: ["droop", "frown", 0.3, -0.5, 0.10, 0, 0, 0.5, "droop", "grip", "drop"],
  anxious:    ["wide", "wave", 0.4, -0.3, 0.04, 0, 0, 2.4, "fold", "cover", "drop"],
  mirth:      ["narrow", "grin", 0.2, 0.5, -0.04, 1, 0, 1.2, "fold", "one", 0],
  laugh:      ["shut", "wide", 0.3, 0.8, -0.07, 1, 1, 1.9, "spread", "up", 0],
  groan:      ["shut", "wave", 0.35, -0.5, 0.11, 0, 0, 0.8, "droop", "cover", "drop"],
  oops:       ["wide", "open", 0.4, 0.3, 0.06, 1, 0, 2.1, "spread", "up", 0],
  frustrated: ["wrath", "flat", -0.5, -0.3, 0, 0, 0, 1.9, "fold", "grip", 0],
  angry:      ["wrath", "snarl", -0.7, -0.4, 0, 0, 0, 2.3, "raise", "grip", 0],
  dramatic:   ["side", "open", -0.2, 0.9, -0.08, 0, 1, 1.1, "spread", "one", "scroll"],
  at_peace:   ["shut", "smile", 0.1, 0.3, 0, 0, 1, 0.3, "fold", "grip", 0],
  solemn:     ["narrow", "flat", -0.1, -0.1, 0, 0, 0, 0.4, "fold", "grip", 0],
  rhyme:      ["side", "smile", 0.1, 0.6, -0.05, 0, 1, 0.9, "fold", "one", "note"],
  awe:        ["wide", "open", 0.35, 0.7, -0.06, 0, 1, 0.8, "spread", "up", "star"],
  vertigo:    ["spiral", "wave", 0.2, -0.6, 0.12, 0, 0, 2.2, "droop", "grip", 0],
  resolute:   ["narrow", "flat", -0.35, 0.4, 0, 0, 0, 0.6, "raise", "grip", 0],
  puzzled:    ["side", "wave", -0.25, 0.1, 0.07, 0, 0, 1.0, "fold", "one", 0],
  asking:     ["up", "small", -0.2, 0.35, -0.06, 0, 0, 0.9, "fold", "one", "scroll"],
  weary:      ["droop", "flat", 0.3, -0.55, 0.09, 0, 0, 0.45, "droop", "grip", 0],
  wink:       ["wink", "grin", 0.2, 0.55, -0.05, 1, 0, 1.0, "fold", "one", 0],
  love:       ["heart", "smile", 0.2, 0.6, -0.04, 1, 1, 1.1, "raise", "up", "heart"],
  working:    ["narrow", "line", -0.25, 0.15, 0, 0, 0, 0.85, "fold", "one", "quill"]
};

function build(mood, frame) {
  const [eyeK, mouthK, brow, tail, tilt, blush, gild, boil, wingK, handK, prop] = M[mood];
  const R = rng(mood.length * 9173 + frame * 7717 + mood.charCodeAt(0) * 131);
  const J = 0.55 * boil;                                   // the hand's own steadiness, per mood                                          // the boil: sub-pixel wobble, per frame
  const jx = () => (R() - 0.5) * J, jy = () => (R() - 0.5) * J;
  const S = [];
  // v1 sat small and polite in the middle of its cell. A gargoyle CROUCHES, filling its
  // niche — so the whole figure grew ~35% and dropped to sit on the bottom edge.
  const hx = 32 + jx(), hy = 25 + jy(), HR = 21;
  const rot = (px, py, a) => {
    const dx = px - hx, dy = py - hy, c = Math.cos(a), s2 = Math.sin(a);
    return [hx + dx * c - dy * s2, hy + dx * s2 + dy * c];
  };
  const P = (px, py) => rot(px + jx(), py + jy(), tilt);

  // ── TAIL. The maintainer read v1's vine as a tail and was right to — so it IS one now:
  // always visible, sweeping wide, tuft on the end. Its curl is a real expression channel
  // rather than a decoration that vanished in most moods.
  // It has to CLEAR the body or it is just a lump behind a hip: v2's first pass started the
  // curl at x±9, well inside a body of radius 12.6, so six of its seven segments were buried.
  // Aim the TIP first, then curve to it. Tuning the sweep parametrically kept throwing the
  // tuft into the body or off the canvas for extreme values — half the moods lost the one
  // channel meant to tell them apart. A tip placed in a band known to clear the body
  // (|dx| > 14 from centre, y in 34..54) cannot do that, whatever the mood asks for.
  const tDir = tail >= 0 ? 1 : -1;
  const tipX = hx + tDir * (19 + Math.abs(tail) * 5);
  const tipY = 46 - tail * 9;
  const hipX = hx + tDir * 10, hipY = 50 + jy();
  const ctlX = hx + tDir * 19, ctlY = 54 + tail * 3;            // bows the curve out and under
  let tx = hipX, ty = hipY;
  for (let i = 1; i <= 8; i++) {
    const u = i / 8, iu = 1 - u;
    const nx = iu * iu * hipX + 2 * iu * u * ctlX + u * u * tipX;
    const ny = iu * iu * hipY + 2 * iu * u * ctlY + u * u * tipY;
    S.push(capsule(tx, ty, nx, ny, 5.4 - i * 0.42, C.ink));
    S.push(capsule(tx, ty, nx, ny, 3.6 - i * 0.32, C.gold));
    tx = nx; ty = ny;
  }
  S.push(ell(tx, ty, 6.0, 3.6, tDir * 0.7, C.ink));
  S.push(ell(tx, ty, 4.6, 2.4, tDir * 0.7, C.verd));

  // ── folded wings, lapis, behind the shoulders — the one place the blue survives
  const WG = { fold: [25, 2, 20, 22], spread: [33, -4, 26, 20], raise: [28, -10, 22, 14], droop: [22, 12, 18, 26] }[wingK];
  [-1, 1].forEach((sd) => {
    const w1 = P(hx + sd * 15, hy + 12), w2 = P(hx + sd * WG[0], hy + WG[1]), w3 = P(hx + sd * WG[2], hy + WG[3]);
    S.push(poly([[w1[0], w1[1]], [w2[0], w2[1]], [w3[0], w3[1]]], C.ink));
    const i1 = P(hx + sd * 16, hy + 13), i2 = P(hx + sd * (WG[0] - 2.5), hy + WG[1] + 3), i3 = P(hx + sd * (WG[2] - 1), hy + WG[3] - 2.5);
    S.push(poly([[i1[0], i1[1]], [i2[0], i2[1]], [i3[0], i3[1]]], sd < 0 ? C.wing : C.wingL));
  });

  // ── the crouching body
  S.push(ell(hx, 45 + jy(), 14.5, 12.5, 0, C.ink));
  S.push(ell(hx, 45 + jy(), 12.6, 10.8, 0, C.body));
  S.push(ell(hx - 4, 41.5 + jy(), 5.5, 4.2, -0.4, C.bodyL));

  // ── CLAWED HANDS gripping the ledge. Nothing else on the roster has hands, and a thing
  // that grips reads as perched rather than floating — the most gargoyle detail available.
  const HP = { grip: [0, 0], one: [0, -13], up: [-13, -13], cover: [-9, -9] }[handK];
  [-1, 1].forEach((sd, hi) => {
    const lift = HP[hi], inset = handK === "cover" ? 5 : 0;
    const g0 = P(hx + sd * (11.5 - inset), 54 + lift + jy());
    S.push(ell(g0[0], g0[1], 5.4, 4.0, 0, C.ink));
    S.push(ell(g0[0], g0[1], 4.0, 2.7, 0, C.bodyD));
    for (let k = -1; k <= 1; k++) {
      const c0 = P(hx + sd * (11.5 - inset + k * 3.2), 57.5 + lift + jy());
      S.push(disc(c0[0], c0[1], 1.9, C.ink));
      S.push(disc(c0[0], c0[1] - 0.3, 1.1, C.gold));
    }
  });

  // ── back-swept gold horns
  [-1, 1].forEach((sd) => {
    const b0 = P(hx + sd * 12, hy - 15), b1 = P(hx + sd * 20, hy - 24);
    S.push(capsule(b0[0], b0[1], b1[0], b1[1], 5.6, C.ink));
    S.push(capsule(b0[0], b0[1], b1[0], b1[1], 3.4, C.gold));
    S.push(disc(b1[0], b1[1], 2.8, C.ink));
    S.push(disc(b1[0], b1[1], 1.7, C.goldL));
  });

  // ── head
  S.push(disc(hx, hy, HR + 2.1, C.ink));
  S.push(disc(hx, hy, HR, C.body));
  S.push(ell(hx - 7, hy - 7, 9.5, 7.5, -0.5, C.bodyL));
  if (gild) arcStroke(hx, hy, HR - 1.4, 3.5, 5.9, 1.8, C.goldL, S, 1);

  // ── pointed, back-swept ears, lapis inside
  [-1, 1].forEach((sd) => {
    const e1 = P(hx + sd * 15, hy - 6), e2 = P(hx + sd * 26, hy - 12), e3 = P(hx + sd * 17, hy + 4);
    S.push(poly([[e1[0], e1[1]], [e2[0], e2[1]], [e3[0], e3[1]]], C.ink));
    const f1 = P(hx + sd * 16.5, hy - 5.5), f2 = P(hx + sd * 23, hy - 10.5), f3 = P(hx + sd * 17.5, hy + 1);
    S.push(poly([[f1[0], f1[1]], [f2[0], f2[1]], [f3[0], f3[1]]], C.wing));
  });

  // ── eyes
  const E = EYES[eyeK], ey = hy - 2;
  [-1, 1].forEach((sd) => {
    const c = P(hx + sd * 8, ey);
    const winking = E.winkL && sd === -1;
    if (E.shut || E.lid || winking) {
      const a = P(hx + sd * 8 - 5.6, ey), b = P(hx + sd * 8 + 5.6, ey);
      S.push(capsule(a[0], a[1], b[0], b[1], 2.6, C.ink));
      return;
    }
    if (E.heart) {
      S.push(disc(c[0] - 2.4, c[1] - 1.7, 3.6, C.ink)); S.push(disc(c[0] + 2.4, c[1] - 1.7, 3.6, C.ink));
      S.push(poly([[c[0] - 5.6, c[1] - 1.2], [c[0] + 5.6, c[1] - 1.2], [c[0], c[1] + 6.2]], C.ink));
      S.push(disc(c[0] - 2.1, c[1] - 1.8, 2.5, C.rose)); S.push(disc(c[0] + 2.1, c[1] - 1.8, 2.5, C.rose));
      S.push(poly([[c[0] - 4.3, c[1] - 1.3], [c[0] + 4.3, c[1] - 1.3], [c[0], c[1] + 4.4]], C.rose));
      return;
    }
    if (E.wedge) {
      // upper lid falls steeply toward the nose; almost no white left showing
      const w = E.rx * 1.25, h = E.ry * 1.25;
      const ox = c[0] + sd * w, ix = c[0] - sd * w;
      const out = [[ox, c[1] - h * 1.05], [ix, c[1] + h * 0.05], [ix, c[1] + h * 1.0], [ox, c[1] + h * 0.9]];
      S.push(poly(out.map((q) => [q[0] + sd * 1.4, q[1] + 1.4]), C.ink));
      S.push(poly(out, C.ink));
      const inn = [[ox + sd * -1.6, c[1] - h * 0.62], [ix + sd * 1.2, c[1] + h * 0.16],
                   [ix + sd * 1.2, c[1] + h * 0.72], [ox + sd * -1.6, c[1] + h * 0.66]];
      S.push(poly(inn, C.parch));
      S.push(disc(c[0] - sd * w * 0.42, c[1] + h * 0.42, E.pupil, C.ink));
      return;
    }
    S.push(ell(c[0], c[1], E.rx * 1.22 + 1.5, E.ry * 1.22 + 1.5, 0, C.ink));
    S.push(ell(c[0], c[1], E.rx * 1.22, E.ry * 1.22, 0, C.parch));
    if (E.spiral) {
      for (let i = 0; i < 16; i++) {
        const a = i * 0.62, rr = 0.5 + i * 0.36;
        S.push(disc(c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, 1.0, C.ink));
      }
      return;
    }
    const pxo = (E.px || 0) * (E.inward ? -sd : 1), pyo = E.py || 0;
    S.push(disc(c[0] + pxo, c[1] + pyo, E.pupil * 1.2, C.ink));
    S.push(disc(c[0] + pxo - 1.1, c[1] + pyo - 1.2, 0.9, C.parch));
    if (E.lidTop) {
      const a = P(hx + sd * 8 - 6.2, ey - 3.2), b = P(hx + sd * 8 + 6.2, ey - 1.7);
      S.push(capsule(a[0], a[1], b[0], b[1], 2.8, C.ink));
    }
  });

  if (brow !== 0 || EYES[eyeK].brow) {
    [-1, 1].forEach((sd) => {
      const heavy = EYES[eyeK].wedge ? 1 : 0;                // wrath: lower, thicker, touching the lid
      const inner = P(hx + sd * 3.2, ey - (heavy ? 5.4 : 9.2) + brow * 3.8 * sd * -1);
      const outer = P(hx + sd * 13.5, ey - (heavy ? 9.0 : 10.6) - brow * 2.6 * sd * -1);
      S.push(capsule(inner[0], inner[1], outer[0], outer[1], heavy ? 4.2 : 2.9, C.ink));
    });
  }

  // ── THE UNDERBITE. A jutting lower jaw with two fangs pointing up — impudent, unmistakably
  // gargoyle, and the single feature neither Sepia nor Kip has anywhere in their vocabulary.
  const jw = P(hx, hy + 13.5);
  S.push(ell(jw[0], jw[1], 11.5, 7.4, 0, C.ink));
  S.push(ell(jw[0], jw[1], 10.0, 6.0, 0, C.bodyD));
  const mo = MOUTHS[mouthK], my = hy + 11.5;
  if (mo.kind === "arc") {
    const n = 9, pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = hx + (u - 0.5) * (HR * 2 * mo.span * 1.9);
      const y = my + Math.sin(u * Math.PI) * -mo.bend * 3.8;
      pts.push(P(x, y));
    }
    for (let i = 1; i < pts.length; i++) S.push(capsule(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], mo.w * 1.15, C.ink));
  } else if (mo.kind === "wave") {
    const n = 12, pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n; pts.push(P(hx + (u - 0.5) * 15, my + Math.sin(u * Math.PI * 3) * 1.9)); }
    for (let i = 1; i < pts.length; i++) S.push(capsule(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], mo.w * 1.15, C.ink));
  } else if (mo.kind === "snarl") {
    const w = mo.w, h = mo.h, y0 = my - 1;
    const gash = [P(hx - w, y0 - h * 0.30), P(hx + w, y0 - h * 0.30), P(hx + w * 0.72, y0 + h), P(hx - w * 0.72, y0 + h)];
    S.push(poly(gash.map((q) => [q[0], q[1]]), C.ink));
    const inner = [P(hx - w * 0.84, y0 - h * 0.08), P(hx + w * 0.84, y0 - h * 0.08),
                   P(hx + w * 0.60, y0 + h * 0.76), P(hx - w * 0.60, y0 + h * 0.76)];
    S.push(poly(inner, [92, 18, 16, 255]));
    for (let k = -2; k <= 2; k++) {                          // upper teeth, bared
      const a = P(hx + k * 4.6 - 2.2, y0 - h * 0.06), b = P(hx + k * 4.6 + 2.2, y0 - h * 0.06), t = P(hx + k * 4.6, y0 + h * 0.40);
      S.push(poly([[a[0], a[1]], [b[0], b[1]], [t[0], t[1]]], C.parch));
    }
  } else {
    const c = P(hx, my + 0.6);
    S.push(ell(c[0], c[1], mo.rx * 1.15 + 1.6, mo.ry * 1.15 + 1.6, 0, C.ink));
    S.push(ell(c[0], c[1], mo.rx * 1.15, mo.ry * 1.15, 0, [110, 24, 20, 255]));
    if (mo.tongue) S.push(ell(c[0], c[1] + mo.ry * 0.5, mo.rx * 0.6, mo.ry * 0.46, 0, C.body));
  }
  [-1, 1].forEach((sd) => {                                 // the fangs, always
    const big = EYES[eyeK].wedge ? 1.55 : 1;
    const t0 = P(hx + sd * 5.2 * big, hy + 9.2), t1 = P(hx + sd * 4.2 * big, hy + 13.4 + (big - 1) * 4);
    S.push(poly([[t0[0] - 1.9 * big, t0[1]], [t0[0] + 1.9 * big, t0[1]], [t1[0], t1[1]]], C.parch));
  });

  if (prop) drawProp(S, prop, hx, hy, P, C, disc, ell, capsule, poly);
  if (blush) [-1, 1].forEach((sd) => { const b = P(hx + sd * 14.5, hy + 5); S.push(ell(b[0], b[1], 3.8, 2.4, 0, C.rose)); });
  return S;
}



// A handful of moods carry a MARK — the sort of small object a marginal figure is forever
// holding: a quill, a taper, a banderole, a note. Drawn in the same ink and gold as the rest,
// never an emoji: this creature predates them by six hundred years.
function drawProp(S, kind, hx, hy, P, C, disc, ell, capsule, poly) {
  if (kind === "quill") {
    const a = P(hx + 24, hy + 6), b = P(hx + 14, hy + 26);
    S.push(capsule(a[0], a[1], b[0], b[1], 3.2, C.ink));
    S.push(capsule(a[0], a[1], b[0], b[1], 1.7, C.parch));
    const f = P(hx + 26, hy + 2);
    S.push(ell(f[0], f[1], 5.0, 2.6, -0.7, C.ink));
    S.push(ell(f[0], f[1], 3.6, 1.5, -0.7, C.goldL));
  } else if (kind === "flame") {
    const f = P(hx, hy - 30);
    S.push(ell(f[0], f[1], 4.6, 6.6, 0, C.ink));
    S.push(ell(f[0], f[1] + 0.6, 3.2, 4.8, 0, C.gold));
    S.push(ell(f[0], f[1] + 1.6, 1.6, 2.4, 0, C.goldL));
  } else if (kind === "scroll") {
    const c = P(hx + 21, hy + 16);
    S.push(ell(c[0], c[1], 10.5, 5.2, -0.28, C.ink));
    S.push(ell(c[0], c[1], 9.0, 3.8, -0.28, C.parch));
    for (let k = -1; k <= 1; k++) {
      const l0 = P(hx + 15 + k * 5, hy + 15 + k * 1.4), l1 = P(hx + 19 + k * 5, hy + 16 + k * 1.4);
      S.push(capsule(l0[0], l0[1], l1[0], l1[1], 0.9, C.ink));
    }
  } else if (kind === "note") {
    const n0 = P(hx + 22, hy - 14), n1 = P(hx + 22, hy - 3);
    S.push(capsule(n0[0], n0[1], n1[0], n1[1], 2.4, C.ink));
    S.push(disc(n1[0] - 1.6, n1[1] + 1.2, 3.6, C.ink));
    S.push(disc(n1[0] - 1.6, n1[1] + 1.2, 2.4, C.gold));
    const t0 = P(hx + 22, hy - 14), t1 = P(hx + 28, hy - 11);
    S.push(capsule(t0[0], t0[1], t1[0], t1[1], 2.2, C.ink));
  } else if (kind === "star") {
    [[-24, -18, 3.4], [22, -22, 4.2], [26, -6, 2.8]].forEach((q) => {
      const c = P(hx + q[0], hy + q[1]);
      S.push(poly([[c[0], c[1] - q[2]], [c[0] + q[2] * 0.4, c[1]], [c[0], c[1] + q[2]], [c[0] - q[2] * 0.4, c[1]]], C.ink));
      S.push(poly([[c[0] - q[2], c[1]], [c[0], c[1] - q[2] * 0.4], [c[0] + q[2], c[1]], [c[0], c[1] + q[2] * 0.4]], C.goldL));
    });
  } else if (kind === "heart") {
    const c = P(hx + 22, hy - 18);
    S.push(disc(c[0] - 2.6, c[1] - 1.8, 3.8, C.ink)); S.push(disc(c[0] + 2.6, c[1] - 1.8, 3.8, C.ink));
    S.push(poly([[c[0] - 6.1, c[1] - 1.2], [c[0] + 6.1, c[1] - 1.2], [c[0], c[1] + 6.8]], C.ink));
    S.push(disc(c[0] - 2.4, c[1] - 2.0, 2.6, C.rose)); S.push(disc(c[0] + 2.4, c[1] - 2.0, 2.6, C.rose));
    S.push(poly([[c[0] - 4.6, c[1] - 1.4], [c[0] + 4.6, c[1] - 1.4], [c[0], c[1] + 4.8]], C.rose));
  } else if (kind === "drop") {
    const d0 = P(hx + 18, hy - 8);
    S.push(poly([[d0[0], d0[1] - 5.5], [d0[0] + 3.4, d0[1] + 2.4], [d0[0] - 3.4, d0[1] + 2.4]], C.ink));
    S.push(disc(d0[0], d0[1] + 1.6, 3.0, C.ink));
    S.push(disc(d0[0], d0[1] + 1.6, 1.9, C.wingL));
  }
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
