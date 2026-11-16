# What's next: the backlog cleaned, and what to build (CEO review, 2026-11-16)

Owner's ask (the /plan-ceo-review arguments, verbatim): "what's next? Clean up
the todo list and see what else we can implement". On `main` at `6bb6799`,
version 1.0.1.

Mode: SELECTIVE EXPANSION (the ask's own words, "see what else we can
implement": hold the current scope, offer additions one by one). Depth:
strategy-only (state, order, scope; no implementation design). This is a
delta on the review of two days ago
(`docs/plan/2026-11-14-product-state-review.md`), not a second copy of it.
The owner's standing rules still bind: partnership and outreach shelved
(2026-11-04), "any legal risk, scrap it" (2026-11-05), no brand names
(AGENTS.md).

**Version (AGENTS.md, "every plan names the version").** This review and the
backlog cleanup land as one documents pull request: 1.0.1 to **1.0.2**
(patch: docs only). Each piece of work accepted below is its own pull request
and names its own number in the task list; none is stacked.

## Step 0 evidence

### 0A. Premise

- **The real problem.** Two days ago the owner accepted five additions. All
  five are built and live, with a phone editor and versioning on top. The
  backlog was not kept in step: it still lists finished work as open, so it
  no longer says what is left. The question is what the honest queue is now,
  and what is worth adding to it.
- **Target outcome.** A backlog where every open heading is open work with
  today's facts; a short ordered list of what is left; a decision on each
  proposed addition.
- **Do-nothing cost.** The list is the queue. An agent or a contributor
  reading it today would rebuild the train, table fit or the ready layouts,
  or send the IP question to counsel again.
- **Direct or proxy.** Cleaning a list is a proxy. The direct evidence of what
  to build is still the usage dashboard, which this review cannot open, and
  the floor readings, which only the owner can take.

### 0B. What happened since 2026-11-14 (leverage)

| Accepted then | State now | Receipt |
|---|---|---|
| E1 findable in search | built | `app/index.html:7`, `app/src/layoutPages.ts`, `app/public/sitemap.xml` |
| E2 ready layouts, box-can-build | built: 8 ready layouts | `app/src/canBuild.ts:17`, `app/src/presets.ts` |
| E3 finish the loop | built for one joint that does not meet | `engine/src/graph/fill.ts`, `engine/src/graph/repair.ts` |
| E4 phone editor | built and live | `app/src/PhoneShell.tsx`, DESIGN.md rule 14 |
| E5 route walker and train | built; engine and two wagons, a dice at switches | `engine/src/graph/route.ts`, `app/src/playback.ts` |
| not planned then | versioning: a number per merge, tagged and released | `engine/tools/version.ts`, `CHANGELOG.md`, release v1.0.1 |
| H5 deep checkup | run 2026-11-15, no red findings | issue #209 |

### 0B. Reality rows

| premise | claim | receipt | verdict |
|---|---|---|---|
| P1 | 71 built-in parts: 13 published, 57 unverified, 1 measured | [measured: `bun -e` over `BUILT_IN`, 2026-11-16] | verified, unchanged since 2026-11-14 |
| P2 | 9 calibration figures are still `null` | [measured: `engine/data/measurements.ts:33-84`] | verified |
| P3 | The backlog lists train playback as open P2 | `generic-TODOS.md:195` at `6bb6799` (before this cleanup, as are the line numbers in P4 to P6); built in #273 to #277 and #293 | verified: stale |
| P4 | The backlog lists table fit (E8) and auto-complete (E10) as undecided | `generic-TODOS.md:79,81`; `app/src/tableModel.ts:1`, `engine/src/graph/fill.ts:1` | verified: stale |
| P5 | The backlog's IP entry says "to counsel, overdue" | `generic-TODOS.md:86`; the owner's typed answer of 2026-11-14 is in `2026-11-14-product-state-review.md` (ledger row E1-ORDER) | verified: the entry has not caught up |
| P6 | `App.tsx` is 2,518 lines; its backlog entry says 627 | [measured: `wc -l`]; `generic-TODOS.md:470` | verified: stale, and bigger than two days ago (2,360) |
| P7 | README does not mention the usage counter | [measured: `grep -i "counter\|analytics\|privacy" README.md`, no match] | verified |
| P8 | The counter script sends the page title, referrer, screen width and query string with each visit | `app/public/count.js:25-30` | verified (static read) |
| P9 | The app is not installable and does not work offline | [measured: no manifest or service worker in `app/public`, `app/index.html`, `app/src`] | verified |
| P10 | One layout is kept, plus one put aside | `app/src/storageKeys.ts:38,87` | verified |
| P11 | Dead exports named by the backlog and the checkup still exist | [measured: `git grep`: `nominalFinalHeading`, `bounds`, `VEHICLE`, `KNOWN_ABSENT`, `weldsTouching`, `adapterNote` each have one source hit, their own definition] | verified |
| P12 | Visits arrive and people reach "This works" | no receipt: the dashboard is not readable from here | unverified |
| P13 | The weekly checkup has run on its schedule | [measured: `gh run list --workflow checkup.yml`: push runs only; the first scheduled run is due 2026-11-16] | not yet |

unverified=1 (P12).

REALITY: premise-table finding 11 of 13 claims hold a receipt; P12 (usage) has none and P13 is not due until today docs/plan/2026-11-16-whats-next.md:50
REALITY: already-done finding train playback, table fit, auto-complete, ready layouts and box-can-build were listed open at 6bb6799 and are built docs/plan/TODOS-archive.md:240
REALITY: surface-check pass every command named here exists (`bun run version:check`, `bun run checkup`, `bun run calibration`, `/checkup`) package.json:17
REALITY: binding-decisions pass outreach shelved, no brand names, the legal-risk rule, the counter kept (D9, 2026-11-14) and a version named per plan are all honoured AGENTS.md:117
REALITY: numbers pass every count above is re-measured today and tagged docs/plan/2026-11-16-whats-next.md:50
REALITY: deferred-asks pass no linked issue docs/plan/2026-11-16-whats-next.md:3
REALITY: pr-count pass no ship-policy file, so the default holds: this review and the cleanup are one documents PR, each accepted item is its own PR, none stacked AGENTS.md:105

### Landscape

Not searched again: the review of 2026-11-14 searched and found no live web
tool that answers "will this loop close" (its P9), and two days do not change
that. Its first-principles reading still holds: the gap was that the tool
could not be found, and E1 has since shipped.

### 0C. Dream state

```
  CURRENT STATE                     THIS REVIEW                      12-MONTH IDEAL
  Every accepted addition built.    A backlog that is true; the      A parent on the floor, phone
  A phone edits. Versions count.    owner's four jobs named; a  -->  in hand, gets a true answer
  57 of 71 pieces unverified.  -->  decision on each offered         for the track they own, with
  9 floor readings open. One        addition.                        or without a signal, and a fix
  known user. Usage unread.                                          when the loop does not close.
```

## The backlog, entry by entry (the cleanup)

Nothing is cut. Finished and superseded entries move word for word to
`docs/plan/TODOS-archive.md`; open entries keep their decisions and get
today's facts. "Rewrite" means the old body goes to the archive and a short
current entry replaces it.

| Entry (`generic-TODOS.md`) | Disposition | Why |
|---|---|---|
| Header ("renamed from ChooChooCAD") | fix | garbled by an old find-and-replace |
| P2 The ramp measures 225mm | keep, owner | waits on one re-measure |
| P2 Community custom-part registry | rewrite | superseded by the community-pieces plan; what is left is that plan's five unbuilt tasks (2026-11-14 review, H10) |
| Recorded, not yet decided (E7 to E10) | rewrite | E8 table fit is built; E10's auto-complete is built for one gap; E7 kid mode, E9 photo inventory and mirror stay as ideas |
| P1 IP: provenance and naming | per D1 below | the owner said on 2026-11-14 there is no issue with the part IP |
| P2 Inventory | rewrite | ready layouts and box-can-build are built; left: a copyable buy list, "These are mine", an owned-only filter |
| P2 Animated train playback | archive | built (#273 to #277, #293) |
| P2 Nudge-to-fit | keep, updated | Finish the loop covers one gap from the box; swapping a piece and several gaps are still open |
| P2 Launch operations and the corpus | rewrite | CI and the counter exist; left: a fuzz harness with a logged seed, and the physical corpus (owner) |
| Accepted residual risks (2026-10-07) | archive | 1 closed; 3 scrapped with the backend; 4 answered by repair and Finish the loop; 5 bounded by the canvas ceiling and work budgets; 2 lives on in the calibration entry |
| P2 Failure replay and solver inspector | keep, P3 | the crash report and layout files cover most of it; no trigger yet |
| P2 A third layer | keep | trigger unchanged: the first layout that needs a bridge over a bridge |
| P2 Calibration readings (umbrella) | rewrite, owner | one short entry pointing at the sheet's "Still open" list; the history goes to the archive |
| P3 Finish splitting App.tsx | keep, updated | 2,518 lines; the palette is out (#275); persistence and the panels are not |
| P2 Measure a real switch | fold into calibration | it is one of the sheet's readings |
| P2 The review backlog (A to F) | rewrite | each item re-checked against the tree in the cleanup; fixed ones archived, the rest listed plainly |
| P3 Canvas virtualisation and a size cap | keep, trimmed | the freeze is bounded; left: a load cap, the `maxLayers` memo, virtualisation |
| DONE CYCLE_RANK_CEILING | archive | done 2026-10-15 |
| P2 `dimensions.status` is self-asserted | keep | blocks only a sharing backend, which is scrapped; note that the contributor link already validates untrusted parts |
| P2 E1's centreline is derived | keep | still no provenance flag ([measured: no match in `engine`, `app`]) |
| P3 The track profile's copies | keep | absorbs the review backlog's item A |
| P3 Test-quality items after K2 | keep, re-checked | `toBeDefined()` is still in `engine/test/analytic.test.ts` |
| P3 The cursor ring shrinks | re-check, then archive or keep | end marks got a screen-size floor in #278; the cleanup confirms whether the cursor ring is under it |
| P2 Raised track is held up | fold into calibration | built; waits on F4 alone |
| DONE version list; DONE catalogue sizes | archive | done |
| P2 Wire the approved analytics | archive | built and kept (D9); left: the owner reads the dashboard (T7); README says nothing about it (W3, not chosen this round) |
| P3 Richer 3D pieces | keep | the track itself is still plain |
| SHELVED (seven entries) | keep as one short section | shelved by the owner; bodies to the archive |
| P3 Paint the printed pieces | keep | unchanged |
| Repo checkups: decide after four runs | keep | 0 scheduled runs yet |
| Contributor brief: other LLMs | keep | unchanged |
| Parked: move to an organisation | keep | parked by the owner |
| Phone editor: deferred | keep, updated | the verdict fold and the 3D how-to are done; the joint tap area and the real-phone pass are open |
| (new) Checkup leftovers, 2026-11-15 | add | Actions pinned by tag, not commit; six exports nothing calls, in five files; the crash screen's key list covers 5 of 10 keys. Not chosen and filed apart: the README counter section, a linter, the remote branch `photo-guide-2x` |
| (new) Train, not yet looked at | add | on a real phone; wagons on a ramp or bridge; a three-way switch |
| (new) Choices the agent made that the owner has not confirmed | add | the 100px strip row (the plan said 52px); "Next end" stepping the chosen end while joining; the put-aside notice living in More on a phone; Clear leaving an older put-aside layout alone; the verdict fold starting whole |

## What is left (current scope, ordered)

**Only the owner can do these, and they outrank everything an agent can
build.** They were H1, H2 and H6 two days ago and are still open.

| # | Job | Time | Why first |
|---|---|---|---|
| O1 | Read the usage dashboard: do visits arrive, does anyone reach "This works", what share is phones | ~10 min | every priority below is a guess until this is read; it also says whether the phone editor has an audience |
| O2 | The floor afternoon: F4 (turns the supports check on), the ramp run, Q2 bend, the switch, F2, plank thickness, and the seven structures' heights | one afternoon | the only work that makes a verdict physically true |
| O3 | The real-phone pass (plan task T12): Escape and focus in the sheets, the keyboard over a field, a screen reader, a second browser, the train | ~1 h | the phone editor has only ever been seen in a headless browser |
| O4 | Confirm or change the agent's five unconfirmed choices (listed in the backlog) | ~10 min | they shipped on a guess |

**An agent can do these. Each is backlog work, already in scope.**

| # | Work | Effort | Version |
|---|---|---|---|
| W1 | Hardening: the review backlog's open items in groups C, D and E (an id bound on load, a decimal comma in Add a part, the notice's place on a wide screen, the inventory field's 44px, the inventory row's clipped refusal message, the editor's missing `<h1>`, two loosely pinned tests) | human ~2 d / CC ~3 h | patch |
| W2 | Checkup leftovers: Actions pinned to commits; the six dead exports removed; the crash screen's key list made whole | human ~1 d / CC ~1 h | patch |
| W3 | Say what the counter sends: a short section in README matching `count.js` (the app itself has no page that mentions the counter) | human ~2 h / CC ~15 min | patch |
| W4 | The joint's tap area on a phone | human ~1 d / CC ~1 h | patch; needs one decision first (which wins, the joint or the piece under it) |
| W5 | Finish splitting `App.tsx` (persistence, then the panels) | human ~1 week / CC ~3 h | patch; changes nothing a person sees |

**Hold-scope checks.** Complexity: this review writes no code. Minimum change:
O1 and O2 would move the product more than any item an agent can build.
Invariants: "never shown as a pass" and "says when an answer rests on an
unmeasured size" hold; the one place they were loosened is the phone's
verdict fold, by the owner's word on 2026-11-15, recorded in DESIGN.md rule 14.

## Offered additions (each decided separately)

| # | Addition | What a person gets | Effort | Risk |
|---|---|---|---|---|
| A1 | Works offline, installs to the home screen | open the app on the floor with no signal; an icon on the phone | human ~1 week / CC ~3 h | medium: a cached app must still pick up each new version |
| A2 | Several saved layouts | "My layouts": name, keep and reopen more than one, where today there is one and one put aside | human ~1 week / CC ~3 h | medium: more to store, and a full store must still be said |
| A3 | A buy list and "These are mine" | copy the list of pieces a layout is short of; one tap sets your box to what is on screen | human ~3 d / CC ~1.5 h | low |
| A4 | Kid mode | a locked layout with big controls: run the train, nothing else | human ~3 d / CC ~2 h | low |
| A5 | Suggest a swap when a loop misses | "swap this curve for that one", beyond filling one gap | human ~2 weeks / CC ~1 day | medium: every suggestion must be re-checked before it shows |

Offered on request, not in this round: mirror a layout, a third layer, the
failure inspector, photo inventory, richer 3D track.

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| MODE, owner | Review posture | none | SELECTIVE EXPANSION | approved | the ask's own words, "see what else we can implement"; mode only, approves no change |
| IP, owner | The backlog's P1 IP entry and README's "Licence" section. P5 | backlog: "to counsel, overdue"; README: the question "is open" | archive the entry; README says the owner considers the use to raise no issue | approved | D1 answer "Close and reword README" (2026-11-16); scope: the backlog entry archived with the owner's statement, and README's one paragraph reworded; the take-down offer, the font and trademark paragraphs untouched |
| NEXT, owner | Which backlog work an agent builds next (W1 to W5) | none chosen | W1 hardening and W2 checkup leftovers | approved | D2 answer "Hardening, Checkup leftovers" (2026-11-16); scope: those two, one pull request each, exactly as the question described them (W2: Actions pinned to commits, the dead exports removed, the crash screen's key list made whole); W3, W4 and W5 were offered and not chosen and stay in the backlog |
| A1, owner | Offline and install. P9 | neither | add | deferred | D3 answer "Defer to TODOS.md" (2026-11-16), against the recommendation to add |
| A2, owner | Several saved layouts. P10 | one, plus one put aside | add | approved | D4 answer "Add to scope" (2026-11-16); scope: name, keep and reopen several layouts in the browser; no accounts, no sync, no change to the layout format; whether and how a layout is removed or renamed is for its design pass (T5), which the owner approves |
| A3, owner | Buy list and "These are mine". `TODOS-archive.md`, the 2026-11-05 inventory list | the box counts and shows a shortfall | add | approved | D5 answer "Add to scope" (2026-11-16); scope: copy the shortfall as text, and one tap that raises the box to the layout on screen; the shortfall includes adapters, as the app already counts it (O5); no shops, links or sets |
| A4, owner | Kid mode | none | defer | deferred | D6 answer "Defer to TODOS.md" (2026-11-16) |
| A5, owner | Swap suggestions (the rest of nudge-to-fit) | one gap filled from the box | defer | deferred | D7 answer "Defer to TODOS.md" (2026-11-16) |

Approval readiness: PASS (MODE; IP at D1; NEXT at D2; A1 at D3; A2 at D4; A3 at D5; A4 at D6; A5 at D7). Each is applied only within its answer's scope. Nothing below is approved beyond these rows; the outside review's findings (O1 to O6, in "Outside voice") changed facts and wording, not scope.

## 0I. The first hours of building this (sequence and blockers)

```
  HOUR 1 (foundations)   This documents PR (1.0.2). The builder needs: AGENTS.md's version rule
                         and no-brand rule, CLAUDE.md's mutation rule, and that every merge deploys.
  HOUR 2-4 (core)        W1 hardening (1.0.3), then W2 checkup leftovers (1.0.4). Ambiguity in W1:
                         a stored layout that breaks a new bound must be kept in the rescue copy,
                         never silently dropped. In W2: which of five stored keys a crash report
                         carries is a small decision of its own.
  HOUR 5-6 (integration) A3 buy list and "These are mine" (1.1.0). Surprise: "These are mine"
                         raises counts and never lowers them, or one tap empties a counted box.
  HOUR 7+ (design first) A2 several saved layouts (1.2.0). Blocked on a design pass (a new list on
                         two screens) and an engineering pass on storage. Not started before both.
```

Human team: about three weeks. CC + gstack: about nine hours of agent work,
plus the two review passes for A2.

## Review sections (strategy depth: capability rows, not method contracts)

**Current scope.** Mode SELECTIVE EXPANSION (the ask's own words). Accepted:
the cleanup and README wording (IP, D1), W1 and W2 (NEXT, D2), A2 (D4), A3
(D5). Deferred to the backlog: A1 (D3), A4 (D6), A5 (D7). Not chosen and
still in the backlog: W3, W4, W5. Pending: none.

### Section 1: Architecture

```
  THE APP (static, no server)                       WHAT THIS PLAN TOUCHES
  ┌───────────────────────────────────────────┐
  │ engine/  exact geometry, solve, route      │   W2: dead exports out (fk.ts, generic.ts,
  │   (no storage, no DOM)                     │       sources.ts, edit.ts; VerdictLine.tsx)
  ├───────────────────────────────────────────┤
  │ app/src/layoutStore.ts  load ─ validate ─  │   W1: bounds on what a stored layout may hold
  │   save; rescue copy; put-aside             │   A2: NEW a list of named layouts beside the
  │ app/src/storageKeys.ts  one owner per key  │       one current layout (a new key)
  ├───────────────────────────────────────────┤
  │ app/src/App.tsx (2,518 lines)              │   A3: two controls in Your box
  │   Inventory, SubmitPart, panels            │   W1: Add a part's refusal message; CSS
  │   PhoneShell (same state, other layout)    │   A2: the list, on both screens
  ├───────────────────────────────────────────┤
  │ ErrorBoundary  crash report, "clear"       │   W2: which keys it carries and clears
  │ .github/workflows  ci, pages, checkup      │   W2: Actions pinned to commits
  └───────────────────────────────────────────┘
```

- **OK** Nothing here adds a server, an account or a network call. The four
  accepted items stay inside the existing boundaries.
- **WARNING (A2), coupling.** Every stored key has one owner and four readers
  that must agree: the loader, the saver, the stale-tab notice and the crash
  screen. A2 adds a key that all four must know. The implementation owner
  must prove: what a crash-screen "clear" does to the list is decided by
  the owner in T5, and then pinned; another tab adding a layout does not
  lose this tab's; the existing put-aside layout is never lost and its key
  stays readable by the version before. How put-aside relates to the list is
  T5's to design.
- **WARNING, the file every item touches.** A3 and A2 both add wiring to
  `App.tsx`, which grew 158 lines in two days. Splitting it (W5) was offered
  and not chosen. A2's engineering pass should say whether its list lives in
  its own module from the start.
- **Scaling.** Browser storage is about 5MB per origin. One layout of 500
  pieces is about 15KB by the backlog's own figures (3.72M characters for
  120,000 pieces), so hundreds of layouts fit; the bound that matters is a
  clear message when the store is full, which exists for one layout today.
- **Rollback.** Every item is a static deploy: revert the merge and the next
  deploy is the old app, in about four minutes. A2 is the exception in
  kind: once people have saved several layouts, a rollback must not strand
  them, so the new key is only ever added, and the old single-layout key
  keeps working.
- **Value test for this plan's own artifacts.** The cleaned backlog is read
  by every agent that plans next (AGENTS.md); this review file is the record
  of seven decisions. Neither is a report nobody consumes.

### Section 2: Error and rescue map

| Capability | What can go wrong | Known safeguard | User sees | Owner must prove |
|---|---|---|---|---|
| W1 load bounds | a stored layout breaks the new id bound | the rescue copy and its notice exist (`layoutStore.ts`, `GRAPH_RESCUE_KEY`) | "could not be read", with a download | the bound accepts every id the app can have written, so nothing that loads today is refused; no piece-count cap is added (O1) |
| W1 decimal comma | `12,5` typed in Add a part | none: a greyed button | nothing ← GAP today | either the comma is read as a decimal, or a sentence says why not |
| W2 crash keys | a crash report lacks the box or the table | 5 of 10 keys carried | a report missing data | the list is decided key by key, and a test pins it |
| W2 pinned Actions | a pinned commit goes stale | Dependabot updates Actions monthly (`.github/dependabot.yml`) | nothing | each pin keeps its version in a comment beside it, the form Dependabot updates; checked at its next monthly run |
| A3 buy list | the clipboard is refused | Share already handles a refused copy | must not be silent | the same fallback Share uses, said in words |
| A3 both controls | the layout is short of adapters only | the adapter shortfall is worked out apart from the pieces (`inventoryModel.ts:38`) | an empty list for a layout that cannot be built ← must not happen | adapters are in the copied list and in "These are mine"; an adapter-only test (O5) |
| A3 "These are mine" | it lowers a count the owner entered | none yet | a counted box emptied ← must not happen | it only raises, says what it raised, and can be put back in one step; a test |
| A2 saved layouts | the store is full on save | a failed save is never hidden (rule 14) | the existing failed-save notice | the list's save uses the same notice, on both screens |
| A2 saved layouts | two tabs change the list | "changed in another tab" exists for one layout | must not lose a layout | a storage design in which two tabs that both read before either writes cannot lose an entry, and a test that interleaves them (O2) |
| A2 saved layouts | a stored list is damaged | the loader validates one layout | must not crash on every load | each entry validated alone; one bad entry does not hide the rest |

GAPS today: 1 (the decimal comma, which W1 fixes). No row is silent after the
accepted work, provided each "owner must prove" is met.

### Section 3: Security and threat model

- **OK, no new surface.** No endpoint, secret or dependency is added. The
  counter is unchanged.
- **W1 narrows an existing one.** A stored or shared layout is attacker-
  chosen text. Unbounded ids were what made the old crash-report injection
  reachable (archived review backlog, D). Likelihood low, impact low to
  medium (the reader's own machine); W1 mitigates.
- **A2, new stored text: layout names.** A name is user text shown in a
  list and possibly in a file name. Likelihood low, impact low. Owner must
  prove: a name is length-bounded, rendered as text only, and never used
  unescaped in a downloaded file's name or a crash report (the crash report
  already had one injection through a stored id).
- **A3, the copied list** carries part names only. It must name no brand
  (AGENTS.md) and nothing about the person.
- **README, honesty.** README says nothing about the counter (P7) while the
  script sends more than action names (P8). Not a vulnerability; it is the
  one place the project claims less than it does. The fix is W3, offered
  and not chosen; it is in the backlog, part 3.
- **W2, pinning Actions to commits** closes the audit's one finding (a
  moved tag running in a job that can now also write releases).

High severity: none.

### Section 4: Data flow and interaction edge cases

```
  A2   name + layout ─▶ validate (name bound, layout as today) ─▶ list entry ─▶ storage ─▶ list
          │ empty name        │ a damaged entry                    │ store full   │ other tab
          ▼                   ▼                                    ▼              ▼
       a default name      that entry refused, the rest shown   said, never    reread, never
       (decide in design)  and the bad one offered as a file    silent         overwrite blind

  A3   layout on screen ─▶ shortfall (exists) ─▶ text ─▶ clipboard
          │ empty floor       │ nothing short       │ clipboard refused
          ▼                   ▼                     ▼
       no button           no button            the Share fallback
```

| Interaction | Edge case | Handled today? | Must be |
|---|---|---|---|
| A2 open a saved layout | the current layout has unsaved changes | n/a | kept: opening never discards without saying, as Clear does now |
| A2 a reopened layout is edited | do the edits change the saved entry? | n/a | a question T5 must answer; whichever it is, it is said on screen |
| A2 open a saved layout | a shared link is on screen | n/a | the link stays read-only; "Open in editor" is the only way in (rule 13) |
| A2 removing a layout, if T5 adds it | a mistaken tap | n/a | undoable or confirmed; decided in the design pass |
| A2 the list | zero, one, fifty entries | n/a | an empty state that says what the list is for; fifty scroll |
| A3 "These are mine" | tapped twice | n/a | the second tap changes nothing |
| A3 copy | the layout changes while the panel is open | the shortfall is live | the text is built at the tap |
| W1 Add a part | `12,5`, `12.5.1`, a pasted space | no message | a sentence, or the comma accepted |

Async ordering: only A2 has it (two tabs). The invariant: no saved layout is
lost by another tab's write, including when both tabs read the list before
either writes. Running the tabs in turn does not prove it; the test must
interleave their reads and writes (Section 2, O2).
Unhandled today: none in accepted work; all rows above are requirements on
the builder.

### Section 5: Code quality

- **WARNING** `App.tsx` at 2,518 lines is the place A2 and A3 will land
  unless their passes say otherwise (Section 1).
- **OK** W2 removes code. W1's checks belong in the loader that already
  owns validation, not in callers.
- **Duplication to avoid.** A2 must reuse the put-aside machinery
  (`app/src/putAside.ts`), which already keeps a second layout, says so and
  offers it back. Two mechanisms that each keep "another layout" would be
  the duplicated behaviour this project has shipped before. How they join
  is T5's to design; the invariant is in Section 1.

### Section 6: Tests

```
  NEW THING                         TEST KIND            THE CASE THAT MATTERS
  W1 a bound on a stored layout     node, loader         a layout that loads today still loads;
                                                         one that breaks the bound is rescued
  W1 decimal comma                  dom                  typing 12,5 gives a result or a sentence
  W1 notice placement, 44px field   stylesheet as text   (blunt, per CLAUDE.md) plus one browser look
  W2 crash key list                 node                 every key in storageKeys.ts is either
                                                         carried or named as left out
  W2 dead exports                   typecheck + suite    nothing imports them
  W2 pinned Actions                 workflow as text     every `uses:` is a 40-character commit
  A3 "These are mine"               node (model) + dom   raises, never lowers; twice is once;
                                                         adapters included, adapter-only case
  A3 copy                           dom                  the text; the refused-clipboard path
  A2 list                           node (store) + dom   add, reopen, full store, damaged entry,
                                                         two tabs interleaved, put-aside never
                                                         lost; the rest as T5 decides
```

Every pin records the mutation that fails it, and the mutation is run
(CLAUDE.md). `no_claim` for all of the above: a real phone, a real full
browser store, and two real tabs; jsdom stands in for each.

- The 2am test: A2's "a layout saved yesterday opens today after this
  deploy", run against a stored blob written by the previous version.
- The hostile test: a stored list with one enormous name and one damaged
  entry.
- Flakiness: W1 removes a wall-clock assertion (`cycles.test.ts:192`); none
  is added.

Gaps: 0 in the plan; each row is a requirement on its pull request.

### Section 7: Performance

- **OK** No hot path changes. A2 reads a list once at start; the owner must
  prove it does not parse every saved layout on every edit (the current
  layout is saved per edit: 25ms at 120,000 pieces by the archived
  measurement, far less at real sizes).
- The first-load budget is 169.66 kB of 171.90 kB [measured 2026-11-15].
  **WARNING:** A2's list and A3's controls have about 2 kB of room. A2 should
  load its list screen lazily, as the phone shell does. A3 lands first, in
  a panel that is on the first-load path: if it does not fit, its pull
  request stops and the budget is re-measured only on the owner's word, as
  every earlier re-measure was.

### Section 8: Observability

- The counter's ten action names are fixed (`ACTIONS`,
  `app/src/linkFragment.ts`). Nothing in this plan adds one. Whether A2 or
  A3 should send an action ("saved-layout", "these-are-mine") is a small
  decision for their own pull requests, because the list is a privacy
  promise; default: add none.
- A crash report now carries the version. W2 makes it carry the keys it
  should.
- **Gap, the owner's:** the dashboard has never been read (O1). Nothing an
  agent builds closes that.

### Section 9: Deployment and rollout

- Every merge deploys, is tagged and released (v1.0.1 is live). No flags
  exist and none is needed for W1, W2 or A3.
- **A2 is the one with a deploy-time window:** a tab open on the old version
  and a tab on the new one share storage. The new key must be ignorable by
  the old code, and the old key must stay the truth for the current layout.
- Post-deploy check for each: the live file carries the change, the release
  appears, and for A2 a layout saved before the deploy opens after it.
- Rollback: revert and redeploy (about four minutes); for A2, see Section 1.

### Section 10: Long-term trajectory

- **Debt removed:** W2 (dead code, unpinned Actions), W1 (loose bounds), the
  backlog itself. **Debt added:** A2 is a second persistence surface; A3 is
  small.
- **Reversibility:** W1, W2, A3: 5 of 5. A2: 3 of 5, because saved layouts
  are people's data once it ships. This plan as a whole: 4 of 5.
- **After this:** with several saved layouts, "offline" (A1) becomes more
  valuable, not less, and the two share the hard question of versions. The
  owner deferred A1 against this review's recommendation; the order still
  works, because the dashboard's phone share is the evidence A1 was missing.
- **Were the right picks accepted?** A2 and A3 serve a returning user, and
  nobody has measured whether anyone returns (P12). They are cheap enough to
  build on judgement; A1 and A5 wait for evidence, by the owner's choice.
  The work with the most value is still not an agent's: O1 and O2.

### Section 11: Design and UX (A2 and A3 change the UI)

```
  A3  Your box ─▶ [These are mine]  ─▶ counts rise, said in words
                └▶ shortfall line ─▶ [Copy the list] ─▶ "Copied."
  A2  More / palette ─▶ My layouts ─▶ (empty: what this is for)
                                   ├▶ a row per layout: name, pieces, when ─▶ open
                                   └▶ [Keep this layout] ─▶ name it ─▶ in the list
```

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| A3 copy | n/a | no shortfall: no button | clipboard refused: the Share fallback | "Copied." | n/a |
| A3 These are mine | n/a | empty floor: no button | n/a | counts rise, announced | already owned: says so |
| A2 list | n/a | says what it is for | a damaged entry named, the rest shown | opens the layout | a full store, said |

- **DESIGN.md binds both:** colour only on verdicts (1), no direction words
  (7), 44px targets (10), a shared link read-only (13), a phone edits on one
  screen (14: the list is a panel, full screen, with its name and Done).
- **WARNING** The owner asked on 2026-11-05 for Your box to stay a plain
  list of counts. A3 adds two controls to it; they must read as part of the
  list, not a toolbar.
- **A2 needs `/plan-design-review` before code:** where the list lives on
  the wide editor, what a row shows, how a layout is named, and what happens
  to "put aside". A3 does not: Your box is one component, drawn in the
  palette on a wide screen and as a full-screen panel on a phone, so both
  controls go in it once and follow its existing rows.

## Spec review (0H)

One reviewer, two passes, on this plan and its scope summary together. Pass
one: 7 of 10, 26 points, nearly all places where the plan disagreed with
itself or with the backlog, and one real scope error (the README counter
section had been slipped into the checkup work though the owner did not
choose it). All 26 applied. Pass two: 9 of 10, the 26 confirmed fixed, 4 new
small points; those 4 were then applied and checked by hand against the text
(issues verified: 4 of 4), with no third pass.

## Outside voice

Codex (model gpt-6-astra, read-only, 2026-11-16) reviewed this plan and the
cleaned backlog against the repository. Six findings; each was checked
against the code and all six hold. None changes an approved scope: they
correct facts and sharpen what the builder must prove.

| # | Severity | Finding | Checked | Disposition |
|---|---|---|---|---|
| O1 | High | W1 promised both a new load cap and that everything loading today still loads; a file import already refuses more than 500 pieces (`app/src/layoutFile.ts:63`), so a rescue download does not help | true | W1 adds an id bound that accepts every id the app can have written, and no piece-count cap; the cap stays with the canvas entry as a breaking change to decide |
| O2 | High | "A saves then B, B then A" tests the tabs in turn; the lost write is both reading before either writes | true | A2's requirement is now a storage design that makes it impossible and an interleaved test |
| O3 | Medium | The cleanup dropped two open items: the editor's missing `<h1>` (`app/src/AppName.tsx:14`; the one in `index.html` is inside `noscript`) and the copied joint-give constants | true | `<h1>` added to Hardening; the constants added to the profile-copies entry |
| O4 | Medium | W1 listed two fixes that are done: welds keep only their two fields (`layoutStore.ts:458`), and the ready layouts' tests take the app's path (`presets.test.ts:8`) | true | both removed from Hardening and named as fixed |
| O5 | Medium | A3 left out adapters, which are counted apart from pieces (`inventoryModel.ts:38`) | true | both controls must include adapters, with an adapter-only test |
| O6 | Medium | The cleanup made the library audit and palette regroup wait for an outside contributor; the owner asked for them outright on 2026-11-08 | true | split into its own P2 entry with no such dependency |

## Required outputs

REALITY lines: as in "0B. Reality rows" above (seven rows).

### NOT in scope

Deferred (each is in the backlog, part 3):

- **A1, offline and install** (D3, "Defer"): wait for the dashboard's phone
  share and the real-phone pass.
- **A4, kid mode** (D6, "Defer"): decide after the train has been watched on
  a real phone.
- **A5, swap suggestions** (D7, "Defer"): see first where Finish the loop
  leaves people stuck.
- **W3, the README section on what the counter sends**, **W4, the joint's
  tap area** and **W5, splitting `App.tsx`** (D2, offered and not chosen):
  stay in the backlog. With W3 are two more checkup items nobody chose: a
  linter in CI, and deleting the remote branch `photo-guide-2x`.
- **A piece-count cap on load** (outside finding O1): a breaking change, not
  part of W1.
- **The library review and palette regroup** (O6): back in the backlog as
  its own P2; not offered in this round's questions.

Rejected: nothing.

### What already exists

| Sub-problem | Existing code | Reused? |
|---|---|---|
| Keep a second layout and offer it back | `app/src/putAside.ts`, `PutAsideNotice` | A2 must build on it, not beside it |
| Say when a save failed | the unsaved notice, on both screens | A2 reuses it |
| The shortfall, pieces and adapters | `app/src/inventoryModel.ts`, `app/src/canBuild.ts` | A3 turns it into text and counts |
| Copy with a fallback | the Share control | A3 reuses it |
| Refuse a damaged layout and keep a copy | `layoutStore.ts`, `GRAPH_RESCUE_KEY` | W1 extends it |
| Read a workflow as text in a test | `engine/tools/checkupWorkflow.test.ts`, `version.test.ts` | W2's pin check |

### Dream state delta

This plan does not move the two things furthest from the ideal: 57 of 71
pieces unverified, and usage never read. It leaves the app tidier and safer
(W1, W2), quicker to start with (A3) and kinder to someone who comes back
(A2), and it leaves an honest queue. "With or without a signal" (A1) and "a
fix when the loop does not close" beyond one gap (A5) are still ahead, by
the owner's choice, until there is evidence.

### Failure modes registry

| Capability | Failure mode | Rescued? | Test? | User sees | Logged? |
|---|---|---|---|---|---|
| W1 id bound | a hostile stored id | yes: rescue copy | required | a notice and a download | no (static app) |
| W1 decimal comma | `12,5` refused | after W1 | required | a sentence, or it works | no |
| W2 crash keys | a report missing stored data | after W2 | required | n/a | the report itself |
| A3 copy | clipboard refused | required | required | the Share fallback | no |
| A3 adapters | adapter-only shortfall left out | required | required | the adapters, listed | no |
| A3 These are mine | a count lowered | prevented by design | required | counts only rise | no |
| A2 save | store full | required: the existing notice | required | "could not be saved" | no |
| A2 two tabs | a lost entry | required: by storage design | required, interleaved | nothing lost | no |
| A2 damaged entry | the list fails to load | required: per entry | required | the bad entry named | no |

9 rows. CRITICAL GAPS (not rescued, not tested and silent): 0, given each
"required" is met by its pull request. "Logged" is no throughout: a static
app has no log, and the counter carries no errors by design.

### Scope expansion decisions

- **Accepted:** A2 several saved layouts (D4); A3 buy list and "These are
  mine" (D5).
- **Deferred:** A1 offline and install (D3); A4 kid mode (D6); A5 swap
  suggestions (D7).
- **Skipped:** none.

### Diagrams

Produced: system architecture (Section 1), data flow with shadow paths
(Section 4), user flow (Section 11), the build sequence (0I). State machine:
none new at this depth; A2's (saved, current, put aside) belongs to its
engineering pass. Deployment and rollback are one step each (merge deploys;
revert redeploys) and are said in prose in Sections 1 and 9.

### Stale diagram audit

This pull request touches no file that holds a diagram other than this one.
`docs/plan/generic-TODOS.md` and `TODOS-archive.md` hold none that changed.

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship. Versions
assume this order and nothing merged in between.

- [x] **T1 (P1, human: ~1 h / CC: done in this PR)** — docs — Land this review, the cleaned backlog and README's licence wording (1.0.1 to 1.0.2)
  - Surfaced by: the ask; ledger rows IP (D1) and the cleanup table
  - Files: `docs/plan/2026-11-16-whats-next.md`, `docs/plan/generic-TODOS.md`, `docs/plan/TODOS-archive.md`, `README.md`, `CHANGELOG.md`, `package.json`
  - Verify: `bun run version:check --base origin/main`; `bun run checkup --content`; every old heading is in one of the two backlog files
- [x] **T2 (P2, human: ~2 d / CC: ~3 h)** — app — Hardening (1.0.2 to 1.0.3)
  - Surfaced by: NEXT (D2); Sections 2, 3, 6; outside findings O1, O3, O4
  - Files: `app/src/layoutStore.ts`, `app/src/SubmitPart.tsx`, `app/src/app.css`, `app/src/AppName.tsx`, `engine/test/graphFeasible.test.ts`, `engine/test/cycles.test.ts`
  - Verify: the pull request lists every place a piece id can come from (the reducer's own ids, old stored spellings, a contributor link, a layout file; and Add a part, if a part's id can reach a piece's id, which the pull request must say either way) and tests one id from each against the bound; a stored blob from 1.0.2 still loads; a hostile id lands in the rescue copy; `12,5` gives a result or a sentence; the inventory row's message checked in a browser; each pin's mutation run
- [x] **T3 (P2, human: ~1 d / CC: ~1 h)** — repo — Checkup leftovers (1.0.3 to 1.0.4)
  - Surfaced by: NEXT (D2); Section 3; the deep checkup of 2026-11-15
  - Files: `.github/workflows/*.yml`, `engine/src/geom/fk.ts`, `engine/data/generic.ts`, `engine/data/sources.ts`, `engine/src/graph/edit.ts`, `app/src/VerdictLine.tsx`, `app/src/ErrorBoundary.tsx`
  - Verify: a text test that every `uses:` is a 40-character commit with its version in a comment; typecheck and the suite with the six exports gone; the owner's answer on which of the five uncarried keys a crash report holds and "clear" removes, then a test naming every key in `storageKeys.ts`
- [x] **T4 (P2, human: ~3 d / CC: ~1.5 h)** — app — A buy list and "These are mine" (1.0.4 to 1.1.0)
  - Surfaced by: A3 (D5); Sections 2, 4, 11; outside finding O5
  - Files: `app/src/Inventory.tsx`, `app/src/inventoryModel.ts`
  - Verify: counts only rise, the change is said and can be put back in one step; twice is once; adapters in both; the refused-clipboard path; the first-load budget holds; looked at on both screens
- [x] **T5 (P1 for T6, human: ~1 d / CC: ~1 h)** — design and engineering — Review A2 before any code (a documents pull request, 1.1.0 to 1.1.1)
  - Surfaced by: A2 (D4); Sections 1, 2, 4, 9, 11; outside finding O2
  - Files: a plan under `docs/plan/`; no code
  - Verify: the plan answers, with the owner's word on each: where the list lives on both screens; what a row shows; how a layout is named, and whether it can be renamed, share a name or be removed; whether edits to a reopened layout change its entry; whether the box and the table belong to a layout or to the browser (today: the browser); what happens to put-aside; what the crash screen's "clear" removes; how many layouts fit and what a full store says. And the storage design: no shared record that two tabs can overwrite (any index must be rebuildable from the per-layout keys), and a blob written by the version before still opens
- [ ] **T6 (P2, human: ~1 week / CC: ~3 h)** — app — Several saved layouts (1.1.1 to 1.2.0)
  - Surfaced by: A2 (D4)
  - Files: to be determined by T5
  - Verify: T5's list, each with its test; a layout saved before the deploy opens after it
- [ ] **T7 (P1, human: ~10 min / CC: n/a)** — owner — Read the usage dashboard
  - Surfaced by: reality row P12; Section 8
  - Files: none
  - Verify: three numbers written into the backlog: visits, "This works" events, phone share
- [ ] **T8 (P1, human: one afternoon / CC: n/a)** — owner — The floor afternoon, F4 first
  - Surfaced by: reality rows P1, P2
  - Files: `engine/data/measurements.ts`
  - Verify: `bun run calibration`; the verdict stops saying "supports are not checked"
- [ ] **T9 (P1, human: ~1 h / CC: n/a)** — owner — The real-phone pass
  - Surfaced by: the backlog, part 1; every phone change so far was seen headless only
  - Files: none
  - Verify: each item in the backlog entry tried on a real phone; findings filed
- [ ] **T10 (P2, human: ~10 min / CC: n/a)** — owner — Confirm or change the agent's five unconfirmed choices
  - Surfaced by: the "What is left" table, O4
  - Files: `docs/plan/generic-TODOS.md`
  - Verify: each of the five marked confirmed or changed in the backlog entry

The owner's tasks carry no version here: T7, T9 and T10 change no file an
agent has not been asked to change, and whatever pull request records their
result (or T8's readings) takes the next patch number when it lands.

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | backlog stale in 12 entries; all five       |
  |                      | additions of 2026-11-14 built               |
  | Step 0               | SELECTIVE; IP closed; W1+W2; A2+A3 accepted |
  | Section 1  (Arch)    | 2 issues found (A2 coupling, App.tsx)       |
  | Section 2  (Errors)  | 10 error paths mapped, 1 GAP (fixed by W1)  |
  | Section 3  (Security)| 2 issues found, 0 High severity             |
  | Section 4  (Data/UX) | 7 edge cases mapped, 0 unhandled            |
  | Section 5  (Quality) | 2 issues found                              |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 1 issue found (first-load budget)           |
  | Section 8  (Observ)  | 1 gap found (the unread dashboard)          |
  | Section 9  (Deploy)  | 1 risk flagged (A2, two versions, one store)|
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 1 (A2)      |
  | Section 11 (Design)  | 2 issues (the plain box; A2 needs a review) |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (10 items)                             |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 10 rows, 0 CRITICAL GAPS                    |
  | Failure modes        | 9 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | the whole file cleaned; 0 further proposed  |
  | Scope proposals      | 5 proposed, 2 accepted (EXP + SEL)          |
  | CEO plan             | written                                     |
  | Outside voice        | codex completed: 6 findings, 6 resolved     |
  | Lake Score           | N/A (no coverage-scored questions)          |
  | Diagrams produced    | 4 (architecture, data flow, user flow,      |
  |                      | build sequence)                             |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows (PLAN_REALITY), 1 unverified       |
  +====================================================================+
```

### Unresolved decisions

None. Every question asked was answered.

**Decisions that belong to later tasks, each with its decider.** These are
not open questions of this review; they are named so no builder settles
them alone.

- Which of the five stored keys a crash report carries and "clear" removes:
  the owner, in T3's pull request.
- Everything in T5's list for A2, including what "clear" does to saved
  layouts: the owner, in T5's plan.
- Whether A2 or A3 sends a counter action: default none; the owner, in each
  pull request, only if one is proposed.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 for this plan | CLEAR | 5 proposals, 2 accepted, 3 deferred |
| Outside Review | codex, plan-review phase of `/plan-ceo-review` | Independent 2nd opinion | 1 | completed | 6 findings; 6 resolved; 0 unresolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 for this plan | not run | none: W1, W2 and A3 are small; A2's engineering pass is task T5 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 for this plan | not run | none: A2's design pass is task T5 |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | not applicable |

- **OUTSIDE COVERAGE:** codex (gpt-6-astra), plan-review phase, completed; 6 findings, all checked against the code and applied.
- **CROSS-MODEL:** the native review and codex agreed on scope and order. Codex found what the native review missed: a load cap that contradicted "everything that loads today still loads", a two-tab test that could not see the real lost write, two open items dropped by the cleanup, two finished items still listed, adapters left out of A3, and a dependency invented for the library review.
- **VERDICT:** CEO CLEARED for the documents in this pull request and for W1, W2 and A3. A2 is not cleared to build: its design and engineering passes (T5) come first.

NO UNRESOLVED DECISIONS
