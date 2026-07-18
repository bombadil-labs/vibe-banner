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
ok(/viewBox="0 0 680 107"/.test(s), "3-row banner is H=107");
ok((s.match(/<text /g) || []).length === 4, "3 readout rows + 1 face = 4 <text>");
ok(/\[user\]/.test(s) && /\[mood\]/.test(s) && /\[goal\]/.test(s), "labels [user]/[mood]/[goal] present");

console.log("optional [note] adds a row");
let n = buildSVG(Object.assign({}, base, { noticing: "peripheral" }));
ok(/viewBox="0 0 680 132"/.test(n), "4-row banner is H=132");
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
let kf1 = buildSVG(Object.assign({}, base, { face: { set: "noto-animated", item: "1f60a" } }));
ok(/fonts\.gstatic\.com\/s\/e\/notoemoji\/latest\/1f60a\/512\.gif/.test(kf1), "KnownFace noto-animated resolves the gstatic URL");
let kf2 = buildSVG(Object.assign({}, base, { face: { set: "kip", item: "puzzled" } }));
ok(/kip-sheet\.png/.test(kf2) && /viewBox="128 0 64 64"/.test(kf2), "KnownFace kip:puzzled → sheet cell 2");
let kf3 = buildSVG(Object.assign({}, base, { face: { set: "sepia", item: "vertigo" } }));
ok(/sepia-sheet\.png/.test(kf3) && /viewBox="64 192 64 64"/.test(kf3), "KnownFace sepia:vertigo → index 25, col 1 row 3");
ok(/viewBox="448 192 64 64"/.test(buildSVG(Object.assign({}, base, { face: { set: "sepia", item: "love" } }))), "sepia:love → the last cell (31)");
ok(/class="txt fk vk"/.test(buildSVG(Object.assign({}, base, { face: { set: "unknown-set", item: "x" } }))), "unknown set → falls back to kaomoji");
ok(buildSVG(Object.assign({}, base, { face: { nope: true } })).indexOf("vk") > 0, "malformed face → falls back to kaomoji, no crash");
let ctr = +/(?:<image class="vk" x=")([0-9.]+)/.exec(fp1)[1];
ok(ctr === 27.5, "image faces centre in the window (x=" + ctr + " → centre 55.5 in the 95px window at x=8)");

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
ok(/rotate\(/.test(buildSVG(Object.assign({}, base, { flag: "excited" }))), "excited adds rotated sparkles");
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

console.log("prev is animation-only: static fallback ignores it, no crash");
ok(buildSVG(Object.assign({}, base, { prev: ["#a06a6a"] })).startsWith("<svg"), "prev ignored in static");

console.log("flag is a single string — the API contract");
const FLOWERS = /🌸|🌼|✿|❀|🌷/;
ok(FLOWERS.test(buildSVG(Object.assign({}, base, { flag: "at_peace" }))), "flag: 'at_peace' blossoms");
let unk = buildSVG(Object.assign({}, base, { flag: "enraptured" }));
ok(unk.startsWith("<svg") && !/class="txt fl"/.test(unk), "unknown flag string → ignored, no trace, no crash");
let pz = buildSVG(Object.assign({}, base, { flag: "puzzled" }));
ok(!/>\?<\/text>/.test(pz), "puzzled hangs NO ?-cloud (v0.33.0: the ? is the avatar's own prop, baked into its sheet)");

console.log("legacy boolean payloads still resolve, one flag wins by priority");
let multi = buildSVG(Object.assign({}, base, { angry: true, at_peace: true, puzzled: true }));
ok(!FLOWERS.test(multi), "angry outranks at_peace: no blossoms");
ok(!/>\?<\/text>/.test(multi), "angry outranks puzzled: no question-cloud");
ok(!FLOWERS.test(buildSVG(Object.assign({}, base, { tender: true, at_peace: true }))), "tender outranks at_peace: no blossoms");
ok(FLOWERS.test(buildSVG(Object.assign({}, base, { at_peace: true }))), "legacy at_peace boolean alone still blossoms");

console.log("flag caption: bottom-left [name] whenever a flag fires");
ok(!/class="txt fl"/.test(buildSVG(base)), "no flag → no caption");
let ft = buildSVG(Object.assign({}, base, { flag: "solemn" }));
ok(/>\[solemn\]<\/text>/.test(ft), "solemn → '[solemn]' bottom-left");
ok(/>\[at peace\]<\/text>/.test(buildSVG(Object.assign({}, base, { flag: "at_peace" }))), "at_peace displays as '[at peace]'");
ok(/>\[angry\]<\/text>/.test(buildSVG(Object.assign({}, base, { angry: true, puzzled: true }))), "legacy multi-flag payload captions the winner");
ok(/viewBox="0 0 680 107"/.test(ft), "flag caption lives in the window — no bottom padding (H=107)");

console.log("new-flag static markers");
ok(/🌸|🌼|✿|❀|🌷/.test(buildSVG(Object.assign({}, base, { at_peace: true }))), "at_peace scatters blossoms");
let sol = buildSVG(Object.assign({}, base, { solemn: true }));
ok(/<rect [^>]*fill="#2a2622"/.test(sol) && /#ffbf72/.test(sol), "solemn dims once and keeps one ember");
ok(/<line /.test(buildSVG(Object.assign({}, base, { resolute: true }))), "resolute draws concentration lines");
ok(!/>\?<\/text>/.test(buildSVG(Object.assign({}, base, { puzzled: true }))), "puzzled (legacy boolean) also hangs no ? — the mark lives in the sheet now");
let rh = buildSVG(Object.assign({}, base, { rhyme: true }));
ok((rh.match(/꒳/g) || []).length === 2, "rhyme echoes the face (kaomoji appears twice)");

console.log("every flag yields a valid static fallback (string API + legacy boolean)");
["surprised", "tender", "melancholy", "anxious", "mirth", "laugh", "groan", "oops", "dramatic", "frustrated", "angry", "excited", "spark",
 "at_peace", "solemn", "rhyme", "awe", "vertigo", "resolute", "puzzled"].forEach(function (fl) {
  var s1 = buildSVG(Object.assign({}, base, { flag: fl }));
  var o = {}; o[fl] = true;
  var s2 = buildSVG(Object.assign({}, base, o));
  ok(s1.startsWith("<svg") && s1.endsWith("</svg>") && noClip(s1) === noClip(s2), fl + " → valid static svg, string ≡ legacy boolean");
});

console.log(fails ? "\nFAILED (" + fails + ")" : "\nALL PASS");
process.exit(fails ? 1 : 0);
