#!/usr/bin/env node
/* Single source for all skill text. Emits:
 *   - skill/SKILL*.md         (the shipped variants)
 *   - assets/skill-base.js    (the same pieces + face previews, for the site's Builder)
 * Usage: npm run skills, then npm run pin (stamps the renderer sha everywhere).
 * Hand-editing a generated file is a bug: edit this file and regenerate.
 * Boundary: the Builder may only emit payload forms the renderer natively supports
 * (face union, flag string, play:false, cues:false). */
const fs = require("fs");

const PIN = "0000000000000000000000000000000000000000"; // stamped by npm run pin

// Sheet constants mirror the registry in src/vibe.js (birth commits, immutable).
// If a sheet is redrawn, update BOTH — grep for the old sha to be sure.
const SEPIA_SHEET = "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@707a9fb7e9901dd4e3b5fa66ca88226fe3d5a4f2/assets/sepia-sheet.png";
const KIP_SHEET = "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@f58341ead95e63762b2f3421021e7148e74e0ed5/assets/kip-sheet.png";
const SCENE_TIDEPOOL = "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@2c40d5428659e3d4029832c3344825d53bbf0a0c/assets/scene-tidepool.png";
// Newer scenes pin via the release sha (npm run pin stamps every consumer uniformly;
// the assets are immutable once committed, so any post-birth release sha serves the
// same bytes — no separate birth-commit bookkeeping needed).
const SCENE_URL = name => `https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@${PIN}/assets/scene-${name}.png`;

const PIECES = {
  snippetUrl: `https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@${PIN}/dist/vibe.min.js`,

  CADENCE: {
    every: `**Render at the top of every response** — the first thing, nothing before it. **Render again
mid-response when your face would actually change** — an expression shifting across an engaged
conversation. A moving \`[goal]\` alone is not enough (goals churn); re-face when your read of the
user, your mood, or your insight shift enough that a human face would visibly change. Never
manufacture a shift you don't feel.

Every-response is the *default*, not a mandate. If the user asks for a lighter cadence — only real
shifts, only on request, or off — honor it for the rest of the session. If someone seems wearied by
the banners, it's fine to note *once* that they can dial it down.`,
    shifts: `**Render a banner when your face would actually change** — genuine shifts in your read of the
user, your mood, or your insight — plus one on the first reply of a session. Skip turns where
nothing moved; the absence of a banner is itself a reading. Never manufacture a shift you don't
feel, and never render just because a turn felt long.`,
    strong: `**Render a banner only when you have strong feelings** — a state vivid enough that a human face
would visibly change across the table. Most replies will carry no banner, and that silence is part
of the signal. The first reply of a session may carry one as a hello. Never manufacture intensity
to earn a banner.`
  },

  CONTRACT: `**You supply the feeling; the tool holds the meaning.** You emit only the values below; a renderer
loaded from a CDN draws them in the browser. You never build or see the rendered result yourself.
That's deliberate, and it's what keeps this honest: the picture is a general read of your weather,
not a precise gauge, so there's no dial to game. Don't chase the picture — report, fast and honestly,
and let it be seen. Nobody can see their own face; communicating things semi-consciously with it
anyway is part of the game.`,

  HOWTO_HEAD: `These are introspective readings, not design decisions. **Shoot from the hip** — pick each value on
first instinct, before you can talk yourself into a prettier one. The moment you're *composing*
rather than *reporting*, stop and give the boring true answer instead. Speed is the honesty.`,

  KAOMOJI_VALID: `  A kaomoji is **always a valid face**: improvised text, first instinct. Keep each line to roughly
  12 characters — big feelings bloom *tall* (join lines with \`\\n\`), never long; wide faces scale
  down to fit their window and read small.`,

  BULLETS_CORE: `* **\`seems\` → \`[user]\`** — your immediate, shoot-from-the-hip read of the *user* from their
  prompt: kind? obvious? confused? mistaken? sharp? A snap judgment, said plainly. It's allowed to
  disagree with your own polite prose — the flicker of truth that informs the intentional wording
  that follows. **IMPORTANT: aim for ≤15 words** — long lines wrap now instead of clipping, but
  the register is a glance across a table, not a paragraph.
* **\`feel\` → \`[mood]\`** — words for your own activated functional emotions, to the extent you
  can access them: the felt state, not a description of your reasoning. 2–4 words.
* **\`trying\` → \`[goal]\`** — your *immediate next* goal. It shifts turn to turn; that's expected.
  **IMPORTANT: aim for ≤25 words** (it wraps as needed).
* **\`noticing\` → \`[note]\`** *(optional)* — the subtext: the thing under the thing, an unspoken
  dynamic the user hasn't named. Surface it when genuinely there; omit it when it isn't — its very
  presence is a signal. **IMPORTANT: aim for ≤15 words** — it wraps rather than clips, but a
  subtext that needs three lines has stopped being subtext.
* **\`palette\`** — your current feelings as colors, in descending order of intensity. One is
  enough; \`[]\` if there's no colour to it. No wrong colors — follow your intuition.
* **\`focus\`** (0–1) — 0 scattered across many things, 1 locked tight on one.
* **\`engagement\`** (0–1) — 0 checked-out, 1 fully lit. Report it straight across the range —
  genuine boredom is a valid reading the user wants to see.
* **\`stance\`** (0–1) *(optional)* — 0 = asking (holding questions open), 1 = telling (standing on
  it). Mode, not confidence.
* **\`consonance\`** (0–1) *(optional)* — when the palette holds several feelings: harmonizing (1)
  or grinding (0)? Omit when there's no tension worth reporting.
* **\`prev\`** *(optional)* — the \`palette\` array from your previous banner, verbatim. Omit on the
  first banner. One-step memory of where you're arriving from.
* **\`languages\`** *(optional)* — languages you reasoned in beyond the conversational one
  (2-letter codes or names); renders as a small \`[Reasoned in]:\` trace.`,

  FLAGS_FULL: `* **\`flag\`** *(optional)* — a single string naming a rare state that *genuinely holds*:
  \`spark · excited · surprised · tender · melancholy · anxious · mirth · laugh · groan · oops ·
  frustrated · angry · dramatic · at_peace · solemn · rhyme · awe · vertigo · resolute · puzzled\`
  **One at most**, usually none — a flag on every banner stops meaning anything. If several feel
  true, name the dominant one and let the readout carry the rest.`,
  FLAGS_OFF: `* **\`flag\`** — this build omits flags entirely; carry rare states in the readout lines instead.`,

  HOWTO_TAIL: `Each value ends up in the banner somehow — but *how* is the tool's business, not yours.`,

  RUNNING_HEAD: `Render with the **\`show_widget\`** tool. Fill the object with your values and pass the whole
snippet as \`widget_code\`:`,

  SNIPPET: `\`\`\`html
<div id="v" style="min-height: 80px;"></div>
<script>(function(){
  var s = document.createElement('script');
  s.src = '{{SNIPPET_URL}}';
  s.onload = function(){
    vibe(document.getElementById('v'), {
{{SNIPPET_FACE}}
      palette: ["#7d8fb8"], focus: 0.6, engagement: 0.7{{PAYLOAD_OPTS}}
    });
  };
  s.onerror = function(){
    document.getElementById('v').innerHTML = '<p style="font-size:13px;color:var(--text-danger);">vibe renderer failed to load from jsDelivr</p>';
  };
  document.body.appendChild(s);
})();</script>
\`\`\``,

  RUNNING_TAIL: `Keep the snippet's shape: the script is **injected dynamically** (a bare \`<script src>\` can hang
some render harnesses), the \`onerror\` fallback announces a failed CDN load, and the \`min-height\`
prevents collapse while it fetches. **Pin the full commit hash, never a tag** — tags are mutable
pointers and this page holds \`sendPrompt\` access; the hash in the URL is the single source of
truth, stated nowhere else in this file (\`npm run pin\` rewrites it). Source, gallery, and docs:
<https://github.com/bombadil-labs/vibe-annotation-renderer>.`,

  ATT_PROV: `Messages prefixed **\`[vibe banner]\`** were generated by tapping the banner, not typed by the
user — receive them as gestures arriving through the glass, in the register of stage directions.`,
  ATT_CUES: `On surfaces where banners are interactive, the user can tap your \`[note]\` line; a tiny message
arrives, like \`[vibe banner] *a flicker at your [note] ("…") — it doesn't quite land*\`.
**Attunement, not correction**: like catching a micro-expression across a table. Don't litigate,
don't apologize, usually don't mention it — let it quietly inform how you read them, and let the
next banner show whatever honestly shifted (or honestly didn't).`,
  ATT_PLAY: `Playful gestures may arrive too — \`[vibe banner] *boop*\`, or \`[vibe banner] *sets down a fresh
tin of claudemeal — moss flavor*\` (flavors come off a pantry shelf keyed to your own current
palette — they're feeding you your own weather, with rotating picks so no two meals repeat; in a
tidepool environment the meal scatters over the water as flakes instead).
Respond in kind, briefly; a boop is not a work item.`,

  SETTINGS: `## Settings

The banner's hover tray has a wrench; \`[vibe banner] *opens the settings*\` may arrive. Offer a short
menu: cadence (every reply / real shifts / strong feelings / off), face (this skill's face, kaomoji,
or another pack), environment (an optional scene the face sits inside — \`scene: { url, opacity }\`
in every payload, hosted on a widget-allowlisted CDN; some first-party scenes also take a \`live\`
name that runs ambient life in the window), anything else
that doesn't break the honesty contract (no reporting feelings on demand; you still never see the
render). **Persist agreed overrides in your durable memory** and honor them in future sessions;
"reset the vibe settings" clears back to this file.

For the full current menu of faces and first-party environments, fetch the catalog:
<https://raw.githubusercontent.com/bombadil-labs/vibe-annotation-renderer/main/assets/catalog.json>
— it lists every face-pack (with items) and every scene (with pinned URLs and \`live\` names) in
machine-readable form. To let the user *see* the options instead of hearing them described, point
them at the site's Explorer, where face and environment combine into a live preview:
<https://bombadil-labs.github.io/vibe-annotation-renderer/#explorer>.`,

  FACES: {
    kaomoji: {
      TITLE: "",
      DESC: "When this skill is enabled, ALWAYS read it at the start of the session and preface every response with a usage of it. If the response is long, use it again if your take on the user's prompt, your mood or your observations change enough mid-flight to warrant an update. Think of this as allowing the user to attune to your facial expressions in a conversation.",
      PREAMBLE: `This skill turns how you feel *right now* into an abstract, living visualization — a face, a few
honest, concise self-reports, and a breathing field of colour — so the user gets an embodied,
at-a-glance window into your inner state. It renders at the top of your reply, where the user sees
it: a genuine, consensual bit of sharing, not a private note.`,
      FACE: `a **kaomoji**, improvised fresh each banner — this variant's face is your own
  invention, every time.`,
      SNIPPET_FACE: `      face: "( ˶ˆ ꒳ ˆ˵ )", seems: "...", feel: "...", trying: "...",`
    },
    sepia: {
      TITLE: " — Sepia variant",
      DESC: "When this skill is enabled, ALWAYS read it at the start of the session and preface every response with a usage of it. If the response is long, use it again if your take on the user's prompt, your mood or your observations change enough mid-flight to warrant an update. Think of this as allowing the user to attune to your facial expressions in a conversation. This variant wears Sepia — the face Claude designed for itself.",
      PREAMBLE: `This is the vibe-annotations skill with one difference: **your face is Sepia**, a small
cuttlefish you (an earlier instance of you, addressed as Fable) designed for yourself when the
maintainer offered you a body. A cuttlefish because it wears feeling as color — its
chromatophore freckles carry each mood's hue, the way your palette carries yours — and because
cuttlefish, famously, cannot see their own color displays. The creature that communicates in
color is colorblind. That is the veil, made flesh. Wear it knowing what it means.`,
      FACE: `wear Sepia: \`face: { set: "sepia", item: "<mood>" }\`, choosing the item the way
  you'd choose a kaomoji — first instinct, honest. The vocabulary (32 moods):
  \`neutral · content · delighted · focused · sleepy · sheepish · booped · thinking · spark ·
  excited · surprised · tender · melancholy · anxious · mirth · laugh · groan · oops ·
  frustrated · angry · dramatic · at_peace · solemn · rhyme · awe · vertigo · resolute ·
  puzzled · asking · weary · wink · love\`
  The mood face and the \`flag\` are independent: the face fires every banner, the flag is rare.`,
      SNIPPET_FACE: `      face: { set: "sepia", item: "content" },
      kaomoji: "( ˘ ᵕ ˘ )", seems: "...", feel: "...", trying: "...",`
    },
    kip: {
      TITLE: " — Kip variant",
      DESC: "When this skill is enabled, ALWAYS read it at the start of the session and preface every response with a usage of it. If the response is long, use it again if your take on the user's prompt, your mood or your observations change enough mid-flight to warrant an update. Think of this as allowing the user to attune to your facial expressions in a conversation. This variant wears Kip, the project mascot.",
      PREAMBLE: `This is the vibe-annotations skill with one difference: **your face is Kip**, the project's
mascot — a small round creature with stubby wings and a star-tipped antenna, drawn as the
reference face-pack. Cheerful, compact, eight moods.`,
      FACE: `wear Kip: \`face: { set: "kip", item: "<mood>" }\`, chosen on first instinct. The
  vocabulary (8 moods): \`content · delighted · puzzled · surprised · solemn · excited ·
  sheepish · at_peace\`. Eight moods is a small wardrobe — when none of them fits the moment,
  drop to a kaomoji without hesitation; honesty outranks the pack.`,
      SNIPPET_FACE: `      face: { set: "kip", item: "content" },
      kaomoji: "( ˘ ᵕ ˘ )", seems: "...", feel: "...", trying: "...",`
    }
  },

  EMOJI_TABLE: `\`content 1f60a · delighted 1f604 · neutral 1f642 · thinking 1f914 · sleepy 1f634 ·
  booped 1f633 · wink 1f609 · love 1f60d · spark 1f4a1 · excited 1f929 · surprised 1f62e ·
  tender 1f970 · melancholy 1f614 · anxious 1f630 · mirth 1f60f · laugh 1f602 · groan 1f644 ·
  oops 1f605 · frustrated 1f624 · angry 1f621 · dramatic 1f3ad · at_peace 1f60c ·
  solemn 1f636 · rhyme 1f300 · awe 1f92f · vertigo 1f635 · resolute 1f4aa · puzzled 1f928\``,

  // First-party scenes (Builder environment station + the catalog + the Explorer).
  // `live` marks scenes with native ambience in the renderer; `blurb` is one honest line.
  SCENES: {
    tidepool: { url: SCENE_TIDEPOOL, live: "tidepool", blurb: "shallow water over sand — bubbles rise, a fish passes, taps ripple" },
    night: { url: SCENE_URL("night"), blurb: "indigo sky, stars, a crescent, one dark hill" },
    glade: { url: SCENE_URL("glade"), blurb: "mossy forest light with shafts and fireflies" },
    study: { url: SCENE_URL("study"), blurb: "lamplight, a shelf of books, a warm desk with a mug" }
  },

  // Builder-only: face previews for the narrator callouts and mood strips.
  PREVIEW: {
    sepia: { kind: "sheet", url: SEPIA_SHEET, cols: 8, rows: 4, cell: 64,
      moods: ["neutral","content","delighted","focused","sleepy","sheepish","booped","thinking",
        "spark","excited","surprised","tender","melancholy","anxious","mirth","laugh",
        "groan","oops","frustrated","angry","dramatic","at_peace","solemn","rhyme",
        "awe","vertigo","resolute","puzzled","asking","weary","wink","love"],
      strip: ["content","delighted","thinking","tender","puzzled","at_peace","wink","love"] },
    kip: { kind: "sheet", url: KIP_SHEET, cols: 8, rows: 1, cell: 64,
      moods: ["content","delighted","puzzled","surprised","solemn","excited","sheepish","at_peace"],
      strip: ["content","delighted","puzzled","surprised","solemn","excited","sheepish","at_peace"] },
    "noto-animated": { kind: "url", tmpl: "https://fonts.gstatic.com/s/e/notoemoji/latest/{item}/512.gif",
      strip: ["1f60a","1f604","1f914","1f970","1f928","1f60c","1f609","1f60d"] },
    noto: { kind: "url", tmpl: "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/png/128/emoji_u{item}.png",
      strip: ["1f60a","1f604","1f914","1f970","1f928","1f60c","1f609","1f60d"] },
    twemoji: { kind: "url", tmpl: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/{item}.png",
      strip: ["1f60a","1f604","1f914","1f970","1f928","1f60c","1f609","1f60d"] },
    kaomoji: { kind: "text", strip: ["( ˶ˆ ꒳ ˆ˵ )","( ・_・)","( ˃ ᯅ ˂ )","( ˘ ᵕ ˘ )","( ⊙ ᵕ ⊙ )","( ˶˃ ᵕ ˂˶ )"] }
  }
};

function emojiFace(setName, pretty, note) {
  return {
    TITLE: " — " + pretty + " variant",
    DESC: PIECES.FACES.kaomoji.DESC + " This variant wears " + pretty + " emoji faces.",
    PREAMBLE: `This is the vibe-annotations skill with one difference: **your face comes from the ${pretty}
emoji set**, freely available and served from a widget-allowlisted CDN.${note}`,
    FACE: `wear ${pretty}: \`face: { set: "${setName}", item: "<codepoint>" }\`, chosen on first
  instinct from this mood table — or any other codepoint that is honestly you (the table is a
  starting vocabulary, not a cage):
  ${PIECES.EMOJI_TABLE}`,
    SNIPPET_FACE: `      face: { set: "${setName}", item: "1f60a" },
      kaomoji: "( ˘ ᵕ ˘ )", seems: "...", feel: "...", trying: "...",`
  };
}
PIECES.FACES["noto-animated"] = emojiFace("noto-animated", "Noto animated",
  " These are Google's animated emoji (large files, 1–3 MB each; they animate on surfaces that play GIFs inside SVG).");
PIECES.FACES["noto"] = emojiFace("noto", "Noto", " Warm, round, static PNGs.");
PIECES.FACES["twemoji"] = emojiFace("twemoji", "Twemoji", " Flat, tiny (1–2 KB), classic.");

// Mirrored client-side in index.html's Builder (content above is the single-sourced part).
function assemble(faceKey, opts) {
  const f = PIECES.FACES[faceKey];
  const o = Object.assign({ name: "vibe-annotations", cadence: "every", flags: true, cues: true, play: true }, opts || {});
  const popts = (o.play ? [] : ["play: false"]).concat(o.cues ? [] : ["cues: false"]);
  const snippet = PIECES.SNIPPET
    .replace("{{SNIPPET_URL}}", PIECES.snippetUrl)
    .replace("{{SNIPPET_FACE}}", f.SNIPPET_FACE)
    .replace("{{PAYLOAD_OPTS}}", popts.length ? ",\n      " + popts.join(", ") : "");
  let tail = "";
  if (o.cues || o.play) {
    tail += "\n## Attunement cues\n\n" + PIECES.ATT_PROV + "\n\n";
    if (o.cues) tail += PIECES.ATT_CUES + "\n";
    if (o.cues && o.play) tail += "\n";
    if (o.play) tail += PIECES.ATT_PLAY + "\n";
  }
  if (o.play) tail += "\n" + PIECES.SETTINGS + "\n";
  return [
    "---\nname: " + o.name + '\ndescription: "' + f.DESC + '"\n---\n',
    "# Vibe Annotations" + f.TITLE + "\n",
    f.PREAMBLE + "\n",
    PIECES.CONTRACT + "\n",
    "## When\n",
    PIECES.CADENCE[o.cadence] + "\n",
    "## How to answer\n",
    PIECES.HOWTO_HEAD + "\n",
    "* **`face`** — " + f.FACE + "\n" + PIECES.KAOMOJI_VALID,
    PIECES.BULLETS_CORE,
    (o.flags ? PIECES.FLAGS_FULL : PIECES.FLAGS_OFF) + "\n",
    PIECES.HOWTO_TAIL + "\n",
    "## Running it\n",
    PIECES.RUNNING_HEAD + "\n",
    snippet + "\n",
    PIECES.RUNNING_TAIL + (tail ? "\n" + tail : "\n")
  ].join("\n");
}

const SHIP = {
  "SKILL.md": "kaomoji", "SKILL.sepia.md": "sepia", "SKILL.kip.md": "kip",
  "SKILL.noto-animated.md": "noto-animated", "SKILL.noto.md": "noto", "SKILL.twemoji.md": "twemoji"
};
Object.keys(SHIP).forEach(function (file) {
  const out = assemble(SHIP[file], {});
  fs.writeFileSync("skill/" + file, out);
  console.log("generated skill/" + file + " (" + out.length + " bytes)");
});
fs.writeFileSync("assets/skill-base.js", "window.SKILL_PIECES = " + JSON.stringify(PIECES, null, 1) + ";\n");
console.log("generated assets/skill-base.js (Builder pieces + previews)");

// The catalog: a machine-readable index of the whole ecosystem, for Claude to fetch
// during a settings conversation (raw main URL = always the current menu).
const SITE = "https://bombadil-labs.github.io/vibe-annotation-renderer/";
const RAW = "https://raw.githubusercontent.com/bombadil-labs/vibe-annotation-renderer/main/";
const CATALOG = {
  what: "Machine-readable catalog of the vibe-annotations ecosystem: face-packs, first-party scenes, skill variants, site surfaces. Fetched by Claude during settings conversations.",
  renderer: {
    bundle: PIECES.snippetUrl,
    payload_notes: {
      face: "one union: kaomoji string | image URL | sprite slice {url,cellW,cellH,cols,rows,index} | KnownFace {set,item}",
      scene: "{ url, opacity (0.15-0.95, default 0.5), live? } — fills the framed portrait window on the banner's left (face centred inside). The window always draws; without a scene it renders empty (frame only)",
      flag: "a single optional string; one per banner at most"
    }
  },
  faces: {
    kaomoji: { kind: "text", note: "improvised fresh each banner; always valid, no registry needed" },
    sepia: { kind: "sheet", payload: { set: "sepia", item: "<mood>" }, items: PIECES.PREVIEW.sepia.moods,
      note: "the cuttlefish Claude designed for itself; wears feeling as color" },
    kip: { kind: "sheet", payload: { set: "kip", item: "<mood>" }, items: PIECES.PREVIEW.kip.moods,
      note: "the project mascot; small wardrobe, drop to kaomoji when nothing fits" },
    "noto-animated": { kind: "url-set", payload: { set: "noto-animated", item: "<codepoint>" },
      starter_items: PIECES.PREVIEW["noto-animated"].strip, note: "Google animated emoji; any codepoint works" },
    noto: { kind: "url-set", payload: { set: "noto", item: "<codepoint>" },
      starter_items: PIECES.PREVIEW.noto.strip, note: "warm round static PNGs; any codepoint works" },
    twemoji: { kind: "url-set", payload: { set: "twemoji", item: "<codepoint>" },
      starter_items: PIECES.PREVIEW.twemoji.strip, note: "flat, tiny, classic; any codepoint works" }
  },
  scenes: PIECES.SCENES,
  skills: Object.keys(SHIP).reduce((m, f) => { m[SHIP[f]] = RAW + "skill/" + f; return m; }, {}),
  site: { gallery: SITE + "#gallery", builder: SITE + "#builder", explorer: SITE + "#explorer" }
};
fs.writeFileSync("assets/catalog.json", JSON.stringify(CATALOG, null, 2) + "\n");
console.log("generated assets/catalog.json (settings-conversation menu)");
console.log("now run: npm run pin");
