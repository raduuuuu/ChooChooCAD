# Product-state review: where the app stands, what is left, what to add (CEO review, 2026-11-14)

Owner's ask (the /plan-ceo-review arguments, verbatim): "review the current
state of the product, what is left to be implemented and suggest possible
improvements". On `main` at `4f35b7e`.

Mode: SELECTIVE EXPANSION (the ask is "suggest possible improvements": hold the
current scope, offer additions one by one). Depth: strategy-only (state,
priorities, scope; no implementation design). Not legal advice anywhere below.
The owner's standing rules still bind: partnership and outreach shelved
(2026-11-04), "any legal risk, scrap it" (2026-11-05), no brand names
(AGENTS.md).

## Step 0 evidence

### 0A. Premise

- **The real problem this review answers.** The app has one promise: say
  truthfully whether a wooden-track layout will work. After 682 commits in
  under six weeks [measured: `git log --oneline | wc -l`, first commit
  2026-10-07] the question is no longer "what can it do" but "what stands
  between it and (a) a verdict that is physically true and (b) a second user".
- **Target outcome.** A short, ordered list of what is left, and a decision on
  each proposed addition.
- **Do-nothing cost.** The last ten days (250 commits since 2026-11-04) went
  mostly to decorated pieces, the contributor pipeline and the calibration
  sheet [measured: commit subjects]. Nobody outside has used either: the
  repository has 1 star, 0 forks, and the only two piece issues ever (#204,
  #231) were the owner's dry runs [measured: `gh api`, `gh issue list --state
  all`, 2026-11-14]. More of the same builds supply for demand nobody has
  measured.
- **Direct or proxy.** Reviewing the backlog is a proxy; the direct evidence
  would be the usage counter, live since 2026-11-05, whose dashboard this
  review cannot open (see U1).

### 0B. What already exists (leverage)

| Need | Already in the tree | Receipt |
|---|---|---|
| Exact closure, joint give, bend solve | engine, linear, budgeted | `engine/src/graph/solve.ts`, README "How the check works" |
| Two levels, ramps, bridges, clearance warning | built | `engine/src/graph/frames.ts`, `app/src/VerdictLine.tsx` |
| Supports check | built, switched off until F4 is read | `engine/src/graph/supports.ts`, `engine/data/measurements.ts:84` |
| 3D view, build mode, share links, phone read-only view | built | `app/src/Viewer3D.tsx`, `BuildMode.tsx`, `LinkRoute.tsx`, `screenMode.ts` |
| Your box (counts, shortfall) | built, simple form | `app/src/inventoryModel.ts` |
| Table or room fit | built | `app/src/tableModel.ts` |
| Community intake | built, never used by an outsider | `app/public/contributor-brief.md`, `.claude/skills/draw-piece/` |
| Usage counter, ten named actions | built, live | `app/src/linkFragment.ts:37`, `app/src/main.tsx:47` |
| CI, Pages deploy, weekly checkup | built | `.github/workflows/` (ci, pages, checkup) |

### 0B. Reality rows

| premise | claim | receipt | verdict |
|---|---|---|---|
| P1 | 71 built-in parts: 13 published, 57 unverified, 1 measured | [measured: `bun -e` over `BUILT_IN`, `engine/data/library.ts:1`] | verified |
| P2 | 10 calibration figures are still `null` | `engine/data/measurements.ts:33-84` | verified |
| P3 | 14 readings open on the sheet, all by ruler, photo or hand | `docs/calibration-sheet.html:64-81` | verified |
| P4 | The counter is GoatCounter; the Cloudflare swap accepted 2026-11-08 is not built | `app/src/main.tsx:47`; no `cloudflare` match in `app/` | verified |
| P5 | The pinned issue #194 links a deleted file | #194 body links `docs/brief/draft.md`; `ls docs/brief` fails; removed in #253 | verified |
| P6 | A deep checkup is due and none is recorded | issue #209 body, 2026-11-12 | verified |
| P7 | Only three ready layouts ship | `app/src/presets.ts:26-33` | verified |
| P8 | The page title is the product name only and the body is empty until the script runs | `app/index.html:7,21` | verified |
| P9 | No live web tool answers "will this layout close" | [web search, 2026-11-14: one beta desktop program, one developer library, general model-railway planners] | verified (search, not exhaustive) |
| P10 | Table fit, listed as undecided E8 in the backlog, is built | `app/src/tableModel.ts:1-3`; `docs/plan/generic-TODOS.md:79` | verified: the backlog line is stale |
| P11 | Visits arrive and people reach "This works" | no receipt: dashboard not readable from here | unverified |
| P12 | `App.tsx` is 2,360 lines; its backlog entry says 627 | [measured: `wc -l`]; `generic-TODOS.md:470` | verified: the entry is stale |

unverified=1 (P11).

REALITY: premise-table finding 11 of 12 claims hold a receipt; P11 (usage) has none docs/plan/2026-11-14-product-state-review.md:55
REALITY: already-done finding table fit (E8) is listed undecided but is built app/src/tableModel.ts:1
REALITY: surface-check pass every command named here exists (`bun run calibration`, `bun run photos`, `/checkup`, `/draw-piece`) AGENTS.md:60
REALITY: binding-decisions finding outreach shelved and no brand names honoured; the 2026-11-08 Cloudflare-only analytics decision was unbuilt and is reversed by the owner at D9; the legal-risk rule is not triggered per the owner at D6 docs/plan/2026-11-08-community-pieces.md:184
REALITY: numbers pass every count above is re-measured today and tagged docs/plan/2026-11-14-product-state-review.md:44
REALITY: deferred-asks pass no linked issue docs/plan/2026-11-14-product-state-review.md:3
REALITY: pr-count pass no ship-policy file, so the default holds: this review is one documents PR, and each of the five additions is its own PR, none stacked AGENTS.md:105

### Landscape (three layers)

- **Tried and true.** Track planners for model railways are mature: big part
  libraries, 1:1 printing, paid desktop apps. None models wooden track's joint
  play, so none can say whether a loop that misses by a few millimetres seats.
- **What search says.** For wooden track: one desktop program still marked
  beta, one developer library, and people drawing layouts in general 3D tools.
  No live web tool.
- **First principles.** The gap is not a missing feature. It is that the one
  tool that answers the question cannot be found by the people asking it. The
  title is the product name, and the page is empty to anything that does not
  run the script. Findability is an app change, not outreach.

### 0C. Dream state

```
  CURRENT STATE                      THIS REVIEW                        12-MONTH IDEAL
  A deep, correct checker.           An ordered "left to do" list;      A parent searching "will my
  57 of 71 pieces unverified.   -->  five additions decided one    -->  wooden track loop close" lands
  14 floor readings open.            by one; stale backlog lines        here, gets a true answer for
  One user. No usage number read.    named.                             the track they own, and a fix
                                                                        when it does not close.
```

## Where the product stands

**Built and working** (README, verified against the tree): canvas editor with
undo, switches and crossings; a verdict on every change; two levels with ramps,
bridges, risers and a clearance warning; decorated pieces; 3D view; build mode
with a pull list; your box; table fit; add or correct a piece; share links;
phone read-only view; the contributor brief and the review skill; CI, Pages,
the weekly checkup.

**The honest weak points.**

1. **Physical truth.** 57 of 71 pieces are unverified. The bend limit is
   inferred from one loop. The ramp is drawn 9mm short of one floor reading.
   The supports check is built and switched off for want of one number (F4).
   Every one of these waits on the owner with a ruler, not on code.
2. **Users.** One known user, the owner. The audience size is unknown, not
   zero: stars and issues do not measure visitors. The usage counter has been live for nine days and its
   dashboard check (TODO "Wire the approved analytics", "Left: confirm visits
   arrive") is still open.
3. **Legal.** The backlog marks the IP question overdue for counsel. The
   owner said on 2026-11-14 that there is no issue with the part IP (D6); the
   backlog entry has not caught up (T4).
4. **A near dead end on failure.** When a loop is exactly one straight short
   or long, the verdict already says which one to add or take out
   (`engine/src/graph/repair.ts`, `app/src/VerdictLine.tsx:946`). Any other
   miss names the joints and proposes nothing. (Corrected after the outside
   review: the first draft said no failure got a suggestion.)

## What is left (current scope, ordered)

Nothing here is new scope. It is the open backlog, re-ordered by how directly
each item protects the promise.

| # | Item | Who | Effort | Why this rank |
|---|---|---|---|---|
| H1 | Read the usage dashboard: do visits arrive, does anyone reach "This works", what share is phones | owner | ~10 min | Every other priority is a guess until this is read |
| H2 | The floor afternoon: F4 (turns the supports check on), F1 ramp, Q2 bend, Q6 switch, F2, F3 | owner | one afternoon | The only work that makes verdicts physically true; cannot be done by an agent |
| H3 | IP question: the backlog says "to counsel, overdue"; the owner said on 2026-11-14 there is no issue with the part IP | owner, then CC | ~10 min | Make the backlog entry say what the owner decided (T4) |
| H4 | Analytics: DECIDED 2026-11-14 (D9): the current counter stays, with its action counts; the 2026-11-08 swap is reversed | CC | ~10 min of backlog edits (T3) | Was an accepted decision the code contradicted |
| H5 | Fix issue #194's dead brief link; run the due deep `/checkup` | CC ~30 min | The front door for contributors points at a deleted file |
| H6 | Ruler heights for the seven photo-built structures (S1, S2, M1, M2, B1, K1, D1) | owner | ~1 hour with H2 | Each stays unverified until read |
| H7 | Backlog truth: mark E8 built, correct the `App.tsx` figure, tick or strike the stale checkboxes in shipped plans | CC ~20 min | The list is the queue; three stale lines found in one pass |
| H8 | Review backlog groups D (load validation bounds), E (accessibility), F (one placement, not two) | CC ~3 h | Real, evidenced, none urgent |
| H10 | Community-pieces plan, five P2 tasks never built: the community verdict caveat (its T8), "confirmed by N readers" (its T9), the library audit (its T11), the palette regroup (its T12); and the pilot's second half, one outside contributor (its T6). Its T10, the analytics swap, is dropped by D9 | CC, plus one invited person | ~5 h | [measured: no `community` in `engine/src/joints/trust.ts`, no "confirmed by" in `app/src`, no regroup or audit commit after the plan PRs #189 and #191]. They matter only once an outside piece arrives |
| H9 | P3s: virtualised canvas, `App.tsx` split, profile copies, richer 3D track, printed-piece paint, third layer | CC | Change no answer; wait for a trigger |

**Hold-scope checks.** Complexity: no code in this review. Minimum change:
H1, H2 and H5 alone would move the product more than any feature. Invariants:
"never shown as a pass" and "says when an answer rests on an unmeasured size"
both hold today and no proposal below weakens them.

**One recommendation that is not a decision row.** Pause new piece drawing and
contributor tooling until H1 is read and one outside contributor has used the
brief. Seven structures were drawn in two weeks; none is verified, and nobody
has asked for the pipeline yet.

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| MODE, owner | Review posture | none | SELECTIVE EXPANSION | approved | the ask's own words, "suggest possible improvements"; mode only, approves no change |
| E1, owner | Findable in search. P8, P9 | title is the product name; empty body | a descriptive title, a short readable explanation, example-layout pages | approved | D1 answer "Add to scope" (2026-11-14); scope: title and description, one static explanation, a few example-layout pages; no outreach, accounts or tracking |
| E2, owner | Ready layouts and "what can I build". P7; `generic-TODOS.md:161` | three ready layouts; the box only counts | about five more ready layouts; a list of those your box can build | approved | D2 answer "Add to scope" (2026-11-14); scope: about five more solver-checked ready layouts and the box-can-build list; no sets, buy list or shop links |
| E3, owner | Finish the loop. `engine/src/graph/repair.ts`; `generic-TODOS.md:229,81` | one straight short or long gets a suggestion; any other miss names joints only | the existing repair extended to fills of several pieces and to two picked open ends, closing exactly | approved | D3 "Add to scope", reopened on a corrected fact and confirmed at D7 "Keep, extend repair" (2026-11-14); scope: extend `repair.ts`, fills from the box only, each re-checked, a work budget with a refusal; exact closure only, no fills that rely on joint give; the full nudge-to-fit search stays deferred |
| E4, owner | Editing on a phone. `app/src/screenMode.ts:14` | read-only under 620px | a touch editor on phones | approved | D4 answer "Add to scope" (2026-11-14), against the recommendation to defer; scope: a touch editor under 620px, with a design review before any code |
| E5, owner | Train playback. `generic-TODOS.md:195`; no route walker exists in `engine/src/graph/` | none; `VEHICLE` in `generic.ts:243` is unused | a route walker, then a train animated round the layout | approved | D5 "Add to scope", reopened on a corrected fact and confirmed at D8 "Keep in scope" (2026-11-14), both against the recommendation to defer; scope: build the route walker first, then 2D and 3D playback that stops on edit and where the train may not pass; effort L, not M |
| E1-ORDER, owner (section 3) | Ship E1 before or after counsel answers the IP question. `generic-TODOS.md:86`; README "Licence" | E1 approved, no order set | ship now | approved | owner, 2026-11-14, typed answer to D6: "There is no issue with the part IP so go ahead with E1"; scope: E1 ships in full with no wait on counsel |
| ANALYTICS, owner (outside review) | Counter. `docs/plan/2026-11-08-community-pieces.md:184` approved a Cloudflare swap, never built; `app/src/main.tsx:47` | GoatCounter with ten action names | keep it | approved | D9 "Keep the current counter" (2026-11-14); scope: reverses the 2026-11-08 swap decision; no new tracking |

Approval readiness: PASS (MODE; E1 at D1; E2 at D2; E3 at D3 and D7; E4 at D4; E5 at D5 and D8; E1-ORDER at D6, typed; ANALYTICS at D9). Each is applied only within its answer's scope. Nothing below is approved beyond these rows.

Offered on request, not in this round: kid mode (E7 in the backlog), the
failure inspector, a third layer.

## currentDecision (E1)

Commitment comparison:

```text
Commitment                  | Source/approval or pending | Current        | A (add)                         | B (defer)      | C (skip)
Page title and description  | pending                    | product name   | says what the app answers       | unchanged      | unchanged
Readable text without script| pending                    | none           | one short static explanation    | unchanged      | unchanged
Example-layout pages        | pending                    | none           | one per ready layout that closes| unchanged      | unchanged
Outreach, accounts, tracking| shelved / scrapped         | none           | none                            | none           | none
TODOS.md entry              | pending                    | none           | none                            | one P2 entry   | none
```

Question: D1 — E1: Make the site findable in search?
Project/branch/task: ChooChooCAD on main, product-state review (strategy only).
ELI10: The page is blank until its code runs, and its title is only the product name. Someone searching for a wooden train track planner finds nothing that points here. This adds a title that says what the app answers, a short written explanation and a few example-layout pages a search engine can read. No outreach, no accounts, no tracking.
Stakes if we pick wrong: Skip it and the app keeps one user; add it badly and the first screen gets wordier for the person who came to build.
Recommendation: A because the search found no live web tool that answers this question, the repo has 1 star and no outside issues, and this is the only growth lever that needs no outreach.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: on each option.
Net: about half an hour of agent work for the only way strangers find the app, against a small risk of cluttering the first screen.
Header: Findability
A) Add to scope (recommended)
Effort S (human: ~1 day / CC: ~30 min), risk low. Reuses the share-link view and og.png. ✅ People searching for a track planner can finally land on the app ✅ Static text and titles only, so no new legal or privacy surface ❌ Search results take weeks to move, so the payoff is slow to see
B) Defer to TODOS.md
Effort S when picked up, zero implementation work now, risk low. ✅ Keeps this round on the floor readings and the backlog already open ✅ The usage numbers can show first whether anyone arrives at all ❌ Every week it waits, the app stays invisible to the people it is for
C) Skip
Effort S (zero implementation work), risk low. ✅ Nothing new to maintain or keep true as the app changes ✅ Fits if the app is meant only for you and people you send links to ❌ Growth then depends entirely on the outreach you shelved

## currentDecision (E2)

Commitment comparison:

```text
Commitment                  | Source/approval or pending | Current     | A (add)                               | B (defer)                 | C (skip)
Ready layouts               | pending                    | three       | about eight, each solver-checked      | unchanged                 | unchanged
"What can I build" list     | pending                    | none        | ready layouts your box covers         | unchanged                 | unchanged
Sets, buy list, shop links  | dropped 2026-11-05/shelved | none        | none                                  | none                      | none
TODOS.md entry              | exists (P2 inventory)      | P2, broad   | narrowed to what is left              | unchanged                 | these two lines struck
```

Question: D2 — E2: Add more ready layouts and a "what can I build with my box" list?
Project/branch/task: ChooChooCAD on main, product-state review (strategy only).
ELI10: A new visitor sees three starting layouts: a circle, a stadium and one that misses. This adds about five more that close exactly, and a list showing which of them the pieces you own can build. It is the part of the inventory plan you left for "later, when I want more complex things".
Stakes if we pick wrong: Skip it and a first-time visitor has little to try before drawing from scratch; add it and each ready layout must stay true as piece sizes get corrected.
Recommendation: A because a visitor who lands with a box of track and no idea gets an answer in one click, and every ready layout is checked by the solver that already exists.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: on each option.
Net: a modest feature that gives newcomers something to do at once, against a small upkeep cost per ready layout.
Header: Ready layouts
A) Add to scope (recommended)
Effort M (human: ~3 days / CC: ~1.5 h), risk low. Reuses presets.ts, inventoryModel.ts and the verdict. ✅ A newcomer with a box of track gets a buildable layout in one click ✅ Each ready layout is solver-checked, so none can quietly stop closing ❌ Eight layouts to keep true whenever a measured size changes
B) Defer to TODOS.md
Effort M when picked up, zero implementation work now, risk low. ✅ The existing inventory entry already records it, so nothing is lost ✅ Waits until the usage numbers show whether people open the ready layouts ❌ The first screen stays thin for anyone who arrives without a layout in mind
C) Skip
Effort S (zero implementation work), risk low. ✅ Keeps the box a plain list of counts, as you chose on 2026-11-05 ✅ No ready-layout upkeep when a ramp or curve size is corrected ❌ "What can I build with what I own" stays unanswered for good

## currentDecision (E3)

Commitment comparison:

```text
Commitment                  | Source/approval or pending | Current              | A (add)                                  | B (defer)       | C (skip)
A loop that does not close  | residual risk 4            | names the joints     | proposes the fewest pieces that close it | unchanged       | unchanged
Respects your box           | pending                    | n/a                  | yes, and says when it cannot             | n/a             | n/a
Never a wrong suggestion    | invariant 3                | holds                | every proposal re-checked by the verdict | holds           | holds
Full nudge-to-fit search    | P2, deferred 2026-10-07    | deferred             | still deferred (only the gap-fill part)  | deferred        | deferred
TODOS.md entry              | exists (P2 nudge, E10)     | two entries          | E10 becomes in scope                     | unchanged       | E10 struck
```

Question: D3 — E3: Let the app suggest the pieces that close a loop?
Project/branch/task: ChooChooCAD on main, product-state review (strategy only).
ELI10: Today a loop that misses gets a verdict that names the joints and stops there. This lets you pick two open ends and have the app suggest the fewest pieces that join them exactly, using what is in your box. Because every position is exact arithmetic, the search is a countable list of options, not guesswork.
Stakes if we pick wrong: Skip it and "this does not close" stays a dead end; build it carelessly and the app could suggest a fix that does not work, which is the one failure this product cannot afford.
Recommendation: A because it is the payoff of the exact engine, it turns the most common first experience (a loop that misses) into a fix, and every suggestion can be re-checked by the verdict before it is shown.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: on each option.
Net: the largest item offered here, about a day of agent work, for the one thing no other tool could do.
Header: Finish loop
A) Add to scope (recommended)
Effort L (human: ~2 weeks / CC: ~1 day), risk medium. Reuses the exact lattice, the verdict and the box. ✅ A loop that misses becomes "add these two pieces" instead of a dead end ✅ Each suggestion is re-checked by the existing verdict before it shows ❌ The search needs a work budget, and a refusal when it runs out
B) Defer to TODOS.md
Effort L when picked up, zero implementation work now, risk low. ✅ The backlog already holds the design notes for it, nothing is lost ✅ The floor readings come first, so suggestions rest on measured sizes ❌ A failing layout keeps ending at a verdict with no way forward
C) Skip
Effort S (zero implementation work), risk low. ✅ No new search code to bound, test and keep honest ✅ The verdict already names the joints at fault, which helps a patient user ❌ The exact engine's clearest advantage over any other tool stays unused

## currentDecision (E4)

Commitment comparison:

```text
Commitment                  | Source/approval or pending | Current             | A (add)                        | B (defer)                      | C (skip)
Editing under 620px         | owner ruling (read-only)   | read-only           | a touch editor                 | read-only                      | read-only
Design review needed        | DESIGN.md                  | n/a                 | yes, before any code           | when picked up                 | n/a
Trigger to revisit          | pending                    | none                | n/a                            | phone share of visits, from H1 | none
TODOS.md entry              | none                       | none                | none                           | one P2 entry with the trigger  | none
```

Question: D4 — E4: Make the editor work on a phone?
Project/branch/task: ChooChooCAD on main, product-state review (strategy only).
ELI10: On a screen narrower than 620px the app shows layouts but will not edit them. A parent on the floor with a phone can open a shared layout and cannot change it. This would add a touch editor for phones, which means new controls for placing, turning and joining pieces with a thumb.
Stakes if we pick wrong: Build it now and it could be a large design effort for visitors who may not exist; never build it and every phone visitor is told to come back on a bigger screen.
Recommendation: B because it is the largest design job offered here and the usage dashboard can tell you, for free, what share of visits come from phones before you spend it.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: on each option.
Net: probably the right feature eventually, but the evidence that decides it is ten minutes away in the dashboard.
Header: Phone editor
A) Add to scope
Effort XL (human: ~3 weeks / CC: ~2 days), risk high. Needs a design review first. ✅ A parent on the floor can change the layout on the device in hand ✅ Removes the "open this on a tablet or computer" dead end on phones ❌ A second editing model to design, test and keep in step with the first
B) Defer to TODOS.md (recommended)
Effort XL when picked up, zero implementation work now, risk low. ✅ The dashboard's phone share decides it with evidence, not a guess ✅ Keeps this round small enough to ship beside the floor readings ❌ Phone visitors keep a read-only view for as long as it waits
C) Skip
Effort S (zero implementation work), risk low. ✅ One editor to maintain, the one that already works well ✅ Matches the earlier ruling that editing needs a wider screen ❌ Rules out the device most parents will have in their hand

## currentDecision (E5)

Commitment comparison:

```text
Commitment                  | Source/approval or pending | Current        | A (add)                            | B (keep deferred)  | C (skip)
Train animated on the track | P2, deferred 2026-10-07    | none           | 2D and 3D playback, stops on edit  | none               | none
Clearance shown by the run  | pending                    | a warning line | the train stops where it cannot pass| a warning line    | a warning line
Depends on F2 reading       | calibration sheet          | open           | yes, or it dramatises a guess      | n/a                | n/a
TODOS.md entry              | exists (P2 playback)       | P2             | in scope                           | unchanged          | struck
```

Question: D5 — E5: Add an animated train that runs round the layout?
Project/branch/task: ChooChooCAD on main, product-state review (strategy only).
ELI10: The app says in words whether a train gets round and under the bridges. This would show it: a train driving the layout, in 2D and 3D, stopping where it cannot pass. It is already in the backlog, deferred since October, and its note says it should wait until the clearance under a bridge is measured.
Stakes if we pick wrong: Build it before the bridge clearance is measured and the animation shows a confident train passing a gap nobody has checked; never build it and the app stays a checker with no moment of joy.
Recommendation: B because the playback would act out the bridge clearance, and that figure (F2) is still open on the calibration sheet, so today it would dramatise a guess.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: on each option.
Net: the most delightful item here, worth doing right after the floor afternoon and not before.
Header: Train run
A) Add to scope
Effort M (human: ~1 week / CC: ~3 h), risk medium. Reuses the traversal checker and the 3D view. ✅ Watching a train clear a bridge makes the verdict believable to a child ✅ The traversal checker and vehicle sizes it needs are already built ❌ Until F2 is measured it would animate an unverified clearance as fact
B) Keep deferred in TODOS.md (recommended)
Effort M when picked up, zero implementation work now, risk low. ✅ Waits for the F2 reading, so the train's run rests on a measured gap ✅ The backlog entry keeps every design decision already made for it ❌ The app stays words and marks, with no payoff moment, a while longer
C) Skip
Effort S (zero implementation work), risk low. ✅ No animation loop to stop, invalidate and test on every edit ✅ Keeps the app a quiet tool, in line with DESIGN.md's plain style ❌ Gives up the single most convincing proof that a layout works

## 0I. The first hours of building this (sequence and blockers)

```
  HOUR 1 (foundations)   Read the dashboard (H1). Fix #194 and the stale backlog lines (H5, H7).
                         The builder needs: AGENTS.md's no-brand rule, CLAUDE.md's mutation rule,
                         and that docs/ is not deployed (only app/dist reaches the site).
  HOUR 2-3 (core)        E1 and E2. Ambiguity: where static pages come from. They must be generated
                         at build from the same ready layouts, or they drift from the app.
  HOUR 4-5 (integration) E3. Surprise: the search must be bounded at the whole entry point, not at
                         the function (this project moved a bound outward four times, TODOS:671).
  HOUR 6+ (polish)       E5 is not blocked: it needs a route walker built first, and until F2 is read
                         it shows the clearance as an estimate. E4 needs a design review first and is
                         easier after App.tsx is split.
```

Feasibility blockers: none for E1 to E3. E5 is buildable now but must carry
the "unmeasured clearance" note until F2 is read (existing invariant, not a
new choice). E4 has one prerequisite already in its approved scope: a design
review before any code.

Suggested order (a recommendation, not an approval): H1, H5, H7 the same day;
E1; E2; the floor afternoon H2 in parallel, owner only; E3; E5 (route walker,
then playback; F2 only changes its wording); E4 last, after its design review
and with the phone share from H1 in hand.

Effort for the five additions together, after the corrections at D7 and D8:
E1 S, E2 M, E3 M, E5 L, E4 XL: human ~7 weeks / CC ~4 days, plus the design
review E4 requires and the owner's afternoon.

## Review sections (strategy-only, capability level)

### 1. Architecture

```
  engine (exact, no DOM)                              app (React, static, GitHub Pages)
  ┌──────────────────────────────┐                    ┌──────────────────────────────────────┐
  │ geom/   Z[zeta16] positions  │                    │ editorReducer ── TrackCanvas (SVG)   │
  │ graph/  solve, frames,       │── verdict ───────▶ │ VerdictLine     Viewer3D  BuildMode  │
  │         supports, traversal  │                    │ inventoryModel  tableModel  presets  │
  │ data/   library, sizes       │                    │ LinkRoute (read-only, phones)        │
  └──────────────────────────────┘                    └──────────────────────────────────────┘
        │ E3: repair.ts EXTENDED ── every candidate ──▶ solve ──▶ shown only if it passes
        │ NEW E5 route walker, then its path as a timeline ───▶ one moving train, 2D and 3D
        │ NEW E2 ready layouts (data) ─────────────────────────▶ palette + "your box can build"
        │                              NEW E4 touch surface ───▶ the SAME editorReducer
  build (vite) ── NEW E1 title, static text, pages generated from the ready layouts ──▶ app/dist
```

- **WARNING A1.** E4 must drive the existing `editorReducer`. A second state
  model would fork the editor. `App.tsx` is 2,360 lines and owns five jobs;
  the backlog's P3 "Finish splitting App.tsx" would make E4 cheaper. That is
  a recommendation for the eng review, not approved scope: no ledger row
  covers the split and E4's XL estimate does not include it.
- **WARNING A2.** E3 is a search. This project relocated an unbounded cost
  four times before it held (`generic-TODOS.md:671`). Prior learning applied:
  bounding-the-component-you-are-looking-at-is-not-bounding-the-system
  (confidence 10/10, 2026-10-15). The implementation owner must time the
  whole user-visible entry point at the largest layout the budget permits.
- **OK A3.** E1's pages are generated at build from the same ready layouts, so
  the text cannot drift from the app. docs/ is not deployed (prior learning:
  calibration-sheet-not-published, 10/10), so the pages must land in
  `app/dist`.
- Scaling: no server. Ten or a hundred times the visitors is a CDN matter.
  The counter's free-tier ceiling is unknown; owner to check with H1.
- Single points of failure: the owner (every measurement, every piece
  review) and GitHub Pages.
- Rollback: revert the pull request; Pages redeploys in about three minutes
  [measured: Pages run 43211584998, 3m20s].

### 2. Errors and rescue

| Capability | What can go wrong | Known safeguard | User sees | Owner must prove |
|---|---|---|---|---|
| E1 pages | text says something the app no longer does | generated from the ready layouts at build | n/a | a build test that fails when a page and its layout disagree |
| E2 ready layout | stops closing after a size is corrected | each one solver-checked (approved scope) | CI fails, nothing ships wrong | the check runs through the reducer path, not the retired chain engine (`generic-TODOS.md:577`) |
| E2 box list | box is empty or holds none of a layout's pieces | none yet | unknown | an empty box shows every layout with its shortfall, never a blank list |
| E3 search | runs out of work budget | none yet | unknown | a refusal that says it could not find a fill, never "impossible" |
| E3 suggestion | fails the verdict re-check | approved scope: re-checked before shown | nothing wrong is shown | the re-check uses the same `solveGraph` call the verdict uses |
| E3 suggestion | exact, but mixes track systems that do not join, or needs an adapter the box lacks | `layoutTrust` checks system fit apart from the solver (`engine/src/joints/trust.ts:130`) | unknown | a fill passes the solver AND the system-fit check AND the box count, adapters included, before it shows |
| E3 box | empty or never filled in | none yet | unknown | says the box is empty and offers nothing, or the owner picks another rule in eng review |
| E3 suggestion | rests on an unmeasured piece size | existing trust notes | the usual "estimate" wording | the note travels with the suggestion |
| E4 touch editor | a pan or pinch read as a drag, moving track by accident | undo exists | a surprise move | one undo step restores it; design review owns the gesture rules |
| E4 touch editor | screen turned across 620px mid-edit | mode derived on every render (`screenMode.ts:14`) | editor swaps | the layout and undo history survive the swap |
| E5 playback | layout edited mid-run | backlog T40: stop and invalidate | unknown | the train never keeps driving a layout that changed |
| E5 playback | clearance under a bridge is unmeasured (F2 open) | existing rule: say when an answer rests on an estimate | **WARNING** | the run carries the same "may not pass" wording as the verdict; it never shows a clean pass the verdict does not give |
| E5 playback | track ends in mid-air, or a switch offers two roads | none yet | unknown | the train stops at an open end; which road it takes at a switch is undecided, for the eng review |
| E5 playback | a visitor's train is not the owner's 55mm one (`engine/data/calibration.ts:120`) | none | a run that looks like a promise about their train | the run names the train it used; it never claims another train passes |
| Usage counter | nobody reads it | none | nothing | H1 |
| Supports check | off until F4 | verdict says "supports are not checked" | the disclosure | H2 |

No silent failure is approved by this review. 16 paths mapped, 0 critical
gaps, 2 warnings (E5 before F2; E5 shows one reference train).

### 3. Security, privacy and legal

- **WARNING S1 (legal, High impact, likelihood unknown).** The IP question
  (`generic-TODOS.md:86`) is overdue and unanswered. E1 exists to make the
  site easier to find, which also makes the transcribed size tables easier to
  find. The site and repository are already public, and the README already
  offers a takedown. **Resolved by the owner (D6, 2026-11-14): "There is no
  issue with the part IP so go ahead with E1."** E1 ships with no wait. The
  backlog's IP entry still reads "P1, overdue, needs counsel"; task T8 brings
  it in line with the owner's statement, in the owner's words.
- **WARNING S2 (findability against a binding rule).** People search by brand
  name. AGENTS.md forbids naming one anywhere. E1 keeps the rule and uses
  descriptive words ("wooden train track"), accepting weaker search reach.
  `engine/data/brandWords.ts` already exists; the implementation owner must
  prove the generated pages pass the same brand check.
- E2: layouts must be original. Sets were dropped on 2026-11-05, so no boxed
  set contents enter the tree.
- E3, E4, E5: no new input from outside the device, no new storage keys
  required, no new dependency expected. Eng review confirms.
- Privacy: the counter sends ten fixed action names and never the layout
  (`linkFragment.ts:57`). Counting the new features means adding names to
  that list; the owner approved the list by hand, so new names are a
  recommendation for the owner to approve at implementation time (T11), not
  approved scope.

### 4. Data flow and interaction edges

```
  E3  pick two open ends ─▶ validate ─▶ search (budget) ─▶ candidates ─▶ verdict re-check ─▶ show ─▶ apply
        │ one end, or none      │ ends on        │ budget out        │ none          │ fails            │ tapped twice
        ▼                       ▼ two levels     ▼                   ▼               ▼                  ▼
      button off          undecided (eng)    "could not find"   "nothing in     dropped, never     one undo step,
                                                                 your box fits"  shown              applied once
```

| Interaction | Edge case | Handled? | How |
|---|---|---|---|
| E3 apply | tapped twice | to design | one undo step, second tap is a no-op |
| E3 search | layout edited while it runs | to design | a result for an older layout is discarded |
| E3 results | none, or dozens | to design | a plain sentence; the best few only |
| E2 list | box edited while the list is open | to design | the list follows the box |
| E4 edit | pinch, pan and drag overlap | design review | gesture rules |
| E5 run | edit, tab hidden, reduced-motion setting | to design | stop on edit; pause when hidden; a still summary when motion is off |
| E1 page | opened with scripts off | approved scope | the static text still reads |

Async ordering: only E3 can run long enough to overlap an edit. Invariant: a
suggestion on screen always belongs to the layout on screen. The
implementation owner must name the mechanism (for example a layout version
checked on return) and test both completion orders. 9 edges mapped; none is
handled yet because nothing is built; each has an owner above.

### 5. Code quality

- `App.tsx` at 2,360 lines is where all five additions would land. See A1.
- `presets.ts` still carries `presetLayout`, kept alive by one test against
  the retired chain engine (`generic-TODOS.md:577`). E2 edits this file, so
  that pin moves to the reducer path in the same change.
- Three stale backlog lines found in one pass (P10, P12, and the unbuilt
  Cloudflare swap). The backlog is the work queue; H7 repairs it.
- No over-engineering in the accepted scope: E3 is gap-fill only, the full
  nudge-to-fit search stays deferred.

### 6. Tests

```
  NEW THING                      TEST TYPE              HAPPY                         FAILURE                          EDGE
  E1 generated pages             build (node)           page per ready layout         a page disagrees with its layout  a brand word in page text
  E2 ready layouts               node, reducer path     each closes exactly           a corrected size breaks one       empty box
  E2 box-can-build list          node + dom             owned layout listed           box short by one piece            box edited while open
  E3 gap-fill                    node, property         fill closes exactly           budget out returns a refusal      ends on two levels
  E3 against the corpus          node, differential     remove k pieces from a closing layout: a fill of at most k is found
  E3 stale result                dom                    result applied                edit lands first: result dropped  both orders
  E4 touch editor                dom + a real phone     place, turn, join by touch    pinch not read as drag            rotate across 620px
  E5 playback                    node, fixed timestep   train completes the loop      stops at a negative clearance     edit mid-run, open end
```

- 2am-Friday test: the E3 corpus differential. Hostile test: a layout built
  to exhaust the E3 budget, timed at the whole entry point. Chaos test: edits
  fired during an E3 search and an E5 run.
- Every pin records its mutation and the mutation is run (CLAUDE.md).
- no_claim: none of these proves physical truth. Exact arithmetic on an
  unmeasured size is still an estimate; only H2 changes that. The E4 dom
  tests do not prove a thumb can use it; a real phone does (human).
- Gaps: 2, both human: a real-phone pass for E4, and a person judging the E5
  run beside real track.

### 7. Performance

- E3: extending `repair.ts` past one piece, the worst case grows fast with the gap length. Needs the bend solver's
  pattern: one fixed work budget, a refusal past it.
- E5: animate one element; never re-render the whole SVG per frame. The
  canvas ceiling is 10,000 pieces, sized on a laptop (`generic-TODOS.md:693`).
- E4: that ceiling has never been measured on a phone. The implementation
  owner must measure draw time on a mid-range phone before choosing one.
- CI has a chunk budget (`.github/workflows/ci.yml`). E3 and E5 add code;
  load them when first used.

### 8. Observability

- **WARNING O1.** The one usage signal has gone unread for nine days (P11).
  H1 is ten minutes and decides the order of everything after it.
- New action names for the counter (finish-loop, play-train, a phone edit)
  are recommended, and need the owner's approval as the first ten did (T11).
  Each addition's success signal is its own action count; E1's is visits in
  the existing counter. No new tracking.
- There are no logs and no server. A bug report three weeks on is
  reproducible only from a shared link or a saved file, which already works.

### 9. Deployment

- One pull request per addition, none stacked (AGENTS.md).
- No saved-file format change is expected from any of the five. Eng review
  must confirm, because the format is hard to change once files exist
  (`generic-TODOS.md:370`).
- E5 can ship 2D first. E4 sits behind the existing screen-width switch, so
  it can be merged dark by keeping the read-only view until it is ready.
- After each deploy: the live-site check the owner already runs, plus one
  shared link opened on a phone.

### 10. Long-term trajectory

- Reversibility: 4/5. Every addition is removable code. E1 is the exception:
  pages a search engine has indexed linger after removal (3/5).
- Debt taken on: a second input surface (E4) to keep in step with the first.
- What comes after: E3's search is the base of the deferred nudge-to-fit; E5's
  timeline is the base of kid mode's "drive the train".
- Were the right cherry-picks accepted? E1 to E3 follow the evidence. E4 and
  E5 were accepted against the recommendation. E5's risk is contained by the
  existing "say it is an estimate" rule, and the owner kept it at D8 knowing
  it needs a route walker first and costs about a day, not three hours. E4's risk is cost: it is the largest
  item, taken before the dashboard has said how many visitors use a phone.
  Sequencing it last keeps that evidence available before any code.
- The larger pattern, for the record: this is the second review to find that
  building outruns both measurement and users (2026-11-04 said the same).
  Five more features were accepted today; the floor afternoon (H2) and the
  dashboard (H1) are still the two cheapest, highest-value items on the list,
  and neither is code.

### 11. Design and UX

UI scope: yes, all five.

- What the user sees first stays the verdict line. E2's ready layouts sit
  with the existing three; E3 appears only when two open ends are picked; E5
  is one control near the verdict; E1's text sits outside the editor.
- States:

  | Feature | Loading | Empty | Error | Success | Partial |
  |---|---|---|---|---|---|
  | E2 list | n/a | empty box: every layout with its shortfall | n/a | owned layouts first | short by a few: says which |
  | E3 | searching | nothing in the box fits | could not find within budget | best few fills, from the box | n/a: fills come from the box only (approved scope) |
  | E5 | n/a | no track to drive | n/a | a full lap | stops where it may not pass, and says why |
  | E4 | n/a | blank canvas with one first action | a refused join says why (existing copy) | same verdict line | n/a |

- DESIGN.md: rule 7 (no screen directions in copy), rule 10 (44px targets,
  which E4 lives on), rule 11 (any new canvas mark, such as a suggested
  piece or the train, needs measured contrast).
- E4 gets a full `/plan-design-review` before code (approved scope). E3 and
  E5 each add a canvas mark; sending them through it too is a recommendation,
  not approved scope.

```
  E3 flow:  pick an open end ─▶ pick a second ─▶ "Finish this loop" ─▶ searching ─▶ fills listed
                                                        │                              │
                                                        ▼                              ▼
                                                 could not find                  tap one: pieces placed,
                                                 (says so, stays put)            verdict updates, one undo
```

## currentDecision (E1-ORDER)

Commitment comparison:

```text
Commitment                  | Source/approval or pending | Current            | A (ship now)        | B (wait for counsel) | C (title only now)
E1 title and description    | D1 approved                | not built          | ships               | waits                | ships
E1 static text and pages    | D1 approved                | not built          | ships               | waits                | waits for counsel
IP question to counsel (H3) | P1, overdue                | open               | open, unchanged     | blocks E1            | blocks the pages
Size tables in the repo     | public since October       | public             | unchanged           | unchanged            | unchanged
```

Question: D6 — E1-ORDER: Ship the findability work before the IP question is answered?
Project/branch/task: ChooChooCAD on main, product-state review (strategy only).
ELI10: You approved making the site easier to find. The piece sizes in the app were partly copied from a published guide, and the question of whether that needs permission has waited for a lawyer since October. More visitors means more chance the guide's owner notices. The site and the code are already public, so this changes how visible the question is, not whether it exists. This is not legal advice.
Stakes if we pick wrong: Ship first and a complaint could arrive before you have counsel's answer; wait and the only growth work you approved sits behind a task that has not moved in six weeks.
Recommendation: A because the tables are already public on the site and in the repository, the README already offers to take them down on request, and waiting ties the app's only growth lever to an errand with no date.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: on each option.
Net: a small rise in visibility of a risk that already exists, against stalling findability on a task only you can start.
Header: E1 and IP
A) Ship E1 now (recommended)
Effort S (zero extra implementation work), risk medium. Reuses the README's takedown offer. ✅ Findability is not held up by a task that has no date on it yet ✅ The tables are already public, so no new material is being published ❌ More visitors raises the chance of a complaint before counsel answers
B) Wait for counsel
Effort S (zero implementation work now), risk low. ✅ Follows your own rule from 2026-11-05: any legal risk, scrap it ✅ Gives the counsel errand a concrete reason to happen this month ❌ The app stays unfindable until a lawyer replies, which could be weeks
C) Title now, pages later
Effort S (human: ~2 h / CC: ~10 min now), risk low. ✅ The cheapest fix ships: a title that says what the app answers ✅ The readable pages, the bigger draw, wait for counsel's answer ❌ A title alone moves search results far less than real pages do

## The two reviewers

**Spec review (Claude subagent, both documents read in full): 6/10, FAIL on
four of five dimensions, 19 issues.** All 19 were applied as edits above
(task ids renumbered, E3 "from the box only", E5's timing and empty state,
the E1 page source, effort totals, three items relabelled as recommendations
that are not approved scope). They were not sent back for a second pass:
issues verified 19 of 19 as applied edits, spec not re-verified.

**Outside voice (Codex, gpt-6-astra): ran and returned six findings, but its
answer failed the gate's format check, so it counts as unavailable coverage,
not a completed review.** The native fallback was not run. Its claims were
checked by hand instead:

| # | Claim | Checked | Disposition |
|---|---|---|---|
| 1 | The 2026-11-08 ledger approved Cloudflare-only analytics, which drops the action counts this review leans on | true: `2026-11-08-community-pieces.md:184` | owner decided at D9: the current counter stays |
| 2 | A one-straight repair suggestion already exists; the near-miss preset has no open ends to pick | true: `engine/src/graph/repair.ts`, `VerdictLine.tsx:946` | fact corrected; owner confirmed E3 at D7 as an extension of the repair |
| 3 | No train traversal exists; `VEHICLE` is unused | true: no walker in `engine/src/graph/`; `generic.ts:243` | fact corrected; owner kept E5 at D8 at effort L |
| 4 | The 55mm train is the owner's, shown as everyone's | true: README "The train" | added to the error table: the run names its train |
| 5 | A solver re-check alone does not prove a fill is buildable (system fit, adapters, box) | cited line not opened by this review | added as a requirement the implementation owner must prove |
| 6 | "One user" overstates what stars and issues show | fair | wording changed to "one known user; audience unknown" |

Still open from finding 2, for the eng review: how a welded loop that misses
(no open ends) enters the gap-fill, since E3's approved entry is two picked
open ends.

## NOT in scope

- **Deferred:** none new. The full nudge-to-fit search stays deferred (D3, D7:
  only the gap-fill was accepted). The mirror half of backlog E10 stays
  undecided.
- **Rejected:** the Cloudflare analytics swap (D9; reverses 2026-11-08).
- **Not offered this round, already in the backlog:** kid mode, the failure
  inspector, a third layer.
- **Recommendations, not approved:** splitting `App.tsx` before E4; design
  review for E3 and E5; new counter action names; pausing new piece drawing
  until H1 is read.
- **Standing:** partnership and outreach stay shelved; the backend stays
  scrapped.

## What already exists

See the 0B table. Reused by the additions: `repair.ts` (E3), `presets.ts` and
`inventoryModel.ts` (E2), `editorReducer.ts` and `screenMode.ts` (E4),
`frames.ts`, the clearance figures and `Viewer3D.tsx` (E5), `og.png`, the
build and `brandWords.ts` (E1), the counter and its action list (measuring
all five).

## Dream state delta

```
  BEFORE THIS REVIEW                 AFTER (decided, not built)             STILL BETWEEN HERE AND THE IDEAL
  findable by nobody                 E1 approved, ships without waiting     the floor afternoon (owner):
  three ready layouts                E2 approved                            57 of 71 pieces unverified,
  one-straight repair only           E3 approved, extends the repair        supports check off, ramp 9mm short
  phones read-only                   E4 approved, design review first       one outside contributor
  no train                           E5 approved, route walker first        the dashboard, unread
  analytics decision contradicted    counter kept, decision recorded
```

## Error and rescue registry, and failure modes

The section 2 table is the registry (strategy depth: capability rows, each
with the owner who must prove it). Failure modes: 16 rows; rescue and test
coverage are unknown for every new capability because nothing is built; no
row is approved as silent. Critical gaps: 0.

## Scope expansion decisions

- **Accepted (5 of 5):** E1 findability; E2 ready layouts and the box list;
  E3 finish the loop, as an extension of the existing repair; E4 phone
  editor, design review first; E5 route walker and train playback.
- **Also decided:** E1 ships now (D6); the current counter stays (D9).
- **Deferred:** none. **Skipped:** none.

The full record is the CEO plan at
`~/.gstack/projects/raduuuuu-ChooChooCAD/ceo-plans/2026-11-14-product-state-review.md`.

## Diagrams

Produced: system architecture (section 1), data flow with shadow paths
(section 4), user flow (section 11), dream state (0C), sequence (0I). No
state machine, deployment or rollback diagram: strategy depth, and the deploy
path is unchanged (revert, Pages redeploys).

Stale diagram audit: this review touches no source file. The diagram in
`app/src/linkFragment.ts:22-27` stays accurate because the counter stays (D9).

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, owner: ~10min)** — analytics — Read the usage dashboard: visits, "works" count, phone share
  - Surfaced by: weak point 2, O1, premise P11
  - Files: none
  - Verify: the three numbers written into the backlog's analytics entry
- [ ] **T2 (P1, human: ~1h / CC: ~30min)** — github — Fix issue #194's dead brief link; run the due deep `/checkup`
  - Surfaced by: P5, P6
  - Files: none (issue body); whatever the checkup finds
  - Verify: the link opens `app/public/contributor-brief.md`; issue #209 records a deep checkup
- [ ] **T3 (P1, human: ~2h / CC: ~20min)** — docs — Make the backlog true: E8 built; the `App.tsx` figure; E10 split (gap-fill in scope, mirror undecided); playback in scope and needing a route walker; inventory entry narrowed; analytics entry says the counter stays; the community plan's T10 struck
  - Surfaced by: P10, P12, D2, D7, D8, D9, spec review 1.2
  - Files: `docs/plan/generic-TODOS.md`, `docs/plan/2026-11-08-community-pieces.md`
  - Verify: each edited entry cites this review and its decision id
- [ ] **T4 (P1, owner, then CC: ~10min)** — docs — The IP backlog entry says what the owner decided on 2026-11-14, in the owner's words
  - Surfaced by: D6, S1
  - Files: `docs/plan/generic-TODOS.md`
  - Verify: the entry no longer reads "P1, overdue" unless the owner wants it to
- [ ] **T5 (P1, owner: one afternoon)** — calibration — The floor readings: F4, F1, Q2, Q6, F2, F3, and the seven structures' ruler heights
  - Surfaced by: weak point 1, H2, H6
  - Files: `engine/data/measurements.ts`
  - Verify: `bun run calibration`; the supports check turns on when `f4.supportGapMm` is set
- [ ] **T6 (P1, human: ~1d / CC: ~30min)** — app — E1: title and description, one static explanation, one generated page per ready layout that closes
  - Surfaced by: D1, D6, A3, S2
  - Files: `app/index.html`, the build; others to be determined
  - Verify: a build test fails when a page and its layout disagree, and when page text contains a brand word
- [ ] **T7 (P2, human: ~3d / CC: ~1.5h)** — app — E2: about five more ready layouts and the "your box can build" list
  - Surfaced by: D2, section 5
  - Files: `app/src/presets.ts`, `app/src/inventoryModel.ts`; others to be determined
  - Verify: every ready layout solver-checked through the reducer path; empty box shows shortfalls; mutations run
- [ ] **T8 (P2, human: ~1w / CC: ~4h)** — engine — E3: eng review, then extend `repair.ts` to multi-piece fills between two picked open ends
  - Surfaced by: D3, D7, A2, outside findings 2 and 5
  - Files: `engine/src/graph/repair.ts`; others to be determined
  - Verify: the corpus differential; a budget-exhausting layout timed at the whole entry point; fills pass solver, system fit and box count
- [ ] **T9 (P2, human: ~2w / CC: ~1d)** — engine — E5: eng review, then the route walker, then 2D and 3D playback
  - Surfaced by: D5, D8, outside findings 3 and 4
  - Files: to be determined
  - Verify: fixed-timestep positions; stops on edit, at an open end and at a negative clearance; names its train; estimate wording until F2
- [ ] **T10 (P2, human: ~3w / CC: ~2d)** — app — E4: `/plan-design-review`, then the touch editor on the existing editor state
  - Surfaced by: D4, A1, section 7
  - Files: to be determined
  - Verify: dom tests for touch; draw time measured on a mid-range phone; a real-phone pass by a person
- [ ] **T11 (P3, owner)** — analytics — Approve or decline action names for the new features
  - Surfaced by: section 8
  - Files: `app/src/linkFragment.ts`
  - Verify: the list matches the owner's answer; nothing about the layout is sent
- [ ] **T12 (P3, human: ~1w / CC: ~5h)** — community — Carried from 2026-11-08: the community verdict caveat, "confirmed by N readers", the library audit, the palette regroup, and one outside contributor through the brief
  - Surfaced by: H10
  - Files: `engine/src/joints/trust.ts`, `engine/data/library.ts`, `app/src/App.tsx`
  - Verify: per the 2026-11-08 plan's own task rows

PLAN_REALITY: phase=ceo rows=7/7 missing=none verdict=complete

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | deep checker; 57/71 pieces unverified; 14   |
  |                      | readings open; usage unread; 3 stale lines  |
  | Step 0               | 5 additions offered, 5 accepted; 9 answers  |
  | Section 1  (Arch)    | 2 issues found (both warnings)              |
  | Section 2  (Errors)  | 16 error paths mapped, 0 GAPS               |
  | Section 3  (Security)| 2 issues found, 1 High (resolved by owner)  |
  | Section 4  (Data/UX) | 9 edge cases mapped, 0 handled yet (unbuilt)|
  | Section 5  (Quality) | 3 issues found                              |
  | Section 6  (Tests)   | Diagram produced, 2 gaps (both human)       |
  | Section 7  (Perf)    | 3 issues found                              |
  | Section 8  (Observ)  | 1 gap found                                 |
  | Section 9  (Deploy)  | 1 risk flagged (saved-file format, to check)|
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 1           |
  | Section 11 (Design)  | 0 issues; design review required for E4     |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 groups)                          |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 16 rows, 0 CRITICAL GAPS                    |
  | Failure modes        | 16 total, 0 CRITICAL GAPS                   |
  | TODOS.md updates     | 0 items proposed (edits are task T3)        |
  | Scope proposals      | 5 proposed, 5 accepted                      |
  | CEO plan             | written                                     |
  | Outside voice        | codex: unavailable (format check failed);   |
  |                      | 6 findings checked by hand                  |
  | Lake Score           | N/A (no coverage-scored questions)          |
  | Diagrams produced    | 5 (architecture, data flow, user flow,      |
  |                      | dream state, sequence)                      |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows (PLAN_REALITY), 1 unverified       |
  +====================================================================+
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 15 | CLEAR | 5 proposals, 5 accepted, 0 deferred |
| Outside Review | codex, `/plan-ceo-review` | Independent 2nd opinion | 34 | unavailable | output failed the format check; no completed external review; 6 claims checked by hand, 3 led to owner decisions |
| Eng Review | `/autoplan` | Architecture & tests (required) | 22 | not run for this plan (last: 2026-11-08, other plans) | none for this plan |
| Design Review | `/plan-design-review` | UI/UX gaps | 16 | not run for this plan (last: 2026-11-08, other plans) | none for this plan |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | none |

- **OUTSIDE COVERAGE:** codex (gpt-6-astra), plan-review phase, unavailable: the response lacked the markers the gate requires. Native fallback not run. A Claude subagent spec review completed (6/10, 19 issues, all applied, not re-verified); it is not outside coverage.
- **VERDICT:** CEO CLEARED for scope. Eng review required before E3, E5 and E4 are built; design review required before E4.

NO UNRESOLVED DECISIONS
