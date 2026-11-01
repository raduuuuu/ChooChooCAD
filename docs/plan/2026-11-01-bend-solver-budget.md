# Plan: complex layouts that work on the floor are refused (revisit the calibration)

Owner request (2026-11-01, /plan-ceo-review): "we need to revisit the calibration: I tried the tool for a more complex layout and I think it's too strict, preventing the creation of some layouts that would otherwise work on the floor" … "the problem is more general, if you try to join all loose ends it would fail."

Evidence layout: the owner's share link (60 pieces, 59 joints, 15 free ends; kept at `.gstack/tmp/link.txt`, not committed). Symptom picked: "Loop 'doesn't close'".

## Premises (measured 2026-11-01)

| # | Premise | Finding | Evidence |
|---|---|---|---|
| P1 | The joint calibration is too strict | **False for this layout.** Its two closed loops need 2.53° and 1.03° of bend against the inferred 2.69° limit; with all six joinable loose-end pairs joined it still needs 2.53° | probe over `solveGraph` (`.gstack/tmp/probeAll.tsx`); `bun run calibration`: limit 2.687° inferred from Q1, stretch 2mm measured |
| P2 | What fails when all loose ends are joined | **The bend solver's work budget.** From 4 interlocking loops the verdict is BEND_UNCHECKED ("Could not check the bend: out of work", once "the model still leaves 4.4mm"). Raising the limit to 3.5° or 5° does not help; raising `BEND_BUDGET` ×10 makes all six joins NEEDS_GIVE in 91ms, and ×100 gives the same answer in the same time | engine/src/graph/bendRun.ts:276 `BEND_BUDGET = { maxCells: 2_000_000, maxWork: 20_000_000 }`; sensitivity grid in this review |
| P3 | The X "Track overlaps" while ends are open | Real: unjoined ends' planks overlap (e.g. piece 44 D and piece 60 A2, 387 mm²) until joined; clears when joined | `findPlankOverlaps` before/after the join |
| P4 | Calibration headroom | The loop uses 94% of a limit that is a lower bound (Q1 felt "strained"; Q2's bend was never measured) | engine/data/measurements.ts q2.bendDeg null; engine/data/bendLimit.ts |

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| R1 (Sec 1, 7) | Bend solver budget | maxWork 20M | A: maxWork 200M (×10), same solver; maxCells unchanged (does not bind) | approved | D1 answer "Raise the work budget ×10 (recommended)", 2026-11-01 |
| R2 (Sec 11, reopened by OV-D) | Wording when the bend check cannot finish | "Could not check the bend: out of work … build it and see." | Grey ?, never red. Out of work: "The bend check ran out of time before it could finish. That says nothing against the track: build it and see." Leftover: "The bend check got within N mm of closing but not all the way. It may still go together: build it and see." | approved | D2 A, then reopened by outside voice OV-D: D6 "Only what's known (recommended)", 2026-11-01 |
| OV-B (outside) | Per-loop diagnostics in solveBend | each loop re-solved alone; an exhausted one discards the solved whole (bend.ts:512-526); `standalone` read by nothing | drop the per-loop re-solves and the unused `standalone` field | approved | D3 "Apply: drop the per-loop re-solves (recommended)" |
| OV-A (outside) | Work accounting | a failed or exhausted refinement and a null result are not charged (bend.ts:470) | charge every unit so spent ≤ maxWork; re-measure the worst case at 200M | approved | D4 "Apply: count every unit spent (recommended)" |
| OV-C (outside) | Proof that verdicts don't regress | owner's fixture only | run the frozen corpus, presets and fixtures under old and new solver; list every changed verdict in the PR with its cause; fail on any works → fails | approved | D5 "Apply: compare every corpus layout (recommended)" |
| OV-E (outside) | Q2 geometry | `atan2(sideways, over)` vs a drawing labelled with the piece's length | correction: the drawing defines `over` as the distance along the held piece's line from the joint to where the sideways travel is measured, so `atan2` is exact | approved (correction, no behaviour change) | factual correction under the approved Q2 scope |
| P1–P4 (0A) | Premises above | measured | — | approved | Target answer "Solver, and re-measure Q2 too", 2026-11-01: the review targets the bend solver's budget for interlocking loops and how its could-not-check verdict reads, plus a Q2 bend measuring sheet with an engineering drawing; calibration numbers unchanged until Q2 is measured |

Mode: HOLD SCOPE (mode answer, 2026-11-01).

## Budget evidence (measured 2026-11-01, owner's layout with its six joinable loose-end pairs joined)

| maxCells | maxWork | 4 loops | 5 loops | 6 loops |
|---|---|---|---|---|
| 2M | 20M (today) | could not check | could not check | could not check |
| 20M | 20M | could not check | could not check | could not check |
| 2M | 60M | works, 17ms | works, 35ms | could not check |
| 2M | 100M | works | works | could not check, 68ms |
| 2M | 200M | works, 15ms | works, 33ms | works, 86ms |

Only `maxWork` binds. Today's 20M is spent in about 15ms (~1.3M work/ms on this machine). The work is a phase-1 simplex per bisection step (engine/src/graph/bend.ts:229), rows 3 per loop and two variables per joint, so it grows polynomially with joints × loops, not exponentially. With the limit tightened on purpose (1° and 2°), ×10 returns a real verdict ("Beyond the tested bend: needs up to 2.6°") in 68–134ms.

## Answered: R1 (D1 → A)
Commitment comparison:

| Commitment | Source/approval or pending | Current | A | B | C |
|---|---|---|---|---|---|
| The owner's layout, all ends joined, gets a real verdict | P2 approved target | could not check | yes (works, 2.53°) | yes | yes |
| Work budget | pending | 20M | 200M | 200M, and the bisection replaced by one LP minimising lambda | 200M, solved in a Web Worker |
| Worst-case pause in the editor | pending | ~15ms | ~150ms desktop, ~0.5–0.75s slow phone [estimated] | far lower (one LP) [estimated 30–50× less work] | none (off the main thread), plus a "checking" state |
| Verdict numbers on existing layouts | existing contract | — | unchanged (same solver) | must be re-proved by a differential over the corpus | unchanged |
| Tests | required | — | owner's layout frozen as a fixture (all joins → NEEDS_GIVE); a budget-timing guard | A's plus the corpus differential | A's plus worker wiring |

Question: D1 — R1: How should the bend solver get enough budget for interlocking loops?
Header: Solver fix
A) Raise the work budget ×10 (recommended)
maxWork 20M → 200M, same solver. Your layout passes; worst case is about 150ms on a desktop and maybe 0.5–0.75s on a slow phone, only on big interlocking layouts. Effort S, risk low; your layout frozen as a test.
B) ×10 and a faster solver
Same budget, and find the smallest bend in one linear program instead of bisecting through dozens of them: much less work, so the pause stays small. Effort M, risk medium: every existing verdict must be re-proved against the corpus.
C) ×10 in a background worker
Same solver, run off the main thread so the editor never pauses, with a "checking…" state while it works. Effort L, risk medium: new wiring and a new state on screen.

## Review sections

1. **Architecture:** no new component. `BEND_BUDGET.maxWork` (engine/src/graph/bendRun.ts:276) is the one number; `maxCells` stays (measured: it does not bind). Rollback = revert the constant.
2. **Errors:** the solver already reports out-of-work and leftover as `status: 'unchecked'` with a `why`; only the words change (R2). No new failure path.
3. **Security:** none (no input, storage or network change). The frozen fixture is the owner's own layout, stored as plain pieces and joints.
4. **Edge cases:** a layout that still exhausts 200M gets the new grey ? sentence; a loop truly beyond the bend gets "Beyond the tested bend" (seen at 1° and 2° limits); small layouts are unaffected (they never reached 20M).
5. **Code quality:** the two sentences live in `verdictAction.ts` with the other verdict words; the `why` strings in bendRun.ts are mapped there, not rewritten in the engine.
6. **Tests:** (a) the owner's layout with its six loose-end pairs joined, frozen as a stored-graph fixture: verdict NEEDS_GIVE, needing 2.53° (fails at today's budget: run as the mutation); (b) a deterministic work guard: the fixture's spent work is under the budget with a stated margin, so a future budget cut is caught without timing; (c) the R2 sentences, both cases, in the verdict tests; (d) the copy guard still passes.
7. **Performance:** today's budget is spent in ~15ms; 200M is ~150ms on this machine at worst [estimated from ~1.3M work/ms], 0.5–0.75s on a slow phone [estimated]. Only big interlocking layouts reach it; the owner's needed 86ms.
8. **Observability:** the verdict names the check's own limit (R2); no telemetry.
9. **Deploy:** one PR; revert-safe.
10. **Trajectory:** if layouts grow past 200M, B (one LP for the smallest bend) and C (a worker) remain the next steps; they were offered and not chosen now. Reversibility 5/5.
11. **Design:** R2's wording; Q2's drawing follows the sheet's existing drawing style (`svg.dwg`), plan view of two straights, one held on a rule, the other swung to the limit, with the sideways travel and length marked.

## Q2 measuring sheet (approved scope, P1–P4 answer)

Add an engineering drawing to Q2 in docs/calibration-sheet.html (memory: measurements need diagrams): plan view, piece 1 held along a steel rule, piece 2 joined and swung flat on the floor until the joint binds without forcing; label "sideways travel at the far end, square to the rule" and "distance along the rule from the joint to that point" (eng X5: not piece 2's length). Questions phrased so they can't be read backwards. When the owner fills `q2.bendSidewaysMm` / `q2.bendOverMm`, `bendLimit.ts` takes the measured value over the Q1 inference automatically.

## Outside voice (Codex gpt-6-astra) and dispositions

| # | Finding | Severity | Verified | Disposition |
|---|---|---|---|---|
| OV-A | Work cap leaks: exhausted/null refinements uncharged | High | yes, bend.ts:470 | D4 Apply |
| OV-B | Unused per-loop diagnostics can veto a solved run | High | yes, bend.ts:512-526; with the veto removed, 4 loops pass at 20M; with the re-solves skipped, 5–6 loops still need >20M | D3 Apply |
| OV-C | More budget can change borderline verdicts | Medium | plausible (Codex probe: Q1 lambda 1.0026 → 0.9952) | D5 Apply |
| OV-D | R2 wording claims an unknown cause | Medium | yes, solve.ts:385 forwards the first unchecked reason only | D6 Apply |
| OV-E | Q2 drawing vs atan2 | Medium | yes, calibration.ts:93 | correction |

Approval readiness: PASS — P1–P4 (target answer), MODE (mode answer), R1 (D1 A), R2 (D2 A reopened → D6 A), OV-A (D4 A), OV-B (D3 A), OV-C (D5 A), OV-E (correction).

## NOT in scope

- Deferred: none.
- Rejected: a faster solver (one LP for the smallest bend) and solving in a Web Worker (D1 options B, C) — the next steps if layouts outgrow 200M; loosening the joint calibration (target answer: it would not fix the layout).

## What already exists

The bend solver (bend.ts, bendRun.ts), its unchecked status and `why`, the verdict word tables (verdictAction.ts), the calibration pipeline that prefers a measured Q2 over the Q1 inference (bendLimit.ts), and the sheet's drawing style (calibration-sheet.html `svg.dwg`).

## Dream state delta

```
  CURRENT                              THIS PLAN                           12-MONTH IDEAL
  interlocking loops "could not   -->  same solver, honest budget,    -->  any layout a family builds gets a
  check"; per-loop diagnostics         no veto, wording that blames         verdict in under a frame; joint
  veto good answers; bend limit        the checker not the track; Q2        limits measured, not inferred
  only inferred                        sheet ready to measure
```

## Failure modes

| Codepath | Failure | Rescued | Test | User sees |
|---|---|---|---|---|
| solveBend | budget exhausted | yes, unchecked | owner fixture + exhausting run | grey ?, R2 sentence |
| solveBend | a solved run vetoed by a diagnostic | removed (OV-B) | multi-loop test | — |
| work accounting | overspend past maxWork | fixed (OV-A) | spent ≤ maxWork test | — |
| corpus | a verdict moves works → fails | caught | differential (OV-C) | — |
| Q2 reading | wrong conversion | drawing matches formula (OV-E) | calibration test | — |

0 critical gaps.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [x] **B1 (P1, human: ~6h / CC: ~40min)** — engine — Give the bend solver an honest 200M budget and stop diagnostics vetoing answers
  - Surfaced by: R1, OV-A, OV-B, OV-C
  - Files: engine/src/graph/bendRun.ts, engine/src/graph/bend.ts, engine/test (fixture + accounting + differential), app/src/test or engine/test fixture of the owner's layout
  - Verify: owner's layout with its six pairs joined → NEEDS_GIVE at 2.53° (fails at 20M: run as the mutation); an explicit exhausted outcome distinct from infeasible (eng X1); work units defined and charged before they are spent, with tests for a zero budget, a budget too small to set up, and exhaustion mid-pivot, spent ≤ maxWork in each (eng X2); verdictDiff classifies with `viewOf` and fails on any move out of EXACT/NEEDS_GIVE, including to BEND_UNCHECKED (eng X4), table in the PR; owner fixture and worst case re-measured at 200M after the accounting change
- [x] **B2 (P1, human: ~2h / CC: ~15min)** — app — Say the bend check's limit plainly
  - Surfaced by: R2, OV-D, eng X3
  - Files: app/src/verdictAction.ts, app/src/VerdictLine.tsx (it appends the raw detail today), verdict render tests
  - Verify: rendered verdict for out-of-work and for leftover N mm shows the D6 sentences; the other reasons render unchanged; copy guard passes
- [x] **B3 (P2, human: ~2h / CC: ~15min)** — docs — Q2 engineering drawing
  - Surfaced by: target answer, OV-E
  - Files: docs/calibration-sheet.html
  - Verify: the drawing labels match `measuredBendDeg`'s atan2(sideways, over), with `over` dimensioned as the distance along the held piece's line from the joint (never "piece 2's length"; the sheet's existing row label is changed too, eng X5); sheet renders (headless screenshot)

## Reality rows

REALITY: premise-table pass unverified=0 (every premise measured by the probe) docs/plan/2026-11-01-bend-solver-budget.md:9
REALITY: already-done pass no commits to bend.ts or bendRun.ts since the ask engine/src/graph/bendRun.ts:276
REALITY: surface-check pass `bun run calibration` and the probe ran engine/data/bendLimit.ts:1
REALITY: binding-decisions pass the joint-bend design (lambda, Q1 inference) is kept engine/src/graph/bend.ts:1
REALITY: numbers pass 2.687° [measured: bun run calibration engine/tools/calibration.ts:1]; 2.53° [measured: .gstack/tmp/probeAll.tsx:1]; 86ms at 200M [measured: .gstack/tmp/probeAll.tsx:1]; ~150ms worst [estimated] engine/src/graph/bendRun.ts:276
REALITY: deferred-asks pass no linked issue engine/data/measurements.ts:1
REALITY: pr-count pass one PR for B1+B2, B3 may ride along docs/calibration-sheet.html:68

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | HOLD SCOPE                                  |
  | System Audit         | calibration not the cause; solver budget +  |
  |                      | diagnostic veto refuse interlocking loops   |
  | Step 0               | target retargeted (calibration → solver)    |
  | Section 1  (Arch)    | 1 issue (budget)                            |
  | Section 2  (Errors)  | 2 error paths mapped, 0 GAPS                |
  | Section 3  (Security)| 0 issues                                    |
  | Section 4  (Data/UX) | 3 edge cases mapped, 0 unhandled            |
  | Section 5  (Quality) | 0 issues                                    |
  | Section 6  (Tests)   | 4 tests planned, 0 gaps                     |
  | Section 7  (Perf)    | 1 issue (worst-case pause), measured        |
  | Section 8  (Observ)  | 0 gaps                                      |
  | Section 9  (Deploy)  | 0 risks                                     |
  | Section 10 (Future)  | Reversibility: 5/5, debt items: 0           |
  | Section 11 (Design)  | 1 issue (wording), resolved                 |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (3 rejected)                        |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 2 rows, 0 CRITICAL GAPS                     |
  | Failure modes        | 5 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | 0 items proposed                            |
  | Scope proposals      | 0 (HOLD)                                    |
  | CEO plan             | skipped by mode                             |
  | Outside voice        | codex completed, 5 findings, 5 resolved     |
  | Lake Score           | 3/3                                         |
  | Diagrams produced    | 1 (dream state); flows unchanged            |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7, 0 unverified                           |
  +====================================================================+
```

## Eng review (2026-11-01)

Scope record: feature answers: none cut; structure: A Original arrangement (eng D1); accepted scope: B1–B3 in 9 files — engine/src/graph/bend.ts, engine/src/graph/bendRun.ts, app/src/verdictAction.ts, docs/calibration-sheet.html, engine/test/bend.test.ts (the `standalone` assertions retired on purpose), engine/test/bendBudget.test.ts (new), engine/test/fixtures/owner-interlocked.json (new), app/src/verdictAction.test.ts or the verdict tests, scripts/verdictDiff.ts (new); pending remedies: none.

Findings (no new decisions):
1. [INFORMATIONAL] (8/10) engine/test/bend.test.ts:236 `expect(o.standalone[0]).toBeCloseTo(0.5, 6);` — removing `standalone` (D3) retires this assertion on purpose; the test's main claim (the joint solve, not the max of single loops) stays.
2. [INFORMATIONAL] (8/10) engine/src/graph/bendRun.ts:244,251 — other `why`s ("a loop could not be followed round", "too big to check the bend", "a joint has no usable bend or stretch figure") keep today's "Could not check the bend: …"; D6 rewords only out-of-work and leftover.
3. [INFORMATIONAL] (7/10) engine/src/graph/solve.ts:404-415 — repair's per-cycle solves spend from the same budget only on runs already beyond and never veto; the accounting fix (D4) changes what they get, which the verdict diff (D5) covers.
4. Performance: work counts are deterministic, so the cap behaves the same on every machine; wall time re-measured at 200M after D4.

Test plan: owner fixture (all six pairs joined) → NEEDS_GIVE needing 2.53° (mutation: today's 20M → BEND_UNCHECKED); an exhausting run reports work ≤ maxWork and charges a failed refinement; scripts/verdictDiff.ts run on main and on the branch over the differential and levels corpora, presets and fixtures, exiting non-zero on works → fails, its table in the PR; both D6 sentences in the verdict tests; copyPosition guard.

### Outside voice (eng, Codex gpt-6-astra) and dispositions

| # | Finding | Severity | Disposition |
|---|---|---|---|
| X1 | A strict cap removes today's exhaustion signal (`work > maxWork`); an interrupted test could read as infeasible → beyond | High | correction to D4: explicit exhausted outcome, work reserved before it is spent |
| X2 | Work unit undefined below refinement (init charged after allocation; pivots uncharged) | Medium | correction to D4's proof: define the unit; test zero, too-small-to-set-up and mid-pivot exhaustion; re-measure after |
| X3 | VerdictLine.tsx appends the raw detail, so editing verdictAction.ts alone can't show D6's sentences | Medium | correction: B2 includes VerdictLine.tsx and rendered-output tests |
| X4 | verdictDiff needs the UI's classification and a precise failure rule | Medium | correction to D5: `viewOf` classification; fail on any move out of EXACT/NEEDS_GIVE, including to BEND_UNCHECKED |
| X5 | B3 still said "piece 2's length" | Medium | correction (OV-E): the distance along the held piece's line; the sheet's row label changes too |

Approval readiness (eng): PASS — D1 structure (Original arrangement); X1–X5 are corrections that keep approved behaviour (D4, D5, D6, OV-E) and need no new answer; CEO rows R1, R2, OV-A..OV-E carried.

### Completion summary (eng)

- Step 0: Scope Challenge — scope accepted as-is (Original arrangement)
- Reality rows: 7/7 (PLAN_REALITY complete), 0 unverified
- Architecture Review: 2 issues (informational)
- Code Quality Review: 1 issue (informational)
- Test Review: plan written, 0 gaps after corrections
- Performance Review: 0 new issues (re-measure after D4)
- Outside voice: codex completed, 5 findings, 5 resolved as corrections
- Failure modes: 0 critical gaps
- Unresolved decisions: 0
- Parallelization: sequential (B1 then B2; B3 independent)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 for this plan | CLEAR | mode: HOLD_SCOPE, 0 critical gaps |
| Outside Review | codex (gpt-6-astra), automatic after CEO and Eng review | Independent 2nd opinion | 2 | completed | CEO: 5 findings, 5 resolved; Eng: 5 findings, 5 resolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 for this plan | ISSUES OPEN | 3 issues, 0 critical gaps (all resolved; status counts resolved findings) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | wording only; not needed |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review, completed twice: CEO pass 5 findings (D3–D6, one correction); eng pass 5 findings, all corrections (X1–X5).
- **CROSS-MODEL:** both found the budget binds; Codex alone found the diagnostic veto, the accounting leak and its missing exhaustion signal, the renderer dependency for the wording, the differential's classification gap and the Q2 label. Model identity: codex gpt-6-astra; host model Claude.
- **VERDICT:** CEO CLEARED; eng review complete with 0 unresolved decisions and 0 critical gaps — ready to implement.

NO UNRESOLVED DECISIONS
