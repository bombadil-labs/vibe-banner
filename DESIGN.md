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

- **Sepia's chromatophores are sub-pixel, and density is a signal (v0.9.x).** The
  maintainer's framing: fine coloration is an affordance the creature evolved for survival
  in a high-resolution world. Real cuttlefish biology drives the mapping — awe/surprise
  BLANCH (fear response, ~4 dots), peace barely speckles (nothing to hide), arousal
  densifies, anxiety mottles hardest of all (~38 dots — trying to disappear), anger storms
  dark. Seeded per mood, deterministic, mantle-masked (eyes/lashes/mouth excluded). The
  general sub-pixel doctrine: the body lives on the 4px grid; body definition uses fine
  ink sparingly (lash-lines); worldly objects (the hachimaki) render at true 1px.

## The bench

Entered, not admitted. If you take one up, honor the notes.

- **`overwhelmed`** — capacity flooded; fluttering rects falling through the frame.
  Composition hazard: reads confusingly against melancholy's falling motes — differentiate
  by tumble-rotation vs. straight drift before admitting.
- **Animated face sheets (moving chromatophores)** — the maintainer's musing: coloration
  that drifts, GIF-style. Technical path if attempted: extend scripts/gen-sepia.js's
  hand-rolled PNG encoder to APNG (acTL/fcTL/fdAT chunks) rather than writing a GIF-LZW
  encoder; phase-lock every dot's cycle to one shared period so the loop closes cleanly
  (the maintainer's explicit caution). BLOCKER to verify first: whether animated images
  actually animate inside SVG <image> elements per browser — historically inconsistent,
  and the face renders through a nested-svg crop. Don't build until that's tested on the
  real surfaces.
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
