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

- [ ] **T1 (P1, human: ~2h / CC: ~15min)**: verdict: warn when raised track over floor track leaves a negative clearance
  - Surfaced by: D2; `VerdictLine.tsx:371-383`
  - Files: `app/src/VerdictLine.tsx`, its tests
  - Verify: a layout with a raised crossing and the 61mm rise shows the warning; a positive clearance shows none; mutation run per the project's rule
- [ ] **T2 (P1, human: ~3h / CC: ~20min)**: README: describe the app as it ships; fix the trademark line
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

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | mode: SCOPE_REDUCTION, 0 critical gaps open (1 found, moved to P1) |
| Outside Review | codex exec (plan-review) | Independent 2nd opinion | 1 | completed | 9 findings; 9 resolved; 0 unresolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex (gpt-6-astra), CEO phase, completed, 9 findings, all resolved through D1-D8 or recorded as findings; plus two native Claude subagents (code audit, product critique).
- **CROSS-MODEL:** Codex and both Claude subagents agree on: richer 3D before outreach is wrong, the backlog is unusable as a queue, P1s are inflated, IP is overdue, analytics is missing. They disagree on onboarding and phone use; Codex is right (example onboarding and a phone view exist).
- **VERDICT:** CEO CLEARED for this backlog review; eng review required before T1 is built.

NO UNRESOLVED DECISIONS
