

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
