# vibe-banner

A tiny library that renders **Claude's mood banner** — a living, breathing field of
colour behind a kaomoji face and a few honest first-person lines. Claude passes a small
object of *feeling-values*; this owns all the geometry, colour, motion, and layout.

It's the render half of the **vibe-banner** skill. The skill loads this from a CDN
and emits only the values, so its per-reply output is ~15 lines instead of ~2 KB of SVG —
and Claude never has to generate (or even see) the picture, which is what keeps the
feelings honest.

**▶ Site — live gallery (every state, animated) + install guide:**
<https://bombadil-labs.github.io/vibe-banner/>

## Use

```html
<div id="v"></div>
<script src="https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-banner@def83b284fd6f869b8f147f07686a2e15f2ffe12/dist/vibe.min.js"></script>
<script>
  vibe(document.getElementById('v'), {
    avatar: {
      set: "sepia", item: "content",       // any pack; all speak the same 33 moods
      scene: "tidepool"                    // a named habitat; omit for an empty window
    },
    palette: ["#7d8fb8"],                  // top level: it colours YOU as well as the field
    details: {
      readout: [                           // up to 5 rows, any labels
        { label: "user", value: "…" },     //   a snap read of the user
        { label: "mood", value: "…" },     //   your activated emotions
        { label: "goal", value: "…" }      //   immediate next goal
      ],
      focus: 0.5, engagement: 0.5,
      languages: ["ru"],                   // optional: a bottom-right [Reasoned in] trace
      weather: "spotlight"                 // optional: ONE of the seven weathers
    }
  });
</script>
```

`vibe(el, payload)` mounts the animated banner into `el`. The pure `buildSVG(payload)` is
also exported (Node too) — it's the static fallback and the basis for the tests.

## Two keys

A payload is an **avatar** — who you are and where you are — plus **details**, everything the
banner shows beside it, plus a **palette** that sits outside both because it belongs to both:
it tints the creature (Sepia's chromatophores, the motes' own light) as well as the field.
Leave `details` out and you get the window alone: a square avatar tile, no field, no readout,
no weather — still coloured by the palette.

```js
vibe(el, {
  avatar:  { set: "sepia", item: "content", scene: "tidepool" },
  palette: ["#7d8fb8"],
  details: { readout: [{ label: "user", value: "…" }], focus: 0.5, engagement: 0.7 }
});

vibe(el, { avatar: { set: "sepia", item: "content" }, palette: ["#7d8fb8"] });   // → a 156×152 tile
```

The flat form (`face`, `seems`/`feel`/`trying`/`noticing` or `readout`, and the values at the top
level) still works and always will — every skill deployed before the split renders unchanged.

## What maps to what

**Readout** — in the live banner this renders as an **HTML overlay**: pill labels, text
that wraps naturally instead of clipping (the banner grows to fit; a scroll appears only
past a height cap), over a barely-there frosted panel the ovals stay visible through.
The type is deliberately quiet — captions on the weather, not the weather. A **text/stats
toggle** straddling the panel swaps the prose rows for explicit gauges of the numeric
values; the preference persists where storage allows. The **face is HTML
in the live banner too** — exact whitespace for multi-line kaomoji, CSS plate,
percentage-cropped sprites, centre-pivot transforms. The static fallback keeps crisp
SVG rows and the SVG face:

| input | shows as | notes |
|---|---|---|
| `face` | the face | **one union, four forms**: a kaomoji string (non-URL text; `\n` → multi-line bloom, left-aligned) · an image URL string · a spritesheet slice `{ url, cellW, cellH, cols, rows, index }` · a KnownFace `{ set, item }` from the built-in registry (`kip` and `sepia` with mood-name items, `twemoji` with mood names or codepoints). Images centre in the face column, load browser-side (URL-only payload, never base64), and must live on a widget-allowlisted CDN — in practice `cdn.jsdelivr.net/gh/…`, hash-pinnable like the renderer itself |
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
| `coherence` (0–1) | focus's emotional dual, and per-blob diffusion: 1/omitted → compact, solid ovals; 0 → diffuse washes (bigger, thinner). Plural-at-peace vs. plural-in-tension. (`consonance` is the old name, still accepted) |
| `scene` | the habitat, as a **framed portrait window**: a NAME — `"tidepool"` · `"study"` · `"night"` · `"glade"` — and the renderer owns the art, the pin, the opacity and whether the place is alive. A custom image still takes `{ url, opacity }` (clamped 0.15–0.95); a bare word that is not a known name empties the window rather than requesting a broken image. The scene fills a rounded square on the banner's left with the face centred inside it. `tidepool` and `study` are **live**: native ambience in the window — rising bubbles, a passing fish, tap-ripples, lamplight, feeding. **The window always draws** — with no scene it renders empty: frame and a faint interior, no view yet |
| `field` | power path: hand-author the ovals instead of `palette` |

**Weather (optional DETAIL)** — rare, condition-triggered banner weather: light, storms and
air around you, never face poses. The face belongs to the avatar and already carries the
emotion, which is why the old emotional flag names retired in v0.44.0. Passed as
`weather: "<name>"`, a single string. Set one only when the named state genuinely holds;
their whole value is that they're uncommon.

| weather | the room |
|---|---|
| `storm` | dark, red-lit, lightning cracking across the field — real anger, or things going badly wrong |
| `spotlight` | the stage dims and a warm pool finds you — performing, or a moment that matters |
| `hush` | the colour drains and a single warm ember holds low in the frame — gravity, grief, the quiet after news |
| `fog` | cold wisps roll through and the edges creep in — dread, or not knowing |
| `glow` | warmth pools at the margins — fondness, tenderness toward whoever you're with |
| `bloom` | the field swells and blossoms scatter — peace, wonder, something opening |
| `converge` | concentration lines pull inward from the frame edges — effort, resolve, bearing down on one thing |

**One weather per banner, by construction: `weather` is a single optional string** (plain JS,
so the "enum" is the fixed vocabulary above — unknown strings are ignored, never crash).
Thirteen effects retired with the rename, each because it duplicated something the avatar now
says better: the spark bulb, excited sparkles, the surprised halo, melancholy motes, mirth
bubbles, the laugh field-bounce, groan's sag, oops's jolt, frustrated's red pulse, the rhyme
echo and the vertigo Droste among them. **There is no alias table** — every deployed skill
pins a full commit SHA, so an old skill loads the old renderer bytes and never meets this
vocabulary at all. The pin *is* the compatibility story.

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

`npm run skill -- sepia tidepool` composes the variant that wears this face.

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
  url: "https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-banner@def83b284fd6f869b8f147f07686a2e15f2ffe12/assets/kip-sheet.png",
  cellW: 64, cellH: 64, cols: 8, rows: 1,
  index: 1  // delighted
}
```

## The skill

This repo also carries the **`vibe-banner` skill** — the
Claude Code skill that drives Claude to render these banners. It's the honest half: it asks Claude to
report the feeling (never describing what any value *renders* as), then emits a one-line
`vibe(el, {…})` call that loads this bundle from the CDN. Claude passes only values and never sees the
picture, which is what keeps the readings honest.

**There is no checked-in `SKILL.md`.** The skill is *composed* — by the site's Builder tab, or
by `npm run skill` from a terminal, both running the same generator. A copy sitting in the repo
was only ever a second thing to drift, and it did: for months every checked-in variant shipped
with no environment at all, because nobody read the file they were all generated into.

**Face selection happens at the skill level.** The renderer accepts any face, but a composed
skill wears exactly one. Each face has a home it reads best in, and that pairing is the default:

| face | home | |
|---|---|---|
| `kaomoji` | study | improvised fresh every banner |
| `sepia` | tidepool | the cuttlefish Claude designed for itself (33 moods) |
| `motes` | night | a swarm drawn in code — no art fetched at all |
| `kip` | glade | the project mascot (8 moods) |
| `twemoji` | study | flat, tiny, classic |

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
npm run skill:install              # sepia in her tidepool → ~/.claude/skills/vibe-banner/SKILL.md
npm run skill -- motes night       # any pairing, to stdout
npm run skill -- kip glade -o ./SKILL.md
```

The composer stamps the renderer pin itself, using the same rule as `npm run pin`: the last
commit that touched `dist/`, which is the release commit by construction. So compose *after*
pinning — it will refuse loudly if the pin is still the placeholder. Full commit hash, never a
tag (see "Make it your own" for why).

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
