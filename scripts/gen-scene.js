#!/usr/bin/env node
/* First-party scenes — the banner's habitats. Each is a deterministic pixel painting
 * (same minimal PNG encoder as gen-sepia), drawn to sit at ~0.5 opacity inside the
 * portrait window: atmosphere, never competition.
 *   tidepool — 680x132 (170x33 logical @4px): shallow water, sand, rocks, glints.
 *              KEEP BYTE-IDENTICAL: its birth commit is pinned in consumers.
 *   night    — 160x160 (40x40 @4px): indigo sky, stars, a crescent, a dark hill.
 *   glade    — 160x160: mossy forest light, canopy, light shafts, fireflies.
 *   study    — 160x160: lamplight interior, shelf of books, warm desk.
 * Regenerate: node scripts/gen-scene.js → assets/scene-*.png */
const fs = require("fs");
const zlib = require("zlib");

const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// PNG encode (same minimal encoder as gen-sepia)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function savePNG(name, W, H, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync("assets/" + name, png);
  console.log(name + ": " + W + "x" + H + ", " + png.length + " bytes");
}

// per-scene canvas: logical grid, SCALE-up pixels
function canvas(LW, LH, SCALE) {
  const W = LW * SCALE, H = LH * SCALE;
  const px = Buffer.alloc(W * H * 4);
  function put(x, y, c) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const [r, g, b] = hex(c), i = (y * W + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  }
  function lput(gx, gy, c) {
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) put(gx * SCALE + dx, gy * SCALE + dy, c);
  }
  return { W, H, LW, LH, px, lput, save: name => savePNG(name, W, H, px) };
}

/* ---- tidepool (byte-identical to the original single-scene script) ---- */
{
  const { LW, LH, lput, save } = canvas(170, 33, 4);
  const r = rng(20260717);
  const WATER = ["#cfe8e2", "#b2ddd4", "#93cec4", "#79bfb4", "#66b0a6"];
  for (let y = 0; y < 26; y++) {
    for (let x = 0; x < LW; x++) {
      const wob = Math.sin(x / 9 + y * 0.7) * 1.4;
      const band = Math.max(0, Math.min(WATER.length - 1, Math.floor((y + wob) / 5.4)));
      lput(x, y, WATER[band]);
    }
  }
  for (let y = 26; y < LH; y++) for (let x = 0; x < LW; x++)
    lput(x, y, y === 26 ? "#dbc9a4" : ((x * 7 + y * 13) % 17 === 0 ? "#cbb894" : "#d6c49e"));
  const ROCK = "#7a7268", ROCK_D = "#645c53";
  for (let k = 0; k < 9; k++) {
    const bx = 6 + r() * (LW - 12), by = 24 + r() * 7, rad = 1.6 + r() * 2.6;
    for (let y = Math.floor(by - rad - 1); y <= by + rad + 1; y++)
      for (let x = Math.floor(bx - rad - 1); x <= bx + rad + 1; x++) {
        const e = rad + (r() - 0.5) * 1.2;
        if ((x - bx) ** 2 + (y - by) ** 2 * 2.2 <= e * e && y < LH && y > 20) lput(x, y, r() < 0.25 ? ROCK_D : ROCK);
      }
  }
  for (let k = 0; k < 7; k++) {
    const gx = 4 + Math.floor(r() * (LW - 8)); const h = 3 + Math.floor(r() * 4);
    for (let d = 0; d < h; d++) lput(gx + Math.round(Math.sin(d * 1.3 + k) * 0.8), 26 - d, "#5f9a7a");
  }
  for (let k = 0; k < 26; k++) {
    const gx = Math.floor(r() * LW), gy = Math.floor(r() * 14);
    lput(gx, gy, "#eef8f4");
    if (r() < 0.5) lput(gx + 1, gy, "#def0ea");
  }
  for (let k = 0; k < 6; k++) lput(Math.floor(r() * LW), 6 + Math.floor(r() * 16), "#e6f4f0");
  save("scene-tidepool.png");
}

/* ---- night: indigo sky, stars, a crescent, one dark hill ---- */
{
  const { LW, LH, lput, save } = canvas(40, 40, 4);
  const r = rng(20260718);
  const SKY = ["#0e1226", "#131a33", "#1a2340", "#232e4e"];
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const band = Math.min(SKY.length - 1, Math.floor(y / 11 + Math.sin(x / 7) * 0.4 + 0.4));
    lput(x, y, SKY[Math.max(0, band)]);
  }
  // stars: mostly faint, a few bright with cross glints
  for (let k = 0; k < 34; k++) {
    const sx = Math.floor(r() * LW), sy = Math.floor(r() * 30);
    const bright = r() < 0.2;
    lput(sx, sy, bright ? "#f2f0e0" : (r() < 0.5 ? "#9aa4c8" : "#c8cde2"));
    if (bright) { lput(sx - 1, sy, "#5a6390"); lput(sx + 1, sy, "#5a6390"); lput(sx, sy - 1, "#5a6390"); lput(sx, sy + 1, "#5a6390"); }
  }
  // crescent moon, upper right
  const mx = 30, my = 8;
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    const inMoon = x * x + y * y <= 17, inBite = (x - 2) * (x - 2) + (y - 1) * (y - 1) <= 13;
    if (inMoon && !inBite) lput(mx + x, my + y, (x * x + y * y > 12) ? "#d8d2ba" : "#efe9cf");
  }
  // dark hill silhouette with two tiny warm windows far off
  for (let x = 0; x < LW; x++) {
    const top = 33 - Math.round(3.4 * Math.sin(x / 8 + 1.2) + 1.6 * Math.sin(x / 3.1));
    for (let y = top; y < LH; y++) lput(x, y, y === top ? "#141826" : "#0b0e1a");
  }
  lput(9, 36, "#e8b86a"); lput(27, 37, "#d89a52");
  save("scene-night.png");
}

/* ---- glade: mossy forest light, canopy, light shafts, fireflies ---- */
{
  const { LW, LH, lput, save } = canvas(40, 40, 4);
  const r = rng(20260719);
  const AIR = ["#2e4432", "#39523a", "#455f42", "#526c4a"];
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const band = Math.min(AIR.length - 1, Math.floor((y + Math.sin(x / 5) * 1.8) / 10));
    lput(x, y, AIR[Math.max(0, band)]);
  }
  // canopy: dark leaf clumps along the top
  for (let k = 0; k < 26; k++) {
    const cx = Math.floor(r() * LW), cy = Math.floor(r() * 7), rad = 1 + Math.floor(r() * 2);
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= rad * rad + 1) lput(x, y, r() < 0.3 ? "#1c2e20" : "#24382a");
  }
  // light shafts: two soft diagonals
  for (const [sx0, w] of [[8, 3], [24, 4]]) {
    for (let y = 2; y < 34; y++) for (let dx = 0; dx < w; dx++) {
      const x = sx0 + Math.floor(y / 3) + dx;
      if ((x + y) % 2 === 0) lput(x, y, "#7c9468");
    }
  }
  // undergrowth: ferns + moss floor
  for (let y = 34; y < LH; y++) for (let x = 0; x < LW; x++)
    lput(x, y, (x * 5 + y * 11) % 13 === 0 ? "#3a5230" : "#44603a");
  for (let k = 0; k < 9; k++) {
    const fx = 2 + Math.floor(r() * (LW - 4)), h = 3 + Math.floor(r() * 3);
    for (let d = 0; d < h; d++) { lput(fx + Math.round(Math.sin(d + k) * 1.2), 34 - d, "#5f7e4c"); }
  }
  // fireflies
  for (let k = 0; k < 7; k++) lput(Math.floor(r() * LW), 12 + Math.floor(r() * 20), r() < 0.5 ? "#e8d87a" : "#f4ea9c");
  save("scene-glade.png");
}

/* ---- study: lamplight interior, shelf of books, warm desk ---- */
{
  const { LW, LH, lput, save } = canvas(40, 40, 4);
  const r = rng(20260720);
  // wall: warm dusk gradient, brightest near the lamp (upper left)
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const d = Math.sqrt((x - 8) * (x - 8) + (y - 9) * (y - 9));
    const c = d < 7 ? "#6b5240" : d < 13 ? "#57432f" : d < 20 ? "#463628" : "#382c22";
    lput(x, y, c);
  }
  // the lamp: shade, stem, glow core
  for (let x = 5; x <= 11; x++) lput(x, 6, "#8a5f3a");
  for (let x = 6; x <= 10; x++) { lput(x, 5, "#8a5f3a"); lput(x, 7, "#a06e42"); }
  lput(8, 8, "#f4d89a"); lput(7, 8, "#e8c07a"); lput(9, 8, "#e8c07a");
  for (let y = 9; y <= 12; y++) lput(8, y, "#5a4632");
  // shelf on the right with book spines
  for (let x = 22; x < 39; x++) lput(x, 16, "#2c2018");
  const SPINES = ["#8a4a3a", "#4a6a5a", "#b0885a", "#5a5a7a", "#7a4a5a", "#4a5a3a", "#a05a42", "#6a7a8a"];
  let bx = 23;
  while (bx < 38) {
    const w = 1 + Math.floor(r() * 2), h = 4 + Math.floor(r() * 3), c = SPINES[Math.floor(r() * SPINES.length)];
    for (let x = bx; x < Math.min(bx + w, 38); x++) for (let y = 16 - h; y < 16; y++) lput(x, y, c);
    if (r() < 0.3) lput(bx, 16 - h, "#d8c49a");
    bx += w;
  }
  // desk: wood grain band across the bottom
  for (let y = 30; y < LH; y++) for (let x = 0; x < LW; x++)
    lput(x, y, y === 30 ? "#6a4a30" : ((x * 3 + y * 7) % 11 === 0 ? "#4a3422" : "#573d28"));
  // a little side table (v0.35.0, cozy-core): pedestal and all, standing on the desk
  // floor — the tea lives HERE now, and the renderer sets the feeding plate beside it
  for (let x = 26; x <= 38; x++) { lput(x, 24, "#7a5638"); lput(x, 25, "#5a3e28"); }
  lput(26, 24, "#8a6644"); lput(38, 24, "#8a6644");
  for (let y = 26; y <= 30; y++) { lput(31, y, "#4a3422"); lput(32, y, "#4a3422"); }
  for (let x = 29; x <= 34; x++) lput(x, 30, "#42301e");
  // the mug of tea, up on the table (its steam is the renderer's — animation is code)
  for (let x = 27; x <= 30; x++) for (let y = 21; y <= 23; y++) lput(x, y, "#7a8a94");
  lput(31, 22, "#7a8a94");
  for (let x = 27; x <= 30; x++) lput(x, 21, "#5f6e78");
  // dust motes in the lamplight
  for (let k = 0; k < 6; k++) lput(4 + Math.floor(r() * 12), 4 + Math.floor(r() * 14), "#8a6f52");
  save("scene-study.png");
}

/* ---- hearth: a fire in the LOWER third, warm room above. The scene sits behind the
   avatar, who is centred in the window — so the fire has to stay low or it cooks the face.
   Warm mid-tones throughout (dark pixels vanish at scene opacity); the creature sits in the
   glow of the room, the fire below her. ---- */
{
  const { LW, LH, lput, save } = canvas(40, 40, 4);
  const r = rng(20260721);
  // warm firelit interior — a MID brown that reads even at half opacity, brightest low where the fire is
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const d = Math.sqrt((x - 20) * (x - 20) + (y - 35) * (y - 35));
    const c = d < 10 ? "#6e4228" : d < 20 ? "#5c3a24" : d < 30 ? "#4e3120" : "#43291d";
    lput(x, y, ((x * 7 + y * 5) % 19 === 0) ? "#3a2519" : c);   // faint brick seams
  }
  // mantel beam across the top, catching the glow — the shelf the creature sits below
  for (let x = 2; x < 38; x++) { lput(x, 5, "#8a6038"); lput(x, 6, "#6e4a2c"); lput(x, 7, "#563a24"); }
  // the firebox: a warm glowing recess low in the frame
  for (let y = 22; y < 37; y++) for (let x = 8; x < 32; x++) {
    const d = Math.sqrt((x - 20) * (x - 20) + (y - 35) * (y - 35));
    lput(x, y, d < 9 ? "#7a3010" : d < 15 ? "#5a2810" : "#43200f");
  }
  // logs across the base
  for (let x = 8; x < 32; x++) { lput(x, 35, "#6a4020"); lput(x, 36, "#4a2c14"); }
  for (let i = 0; i < 12; i++) { lput(10 + i, 34 - (i % 2), "#5a3418"); }
  // ember bed: a hot glowing band spanning the base
  for (let x = 9; x < 31; x++) { lput(x, 34, r() < 0.5 ? "#ff8a2e" : "#f06418"); lput(x, 33, r() < 0.4 ? "#ffb24a" : "#e05812"); }
  // a low, wide fire: broad at the base, licking up only into the lower third so the
  // face above stays clear. wide enough to read as a fire once downscaled to banner size.
  const FL = ["#e05812", "#f47420", "#ff9a34", "#ffc45a", "#ffe89a"];
  for (let y = 25; y < 34; y++) {
    const down = (y - 24);                                  // 1 at top of fire, 9 at base
    const half = Math.max(1, Math.round(down * 1.35) - Math.floor(Math.abs(Math.sin(y * 0.8 + 1)) * 1.5));
    for (let x = 20 - half; x <= 20 + half; x++) {
      const edge = Math.abs(x - 20) / (half + 0.5);         // 0 core -> 1 edge
      const heat = (1 - edge) * 2.2 + down * 0.22;          // hotter at core and base
      const tier = Math.min(FL.length - 1, Math.max(0, Math.round(heat)));
      if (r() < 0.94 - edge * 0.25) lput(x, y, FL[tier]);
    }
  }
  save("scene-hearth.png");
}

/* ---- rain: a window onto a grey day, rain falling beyond the glass (drawn live) ---- */
{
  const { LW, LH, lput, save } = canvas(40, 40, 4);
  const r = rng(20260722);
  // the day beyond: a soft cool grey gradient, brighter toward the top
  const SKY = ["#828d9a", "#75838f", "#697987", "#5f6f7e", "#576878"];
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) lput(x, y, SKY[Math.min(4, Math.floor(y / 8))]);
  // blurred greenery low on the far side
  for (let k = 0; k < 40; k++) {
    const gx = Math.floor(r() * LW), gy = 24 + Math.floor(r() * 8);
    lput(gx, gy, r() < 0.5 ? "#4f6a55" : "#5c7360");
  }
  // rain streaks in the air beyond the glass — faint diagonal hints (the live layer runs the glass drops)
  for (let k = 0; k < 30; k++) {
    const rx = Math.floor(r() * LW), ry = Math.floor(r() * LH);
    lput(rx, ry, "#8fa0ad"); if (ry + 1 < LH) lput(rx, ry + 1, "#849aa8");
  }
  // the window frame: outer border + a cross of muntins
  for (let x = 0; x < LW; x++) { lput(x, 0, "#3a2c22"); lput(x, 1, "#4a3a2c"); lput(x, LH - 1, "#2e2218"); lput(x, LH - 2, "#3a2c22"); }
  for (let y = 0; y < LH; y++) { lput(0, y, "#3a2c22"); lput(1, y, "#4a3a2c"); lput(LW - 1, y, "#2e2218"); lput(LW - 2, y, "#3a2c22"); }
  for (let y = 2; y < LH - 2; y++) { lput(19, y, "#4a3a2c"); lput(20, y, "#3a2c22"); }   // vertical muntin
  for (let x = 2; x < LW - 2; x++) { lput(x, 19, "#4a3a2c"); lput(x, 20, "#3a2c22"); }   // horizontal muntin
  // a sill catching a little water at the bottom
  for (let x = 2; x < LW - 2; x++) { lput(x, LH - 4, "#5a4632"); lput(x, LH - 5, "#6a5440"); }
  save("scene-rain.png");
}
