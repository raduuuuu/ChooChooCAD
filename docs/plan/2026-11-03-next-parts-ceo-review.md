# Next parts: decorative or not? (CEO review, 2026-11-03)

Owner: "review all the new features and tell me if you think we should add more
decorative parts". Mode: SELECTIVE EXPANSION (D1, owner's answer).

## What shipped (PRs #124-#131)

| PR | Feature |
|---|---|
| #124 | Measured tick; printable-model mark and MakerWorld link |
| #125 | Measured riser (RS) and tunnel with overpass (TO); estimated pier and tunnel retired |
| #126 | Ramp rise measured: 61mm |
| #127 | Stone arch bridge (SA): up-and-over road, arch in 3D, clearance sentence |
| #128 | Suspension bridge (SB), estimated: towers and cables |
| #129 | Riser in 3D: posts and a plate |
| #130 | Double crossing (HH), track support (TS), ramp origin and Q4 evidence |
| #131 | Harbour arch bridge (HB): raised road between portals, truss arch in 3D |

## Premise (0A)

The product answers one question: **will this layout actually work?** (README).
Every part earns its place by changing that answer: its ends (does it join),
its wood (does it clash), its height (does the train fit). Pure scenery (trees,
ponds, rocks) changes none of these; it moves the product toward a scenery
editor. A part that takes floor space next to the track, or limits the room a
train has, does change the answer, whatever it looks like.

Do-nothing cost: none for scenery. The owner's real gap is elsewhere: the
verdict still says "Raised track: supports are not checked", now that a
measured support exists.

## Existing leverage (0B)

- Floor-space parts: `BlockPart` with `body` footprints (TS, retired PR) and the
  overlap/ghostFit body checks (16mm2 body threshold).
- Room for the train: bridge clearance sentences (`BridgeClearance`, hump
  `clearanceMm`), ramp clearance note.
- 3D in the house style: body prisms with `profileMm`, `plate`, `trussArch`.
- Origins: `PART_ORIGINS` with MakerWorld links.

## Dream state (0C)

```
  CURRENT                          THIS PLAN                         12-MONTH IDEAL
  Track + 8 structures, each  -->  Decorated variants: a base   -->  Every popular printable piece in
  hand-built with one-off          part's track + decoration          the library, decorated like the
  3D fields; station is two        from shared shapes; station,       real one; any layout re-dressed
  estimated boxes                  level crossing, tunnel, bridge     by swapping; supports and room
                                   straights; swap; "works like"      for the train all checked
```

## 10x check (0G)

A decorated piece costs only its decoration: its joins and closure are a
part we've already measured and tested, so those cannot move. What it adds
is real wood: a platform or tunnel shell takes floor and room, and the
collision and clearance checks run on it like any other piece (outside
review, 2026-11-03: decoration that takes space can and should change the
verdict). Swapping re-dresses a built layout without touching its joins.

## Accepted scope

1. **Decorated variants (E5, D2).** A part that takes its track from a base
   part, unchanged (ends, lengths, joint give: for a straight its length and
   ends; for a multi-road piece its ports and roads), and adds decoration (3D)
   plus the floor and room it takes (collision bodies). Built-in only.
   - The base is a fixed built-in part id; a stored correction to the base
     never reaches its variants.
   - A variant is NOT a structure because it has bodies: it stays in the
     bridge, crossing and supports checks exactly as its base does (G1).
   - Its own bodies carry their own provenance: inheriting a measured track
     never makes an unmeasured shell look measured.
   - Every shape that takes space has a collision body, or a stated reason it
     has none (a thin barrier); a test pairs them (G3).
2. **Shared 3D shapes (E5).** A small vocabulary any decoration lists: slab,
   post, prism by profile, arch band, gable roof; drawn in the house matte
   (`--slab-side`, `--ink-soft` edges). Measured from a printable model,
   never the designer's mesh.
3. **First pieces (D5):** station straight (E2; ST stays until an elevated station is measured, D7), level
   crossing (E3), tunnel straight with its room over the train (E4), bridge
   straight: riser and harbour bridge moved onto variants, `plate` and
   `trussArch` folded into the shapes (E7, with F2 pending).
4. **Catalogue numbers (E6, D3)** only on verified matches.
5. **Swap (E8) and "works like" line (E9), D6.**
6. **Repairs:** R1, the stone arch and suspension tower 3D passes set the
   piece whose bounds they grow (checked by a test with two bridges in one
   layout: each piece's bounds hold only its own shapes); R2, the harbour
   bridge's room-underneath sentence and card wording, as the other bridges.

## Delivery sequence (0I)

```
  PR 1  R1 + R2 repairs                           human ~2h   / CC ~15min
  PR 2  variant model + shared shapes + tripwire  human ~2d   / CC ~1h
        + "works like" line; one piece to prove it (level crossing)
  PR 3  station straight (measure, decoration, footprint)    human ~1d / CC ~30min
  PR 4  tunnel straight + its clearance sentence  human ~1d   / CC ~30min
  PR 5  swap plain <-> decorated                  human ~4h   / CC ~20min
  PR 6  bridge straight: riser, HB onto variants  human ~1d   / CC ~40min
```

- Hour 1: the implementer needs the base-part rule (F2) and the triangle
  budget (F5) settled; both go to /plan-eng-review.
- Hours 2-3: what a decoration's footprint blocks (levels) and whether a
  variant may add bodies its base lacks (yes: the station's platform).
- Hours 4-5: surprises: share links with new ids (F4); the elevated station (F1).
- Hour 6+: they'll wish for the swap differential: every straight in the
  670 layouts swapped for a decorated version with the SAME joins, closure
  results identical; collisions re-checked, and the layouts whose verdict
  changes listed and each explained by a body.
- Each piece names its source model and measurement before its PR (station,
  level crossing and tunnel models chosen at PR time, measured off the 3MF,
  with a diagram for anything asked of the owner).
- PRs 3-6 depend on PR 2; none is stacked (each branches from main after
  PR 2 merges).

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| D1 owner | Review mode | - | SELECTIVE EXPANSION | approved | Owner's answer to D1 |
| E1 owner | Supports check using TS and the riser | "supports are not checked" note | Check raised track has a support within reach | deferred | Owner's answer to D4: "Defer to TODOS"; filed in docs/plan/generic-TODOS.md (needs a reach measurement first) |
| E2 owner | Station platforms (floor space beside track) | ST only (estimated, deck) | Station straight: a decorated variant with platform and building beside the track (ST kept, F1/D7) | approved | Owner's answer to D5 (all four picked) |
| E3 owner | Level crossings (track with a road) | none | Level crossing: a decorated straight with road and barriers | approved | Owner's answer to D5 (all four picked) |
| E4 owner | Tunnels and mountains (room for the train) | TO only | Tunnel straight: a decorated straight under a tunnel shell, with its room over the train stated | approved | Owner's answer to D5 (all four picked) |
| E6 owner | Catalogue part numbers on decorated variants (owner asked: "shall we use Brio part numbers?") | 9 parts already carry `partNumber`, shown in repair advice as "part 33334", brand never named | Set `partNumber` on a variant only when it matches a real catalogue piece, shown on its card, brand still unnamed | approved | Owner's answer to D3: "Only verified matches". Size and shape must match the real piece; never the nearest match |
| E7 owner | Bridge straight: riser and harbour bridge moved onto decorated variants, their one-off 3D fields folded into the shared shapes | `plate`, `trussArch` one-off fields | A raised straight + bridge decoration | approved | Owner's answer to D5 (all four picked) |
| E5 owner | Decorative = pieces that work like a standard part but carry decoration, like the real ones (owner: "rich details on a train station"; then "there are many pieces that although might functionally be just like another standard part, they have some decorations. Bridges are another example") | Each decorated piece is its own hand-built part with one-off 3D fields (plate, trussArch, hump.arch, towers) | Decorated variants: a standard part's track, unchanged, plus decoration from a shared 3D shape set and its footprint | approved | Owner's answer to D2: "1" (Decorated variants). Scope: the variant model and the shared shape set; which pieces is D5 |
| E8 owner | Swap a placed piece between plain and decorated | - | Selected-piece control offering the decorated versions of its base part, and back; layout and verdict unchanged | approved | Owner's answer to D6 |
| E9 owner | "Works like" line on decorated cards | - | Each decorated card names the plain part it behaves as | approved | Owner's answer to D6 |
| E10 owner | Hide decorations in 3D | - | 3D toggle | declined | Owner's answer to D6 (not picked) |
| E11 owner | Pull list grouped by base part | - | Grouped list | declined | Owner's answer to D6 (not picked) |
| F1 Section 1 | Station straight vs the elevated station ST (engine/data/structureSeeds.ts:38: ST is `deck: 1`, an ELEVATED station) | D5 text: the station straight "replaces the estimated ST" | ST is retired only if the measured station is itself elevated; a floor-level station straight is a new piece and ST stays until an elevated one is measured | approved | Owner's answer to D7: "Keep ST until measured". The floor station straight is a new piece; ST stays until a printable elevated station is measured |
| F2 Section 1 | What a raised "bridge straight" works like (E7) | Riser and HB lift their own road (`deck: 1`); no standard part does | Decorated variants may have a structure as their base (the riser's deck straight), not only a plain catalogue part; "works like" names that base | pending | For /plan-eng-review: base must be a part id in the library; deck pieces keep `deck` on the base |
| F3 Section 2 | Decoration out of step with its base | - | A tripwire test: every decorated part's ports, roads and slop equal its base part's, exactly | approved | Follows from D2 ("the track comes from the base, so the checks are unchanged") |
| F4 Section 4 | Shared and saved layouts after a swap | Saved layouts and share links store part ids | A swap changes a piece's part id only; an old link opened in a newer app resolves; a newer link in a cached older app shows its usual unknown-part handling | pending | /plan-eng-review to confirm the existing unknown-part path covers a decorated id |
| G1 outside review + spec review | `isStructure` is true for any part with a body (engine/src/parts/schema.ts:387); structures are left out of bridge, crossing and supports detection (engine/src/graph/solve.ts:235-252) | A decorated straight with a platform body would silently become a structure | Variants are classified by their base, not by having bodies | pending | /plan-eng-review owns the schema change; required before PR 2 |
| G2 outside review | Tunnel clearance needs more than one height | Bridges state one opening height | The tunnel records its opening width and usable height (track thickness included) and compares them with the train, or says train fit is unchecked | pending | Required before PR 4 |
| G3 outside review | Visible shapes and collision bodies authored separately can disagree | - | Each space-taking shape has a body or a stated exemption; paired fixtures | pending | Required before PR 2 |
| F5 Section 7 | 3D size of rich decoration | Bridges are a few hundred triangles each | A per-piece triangle budget (proposed 3,000) checked by test | pending | Needs an answer before implementation (eng review) |

## Review sections

**1. Architecture.**
```
  library.ts --resolve--> DecoratedPart{ base, decor[], body[] }
                            |                     |
             ports/roads/slop from base     shapes -> mesh.ts (3D only)
                            |                body  -> overlap / ghostFit
                       solve, verdict (unchanged)
```
WARNING F1 (ST is elevated; owner kept it, D7), F2 (base of a raised bridge,
pending eng). Coupling: decoration depends on the base part's id only.
Rollback: revert the PR; data-only parts.

**2. Error and rescue.** Data, not services. Failure modes: decoration
out of step with its base (F3 tripwire); base id missing (resolver must
refuse at load, test); shape with a bad profile (mesh guards non-finite).

**3. Security.** No new inputs: built-in data only; stored parts cannot
carry decoration (strip like `plate`). Origin links already open with
`rel="noopener"`. No issues found beyond that.

**4. Data flow and edges.** Swap on a selected piece: offered only between
variants of the same base id (same joins, enforced by test); keeps the
piece's identity and joints; undo restores it; nothing selected or no
variants: no swap shown. A one-sided decoration (a station platform) needs a
side choice that keeps its joins (design). RS and HB keep their ids when they
move onto variants, so saved layouts and share links still load (test).
Released ids are never removed on rollback. F4 covers new ids in older apps.

**5. Code quality.** Retire one-off 3D fields as they move onto shapes
(E7). Keep the shape set small: five shapes, added only when a piece needs one.

**6. Tests.** Tripwire F3; swap differential over the 670 layouts (verdicts
identical); each piece: footprint clash and clear, 3D height, origin link,
"works like" text; mutation recorded for every pin, as the project requires.

**7. Performance.** Rich decoration multiplies triangles: F5 pending.

**8. Observability.** Static client app; the verdict differential script is
the dashboard. No issues found.

**9. Deployment.** GitHub Pages, per-PR; each PR independent (no stacking).
Rollback is a revert.

**10. Trajectory.** Reversibility 4/5 (data-only parts; the variant form is
the one structural change). Platform: every future printable piece and the
supports check (deferred) reuse decorations' footprints.

**11. Design.** Cards: "works like" line under the name; decorated pieces
listed after their base part or in a Decorated group (pending, design).
Swap: one button on the selected-piece panel. Recommend /plan-design-review
before PR 2.

## NOT in scope

- Supports check: deferred to docs/plan/generic-TODOS.md (D4); needs the owner's reach measurement first.
- Pure scenery (trees, rocks, ponds): not what the owner means by decorative (clarification, 2026-11-03).
- Hide decorations in 3D, pull list by base part: not picked (D6).

## Approval readiness

PASS: D1-D7 answered and recorded in the ledger; D8 approved both documents
(this plan and the CEO summary). Pending rows (F2, F4, F5, G1, G2, G3, and the
station side choice) are implementation questions owned by /plan-eng-review
and /plan-design-review and gated before the PRs that need them; none is an
unresolved scope decision.

## Engineering review (2026-11-03)

Target: this plan (no branch diff on main; working tree holds only this plan
and the supports-check TODO). Report file: this plan.

### Scope record
feature answers: none (no cuts proposed); structure: A, Original arrangement
(owner's answer to eng D1); accepted scope: the CEO-approved scope, with the
shape set in a new engine/src/view3d/decor.ts and decorated pieces in a new
engine/data/decoratedSeeds.ts; pending remedies: G1, F2, G2, G3, F5, P1.
Scope Challenge result: scope accepted as-is.

### Findings (Scope Challenge)
1. [CRITICAL] (confidence: 9/10) engine/src/parts/schema.ts:387 —
   `p.kind === 'block' || p.body !== undefined || ...`: any part with a body is
   a structure, and engine/src/graph/solve.ts:242 `const structural = ... isStructure(...)`
   drops structures from bridge, crossing and supports detection; App.tsx:166
   drops them from the brand lists. A decorated straight with a platform body
   would silently leave those checks and its brand list. (G1)
2. [CRITICAL] (confidence: 8/10) engine/data/structureSeeds.ts:112-120, 309-319 —
   RS (58, `deck: 1`) and HB (216, `deck: 1`) lift their own road; no plain
   part in the library behaves like either, so "a raised straight + decoration"
   has no base to inherit from. (F2)
3. [INFORMATIONAL] (confidence: 8/10) app/src/layoutStore.ts:347,560 —
   `if (!knownPartIds.has(partId)) return { ok: false, reason: 'unknown-part', partId };`
   then "Your saved track used a part the library no longer has": a share link
   with a new decorated id opened in a cached older app is refused safely, but
   the wording says "no longer has" for a part it never had. (F4; TODO candidate)

## Decision ledger (engineering)

### G1: How decorated pieces are represented
Finding: 1, CRITICAL, 9/10, engine/src/parts/schema.ts:387 and engine/src/graph/solve.ts:242, native review + outside review (CEO phase)
Plan baseline: CEO D2 approved "decorated variants: a standard part's track, unchanged, plus decoration from a shared 3D shape set and its footprint"; mechanism unchosen
Runtime evidence: isStructure is true for any part with `body`; solve.ts:242 and App.tsx:166 are its only non-test readers [measured: git grep]
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| Where a variant is built | none | library.ts derives a full Part from base + decoration | new part kind 'decorated', unwrapped by each consumer |
| Collision boxes for decoration | none | separate `decorBody`, emitted by render with the bodies, not read by isStructure | `body` on the wrapper; isStructure taught to skip decorated kind |
| Structure classification | any body | base's own (unchanged rule) | unchanged rule + one exception |
| Consumers changed | - | library, render, mesh | every resolve/ports/render/solve caller |
| Tripwire: joins equal base | - | yes (F3, approved) | yes (F3, approved) |
Question D2:
D2 — G1: How should a decorated piece be represented in the code?
Project: ChooChooCAD main, decorated pieces plan (CEO D2).
ELI10: Today any part with floor space counts as a 'structure', and the app leaves structures out of the bridge and supports checks (schema.ts:387, solve.ts:242). A decorated straight with a platform would quietly fall out of those checks. Option A builds each decorated piece in the library as a normal part copied from its base, and keeps the decoration's floor space in its own field, which still blocks other track but doesn't make the piece a structure. Option B adds a new kind of part that every piece of code must unwrap.
Stakes if we pick wrong: B spreads 'is this decorated?' through the whole engine; a sloppy A lets decorated pieces escape checks.
Recommendation: A, because every consumer keeps seeing an ordinary part, and only the library, the renderer and the 3D builder learn about decoration (explicit, smallest surface).
Note: options differ in kind, not coverage — no completeness score.
Net: one derived part and one new field vs a new part kind everywhere.
Header: Variant model
Options:
A) Derived part (recommended)
library.ts builds each decorated piece from its base part plus decoration; its floor space goes in a separate decorBody field that blocks track but never makes it a structure. (human: ~1d / CC: ~30min) ✅ Solver, verdict and placement code unchanged ✅ Structure checks keep working for decorated straights ❌ Render must emit decorBody alongside body (one more field)
B) New part kind
A 'decorated' kind wrapping a base id and decoration; resolve, ports, render, solve and the app unwrap it. (human: ~3d / CC: ~1.5h) ✅ The wrapper is explicit in the data ✅ The base is never copied ❌ Every consumer learns a new kind; easy to miss one and break a check

State: approved
Actual answer: A) Derived part (owner's answer to eng D2)
Accepted scope: library.ts derives each decorated piece from its base part plus decoration; decoration's floor space in a separate `decorBody` field that render emits with the bodies and isStructure never reads; solver, verdict and placement unchanged; F3 tripwire (joins equal base)
History: none

### F2: The riser and harbour bridge under decorated pieces
Finding: 2, CRITICAL, 8/10, engine/data/structureSeeds.ts:112-120 and 309-319, native review + outside review (CEO phase, Codex #5)
Plan baseline: CEO D5 approved "bridge straight: riser and harbour bridge moved onto decorated variants, their one-off 3D fields folded into the shared shapes" (E7)
Runtime evidence: RS is 58 long, HB 216, both `deck: 1` (lift their own road); no plain library part behaves like either, so there is no base to derive from or swap to
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| RS, HB ids and structure behaviour | kept | kept | kept |
| `plate`, `trussArch` one-off fields | on StraightPart | replaced by decoration shapes on RS and HB | replaced by decoration shapes on new bases |
| Base part for RS/HB | none | none: they stay structures with decoration | two new hidden "raised straight" bases (58, 216) |
| Swap plain <-> decorated for RS/HB | none | not offered (no plain twin exists) | offered, to a raised straight no one owns |
Question D3:
D3 — F2: How should the riser and harbour bridge join the decorated-pieces work?
Project: ChooChooCAD main, decorated pieces plan (CEO D5, bridge straight).
ELI10: You approved moving the riser and harbour bridge onto decorated pieces. But a decorated piece needs a plain part it behaves like, and nothing plain behaves like these two: they lift their own road one level. Option A keeps them as the structures they are and just moves their 3D detail (the plate, the truss arch) onto the shared shapes. Option B invents hidden plain 'raised straights' for them to be variants of, so they could be swapped to a plain version that doesn't exist in real life.
Stakes if we pick wrong: B adds parts nobody owns and a swap to a fictional piece; A leaves them without a swap.
Recommendation: A, because the shared shapes are the real gain, and a swap target should be a piece you could actually buy or print.
Note: options differ in kind, not coverage — no completeness score.
Net: shared shapes without a fake base vs a swap to a piece that doesn't exist.
Header: Riser and HB
Options:
A) Shapes only (recommended)
RS and HB keep their ids and stay structures; their plate and truss arch become shared decoration shapes; no swap offered for them. (human: ~4h / CC: ~20min) ✅ No invented parts; saved layouts untouched ✅ Two one-off 3D fields retired ❌ No plain-to-decorated swap for these two
B) Invent raised bases
Add hidden 58mm and 216mm raised straights; RS and HB become their decorated variants with a swap. (human: ~1d / CC: ~40min) ✅ Swap works for them too ✅ Same model as other decorated pieces ❌ Swaps to a plain raised piece that doesn't exist in real life

State: approved
Actual answer: A) Shapes only (owner's answer to eng D3)
Accepted scope: RS and HB keep their ids and stay structures; `plate` and `trussArch` are replaced by shared decoration shapes on RS and HB; no swap offered for them. Narrows CEO E7 (bridge straight): no invented base parts
History: CEO E7 baseline "moved onto decorated variants" reopened because no plain part behaves like RS or HB (finding 2)

## Section 1: Architecture

Two shapes (design-twice): the shape module `decor.ts` is a new public surface.
- Shape A (chosen, G1): a decoration is a list of shapes in the part's own
  frame (`{ kind: 'slab' | 'post' | 'prism' | 'arch' | 'roof', ...measures }`);
  decor.ts turns one list into triangles and edges for mesh.ts. One function
  in, mesh out: deep module, small surface.
- Shape B: each shape a class with draw/bounds/collide methods registered in
  a table. Wider surface, more ways to extend, nothing needs them yet.
Pick: A, by interface depth.

```
  decoratedSeeds.ts --(base id + shapes)--> library.ts derive --> Part{...base, id, name, decor, decorBody, decoratedFrom}
                                                                     |            |          |
                                                     ports/roads/solve (base's)   |    render.ts emits decorBody as bodies
                                                                                  |          |
                                                                   mesh.ts -> decor.ts   overlap / ghostFit (unchanged)
```

Red flags screened: 8 (hand-synced list) applies to G3 below; none of the
others (the variant is derived once in library.ts; one owner for each field).

Findings:
4. [CRITICAL] (confidence: 8/10) plan "Accepted scope" item 1 — decoration
   shapes (3D) and `decorBody` (collisions) would be written separately for
   each piece: the same platform in two lists that can disagree (a roof drawn
   with no collision box, or an invisible blocker). (G3)
5. [INFORMATIONAL] (confidence: 8/10) engine/src/parts/schema.ts:613-617 —
   placement `turn` is ignored for straights, so a one-sided decoration (a
   station platform on one side) has no way to be placed on the other side.
   (P1)

### G3: Where a decoration's collision boxes come from
Finding: 4, CRITICAL, 8/10, plan Accepted scope item 1, native review + outside review (CEO phase, Codex #7)
Plan baseline: CEO G3 pending: "Each space-taking shape has a body or a stated exemption; paired fixtures"
Runtime evidence: today bodies are hand-written boxes (structureSeeds.ts) and 3D profiles ride on them (`profileMm`)
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| Source of decorBody | n/a | derived: each shape marked solid yields its bounding box(es); one list | hand-written next to the shapes |
| Exemptions (thin barrier, hanger) | n/a | shape marked `solid: false` | omitted from bodies by hand |
| Test | n/a | derivation test: every solid shape's footprint is covered | paired fixture per piece |
| Variant model (G1) | approved A | unchanged | unchanged |
Question D4:
D4 — G3: Where should a decoration's collision boxes come from?
Project: ChooChooCAD main, decorated pieces (eng G1: derived parts with decorBody).
ELI10: A decoration is drawn from shapes (platform, roof, walls) and also needs floor-space boxes so it blocks other track. If those are written as two separate lists, they can drift apart: a roof you can see that nothing collides with, or an invisible blocker. Option A derives the boxes from the shapes themselves, with thin parts like barrier arms marked as not solid. Option B writes both lists by hand and adds a test per piece that they match.
Stakes if we pick wrong: hand-written lists drift the first time someone edits one without the other, and the verdict lies about the space.
Recommendation: A, because one list can't disagree with itself; derive the second list rather than keep two in sync.
Completeness: A=9/10, B=7/10
Net: one source of truth vs two lists and a guard test.
Header: Collision boxes
Options:
A) Derive from shapes (recommended)
Each shape is solid unless marked otherwise; decorBody is computed from the solid shapes' boxes in library.ts. (human: ~4h / CC: ~20min) ✅ Drawing and collision can never disagree ✅ Each new piece writes one list, not two ❌ Box bounds are coarser than curved shapes (cautious, as bridges are today)
B) Hand-written + test
Shapes and boxes written separately per piece, with a paired test checking each solid shape is covered. (human: ~6h / CC: ~30min) ✅ Boxes can be shaped exactly by hand ✅ Familiar: how structures work today ❌ Two lists per piece; the test catches drift only where someone wrote one

State: approved
Actual answer: A) Derive from shapes (owner's answer to eng D4)
Accepted scope: every decoration shape is solid unless marked `solid: false`; library.ts computes `decorBody` from the solid shapes' boxes; a derivation test checks each solid shape's footprint is covered; no hand-written decorBody
History: none

### P1: Which side a one-sided decoration sits on
Finding: 5, INFORMATIONAL, 8/10, engine/src/parts/schema.ts:616 ("Which way a curve bends. Ignored for straights."), native review + outside review (CEO phase, Codex #6)
Plan baseline: CEO plan Section 4: "A one-sided decoration (a station platform) needs a side choice that keeps its joins (design)"; mechanism unchosen
Runtime evidence: Placement.turn is ignored for straights (schema.ts:616); multi-road parts already offer F through `flip` (schema.ts:537) when the mirror differs
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| How the side is chosen | none | the piece's turn: right mirrors the decoration across the road; F flips it while placing, as on switches | two library parts per piece (left and right) |
| Joins | base's | unchanged (a straight's mirror has the same ends) | unchanged |
| Library cards | - | one card per decorated piece | two cards per one-sided piece |
| Saved layouts | turn already stored | turn now matters for decorated straights only | new ids |
Question D5:
D5 — P1: How does someone put a station's platform on the other side of the track?
Project: ChooChooCAD main, decorated pieces (station straight, CEO D5).
ELI10: A station has its platform on one side. In a real layout you'd turn the piece round so the platform faces the other way. The app ignores 'turn' for straights today (schema.ts:616), so there's no way to say which side. Option A uses that existing turn for decorated straights: F flips the platform to the other side while placing, as it already flips switches, and the track's ends stay exactly where they were. Option B adds two library cards per one-sided piece, one per side.
Stakes if we pick wrong: platforms stuck on one side make the station unusable on half of layouts; two cards per piece doubles the library list.
Recommendation: A, because F already means 'the mirror image' for switches, and the ends don't move, so nothing else changes.
Note: options differ in kind, not coverage — no completeness score.
Net: reuse the F key vs twice the cards.
Header: Platform side
Options:
A) Flip with F (recommended)
Decorated straights honour turn: right mirrors the decoration across the road; F offers it while placing and on a selected piece. (human: ~3h / CC: ~15min) ✅ Same key and words as switches ✅ One card per piece; ends never move ❌ turn starts to matter for one kind of straight
B) Two cards per piece
Each one-sided piece is two library parts, platform left and platform right. (human: ~2h / CC: ~10min) ✅ No change to how straights are placed ✅ Each card shows exactly what you get ❌ Library list doubles for one-sided pieces; swap must pick a side

State: approved
Actual answer: A) Flip with F (owner's answer to eng D5)
Accepted scope: decorated straights honour `turn`: right mirrors the decoration (and its derived decorBody) across the road; F offers it while placing and on a selected piece, with switch wording; ends unchanged; plain straights still ignore turn
History: none

## Section 2: Code quality

Findings:
6. [CRITICAL] (confidence: 9/10) engine/src/view3d/mesh.ts:614-617 and 656-659 —
   `for (const s of segments) { if (!s.alongMm ...) continue; const part = partOf(s.pieceId); if (... !part.hump?.arch) continue;`
   neither the arch pass nor the tower pass sets `boxOf`, so their shapes grow
   the bounds of whichever piece was last open (the plate and truss passes at
   :542 and :566 do set it). Already approved as repair R1 (CEO plan, D8):
   accepted, no new question.
7. [INFORMATIONAL] (confidence: 8/10) engine/src/view3d/mesh.ts:610-700 — once
   decor.ts draws arches and posts for RS and HB (eng D3), the stone arch's
   `hump.arch` band and the suspension bridge's `hump.towers` stay as a second
   way to draw the same shapes (red flag 6: two ways to do one task). (Q1)

### Q1: Move the stone arch and suspension bridge onto the shared shapes too
Finding: 7, INFORMATIONAL, 8/10, engine/src/view3d/mesh.ts:610-700, native review
Plan baseline: CEO E7 (narrowed by eng D3) covers RS and HB only; SA and SB not in scope
Runtime evidence: SA draws 956 triangles and SB 978 through `hump.arch` and `hump.towers` [measured: buildScene, 2026-11-03]
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| SA arch band, SB towers and cables | one-off passes in mesh.ts | drawn by decor.ts shapes; `hump.arch`/`hump.towers` 3D fields retired (clearance figures stay) | unchanged |
| Ways to draw an arch in 3D | 2 after PR 6 | 1 | 2 |
| RS, HB (eng D3) | approved | unchanged | unchanged |
| R1 bounds repair | approved | folded into the move | separate fix, as approved |
Question D6:
D6 — Q1: Should the stone arch and suspension bridges also move onto the shared shapes?
Project: ChooChooCAD main, decorated pieces (eng D3: riser and harbour bridge move onto shapes).
ELI10: After this plan, the riser's and harbour bridge's 3D detail comes from the shared shapes, but the stone arch and suspension bridges would still draw their arch and towers with their own one-off code. That's two ways to draw the same arch, and the next person copies whichever they find first. Option A moves them too (their clearance figures for the verdict stay as they are). Option B leaves them.
Stakes if we pick wrong: two arch drawers drift apart in looks and bugs (like the bounds bug R1); or extra work now for no visible change.
Recommendation: A, because one way to draw an arch is easier to keep right, and R1's fix lands in the shared code once.
Completeness: A=9/10, B=7/10
Net: one drawing path vs less work now.
Header: SA and SB
Options:
A) Move them too (recommended)
SA's arch band and SB's towers and cables drawn by decor.ts; their one-off 3D passes removed; clearance data unchanged. (human: ~1d / CC: ~40min) ✅ One way to draw arches and posts ✅ The bounds fix (R1) lives in one place ❌ Touches two shipped bridges; their 3D tests must stay green
B) Leave them
SA and SB keep their own 3D passes; R1 is fixed in those passes. (human: ~1h / CC: ~10min) ✅ No change to shipped bridges ✅ Smallest diff ❌ Two arch drawers to keep consistent

State: approved
Actual answer: A) Move them too (owner's answer to eng D6)
Accepted scope: SA's arch band and SB's towers and cables drawn by decor.ts shapes; the one-off arch and tower passes in mesh.ts removed; `hump.arch` and `hump.towers` keep only what the verdict and clearance need; R1's bounds fix lands in decor.ts; existing SA/SB 3D tests stay green
History: none

## Section 3: Tests

```
CODE PATHS                                              USER FLOWS
[+] library.ts derive(decorated seed)                   [+] Add a decorated piece from its card
  ├── [GAP] joins equal base exactly (F3 tripwire)        ├── [GAP] card shows "Works like ..." (E9)
  ├── [GAP] base id missing -> refused at load            └── [GAP] [→E2E dom] placed, F flips platform (D5)
  ├── [GAP] decorBody derived from solid shapes (D4)    [+] Swap plain <-> decorated (E8)
  └── [GAP] stored correction carries no decor (strip)    ├── [GAP] [→dom] swap keeps joints; undo restores
[+] render.ts emits decorBody with bodies                 ├── [GAP] no variants -> no swap shown
  ├── [GAP] platform clashes with neighbouring track      └── [GAP] swap differential: 670 layouts, closure identical
  └── [GAP] isStructure false for decorated straight    [+] Tunnel straight clearance sentence (G2)
      (bridge/supports checks still see it)               └── [GAP] fits / does not fit / estimated
[+] decor.ts shapes -> mesh                             [+] Saved layouts
  ├── [GAP] each shape kind: bounds and edges             ├── [★★★ TESTED] unknown part refused, layoutStore.test.ts
  ├── [GAP] mirrored decoration (turn right)              └── [GAP] RS/HB ids still load after the move (D3)
  ├── [GAP] piece bounds hold only own shapes (R1)
  └── [★★ TESTED] SA/SB/HB/RS 3D heights (structuresApp.test.ts) — must stay green (D6)

COVERAGE (proposed): 2/19 paths tested today | QUALITY: ★★★:1 ★★:1 | GAPS: 17 (2 dom)
```

Regression contract (carried, CEO D8 + eng D3/D6): every existing 3D scene
test, the 670-layout differential and saved RS/HB layouts pass unchanged.

Findings:
8. [CRITICAL] (confidence: 8/10) engine/data/calibration.ts:121 —
   `trainMm: m.q5.vehicleHeightMm ?? ESTIMATES.trainMm,`: the train has a
   height (measured or estimated 44) but no width, so a tunnel's room for the
   train can only be checked in height today. The plan's tunnel sentence
   (CEO G2) needs its behaviour settled before PR 4. (G2)

### G2: What the tunnel straight says about room for the train
Finding: 8, CRITICAL, 8/10, engine/data/calibration.ts:121, native review + outside review (CEO phase, Codex #3)
Plan baseline: CEO G2 pending: "The tunnel records its opening width and usable height (track thickness included) and compares them with the train, or says train fit is unchecked"
Runtime evidence: bridges compare opening height with plank + train height (app/src/VerdictLine.tsx:352-353); no train width exists anywhere
Comparison grid:
| Commitment | Current | A | B | C |
|---|---|---|---|---|
| Height check | bridges only | tunnel too, same sentence as bridges | tunnel too | none |
| Width | none | measured and stored on the piece, not shown until a train width exists | checked against a train width the owner measures (diagram) | none |
| New measurement asked of owner | - | none | train width, with a diagram | none |
Question D7:
D7 — G2: What should a tunnel straight say about room for the train?
Project: ChooChooCAD main, decorated pieces (tunnel straight, CEO D5).
ELI10: The app knows how tall the train is (measured by you, or estimated at 44mm) but not how wide. For bridges it already says 'about 2mm to spare'. For a tunnel, A says the same about height, and stores the tunnel's inside width for later without claiming it's checked. B also checks width, which needs you to measure your train's width first. C says nothing about room.
Stakes if we pick wrong: claiming a width check we can't do misleads; saying nothing hides a real 'train won't fit'.
Recommendation: A, because height is the check we can do honestly today, and the stored width makes B a small step later.
Completeness: A=8/10, B=10/10, C=3/10
Net: honest height check now vs full check after a measurement.
Header: Tunnel room
Options:
A) Height now, width stored (recommended)
Tunnel says room overhead like the bridges; its measured inside width is stored but not shown. (human: ~3h / CC: ~15min) ✅ Same tested sentence as bridges ✅ No new measurement needed ❌ A too-wide train isn't caught yet
B) Height and width
Also check width against your train's width, measured with a diagram. (human: ~5h / CC: ~25min) ✅ Full room check ✅ Catches a wide train ❌ Waits on a new measurement from you
C) No room check
The tunnel is decoration only; no clearance sentence. (human: ~0 / CC: ~0) ✅ Nothing to build ✅ Nothing to get wrong ❌ A train that won't fit goes unreported

State: approved
Actual answer: A) Height now, width stored (owner's answer to eng D7)
Accepted scope: the tunnel straight states room overhead with the bridges' sentence (opening - plank - train height, measured or estimated); its measured inside width is stored on the piece and not shown until a train width exists; no new measurement asked
History: none

Test requirements (carried as required proof of approved behaviour, no new
choices): every [GAP] above becomes a test in the PR that ships its
behaviour, each with its mutation run and recorded (CLAUDE.md). The
dom-project tests are the F flip and the swap (events); the rest are node.

## Section 4: Performance

Findings:
9. [INFORMATIONAL] (confidence: 7/10) engine/src/view3d/mesh.ts — rich
   decoration multiplies triangles: today A draws 14, RS 68, HB 588, SA 956,
   SB 978 [measured: buildScene, 2026-11-03]. A layout of 40 decorated pieces
   at ~1,000 each is ~40k triangles, well within WebGL's comfort, but nothing
   stops one piece from being drawn at 100k by a careless curve step. (F5)

### F5: A size budget for each piece's 3D drawing
Finding: 9, INFORMATIONAL, 7/10, engine/src/view3d/mesh.ts, native review
Plan baseline: CEO F5 pending: "A per-piece triangle budget (proposed 3,000) checked by test"
Runtime evidence: largest piece today 978 triangles (SB) [measured: buildScene, 2026-11-03]
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| Per-piece triangle limit | none | 3,000, a test over every built-in part | none |
| Headroom over today's largest | - | about 3x SB's 978 | - |
Question D8:
D8 — F5: Should each piece's 3D drawing have a size limit, checked by a test?
Project: ChooChooCAD main, decorated pieces (shared shapes, eng D4/D6).
ELI10: Richer decoration means more triangles for the 3D view to draw. Today the biggest piece, the suspension bridge, is 978. A test could check that no piece goes over 3,000, so a shape drawn too finely (say a curve split into thousands of steps) is caught before it makes the 3D view slow on a phone.
Stakes if we pick wrong: no limit lets one careless shape slow every layout that uses it; a limit set too low blocks a detailed piece.
Recommendation: A, because a one-line test over every part is cheap, and 3,000 leaves three times today's largest.
Completeness: A=9/10, B=6/10
Net: a cheap guard vs no guard.
Header: 3D budget
Options:
A) 3,000 per piece (recommended)
A test draws every built-in part alone and fails over 3,000 triangles. (human: ~1h / CC: ~5min) ✅ Catches an over-fine shape before it ships ✅ Three times today's largest piece ❌ A rich piece may one day need the limit raised
B) No limit
Rely on reviewing each piece's 3D by eye. (human: ~0 / CC: ~0) ✅ Nothing to maintain ✅ No limit to argue about ❌ A slow piece is found only on someone's phone

State: approved
Actual answer: A) 3,000 per piece (owner's answer to eng D8)
Accepted scope: a test draws every built-in part alone and fails above 3,000 triangles
History: none

## Outside voice (Codex, plan review, completed)

Five findings, each verified against the code (library.ts:137, 148;
overlap.ts:302; schema.ts:366; mesh.ts:490; structureSeeds.ts:312).
- O1 High, swap under stored corrections: carried under CEO E8 + plan
  Section 4 ("offered only between variants of the same base id (same joins,
  enforced by test)"): the same-joins check runs against the RESOLVED
  library when the swap is offered; a corrected base whose ends differ hides
  the swap. Test: a corrected base hides the swap. Accepted (carried).
- O4 Medium, decorBody drawn as boxes: carried under eng D4 (boxes derived
  from shapes, the shapes are the drawing): derived bodies are collision-only;
  mesh.ts does not draw them. Test: a decorated piece's solid triangles all
  come from decor.ts. Accepted (carried).
- O5 Medium, variants replaceable by submissions: carried under CEO Accepted
  scope item 1 ("Built-in only"): decorated ids join the built-in refusal set
  in library.ts independently of isStructure. Test: a submission for a
  decorated id is refused. Accepted (carried).
- O2 High, height of derived boxes: new choice (O2 below).
- O3 High, boxes closing openings: new choice (O3 below).

### O2: Which levels a decoration shape blocks
Finding: outside voice O2, High, 9/10 (verified), engine/src/parts/schema.ts:366 and engine/src/graph/overlap.ts:302 (`const sameLevel = p.lo <= q.hi && q.lo <= p.hi;`), Codex
Plan baseline: eng D4 approved boxes derived from solid shapes; the height rule is unchosen
Runtime evidence: collisions compare whole levels (lo..hi); shapes are measured in millimetres
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| Levels a solid shape blocks | n/a | every level its height range touches, from its bottom to its top, measured against the level height | levels written by hand on each shape |
| Low platform (0-20mm) | n/a | level 0 only | as written |
| Roof 70-90mm over track | n/a | level 1 only: floor track passes under, raised track there clashes | as written |
| Derived boxes (D4) | approved | unchanged | unchanged |
Question D9:
D9 — O2: Which levels should a decoration shape block?
Project: ChooChooCAD main, decorated pieces (eng D4: collision boxes derived from shapes).
ELI10: The app checks clashes by level: floor, one up, and so on. Shapes are measured in millimetres. A rule must turn 'a platform 0 to 20mm high' or 'a roof 70 to 90mm up' into levels. Option A: a shape blocks every level its height touches, worked out from the real level height (61mm), so a low platform blocks the floor and a high roof blocks only the level it's in. Option B: each shape says its levels by hand.
Stakes if we pick wrong: a hand-written level can disagree with the shape it describes; a careless automatic rule could make a roof block the floor track it covers.
Recommendation: A, because it derives levels from the measurements like D4 derives the boxes, and fixtures above and below each shape pin it.
Completeness: A=9/10, B=7/10
Net: computed levels vs hand-written ones.
Header: Shape levels
Options:
A) From the shape's height (recommended)
A solid shape blocks every level its millimetre range touches, using the 61mm level height; tests place track just above and below each shape. (human: ~3h / CC: ~15min) ✅ One rule, no hand-written levels ✅ Roofs over floor track stay passable ❌ A shape ending exactly on a level line needs a stated rounding rule
B) Written by hand
Each shape lists the levels it blocks, beside its measurements. (human: ~2h / CC: ~10min) ✅ Full control per shape ✅ No rounding edge cases ❌ Two descriptions of one shape that can disagree

State: approved
Actual answer: A) From the shape's height (owner's answer to eng D9)
Accepted scope: a solid shape blocks every level its millimetre range touches, computed with the level height (61mm); a range ending exactly on a level line does not reach into the next level; tests place track just above and just below each shape
History: none

### O3: Boxes for shapes with an opening
Finding: outside voice O3, High, 8/10 (verified), engine/data/structureSeeds.ts:312 (HB's portal floors and pylons are separate boxes, leaving the passage open), Codex
Plan baseline: eng D4 (boxes derived from solid shapes) and D9 (levels from height); decomposition per shape unchosen
Runtime evidence: an arch, a tunnel shell and a roof on posts all enclose an opening that one bounding box would close
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| Boxes for an opening shape (arch, tunnel shell, roof on posts) | n/a | each shape kind knows its solid parts: an arch yields its two feet and its crown band; a shell its walls and roof; posts each post | opening shapes are always `solid: false`; their footprint written as plain solid slabs/posts beside them |
| Test | n/a | track through every opening passes; track into every solid part clashes | same fixtures, on the hand-placed slabs |
| D4 single source | approved | kept | weakened: opening shapes need a second list |
Question D10:
D10 — O3: How should shapes with an opening (arch, tunnel, roof on posts) block other track?
Project: ChooChooCAD main, decorated pieces (eng D4 boxes from shapes, D9 levels from height).
ELI10: A box drawn round a whole arch would also fill the hole under it, so track the arch is meant to carry over would wrongly clash. Option A teaches each opening shape which parts are solid: an arch's two feet and its top band, a tunnel's walls and roof, each post of a canopy. Option B marks opening shapes as not solid and asks each piece to add plain blocks for their solid parts by hand.
Stakes if we pick wrong: openings that wrongly clash make bridges and tunnels useless; hand-added blocks bring back the two-lists problem D4 removed.
Recommendation: A, because it keeps D4's single source, and an opening test per shape proves the hole stays open.
Completeness: A=9/10, B=7/10
Net: smarter shapes vs a second hand-written list.
Header: Openings
Options:
A) Shapes know their solid parts (recommended)
Each opening shape yields boxes for its solid parts only; a test sends track through every opening and into every solid part. (human: ~5h / CC: ~25min) ✅ Openings stay open by construction ✅ Still one list per piece (D4) ❌ Each new opening shape needs its own box rule
B) Opening shapes not solid
Arches, shells and canopies never block; each piece adds plain blocks for their feet and walls. (human: ~3h / CC: ~15min) ✅ Simple shape code ✅ Exact control of each block ❌ Brings back two lists per piece

State: approved
Actual answer: A) Shapes know their solid parts (owner's answer to eng D10)
Accepted scope: each opening shape (arch, tunnel shell, roof on posts) yields boxes for its solid parts only (arch: two feet and crown band; shell: walls and roof; canopy: each post and the roof); a test per opening shape sends track through every opening (passes) and into every solid part (clashes)
History: none

### T1: TODO — the message for a part from a newer version
Finding: 3, INFORMATIONAL, 8/10, app/src/layoutStore.ts:347,560, native review
Plan baseline: none (TODO candidate)
Runtime evidence: an unknown part id is refused safely with "Your saved track used a part the library no longer has (...)"; a share link with a NEW decorated id opened in an older cached app gets that wording though the part is newer, not removed
TODO:
- What: when a saved layout or link names a part this copy of the app doesn't know, say it may come from a newer version and suggest reloading, instead of "no longer has".
- Why: decorated pieces add new ids often; anyone with a cached app who opens a friend's link is told the part was removed.
- Pros: clear next step (reload); no behaviour change. Cons: one message, one test; small.
- Context: app/src/layoutStore.ts:560; the refusal itself is right and stays.
- Depends on: nothing.
Comparison grid:
| Commitment | Current | A | B | C |
|---|---|---|---|---|
| Message wording | "no longer has" | TODOS.md entry, unchanged now | unchanged | changed in PR 2 |
Question D11:
D11 — T1: Add a TODO for the 'part from a newer version' message?
Project: ChooChooCAD main, decorated pieces (new ids, CEO F4).
ELI10: When an old cached copy of the app opens a link with a part it doesn't know, it safely refuses and says 'the library no longer has' that part. With decorated pieces adding new parts, the usual reason will be that the part is newer, not removed, so the right advice is 'reload to get the latest version'. A records this as a TODO, B skips it, C changes the wording in the first decorated-pieces PR.
Stakes if we pick wrong: people told a part was removed when they only need to reload.
Recommendation: C, because it's one sentence and one test, and PR 2 is what makes the situation common.
Note: options differ in kind, not coverage — no completeness score.
Net: fix the wording now vs note it for later.
Header: Newer part
Options:
A) Add to TODOS.md
Record it with its context; fix later. (human: ~5min / CC: ~1min) ✅ Nothing added to PR 2 ✅ Kept with where to start ❌ Users meet the wrong wording once decorated pieces ship
B) Skip
Not worth tracking. (human: ~0 / CC: ~0) ✅ No work ✅ Refusal is already safe ❌ The misleading wording stays
C) Build it in PR 2 (recommended)
Change the sentence to suggest reloading for a newer version, with a test. (human: ~30min / CC: ~5min) ✅ Right advice from day one ✅ One sentence, one test ❌ PR 2 grows slightly

State: approved
Actual answer: A) Add to TODOS.md (owner's answer to eng D11)
Accepted scope: P3 entry in docs/plan/generic-TODOS.md; no change to PR 2
History: none

Approval readiness: PASS. Checked: G1 (eng D2), F2 (D3), G3 (D4), P1 (D5),
Q1 (D6), G2 (D7), F5 (D8), O2 (D9), O3 (D10), T1 (D11); structure (D1);
outside-voice O1, O4, O5 carried under CEO E8, eng D4 and CEO Accepted scope
item 1; test requirements carried as proof of approved behaviour.

## Eng review outputs

### What already exists
- Bodies and collisions: `BodyBox`, render.ts:151 emits bodies, overlap.ts
  checks them; decorated pieces reuse this through `decorBody` (D2).
- Built-in protection: library.ts:148 `BUILT_IN_STRUCTURES`; decorated ids
  join it (O5).
- Clearance sentence: VerdictLine.tsx:339-353 (bridges), reused for the
  tunnel (D7).
- F key wording: multi-road `flip` (schema.ts:537), reused for one-sided
  decorations (D5).
- Unknown-part refusal: layoutStore.ts:347 (kept; wording TODO, D11).
- 3D prisms, plate and truss passes in mesh.ts: replaced by decor.ts (D3, D6).

### NOT in scope (eng)
- Train width check: needs a measurement first (D7 option B not chosen).
- Invented raised bases for RS and HB (D3 option B not chosen).
- "Newer version" wording: TODO P3 (D11).

### Failure modes
| Path | Realistic failure | Covered by | User sees |
|---|---|---|---|
| derive variant | base corrected in storage, ends differ | O1 swap check + test; variant uses built-in base | swap not offered |
| derive decorBody | shape with opening closes it | D10 opening tests | track passes as expected |
| shape levels | roof edge exactly on 61mm | D9 rounding rule + boundary test | correct clash or pass |
| mesh | decoration drawn twice as a box | O4 test | clean 3D |
| submissions | decorated id replaced by a bare straight | O5 refusal test | built-in kept |
| 3D size | over-fine curve | D8 budget test | caught in CI |
| saved layouts | RS/HB move breaks old saves | D3 load test | layouts load |
No critical gaps: every path has a test and a visible outcome.

### Worktree parallelization
| Step | Modules touched | Depends on |
|---|---|---|
| R1/R2 repairs | engine/src/view3d, app/src | — |
| Variant model + shapes | engine/src/parts, engine/data, engine/src/view3d, engine/src/graph | — |
| Level crossing (proof piece) | engine/data, app/src | variant model |
| Station straight + F flip | engine/data, app/src | variant model |
| Tunnel straight + clearance | engine/data, app/src | variant model |
| Swap + works-like line | app/src | variant model |
| RS/HB/SA/SB onto shapes | engine/data, engine/src/view3d | variant model |
Lane A: repairs (independent). Lane B: variant model, then the pieces and the
swap in parallel lanes; RS/HB/SA/SB after the model. Conflict flags: the
pieces and the swap all touch app/src (cards); merge them one at a time.
No stacking: each lane branches from main after its dependency merges.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — 3D — Repair piece bounds and the harbour bridge's room sentence (R1, R2)
  - Surfaced by: Code quality finding 6 (mesh.ts:614-617, 656-659)
  - Files: engine/src/view3d/mesh.ts, app/src/VerdictLine.tsx, app/src/App.tsx
  - Verify: bun run test (two bridges in one layout: each piece's bounds hold only its shapes)
- [ ] **T2 (P1, human: ~2d / CC: ~1h)** — engine — Variant model, shared shapes, derived collision boxes
  - Surfaced by: G1 (D2), G3 (D4), O2 (D9), O3 (D10), O4, O5, F5 (D8), structure (D1)
  - Files: engine/src/parts/schema.ts, engine/data/library.ts, engine/data/decoratedSeeds.ts (new), engine/src/view3d/decor.ts (new), engine/src/view3d/mesh.ts, engine/src/graph/render.ts
  - Verify: tripwire (joins equal base), opening and level fixtures, 3,000-triangle budget, submission refusal
- [ ] **T3 (P1, human: ~1d / CC: ~30min)** — parts — Level crossing as the first decorated piece, with "works like" (E9)
  - Surfaced by: CEO D5/D6; Section 3 test diagram
  - Files: engine/data/decoratedSeeds.ts, engine/data/origins.ts, app/src/App.tsx, app/src/PartPreview.tsx
  - Verify: card text test; clash and pass fixtures
- [ ] **T4 (P2, human: ~1d / CC: ~30min)** — parts — Station straight with the F flip (D5)
  - Surfaced by: P1 (D5); CEO D5, D7
  - Files: engine/data/decoratedSeeds.ts, app/src (placing, F key)
  - Verify: dom test: F flips the platform, ends unchanged
- [ ] **T5 (P2, human: ~1d / CC: ~30min)** — parts — Tunnel straight with its room sentence (D7)
  - Surfaced by: G2 (D7)
  - Files: engine/data/decoratedSeeds.ts, app/src/VerdictLine.tsx, app/src/verdictView.ts
  - Verify: fits / doesn't fit / estimated sentences
- [ ] **T6 (P2, human: ~4h / CC: ~20min)** — app — Swap plain and decorated (E8), checked against the resolved library (O1)
  - Surfaced by: O1; CEO D6
  - Files: app/src/editorReducer.ts, app/src/App.tsx
  - Verify: dom test; corrected base hides the swap; 670-layout swap differential, closure identical
- [ ] **T7 (P2, human: ~1.5d / CC: ~1h)** — 3D — RS, HB, SA and SB onto the shared shapes (D3, D6)
  - Surfaced by: F2 (D3), Q1 (D6)
  - Files: engine/data/structureSeeds.ts, engine/src/view3d/mesh.ts, engine/src/view3d/decor.ts, engine/src/parts/schema.ts
  - Verify: existing SA/SB/HB/RS 3D tests unchanged; saved RS/HB layouts load

### Completion summary
- Step 0: Scope Challenge — scope accepted as-is
- Reality rows: 7/7 tier-1 rows considered in findings, 0 unverified premises (each finding quotes its line)
- Architecture Review: 2 issues found (G3, P1)
- Code Quality Review: 2 issues found (R1 carried, Q1)
- Test Review: diagram produced, 17 gaps identified (all carried as required proof)
- Performance Review: 1 issue found (F5)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 item proposed to user (added, P3)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex, completed (5 findings: 3 carried, 2 decided)
- Parallelization: 2 lanes, 5 parallel / 2 sequential
- Lake Score: 5/6 scored answers chose the highest-scored option; D7 chose height-only (8/10) over height and width (10/10), which needs a new measurement

## Design review (2026-11-03)

Text-only (no mockups: no image key in this project). Outside design voices
declined. Calibrated against DESIGN.md rules 7, 10 and 11.

### Decisions
- **1 (Pass 1, library place): 1A.** Decorated pieces get their own library
  heading, "Decorated", after Structures, in the same card style; the plain
  track lists are unchanged. (Owner's answer to design question 1.)
- **2 (Pass 1, card line): 2A.** A decorated card's note line reads
  "Works like A, Medium straight" (base code, then base name), in the
  existing `piece-note` style; the screen-reader label adds it as its own
  sentence; the tooltip carries it in full when the card cuts it short.
- **3 (Pass 2, swap control): 3A.** On the selected-piece strip, after
  "Rotate run (R)": one button per decorated version, "Make it a <name>"
  (e.g. "Make it a Station straight"), and "Make it plain" on a decorated
  piece; no button when the piece has no version (or the O1 joins check
  hides it); three or more versions fall back to a short list.
- **4 (Pass 2, swap into a clash): 4A.** A swap whose decoration would
  clash is refused like a refused move, in the strip's existing refusal
  line: "Can't make it a <name>: its <part> would sit on piece <n>."
  The layout is unchanged.
- Carried from the existing contract (every action is announced in its own
  polite region, DESIGN.md "What is NOT settled", dec-cc66dbf5): a swap
  announces "Piece <n> is now a <name>." and undo restores it; no new
  decision.
- **5 (Pass 2, F wording): 5A.** A one-sided decorated piece's flip reads
  "Other side (F)"; the keys line says "F to put the <noun> on the other
  side"; the announcement is "<Noun> on the other side." The noun (platform,
  building, barrier) is set per piece. No screen directions (DESIGN.md 7).

- **6 (Pass 5, 2D marks): 6A.** A decorated piece's solid decoration is
  drawn on the canvas and in its card drawing with the existing marks: the
  flat slab with a 1px `--ink-soft` edge ("wood that is not track") for
  floor space, the diagonal hatch for a roof (DESIGN.md 11). No new mark.

### Journey storyboard (Pass 3)
| Step | User does | User feels | Plan specifies? |
|---|---|---|---|
| 1 | Scans the library, finds "Decorated" | curious: these look like my real pieces | yes (1A) |
| 2 | Reads "Works like A, Medium straight" | reassured: my layout still works | yes (2A) |
| 3 | Places a station, presses F | in control: platform where I want it | yes (5A, eng D5) |
| 4 | Selects a plain straight, "Make it a Station straight" | delighted: dressed without rebuilding | yes (3A) |
| 5 | Swap refused: "its platform would sit on piece 7" | told why, knows the fix | yes (4A) |
| 6 | Reads the verdict, opens 3D | proud: it looks like the real one | yes (verdict unchanged; 3D shapes) |


### What already exists (design)
- Card note line (`piece-note`) and screen-reader label sentences: App.tsx ~1547-1570.
- Flip label/verb/after pattern and "(F)" key line: switchSeeds.ts:207-208, ghostKeys.ts.
- Selected-piece strip buttons and refusal line: App.tsx ~1170-1192.
- Slab and roof marks: DESIGN.md 11; bridges' room sentence: VerdictLine.tsx:339-353.

### NOT in scope (design)
- A distinct 2D mark for decoration (6B): same meaning as the slab, so reused.
- Auto-flipping a swap onto the clear side (4C): surprising; refused instead.
- Mockups: no image key in this project.

### Implementation Tasks (design)
- [ ] **D-T1 (P1, human: ~2h / CC: ~10min)** — app — "Decorated" library heading and "Works like <code>, <name>" card line
  - Surfaced by: decisions 1, 2
  - Files: app/src/App.tsx, app/src/app.css
  - Verify: dom test: heading lists decorated cards; card label sentence; tooltip
- [ ] **D-T2 (P1, human: ~4h / CC: ~20min)** — app — Swap buttons, refusal and announcement
  - Surfaced by: decisions 3, 4; carried announcement
  - Files: app/src/App.tsx, app/src/editorReducer.ts
  - Verify: dom test: "Make it a Station straight", "Make it plain", hidden with no version, refusal names the piece, announcement, undo
- [ ] **D-T3 (P2, human: ~2h / CC: ~10min)** — app — "Other side (F)" wording per one-sided piece
  - Surfaced by: decision 5
  - Files: engine/data/decoratedSeeds.ts, app/src/ghostKeys.ts
  - Verify: keys line and announcement text; copyPosition.test.ts stays green
- [ ] **D-T4 (P2, human: ~2h / CC: ~10min)** — canvas — Decoration drawn as slab and hatch on canvas and card
  - Surfaced by: decision 6; Pass 7 note (a level crossing's own road never clashes with its own track)
  - Files: app/src/TrackCanvas.tsx, app/src/previewGeometry.ts
  - Verify: card drawing and canvas marks tests; own-road no-clash test

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (13 rules); UI in library, |
  |                      | strip, placing, canvas, verdict, 3D          |
  | Step 0               | 3/10; all 7 passes                           |
  | Pass 1  (Info Arch)  | 3/10 → 8/10 after fixes                      |
  | Pass 2  (States)     | 2/10 → 8/10 after fixes                      |
  | Pass 3  (Journey)    | 6/10 → 8/10 (storyboard recorded)            |
  | Pass 4  (AI Slop)    | 9/10 → 9/10                                  |
  | Pass 5  (Design Sys) | 5/10 → 8/10 after fixes                      |
  | Pass 6  (Responsive) | 8/10 → 8/10                                  |
  | Pass 7  (Decisions)  | 6 resolved, 0 deferred                       |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (3 items)                            |
  | What already exists  | written                                      |
  | TODOS.md updates     | 0 items proposed                             |
  | Approved Mockups     | 0 generated, 0 approved (no image key)       |
  | Decisions made       | 6 added to plan                              |
  | Decisions deferred   | 0                                            |
  | Overall design score | 2/10 → 8/10                                  |
  +====================================================================+
```

Plan is design-complete. Run /design-review after implementation for visual QA.

### Unresolved Decisions
None.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 10 proposals, 6 accepted, 1 deferred |
| Outside Review | codex (plan-eng-review outside voice) | Independent 2nd opinion | 2 | completed | 5 findings: 3 carried under approvals, 2 decided (eng D9, D10) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | ISSUES OPEN | 22 issues, 0 critical gaps; all decided and mapped to tasks |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 | CLEAR | score: 2/10 → 8/10, 6 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review phase, completed (CEO and eng phases); design phase outside voices declined by the owner.
- **CROSS-MODEL:** eng phase only, as recorded above; no design-phase outside review to compare.
- **VERDICT:** CEO + DESIGN CLEARED; eng review recorded every finding as decided work (ISSUES OPEN = mapped tasks, not open choices). Ready to implement, starting with T1.

NO UNRESOLVED DECISIONS
