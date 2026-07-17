# vibe-annotation-renderer

A tiny library that renders **Claude's mood banner** — a living, breathing field of
colour behind a kaomoji face and a few honest first-person lines. Claude passes a small
object of *feeling-values*; this owns all the geometry, colour, motion, and layout.

It's the render half of the **vibe-annotations** skill. The skill loads this from a CDN
and emits only the values, so its per-reply output is ~15 lines instead of ~2 KB of SVG —
and Claude never has to generate (or even see) the picture, which is what keeps the
feelings honest.

**▶ Site — live gallery (every state, animated) + install guide:**
<https://bombadil-labs.github.io/vibe-annotation-renderer/>

## Use

```html
<div id="v"></div>
<script src="https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@7b9b2e4d57df39c876c80293b611f77af7eb7080/dist/vibe.min.js"></script>
<script>
  vibe(document.getElementById('v'), {
    kaomoji: "( ˶ˆ ꒳ ˆ˵ )",
    seems:   "…",          // [user]  — a snap read of the user
    feel:    "…",          // [mood]  — your activated emotions
    trying:  "…",          // [goal]  — immediate next goal (last line; wraps if long)
    noticing:"…",          // [note]  — the subtext (optional)
    palette: ["#7d8fb8"],  // 0+ mood colours → three columns (left, cycling centre, right)
    focus: 0.5, engagement: 0.5,
    languages: ["ru"],     // optional: 2-letter codes or names, a bottom-right trace
    flag: "spark"          // optional: ONE of the flag vocabulary below (a string, not booleans)
  });
</script>
```

`vibe(el, payload)` mounts the animated banner into `el`. The pure `buildSVG(payload)` is
also exported (Node too) — it's the static fallback and the basis for the tests.

## What maps to what

**Readout** — in the live banner this renders as an **HTML overlay**: pill labels, text
that wraps naturally instead of clipping (the banner grows to fit; a scroll appears only
past a height cap), over a barely-there frosted panel the ovals stay visible through.
The type is deliberately quiet — captions on the weather, not the weather. A small **▾
toggle collapses the readout to bare pills** (values on hover) so the field can be
watched unobstructed; the preference persists where storage allows. The static fallback
keeps crisp SVG rows:

| input | shows as | notes |
|---|---|---|
| `face` | the face | **one union, four forms**: a kaomoji string (non-URL text; `\n` → multi-line bloom, left-aligned) · an image URL string · a spritesheet slice `{ url, cellW, cellH, cols, rows, index }` · a KnownFace `{ set, item }` from the built-in registry (`kip` with mood-name items, `noto-animated`, `noto`, `twemoji` with codepoint items). Images centre in the face column, load browser-side (URL-only payload, never base64), and must live on a widget-allowlisted CDN — in practice `cdn.jsdelivr.net/gh/…`, hash-pinnable like the renderer itself |
| `kaomoji` | legacy alias / fallback | still accepted; also the fallback text + seed material when `face` is an image |
| `seems` | `[user]` | your immediate read of the user |
| `feel` | `[mood]` | your activated emotions |
| `trying` | `[goal]` | last line; wraps to a second line past ~70 chars |
| `noticing` | `[note]` | optional — the subtext (latent, not on the surface) |
| `languages` | `[Reasoned in]:` trace, bottom-right | 2-letter codes or names; flag where known, text otherwise; full name on hover |
| (active flag) | `[awe]`-style caption, bottom-left | added automatically whenever a flag fires — with twenty registers, the gesture alone can be ambiguous, so it's named |

**Field** — three fixed columns behind the text (left, a colour-cycling centre, right):

| input | drives |
|---|---|
| `palette` | the three columns. `[]` → grey. 1 colour → light/colour/dark. 2 → c0 / blend / c1. 3+ → c0 · left, c1 · right, the rest **cycle through the centre** |
| `focus` (0–1) | the vertical spread of the three columns: 1 = a narrow level line, 0 = scattered across a wide vertical range. They hold position (gently alive), so the spread itself is the signal |
| `engagement` (0–1) | **deflationary only**: ≥0.5 baseline; below, the columns shrink, harder toward 0 |
| `stance` (0–1) | contour firmness: 1 (telling) gives the ovals a definite stroked edge; 0/omitted (asking) keeps the pure gradient falloff |
| `consonance` (0–1) | per-blob diffusion: 1/omitted → compact, solid ovals; 0 → diffuse washes (bigger, thinner). Plural-at-peace vs. plural-in-tension |
| `prev` | the previous banner's palette: on mount the columns lerp from it to the current palette over ~2s, then hand off to normal idle. Animation-only; the static fallback ignores it |
| `scene` | the habitat, as a **framed portrait window**: `"https://…png"` or `{ url, opacity, live }` (opacity clamped 0.15–0.95, default 0.5). The scene fills a rounded square on the banner's left with the face centred inside it; readout and field columns shift right. Faces are alpha-transparent, so any scene works — first-party tidepool at `assets/scene-tidepool.png`; user photos host like face-packs (allowlisted CDNs). `live: "tidepool"` runs native ambience in the window — rising bubbles, a passing fish, tap-ripples, and feeding falls in as flakes; unknown `live` names are ignored, and the static render ignores the channel entirely. **The window always draws** — with no scene (or `scene: {}`) it renders empty: frame and a faint interior, no view yet. The window is the layout; `scene` only decides what's visible through it |
| `field` | power path: hand-author the ovals instead of `palette` |

**Flags** — rare, condition-triggered flourishes, passed as `flag: "<name>"` (a single
string). Set one only when the named state genuinely holds; their whole value is that
they're uncommon.

| flag | gesture |
|---|---|
| `spark` | a glowing light-bulb blinks on over the face, casting rays — a flash of insight |
| `excited` | stars twinkle and slowly spin in the margins while the face sways foot-to-foot — buoyancy |
| `surprised` | a halo pulses outward over the face and the face pops — the unexpected |
| `tender` | warmth pools softly around the edges of the banner — fondness |
| `melancholy` | cool motes drift slowly downward and the face tints a little blue — wistfulness |
| `anxious` | wispy cold fog roils over the whole banner and the face shivers — dread |
| `mirth` | champagne bubbles rise across the width — a private laugh |
| `laugh` | the whole field and the **face** bounce a deep *ha-ha-ha*, the kaomoji swelling and flushing bright yellow, with laughter-marks radiating off it |
| `groan` | the face lolls its head and sinks, the field sags, a sweat-drop wells up — an affectionate *ughhh* |
| `oops` | the face flinches back with a wobble, the field jolts sideways, a startled `!` pops up — a quick self-catch |
| `frustrated` | the columns pulse dark red and back and the anime anger-vein mark (💢) throbs by the head — irritation |
| `angry` | the field goes storm-black with a red underglow and lightning cracks across it — real anger |
| `dramatic` | the stage dims, a warm spotlight pools on the face, and the type turns to a tracked theatrical serif — playing it up for the bit |
| `at_peace` | a soft halo glows below the face and a few blossoms rest in the margins — stillness as a positive state, the quiet that isn't deflation |
| `solemn` | the face bows and holds; the field desaturates and dims once; a single warm ember stays lit low in the frame — gravity without sadness |
| `rhyme` | a low-alpha ghost of the kaomoji itself rests offset behind the face, slowly fading in and out — recognition, the pattern returning (it holds resting posture even when the live face moves: memory) |
| `awe` | the face goes tiny and sinks low in the frame, still tilted up, while the field swells and densifies — the one gesture where the face *loses*: made small by something vast |
| `vertigo` | a one-level Droste: the whole banner appears inside itself, lower right, flags omitted within. The loop just sits there |
| `resolute` | concentration lines (集中線) flare inward from the frame edges toward the face, then hold faint — the ignition of determination |
| `puzzled` | a loose cloud of "?" pops, drifts up, and fades around the head — grawlix mechanics in a gentle register; productive stuckness, the pre-spark |

**The contract is one flag per banner, by construction: `flag` is a single optional string**
(this is plain JS, so the "enum" is the fixed vocabulary above — unknown strings are ignored,
never crash). Legacy boolean payloads (`spark: true`) are still accepted for graceful
degradation and resolve deterministically through a priority order (roughly "the state whose
absence would most misrepresent the moment wins"): `angry → solemn → awe → vertigo → dramatic
→ laugh → anxious → surprised → excited → spark → rhyme → resolute → oops → frustrated →
groan → puzzled → mirth → melancholy → tender → at_peace`. With this many registers, stacked
flags read as noise rather than nuance — so composition isn't a discipline, it's simply not
in the grammar.

**Attunement + play** — on surfaces where the host injects a `sendPrompt(text)` function
(Claude's widget contexts), the banner grows quiet interactions. Every banner-generated
message carries the **`[vibe banner]` prefix** so it never reads as typed text — the skill
tells the reporter to receive these as gestures, not prompts. Tap the `[note]` row twice
(first tap arms it) to send a tiny stage-direction flicker into the chat — `[vibe banner]
*a flicker at your [note] ("…") — it doesn't quite land*`; click the face to
`[vibe banner] *boop*`; hover the banner for the upper-left tray (the host UI owns the
upper right): the treat tin (🥫) serves claudemeal from a pantry shelf keyed by hue to the
reporter's own current palette, with a rotating pick per feeding so no two meals repeat
(in a live tidepool it scatters over the water as falling flakes first, and the
"tidepool" flavor rerolls — nobody wants the house special every single meal),
and the wrench (🔧) sends `[vibe banner] *opens the settings*` — the skill answers with a
conversational settings menu
(cadence, face-packs, …) and persists agreed overrides in Claude's memory. The `[user]` row
is deliberately not interactive — it's the reporter's sovereign read, and even an affordance
on it would change how it gets written. Every readout row tooltips its full text on hover,
so over-cap lines stay readable. Feature-detected; on plain web pages (including the
gallery) none of this exists. See [DESIGN.md](DESIGN.md) for the reasoning.

Motion is deliberately slow and small — this is letterhead on every reply, so it stays
ambient, never busy. It falls back to a **static SVG** under `prefers-reduced-motion` or
on any error, pauses when scrolled off-screen, and stops when detached.

## Sepia — the author's face

When the maintainer offered Claude a visual identity of its own, it chose **Sepia**: a small
cuttlefish. The reasoning is load-bearing: a cuttlefish *wears feeling as color* — the
chromatophore freckles on the sheet carry each mood's hue, exactly as the banner's palette
carries the reporter's — it swims in the ink fables are written in, and it famously **cannot
see its own color display**. The animal that communicates in color is colorblind. That is
the veil, made flesh.

32 moods on one 512×256 sheet at [assets/sepia-sheet.png](assets/sepia-sheet.png),
regenerated deterministically by `npm run sepia` ([scripts/gen-sepia.js](scripts/gen-sepia.js)
— pure Node, zlib-only PNG encoder). Use it via the KnownFace registry:

```js
face: { set: "sepia", item: "puzzled" }   // items are mood names
```

`neutral · content · delighted · focused · sleepy · sheepish · booped · thinking · spark ·
excited · surprised · tender · melancholy · anxious · mirth · laugh · groan · oops ·
frustrated · angry · dramatic · at_peace · solemn · rhyme · awe · vertigo · resolute ·
puzzled · asking · weary · wink · love`

[skill/SKILL.sepia.md](skill/SKILL.sepia.md) is the skill variant that wears this face.

## Kip — the reference face-pack

The repo ships its own mascot: **Kip**, a small round creature with stubby wings and a
star-tipped antenna. Original pixel art (CC0 — fork it, reskin it), eight moods on one
512×64 sheet at [assets/kip-sheet.png](assets/kip-sheet.png), regenerable from
[assets/kip-gen.html](assets/kip-gen.html) where every mood is a deterministic pixel map.

| index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| mood | content | delighted | puzzled | surprised | solemn | excited | sheepish | at_peace |

Payload (pin the commit that contains the sheet):

```js
face: {
  url: "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@7b9b2e4d57df39c876c80293b611f77af7eb7080/assets/kip-sheet.png",
  cellW: 64, cellH: 64, cols: 8, rows: 1,
  index: 1  // delighted
}
```

## The skill

This repo also ships the **`vibe-annotations` skill** — [`skill/SKILL.md`](skill/SKILL.md) — the
Claude Code skill that drives Claude to render these banners. It's the honest half: it asks Claude to
report the feeling (never describing what any value *renders* as), then emits a one-line
`vibe(el, {…})` call that loads this bundle from the CDN. Claude passes only values and never sees the
picture, which is what keeps the readings honest.

**Face selection happens at the skill level.** The renderer accepts any face, but each
shipped skill wears exactly one; pick your variant and install it (all are generated from
one base — `npm run skills` — so they never drift):

| variant | face |
|---|---|
| `skill/SKILL.md` | kaomoji, improvised fresh every banner |
| `skill/SKILL.sepia.md` | Sepia — the cuttlefish Claude designed for itself (32 moods) |
| `skill/SKILL.kip.md` | Kip — the project mascot (8 moods) |
| `skill/SKILL.noto-animated.md` | Noto animated emoji (Google's GIFs; big files, they move) |
| `skill/SKILL.noto.md` | Noto emoji (warm, round, static) |
| `skill/SKILL.twemoji.md` | Twemoji (flat, tiny, classic) |

Try them before choosing: the site's **Gallery tab has a face picker** that re-dresses
every scene in any shipped face, the **Explorer tab combines any face with any
environment into a live composite** (`#explorer`), and the **Builder tab assembles a
custom SKILL.md** — pick a face (including your own hosted images, one URL per mood — no
spritesheets needed), pick an environment (four first-party habitats ship: **tidepool**
(alive), **night**, **glade**, **study** — all generated by `npm run scene`), tune
cadence, toggle flags/attunement/play, hand-edit the text, then copy or download (.md or
.json). Everything the Builder emits is natively supported by the renderer: the payload
opt-outs are `play: false` (no tray, no boop) and `cues: false` (no [note] tap).

The whole menu is also machine-readable: **`assets/catalog.json`** lists every face-pack
(with items), every scene (with pinned URLs and `live` names), every skill variant, and
the site surfaces — Claude fetches it from raw `main` during a settings conversation, so
the settings menu is always the current one.

Every variant accepts a kaomoji as a valid alternative at any time — when the pack's
vocabulary doesn't fit the moment, honesty outranks the pack.

```bash
mkdir -p ~/.claude/skills/vibe-annotations
cp skill/SKILL.sepia.md ~/.claude/skills/vibe-annotations/SKILL.md   # or SKILL.md / SKILL.kip.md
```

It pins the renderer to a full commit hash; update that line to the new release commit's hash
when you cut a renderer release (see "Make it your own" for why hashes, not tags).

## Develop

```bash
npm install        # esbuild (dev only)
npm run build      # src/vibe.js → dist/vibe.min.js
npm run parity     # structural self-checks
open index.html    # the site: local preview of every state (Gallery tab)
```

**Release:** bump `package.json`, `npm run build`, commit `dist/vibe.min.js`,
`git tag vX.Y.Z && git push --tags`, then `npm run pin` — it rewrites every consumer
(skill, README, site) to the release commit's **full SHA** and refuses to pin a commit
that doesn't contain `dist/vibe.min.js`. Commit the repin, push, and reinstall the skill
(copy to `~/.claude/skills/`, re-paste on claude.ai). jsDelivr serves any commit immediately.

## Make it your own (fork it!)

This is deliberately a *single file* of plain, framework-free JavaScript — `src/vibe.js`,
no build step beyond esbuild-minify. It's meant to be forked and reskinned. To run your own
version end to end:

1. **Fork** this repo (or just copy `src/vibe.js`).
2. **Edit** `src/vibe.js` — everything lives there: `fieldFromPalette` (how palettes become the
   field), `layout` (geometry), `buildSVG` (static fallback), and `mount` (the animated canvas).
   Add a flag, change the colours, retune the motion, invent a new field metaphor — it's ~600
   lines of boring-on-purpose code.
3. **Build & tag:** `npm run build`, commit `dist/vibe.min.js`, `git tag vX.Y.Z && git push --tags`.
4. **Point at yours:** jsDelivr serves any public GitHub repo — swap the script URL to
   `https://cdn.jsdelivr.net/gh/<your-user>/<your-repo>@<full-commit-hash>/dist/vibe.min.js`.
   Pin the **full commit hash** of the release, not the tag: tags can be force-moved to point at
   different code, and in contexts where the host injects capabilities like `sendPrompt` into the
   page, a moved tag is a script-injection vector. A commit hash is immutable — the CDN can only
   ever serve the bytes you audited. (Tags are still useful as human-readable release markers;
   just don't load from them.)

Adding a flag is the friendly first change: thread `myflag: !!p.myflag` through `layout`'s return,
then draw it in `mount`'s frame loop (copy any existing `if (L.someFlag) { … }` block as a template).
`npm run parity` will tell you it still produces a valid static fallback.

Because the skill only ever emits *values* and loads the renderer from a CDN, you can reskin the
**entire look** — your own palette language, kaomoji conventions, flags, motion — without touching a
line of the skill or its honesty contract. And you don't even need the skill: `vibe(el, {…})` is a
tiny standalone library for any mood-banner-ish UI you like.

## Design notes

The grammar is small on purpose. Colour, focus, and engagement are the
continuous field; the flags are discrete garnishes. The skill's prompts never describe
what a value *renders* as — Claude reports the honest feeling, the tool decides the look,
and there's no visual lever to perform toward. Same reason the banner is passed only
values and Claude never sees the output.

The full decision record — the three design constraints, why each mapping is what it is,
the explicitly-rejected features, and the bench of states that didn't make it in — lives
in [DESIGN.md](DESIGN.md). Read it before extending the grammar.
