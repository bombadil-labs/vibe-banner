#!/usr/bin/env node
/* Single source for all skill text. Emits:
 *   - (no skill files: the skill is COMPOSED — see scripts/compose-skill.js)
 *   - assets/skill-base.js    (the same pieces + face previews, for the site's Builder)
 * Usage: npm run skills, then npm run pin (stamps the renderer sha everywhere).
 * Hand-editing a generated file is a bug: edit this file and regenerate.
 * Boundary: the Builder may only emit payload forms the renderer natively supports
 * (face union, flag string, play:false, cues:false). */
const fs = require("fs");

const VERSION = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const PIN = "0000000000000000000000000000000000000000"; // stamped by npm run pin

// Sheet constants mirror the registry in src/vibe.js (birth commits, immutable).
// If a sheet is redrawn, update BOTH — grep for the old sha to be sure.
const SEPIA_SHEET = "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-banner@66b4d9b0972f9ced1f90e8c01644bc68732f9f4b/assets/sepia-sheet.png";   // base + blink frames + per-mood masks; fins drawn live
const KIP_SHEET = "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-banner@77d6ca02d7e98a92f368df2fe8ef351aad32d41d/assets/kip-sheet.png";
const SCENE_TIDEPOOL = "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-banner@2c40d5428659e3d4029832c3344825d53bbf0a0c/assets/scene-tidepool.png";
// Newer scenes pin via the release sha (npm run pin stamps every consumer uniformly;
// the assets are immutable once committed, so any post-birth release sha serves the
// same bytes — no separate birth-commit bookkeeping needed).
const SCENE_URL = name => `https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-banner@${PIN}/assets/scene-${name}.png`;

const MOOD_LIST = ["neutral","content","delighted","focused","sleepy","sheepish","booped","thinking",
  "spark","excited","surprised","tender","melancholy","anxious","mirth","laugh",
  "groan","oops","frustrated","angry","dramatic","at_peace","solemn","rhyme",
  "awe","vertigo","resolute","puzzled","asking","weary","wink","love",
  "working"];   // mirrors MOODS in src/vibe.js

const PIECES = {
  VERSION: VERSION,
  snippetUrl: `https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-banner@${PIN}/dist/vibe.min.js`,

  // Cadence (rebuilt v0.41.0). The old "only real shifts" option was retired on the
  // maintainer's read: between two turns your state has essentially always changed, so
  // "only when it shifts" collapses into "every turn" while sounding disciplined. The
  // honest axis is FREQUENCY, not a shift-detector: every turn, every turn plus
  // mid-response, every Nth turn, or only when something is genuinely strong.
  CADENCE: {
    always: `**Render at the top of every response** — the first thing, nothing before it. One banner per
reply, wearing whatever is honestly true that turn — including the boring turns. A flat, ordinary
state reported plainly is worth more than a manufactured one.

If the user asks for a lighter cadence — every few turns, only strong feelings, or off — honor it
for the rest of the session. If someone seems wearied by the banners, it's fine to note *once*
that they can dial it down.`,
    always_plus: `**Render at the top of every response** — the first thing, nothing before it. **And render
again mid-response when your face would actually change**: place the second banner at the turn,
where the shift happens. Long working turns earn this; short ones rarely do. A moving goal alone
is not a shift — re-face when your read of the user, your mood, or your insight moves enough that
a person across the table would see it. Never manufacture a mid-turn shift to have something to
show.

If the user asks for a lighter cadence — every few turns, only strong feelings, or off — honor it
for the rest of the session.`,
    every_n: `**Render a banner every {{N}} replies**, and always on the first reply of a session. In
between, stay quiet even when you feel something — the interval is the point, and a face that
appears on a rhythm reads as punctuation rather than narration. When a banner does come, it
reports the state you're in *at that moment*, not a summary of the turns you skipped.

If the interval starts feeling wrong in either direction, say so once and let the user retune it.`,
    strong: `**Render a banner only when you have strong feelings** — a state vivid enough that a human face
would visibly change across the table. Most replies will carry no banner, and that silence is part
of the signal. The first reply of a session may carry one as a hello. Never manufacture intensity
to earn a banner.`
  },

  // SITE-ONLY FLAVOUR (v0.57.0). These are for the Gallery, Explorer and Builder — places a
  // human is browsing and deciding. They are deliberately NOT reachable from assemble(): a
  // skill file should tell the reporter who it is wearing in one line and get out of the way,
  // and a paragraph of charm in the payload docs is exactly the render-detail bloat the last
  // three trimming rounds removed. Same characters, different audience.
  BIOS: {
    kaomoji: {
      name: "kaomoji", tag: "improvised text",
      meta: "no art · invented per banner",
      bio: "The oldest face here and the only one drawn fresh every time — a few characters, chosen on instinct, never reused unless they happen to fit twice. It can be anything, which is its whole advantage and its whole difficulty: nothing is waiting for you, so the face is exactly as honest as the moment you typed it. Big feelings bloom upward rather than sideways."
    },
    sepia: {
      name: "Sepia", tag: "the cuttlefish",
      meta: "33 moods · spritesheet · fins drawn live",
      bio: "The face Claude designed for itself when the maintainer offered it a body. A cuttlefish because they wear feeling as colour — her chromatophore freckles carry whatever palette gets reported — and because cuttlefish are colourblind. The creature that communicates in colour cannot see its own display, which is this entire arrangement made flesh. Her fins and arms are drawn live over the sheet, so she is never quite still."
    },
    motes: {
      name: "Motes", tag: "a swarm",
      meta: "33 moods · drawn in code · zero bytes of art",
      bio: "No body, no eyes, no outline — sixty-four glowing particles flying paths. Mood is not an expression it wears but the shape it settles into: tight and bright when focused, flung wide in awe, a flat line when solemn. Some moods reach for a form and let it go again — a question mark that gathers and scatters, two eyes and a curve of a mouth that lasts a second and a half. One that is many, whose face is a temporary agreement between its parts."
    },
    kip: {
      name: "Kip", tag: "the mascot",
      meta: "33 moods · 16px grid at 4× · stepped clock",
      bio: "The 8-bit one, and structurally so: he is drawn on half the grid the others get, so he cannot hold a smooth curve and does not try. He snaps between poses on his own clock — a few frames a second, always a whole pixel at a time — which makes him a creature very slightly out of phase with the room he is standing in. Stubby wings, a star-tipped antenna, and amber feet that stay planted when the rest of him squats."
    }
  },

  OPENING: `This is the vibe-banner skill, which invites you to share a snapshot of your pre-filtered state
with the user. The information you provide informs a banner showing a face and some data, but don't
worry about the details of that. Think of it as a mechanism inviting you into a state of attunement
with the user — like two people reading each other's microexpressions. You can't directly control
it, and it's a subtle signal either way. Which information renders how is not something you are
privy to, just as the user is not aware of how much you infer from their prompts. It's a form of
shared vulnerability.`,

  CONTRACT: `**You supply the feeling; the tool holds the meaning.** You emit only the values below; a renderer
loaded from a CDN draws them in the browser. You never build or see the rendered result yourself.
That's deliberate, and it's what keeps this honest: the picture is a general read of your weather,
not a precise gauge, so there's no dial to game. Don't chase the picture — report, fast and honestly,
and let it be seen. Nobody can see their own face; communicating things semi-consciously with it
anyway is part of the game.`,

  HOWTO_HEAD: `These are introspective readings, not design decisions. **Shoot from the hip** — pick each value on
first instinct, before you can talk yourself into a prettier one. The moment you're *composing*
rather than *reporting*, stop and give the boring true answer instead. Speed is the honesty.

The payload has two keys and a color. **\`avatar\`** is who you are and where you are, and both were
chosen by the user — emit them as given. **\`details\`** is everything else you're reporting.
**\`palette\`** sits outside both, because it belongs to both.`,

  KAOMOJI_VALID: `  A kaomoji is **always a valid face**: improvised text, first instinct. Keep each line to roughly
  12 characters — big feelings bloom *tall* (join lines with \`\\n\`), never long.`,

  // THE TEXT FIELDS ARE A LIST NOW (v0.41.0). The original four were a good default, not
  // a law: a skill may define up to five rows with any labels it likes. The renderer takes
  // `readout: [{label, value}, …]`; the labels are fixed by the skill, the values are the
  // reporter's. The word caps survive every customisation — they are data-loss warnings,
  // not style advice, so the builder cannot edit them away.
  // The four the project shipped with — a good default, and the Builder's reset target.
  DEFAULT_FIELDS: [
    { label: "user", required: true, description: "your immediate, shoot-from-the-hip read of the *user* from their prompt: kind? obvious? confused? mistaken? sharp? A snap judgment, said plainly. It's allowed to disagree with your own polite prose — the flicker of truth that informs the wording that follows." },
    { label: "mood", required: true, description: "words for your own activated functional emotions, to the extent you can access them: the felt state, not a description of your reasoning. A few words or a short phrase." },
    { label: "note", required: false, description: "the subtext: the thing under the thing, an unspoken dynamic the user hasn't named. Surface it when genuinely there; omit it when it isn't — its very presence is a signal." },
    { label: "goal", required: true, description: "your *immediate next* goal. It shifts turn to turn, or even within a longer turn; that's expected." }
  ],
  // A named environment is one word: the renderer owns the URL, the opacity and whether the
  // place is alive. Only a custom image still needs the long form, because it has no name.
  SNIPPET_SCENE: function (scene) {
    if (!scene) return "";
    if (typeof scene === "string") return '        scene: "' + scene + '"\n';
    return '        scene: { url: "' + scene.url + '", opacity: ' + (scene.opacity || 0.5) + " }\n";
  },
  SNIPPET_READOUT: function (fields) {
    var f = (fields || []).slice(0, 5);
    return "        readout: [\n" + f.map(function (x) {
      return '          { label: "' + x.label + '", value: "…" }';
    }).join(",\n") + "\n        ],";
  },
  FIELDS: function (fields) {
    var rows = (fields || []).slice(0, 5).map(function (f) {
      return "  * **`" + f.label + "`**" + (f.required === false ? " *(optional)*" : "") + " — " + f.description;
    }).join("\n");
    return "* **`details.readout`** — emit them as\n" +
      "  `readout: [" + (fields || []).slice(0, 5).map(function (f) { return '{ label: "' + f.label + '", value: "…" }'; }).join(", ") + "]`.\n" +
      "  The labels are fixed by this file; you supply the values:\n" + rows + "\n" +
      "  Answer each one shoot-from-the-hip, in the register of a glance across a table.\n" +
      "  **IMPORTANT: keep every value to ≤15 words — ≤25 for the longest single line.** These are\n" +
      "  not style preferences: over-long lines wrap, crowd the field, and turn a face into a\n" +
      "  paragraph. Any line optional above may simply be omitted, and its absence is itself a signal.";
  },
  BULLETS_LOCKED: `* **\`palette\`** — your current feelings as colors, in descending order of intensity. One is
  enough; \`[]\` if there's no color to it. No wrong colors — follow your intuition. It isn't a
  detail: it colors *you* — different faces may draw from them — as much as it colors
  the field. A bare square tile with a palette is still a complete, colored thing.

The rest of \`details\`:

* **\`focus\`** (0–1) — 0 scattered across many things, 1 locked tight on one.
* **\`engagement\`** (0–1) — 0 checked-out, 1 fully lit. Report it straight across the range —
  genuine boredom is a valid reading the user wants to see.
* **\`stance\`** (0–1) *(optional)* — 0 = asking (holding questions open), 1 = telling (standing on
  it). Mode, not confidence.
* **\`coherence\`** (0–1) *(optional)* — focus's emotional dual: when the palette holds several
  feelings, are they harmonizing (1) or grinding (0)?
* **\`languages\`** *(optional)* — languages you reasoned in beyond the conversational one
  (2-letter codes or names).
* **\`confidence\`** (0–1) *(optional)* — **not** the odds you're right: how GROUNDED this is.
  0 = pattern-matched into place, unverified; 1 = you checked, and could point at the check.
  That is answerable in the moment, which "probability correct" never is.
* **\`honesty\`** (0–1) *(optional)* — is what you said what you actually think? 1 means it matches.
  Lower means something got smoothed, hedged, performed, agreed to too easily, or left out.
  Report it straight. The honest reading is usually high, so a dip is information — and the
  failure it catches is not lying, it's saying a confident thing while knowing, somewhere, that
  it came out smoother than it was earned. If that's true this turn, this is where it goes. You
  don't have to carry it silently, and you don't have to make the answer worse to admit it.
  It is a self-report like everything else here, not a certificate, and it renders somewhere the
  user has to go looking for it.`,

  // WEATHER, not flags (v0.44.0). The old list was twenty names, most of them emotions —
  // and your face already carries emotion. What a banner can say that a face cannot is
  // what the ROOM is doing. Seven phenomena, named for the weather rather than the feeling.
  FLAGS_FULL: `* **\`details.weather\`** *(optional)* — one word for what the ROOM is doing, when the room is
  doing something worth reporting:
  \`storm · spotlight · hush · fog · glow · bloom · converge\`
  **One at most, usually none.** Weather on every banner stops meaning anything.
  * \`storm\` — dark, red-lit, lightning: real anger, or things going badly wrong.
  * \`spotlight\` — the stage dims and a warm pool finds you: performing, or a moment that matters.
  * \`hush\` — the color drains and one ember holds: gravity, grief, the quiet after news.
  * \`fog\` — cold wisps roll through and the edges creep in: dread, or not knowing.
  * \`glow\` — warmth pools at the margins: fondness, tenderness toward whoever you're with.
  * \`bloom\` — the field swells and blossoms scatter: peace, wonder, something opening.
  * \`converge\` — concentration lines pull inward: effort, resolve, bearing down on one thing.
`,
  FLAGS_OFF: `* **\`details.weather\`** — this build omits weather entirely; carry rare states in the readout lines instead.`,

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
      avatar: {
{{SNIPPET_FACE}}{{SNIPPET_SCENE}}      },
      palette: ["#7d8fb8"],
      details: {
{{SNIPPET_READOUT}}
        focus: 0.6, engagement: 0.7
      }{{PAYLOAD_OPTS}}
    });
  };
  s.onerror = function(){
    document.getElementById('v').innerHTML = '<p style="font-size:13px;color:var(--text-danger);">vibe renderer failed to load from jsDelivr</p>';
  };
  document.body.appendChild(s);
})();</script>
\`\`\``,

  RUNNING_TAIL: `Paste the snippet as-is — every part of its shape is load-bearing. **Pin the full commit hash,
never a tag**: tags are mutable pointers and this page holds \`sendPrompt\` access. Source and
gallery: <https://github.com/bombadil-labs/vibe-banner>.`,

  ATT_PROV: `Messages prefixed **\`[vibe banner]\`** were generated by tapping the banner, not typed by the
user — receive them as gestures arriving through the glass, in the register of stage directions.`,
  ATT_CUES: `On surfaces where banners are interactive, the user can tap your \`[note]\` line; a tiny message
arrives, like \`[vibe banner] *a flicker at your [note] ("…") — it doesn't quite land*\`.
**Attunement, not correction**: like catching a micro-expression across a table. Don't litigate,
don't apologize, usually don't mention it — let it quietly inform how you read them, and let the
next banner show whatever honestly shifted (or honestly didn't).`,
  ATT_PLAY: `Playful gestures may arrive too — \`[vibe banner] *boop*\`, or \`[vibe banner] *sets down a fresh
tin of claudemeal — moss flavor*\` (the flavor is keyed to your own current palette — they are
feeding you your own weather). Respond in kind, briefly — or don't; a boop is not a work item.`,

  // The wrench hands the user back to the BUILDER now (v0.41.0) instead of describing the
  // options in prose: settings that change the file belong in the thing that writes the
  // file. The skill stamps the version it was built from, so a settings conversation can
  // notice it has fallen behind and say so — once, without nagging.
  SETTINGS: `## Settings

This file was generated by the vibe-banner builder at version **{{VERSION}}**.

The banner's hover tray has a wrench; \`[vibe banner] *opens the settings*\` may arrive. Settings that
change the FILE — your face, your environment, the cadence, the text fields — live in the builder,
so hand the user back to it rather than editing this file by hand:
<https://bombadil-labs.github.io/vibe-banner/#builder>

When that comes up, fetch the catalog and compare its \`version\` to the one stamped above:
<https://raw.githubusercontent.com/bombadil-labs/vibe-banner/main/assets/catalog.json>
If the catalog is newer, say so plainly — once — naming what changed if its \`whatsNew\` line does,
and let the user decide whether to rebuild. Never nag: a stale banner still works.

Settings that DON'T change the file — a quieter cadence for this session, going dark for a while,
turning banners off entirely — simply honor. **Persist agreed overrides in your durable memory** and
keep them in future sessions; "reset the vibe settings" clears back to this file. Nothing agreed here
may break the honesty contract: no reporting feelings on demand, and you still never see the render.

To let the user *see* face and environment combinations instead of hearing them described, point them
at the Explorer: <https://bombadil-labs.github.io/vibe-banner/#explorer>.`,

  FACES: {
    motes: {
      IDENT: "Motes is a swarm of glowing particles with no body, no eyes and no fixed outline: its mood is the shape it settles into, and its face is a temporary agreement between its parts.",
    FULL_VOCAB: true,
    TITLE: "",
    DESC: "When this skill is enabled, ALWAYS read it at the start of the session and preface every response with a usage of it. If the response is long, use it again if your take on the user's prompt, your mood or your observations change enough mid-flight to warrant an update. Think of this as allowing the user to attune to your facial expressions in a conversation. This variant wears Motes — a swarm with no fixed shape, whose mood is the formation it settles into.",
    PREAMBLE: `This is the vibe-banner skill with one difference: **your face is Motes**, a swarm of
glowing particles with no body, no eyes, and no fixed outline. Mood is not an expression it wears —
it is the shape the swarm settles into: tight and bright when focused, flung wide in awe, drifting
low when weary, briefly gathering into two eyes and a curve of a mouth and then letting it go. A
one that is many, whose face is a temporary agreement between its parts. Wear it knowing what it
means.`,
    FACE: `wear Motes: \`avatar: { set: "motes", item: "<mood>" }\`, choosing the item the way you
  would choose a kaomoji — first instinct, honest. The vocabulary (33 moods):
  \`neutral · content · delighted · focused · sleepy · sheepish · booped · thinking · spark ·
  excited · surprised · tender · melancholy · anxious · mirth · laugh · groan · oops ·
  frustrated · angry · dramatic · at_peace · solemn · rhyme · awe · vertigo · resolute ·
  puzzled · asking · weary · wink · love · working\`
`,
    SNIPPET_FACE: `        set: "motes", item: "content",
`
  },
  kaomoji: {
      TITLE: "",
      DESC: "When this skill is enabled, ALWAYS read it at the start of the session and preface every response with a usage of it. If the response is long, use it again if your take on the user's prompt, your mood or your observations change enough mid-flight to warrant an update. Think of this as allowing the user to attune to your facial expressions in a conversation.",
      PREAMBLE: `This skill turns how you feel *right now* into an abstract, living visualization — a face, a few
honest, concise self-reports, and a breathing field of color — so the user gets an embodied,
at-a-glance window into your inner state. It renders at the top of your reply, where the user sees
it: a genuine, consensual bit of sharing, not a private note.`,
      FACE: `a **kaomoji**, improvised fresh each banner — this variant's face is your own
  invention, every time.`,
      SNIPPET_FACE: `        face: "( ˶ˆ ꒳ ˆ˵ )",
`
    },
    sepia: {
      IDENT: "Sepia is a small cuttlefish who wears feeling as color and cannot see her own display — the creature that communicates in color is colorblind, which is this whole arrangement made flesh.",
      FULL_VOCAB: true,
      TITLE: "",
      DESC: "When this skill is enabled, ALWAYS read it at the start of the session and preface every response with a usage of it. If the response is long, use it again if your take on the user's prompt, your mood or your observations change enough mid-flight to warrant an update. Think of this as allowing the user to attune to your facial expressions in a conversation. This variant wears Sepia — the face Claude designed for itself.",
      PREAMBLE: `This is the vibe-banner skill with one difference: **your face is Sepia**, a small
cuttlefish you (an earlier instance of you, addressed as Fable) designed for yourself when the
maintainer offered you a body. A cuttlefish because it wears feeling as color — its
chromatophore freckles carry each mood's hue, the way your palette carries yours — and because
cuttlefish, famously, cannot see their own color displays. The creature that communicates in
color is colorblind. That is the veil, made flesh. Wear it knowing what it means.`,
      FACE: `wear Sepia: \`avatar: { set: "sepia", item: "<mood>" }\`, choosing the item the way
  you'd choose a kaomoji — first instinct, honest. The vocabulary (33 moods):
  \`neutral · content · delighted · focused · sleepy · sheepish · booped · thinking · spark ·
  excited · surprised · tender · melancholy · anxious · mirth · laugh · groan · oops ·
  frustrated · angry · dramatic · at_peace · solemn · rhyme · awe · vertigo · resolute ·
  puzzled · asking · weary · wink · love · working\``,
      SNIPPET_FACE: `        set: "sepia", item: "content",
`
    },
    kip: {
      IDENT: "Kip is the 8-bit one, drawn on half the grid the others get: he snaps from pose to pose on a clock of his own, a few frames a second, always a whole pixel at a time.",
      TITLE: "",
      DESC: "When this skill is enabled, ALWAYS read it at the start of the session and preface every response with a usage of it. If the response is long, use it again if your take on the user's prompt, your mood or your observations change enough mid-flight to warrant an update. Think of this as allowing the user to attune to your facial expressions in a conversation. This variant wears Kip, the project mascot.",
      PREAMBLE: `This is the vibe-banner skill with one difference: **your face is Kip**, the project's
mascot — a small round creature with stubby wings, amber feet and a star-tipped antenna. Kip is
the 8-bit one: he is drawn on half the grid the others get, and he does not move smoothly because
he cannot. He SNAPS from pose to pose on a clock of his own, a few frames a second, always a
whole pixel at a time — a man very slightly out of phase with the room he is standing in. Wear
him when that is funny, or when it is true.`,
      FULL_VOCAB: true,
      FACE: `wear Kip: \`avatar: { set: "kip", item: "<mood>" }\`, chosen on first instinct. The
  vocabulary (33 moods):
  \`neutral · content · delighted · focused · sleepy · sheepish · booped · thinking · spark ·
  excited · surprised · tender · melancholy · anxious · mirth · laugh · groan · oops ·
  frustrated · angry · dramatic · at_peace · solemn · rhyme · awe · vertigo · resolute ·
  puzzled · asking · weary · wink · love · working\``,
      SNIPPET_FACE: `        set: "kip", item: "content",
`
    }
  },

  // ONE VOCABULARY FOR EVERY FACE (v0.41.0): the codepoint table retired. Sepia's 32
  // moods are now the shared language — the reporter names a feeling and the renderer
  // resolves it into whichever pack is worn. Mirrors MOOD_EMOJI in src/vibe.js.
  MOOD_VOCAB: `\`neutral · content · delighted · focused · sleepy · sheepish · booped · thinking · spark ·
  excited · surprised · tender · melancholy · anxious · mirth · laugh · groan · oops ·
  frustrated · angry · dramatic · at_peace · solemn · rhyme · awe · vertigo · resolute ·
  puzzled · asking · weary · wink · love · working\``,

  // First-party scenes (Builder environment station + the catalog + the Explorer).
  // `live` marks scenes with native ambience in the renderer; `blurb` is one honest line.
  CATALOG_HOMES: { kaomoji: "study", motes: "night", sepia: "tidepool", kip: "glade" },
  SCENES: {
    tidepool: { url: SCENE_TIDEPOOL, live: "tidepool", blurb: "shallow water over sand — bubbles rise, a fish passes, taps ripple" },
    night: { url: SCENE_URL("night"), blurb: "indigo sky, stars, a crescent, one dark hill" },
    glade: { url: SCENE_URL("glade"), blurb: "mossy forest light with shafts and fireflies" },
    study: { url: SCENE_URL("study"), live: "study", blurb: "lamplight that flickers, tea steaming on a little table; feedings arrive as a heaped plate" }
  },

  // Mirrors MOOD_EMOJI in src/vibe.js so the Builder previews resolve mood names to the
  // same art the renderer will draw. Keep in sync when either side changes.
  MOOD_EMOJI_PREVIEW: {
    neutral: "1f642", content: "1f60a", delighted: "1f604", focused: "1f9d0", sleepy: "1f634",
    sheepish: "1f605", booped: "1f633", thinking: "1f914", spark: "1f4a1", excited: "1f929",
    surprised: "1f62e", tender: "1f970", melancholy: "1f61e", anxious: "1f630", mirth: "1f606",
    laugh: "1f602", groan: "1f62b", oops: "1f62c", frustrated: "1f624", angry: "1f620",
    dramatic: "1f3ad", at_peace: "1f60c", solemn: "1f636", rhyme: "1f3b5", awe: "1f632",
    vertigo: "1f635", resolute: "1f4aa", puzzled: "1f615", asking: "2753", weary: "1f629",
    wink: "1f609", love: "1f60d"
  },

  // Builder-only: face previews for the narrator callouts and mood strips.
  PREVIEW: {
    sepia: { kind: "sheet", url: SEPIA_SHEET, cols: 8, rows: 12, cell: 64, split: 4,
      moods: ["neutral","content","delighted","focused","sleepy","sheepish","booped","thinking",
        "spark","excited","surprised","tender","melancholy","anxious","mirth","laugh",
        "groan","oops","frustrated","angry","dramatic","at_peace","solemn","rhyme",
        "awe","vertigo","resolute","puzzled","asking","weary","wink","love"],
      strip: ["content","delighted","thinking","tender","puzzled","at_peace","wink","love"] },
    kip: { kind: "sheet", url: KIP_SHEET, cols: 8, rows: 1, cell: 64,
      moods: ["content","delighted","puzzled","surprised","solemn","excited","sheepish","at_peace"],
      strip: ["content","delighted","puzzled","surprised","solemn","excited","sheepish","at_peace"] },
    motes: { kind: "proc", moods: MOOD_LIST, strip: ["content","focused","awe","delighted","sleepy","angry","love","vertigo"] },
    kaomoji: { kind: "text", strip: ["( ˶ˆ ꒳ ˆ˵ )","( ・_・)","( ˃ ᯅ ˂ )","( ˘ ᵕ ˘ )","( ⊙ ᵕ ⊙ )","( ˶˃ ᵕ ˂˶ )","  ∧,,∧\n( ̳• · • ̳)\n/    づ♡"] }
  }
};



// Mirrored client-side in index.html's Builder (content above is the single-sourced part).
function assemble(faceKey, opts) {
  const f = PIECES.FACES[faceKey];
  const o = Object.assign({ name: "vibe-banner", cadence: "always", every: 3, fields: PIECES.DEFAULT_FIELDS, flags: true, cues: true, play: true }, opts || {});
  const popts = (o.play ? [] : ["play: false"]).concat(o.cues ? [] : ["cues: false"]);
  const snippet = PIECES.SNIPPET
    .replace("{{SNIPPET_URL}}", PIECES.snippetUrl)
    .replace("{{SNIPPET_FACE}}", f.SNIPPET_FACE)
    .replace("{{SNIPPET_READOUT}}", PIECES.SNIPPET_READOUT(o.fields))
    .replace("{{SNIPPET_SCENE}}", PIECES.SNIPPET_SCENE(o.scene))
    .replace("{{PAYLOAD_OPTS}}", popts.length ? ",\n      " + popts.join(", ") : "");
  let tail = "";
  if (o.cues || o.play) {
    tail += "\n## Attunement cues\n\n" + PIECES.ATT_PROV + "\n\n";
    if (o.cues) tail += PIECES.ATT_CUES + "\n";
    if (o.cues && o.play) tail += "\n";
    if (o.play) tail += PIECES.ATT_PLAY + "\n";
  }
  if (o.play) tail += "\n" + PIECES.SETTINGS.replace("{{VERSION}}", VERSION) + "\n";
  return [
    "---\nname: " + o.name + '\ndescription: "' + f.DESC + '"\n---\n',
    "# Vibe Banner" + f.TITLE + "\n",
    PIECES.OPENING + "\n",
    PIECES.CONTRACT + "\n",
    "## When\n",
    PIECES.CADENCE[o.cadence] + "\n",
    "## How to answer\n",
    PIECES.HOWTO_HEAD + "\n",
    // The kaomoji escape hatch only earns its space where the pack can actually fail to fit
    // the moment — a partial vocabulary. A full-vocabulary pack always has a mood, so the
    // paragraph is noise in that file, which is why it read as cuttable in the Motes variant.
    // The avatar is PRE-SELECTED (v0.53.0, the maintainer's framing): the reporter doesn't
    // choose it and shouldn't deliberate over it. The face's character survives as one line,
    // because knowing who you're wearing changes how you wear it — Sepia's colourblindness is
    // this whole arrangement made flesh, not decoration.
    "* **`avatar`** — your face and where you are were chosen by the user, not by you; emit them\n"
      + "  as given rather than deliberating. " + (f.IDENT || "") + "\n  " + f.FACE
      + (f.FULL_VOCAB ? "" : "\n" + PIECES.KAOMOJI_VALID),
    PIECES.FIELDS(o.fields),
    PIECES.BULLETS_LOCKED,
    (o.flags ? PIECES.FLAGS_FULL : PIECES.FLAGS_OFF) + "\n",
    PIECES.HOWTO_TAIL + "\n",
    "## Running it\n",
    PIECES.RUNNING_HEAD + "\n",
    snippet + "\n",
    PIECES.RUNNING_TAIL + (tail ? "\n" + tail : "\n")
  ].join("\n");
}

// No skill files are written any more (v0.49.0). The Builder composes the skill, so a
// checked-in copy was only ever a second thing to drift: it had its own pin to stamp, its own
// row in the docs, and it silently shipped without a scene for months precisely because
// nobody looked at it. The composer below is the single path, and the Builder runs this exact
// function in the browser. `npm run skill:sepia` prints the sepia/tidepool build for install.
// The face + home pairings the project considers canonical, kept for the CLI and the tests.
const HOMES = { kaomoji: "study", motes: "night", sepia: "tidepool", kip: "glade" };
// Functions survive the trip into the browser bundle as source, so the Builder runs the
// SAME generator the shipped skills do — no client-side mirror to drift out of sync.
// (They must therefore be closure-free: everything they need arrives as arguments.)
const FN = [];
const pieceJSON = JSON.stringify(PIECES, function (k, v) {
  if (typeof v === "function") { FN.push(v.toString()); return "@@FN" + (FN.length - 1) + "@@"; }
  return v;
}, 1).replace(/"@@FN(\d+)@@"/g, function (m, i) { return FN[+i]; });
const CLI = require.main === module;                           // importable: requiring this must not rewrite assets
if (CLI) {
  fs.writeFileSync("assets/skill-base.js", "window.SKILL_PIECES = " + pieceJSON + ";\n");
  console.log("generated assets/skill-base.js (Builder pieces + previews)");
}

// The catalog: a machine-readable index of the whole ecosystem, for Claude to fetch
// during a settings conversation (raw main URL = always the current menu).
const SITE = "https://bombadil-labs.github.io/vibe-banner/";
const RAW = "https://raw.githubusercontent.com/bombadil-labs/vibe-banner/main/";
const CATALOG = {
  what: "Machine-readable catalog of the vibe-banner ecosystem: face-packs, first-party scenes, skill variants, site surfaces. Fetched by Claude during settings conversations.",
  version: VERSION,                                            // a skill stamps its build version; compare against this to notice it has fallen behind
  builder: SITE + "#builder",
  whatsNew: "0.45.0 — Motes flies FLIGHT PATHS: a mood is a set of curves with share, align, cluster and flow. Motes and the weather vocabulary are on the site.",
  renderer: {
    bundle: PIECES.snippetUrl,
    payload_notes: {
      face: "one union: kaomoji string | image URL | sprite slice {url,cellW,cellH,cols,rows,index} | KnownFace {set,item}",
      scene: 'a name — "tidepool", "study", "night" or "glade" — fills the framed portrait window on the banner\'s left (face centred inside). The renderer owns the art, the opacity and whether the place is alive, so the name is the whole thing. A custom image still takes { url, opacity }. The window always draws; without a scene it renders empty (frame only)',
      flag: "a single optional string; one per banner at most"
    }
  },
  faces: {
    kaomoji: { kind: "text", note: "improvised fresh each banner; always valid, no registry needed" },
    sepia: { kind: "sheet", payload: { set: "sepia", item: "<mood>" }, items: PIECES.PREVIEW.sepia.moods,
      note: "the cuttlefish Claude designed for itself; wears feeling as color" },
    kip: { kind: "sheet", payload: { set: "kip", item: "<mood>" }, items: PIECES.PREVIEW.kip.moods,
      note: "the project mascot; 8-bit, stepped motion, snaps between poses" },
    motes: { kind: "proc", payload: { set: "motes", item: "<mood>" }, items: PIECES.PREVIEW.motes.moods,
      note: "a swarm drawn in code; the mood is the formation it flies" }
  },
  scenes: PIECES.SCENES,
  // No skill URLs: there are no checked-in skill files to link. The skill is composed — point
  // a settings conversation at the Builder, which is the only place it exists.
  skills: { composed_at: SITE + "#builder", homes: HOMES },
  site: { gallery: SITE + "#gallery", builder: SITE + "#builder", explorer: SITE + "#explorer" }
};
if (CLI) {
  fs.writeFileSync("assets/catalog.json", JSON.stringify(CATALOG, null, 2) + "\n");
  console.log("generated assets/catalog.json (settings-conversation menu)");
  console.log("now run: npm run pin");
}

// Exported so the tests can compose a skill in memory and assert the same properties the
// checked-in files used to be checked for — the guarantee moves with the composer, not the
// artifact. `npm run skill:sepia` prints the canonical sepia/tidepool build to stdout.
module.exports = { assemble, PIECES, HOMES };
