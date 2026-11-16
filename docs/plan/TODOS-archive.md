
## DONE 2026-11-05 — Show the editor's selection in 3D (left from pick in 3D, 2026-11-05)

**What:** the other half of "pick in 3D": a piece selected in 2D, or picked in 3D, is marked in the 3D view.
**Why deferred:** design 10A says a selection is kept in 3D but the piece is not highlighted, and nothing has decided how a mark would look next to build mode's muted-and-outlined next piece (D42). Pick in 3D shipped without it, so a pick is said (the selection's announcement), not shown.
**Context:** `docs/plan/2026-10-31-3d-viewer.md` 10A; `SceneInput.highlight` is build mode's, not a selection's. Side-by-side vs the switch is still the switch.
**Effort:** human S / CC S. **Depends on:** a design call on 10A.

**DONE 2026-11-05 (branch select-in-3d).** Owner decision: ink outline only. The selected piece's plank top gets build mode's top outline (`SceneArrays.selection`), drawn in 3px `--ink` (the 2D selection's weight) and seen through whatever is in front, so a piece under a tunnel or station can still be found. Nothing else changes: no muting, no piece drawn apart, so it never reads as build mode. The selection reaches 3D whether picked there or carried over from 2D; build mode's scene never gets it.



## DONE 2026-11-04 — Documentation: README.md denies most of what this release shipped (filed by /ship's docs audit, 2026-10-14)

**DONE 2026-11-04 (branch readme-truth).** README.md rewritten to match the app: canvas editing, multiple loops, two levels and clearances, decorated pieces, 3D, build mode, inventory, sharing, the phone view; what is not checked or measured yet; the trademark line now names no maker and still disclaims. Reviewed in docs/plan/2026-11-04-app-focus-review.md (D3).

**2026-11-04 (D3, raised to P1) (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** README.md:117-125 still says no drag-and-drop, single cycle only, no inventory/3D/build mode; README.md:207 reads "Generic is a live trademark of Generic AB" after a find-and-replace and disclaims nothing. Rewrite to match the app and fix the trademark line (it must name nobody yet still disclaim; may want counsel).

**RE-CONFIRMED 2026-10-15 with the exact lines, so this does not need
re-deriving.** Four claims are flatly false against the shipped code, and the
README is the first thing a reader checks it against:

- `:96` "The layout verdict has four states" -- there are ten `VerdictKind`s,
  five of them failure kinds.
- `:105` "The engine is single-cycle" and `:119` "Single cycle only. A layout
  is a chain, optionally closed." -- the graph engine ranks up to
  `CYCLE_RANK_CEILING = 20` independent loops, and the UI renders "N of M
  loops". This one is the most jarring: the branch that bounded that
  enumeration left the README saying it cannot happen.
- `:126` "No inventory, no 3D, no build mode, no library." -- there is an
  inventory (`inventoryModel.ts`), a library and a submissions pipeline
  (`engine/data/library.ts`, `SubmitPart`).

Left to this entry rather than patched in passing, because scoping the chain
engine (`engine/src/solver`) apart from the graph engine is the actual job and
it is prose, not a one-line correction.

**What:** the docs audit returned `blocked`. It made four factual corrections
(test count, `bun run typecheck`, the split U7a/U7b reference, the third
exported plan copy) and refused the rest as owner territory. `README.md`
contradicts shipped code in eight places: "Single cycle only", "Switches …
Not here", "No inventory … no library", "No drag-and-drop. Pieces append and
remove from the end of the chain", and "the overlap check is specified and
unbuilt". All of those now exist.

**Also:** `README.md` calls `tokens.css` "PROVISIONAL" with "a researched
design system … separate work", while `DESIGN.md` says it IS the design system
and commit `d7238cb` is titled "stop telling people to throw it away". One of
the two states the project's position; which one is the owner's call. `README`
line 89 says "There are no per-joint glyphs" while its own Layout tree still
lists "four-channel joint glyphs". The Layout tree predates the graph rewrite
and omits about 25 modules. And `DESIGN.md` plus all of `docs/plan/` are
reachable from neither entry point, so the only explanation-quadrant docs for
this release cannot be found.

**Fix:** `/document-generate` for the README rewrite and the missing how-to
coverage. Not a ship job: it rewrites the introduction, "The UI" and the whole
"What this MVP does NOT do" section.

**Effort:** human ~3h / CC ~45m. **Priority:** P2.
**Depends on / blocked by:** nothing.

## DONE 2026-11-04 — The rescue copy can fail on a full storage (was: the three save functions swallow every failure)

**DONE 2026-11-04 (branch rescue-quota).** While any save fails and a rescue copy is stored, the "Not saved" notice adds a sentence with the copy's size and a Download it button (the exact bytes, `choochoocad-unreadable-layout.json`). Only after the download does Remove it appear; it deletes `GRAPH_RESCUE_KEY` and re-runs every save, so the notice goes once there is room. The copy is never removed on its own. Specs: app/src/saveFailure.dom.test.tsx ("the rescue copy, while a save fails").

**2026-11-04 (D6, P1 → P2, retitled) (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** every save now returns a boolean and the notice exists (layoutStore.ts:673, library.ts:524, inventoryModel.ts:242, tableModel.ts:232). Still open: `rescue()` (layoutStore.ts:153) can fail on a full storage.

**SAVE HALF DONE (2026-10-24).** All four saves (`saveGraph`, `saveTable`,
`saveInventory`, `saveSubmissions`) now return whether storage took the write.
App.tsx keeps one flag per store and shows a dismissable notice naming what was
not stored: "Not saved: this browser refused to store your layout. It stays on
screen, but is lost when you close or reload this tab. …". An empty layout or
parts list that fails to save loses nothing, so the notice waits for the first
piece; a later save that succeeds takes its store off the notice. Specs:
app/src/saveFailure.dom.test.tsx. **Still open:** the rescue copy's share of
the quota (the "Compounding" paragraph below). Evicting it would delete bytes
the user may need, so it wants a decision, not a keystroke.

**What:** `saveGraph`, `saveInventory` and `saveSubmissions` each wrap
`localStorage.setItem` in an empty `catch`. Private browsing and a full quota
both throw. The app then silently stops persisting anything, for the rest of
the session, with no notice.

`library.ts:193-196` is explicit that this is not acceptable for one of them:
"unlike the chain this IS data the user cannot trivially recreate, so the
caller should surface a failure." `saveSubmissions` returns `void`, so the
caller cannot. The obligation is unmeetable as typed.

**Compounding:** `loadGraph.rescue()` copies the full refused blob to a second
key. A 2.5MB bad graph plus its 2.5MB rescue copy sits at the ~5MB origin
budget, after which all three saves start throwing. The safety net can consume
the budget of the thing it protects.

**Fix:** have the three save functions return whether they succeeded, surface a
failure for the submissions at minimum, and cap or evict the rescue copy rather
than letting it compete for the live budget.

**Effort:** human ~2h / CC ~30m. **Priority:** P1.
**Depends on / blocked by:** nothing.


## DONE 2026-11-04 — Layout file when a link is too long (deferred by /plan-ceo-review D4, 2026-10-31)

**DONE 2026-11-04 (branch layout-file).** "Save to a file" (once there is a layout) downloads `layout.choochoo`, holding the link's own `v1.…` string, checked by the decoder first. "Open a layout file" reads a `.choochoo` file, a pasted fragment or whole link, or a downloaded `.json` backup (the storage-full and rescue-copy downloads), and opens it through the address, which is the pasted-link road: saves flushed or the link held, the read-only view, its exits. Same decoder and caps as a link; a refusal is one sentence (`FILE_REFUSED`). The storage-full warning no longer says these files can't be opened. Left: drop on the canvas (new P3). Specs: app/src/layoutFile.test.ts, app/src/layoutFile.dom.test.tsx. Differs from the design doc in one way: the address carries the fragment after opening, as a pasted link's does.

**What:** a `.choochoo` text file holding the same `v1.` share string, offered
by Share when the link is too long, opened with "Open a layout file" or by
dropping it on the canvas. It opens the same read-only view, goes through the
same pure decoder and caps, and follows the link's storage rules.
**Why deferred:** nobody has measured whether real layouts make links too long.
The share wave measures the presets and the largest corpus layouts first.
**Trigger:** a measured preset or corpus layout over the chosen link threshold,
or a user who can't share a layout, or a user restoring a "Download a copy"
backup (eng review D36: the storage-full warning downloads raw bytes that only
this feature can open again).
**Spec:** docs/designs/share-and-polish.md, step 3 "Layout file".
**Effort:** human ~1 day / CC ~30 min
**Priority:** P2

---

## DONE 2026-11-05 — Drop a layout file on the canvas (left from the layout-file P2, 2026-11-04)

**DONE 2026-11-05 (branch drop-layout-file).** A file dropped on the editor's canvas (the stage, 2D or 3D) opens as "Open a layout file" does: both hand the file to one function, `openLayoutFile` in `LayoutFileControls.tsx`, so the size cap, `fragmentOfFile`, the `open-file` count and the address road are shared. A refusal is said on the file row's status line, whose sentence App now owns so the drop can use it. Only a drag carrying files is accepted; the first file is taken; a drop with no file is ignored. The canvas's pointer handling is untouched. Spec: app/src/layoutFileDrop.dom.test.tsx.

**What:** dropping a `.choochoo` file or a downloaded `.json` backup on the canvas opens it, as "Open a layout file" does (`LayoutFileControls.tsx`, `fragmentOfFile`).
**Why:** the design doc names drop as the second way in; the picker shipped first because it is the one every device has.
**Effort:** human ~1h / CC ~15m. **Priority:** P3. **Depends on:** nothing.

## DONE 2026-11-05 — Pick a piece in 3D and it is selected in 2D (filed by /plan-ceo-review 2026-10-31, D5)

**DONE 2026-11-05 (branch pick-in-3d).** A click or tap on a piece in the 3D view selects it in the editor, so 2D shows it selected; the selection's own announcement says so ("Selected Piece n: …"), and the view stays in 3D. A press that moves more than 5px is a turn or a pan and picks nothing; a click on the table, a building or empty space does nothing; a second click on the same piece keeps it selected. The ray reads the merged wood through `pieceRanges` and a new `sideRanges` (top and sides), passing through grooves, beams and footprints. Build mode and a shared link's view pick nothing. Not done: the other way round (2D's selection shown in 3D) is held by design 10A and filed as a new P3; the switch stays (no side-by-side). Specs: app/src/viewer3dPick.test.ts, app/src/view3d.dom.test.tsx.

**What:** Clicking a piece in the 3D viewer selects it on the 2D canvas, and the other way round.
**Why:** Finding which plan-view piece is the one under a bridge is by eye until then.
**Pros:** 3D becomes a way to navigate. Mesh ids are needed by build mode anyway. **Cons:** Ray-cast picking, which jsdom cannot test.
**Context:** The 3D viewer ships read-only (`docs/plan/2026-10-31-3d-viewer.md`). Decide side-by-side vs a switch first.
**Effort:** human M / CC S. **Depends on:** the 3D viewer.

---


## WON'T DO 2026-11-05 — Nothing has ever verified what the verdict announces, and the text inside the live region just changed (filed by /qa, 2026-10-19)

**WON'T DO 2026-11-05 (owner).** The owner does not expect screen-reader users and chose not to run the VoiceOver listen or change the announcement. `app/src/verdictAnnouncement.dom.test.tsx` stays as the record of what is announced; the findings, including "every placement is said twice", are in docs/plan/2026-11-05-verdict-announcement.md for whoever reopens this.

**2026-11-05, MACHINE HALF DONE (branch verdict-announcement):** `app/src/verdictAnnouncement.dom.test.tsx` pins the exact spoken words of both live regions through a real session; results and a VoiceOver checklist are in docs/plan/2026-11-05-verdict-announcement.md. Marks are silent and the region holds the sentence alone (pass). Finding: while a run is open, every placement is said twice, the verdict re-reading its piece count beside "Added piece N". **Still open, owner-owned:** the 30-minute VoiceOver listen (the checklist), then decide whether to drop the piece count from the spoken not-a-loop verdict.

**What:** The verdict is announced through a polite, atomic live region:
`app/src/VerdictLine.tsx:214-216` carries `role="status"`, `aria-live="polite"` and
`aria-atomic="true"`. On 2026-10-19 the EXCEEDS sentence inside that region was
rewritten and a fifth disclosure kind was added to the `aria-describedby` sibling.
**No test, no probe and no human has ever confirmed what a screen reader says when
that region changes.** The `/qa` browser pass on the same day covered the rendered
text and the console and explicitly scored Accessibility as untested.

**Why it matters.** `aria-atomic="true"` means the WHOLE region re-announces on every
change, by design, because a verdict is only true whole. Every piece a builder places
re-announces the entire sentence. That sentence is now longer than it was, so the
cost of the atomic choice went up in a change that never measured it. If the
announcement is too long or repeats on every click, a screen-reader user hears the
editor talk over itself while placing track.

**What is NOT the gap, so nobody re-investigates it.** The structural half is already
right and tested in a browser: task W1 moved `<Trust>` and `<Action>` OUT of the live
region into an `aria-describedby` sibling precisely so they do not re-announce, and
`aria-describedby` is omitted rather than pointed at an empty element. Confirmed in
the DOM on 2026-10-19. The gap is the announcement itself, not the markup.

**This is NOT blocked on E11.** E11 (a real DOM test environment) blocks event-driven
assertions: that Enter activates a free end, focus order, a second Enter welding.
Hearing what VoiceOver says needs a human with VoiceOver, which this project's own
machine already has. Thirty minutes with the screen reader on would settle it, and no
infrastructure has to land first. Note also that the automated tooling cannot close
this one: `renderToStaticMarkup` dispatches nothing, and gstack's headless browser
clicks by element ref rather than tabbing, so neither can hear an announcement or
exercise focus order.

**Fix:** turn VoiceOver on, place pieces until the verdict changes between states, and
record what is actually announced at each transition, including whether the
disclosures are reachable on demand through `aria-describedby` and whether the region
is reachable by keyboard at all. Write the result down. Only then decide whether
`aria-atomic` is still the right call for a sentence this length, and whether the
design review's standing decision ("the verdict region gets `aria-live="polite"` and
nothing else becomes announced") still holds now that the sentence has grown.

**Effort:** human ~30m to listen and record / CC ~0 for the listening, ~30m to act on
what it finds. **Priority:** P2.
**Depends on / blocked by:** nothing. Owner-owned because it needs a human ear.


## DONE 2026-11-05 — The crash repro can report a failure the app cannot produce (filed by /ship, 2026-10-14)

**DONE 2026-11-05 (branch crash-repro).** The per-row submissions filter is one function, `readSubmissionRows` (engine/data/library.ts), used by the app's load and by the generated repro. The repro keeps the rows the app kept, prints each dropped row with its index ("submissions: row 1 dropped, as the app drops it"), and falls back to the built-in catalogue only when the kept rows still fail to resolve. Spec: app/src/repro.test.ts, "keeps the good submission rows, names the dropped one, and solves the layout that used them" (the MINE plus junk-row case).

**What:** `repro.ts` wraps `resolveLibrary` in a try/catch that falls back
wholesale to `BUILT_IN`. Reproduced: a stored graph using a user-submitted part
`MINE`, plus a submissions blob holding the valid `MINE` row and one junk row.
`resolveLibrary` throws on the junk row, the catch discards the whole set,
`MINE` disappears, and the generated file dies at `makeResolver` with
`unknown part id: MINE`.

The real app never sees this: `App.tsx` resolves from
`loadSubmissionsResult`'s `looksLikePart`-filtered rows, which drop the junk
row and keep `MINE`. So the maintainer reading the dump chases a fabricated
error instead of the user's.

Not a regression -- before the guard the same input exited 1 having printed
nothing, which was worse -- but an incomplete fix.

**Fix:** have the repro mirror the app and run the parsed submissions through
the same per-row filter, keeping the good rows. Falling back to `BUILT_IN`
should be the last resort, and the dump should name the rows it dropped.

**Effort:** human ~1h / CC ~15m. **Priority:** P2.
**Depends on / blocked by:** nothing.


## DONE 2026-11-05 — Build mode's buttons are a second button vocabulary (filed by /design-review 2026-10-31, D1)

**DONE 2026-11-05 (branch build-mode-polish).** The outline, filled and text buttons each have one look rule, shared by the editor and build mode (`.build-outline` with `.view-reset`, `.build-primary` with `.canvas-empty-action button`, `.build-text` with `.share-close` and `.put-aside-button`); only sizes stay per place, and build mode's 48px is the new `--target-build` token. Checked in a headless browser: every button in the editor, Share and build mode has identical computed styles before and after. Found on the way: `.build-primary`'s `font-weight: 600` never applied (the size rule's `font: inherit` outranked it), so it was dropped rather than switched on.

**What:** `.build-outline`, `.build-primary` and `.build-text` (app/src/app.css, BUILD MODE block) restate the app's outline and filled buttons instead of sharing them, at 48px rather than 36/44.
**Why:** Two systems drift: the design review already had to re-align radius and hover by hand.
**Pros:** One button rule set. **Cons:** Build mode's 48px floor target needs its own token either way.
**Context:** Found by the design outside voice. Start from `.view-reset` and `.canvas-empty-action button`; add a `--target-build` token for the 48px.
**Effort:** human S / CC S. **Depends on:** nothing.


## DONE 2026-11-05 — Build mode's loading and failure text uses the editor's size (filed by /design-review 2026-10-31, D4)

**DONE 2026-11-05 (branch build-mode-polish).** BuildModeLoader.tsx's four sentences ("Opening build mode…" and the three failure sentences) use `.build-code-line`, build mode's `--build-code` size.

**What:** `BuildModeLoader.tsx` reuses `.canvas-empty-lead`, so "Couldn't load build mode." renders at editor size inside a screen read from 60cm.
**Why:** Build mode's text rule (DESIGN.md rule 12) is `--build-*` sizes.
**Pros:** Readable from the floor. **Cons:** One more class.
**Context:** Design outside voice. Use `.build-code-line` for the sentence.
**Effort:** human S / CC S. **Depends on:** nothing.


# Moved here on 2026-11-16 (the backlog cleanup, docs/plan/2026-11-16-whats-next.md)

Word for word as they stood in `generic-TODOS.md`; only each heading says what became of it.


## SUPERSEDED 2026-11-16 — Community custom-part registry (the community-pieces plan of 2026-11-08 replaced it)

**What:** Let the part database accept community-defined parametric parts, so
users can register 3D-printed track pieces and design with them.

**Why:** A large ecosystem of printable Generic-compatible parts already exists and
is in active use — 45-degree short curves, 60-degree IKEA-compatible curves,
flexible sections, ramps, and a parametric generator. No design tool can touch
any of them. This is the clearest platform play available: each registered part
makes the tool more useful to every other user.

**Pros:** Becomes the hub for the printed-track ecosystem. Compounding value per
part. Targets exactly the large-layout builders this product is aimed at, who
are the people printing custom pieces.

**Cons:** User-submitted part geometry is a new trust and moderation surface. A
wrong dimension makes the solver confidently wrong, which is the one failure
this product cannot afford.

**Context:** The enabling work is already in scope and already decided —
E5 put brand, gauge width and explicit connector geometry in the part schema;
12A made height continuous so arbitrary risers are representable; E6 provides
the backend and a moderation queue. A community part is therefore just another
row with the same fields. No new concepts are required.

What is missing: a submission flow, a review process, and a trust level per
community part. Likely shape: `trustLevel: submitted | community-confirmed |
measured`, surfaced through 13A's dotted-outline channel, which already exists
for exactly this purpose (E5's calibrationStatus).

**Sequencing note (why this is P2 and not now):** the registry's hard problem is
trusting submitted dimensions, and that cannot be solved before trust in your
OWN dimensions is solved. 8A commits to a physical calibration corpus across
five brands. Until that process exists and is proven, there is no yardstick to
judge a community part against. Build the registry after the calibration
pipeline works and community parts can be given a meaningful trust level.

**Effort:** human M → S with AI assistance
**Priority:** P2
**Depends on:** E5 part schema (in scope), E6 backend (in scope), 8A calibration
pipeline (in scope, must be working first)


## REWRITTEN 2026-11-16 — Recorded in the CEO plan, not yet decided (E8 and E10 built; E7, E9 kept as ideas)

These were surfaced as delight opportunities during the expansion ceremony but
not presented as individual decisions. Full context lives in
`ceo-plans/2026-10-06-generic-track-designer.md` under "NOT in scope".

- **E7 Kid mode** (S) — big targets, no menus, drive-the-train only, layout locked
- **E8 Table / room bounds** (S) — declare your table or rug, warn on overhang
- **E9 Photo-based inventory** (L, speculative) — CV counts scattered track by type
- **E10 Symmetry / mirror + auto-complete-the-loop** (M) — pick two open ends,
  fill the gap from inventory


## CLOSED 2026-11-16 by the owner — IP: data provenance and product naming

**2026-11-04 status (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** the naming half is done in what the app shows (product named; Generic brand; trait names "Small-peg"/"Look-alike", app/src/traitNames.test.ts). Still open: Q1 provenance of the transcribed tables, the licence terms of the replica-derived switch seeds, and maker names in internal ids and the `Brand` enum (engine/src/parts/schema.ts). Q2 below was garbled by the brand find-and-replace. Partnership outreach is shelved, so this stays P1 for counsel, not code.

Added 2026-10-06 by /plan-eng-review (D20). Blocks public launch only; blocks
nothing in development.

**OVERDUE (noted 2026-11-01).** This said to settle these questions before the
part database is published in a repo or deployed. Both have happened: the repo
is public and the app is live at woodentrain.world. The questions are still
open and still need counsel.

**What:** two questions needing counsel, not engineering.
1. The part database is a wholesale transcription of the published guide's curated
   measurement tables. Raw measurements of physical objects are facts, but a
   curated compilation of them may be protected. Determine whether permission is
   needed, or whether the data should be independently re-derived from physical
   measurement (which T16's corpus work partly does anyway).
2. Generic is a live trademark. No product name has actually been chosen yet — the
   plan document's title is the reviewer's working label, not a decision — so
   settle whether the eventual name may reference Generic, or whether it must be
   descriptive with a compatibility statement instead.

**Why:** the plan carries a full COPPA and GDPR-K posture and had zero lines on
either of these. The licence question that originally accompanied them is gone:
`@salusoft89/planegcs` was LGPL-2.0-or-later and D19A removed it; the replacement
`yalps` is MIT, so there is no copyleft obligation left in the engine.

**Pros:** surfaces before launch rather than after. The provenance note is needed
regardless for T40's calibration provenance, which commits to recording raw
measurements with their derivation.

**Cons:** neither question is answerable without counsel, so this is a reminder
rather than work. The naming half may be premature.

**Context:** whoever picks this up should know that the engineering-side licence
work is already done by virtue of the D19A engine change. What remains is purely
legal.

**A third question, added 2026-10-22 by /plan-ceo-review (owner's answer to
D2).** The four switch seeds (L, M, O1, P1 in `engine/data/switchSeeds.ts`) are
dimensions read off the 3MF files of one printed replica set,
licensed Creative Commons Attribution-NonCommercial-ShareAlike. Other printed
models were used only to compare against, and one to confirm which end of B and C carries the pegs. The licences seen on
those pages were CC BY-NC-SA, CC BY-NC and the hosting site's "Standard Digital File";
one model's own licence was not checked. A dimension is
probably a fact rather than a work, but the NonCommercial terms matter if the
product is ever sold, and nobody has checked whether reading measurements off a
licensed model is use of the model. This does not unblock K9 (set manifests),
which waits on the published guide question above; printed reproductions supply no
box contents.

**Effort:** human ~1 day of counsel time / CC: not compressible, not an AI task
**Priority:** P1 pre-launch
**Depends on / blocked by:** nothing. Should be settled before any public launch
or before the part database is published in a repo.


## REWRITTEN 2026-11-16 — Inventory: a copyable buy list, and what can I build with what I have

**2026-11-05 (/plan-ceo-review, docs/plan/2026-11-05-inventory-by-part.md):** SETS ARE DROPPED (owner: "not set but rather part dependent"): no set manifests, no "which sets do you own" screen. The owner chose "simple first": Your box was made always reachable and stripped back to a plain list of counts (branch simple-box). Left here for later, when the owner wants "more complex things": a copyable buy list for the layout; "What can I build" checking ready layouts against the box; "These are mine" (raise each count to what the layout on screen uses); about five more ready layouts so that list is worth opening; an owned-only palette filter. The paragraphs below describe the older set-based plan.

**2026-11-04 (D6, P1 → P2, narrowed) (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** per-piece counts, quick-fills, the shortfall list and greyed unowned cards exist (inventoryModel.ts, Inventory.tsx, App.tsx). What remains is only: declaring sets you own (set manifests), a copyable buy list, and rebuild-with-what-I-have.

**What:** Declare which Generic sets you own; constrain the palette to owned pieces;
produce a shortfall buy list when a layout needs more.

**Why:** Answers "can I build this with what I own", and the buy list is the most
obviously shareable and monetisable surface in the plan.

**Pros:** Strong retention and the one feature a parent would forward. Makes
every verdict actionable rather than theoretical.

**Cons:** A second data model and a second source of truth, added to a product
whose first source of truth was numerically wrong until W1.

**Context:** T28 (inventory model, add-by-set manifests, constrained palette),
T29 (shortfall banner with part codes, buy list, rebuild-with-what-I-have),
T38 (which-sets-do-you-own empty state, skippable). T39's rotate-into-overlap
guard was NOT deferred: it folds into the K2 drag work, where collision handling
has to exist anyway, and W9 added planar overlap detection to the core engine.
Deferred at D2 on 2026-10-07.

**Effort:** human ~1 week / CC ~2 hours
**Priority:** P1
**Depends on:** K1 correct tolerances, K4 full part catalogue (set manifests need
the real catalogue to reference)

**2026-11-04 (partnership CEO review, D1):** deferred again; a maker partner
could supply exact set contents, saving the counting. Plan:
docs/plan/2026-11-04-partnership-pitch.md.


## DONE 2026-11-15 — Animated train playback and the completion arc (#273 to #277, #293)

**2026-11-04 (D5):** absorbs "The success state's payoff beat" (archived). The train height it waited on is measured (55).

**What:** Deterministic fixed-timestep train traversal rendered as an animation,
with the completion state and its copy.

**Why:** Watching a train clear a bridge is the one moment that makes the
clearance check believable rather than abstract.

**Pros:** The most convincing possible proof that a layout works.

**Cons:** Needs a vehicle model and an animation loop before the editor can place
the ramps and bridges it would be driving over.

**Context:** C1 had already split T16 into two halves. The headless half (the
connectivity, grade and under-bridge clearance checker) was KEPT in core as K3,
along with C2's vehicle scalars and C5's traversability fixture, because it
carries the entire correctness value. Only the animation and its copy are
deferred: the T16 animation half, N6 (what the animation says on completion) and
G6's completion-arc tone. **G6's other two tone rules were NOT deferred** -
near-miss-is-normal and user-as-witness-on-calibration describe the verdict line
that already exists and stay in core. T40 (invalidate and stop a running
simulation when the layout is edited) travels with this item, since there is no
running simulation to invalidate until the animation exists.
**This reverses N3 on the animation only.** Deferred at D5 on 2026-10-07.

**Effort:** human ~1 week / CC ~3 hours
**Priority:** P2
**Depends on:** K3 levels and bridges, C2 vehicle scalars being measured rather
than estimated (otherwise the animation dramatises a guess)


## REWRITTEN 2026-11-16 — Launch operations and the physical calibration corpus

**What:** Fuzz harness with a logged seed; GitHub Actions running Vitest with the
analytic tier gating before the corpus; feature flags; content-free opt-in
telemetry with a BUILD OUTCOME signal; runbooks; the worker hostile-input
wall-clock bound; and the physical corpus of built-and-measured layouts split
into a calibration set and a never-fitted validation set.

**Why:** The corpus is the only thing that can ever confirm the derived budgets
against reality, and W1 made derivation the basis of every verdict in the
product. A CI gate would have caught the order-independence bug automatically
instead of by inspection.

**Pros:** Turns "the engine has never met real track" from a permanent condition
into a scheduled one.

**Cons:** This is the operational apparatus of a live service, and there is no
service: zero commits, zero users, no deployment. The corpus additionally needs
physical track, floor space and hours of measurement.

**Context:** T14, T21, T22, T23, T37, T45, T47. Two items were NOT deferred:
T46 (calibration provenance - commit raw measurements with their derivation)
moved INTO core K1, because W1's derivation has to record its source and
derivation beside the numbers regardless; and T19/T20 (analytic and property
tests) stay in core as K6 and run locally in under a second.
**W1 already demoted T22** from calibration prerequisite to held-out validation,
so it no longer blocks confident verdicts - it is what would eventually
CONFIRM them. No pre-launch gate was attached. Deferred at D7 on 2026-10-07.

**Effort:** human ~2 weeks / CC ~4 hours, plus physical measurement time
**Priority:** P2 for the ops; the corpus should be P1 before any public launch
claim of accuracy
**Depends on:** K1 derived budgets existing to validate against. Owning or
borrowing a substantial amount of real Generic track.


## CLOSED 2026-11-16 — Accepted residual risks of the 2026-10-07 reduction

1. **No automated regression gate.** CLOSED 2026-10-14 by task X1b: CI now
   runs typecheck, tests and build on every push. Left in place because the
   accepted-risk record should show what was accepted, not be rewritten.
   As originally written: the 21 tests run only when someone
   remembers. A solver regression ships silently until the next manual run.
2. **The engine has never met real track.** W1 replaced a guess with a
   derivation from two agreeing published sources, which is better evidence but
   is not measurement. A wrong published dimension now propagates with a
   `published` label and no dotted-ring hedge.
3. **Single-player only.** No library, so no compounding value from other
   people's layouts for as long as the core takes.
4. **FAIL is a dead end.** T11 names the binding joints but proposes no fix.
5. **A pathological layout can freeze the tab.** T14's time budget was deferred.


## REWRITTEN 2026-11-16 — Calibration readings still open (umbrella): the history

**2026-11-04 (D6, P1 → P2 umbrella) (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** the open physical readings, each with its own entry or sheet question: ramp run 225 vs 216 ("The ramp measures 225mm"), Q2 bend, a real switch ("Measure a real Generic switch"), F4 support span ("Check that raised track is held up"), F2 train under a bridge (the P1 clearance entry), plank thickness, Q1b. The rise is no longer null: 61 (measurements.ts q5).

**2026-11-12:** the sheet's "Still open" list (`docs/calibration-sheet.html`) is
the current list. Besides the readings above, it holds the ruler heights of the
pieces built from photos: S1 and S2 (the elevated station and its arch), M1
(the metro tunnel, T1 to T4 and the 55mm train pushed through; T4, the inside
of the red tube, decides the fit, #262), M2 (the metro station), B1 (the
bowstring bridge), K1 (the cargo crane) and D1 (the Action Tunnel Station).
Each piece stays marked unverified until its heights are read.

**MOSTLY DONE (2026-10-30, PR #72).** The afternoon happened. Joint stretch
and the train's height are measured and in `engine/data/measurements.ts`; the
Q1 loop closed and carried a train, which is where the Generic bend limit now
comes from (`engine/data/bendLimit.ts`, status `inferred`). Still `null`, and
each read as published or estimated until someone measures it: the bend
itself (Q2, `bendDeg` or `bendSidewaysMm`/`bendOverMm`), the ramp rise and
plank thickness (published 64 and 12), the Q1b loop's leftover gap, and a
real switch's three figures (`throughMm`, `chordMm`, `offsetMm`; its own P2
below). Every one of them gets an engineering diagram on the sheet before it
is asked for. The history below is kept as written.

**2026-11-01.** A layout of interlocking loops that closes on the floor was
refused by the bend checker's work budget, not by the calibration (#105, #106).
Q2 now has its plan-view drawing on the calibration sheet; a Q2 reading would
replace the inferred limit with a measured one.

> **READY TO MEASURE 2026-10-24.** The path from the floor to the engine is
> built: `docs/calibration-sheet.html` to print, `engine/data/measurements.ts`
> to copy it into, `engine/data/calibration.ts` deriving the give and the
> train height from it (marked measured only where read), and `bun run
> calibration` reading every answer against CALIBRATION.md's contingency table,
> with the Q1 loop checked against the engine's verdict. What is left is the
> afternoon itself.

**What:** The physical measurement afternoon described in `CALIBRATION.md`, and
every decision that depends on its numbers: the per-joint slop budgets, plank
width, plank thickness, the ramp rise, vehicle height, the 216mm datum, and the
bridge clearance margin.

**Why:** Every non-exact verdict the product gives is arithmetic on a guess.
`engine/data/generic.ts` labels every slop budget `estimated`. The bound's hedged
middle band, the footprint overlap tier and the whole elevation feature all read
numbers nobody has measured.

**Pros:** It is the cheapest item on the list by a wide margin, one afternoon,
and it unblocks more than anything else of comparable size: the tolerance band,
the footprint tier, the 8L+8R tangency via footprints, the ramp datum and the
clearance margin.

**Cons:** It needs real track, floor space and an afternoon, and it cannot be
done by an agent. It is the only item on this list with that property.

**Context:** Deferred by direct user instruction on 2026-10-08: "forget the
tolerance and the calibration document for now (put it in the backlog)." This
supersedes the measure-first recommendation two consecutive outside voices made,
and it was taken with the consequences stated. What follows from it:

- **Elevation, layers, ramps and clearance are deferred entirely.** Q5's own
  contingency row says single-level bridges become impossible if the clearance
  margin is zero or negative, and the margin is 8mm composed of three unmeasured
  figures. The layer work cannot start without that number.
- **The footprint overlap tier is deferred** with plank width, which
  `CALIBRATION.md:76` records is not the gauge and is written down nowhere.
  Decision D10 (2026-10-08) replaced it with an exact coincident-connector check
  that needs no measurement and catches both known false passes, so the loss is
  smaller than it was: what remains uncovered is near-miss adjudication and
  visible non-joint crossings.
- **The verdict stays permanently hedged** for anything that is not an exact
  closure. `NEEDS_GIVE` reports numbers derived from `estimated` budgets and says
  so; that disclosure is now permanent rather than temporary.
- **One measurement escaped the backlog by becoming a task dependency.** Under
  decision D9 (2026-10-08) switches are accepted as approximate, with a stated
  per-switch error. You cannot state an error you have not measured, so the
  switch's diverging-leg angle and lateral offset must be obtained before
  switches ship. Published Generic dimensions may answer it without calipers.

**Effort:** human ~1 afternoon / CC ~0 (this one does not compress)
**Priority:** P1
**Depends on:** real track and floor space


## FOLDED 2026-11-16 into the calibration entry — Measure a real Generic switch

**Still open, no longer blocking (2026-11-01).** Switches shipped as
unverified seeds read off printed models, so the catalogue row this entry
said could not ship did. A measured switch would turn its seed into a
verified part; Q6 on the calibration sheet asks for the three figures.

**What:** With a physical Generic switch and calipers, record its through-road
length, diverging-leg radius and arc, and the heel offset. Then compute the
rounding residual against the 22.5-degree lattice.

**Why:** Task T1 (2026-10-13) searched four source classes and found no citable
figure: manufacturer pages for 33344 and 33346, retailer specs, patent and
dimensioned drawings, and the published track guide, which is the
citation behind every other dimension in the catalogue. The full enumeration is
in `CALIBRATION.md` Q6. Without a number, the switch catalogue row cannot ship
and the engine's switch support stays reachable only from tests.

**Pros:** Unblocks the one feature the graph rewrite was built for. The engine,
the heel semantics, the editor and the per-cycle machinery are all finished and
tested; this is the only missing input.

**Cons:** Needs a physical part and calipers, so it cannot be done from a
keyboard. The residual may turn out to exceed E1's ceiling, in which case the
honest answer is that a Generic switch is not modellable on this lattice.

**Context:** Filed under the EXISTING calibration deferral rather than as new
scope, because the user deferred measurement work on 2026-10-07 and the fifth
CEO review retired four elevation tasks for following it. `CALIBRATION.md` Q6
lists the four measurements and the method. E1 of the fifth eng review makes
the residual the number a verdict gets checked against, so recording it is the
point, not an extra.

**Effort:** human S (one afternoon with the part) / CC: cannot be done by CC.
**Priority:** P2.
**Depends on / blocked by:** owning a Generic switch. Blocks task T2 entirely.


## REWRITTEN 2026-11-16 — The review backlog (A to F), as filed 2026-10-14

**2026-11-04 (D5):** item B absorbs "Five dead exports" (still dead: walkFloat, nominalFinalHeading, bounds in fk.ts; VEHICLE in generic.ts). Item A's profile copies move to "The track profile has a third, unpinned copy".

The /ship pre-landing review ran six specialists over this branch. Seven criticals
were fixed in the ship itself and the mechanical findings folded into one commit.
These are the rest: real, evidenced, and each needing a decision rather than an
edit. Grouped so one sitting can close a group.

**A. Duplicated constants with no owner.** The same failure shape the project has
already shipped: a value retyped in two places with a comment claiming the other
enforces it.
- `BRAND_LABEL` is byte-identical in `App.tsx` and `SubmitPart.tsx`, and the brand
  list is duplicated as `BRAND_ORDER` / `BRANDS` with the same six members in the
  same order. Adding a brand is a compile error in both; RENAMING one's label
  silently diverges the palette heading from the form's dropdown.
- The Generic profile (40 / 12 / 26 / 6) exists three times: named but unexported in
  `generic.ts`, as bare literals on every `thirdParty.ts` seed, and again as
  `PROFILE_DEFAULTS` in `SubmitPart.tsx`. The slop budget is duplicated the same
  way (`ESTIMATED_SLOP`, `UNMEASURED_SLOP`, an inline literal). A corrected
  measurement has to be applied in three files and nothing fails if one is missed
  -- which is exactly how `gaugeWidthMm` held the plank width for three days.
  **Needs:** a decision on where shared data constants live. `schema.ts` owns
  `Brand`; `generic.ts` owns the figures.

**B. Dead exports, and one test keeping a function alive.** `walkFloat`, `bounds`,
`nominalFinalHeading` (`geom/fk.ts`), `breakWeld` (`layoutModel.ts`), `VEHICLE`
(`generic.ts`), `IKEA_CONNECTOR` (`thirdParty.ts`), `KNOWN_ABSENT`,
`SWITCH_GEOMETRY_ABSENT`, `STRAIGHT_CITATION`, `CURVE_ARC_CITATION` (`sources.ts`),
`INITIAL_SELECTION` (`editorReducer.ts`), `weldsTouching` (`graph/edit.ts`),
`presetLayout` (`presets.ts`). **Check U5 before deleting `breakWeld`:** it is in
U5's file list, so U5 may be about to give it its first caller. `graphEdit.test.ts`
guards `removeWeld` at the engine boundary and should stay regardless.
**Needs:** `/test-audit`, and the U5 question answered first.

**C. Tests pinned to paths the user no longer takes.**
- `presets.test.ts` solves through `solveLayout(presetLayout(...))`, the CHAIN
  engine the app no longer calls. The app builds a preset through `editorReducer`
  and judges it with `solveGraph`/`viewOf`, so a regression in the reducer's preset
  wiring leaves the pin green. `presetLayout` exists only to feed it.
- Only the blank-canvas preset is solver-checked. Stadium's `note: 'exact'` and
  Near miss's `'72mm short'` are rendered as button titles and never verified.
  Measured today: Stadium closes exactly, Near miss is 72mm. Both true, both would
  silently become lies.
- `graphFeasible.test.ts` asserts `clashes(g).length > 0` where the chain engine's
  equivalent pins exact counts and pairs. Measured: 8L+8R returns exactly 1 clash
  at [0,0]; two stacked A pieces 2; the open 16-run 9.
- `analytic.test.ts` holds published figures as test-local literals (`OUTER = 222`,
  the 40/12/26 profile) that exist in `sources.ts` only inside free-text
  `conflict.note` strings, where no test can read them. K2 is the task that fixes
  this properly.
- `cycles.test.ts` asserts wall-clock `< 250ms`, which on a shared CI runner turns
  a correct refusal into a red build. The structural assertions beside it already
  prove the behaviour.

**D. Input validation: bounds, not just types.** `loadGraph` checks shapes but no
magnitudes. A weld port passes on `typeof === 'number'`, so `NaN`, `-1`, `2.5` and
`1e9` are written into the accepted graph and `portFrame` throws on the next solve
-- the loader declares a blob valid and the app crashes to the boundary on every
load. `pieceId` has no length or charset bound (this is what made the repro
injection reachable), and `Number.isInteger(1e300)` is true so an anchor can sit
1e300 lattice units away. Welds are also spread (`{ ...a }`), carrying unknown
attacker-chosen properties into saved state. **Same class as E9**, which this ship
fixed for `heading` only.

**E. Design and accessibility, needing layout work.**
- `.inventory-row` is a 6-column grid with three `nowrap` columns inside a
  `minmax(260px, 1fr)` track, so its min-content exceeds its area and the refusal
  message -- the visible half of the guard against a discarded inventory -- is
  clipped and painted over by the next row.
- No `<h1>` in the application document; the editor jumps straight to `<h2>`.
- `.port:focus-visible` and `.port.is-armed` have equal specificity, so a port
  armed from the KEYBOARD composes into the heavy ink disc task W3 removed. Mouse
  users are unaffected, which is why it survived.
- `SubmitPart` refuses a number with no message at all: `parseMm` returns null for
  `12,5` (a European decimal comma) and the only signal is a disabled button at
  0.4 opacity, about 2.37:1. The inventory panel solves the same problem properly
  one file over.
- At >=1000px `.notice` has a column span but no row, so the data-loss notice
  renders at the BOTTOM of the screen under the palette; `.shortfall` is not in the
  span list at all.
- The inventory count field is 32px until `pointer: coarse`, while DESIGN.md rule
  10 holds 44px unconditionally on data entry and `.submit-field input` does.

**F. One engine duplication.** `solveGraph` recomputes `placeAll` even though
`App.tsx` already memoized that exact placement and passed it to `renderGraph`, so
the drawing and the verdict build two separate forests and agree only because
`spanningForest` is deterministic -- the property `forest.ts` says it exists to
guarantee by construction. ~0.6ms at 160 pieces, so this is correctness-shaped, not
speed-shaped. Also `differential.test.ts` re-implements the UI's verdict precedence
and gets it BACKWARDS (returns `reason` before checking clashes, where `viewOf`
promotes IMPOSSIBLE), so the harness the file calls "the gate" cannot see the
divergence it exists for.

**Effort:** human ~2d / CC ~3h across all six groups. **Priority:** P2.
**Depends on / blocked by:** B waits on U5's intent for `breakWeld`; the
`analytic.test.ts` half of C is K2's job.


## REWRITTEN 2026-11-16 — Canvas virtualisation and a layout-size cap: the measurements

**2026-11-04 (D6, P1 → P3, merged) (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** a 10,000-piece canvas ceiling (TrackCanvas.tsx:59,818) and the linear engine already stop the freeze; share links cap at 500 pieces. What remains: decide a load cap in `loadGraph`, and memoise `maxLayers` (TrackCanvas.tsx:536-541), a ten-minute fix.

**What:** this branch made the engine linear and the freeze relocated one
layer out, into the render that consumes the engine's answer in the SAME
synchronous pass. MEASURED on 120,000 loose straights -- 3.72M stored chars,
inside a ~5MB quota, which `loadGraph` accepts with `discarded=none` and
`droppedAnchors=0`:

```
  loadGraph                        29ms
  placeAll      (canvas memo)      58ms
  renderGraph   (canvas memo)     185ms
  solveGraph    (verdict memo)    274ms   <- the whole engine
  layoutTrust                       5ms
  saveGraph     (per-edit effect)  25ms
  TrackCanvas render             3153ms   <- 1.2M SVG elements, 96MB markup
```

At 161,000 pieces (4.99M chars, exactly at quota) the canvas is 5,172ms and
1.6M elements. The 3,153ms figure is `renderToStaticMarkup`, which is a FLOOR:
client-side reconciliation plus SVG layout and paint of 1.2M nodes, each free
port carrying `onClick`/`onKeyDown`/`tabIndex`, is strictly worse and is an
OOM candidate.

**Why it is worse than slow:** it is inside render, so it is an uncatchable
frozen tab. `ErrorBoundary` never fires, `GRAPH_STORAGE_KEY` is never cleared,
and every reload repeats it. That is the identical shape of the two P0s this
branch just closed.

**THIS IS THE FOURTH TIME THE BOUND HAS MOVED ONE LAYER OUT, and that is the
finding, not the milliseconds.** Round one capped subsets while per-subset
cost still scaled with pieces. Round two capped enumeration work while the
all-pairs clash scan ran upstream of it. Round three grouped that scan while
the coincident case stayed quadratic. This round made the clash scan linear in
every case, and the render downstream of it is now the binding constraint. The
engine comment that says "`solveGraph` end to end on the 8,000-piece lapped
run is 63ms" was and is true, and it invited exactly the inference that the
tab was fine; it now carries this measurement beside it.

**Mechanism:** `app/src/TrackCanvas.tsx` emits roughly 10 DOM nodes per piece
-- `maxLayers x segments` `<path>` plus 3 `<circle>` per FREE port -- with no
cap and no virtualisation. `maxLayers` and the inner `layers(s.partId)` are
computed in the render body rather than a `useMemo`, so every render repeats
`4 x segments` `resolve()` calls and allocations on top.

**Pre-existing:** `TrackCanvas` is untouched by this branch. It is filed as a
P0 anyway because the branch is what made it binding, and because a reader of
the engine's own numbers would now conclude the opposite.

**HALF FIXED 2026-10-15. The freeze is gone; virtualisation is not done.**

`CANVAS_SEGMENT_CEILING` is 10,000 pieces (`app/src/TrackCanvas.tsx`). Above
it the canvas renders "Too much track to draw: N pieces" with a line saying
the layout is still there and still checked, instead of drawing. The verdict
is unaffected, because `solveGraph` does not depend on the canvas -- so a
layout too big to draw is still CHECKED, which keeps the refusal honest.

The value is set from measurement rather than taste. MEASURED through
`renderToStaticMarkup`, which is a floor for what a browser then does:

```
   2,000 pieces     76ms    40,000 tags    1.6MB
   5,000 pieces    169ms   100,000 tags    4.0MB
  10,000 pieces    453ms   200,000 tags    8.0MB
  20,000 pieces    793ms   400,000 tags   16.1MB
  40,000 pieces   1474ms   800,000 tags   32.2MB
```

About 20 tags per piece, linear. 10,000 is where the draw stays under about
half a second, and it is more than an order of magnitude above the few
hundred pieces the cap entry below calls a big floor. Three specs pin the
boundary at exactly the ceiling, one piece above it, and the copy.

A note on the number first proposed: 20,000 was offered as "about 200,000
SVG nodes, measured ~250ms", which was an extrapolation from a LAPPED run --
fewer free ports per piece, so fewer circles per piece. Measured directly on
loose pieces, 20,000 is 400,000 tags and 793ms, and 200,000 tags is 10,000
pieces at 453ms. The measurement moved the value.

**WHAT REMAINS:** virtualisation -- draw what the viewport covers, so no
layout is ever too big to open and the ceiling can go away rather than being
tuned. Also `maxLayers` and the inner `layers(s.partId)` are still computed
in the render body rather than a `useMemo`, so every render repeats
`4 x segments` `resolve()` calls under the ceiling as well as over it.

**Effort:** human ~3d / CC ~4h for virtualisation; human ~1h / CC ~10m for
the render-body memo. **Priority:** P1 now the freeze is bounded (was P0).
**Depends on / blocked by:** nothing; the ceiling makes it safe to take later.

**FIXED IN THIS BRANCH, the one part that was one line:**
`Math.max(...segments.map(...))` passed one argument per segment. MEASURED:
node/V8, the engine Chrome runs, throws `RangeError: Maximum call stack size
exceeded` at 125,000 arguments; bun/JSC, which is what `vitest` runs under,
returns fine at 161,000 -- so every spec in this repo passed while the browser
threw. A 161,000-piece blob is 4.99M chars and loads clean, so the throw
landed inside render, `ErrorBoundary` painted the crash screen, and its only
exit (`clearAndReload`) also deletes the inventory and the submitted parts,
which `library.ts` records as impossible to recreate. Replaced with a loop.

### DONE — `CYCLE_RANK_CEILING` refused layouts the work budget answers in microseconds (P2, fixed 2026-10-15)

**What:** MEASURED -- 21 separate 8-curve circles, 168 pieces, every loop
closing exactly, reachable by 21 weld clicks with no stored layout involved:
`TOO_MANY_LOOPS`, "21 independent loops is more than this can rank", in 1.1ms.
Twenty of the same circles answer `ok` with `closesExactly: true` in 4.8ms.

**Why it matters:** the ceiling was sized when the enumeration was `2^rank`
subsets, and this branch deleted that justification -- the comment saying
`2^rank` "no longer describes anything" -- while keeping the number. On a
two-port catalogue `sharingGraph` is all zeros, the walk emits exactly `rank`
singletons, and those 21 circles spend 168 of a 150,000-slot budget. The
work budget is the real bound now; 20 is a leftover.

`SUBSET_MASK_BITS` is 31, so the int32 mask supports a ceiling of 31 with no
representation change. Invariant 3 is not broken -- the verdict is a grey "?"
rather than a green pass, and clashes are still reported on this branch -- but
refusing a correct, ordinary layout is the mirror of it, and 21 loops on a big
floor is not an exotic shape.

**FIXED 2026-10-15.** `CYCLE_RANK_CEILING` is now `SUBSET_MASK_BITS`, so the
ceiling IS the representation and the two can no longer drift apart. MEASURED
after: 21 circles answer `closesExactly` in 5.4ms, 31 circles in 2.1ms, and 32
are refused in 1.4ms. The work budget does the bounding, which is the only
bound with a measurement behind it.

**Effort:** spent, CC ~20m. **Priority:** done.


## FOLDED 2026-11-16 into the calibration entry — Check that raised track is held up (built; waits on F4)

**2026-11-06: built, waiting on F4.** `engine/src/graph/supports.ts` checks every raised stretch between held places (a track support whose 25×52 footprint the centre line crosses, turned within 22.5°; a ramp's high end; a structure's raised road) against F4, read from `measurements.ts` `f4.supportGapMm`. Owner decisions: a warning with the X naming the piece, the verdict unchanged; track ending in mid-air reported as not checked; placement by centre line, roughly along. While `f4.supportGapMm` is null the verdict still says "supports are not checked". Filling it in turns the check on with no code change. Tests: engine/test/supports.test.ts, app/src/supportsNote.test.ts.

**2026-11-04 (D5):** absorbs "Support and pier modelling" (archived). Measurement: calibration sheet F4, the span between two supports.

**What:** Replace the blanket "Raised track: supports are not checked." note with a real check: every raised piece has a track support (TS), a riser or a structure under it within a measured reach, and the verdict names the piece that isn't held up.

**Why:** It is the last part of "will this layout work?" the app doesn't check, and the measured track support (PR #130) makes it checkable.

**Needs first:** one measurement from the owner, with a diagram: how far a raised straight can reach past its support before it sags or tips. Without it the check would guess and raise false alarms.

**Context:** Deferred in docs/plan/2026-11-03-next-parts-ceo-review.md (D4), to keep that round on decorated pieces.

**Effort:** human L / CC M
**Priority:** P2
**Depends on:** the reach measurement


## DONE 2026-11-07 — A short list when a piece has three or more versions

**Built 2026-11-07** with the metro tunnel and station, which gave the long straight (D) its third version: `app/src/VersionList.tsx`, tested by `app/src/versionList.dom.test.tsx`; the tripwire is retired.

**What:** Design 3A says a piece with three or more versions to swap to shows a short list instead of one "Make it a <name>" button each. Today the strip shows one button per version.

**Why not now:** no piece has more than one version yet (A: station, D: tunnel, HP: level crossing), so the list could not be shown or tested on a real piece.

**Designed 2026-11-04** (/plan-design-review, D3-D9): the whole family with the current piece marked "now", one "Make it…" button that opens it in place, blocked versions greyed with their reason, the standard keyboard flow. Spec in docs/plan/2026-11-04-version-list-and-trait-names.md. `app/src/versionListTripwire.test.ts` fails the day a piece reaches three swaps.

**Context:** app/src/App.tsx `selectedSwaps`; docs/plan/2026-11-03-next-parts-ceo-review.md, design decision 3.

**Effort:** human S / CC S
**Priority:** P3
**Depends on:** a third version of one base piece


## DONE 2026-11-11 — "Checked with catalogue sizes." overstates photo-read pieces

**Done:** the sentence now follows the verdict's unmeasured count (`sizesLine`, app/src/linkWords.ts): "Checked with catalogue sizes, and estimates for the pieces nobody has measured." when some are, "Checked with estimated sizes: nobody has measured these pieces." when all are. It says estimates, not photos: unmeasured also covers guide figures and print-file meshes. The community case (community-pieces plan, design D8) is still that plan's.


**What:** the friend screen's always-shown sentence (`CATALOGUE_SIZES`, app/src/linkWords.ts:36) names photo-read sizes when a shared layout uses an unverified photo-drawn piece: "Checked with catalogue sizes and sizes read from photos."
**Why:** DESIGN.md rule 13 makes this sentence the friend screen's promise; today it is untrue for layouts using the stations, crane, tunnel and other photo pieces.
**Pros:** the trust screen stops overstating. **Cons:** one more sentence variant beside the community one (docs/plan/2026-11-08-community-pieces.md, design D8).
**Context:** found in the design review of the community-pieces plan; that plan fixes the community case only. Start at linkWords.ts and FriendScreen.
**Effort:** human S / CC S. **Priority:** P2. **Depends on:** nothing.


## DONE 2026-11-05 — Wire the approved analytics (kept as built, D9 of 2026-11-14)

**2026-11-04, built (branch analytics), site code set (`raduuuuu`):** `app/public/count.js` (the reviewed copy, sha-pinned), `countedPath`/`counterPath`/`counterTag` in app/src/linkFragment.ts, inserted by main.tsx in production only. `GOATCOUNTER_CODE` is `raduuuuu`. Left: after the deploy, open the GoatCounter dashboard and confirm visits arrive, and that a shared link shows as `/shared-link`.

**2026-11-05, actions added (branch count-actions):** the owner reversed P4's "visits only" ("what people do in the app"). Ten fixed action names are sent as GoatCounter events (`ACTIONS` in app/src/linkFragment.ts): share, build-it, view-3d, preset, your-box, add-part, save-file, open-file, open-in-editor, and works (the user's own layout first saying "This works", once per page load). Each event carries its name and title only; never the layout, a piece count or the page title. They show on the dashboard under paths starting `action/`.


**What:** wire the privacy-friendly page counter exactly as approved on 2026-11-01 (docs/plan/2026-11-01-editing-tjunction-analytics.md); no other tracking.
**Why:** the app is live and nothing says whether anyone opens it, builds a layout or reaches a "this works" verdict; every other priority is a guess until then.
**Pros:** already designed and approved; small. **Cons:** little to learn until people know the app exists.
**Context:** approved 2026-11-01, never built, never tracked; surfaced by all three reviewers of (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md).
**Effort:** human S / CC S. **Priority:** P2. **Depends on:** nothing.


## SHELVED 2026-11-04 — Maker data pack (D3)

**What:** a documented file format, a sample file and an importer: a maker's
official sizes, part numbers and joint tolerances turn their pieces from
`unverified` to `published`, with the verified mark.
**Why:** the one thing only a maker can give; it makes every verdict on their
track exact instead of "exact about an estimate".
**Pros:** turns "share your data" into "fill in this sheet". **Cons:** pays off
only when a maker sends figures.
**Context:** reuses `DimensionSource`, the verified mark (`measured.ts`) and the
trust register. Shape it around the maker's own format (CAD, spreadsheet).
**Effort:** M. **Depends on:** a maker's reply.


## SHELVED 2026-11-04 — Links from the shopping list to the maker's shop (D4)

**What:** each piece a layout is short of links to the maker's shop by part
number, or fills a basket.
**Why:** a sales channel a maker can measure.
**Pros:** part numbers already exist on several pieces. **Cons:** brand-linked
selling needs the partner's agreement and terms.
**Context:** builds on the shopping list in the P1 inventory entry.
**Effort:** S. **Depends on:** the P1 inventory by set; a partner agreement.


## SHELVED 2026-11-04 — Set planner (D5)

**What:** pick a boxed set; see layouts it builds that close exactly, and
"add these pieces to build this bigger one".
**Why:** shows what only an exact closure engine can promise; sells add-ons.
**Pros:** the clearest "only we can do this" story. **Cons:** needs set
contents and a layout generator that does not exist.
**Context:** exact closure in `engine/src/geom/cyclotomic.ts`; the 670-layout
corpus (`app/test/verdictCorpus.ts`) shows the kind of layouts to search.
**Effort:** L. **Depends on:** the P1 inventory by set; set contents.


## SHELVED 2026-11-04 — Mark each joint where two systems meet (D6)

**What:** on the canvas, in the verdict and in build mode, mark every joint
where pieces of two systems that don't join meet, instead of one sentence for
the whole layout. Adapter advice waits for a measured adapter.
**Why:** answers "my old track doesn't fit the new set" precisely.
**Pros:** uses facts the app already holds (`brandFit`, each piece's system).
**Cons:** a new kind of canvas mark to design (DESIGN.md rule 11).
**Context:** `layoutTrust`'s 'brands-do-not-join' note in `engine/src/joints/trust.ts`.
**Effort:** S. **Depends on:** nothing; ideally a measured adapter.


## SHELVED 2026-11-04 — Embeddable "try this set" view (D7)

**What:** a view a maker can put on a product page: the layout, the verdict,
the 3D view and "open in the full planner".
**Why:** puts the app in front of the maker's customers.
**Pros:** the read-only link view (`LinkRoute.tsx`) already does most of it and
stands in for it in a demo. **Cons:** embedding in other sites brings sizing
and security work.
**Effort:** M. **Depends on:** a maker agreeing to embed it.


## SHELVED 2026-11-04 — Maker names behind a licence switch (D8)

**What:** per track system, a switch that shows the maker's own names and part
numbers when a licence allows; off by default, trait names otherwise.
**Why:** a partner may want their brand visible.
**Pros:** small: one name table per system. **Cons:** no maker names may enter
the code before a signed licence (`app/src/traitNames.test.ts` guards this).
**Effort:** S. **Depends on:** a signed licence.


## SCRAPPED 2026-11-05 — Backend: library, publish, moderation, auth

**2026-11-05, SCRAPPED (/plan-ceo-review, docs/plan/2026-11-05-see-shared-layouts.md):** the owner's rule was "any legal risk, scrap it". A public page of approved, unattributed builds still carries the sender's IP address (GDPR, COPPA), needs the sender's licence to show the layout, makes the owner the publisher (DSA duties in the EU), and widens the open IP P1. A private inbox and the full library were declined with it. Reopen only with counsel's answer on these four points.

**2026-11-04 (D6, P1 → P3) (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** sharing already works without a server (app/src/shareLink.ts, LinkRoute.tsx); no user asks for a library yet; blocked by "dimensions.status is a self-asserted claim" and by the IP entry anyway.

**What:** Hono API with email-only auth, library browse and fork, publish to a
pending queue, admin moderation, server-side inventory filtering, stable cursor
pagination, idempotent publish.

**Why:** The library is the one feature that compounds: every published layout
makes the tool more useful to everyone else.

**Pros:** Compounding value. The design decisions are already made and recorded
(D4 chose the optimistic publish view; G5 specified the pending-link page rather
than a bare 404; G6 specified the one-tap rename nudge), so none of that has to
be re-decided.

**Cons:** Accounts, a database, hosting, a moderation queue and a children's
privacy posture, all taken on at once. Publishing a tool whose verdicts are
wrong distributes the error.

**Context:** T34, T35, T36, T42, T43, plus design rows G3 (dense library rows,
shortfall text never truncated), G4 (author sees their layout as published
immediately while it stays out of public browse), G5 (pending-link page).
Local save/load (K5) was KEPT in core, so work surviving the tab closing does
not depend on this. A shareable layout file covers much of what sharing needs
without operating a service. Deferred at D3 on 2026-10-07.

**Effort:** human ~3-4 weeks / CC ~1 day, plus ongoing moderation duty
**Priority:** none (scrapped)
**Depends on:** K5 layout document (the wire format is the file format), and the
IP questions below should be settled before anything is published publicly


## REWRITTEN 2026-11-16 — Phone editor: deferred by the design review of 2026-11-15

Found by `/design-review` on the live phone editor (390x844 and 844x390,
headless, touch). Seven findings were fixed in the review's own pull request;
these were left because each needs a decision or a real phone.

- **A joint's tap area on the plan is 12 to 25px on a phone.** "Break this
  joint" is drawn in millimetres, so on a fitted plan it is far under the 44px
  floor (DESIGN.md rule 10). Free ends got a pixel floor (`endHitRadiusMm`);
  joints did not. A bigger joint target competes with selecting the piece
  under it, so which wins needs deciding first. The layout list breaks a
  joint by name meanwhile. **Effort:** S. **Priority:** P2.
- **Done since:** the sideways verdict no longer scrolls inside its column
  (the controls take the column's whole height), and a card's size and note
  are 13px in the Pieces sheet.
- **Not checked by the review, for the real-phone pass (T12):** Escape and
  focus in the sheets, the keyboard over a panel's field, a screen reader,
  a second phone browser, "Next end" at a real scale.


## DONE 2026-11-16 (version 1.0.3) — Hardening: what was left of the review backlog of 2026-10-14

**Done 2026-11-16 (branch hardening).** A piece id read from storage, a link
or a file is letters, digits, `_` and `-`, one to 64 (`isPieceId`,
app/src/layoutStore.ts); every id the app writes is `p` and a number, so
nothing it wrote is refused, and a refused layout goes to the rescue copy.
Add a part reads `12,5` as 12.5 and says why it refuses anything else. The
count field in Your box is 44px on every screen, keeps a typo on screen and
refuses it in words on a line of its own: in a browser the old number field
turned a typo into "I own none" with no word, and its "needs a number" could
never appear. On a wide screen a notice sits over the plan and the shortfall
line under the verdict, each in a row of its own. The editor's identity line
is its `<h1>`. The clash counts are pinned exactly and the wall-clock
assertion is gone. No piece-count cap was added (see the canvas entry).

What is still open of the review backlog filed 2026-10-14, re-checked against
the tree on 2026-11-16. The original entry, groups A to F, is in the archive.

- **Load bounds (group D).** Ports and coefficients are now bounded and a
  weld keeps only its two fields (`app/src/layoutStore.ts:125,140,410,458`).
  Still open: a `pieceId` has no length or character bound. The bound must
  accept every id the app itself can have written, so no layout that loads
  today is refused; only a hand-edited or hostile blob falls outside it, and
  that one goes to the rescue copy with its notice. No piece-count cap is
  added here: a cap that refuses layouts the editor can save is a breaking
  change, and it stays with the canvas entry in part 3.
- **Add a part refuses a decimal comma with no message (group E).**
  `parseMm` (`app/src/SubmitPart.tsx:44`) returns null for `12,5` and the
  only sign is a greyed button.
- **A notice on a wide screen (group E).** At 1000px and up `.notice` has a
  column and no row (`app/src/app.css:1593`), so a data-loss notice can sit
  under the palette; `.shortfall` is not in that list.
- **The inventory count field is 32px** until a coarse pointer
  (`app/src/app.css:1193`); DESIGN.md rule 10 holds 44px on data entry.
- **The inventory row's refusal message** can be clipped by the row's grid.
  Re-check in a browser before fixing.
- **The editor has no `<h1>` (group E).** The identity line is a paragraph
  (`app/src/AppName.tsx:14`); the only `<h1>` in `app/index.html` is inside
  `noscript`. Build mode, the friend screen and the crash screen have one.
- **Tests pinned loosely (group C).** `engine/test/graphFeasible.test.ts`
  asserts "more than zero" clashes where the counts are known (1, 2 and 9);
  `engine/test/cycles.test.ts:192` asserts a wall-clock time.

Fixed since it was filed, so not here: the duplicated brand labels (A), the
armed port's focus ring (E), one placement shared by the drawing and the
verdict (F), the differential test's verdict order (F), and the ready
layouts' tests, which now take the path the app takes (C).

**Effort:** human ~2 d / CC ~3 h. **Depends on:** nothing.


## DONE 2026-11-16 (version 1.0.4) — Checkup leftovers

**Done 2026-11-16 (branch checkup-leftovers).** Every action in the three
workflows is pinned to its full commit with its version in a comment. The six
exports nothing called are gone (`KNOWN_ABSENT`'s content stays as a comment
in sources.ts). The crash screen reports and clears every key the app keeps,
from the one list of them (`MOVED_KEYS`, app/src/oldNames.ts), by the owner's
decision of 2026-11-16: all six missing keys, both ways, the layout put aside
included, and the confirming button says so.

From the deep checkup of 2026-11-15 (issue #209):

- **Actions are pinned by tag, not by commit,** in `ci.yml`, `checkup.yml`
  and `pages.yml` (the security audit's one finding, low).
- **Exports nothing calls:** `nominalFinalHeading` and `bounds`
  (`engine/src/geom/fk.ts`), `VEHICLE` (`engine/data/generic.ts`),
  `KNOWN_ABSENT` (`engine/data/sources.ts`), and two kept alive only by a
  test: `weldsTouching` (`engine/src/graph/edit.ts`) and `adapterNote`
  (`app/src/VerdictLine.tsx`).
- **The crash screen's key list** covers 5 of the 10 stored keys
  (`app/src/ErrorBoundary.tsx:81`, `app/src/storageKeys.ts`): decide which of
  the other five a crash report should carry and which "clear" should remove.
  The owner decides key by key, in the pull request.

**Effort:** human ~1 d / CC ~1 h. **Depends on:** nothing.
