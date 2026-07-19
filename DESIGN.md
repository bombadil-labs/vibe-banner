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

- **The flat-Sepia bug (v0.39.5→v0.39.7): `var cv` shadowed the canvas.** The stats
  view's consonance row declared `var cv = num(p.consonance, 1)` inside mount() —
  function scoping made it a REASSIGNMENT of the canvas variable. fit() set .width on a
  number (silent no-op), every frame read .isConnected off a number (undefined → the
  detach branch), and every banner shipped as pure CSS: body and panels alive, all live
  layers dead. Found only after the maintainer reported it three times and the renderer
  was finally run in a REAL browser with instrumentation — two prior in-context theories
  (host clone-detach, rAF starvation) were plausible, produced useful hardening (the
  remount marker; the watchdog interval, which the repro host genuinely needed: rAF
  never fired there and the interval drove the loop), but were not the bug. Lessons:
  short names in a 1700-line closure are landmines; and render-path regressions cannot
  be caught by the node-side parity suite — verify live changes in an actual browser
  before shipping (the Browser-pane repro server pattern works).

- **vibe-banner: the rename, and why the CDN survived it (v0.41.0).** The project became
  `vibe-banner` — repo, skill, package. Every deployed SKILL.md pins jsDelivr URLs under
  the OLD repo name, so this looked like it would break every banner in the wild. It
  does not: GitHub redirects renamed repos and jsDelivr follows, verified by fetching
  uncached old-name paths immediately after the rename (200). The standing hazard is
  narrow but real — if anyone ever creates a new `vibe-annotation-renderer` under the
  org, the redirect dies and old skills 404. Never reuse the old name.

- **The readout is a list; every face speaks one vocabulary (v0.41.0).** Two contract
  changes, both the maintainer's read that a good default had been mistaken for a law.
  (1) `seems/feel/trying/noticing` become `readout: [{label, value}, …]` — up to five
  rows with any labels a skill defines. The four originals are the default and the
  legacy keys still map onto them, so nothing deployed breaks. Known labels keep their
  typographic voice; new ones take one by position. The ≤15/≤25-word caps are appended
  by the generator and cannot be edited away — they are data-loss warnings, not style.
  (2) The emoji packs took raw codepoints, so the face vocabulary changed SHAPE when you
  switched packs; now every pack resolves Sepia's 32 moods (audited all 32 against the
  animated set: only the musical note is absent, so rhyme borrows an upside-down face
  there). `consonance` → `coherence`, focus's emotional dual; both still accepted.

- **The builder has a spine (v0.41.0).** v2 made every section editable; that was wrong.
  Editable versions of the load-bearing parts — preamble, honesty contract, locked value
  bullets, flag vocabulary, loader snippet, attunement rules, settings desk — mostly
  produced WORSE skills, and the snippet in particular must never be hand-edited (it
  carries the pinned hash). v3 gives real controls to the four things that are genuinely
  personal (face, environment, cadence, text fields) and names the rest as fixed rather
  than hiding it. Cadence was rebuilt too: "only real shifts" retired, because between
  two turns the state has essentially always moved — it collapsed into "every turn"
  while sounding stricter. The honest axis is frequency. The Builder now runs the SAME
  generator functions the shipped skills do (serialised into skill-base.js as source),
  so there is no client-side mirror left to drift. The wrench hands users back to the
  builder and compares the skill's stamped version against the catalog's.

- **A still of a living thing is a lie about it (v0.41.1).** The Builder previewed faces
  as sprite crops from the sheet — body plus features, no live layer — which is exactly
  what a BROKEN render looks like: Sepia with no fins, no arms, no drifting colour. The
  maintainer spotted it as the bug it resembled. Fix: the face station mounts a REAL
  banner and flips moods inside it. Rule going forward: never preview a live avatar with
  a still frame; if the preview cannot move, it is misrepresenting the product.
  (The small narrator chips beside each station are still sheet crops, because there is
  no standalone avatar API to mount at 42px — which is one more argument for extracting
  the avatar layer.)

- **The hidden-mount bug (v0.41.1).** Chasing the preview turned up a real renderer
  fault: mounting inside a hidden container (a lazy tab, an accordion, a closed
  `<details>`) measures 0, `fit()` bails, and the ResizeObserver does NOT reliably fire
  on the unhide — so the banner stayed at the canvas default of 300×150, stretched by
  CSS, blurry forever. The frame loop now re-fits whenever the backing store stops
  matching the box: the same self-healing instinct as the rAF watchdog. Verified failing
  before and healing after, in a browser — this class of bug is invisible to the
  node-side parity suite.

- **Not every dead banner is a bug.** While investigating the above, the Explorer's
  banner appeared stone dead — zero ink on every canvas, zero rAF calls. It was correct:
  the mount sat below the fold and the IntersectionObserver was pausing it on purpose.
  Scrolling it into view showed all three canvases sizing and animating. Worth recording
  because the symptom is indistinguishable from the flat-Sepia bug: check `inViewport`
  before diagnosing a dead loop.

- **Two keys: avatar and details (v0.42.0).** The payload had grown a flat sprawl of
  fifteen sibling keys where two different things were mixed: WHO you are and WHERE you
  are, versus everything the banner says BESIDE you. The maintainer named the cut. Now
  `avatar` (face + scene) and `details` (readout, palette, focus, engagement, stance,
  coherence, flag, languages), and an absent or empty `details` renders the window alone
  as a 156×152 square tile — no field, no readout, no weather, since a flag is a detail.
  `scene` moved inside `avatar` because where you are is part of who you are, not a fact
  about you. Implementation is a `normalize()` at the head of `layout()` that maps the
  nested form onto the existing internals, plus a per-layout `L.W` shadowing the module
  width inside both renderers — so one line changes the banner's whole geometry. The flat
  form is untouched and parity asserts it, because every deployed skill still emits it.

- **The site is four tabs.** Installation folded into Build and install (v0.41.3) and
  What it means was retired (v0.42.0): its prose legend duplicated what the Gallery
  demonstrates live and what the Explorer now lets you manipulate directly, and a legend
  competing with a working example loses. Documentation that can be an interactive
  surface should be one. What survived: the standalone-library example, which moved to
  Build and install — the tab someone is already on when they want it.

- **Motes, and the procedural face kind (v0.44.0).** The siphonophore died because a
  distributed creature still needed a legible ANATOMY at 64px. The maintainer kept the
  soul and threw out the body: a swarm of glowing motes, which has no silhouette to get
  wrong. That forced the general affordance this project needed anyway — a face may be
  PROCEDURAL. Sepia and Kip are spritesheets (art, hash-pinned, birth-SHA rotated on
  every redraw); Motes resolves to `{ proc: "motes" }` and the renderer hands it a canvas.
  It ships ZERO BYTES of art. The static path evaluates the same formation at t=0 and
  emits circles, so one source of truth serves both renders.

- **Flight paths (v0.45.0) — the maintainer's model, and better than mine.** v0.44 had
  nine hardcoded formations in a switch. The maintainer proposed paths: a curve the motes
  trace, with a share of the swarm, an alignment, a clustering. Every one of my nine
  formations turned out to BE that primitive wearing different numbers. The full spec:
  `p` (ring/arc/line/point/spiral), `share` (may sum below 1 — the remainder drift free,
  which reads as a creature not entirely made up yet), `align` (0 suggesting → 1 locked),
  `cluster` (0 spread along the curve → 1 converged on one point of it), `flow` (speed
  ALONG the curve, which is what makes a path a *flight*), `spin`. Because paths compose,
  a face is three of them — two rings and an arc — so a smile is a temporary flight path
  rather than a special case: the `flash` field swaps a path set in briefly and lets it
  go. A face that keeps almost-happening. `align` drives the physics directly (spring
  constant up, wander down), so it is genuinely independent of shape.

- **Weather replaces flags (v0.44.0).** Twenty flag names, most of them EMOTIONS — and
  emotion is the avatar's job now that avatars are properly expressive. What a banner can
  say that a face cannot is what the ROOM is doing. Seven remain, named for the
  phenomenon: `storm · spotlight · hush · fog · glow · bloom · converge`. Retired with the
  other thirteen: excited sparkles, the surprised halo, melancholy motes, mirth bubbles,
  the laugh field-bounce, groan's sag, oops's jolt, frustrated's red pulse, the rhyme
  echo, and the vertigo droste. Each duplicated avatar expression. The last two were the
  hardest to lose and are worth remembering as good ideas that stopped fitting.

- **Hash-pinning IS the compatibility story (v0.45.0).** v0.44 shipped an alias table so
  old flag names resolved to their weather. The maintainer pointed out it was pointless:
  every deployed skill pins a full commit SHA, so an old skill loads OLD RENDERER BYTES
  and never meets a new vocabulary at all. Backwards compatibility is structurally
  unnecessary here — a quiet dividend of the supply-chain discipline. The alias table is
  gone; retired names are simply ignored. Where a translation is genuinely wanted (the
  gallery, mapping each demo's state to a weather) it lives in the demo data, not the
  renderer.

- **"Almost all of these reduce to spinning circles" (v0.46.0).** The maintainer counted what
  I had not: twenty of thirty-two Motes moods were a ring with different numbers on it. Not a
  style — I kept reaching for the primitive I had already built, which is the failure mode of
  a good primitive. The fix was more SHAPES, not more parameters: a `poly` path type that
  walks a point list by ARC LENGTH (so motes space evenly along a letterform, not per vertex),
  a Gerono lemniscate for a true closed figure-eight, and glyph outlines the swarm can spell.
  Ring-only-and-static went 20 → 9, and the nine that remain — neutral, at_peace, awe, angry,
  anxious, booped — are moods where a circling swarm is genuinely the right answer.

- **The stray mote was a bug, not a flourish (v0.46.0).** The maintainer described "one more
  shooting off and back at one end" of the straight-line moods, and called it distracting on
  `solemn`. It was a wrap: `u = (u + t*flow) % 1` is seamless on a closed ring but on an OPEN
  path u=1 is the far end and u=0 the near one, so each cycle teleported a mote the length of
  the line and the spring dragged it visibly back across. Open paths now ping-pong on a
  triangle wave. Measured worst single-frame step over the line moods: 140px → 0.47px at
  R=100. Closedness is derived (`ring`/`infinity` closed, `line`/`poly`/`spiral` open, `arc`
  closed only if it spans nearly a full turn) with an explicit override.

- **A rainbow is a frown (v0.46.0).** `mirth` was built as an arch — I was thinking fountain,
  or literally rainbow. But an arch bulges UP, and a mouth that bulges up is a frown; the
  maintainer read it instantly and correctly. Four moods had it (`mirth`, `delighted`,
  `laugh`, `excited`), all sweeping a0≈3.3→a1≈6.1 with the centre below. Flipped to a
  downward bowl. Guarded by a test that sorts motes by x and asserts the middle sits BELOW
  the ends, so no future arc can quietly become a frown again.

- **Marks the swarm can spell, as flashes rather than poses (v0.46.0).** The maintainer asked
  for a question mark and an exclamation point, and — importantly — for shapes that "turn on
  and turn off so the motes periodically assemble into it then diffuse again." That last part
  is what makes them work: as a standing shape a punctuation mark is a logo, but as a `flash`
  it is a gesture. `puzzled` gathers into a `?` and lets go; `surprised` snaps to a `!`;
  `oops` throws a lightning bolt. `rhyme` took the figure-eight, which is the right shape for
  a thing that comes back around.

- **`working`, and packs that outlive their art (v0.46.0).** The maintainer noticed the
  vocabulary had no word for sustained effort — "Claude Code would use it a lot" — which is
  true and was a real gap: `focused` is attention narrow, `resolute` is determination, and
  neither is the experience of grinding at something. Motes renders it as a genuine loader
  via a third movement mode: `seq` walks a list of path sets, holding each a couple of
  seconds and scattering between, so it NEVER settles. That is the point — effort visibly
  ongoing rather than a pose of effort. Adding a 33rd mood would have meant regenerating
  Sepia's 32-cell sheet, so instead `MOOD_FALLBACK` lets a pack whose art predates a mood
  borrow its nearest neighbour. The vocabulary can now grow without every pack redrawing.

- **`palette` is not a detail (v0.46.0).** It had lived inside `details` since the beginning,
  from back when the field of colour was the only thing it touched. Sepia's chromatophores
  broke that, and Motes settled it — the maintainer's call: "having the palette inform the
  whole banner rather than living in the optional details is going to have to be the norm."
  It now sits at the top level beside `avatar`, and crucially does NOT widen the tile: a
  details-free square with a palette is a complete, coloured thing. A palette found in
  `details` is still honoured, because punishing the old shape would be pointless — but it no
  longer forces the wide layout.

- **The sequencer had to tween (v0.47.0).** The maintainer asked whether shapes shouldn't
  transition smoothly, and they were right that it wasn't happening. The subtle part is WHY it
  looked half-right: the motes are spring-driven, so a hard target swap already produces
  motion — but it is 64 springs racing independently toward new stations, which reads as a
  scramble rather than a change of shape. The fix belongs one level up, at the target rather
  than the spring. A mood's movement now resolves to a PLAN — two path sets and a blend
  factor — and never to a bare set. The target is the lerp of both, so the swarm morphs as one
  body, each mote walking a smooth line from its old station to its new one. `align` eases
  across the seam too, so the grip loosens in transit and firms up on arrival.
  Applied to `flash` as well as `seq`, which is what makes gathering into a question mark
  actually look like gathering. Measured: no mood's target moves more than 8px per frame at
  R=100, where a hard swap stepped ~150px. `seq` reads as reach-hold-release: gather 0.77s,
  hold 0.86s, let go into the scatter, gather the next.
  One consequence worth recording: the static tile can no longer sample t=0, because at zero
  every seq mood is mid-gather and every flash mood is mid-reach. `MOTE_STILL_T = 0.9` is
  chosen so the flashes sit at full reach and a seq sits mid-hold — a still frame should show
  a shape, not a blur between two.

- **Named environments, and the bug hiding behind the wart (v0.48.0).** The maintainer
  reported two things that turned out to be one: the environment wasn't getting set from a
  deployed skill, and the API looked wrong — "do we really need to specify a whole path for a
  png? Can't I just say tidepool and the JS engine knows what to do?"
  The wart first: yes, and now it does. `scene: "tidepool"` is the whole call. The renderer
  owns the URL, the pin, the opacity and whether the place is alive, because none of that is
  the reporter's business. A bare word is read as a NAME and only a url-shaped string as a
  url, so a mistyped name empties the window rather than requesting an image called
  "tidepool". `{ name, opacity }` keeps the name when you want to override the level.
  The bug was worse and the wart was pointing right at it: `gen-skills` assembled every
  shipped skill with `assemble(face, {})` — an empty options object — so **no stock skill ever
  contained a scene at all**. Not a wrong URL: no scene key. The environment could not be set
  from a shipped skill however the reporter tried. Every variant now names a home (Sepia her
  tidepool, Motes the dark, the rest a lamplit study), and a test asserts that no shipped
  skill lacks a scene and that none contains a hand-copyable 40-char sha.
  The general lesson: a payload field that is long, opaque and mandatory-looking is not just
  ugly — it is a field that silently doesn't get filled in. The awkwardness was the symptom
  and the empty window was the disease.

- **The skill files are gone (v0.49.0).** The maintainer's call, and the v0.48.0 bug is the
  argument for it: five `skill/SKILL*.md` files sat in the repo, each generated, each with its
  own pin to stamp and its own row in the docs, and every one of them shipped without an
  environment for months because a generated artifact is exactly the thing nobody reads. A
  checked-in copy of a composed thing is not a convenience, it is a second source of truth
  that drifts silently and looks authoritative while doing it.
  The Builder is now the only place the skill exists, plus `scripts/compose-skill.js` running
  the same generator for the terminal (`npm run skill:install` writes Sepia-in-her-tidepool
  straight to `~/.claude/skills/`). Two things had to move to make deletion safe rather than
  merely tidy:
  - **The pin.** `npm run pin` used to stamp the emitted files; with no files, the composer
    resolves its own sha by the same rule (last commit touching `dist/`) and refuses loudly
    if it comes out as the placeholder. A skill that loads nothing is worse than no skill.
  - **The guarantees.** The v0.48.0 tests read the files on disk. They now compose in memory
    via the exported `assemble()` and assert the same properties, so the protection follows
    the generator instead of the artifact — which is where it should have been.
  One more hazard closed while here: the Builder defaulted to `scene: "none"`, which is how
  the sceneless skills got written in the first place. It now opens in a home and follows the
  face's home when you switch faces, until you pick one yourself — after which it stops
  second-guessing you. An unmade choice should not render as a considered one.

- **The site now eats its own dog food (v0.49.1).** v0.48.0 taught `scene: "tidepool"` in the
  docs while every one of the site's own five mount sites — hero, gallery, both Builder
  previews, Explorer — kept building `{ url, opacity, live }` by hand from the SCENES table.
  The maintainer caught it: the "use it as a library" script was still on the old form. That
  is worse than an inconsistency, because the page is the most-read example of the API and it
  was demonstrating the shape the release existed to replace. One `sceneArg(name, opt)` helper
  now feeds all five: a NAME when the environment is first-party, the long form only for a
  custom image that has no name to use, `null` for unknown. Every preview on the page
  therefore exercises name-resolution on every mount, so that path is covered by simply
  looking at the site rather than only by the tests.
  Found while there: the Explorer's "strip the sha before displaying the payload" guard read
  `shown.scene`, but the scene has lived under `avatar` since v0.42.0 — it had been a no-op
  for seven releases and only stopped mattering because names carry no sha.

- **The skill stopped explaining how it renders (v0.50.0).** The maintainer hand-trimmed a
  generated skill and sent it back as the spec, with the rule stated plainly: *the reporter
  doesn't need the details of how it's going to render.* Their cuts had one shape — every
  sentence describing the PICTURE went, every sentence describing the READING stayed. Motes'
  paragraph about flight paths and question marks; the palette bullet naming Sepia's
  chromatophores; "the lines beside your face, in order." None of it changes a value the
  reporter emits, and all of it invites chasing the picture, which is the exact failure the
  veil exists to prevent. Explaining the render is a small, constant tax on the honesty
  contract.
  Also from their pass: American spellings throughout, `2–4 words` softened to "a few words or
  a short phrase" (a count invites counting), and the duplicated `palette` lead-in dropped —
  v0.48.0 scaffolding that restated the bullet directly beneath it.
  Carrying the rule further, as asked: the snippet's per-element rationale (why the script is
  injected, what `onerror` and `min-height` do) collapsed to "paste it as-is, every part is
  load-bearing" — the reporter must not restructure it, but *why* is the tool's business. The
  `[Reasoned in]:` trace, and the claudemeal aside's staging (flakes on water, a heaping plate)
  went the same way; the flavor-from-your-own-palette line stayed, because that one changes how
  the gesture is received.
  One genuine bug surfaced under the cut: the palette bullet described Sepia's chromatophores
  **in the Motes skill**, and Sepia's face bullet still named `flag`, a key retired in v0.44.0.
  A shared block that names one pack's rendering is wrong in every other file it lands in.
  The kaomoji escape hatch is now conditional rather than blanket — it earns its space only
  where a pack's vocabulary is PARTIAL (Kip's eight moods, a custom pack) and can genuinely
  fail to fit the moment. A full-vocabulary pack always has a mood, which is why the paragraph
  read as cuttable in Motes. Net: 1919 → 1599 words, and nothing removed that a reporter uses.

- **The window caption names the MOOD now (v0.51.0).** It was built to name the active flag,
  on the argument that twenty flag gestures had outgrown unaided recognition. The maintainer's
  observation retires that: flags became seven weathers, and the label would be better spent on
  the face. The original argument in fact applies far harder to the face than it ever did to
  the weather — there are 33 moods, they fire on EVERY banner rather than rarely, and a
  formation of motes or a cuttlefish at 64px is genuinely hard to name. Weather is seven, rare,
  and visually unmistakable; it does not need naming, and with a mood caption present it would
  be competing for the same corner.
  Only a pack whose items ARE moods gets a caption. A kaomoji already names itself, an
  arbitrary image URL has no mood to report, and a raw twemoji codepoint is not a mood name.
  Two judgement calls worth recording, since neither was specified:
  - **Not on a square tile.** That form is documented as the creature alone, deliberately
    without commentary, and a label is commentary however short. The caption is a banner
    affordance. (Kept the old behaviour, which fell out of flags being details; now explicit.)
  - **Mood wins over weather** when both are present, rather than showing both. One label, one
    job. If naming rare weather turns out to matter, the honest fix is a second affordance,
    not two things sharing a corner.

- **Kip becomes a crew member, and stepped motion is his whole character (v0.52.0).** He was
  eight hand-drawn cells in a single row with no generator and no animation. He is now
  generated (`scripts/gen-kip.js`), 33 moods x 2 frames, and — the part that matters — he does
  not move the way anything else here moves.
  The maintainer's framing did the design work: *8-bit, discrete state changes, a man out of
  phase with reality.* So the difference is STRUCTURAL, not decorative. Sepia is drawn on a
  32-grid; Kip is drawn on a SIXTEEN-grid at 4x scale, so he physically cannot hold a smooth
  curve. His clock is quantised to 6 steps a second and every offset rounds to a whole
  art-pixel: he arrives at each pose instead of travelling to it. Nothing about him
  interpolates, and a test asserts the frame is constant *within* a step so nothing ever can.
  Two frames alternating at a steady rate reads as a VIBRATION, not as animation. The fix is
  a per-mood beat pattern: `r` holds still six steps then twitches once (solemn, focused,
  at_peace), `c` holds three (the calm default), `b` alternates every step (delighted, laugh,
  working). Stillness is where the character lives; the off-beat only lands because most of
  the time nothing happens.
  Frame 1 had to differ STRUCTURALLY for every mood, not just the lively ones — v1 varied only
  the antenna star and he read as a static sprite with a blinking light. Standing Kip now
  squats a pixel with his feet planted (the classic 8-bit idle); hopping Kip leaves the ground
  entirely, feet and all.
  **The feet, answering the maintainer's question: yes, he needs them.** They were
  body-coloured and vanished against him. They are amber now — the one warm note on a cool
  creature — with the hem outline between, so they read at 56px. They earn it: discrete feet
  are what make a stepped hop legible as a HOP rather than as the whole sprite jittering, and
  a planted foot is what makes the idle squat read as weight rather than as drift.
  His props are drawn bigger and fully opaque (`propScale`, `propAlpha`), because at his
  resolution a faint prop is just noise on the sprite.
  One bug worth recording: he initially inherited Sepia's `working -> focused` fallback and
  silently drew the wrong cell for a mood he HAS art for. A fallback must be per-pack and
  tried only after a direct hit — it exists for art that has fallen behind, not as a lookup.

- **Twemoji and the custom-URL pack retired (v0.52.0).** The maintainer's call, and the right
  one: the project's own faces each carry an identity the renderer animates natively, and a
  borrowed emoji sheet could never do that. It was a still image with a mood name attached —
  no frames, no stepped clock, no chromatophores, nothing to say. Keeping it meant every
  vocabulary change had to be audited against a third party's art (which had already cost a
  release when `working` mapped to nothing and requested a 404). Three faces that are ours,
  each with a real mechanic, beats five where two are stubs.

- **`honesty`, and why the obvious objection doesn't sink it (v0.53.0).** The maintainer
  proposed it while naming its own weakness: a reporter minded to deceive would simply report
  1.00. True, and it doesn't matter, because deception is not the failure this catches. The
  common failure is saying a confident thing while knowing, somewhere, that it came out
  smoother than it was earned — glossing an unverified step, agreeing too easily, performing
  certainty because the format wanted an answer. That state IS introspectable in the moment,
  and having a designated place to put it is what makes it reportable at all. The maintainer's
  own framing — "as an autistic person I hate lying, and if asked directly whether I'm being
  honest I fold immediately" — is the mechanism exactly: the banner asks, every turn, so the
  user never has to. A pressure valve, and cheaper than the alternative of carrying it.
  It renders in the STATS view, which is the point: front of house says the thing, the back is
  where you can say what it cost. A reading below 0.6 marks the view toggle with a small dot,
  because a valve nobody can find is just a diary — but it is a dot, not a warning colour.
  **The limit, stated plainly in the skill and worth repeating here:** it is a self-report, not
  a certificate. It cannot catch confabulation the reporter doesn't know it is doing, which is
  exactly the dangerous case. If a user ever reads a high bar as clearance, the instrument has
  made things worse than no instrument. It is one more honest signal, subject to every limit
  the rest of the payload has.

- **`confidence` is the second attempt at a dead idea (v0.53.0).** `conviction` was benched
  long ago: reporting p(correct) is the thing LLMs are famously worst at, so the number becomes
  decoration. Rather than relitigate that, `confidence` asks a different question the reporter
  CAN answer — how GROUNDED is this? 0 is pattern-matched into place, 1 is checked and I could
  point at the check. Answerable in the moment, and externally checkable afterwards, which is
  the same test `stance` had to pass. It pairs with honesty on an orthogonal axis: confidence
  is the relationship between the answer and the evidence, honesty is the relationship between
  the answer and what the reporter actually thinks.

- **The ovals stopped earning examples (v0.53.0).** Three of the gallery's five groups existed
  to teach the field's mechanics — palette to columns, focus to spread, stance and coherence to
  edges. That was right when the ovals carried the signal. The avatar carries it now, and
  teaching atmosphere in depth tells a reader it matters. Cut to one group that shows all four
  at once and says plainly that they set a temperature, not a signal; the recovered space went
  to the new instruments.

- **The two-key payload never reached the mount (v0.53.0, found by accident).** `mount()` took
  the raw payload and only `layout()` normalised — so for the whole of mount, `p.focus`,
  `p.palette`, `p.stance` and `p.consonance` were undefined for any payload in the two-key
  shape every skill has emitted since v0.42.0. The stats gauges silently showed their defaults,
  stance and coherence never rendered at all, and Sepia's palette-driven mask tint never fired.
  Nothing threw; it just quietly showed the wrong numbers for eleven releases. Found only
  because two new gauges failed to appear and the defaults looked suspiciously round.
  The lesson is the one this file keeps relearning: a normaliser that isn't applied at every
  entry point is a normaliser that will be forgotten at one of them.

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
  The sepia variant is composed with `npm run skill -- sepia tidepool`; the base remains face-agnostic.

## How this project evolves

The pattern that produced v0.2.0–v0.3.2, kept because it worked: the **reporter** (the model
wearing the banner) proposes from felt need; the **maintainer** filters through the three
constraints and owns taste calls; the **implementer** ships against parity tests and the
release doctrine (build → tag → `npm run pin` → commit → reinstall the skill everywhere,
including the copy pasted into claude.ai, which cannot auto-update and WILL lag). Renderer
changes and skill changes travel together; the gallery demonstrates every admitted state or
the state doesn't exist.
