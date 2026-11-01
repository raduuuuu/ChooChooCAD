# Plan: QA pass, layout links, and a friendlier look

Source of truth for the problem, premises and approach:
`docs/designs/share-and-polish.md` (office hours, APPROVED 2026-10-31).
This file is the /plan-ceo-review working plan built on it.

## Requirements (copied from the design doc, approach B)

1. QA baseline on woodentrain.world: every flow; desktop, tablet, phone;
   odd layouts; each bug fixed with a test or filed.
2. Remove the printable sheet (design doc premise 3).
3. Share link: versioned `#v1.` fragment, a pure decoder that refuses rather
   than repairs, caps, a code table that only grows, a read-only view, a
   layout-file fallback, routing and storage isolation, and Open in editor
   with a put-aside slot (the design doc's step 3, in full).
4. Look redesign within DESIGN.md: warmth, a lighter verdict area, a clear
   first visit. Designed and reviewed before it is built.
5. Final QA pass.

## Step 0

### 0A. Premise challenge

- Real problem: a layout can't leave the browser it was made in, and the app
  doesn't invite a newcomer in. The target is a friend who gets a link, sees
  the railway and builds it.
- Doing nothing costs this: every layout stays private, and the first visit
  keeps reading as a CAD tool. The printed sheet keeps a second, overlapping
  path to maintain (BuildSheet.tsx + sheetLayout.ts, plus their tests).
- The plan solves the pain directly. The link carries the layout itself, not
  a proxy such as a screenshot or an exported image.

### 0B. Existing code leverage

| Sub-problem | Reuse | Receipt |
|---|---|---|
| Serialise a graph | `storedGraphOf` | app/src/layoutStore.ts:595 |
| Validate a stored graph | the checks inside `loadGraph`, extracted | app/src/layoutStore.ts:305 |
| Plan, verdict, parts list | the editor's existing renderers, read-only | app/src/App.tsx |
| 3D on request | the lazy `View3DPanel` | app/src/View3DPanel.tsx |
| Build it | `BuildModeLoader` + `buildSession` (`layoutKey`) | app/src/BuildModeLoader.tsx:45, app/src/buildSession.ts:34 |
| Storage keys | `storageKeys.ts` | app/src/storageKeys.ts:38-70 |
| Lazy-chunk guard | `scripts/chunkBudget.ts` | scripts/chunkBudget.ts:20-36 |
| Label spot (kept after sheet removal) | `segmentMid` | app/src/trackPath.ts:413, :445 |

Nothing is rebuilt. The one refactor is splitting `loadGraph` into a pure
checker plus a storage wrapper. Today the checks and `rescue()` are
interleaved in one function (layoutStore.ts:305-330), so a link can't reuse
them without that split.

### Premise table

| Premise | Claim | Receipt | Verdict |
|---|---|---|---|
| P-a | `loadGraph` reads storage itself | app/src/layoutStore.ts:316 | verified |
| P-b | `rescue()` writes the rescue slot | app/src/layoutStore.ts:152-154 | verified |
| P-c | Build progress is one slot, keyed by `layoutKey` | app/src/buildSession.ts:52-76, app/src/storageKeys.ts:70 | verified |
| P-d | Main chunk limit 134.02 kB | scripts/chunkBudget.ts:20-21 | verified |
| P-e | `segmentMid` is used outside the sheet | app/src/trackPath.ts:445 | verified: it stays |
| P-f | `savesSuppressed` can suspend autosave in a link view | app/src/layoutStore.ts:661-664 | **finding**: it is a predicate over the loss notice (`notice`, `dismissed`), not a general switch. A link view needs a new input or its own guard. |
| P-g | The custom-parts TODO blocks sharing custom parts | docs/plan/brio-TODOS.md:2140 | verified |
| P-h | No sharing code exists yet | grep for CompressionStream/navigator.share/clipboard in app/src: no hits | verified |
| P-i | `CompressionStream('deflate-raw')` works in current Safari, Chrome and Firefox | external (MDN); not checked here | unverified |
| P-j | Messaging apps truncate links around 2 KB | design doc, Open Questions | unverified (to be measured) |

unverified=2

### Reality rows

REALITY: premise-table finding P-f: savesSuppressed is a loss-notice predicate, not an autosave switch app/src/layoutStore.ts:661
REALITY: already-done pass no share/link work on origin/main since 2026-10-30 (only 1a78945, ab21b0b match) 1a78945
REALITY: surface-check pass no CLI or HTTP route is named; the in-app routes (#v1. fragment, hashchange) are new and listed as new docs/designs/share-and-polish.md:1
REALITY: binding-decisions pass build-mode decisions (lazy chunk, storedGraphOf shared, editor suspended in build mode) are reused, not overruled docs/plan/2026-10-31-build-mode.md:1
REALITY: numbers finding caps 32,768 chars / 256 KB / 2,000 pieces are [estimated]; the 134.02 kB budget is [measured: scripts/chunkBudget.ts:20] and is [re-measure before gate] after the sheet removal scripts/chunkBudget.ts:20
REALITY: deferred-asks pass no linked issue docs/designs/share-and-polish.md:1
REALITY: pr-count pass no .gstack/ship-policy.json, so one PR per wave by default; this plan's waves are QA fixes, sheet removal, share (several PRs), look (several PRs), final QA docs/designs/share-and-polish.md:1

### 0C. Dream state

```
  CURRENT STATE                 THIS PLAN                       12-MONTH IDEAL
  Layouts live in one   --->    QA-hardened app; a link   --->  Friends trade layouts by
  browser; app reads            opens a read-only view           link; a newcomer builds an
  as a CAD tool; a              with Build it; a warmer          example on first visit;
  printed sheet                 look with a light verdict;       custom parts shareable once
  duplicates build mode         the sheet removed                their status is earned; an
                                                                 optional gallery on top
```

The plan moves straight toward the ideal. A link format that only grows, plus
a pure decoder, is the base a later gallery or file library would reuse
without changing links.

0D: no new approach decision was needed. The approach (B) was chosen in office
hours, D1.

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| OH-D1 (user) | Approach | B: full (QA, share, redesign) | — | approved | office-hours D1 "B) Full: QA, share, redesign (recommended)" |
| OH-D2 (user) | Design doc | docs/designs/share-and-polish.md | — | approved | office-hours D2 "A) Approve (recommended)" |
| OH-cut (user) | Printable sheet | removed | — | approved | "1 but also remove the print sheet. too much overlap with build mode" |
| MODE (user) | Review mode | SCOPE REDUCTION | — | approved | D3 "Scope reduction (recommended)" |
| R-1 (S0) | Layout-file fallback | deferred to TODOs (brio-TODOS.md:383) | — | approved (defer) | D4 "Defer to TODOs (recommended)": the file fallback only |
| R-2 (S0) | System share sheet on touch | kept; copy is the fallback; a cancelled sheet does nothing | — | approved (keep) | D5 "Keep the share sheet (recommended)" |
| A1 (S1) | Where the read-only view lives (App.tsx is 1,749 lines, pipeline inline) | — | App with a link source, or a separate LinkView | unresolved (owner: /plan-eng-review) | D6 "Decide in eng review": the view's home only; every isolation invariant stands either way |
| A2 (S1) | A crashing link reaches ErrorBoundary.clearAndReload (ErrorBoundary.tsx:78-92) | link sessions get their own boundary: "This link couldn't be shown." + Back to my layout (clears the fragment, reloads into the editor); never the clear | — | approved | D7 "Own crash screen (recommended)" |
| A3 (S1) | Link pasted into an open tab | a `#v…` hashchange reloads the page; the load-time route handles every arrival | — | approved, amended by OV2 | D8 "Reload on hashchange (recommended)" |
| E1 (S2) | Compression Streams missing | feature-check once; sender: "Sharing needs a newer browser."; recipient: "This browser can't open shared links. Updating it should fix this." + Back to my layout | — | approved | D9 "Feature-check and say so (recommended)" |
| E2 (S2) | Clipboard write rejects | the link appears in a selected read-only field with "Copy it from here."; "Copied" shows only after the write resolves | — | approved | D10 "Show it to copy by hand (recommended)" |
| E3 (S2) | An id no longer in the library (was R3-3); a rollback write failing during Restore (R3-11) | — | owner /plan-eng-review | unresolved (owner: eng review) | non-blocking |
| Q1 (S5) | Part codes in links | links carry built-in part ids; one pin test lists every built-in id and fails on a rename; no shareCodes.ts; an unknown id is refused like any bad link | — | approved, amended by OV1 | D11 "Use part ids (recommended)" |
| T1 (S6) | Old links keep opening | 3-4 v1 links (Stadium, two-level, switch, adapters) committed as literal strings; CI decodes each and compares it with its expected graph | — | approved | D12 "Freeze a few real links (recommended)" |
| D-1 (S11) | Share screens designed | /plan-design-review covers the look AND the share screens (read-only view, bad-link + crash screens, put-aside ask, Restore entry, Share states), before the share UI PRs | — | approved | D13 "One design review for both (recommended)" |
| OV1 (codex) | Corrections keep built-in ids (library.ts:109-135) | the link view resolves ids against the built-in catalogue only; when the sender's verdict used a correction, Share says "The link uses standard part sizes; your corrected sizes stay with you."; Open in editor uses the recipient's library | — | approved | D14 "Standard catalogue (recommended)" |
| OV2 (codex) | A save can fail, leaving edits only in memory (App.tsx:427) | reload on hashchange only when App's `unsaved` set is empty; otherwise stay, restore the old hash, and say "Your last changes couldn't be saved, so the link wasn't opened. Your changes are still here." | — | approved | D15 "Reload only if saved (recommended)" |
| OV3 (codex) | Sender checks only the length | Share runs the real decoder on its own output (every cap and refusal) before showing a link; otherwise one sentence names why | — | approved | D16 "Decode before showing (recommended)" |
| OV4 (codex) | `#v2.` would fall to the editor | any `#v<digits>.` fragment takes the link route before the editor mounts; a non-v1 link gets "This link was made by a newer ChooChooCAD. Reloading usually fixes this." + Back to my layout | — | approved | D17 "Route the whole namespace (recommended)" |
| OV5 (codex) | Share could ship before the view | PR order: format and decoder → link route and view (verified live) → Share button | — | approved | D18 "Recipient first (recommended)" |

Approval readiness: PASS. Checked: OH-D1, OH-D2, OH-cut, R-1 (D4), R-2 (D5), A2 (D7),
A3 (D8, amended by D15), E1 (D9), E2 (D10), Q1 (D11, amended by D14), T1 (D12), D-1 (D13),
OV1 (D14), OV2 (D15), OV3 (D16), OV4 (D17), OV5 (D18). A1 and E3 stay unresolved and
eng-owned; nothing of theirs is in the tasks below.

## Scope after review (SCOPE REDUCTION)

Kept:
1. QA baseline on woodentrain.world.
2. Sheet removal.
3. Share, in three PRs (D18):
   - (a) format: `#v1.` + base64url(deflate-raw(compact)), with built-in part
     ids (D11), resolved against the built-in catalogue (D14). A pure decoder
     with caps (32,768 characters; 256 KB inflated, capped mid-stream; 2,000
     pieces), the checker split out of `loadGraph`, the old-browser check
     (D9) and the frozen links (D12).
   - (b) link route for any `#v<digits>.` (D17), a reload on hashchange only
     when everything is saved (D8 + D15), the read-only view (its home per
     A1), the link crash screen (D7), the storage rules, and Open in editor
     with the put-aside slot and Restore. Verified live with a hand-made link.
   - (c) Share: the share sheet on touch, otherwise copy (D5). The copy-fails
     field (D10). The real decoder runs on its own output before showing
     (D16). The corrections sentence (D14).
4. The look and the share screens, designed first in one design review (D13).
5. Final QA.

## NOT in scope

- Layout-file fallback (.choochoo): deferred (D4) until link lengths are
  measured. TODO at docs/plan/brio-TODOS.md:383.
- Sharing custom parts or sender corrections: blocked by
  docs/plan/brio-TODOS.md:2140. Links use standard sizes (D14).
- Inflate fallback for old browsers: rejected (D9). Old browsers get a
  sentence instead.
- A separate part-code table: rejected (D11).
- A public gallery, accounts, any server: the office-hours premises.
- Cross-tab sync (S4-3): recorded. An editor open in another tab can overwrite
  an opened link; the recipient's own layout stays put aside. Existing
  behaviour, not addressed.

## What already exists

- `storedGraphOf` (layoutStore.ts:595): serialisation, reused.
- `loadGraph` checks (layoutStore.ts:305): split into a pure checker, which the
  link decoder reuses.
- The editor's plan, verdict, parts list, 3D view and build mode: reused by the
  read-only view (how, per A1).
- `layoutKey` and resume (buildSession.ts:34-76): reused for
  `brio.build.link.v0`.
- The `unsaved` set (App.tsx:427): reused to gate the hashchange reload (D15).
- `BUILT_IN` (engine/data/library.ts): the catalogue links resolve against
  (D14).
- `segmentMid` (trackPath.ts:413): kept, because labelSpot (:445) uses it.

## Dream state delta

This plan gets the app to "friends trade layouts by link" and "a newcomer
builds an example on first visit". Still missing from the 12-month ideal:
custom parts and corrections travelling (blocked by the status TODO), and an
optional gallery. The versioned, frozen link format is what both would build
on.

## Error & Rescue Registry

| Codepath | Failure | Class | Rescued | User sees |
|---|---|---|---|---|
| decodeLink | over 32,768 characters | TooLong | Y | "This link couldn't be opened." + Back to my layout |
| decodeLink | bad base64url | DOMException | Y | same |
| decodeLink | no DecompressionStream | ReferenceError (feature-checked first) | Y (D9) | "This browser can't open shared links. Updating it should fix this." |
| decodeLink | corrupt or truncated deflate | TypeError | Y | the bad-link sentence |
| decodeLink | inflated past 256 KB (stopped mid-stream) | TooLarge | Y | the bad-link sentence |
| decodeLink | parse fails | Malformed | Y | the bad-link sentence |
| decodeLink | unknown part id | UnknownPart | Y | the bad-link sentence (eng: maybe its own sentence, E3) |
| decodeLink | version not 1 | Version | Y (D17) | "This link was made by a newer ChooChooCAD…" |
| checkStored | refuses the graph | Invalid | Y | the bad-link sentence |
| link view render | throws | any | Y (D7) | "This link couldn't be shown." + Back to my layout |
| hashchange | an earlier save failed | — | Y (D15) | "Your last changes couldn't be saved, so the link wasn't opened…" |
| Share encode | no CompressionStream | ReferenceError (feature-checked first) | Y (D9) | "Sharing needs a newer browser." |
| Share encode | its own decode refuses | any decode class | Y (D16) | one sentence naming why |
| Share | a custom part is used | CustomPart | Y | "can't share custom parts yet" (wording: design review) |
| Share | the share sheet is cancelled | AbortError | Y | nothing |
| Share | the share sheet is unsupported or refused | NotAllowedError / TypeError | Y | falls back to copy |
| Share | the clipboard write rejects | NotAllowedError | Y (D10) | the copy-by-hand field |
| Open in editor | put-aside write or read-back fails | QuotaExceededError | Y | nothing changes; one sentence |
| Restore swap | a write fails | QuotaExceededError | Y | rolled back; one sentence |
| Restore swap | the rollback write also fails | QuotaExceededError | open (E3) | eng review |

## Failure Modes Registry

```
  CODEPATH            | FAILURE MODE                         | RESCUED? | TEST?          | USER SEES?            | LOGGED?
  --------------------|--------------------------------------|----------|----------------|-----------------------|--------
  decodeLink          | every class above                    | Y        | Y (per class)  | one sentence + exit   | console.info reason
  link view           | render throws                        | Y (D7)   | Y              | crash screen, no wipe | console.error
  hashchange          | unsaved edits in memory              | Y (D15)  | Y              | sentence, stays       | —
  Share               | link the friend can't open           | Y (D16)  | Y (2,001 pcs)  | sentence names why    | —
  Share               | copy silently fails                  | Y (D10)  | Y              | copy-by-hand field    | —
  Open in editor      | put-aside fails                      | Y        | Y (full store) | sentence, unchanged   | —
  Restore             | rollback write fails                 | ?        | ?              | ? (E3, eng)           | —
  link session        | any write to a protected key         | Y        | Y (all keys)   | — (prevented)         | test only
  old v1 links        | format change breaks them            | Y (D12)  | Y (frozen)     | — (prevented)         | CI
```

0 CRITICAL GAPS. The one open row (Restore rollback) is eng-owned under E3.

## Diagrams

System architecture and flows are in Sections 1 and 4 of this review (chat),
summarised here:

```
  main.tsx ── fragment #v<n>.? ──no──▶ ErrorBoundary ▶ App (editor; loadGraph)
                 │yes                      ▲ hashchange #v… and unsaved empty → reload
                 ▼                         │ (unsaved not empty → stay + sentence)
           link route ── feature check ── decodeLink (pure; caps; BUILT_IN ids) ── checkStored (pure)
                 │ok                              │refused
                 ▼                                ▼
           LinkBoundary ▶ read-only view     bad-link screen ── Back to my layout (replaceState → editor)
                 ├─ Build it ─▶ build mode (brio.build.link.v0 only)
                 ├─ Open in editor ─▶ put-aside (read back) ─▶ saved ← link ─▶ editor + Restore
                 └─ Back to my layout ─▶ editor (unchanged)

  Deployment: PR(a) format/decoder ─▶ PR(b) route + view, verify live with hand-made link ─▶ PR(c) Share
  Rollback: revert the merge → Pages redeploys (~2 min) → links made since stop opening until re-landed
```

## Stale Diagram Audit

- engine/src/graph/buildSteps.ts:4, :23 mention "the printable sheet". Update
  them in the sheet-removal PR.
- app/src/trackPath.ts:411 mentions the printed sheet's step numbers. Update.
- app/src/BuildMode.tsx:66, :103-105 and app/src/App.tsx:674 have
  printing-path comments. They go with the code.
- DESIGN.md:202-203 has the sheet bullet. It goes (premise 3).
- docs/plan/2026-10-31-build-mode.md describes the sheet as shipped. Add a
  "removed 2026-10-31" note; don't rewrite history.

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~1 day / CC: ~1h)**: QA: run the baseline /qa on woodentrain.world. Every flow; desktop, tablet, phone; odd layouts. Fix each bug with a test or file it.
  - Surfaced by: OH-D1, design doc step 1
  - Files: to be determined
  - Verify: /qa report; each fix PR green on `check`
- [ ] **T2 (P1, human: ~3h / CC: ~20min)**: sheet: remove the printable sheet and its entry points; update the stale comments (Stale Diagram Audit); re-measure the chunk
  - Surfaced by: OH-cut; Stale Diagram Audit
  - Files: app/src/BuildSheet.tsx, app/src/sheetLayout.ts, app/src/sheetLayout.test.ts, app/src/buildSheet.dom.test.tsx, app/src/BuildMode.tsx, app/src/App.tsx, app/src/View3DPanel.tsx, app/src/app.css, app/src/tokens.css, DESIGN.md, engine/src/graph/buildSteps.ts, app/src/trackPath.ts, docs/plan/2026-10-31-build-mode.md
  - Verify: `bun run test` green; no "Print the sheet" in app/src; chunk budget printed in the PR
- [ ] **T3 (P1, human: ~1 day / CC: ~1h)**: share (a): format, pure decoder with caps, checker split from loadGraph, BUILT_IN resolution, old-browser check, part-id pin, frozen links
  - Surfaced by: Q1/D11, OV1/D14, E1/D9, T1/D12, design doc step 3
  - Files: app/src/layoutStore.ts, new share module + tests (names: eng review)
  - Verify: per-class refusal tests; 1 MB-zeros test; setItem spy never called; frozen links decode
- [x] **T4 (P1, human: ~2 days / CC: ~2h)**: share (b): route `#v<digits>.`, the gated hashchange reload, the read-only view, the link crash screen, the storage rules, Open in editor + put-aside + Restore (done: #96, #97, #98; opened live on woodentrain.world 2026-11-01)
  - Surfaced by: A2/D7, A3/D8, OV2/D15, OV4/D17, design doc step 3
  - Files: app/src/main.tsx, app/src/App.tsx, app/src/storageKeys.ts, app/src/buildSession.ts, new link-boundary module (exact shape: A1, eng review)
  - Verify: the all-keys isolation test (view + Build it + exit); `#v2.abc` test; throwing-view test; failing-save hashchange test; full storage on Open in editor and on Restore; then a hand-made Stadium link opened on woodentrain.world
- [ ] **T5 (P1, human: ~4h / CC: ~30min)**: share (c): the Share control (share sheet or copy, the copy-fails field, decode-before-show, the corrections and too-large sentences)
  - Surfaced by: R-2/D5, E2/D10, OV3/D16, OV1/D14, OV5/D18
  - Files: app/src/App.tsx (the Share control's home: design review)
  - Verify: writeText-reject test; share-cancel test; 2,001-piece refusal test; the Stadium link's length written in the PR
- [ ] **T6 (P1, human: ~2 days / CC: ~2h)**: look: build the design-reviewed look and share screens in small PRs, then /design-review
  - Surfaced by: OH-D1, D-1/D13
  - Files: to be determined (design review)
  - Verify: /design-review on the live site
- [ ] **T7 (P2, human: ~1 day / CC: ~1h)**: QA: final /qa over the changed flows on the same devices
  - Surfaced by: design doc step 5
  - Files: to be determined
  - Verify: /qa report

Assumptions: features ~30x, tests ~50x, bug fixes ~20x (human ÷ CC).

## Reality rows (repeated for the summary)

REALITY: premise-table finding P-f: savesSuppressed is a loss-notice predicate, not an autosave switch app/src/layoutStore.ts:661
REALITY: already-done pass no share/link work on origin/main since 2026-10-30 1a78945
REALITY: surface-check pass no CLI or HTTP route; the in-app routes are new docs/designs/share-and-polish.md:1
REALITY: binding-decisions pass build-mode decisions reused, not overruled docs/plan/2026-10-31-build-mode.md:1
REALITY: numbers finding caps are [estimated]; the 134.02 kB budget is [measured] and [re-measure before gate] scripts/chunkBudget.ts:20
REALITY: deferred-asks pass no linked issue docs/designs/share-and-polish.md:1
REALITY: pr-count pass one PR per wave by default; share is three PRs by D18 docs/designs/share-and-polish.md:1
PLAN_REALITY: phase=ceo rows=7/7 missing=none verdict=complete

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SCOPE REDUCTION                             |
  | System Audit         | loadGraph writes storage; the app-wide crash |
  |                      | screen wipes layouts; corrections keep ids  |
  | Step 0               | office hours → B; file fallback deferred;   |
  |                      | share sheet kept                            |
  | Section 1  (Arch)    | 3 issues found (1 to eng review)            |
  | Section 2  (Errors)  | 20 error paths mapped, 2 GAPS (both fixed)  |
  | Section 3  (Security)| 2 issues found, 0 High severity             |
  | Section 4  (Data/UX) | 6 edge cases mapped, 3 unhandled (eng)      |
  | Section 5  (Quality) | 1 issue found                               |
  | Section 6  (Tests)   | Diagram produced, 1 gap (fixed: D12)        |
  | Section 7  (Perf)    | 1 issue found (timing, eng)                 |
  | Section 8  (Observ)  | 1 gap found (reason codes)                  |
  | Section 9  (Deploy)  | 2 risks flagged                             |
  | Section 10 (Future)  | Reversibility: 2/5 (link format), debt: 1   |
  | Section 11 (Design)  | 1 issue (fixed: D13)                        |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (6 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 20 rows, 0 CRITICAL GAPS                    |
  | Failure modes        | 9 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | 1 item (layout file, D4)                    |
  | Scope proposals      | 2 proposed cuts, 1 deferred, 1 kept         |
  | CEO plan             | skipped by mode                             |
  | Outside voice        | codex completed (5 findings, 5 resolved)    |
  | Lake Score           | 9/10 recommendations chose complete option  |
  | Diagrams produced    | 4 (architecture, data flow, failure, deploy)|
  | Stale diagrams found | 5                                           |
  | Unresolved decisions | 2 (A1, E3: eng review)                      |
  | Reality rows         | 7/7 rows (PLAN_REALITY), 2 unverified       |
  +====================================================================+
```

### Unresolved Decisions

- A1 and E3 were open after the CEO review; the eng review resolved them (A1: D21; E3: D24, D25, D36). None remain.

## Engineering review (/plan-eng-review, 2026-10-31)

Target: docs/plan/2026-10-31-share-and-polish.md (this file), with docs/designs/share-and-polish.md as source of truth.

### Scope record

- D20 (feature): the friend's screen stays the read-only editor, as planned (2D plan, 3D on request, verdict, parts, Build it). Answer: "Read-only editor (as planned)". Build mode's first screen as the viewer was rejected.
- Evidence: link lengths [measured: synthetic probe, deflate-raw + base64url]: 10 pieces ≈ 146 characters, 200 ≈ 1,343, 500 ≈ 3,231, 2,000 ≈ 13,798.
- Complexity: ≈25 changed files [estimated], 2+ new modules, so the gate trips. Structure is settled by D21 (A1 from the CEO review).

### Decision ledger (eng)

#### A1: where the read-only editor lives (structure)
Finding: CEO review A1, INFORMATIONAL (confidence 9/10), App.tsx:182-1749 holds the pipeline inline; graph state is `editor` (App.tsx:372), and inventory/table/submissions setters are reached only from their panels (App.tsx:1686, 1698, 1714)
Plan baseline: CEO D6 "Decide in eng review"; D20 keeps the read-only editor
Runtime evidence: one graph state holder (`setEditor`); six save sites (layoutStore.ts:154,:610; inventoryModel.ts:244; tableModel.ts:233; viewChoice.ts:21; buildSession.ts:76; library.ts:402)
Comparison grid:

| Commitment | Current | A Smaller | B Original |
|---|---|---|---|
| Features (2D, 3D, verdict, parts, Build it, Open in editor) | D20 | same | same |
| Where | pending | App takes `source: stored \| link` | new LinkView + an extracted `useLayoutPipeline` hook that App also uses |
| How editing is prevented | pending | one guard where `setEditor` changes the graph, refusing any graph change in link mode; the editing panels are not rendered | LinkView never renders editing controls |
| How saves are prevented | pending | one `linkMode` flag added to all six save conditions | LinkView never mounts App's save effects |
| New files/modules | — | shareLink.ts, LinkBoundary.tsx (2) | shareLink.ts, LinkBoundary.tsx, LinkView.tsx, useLayoutPipeline.ts (4) |
| App.tsx change | — | about 40 lines | the pipeline moves out (several hundred lines) |
| Isolation proof | CEO success criteria | the all-keys test | the all-keys test |
| Pending remedies not decided here | — | E3 | E3 |

Question D21:
D21 — A1: Where does the read-only editor live?
Pending remedies not decided here: E3.
A) Smaller arrangement (recommended): App takes a link source; one guard in the graph setter refuses edits in link mode; one flag blocks the six saves. 2 new modules; App +~40 lines. (human: ~1 day / CC: ~1h)
B) Original arrangement: a separate LinkView on a pipeline hook extracted from App. 4 new modules; several hundred lines move out of App. (human: ~3 days / CC: ~3h)

State: approved
Actual answer: D21 "Smaller arrangement (recommended)"
Accepted scope: App takes `source: stored | link`. In link mode: loadGraph never runs; one guard where `setEditor` changes the graph refuses graph changes; the editing panels are not rendered; one `linkMode` flag is added to all six save conditions. New modules: shareLink.ts, LinkBoundary.tsx.
History: CEO D6 sent it here.

Scope Challenge result: scope accepted as-is (smaller arrangement, same features). Feature answers: D20; structure: A (D21); pending remedies: E3.

#### S3-1: the piece cap
Finding: CEO S3-1, CRITICAL (confidence 9/10). Measured by a bounded probe (scratchpad captime.ts: placeAll + renderGraph + solveGraph, the same calls as App.tsx:527, on this Mac):
- disjoint 8-piece circles: 200 pieces → 35 ms solve; 1,000 → 461 ms; 2,000 → 2,370 ms
- one long chain: 2,000 pieces → 301 ms

A phone is slower [estimated 3-5x], so a 2,000-piece link would freeze it for several seconds.
Plan baseline: design doc caps "pieces: 2,000", as starting values that eng review checks.
Comparison grid:

| Commitment | Current | A 500 | B 1,000 | C 2,000 |
|---|---|---|---|---|
| Piece cap (decoder, and Share via D16) | 2,000 | 500 | 1,000 | 2,000 |
| Worst solve measured here | 2,370 ms | ≈130 ms [estimated between the 200 and 1,000 rows] | 461 ms | 2,370 ms |
| Link length at the cap [measured synthetic] | ≈13,800 characters | ≈3,230 | ≈6,900 [estimated] | ≈13,800 |
| Fragment cap | 32,768 characters | 8,192 | 16,384 | 32,768 |
| Inflated cap | 256 KB | 64 KB | 128 KB | 256 KB |

Question D22: what piece cap do links get? (options as in the grid: A 500, B 1,000, C 2,000)
State: approved
Actual answer: D22 "500 pieces (recommended)"
Accepted scope: caps are 500 pieces, an 8,192-character fragment and 64 KB inflated, in the decoder and therefore at Share (D16). A test covers a 501-piece layout refused at Share and at decode.
History: the design doc's starting caps were 2,000 / 32,768 / 256 KB.

#### R3-5: what "empty" means for Open in editor
Finding: design-doc review R3-5, CRITICAL (confidence 8/10). Data loss if a corrupt save counts as empty.
Options: A) only provably empty (no key, and no rescue or legacy slot; or a readable layout with zero pieces) B) whatever loads as empty
State: approved
Actual answer: D23 "Only provably empty (recommended)"
Accepted scope: one function decides emptiness. Everything else takes the put-aside path with its raw bytes. Test: a corrupt save, then Open in editor, leaves the bytes put aside unchanged.
History: this record was saved after the answer; the pre-question save was missed.

#### E3b: the Restore rollback write also fails
Finding: design-doc review R3-11, INFORMATIONAL (confidence 7/10). After a failed swap the rollback write can fail too, under the same full storage.
Comparison grid:

| Commitment | Current | A | B |
|---|---|---|---|
| Swap order and the first rollback | design doc | same | same |
| If the rollback fails | unspecified | both layouts stay in memory; one sentence says the previous layout now lives only in this tab, with a Share link that holds it | stage the incoming layout in a temporary key first |

Question D24 (options as in the grid)
State: approved
Actual answer: D24 "Warn and offer a link (recommended)"
Accepted scope: if the rollback write fails, both layouts stay in memory, and one sentence ("Storage is full, so your previous layout is only in this tab now.") comes with a Share link that holds it. Test: both writes fail.

#### E3a: a link naming a part this version doesn't have
Finding: design-doc review R3-3, INFORMATIONAL (confidence 8/10). Two causes: a removed part, or a link made with a newer catalogue than a cached app has.
Options: A) its own sentence: "This link uses a piece this version of ChooChooCAD doesn't have. Reloading usually fixes this." + Back to my layout B) the generic bad-link sentence
State: approved
Actual answer: D25 "Its own sentence (recommended)"
Accepted scope: an unknown id gets "This link uses a piece this version of ChooChooCAD doesn't have. Reloading usually fixes this." + Back to my layout; one table-test row, every key unchanged.

#### S4-1/S4-2/S4-4/R3-1: Share and Open in editor edge cases
Each is its own choice, asked in turn:
- S4-1 (D26): Share on an empty layout
- S4-2 (D27): a double tap on Open in editor before the reload
- S4-4 (D28): browser Back after Open in editor
- R3-1 (D29): declining "replace the layout you put aside last time?"

State: approved (each)
Actual answers and accepted scope:
- D26 "Disable with a reason (recommended)": Share is disabled on an empty layout with the hint "Nothing to share yet."; one DOM test.
- D27 "Guard until the reload (recommended)": the first Open in editor tap sets a guard and disables the button; test: two taps, one put-aside write, no second question.
- D28 "Erase the link (recommended)": replaceState on every exit; test: history and location.hash after Open in editor.
- D29 "Nothing changes, say why (recommended)": declining leaves every key untouched, returns to the link view, and says "Nothing changed. To keep both, restore your earlier layout first."; test: decline, every key unchanged.

#### Remaining design-doc reviewer concerns (no eng choice)
- R3-2 (dismissing the Restore entry) and R3-9 (the first-visit example's storage rule): owned by /plan-design-review (D13 scope). R3-9's storage half is a requirement the design review must settle before build.
- R3-6 corrected as a fact: the Stadium link is ≈146 characters [measured: synthetic probe]. The success criterion is now "the Stadium link is under 200 characters, with its exact length written in the PR".
- R3-8: re-baselining the chunk after the sheet removal is the owner's call at that PR (as with #90).
- R3-10: the device and browser matrix belongs to the /qa run (T1). It must include iOS Safari on a real device or the closest emulation, and say which.

### Section 1: Architecture

#### AR1: the link encoding derives from storedGraphOf
Finding: CRITICAL (confidence 8/10), app/src/layoutStore.ts:595 `export function storedGraphOf(graph: Graph): StoredGraph`. A second hand-written field list for links (red flag 8).
Comparison grid:

| Commitment | Current | A | B |
|---|---|---|---|
| What a link carries | its own compact field list | compact = a lossless packing of `storedGraphOf(graph)`; decode returns a StoredGraph for `checkStored` | own field list |
| Guard | frozen links (D12) | + a round-trip test over every corpus fixture and preset: decode(encode(g)) deep-equals storedGraphOf(g) | frozen links only |

Question D30 (options as in the grid)
State: approved
Actual answer: D30 "Pack the saved format (recommended)"
Accepted scope: compact = a lossless packing of storedGraphOf(graph); decode returns a StoredGraph for checkStored; a round-trip test over every corpus fixture and preset checks that decode(encode(g)) deep-equals storedGraphOf(g).

#### AR2: one owner for storage writes
Finding: CRITICAL (confidence 8/10). Writes sit in 7 places across 6 files (layoutStore.ts:154, :610; inventoryModel.ts:244; tableModel.ts:233; viewChoice.ts:21; buildSession.ts:76; library.ts:402), plus ErrorBoundary.tsx:87's clear; the link-mode flag would live in App.
Comparison grid:

| Commitment | Current | A | B |
|---|---|---|---|
| Link sessions never write protected keys | CEO success criteria | same | same |
| Mechanism | a flag in six App conditions | one `storage.ts` (write/remove), with a read-only session switch set by the link route before App mounts; it only allows `brio.build.link.v0` | as current |
| Guard against a new write path | all-keys test | + a parser-based test (TypeScript AST, per learning four-regex-versions-of-an-import-guard-all-got-defeated) failing if any other source calls localStorage.setItem/removeItem | all-keys test only |

Question D31 (options as in the grid)
State: approved
Actual answer: D31 "One storage module (recommended)"
Accepted scope:
- New app/src/storage.ts with write/remove. The seven call sites move to it, and so does ErrorBoundary's clear.
- The link route turns on a read-only session before App mounts. During it, only `brio.build.link.v0` is written, and every other write returns "skipped", which callers treat as not failed, so no save-failure notice appears.
- Open in editor is the one sanctioned exit: it ends the read-only session immediately before its put-aside and replace writes.
- A parser-based test (TypeScript AST) fails if any other source calls localStorage.setItem/removeItem.
- This replaces D21's "flag in six save conditions"; D21's setEditor guard stands.

### Section 2: Code quality

- CQ1 (D32 "One linkWords.ts (recommended)"): every link-flow sentence lives in app/src/linkWords.ts, a reason-to-sentence table like joinWords.ts; components and tests import it. Approved.
- CQ2: the checkStored split puts loadGraph at regression risk; settled in Section 3 (D33).

### Section 3: Tests

- CQ2/D33 "Frozen tests + shared tables (recommended)": in the split PR, layoutStore.test.ts's existing expectations don't change (additions only). Its refusal matrices become shared tables, and each row states two outcomes: what loadGraph does (refuse, or repair) and what the decoder does (always refuse; it never repairs). Approved.

Coverage diagram (proposed code; every path below is a planned test, nothing exists yet):

```
CODE PATHS                                              USER FLOWS
[+] app/src/shareLink.ts                                 [+] Friend opens a link
  ├── encode(storedGraphOf(g))                             ├── [PLANNED ★★★] fresh load #v1. → read-only editor, every key unchanged [→E2E: live check]
  │   ├── [PLANNED ★★★] round-trip every fixture+preset (D30) ├── [PLANNED ★★★] Build it a few steps → Back; only brio.build.link.v0 written
  │   └── [PLANNED ★★★] 501 pieces refused (D22/D16)      ├── [PLANNED ★★★] Open in editor: empty / put-aside / ask / decline (D23, D29)
  ├── decode(fragment)                                     ├── [PLANNED ★★★] Open in editor double tap (D27); Back after (D28)
  │   ├── [PLANNED ★★★] each refusal class (table)         ├── [PLANNED ★★★] Restore swap; full storage on put-aside, on swap, on rollback (D24)
  │   ├── [PLANNED ★★★] 1 MB zeros stops mid-stream        └── [PLANNED ★★★] crash inside link view → crash screen, keys unchanged (D7)
  │   ├── [PLANNED ★★★] unknown id sentence (D25)        [+] Arrivals
  │   ├── [PLANNED ★★ ] #v2. → newer-version (D17)         ├── [PLANNED ★★★] hashchange, all saved → reload (D8)
  │   └── [PLANNED ★★ ] no DecompressionStream (D9)        └── [PLANNED ★★★] hashchange, a save failed → stays + sentence (D15)
  ├── [PLANNED ★★★] frozen v1 links decode (D12)        [+] Sender
  └── BUILT_IN resolution (D14) [PLANNED ★★★]             ├── [PLANNED ★★★] copy ok / writeText rejects → field (D10)
[+] checkStored (pure, split from loadGraph)               ├── [PLANNED ★★ ] share sheet cancel = no-op; unsupported → copy (D5)
  ├── [EXISTING ★★★] 52 layoutStore tests unchanged (D33)  ├── [PLANNED ★★ ] empty layout → disabled (D26)
  └── [PLANNED ★★★] shared refusal tables, both paths      └── [PLANNED ★★ ] corrections sentence (D14)
[+] app/src/storage.ts (D31)
  ├── [PLANNED ★★★] read-only session: writes skipped, build.link allowed
  └── [PLANNED ★★★] AST guard: no other localStorage.setItem/removeItem
[+] App link source (D21)
  └── [PLANNED ★★★] graph-changing setEditor refused in link mode
[+] sheet removal: [EXISTING ★★★] buildMode.dom tests stay green; buildSheet/sheetLayout tests retire

COVERAGE (planned): every new path has a planned ★★/★★★ test | GAPS: 0 | E2E: 1 live check per share PR (D18)
```

Tests to retire: app/src/sheetLayout.test.ts and app/src/buildSheet.dom.test.tsx (the sheet is removed, OH-cut); buildMode.dom.test.tsx has no print assertions (checked).

### Section 4: Performance

No issues found. Decode is milliseconds at the cap (an 8,192-character fragment, at most 64 KB inflated). Solving a 500-piece link is under the measured 461 ms (the 1,000-piece row). Share's encode and check run per click. storage.ts adds one call per existing write.

### Outside voice (Codex gpt-6-astra, eng phase)

| ID | Finding (verified) | Status |
|---|---|---|
| OV-E1 | D15 gates on `unsaved` only; App.tsx:1408 `allSaved` also checks the four *SaveBlocked flags | approved D34 "Apply this change (recommended)": one shared `allSaved` value (unsaved empty AND no *SaveBlocked flag) drives both build mode's Reload and the hashchange gate; test: a held-back save + edits + a pasted link → no reload |
| OV-E2 | D31 lifts the read-only switch before import writes that can fail; a 2D/3D toggle then writes (App.tsx:712) | approved D35 "Apply this change (recommended)": storage.withImport(fn) makes only the saved-layout and put-aside keys writable, during fn only; the session stays read-only otherwise, success or failure; test: a failed import, then a 2D/3D toggle + Build it → every key unchanged. Amends D31's "ends the read-only session" |
| OV-E3 | D24's recovery link can't carry corrupt bytes, custom parts or >500 pieces | approved D36 "Apply: download the raw bytes (recommended)": the storage-full warning offers "Download a copy", the exact stored bytes as a .json Blob download; test: byte-identical content. Replaces D24's Share link; re-import rides the layout-file TODO |
| OV-E4 | No cross-tab handling (App.tsx:452). It loses the opened link's layout (reopenable), not the friend's own; Medium | approved D37 "Apply: stale tab stops saving (recommended)": editors listen for the storage event on the saved-layout key; on another tab's change, this tab stops autosaving and says "This layout was changed in another tab. Reload to see the latest." + Reload; test: a simulated storage event → no further saveGraph writes |
| OV-E5 | The 500-piece timing is interpolated from easy layouts | approved D38 "Apply: measure before merge (recommended)": before PR (b) merges, three valid 500-piece layouts (switch-heavy, overlapping, mixed) are timed load-to-verdict on a real phone or the slowest named device; if any is over 1 s, halve the cap and repeat; numbers go in the PR |

### TODO choices

No new TODO proposals. The existing layout-file TODO (docs/plan/brio-TODOS.md:383) gains D36's re-import reason. No other deferral was chosen.

Approval readiness (eng): PASS. Checked: D20 (feature), D21 (structure), D22, D23, D24 (amended by D36), D25, D26, D27, D28, D29, D30, D31 (amended by D35), D32, D33, D34 (amends CEO D15), D35, D36, D37, D38. Each carries its actual answer above. No pending rows.

### Eng: NOT in scope

- Build mode's first screen as the friend's view: rejected (D20). The friend gets the read-only editor.
- A separate LinkView with an extracted pipeline: rejected (D21).
- A temporary-key staging for Restore: rejected (D24).
- Re-importing a "Download a copy" backup: rides the deferred layout-file TODO (D36).

### Eng: What already exists

- storedGraphOf (layoutStore.ts:595) is the one format, and links pack it (D30).
- loadGraph's checks (layoutStore.ts:305) become checkStored. The 52 tests in layoutStore.test.ts stay the contract, and their matrices become shared tables (D33).
- App's `allSaved` expression (App.tsx:1408) becomes the one "safe to reload" value (D34).
- joinWords.ts is the pattern for linkWords.ts (D32).
- Build mode is reused unchanged for Build it from a link. Its resume moves to `brio.build.link.v0` via storage.ts.

### Eng: Diagrams

```
 ARRIVAL                                   STORAGE (D31, D35)
 load ─▶ #v<n>.? ─no─▶ editor               storage.ts
           │yes                              ├─ write/remove ◀── 7 call sites (+ ErrorBoundary clear)
           ▼                                 ├─ readOnlySession: on before App mounts in link mode
     storage.readOnly = on                   │     allows brio.build.link.v0 only; others → "skipped"
     decode (caps 500 / 8,192 / 64 KB)       └─ withImport(fn): saved + put-aside keys, during fn only
     ── refused ─▶ linkWords sentence ─▶ Back (replaceState + reload)
     ── ok ─▶ LinkBoundary ▶ App(source=link)
                 setEditor guard: no graph change
 hashchange #v… ─▶ allSaved? ─yes─▶ reload │ no ─▶ restore old hash + sentence (D15, D34)

 OPEN IN EDITOR (D23, D27, D29, D35)
 tap ─guard─▶ provably empty? ─yes─▶ withImport: write saved ─▶ reload
                 │no
                 ▼
          put-aside holds a different layout? ─yes─▶ ask ─no─▶ "Nothing changed…" (back to the view)
                 │no / yes-replace
                 ▼
          withImport: write put-aside, read back ─▶ write saved, read back ─▶ replaceState + reload
          any failure ─▶ nothing changed + sentence (still read-only)

 RESTORE SWAP (D24, D36)
 read both ─▶ write put-aside ✓ ─▶ write saved ✓ ─▶ done
              any ✗ ─▶ roll back from memory ─✗─▶ "Storage is full…" + Download a copy (raw bytes)

 OTHER TAB (D37): storage event on the saved key ─▶ stop autosave + "changed in another tab" + Reload
```

### Eng: Failure modes

| New path | Realistic failure | Test | Error handling | User sees |
|---|---|---|---|---|
| decode | a truncated link from a chat app | refusal table | typed result | sentence + Back |
| decode | a hostile 500-piece link | D38 device run + 501 refusal | caps | bounded wait (D38 rule) |
| link view | render throws | throwing-view test | LinkBoundary | crash screen, keys unchanged |
| hashchange | edits held back by a rescue notice | D34 test | allSaved gate | sentence, stays |
| Open in editor | quota exceeded mid-import | full-storage test + toggle after | withImport | nothing changed + sentence |
| Restore | the rollback also fails | both-fail test | in-memory + download | warning + Download a copy |
| two tabs | a stale tab autosaves over the opened link | storage-event test | autosave stopped | "changed in another tab" |
| any new storage write | added outside storage.ts | AST guard test | CI fails | — (prevented) |
| link format | a new graph field is dropped | round-trip over fixtures (D30) | CI fails | — (prevented) |

Critical gaps: 0.

### Eng: Worktree parallelization strategy

| Step | Modules touched | Depends on |
|------|----------------|------------|
| QA baseline fixes | to be determined | — |
| Sheet removal | app/src build-mode + css, DESIGN.md, engine/src/graph comments | QA wave (plan order) |
| Share (a) format, decoder, checker, storage.ts | app/src store modules, engine/data | QA wave (plan order) |
| Design review (look + share screens) | docs | — |
| Share (b) route, link view, Open in editor, Restore, cross-tab | app/src App, main, storage | Share (a), design review, D38 device run before merge |
| Share (c) Share control | app/src App + linkWords | Share (b) live check (D18) |
| Look PRs | app/src css/components | design review |

Parallel lanes, after QA:
- Lane A: sheet removal (build-mode files).
- Lane B: share (a) (store modules).

These are disjoint, except that both touch app/src/buildSession.ts (B moves its write into storage.ts), so merge A first and rebase B. The design review can run alongside either. Then (b), then (c), then the look PRs. Each PR branches from main (memory: stacked-prs-close-on-delete-branch).

### Eng: Implementation Tasks

These supersede the CEO tasks T3 to T5 for the share wave.

- [ ] **E1 (P1, human: ~1 day / CC: ~1.5h)**: share (a): storage.ts and the 7-site migration, the AST guard, and the checkStored split with the shared refusal tables
  - Surfaced by: AR2/D31, D35, CQ2/D33
  - Files: app/src/storage.ts (new), app/src/layoutStore.ts, app/src/inventoryModel.ts, app/src/tableModel.ts, app/src/viewChoice.ts, app/src/buildSession.ts, engine/data/library.ts, app/src/ErrorBoundary.tsx, app/src/layoutStore.test.ts (additions only)
  - Verify: `bun run test`. The 52 existing layoutStore expectations are unchanged; the AST guard fails on an injected setItem (mutation run and quoted).
- [ ] **E2 (P1, human: ~1 day / CC: ~1h)**: share (a): shareLink.ts (packs storedGraphOf, caps 500 / 8,192 / 64 KB with a mid-stream stop, BUILT_IN resolution, the version namespace), linkWords.ts, the frozen links, the round-trip test
  - Surfaced by: D30, D22, D14, D17, D25, D32, D12, D9
  - Files: app/src/shareLink.ts, app/src/shareLink.test.ts, app/src/linkWords.ts, fixtures
  - Verify: refusal table; 1 MB zeros; 501 pieces; frozen links; round-trip over every fixture and preset
- [x] **E3 (P1, human: ~2 days / CC: ~2h)**: share (b): main.tsx route, LinkBoundary, App `source` with the setEditor guard, the read-only session, hashchange on allSaved, Open in editor (empty rule, guard, ask/decline, withImport), Restore (swap, rollback, download), cross-tab listener (done: #97, #98)
  - Surfaced by: D21, D7, D8/D15/D34, D23, D27, D28, D29, D35, D24/D36, D37
  - Files: app/src/main.tsx, app/src/App.tsx, app/src/LinkBoundary.tsx (new), app/src/storageKeys.ts, app/src/buildSession.ts
  - Verify: the all-keys isolation test, plus one test per row of the failure table; then D38's device run; then a hand-made Stadium link opened on woodentrain.world
- [ ] **E4 (P1, human: ~4h / CC: ~30min)**: share (c): the Share control (share sheet or copy, the copy-fails field, decode-before-show, empty disabled, the corrections and too-large sentences)
  - Surfaced by: D5, D10, D16, D26, D14
  - Files: app/src/App.tsx (placement per the design review), app/src/linkWords.ts
  - Verify: the DOM tests for each state; the Stadium link under 200 characters, with its length in the PR

Assumptions: features ~30x, tests ~50x (human ÷ CC).

### Eng: Unresolved decisions

None in this review.

### Eng: Reality rows

REALITY: premise-table finding P-f savesSuppressed is a notice predicate, superseded by storage.ts (D31) app/src/layoutStore.ts:661
REALITY: already-done pass no share/link/storage-module work on origin/main 1a78945
REALITY: surface-check pass the new in-app routes and APIs (CompressionStream, navigator.share, the storage event) are platform APIs; no CLI app/src/App.tsx:1408
REALITY: binding-decisions pass CEO D3-D18 carried; D15 and D24 amended only by explicit answers D34 and D36 docs/plan/2026-10-31-share-and-polish.md:1
REALITY: numbers finding link lengths and solve times [measured: synthetic probe]; the 500-piece phone time is [re-measure before gate] (D38) app/src/App.tsx:527
REALITY: deferred-asks pass no linked issue docs/designs/share-and-polish.md:1
REALITY: pr-count pass the share wave is 3 PRs (D18); the sheet removal 1; each PR costs one CI run, and no user-facing reference spans PRs docs/designs/share-and-polish.md:1

### Eng: Completion summary

- Step 0: Scope Challenge — scope accepted as-is (smaller arrangement, D21)
- Reality rows: 7/7 applicable rows emitted, 2 unverified premises (P-i, P-j)
- Architecture Review: 2 issues found (AR1, AR2)
- Code Quality Review: 2 issues found (CQ1, CQ2)
- Test Review: diagram produced, 0 gaps identified
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items proposed to user (1 existing TODO amended per D36)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: Codex gpt-6-astra, completed (5 findings, 5 resolved by D34-D38)
- Parallelization: 2 lanes, 2 parallel / 4 sequential
- Lake Score: 12/12

## Design review (/plan-design-review, 2026-11-01)

Step 0: 3/10. Focus: all 7 dimensions (D40). Mockups: none (the designer has no API key; text-only). Outside voices: Codex + Claude subagent (D41); litmus fails 1-4 and 6, both agree; no hard rejection.

### Pass 1: Information architecture: 2/10 → 8/10

- 1A (D42): the friend's screen order is (1) a title line, "A wooden railway · 14 pieces" (count in .num); (2) the 2D plan as the anchor, filling the stage; (3) the verdict line; (4) Build it, the one solid --ink button; (5) the parts list, folded; (6) quiet buttons: 3D, Open in editor, Back to my layout / Start your own.
- 2A (D43): the mark, ChooChooCAD and "wooden railway layouts" move out of the parts rail to an identity line at the top of the stage, start-aligned, in every mode (editor, friend, first visit), at the existing app-name size.
- 3A (D44): first visit shows the Stadium on the floor, only when nothing is stored (no layout, rescue or legacy data). It is labelled "An example", has its verdict line, primary "Build this" (build mode) and secondary "Start my own" (clears to the editor). It is never saved until edited or adopted, and the parts rail stays.
- 4A (D45): the verdict strip always shows the glyph, the sentence, the arrowed next step, and any "not checked" or "needs an adapter" note (rule 3). Estimates, unverified sizes and catalogue provenance fold behind an "N notes" text button (aria-expanded, opens inline, no colour), whose open state is remembered per session. The shaded band goes: the strip sits on paper above one --rule divider.
- 5A (D46): Share sits in the canvas corner: [Share] [Build it] [2D|3D], in the .view-reset outline style (Build it stays the stronger action), and is disabled with "Nothing to share yet." on an empty layout.
- Left for 8 → 10: the phone composition (Pass 6).

### Pass 2: Interaction states: 3/10 → 9/10

- 6A (D47): when a link is opening, the identity line shows at once. After 300ms (LOADING_DELAY_MS) with nothing ready, the stage shows "Opening a shared railway…" (canvas-empty-lead, role=status). No spinner, and the editor never flashes.
- 7A (D48): after the clipboard write resolves, Share reads "Link copied" for 2s at a fixed min-width, and the same sentence goes to the polite live region. On touch the share sheet is the feedback.
- 8A (D49): the friend's screen always shows "Checked with standard part sizes." under the verdict, in --ink-soft meta type, never folded.
- 9A (D50): Restore has a quiet "Discard" next to it. It confirms "Discard the put-aside layout (N pieces)? This can't be undone." with Discard / Keep it, then empties the slot and the entry goes.
- R3-9 is settled by 3A: the example appears only with nothing stored and is never saved until edited or adopted. Build this may write build progress (`brio.build.v0`), never the layout.

```
  FEATURE            | LOADING                    | EMPTY                       | ERROR                                   | SUCCESS                        | PARTIAL
  -------------------|----------------------------|-----------------------------|-----------------------------------------|--------------------------------|-------------------------------
  Friend's screen    | identity + "Opening a      | — (an empty layout can't    | linkWords sentence + Back/Start;        | title, plan, verdict, Build it | "Checked with standard part
                     | shared railway…" after 300ms| be shared, D26)             | crash screen (D7); newer version (D17)  |                                | sizes." always (8A)
  Share              | —                          | disabled, "Nothing to share | too long / custom part / old browser;   | "Link copied" 2s, or the sheet | corrections sentence (D14)
                     |                            | yet." (D26)                 | copy-by-hand field (D10)                |                                |
  Open in editor     | —                          | provably empty → replace    | "couldn't put your layout aside"        | editor + Restore/Discard       | ask when the slot holds another
  First visit        | —                          | the Stadium example (3A)    | —                                       | Build this / Start my own      | —
  Verdict strip      | —                          | "Nothing to check yet."     | glyph + sentence + kept notes (4A)      | glyph + sentence + next step   | "N notes" folded (4A)
```

### Pass 3: User journey: 4/10 → 9/10

```
  STEP | USER DOES                           | USER FEELS              | PLAN SPECIFIES
  1    | Sees the link in a chat             | curious, maybe wary     | og preview + share text (12A)
  2    | Taps it, usually on a phone         | expectant               | phone composition (Pass 6)
  3    | Sees "A wooden railway · 14 pieces" | "oh, that's theirs"     | 1A, 2A
  4    | Reads the verdict                   | "can I build it?"       | 4A, 8A
  5    | Build it → on the floor             | delight, doing it together | build mode
  6    | Open in editor                      | ownership, slight fear  | 11A ask with previews, Restore/Discard (9A)
  7    | Leaves                              | knows where they're going | 10A labels
```

- 10A (D51): D23's empty check picks the exit label: "Back to my layout" when a layout is stored, "Start your own" when none is. It applies on the friend's, refusal and crash screens, and both labels live in linkWords.ts.
- 11A (D52): the put-aside ask shows two rows, "Put aside earlier: N pieces" and "This link: M pieces", each with a 48px ink drawing in the part-card style (rule 11, no colour). Buttons: "Replace it" / "Keep it" (Keep = D29).
- 12A (D53): index.html gains og:title "ChooChooCAD", og:description "Plan a wooden railway, check it fits, build it piece by piece." and a 1200×630 og:image (the Stadium in beech on paper, the wordmark in ink). The share sheet's text is "A wooden railway for you to build:".
- 13A (D54): the storage-full warning reads "Storage is full, so your previous layout is only in this tab now. Download a copy to keep it safe. ChooChooCAD can't open these files yet, so keep this tab open until you've freed some space." It stays while a layout exists only in memory.

### Pass 4: Specificity and AI-slop risk: 4/10 → 8/10

Classifier: OPERATE (app UI) for the editor and the friend's screen. Hard rejections: none, from either voice. Litmus after fixes: brand YES (2A, 12A); anchor YES (1A, 3A); headlines YES (1A title, 3A label); one job per section YES (4A splits judging from explaining); cards needed NO, part cards only; motion YES (15A); premium without shadows YES.

- 14A (D55): warmth comes from wood, words and space; no new colours or faces.
  - More wood: the example on first visit (3A), and the plan fills the stage with --s5 margins.
  - Words: titles say "railway", "build", "pieces", never jargon.
  - Type: a page-title role at 24px/600 for the identity line and the friend's title.
  - Space: the stage padding goes from --s4 to --s5.
- 15A (D56): the one authored motion is a placed or joined piece settling over 160ms (a 2px drop, opacity 0.85→1, ease-out). New --motion tokens go in tokens.css, the brand-note caret transition is removed, prefers-reduced-motion turns the settle off, and build mode stays cut.
- 16A (D57): TrackCanvas.tsx:772 becomes "The layout is still here and still checked, and the verdict applies to all of it. Remove some track to see the picture again." A parser-based test fails on below/above/left/right in UI copy.
- Not a finding: Codex's ::selection literal (tokens.css:295) sits inside tokens.css, where DESIGN.md says values live.

### Pass 5: Design system alignment: 6/10 → 9/10

- 17A (D58): the look PR amends DESIGN.md.
  - Rule 3 gains "a folded note never hides a not-checked or adapter note" (4A).
  - Rule 8 names the settle (15A).
  - Rule 12 loses the printed-sheet bullet.
  - A new rule 13, "A shared railway is an invitation", states 1A's order, 10A's labels and 8A's line.
  - The identity line (2A) joins rule 9's surfaces.
  - The new tokens (the 24px/600 page-title role, --motion-*) go in tokens.css with their comments and measured ratios where colour is involved (none is new).
- New components fit existing vocabulary: Share uses .view-reset; the put-aside thumbnails use the PartPreview ink style; the folded-notes control is a text button like the brand note.

### Pass 6: Responsive and accessibility: 2/10 → 9/10

- 18A (D59): under 620px the link route skips the "larger screen" gate and shows the phone friend screen.
  - Contents: the identity line, the title, the 2D plan fitted to full width, the verdict, Build it full width at 48px, the parts folded, and the 3D button.
  - The canvas has no zoom gesture of its own; browser zoom stays allowed.
  - "Open in editor" is replaced by "Open this link on a tablet or computer to change it."
  - Tested at 360 and 390px with 44px targets. D38's device run uses this screen.
- 19A (D60): under 620px with no link, the same composition shows 3A's example ("An example · 10 pieces", Build this) and "Open ChooChooCAD on a tablet or computer to design your own." With a stored layout, it shows the user's own layout read-only with Build it.
  - Eng note: this is a phone read-only mode for a stored layout. It reuses the D21 read-only editor (graph guard, panels hidden), but saves need no block because nothing edits. /plan-eng-review should confirm in its next pass.
- 20A (D61): on the friend's screen, the title is an h1 in main and takes focus on load (tabindex=-1).
  - The polite region says "Shared railway, N pieces. <verdict sentence>" once.
  - Tab order: Build it, the parts disclosure, 3D, Open in editor, the exit.
  - The canvas is role=img, labelled with the piece count and verdict; the U7a layout list stays.
  - Refusal and crash screens focus their sentence, and every target is 44px (rule 10).
- Tablet and desktop (≥621px) use 1A's composition. In link mode the rail is hidden, so the stage spans the width.

### Pass 7: Unresolved design decisions: 2 resolved, 0 deferred

- 21A (D62): the friend's screen always opens in 2D. 3D is in the quiet row, and the choice is never remembered for links (no view write).
- 22A (D63): Restore and Discard live in a notice line under the identity line, in the .notice style: "Your earlier layout (N pieces) is put aside." with [Restore it] [Discard] text buttons, no colour. It goes once discarded.

| DECISION | IF DEFERRED, WHAT HAPPENS | STATUS |
|---|---|---|
| Phone read-only mode for a stored layout (19A) | eng must confirm it reuses D21 safely | eng follow-up, not a design choice |

### Design: NOT in scope

- A display typeface for titles (14B, rejected).
- A phone editor: phones view and build only (18A, 19A).
- Skeleton loading (6B, rejected).
- Mockups: the designer has no API key; run `$D setup` to enable them for /design-review.

### Design: What already exists (reused)

- VerdictLine (for the strip and the fold, 4A)
- .view-reset buttons (Share, 5A)
- the .notice style (Restore, 22A)
- PartPreview's ink drawing (thumbnails, 11A)
- canvas-empty-lead (loading, 6A)
- LOADING_DELAY_MS
- build mode's phone tokens (under 600px)
- the U7a layout list
- the polite live region

### Design: Implementation Tasks

- [ ] **DT1 (P1, human: ~2 days / CC: ~2h)**: look PR: the identity line out of the rail (2A), warmth (14A: the page-title role, --s5 stage), the verdict fold (4A), the settle motion (15A), the rule 7 copy fix and guard (16A), the DESIGN.md amendments (17A), the first-visit example (3A) and the phone first visit (19A)
  - Surfaced by: Passes 1, 4, 5, 6
  - Files: app/src/App.tsx, app/src/AppName.tsx, app/src/VerdictLine.tsx, app/src/TrackCanvas.tsx, app/src/app.css, app/src/tokens.css, DESIGN.md
  - Verify: DOM tests for the fold (a not-checked note stays visible), for the example (shown only when nothing is stored; nothing written until edited), and for reduced motion; then /design-review on the live site
- [x] **DT2 (P1, human: ~1.5 days / CC: ~1.5h)**: share (b) screens: (done: #97, #98)
  - order and title (1A), loading (6A), the standard-sizes line (8A), exit labels (10A)
  - the ask with thumbnails (11A), the storage-full copy (13A)
  - the phone friend screen (18A), accessibility (20A), 2D first (21A)
  - the Restore notice with Discard (9A, 22A)
  - Surfaced by: Passes 1, 2, 3, 6, 7
  - Files: app/src/App.tsx, app/src/LinkBoundary.tsx, app/src/linkWords.ts, app/src/app.css
  - Verify: DOM tests per state (the state table); 360 and 390px screenshots; D38's device run on the phone screen
- [ ] **DT3 (P1, human: ~4h / CC: ~30min)**: share (c): Share in the canvas corner (5A), "Link copied" (7A), og tags, the og image and the share text (12A)
  - Surfaced by: Passes 1, 2, 3
  - Files: app/src/App.tsx, app/index.html, app/public/og.png, app/src/linkWords.ts
  - Verify: the "Link copied" DOM test; a preview check in one chat app (named in the PR)

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md (12 rules) + tokens.css; large UI scope; live site: phone wall, blank first visit, 5-line verdict |
  | Step 0               | 3/10; all 7 dimensions (D40)                |
  | Pass 1  (Info Arch)  | 2/10 → 9/10 after fixes                     |
  | Pass 2  (States)     | 3/10 → 9/10 after fixes                     |
  | Pass 3  (Journey)    | 4/10 → 9/10 after fixes                     |
  | Pass 4  (AI Slop)    | 4/10 → 8/10 after fixes                     |
  | Pass 5  (Design Sys) | 6/10 → 9/10 after fixes                     |
  | Pass 6  (Responsive) | 2/10 → 9/10 after fixes                     |
  | Pass 7  (Decisions)  | 2 resolved, 0 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated (no API key), 0 approved        |
  | Decisions made       | 22 added to plan (D42-D63)                  |
  | Decisions deferred   | 0                                           |
  | Overall design score | 2/10 → 8/10                                 |
  +====================================================================+
```

Every pass is 8+, so the plan is design-complete. Run /design-review after implementation for visual QA.

Unresolved Decisions (design): none. One eng follow-up: confirm the phone read-only mode for a stored layout (19A).

## Engineering review re-run (2026-11-01): the design additions

Target: the design review's D42-D63, especially 18A, 19A and 3A.
- Scope Challenge: the 620px breakpoint exists only in CSS (app.css:1140); 19A needs JS to turn editing off. Every edit saves (App.tsx:451-454), so 3A's example needs a save block.
- Complexity: about 10 more files [estimated], so the gate trips.
- Result: scope accepted as-is, with the smaller arrangement (D65).

| ID | Decision | Accepted scope | Answer |
|---|---|---|---|
| D65 | Structure | one pure `screenMode({fragment, stored, narrow, adopted})` → edit/link/example/view (plus ownership, D71) feeds `canEdit` and `canSave` to D21's setEditor guard and to storage.ts; a table test covers every combination | "Smaller arrangement (recommended)" |
| D66 | Example storage | the example uses storage.ts's session; the first graph-changing edit adopts it (the session ends, the edit saves); Start my own clears to an empty editor with nothing written; Build this writes build progress to brio.build.link.v0 | "Reuse D31's read-only session (recommended)", narrowed by D68 |
| D67 | Breakpoint | NARROW_QUERY '(max-width: 620px)' is one exported constant; a useMatchMedia hook feeds `narrow`; a CSS-parser test checks the gate's media query against it; rotation across 620px is tested | "One constant + CSS check (recommended)", scoped by D73 |
| D68 (OV-R1) | Example blocks only the layout | example mode blocks only the saved-layout key (build progress goes to the link slot); box, table, submissions and view save as normal; test: example up, edit the box, reload → box kept, no layout saved | "Apply: block only the layout (recommended)" |
| D69 (OV-R2) | Unverified honesty | 8A's line becomes "Checked with catalogue sizes."; when unverified parts are used, a visible, never-folded line "N pieces have sizes nobody has measured." in the editor and the friend's screen; details stay in "N notes"; named in 17A's rule 3 amendment | "Apply: say 'catalogue', count unverified (recommended)" |
| D70 (OV-R3) | Mode timing | screenMode is derived on every render; the graph is kept across rotation; tests assert permissions after adopt and after rotating narrow and back | "Apply: derive per render (recommended)" |
| D71 (OV-R4) | Build slot by ownership | your own layout (edit or phone view) uses brio.build.v0; links and the un-adopted example use brio.build.link.v0; width never changes the slot; the phone view of your own layout is not a storage session (the guard blocks graph changes); test: 3 steps on the phone view, widen, resume at 3 | "Apply: slot follows ownership (recommended)" |
| D72 (OV-R5) | Ask rows (corrects 11A) | rows "Put aside earlier (will be replaced): N pieces" and "Your current layout (goes into its place): M pieces", each with a drawing; an unreadable layout shows "A layout that couldn't be read (kept exactly as saved)" with no drawing, in the ask and in the Restore notice (22A); test: corrupt slot bytes render | "Apply: show the two at stake (recommended)" |
| D73 (OV-R6) | Guard scope | the copy guard checks visible prose for screen-position phrases and allows movement commands; the breakpoint guard checks only the media query marked `/* gate: NARROW_QUERY */`; build mode's 599px rule is untouched; each guard quotes a mutation run | "Apply: scope both (recommended)" |

Amended design rows: 8A wording (D69), 4A's fold (unverified counts stay visible, D69), 11A rows (D72), 16A guard scope (D73).

Sections 1-4:
- Architecture: D65 and D67 (2 issues).
- Code quality: no new issues. VerdictLine's notes need a typed `keepVisible` field (4A, D69) rather than CSS order, which is required implementation of an approved behaviour. The 11A thumbnails reuse trackPath.ts `segmentPath`.
- Tests: no gaps. Intended changes to existing tests: appName.dom.test (2A moves the name); the VerdictLine tests (4A fold, D69 lines).
- Performance: none. The settle is CSS-only, and the og image stays under 100 KB.

Approval readiness (eng re-run): PASS. Checked D65-D73. No pending rows.
Implementation: DT1 gains D65, D66/D68, D67/D73 and D69. DT2 gains D70, D71 and D72.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | ISSUES OPEN | mode: SCOPE_REDUCTION, 0 critical gaps (open items resolved in the eng review) |
| Outside Review | Codex (gpt-6-astra) via CEO, eng (×2) and design reviews | Independent 2nd opinion | 4 | completed | 24 findings; 24 resolved; 0 unresolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | ISSUES OPEN | 2 issues, 0 critical gaps (re-run on the design additions; all resolved, D65-D73) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 2/10 → 8/10, 22 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not applicable |

- **OUTSIDE COVERAGE:** Codex gpt-6-astra, plan-review and design phases, all completed:
  - CEO phase: 5 findings, resolved by D14-D18.
  - Eng phase: 5, resolved by D34-D38.
  - Design phase: 8, resolved or judged.
  - Eng re-run: 6 (2 High, 3 Medium, 1 Low), resolved by D68-D73.
- **CROSS-MODEL:** Codex alone caught the example blocking non-layout saves (D68), the overconfident "standard sizes" line (D69) and the ask showing the wrong layout (D72, correcting my 11A). This re-run alone caught the CSS-only breakpoint that 19A needs in JS (D67) and the save-on-first-render that breaks 3A (D66).
- **VERDICT:** Design CLEAR. The eng status is issues_open only because findings were mapped; nothing is unresolved. Ready to implement: QA first, then the sheet removal, then the share and look PRs in the planned order.

NO UNRESOLVED DECISIONS
