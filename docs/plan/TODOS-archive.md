

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

## DONE 2026-11-05 — Pick a piece in 3D and it is selected in 2D (filed by /plan-ceo-review 2026-10-31, D5)

**DONE 2026-11-05 (branch pick-in-3d).** A click or tap on a piece in the 3D view selects it in the editor, so 2D shows it selected; the selection's own announcement says so ("Selected Piece n: …"), and the view stays in 3D. A press that moves more than 5px is a turn or a pan and picks nothing; a click on the table, a building or empty space does nothing; a second click on the same piece keeps it selected. The ray reads the merged wood through `pieceRanges` and a new `sideRanges` (top and sides), passing through grooves, beams and footprints. Build mode and a shared link's view pick nothing. Not done: the other way round (2D's selection shown in 3D) is held by design 10A and filed as a new P3; the switch stays (no side-by-side). Specs: app/src/viewer3dPick.test.ts, app/src/view3d.dom.test.tsx.

**What:** Clicking a piece in the 3D viewer selects it on the 2D canvas, and the other way round.
**Why:** Finding which plan-view piece is the one under a bridge is by eye until then.
**Pros:** 3D becomes a way to navigate. Mesh ids are needed by build mode anyway. **Cons:** Ray-cast picking, which jsdom cannot test.
**Context:** The 3D viewer ships read-only (`docs/plan/2026-10-31-3d-viewer.md`). Decide side-by-side vs a switch first.
**Effort:** human M / CC S. **Depends on:** the 3D viewer.

---

