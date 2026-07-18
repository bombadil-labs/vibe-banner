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
  var SEPIA_SHEET = "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@9fc85b32e8f6e4a1b39f29a9f9405a1c937ae6d5/assets/sepia-sheet.png";   // base + blink frames + per-mood masks; fins drawn live
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
          frames: 2, frameRows: 4, stride: 32, maskStart: 64,
          fins: "rrftdtfrfffrdtrfdtttfcdrtrcrrdrf"            // per-mood fin posture (derives from gen-sepia's FRILL_OF — keep in sync): r ripple, f flared, d drooped, t tucked, c calm
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
    // (currently only "tidepool"); unknown names are ignored, static render ignores all.
    var scene = null;
    if (p.scene) {
      scene = typeof p.scene === "string" ? { url: p.scene } : (p.scene === true ? {} : p.scene);
      if (scene && typeof scene === "object") {
        var scu = scene.url ? String(scene.url) : null;
        scene = {
          url: scu,
          op: Math.max(0.15, Math.min(0.95, scene.opacity || 0.5)),
          live: (scu && scene.live === "tidepool") ? "tidepool" : null
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
    var H = Math.round(PAD + topExtent + bottomExtent + PAD) + langPad;
    var coreCy = PAD + topExtent, dyField = coreCy - DEFAULT_MID;
    // THE WINDOW IS THE LAYOUT: every face lives in a framed square block on the left,
    // scene or no scene. A scene just decides what's visible through it (v0.16.0 — the
    // classic un-windowed layout is retired).
    var pside = Math.min(H - 12, 140);
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
        var col = faceImg.index % faceImg.cols, rowI = Math.floor(faceImg.index / faceImg.cols);
        kaoSVG = '<svg class="vk" x="' + g(ix) + '" y="' + g(iy) + '" width="' + faceImg.w + '" height="' + faceImg.h +
          '" viewBox="' + (col * faceImg.cellW) + ' ' + (rowI * faceImg.cellH) + ' ' + faceImg.cellW + ' ' + faceImg.cellH +
          '" preserveAspectRatio="xMidYMid meet"><image href="' + esc(faceImg.url) + '" x="0" y="0" width="' + (faceImg.cellW * faceImg.cols) + '" height="' + (faceImg.cellH * faceImg.rows) +
          '" style="image-rendering:crisp-edges;image-rendering:pixelated"/></svg>';   // nearest-neighbour: no cross-cell texture bleed, crisper pixel art
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
    if (L.spark) {                                             // a little light-bulb over the face
      var bx = 46, by = L.coreCy - 32;
      glow.push('<ellipse cx="' + bx + '" cy="' + by + '" rx="22" ry="22" fill="#ffe27a" opacity="0.16"/>' +
        '<circle cx="' + bx + '" cy="' + by + '" r="9" fill="#ffe27a" opacity="0.85"/>' +
        '<rect x="' + (bx - 4) + '" y="' + (by + 7) + '" width="8" height="3" rx="1" fill="#9a875f"/>');
    }
    if (L.excited) sparkleData(L.H, L.seed).forEach(function (st) { for (var a = 0; a < 3; a++) glow.push('<ellipse cx="' + st.cx.toFixed(1) + '" cy="' + st.cy.toFixed(1) + '" rx="' + st.s.toFixed(1) + '" ry="' + (st.s * st.ry).toFixed(2) + '" fill="#f7e3a8" opacity="' + st.op.toFixed(2) + '" transform="rotate(' + (st.rot + 60 * a).toFixed(1) + ' ' + st.cx.toFixed(1) + ' ' + st.cy.toFixed(1) + ')"/>'); });
    if (L.at_peace) {                                          // stillness as a positive state: a soft halo below the face, blossoms in the margins
      glow.push('<ellipse cx="46" cy="' + g(L.coreCy + 16) + '" rx="36" ry="15" fill="#ffe9bd" opacity="0.28"/>');
      peaceData(L.H, L.seed).forEach(function (f) {
        glow.push('<text x="' + f.x.toFixed(1) + '" y="' + f.y.toFixed(1) + '" font-size="' + f.s.toFixed(1) + '" opacity="' + f.op.toFixed(2) + '">' + f.g + '</text>');
      });
    }
    if (L.resolute) resoluteData(L.H, L.seed).forEach(function (r) {  // concentration lines held faint
      var dx = 46 - r.x, dy = L.coreCy - r.y;
      glow.push('<line x1="' + r.x.toFixed(1) + '" y1="' + r.y.toFixed(1) + '" x2="' + (r.x + dx * r.len).toFixed(1) + '" y2="' + (r.y + dy * r.len).toFixed(1) + '" stroke="#4a3c26" stroke-opacity="' + (0.16 * r.op).toFixed(3) + '" stroke-width="1.2"/>');
    });
    if (L.puzzled) {                                           // the question-cloud, at rest
      var qr = mulberry32(L.seed + 37);
      for (var qi = 0; qi < 4; qi++) {
        var qa2 = qr() * 6.2832, qd = 20 + qr() * 32;
        glow.push('<text x="' + g(60 + Math.cos(qa2) * qd) + '" y="' + g(L.coreCy - 4 + Math.sin(qa2) * qd * 0.6) +
          '" font-size="' + g(10 + qr() * 4) + '" font-weight="600" fill="#7a6a55" opacity="' + g(0.25 + qr() * 0.3) + '">?</text>');
      }
    }
    if (glow.length) out.push('<g opacity="0.9">' + glow.join("") + '</g>');
    if (L.rhyme) out.push('<g opacity="0.12" transform="translate(14,6)">' + L.kaoSVG + '</g>');   // the echo of the face, behind-ish and offset
    var kao = L.kaoSVG;                                        // constant-pose flags transform the face in the still frame too
    var pvx = L.faceBox ? L.faceBox.x + L.faceBox.w / 2
      : L.portrait.x + L.portrait.s / 2;                       // pivot on the face's real centre (window centre for text faces)
    if (L.awe) kao = '<g transform="translate(' + g(pvx) + ' ' + g(L.coreCy + 5) + ') scale(0.62) rotate(-3) translate(' + g(-pvx) + ' ' + g(-L.coreCy) + ')">' + kao + '</g>';
    else if (L.solemn) kao = '<g transform="translate(' + g(pvx) + ' ' + g(L.coreCy + 3) + ') rotate(4) translate(' + g(-pvx) + ' ' + g(-L.coreCy) + ')">' + kao + '</g>';
    out.push(kao + L.restSVG + '</svg>');
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
      ".vo-tg{position:absolute;top:0;right:0;pointer-events:auto;background:none;border:none;cursor:pointer;font-size:0.85em;line-height:1;padding:2px 4px;color:inherit;opacity:0.4;transition:opacity .2s}" +
      ".vo-tg:hover{opacity:0.85}" +
      ".vcollapsed .vo-panel{display:flex;flex-wrap:wrap;gap:0.28em;background:transparent;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;overflow:visible}" +
      ".vcollapsed .vo-panel .row{margin:0}" +
      ".vcollapsed .vo-panel .row span:not(.pill){display:none}" +                              // collapsed: bare pills, values on hover via the row tooltip
      "@media (prefers-color-scheme:dark){.vo{color:#f6ead0;text-shadow:0 1px 2px rgba(36,26,6,0.6)}" +
      ".vo .pill{background:rgba(216,197,160,0.24);color:#f6ead0}" +
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
    ov.appendChild(pn); wrap.appendChild(ov);
    // The readout collapses to bare pills (values on hover) so the field can be watched
    // unobstructed. The preference persists where storage allows — set once, kept.
    var vmin = false;
    try { vmin = localStorage.getItem("vibeReadout") === "min"; } catch (e) { }
    if (vmin) wrap.classList.add("vcollapsed");
    var tg = document.createElement("button");
    tg.className = "vo-tg"; tg.textContent = vmin ? "▸" : "▾";
    tg.title = vmin ? "expand readout" : "collapse readout to pills";
    tg.addEventListener("click", function () {
      vmin = !vmin;
      wrap.classList.toggle("vcollapsed", vmin);
      tg.textContent = vmin ? "▸" : "▾";
      tg.title = vmin ? "expand readout" : "collapse readout to pills";
      try { localStorage.setItem("vibeReadout", vmin ? "min" : "full"); } catch (e) { }
    });
    ov.appendChild(tg);
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
    var fm = L.faceMeta, kaoEl = null, baseFill = [92, 67, 32];
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
      faceLayer.appendChild(kaoEl); wrap.appendChild(faceLayer);
    }
    // SUB-PIXEL FINS (v0.21.0): the grid could only crenelate; membranes flow. Each
    // flank wears a tapered ribbon whose outer edge is a travelling sine wave, posture
    // per mood: undulating at rest, rippling furiously when flared, sagging when
    // drooped, tucked to a sliver when scared. Drawn every frame; rides every pose.
    var finC = null;
    var FINP = { r: [4, 1.8, 1.1], f: [5.5, 2.9, 3.0], d: [3, 1.1, 0.45], c: [3.5, 1.0, 0.4], t: [1.6, 0.5, 0.6] };   // [baseW, amp, rate] in 64-cell units
    if (kaoEl && fm && fm.kind === "sprite" && fm.anim && fm.anim.fins) {
      finC = document.createElement("canvas");
      finC.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      kaoEl.style.position = "relative";
      kaoEl.appendChild(finC);
    }
    // SUB-PIXEL TIME: the body animates in block frames, but the chromatophore layer
    // glides smoothly over it — soft spots in the reporter's live palette colour,
    // drifting continuously, masked to the mantle by the sheet's own mask cell. The
    // space doctrine's sibling: chunky body, fine ink; chunky frames, fluid colour.
    var chromo = null, chromoMask = null;
    if (kaoEl && fm && fm.kind === "sprite" && fm.anim && (fm.anim.maskStart != null || fm.anim.maskIndex != null)) {
      chromo = document.createElement("canvas");
      chromo.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      kaoEl.style.position = "relative";
      kaoEl.appendChild(chromo);                               // inside the face element: rides every pose and shake
      var mimg = new Image(); mimg.crossOrigin = "anonymous";
      mimg.onload = function () {
        try {
          var mc = document.createElement("canvas"); mc.width = fm.cellW || 64; mc.height = fm.cellH || 64;
          var mIdx = fm.anim.maskStart != null ? fm.anim.maskStart + fm.index : fm.anim.maskIndex;   // per-mood mask: the flow hugs THIS expression's features
          var mcol = mIdx % fm.cols, mrow = Math.floor(mIdx / fm.cols);
          var mx = mc.getContext("2d");
          mx.drawImage(mimg, mcol * mc.width, mrow * mc.height, mc.width, mc.height, 0, 0, mc.width, mc.height);
          mx.getImageData(0, 0, 1, 1);                         // taint probe — throws if CORS failed, and we quietly skip the layer
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
    var live = (L.scene && L.scene.live && L.portrait) ? { ripples: [], feeds: [] } : null;
    if (live && p.play !== false) {                            // tap the water, get ripples
      wrap.addEventListener("click", function (e) {
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
      if (kaoEl && p.play !== false) {                         // boop: the face itself is the button
        kaoEl.style.cursor = "pointer";
        kaoEl.addEventListener("click", function () { say("*boop*"); });
      }
      if (p.play !== false) {
      var tray = document.createElement("div");                // hover tray, upper LEFT (Claude's own UI owns the upper right)
      tray.style.cssText = "position:absolute;top:2px;left:6px;z-index:3;opacity:0;transition:opacity .25s";
      var BTN = "background:none;border:none;cursor:pointer;font-size:14px;padding:2px;line-height:1";
      var fb = document.createElement("button");
      fb.textContent = "🥫"; fb.title = "feed claude"; fb.style.cssText = BTN;
      fb.addEventListener("click", function () {
        var flav = flavorOf(p.palette, live ? "tidepool" : null) + " flavor*";
        if (live) {                                            // in a tidepool the meal arrives as flakes on the water; the message follows the fall
          live.feeds.push({ t0: null });
          setTimeout(function () { say("*scatters a pinch of claudemeal over the tidepool — " + flav); }, 1400);
        } else say("*sets down a fresh tin of claudemeal — " + flav);
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
        // face anchor box: layout's own numbers, always — the HTML face never needs measuring
        var fb = fm && fm.box;
        var faceCX = fb ? fb.x + fb.w / 2 : 46;
        var faceTop = fb ? fb.y : cyC - 15;
        var faceRight = fb ? fb.x + fb.w : 92;
        var faceMidY = fb ? fb.y + fb.h / 2 : cyC;
        ctx.setTransform(sx, 0, 0, sy, 0, 0);
        ctx.clearRect(0, 0, W, H);

        // --- live scene: the tidepool breathes. Everything here stays inside the window's
        // rounded clip; the face (DOM, above the canvas) swims in front of all of it. ---
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

        // --- the living sprite: shimmer + blink, cycled from the sheet's extra frames.
        // Chromatophores drift on a slow uneven clock; blinks land on a seeded organic
        // cadence. Native frames, never an animated image — the tidepool's philosophy. ---
        if (kaoEl && fm && fm.kind === "sprite" && fm.anim) {
          var fRows = fm.anim.frameRows || fm.rows / fm.anim.frames;
          var fr = 0;                                                                // base at rest — fins and chromatophores carry all continuous motion now
          var bper = 3.2 + (L.seed % 5) * 0.9;
          if (((t + (L.seed % 7) * 0.6) % bper) < 0.16) fr = 1;                      // blink, ~160ms on a seeded organic cadence
          if (fr !== spriteFrame) {
            spriteFrame = fr;
            var fcol2 = fm.index % fm.cols, frow2 = Math.floor(fm.index / fm.cols) + fr * fRows;
            kaoEl.style.backgroundPosition =
              g(fm.cols > 1 ? fcol2 / (fm.cols - 1) * 100 : 0) + "% " + g(fm.rows > 1 ? frow2 / (fm.rows - 1) * 100 : 0) + "%";
          }
        }

        // --- liquid fins: smooth membranes on each flank, posture from the mood ---
        if (finC) {
          var fcw = kaoEl.clientWidth, fch = kaoEl.clientHeight;
          if (fcw > 4) {
            if (finC.width !== fcw) { finC.width = fcw; finC.height = fch; }
            var fx2 = finC.getContext("2d");
            fx2.clearRect(0, 0, fcw, fch);
            var fcode = fm.anim.fins.charAt(fm.index) || "r";
            var fp2 = FINP[fcode] || FINP.r;
            var fsc = fcw / 64;
            var baseW = fp2[0] * fsc, famp = fp2[1] * fsc, frate = fp2[2];
            fx2.fillStyle = rgba("#d8bcc8", 0.92);
            [[9.5, -1], [54.5, 1]].forEach(function (fside) {
              var ax = fside[0] * fsc, fdir2 = fside[1];
              fx2.beginPath();
              fx2.moveTo(ax, 12 * fsc);
              for (var fy = 12; fy <= 44; fy++) {
                var prof = Math.sin((fy - 12) / 32 * Math.PI);                       // tapered ends, widest amidships
                var sagF = fcode === "d" ? 0.25 + (fy - 12) / 32 * 0.9 : 1;          // drooped: the membrane pools toward the bottom
                var wv = famp * Math.sin(fy * 0.32 - t * frate * 6.283 * fdir2) * prof;
                var wdt = Math.max(0, baseW * prof * sagF + wv);
                fx2.lineTo(ax + fdir2 * wdt, fy * fsc);
              }
              fx2.lineTo(ax, 44 * fsc);
              fx2.closePath(); fx2.fill();
            });
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
            var cSpd = 0.15 + 0.35 * cEng;                     // half the old rate: same refresh, less drastic travel
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

        // --- the face itself ---
        var kx = 0, ky = 0, ks = 1, krot = 0, kfill = "";                            // face transform, hoisted so marks can ride along
        if (kaoEl && (L.laugh || L.excited || L.anxious || L.melancholy || L.groan || L.oops || L.dramatic || L.surprised || L.frustrated || L.angry || L.solemn || L.awe)) {
          if (laughKp > 0.03) { ks *= 1 + laughKp * 0.15; kfill = mixCss(baseFill, [255, 223, 58], laughKp * 0.92); }        // laugh: swell + flush yellow
          if (L.excited) { kx += Math.tanh(3 * Math.sin(t * 1.0)) * 10; }                                                    // excited: sway foot-to-foot
          if (L.anxious) { kx += (Math.sin(t * 41) + Math.sin(t * 57)) * 0.7; ky += Math.sin(t * 47) * 0.6; }                // anxious: shiver
          if (L.surprised) { ks *= 1 + surP * 0.13; ky -= surP * 3; }                                                        // surprised: a quick startled pop
          if (L.groan) { ky += groanGr * 7; krot += groanGr * 13; if (!kfill) kfill = mixCss(baseFill, [138, 140, 150], groanGr * 0.4); }
          if (L.oops) { ky -= oopsE * 5; kx += oopsOsc * 4; krot += oopsOsc * 6; ks *= 1 - oopsE * 0.06; if (!kfill) kfill = mixCss(baseFill, [206, 208, 220], oopsE * 0.5); }
          if (L.dramatic) { ks *= 1.06; ky += Math.sin(t * 0.8) * 1.2; }
          if (L.solemn) { krot += 4; ky += 3; }                                                                              // solemn: the face bows, held
          if (L.awe) { ks *= 0.62; ky += 5; krot -= 3; }                                                                     // awe: the face made quite tiny and sunk low, still tilted up at the vast thing
          if (L.frustrated) { kx += Math.sin(t * 34) * 0.9; if (!kfill) kfill = mixCss(baseFill, [150, 44, 40], 0.3 + 0.2 * frP); }  // frustrated: tense micro-shake, red
          if (L.angry) { kx += Math.sin(t * 46) * 1.4; ky += Math.sin(t * 39) * 0.8; kfill = mixCss(baseFill, [200, 60, 46], 0.6); } // angry: hard shake, hot red
          if (L.solemn && !kfill) { kfill = mixCss(baseFill, [112, 106, 96], 0.35); }
          if (L.melancholy && !kfill) { kfill = mixCss(baseFill, [120, 134, 176], 0.45); }
          kaoEl.style.transform = "translate(" + (kx * pxScale).toFixed(2) + "px," + (ky * pxScale).toFixed(2) + "px) rotate(" + krot.toFixed(1) + "deg) scale(" + ks.toFixed(3) + ")";   // banner units → real pixels for the HTML face
          kaoEl.style.color = kfill;                           // mood tint: text recolors, image faces ignore it
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
          // a little cloud of grawlix curses clustered around the head — pop, fall, shrink, fade
          var gw = ["$#@&", "%$#!", "@#$%", "#@!*", "&$@#", "*!?#", "$%&#", "@&#!", "!#$%", "#$@!"];
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          var GN = 10, gper = 2.0, glife = 1.3, fcx = Math.min(faceCX, 92), fcy = faceMidY;
          for (var gi = 0; gi < GN; gi++) {
            var grr = mulberry32(L.seed + gi * 131 + 61);
            var birth = grr() * gper, word = gw[Math.floor(grr() * gw.length) % gw.length];
            var ang = grr() * 6.2832, rad = 18 + grr() * 36;
            var age = (((t - birth) % gper) + gper) % gper;
            if (age > glife) continue;
            var u = age / glife;
            var fall = u < 0.2 ? -6 * (u / 0.2) : -6 + 22 * ((u - 0.2) / 0.8);         // small pop up, then fall
            var gx = fcx + Math.cos(ang) * rad, gy = fcy + Math.sin(ang) * rad * 0.7 + fall;
            var scl = 1.05 - 0.5 * u, al = u < 0.14 ? u / 0.14 : Math.max(0, 1 - (u - 0.14) / 0.86);
            ctx.globalAlpha = al; ctx.font = "700 " + (10.5 * scl).toFixed(1) + "px ui-monospace, Menlo, Consolas, monospace";
            ctx.fillStyle = gi % 3 === 0 ? "#ffd24a" : "#ff5a4a";
            ctx.fillText(word, gx, gy);
          }
          ctx.globalAlpha = 1; ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
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
        if (L.spark) {                                                               // light-bulb over the face: a periodic "click on"
          var bx = faceCX, by = faceTop - 14, scyc = t % 3.0, on;
          if (scyc < 0.12) on = scyc / 0.12;                                          // fast attack — the click
          else if (scyc < 1.6) on = 1;                                               // hold bright
          else if (scyc < 2.1) on = 1 - (scyc - 1.6) / 0.5;                          // dim down
          else on = 0.12 + 0.05 * Math.sin(t * 2);                                    // faint idle glow
          var gg = ctx.createRadialGradient(bx, by, 2, bx, by, 30);
          gg.addColorStop(0, rgba("#fff6c0", 0.6 * on)); gg.addColorStop(0.5, rgba("#ffe27a", 0.24 * on)); gg.addColorStop(1, rgba("#ffe27a", 0));
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(bx, by, 30, 0, 6.2832); ctx.fill();
          var burst = Math.max(0, on) * (scyc < 0.5 ? 1 : 0.4);                       // rays flare on the click
          ctx.strokeStyle = rgba("#fff0a0", 0.85 * burst); ctx.lineWidth = 1.6; ctx.lineCap = "round";
          for (var ri = 0; ri < 8; ri++) { var ra = ri * Math.PI / 4 - 0.2, r1 = 13 + burst * 9; ctx.beginPath(); ctx.moveTo(bx + Math.cos(ra) * 12, by + Math.sin(ra) * 12); ctx.lineTo(bx + Math.cos(ra) * r1, by + Math.sin(ra) * r1); ctx.stroke(); }
          ctx.globalAlpha = 1; ctx.fillStyle = rgba("#ffe27a", 0.5 + 0.45 * on); ctx.beginPath(); ctx.arc(bx, by, 9, 0, 6.2832); ctx.fill();
          if (on > 0.5) { ctx.strokeStyle = rgba("#c9892a", on); ctx.lineWidth = 1; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(bx - 3, by + 1); ctx.lineTo(bx - 1, by - 2); ctx.lineTo(bx + 1, by + 1); ctx.lineTo(bx + 3, by - 2); ctx.stroke(); }  // filament
          ctx.fillStyle = rgba("#fffbe6", 0.6 * on); ctx.beginPath(); ctx.arc(bx - 2.5, by - 2.5, 3, 0, 6.2832); ctx.fill();
          ctx.fillStyle = "#9a875f"; ctx.fillRect(bx - 4, by + 7, 8, 3); ctx.fillRect(bx - 3.5, by + 10, 7, 1.6); ctx.fillRect(bx - 3, by + 12, 6, 1.4);   // screw base
        }
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
        if (L.laugh) {
          var faceCx = faceCX, faceCy = faceMidY, NM = 7, MLIFE = 1.25;
          ctx.strokeStyle = "#ffdf3a"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
          for (var li = 0; li < NM; li++) {
            var life = (lLt - li * 0.12) / MLIFE;
            if (life < 0 || life > 1) continue;
            var la = life < 0.15 ? life / 0.15 : (life < 0.62 ? 1 : Math.max(0, 1 - (life - 0.62) / 0.26));
            if (la <= 0) continue;
            var dir = (li / NM) * 6.2832 + lCyc * 0.7 + 0.25, dist = 14 + life * 46;
            var lmx = faceCx + Math.cos(dir) * dist, lmy = faceCy + Math.sin(dir) * dist * 0.72;
            var sz = 4 + Math.min(life * 8, 5), rot = dir + 0.4;
            ctx.globalAlpha = 0.9 * la;
            for (var r = 0; r < 2; r++) {
              var ang2 = r * Math.PI / 2 + rot;
              ctx.beginPath();
              ctx.moveTo(lmx - Math.cos(ang2) * sz, lmy - Math.sin(ang2) * sz);
              ctx.lineTo(lmx + Math.cos(ang2) * sz, lmy + Math.sin(ang2) * sz);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
        }
        if (L.frustrated) {                                                          // the anime anger-vein mark, above-and-right of the head; throbs in intensity, not size
          var mkx = faceRight + 4 + kx, mky = faceTop - 6 + ky;                       // ride the kaomoji's shake
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.globalAlpha = 0.6 + 0.4 * frP;                                          // pulse opacity only (size stays put, so it doesn't fight the shake)
          ctx.font = "16px ui-sans-serif, \"Segoe UI Emoji\", \"Apple Color Emoji\", sans-serif";
          ctx.fillText("💢", mkx, mky);
          ctx.globalAlpha = 1; ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
        }
        if (L.groan && groanGr > 0.05) {
          var sdx = faceRight - 8, sdy = faceTop + 4 + groanGr * 7;
          ctx.globalAlpha = 0.75 * groanGr; ctx.fillStyle = "#a9c4e0";
          ctx.beginPath(); ctx.arc(sdx, sdy, 3.2, 0, 6.2832); ctx.fill();
          ctx.beginPath(); ctx.moveTo(sdx - 2.4, sdy - 1.8); ctx.lineTo(sdx, sdy - 7.5); ctx.lineTo(sdx + 2.4, sdy - 1.8); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (L.oops && oopsE > 0.04) {
          var exX = (faceRight - 4) + oopsOsc * 4, exY = faceTop - 8 - oopsE * 5;
          ctx.globalAlpha = Math.min(1, oopsE * 1.3); ctx.strokeStyle = "#e07a5f"; ctx.fillStyle = "#e07a5f"; ctx.lineWidth = 3; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(exX, exY - 9); ctx.lineTo(exX, exY + 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(exX, exY + 7, 1.9, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (L.rhyme && kaoEl && !L.faceImg) {                                        // the echo of the face: the kaomoji's own ghost, resting posture, slow fade cycle (text faces only)
          if (!kaoFont) {
            var kcs = root.getComputedStyle ? getComputedStyle(kaoEl) : null;
            kaoFont = g(fm.fs) + "px " + ((kcs && kcs.fontFamily) || "ui-sans-serif, sans-serif");   // banner units — the canvas draws in viewBox space
          }
          ctx.globalAlpha = 0.09 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.45));
          ctx.font = kaoFont; ctx.fillStyle = "rgb(" + baseFill[0] + "," + baseFill[1] + "," + baseFill[2] + ")";
          L.kaoLines.forEach(function (ln, li) { ctx.fillText(ln, FACE_X + 14, L.kaoAbs[li] + 6); });
          ctx.globalAlpha = 1;
        }
        if (L.resolute) {                                                            // 集中線: ignition flare, then held faint — drawn after washes so it reads inside storms
          var rt = t % 6, flare = rt < 0.7 ? (rt < 0.15 ? rt / 0.15 : 1 - 0.72 * ((rt - 0.15) / 0.55)) : 0.28;
          ctx.lineCap = "round"; ctx.lineWidth = 1.2;
          resLines.forEach(function (r) {
            var dx = faceCX - r.x, dy = faceMidY - r.y, ln = r.len + flare * 0.05;
            ctx.strokeStyle = rgba("#4a3c26", (0.10 + 0.4 * flare) * r.op);
            ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + dx * ln, r.y + dy * ln); ctx.stroke();
          });
        }
        if (L.puzzled) {                                                             // the pre-spark: a loose cloud of "?" around the head — grawlix mechanics, gentle register
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          var QN = 5, qper = 3.4, qlife = 2.4, qcx = Math.min(faceCX, 92) + kx, qcy = faceMidY + ky;
          for (var qi = 0; qi < QN; qi++) {
            var qrr = mulberry32(L.seed + qi * 173 + 37);
            var qbirth = qrr() * qper, qang = qrr() * 6.2832, qrad = 20 + qrr() * 34;
            var qage = (((t - qbirth) % qper) + qper) % qper;
            if (qage > qlife) continue;
            var qu = qage / qlife;
            var qrise = qu < 0.15 ? 2 * (qu / 0.15) : 2 - 14 * ((qu - 0.15) / 0.85);   // tiny bob, then a slow drift up
            var qx = qcx + Math.cos(qang) * qrad, qy = qcy + Math.sin(qang) * qrad * 0.6 + qrise;
            var qscl = 0.85 + 0.3 * qrr(), qa = qu < 0.18 ? qu / 0.18 : Math.max(0, 1 - (qu - 0.18) / 0.82);
            ctx.globalAlpha = 0.5 * qa;
            ctx.font = "600 " + (11.5 * qscl).toFixed(1) + "px ui-sans-serif, sans-serif";
            ctx.fillStyle = qi % 3 === 0 ? "#9a8a6a" : "#7a6a55";
            ctx.fillText("?", qx, qy);
          }
          ctx.globalAlpha = 1; ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
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
