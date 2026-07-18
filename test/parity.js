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
ok(/1f604\.png/.test(buildSVG(Object.assign({}, base, { face: { set: "twemoji", item: "delighted" } }))), "twemoji: mood name resolves to its emoji");
ok(/1f620\.png/.test(buildSVG(Object.assign({}, base, { face: { set: "twemoji", item: "angry" } }))), "twemoji: a second mood name resolves");
ok(/1f60a\.png/.test(buildSVG(Object.assign({}, base, { face: { set: "twemoji", item: "1f60a" } }))), "raw codepoints still pass through");
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
ok(!/class="txt fl"/.test(sqFlag), "a square tile carries no weather — flags are details");
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
let kf1 = buildSVG(Object.assign({}, base, { face: { set: "twemoji", item: "1f60a" } }));
ok(/twemoji@15\.1\.0\/assets\/72x72\/1f60a\.png/.test(kf1), "KnownFace twemoji resolves its jsDelivr URL");
let kf2 = buildSVG(Object.assign({}, base, { face: { set: "kip", item: "puzzled" } }));
ok(/kip-sheet\.png/.test(kf2) && /viewBox="128 0 64 64"/.test(kf2), "KnownFace kip:puzzled → sheet cell 2");
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

console.log("flag caption: bottom-left [name] whenever a flag fires");
ok(!/class="txt fl"/.test(buildSVG(base)), "no flag → no caption");
let ft = buildSVG(Object.assign({}, base, { weather: "hush" }));
ok(/>\[hush\]<\/text>/.test(ft), "legacy solemn resolves to the hush weather");
ok(/>\[bloom\]<\/text>/.test(buildSVG(Object.assign({}, base, { weather: "bloom" }))), "bloom captions itself");
ok(/>\[storm\]<\/text>/.test(buildSVG(Object.assign({}, base, { storm: true }))), "boolean weather payload works");
ok(!/class="txt fl"/.test(buildSVG(Object.assign({}, base, { flag: "at_peace" }))), "a retired flag name is simply ignored — no alias table (v0.45.0: old skills pin old builds)");
ok(/viewBox="0 0 680 152"/.test(ft), "flag caption lives in the window — no bottom padding (H=152)");

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
function frameAt(mood, t) {
  const paths = M.pathsFor(mood, t), out = [];
  for (let i = 0; i < M.N; i++) out.push(M.target(i, M.N, t, paths, 0, 0, 100, 7));
  return out;
}
let worstJump = 0;
["solemn", "sleepy", "melancholy", "groan", "weary"].forEach((m) => {
  for (let t = 0; t < 8; t += 1 / 30) {
    const a = frameAt(m, t), b = frameAt(m, t + 1 / 30);
    for (let i = 0; i < M.N; i++) worstJump = Math.max(worstJump, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  }
});
ok(worstJump < 12, "open paths never teleport: worst step " + worstJump.toFixed(2) + "px of R=100 (a wrap would be ~140)");
ok(M.closed({ p: "ring" }) && M.closed({ p: "infinity" }) && !M.closed({ p: "line" }) && !M.closed({ p: "poly" }),
   "closedness: ring/infinity wrap, line/poly ping-pong");
["mirth", "delighted", "laugh", "excited"].forEach((m) => {
  const pts = frameAt(m, 0).slice().sort((p, q) => p.x - q.x);
  const ends = (pts[0].y + pts[pts.length - 1].y) / 2, mid = pts[Math.floor(pts.length / 2)].y;
  ok(mid > ends, m + " curves as a SMILE, not a rainbow (a rainbow reads as a frown)");
});
let bang = frameAt("surprised", 0.2), bx = bang.map((p) => p.x);
ok(Math.max(...bx) - Math.min(...bx) < 6, "surprised flashes an exclamation: a vertical stroke, near-zero width");
let qm = frameAt("puzzled", 0.2);
ok(Math.max(...qm.map((p) => p.y)) - Math.min(...qm.map((p) => p.y)) > 100, "puzzled flashes a question mark: tall, with a detached dot");
let sil = new Set();
for (let t = 0; t < 13; t += 1) {
  const f = frameAt("working", t), xs = f.map((p) => p.x), ys = f.map((p) => p.y);
  sil.add(Math.round(Math.max(...xs) - Math.min(...xs)) + "x" + Math.round(Math.max(...ys) - Math.min(...ys)));
}
ok(sil.size >= 5, "working never settles: " + sil.size + " distinct silhouettes across 13s");
ok(/<circle/.test(buildSVG({ avatar: { set: "motes", item: "working" } })), "working renders statically too");
ok(/sepia-sheet/.test(buildSVG({ avatar: { set: "sepia", item: "working" } })), "a pack without art for a mood falls back instead of breaking");
let ringOnly = Object.keys(M.moods).filter((k) => { const p = M.moods[k].paths; return p && p.every((x) => !x.p || x.p === "ring") && !M.moods[k].flash; });
ok(ringOnly.length <= 10, "the swarm is not all circles: " + ringOnly.length + " moods are a plain ring with no flash (was 20)");

console.log(fails ? "\nFAILED (" + fails + ")" : "\nALL PASS");
process.exit(fails ? 1 : 0);
