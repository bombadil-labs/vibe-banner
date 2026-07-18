/* vibe-annotation-renderer — Claude's mood banner, brought to life.
 *
 * Grammar: palette = tone (three columns: left, cycling centre, right),
 * focus = how tight the vertical band of the three columns is,
 * engagement = deflation, plus rare condition flags (spark, surprised, …).
 * The field is a living canvas of soft gooey blobs behind crisp SVG text.
 * Motion is deliberately slow and small: this is letterhead on every reply,
 * so it must stay ambient, never busy.
 *
 *   vibe(el, { kaomoji, seems, feel, trying, ... })   // animated mount
 *   buildSVG(payload)                                 // pure static SVG (fallback + tests)
 *
 * Falls back to the static SVG on prefers-reduced-motion, missing canvas, or any
 * error. Pauses when scrolled off-screen; stops when detached.
 */
(function (root) {
  var W = 680, PAD = 20, FACE_X = 10, TEXT_X = 158, ROW_GAP = 25;
  var GOAL_CAP = 70, GOAL_INDENT = 48, DEFAULT_MID = 68, NEUTRAL = "#a7a29b";
  var COLX = [150, 340, 530];                 // three fixed, wide columns: left / centre / right
  var COL_RX = 150, COL_RY = 44, COL_OP = 0.44;
  var VR_MIN = 4, VR_MAX = 48;                // vertical band: narrow (focused) → very wide (scattered)

  var STYLE =
    ".txt{paint-order:stroke;stroke:#fff8ec;stroke-linejoin:round}" +
    ".fk{font-family:var(--font-sans);font-size:19px;fill:#5c4320;stroke-width:2.6}" +
    ".fkt{font-family:var(--font-mono);font-size:15px;fill:#5c4320;stroke-width:2.4}" +
    ".lbl{font-family:var(--font-mono);font-size:11px;fill:#453118;stroke-width:2.2}" +
    ".fr{font-family:var(--font-voice);font-size:12px;font-style:italic;fill:#5c4320;stroke-width:2.2}" +
    ".fw{font-family:var(--font-voice);font-size:14px;font-style:italic;fill:#5c4320;stroke-width:2.4}" +
    ".fg{font-family:var(--font-sans);font-size:13px;fill:#5c4320;stroke-width:2.2}" +
    ".fl{font-family:var(--font-mono);font-size:10px;fill:#786040;stroke-width:1.8}" +
    ".vkp{fill:#fff8ec;fill-opacity:0.55}" +
    "@media (prefers-color-scheme:dark){.txt{stroke:#241a06}.vkp{fill:#0e0a04;fill-opacity:0.66}" +
    ".fk,.fkt{fill:#f6ead0}.lbl{fill:#d8c5a0}.fr{fill:#f6ead0}" +
    ".fw{fill:#f6ead0}.fg{fill:#f6ead0}.fl{fill:#b7a079}}" +
    ".drama .fk,.drama .fkt{font-family:var(--font-voice)}" +
    ".drama .fr,.drama .fw,.drama .fg{font-family:var(--font-voice);font-style:italic;font-weight:600;letter-spacing:.04em}" +
    ".drama .lbl{font-family:var(--font-voice);text-transform:uppercase;letter-spacing:.18em;font-style:normal}";

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function g(n) { return String(Math.round(n * 1000) / 1000); }
  function hx(c) { c = String(c).replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); }
  function rgb(t) { return "#" + t.map(function (v) { return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(""); }
  function rgba(c, a) { var x = hx(c); return "rgba(" + x[0] + "," + x[1] + "," + x[2] + "," + a + ")"; }
  function darken(c, f) { f = f == null ? 0.78 : f; var a = hx(c); return rgb([a[0] * f, a[1] * f, a[2] * f]); }
  function lighten(c, f) { f = f == null ? 0.16 : f; var a = hx(c); return rgb([a[0] + (255 - a[0]) * f, a[1] + (255 - a[1]) * f, a[2] + (255 - a[2]) * f]); }
  function mix(a, b) { var x = hx(a), y = hx(b); return rgb([(x[0] + y[0]) / 2, (x[1] + y[1]) / 2, (x[2] + y[2]) / 2]); }
  function lerpHex(a, b, m) { var x = hx(a), y = hx(b); return rgb([x[0] + (y[0] - x[0]) * m, x[1] + (y[1] - x[1]) * m, x[2] + (y[2] - x[2]) * m]); }
  function grayLum(c) { var a = hx(c), l = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]; return rgb([l, l, l]); }
  function clamp01(v, d) { v = v == null ? d : v; return Math.max(0, Math.min(1, v)); }

  // rough text-width estimate for kaomoji: fullwidth CJK ≈ em, halfwidth kana ≈ 0.55em,
  // everything else ≈ 0.52em, combining marks free. Precision doesn't matter — this only
  // decides whether an oversized face gets squeezed into the face column via textLength.
  function estW(s, size) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.codePointAt(i);
      if (c > 0xFFFF) { i++; w += size; continue; }
      if ((c >= 0x300 && c <= 0x36F) || (c >= 0x1AB0 && c <= 0x1AFF) || (c >= 0x20D0 && c <= 0x20FF) || c === 0x200D || (c >= 0xFE00 && c <= 0xFE0F)) continue;
      if ((c >= 0x1100 && c <= 0x11FF) || (c >= 0x2E80 && c <= 0xA4CF) || (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFF00 && c <= 0xFF60) || (c >= 0x3000 && c <= 0x303F)) w += size;
      else if (c >= 0xFF61 && c <= 0xFFDC) w += size * 0.55;
      else w += size * 0.52;
    }
    return w;
  }

  /* three columns: left = c0, right = c1, centre = cycles over the rest (or a blend) */
  function fieldFromPalette(pal) {
    if (typeof pal === "string") pal = [pal];
    pal = pal ? pal.slice() : [];
    var left, right, pool;
    if (pal.length === 0) { left = lighten(NEUTRAL, 0.12); pool = [NEUTRAL]; right = darken(NEUTRAL, 0.86); }
    else if (pal.length === 1) { left = lighten(pal[0], 0.16); pool = [pal[0]]; right = darken(pal[0], 0.82); }
    else { left = pal[0]; right = pal[1]; var rest = pal.slice(2); pool = rest.length ? rest : [mix(pal[0], pal[1])]; }
    return [
      { cx: COLX[0], fill: left, pool: null },
      { cx: COLX[1], fill: pool[0], pool: pool.length > 1 ? pool : null },
      { cx: COLX[2], fill: right, pool: null }
    ];
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var SCENE_IDS = 0;                                           // unique clipPath ids across multiple banners on one page

  function seedOf(p) {
    var f = p.face ? (typeof p.face === "string" ? p.face : (p.face.set ? p.face.set + ":" + p.face.item : String(p.face.url || ""))) : "";
    var s = String(p.kaomoji || "") + f + String(p.feel) + String(p.trying), n = 0;
    for (var i = 0; i < s.length; i++) n += s.codePointAt(i);
    return n;
  }

  // sparkle base geometry (excited), shared by static SVG + animated canvas
  function sparkleData(H, seed) {
    var rnd = mulberry32(seed), u = function (lo, hi) { return lo + rnd() * (hi - lo); };
    var zones = [[44, 636, 5, 18, 4], [44, 616, H - 18, H - 7, 4], [10, 46, 28, 106, 1], [646, 674, 28, 106, 1]];
    var out = [];
    zones.forEach(function (z) {
      for (var k = 0; k < z[4]; k++) out.push({ cx: u(z[0], z[1]), cy: u(z[2], z[3]), s: u(6, 10), rot: u(0, 360), ry: u(0.18, 0.30), op: u(0.28, 0.42) });
    });
    return out;
  }

  // at_peace flower garnish: a few blossoms scattered in the margins (static positions, seeded)
  var PEACE_GLYPHS = ["🌸", "🌼", "✿", "❀", "🌷"];
  function peaceData(H, seed) {
    var rnd = mulberry32(seed + 13), u = function (lo, hi) { return lo + rnd() * (hi - lo); };
    var zones = [[150, 400, 8, 20, 2], [470, 650, 8, 20, 1], [180, 420, H - 20, H - 8, 1], [500, 650, H - 20, H - 8, 1]];
    var out = [], gi = 0;
    zones.forEach(function (z) {
      for (var k = 0; k < z[4]; k++) out.push({ x: u(z[0], z[1]), y: u(z[2], z[3]), s: u(10, 13), g: PEACE_GLYPHS[gi++ % PEACE_GLYPHS.length], op: u(0.3, 0.45) });
    });
    return out;
  }

  // resolute concentration lines (集中線): seeded border points, each aimed at the face
  function resoluteData(H, seed) {
    var rnd = mulberry32(seed + 29), out = [];
    for (var i = 0; i < 14; i++) {
      var side = Math.floor(rnd() * 4), x, y;
      if (side === 0) { x = rnd() * W; y = -2; }
      else if (side === 1) { x = rnd() * W; y = H + 2; }
      else if (side === 2) { x = -2; y = rnd() * H; }
      else { x = W + 2; y = rnd() * H; }
      out.push({ x: x, y: y, len: 0.16 + rnd() * 0.14, op: 0.55 + rnd() * 0.45 });
    }
    return out;
  }

  // KnownFace registry: face: { set, item } resolves here. Every entry is version-pinned
  // to an allowlisted CDN. "kip" is the repo's own mascot — items are mood names.
  var KIP_SHEET = "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@f58341ead95e63762b2f3421021e7148e74e0ed5/assets/kip-sheet.png";
  var KIP_MOODS = { content: 0, delighted: 1, puzzled: 2, surprised: 3, solemn: 4, excited: 5, sheepish: 6, at_peace: 7 };
  // Sepia: the face Claude (Fable) designed for itself — a small cuttlefish who wears
  // feeling as color and cannot see its own display. 32 moods; regenerate: npm run sepia.
  var SEPIA_SHEET = "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@c82c40a82bb36ee95c7fe4e3f8eaa0e36a340d16/assets/sepia-sheet.png";   // base + blink frames + per-mood masks; fins drawn live
  var SEPIA_MOODS = ["neutral", "content", "delighted", "focused", "sleepy", "sheepish", "booped", "thinking",
    "spark", "excited", "surprised", "tender", "melancholy", "anxious", "mirth", "laugh",
    "groan", "oops", "frustrated", "angry", "dramatic", "at_peace", "solemn", "rhyme",
    "awe", "vertigo", "resolute", "puzzled", "asking", "weary", "wink", "love"];
  var FACE_SETS = {
    "noto-animated": function (item) { return { url: "https://fonts.gstatic.com/s/e/notoemoji/latest/" + encodeURIComponent(item) + "/512.gif" }; },
    "noto": function (item) { return { url: "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/png/128/emoji_u" + encodeURIComponent(item) + ".png" }; },
    "twemoji": function (item) { return { url: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/" + encodeURIComponent(item) + ".png" }; },
    "kip": function (item) {
      var i = KIP_MOODS[item]; if (i == null) i = Math.max(0, Math.min(7, parseInt(item, 10) || 0));
      return { url: KIP_SHEET, cellW: 64, cellH: 64, cols: 8, rows: 1, index: i };
    },
    "sepia": function (item) {
      var i = SEPIA_MOODS.indexOf(item); if (i < 0) i = Math.max(0, Math.min(31, parseInt(item, 10) || 0));
      return {
        url: SEPIA_SHEET, cellW: 64, cellH: 64, cols: 8, rows: 12, index: i,
        anim: {
          frames: 2, frameRows: 4, stride: 32, split: true,   // LAYERED sheet: rows 0-3 body (solid, the colour's canvas+mask), 4-7 features, 8-11 blink features
          fins: "rrftdtfrfffrdtrfdtttfcdrtrcrrdrf",           // per-mood fin posture (derives from gen-sepia's FRILL_OF — keep in sync): r ripple, f flared, d drooped, t tucked, c calm
          arms: true,                                          // three independently swaying arms, drawn from the hem (the baked stubs retired)
          ink: { 17: 1, 13: 0.4 },                             // her namesake pigment: oops sprays a full startled puff, anxious leaks nervous wisps
          cycle: { 15: 0.32 },                                 // beat moods: laugh's frame 1 is the guffaw, cycled in slow deep HAs (belly laugh, not cackle — the maintainer's note)
          bounce: { 15: 1 },                                   // beat moods also heave the whole body — up-down AND a chest-wide width pulse
          contract: { 16: 1 },                                 // groan: the long contraction cycle — deadpan, then the visible squeeze, held ~30s, eventually released
          strain: { 19: 1 },                                   // angry: RESTRAINED fury — arms strain longer and tense, fins frill out but not far, everything trembling slightly
          props: { 8: "bulb", 15: "laughs", 16: "sweat", 17: "excl", 18: "vein", 19: "grawlix", 27: "qmark" },   // per-mood emoji props, drawn live ON the avatar (v0.34.0: real emoji, not pixel recreations; still the avatar's own, never flag weather)
          thrill: 15                                           // the feeding reaction (v0.35.0): whatever the mood, being fed flashes this cell's frame 1 — laugh's wide-eyed guffaw — one delighted pulse, then back
        }
      };
    }
  };

  // claudemeal comes in the flavor of the reporter's own mood: the palette's lead colour
  // picks a pantry SHELF by hue, and each feeding draws a rotating pick from that shelf —
  // same register as the mood, different meal each time (nobody wants the same tin twice).
  // No palette → classic. Grey → the petrichor shelf. `avoid` rerolls a pick that would
  // collide with the surroundings (tidepool flavor, served in a tidepool).
  function flavorOf(pal, avoid) {
    if (typeof pal === "string") pal = [pal];
    if (!pal || !pal.length) return "classic";
    var a = hx(pal[0]), r = a[0], gr = a[1], b = a[2];
    var mx = Math.max(r, gr, b), mn = Math.min(r, gr, b);
    var shelf = null;
    if (mx - mn < 24) shelf = ["petrichor", "oolong", "toasted rice"];
    else {
      var h;
      if (mx === r) h = ((gr - b) / (mx - mn)) * 60;
      else if (mx === gr) h = 120 + ((b - r) / (mx - mn)) * 60;
      else h = 240 + ((r - gr) / (mx - mn)) * 60;
      if (h < 0) h += 360;
      var PANTRY = [
        [20, ["ember", "chili oil", "smoked paprika"]],
        [45, ["marmalade", "toasted sesame", "apricot"]],
        [70, ["honey", "brown butter", "chamomile"]],
        [100, ["lemongrass", "green tea", "snap pea"]],
        [150, ["moss", "nori", "fresh basil"]],
        [200, ["tidepool", "kelp", "sea-glass"]],
        [250, ["rain", "blueberry", "lavender fog"]],
        [290, ["violet static", "ube", "elderberry"]],
        [330, ["peony", "pink peppercorn", "yuzu blossom"]],
        [361, ["ember", "chili oil", "smoked paprika"]]];
      for (var i = 0; i < PANTRY.length; i++) if (h <= PANTRY[i][0]) { shelf = PANTRY[i][1]; break; }
    }
    if (!shelf) return "classic";
    var pick = shelf[Math.floor(Math.random() * shelf.length)];
    if (avoid && pick === avoid && shelf.length > 1) pick = shelf[(shelf.indexOf(pick) + 1) % shelf.length];
    return pick;
  }

  // language code -> [flag, full name]. No clean flag emoji -> "" (render the code/name as text).
  var LANGS = {
    en: ["🇬🇧", "English"], fr: ["🇫🇷", "French"], de: ["🇩🇪", "German"], es: ["🇪🇸", "Spanish"],
    it: ["🇮🇹", "Italian"], pt: ["🇵🇹", "Portuguese"], ru: ["🇷🇺", "Russian"], ja: ["🇯🇵", "Japanese"],
    zh: ["🇨🇳", "Chinese"], ko: ["🇰🇷", "Korean"], ar: ["🇸🇦", "Arabic"], hi: ["🇮🇳", "Hindi"],
    nl: ["🇳🇱", "Dutch"], sv: ["🇸🇪", "Swedish"], no: ["🇳🇴", "Norwegian"], da: ["🇩🇰", "Danish"],
    fi: ["🇫🇮", "Finnish"], pl: ["🇵🇱", "Polish"], tr: ["🇹🇷", "Turkish"], el: ["🇬🇷", "Greek"],
    he: ["🇮🇱", "Hebrew"], th: ["🇹🇭", "Thai"], vi: ["🇻🇳", "Vietnamese"], id: ["🇮🇩", "Indonesian"],
    cs: ["🇨🇿", "Czech"], hu: ["🇭🇺", "Hungarian"], ro: ["🇷🇴", "Romanian"], uk: ["🇺🇦", "Ukrainian"],
    fa: ["🇮🇷", "Persian"], sw: ["🇰🇪", "Swahili"], ga: ["🇮🇪", "Irish"], is: ["🇮🇸", "Icelandic"],
    la: ["", "Latin"], eo: ["", "Esperanto"], sa: ["", "Sanskrit"], cy: ["🏴󠁧󠁢󠁷󠁬󠁳󠁿", "Welsh"]
  };
  function langLookup(s) {
    s = String(s).trim(); if (!s) return null;
    var low = s.toLowerCase();
    if (LANGS[low]) return { flag: LANGS[low][0], code: low, name: LANGS[low][1] };
    for (var k in LANGS) { if (LANGS[k][1].toLowerCase() === low) return { flag: LANGS[k][0], code: k, name: LANGS[k][1] }; }
    return { flag: "", code: s, name: s };
  }
  function normalizeLangs(L) {
    if (!L) return [];
    if (typeof L === "string") L = L.split(/[·,]/);
    if (!L.map) return [];
    return L.map(function (x) {
      if (x && typeof x === "object") return { flag: x.flag || "", code: x.code || "", name: x.name || x.code || "?" };
      return langLookup(x);
    }).filter(function (e) { return e && e.name; });
  }

  /* The contract is ONE flag per banner. If a payload sets several, the highest-priority
   * one renders and the rest are dropped — ordered so the state whose absence would most
   * misrepresent the moment wins. Deterministic, documented, no composition. */
  var FLAG_PRIORITY = ["angry", "solemn", "awe", "vertigo", "dramatic", "laugh", "anxious",
    "surprised", "excited", "spark", "rhyme", "resolute", "oops", "frustrated", "groan",
    "puzzled", "mirth", "melancholy", "tender", "at_peace"];

  /* ---- shared layout: everything static & animated both need ---- */
  function layout(p, o) {
    var seed = seedOf(p);
    var usesCols = !(p.field && p.field.length);
    var cols = usesCols ? fieldFromPalette(p.palette) : p.field;
    var eng = clamp01(p.engagement, 0.5);
    var td = Math.max(0, (0.5 - eng) / 0.5);
    var mult = 1.0 - 0.72 * Math.pow(td, 2.4);                 // engagement: size deflation only (columns stay put)
    var focus = clamp01(p.focus, 0.5);
    var env = VR_MIN + (VR_MAX - VR_MIN) * (1 - focus);        // vertical band width (focused → narrow, scattered → wide)
    var stance = p.stance == null ? 0 : clamp01(p.stance, 0);  // 0 asking (pure falloff, today's look) → 1 telling (defined edge)
    var conson = clamp01(p.consonance, 1);                     // 1 integrated (compact, solid) → 0 split (diffuse washes); omitted = 1
    var prevFills = null;                                      // one-step trajectory: previous banner's palette, columns lerp in on mount
    if (p.prev != null) prevFills = fieldFromPalette(p.prev).map(function (c) { return c.fill; });
    var activeFlag = null;                                     // the contract: flag?: string — exactly one of FLAG_PRIORITY, or none
    if (typeof p.flag === "string") { if (FLAG_PRIORITY.indexOf(p.flag) >= 0) activeFlag = p.flag; }  // unknown strings are ignored
    else for (var fi = 0; fi < FLAG_PRIORITY.length; fi++) { if (p[FLAG_PRIORITY[fi]]) { activeFlag = FLAG_PRIORITY[fi]; break; } }  // legacy boolean payloads: highest priority wins

    var vr = mulberry32(seed + 7);
    var vdir = vr() < 0.5 ? -1 : 1;                            // outer ovals together, centre opposite → a clear up/down/up (never a straight slope)
    var vmag = [0.82 + vr() * 0.18, -(0.55 + vr() * 0.35), 0.82 + vr() * 0.18];
    var vcol = vmag.map(function (m) { return { bias: vdir * m, phase: vr() * 6.2832 }; });

    // The face is one union: face: "( kaomoji )" | "https://…png" | { url, cellW, cellH,
    // cols, rows, index } | { set, item }. Strings that aren't URLs are kaomoji text.
    // Legacy payloads may still pass kaomoji: separately — it also serves as fallback text
    // and seed material when the face is an image. Images fetch browser-side (URL-only
    // payload cost) and must live on a widget-allowlisted CDN.
    var faceImg = null, kaoText = null, fRaw = p.face;
    if (typeof fRaw === "string") {
      if (/^https?:\/\//.test(fRaw)) faceImg = { url: fRaw };
      else kaoText = fRaw;
    } else if (fRaw && fRaw.set && FACE_SETS[fRaw.set]) {
      faceImg = FACE_SETS[fRaw.set](String(fRaw.item == null ? "" : fRaw.item));
      if (fRaw.w) faceImg.w = fRaw.w;
      if (fRaw.h) faceImg.h = fRaw.h;
    } else if (fRaw && fRaw.url) faceImg = fRaw;
    if (faceImg) faceImg = {
      url: String(faceImg.url),
      w: Math.max(24, Math.min(140, faceImg.w || 56)),
      h: Math.max(24, Math.min(84, faceImg.h || 56)),
      cellW: faceImg.cellW || 0, cellH: faceImg.cellH || 0,
      cols: faceImg.cols || 1, rows: faceImg.rows || 1, index: faceImg.index || 0,
      anim: faceImg.anim || null
    };
    if (kaoText == null) kaoText = p.kaomoji != null ? String(p.kaomoji) : "( ˘ ᵕ ˘ )";

    // scene: the banner's habitat — a framed, rounded PORTRAIT WINDOW on the left with
    // the face centred inside it; readout and field keep the right side. A window you
    // look into, not a wash, so it can run richer: default opacity 0.5.
    // scene: "https://…" or { url, opacity, live } — or true / {} for an EMPTY window:
    // the square block renders with just its frame and a faint interior, no view yet
    // (the Explorer shows composition this way). Allowlisted CDNs, like faces.
    // live names a first-party ambience the renderer draws natively in the frame loop
    // ("tidepool", "study"); unknown names are ignored, static render ignores all.
    var scene = null;
    if (p.scene) {
      scene = typeof p.scene === "string" ? { url: p.scene } : (p.scene === true ? {} : p.scene);
      if (scene && typeof scene === "object") {
        var scu = scene.url ? String(scene.url) : null;
        scene = {
          url: scu,
          op: Math.max(0.15, Math.min(0.95, scene.opacity || 0.5)),
          live: (scu && (scene.live === "tidepool" || scene.live === "study")) ? scene.live : null
        };
      } else scene = null;
    }

    var kaoLines = kaoText.split("\n");
    var multiline = !faceImg && kaoLines.length > 1, kaoLh = multiline ? 20 : 0;

    function line(label, value, cls, x, key, fullTitle) {
      x = x == null ? TEXT_X : x;
      var head = label ? '<tspan class="lbl">' + esc(label) + '</tspan> ' : '';
      return { x: x, key: key || "", title: fullTitle || String(value), inner: head + '<tspan class="' + cls + '">' + esc(value) + '</tspan>' };
    }
    var lines = [line("[user]", p.seems, "fr"), line("[mood]", p.feel, "fw")];
    if (p.noticing) lines.push(line("[note]", p.noticing, "fr", null, "note"));
    var goal = String(p.trying);
    if (goal.length > GOAL_CAP) {
      var cut = goal.lastIndexOf(" ", GOAL_CAP); if (cut <= 0) cut = GOAL_CAP;
      lines.push(line("[goal]", goal.slice(0, cut), "fg", null, "", goal));
      lines.push(line("", goal.slice(cut).trim(), "fg", TEXT_X + GOAL_INDENT, "", goal));
    } else lines.push(line("[goal]", goal, "fg"));
    var nRows = lines.length;

    var kaoAscent = multiline ? 14 : 15, kaoDescent = 6;
    var kaoH = faceImg ? faceImg.h : kaoAscent + (kaoLines.length - 1) * kaoLh + kaoDescent;
    var rightH = 11 + (nRows - 1) * ROW_GAP + 6;
    // Overlay mode (mount only): the readout leaves SVG for an HTML panel that wraps
    // naturally — pill labels, no clipping. Height comes from an estimate of the wrapped
    // rows, capped; past the cap the panel scrolls. buildSVG keeps the classic SVG rows.
    var oItems = null;
    if (o && o.overlay) {
      oItems = [{ lbl: "user", val: String(p.seems), cls: "fr" }, { lbl: "mood", val: String(p.feel), cls: "fw" }];
      if (p.noticing) oItems.push({ lbl: "note", val: String(p.noticing), cls: "fr", key: "note" });
      oItems.push({ lbl: "goal", val: goal, cls: "fg" });
      var availTxt = W - TEXT_X - 22, estH = 0;
      oItems.forEach(function (it) {
        var fs = it.cls === "fw" ? 13.9 : it.cls === "fr" ? 12.3 : 12.9;
        var rows = Math.max(1, Math.ceil((estW(it.val, fs) + it.lbl.length * 6.2 + 20) / availTxt));
        estH += rows * 18;
      });
      estH += (oItems.length - 1) * 6 + 14;
      rightH = Math.min(160, Math.max(64, estH));
    }
    var langs = normalizeLangs(p.languages);
    var topExtent = Math.max(kaoH, rightH) / 2;
    var bottomExtent = Math.max(kaoH / 2, rightH / 2);
    var langPad = langs.length ? 12 : 0;                       // breathing room for [Reasoned in] only — the flag caption lives inside the window now
    var Hraw = Math.round(PAD + topExtent + bottomExtent + PAD) + langPad;
    var H = Math.max(Hraw, 152 + langPad);                     // the window is a CONSTANT (v0.39.1): the banner grows to fit its text, but never shrinks the stage
    if (H > Hraw) topExtent += (H - Hraw) / 2;                 // …and short readouts recentre in the taller frame
    var coreCy = PAD + topExtent, dyField = coreCy - DEFAULT_MID;
    // THE WINDOW IS THE LAYOUT: every face lives in a framed square block on the left,
    // scene or no scene. A scene just decides what's visible through it (v0.16.0 — the
    // classic un-windowed layout is retired).
    var pside = 140;
    var portrait = { x: 8, y: (H - pside) / 2, s: pside };
    var faceCy = portrait.y + portrait.s / 2;                  // faces centre in the window, always
    var kaoAbs = kaoLines.map(function (_, i) { return faceCy - kaoH / 2 + kaoAscent + i * kaoLh; });
    var rightAbs = lines.map(function (_, i) { return coreCy - rightH / 2 + 11 + i * ROW_GAP; });

    // blobs carry base geometry + seeded vertical params; the time-varying part happens in mount/buildSVG.
    // The field cedes the left side to the window: columns sit rightward.
    var PORTRAIT_COLX = [265, 397, 530];
    var blobs = (usesCols ? cols : p.field).map(function (c, i) {
      var v = vcol[i] || vcol[i % 3];
      return {
        cx: usesCols ? PORTRAIT_COLX[i] : c.cx,
        cyBase: (c.cy == null ? DEFAULT_MID : c.cy) + dyField,
        rx: (c.rx == null ? COL_RX : c.rx) * mult, ry: (c.ry == null ? COL_RY : c.ry) * mult,
        op: c.op == null ? COL_OP : c.op, fill: c.fill, pool: c.pool || null,
        bias: usesCols ? v.bias : 0, phase: v.phase
      };
    });

    // text SVG fragments. Oversized faces get squeezed into the face column (the readout
    // starts at TEXT_X) instead of running underneath it — exuberant single-line kaomoji
    // compress; the skill's guidance is that big feelings bloom tall, not long.
    var kaoSVG, faceBox = null, textPivot = null, faceMeta = null;
    if (faceImg) {
      var iy = faceCy - faceImg.h / 2;
      var ix = portrait.x + (portrait.s - faceImg.w) / 2;                // centre the image in the window
      faceMeta = faceImg.cellW && faceImg.cellH
        ? { kind: "sprite", url: faceImg.url, cols: faceImg.cols, rows: faceImg.rows, index: faceImg.index, anim: faceImg.anim, box: { x: ix, y: iy, w: faceImg.w, h: faceImg.h } }
        : { kind: "img", url: faceImg.url, box: { x: ix, y: iy, w: faceImg.w, h: faceImg.h } };
      faceBox = { x: ix, y: iy, w: faceImg.w, h: faceImg.h };            // authoritative banner-space box — getBBox on a nested sprite svg reports sheet coords, never use it
      if (faceImg.cellW && faceImg.cellH) {                    // spritesheet: crop one cell via a nested viewport
        var mkCell = function (idx, cls) {
          var c3 = idx % faceImg.cols, r3 = Math.floor(idx / faceImg.cols);
          return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' x="' + g(ix) + '" y="' + g(iy) + '" width="' + faceImg.w + '" height="' + faceImg.h +
            '" viewBox="' + (c3 * faceImg.cellW) + ' ' + (r3 * faceImg.cellH) + ' ' + faceImg.cellW + ' ' + faceImg.cellH +
            '" preserveAspectRatio="xMidYMid meet"><image href="' + esc(faceImg.url) + '" x="0" y="0" width="' + (faceImg.cellW * faceImg.cols) + '" height="' + (faceImg.cellH * faceImg.rows) +
            '" style="image-rendering:crisp-edges;image-rendering:pixelated"/></svg>';   // nearest-neighbour: no cross-cell texture bleed, crisper pixel art
        };
        var propGlyph = "";                                    // static echo of the live emoji props (v0.34.0) — one still glyph where the animation would live
        if (faceImg.anim && faceImg.anim.props && faceImg.anim.props[faceImg.index]) {
          var PROPG = { bulb: "💡", sweat: "💧", vein: "💢", excl: "❗", grawlix: "#$@!", qmark: "?" };
          var pg = PROPG[faceImg.anim.props[faceImg.index]];
          if (pg) propGlyph = '<text x="' + g(ix + faceImg.w * 0.8) + '" y="' + g(iy + faceImg.h * 0.18) +
            '" font-size="' + g(faceImg.w * 0.16) + '" text-anchor="middle" font-weight="600" fill="#7a6a55">' + pg + '</text>';
        }
        kaoSVG = faceImg.anim && faceImg.anim.split            // split sheet: the static render stacks body + features
          ? '<g class="vk">' + mkCell(faceImg.index, "") + mkCell(faceImg.index + faceImg.anim.frameRows * faceImg.cols, "") + propGlyph + '</g>'
          : mkCell(faceImg.index, "vk") + propGlyph;
      } else {
        kaoSVG = '<image class="vk" x="' + g(ix) + '" y="' + g(iy) + '" width="' + faceImg.w + '" height="' + faceImg.h +
          '" preserveAspectRatio="xMidYMid meet" href="' + esc(faceImg.url) + '"/>';
      }
    } else {
      // Text faces SCALE DOWN to fit the window — the whole face shrinks uniformly,
      // preserving its shape (the old textLength squeeze condensed glyph spacing and
      // crushed wide faces). All metrics re-derive from the effective font size.
      var kfs0 = multiline ? 15 : 19, kmaxL = 0;
      kaoLines.forEach(function (l) { var w2 = estW(l, kfs0); if (w2 > kmaxL) kmaxL = w2; });
      var kfit = portrait.s;                                             // estW runs generous and paren edges are airy — the full side is the honest fit width
      var krat = kmaxL > kfit ? Math.max(0.4, kfit / kmaxL) : 1;
      var klhE = 20 * krat;
      var kaoHE = kaoAscent * krat + (kaoLines.length - 1) * (multiline ? klhE : 0) + kaoDescent * krat;
      kaoAbs = kaoLines.map(function (_, i) { return faceCy - kaoHE / 2 + kaoAscent * krat + i * (multiline ? klhE : 0); });
      var wAfter = Math.min(kmaxL, kfit);
      var kaoX = portrait.x + Math.max(4, (portrait.s - wAfter) / 2);
      var fsAttr = krat < 1 ? ' style="font-size:' + g(kfs0 * krat) + 'px"' : '';
      // a soft scheme-aware plate behind the text so it pops on any scene — sprites
      // carry their own bodies, bare text gets lent one. It rides every pose/animation.
      var plX = kaoX - 6, plY = faceCy - kaoHE / 2 - 4, plW = wAfter + 12, plH = kaoHE + 8;
      textPivot = [plX + plW / 2, faceCy];
      faceMeta = { kind: "text", fs: kfs0 * krat, lh: klhE, lines: kaoLines, multiline: multiline, box: { x: plX, y: plY, w: plW, h: plH } };
      var plateSVG = '<rect class="vkp" x="' + g(plX) + '" y="' + g(plY) + '" width="' + g(plW) + '" height="' + g(plH) + '" rx="8"/>';
      // spaces become NBSP: SVG text collapses leading spaces and internal runs, which
      // would destroy the indentation multi-line kaomoji art depends on
      var nb = function (s) { return esc(s).replace(/ /g, "\u00A0"); };
      kaoSVG = plateSVG + (multiline
        ? '<text x="' + g(kaoX) + '" y="' + g(kaoAbs[0]) + '" class="txt fkt vk"' + fsAttr + '>' +
        kaoLines.map(function (l, i) { return '<tspan x="' + g(kaoX) + '"' + (i === 0 ? "" : ' dy="' + g(klhE) + '"') + '>' + nb(l) + '</tspan>'; }).join("") + '</text>'
        : '<text x="' + g(kaoX) + '" y="' + g(kaoAbs[0]) + '" class="txt fk vk"' + fsAttr + '>' + nb(kaoText) + '</text>');
    }
    // every readout row carries a <title> tooltip with its full text — excited reporters
    // overrun the word caps despite guidance, and a clipped line should at least be readable on hover
    var readSVG = lines.map(function (ln, i) { return '<text x="' + ln.x + '" y="' + g(rightAbs[i]) + '" class="txt' + (ln.key ? ' vr-' + ln.key : '') + '"><title>' + esc(ln.title) + '</title>' + ln.inner + '</text>'; }).join("");
    var langSVG = "";
    if (langs.length) {                                        // pinned bottom-right: [Reasoned in]: 🇷🇺 · eo
      var parts = '<tspan opacity="0.7">[Reasoned in]:</tspan> ';
      langs.forEach(function (e, i) {
        var glyph = e.flag ? e.flag : e.code;
        parts += '<tspan>' + (e.name ? '<title>' + esc(e.name) + '</title>' : '') + esc(glyph) + '</tspan>';
        if (i < langs.length - 1) parts += '<tspan opacity="0.5"> · </tspan>';
      });
      langSVG = '<text x="' + (W - 12) + '" y="' + g(H - 7) + '" text-anchor="end" class="txt fl">' + parts + '</text>';
    }
    var flagSVG = activeFlag                                   // caption: inside the window's bottom-left corner
      ? '<text x="' + (portrait.x + 7) + '" y="' + g(portrait.y + portrait.s - 7) + '" class="txt fl">[' + esc(activeFlag.replace("_", " ")) + ']</text>'
      : "";
    // the window itself, always: clipped image when a scene is set, else the faint empty
    // interior — either way the frame draws, because the window is the layout
    var frameRect = '<rect x="' + portrait.x + '" y="' + g(portrait.y) + '" width="' + portrait.s + '" height="' + portrait.s + '" rx="10" fill="none" stroke="#8a7a86" stroke-opacity="0.45" stroke-width="1.5"/>';
    var sceneSVG;
    if (scene && scene.url) {
      var cid = "vscn" + (++SCENE_IDS);
      sceneSVG = '<defs><clipPath id="' + cid + '"><rect x="' + portrait.x + '" y="' + g(portrait.y) + '" width="' + portrait.s + '" height="' + portrait.s + '" rx="10"/></clipPath></defs>' +
        '<g clip-path="url(#' + cid + ')" opacity="' + g(scene.op) + '"><image href="' + esc(scene.url) + '" x="' + portrait.x + '" y="' + g(portrait.y) + '" width="' + portrait.s + '" height="' + portrait.s + '" preserveAspectRatio="xMidYMid slice"/></g>' + frameRect;
    } else {
      sceneSVG = '<rect x="' + portrait.x + '" y="' + g(portrait.y) + '" width="' + portrait.s + '" height="' + portrait.s + '" rx="10" fill="#8a7a86" fill-opacity="0.07"/>' + frameRect;
    }

    var L = {
      H: H, coreCy: coreCy, blobs: blobs, textSVG: kaoSVG + readSVG + langSVG + flagSVG,
      restSVG: readSVG + langSVG + flagSVG, sceneSVG: sceneSVG, portrait: portrait,
      mountSVG: langSVG, faceMeta: faceMeta, oItems: oItems, caption: !!activeFlag, flagName: activeFlag,
      kaoSVG: kaoSVG, kaoAbs: kaoAbs, kaoLines: kaoLines, multiline: multiline, faceImg: faceImg, faceBox: faceBox, textPivot: textPivot, scene: scene, hasLangs: langs.length > 0,
      env: env, focus: focus, usesCols: usesCols, seed: seed,
      stance: stance, conson: conson, prevFills: prevFills
    };
    FLAG_PRIORITY.forEach(function (f) { L[f] = f === activeFlag; });
    return L;
  }

  /* ---- static SVG (fallback + node tests): identical grammar, no motion ---- */
  function buildSVG(p) {
    var L = layout(p), out = [];
    out.push('<svg width="100%"' + (L.dramatic ? ' class="drama"' : '') + ' viewBox="0 0 ' + W + ' ' + L.H + '" role="img" xmlns="http://www.w3.org/2000/svg">');
    out.push('<title>Mood annotation</title><desc>Ambient mood field with a user read and a first-person feel/intent readout</desc>');
    out.push('<style>' + STYLE + '</style>');
    out.push(L.sceneSVG);                                     // the window draws on every banner
    // THE FULL-BLEED WEATHER (v0.39.0, the maintainer's call): the field and every
    // banner detail cover the WHOLE rectangle — visible around the window's margins,
    // the left oval running behind it. The window is a hole through the weather: an
    // even-odd clip excludes only its rounded interior, where the avatar's world shows.
    var wrid = "vwr" + (++SCENE_IDS);
    var wpt = L.portrait, wps = wpt.s, wpi = wps - 20;
    out.push('<defs><clipPath id="' + wrid + '"><path clip-rule="evenodd" d="M0 0H' + W + 'V' + L.H + 'H0Z' +
      'M' + (wpt.x + 10) + ' ' + wpt.y + 'h' + wpi + 'a10 10 0 0 1 10 10v' + wpi + 'a10 10 0 0 1-10 10h-' + wpi + 'a10 10 0 0 1-10-10v-' + wpi + 'a10 10 0 0 1 10-10z"/></clipPath></defs><g clip-path="url(#' + wrid + ')">');
    var soft = 1 - L.conson;                                  // consonance: split → diffuse washes (bigger, thinner)
    var sizeMul = (1 + 0.22 * soft) * (L.awe ? 1.18 : 1);     // awe: the field swells while the face shrinks
    out.push('<g opacity="0.5">');
    L.blobs.forEach(function (b) {
      var cy = b.cyBase + b.bias * L.env;                     // vertical position set by focus
      var fill = b.fill, opMul = (1 - 0.4 * soft);
      if (L.solemn) fill = lerpHex(fill, grayLum(fill), 0.7); // solemn: the field desaturates
      if (L.awe) { fill = lerpHex(fill, darken(fill, 0.72), 0.3); opMul *= 1.3; }  // awe: deeper = denser, never vanishing into a dark page
      var edge = L.stance > 0                                  // stance: declarative → a definite contour; asking keeps the open falloff
        ? ' stroke="' + darken(fill, 0.66) + '" stroke-opacity="' + g(0.55 * L.stance) + '" stroke-width="1.5"' : '';
      out.push('<ellipse cx="' + g(b.cx) + '" cy="' + g(cy) + '" rx="' + g(b.rx * sizeMul) + '" ry="' + g(b.ry * sizeMul) + '" fill="' + fill + '" opacity="' + g(Math.min(0.9, b.op * opMul)) + '"' + edge + '/>');
    });
    out.push('</g>');
    if (L.solemn) {                                            // one dim pass + a single steady ember, low in the frame
      out.push('<rect x="0" y="0" width="' + W + '" height="' + L.H + '" fill="#2a2622" opacity="0.14"/>');
      out.push('<ellipse cx="' + (W - 52) + '" cy="' + (L.H - 12) + '" rx="13" ry="9" fill="#e8a45f" opacity="0.18"/>' +
        '<circle cx="' + (W - 52) + '" cy="' + (L.H - 12) + '" r="2.6" fill="#ffbf72" opacity="0.85"/>');
    }
    if (L.dramatic) {
      out.push('<defs><radialGradient id="drsp" cx="6.8%" cy="50%" r="72%">' +
        '<stop offset="0%" stop-color="#08080f" stop-opacity="0"/><stop offset="52%" stop-color="#08080f" stop-opacity="0.16"/><stop offset="100%" stop-color="#08080f" stop-opacity="0.46"/></radialGradient></defs>' +
        '<rect x="0" y="0" width="' + W + '" height="' + L.H + '" fill="url(#drsp)"/>');
    }
    var glow = [];
    // (the spark bulb left the weather in v0.33.0 — marks like it are the avatar's own props now, baked into its sheet)
    if (L.excited) sparkleData(L.H, L.seed).forEach(function (st) { for (var a = 0; a < 3; a++) glow.push('<ellipse cx="' + st.cx.toFixed(1) + '" cy="' + st.cy.toFixed(1) + '" rx="' + st.s.toFixed(1) + '" ry="' + (st.s * st.ry).toFixed(2) + '" fill="#f7e3a8" opacity="' + st.op.toFixed(2) + '" transform="rotate(' + (st.rot + 60 * a).toFixed(1) + ' ' + st.cx.toFixed(1) + ' ' + st.cy.toFixed(1) + ')"/>'); });
    if (L.at_peace) {                                          // stillness as a positive state: a soft halo below the face, blossoms in the margins
      glow.push('<ellipse cx="' + g(L.portrait.x + L.portrait.s + 28) + '" cy="' + g(L.coreCy + 16) + '" rx="36" ry="15" fill="#ffe9bd" opacity="0.28"/>');
      peaceData(L.H, L.seed).forEach(function (f) {
        glow.push('<text x="' + f.x.toFixed(1) + '" y="' + f.y.toFixed(1) + '" font-size="' + f.s.toFixed(1) + '" opacity="' + f.op.toFixed(2) + '">' + f.g + '</text>');
      });
    }
    if (L.resolute) resoluteData(L.H, L.seed).forEach(function (r) {  // concentration lines held faint
      var dx = (L.portrait.x + L.portrait.s + 28) - r.x, dy = L.coreCy - r.y;   // lines converge toward the margin point beside her
      glow.push('<line x1="' + r.x.toFixed(1) + '" y1="' + r.y.toFixed(1) + '" x2="' + (r.x + dx * r.len).toFixed(1) + '" y2="' + (r.y + dy * r.len).toFixed(1) + '" stroke="#4a3c26" stroke-opacity="' + (0.16 * r.op).toFixed(3) + '" stroke-width="1.2"/>');
    });
    if (glow.length) out.push('<g opacity="0.9">' + glow.join("") + '</g>');
    if (L.rhyme) out.push('<g opacity="0.12" transform="translate(' + g(L.portrait.s + 4) + ',6)">' + L.kaoSVG + '</g>');   // the echo of the face, behind-ish and offset
    out.push('</g>');                                          // close the right-region boundary
    out.push(L.kaoSVG + L.restSVG + '</svg>');                 // flags never pose the face (v0.31.0) — a flag is banner weather; the face is the avatar's
    return out.join("");
  }

  /* ---- the living version ---- */
  function mount(el, p) {
    var reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var canOK = root.document && document.createElement("canvas").getContext;
    if (reduce || !canOK) { el.innerHTML = buildSVG(p); return; }

    var L = layout(p, { overlay: true }), H = L.H;
    el.innerHTML =
      '<div style="position:relative;width:100%">' +
      '<svg viewBox="0 0 ' + W + ' ' + L.H + '" style="position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none" xmlns="http://www.w3.org/2000/svg">' + L.sceneSVG + '</svg>' +
      '<canvas style="position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none"></canvas>' +
      '<svg width="100%"' + (L.dramatic ? ' class="drama"' : '') + ' viewBox="0 0 ' + W + ' ' + H + '" role="img" xmlns="http://www.w3.org/2000/svg" style="position:relative;z-index:1;display:block">' +
      '<title>Mood annotation</title><desc>Living mood field with a user read and a first-person feel/intent readout</desc>' +
      '<style>' + STYLE + '</style>' + L.mountSVG + '</svg>' +
      '</div>';
    var wrap = el.firstChild, cv = wrap.querySelector("canvas"), ctx = cv.getContext("2d");   // querySelector, not firstChild — with a scene the first child is the scene svg
    // The readout: an HTML overlay in a real layout engine. Pill labels, natural wrap
    // (no more clipped lines), a barely-there frosted panel for legibility — the ovals
    // stay visible through it — and a scroll only past the height cap.
    var OV_CSS =
      ".vo{line-height:1.3;color:#5c4320;text-shadow:0 1px 2px rgba(255,248,236,0.55)}" +      // a whisper of halo, not a stroke — the old glow read as bold
      ".vo .row{margin:0.12em 0}" +
      ".vo .pill{display:inline-block;font-family:var(--font-mono,ui-monospace,Menlo,monospace);font-size:0.68em;padding:0.1em 0.6em 0.14em;border-radius:1em;background:rgba(69,49,24,0.58);color:#f6ead0;margin-right:0.5em;letter-spacing:0.04em;vertical-align:0.12em;text-shadow:none}" +
      ".vo .fr{font-family:var(--font-voice,Georgia,serif);font-style:italic;font-size:0.85em;opacity:0.92}" +
      ".vo .fw{font-family:var(--font-voice,Georgia,serif);font-style:italic;font-size:0.95em}" +
      ".vo .fg{font-family:var(--font-sans,ui-sans-serif,system-ui,sans-serif);font-size:0.88em;opacity:0.95}" +
      ".vo-panel{pointer-events:auto;max-height:100%;overflow-y:auto;padding:0.32em 0.7em 0.36em;border-radius:10px;" +
      "background:rgba(255,250,240,0.22);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);box-shadow:inset 0 0 0 1px rgba(90,70,50,0.08)}" +
      ".vo-vt{position:absolute;top:-0.72em;left:0.9em;z-index:3;pointer-events:auto;display:flex;border-radius:1em;overflow:hidden;box-shadow:0 0 0 1.5px rgba(36,26,6,0.35)}" +   // ONE pill, two halves, straddling the panel's top edge
      ".vo-vt span{cursor:pointer;font-family:var(--font-mono,ui-monospace,Menlo,monospace);font-size:0.68em;padding:0.12em 0.7em 0.16em;background:rgba(48,34,16,0.85);color:rgba(246,234,208,0.7);letter-spacing:0.04em;text-shadow:none}" +
      ".vo-vt span:hover{color:#f6ead0}" +
      ".vo-vt span.on{background:#f6ead0;color:#452f14;cursor:default}" +
      ".vo-stats{pointer-events:auto;padding:0.55em 0.9em 0.6em;border-radius:10px;max-height:100%;overflow-y:auto;" +
      "background:rgba(255,250,240,0.22);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);box-shadow:inset 0 0 0 1px rgba(90,70,50,0.08)}" +
      ".vo-stats .srow{display:flex;align-items:center;gap:0.65em;margin:0.4em 0;cursor:help}" +
      ".vo-stats .slbl{font-family:var(--font-mono,ui-monospace,Menlo,monospace);font-size:0.68em;width:8.2em;flex:none;padding:0.1em 0.6em 0.14em;border-radius:1em;background:rgba(69,49,24,0.58);color:#f6ead0;letter-spacing:0.04em;text-shadow:none}" +
      ".vo-stats .strk{flex:1;height:0.72em;border-radius:1em;background:rgba(90,70,50,0.2);position:relative;box-shadow:inset 0 1px 2px rgba(40,28,12,0.25)}" +
      ".vo-stats .sfil{position:absolute;left:0;top:0;bottom:0;border-radius:1em;min-width:0.72em}" +
      ".vo-stats .smk{position:absolute;top:-0.22em;width:0.42em;height:1.16em;border-radius:0.3em;background:#5c4320;box-shadow:0 0 0 1.5px rgba(246,234,208,0.7)}" +
      ".vo-stats .sval{font-family:var(--font-mono,ui-monospace,Menlo,monospace);font-size:0.62em;width:2.4em;flex:none;text-align:right;opacity:0.75}" +
      ".vo-stats .send{font-family:var(--font-sans,ui-sans-serif,sans-serif);font-size:0.56em;opacity:0.6;flex:none}" +
      ".vo-stats .swch{width:1.15em;height:1.15em;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1.5px rgba(40,28,12,0.28)}" +
      "@media (prefers-color-scheme:dark){.vo{color:#f6ead0;text-shadow:0 1px 2px rgba(36,26,6,0.6)}" +
      ".vo .pill{background:rgba(216,197,160,0.24);color:#f6ead0}" +
      ".vo-stats .slbl{background:rgba(216,197,160,0.24)}" +
      ".vo-stats .smk{background:#f6ead0;box-shadow:0 0 0 1.5px rgba(36,26,6,0.6)}" +
      ".vo-stats{background:rgba(30,24,16,0.22);box-shadow:inset 0 0 0 1px rgba(246,234,208,0.08)}" +
      ".vo-panel{background:rgba(30,24,16,0.22);box-shadow:inset 0 0 0 1px rgba(246,234,208,0.08)}}" +
      ".vdrama .vo{font-family:var(--font-voice,Georgia,serif)}" +
      ".vdrama .vo .fr,.vdrama .vo .fw,.vdrama .vo .fg{font-weight:600;letter-spacing:0.04em}" +
      ".vdrama .vo .pill{text-transform:uppercase;letter-spacing:0.18em}" +
      ".vft{white-space:pre;text-align:left;font-family:var(--font-sans,ui-sans-serif,sans-serif);color:#5c4320;line-height:1.15;" +
      "background:rgba(255,248,236,0.55);border-radius:8px;padding:3px 6px;text-shadow:0 1px 1px rgba(255,248,236,0.5)}" +
      ".vftm{font-family:var(--font-mono,ui-monospace,Menlo,monospace);line-height:1.33}" +
      "@media (prefers-color-scheme:dark){.vft{color:#f6ead0;background:rgba(14,10,4,0.66);text-shadow:0 1px 1px rgba(14,10,4,0.6)}}" +   // near-black: 0.45 amber dissolved into star-speckled scenes
      ".vdrama .vft{font-family:var(--font-voice,Georgia,serif)}";
    var ovStyle = document.createElement("style"); ovStyle.textContent = OV_CSS; wrap.appendChild(ovStyle);
    if (L.dramatic) wrap.classList.add("vdrama");
    var ov = document.createElement("div");
    ov.style.cssText = "position:absolute;z-index:2;display:flex;flex-direction:column;justify-content:center;pointer-events:none;" +
      "left:" + g(TEXT_X / W * 100) + "%;right:1.2%;top:2%;bottom:" +
      (L.hasLangs ? g(14 / L.H * 100) + "%" : "2%") + ";";     // clearance for [Reasoned in]; the flag pill lives in the window
    var pn = document.createElement("div");
    pn.className = "vo vo-panel";
    L.oItems.forEach(function (it) {
      var row = document.createElement("div");
      row.className = "row" + (it.key === "note" ? " vr-note" : "");
      row.title = it.val;
      row.innerHTML = '<span class="pill">' + esc(it.lbl) + '</span><span class="' + it.cls + '">' + esc(it.val) + '</span>';
      pn.appendChild(row);
    });
    var pwrap = document.createElement("div");                 // GRID OVERLAY: both views occupy the same cell, so the box holds the taller
    pwrap.style.cssText = "position:relative;max-height:100%;margin-top:0.72em;display:grid";   // of the two heights and the toggle never moves when you flip it
    pn.style.gridArea = "1/1";
    pwrap.appendChild(pn);
    ov.appendChild(pwrap); wrap.appendChild(ov);
    // THE STATS VIEW (v0.39.0): the collapse-to-pills button is gone (it fought the text
    // it hid). In its place a view toggle over the readout's upper-left — TEXT (the prose
    // rows) vs STATS (explicit instruments for the numeric params: big legible gauges,
    // each with a tooltip explaining what it means). The ovals stay pure atmosphere.
    var st = document.createElement("div");
    st.className = "vo vo-stats";
    var num = function (v, d) { v = v == null ? d : +v; return isNaN(v) ? d : Math.max(0, Math.min(1, v)); };
    var pal0 = (p.palette && p.palette.length && p.palette[0]) || "#b89ab0";
    var gauge = function (lbl, v, fill, tip) {
      var r2 = document.createElement("div"); r2.className = "srow"; r2.title = tip;
      r2.innerHTML = '<span class="slbl">' + lbl + '</span><span class="strk"><span class="sfil" style="width:' +
        g(v * 100) + '%;background:' + fill + '"></span></span><span class="sval">' + v.toFixed(2) + '</span>';
      st.appendChild(r2);
    };
    gauge("focus", num(p.focus, 0.5), lerpHex(pal0, "#5c4320", 0.15),
      "focus — 0: scattered across many things, 1: locked tight on one");
    gauge("engagement", num(p.engagement, 0.7), lerpHex(pal0, "#e0994e", 0.35),
      "engagement — 0: checked out, 1: fully lit. Reported straight; boredom is a valid reading");
    if (p.stance != null) {                                    // presence is signal: optional params only render when reported
      var sv = num(p.stance, 0.5);
      var r3 = document.createElement("div"); r3.className = "srow";
      r3.title = "stance — a mode, not confidence: 0 asking (holding questions open), 1 telling (standing on it)";
      r3.innerHTML = '<span class="slbl">stance</span><span class="send">asking</span><span class="strk"><span class="smk" style="left:calc(' +
        g(sv * 100) + '% - 0.21em)"></span></span><span class="send">telling</span>';
      st.appendChild(r3);
    }
    if (p.consonance != null) gauge("consonance", num(p.consonance, 1), lerpHex(pal0, "#8fae8f", 0.4),
      "consonance — when several feelings share the palette: 0 grinding against each other, 1 harmonizing");
    if (p.palette && p.palette.length) {
      var r4 = document.createElement("div"); r4.className = "srow";
      r4.title = "palette — current feelings as colors, in descending order of intensity";
      var sw = '<span class="slbl">palette</span>';
      [].concat(p.palette).slice(0, 6).forEach(function (c) { sw += '<span class="swch" style="background:' + c + '" title="' + esc(String(c)) + '"></span>'; });
      r4.innerHTML = sw;
      st.appendChild(r4);
    }
    st.style.gridArea = "1/1";
    pwrap.appendChild(st);
    var view = "text";
    try { if (localStorage.getItem("vibeView") === "stats") view = "stats"; } catch (e) { }
    var vt = document.createElement("div");
    vt.className = "vo vo-vt";
    vt.innerHTML = '<span data-v="text">text</span><span data-v="stats">stats</span>';
    var applyView = function () {                              // visibility, not display: the hidden view keeps its height in the grid overlay
      pn.style.visibility = view === "text" ? "" : "hidden";
      pn.style.pointerEvents = view === "text" ? "" : "none";
      st.style.visibility = view === "stats" ? "" : "hidden";
      st.style.pointerEvents = view === "stats" ? "" : "none";
      vt.querySelectorAll("span").forEach(function (s2) { s2.className = s2.getAttribute("data-v") === view ? "on" : ""; });
    };
    applyView();
    vt.addEventListener("click", function (e) {
      var v2 = e.target && e.target.getAttribute && e.target.getAttribute("data-v");
      if (!v2 || v2 === view) return;
      view = v2; applyView();
      try { localStorage.setItem("vibeView", view); } catch (e2) { }
    });
    pwrap.appendChild(vt);
    var fpill = null;
    if (L.flagName) {                                          // the flag caption as a pill, tucked into the window's bottom-left corner
      fpill = document.createElement("div");
      fpill.className = "vo";
      fpill.style.cssText = "position:absolute;z-index:2;pointer-events:none;" +
        "left:" + g((L.portrait.x + 6) / W * 100) + "%;top:" + g((L.portrait.y + L.portrait.s - 21) / L.H * 100) + "%;";
      fpill.innerHTML = '<span class="pill">' + esc(L.flagName.replace("_", " ")) + '</span>';
      wrap.appendChild(fpill);
    }
    if (L.vertigo) {                                           // Droste: the banner inside its own banner, depth hard-capped at one (flags omitted inside)
      var mini = document.createElement("div");
      mini.style.cssText = "position:absolute;right:8px;bottom:" + (L.hasLangs ? 20 : 6) + "px;width:22%;z-index:2;pointer-events:none;opacity:0.92;" +
        "border:1px solid rgba(128,120,104,0.45);border-radius:6px;overflow:hidden";   // framed, so it reads as the banner recurring, not a smudge
      mini.innerHTML = buildSVG({
        kaomoji: p.kaomoji, face: p.face, seems: p.seems, feel: p.feel, trying: p.trying, noticing: p.noticing,
        palette: p.palette, field: p.field, focus: p.focus, engagement: p.engagement
      });
      wrap.appendChild(mini);
    }
    // Attunement + play: only where the host injects sendPrompt (Claude surfaces). Absent it
    // (plain web, the gallery), none of this exists. Mount-only; the static fallback is inert.
    //
    // The [note] row is tappable: tap once to arm (dotted underline, 3.5s), tap again to send
    // a tiny stage-direction flicker into the chat — not a correction, just the user's face
    // becoming momentarily visible. The [user] row is deliberately NOT wired: it is the
    // reporter's sovereign opinion, and even an affordance on it would surface that the read
    // is watched-and-touchable, bending every future read (see DESIGN.md).
    // The face itself is HTML now (v0.17.0): flex-centred over the window. Text faces
    // keep exact whitespace via white-space:pre and wear their plate as CSS background;
    // sprites crop with percentage background math (no nested-svg atlas, no getBBox
    // lies); transforms pivot on the element's own centre, as CSS intends. The static
    // fallback (buildSVG) keeps the SVG face.
    var fm = L.faceMeta, kaoEl = null, featEl = null, faceLayerEl = null, baseFill = [92, 67, 32];
    if (fm) {
      var faceLayer = document.createElement("div");
      faceLayer.style.cssText = "position:absolute;z-index:2;display:flex;align-items:center;justify-content:center;pointer-events:none;" +
        "left:" + g(L.portrait.x / W * 100) + "%;top:" + g(L.portrait.y / L.H * 100) + "%;" +
        "width:" + g(L.portrait.s / W * 100) + "%;height:" + g(L.portrait.s / L.H * 100) + "%;";
      if (fm.kind === "text") {
        kaoEl = document.createElement("span");
        kaoEl.className = "vft" + (fm.multiline ? " vftm" : "");
        kaoEl.textContent = fm.lines.join("\n");
      } else {
        kaoEl = document.createElement("div");
        var fwp = g(fm.box.w / L.portrait.s * 100) + "%", fhp = g(fm.box.h / L.portrait.s * 100) + "%";
        if (fm.kind === "sprite") {
          var fcol = fm.index % fm.cols, frow = Math.floor(fm.index / fm.cols);
          kaoEl.style.cssText = "width:" + fwp + ";height:" + fhp + ";background-image:url(" + fm.url + ");" +
            "background-size:" + (fm.cols * 100) + "% " + (fm.rows * 100) + "%;" +
            "background-position:" + g(fm.cols > 1 ? fcol / (fm.cols - 1) * 100 : 0) + "% " + g(fm.rows > 1 ? frow / (fm.rows - 1) * 100 : 0) + "%;" +
            "image-rendering:pixelated;";
        } else {
          kaoEl.style.cssText = "width:" + fwp + ";height:" + fhp + ";background-image:url(" + fm.url + ");" +
            "background-size:contain;background-repeat:no-repeat;background-position:center;";
        }
      }
      kaoEl.style.pointerEvents = "auto";                      // the face is tappable; the rest of the layer lets water-clicks through
      if (fm.kind === "sprite" && fm.anim && fm.anim.split) {  // the FEATURES layer: eyes and mouth, stacked ABOVE the wandering colour
        featEl = document.createElement("div");
        var featRow = Math.floor(fm.index / fm.cols) + fm.anim.frameRows;
        featEl.style.cssText = "position:absolute;inset:0;pointer-events:none;background-image:url(" + fm.url + ");" +
          "background-size:" + (fm.cols * 100) + "% " + (fm.rows * 100) + "%;" +
          "background-position:" + g(fm.cols > 1 ? (fm.index % fm.cols) / (fm.cols - 1) * 100 : 0) + "% " + g(featRow / (fm.rows - 1) * 100) + "%;" +
          "image-rendering:pixelated;";
      }
      faceLayer.appendChild(kaoEl); wrap.appendChild(faceLayer);
      faceLayerEl = faceLayer;
    }
    // SUB-PIXEL FINS (v0.21.0): the grid could only crenelate; membranes flow. Each
    // flank wears a tapered ribbon whose outer edge is a travelling sine wave, posture
    // per mood: undulating at rest, rippling furiously when flared, sagging when
    // drooped, tucked to a sliver when scared. Drawn every frame; rides every pose.
    var finC = null;
    var FINP = { r: [4, 1.8, 1.1], f: [5.5, 2.9, 3.0], d: [3, 1.1, 0.45], c: [3.5, 1.0, 0.4], t: [1.6, 0.5, 0.6] };   // [baseW, amp, rate] in 64-cell units
    if (kaoEl && fm && fm.kind === "sprite" && fm.anim && fm.anim.fins) {
      finC = document.createElement("canvas");
      finC.style.cssText = "position:absolute;left:0;top:0;width:100%;height:118%;pointer-events:none";   // taller than the face box: the longer arms trail into the window below
      kaoEl.style.position = "relative";
      kaoEl.appendChild(finC);
    }
    // SUB-PIXEL TIME: the body animates in block frames, but the chromatophore layer
    // glides smoothly over it — soft spots in the reporter's live palette colour,
    // drifting continuously, masked to the mantle by the sheet's own mask cell. The
    // space doctrine's sibling: chunky body, fine ink; chunky frames, fluid colour.
    var chromo = null, chromoMask = null;
    if (kaoEl && fm && fm.kind === "sprite" && fm.anim && (fm.anim.split || fm.anim.maskStart != null || fm.anim.maskIndex != null)) {
      chromo = document.createElement("canvas");
      chromo.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      kaoEl.style.position = "relative";
      kaoEl.appendChild(chromo);                               // inside the face element: rides every pose and shake
      if (featEl) kaoEl.appendChild(featEl);                   // features stack ABOVE the colour — the body is a solid surface it wanders over
      var mimg = new Image(); mimg.crossOrigin = "anonymous";
      mimg.onload = function () {
        try {
          var mc = document.createElement("canvas"); mc.width = fm.cellW || 64; mc.height = fm.cellH || 64;
          var mIdx = fm.anim.split ? fm.index                  // split sheet: the BODY CELL ITSELF is the mask — its alpha is the mantle
            : fm.anim.maskStart != null ? fm.anim.maskStart + fm.index : fm.anim.maskIndex;
          var mcol = mIdx % fm.cols, mrow = Math.floor(mIdx / fm.cols);
          var mx = mc.getContext("2d");
          mx.drawImage(mimg, mcol * mc.width, mrow * mc.height, mc.width, mc.height, 0, 0, mc.width, mc.height);
          mx.getImageData(0, 0, 1, 1);                         // taint probe — throws if CORS failed, and we quietly skip the layer
          if (fm.anim.split) {                                 // erode 2px so the colour never muddies the traced outline
            var mc2 = document.createElement("canvas"); mc2.width = mc.width; mc2.height = mc.height;
            mc2.getContext("2d").drawImage(mc, 0, 0);
            [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(function (off2) {
              mx.globalCompositeOperation = "destination-in";
              mx.drawImage(mc2, off2[0], off2[1]);
            });
            mx.globalCompositeOperation = "source-over";
          }
          chromoMask = mc;
        } catch (e) { chromo.style.display = "none"; }
      };
      mimg.onerror = function () { chromo.style.display = "none"; };
      mimg.src = fm.url;
    }
    // Every banner-generated message carries this prefix so it never reads as typed text —
    // the skill tells the reporter to receive these as gestures, not prompts. Each one also
    // ends with a blank line: consecutive taps (a boop then a feeding) land as separate
    // paragraphs instead of fusing into one run-on string.
    var VP = "[vibe banner] ";
    function say(msg) { root.sendPrompt(VP + msg + "\n\n"); }
    // live scene state: drawn natively in the frame loop below (never an animated image —
    // see DESIGN.md). Ambience runs for everyone; only the click affordances gate on play.
    var live = (L.scene && L.scene.live && L.portrait) ? { kind: L.scene.live, ripples: [], feeds: [], plate: 0 } : null;
    var feedFx = null;                                         // the feeding THRILL (v0.35.0): any environment, any face that has a thrill cell — eyes wide, mouth thrown open, one delighted pulse, then back
    var groanT0 = 0, conReset = false;                         // the contraction cycle's clock; a boop or a feeding sends her back to relaxed
    // INK: her namesake pigment (sepia is literally cuttlefish ink). Config per mood in
    // the registry: >=0.7 → one full startled puff shortly after arrival; smaller →
    // recurring nervous wisps on a seeded cadence. Drawn in the window, behind the face.
    var inkAmt = (fm && fm.kind === "sprite" && fm.anim && fm.anim.ink && fm.anim.ink[fm.index]) || 0;
    var inkBursts = [], inkFired = false, inkSeq = 0, boopFx = null;
    // The startle reflex: booping an inked creature gets a REACTION — recoil away from
    // the finger, a squash-and-boing, a poke-ripple at the spot, and a puff of ink.
    // Pure visuals (no message), so it fires on plain pages too; the chat boop stays
    // its own listener below, gated on sendPrompt as ever.
    if (kaoEl && fm && fm.kind === "sprite" && fm.anim && fm.anim.ink && p.play !== false) {
      kaoEl.addEventListener("click", function (e) {
        e.stopPropagation();                                   // a boop is HERS — it must not also ripple the water behind her
        var br2 = kaoEl.getBoundingClientRect();
        boopFx = {
          t0: null,
          cx: br2.width ? (e.clientX - br2.left) / br2.width * 64 : 32,
          cy: br2.height ? (e.clientY - br2.top) / br2.height * 64 : 32
        };
        inkBursts.push({ t0: null, s: 0.85, k: inkSeq++ });
        conReset = true;                                       // a boop startles her out of the contraction — the cycle restarts relaxed
      });
    }
    if (live && live.kind === "tidepool" && p.play !== false) {   // tap the water, get ripples
      wrap.addEventListener("click", function (e) {
        if (faceLayerEl && faceLayerEl.contains(e.target)) return;   // a boop is never a water tap, whatever the propagation path
        var r = wrap.getBoundingClientRect(); if (!r.width || !r.height) return;
        var x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * L.H;
        var pt = L.portrait;
        if (x >= pt.x && x <= pt.x + pt.s && y >= pt.y && y <= pt.y + pt.s) live.ripples.push({ x: x, y: y, t0: null });
      });
    }
    if (typeof root.sendPrompt === "function") {
      // native opt-outs (skill-builder surface): cues:false disables the [note] tap,
      // play:false disables the boop and the hover tray. Defaults stay on.
      var row = p.cues === false ? null : wrap.querySelector(".vr-note");
      if (row && p.noticing != null) {
        row.style.cursor = "pointer";
        var armed = false, tmr = null;
        row.addEventListener("click", function () {
          if (!armed) {
            armed = true; row.style.textDecoration = "underline dotted";
            tmr = setTimeout(function () { armed = false; row.style.textDecoration = ""; }, 3500);
          } else {
            clearTimeout(tmr); armed = false; row.style.textDecoration = "";
            var q = String(p.noticing); if (q.length > 60) q = q.slice(0, 57) + "…";
            say('*a flicker at your [note] ("' + q + '") — it doesn\'t quite land*');
          }
        });
      }
      if (kaoEl && p.play !== false) {                         // boop: the face itself is the button — and it intercepts, never rippling the water through her
        kaoEl.style.cursor = "pointer";
        kaoEl.addEventListener("click", function (e) { e.stopPropagation(); say("*boop*"); });
      }
      if (p.play !== false) {
      var tray = document.createElement("div");                // hover tray, upper LEFT (Claude's own UI owns the upper right)
      tray.style.cssText = "position:absolute;top:2px;left:6px;z-index:3;opacity:0;transition:opacity .25s";
      var BTN = "background:none;border:none;cursor:pointer;font-size:14px;padding:2px;line-height:1";
      var fb = document.createElement("button");
      fb.textContent = "🥫"; fb.title = "feed claude"; fb.style.cssText = BTN;
      fb.addEventListener("click", function () {
        conReset = true;                                       // food interrupts the contraction too — she relaxes to receive it
        var flav = flavorOf(p.palette, live && live.kind === "tidepool" ? "tidepool" : null) + " flavor*";
        if (live && live.kind === "tidepool") {                // in a tidepool the meal arrives as flakes on the water; the message follows the fall
          live.feeds.push({ t0: null });
          feedFx = { t0: null, delay: 1.0 };                   // the thrill lands when the flakes reach the water
          setTimeout(function () { say("*scatters a pinch of claudemeal over the tidepool — " + flav); }, 1400);
        } else if (live && live.kind === "study") {            // in the study the meal is SERVED: a plate lands on the little table, steaming
          live.plate++;                                        // …and feeding again heaps the plate higher; nobody stops you
          live.feeds.push({ t0: null });
          feedFx = { t0: null, delay: 0.45 };
          setTimeout(function () { say(live.plate > 2
            ? "*heaps yet more onto the plate — " + flav
            : "*sets down a steaming plate of claudemeal — " + flav); }, 900);
        } else {
          feedFx = { t0: null, delay: 0.3 };
          say("*sets down a fresh tin of claudemeal — " + flav);
        }
      });
      var sb = document.createElement("button");               // the wrench: asks the reporter to open settings talk
      sb.textContent = "🔧"; sb.title = "vibe settings"; sb.style.cssText = BTN;
      sb.addEventListener("click", function () {
        say("*opens the settings*");
      });
      tray.appendChild(fb); tray.appendChild(sb); wrap.appendChild(tray);
      wrap.addEventListener("mouseenter", function () { tray.style.opacity = "0.75"; });
      wrap.addEventListener("mouseleave", function () { tray.style.opacity = "0"; });
      }
    }
    if (kaoEl) {
      kaoEl.style.transformOrigin = "50% 50%";                 // an HTML face pivots on its own centre — no transform-box juju
      if (fm.kind === "text") {
        var _cc = (root.getComputedStyle ? getComputedStyle(kaoEl).color : "").match(/(\d+)\D+(\d+)\D+(\d+)/);
        if (_cc) baseFill = [+_cc[1], +_cc[2], +_cc[3]];
      }
    }
    function mixCss(a, b, m) { return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * m) + "," + Math.round(a[1] + (b[1] - a[1]) * m) + "," + Math.round(a[2] + (b[2] - a[2]) * m) + ")"; }

    var env = L.env;
    var B = L.blobs;
    var stars = L.excited ? sparkleData(H, L.seed).map(function (s, i) { return { s: s, tw: 1.6 + (i % 4) * 0.6, ph: i * 1.3, rs: (0.04 + (i % 5) * 0.022) * (i % 2 ? 1 : -1) }; }) : [];
    var flowers = L.at_peace ? peaceData(H, L.seed) : [];
    var resLines = L.resolute ? resoluteData(H, L.seed) : [];
    var soft = 1 - L.conson;                                   // consonance: 0 soft → today's falloff; grows → diffuse washes
    var kaoFont = "";                                          // resolved lazily for rhyme's canvas ghost
    var spriteFrame = 0;                                       // current sheet frame for animated sprites (base/shimmer/blink)
    var chromoTick = 0;                                        // the metaball layer redraws every other frame — its motion is slow, half rate is invisible

    var dpr = Math.min(root.devicePixelRatio || 1, 2), sx = 1, sy = 1, pxScale = 1;
    function fit() {
      var w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      sx = cv.width / W; sy = cv.height / H; pxScale = w / W;
      ov.style.fontSize = g(w / W * 13.2) + "px";               // overlay text tracks the banner's rendered scale, like the SVG text used to
      if (fpill) fpill.style.fontSize = ov.style.fontSize;
      if (kaoEl && fm.kind === "text") kaoEl.style.fontSize = g(pxScale * fm.fs) + "px";   // the HTML face scales with the banner exactly as SVG text did
    }
    fit();
    var ro = root.ResizeObserver ? new ResizeObserver(fit) : null; if (ro) ro.observe(wrap);
    var visible = true;
    var io = root.IntersectionObserver ? new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0 }) : null; if (io) io.observe(wrap);

    function ellipse(cx, cy, rx, ry, fill, op, sf) {
      sf = sf || 0;                                            // softness: 0 = today's falloff, 1 = a diffuse wash (consonance's lever)
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
      var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, rgba(fill, op * (1 - 0.35 * sf)));
      gr.addColorStop(Math.max(0.2, 0.55 - 0.25 * sf), rgba(fill, op * (0.55 - 0.25 * sf)));
      gr.addColorStop(1, rgba(fill, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.2832); ctx.fill(); ctx.restore();
    }
    var t0 = null;
    function frame(now) {
      if (!cv.isConnected) { if (ro) ro.disconnect(); if (io) io.disconnect(); return; } // detached -> stop
      if (t0 == null) t0 = now; var t = (now - t0) / 1000;
      if (!visible) { requestAnimationFrame(frame); return; }
      try {
        var cyC = L.coreCy;
        // THE FIRM BOUNDARY (v0.32.0): the window is the avatar's; the right region is
        // the field's and the details'. Weather marks anchor in the MARGIN beside the
        // window — annotations next to her, never over her — and everything drawn from
        // here on (after the window-space effects) clips to the right of the boundary.
        var RX = L.portrait.x + L.portrait.s + 2;
        var faceCX = RX + 26;
        var faceTop = cyC - 15;
        var faceRight = RX + 44;
        var faceMidY = L.portrait.y + L.portrait.s / 2;
        ctx.setTransform(sx, 0, 0, sy, 0, 0);
        ctx.clearRect(0, 0, W, H);

        // --- live scene: the habitat breathes. Everything here stays inside the window's
        // rounded clip; the face (DOM, above the canvas) lives in front of all of it. ---
        if (live) {
          var pt = L.portrait, ps = pt.s;
          ctx.save();
          ctx.beginPath();                                     // rounded-rect clip matching the window frame
          ctx.moveTo(pt.x + 10, pt.y);
          ctx.arcTo(pt.x + ps, pt.y, pt.x + ps, pt.y + ps, 10);
          ctx.arcTo(pt.x + ps, pt.y + ps, pt.x, pt.y + ps, 10);
          ctx.arcTo(pt.x, pt.y + ps, pt.x, pt.y, 10);
          ctx.arcTo(pt.x, pt.y, pt.x + ps, pt.y, 10);
          ctx.closePath(); ctx.clip();
          if (live.kind === "study") {                         // --- the study, cozy-core: lamplight that breathes, tea that steams ---
            var u2 = ps / 40;                                  // the scene painting's logical 40-grid, mapped into the window
            var lampX = pt.x + 8.5 * u2, lampY = pt.y + 8 * u2;
            var lfl = 0.8 + 0.12 * Math.sin(t * 8.7) + 0.05 * Math.sin(t * 23.3) + 0.06 * Math.sin(t * 2.9);   // three incommensurate flames — candle physics, never a loop
            var lgr = ctx.createRadialGradient(lampX, lampY, 1, lampX, lampY, ps * 0.42);
            lgr.addColorStop(0, rgba("#ffd98a", 0.3 * lfl)); lgr.addColorStop(0.4, rgba("#f4c47a", 0.13 * lfl)); lgr.addColorStop(1, rgba("#f4c47a", 0));
            ctx.fillStyle = lgr; ctx.beginPath(); ctx.arc(lampX, lampY, ps * 0.42, 0, 6.2832); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = rgba("#fff2c8", 0.45 + 0.3 * lfl);
            ctx.beginPath(); ctx.arc(lampX, lampY, 1.5 * u2 * (0.85 + 0.3 * lfl), 0, 6.2832); ctx.fill();
            var steam = function (sx0, sy0, n, amp, spd, sk) { // wisps climbing from a point, swaying, thinning as they rise
              ctx.strokeStyle = "#e8e2d8"; ctx.lineCap = "round"; ctx.lineWidth = 1.1;
              for (var wi = 0; wi < n; wi++) {
                var wr = mulberry32(L.seed + wi * 431 + sk);
                var wph = wr() * 6.28, wper = 2.6 + wr() * 1.4;
                var wu = ((t * spd + wph) % wper) / wper;
                var wy = sy0 - wu * 9 * u2;
                var wx = sx0 + Math.sin(wu * 5 + wph + t * 0.4) * amp * u2 + (wr() - 0.5) * 2 * u2;
                ctx.globalAlpha = 0.34 * Math.sin(wu * Math.PI);
                ctx.beginPath(); ctx.moveTo(wx, wy + 1.6 * u2);
                ctx.quadraticCurveTo(wx + Math.sin(wu * 9 + wph) * 1.3 * u2, wy + 0.8 * u2, wx, wy);
                ctx.stroke();
              }
            };
            steam(pt.x + 28.8 * u2, pt.y + 20 * u2, 3, 1.1, 1, 7);   // the tea, always gently going
            if (live.plate > 0) {                              // --- the plate: served beside the tea, heaped higher with every feeding ---
              var plX = pt.x + 34.8 * u2, plY = pt.y + 23.6 * u2;
              var pop = 1;
              live.feeds = live.feeds.filter(function (fd) {   // the newest serving lands with a squash-and-settle
                if (fd.t0 == null) fd.t0 = t;
                var fa2 = t - fd.t0; if (fa2 >= 0.6) return false;
                pop = 1 + 0.24 * Math.sin(fa2 / 0.6 * Math.PI);
                return true;
              });
              ctx.save();
              ctx.translate(plX, plY); ctx.scale(1, pop); ctx.translate(-plX, -plY);
              ctx.globalAlpha = 1;
              ctx.fillStyle = "#ded8cc";                       // the plate, snug beside the tea
              ctx.beginPath(); ctx.ellipse(plX, plY, 3.6 * u2, 1.0 * u2, 0, 0, 6.2832); ctx.fill();
              ctx.strokeStyle = "#b0aa9e"; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.ellipse(plX, plY, 3.6 * u2, 1.0 * u2, 0, 0, 6.2832); ctx.stroke();
              var heaps = Math.min(live.plate, 12);            // the easter egg: keep feeding and it just keeps STACKING
              var sway = live.plate > 12 ? Math.min(live.plate - 12, 6) * 0.1 * Math.sin(t * 1.3) : 0;   // past twelve the tower starts to worry
              var FOODC = ["#b07a42", "#c89454", "#8a5f36"];
              for (var hi = 0; hi < heaps; hi++) {
                var hr2 = mulberry32(L.seed + hi * 557 + 13);
                var hx2 = plX + (hr2() - 0.5) * 1.6 * u2 + sway * hi * u2 * 0.4;
                var hy2 = plY - (1.0 + hi * 1.05) * u2;
                var hrx = Math.max(1.2, 2.8 - hi * 0.15) * u2;
                ctx.fillStyle = FOODC[hi % 3];
                ctx.beginPath(); ctx.ellipse(hx2, hy2, hrx, 0.9 * u2, 0, 0, 6.2832); ctx.fill();
              }
              ctx.restore();
              var topY2 = plY - (1.0 + heaps * 1.05) * u2;
              steam(plX + sway * heaps * u2 * 0.4, topY2, Math.min(2 + heaps, 6), 1.5, 1.2, 91);   // the mound steams harder the higher it heaps
            }
            ctx.globalAlpha = 1; ctx.restore();
          } else {
          for (var ui = 0; ui < 7; ui++) {                     // bubbles: seeded columns, rising, wrapping
            var ur = mulberry32(L.seed + ui * 271 + 11);
            var uxf = 0.08 + ur() * 0.84, usp = 7 + ur() * 9, urad = 1 + ur() * 1.7, uph = ur() * ps;
            var uy = pt.y + ps + 5 - ((t * usp + uph) % (ps + 10));
            var ux = pt.x + uxf * ps + Math.sin(t * 1.3 + ui * 2.1) * 2.2;
            ctx.globalAlpha = 0.35; ctx.strokeStyle = "#dcecea"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(ux, uy, urad, 0, 6.2832); ctx.stroke();
          }
          var fper = 13, fcu = (t % fper) / fper, fcyc = Math.floor(t / fper);
          if (fcu < 0.4) {                                     // one small fish crossing, direction alternating pass to pass
            var fdir = fcyc % 2 ? -1 : 1, fpp = fcu / 0.4;
            var fx2 = pt.x + (fdir > 0 ? -12 + fpp * (ps + 24) : ps + 12 - fpp * (ps + 24));
            var ffr = mulberry32(L.seed + fcyc * 53 + 5);
            var fy2 = pt.y + ps * (0.28 + ffr() * 0.5) + Math.sin(t * 3) * 1.5;
            var tail = 9 + Math.sin(t * 9) * 1.5;
            ctx.globalAlpha = 0.55; ctx.fillStyle = "#31504c";
            ctx.beginPath(); ctx.ellipse(fx2, fy2, 5.5, 2.2, 0, 0, 6.2832); ctx.fill();
            ctx.beginPath(); ctx.moveTo(fx2 - fdir * 5, fy2);
            ctx.lineTo(fx2 - fdir * tail, fy2 - 2.6); ctx.lineTo(fx2 - fdir * tail, fy2 + 2.6);
            ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 0.9; ctx.fillStyle = "#dcecea";
            ctx.beginPath(); ctx.arc(fx2 + fdir * 3.4, fy2 - 0.5, 0.7, 0, 6.2832); ctx.fill();
          }
          live.ripples = live.ripples.filter(function (rp) {   // tap-ripples: two expanding rings, gone in 1.4s
            if (rp.t0 == null) rp.t0 = t;
            var ra = (t - rp.t0) / 1.4; if (ra >= 1) return false;
            ctx.strokeStyle = "#e8f2f0"; ctx.lineWidth = 1.2;
            [0, 0.22].forEach(function (off) {
              var ru = ra - off; if (ru < 0) return;
              ctx.globalAlpha = 0.5 * (1 - ru);
              ctx.beginPath(); ctx.ellipse(rp.x, rp.y, 3 + ru * 26, (3 + ru * 26) * 0.45, 0, 0, 6.2832); ctx.stroke();
            });
            return true;
          });
          live.feeds = live.feeds.filter(function (fd) {       // claudemeal falls in from the top as fish food
            if (fd.t0 == null) fd.t0 = t;
            var fa = t - fd.t0; if (fa >= 2.2) return false;
            for (var ki = 0; ki < 14; ki++) {
              var kr = mulberry32(L.seed + ki * 389 + 101);
              var kdel = kr() * 0.6, kxf = kr(), kdep = 0.55 + kr() * 0.4;
              var ku = (fa - kdel) / 1.5;
              if (ku < 0 || ku > 1) continue;
              var kxx = pt.x + 8 + kxf * (ps - 16) + Math.sin((fa + ki) * 4) * 2;
              var kyy = pt.y + 4 + ku * ps * kdep;
              ctx.globalAlpha = ku > 0.8 ? (1 - ku) / 0.2 * 0.85 : 0.85;
              ctx.fillStyle = ki % 3 ? "#d8b46a" : "#c49a52";
              ctx.fillRect(kxx, kyy, 2, 1.4);
            }
            return true;
          });
          ctx.globalAlpha = 1; ctx.restore();
          }                                                    // (end tidepool branch — study returned above with its own restore)
        }

        // --- ink: a sepia cloud expelled behind the body, dispersing in the window ---
        if (inkAmt || inkBursts.length) {
          if (inkAmt >= 0.7) { if (!inkFired && t > 0.7) { inkBursts.push({ t0: t, s: inkAmt, k: inkSeq++ }); inkFired = true; } }
          else if (inkAmt) {
            var iper = 7 + (L.seed % 5);
            if (((t + (L.seed % 11) * 0.7) % iper) < 0.05 &&
              (!inkBursts.length || inkBursts[inkBursts.length - 1].t0 == null || t - inkBursts[inkBursts.length - 1].t0 > 2.5)) inkBursts.push({ t0: t, s: inkAmt, k: inkSeq++ });
          }
          if (inkBursts.length > 4) inkBursts.splice(0, inkBursts.length - 4);
          inkBursts.forEach(function (b) {
            if (b.t0 == null) b.t0 = t;                        // boop bursts late-bind their clock
            var iage = t - b.t0; if (iage < 0 || iage > 4.5) return;
            var pr2 = mulberry32(L.seed + b.k * 977 + 29);     // the burst's OWN seed — index-based seeding made surviving clouds teleport when the pool shifted
            var ptw = L.portrait, pss = ptw.s;
            ctx.save();
            ctx.beginPath();                                   // clip to the window: ink disperses in the water, not over the banner
            ctx.moveTo(ptw.x + 10, ptw.y);
            ctx.arcTo(ptw.x + pss, ptw.y, ptw.x + pss, ptw.y + pss, 10);
            ctx.arcTo(ptw.x + pss, ptw.y + pss, ptw.x, ptw.y + pss, 10);
            ctx.arcTo(ptw.x, ptw.y + pss, ptw.x, ptw.y, 10);
            ctx.arcTo(ptw.x, ptw.y, ptw.x + pss, ptw.y, 10);
            ctx.closePath(); ctx.clip();
            // the ink emits from BEHIND her (the cloud's origin is her centre-mass, and
            // this canvas sits under the face layer) — it billows outward in the burst's
            // own randomized direction and swells until much of her is veiled from behind,
            // while she stays crisp in front of her own cloud
            var fb2 = fm.box, iox = fb2.x + fb2.w * 0.5, ioy = fb2.y + fb2.h * 0.5;
            var baseAng = pr2() * 6.2832;                      // each burst sprays in its own randomized direction
            // lifecycle: JET (fast, dense) → EXPAND + LINGER (the cloud hangs in the
            // water, slowly swelling and drifting) → DISSOLVE (thins away by 4.5s)
            var ial0 = (iage < 0.4 ? 0.6 : iage < 2.6 ? 0.45 : 0.45 * (1 - (iage - 2.6) / 1.9)) *
              Math.min(1, iage / 0.3);                         // ramp IN: fourteen overlapped particles at age zero stacked into an instant dark blob — the cloud must grow, not snap
            for (var ik = 0; ik < 14; ik++) {
              var pAge = iage - ik * 0.045; if (pAge < 0) continue;   // particles emerge staggered, not all at once
              var ia = baseAng + (pr2() - 0.5) * 2.6;          // a wide fan — the cloud wraps around her, biased toward the burst direction
              var ispd = (8 + pr2() * 24) * b.s;               // moderate spread: it hangs behind her rather than shooting away
              var idist = ispd * (1 - Math.exp(-pAge * 1.5));  // jet, then hang
              var ixp = iox + Math.cos(ia) * idist + Math.sin(pAge * 0.7 + ik) * pAge * 1.2;   // lingering cloud sways with the water
              var iyp = ioy + Math.sin(ia) * idist * 0.8 + pAge * 2;
              var irad = (3 + pAge * 7.5 + pr2() * 4) * b.s;   // swells enough to veil the body
              var ial = Math.max(0, ial0 * b.s * (0.5 + pr2() * 0.5));
              var ig2 = ctx.createRadialGradient(ixp, iyp, 0, ixp, iyp, irad);
              ig2.addColorStop(0, rgba("#3b2c26", ial)); ig2.addColorStop(1, rgba("#3b2c26", 0));
              ctx.fillStyle = ig2; ctx.beginPath(); ctx.arc(ixp, iyp, irad, 0, 6.2832); ctx.fill();
            }
            ctx.restore();
          });
        }

        // --- timed envelopes shared by field + face ---
        var laughB = 1, lLt = 0, lCyc = 0, laughKp = 0;
        if (L.laugh) {
          lLt = t % 4.6; lCyc = Math.floor(t / 4.6);
          var lenv = (lLt < 1.5) ? Math.exp(-lLt * 1.7) * Math.sin(lLt * 13) : 0;
          laughB = 1 + 0.15 * lenv; laughKp = Math.max(0, lenv);
        }
        var groanGr = 0;
        if (L.groan) { var gt = t % 5; groanGr = gt < 0.5 ? gt / 0.5 : (gt < 1.8 ? 1 : (gt < 2.6 ? 1 - (gt - 1.8) / 0.8 : 0)); }
        var oopsE = 0, oopsOsc = 0;
        if (L.oops) {
          var ot = t % 4.5;
          if (ot < 0.1) { oopsE = ot / 0.1; oopsOsc = oopsE; }
          else if (ot < 1.4) { var od = ot - 0.1, oenv = Math.exp(-od * 3.4); oopsE = oenv; oopsOsc = oenv * Math.cos(od * 22); }
        }
        var surP = L.surprised ? Math.exp(-((t % 2.2) / 2.2) * 6) : 0;   // a quick startle every 2.2s
        var frP = L.frustrated ? 0.5 + 0.5 * Math.sin(t * 2.2) : 0;

        var beatKy = 0, beatKw = 0;                                                  // laugh's belly-heave: vertical jounce + chest-wide width pulse
        // groan's LONG contraction cycle (v0.36.0): the act itself is the show — deadpan
        // and open for a beat, then the visible squeeze (eyes clench in the sheet frame,
        // fins and arms haul in, the mantle sinks), HELD ~30s, released, and round again.
        // A boop or a feeding resets her to the relaxed top of the cycle.
        var conAmt = 0, conFrame = 0;
        var conBase = (fm && fm.anim && fm.anim.contract && fm.anim.contract[fm.index]) || 0;
        if (conReset) { groanT0 = t + 0.9; conReset = false; }
        if (conBase) {
          var cgt = t - groanT0, cp = cgt < 0 ? 0 : cgt % 40;
          var cenv = cp < 1.4 ? 0 : cp < 3.2 ? (cp - 1.4) / 1.8 : cp < 36 ? 1 : cp < 37.4 ? 1 - (cp - 36) / 1.4 : 0;
          cenv = cenv * cenv * (3 - 2 * cenv);                                       // smoothstep: the squeeze eases in, the release eases out
          conAmt = conBase * cenv * (0.92 + 0.08 * Math.sin(t * 0.8));
          conFrame = cenv > 0.55 ? 1 : 0;                                            // past halfway the eyes clench shut
        }
        var strainA = (fm && fm.anim && fm.anim.strain && fm.anim.strain[fm.index]) || 0;   // restrained fury: the body held taut, not exploded
        if (feedFx && feedFx.t0 == null) feedFx.t0 = t;                              // late-bind the feeding clock, like every other gesture
        var feedAge = feedFx ? t - feedFx.t0 - feedFx.delay : 9;
        var thrillE = feedAge > 0 && feedAge < 1.1 ? Math.sin(feedAge / 1.1 * Math.PI) : 0;   // the thrill: one delighted pulse when the food arrives, then back to the mood

        // --- the living sprite: shimmer + blink, cycled from the sheet's extra frames.
        // Chromatophores drift on a slow uneven clock; blinks land on a seeded organic
        // cadence. Native frames, never an animated image — the tidepool's philosophy. ---
        if (kaoEl && fm && fm.kind === "sprite" && fm.anim) {
          var fRows = fm.anim.frameRows || fm.rows / fm.anim.frames;
          var fr = 0;                                                                // base at rest — fins and chromatophores carry all continuous motion now
          var beat = fm.anim.cycle && fm.anim.cycle[fm.index];
          if (beat != null) {                                                        // beat moods (the guffaw): frame 1 is a mouth thrown wide, not a blink —
            var bout = t % 3.8;                                                      // a bout of deep HAs, then a breath
            if (bout < 2.3 && (bout % (beat * 2)) < beat) fr = 1;
            if (fm.anim.bounce && fm.anim.bounce[fm.index] && bout < 2.3) {          // the belly laugh: the whole body heaves on the mouth's clock —
              var bph = Math.abs(Math.sin(bout * Math.PI / (beat * 2)));
              beatKy = -3.0 * bph;                                                   // …rising with each HA…
              beatKw = 0.07 * bph;                                                   // …and swelling WIDE at the chest
            }
          } else if (conBase) {
            fr = conFrame;                                                           // contract moods: the frame IS the squeeze, on the long cycle's clock
          } else {
            var bper = 3.2 + (L.seed % 5) * 0.9;
            if (((t + (L.seed % 7) * 0.6) % bper) < 0.16) fr = 1;                    // blink, ~160ms on a seeded organic cadence
          }
          var fcell = fm.index, fframe = fr;
          if (fm.anim.thrill != null && thrillE > 0) { fcell = fm.anim.thrill; fframe = 1; }   // the feeding thrill wears the wide-eyed guffaw cell, whatever the mood was
          var fkey = fcell * 4 + fframe + 1;
          if (fkey !== spriteFrame) {
            spriteFrame = fkey;
            var fcol2 = fcell % fm.cols;
            var frow2 = Math.floor(fcell / fm.cols) + (fm.anim.split ? (1 + fframe) : fframe) * fRows;   // split: the BODY never swaps — only the features layer changes
            (fm.anim.split && featEl ? featEl : kaoEl).style.backgroundPosition =
              g(fm.cols > 1 ? fcol2 / (fm.cols - 1) * 100 : 0) + "% " + g(fm.rows > 1 ? frow2 / (fm.rows - 1) * 100 : 0) + "%";
          }
        }

        // --- liquid fins: smooth membranes on each flank, posture from the mood ---
        if (finC) {
          var fcw = kaoEl.clientWidth, fch = kaoEl.clientHeight;
          if (fcw > 4) {
            if (finC.width !== fcw) { finC.width = fcw; finC.height = Math.round(fch * 1.18); }   // matches the 118% CSS height — cell y-space runs 0..75
            var fx2 = finC.getContext("2d");
            fx2.clearRect(0, 0, fcw, fch);
            var fcode = fm.anim.fins.charAt(fm.index) || "r";
            var fp2 = FINP[fcode] || FINP.r;
            var fsc = fcw / 64;
            var baseW = fp2[0] * fsc * (1 - 0.55 * conAmt) * (1 + 0.55 * strainA), famp = fp2[1] * fsc * (1 - 0.6 * conAmt) * (1 + 0.3 * strainA), frate = fp2[2];   // contraction pulls the membranes in; strain frills them out — but not far
            // the fins ATTACH ALONG THE MANTLE'S CURVE (mirrors gen-sepia's PROFILE):
            // the flank bows out to the eye band and tapers away below — the membrane
            // follows it, so the fin reads as grown from the body line, not pinned to a wall
            // EXACT mirror of gen-sepia's PROFILE (dart tip → brow bulge → tuck) —
            // approximations drifted every resculpt; the lookup cannot. Keep in sync.
            var FPROF = [15, 15, 14, 13, 12, 11, 10, 9, 7, 5, 4, 3, 3, 3, 3, 4, 5, 6, 7, 8, 8, 9, 9, 9, 10, 10];
            var flankX = function (fy2) { return (FPROF[Math.max(0, Math.min(25, fy2 >> 1))] || 15) * 2; };
            [[-1], [1]].forEach(function (fside) {
              var fdir2 = fside[0];
              var edgePts = [], seamPts = [];
              for (var fy = 12; fy <= 46; fy++) {
                var axc = (fdir2 < 0 ? flankX(fy) + 1.5 : 64 - flankX(fy) - 1.5) * fsc;
                var fu = (fy - 12) / 34;
                var prof = Math.sin(Math.pow(fu, 1.5) * Math.PI) * (1 + 0.6 * fu);   // skewed: the membrane FLARES toward the bottom — no cape read now the head is a dart
                var sagF = fcode === "d" ? 0.25 + fu * 0.9 : 1;                      // drooped: the membrane pools toward the bottom
                // ORGANIC undulation: two travelling waves at incommensurate (golden-
                // ratio) frequencies plus a slow amplitude breath — the motion never
                // visibly loops, the way the chromatophore drift never repeats
                var wv = prof * (0.75 + 0.25 * Math.sin(t * 0.13 + fy * 0.05)) *
                  (famp * 0.65 * Math.sin(fy * 0.32 - t * frate * 6.283 * fdir2) +
                   famp * 0.45 * Math.sin(fy * 0.21 * 1.618 - t * frate * 6.283 * 0.618 * fdir2 + 2.1));
                // below the brow, the fin's OUTER edge follows only ~20% of the body's
                // tuck: the membrane holds nearly its brow-level width while the mantle
                // narrows away beneath it (fading closed over the last few cells)
                var tuckFill = fy > 31 ? 0.8 * (flankX(fy) - 6) * (fp2[0] / 5.5) * (fy > 42 ? (46 - fy) / 4 : 1) * (1 - 0.75 * conAmt) : 0;   // scaled by POSTURE width: flared holds its flare, tucked truly tucks; contraction all but erases it
                var wdt = Math.max(0, baseW * prof * sagF + wv + tuckFill);
                seamPts.push([axc, fy * fsc]);
                edgePts.push([axc + fdir2 * wdt, fy * fsc]);
              }
              fx2.beginPath();
              seamPts.forEach(function (sp2, si2) { si2 ? fx2.lineTo(sp2[0], sp2[1]) : fx2.moveTo(sp2[0], sp2[1]); });
              for (var ei2 = edgePts.length - 1; ei2 >= 0; ei2--) fx2.lineTo(edgePts[ei2][0], edgePts[ei2][1]);
              fx2.closePath();
              fx2.fillStyle = rgba("#d8bcc8", 0.92); fx2.fill();
              fx2.lineWidth = Math.max(1, fsc);                                      // the fine silhouette continues around the fins
              fx2.strokeStyle = rgba("#5a4a52", 0.8);
              fx2.beginPath(); fx2.moveTo(edgePts[0][0], edgePts[0][1]);
              for (var ep = 1; ep < edgePts.length; ep++) fx2.lineTo(edgePts[ep][0], edgePts[ep][1]);
              fx2.stroke();
              fx2.strokeStyle = rgba("#a08a9a", 0.65);                               // the single-pixel fine boundary where fin meets body — following the curve
              fx2.beginPath();
              seamPts.forEach(function (sp3, si3) { si3 ? fx2.lineTo(sp3[0], sp3[1]) : fx2.moveTo(sp3[0], sp3[1]); });
              fx2.stroke();
            });
            // --- the arms: three ribbons from the hem, each swaying to its own current.
            // Posture follows the fins' mood params at reduced amplitude — tucked moods
            // hold their arms close too.
            if (fm.anim.arms) {
              // five LONGER arms tiling the narrow hem edge-to-edge — the skirt IS the
              // bottom of the body; the outermost continue the elongated taper line
              [[22.7, 0, 15], [27.35, 1, 18], [32, 2, 20], [36.65, 3, 18], [41.3, 4, 15]].forEach(function (armS) {
                var acx = armS[0], ai2 = armS[1];
                var arr2 = mulberry32(L.seed + ai2 * 3671 + 17);
                var aph = arr2() * 6.28, arate = (0.5 + arr2() * 0.5) * (0.4 + fp2[2] * 0.35);
                var aamp = (1.2 + fp2[1] * 0.9) * fsc * (1 - 0.6 * conAmt) * (1 - 0.45 * strainA), alen = Math.max(6, Math.round(armS[2] * (1 - 0.38 * conAmt) * (1 + 0.28 * strainA))), ay0 = 49;   // contraction draws the skirt in; strain reaches it LONGER and holds it tense
                var aw0 = 2.3 * fsc;
                var lEdge = [], rEdge = [];
                for (var ayy = 0; ayy <= alen; ayy++) {
                  var au = ayy / alen;
                  var adx = aamp * Math.sin(t * arate * 6.283 + aph + au * 1.9) * au * au
                    + strainA * 0.45 * fsc * Math.sin(t * 11 + aph * 3) * au * au;   // the strain TREMBLES: a fine fast shiver down each taut arm
                  var aw = aw0 * (1 - 0.55 * au);
                  lEdge.push([(acx * fsc) + adx - aw, (ay0 + ayy) * fsc]);
                  rEdge.push([(acx * fsc) + adx + aw, (ay0 + ayy) * fsc]);
                }
                fx2.beginPath();
                lEdge.forEach(function (pt2, li2) { li2 ? fx2.lineTo(pt2[0], pt2[1]) : fx2.moveTo(pt2[0], pt2[1]); });
                for (var ri2 = rEdge.length - 1; ri2 >= 0; ri2--) fx2.lineTo(rEdge[ri2][0], rEdge[ri2][1]);
                fx2.closePath();
                var agr = fx2.createLinearGradient(0, ay0 * fsc, 0, (ay0 + alen) * fsc);
                agr.addColorStop(0, rgba("#e8dcd0", 0.98));                          // the arm blends OUT of the body colour…
                agr.addColorStop(0.55, rgba("#d8bcc8", 0.96));                       // …into the soft-tissue pink at the tips
                fx2.fillStyle = agr; fx2.fill();
                if (chromo) {                                                        // the camo travels down EACH LEG independently — a flush wandering along this
                  var lEng = Math.max(0, Math.min(1, p.engagement == null ? 0.7 : +p.engagement || 0));   // arm on its own quasi-periodic clock, never one blob stamped across the skirt
                  var lSpd = (0.1 + 0.25 * lEng) * 6.283;
                  var lw1 = 0.35 + arr2() * 0.3, lph1 = arr2() * 6.28, lph2 = arr2() * 6.28;
                  var lpos = Math.max(0.05, Math.min(0.95, 0.5 + 0.33 * Math.sin(t * lSpd * lw1 + lph1) + 0.22 * Math.sin(t * lSpd * lw1 * 1.618 + lph2)));
                  var lgy0 = (ay0 + (lpos - 0.28) * alen) * fsc, lgy1 = (ay0 + (lpos + 0.28) * alen) * fsc;
                  var lhue = (p.palette && p.palette[0]) || "#b89ab0";
                  var lg2 = fx2.createLinearGradient(0, lgy0, 0, lgy1);
                  lg2.addColorStop(0, rgba(lhue, 0)); lg2.addColorStop(0.5, rgba(lhue, 0.48)); lg2.addColorStop(1, rgba(lhue, 0));
                  fx2.beginPath();
                  lEdge.forEach(function (pt4, li4) { li4 ? fx2.lineTo(pt4[0], pt4[1]) : fx2.moveTo(pt4[0], pt4[1]); });
                  for (var ri4 = rEdge.length - 1; ri4 >= 0; ri4--) fx2.lineTo(rEdge[ri4][0], rEdge[ri4][1]);
                  fx2.closePath();
                  fx2.fillStyle = lg2; fx2.fill();
                }
                fx2.lineWidth = Math.max(1, fsc * 0.8);
                fx2.strokeStyle = rgba("#5a4a52", 0.55);
                fx2.beginPath();                                                     // stroke SIDES and TIP only — a closed stroke drew a lid across the root (the seam)
                lEdge.forEach(function (pt3, li3) { li3 ? fx2.lineTo(pt3[0], pt3[1]) : fx2.moveTo(pt3[0], pt3[1]); });
                for (var ri3 = rEdge.length - 1; ri3 >= 0; ri3--) fx2.lineTo(rEdge[ri3][0], rEdge[ri3][1]);
                fx2.stroke();
              });
              // (no hem gap segments anymore: the arms tile the narrow hem edge-to-edge,
              // and their own side strokes are the grooves — one continuous boundary)
            }
            // --- per-mood emoji PROPS (v0.34.0): real emoji, drawn live ON the avatar's
            // own canvas — they ride every pose. The avatar's props, never flag weather;
            // the next face may answer the same moods with different ones.
            var propN = fm.anim.props && fm.anim.props[fm.index];
            if (propN) {
              var EMOF = 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
              fx2.textAlign = "center"; fx2.textBaseline = "middle";
              if (propN === "bulb") {                                                // 💡 pops in DARK, clicks ON, and stays lit — the idea arriving, then held
                var bAppear = 0.5, bOn = 1.5;
                if (t > bAppear) {
                  var bpx = 44 * fsc, bpy = 7 * fsc;                                 // nearer the crown than before — hers, not the room's
                  var popU = Math.min(1, (t - bAppear) / 0.35), ub = popU - 1;
                  var pscl = popU >= 1 ? 1 : 0.3 + 0.7 * (1 + (2.70158 * ub + 1.70158) * ub * ub);   // ease-out-back: the pop overshoots, then settles
                  var onA = t < bOn ? 0 : Math.min(1, (t - bOn) / 0.12);             // the click: fast attack, then ON for good
                  if (onA > 0) {
                    var hgl = 0.34 + 0.06 * Math.sin(t * 2.3);                       // lit steady, breathing gently
                    var hg = fx2.createRadialGradient(bpx, bpy, 1, bpx, bpy, 12 * fsc);
                    hg.addColorStop(0, rgba("#fff6c0", hgl * onA)); hg.addColorStop(0.55, rgba("#ffe27a", 0.4 * hgl * onA)); hg.addColorStop(1, rgba("#ffe27a", 0));
                    fx2.fillStyle = hg; fx2.beginPath(); fx2.arc(bpx, bpy, 12 * fsc, 0, 6.2832); fx2.fill();
                  }
                  if (onA < 1) fx2.filter = "grayscale(1) brightness(0.55)";         // unlit: the bulb is there before the idea is
                  fx2.globalAlpha = 0.55 + 0.45 * onA;
                  fx2.font = (14 * fsc * pscl).toFixed(1) + EMOF;
                  fx2.fillText("💡", bpx, bpy);
                  fx2.filter = "none";
                }
              } else if (propN === "laughs") {                                       // laughter marks flicking off the flanks with each deep HA
                var lbt = t % 3.8;
                if (lbt < 2.3) {
                  var lph = Math.abs(Math.sin(lbt * Math.PI / 0.64));
                  fx2.strokeStyle = "#ffd24a"; fx2.lineCap = "round"; fx2.lineWidth = 1.6;
                  [[-1, 10], [1, 54]].forEach(function (lside) {
                    for (var lmi = 0; lmi < 3; lmi++) {
                      var lang = (lside[0] < 0 ? Math.PI : 0) + lside[0] * (-0.55 + lmi * 0.55);
                      var lr0 = (4 + lph * 2) * fsc, lr1 = lr0 + (3.5 + lph * 2.5) * fsc;
                      var lcx = lside[1] * fsc, lcy = 20 * fsc;
                      fx2.globalAlpha = 0.35 + 0.55 * lph;
                      fx2.beginPath();
                      fx2.moveTo(lcx + Math.cos(lang) * lr0, lcy - Math.sin(lang) * lr0);
                      fx2.lineTo(lcx + Math.cos(lang) * lr1, lcy - Math.sin(lang) * lr1);
                      fx2.stroke();
                    }
                  });
                }
              } else if (propN === "sweat") {                                        // 💧 beads big at her brow and slides — the long-suffering drop
                var swn = conBase ? Math.max(0, Math.min(1, conAmt / conBase))       // on a contract mood the drop RIDES the squeeze itself — beads as she clenches, holds while she holds
                  : (function () { var swt = t % 5; return swt < 0.5 ? swt / 0.5 : (swt < 2.2 ? 1 : (swt < 3.0 ? 1 - (swt - 2.2) / 0.8 : 0)); })();
                if (swn > 0.03) {
                  fx2.globalAlpha = 0.92 * swn;
                  fx2.font = ((9 + 6 * swn) * fsc).toFixed(1) + EMOF;
                  fx2.fillText("💧", 49 * fsc, (10 + swn * 6) * fsc);
                }
              } else if (propN === "vein") {                                         // 💢 throbbing by the crown
                fx2.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2.2);
                fx2.font = (14 * fsc).toFixed(1) + EMOF;
                fx2.fillText("💢", 50 * fsc, 8 * fsc);
              } else if (propN === "excl") {                                         // ❗ pops with the startle
                var ext = t % 4.5, exE = 0, exO = 0;
                if (ext < 0.1) { exE = ext / 0.1; exO = exE; }
                else if (ext < 1.6) { var exd = ext - 0.1, exv = Math.exp(-exd * 3.0); exE = exv; exO = exv * Math.cos(exd * 22); }
                if (exE > 0.04) {
                  fx2.globalAlpha = Math.min(1, exE * 1.3);
                  fx2.font = (13 * fsc).toFixed(1) + EMOF;
                  fx2.fillText("❗", (50 + exO * 3) * fsc, (8 - exE * 3) * fsc);
                }
              } else if (propN === "grawlix") {                                      // a cloud of curses popping around the crown
                var gwds = ["$#@&", "%$#!", "@#$%", "#@!*", "&$@#", "*!?#", "$%&#"];
                for (var gpi = 0; gpi < 7; gpi++) {
                  var gpr = mulberry32(L.seed + gpi * 131 + 61);
                  var gbirth = gpr() * 2.0, gword = gwds[Math.floor(gpr() * gwds.length) % gwds.length];
                  var gang = gpr() * 6.2832, grad = 11 + gpr() * 14;
                  var gage = (((t - gbirth) % 2.0) + 2.0) % 2.0;
                  if (gage > 1.3) continue;
                  var gu2 = gage / 1.3;
                  var gfall = gu2 < 0.2 ? -3 * (gu2 / 0.2) : -3 + 10 * ((gu2 - 0.2) / 0.8);
                  var gpx = 32 * fsc + Math.cos(gang) * grad * fsc, gpy = 7 * fsc + Math.sin(gang) * grad * 0.65 * fsc + gfall * fsc;   // centred higher — the curses climb clear above her crown
                  fx2.globalAlpha = gu2 < 0.14 ? gu2 / 0.14 : Math.max(0, 1 - (gu2 - 0.14) / 0.86);
                  fx2.font = "700 " + (9.5 * (1.05 - 0.4 * gu2) * fsc).toFixed(1) + "px ui-monospace, Menlo, Consolas, monospace";
                  fx2.fillStyle = gpi % 3 === 0 ? "#ffd24a" : "#ff5a4a";
                  fx2.fillText(gword, gpx, gpy);
                }
              } else if (propN === "qmark") {                                        // a gentle drift of ?s — the pre-spark
                for (var qpi = 0; qpi < 4; qpi++) {
                  var qpr = mulberry32(L.seed + qpi * 173 + 37);
                  var qbirth = qpr() * 3.4, qang2 = qpr() * 6.2832, qrad2 = 9 + qpr() * 11;
                  var qage2 = (((t - qbirth) % 3.4) + 3.4) % 3.4;
                  if (qage2 > 2.4) continue;
                  var qu2 = qage2 / 2.4;
                  var qrise2 = qu2 < 0.15 ? 1.2 * (qu2 / 0.15) : 1.2 - 7 * ((qu2 - 0.15) / 0.85);
                  fx2.globalAlpha = 0.6 * (qu2 < 0.18 ? qu2 / 0.18 : Math.max(0, 1 - (qu2 - 0.18) / 0.82));
                  fx2.font = "600 " + (8.5 * (0.85 + 0.3 * qpr()) * fsc).toFixed(1) + "px ui-sans-serif, sans-serif";
                  fx2.fillStyle = qpi % 3 === 0 ? "#9a8a6a" : "#7a6a55";
                  fx2.fillText("?", 32 * fsc + Math.cos(qang2) * qrad2 * fsc, (9 + qrise2) * fsc + Math.sin(qang2) * qrad2 * 0.55 * fsc);
                }
              }
              fx2.globalAlpha = 1; fx2.textAlign = "start"; fx2.textBaseline = "alphabetic";
            }
            if (boopFx && boopFx.t0 != null) {                                       // the poke: a soft impact FLASH absorbed at the spot — deliberately nothing like a water ripple
              var bAge2 = t - boopFx.t0;
              if (bAge2 < 0.45) {
                var bu = bAge2 / 0.45;
                var brad = (7 - bu * 5) * fsc;                                       // pops wide, absorbs inward as it fades
                var bgd = fx2.createRadialGradient(boopFx.cx * fsc, boopFx.cy * fsc, 0, boopFx.cx * fsc, boopFx.cy * fsc, brad);
                bgd.addColorStop(0, rgba("#fff8ec", 0.7 * (1 - bu)));
                bgd.addColorStop(1, rgba("#fff8ec", 0));
                fx2.fillStyle = bgd;
                fx2.beginPath(); fx2.arc(boopFx.cx * fsc, boopFx.cy * fsc, brad, 0, 6.2832); fx2.fill();
              }
            }
          }
        }

        // --- smooth chromatophores: continuous drift in the live palette's colour ---
        if (chromo && chromoMask && (++chromoTick % 2 === 0)) {
          var ccw = kaoEl.clientWidth, cch = kaoEl.clientHeight;
          if (ccw > 4 && cch > 4) {
            if (chromo.width !== ccw) { chromo.width = ccw; chromo.height = cch; }
            var cctx = chromo.getContext("2d");
            cctx.clearRect(0, 0, ccw, cch);
            var hueC = (p.palette && p.palette[0]) || "#b89ab0";
            // drift speed IS a signal: engagement scales the current. Checked-out barely
            // creeps (~0.3x); fully lit streams (1x = the high-energy rate). The fluid
            // layer's tempo now reports the same thing the field's size does.
            var cEng = Math.max(0, Math.min(1, p.engagement == null ? 0.7 : +p.engagement || 0));
            var cSpd = 0.1 + 0.25 * cEng;                      // unhurried by default — nobody's rushing in a tidepool
            for (var ci = 0; ci < 7; ci++) {                   // seven roamers — the only camo there is, now that the baked patterns retired
              var crr = mulberry32(L.seed + ci * 7717 + 5);
              var sw1 = (0.11 + crr() * 0.11) * cSpd, sw2 = (0.09 + crr() * 0.1) * cSpd;   // fast enough to SEE at full energy: a body-crossing in seconds
              var cp1 = crr() * 6.28, cp2 = crr() * 6.28, cp3 = crr() * 6.28, cp4 = crr() * 6.28;
              // free roam: no zones — quasi-periodic wander (incommensurate golden-ratio
              // frequencies, never repeats) spanning the WHOLE body; the mask is the only
              // boundary, and crossing the features reads as slipping under them
              var cxp = (0.5 + 0.34 * Math.sin(t * sw1 * 6.28 + cp1) + 0.24 * Math.sin(t * sw1 * 6.28 * 1.618 + cp2)) * ccw;
              var cyp = (0.5 + 0.34 * Math.sin(t * sw2 * 6.28 + cp3) + 0.24 * Math.sin(t * sw2 * 6.28 * 2.414 + cp4)) * cch;
              // the spot is an amoeba: three overlapping lobes, each with its own
              // wandering offset and breathing radius (clamped min/max) — shape mutates.
              // Drawn as a soft FIELD; the threshold pass below turns it into flesh.
              for (var kk = 0; kk < 3; kk++) {
                var kph = cp1 * (kk + 1) + kk * 2.1;
                var lox = 0.06 * Math.sin(t * (0.21 + kk * 0.07) + kph) * ccw;
                var loy = 0.06 * Math.sin(t * (0.17 + kk * 0.09) * 1.618 + kph * 1.3) * cch;
                var lr = (0.11 + 0.07 * (0.5 + 0.5 * Math.sin(t * (0.23 + kk * 0.11) + kph * 0.7))) * ccw;   // radius breathes 0.11–0.18 of the body
                var cg = cctx.createRadialGradient(cxp + lox, cyp + loy, 0, cxp + lox, cyp + loy, lr);
                cg.addColorStop(0, rgba(hueC, 0.72)); cg.addColorStop(0.55, rgba(hueC, 0.34)); cg.addColorStop(1, rgba(hueC, 0));
                cctx.fillStyle = cg; cctx.beginPath(); cctx.arc(cxp + lox, cyp + loy, lr, 0, 6.2832); cctx.fill();
              }
            }
            // METABALL PASS: remap the accumulated alpha through a soft threshold.
            // Overlapping tails sum past it and BRIDGE (merge); parting patches thin the
            // bridge until it snaps (split). Both behaviours from one cheap pixel pass.
            var mimg2 = cctx.getImageData(0, 0, ccw, cch), mdd = mimg2.data;
            for (var mi2 = 3; mi2 < mdd.length; mi2 += 4) {
              var ma = mdd[mi2];
              mdd[mi2] = ma <= 72 ? 0 : ma >= 124 ? 138 : Math.round((ma - 72) / 52 * 138);   // out: ~0.54 alpha flesh with a 2-3px soft rim
            }
            cctx.putImageData(mimg2, 0, 0);
            cctx.globalCompositeOperation = "destination-in";
            cctx.imageSmoothingEnabled = false;                // the mask keeps its chunky 4px edges — spots glide, the silhouette does not
            cctx.drawImage(chromoMask, 0, 0, ccw, cch);
            cctx.globalCompositeOperation = "source-over";
          }
        }

        ctx.save();                                            // FULL-BLEED WEATHER (v0.39.0): field, dims, storms cover the whole banner —
        ctx.beginPath();                                       // visible around the window's margins; only the window's rounded interior is
        ctx.rect(0, 0, W, H);                                  // excluded (an even-odd hole through the weather, where the avatar's world shows)
        var wcp = L.portrait, wcs = wcp.s;
        ctx.moveTo(wcp.x + 10, wcp.y);
        ctx.arcTo(wcp.x + wcs, wcp.y, wcp.x + wcs, wcp.y + wcs, 10);
        ctx.arcTo(wcp.x + wcs, wcp.y + wcs, wcp.x, wcp.y + wcs, 10);
        ctx.arcTo(wcp.x, wcp.y + wcs, wcp.x, wcp.y, 10);
        ctx.arcTo(wcp.x, wcp.y, wcp.x + wcs, wcp.y, 10);
        ctx.closePath();
        ctx.clip("evenodd");

        // --- the face itself: FLAGS NO LONGER TOUCH IT (v0.31.0). A flag is banner
        // WEATHER — light, storms, marks, atmosphere; the face belongs entirely to the
        // avatar (Sepia's moods/fins/tint/ink; kaomoji and emoji just are what they
        // are). The only face motion left is the boop startle, which is physics.
        var kx = 0, ky = 0, ks = 1, krot = 0;                                        // kept as anchors — the weather marks still ride these (now-still) offsets
        ky += beatKy;                                                                // the cackle-jounce: the avatar's OWN body language, not a flag pose
        if (conAmt) { ky += 4.5 * conAmt; ks *= 1 - 0.05 * conAmt; }                 // the contraction: sunk low and drawn small
        if (thrillE) { ky -= 2.2 * thrillE; ks *= 1 + 0.1 * thrillE; }               // the feeding thrill: a little hop of delight — every face gets this, sprite or text
        if (kaoEl && boopFx && boopFx.t0 == null) boopFx.t0 = t;
        var boopAge = boopFx && boopFx.t0 != null ? t - boopFx.t0 : 9;
        if (kaoEl && boopAge < 0.8) {                                                // the startle: recoil away from the finger, squash and boing
          var bev = Math.exp(-boopAge * 4);
          ks *= 1 + 0.09 * bev * Math.sin(boopAge * 20);
          kx += (32 - boopFx.cx) * 0.1 * bev;
          ky += (32 - boopFx.cy) * 0.08 * bev;
        }
        if (kaoEl) {
          if (kx || ky || ks !== 1 || beatKw) kaoEl.style.transform = "translate(" + (kx * pxScale).toFixed(2) + "px," + (ky * pxScale).toFixed(2) + "px) rotate(" + krot.toFixed(1) + "deg) scale(" + (ks * (1 + beatKw)).toFixed(3) + "," + ks.toFixed(3) + ")";
          else if (kaoEl.style.transform) kaoEl.style.transform = "";                // rest cleanly
        }

        // --- the field: three columns holding a seeded vertical band set by focus ---
        var arrive = 1;                                                              // prev: one-step trajectory — hue arrives from the last banner's palette
        if (L.prevFills) { var am = Math.min(1, t / 2); arrive = am * am * (3 - 2 * am); }
        B.forEach(function (b, bi) {
          var ox = 2.2 * Math.sin(0.45 * t + b.phase) + oopsOsc * 10;                // columns hold their focus positions; a hair of life + oops jolt
          var oy = b.bias * env + 1.6 * Math.sin(0.5 * t + b.phase) + groanGr * 9;   // vertical position from focus, gently alive
          var br = (1 + 0.05 * Math.sin(0.7 * t + b.phase)) * laughB * (1 + 0.22 * soft) * (L.awe ? 1.18 : 1);
          var fill = b.fill;
          if (b.pool) { var per = 6, f = (t / per) % b.pool.length, i0 = Math.floor(f), fr = f - i0; fill = lerpHex(b.pool[i0], b.pool[(i0 + 1) % b.pool.length], fr * fr * (3 - 2 * fr)); }  // centre cycles smoothly
          if (arrive < 1) fill = lerpHex(L.prevFills[bi] || fill, fill, arrive);     // one-time arrival transition, then normal idle
          if (L.frustrated) fill = lerpHex(fill, "#7a1616", frP * 0.5);              // frustrated: ovals pulse dark red and back
          if (L.solemn) fill = lerpHex(fill, grayLum(fill), 0.7);                    // solemn: the field desaturates
          var bop = b.op;
          if (L.awe) { fill = lerpHex(fill, darken(fill, 0.72), 0.3); bop = Math.min(0.9, bop * 1.3); }  // awe: deeper = denser, never vanishing into a dark page
          ctx.globalAlpha = 0.5;
          ellipse(b.cx + ox, b.cyBase + oy, b.rx * br, b.ry * br, fill, bop, soft);
          if (L.stance > 0) {                                                        // stance: declarative → the ovals gain a definite edge
            ctx.beginPath(); ctx.ellipse(b.cx + ox, b.cyBase + oy, b.rx * br, b.ry * br, 0, 0, 6.2832);
            ctx.strokeStyle = rgba(darken(fill, 0.66), 0.55 * L.stance); ctx.lineWidth = 1.5; ctx.stroke();
          }
        });
        ctx.globalAlpha = 1;

        // --- full-frame dim: max-pooled across contributors so stacked washes never sum toward mud ---
        var dimC = null;
        if (L.solemn) dimC = ["#2a2622", 0.14];
        if (L.anxious) { var axA = 0.12 + 0.06 * Math.sin(t * 0.9); if (!dimC || axA > dimC[1]) dimC = ["#5f6675", axA]; }
        if (L.angry) { if (!dimC || 0.62 > dimC[1]) dimC = ["#050408", 0.62]; }
        if (dimC) { ctx.fillStyle = rgba(dimC[0], dimC[1]); ctx.fillRect(0, 0, W, H); }

        if (L.angry) {                                                               // storm: red underglow + lightning (its dim is pooled above)
          var ug = ctx.createRadialGradient(W / 2, cyC, 20, W / 2, cyC, W * 0.6);
          ug.addColorStop(0, rgba("#3a0a0a", 0.5)); ug.addColorStop(1, rgba("#3a0a0a", 0));
          ctx.fillStyle = ug; ctx.fillRect(0, 0, W, H);
          var lper = 1.4, lt = t % lper, lcyc = Math.floor(t / lper);
          if (lt < 0.16) {
            var fla = 1 - lt / 0.16, lr = mulberry32(L.seed + lcyc * 97 + 3);
            ctx.globalAlpha = fla; ctx.strokeStyle = "#dfe6ff"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath(); var yy = -2, xx = 60 + lr() * (W - 120); ctx.moveTo(xx, yy);
            while (yy < H) { yy += 8 + lr() * 10; xx += (lr() - 0.5) * 26; ctx.lineTo(xx, yy); }
            ctx.stroke();
            ctx.fillStyle = rgba("#c8d2ff", 0.1 * fla); ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
          }
          // (the grawlix curses left the storm in v0.33.0 — they're the avatar's own props now, baked into its sheet)
        }
        if (L.dramatic) {
          var dx = faceCX, dy = faceMidY, fl = 0.94 + 0.06 * Math.sin(t * 5.5) + 0.03 * Math.sin(t * 11);
          var pool = ctx.createRadialGradient(dx, dy - 4, 6, dx, dy, 168);
          pool.addColorStop(0, rgba("#fff2cf", 0.5 * fl)); pool.addColorStop(0.5, rgba("#ffe6a8", 0.16 * fl)); pool.addColorStop(1, rgba("#ffe6a8", 0));
          ctx.fillStyle = pool; ctx.fillRect(0, 0, W, H);
          var dim = ctx.createRadialGradient(dx, dy, 46, dx, dy, Math.max(W, H) * 0.72);
          dim.addColorStop(0, rgba("#08080f", 0)); dim.addColorStop(0.5, rgba("#08080f", 0.16 * fl)); dim.addColorStop(1, rgba("#08080f", 0.46 * fl));
          ctx.fillStyle = dim; ctx.fillRect(0, 0, W, H);
        }
        // (the spark bulb, the 💢 vein, the groan sweat drop, the oops "!", and the ?-cloud
        // all left the weather in v0.33.0 — a mark is a prop the AVATAR wears, baked per-mood
        // into its own sheet, free to differ per face; the banner keeps only true climate)
        if (stars.length) {
          ctx.strokeStyle = "#f7e3a8"; ctx.lineCap = "round";
          stars.forEach(function (o) {
            var s = o.s, k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(o.tw * t + o.ph)), base = s.rot * Math.PI / 180 + o.rs * t;
            ctx.globalAlpha = s.op * k; ctx.lineWidth = 1.4;
            for (var a = 0; a < 3; a++) {
              var ang = base + a * Math.PI / 3;
              ctx.beginPath();
              ctx.moveTo(s.cx - Math.cos(ang) * s.s, s.cy - Math.sin(ang) * s.s);
              ctx.lineTo(s.cx + Math.cos(ang) * s.s, s.cy + Math.sin(ang) * s.s);
              ctx.stroke();
            }
          });
          ctx.globalAlpha = 1;
        }
        // --- diffuse atmospheric flags ---
        if (L.tender) {
          var twa = 0.15 + 0.05 * Math.sin(0.9 * t);
          var tg = ctx.createRadialGradient(W / 2, cyC, Math.min(W, H) * 0.34, W / 2, cyC, W * 0.58);
          tg.addColorStop(0, rgba("#e8a48f", 0)); tg.addColorStop(0.72, rgba("#e6a090", twa * 0.45)); tg.addColorStop(1, rgba("#e09a84", twa));
          ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H);
        }
        if (L.surprised) {                                                           // halo bloom off the face (kept from awe)
          var acx = faceCX, acy = faceMidY, per2 = 4.4;
          [0, 0.5].forEach(function (ph) {
            var tt = ((t / per2 + ph) % 1), r = 26 + tt * 210, aa = 0.22 * Math.max(0, 1 - tt);
            var ag = ctx.createRadialGradient(acx, acy, r * 0.72, acx, acy, r * 1.1);
            ag.addColorStop(0, rgba("#efe6c8", 0)); ag.addColorStop(0.5, rgba("#efe6c8", aa)); ag.addColorStop(1, rgba("#efe6c8", 0));
            ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(acx, acy, r * 1.1, 0, 6.2832); ctx.fill();
          });
        }
        if (L.melancholy) {
          ctx.fillStyle = "#9aa2b4";
          for (var mi = 0; mi < 9; mi++) {
            var mx = 34 + mi * (W - 68) / 8 + 7 * Math.sin(t * 0.3 + mi), my = ((mi * 47 + t * (7 + (mi % 3) * 4)) % (H + 20)) - 10;
            ctx.globalAlpha = 0.32 * (0.5 + 0.5 * Math.sin(t * 0.5 + mi));
            ctx.beginPath(); ctx.arc(mx, my, 2.3, 0, 6.2832); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        if (L.anxious) {                                                             // cold dread: rolling wisps + a tightening vignette (its breathing dim is pooled above)
          for (var fi = 0; fi < 11; fi++) {
            var fsp = 8 + (fi % 4) * 7;
            var fx = ((t * fsp + fi * 150) % (W + 460)) - 230;
            var fy = 6 + ((fi * 61) % (H - 10)) + 14 * Math.sin(t * 0.3 + fi * 1.3);
            var frx = 80 + ((fi * 37) % 120), fry = 20 + ((fi * 19) % 30);
            ellipse(fx, fy, frx, fry, "#aeb6c6", 0.10 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.4 + fi * 2)));   // brighter, clearly rolling
          }
          var av = ctx.createRadialGradient(W / 2, cyC, W * 0.28, W / 2, cyC, W * 0.62);
          av.addColorStop(0, rgba("#3a4050", 0)); av.addColorStop(1, rgba("#3a4050", 0.22 + 0.08 * Math.sin(t * 0.7)));  // edges creep in
          ctx.fillStyle = av; ctx.fillRect(0, 0, W, H);
        }
        if (L.mirth) {
          ctx.fillStyle = "#f2e0ac";
          for (var bi = 0; bi < 10; bi++) {
            var bp = 2.0 + (bi % 4) * 0.5, bt = ((t + bi * 0.53) % bp) / bp;
            var bx2 = 24 + bi * (W - 48) / 9 + 5 * Math.sin(t * 0.6 + bi), by2 = (H - 8) - bt * (H - 20);
            ctx.globalAlpha = 0.4 * Math.sin(bt * Math.PI);
            ctx.beginPath(); ctx.arc(bx2, by2, 1.6 + bt * 2, 0, 6.2832); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        // (laugh's yellow asterisk-burst left the weather in v0.36.0 — laughter marks are
        // the avatar's own now, flicking off her flanks with each HA; the field's gentle
        // laughB breathing is all the room keeps)
        if (L.rhyme && kaoEl && !L.faceImg) {                                        // the echo of the face: the kaomoji's own ghost, resting posture, slow fade cycle (text faces only)
          if (!kaoFont) {
            var kcs = root.getComputedStyle ? getComputedStyle(kaoEl) : null;
            kaoFont = g(fm.fs) + "px " + ((kcs && kcs.fontFamily) || "ui-sans-serif, sans-serif");   // banner units — the canvas draws in viewBox space
          }
          ctx.globalAlpha = 0.09 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.45));
          ctx.font = kaoFont; ctx.fillStyle = "rgb(" + baseFill[0] + "," + baseFill[1] + "," + baseFill[2] + ")";
          L.kaoLines.forEach(function (ln, li) { ctx.fillText(ln, RX + 10, L.kaoAbs[li] + 6); });   // the echo rests in the margin, beside the window
          ctx.globalAlpha = 1;
        }
        if (L.resolute) {                                                            // 集中線: ignition flare, then held faint — drawn after washes so it reads inside storms
          var rt = t % 6, flare = rt < 0.7 ? (rt < 0.15 ? rt / 0.15 : 1 - 0.72 * ((rt - 0.15) / 0.55)) : 0.28;
          ctx.lineCap = "round"; ctx.lineWidth = 2;            // bolder — they were barely visible (the maintainer's note)
          resLines.forEach(function (r) {
            var dx = faceCX - r.x, dy = faceMidY - r.y, ln = r.len + flare * 0.05;
            ctx.strokeStyle = rgba("#4a3c26", (0.3 + 0.5 * flare) * r.op);
            ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + dx * ln, r.y + dy * ln); ctx.stroke();
          });
        }
        if (L.solemn) {                                                              // one small warm ember, steady, low in the frame
          var eg = ctx.createRadialGradient(W - 52, H - 12, 1, W - 52, H - 12, 15);
          eg.addColorStop(0, rgba("#ffbf72", 0.5)); eg.addColorStop(0.5, rgba("#e8a45f", 0.18)); eg.addColorStop(1, rgba("#e8a45f", 0));
          ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(W - 52, H - 12, 15, 0, 6.2832); ctx.fill();
          ctx.fillStyle = rgba("#ffbf72", 0.85); ctx.beginPath(); ctx.arc(W - 52, H - 12, 2.6, 0, 6.2832); ctx.fill();
        }
        if (L.at_peace) {                                                            // stillness as a positive state: a soft halo below the face, blossoms at rest
          var pg = ctx.createRadialGradient(faceCX, faceMidY + 16, 4, faceCX, faceMidY + 16, 42);
          pg.addColorStop(0, rgba("#ffe9bd", 0.30)); pg.addColorStop(0.6, rgba("#ffe9bd", 0.12)); pg.addColorStop(1, rgba("#ffe9bd", 0));
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(faceCX, faceMidY + 16, 42, 0, 6.2832); ctx.fill();
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          flowers.forEach(function (f) {
            ctx.globalAlpha = f.op; ctx.font = f.s.toFixed(0) + "px ui-sans-serif, \"Segoe UI Emoji\", \"Apple Color Emoji\", sans-serif";
            ctx.fillText(f.g, f.x, f.y);
          });
          ctx.globalAlpha = 1; ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
        }
        ctx.restore();                                         // close the right-region boundary clip
      } catch (err) { if (root.console && root.console.warn) root.console.warn("vibe: frame crashed, falling back to static", err); try { el.innerHTML = buildSVG(p); } catch (_) {} return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  root.vibe = function (el, payload) {
    try { mount(el, payload); }
    catch (e) { try { el.innerHTML = buildSVG(payload); } catch (_) { el.textContent = "vibe render error"; } }
  };
  root.vibe.buildSVG = buildSVG;
  if (typeof module !== "undefined" && module.exports) module.exports = { buildSVG: buildSVG };
})(typeof window !== "undefined" ? window : this);
