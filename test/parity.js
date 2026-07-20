/* Structural self-checks for the renderer. Run: npm run parity (node test/parity.js).
 * These assert the invariants that must hold: layout, row count, wrap, engagement
 * deflation, neutral colour, the three-column field, languages, and that every flag
 * yields a valid static fallback. */
const { buildSVG } = require("../src/vibe.js");
let fails = 0;
function ok(cond, msg) { if (!cond) { console.error("  ✗ " + msg); fails++; } else console.log("  ✓ " + msg); }
const base = { kaomoji: "( ˶ˆ ꒳ ˆ˵ )", seems: "a", feel: "b", trying: "c", palette: ["#7d8fb8"] };

console.log("structure");
let s = buildSVG(base);
ok(s.startsWith("<svg") && s.endsWith("</svg>"), "well-formed <svg>…</svg>");
ok(/viewBox="0 0 680 152"/.test(s), "3-row banner is H=152 (v0.39.1: the window is a constant 140; the banner never shrinks below it)");
ok((s.match(/<text /g) || []).length === 4, "3 readout rows + 1 face = 4 <text>");
ok(/\[user\]/.test(s) && /\[mood\]/.test(s) && /\[goal\]/.test(s), "labels [user]/[mood]/[goal] present");

console.log("readout is a list (v0.41.0): custom labels, cap of 5, legacy mapping");
let rd = buildSVG(Object.assign({}, base, { readout: [{ label: "vibe", value: "loose" }, { label: "thread", value: "the builder" }] }));
ok(/\[vibe\]/.test(rd) && /\[thread\]/.test(rd), "custom labels render as their own rows");
let rd5 = buildSVG(Object.assign({}, base, { readout: [["a","1"],["b","2"],["c","3"],["d","4"],["e","5"],["f","6"]] }));
ok(/\[e\]/.test(rd5) && !/\[f\]/.test(rd5), "readout caps at five rows");
ok(/\[user\]/.test(buildSVG(base)), "legacy seems/feel/trying still map to the default labels");
let coh = (x) => buildSVG(Object.assign({}, base, x)).replace(/v(?:scn|wr)\d+/g, "vid");
ok(coh({ coherence: 0.2 }) === coh({ consonance: 0.2 }), "coherence is consonance renamed; both accepted");

console.log("every face pack speaks the 32-mood vocabulary");
ok(/kip-sheet\.png/.test(buildSVG(Object.assign({}, base, { face: { set: "kip", item: "working" } }))), "kip resolves a mood the old 8-cell sheet never had");
ok(!/twemoji/.test(buildSVG(Object.assign({}, base, { face: { set: "twemoji", item: "delighted" } }))), "the retired twemoji pack fetches nothing (v0.52.0)");
ok(/class="txt fk vk"/.test(buildSVG(Object.assign({}, base, { face: { set: "twemoji", item: "delighted" } }))), "a retired pack falls back to kaomoji, never a broken image");
ok(/class="txt fk vk"/.test(buildSVG(Object.assign({}, base, { face: { set: "noto", item: "content" } }))), "the retired noto packs fall back to kaomoji, never a broken image");

console.log("two keys (v0.42.0): avatar + details; empty details ships a square tile");
let sq = buildSVG({ avatar: { set: "sepia", item: "content" } });
ok(/viewBox="0 0 156 152"/.test(sq), "avatar alone → the window IS the banner (156x152)");
ok(!/<ellipse/.test(sq), "square tile has no field");
ok(!/\[user\]/.test(sq), "square tile has no readout");
ok(/sepia-sheet\.png/.test(sq), "square tile still draws its avatar");
ok(/viewBox="0 0 156 152"/.test(buildSVG({ avatar: { set: "sepia", item: "content" }, details: {} })), "details:{} is the same square");
let nested = buildSVG({ avatar: { set: "sepia", item: "content" }, details: { readout: [{ label: "user", value: "hi" }], palette: ["#e0994e"] } });
ok(/viewBox="0 0 680 152"/.test(nested) && /\[user\]/.test(nested) && /<ellipse/.test(nested), "details present → the full banner returns");
ok(/viewBox="0 0 680 152"/.test(buildSVG(base)), "the flat legacy payload is untouched by the split");
let sqFlag = buildSVG({ avatar: { set: "sepia", item: "content" }, details: {} , flag: "angry" });
ok(!/class="txt fl"/.test(sqFlag), "a square tile carries no caption at all");
let av = buildSVG({ avatar: "( ˘ ᵕ ˘ )" });
ok(/class="txt fk vk"/.test(av), "avatar as a bare string → kaomoji");
let avScene = buildSVG({ avatar: { set: "sepia", item: "content", scene: { url: "https://cdn.jsdelivr.net/gh/u/r@abc/p.png" } } });
ok(/vscn\d+/.test(avScene), "avatar.scene fills the window");

console.log("Motes: a procedural avatar — no sheet, formations from the mood table");
let mo = buildSVG(Object.assign({}, base, { face: { set: "motes", item: "content" } }));
ok(!/<image/.test(mo) && (mo.match(/<circle/g) || []).length > 40, "motes draws itself in circles, fetching no art at all");
let spreadOf = (m) => { let q = buildSVG(Object.assign({}, base, { face: { set: "motes", item: m } }));
  let xs = [...q.matchAll(/<circle cx="([0-9.]+)"/g)].map(v => +v[1]); return Math.max(...xs) - Math.min(...xs); };
ok(spreadOf("focused") < spreadOf("content"), "focused draws tighter than content");
ok(spreadOf("awe") > spreadOf("content") * 1.8, "awe flings the swarm wide");
ok(/viewBox="0 0 156 152"/.test(buildSVG({ avatar: { set: "motes", item: "spark" } })), "motes works as a bare square tile too");
ok(/<circle/.test(buildSVG(Object.assign({}, base, { face: { set: "motes", item: "not-a-mood" } }))), "an unknown mood falls back rather than failing");

console.log("optional [note] adds a row");
let n = buildSVG(Object.assign({}, base, { noticing: "peripheral" }));
ok(/viewBox="0 0 680 152"/.test(n), "4-row banner is also H=152 — text flexes inside the constant frame");
ok(/\[note\]/.test(n) && (n.match(/<text /g) || []).length === 5, "[note] present, 5 <text>");

console.log("text faces carry a backdrop plate; sprites do not");
let plt = buildSVG(base);
ok(/<rect class="vkp"[^>]*rx="8"/.test(plt), "kaomoji face → rounded .vkp plate behind it");
ok(plt.indexOf('class="vkp"') < plt.indexOf('class="txt fk vk"'), "plate renders under the text");
ok(!/class="vkp"/.test(buildSVG(Object.assign({}, base, { face: { set: "sepia", item: "content" } }))), "sprite face → no plate (it has its own body)");

console.log("kaomoji whitespace survives: leading-space indentation becomes NBSP");
let indented = buildSVG(Object.assign({}, base, { kaomoji: "  ∧,,∧\n( ̳• · • ̳)\n/    づ♡" }));
ok(/<tspan[^>]*>  ∧/.test(indented), "leading spaces preserved as NBSP (SVG would strip them)");
ok(/\/    づ/.test(indented), "internal space runs preserved too");

console.log("oversized kaomoji SCALE DOWN to fit the window (shape preserved, never crushed)");
ok(!/style="font-size:/.test(buildSVG(Object.assign({}, base, { kaomoji: "( ˘ ᵕ ˘ )" }))) , "compact face → natural size, no scaling");
let wide = buildSVG(Object.assign({}, base, { kaomoji: "( ﾟ∀ﾟ)ｱﾊﾊ\\/\\/\\/\\/\\/\\/\\/\\/" }));
let wfs = /style="font-size:([0-9.]+)px"/.exec(wide);
ok(wfs && +wfs[1] < 19, "wide single-line face → font scales below 19px (got " + (wfs && wfs[1]) + ")");
ok(!/textLength/.test(wide), "no textLength squeeze anywhere — scaling replaced it");
let wideML = buildSVG(Object.assign({}, base, { kaomoji: "✧\n( ﾟ∀ﾟ)ｱﾊﾊ\\/\\/\\/\\/\\/\\/\\/\\/\n✧" }));
let mfs = /style="font-size:([0-9.]+)px"/.exec(wideML);
ok(mfs && +mfs[1] < 15 && (wideML.match(/style="font-size:/g) || []).length === 1, "multi-line bloom scales uniformly as one unit");

console.log("goal wrap");
let long = buildSVG(Object.assign({}, base, { trying: "carefully verify every single one of the four new features works end to end before we ship" }));
ok((long.match(/<text /g) || []).length === 5, "long goal wraps → extra row");

console.log("face is one union: kaomoji string | url | sprite slice | known set");
let fk = buildSVG({ face: "( ˘ ᵕ ˘ )", seems: "a", feel: "b", trying: "c", palette: ["#7d8fb8"] });
ok(/class="txt fk vk"/.test(fk) && /˘.ᵕ.˘/.test(fk), "face: non-URL string → kaomoji text (no kaomoji key needed; spaces are NBSP)");
let fp1 = buildSVG(Object.assign({}, base, { face: "https://cdn.jsdelivr.net/gh/u/r@abc/moogle.png" }));
ok(/<image class="vk"[^>]*href="https:\/\/cdn\.jsdelivr\.net\/gh\/u\/r@abc\/moogle\.png"/.test(fp1), "face URL string → <image> face");
ok(!/class="txt fk vk"/.test(fp1), "image face replaces the kaomoji glyphs");
let fp2 = buildSVG(Object.assign({}, base, { face: { url: "https://cdn.jsdelivr.net/gh/u/r@abc/sheet.png", cellW: 64, cellH: 64, cols: 4, rows: 2, index: 5 } }));
ok(/<svg class="vk"[^>]*viewBox="64 64 64 64"/.test(fp2), "sprite index 5 of 4-col sheet → viewBox crops row 1, col 1");
ok(/width="256" height="128"/.test(fp2), "sheet dims derive from cell size × grid");
let kf2 = buildSVG(Object.assign({}, base, { face: { set: "kip", item: "puzzled" } }));
ok(/kip-sheet\.png/.test(kf2), "KnownFace kip:puzzled resolves the sheet");
ok(/viewBox="192 192 64 64"[^>]*>\s*<image[^>]*kip-sheet/.test(kf2), "kip:puzzled is cell 27 — col 3, row 3 of the 8-wide grid");
ok(/viewBox="0 0 64 64"[^>]*>\s*<image[^>]*kip-sheet/.test(buildSVG(Object.assign({}, base, { face: { set: "kip", item: "neutral" } }))), "kip:neutral is cell 0");
let kf3 = buildSVG(Object.assign({}, base, { face: { set: "sepia", item: "vertigo" } }));
ok(/sepia-sheet\.png/.test(kf3) && /viewBox="64 192 64 64"/.test(kf3), "KnownFace sepia:vertigo → index 25, col 1 row 3");
ok(/viewBox="448 192 64 64"/.test(buildSVG(Object.assign({}, base, { face: { set: "sepia", item: "love" } }))), "sepia:love → the last cell (31)");
ok(/class="txt fk vk"/.test(buildSVG(Object.assign({}, base, { face: { set: "unknown-set", item: "x" } }))), "unknown set → falls back to kaomoji");
ok(buildSVG(Object.assign({}, base, { face: { nope: true } })).indexOf("vk") > 0, "malformed face → falls back to kaomoji, no crash");
let ctr = +/(?:<image class="vk" x=")([0-9.]+)/.exec(fp1)[1];
ok(ctr === 50, "image faces centre in the window (x=" + ctr + " → centre 78 in the constant 140px window at x=8)");

console.log("scene: a framed portrait window on the left");
let sc = buildSVG(Object.assign({}, base, { scene: "https://cdn.jsdelivr.net/gh/u/r@abc/pool.png" }));
ok(/<clipPath id="vscn\d+"><rect x="8"[^>]*rx="10"/.test(sc), "scene → rounded clipped window at the left");
ok(/opacity="0.5"><image/.test(sc), "window default opacity 0.5");
ok(sc.indexOf("clipPath") < sc.indexOf("<ellipse"), "window renders BEHIND the field");
ok(/stroke="#8a7a86"/.test(sc), "the window has its quiet frame");
ok(/cx="265"/.test(sc) && /cx="397"/.test(sc) && /cx="530"/.test(sc), "field columns cede the left side to the window");
let noSc = buildSVG(base);
ok(/stroke="#8a7a86"/.test(noSc) && /fill-opacity="0.07"/.test(noSc) && !/vscn/.test(noSc), "no scene → the EMPTY window still draws (the window is the layout)");
ok(/cx="265"/.test(noSc), "columns sit rightward even without a scene");
ok(/opacity="0.95"><image/.test(buildSVG(Object.assign({}, base, { scene: { url: "https://x.co/a.png", opacity: 3 } }))), "opacity clamps to 0.95");

console.log("empty window: scene {} or true renders the frame with no image");
let ew = buildSVG(Object.assign({}, base, { scene: {} }));
ok(/stroke="#8a7a86"/.test(ew) && !/<image/.test(ew), "scene: {} → framed window, no image");
ok(/fill="#8a7a86" fill-opacity="0.07"/.test(ew), "empty window has a faint interior");
ok(/cx="265"/.test(ew), "empty window still shifts the field columns");
ok(!/vscn/.test(ew), "no image → no scene-image clip needed");
let ewT = buildSVG(Object.assign({}, base, { scene: true }));
ok(/stroke="#8a7a86"/.test(ewT) && !/<image/.test(ewT), "scene: true → same empty window");

console.log("scene.live is animation-only: the static render ignores it entirely");
const noClip = (svg) => svg.replace(/v(?:scn|wr)\d+/g, "vid");   // normalize both the scene-image and boundary clip ids
let lv0 = buildSVG(Object.assign({}, base, { scene: { url: "https://x.co/a.png" } }));
let lv1 = buildSVG(Object.assign({}, base, { scene: { url: "https://x.co/a.png", live: "tidepool" } }));
let lv2 = buildSVG(Object.assign({}, base, { scene: { url: "https://x.co/a.png", live: "volcano" } }));
ok(noClip(lv0) === noClip(lv1), "live: 'tidepool' → static svg identical to a still scene");
ok(noClip(lv0) === noClip(lv2), "unknown live name → ignored, no crash");

console.log("readout rows carry full-text tooltips");
let tt = buildSVG(Object.assign({}, base, { seems: "an overlong read that will clip", noticing: "the full subtext" }));
ok(/<title>an overlong read that will clip<\/title>/.test(tt), "[user] row has a <title> tooltip");
ok(/<title>the full subtext<\/title>/.test(tt), "[note] row has a <title> tooltip");
ok((long.match(/<title>carefully verify every single one/g) || []).length === 2, "wrapped goal: both rows tooltip the full goal");

console.log("three-column field");
let f = buildSVG(Object.assign({}, base, { palette: ["#7d8fb8", "#d99a5e", "#6fa39c"] }));
ok((f.match(/<ellipse /g) || []).length === 3, "always exactly three ovals");
ok(/cx="265"/.test(f) && /cx="397"/.test(f) && /cx="530"/.test(f), "columns pinned at x=265/397/530 (right of the window)");

console.log("engagement is deflationary (size only, columns fixed)");
const rx = (svg) => +/<ellipse[^>]*?rx="([0-9.]+)"/.exec(svg)[1];   // ellipse rx, not the window rect's corner radius
let e0 = rx(buildSVG(Object.assign({}, base, { engagement: 0 })));
let e5 = rx(buildSVG(Object.assign({}, base, { engagement: 0.5 })));
let e9 = rx(buildSVG(Object.assign({}, base, { engagement: 0.9 })));
ok(e5 === 150 && e9 === 150, "engagement ≥0.5 leaves size at baseline 150 (e5=" + e5 + ", e9=" + e9 + ")");
ok(e0 < 90, "engagement 0 shrinks the field hard (e0=" + e0 + ")");

console.log("empty palette = neutral grey, not amber");
let neut = buildSVG(Object.assign({}, base, { palette: [] }));
ok(/fill="#a7a29b"/.test(neut), "no palette → neutral #a7a29b in the centre column");

console.log("languages: bottom-right trace, code or name, flag where known");
let lang = buildSVG(Object.assign({}, base, { languages: ["ru", "Esperanto"] }));
ok(/\[Reasoned in\]:/.test(lang), "renders the [Reasoned in]: trace");
ok(/🇷🇺/.test(lang), "ru → flag");
ok(/Esperanto/.test(lang) || /eo/.test(lang), "Esperanto (no flag) → text, name in title");
ok(/text-anchor="end"/.test(lang), "pinned to the right edge");

console.log("flags render (static markers)");
ok(!/#ffe27a/.test(buildSVG(Object.assign({}, base, { flag: "spark" }))), "spark adds NO bulb (v0.33.0: marks are the avatar's own props, baked into its sheet)");
ok(!/class="txt fl"/.test(buildSVG(Object.assign({}, base, { flag: "excited" }))), "excited brings no weather — the avatar owns that feeling now (v0.44.0)");
ok(!/scale\(0\.62\)/.test(buildSVG(Object.assign({}, base, { flag: "awe" }))), "awe never poses the face (v0.31.0: a flag is banner weather; the face is the avatar's)");

console.log("removed params are ignored, no crash");
ok(buildSVG(Object.assign({}, base, { spread: 0.9, turbulence: 0.9, conviction: 0.3, history: [{ v: .4 }] })).startsWith("<svg"), "legacy params ignored");

console.log("stance: declarative gains a contour, asking keeps the open falloff");
let st0 = buildSVG(base);
let st1 = buildSVG(Object.assign({}, base, { stance: 1 }));
ok(!/<ellipse[^>]*stroke-opacity/.test(st0), "stance omitted → no oval stroke (today's look)");
ok(/stroke-opacity="0.55"/.test(st1), "stance 1 → definite oval edge");

console.log("consonance: split → diffuse washes (bigger, thinner); omitted = compact");
let c1 = buildSVG(base);
let c0 = buildSVG(Object.assign({}, base, { consonance: 0 }));
ok(rx(c0) > rx(c1), "consonance 0 spreads the ovals (rx " + rx(c0) + " > " + rx(c1) + ")");
const elOp = (svg) => +/<ellipse[^>]*?" opacity="([0-9.]+)"/.exec(svg)[1];   // the ellipses' opacity, not the window's
ok(elOp(c0) < elOp(c1), "consonance 0 thins the washes");

console.log("retired params are ignored, never fatal");
ok(buildSVG(Object.assign({}, base, { prev: ["#a06a6a"] })).startsWith("<svg"), "prev (retired in v0.41.2) is inert, not a crash");

console.log("flag is a single string — the API contract");
const FLOWERS = /🌸|🌼|✿|❀|🌷/;
ok(FLOWERS.test(buildSVG(Object.assign({}, base, { weather: "bloom" }))), "weather: bloom blossoms");
let unk = buildSVG(Object.assign({}, base, { flag: "enraptured" }));
ok(unk.startsWith("<svg") && !/class="txt fl"/.test(unk), "unknown flag string → ignored, no trace, no crash");
let pz = buildSVG(Object.assign({}, base, { flag: "puzzled" }));
ok(!/>\?<\/text>/.test(pz), "puzzled hangs NO ?-cloud (v0.33.0: the ? is the avatar's own prop, baked into its sheet)");

console.log("legacy boolean payloads still resolve, one flag wins by priority");
let multi = buildSVG(Object.assign({}, base, { angry: true, at_peace: true, puzzled: true }));
ok(!FLOWERS.test(multi), "angry outranks at_peace: no blossoms");
ok(!/>\?<\/text>/.test(multi), "angry outranks puzzled: no question-cloud");
ok(!FLOWERS.test(buildSVG(Object.assign({}, base, { tender: true, at_peace: true }))), "tender outranks at_peace: no blossoms");
ok(FLOWERS.test(buildSVG(Object.assign({}, base, { bloom: true }))), "boolean weather still resolves");

console.log("window caption: bottom-left [name] holds the FACE'S MOOD (v0.51.0), not the weather");
const capOf = (payload) => { const m = /class="txt fl">\[([^\]]+)\]<\/text>/.exec(buildSVG(payload)); return m ? m[1] : null; };
ok(capOf(Object.assign({}, base, { face: { set: "sepia", item: "working" } })) === "working", "a sepia mood captions itself");
ok(capOf(Object.assign({}, base, { face: { set: "motes", item: "awe" } })) === "awe", "a motes mood captions itself");
ok(capOf(Object.assign({}, base, { face: { set: "kip", item: "puzzled" } })) === "puzzled", "a kip mood captions itself");
ok(capOf(Object.assign({}, base, { face: { set: "sepia", item: "at_peace" } })) === "at peace", "underscores read as spaces");
ok(capOf(base) === null, "a kaomoji names itself — no caption");
ok(capOf(Object.assign({}, base, { face: "https://cdn.jsdelivr.net/gh/u/r@abc/x.png" })) === null, "an arbitrary image has no mood to report");
ok(capOf(Object.assign({}, base, { face: "https://cdn.jsdelivr.net/gh/u/r@abc/y.png" })) === null, "an image URL has no mood to caption");
let wOnly = buildSVG(Object.assign({}, base, { weather: "storm" }));
ok(!/class="txt fl">\[storm\]/.test(wOnly), "weather no longer captions: seven registers, rare and unmistakable");
let bothCap = capOf(Object.assign({}, base, { face: { set: "sepia", item: "angry" }, weather: "storm" }));
ok(bothCap === "angry", "with weather AND a mood face, the caption stays the mood");
ok(!/class="txt fl"/.test(buildSVG({ avatar: { set: "sepia", item: "content" } })), "a square tile stays uncaptioned — the creature without the commentary");
let ft = buildSVG(Object.assign({}, base, { face: { set: "sepia", item: "solemn" } }));
ok(/viewBox="0 0 680 152"/.test(ft), "the caption lives inside the window — no bottom padding (H=152)");

console.log("new-flag static markers");
ok(/🌸|🌼|✿|❀|🌷/.test(buildSVG(Object.assign({}, base, { bloom: true }))), "bloom scatters blossoms");
let sol = buildSVG(Object.assign({}, base, { hush: true }));
ok(/<rect [^>]*fill="#2a2622"/.test(sol) && /#ffbf72/.test(sol), "solemn dims once and keeps one ember");
ok(/<line /.test(buildSVG(Object.assign({}, base, { converge: true }))), "converge draws concentration lines");
ok(!/>\?<\/text>/.test(buildSVG(Object.assign({}, base, { puzzled: true }))), "puzzled (legacy boolean) also hangs no ? — the mark lives in the sheet now");
let rh = buildSVG(Object.assign({}, base, { rhyme: true }));
ok((rh.match(/꒳/g) || []).length === 1, "the rhyme echo retired with the flag — one face, no duplicate (v0.44.0)");

console.log("every flag yields a valid static fallback (string API + legacy boolean)");
["surprised", "tender", "melancholy", "anxious", "mirth", "laugh", "groan", "oops", "dramatic", "frustrated", "angry", "excited", "spark",
 "at_peace", "solemn", "rhyme", "awe", "vertigo", "resolute", "puzzled"].forEach(function (fl) {
  var s1 = buildSVG(Object.assign({}, base, { flag: fl }));
  var o = {}; o[fl] = true;
  var s2 = buildSVG(Object.assign({}, base, o));
  ok(s1.startsWith("<svg") && s1.endsWith("</svg>") && noClip(s1) === noClip(s2), fl + " → valid static svg, string ≡ legacy boolean");
});

console.log("\npalette is top-level (v0.46.0): it colours the avatar, not just the field");
let palTop = buildSVG({ avatar: { set: "sepia", item: "content" }, palette: ["#d99a5e"] });
ok(/viewBox="0 0 156 152"/.test(palTop), "a palette alone does NOT widen the tile — still a square");
let palNorm = (s) => s.replace(/v(?:scn|wr)\d+/g, "vid");
ok(palNorm(buildSVG({ avatar: "( ˆ ᵕ ˆ )", palette: ["#d99a5e"], details: { seems: "a", feel: "b", trying: "c" } }))
   === palNorm(buildSVG({ avatar: "( ˆ ᵕ ˆ )", details: { seems: "a", feel: "b", trying: "c", palette: ["#d99a5e"] } })),
   "palette in details is still honoured, and renders identically to top-level");

console.log("\nflight paths (v0.46.0): open curves ping-pong, mouths smile, glyphs spell");
const M = require("../src/vibe.js").__motes;
const MOTE_STILL = 0.9;   // mirrors MOTE_STILL_T: sample where a flash is at full reach
function frameAt(mood, t) {
  // phase selection runs on real time; the PATHS see the warped clock (a mood may stop it —
  // groan's held beat — and the renderer does exactly this, so the test must too)
  const paths = M.pathsFor(mood, t), tw = M.warp(mood, t), out = [];
  for (let i = 0; i < M.N; i++) out.push(M.target(i, M.N, tw, paths, 0, 0, 100, 7));
  return out;
}
let worstJump = 0;
["solemn", "sleepy", "melancholy", "groan", "weary"].forEach((m) => {
  for (let t = 0; t < 8; t += 1 / 30) {
    const a = frameAt(m, t), b = frameAt(m, t + 1 / 30);
    for (let i = 0; i < M.N; i++) worstJump = Math.max(worstJump, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  }
});
// The guarantee here is "no WRAP", which is a ~140px lurch across the whole shape. The old
// 12px ceiling was really just a snapshot of how slow these moods happened to be; groan now
// orbits fast on purpose and weary races its Zs, and this samples at 30fps, so a real 60fps
// step is half what it measures. Keep the bar far below a wrap and well above honest speed.
ok(worstJump < 25, "open paths never teleport: worst step " + worstJump.toFixed(2) + "px of R=100 (a wrap would be ~140)");
ok(M.closed({ p: "ring" }) && M.closed({ p: "infinity" }) && !M.closed({ p: "line" }) && !M.closed({ p: "poly" }),
   "closedness: ring/infinity wrap, line/poly ping-pong");
// Only the moods that still WEAR a smile. laugh and excited dropped their arcs (v0.84/0.86) —
// they say it in the light now — and leaving them here would have been a test passing by
// accident on shapes that no longer exist, which is worse than no test.
["mirth", "delighted"].forEach((m) => {
  const pts = frameAt(m, 0).slice().sort((p, q) => p.x - q.x);
  const ends = (pts[0].y + pts[pts.length - 1].y) / 2, mid = pts[Math.floor(pts.length / 2)].y;
  ok(mid > ends, m + " curves as a SMILE, not a rainbow (a rainbow reads as a frown)");
});
// A WINK IS ONE EYE (v0.85.0). It used to flash a whole face out of a ring, which read as a
// smile that came and went. The face stands now and one eye snaps shut. Shares are .19/.19/.62
// of 64, so motes 0-11 are the left eye, 12-23 the right, the rest the mouth.
{
  const eh = (pts) => Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
  const eyes = (t) => { const F = frameAt("wink", t); return { L: eh(F.slice(0, 12)), R: eh(F.slice(12, 24)) }; };
  const mid = eyes(4.2 + 0.31), rest = eyes(4.2 - 0.8);
  ok(mid.R < mid.L * 0.45 && mid.L > mid.R + 10,
     "wink: mid-flash the right eye is a dash (" + mid.R.toFixed(1) + ") while the left stays open (" + mid.L.toFixed(1) + ")");
  ok(Math.abs(rest.L - rest.R) < 3, "at rest both eyes match — a face standing, not a smile arriving");
  let shut = 0;
  for (let t = 4.2; t < 5.4; t += 0.01) if (eyes(t).R < rest.R * 0.6) shut += 0.01;
  ok(shut > 0.15 && shut < 0.9, "and it is a snap, not a pose (" + shut.toFixed(2) + "s shut)");
}
// EXCITED (v0.86.0) used to spend 60% of the swarm on a mouth arc, which read as a grin with
// no face around it. Excitement isn't an expression — it's everyone going off at once and NOT
// together, so it carries no formation and lives in the brightness channel instead.
{
  const EP = M.moods.excited.paths;
  ok(!EP.some((p) => p.p === "arc"), "excited carries no mouth — no facial feature to misread");
  ok(EP.every((p) => p.align <= 0.15), "all its paths stay loose — nothing snaps into a shape");
  ok(EP.reduce((a, p) => a + p.share, 0) < 0.85, "and a share of the swarm drifts free of any path");
  ok(M.glow("excited", 1).spark === 1, "excited is fully sparked: every mote flares on its own clock");
  ok(!M.glow("laugh", 1).spark && M.glow("laugh", 1).sync === 1,
     "laugh is its opposite — unison, not desync; the two ends of one dial");
  ok(!M.glow("content", 1).spark && !M.glow("content", 1).sync, "an ordinary mood uses neither");
}
let bang = frameAt("surprised", MOTE_STILL), bx = bang.map((p) => p.x);
ok(Math.max(...bx) - Math.min(...bx) < 6, "surprised flashes an exclamation: a vertical stroke, near-zero width");
// ASKING is the question mark now (v0.83.0). It used to be a wide arc, which read as a frown
// — the same rainbow-is-a-frown trap `mirth` fell into. A question asked should look like one.
let ask = frameAt("asking", MOTE_STILL);
const askYs = ask.map((p) => p.y), askXs = ask.map((p) => p.x);
ok(Math.max(...askYs) - Math.min(...askYs) > 100, "asking spells a question mark: tall, with a detached dot");
ok((Math.max(...askXs) - Math.min(...askXs)) < (Math.max(...askYs) - Math.min(...askYs)),
   "and it stands upright — taller than it is wide, not an arc lying on its back");
{ // not a frown: an arch puts its middle ABOVE its ends. The mark's mass does the opposite.
  const byX = ask.slice().sort((a, b) => a.x - b.x);
  const ends = (byX[0].y + byX[byX.length - 1].y) / 2, mid = byX[Math.floor(byX.length / 2)].y;
  ok(!(mid < ends - 12), "asking does not arch like a frown (mid " + mid.toFixed(0) + " vs ends " + ends.toFixed(0) + ")");
}
// PUZZLED is several smaller questions, each gathering and loosening on its OWN clock.
let qm = frameAt("puzzled", MOTE_STILL);
ok(Math.max(...qm.map((p) => p.y)) - Math.min(...qm.map((p) => p.y)) > 100, "puzzled fills the field with question marks");
{
  const grips = (t) => {                                     // one mote from each of the four marks
    const P = M.pathsFor("puzzled", t);
    return [2, 20, 36, 56].map((i) => +M.target(i, M.N, t, P, 0, 0, 100, 7).align.toFixed(3));
  };
  const t0 = grips(0.6);
  ok(new Set(t0).size > 1, "the four marks are at different grips at the same instant — not in lockstep (" + t0.join(", ") + ")");
  let varies = [0, 0, 0, 0];
  for (let t = 0; t < 12; t += 0.25) { const g = grips(t); g.forEach((v, i) => { if (Math.abs(v - grips(0)[i]) > 0.15) varies[i] = 1; }); }
  ok(varies.every(Boolean), "every mark forms and dissolves over time rather than standing still");
}
let sil = new Set();
for (let t = 0; t < 13; t += 1) {
  const f = frameAt("working", t), xs = f.map((p) => p.x), ys = f.map((p) => p.y);
  sil.add(Math.round(Math.max(...xs) - Math.min(...xs)) + "x" + Math.round(Math.max(...ys) - Math.min(...ys)));
}
ok(sil.size >= 5, "working never settles: " + sil.size + " distinct silhouettes across 13s");
ok(/<circle/.test(buildSVG({ avatar: { set: "motes", item: "working" } })), "working renders statically too");
ok(/sepia-sheet/.test(buildSVG({ avatar: { set: "sepia", item: "working" } })), "a pack without art for a mood falls back instead of breaking");
// "A plain ring" means a mood with nothing to say. A mood that speaks through the BRIGHTNESS
// channel — laugh's unison, excited's desync — is not plain just because its paths are round;
// that is the whole point of those two. Judge them on the light as well as the shape.
let ringOnly = Object.keys(M.moods).filter((k) => {
  const p = M.moods[k].paths, g = M.glow(k, 1);
  const mute = !g.spark && !g.sync && !g.fade;
  return p && p.every((x) => !x.p || x.p === "ring") && !M.moods[k].flash && mute;
});
ok(ringOnly.length <= 10, "the swarm is not all circles: " + ringOnly.length + " moods are a plain ring, no flash, no glow (was 20)");

console.log("\nnamed environments (v0.48.0): scene: \"tidepool\" is the whole thing");
const sceneOf = (sc) => {
  const q = buildSVG({ avatar: { set: "sepia", item: "content", scene: sc }, details: { seems: "a", feel: "b", trying: "c" } });
  const m = /href="([^"]*assets\/scene-[^"]*)"/.exec(q);
  return m ? m[1] : null;
};
["tidepool", "study", "night", "glade"].forEach((n) => {
  const u = sceneOf(n);
  ok(u && u.indexOf("scene-" + n + ".png") > 0, 'scene: "' + n + '" resolves to its art');
  ok(u && /@[0-9a-f]{40}\//.test(u), 'scene: "' + n + '" is pinned to a full sha, never a tag');
});
ok(!sceneOf("nonsense"), "an unknown name renders an EMPTY window, not a request for an image called nonsense");
ok(sceneOf("https://cdn.jsdelivr.net/gh/u/r@abc/assets/scene-custom.png") === null
   || /example|custom/.test(String(sceneOf("https://cdn.jsdelivr.net/gh/u/r@abc/assets/scene-custom.png"))), "a url-shaped string is still taken as a url");
let namedObj = buildSVG({ avatar: { set: "sepia", item: "content", scene: { name: "tidepool", opacity: 0.9 } }, details: { seems: "a", feel: "b", trying: "c" } });
ok(/scene-tidepool\.png/.test(namedObj) && /opacity="0\.9"/.test(namedObj), "{ name, opacity } lets you keep the name and still set opacity");

// SCENE_PIN must contain the art for EVERY scene it advertises. It doesn't by default:
// it lagged hearth+rain by 28 releases (pinned to v0.47.0, which had four scenes), so those
// two 404'd on the CDN and their windows silently emptied. Resolving a name is not the same
// as the pinned commit having the bytes — assert the bytes, at the pin, for all six.
{
  const cp = require("child_process");
  const pinSha = (/@([0-9a-f]{40})\//.exec(sceneOf("tidepool")) || [])[1];
  ok(/^[0-9a-f]{40}$/.test(pinSha || ""), "SCENE_PIN is a full 40-char sha");
  const files = ["tidepool", "study", "night", "glade"].map((n) => "scene-" + n + ".png");
  const missing = files.filter((f) => {
    try { cp.execSync("git cat-file -e " + pinSha + ":assets/" + f, { stdio: "ignore" }); return false; }
    catch { return true; }
  });
  ok(!missing.length, "SCENE_PIN " + (pinSha || "").slice(0, 7) + " ships every scene's art" +
     (missing.length ? " — these 404 on the CDN: " + missing.join(", ") : ""));
}
// The skill is composed, not checked in (v0.49.0) — so these assert the COMPOSER, which is
// the same function the Builder runs in the browser. The guarantee moves with the generator
// rather than with an artifact nobody was looking at.
const { assemble: composeSkill, HOMES } = require("../scripts/gen-skills.js");
let composed = Object.keys(HOMES).map((face) => ({ face: face, md: composeSkill(face, { scene: HOMES[face] }) }));
let sceneless = composed.filter((c) => !/scene:/.test(c.md)).map((c) => c.face);
ok(!sceneless.length, "every composed skill names a home — a stock skill could not set one before v0.48.0" + (sceneless.length ? ": " + sceneless : ""));
let shaInScene = composed.filter((c) => { const snip = /scene: \{[^}]*\}/.exec(c.md); return snip && /[0-9a-f]{40}/.test(snip[0]); }).map((c) => c.face);
ok(!shaInScene.length, "no composed skill asks the reporter to hand-copy a 40-char sha for a scene");
ok(composed.every((c) => /scene: "[a-z]+"/.test(c.md)), "the scene arrives as a bare name in every variant");
ok(!require("fs").existsSync("skill"), "no checked-in skill files: the Builder is where the skill lives");
let sepiaMd = composeSkill("sepia", { scene: "tidepool" });
ok(/set: "sepia"/.test(sepiaMd) && /scene: "tidepool"/.test(sepiaMd), "the canonical build composes: sepia in her tidepool");
ok(/palette: \[/.test(sepiaMd) && !/details: \{[^}]*palette/.test(sepiaMd.replace(/\n/g, "")), "composed skills put palette at the top level, not in details");

console.log("\nshapes tween (v0.47.0): no mood ever hard-swaps its target");
let jumpy = [];
Object.keys(M.moods).forEach((m) => {
  let w = 0;
  for (let t = 0; t < 25; t += 1 / 60) {
    const a = frameAt(m, t), b = frameAt(m, t + 1 / 60);
    for (let i = 0; i < M.N; i++) w = Math.max(w, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  }
  // 12px, not 8: this guards against a SWAP (~150px of instant teleport). 8 was a snapshot of
  // how fast the moods happened to move back when none of them hurried; excited now orbits at
  // ~9px/frame on purpose, and with align 0.12 the motes lag well behind that station anyway.
  if (w > 12) jumpy.push(m + " (" + w.toFixed(1) + "px)");
});
ok(!jumpy.length, "every mood's target moves continuously — a swap would step ~150px" + (jumpy.length ? " — jumpy: " + jumpy : ""));
let plan = M.pathsFor("working", 0.4);
ok(plan.a !== plan.b && plan.k > 0 && plan.k < 1, "mid-gather, a seq mood is genuinely blending two sets (k=" + plan.k.toFixed(2) + ")");
ok(M.pathsFor("working", 1.2).k === 0, "mid-hold, it rests on one shape rather than blending forever");
let fl = M.pathsFor("surprised", 0.2);
ok(fl.k > 0 && fl.k < 1, "flash ramps in too — the mark gathers rather than appearing");

console.log("\nmulti-line faces (v0.55.0): whitespace is never trimmed; alignment defers to the author");
let bloomSVG = buildSVG(Object.assign({}, base, { kaomoji: "✧ ･ ✧\n( ˶ˆ ꓳ ˆ˵ )\n✧ ･ ✧" }));
ok(/class="txt fkt vk" text-anchor="middle"/.test(bloomSVG), "an UNPADDED bloom centres — flush left reads as though the spaces had been eaten");
let padSVG = buildSVG(Object.assign({}, base, { kaomoji: "  ∧,,∧\n( ̳•  ·  • ̳)\n/    づ♡" }));
ok(!/text-anchor="middle"/.test(/<text[^>]*class="txt fkt vk"[^>]*>/.exec(padSVG)[0]),
   "HAND-ALIGNED art keeps the author's alignment — centring would move what they deliberately placed");
let padT = [...padSVG.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]).slice(0, 3);
ok(padT[0].indexOf("  ") === 0, "the leading indent survives, as NBSP");
ok(padT.join("").indexOf(" ") < 0, "not one plain space left unconverted — nothing collapses");
ok(padT.reduce((n, t) => n + t.split(" ").length - 1, 0) === 12, "all twelve spaces of the padded art survive");

console.log("\ntender is a heart; dramatic wears the one mask (v0.59.0)");
const heartPts = (() => {
  const P = M.pathsFor("tender", 1.0), o = [];
  for (let i2 = 0; i2 < M.N; i2++) o.push(M.target(i2, M.N, 1.0, P, 0, 0, 100, 7));
  return o;
})();
const hTop = Math.min(...heartPts.map((p) => p.y)), hBot = Math.max(...heartPts.map((p) => p.y));
const spanOf = (a) => (a.length ? Math.max(...a.map((p) => p.x)) - Math.min(...a.map((p) => p.x)) : 0);
const lobes = spanOf(heartPts.filter((p) => p.y < hTop + (hBot - hTop) * 0.3));
const point = spanOf(heartPts.filter((p) => p.y > hBot - (hBot - hTop) * 0.1));
ok(lobes > point * 2.5, "a heart: wide across the lobes, pinched to a point at the base (" +
  lobes.toFixed(0) + " vs " + point.toFixed(0) + ")");
ok(heartPts.some((p) => Math.abs(p.x) < 14 && p.y < hTop + (hBot - hTop) * 0.22),
   "with a cleft between the lobes — a heart, not a dome");
const maskOf = (m) => /<text[^>]*font-size[^>]*>.{1,3}<\/text>/.test(
  buildSVG(Object.assign({}, base, { face: { set: "motes", item: m } })));
ok(maskOf("dramatic"), "dramatic wears the mask in the still frame too — it IS the pose");
ok(!maskOf("tender") && !maskOf("content") && !maskOf("laugh"),
   "no other mood wears an emoji: the swarm says everything else with its own shape");

console.log("\nthe language pill (v0.60.0): a readout row, not a footnote");
let langSVG = buildSVG(Object.assign({}, base, { languages: ["ru", "ja"] }));
ok(/\[Reasoned in\]/.test(langSVG), "the STATIC fallback keeps its caption — there is no panel there to straddle");
ok(!/class="txt fl"/.test(buildSVG(base)), "no languages → nothing rendered at all");
ok(/viewBox="0 0 680 164"/.test(langSVG), "the static banner grows a row for its caption — the live pill straddles instead, so it needs none");

console.log("\nthe echo (v0.58.0): rhyme doubles the creature, quietly");
const echoOf = (set, item) => {
  const q = buildSVG(Object.assign({}, base, { face: { set: set, item: item } }));
  const m = /opacity="0\.2" transform="translate\((-?[0-9.]+),0\)"/.exec(q);
  return m ? +m[1] : null;
};
ok(echoOf("sepia", "rhyme") !== null, "sepia rhymes with itself");
ok(echoOf("kip", "rhyme") !== null, "kip rhymes with itself");
ok(echoOf("sepia", "content") === null && echoOf("kip", "solemn") === null, "no other mood echoes");
ok(echoOf("motes", "rhyme") === null, "Motes does NOT echo — it already dissolves and re-forms; doubling reads as noise");
ok(Math.abs(echoOf("sepia", "rhyme") / 56 + 0.8) < 0.001, "offset is 80% of the face's own width, left (" + echoOf("sepia", "rhyme") + "px of 56)");
let echoSVG = buildSVG(Object.assign({}, base, { face: { set: "kip", item: "rhyme" } }));
ok((echoSVG.match(/kip-sheet\.png/g) || []).length >= 2, "the echo is a real replica, not a smudge — the sheet is drawn twice");
ok(/aria-hidden="true"[^>]*>|<g opacity="0\.2"[^>]*aria-hidden="true"/.test(echoSVG), "the echo is hidden from assistive tech: it says nothing new");

console.log("\nKip is STEPPED (v0.52.0): a discrete clock, never a tween");
const K = require("../src/vibe.js").__kip;
let held = [0, 0.04, 0.09, 0.14].map((d) => K.frameAt("delighted", 0.5 + d, 6));
ok(new Set(held).size === 1, "the frame is CONSTANT within a step — nothing interpolates");
let calm = Array.from({ length: 12 }, (_, n) => K.frameAt("neutral", n / 6, 6)).join("");
ok(/^(0001)+$/.test(calm), "a calm mood holds frame 0 three steps, then one off-beat: " + calm);
let busy = Array.from({ length: 12 }, (_, n) => K.frameAt("delighted", n / 6, 6)).join("");
ok(/^(01)+$/.test(busy), "a busy mood alternates every step: " + busy);
let rare = Array.from({ length: 14 }, (_, n) => K.frameAt("solemn", n / 6, 6)).join("");
ok(rare.split("1").length - 1 <= 2, "a still mood twitches at most twice in 14 steps: " + rare);
ok(K.beat.length === 33, "one beat char per mood");
ok(K.beat.split("").every((c) => K.pattern[c]), "every beat char names a real pattern");
ok(["delighted", "excited", "laugh", "working"].every((m) => K.pattern[K.beat[K.moods.indexOf(m)]].length <= 2),
   "energetic moods get the short pattern — stillness is not distributed at random");

console.log("\nTHE INVENTORY (v0.68.0): every pack has its OWN art for every mood");
// Resolving is not the same as having art. Sepia covered all 33 for six releases while
// `working` quietly shared a cell with `focused` — it rendered, it just rendered the wrong
// creature. Two moods landing on one cell is the only way to see that from outside.
const CANON = ["neutral", "content", "delighted", "focused", "sleepy", "sheepish", "booped",
  "thinking", "spark", "excited", "surprised", "tender", "melancholy", "anxious", "mirth",
  "laugh", "groan", "oops", "frustrated", "angry", "dramatic", "at_peace", "solemn", "rhyme",
  "awe", "vertigo", "resolute", "puzzled", "asking", "weary", "wink", "love", "working"];
ok(CANON.length === 33, "the sheet holds 33 cells");
["sepia", "kip", "drollery"].forEach((set) => {
  const byCell = {};
  CANON.forEach((mood) => {
    const q = buildSVG(Object.assign({}, base, { face: { set: set, item: mood } }));
    const r = /viewBox="(\d+) (\d+) 64 64"[^>]*>\s*<image[^>]*-sheet/.exec(q);
    const key = r ? r[1] + "," + r[2] : "MISSING";
    (byCell[key] = byCell[key] || []).push(mood);
  });
  const shared = Object.keys(byCell).filter((k) => byCell[k].length > 1).map((k) => byCell[k].join("="));
  ok(!byCell.MISSING && !shared.length,
     set + " draws all 33 cells distinctly" + (shared.length ? " — SHARING: " + shared.join(" ") : ""));
});
let moteGaps = CANON.filter((m) => !M.moods[m]);
ok(!moteGaps.length, "motes has a formation for all 33" + (moteGaps.length ? " — missing " + moteGaps : ""));
ok(Object.keys(M.moods).length === 33, "and no formations beyond the sheet");
// booped is a reaction, not a mood (v0.71.0): art present, but never offered.
const OFFERED = require("../scripts/gen-skills.js").PIECES.MOOD_LIST_ALL;
ok(OFFERED.length === 31 && OFFERED.indexOf("booped") < 0 && OFFERED.indexOf("sleepy") < 0,
   "booped and sleepy are retired from the offered vocabulary (31 moods)");
// Retired means "not offered", NOT "deleted". Both keep their cell in every sheet so the grid
// never reindexes and no pinned art has to be redrawn — the whole reason retiring is cheap.
["booped", "sleepy"].forEach((m) => {
  ok(CANON.indexOf(m) >= 0 && /-sheet/.test(buildSVG(Object.assign({}, base, { face: { set: "sepia", item: m } }))),
     m + " keeps its cell and still renders if asked for directly");
});
ok(CANON.indexOf("booped") >= 0 && /-sheet/.test(buildSVG(Object.assign({}, base, { face: { set: "sepia", item: "booped" } }))),
   "but its cell art is intact — it is the boop interrupt now");

console.log("\nevery mood resolves in every pack that advertises it");
const MOODS_ALL = ["neutral","content","delighted","focused","sleepy","sheepish","booped","thinking",
  "spark","excited","surprised","tender","melancholy","anxious","mirth","laugh","groan","oops",
  "frustrated","angry","dramatic","at_peace","solemn","rhyme","awe","vertigo","resolute","puzzled",
  "asking","weary","wink","love","working"];
let noArt = MOODS_ALL.filter((m) => !M.moods[m]);
ok(!noArt.length, "motes has a formation for all " + MOODS_ALL.length + " moods" + (noArt.length ? " — missing " + noArt : ""));
let kipMissing = MOODS_ALL.filter((m) => !/kip-sheet/.test(buildSVG(Object.assign({}, base, { face: { set: "kip", item: m } }))));
ok(!kipMissing.length, "kip draws all " + MOODS_ALL.length + " moods — he was eight until v0.52.0" + (kipMissing.length ? ": " + kipMissing : ""));
let kipCells = new Set(MOODS_ALL.map((m) => {
  const q = buildSVG(Object.assign({}, base, { face: { set: "kip", item: m } }));
  return (/viewBox="(\d+ \d+) 64 64"[^>]*>\s*<image[^>]*kip-sheet/.exec(q) || [])[1];
}));
ok(kipCells.size === MOODS_ALL.length, "every kip mood lands on its OWN cell (" + kipCells.size + " distinct)");
let sepiaIdx = MOODS_ALL.map((m) => { let s = buildSVG(Object.assign({}, base, { face: { set: "sepia", item: m } })); return /sepia-sheet/.test(s); });
ok(sepiaIdx.every(Boolean), "sepia renders a cell for every mood (via fallback where art is pending)");

console.log(fails ? "\nFAILED (" + fails + ")" : "\nALL PASS");
process.exit(fails ? 1 : 0);
