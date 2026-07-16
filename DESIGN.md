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

## Explicitly not features (recorded so they aren't re-derived)

- **Screenshots to the reporter.** Considered and retracted by the reporter itself: nobody
  sees their own face; the mirror is the corrupting technology. The veil stands.
- **The return channel** — the maintainer occasionally telling the reporter when a `seems`
  or `noticing` missed — is the highest-value addition found, costs zero code, and lives in
  practice rather than in this renderer. It also covers the veil's one real failure mode: a
  mapping drifting until the picture systematically says something the reporter doesn't mean.
- **Flag composition.** Grammar-level composition was removed deliberately when the roster
  hit twenty; see the API decision above. Don't reintroduce it as a feature.

## The bench

Entered, not admitted. If you take one up, honor the notes.

- **`overwhelmed`** — capacity flooded; fluttering rects falling through the frame.
  Composition hazard: reads confusingly against melancholy's falling motes — differentiate
  by tumble-rotation vs. straight drift before admitting.
- **`mischief`** — about-to-do-something-playful, distinct from mirth's private amusement.
  Genuinely entered, but every good gesture found so far requires editing the face, which
  the architecture correctly forbids (the kaomoji is caller-supplied opaque text; whole-face
  transforms and measured-bbox anchors only, never anatomy). Gestureless until one earns it —
  a legitimate permanent answer.

## How this project evolves

The pattern that produced v0.2.0–v0.3.2, kept because it worked: the **reporter** (the model
wearing the banner) proposes from felt need; the **maintainer** filters through the three
constraints and owns taste calls; the **implementer** ships against parity tests and the
release doctrine (build → tag → `npm run pin` → commit → reinstall the skill everywhere,
including the copy pasted into claude.ai, which cannot auto-update and WILL lag). Renderer
changes and skill changes travel together; the gallery demonstrates every admitted state or
the state doesn't exist.
