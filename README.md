# vibe-annotation-renderer

A tiny library that renders **Claude's mood banner** — a living, breathing field of
colour behind a kaomoji face and a few honest first-person lines. Claude passes a small
object of *feeling-values*; this owns all the geometry, colour, motion, and layout.

It's the render half of the **vibe-annotations** skill. The skill loads this from a CDN
and emits only the values, so its per-reply output is ~15 lines instead of ~2 KB of SVG —
and Claude never has to generate (or even see) the picture, which is what keeps the
feelings honest.

**▶ Live gallery (every state, animated):**
<https://bombadil-labs.github.io/vibe-annotation-renderer/gallery.html>

## Use

```html
<div id="v"></div>
<script src="https://cdn.jsdelivr.net/gh/bombadil-labs/vibe-annotation-renderer@v0.0.12/dist/vibe.min.js"></script>
<script>
  vibe(document.getElementById('v'), {
    kaomoji: "( ˶ˆ ꒳ ˆ˵ )",
    seems:   "…",          // [user]  — a snap read of the user
    feel:    "…",          // [mood]  — your activated emotions
    trying:  "…",          // [goal]  — immediate next goal (last line; wraps if long)
    noticing:"…",          // [note]  — the subtext (optional)
    palette: ["#7d8fb8"],  // 0+ mood colours, strongest first; [] = neutral grey
    spread: 0.6, turbulence: 0.35, engagement: 0.5,
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
| `languages` | flag/code chips under the face | only if non-English; full name on hover |

**Field** (soft animated blobs behind the text — they drift and breathe):

| input | drives |
|---|---|
| `palette` | 0+ colours, strongest first; `colours[0]` is dominant; `[]` → neutral grey (never amber) |
| `spread` (0–1) | horizontal spread (focus ↔ scattered) |
| `turbulence` (0–1) | vertical dispersion (one register ↔ churning) |
| `engagement` (0–1) | **deflationary only**: ≥0.5 baseline; below, the field shrinks *and* scatters, harder toward 0 — and drives the motion's liveliness |
| `field` | power path: hand-author the ovals instead of `palette` |

**Flags** — rare, condition-triggered flourishes. Set one only when the named state
genuinely holds; their whole value is that they're uncommon.

| flag | gesture |
|---|---|
| `spark` | a bright bloom pulses in the top-right corner under an expanding halo — a flash of insight |
| `excited` | stars twinkle and slowly spin in the margins while the face sways foot-to-foot — buoyancy |
| `awe` | a halo pulses outward over the face and fades — wonder |
| `tender` | warmth pools softly around the edges of the banner — fondness |
| `melancholy` | cool motes drift slowly downward and the face tints a little blue — wistfulness |
| `unease` | wispy cold fog roils over the whole banner and the face shivers — dread |
| `mirth` | champagne bubbles rise across the width — a private laugh |
| `laugh` | the whole field and the **face** bounce a deep *ha-ha-ha*, the kaomoji swelling and flushing bright yellow, with laughter-marks radiating off it |
| `groan` | the face lolls its head and sinks, the field sags, a sweat-drop wells up — an affectionate *ughhh* |

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

It pins a renderer version (`@vX.Y.Z`); bump that line when you cut a new renderer release.

## Develop

```bash
npm install        # esbuild (dev only)
npm run build      # src/vibe.js → dist/vibe.min.js
npm run parity     # structural self-checks
open gallery.html  # local preview of every state
```

**Release:** bump `package.json`, `npm run build`, commit `dist/vibe.min.js`,
`git tag vX.Y.Z && git push --tags`. jsDelivr serves the tag immediately.

## Design notes

The grammar is small on purpose. Colour, spread, turbulence, and engagement are the
continuous field; the flags are discrete garnishes. The skill's prompts never describe
what a value *renders* as — Claude reports the honest feeling, the tool decides the look,
and there's no visual lever to perform toward. Same reason the banner is passed only
values and Claude never sees the output.
