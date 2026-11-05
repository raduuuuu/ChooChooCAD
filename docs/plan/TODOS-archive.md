

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

