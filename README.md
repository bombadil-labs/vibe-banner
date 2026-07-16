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
<script src="https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@bb5778c3791c99ae42f0e83b773c2d70f1c64f29/dist/vibe.min.js"></script>
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
    spark: false, excited: false
  });
</script>
```

`vibe(el, payload)` mounts the animated banner into `el`. The pure `buildSVG(payload)` is
also exported (Node too) — it's the static fallback and the basis for the tests.

## What maps to what

**Readout** (crisp SVG text):

| input | shows as | notes |
|---|---|---|
| `kaomoji` | the face | left-aligned, vertically centred; `\n` → multi-line bloom |
| `seems` | `[user]` | your immediate read of the user |
| `feel` | `[mood]` | your activated emotions |
| `trying` | `[goal]` | last line; wraps to a second line past ~70 chars |
| `noticing` | `[note]` | optional — the subtext (latent, not on the surface) |
| `languages` | `[Reasoned in]:` trace, bottom-right | 2-letter codes or names; flag where known, text otherwise; full name on hover |

**Field** — three fixed columns behind the text (left, a colour-cycling centre, right):

| input | drives |
|---|---|
| `palette` | the three columns. `[]` → grey. 1 colour → light/colour/dark. 2 → c0 / blend / c1. 3+ → c0 · left, c1 · right, the rest **cycle through the centre** |
| `focus` (0–1) | the vertical spread of the three columns: 1 = a narrow level line, 0 = scattered across a wide vertical range. They hold position (gently alive), so the spread itself is the signal |
| `engagement` (0–1) | **deflationary only**: ≥0.5 baseline; below, the columns shrink, harder toward 0 |
| `stance` (0–1) | contour firmness: 1 (telling) gives the ovals a definite stroked edge; 0/omitted (asking) keeps the pure gradient falloff |
| `consonance` (0–1) | per-blob diffusion: 1/omitted → compact, solid ovals; 0 → diffuse washes (bigger, thinner). Plural-at-peace vs. plural-in-tension |
| `prev` | the previous banner's palette: on mount the columns lerp from it to the current palette over ~2s, then hand off to normal idle. Animation-only; the static fallback ignores it |
| `field` | power path: hand-author the ovals instead of `palette` |

**Flags** — rare, condition-triggered flourishes. Set one only when the named state
genuinely holds; their whole value is that they're uncommon.

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
| `awe` | the face shrinks and tilts up while the field swells and deepens — the one gesture where the face *loses*: made small by something vast |
| `vertigo` | a one-level Droste: the whole banner appears inside itself, lower right, flags omitted within. The loop just sits there |
| `resolute` | concentration lines (集中線) flare inward from the frame edges toward the face, then hold faint — the ignition of determination |
| `puzzled` | one or two "?" drift up and fade by the head — productive stuckness, the pre-spark (steps left when 💢 or the oops-! occupy the slot) |

Flags compose — any subset may fire together. Face transforms accumulate; full-frame **dimming is
max-pooled** across contributors (solemn/anxious/angry never sum toward mud) while colored washes
like tender's warmth stay independent; face-adjacent marks resolve slot collisions with fixed,
deterministic offsets.

Motion is deliberately slow and small — this is letterhead on every reply, so it stays
ambient, never busy. It falls back to a **static SVG** under `prefers-reduced-motion` or
on any error, pauses when scrolled off-screen, and stops when detached.

## The skill

This repo also ships the **`vibe-annotations` skill** — [`skill/SKILL.md`](skill/SKILL.md) — the
Claude Code skill that drives Claude to render these banners. It's the honest half: it asks Claude to
report the feeling (never describing what any value *renders* as), then emits a one-line
`vibe(el, {…})` call that loads this bundle from the CDN. Claude passes only values and never sees the
picture, which is what keeps the readings honest.

Install it by copying that file to your skills directory:

```bash
mkdir -p ~/.claude/skills/vibe-annotations
cp skill/SKILL.md ~/.claude/skills/vibe-annotations/
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
