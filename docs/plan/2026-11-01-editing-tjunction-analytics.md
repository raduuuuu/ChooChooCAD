# Plan: easier removal, joining close ends, a two-way T-junction, web analytics

Owner request (2026-11-01, /plan-ceo-review): "parts should be able to be removed from any part of the existing layout. It becomes difficult, when building a complex layout to remove something you placed 10 parts ago. then when the ends are very close, clicking on them to join is difficult, they overlap. I want you to also find a T shaped switch. I want to also set up web analytics"

Mode: HOLD SCOPE (owner's answer to the mode question, 2026-11-01).

## Premises (owner's answers, 2026-11-01)

| # | Premise | Owner's answer | Evidence |
|---|---|---|---|
| P1 | Removing a middle piece | Already possible (click piece → "Remove piece", or Delete); the problem is "Didn't know you could" + "Can't see what's selected" | `removePiece` app/src/editorReducer.ts:776; button app/src/App.tsx:1116; Delete key app/src/TrackCanvas.tsx:1041; selection style `.piece-selected { stroke: var(--ink); stroke-width: 2 }` app/src/app.css:200 (seen live: a thin dark edge on one curve of ten) |
| P2 | Joining close ends | Fails when "Clicking dot, then dot" | Hit circle r=26mm per free end app/src/TrackCanvas.tsx:1229; coincident ends stack, the top circle takes both clicks, and a click on the armed end disarms it (clickPort), so the end underneath is unreachable by pointer |
| P3 | T-shaped switch | "A T-junction, both ways": a stem splitting into two 90° curves, left and right | The catalogue's `T` (engine/data/switchSeeds.ts:308) is one-sided. Bigjigs T-Junction listing: 21 × 13 cm, matching two r108 quarter curves (216 across, ~128 tall) [estimated from listing; not measured] |
| P4 | Web analytics | "Visits only" (REVERSED 2026-11-05 by the owner: ten named actions are counted too, still without the layout; generic-TODOS.md analytics entry); provider switched to GoatCounter by R4 (originally Cloudflare Web Analytics) | No analytics today (app/index.html); no privacy claim in app/README/DESIGN.md to contradict; DNS at Namecheap (dig NS), site on GitHub Pages |

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| MODE (0E) | Review mode | HOLD SCOPE | — | approved | Mode question answer, 2026-11-01 |
| P1–P4 (0A) | Premises above | as table | — | approved | Premise question answers, 2026-11-01 |
| R1 (Sec 11) | How removal becomes discoverable and the selection visible | thin 2px edge; no hint | A: a heavier --ink outline plus a tint on the selected piece (tokens only); one strip line while pieces exist and none is selected — "Click a piece to select it; Remove piece or Delete takes it out." — gone after the first selection in this tab; DOM + CSS tests with run mutations | approved | D4 answer "Stronger selection + a one-line hint (recommended)", 2026-11-01; scope: selection styling and the hint only |
| R2 (Sec 4) | How a click reaches the second of two stacked ends | top dot takes every click | A: while an end is armed its own hit circle takes no pointer events, so the next click reaches the end beneath and joins (through the existing `joinRefusal`); Esc, Cancel or a floor click disarms. DOM test with a run mutation | approved | D2 answer "Armed dot lets clicks through (recommended)", 2026-11-01; scope: the armed end's hit target and its disarm routes only |
| R3 (Sec 1) | Where the T-junction's geometry and end polarity come from | no such part | C: read a printed two-way T-junction 3MF in the logged-in browser session; add as unverified with the source cited. If no two-way model exists, stop and bring it back to the owner (no silent fallback to A) | approved | D1 answer "Read a printed model", 2026-11-01; scope: the T-junction's geometry and polarity only |
| R4 (Sec 3, reopened by OV2) | How analytics is wired so a shared layout never leaves the browser | none | GoatCounter (replaces Cloudflare): a pinned, reviewed copy of `count.js` committed and served from the site (no remote script); `window.goatcounter.path` reports `location.pathname`, and `/shared-link` for any address the link route takes (`LINK_FRAGMENT`), so link visits count and no fragment is ever sent; production builds only (none in dev); owner creates the free non-commercial GoatCounter site and supplies its code (public); tests: the path function for normal, #v1. and #v9. addresses, one script in production and none in dev, and a scripted browser check that no count request carries a fragment | approved | D3 answer A (production only), then reopened by outside voice OV2: D5 "Investigate first" (beacon read: it strips hash today), then the owner's question and "yes, switch to GoatCounter", 2026-11-01; scope: analytics provider, loading and its privacy contract |

## Answered: R3 (D1 → C)
Commitment comparison:

| Commitment | Source/approval or pending | Current | A | B | C |
|---|---|---|---|---|---|
| A two-way T-junction in the palette | P3 approved | none | yes, unverified, now | yes, after measuring | yes, unverified, after a 3MF read |
| Geometry (stem + two r108 quarter curves, 216 across) | pending | — | derived from the existing T (switchSeeds.ts:308) and the Bigjigs 21 × 13 cm listing | the owner's calipers | a printed reproduction's 3MF |
| End polarity (stem, left, right) | pending | — | stated as unknown in the part's note; stem socket, arms peg as the labelled guess | measured | read from the 3MF |
| Verification | pending | — | measurement page with engineering diagram queued (memory: measurements need diagrams) | done before ship | none until measured |

Question: D1 — R3: Where should the two-way T-junction's shape and end types come from?
Header: T geometry
A) Unverified now, measure later (recommended)
Add it now as an unverified piece built from the existing T switch's 108mm curve mirrored both ways (216mm across, matching the Bigjigs 21 × 13 cm listing), with the end types marked as a guess; a measuring page with a drawing follows. Effort S, risk low: it shows the "unverified size" badge like the other 20 switches.
B) Measure my piece first
I own one: you send a measuring page with an engineering drawing, I fill it in, and the piece ships with checked numbers. Effort S now plus my time, risk lowest, but the piece waits for me.
C) Read a printed model
Find a printable two-way T-junction and read its 3MF in the logged-in browser session, as with the other switches. Effort M, risk medium: none was found by search, and a printed model may not match a shop-bought piece.

## Answered: R2 (D2 → A)
Commitment comparison:

| Commitment | Source/approval or pending | Current | A | B | C |
|---|---|---|---|---|---|
| Two stacked free ends can be joined by pointer, dot then dot | P2 approved | impossible: the top hit circle takes both clicks | yes | yes | yes |
| What a click on the armed end's own dot does | pending | disarms it | passes through to the end beneath; Esc, Cancel or the floor disarms | unchanged | unchanged |
| Extra UI | pending | none | none | a "Join to the end beside it" button when the armed end has a joinable partner within 26mm | the existing Join button offered for any angle when ends are within 26mm |
| Refused joins (polarity, level) | existing contract | refused with the reason (P2 of PR 51) | unchanged: the same `joinRefusal` | unchanged | unchanged |
| Tests | required with the change | — | DOM test: two coincident ends, click, click → welded; mutation run | DOM test for the button | unit test for the widened suggestion + DOM |

Question: D2 — R2: When two end dots sit on top of each other, how should the second click reach the lower one?
Header: Stacked ends
A) Armed dot lets clicks through (recommended)
Once you click an end, its own dot stops catching clicks, so your next click lands on the end beneath and joins them; Esc, Cancel or a click on the floor un-selects it. Effort S, risk low: the smallest change, and it fixes exactly the dot-then-dot flow.
B) A "Join to the end beside it" button
Clicking an end that has a joinable neighbour within 26mm shows a button in the strip that joins the two. Effort S, risk low, but it adds a control and leaves the dot-then-dot click still broken.
C) Offer the Join button at any angle when close
The canvas's existing Join button (today: facing within 30°, up to 100mm) also appears for ends within 26mm at any angle. Effort S, risk medium: a button sitting on the dots can cover what you meant to click.

## Answered: R4 (D3 → A)
Commitment comparison:

| Commitment | Source/approval or pending | Current | A | B | C |
|---|---|---|---|---|---|
| Visits counted, cookieless, Cloudflare Web Analytics | P4 approved | none | yes | yes | yes |
| How it loads | pending | — | the beacon script tag added to index.html by the production build only | in index.html for every build, dev included | no script: DNS moves to Cloudflare and its proxy counts visits at the edge |
| A shared layout (`#v1.…`) never leaves the browser | P4 approved ("must never be sent") | n/a | `spa: false`; a scripted browser check reads every beacon request on a link page and fails on `#v1.`; if the beacon carries the fragment, the link route does not load it | same check, but localhost visits pollute the counts | edge logs see only the path; fragments never reach a server |
| Setup by the owner | pending | — | create the Web Analytics site (dashboard or cf CLI) and paste the public site token | same | move nameservers from Namecheap to Cloudflare, proxy GitHub Pages, set SSL |
| Tests | required with the change | — | a build test: the production index.html has exactly one beacon tag with spa false, the dev one has none; the browser check above | the browser check | none in repo |

Question: D3 — R4: How should Cloudflare Web Analytics be wired in?
Header: Analytics
A) Beacon in production builds only (recommended)
The Cloudflare script tag is added to the published site only, never to local dev, with single-page tracking off; a browser check proves no shared layout (#v1.…) is ever sent, and link pages skip the beacon if it would be. You create the site in Cloudflare and paste its public token. Effort S, risk low.
B) Beacon in every build
Same tag written straight into index.html, so local dev visits are counted too unless filtered by hostname in the dashboard. Effort S, risk low, but the numbers include your own testing.
C) Move the domain behind Cloudflare
No script at all: the domain's nameservers move from Namecheap to Cloudflare, which proxies GitHub Pages and counts at the edge. Effort M, risk medium: a DNS move can take the site down while it propagates, and certificate settings must be right.

## Answered: R1 (D4 → A)
Commitment comparison:

| Commitment | Source/approval or pending | Current | A | B | C |
|---|---|---|---|---|---|
| Removal stays: select a piece, then Remove piece or Delete | existing, P1 | yes | unchanged | unchanged | unchanged |
| The selected piece is easy to see | P1 approved | 2px --ink edge (app.css:200) | a heavier --ink outline plus a tint over the whole piece, in tokens | same as A | unchanged |
| You learn that a piece can be clicked | P1 approved | nothing says so | one line in the strip under the canvas while nothing is selected: "Click a piece to select it; Remove piece or Delete takes it out." It goes once you have selected a piece in this tab | same line as A | the same line only |
| Remove next to the piece | pending | strip under canvas | unchanged | a small Remove button drawn beside the selected piece on the canvas | unchanged |
| Tests | required with the change | — | DOM: hint shown with pieces and none selected, gone after a selection; selected class present; a CSS check that the selection rule is heavier than the plank edge | A's plus the canvas button | the hint test |

Question: D4 — R1: How should the app make "click a piece to remove it" obvious?
Header: Removing
A) Stronger selection + a one-line hint (recommended)
The selected piece gets a heavier outline and a tint so it stands out among many, and while nothing is selected one line under the canvas says a piece can be clicked and removed; the line goes after your first selection. Effort S, risk low: removal itself is unchanged.
B) A plus a Remove button on the canvas
Same as A, and a small Remove button appears right beside the selected piece. Effort M, risk medium: a button on the canvas can cover track you meant to click, and a second Remove control to keep in step.
C) Hint only
Just the one-line hint; the selection keeps its thin edge. Effort S, risk low, but the "can't see what's selected" half of the problem stays.

## Outside voice (Codex, gpt-6-astra, 2026-11-01) and dispositions

| # | Finding | Severity | Disposition |
|---|---|---|---|
| OV1 | Disabling only the hit circle leaves the visible dot and ring catching clicks | High | Factual correction to R2's mechanism, behaviour unchanged: the whole armed port group takes no pointer events; keyboard (Enter on the end) still works |
| OV2 | An index.html tag runs before the link route decides; remote script can change | High | Investigated: Cloudflare's beacon strips hash/search today (`ot()` sets `hash=""`). Resolved by switching R4 to GoatCounter with a self-hosted script and an explicit path |
| OV3 | jsdom can't prove a pointer reaches the lower dot | Medium | D7 "Add a real-browser check (recommended)": keep the DOM test, and add a scripted headless-Chrome check in the PR (two ends on one spot, click the point twice, assert joined), recorded in the PR |
| OV4 | Three stacked ends: an incompatible middle end traps the click | Medium | D8 "Refused ends let clicks through too (recommended)": while an end is armed, ends that would refuse it (those drawn with the refused ring) also take no pointer events; the browser check covers three stacked ends |

Approval readiness: PASS — MODE (mode answer), P1–P4 (premise answers), R1 (D4 A), R2 (D2 A; OV1 correction; D8 A), R3 (D1 C), R4 (D3 A reopened by D5 → "yes, switch to GoatCounter"), OV3 (D7 A), OV4 (D8 A). No pending rows.

## What already exists

- Removing any piece: `removePiece` (app/src/editorReducer.ts:776), "Remove piece" in the selection strip (app/src/App.tsx:1116), Delete/Backspace on a selected piece (app/src/TrackCanvas.tsx:1041), and per-row removal in the layout list (`GraphListing onRemove`, App.tsx:1969). Reused unchanged.
- Join refusal with reasons (`joinRefusal`, layoutModel.ts) and the refused ring on ends that can't join the armed one (TrackCanvas.tsx:1213). Reused by R2/OV4.
- The canvas's Join button for facing ends within 100mm (trackPath.ts:490). Unchanged.
- The one-sided T switch (switchSeeds.ts:308) and the multi-road part type with roads and ports. The T-junction is a new entry of the same type.
- The link-route predicate `LINK_FRAGMENT` (app/src/linkFragment.ts) that main.tsx already uses. Reused by R4 for `/shared-link`.
- The storage guard: GoatCounter is cookieless and writes no storage; the guard's AST test still covers app code.

## NOT in scope

- Deferred: none.
- Rejected: a Remove button drawn on the canvas (D4 option B); a "Join to the end beside it" button and widening the Join button to any angle (D2 options B, C); Cloudflare Web Analytics and moving DNS to Cloudflare (R4, replaced by GoatCounter); counting actions such as shares or builds (P4 "Visits only").

## Dream state delta

```
  CURRENT STATE                      THIS PLAN                          12-MONTH IDEAL
  removal works but is hidden;  -->  a visible selection and a      --> editing a 200-piece layout feels
  stacked ends can't be joined;      hint; stacked ends join by         direct; every common shop-bought
  one-sided T only; no idea          pointer; a two-way T-junction;     piece is in the catalogue, measured;
  who visits                         visit counts with no layout        we know which features people use
                                     ever sent                          and fix what they struggle with
```

## Section findings

- **Section 1 (Architecture):** no new components. Four independent changes, one per area; R3 needed a source decision (a printed reproduction's 3MF).
- **Section 2 (Errors):** see the registry below. One gap closed by the plan: a missing GoatCounter code must leave the production build without a counter, not with a broken tag.
- **Section 3 (Security):** the only real threat is a shared layout (the `#v…` fragment) reaching a third party. Closed by R4: self-hosted script, explicit path, `/shared-link` for links, browser check. Likelihood low, impact high. No secrets: the GoatCounter code is public. No new dependency (the script is a committed file, reviewed once).
- **Section 4 (Edge cases):** two and three stacked ends (R2, OV4); a click on the armed spot with nothing beneath lands on the piece or floor (floor disarms); keyboard joining unchanged; touch uses the same pointer rule. The hint: shown only with pieces and none selected, gone after a selection, never on the friend's or phone screen (those are read-only).
- **Section 5 (Quality):** no duplication; the pointer rule is CSS on an existing class plus the refused set the canvas already computes.
- **Section 6 (Tests):** see the test diagram. OV3 added a real-browser check.
- **Section 7 (Performance):** count.js is a few kB, loaded after the page, outside the 134.02 kB index budget; nothing per frame.
- **Section 8 (Observability):** the GoatCounter dashboard is the dashboard (paths, referrers, browsers, screen sizes, countries). No alerting needed for a counter.
- **Section 9 (Deploy):** four PRs, each independently revertible; GoatCounter needs the owner's site code before its PR merges.
- **Section 10 (Future):** reversibility 5/5 (remove the script; visit data stays at GoatCounter). Debt: the committed count.js needs a manual refresh if GoatCounter's endpoint changes.
- **Section 11 (Design):** R1 approved; the hint's exact wording, the outline weight and the tint token are for /plan-design-review.

## Error & Rescue Registry

| Codepath | What can go wrong | Rescued? | Rescue action | User sees |
|---|---|---|---|---|
| Click on stacked ends (TrackCanvas port group) | second end refuses the armed one | Y | existing `joinRefusal`, refused ring; refused ends pass clicks through (OV4) | the reason, as today |
| Click on armed spot, nothing beneath | click lands on piece or floor | Y | floor click disarms; piece click selects the piece (existing) | the end un-arms or the piece selects |
| Analytics path function | address is a shared link | Y | reports `/shared-link`, never the fragment | nothing |
| Analytics in production | GoatCounter code missing at build | Y | build omits the counter (test pins it) | nothing |
| count.js request | blocked by an ad blocker or offline | Y | fails silently, no retry; app unaffected | nothing |
| T-junction import | no two-way model on printed reproductions | Y | stop and return to the owner (R3) | nothing ships |

## Failure Modes Registry

| Codepath | Failure mode | Rescued? | Test? | User sees? | Logged? |
|---|---|---|---|---|---|
| armed end click-through | the visible dot still catches clicks (OV1) | Y | Y (browser check) | — | n/a |
| three stacked ends | a refused middle end traps the click (OV4) | Y | Y (browser check, three ends) | — | n/a |
| selection hint | hint shown on read-only screens | Y | Y (DOM) | — | n/a |
| analytics | fragment sent to GoatCounter | Y | Y (path unit test + browser check) | — | n/a |
| analytics | counter in dev builds | Y | Y (build test) | — | n/a |
| T-junction | geometry guessed rather than read | Y | Y (seed test against the 3MF numbers) | "unverified size" badge | n/a |

No CRITICAL GAPS.

## Diagrams

1. System (unchanged boundaries, four touch points):
```
  main.tsx ──(not a link)──> App ── TrackCanvas ── port groups (R2/OV4: pointer rule)
     │                        │            └─ pieces (R1: .piece-selected heavier + tint)
     │                        └─ selection strip (R1: hint line when none selected)
     └─ analytics.ts (R4): sets window.goatcounter.path, loads /count.js (production only)
  engine/data/switchSeeds.ts ── + T-junction (R3, from a printed reproduction's 3MF)
```
2. Data flow, analytics:
```
  location ─> is LINK_FRAGMENT? ─yes─> path "/shared-link" ─┐
                 │no                                        ├─> count.js (our copy) ─> gc.zgo.at
                 └──> location.pathname ───────────────────┘      (blocked/offline: dropped silently)
  fragment (#v…) never read by the path function
```
3. State, an end's click target:
```
  free ──click──> armed (own group: no pointer events; refused partners: no pointer events)
  armed ──click on a joinable end beneath──> joined (weld)
  armed ──Esc / Cancel / floor click──> free
  armed ──click on a refused end──> impossible by pointer (it takes no events); by keyboard: refused, reason shown
```
4. Error flow: see the registry. 5. Deploy: PR per area, owner merges; analytics PR after the GoatCounter site exists. 6. Rollback: revert the PR; for analytics, delete the script tag and count.js.

## Stale Diagram Audit

TrackCanvas.tsx's comment at line ~1229 ("ARMED IS A RING") stays true; the plan adds a pointer rule beside it. No other diagram in touched files describes port hit targets.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~4h / CC: ~20min)** — canvas — Make the selected piece obvious and say that pieces can be clicked
  - Surfaced by: R1 (Section 11) — "Didn't know you could", "Can't see what's selected"
  - Files: app/src/app.css, app/src/App.tsx (strip line), app/src/tokens.css if a tint token is needed, a new DOM test
  - Verify: DOM test (hint shown with pieces and no selection, gone after one; never on the friend or phone screen), a CSS test that `.piece-selected` is heavier than the plank edge; mutations run
- [ ] **T2 (P1, human: ~4h / CC: ~25min)** — canvas — Let clicks pass through the armed end and through ends that refuse it
  - Surfaced by: R2 (Section 4), OV1, OV4
  - Files: app/src/TrackCanvas.tsx, app/src/app.css, a DOM test
  - Verify: DOM test for the reducer path; a scripted headless-Chrome check (two and three stacked ends: click the same point, assert joined) recorded in the PR (OV3)
- [ ] **T3 (P1, human: ~3h / CC: ~30min)** — catalogue — Add a two-way T-junction read from a printed reproduction's 3MF
  - Surfaced by: R3 (Section 1) — owner chose "Read a printed model"
  - Files: engine/data/switchSeeds.ts, engine/data/sources.ts (source entry), seed tests
  - Verify: the seed's ports match the 3MF's ends to 0.1mm, shown unverified; if no two-way model exists, stop and report to the owner
- [ ] **T4 (P1, human: ~3h / CC: ~25min)** — analytics — GoatCounter with a committed count.js and a link-safe path
  - Surfaced by: R4 (Section 3), OV2
  - Files: app/public/count.js (pinned copy), app/src/analytics.ts, app/src/main.tsx, vite config (production-only insertion), tests
  - Verify: unit test of the path function (/, /#v1.…, /#v9.…); build test (one counter in production, none in dev); a browser check that no request to GoatCounter contains "#"; owner supplies the site code first

## Reality rows

REALITY: premise-table pass unverified=1 (the Bigjigs 21 × 13 cm match is estimated from a listing) docs/plan/2026-11-01-editing-tjunction-analytics.md:9
REALITY: already-done pass no commits on the named files since the ask app/src/TrackCanvas.tsx:1229
REALITY: surface-check pass count.js `path` and self-hosting confirmed in GoatCounter's docs; codex/gstack commands ran app/src/linkFragment.ts:6
REALITY: binding-decisions pass no branch decision is overruled; P1–P4 recorded app/src/editorReducer.ts:776
REALITY: numbers pass r=26 [measured: app/src/TrackCanvas.tsx line 1229], beacon 31,853 bytes [measured: download], 21 × 13 cm [estimated], budget 134.02 kB [re-measure before gate] app/src/TrackCanvas.tsx:1229
REALITY: deferred-asks pass no linked issue; the four asks are all in scope app/src/App.tsx:1116
REALITY: pr-count finding four PRs (one per area) instead of one: each costs one CI run and an owner merge; no cross-PR references app/src/main.tsx:22

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | HOLD SCOPE                                  |
  | System Audit         | removal exists but hidden; stacked ends     |
  |                      | unreachable by pointer; one-sided T only    |
  | Step 0               | HOLD SCOPE; P1–P4 premises answered         |
  | Section 1  (Arch)    | 1 issue found (R3 source)                   |
  | Section 2  (Errors)  | 6 error paths mapped, 0 GAPS                |
  | Section 3  (Security)| 1 issue found, 1 High severity (R4/OV2)     |
  | Section 4  (Data/UX) | 6 edge cases mapped, 0 unhandled            |
  | Section 5  (Quality) | 0 issues found                              |
  | Section 6  (Tests)   | Diagram produced, 1 gap (OV3, closed)       |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 0 gaps found                                |
  | Section 9  (Deploy)  | 1 risk flagged (analytics needs the site code) |
  | Section 10 (Future)  | Reversibility: 5/5, debt items: 1           |
  | Section 11 (Design)  | 1 issue (R1), resolved                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 6 rows, 0 CRITICAL GAPS                     |
  | Failure modes        | 6 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | 0 items proposed                            |
  | Scope proposals      | 0 proposed, 0 accepted (HOLD)               |
  | CEO plan             | skipped by mode                             |
  | Outside voice        | codex completed, 4 findings, 4 resolved     |
  | Lake Score           | N/A                                         |
  | Diagrams produced    | 6 (system, data flow, state, error, deploy, rollback) |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows, 1 unverified                      |
  +====================================================================+
```

## Eng review (2026-11-01)

Target: docs/plan/2026-11-01-editing-tjunction-analytics.md (this file); report file: this file.

Scope record: feature answers: none cut (no cut proposed); structure: A Smaller arrangement (eng D1, 2026-11-01); accepted scope: T1–T4 as approved by the CEO review, laid out as 13 files with 1 new module — the analytics path function lives in app/src/linkFragment.ts beside LINK_FRAGMENT, main.tsx inserts count.js in production, and one scripts/browserChecks.ts holds the stacked-ends check and the analytics no-fragment check; pending remedies: E1.

### E1: how a click on stacked ends picks its end (reopens R2 and D8)
Finding: E1, CRITICAL, confidence 9/10, app/src/TrackCanvas.tsx:1166-1172 and app/src/editorReducer.ts (clickPort), reviewer: Claude (eng review).
Plan baseline: R2 (D2 A) "while an end is armed its own hit circle takes no pointer events … Esc, Cancel or a floor click disarms", corrected by OV1 to the whole armed group; D8 A "ends that would refuse it (refused ring) also take no pointer events".
Runtime evidence: each end is one `<g className="port is-armed|is-unjoinable" onClick=…>` with a `<title>` reason (TrackCanvas.tsx:1166-1172, 1227); clicking a refused end keeps the selection and announces the reason (editorReducer clickPort: `if (joinRefusal(…)) return { ...state }`, announce.ts), pinned by joinRefusal.test.ts:115-124. With `pointer-events: none` on refused groups, a click on a lone refused end falls to the floor (deselects) and its hover reason never shows.
Comparison grid:

| Commitment | Source | Current | A | B | C |
|---|---|---|---|---|---|
| Two stacked ends join by pointer | R2 approved | impossible | yes | yes | yes |
| Three stacked ends reach the joinable one | D8 approved | impossible | yes | yes | yes |
| Lone refused end: click says why, hover shows why | shipped (PR 51), joinRefusal.test.ts | yes | yes, unchanged | no: click falls to the floor, no tooltip | yes |
| Re-clicking a lone armed end un-selects it | shipped | yes | yes, unchanged | no (Esc, Cancel, floor) | no (Esc, Cancel, floor) |
| Mechanism | — | top element wins | one click handler picks among every free end within 26mm of the point: a joinable end ≠ armed → join; else the armed end → un-select; else a refused end → refusal said | CSS pointer-events: none on armed and refused groups | pointer-events: none on the armed group, and on refused groups only when another free end lies within 26mm |
| Tests | required | — | DOM test of the pick rule (two, three, lone refused, lone armed) + browser check | browser check | DOM + browser check |

Question D2:
D2 — E1: How should a click on stacked ends choose which end it means?
Project/branch/task: main, T2 of docs/plan/2026-11-01-editing-tjunction-analytics.md.
ELI10: The plan said the selected end, and ends that can't join it, should stop catching clicks so the click reaches the right end underneath. But today a click on an end that can't join says why ("both are pegs") and hovering it shows the same reason; switching clicks off on those ends would silently lose both, and a click on a lone one would land on the floor and deselect. A better way: when you click, look at every free end within reach of that point and pick the one you most likely mean.
Stakes if we pick wrong: B quietly removes the "why can't these join?" message you get today, the very help that stops people forcing impossible joins.
Recommendation: A because it fixes both stacked cases and keeps every message and tooltip that works today.
Completeness: A=10/10, B=6/10, C=8/10
Pros / cons:
A) Pick the best end under the click (recommended)
  ✅ Two and three stacked ends both work, and a lone selected end still un-selects on a click
  ✅ Refusal messages and hover reasons stay exactly as they are today
  ❌ One new click rule on the canvas (S-M: human ~4h / CC ~25min) instead of a CSS line
B) Switch clicks off as planned
  ✅ Smallest change: one CSS rule (human ~1h / CC ~5min)
  ❌ A lone refused end loses its click message and hover reason, a regression of shipped help
C) Switch clicks off only when ends overlap
  ✅ Keeps the message and tooltip on refused ends that stand alone
  ❌ A lone selected end can no longer be un-selected by clicking it, and overlap must still be computed
Net: a slightly larger click rule that keeps today's help, against a one-line CSS change that loses it.
Header: Stacked ends
Options:
A) Pick the best end under the click (recommended)
On a click, every free end within 26mm of the point is considered: a joinable end other than the selected one is joined; otherwise the selected end un-selects; otherwise a refused end says why, as today. Effort S-M (human ~4h / CC ~25min), risk low; tests: a DOM test of the pick rule for two, three, lone-refused and lone-selected cases plus the browser check.
B) Switch clicks off as planned
The selected end and ends that refuse it take no pointer events. Effort S (human ~1h / CC ~5min), but a lone refused end loses its click message and hover reason.
C) Switch clicks off only when ends overlap
The selected end takes no clicks; a refused end takes none only when another free end is within 26mm. Effort S, keeps lone refused ends' help, but a lone selected end can't be un-selected by clicking it.

State: approved
Actual answer: A "Pick the best end under the click (recommended)", eng D2, 2026-11-01
Accepted scope: T2's mechanism becomes one click rule on the canvas: on a pointer click, every free end within the drawn hit radius (26mm, the same constant as `.port-hit`) of the point is considered; a joinable end other than the armed one → join; otherwise the armed end → un-select (as today); otherwise a refused end → refusal said and hover reason kept (as today). No pointer-events changes on port groups. R2's other commitments stand (Esc, Cancel and a floor click un-select; keyboard unchanged). Tests: a DOM test of the pick rule for two stacked, three stacked with a refused middle, a lone refused end and a lone armed end, plus the browser check (OV3). Supersedes the mechanism of R2/OV1 and D8; their outcomes are kept.
History: R2 (CEO D2 A), OV1 correction (whole armed group), D8 A (refused ends pass clicks) — mechanisms replaced by E1 A because D8's would drop the shipped refusal message and hover reason (joinRefusal.test.ts:115-124).

### Section findings (eng)

1. Architecture: [INFORMATIONAL] (8/10) app/src/TrackCanvas.tsx:1229 `<circle cx={p.x} cy={p.y} r={26} className="port-hit" />` — the pick rule reads the same radius constant, so clickable and picked can't drift (implementation note). [INFORMATIONAL] (7/10) count.js skips localhost by default; production-only insertion kept as a second guard. Design-twice: not needed, no new public module (one function beside LINK_FRAGMENT). Screen-to-model conversion reuses `probe.toModel` (TrackCanvas.tsx:617).
2. Code quality: the pick rule must take the existing `unjoinable` map / `joinRefusal`, never restate the join rules. No issues otherwise.
3. Tests: diagram below; every path has an approved test; no new choices.
4. Performance: the pick rule scans free ends per click (≤ a few hundred, once per click, O(n)); count.js loads after first paint outside the index chunk. No issues.

### Test coverage diagram

```
CODE PATHS                                             USER FLOWS
[+] TrackCanvas pick rule (T2, E1)                      [+] Join two stacked ends by mouse
  ├── [PLANNED ★★★] 2 stacked → join                      └── [PLANNED →E2E] browser check: click one point twice
  ├── [PLANNED ★★★] 3 stacked, refused middle → join    [+] Three stacked ends
  ├── [PLANNED ★★★] lone armed → un-select                └── [PLANNED →E2E] browser check
  ├── [PLANNED ★★★] lone refused → reason said, tooltip [+] Esc / Cancel / floor un-select
  └── [EXISTING ★★★] joinRefusal.test.ts (must stay green)  └── [PLANNED ★★] DOM
[+] Selection + hint (T1, R1)                           [+] First visit to a busy layout
  ├── [PLANNED ★★★] hint shown with pieces, none selected   └── [PLANNED ★★] hint gone after one selection
  ├── [PLANNED ★★] never on friend/phone screens
  └── [PLANNED ★★] .piece-selected heavier than plank edge (CSS parse)
[+] linkFragment countedPath (T4, R4)                   [+] Visit via a shared link
  ├── [PLANNED ★★★] "/" , "/#v1.x", "/#v9.x", "/#v1" (no dot) └── [PLANNED →E2E] browser check: no GoatCounter request carries '#'
  └── [PLANNED ★★] main.tsx inserts count.js only when PROD
[+] T-junction seed (T3, R3)
  └── [PLANNED ★★★] ports equal the 3MF ends to 0.1mm; shown unverified (switchSeeds.test.ts row)

COVERAGE (planned): 14/14 paths | GAPS: 0 | E2E: 3 (one browser-check script)
```

Tests made obsolete: none. Existing tests that must stay green: joinRefusal.test.ts, trackCanvasPolarity.test.ts, switchSeeds.test.ts, storage.guard.test.ts.

### Outside voice (eng, Codex gpt-6-astra) and dispositions

| # | Finding | Severity | Verified | Disposition |
|---|---|---|---|---|
| X1 | E1 scans every free end, including floor ends hidden under raised wood; candidates unordered | High | yes: TrackCanvas.tsx:665 `hiddenEnds` | Correction (keeps existing contract and E1's intent): candidates are only click-reachable ends (the `hiddenEnds` rule excludes floor ends under raised wood); nearest to the click first, ties to the topmost drawn; tests add a hidden end and two joinable candidates |
| X2 | Floor click doesn't un-select an end today | Medium | yes: App.tsx:1668 `onFloorClick={() => selected !== null && selectPiece(null)}` | Correction (R2 approved floor un-select): App.tsx wires the floor click to clear the armed end and joining mode; tested through the real App |
| X3 | "No # in requests" passes when nothing is sent; misses %23 and other fields | High | yes (logic) | D3 A "Apply this change (recommended)": the browser check loads the committed count.js against an intercepted endpoint, requires exactly one count request within a timeout, asserts path `/shared-link`, and fails if any decoded field contains the layout's distinctive text, `#` or `%23` |
| X4 | Stacked-end browser check could exercise the Join button instead | Medium | yes: trackPath.ts:519, TrackCanvas.tsx:1283 | Correction to the check: fixtures with no covering Join suggestion; assert the first click arms the expected end, then the exact welded pair |
| X5 | Runtime insertion invalidates the built-HTML test | Medium | yes (Smaller arrangement) | Correction: runtime checks for production with a code, production without one (no script), and development (no script); config installed before the script loads |
| X6 | 3MF may not fit the 22.5° lattice; 0.1mm promise too strict | Medium | yes: switchSeeds.ts:397 rounds to whole mm (0.5mm) | Correction: same rounding policy as the other seeds, stated in the part's note; if the model can't be represented on the lattice, stop and return to the owner (extends R3's stop rule) |

### TODOS

None proposed: every finding was resolved inside T1–T4.

Approval readiness (eng): PASS — D1 structure (Smaller arrangement), E1 (D2 A), X3 (D3 A); X1, X2, X4, X5, X6 are corrections that keep approved behaviour (R2, R3, R4, E1) and need no new answer; CEO rows R1–R4, OV1–OV4 carried as approved.

## Implementation Tasks (eng, supersedes the CEO list above)
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~4h / CC: ~20min)** — canvas — Visible selection and the "click a piece" hint
  - Surfaced by: R1 (CEO D4 A)
  - Files: app/src/app.css, app/src/App.tsx, app/src/tokens.css, app/src/selectionHint.dom.test.tsx
  - Verify: DOM test (hint with pieces and none selected; gone after one selection; never on friend/phone screens); CSS parse test that `.piece-selected` outweighs the plank edge; mutations run
- [ ] **T2 (P1, human: ~5h / CC: ~30min)** — canvas — Pick the best reachable end under the click; floor click un-selects an end
  - Surfaced by: E1 (eng D2 A), X1, X2, X4, R2, OV3
  - Files: app/src/TrackCanvas.tsx, app/src/App.tsx, app/src/stackedEnds.dom.test.tsx, scripts/browserChecks.ts
  - Verify: DOM tests (two stacked, three with refused middle, lone refused keeps message + tooltip, lone armed un-selects, hidden floor end never picked, nearest of two joinable wins, floor click clears through the real App); joinRefusal.test.ts stays green; browser check per X4 recorded in the PR
- [ ] **T3 (P1, human: ~3h / CC: ~30min)** — catalogue — Two-way T-junction from a printed reproduction's 3MF
  - Surfaced by: R3 (CEO D1 C), X6
  - Files: engine/data/switchSeeds.ts, engine/data/sources.ts, engine/test/switchSeeds.test.ts
  - Verify: ports equal the 3MF ends within the seeds' whole-mm rounding policy (stated in the note); shown unverified; stop and report if no model or not representable
- [ ] **T4 (P1, human: ~4h / CC: ~30min)** — analytics — GoatCounter with committed count.js and a link-safe path
  - Surfaced by: R4, OV2, X3 (eng D3 A), X5
  - Files: app/public/count.js, app/src/linkFragment.ts, app/src/main.tsx, app/src/linkFragment.test.ts, scripts/browserChecks.ts
  - Verify: unit rows for countedPath (/, /#v1., /#v9., /#v1); runtime checks (prod with code, prod without, dev); browser check per X3; owner supplies the GoatCounter code before merge

### Worktree parallelization strategy

| Step | Modules touched | Depends on |
|------|----------------|------------|
| T1 selection + hint | app/src (App, css) | — |
| T2 pick rule | app/src (TrackCanvas, App), scripts/ | — |
| T3 T-junction | engine/data, engine/test | — |
| T4 analytics | app/src (main, linkFragment), app/public, scripts/ | T2 (scripts/browserChecks.ts created there) |

Lane A: T1 → T2 (both edit App.tsx). Lane B: T3 (independent). Lane C: T4 after T2 merges (shares scripts/browserChecks.ts).
Execution order: launch A and B; merge T2; then T4. Conflict flags: App.tsx (T1, T2), scripts/browserChecks.ts (T2, T4).

### Failure modes (eng)

| Path | Realistic failure | Test | Error handling | User sees |
|---|---|---|---|---|
| pick rule | picks a hidden floor end | DOM (X1) | excluded by hiddenEnds rule | — |
| pick rule | refused end loses its message | joinRefusal.test.ts + DOM | refusal path unchanged | the reason |
| floor click | armed end stays armed | DOM through App (X2) | App clears armed | end un-selects |
| analytics | counter silently broken | browser check requires one request (X3) | — | nothing (owner sees zero visits) |
| analytics | fragment sent encoded | browser check decodes fields (X3) | countedPath | — |
| T-junction | geometry off-lattice | seed test (X6) | stop and report | nothing ships |

0 critical gaps.

### Completion summary (eng)

- Step 0: Scope Challenge — scope accepted as-is (Smaller arrangement, not a reduction)
- Reality rows: 7/7 applicable rows emitted (PLAN_REALITY complete), 1 unverified premise
- Architecture Review: 2 issues found (informational)
- Code Quality Review: 1 issue found (reuse joinRefusal/unjoinable)
- Test Review: diagram produced, 0 gaps identified
- Performance Review: 0 issues found
- Scope Challenge findings: 1 (E1, critical, resolved)
- NOT in scope: written (CEO section stands; nothing new deferred)
- What already exists: written (CEO section stands)
- TODOS.md updates: 0 items proposed to user
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex completed, 6 findings, 6 resolved (1 by D3, 5 corrections)
- Parallelization: 3 lanes, 2 parallel / 1 sequential
- Lake Score: 2/2 (E1 A, X3 A)

## Design review (2026-11-01)

DESIGN.md: present (13 rules); all decisions calibrated against it. Mockups: none (no image API key; 0 of 3 saved). Outside voices: Codex (design hard rules + litmus) and a Claude subagent, both completed. Litmus: anchor YES, one job per section DISAGREE (the hint had no slot; fixed by D2), cards necessary YES, premium without shadows YES; no hard rejections.

### Decisions (each its own question)

| ID | Pass | Decision (owner's answer) | Effect on the plan |
|---|---|---|---|
| DR1 | 1 | "Outline on top of everything (recommended)" | The selected piece's outline is drawn in a top layer above both levels (no wood), so it shows through a bridge. DOM test: raised piece over a selected floor piece |
| DR2 | 1 | "Last in the strip, editor only (recommended)" | Hint is the strip's lowest priority (`placing ?? join ?? selection ?? drop ?? removed/joined confirmation ?? hint`); 2D editor only, 1+ pieces, no piece being placed; never with the empty-floor message, in 3D, build mode, the friend's or the phone screen; plain text, not a live region. DOM test per screen |
| DR3 | 2 | "Gone for good after any selection (recommended)" — reopens R1's "in this tab" | Any selection (canvas, keyboard, layout list) dismisses it; remembered in this browser via a new storageKeys key written through storage.ts; if storage fails it shows again. Tests: each source, a reload |
| DR4 | 2 | "Say it and offer Undo (recommended)" | After Remove piece, the strip shows "Removed piece N, <name>." with Undo, from the existing announcement words; beats the hint; clears on the next action. DOM test |
| DR5 | 3 | "Strip names the join (recommended)" | After a join the strip shows which ends joined (from `endWords` / the announcement) with Undo; clears on the next action; no new canvas mark. DOM test |
| DR6 | 5 | "3px ink with a paper halo (recommended)" — replaces R1's tint | No tint. `.piece-selected` 3px --ink (the heaviest piece mark, equal to the armed ring) over a slightly wider --paper halo (as `.mark-halo`); `.piece-run` stays 1px --ink-soft. Checked in a real browser on a dense layout (straight, curve, junction, keyboard focus). DESIGN.md rule 11 updated to name the halo |
| DR7 | 5 | "\"T-junction\" beside the T switch (recommended)" | Named "T-junction"; the existing piece stays "T switch"; card right after it in Generic's switches; ink schematic with stem, two curves, peg discs/socket rings per the 3MF; unverified dotted border and "*"; Flip (F) hidden while placing it; no card if T3 stops |
| DR8 | 6 | "Mouse and touch wording (recommended)" | Fine pointer: "Click a piece to select it; Remove piece or Delete takes it out." Touch: "Tap a piece to select it; Remove piece takes it out." Chosen by `(pointer: coarse)`; both strings under copyPosition.test.ts |
| DR9 | 6 | "44px floor on touch (recommended)" | On coarse pointers an end's click area is max(26mm, 22px radius), shared by the drawn hit circle and E1's pick rule; dots unchanged; mouse unchanged. Test at a zoom where 26mm is under 44px |

Supersedes in R1: the tint (DR6) and "in this tab" (DR3). E1's radius is now the shared effective radius (DR9).

### Interaction states

```
  FEATURE            | EMPTY (0 pieces)        | DEFAULT              | SUCCESS                         | ERROR / REFUSED
  -------------------|-------------------------|----------------------|---------------------------------|------------------------------
  Hint               | not shown (empty-floor  | shown, last priority | gone for good after a selection | storage blocked: shows again
                     | message owns the strip) |                      |                                 |
  Remove piece       | n/a                     | selection strip      | "Removed piece N, name." + Undo | n/a
  Stacked-end join   | n/a                     | armed ring           | "Joined … to …" + Undo          | refusal said, as today
  T-junction card    | n/a                     | unverified card      | placed; F hidden                | T3 stop: no card
```

### Journey

```
  STEP | USER DOES                          | USER FEELS        | PLAN SPECIFIES
  1    | builds a big layout, wants a fix   | stuck             | hint, last in the strip (DR2, DR8)
  2    | clicks the piece                   | "there it is"     | 3px ink + paper halo, on top of bridges (DR1, DR6)
  3    | Remove piece                       | "did that work?"  | "Removed piece N" + Undo (DR4)
  4    | joins two ends on one spot         | "which one?"      | strip names the join + Undo (DR5); E1 pick
  5    | on a tablet                        | fumbling          | tap wording, 44px end targets (DR8, DR9)
```

### Design review completion summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (13 rules); UI scope T1–T3|
  | Step 0               | 5/10; all 7 dimensions                       |
  | Pass 1  (Info Arch)  | 5/10 → 9/10 after fixes                     |
  | Pass 2  (States)     | 4/10 → 9/10 after fixes                     |
  | Pass 3  (Journey)    | 5/10 → 9/10 after fixes                     |
  | Pass 4  (AI Slop)    | 9/10 → 9/10 (no issues)                     |
  | Pass 5  (Design Sys) | 3/10 → 9/10 after fixes                     |
  | Pass 6  (Responsive) | 4/10 → 9/10 after fixes                     |
  | Pass 7  (Decisions)  | 9 resolved, 0 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (0 new items)                       |
  | What already exists  | written (strip, part cards, .mark-halo, copy guard) |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated (no image key), 0 approved      |
  | Decisions made       | 9 added to plan                             |
  | Decisions deferred   | 0                                           |
  | Overall design score | 3/10 → 9/10                                 |
  +====================================================================+
```

Unresolved design decisions: none.

## Implementation Tasks (design, supersedes the eng list above for T1–T3)
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [x] **T1 (P1, human: ~6h / CC: ~35min)** — canvas — Visible selection, the hint, and the removal confirmation
  - Surfaced by: R1, DR1, DR2, DR3, DR4, DR6, DR8
  - Files: app/src/app.css, app/src/TrackCanvas.tsx (top-layer outline), app/src/App.tsx (strip order, hint, removed line), app/src/storageKeys.ts, DESIGN.md (rule 11), app/src/selectionHint.dom.test.tsx
  - Verify: DOM tests (hint per screen; dismissal by canvas, keyboard and list; reload; storage blocked; removed line + Undo; outline over a bridge); both hint strings under copyPosition.test.ts; real-browser look on a dense layout
- [x] **T2 (P1, human: ~6h / CC: ~35min)** — canvas — Pick the best reachable end; floor click un-selects; name the join; 44px ends on touch
  - Surfaced by: E1, X1, X2, X4, DR5, DR9
  - Files: app/src/TrackCanvas.tsx, app/src/App.tsx, app/src/stackedEnds.dom.test.tsx, scripts/browserChecks.ts
  - Verify: eng T2's tests, plus the joined line + Undo and the coarse-pointer radius at a zoom where 26mm < 44px
- [x] **T3 (P1, human: ~3h / CC: ~30min)** — catalogue — Two-way "T-junction" from a printed reproduction's 3MF (stop rule fired: the only two-way printed model has its own sizes; owner answered "Add the printed T Rail as measured"; shipped as "T-junction, printed" in PR #103)
  - Surfaced by: R3, X6, DR7
  - Files: engine/data/switchSeeds.ts, engine/data/sources.ts, engine/test/switchSeeds.test.ts, app/src (Flip hidden for symmetric parts)
  - Verify: eng T3's checks; card order and drawing; F hidden while placing it
- T4 unchanged (no UI).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 7 | CLEAR | mode: HOLD_SCOPE, 0 critical gaps |
| Outside Review | codex (gpt-6-astra), automatic after CEO and Eng review; design voices | Independent 2nd opinion | 20 | completed | eng pass: 6 findings, 6 resolved; design voices: 4 findings (Codex) + 10 (Claude subagent), all resolved by DR1–DR9 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 14 | ISSUES OPEN | 3 issues, 0 critical gaps (all resolved; status counts resolved findings) |
| Design Review | `/plan-design-review` | UI/UX gaps | 8 | CLEAR | score: 3/10 → 9/10, 9 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex completed for CEO (4 findings), eng (6 findings) and design (4 findings); the Claude design subagent completed (10 findings, native, not outside coverage). All dispositions recorded above.
- **CROSS-MODEL:** in design, both voices flagged the tint against rules 1 and 11 (DR6); Codex alone raised the 44px touch floor for ends (DR9); the subagent alone raised hidden selection under bridges (DR1), the hint's slot and memory (DR2, DR3), touch wording (DR8), removal and join confirmation (DR4, DR5) and the T-junction card (DR7). Model identity: codex gpt-6-astra; host model Claude.
- **VERDICT:** CEO + DESIGN CLEARED; eng review complete with 0 unresolved decisions and 0 critical gaps (logged ISSUES OPEN because it counts resolved findings) — ready to implement.

NO UNRESOLVED DECISIONS
