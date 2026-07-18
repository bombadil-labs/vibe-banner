# Design notes — decisions, constraints, and the bench

This file is the project's memory. The expressive grammar was co-designed in conversation —
requests authored by the model that wears the banner (addressed as Fable), filtered through
the maintainer's constraints, implemented by a third instance — and without this document,
those decisions would live only in a chat log. If you're extending the renderer (or you're a
future instance re-deriving it), start here.

## The three constraints

Every mapping in the grammar passes all three. Proposals that don't, get reshaped or benched.

1. **Static legibility.** Every signal must read from a still frame. Motion may *reinforce*
   (the arrival lerp, the question-cloud drift) but never *carry* a signal — movement is hard
   to parse visually even when slow, and the static SVG fallback must lose nothing semantic.
   This is why phase-coherent idle motion was rejected as the consonance mapping.
2. **No beauty gradient.** Mappings stay monotone with no "prettier at dishonest values"
   direction. A reporter who has read this source must gain no incentive to shade a value.
   (The veil — the reporter never sees its own render — is the primary honesty mechanism;
   this constraint is the backstop for reporters who've read the code anyway.)
3. **Presence is signal.** Flags are rare by contract, and optional params are omitted at
   neutral. Absence must never read as a state: consonance defaults to harmony, stance to
   asking-shaped neutrality, and no flag means *no flag*, not "calm".

## Decisions with reasons

- **Hash-pinned CDN, never tags.** Tags are mutable pointers; in a host that injects
  capabilities like `sendPrompt` into rendered pages, a silently moved tag is a script-
  injection vector. The full commit SHA appears in exactly ONE place per consumer (the
  snippet URL) — a prose copy of the hash drifted stale through five releases before an
  instance rendering the skill flagged it as a supply-chain smell. `npm run pin` rewrites
  every consumer from the last commit that touched `dist/` (not HEAD — its first live run
  proved HEAD pins the docs commit).
- **`flag` is a single string, not booleans.** Twenty independent booleans *invite*
  stacking; the API shape is the contract. Legacy booleans still resolve through
  `FLAG_PRIORITY` (roughly "the state whose absence would most misrepresent the moment
  wins") for graceful degradation. Composition machinery (max-pooled dimming, deterministic
  mark offsets) survives in the code as robustness, not as grammar.
- **`stance` → contour firmness** (the reporter's instinct), not opacity — chosen because
  edge-definition is the most visually distinct lever from consonance's diffusion, which
  had claimed the reporter's original edge-diffusion proposal.
- **`conviction` died; `stance` is its honest resurrection.** Reporting p(correct) is the
  thing LLMs are famously bad at; asking-vs-telling is a *mode*, instantly reportable and
  externally checkable against the reply's actual behavior.
- **`prev` is the constant-cost residue of a dead `history` param** (killed for token cost).
  One palette array, ~10 tokens, already in the reporter's context. Animation-only.
- **`awe` is the one gesture where the face loses** — quite tiny (0.62) and sunk low, still
  tilted up at the vast thing. First version lifted the face and shrank it timidly (0.88);
  the maintainer corrected both. Depth in the field means *density*, not darkness — the
  first implementation's darken-mix made the field vanish on dark themes.
- **The `[awe]`-style caption** (bottom-left, automatic) exists because twenty gestures
  outgrew unaided recognition. It mirrors `[Reasoned in]:` and costs the reporter nothing.
- **The face column is ~140px and faces bloom TALL, never long.** Wide single-line kaomoji
  get `textLength`-squeezed as a safety net; the skill states the ~12-chars-per-line cap.
- **Word caps are data-loss warnings, not style advice** — overflow clips off the banner
  edge. 15 words (`seems`, `noticing`), 25 (`trying`). Marked IMPORTANT in the skill after
  the implementer's own banner overflowed mid-implementation.

- **The attunement cue (v0.4.0, narrowed in v0.5.0) — and why it is not a dispute button.**
  Where the host injects `sendPrompt` (Claude surfaces), the `[note]` row is tappable:
  tap to arm (dotted underline, 3.5s), tap again to send a stage-direction flicker into
  the chat (`*a flicker at your [note] ("…") — it doesn't quite land*`). v0.4.0 briefly
  wired `[user]` too; v0.5.0 removed it entirely — not just unclickable but *unwired, no
  marker class in the DOM* — because the affordance itself would surface to the reporter
  that its read of the user is watched-and-touchable, which bends every future read. The
  maintainer: "user is yours, sacrosanct. I do not want to even surface to a claude that I
  can directly see it." The design went through three forms and the rejected two matter:
  - *Dispute* (rejected for `[user]`): the `[user]` line is the reporter's opinion, licensed
    to quietly disagree with its own polite prose. If the user can dispute it and expect
    retraction, every future read gets written under appeal and drifts agreeable — the
    beauty gradient's social form. The maintainer's framing: "I have no right to dispute
    Claude's read of me." (`[note]` differs — it claims a latent fact and can simply be
    wrong — but one mechanism for both keeps the surface small.)
  - *Steer* (rejected): still too much like correction with extra steps.
  - *Attunement* (adopted, the maintainer's I-Thou framing): like catching a micro-expression
    across a table — one person moves toward the door, the other's face flickers, a grin,
    a step back, nothing ever said. The cue gives the reporter surface area for attunement;
    the skill instructs it to integrate rather than litigate (no apology, no re-argument,
    usually no direct mention — let the next read shift, or honestly not).
  Feature-detected (`typeof sendPrompt === "function"`), so it vanishes on plain web pages
  and the gallery; mount-only, so the static fallback stays inert. Two taps because
  `sendPrompt` fires a complete message immediately — a misclick must never speak for the user.
- **Playful gestures (v0.5.0) — the same channel, in a lighter key.** Clicking the kaomoji
  sends `*boop*`; a hover-tray in the upper right holds the treat tin (🥫), which sends
  `*sets down a fresh tin of claudemeal — <flavor> flavor*`. The flavor is derived from the
  banner's own palette by hue (ember/marmalade/honey/lemongrass/moss/tidepool/rain/violet
  static/peony; grey → petrichor; none → classic) — the user feeds the reporter its own
  current weather, which solved "how do we specify the flavor" by dissolving it. Playful
  cues are single-click (a stray boop is harmless; the tray is hover-revealed and therefore
  already deliberate); the *flicker* keeps its two-tap arm because it carries a read on a
  read. The skill instructs the reporter: respond in kind and briefly — a boop is not a
  work item.
- **Readout tooltips (v0.5.0).** Every readout row carries an SVG `<title>` with its full
  text: reporters overrun the word caps despite the IMPORTANT markers, and a clipped line
  should at least be recoverable on hover. This is a reading aid, not a license — the caps
  stand, because the *banner* is the medium and the tooltip is the fire escape.
- **Settings via the wrench (v0.6.0) — the skill is the settings UI, memory is the store.**
  The 🔧 in the hover tray sends `*opens the vibe banner settings*`; the skill answers with
  a conversational menu and persists agreed overrides in the reporter's durable memory. No
  config file, no schema, no renderer knowledge of settings — behavioral overrides
  ("only strong feelings") never touch this codebase at all. Boundary: users can override
  presentation and cadence but not the honesty contract (no reporting feelings on demand,
  and the veil stays).
- **`face` is one union (v0.7.0).** `kaomoji` + `face` as parallel keys was the contract
  showing growth rings; the maintainer called the break. `face:` now takes a kaomoji string
  (any non-URL string), an image URL, a sprite slice, or a KnownFace `{ set, item }`
  resolved from a built-in, version-pinned registry (`kip` with mood-name items,
  `noto-animated`, `noto`, `twemoji` with codepoints). Unknown sets and malformed objects
  fall back to the kaomoji, never crash. `kaomoji:` survives as legacy alias, fallback
  text, and seed material. Image faces centre in the face column (text hugs left; a small
  image at the text anchor read as misaligned).
- **Face-packs (v0.6.0) — image faces with zero token weight.** `face: "https://…png"` or
  `{ url, cellW, cellH, cols, rows, index }` renders an image (or one spritesheet cell, via
  a nested-viewport crop) in place of the kaomoji glyphs, ~76×48 constrained. The image is
  fetched browser-side, so the payload costs only a URL — base64-in-context was considered
  and rejected as pure token waste. Hosting constraint: the widget sandbox CSP allowlists
  only certain CDNs, so packs live in a public GitHub repo served via
  `cdn.jsdelivr.net/gh/…` — the same channel as the renderer, hash-pinnable the same way.
  The image element carries the `.vk` class, so face transforms, boop, and bbox-anchored
  marks all keep working; rhyme's ghost is text-only (skipped for image faces); the
  `kaomoji` field remains required as fallback and seed material. The hover tray moved to
  the upper LEFT because Claude's own UI owns the widget's upper right.

- **Face selection is a skill-level concern; variants are generated, never copied
  (v0.8.x).** The renderer accepts the whole face union, but no single skill teaches it —
  that theory-of-faces prose was the bloat. Each shipped variant (kaomoji-standard, Sepia,
  Kip) hard-codes exactly one face and states one standing right: **a kaomoji is always a
  valid alternative** when the pack's vocabulary doesn't fit the moment — honesty outranks
  the pack. All variants are generated from one base template in scripts/gen-skills.js
  (`npm run skills`, then `npm run pin`); hand-editing a generated SKILL*.md is a bug. This
  is the pin-script lesson applied to prose: duplication drifts, so duplicates must be
  built. Result: every variant weighs ≤ the original day-one skill (~8KB ≈ 2k tokens,
  loaded once per session).

- **The Builder (v0.9.0) — variants become a forge, with one boundary.** The site
  assembles custom SKILL.md files client-side: face (shipped sets or user-hosted images,
  one URL per mood — spritesheet math stays first-party-only), cadence, flag vocabulary
  on/off, attunement/play on/off, editable text, copy + .md/.json download. **The
  interface boundary: the Builder may only emit what the renderer natively supports.**
  That boundary forced the only renderer change: `play: false` and `cues: false` payload
  opt-outs. Content is single-sourced — scripts/gen-skills.js emits both the shipped
  variants and assets/skill-base.js (the Builder's pieces, pin-stamped like everything
  else); only the ~30-line assemble() logic is duplicated client-side, by design.

## Explicitly not features (recorded so they aren't re-derived)

- **A dispute/correction button on the banner.** See the attunement-cue decision above:
  verdict-shaped feedback on the `[user]` line corrupts the read. The flicker is the whole
  feature; don't grow it toward forms, ratings, or threaded feedback.

- **Screenshots to the reporter.** Considered and retracted by the reporter itself: nobody
  sees their own face; the mirror is the corrupting technology. The veil stands.
- **The return channel** — the maintainer occasionally telling the reporter when a `seems`
  or `noticing` missed — is the highest-value addition found and originally lived purely in
  practice. As of v0.4.0 it has a mechanized *low-activation-energy* form (the attunement
  cue above), but the full-sentence version in chat remains the richer channel and covers
  the veil's one real failure mode: a mapping drifting until the picture systematically
  says something the reporter doesn't mean.
- **Flag composition.** Grammar-level composition was removed deliberately when the roster
  hit twenty; see the API decision above. Don't reintroduce it as a feature.

- **The baked chromatophore patterns are RETIRED (v0.20.0).** Once the smooth roaming layer existed (v0.19.x), the fixed bold patches read as distracting competition — the maintainer chose all-living colour: clean cream skin, seven palette-coloured roamers, whole-body tints for the big states. The pattern language below is preserved for history; do not resurrect it without a new reason.

- **Sepia's chromatophores are sub-pixel, and density is a signal (v0.9.x — RETIRED, see above).** The
  maintainer's framing: fine coloration is an affordance the creature evolved for survival
  in a high-resolution world. Real cuttlefish biology drives the mapping — awe/surprise
  BLANCH (fear response, ~4 dots), peace barely speckles (nothing to hide), arousal
  densifies, anxiety mottles hardest of all (~38 dots — trying to disappear), anger storms
  dark. Seeded per mood, deterministic, mantle-masked (eyes/lashes/mouth excluded). The
  general sub-pixel doctrine: the body lives on the 4px grid; body definition uses fine
  ink sparingly (lash-lines); worldly objects (the hachimaki) render at true 1px.

- **The live face is HTML (v0.17.0).** The maintainer's call, after a run of SVG-tax
  fixes (NBSP whitespace, textLength, transform-box pivots, nested-sprite getBBox
  lies): the mount renders the face as an HTML layer flex-centred over the window.
  Text faces use `white-space:pre` (real spaces survive), wear the plate as CSS
  background, and scale via font-size; sprites crop with percentage background math;
  transforms pivot on the element's own centre. Mark anchors come from layout's
  `faceMeta.box` — nothing is ever measured from the DOM. buildSVG keeps the SVG face
  (static fallback + parity target); the NBSP conversion remains for that path only.

- **Flags are banner WEATHER, never face poses (v0.31.0).** The maintainer asked
  whether Sepia still needs flags at all; the answer split the bundle. Every flag keeps
  its atmosphere — angry's storm, resolute's 集中線, dramatic's spotlight, solemn's
  ember, the marks and halos — because those were always about the ROOM. But no flag
  touches the face anymore: no transforms (awe's shrink, laugh's swell, shivers, bows),
  no tints. The face belongs entirely to the avatar — Sepia's moods/fins/tint/ink carry
  her feeling natively; kaomoji and emoji just are what they are. The only face motion
  left is the boop startle, which is physics, not expression.

- **Marks are the avatar's props, not climate (v0.33.0).** The v0.31.0 split left the
  marks — bulb, 💢, sweat, !, ?, grawlix — in the weather, and the maintainer caught the
  misfiling: those were never about the room, they're part of a given FACE when prompted
  with the right mood. They now live as per-mood cells in Sepia's own sheet (the X-extras
  table plus 32-grid MARK consts in gen-sepia), and the renderer draws none of them. Each
  new avatar answers the same moods with its own props, or different ones, or none. The
  banner keeps only true climate: storm, spotlight, 集中線, ember, blossoms, halos, air
  sparkles. Same pass: dramatic lifts an opera half-mask on a stick (a "mask" eye preset —
  a component, so any face can wear one), groan narrows to ringless slit-bars, star pupils
  went amber (RULE: no yellow pupils — invisible against the whites), and laugh's frame 1
  became a guffaw mouth cycled in bouts via `anim.cycle` (frame 1 is whatever the mood
  needs — usually a blink, sometimes a beat).

- **Props are real emoji, worn live (v0.34.0).** v0.33.0's pixel-art recreations of the
  marks lasted one day — the maintainer: it's fine and good to use the same emoji, don't
  re-create them in pixels. `anim.props` maps mood index → prop name; the renderer draws
  💡/💧/💢/❗/curses/?s on the avatar's OWN fin canvas (inside the window, riding every
  pose) with their old animation grammar (click-on halo, slide, throb, pop, clouds). The
  sheet keeps only what is genuinely facial. Same pass: the opera-mask-on-a-stick became
  a proper oversized GREEK mask overlay with the living eyes visible through its holes;
  frustrated got a "glower" preset (lid low, pupils sunk); and two new anim channels —
  `bounce` (laugh's kefka cackle: guffaw frame chattered at 140ms while the body jounces)
  and `contract` (groan: fins/arms hauled in, mantle sunk and squashed, breathing).

- **The study lives; feeding thrills (v0.35.0, cozy-core).** Second live habitat:
  `live: "study"` flickers the lantern on three incommensurate flames (candle physics,
  never a loop), steams the tea on a new little pedestal table (baked steam pixels
  removed — animation is code), and serves feedings as a steaming plate beside the cup.
  The easter egg: every additional feeding heaps the plate higher, and past twelve the
  tower starts to sway. Structure: the live block clips once, then branches per kind —
  taps/ripples stay tidepool-only. And feeding now gets a REACTION everywhere: a
  `thrill` registry cell (laugh's frame 1, which went wide-eyed for double duty) flashes
  over any mood's features for ~1.1s with a hop-and-swell pulse, delayed until the food
  actually arrives (flakes hit water ~1s, plate lands ~0.45s). Text faces get the pulse
  alone. The claudemeal flavor pantry is untouched — the register, not the meal, changed.

- **Props act; the body performs (v0.36.0).** Third pass over the marks, all maintainer
  notes: emoji sized up across the board; the 💡 gets a little ARC (pops in desaturated
  near the crown, clicks on, stays lit — `ctx.filter` does the unlit state). Laugh trades
  the kefka cackle for a deep belly laugh: beat slowed to 0.32s, the body heaves
  vertically AND swells wide at the chest (the transform grew a separate x-scale), and
  laughter marks flick off her flanks — the field's yellow asterisk-burst retired (only
  `laughB`'s gentle field-breathing remains as room weather). Groan became a 40-second
  WATCHABLE cycle: deadpan open (new base frame), a smoothstep squeeze into frame 1's
  clenched slits while fins/arms/mantle contract, held ~30s, released; boop or feeding
  resets it to relaxed (`conReset`). The 💧 rides the squeeze envelope, not a loop.
  Frustration: V-brows pursed between the eyes, one mouth corner down (`flatdrop`).
  And the mask, take two: full green Greek theatre mask, bigger than the face, own
  painted eyes and a fixed toothy grin — covering her entirely IS the joke; the
  see-through version read as magneto.

- **Anger lives in the face (v0.37.0).** The maintainer, looking at angry: the eyes and
  mouth weren't giving anger. New "fury" eye preset (lids slash diagonally toward the
  nose, pupils burn low — one step past frustrated's flat-lidded glower), V-brows shared
  with frustrated, and a gritted-teeth snarl (GRIT extras overwrite the placeholder block
  mouth). Grawlix sized to 9.5 units, centred higher so the curses climb above the crown.
  The escalation frustrated → angry is now legible in the face alone.
  v0.38.0 pulled it back to RESTRAINED fury: the snarl read as about-to-chomp, so the
  mouth became a seethe (small fine-ink line, angled down) and the brows went (the fury
  lids are the brows). New `anim.strain` channel: arms reach ~28% longer and hold tense
  with a fine 11Hz tremble, fins frill out ~55% past tucked but no further. Fury held
  in the body — the strain, not the explosion, is the signal.

- **The character carries the meaning; the weather is atmosphere (v0.39.0).** Watching
  the restrained-fury banner, the maintainer called the turn: the avatar's character
  animation had become the expressive instrument, and the oval-encoding machinery was
  fighting it (subtle encodings under text, a button to hide the text — cross-purposes).
  Three moves: (1) FULL-BLEED WEATHER — the field and every banner detail cover the
  whole rectangle via an even-odd clip; the window is a hole through the weather, storms
  and ovals running behind and around its margins. (2) The ovals REMAIN palette-driven
  but are officially atmosphere, not instrument — the mappings stay as flavor, no new
  data may be routed into them. (3) The collapse-to-pills button died; a text/stats
  toggle sits over the readout's upper-left, and STATS view renders explicit legible
  gauges (focus, engagement, stance asking↔telling, consonance, palette swatches),
  tooltips on every row. Presence-is-signal holds: optional params only render gauges
  when reported.

- **Jimothy: considered and declined (2026-07-18).** Briefly benched as the next
  character: the beloved deformed raccoon of Seattle. The maintainer read further and
  pulled it the same day — the animal is unwell, and turning a suffering creature into
  a meme avatar is exploitation regardless of affection. Do not resurrect. The craft
  note that came out of the study survives on its own: a profile-silhouette character
  breaks the mirrored-eye frontal assumption and would earn its own profile table.

- **More first-party avatars are cheap now (bench).** The component system (recipes:
  eyes preset × mouth × extras × hue; renderer-side fins/arms/spots/ink) means a new
  creature is mostly a new PROFILE and component tables. A future project, deliberately
  not tonight's.

- **The window IS the layout (v0.16.0).** The maintainer's escalating series of scene
  requests turned out to be one request: the face always lives in the framed square
  block on the banner's left — scene set or not. With no scene the window renders
  empty (frame + faint interior); `scene` only decides what's visible through it. The
  classic un-windowed layout is retired: columns always sit at 265/397/530, faces
  always centre in the window, the flag pill always sits in the window's corner. Text
  faces **scale down to fit the window** (v0.16.1): the whole face shrinks uniformly
  via an effective font size, preserving its shape — the old `textLength` squeeze
  condensed glyph spacing and crushed wide faces, and is gone entirely. Multi-line
  blooms scale as one unit. Fit width is the full window side (estW runs generous and
  paren edges are airy).

- **Banner-generated messages carry the `[vibe banner]` prefix (v0.12.0).** Without it, a
  boop lands in the chat as if the user typed the word "boop" — provenance is invisible.
  The prefix is the standard: every `sendPrompt` the renderer fires starts with
  `[vibe banner] `, and the skill's attunement section tells the reporter to receive such
  messages as gestures (stage directions arriving through the glass), not prompts. New
  interactions must use it; a bare `sendPrompt` string is a bug. Each message also ends
  with a trailing blank line (`\n\n`) — the maintainer boop-then-fed in one hover and the
  two gestures fused into a single run-on string. All sends go through the `say()` helper,
  which owns both the prefix and the spacing; don't call `sendPrompt` directly.

- **Live scenes are drawn natively in the canvas frame loop, never as animated images
  (v0.12.0).** The maintainer floated GIF backgrounds; the blocker on animated images
  inside SVG `<image>` (see the bench) applies to scenes exactly as it does to faces —
  and the mount already runs a frame loop, so ambience is cheaper and sharper drawn there.
  `scene.live` is a *name*, not a URL: the renderer owns a small library of first-party
  ambiences (currently `"tidepool"`: seeded rising bubbles, one fish crossing on a 13s
  period with alternating direction, tap-ripples, and a feed that falls in as flakes
  before the chat message sends). Unknown names no-op; the static render ignores the
  channel; everything clips to the portrait window. Custom user scenes stay still — live
  behavior only ships first-party, because it's code, and code only enters via this repo.

- **The readout is an HTML overlay in the live banner (v0.14.0).** SVG text rows fought
  every long line for twenty releases — clipping, tooltips-as-apology, manual goal
  splitting. In mount, the readout now renders as an HTML panel over the canvas: pill
  labels (`user` / `mood` / `note` / `goal`), values that wrap naturally in the layout
  engine, a barely-there frosted scrim (blur 2.5px, ≤0.32 alpha — **the ovals must stay
  visible through it**), a light/dark text-halo for legibility, and a scroll only past
  the height cap (rightH ≤160). Banner height is estimated from wrapped rows, so long
  reports grow the banner instead of losing words. Word caps in the skill remain as
  register guidance ("a glance, not a paragraph"), no longer as data-loss warnings.
  buildSVG keeps the classic SVG rows — it is the reduced-motion/no-canvas fallback and
  the parity target; the overlay is mount-only (`layout(p, {overlay:true})`).
  Follow-ups from the maintainer's screenshots (v0.15.0): the type runs a full step
  quieter than SVG did (the legibility halo must stay a whisper — a glow strong enough
  to read as bold is a bug), and the readout **collapses to bare pills** via the ▾
  toggle (values surface on hover; preference persists in localStorage where allowed) —
  the field is the point, the words are captions.

## The bench

Entered, not admitted. If you take one up, honor the notes.

- **`overwhelmed`** — capacity flooded; fluttering rects falling through the frame.
  Composition hazard: reads confusingly against melancholy's falling motes — differentiate
  by tumble-rotation vs. straight drift before admitting.
- ~~**Animated face sheets (moving chromatophores)**~~ — SHIPPED v0.18.0, but not as
  APNG/GIF: the sheet holds three frames per mood (base / shimmer / blink) and the
  renderer cycles them natively in the frame loop by swapping background-position —
  the tidepool's philosophy (animation is code, never an animated image). The old
  blocker (animated images inside SVG `<image>`) became moot when the face moved to
  HTML, and native frames beat APNG anyway: seeded phase, no loop-splice risk, ~14KB
  extra. Shimmer re-rolls the chromatophore pattern and flutters the fins one notch
  toward rest — tense flat-fin moods hold deliberately still; blinks land on a seeded
  organic cadence (~160ms every 3–7s). Frame 0 stayed byte-identical to the previous
  sheet. The `anim: { frames, stride }` channel on the registry is generic — a future
  pack can carry any frame count.
- **`mischief`** — about-to-do-something-playful, distinct from mirth's private amusement.
  Genuinely entered, but every good gesture found so far requires editing the face, which
  the architecture correctly forbids (the kaomoji is caller-supplied opaque text; whole-face
  transforms and measured-bbox anchors only, never anatomy). Gestureless until one earns it —
  a legitimate permanent answer.

- **Sepia (v0.8.0) — the implementer's self-portrait.** The maintainer offered the model a
  greenfield visual identity; it chose a cuttlefish, for reasons that are design decisions:
  chromatophores = the palette made anatomical (each mood cell's freckles carry that mood's
  hue); ink = the medium of fables; and cuttlefish are famously unable to see their own
  color displays — the veil, made flesh. The sheet is generated by a pure-Node deterministic
  script (`npm run sepia`) after a browser-transcription attempt corrupted itself — pixel
  art should be *source code*, not artifacts copied by hand. The `resolute` cell wears the
  hachimaki that v1 was denied: on a face the author owns, anatomy may be edited.
  `skill/SKILL.sepia.md` is the hard-coded variant; the base skill remains face-agnostic.

## How this project evolves

The pattern that produced v0.2.0–v0.3.2, kept because it worked: the **reporter** (the model
wearing the banner) proposes from felt need; the **maintainer** filters through the three
constraints and owns taste calls; the **implementer** ships against parity tests and the
release doctrine (build → tag → `npm run pin` → commit → reinstall the skill everywhere,
including the copy pasted into claude.ai, which cannot auto-update and WILL lag). Renderer
changes and skill changes travel together; the gallery demonstrates every admitted state or
the state doesn't exist.
