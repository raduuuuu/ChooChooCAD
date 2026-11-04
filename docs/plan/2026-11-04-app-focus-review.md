# App-focus review of the plan and the TODO list (CEO review, 2026-11-04)

The owner asked for "a very critique look at the existing plan and the todos
list", calling outside agents, then shelved the partnership: "let's forget
about any partnership and outreach for now, let's focus purely on the app,
rethink anything needed based on this information". Mode: SCOPE REDUCTION
(owner's answer to the mode question). Depth: strategy-only (prioritisation,
no implementation design).

Reviewed: `docs/plan/2026-11-04-partnership-pitch.md` (now SHELVED) and
`docs/plan/generic-TODOS.md` (3,140 lines, 90 entries before this review).

## Reviewers

| Reviewer | What it did | Headline |
|---|---|---|
| Code audit (Claude subagent) | checked all 50 open entries against the code and git history | 24 valid, 13 partly done, 1 done, 2 stale, 2 duplicate, 8 mis-prioritised; 50% of the file is finished history |
| Product critique (Claude subagent, independent) | users, recent work, plan, risks | one real user (the owner); polish and process outrun users; IP is the biggest risk; analytics approved but never wired |
| Codex (gpt-6-astra, outside voice) | backlog as a management tool, priorities, plan | backlog unusable as a queue; P1 does not mean urgent; physical credibility is the central product risk (Critical); measure the funnel before building infrastructure |

Disagreement resolved on evidence: the product critique said onboarding and
phone use are missing; Codex was right that example onboarding exists and
phones get a read-only view (`app/src/screenMode.ts`).

Facts verified by hand before acting on them:
- `VerdictLine.tsx:371-383`: raised-over-floor crossings print "clearance is
  about −6mm" (rise 61 from `measurements.ts` q5, plank 12, train 55) as a
  plain note; bridge pieces already warn.
- `README.md:117-125` says no drag-and-drop, single cycle, no inventory/3D/
  build mode; `README.md:207` reads "Generic is a live trademark of Generic AB".

## Premise (0A)

With the partnership shelved, the app has one promise: say truthfully whether
a layout will work. The review ranks work by how directly it protects that
promise, then by whether anyone can find and use the app. Do-nothing cost: a
3,140-line list where half is history and three of seven P1s are not urgent,
while the app shows a negative clearance as fine and the public README
misdescribes it.

## Decision ledger

| ID | Decision | Status | Owner's answer |
|---|---|---|---|
| MODE | SCOPE REDUCTION | approved | mode question |
| SHELVE | Partnership plan and its seven TODOs shelved, kept on disk | approved | direct instruction ("forget about any partnership and outreach for now") |
| D1 R-3D | Richer 3D deferred to a P3 TODO, design kept | approved | "A) Defer, design kept" |
| D2 R-CLEAR | Negative clearance becomes a P1 warning now; F2 refines later | approved | "A) P1, warn now" |
| D3 R-README | README rewrite and trademark line raised to P1 | approved | "A) P1, rewrite" |
| D4 R-ARCHIVE | Finished entries moved word for word to `docs/plan/TODOS-archive.md` | approved | "A) Archive finished" |
| D5 R-CLOSE | Six done/stale entries closed with evidence; four duplicate pairs merged | approved | "A) Close 6, merge 4" |
| D6 R-PRIO | Backend P1→P3; canvas + size cap merged P1→P3; inventory P1→P2 narrowed; calibration P1→P2 umbrella; saves P1→P2 retitled | approved | all four ticked |
| D7 R-CUT | Deleted: selection colour token, 24-state table, guard holes, CONTRIBUTING.md | approved | all four ticked |
| D8 R-LEARN | New P2: wire the analytics approved on 2026-11-01 | approved | "A) Add as P2" |

Approval readiness: PASS (MODE, SHELVE, D1-D8; each applied only within its answer's scope).

## What changed in the TODO list

- 3,140 lines → 1,228 active lines; 47 finished or closed entries in
  `docs/plan/TODOS-archive.md` (1,910 lines, word for word); 4 deleted (D7);
  verified that no other body text was lost.
- Open entries: 33. P1 now means do next: the clearance warning (D2), the
  README (D3), and the IP question (counsel, not code).
- Each changed entry carries a dated note citing its decision and evidence.

## Review sections (strategy-only, at backlog level)

1. **Architecture.** No code changes in this review. The clearance fix reuses
   the bridge pieces' existing warning (`VerdictLine.tsx:345-366`); no new
   component. OK.
2. **Errors and rescue.** Capability rows:

   | Capability | Failure | User sees today | Disposition |
   |---|---|---|---|
   | Raised-over-floor clearance | negative gap | a plain "about −6mm" note | **CRITICAL GAP** → P1 (D2) |
   | Rescue copy of a refused layout | full storage | copy silently missing | P2 (D6) |
   | "Download a copy" backup | the app cannot reopen it (`linkWords.ts:68`) | a file with no way back in | P2 "Layout file when a link is too long"; its trigger has fired, priority unchanged (no decision taken) |
   | Bend limit | inferred from one loop of one set | a confident verdict | P2 calibration umbrella (D6) |
   | Ramp length | 216 modelled vs 225 floor reading | every ramp 9mm short | P2 "The ramp measures 225mm" |
3. **Security and legal.** The live site carries the overdue provenance
   question (High likelihood of mattering, High impact); stays P1 for counsel.
   Analytics limited to the approved privacy-friendly counter (D8).
4. **Data and interaction edges.** The clearance warning's wording must hold
   for both a measured and an estimated train (`trainMeasured`); F2 refines the
   figure. Implementation owner must prove the warning appears exactly when the
   computed gap is negative.
5. **Code quality.** Profile copies now six or more (merged into one entry);
   `App.tsx` is 2,218 lines, not the 627 its entry states (figure stale; entry
   kept P3).
6. **Tests.** Codex: exact arithmetic and the 670-layout corpus cannot prove
   physical accuracy; only floor readings can (calibration umbrella). The
   verdict's spoken announcement has never been heard by a person with a
   screen reader (P2, needs a human).
7. **Performance.** Bounded by the canvas ceiling and the linear engine; the
   remaining work is P3 (D6).
8. **Observability.** No usage signal at all from the live site → D8.
9. **Deployment.** CI and Pages exist; nothing in this review deploys.
10. **Long-term.** The list's rule "bodies are kept as written" is what let
    it decay; the archive keeps history without burying open work.
    Reversibility 5/5 (documents only).
11. **Design.** SKIPPED (no new UI scope; the clearance warning reuses an
    existing pattern).

## NOT in scope

- Partnership, outreach and the seven partner features: SHELVED (owner's
  instruction); kept under "Shelved: partnership".
- Richer 3D pieces: deferred to P3 (D1), design kept.
- Deleted (D7): selection colour token, 24-state table, guard holes,
  CONTRIBUTING.md (text in git history).

## What already exists

Example onboarding, a phone read-only view, share links without a server,
per-piece inventory with shortfalls, CI and Pages deploys, the bridge pieces'
clearance warning, the calibration sheet with diagrams (F1-F4).

## Dream state delta

```
BEFORE                              AFTER THIS REVIEW                  NEXT
3,140-line list, 7 "P1"s, a     ->  1,228-line list, 3 real P1s,  ->  clearance warns, README true,
negative clearance shown as         archive kept, partnership         a usage number, floor readings
fine, no usage signal               shelved, analytics queued          (ramp, bend, F2, F4) in
```

## Implementation Tasks

- [x] **T1 (P1, human: ~2h / CC: ~15min)**: verdict: warn when raised track over floor track leaves a negative clearance
  - Surfaced by: D2; `VerdictLine.tsx:371-383`
  - Files: `app/src/VerdictLine.tsx`, its tests
  - Verify: a layout with a raised crossing and the 61mm rise shows the warning; a positive clearance shows none; mutation run per the project's rule
- [x] **T2 (P1, human: ~3h / CC: ~20min)**: README: describe the app as it ships; fix the trademark line
  - Surfaced by: D3; `README.md:117-125`, `README.md:207`
  - Files: `README.md`
  - Verify: every claim checked against the app; no maker named
- [ ] **T3 (P1, owner)**: IP: take the provenance and seed-licence questions to counsel
  - Surfaced by: section 3; generic-TODOS "IP: data provenance"
  - Files: none
  - Verify: a written answer recorded in the entry
- [ ] **T4 (P2, human: ~2h / CC: ~15min)**: wire the approved analytics counter
  - Surfaced by: D8
  - Files: to be determined (per the 2026-11-01 plan)
  - Verify: counts appear for a test visit; nothing beyond the approved counter is sent

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SCOPE REDUCTION                             |
  | System Audit         | 90 entries, 50% finished history, 7 P1s;    |
  |                      | −6mm clearance shown as fine; README stale  |
  | Step 0               | partnership shelved; 8 decisions            |
  | Section 1  (Arch)    | 0 issues found                              |
  | Section 2  (Errors)  | 5 capability rows mapped, 1 GAP (→ P1)      |
  | Section 3  (Security)| 1 issue found, 1 High severity (IP)         |
  | Section 4  (Data/UX) | 1 edge case mapped, 0 unhandled             |
  | Section 5  (Quality) | 2 issues found                              |
  | Section 6  (Tests)   | 2 gaps (physical proof, screen reader)      |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 1 gap found (→ D8)                          |
  | Section 9  (Deploy)  | 0 risks flagged                             |
  | Section 10 (Future)  | Reversibility: 5/5, debt items: 1           |
  | Section 11 (Design)  | SKIPPED (no UI scope)                       |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (3 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 5 rows, 1 CRITICAL GAP (→ P1)               |
  | Failure modes        | 5 total, 1 CRITICAL GAP (→ P1)              |
  | TODOS.md updates     | 2 added (D1, D8), 4 deleted, 47 archived    |
  | Scope proposals      | n/a (reduction)                             |
  | CEO plan             | skipped by mode                             |
  | Outside voice        | codex: completed; 2 Claude subagents        |
  | Lake Score           | 2/2 recommendations chose complete option   |
  | Diagrams produced    | 1 (dream state)                             |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0                                           |
  +====================================================================+
```

## Eng review of T1: the negative-clearance warning (2026-11-04)

Target: T1 above and its P1 entry in `docs/plan/generic-TODOS.md` ("Raised
track over floor track shows a negative clearance with no warning").
Branch: `clearance-warning`.

### Current behaviour (runtime evidence)

```
VerdictLine notesFor(raised, bridges)
  ├─ RaisedNote(bridges = crossings of plain raised track over floor track)
  │     "Raised track: supports are not checked."
  │     bridges > 0 → "It crosses other track at N places; clearance is about
  │                    {rise − plank − train}mm (61, 12, 55)"   ← −6, plain text
  └─ BridgeClearance(note) per bridge piece (structures, excluded from N)
        spare = opening − plank − train
        spare < 0 → fail register: "X Your 55mm train won't fit under the
                    stone arch bridge (piece 1): 60mm opening."
        else      → "Under the …: about Smm to spare (…)"
```

`VerdictLine.tsx:350-384`; crossings exclude structures (`solve.ts:241-247`);
`CLEARANCE` from `engine/data/calibration.ts:117` (rise 61 measured, plank 12
published, train 55 measured). No preset has a ramp, so the first-visit
example is unaffected.

### Scope Challenge

- Reuse: BridgeClearance's fail register already says this for bridge pieces,
  with the same numbers (HB: 61mm opening, −6). CEO D2 approved "reuses the
  bridge pieces' existing warning, one shape for both cases".
- Minimum change: `app/src/VerdictLine.tsx` and the two tests that pin the old
  sentence (`twoLevels.dom.test.tsx:132`, `twoLevelViews.test.ts:112`). 3
  files, 0 new classes or services: complexity gate not tripped.
- The verdict glyph stays as it is: the layout can be built, only the train
  cannot pass (existing contract, design DD5, `VerdictLine.tsx:344-348`).
- TODO cross-reference: calibration F2 (air gap with the train pushed under)
  refines the figure later; wheels ride in 3mm grooves, so the real gap may be
  up to 3mm better, still negative.

Findings:
1. [INFORMATIONAL] (confidence: 9/10) `VerdictLine.tsx:358` — the approved
   wording (CEO D2: "with 'may not pass'") differs from the bridge pieces'
   existing sentence for the same −6mm ("Your 55mm train won't fit under the
   …"). One of the two must give, or the app says two things about one gap.

## Decision ledger (eng)

### R1: the warning's wording
Finding: 1, INFORMATIONAL, 9/10, `app/src/VerdictLine.tsx:358`, primary reviewer
Plan baseline: CEO D2 answer "A) P1, warn now": "warn now, like the bridge pieces, with 'may not pass'"
Runtime evidence: bridge pieces say "Your 55mm train won't fit under the {name} (piece N): {opening}mm opening." at spare < 0 (`VerdictLine.tsx:356-360`)
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1 wording, raised crossings | plain "clearance is about −6mm" | "Your 55mm train won't fit under raised track (N places): 61mm opening." | "Your 55mm train may not pass under raised track (N places): 61mm opening." |
| R1 wording, bridge pieces | "won't fit" | unchanged, "won't fit" | changed to "may not pass" for all |
| Verdict glyph | unchanged (DD5) | unchanged | unchanged |
| Fail register with X | bridges only | both | both |

Question D1:
D1 — Raised crossing warning: say "won't fit" like the bridges, or "may not pass"?
Project/branch/task: ChooChooCAD clearance-warning, T1 (the negative-clearance warning, P1).
ELI10: You approved warning "like the bridge pieces, with 'may not pass'". But the bridge pieces already say "Your 55mm train won't fit under the stone arch bridge" for exactly the same −6mm gap. "May not pass" was meant to allow for the wheels sitting 3mm down in the grooves; even then the gap is −3mm, so the train still hits. If raised crossings say "may not pass" and bridges say "won't fit", the app says two different things about one number.
Stakes if we pick wrong: the app hedges where the arithmetic is clear, or contradicts itself between bridges and raised track.
Recommendation: A because the numbers are identical, the grooves still leave a negative gap, and one sentence shape for both is what D2 approved ("one shape for both cases").
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) "Won't fit", same as the bridge pieces (recommended)
  ✅ One sentence for one fact, wherever the train passes under raised track
  ✅ True even with the 3mm grooves allowance: the gap is still negative
  ❌ Departs from the words "may not pass" in your D2 answer
B) "May not pass", and the bridge pieces change to match
  ✅ Keeps your D2 wording, and stays cautious until F2 is measured
  ✅ Bridges and raised track still say the same thing
  ❌ Softens a warning the arithmetic already supports, on every bridge too
Net: one firm sentence everywhere versus one cautious sentence everywhere.
Header: D1 Wording
Options:
A) Won't fit, like bridges (recommended)
Raised crossings say "Your 55mm train won't fit under raised track (N places): 61mm opening." in the fail register with the X; bridge sentences unchanged; verdict glyph unchanged. Effort: human ~1h / CC ~10min, low risk.
B) May not pass, everywhere
Raised crossings and all bridge pieces say "may not pass" instead of "won't fit"; verdict glyph unchanged. Effort: human ~1.5h / CC ~15min (more tests change), low risk.

State: approved
Actual answer: B) May not pass, everywhere (owner's answer to D1, 2026-11-04)
Accepted scope: raised crossings and every bridge piece say "may not pass" instead of "won't fit", in the fail register with the X; raised crossings gain that fail sentence ("Your 55mm train may not pass under raised track (N places): 61mm opening."); verdict glyph unchanged; the tests pinning the old sentences change with it.
History: none

### Sections 1-4 and the outside voice (eng)

Section 1 (architecture): [INFORMATIONAL] (8/10) `VerdictLine.tsx:371-384` two
ways to do one task (RaisedNote computes its own gap, BridgeClearance its
own). Accepted under CEO D2 ("one shape for both cases") and eng D1: one shared
train-fit sentence; raised crossings pass the rise (61) as their opening,
bridges their arch, tunnels their vault (`verdictView.ts:266-278` uses the same
component, so D1's "everywhere" covers tunnels). No new module; design-twice
not applicable.
Section 2 (code quality): under one shape the positive case reads like the
bridges ("about N mm to spare (opening, track, train)"); "Raised track:
supports are not checked." stays its own sentence (DESIGN.md rule 3).
Section 3 (tests): required proof, all with run mutations: raised crossing
fails (twoLevelViews.test:112-114 incl. the '55mm train).' assertion,
twoLevels.dom.test:132); bridges and tunnel fail (structuresApp.test:477,494,
572, plus a tunnel failure); a raised crossing that fits; supports-only; the
verdict glyph unchanged; a layout with a bridge piece and a plain crossing,
each keeping only its own sentence; the X aria-hidden with the full spoken
sentence; margins just below zero, at zero and just above.
Section 4 (performance): no issues found.

Outside voice (Codex, gpt-6-astra), dispositions:
- High "level 2 over floor has a 122mm opening": downgraded to Low on
  evidence: any level-2 piece is refused as a third level (`frames.ts:201-216`)
  and fails the verdict (`verdictView.ts:143`); on every buildable layout the
  gap is one level (61). Residual: a refused layout may show the 61mm note.
- Medium "N places assumes identical gaps": follows from the above; identical
  on buildable layouts.
- Medium "ramp crossings are clashes": correct and unchanged
  (`overlap.ts:259-263`); a test keeps it so.
- Medium "rounding can suppress failures": confirmed (`VerdictLine.tsx:353-354`
  rounds before comparing). Fixed as required proof of "warn exactly when the
  gap is negative": compare the unrounded margin, round only the text.
- Medium/Low tests, accessibility, dedup: added to Section 3's required proof.

### R2: a margin of exactly zero
Finding: Codex Medium (rounding), confirmed, `app/src/VerdictLine.tsx:354`
Plan baseline: unspecified; today spare 0 takes the passing branch ("about 0mm to spare")
Runtime evidence: `if (spare < 0)` on a rounded spare (`VerdictLine.tsx:355`)
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R2 margin exactly 0 | passes ("about 0mm to spare") | "may not pass" (fail register) | passes ("about 0mm to spare") |
| R1 wording | approved: "may not pass" | unchanged | unchanged |
| Rounding | rounds before comparing | compare unrounded (required) | compare unrounded (required) |

Question D2:
D2 — When the train's roof exactly touches the track above (0mm to spare), warn or not?
Project/branch/task: ChooChooCAD clearance-warning, T1.
ELI10: The warning fires when the train is taller than the gap. If the gap and the train are exactly equal, the roof just touches the underside of the track above. Today that reads "about 0mm to spare", as if fine. Real wood varies by a millimetre either way, and a train that touches will usually catch or derail.
Stakes if we pick wrong: a layout whose train just scrapes is shown as fine; or a warning on a train that would have squeezed through.
Recommendation: A because a touching roof catches in practice, and "may not pass" is already the cautious word you chose.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Zero margin warns: "may not pass" (recommended)
  ✅ A train that scrapes the track above is flagged before anyone builds it
  ✅ Matches the cautious "may not pass" wording you chose in D1
  ❌ A train that would just squeeze through gets a warning it didn't need
B) Zero margin passes: "about 0mm to spare"
  ✅ Only a train strictly taller than the gap is flagged, the plain arithmetic
  ✅ Fewer warnings on layouts that are right at the limit
  ❌ Says "to spare" when nothing is spare and the roof touches
Net: caution at the exact limit versus strict arithmetic.
Header: D2 Zero
Options:
A) Zero warns (recommended)
A margin of 0mm or less shows "may not pass" in the fail register; only a positive margin reads "to spare". Effort: same change, one extra test; low risk.
B) Zero passes
Only a negative margin warns; exactly 0 reads "about 0mm to spare". Effort: same change; low risk.

State: approved
Actual answer: A) Zero warns (owner's answer to D2, 2026-11-04)
Accepted scope: a margin of 0mm or less shows "may not pass" in the fail register; only a positive margin reads "to spare"; the comparison uses the unrounded margin; tests at just below zero, zero and just above.
History: none

Approval readiness: PASS (R1: D1 answer B; R2: D2 answer A; the merge into one sentence, rounding fix and tests are required proof of CEO D2 and these answers).

### Implementation (eng)

- [x] **T1a (P1, human: ~2h / CC: ~20min)**: VerdictLine — one train-fit sentence for raised crossings, bridges and tunnels
  - Surfaced by: CEO D2, eng R1 (D1 B), R2 (D2 A), Codex rounding finding
  - Files: `app/src/VerdictLine.tsx`; tests `app/src/twoLevelViews.test.ts`, `app/src/twoLevels.dom.test.tsx`, `app/src/structuresApp.test.ts`
  - Behaviour: margin = opening − 12mm track − 55mm train, unrounded; margin ≤ 0 → fail register with an aria-hidden X: "Your 55mm train may not pass under {raised track (N places) | the stone arch bridge (piece 1) | …}: {opening}mm opening."; margin > 0 → "about {rounded}mm to spare ({opening}mm opening, 12mm track, 55mm train)"; "Raised track: supports are not checked." unchanged; verdict glyph unchanged
  - Verify: the Section 3 list above, each with a mutation actually run; full suite; verdict corpus unchanged (0 of 670)

NOT in scope (eng): per-crossing level differences (level 2 is refused as a third level); a local clearance for ramps (they clash instead); refining 61/12/55 (calibration F2).

What already exists: BridgeClearance's fail register (`VerdictLine.tsx:350-369`), bridgeNotesOf and tunnelNotesOf (`verdictView.ts:238-278`), the crossing count excluding structures (`solve.ts:241-247`).

Failure modes: a margin rounding to −0 passing (fixed by comparing unrounded, tested); a bridge piece also counted as a plain crossing (excluded today, tested); a third-level layout citing 61mm (accepted residual, Low).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | mode: SCOPE_REDUCTION, 0 critical gaps open (1 found, moved to P1) |
| Outside Review | codex exec (plan-review) | Independent 2nd opinion | 2 | completed | CEO: 9 findings; 9 resolved. Eng: 7 findings; 7 resolved (1 downgraded on evidence) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 2 issues, 0 critical gaps (T1 clearance warning) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex (gpt-6-astra): CEO phase completed, 9 findings; eng phase completed, 7 findings (rounding confirmed and fixed in the plan; the level-2 High downgraded to Low on `frames.ts:201-216` and `verdictView.ts:143`). Two native Claude subagents in the CEO phase.
- **CROSS-MODEL:** in the eng phase Codex alone found the rounding defect in the existing BridgeClearance (`VerdictLine.tsx:353-355`); the primary review had missed it.
- **VERDICT:** CEO + ENG CLEARED for T1 (the negative-clearance warning): ready to implement.

NO UNRESOLVED DECISIONS
