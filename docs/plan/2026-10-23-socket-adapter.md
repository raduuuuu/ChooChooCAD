# Allow socket-to-socket joints, flagged as needing an adapter

Owner request (2026-10-23): "let's allow female female connection and display a warning that this
connection requires an adapter". Reviewed with /plan-ceo-review.

## Problem

A joint where two sockets (female ends) meet is "Can't be built" everywhere today: the verdict,
the placing preview, auto-join, palette drops and run moves. Real builders join two sockets with a
double-peg ("male-male") adapter, sold commercially (e.g. Orbrium's adapter pack) and widely 3D
printed; no official BRIO part number was found. So layouts people can build read as impossible.

## System audit (evidence)

| Where the same-kind rule lives | file:line |
|---|---|
| The convention: every part records a peg end and a socket end | engine/src/parts/schema.ts:185-200 |
| Verdict: a same-kind weld is IMPOSSIBLE | engine/src/graph/feasible.ts:560 (`findWeldPolarityViolations`), app/src/verdictView.ts (`impossible`) |
| Verdict copy | app/src/VerdictLine.tsx:383-393 |
| Attaching at a cursor end: same-kind options removed, `refused` flag | app/src/layoutModel.ts:200-228 (`fitOptions`) |
| A landing end: `polarity` conflict | engine/src/graph/feasible.ts (`landingOf`) |
| Preview conflicts `here` / `polarity` | app/src/layoutModel.ts:262-264, 312-322 |
| Auto-join skips, moveRun refuses "two ends of the same kind would meet" | app/src/layoutModel.ts:410, 558 |
| Canvas marker on a refused joint | app/src/TrackCanvas.tsx:167, 1047; app/src/App.tsx:692-709 |

Physical facts (web, unverified against BRIO): peg 11.5 mm on a 7 mm neck, socket throat 5 mm
(woodenrailway.info track guide). The owner states male-male adapters exist that add no length
(R2), so a socket-to-socket joint is modelled as exact.

## Dream state

```
  CURRENT                         THIS PLAN                          12-MONTH IDEAL
  same-kind joint = IMPOSSIBLE -> socket+socket = buildable,    ->  every adapter kind is a part,
  everywhere                      marked, counted in Your box,      in a printable build list
                                  named in the list
```

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| R1 (owner) | Which same-kind joints become buildable | socket-socket only | B) both kinds (declined) | approved | Owner, 2026-10-23: "i want option 1" (socket-to-socket only). Peg-to-peg stays IMPOSSIBLE. |
| R2 (owner) | Adapter length in the geometry | zero: an exact joint, no caveat | model a length (declined) | approved | Owner, 2026-10-23: "without adding any length. there exists male male adapters that don't add any length". The warning must not claim a gap. |
| R4 (owner) | Give (slop) at an adapter joint: two peg-in-socket fits, where `weldGiveMm` (engine/src/graph/model.ts:239) assumes one | same as any joint | B) doubled (declined) | approved | Owner, 2026-10-23, D6: "A) Same as any joint". `weldGiveMm` is untouched, so no loop figure changes. Raised by the spec review. |
| X1 (owner) | Preview offers the socket-to-socket way round | last in the R/F cycle | defer / skip | approved | Owner, 2026-10-23, D3: "A) Add". |
| X2 (owner) | Count adapters in Your box | an adapters row + shortfall | defer (recommended) / skip | approved | Owner, 2026-10-23, D4: "A) Add", against the Defer recommendation. |
| OV1-OV4 (outside voice, Codex) | R reaches the adapter way; wording per connection; snap prefers among accepted moves; legacy disagreement documented | applied | n/a | approved | Corrections inside R1/X1/R3's accepted scope, no new behaviour: R1 ("i want option 1"), X1 (D3:A), R3 (D2:A). |
| X3 (owner) | Name adapter joints in the layout list | the joint row says so | defer / skip | approved | Owner, 2026-10-23, D5: "A) Add". |
| R3 (owner) | How loud: verdict tone for a layout that needs adapters | normal verdict + note + canvas mark | B) a separate amber verdict tier (declined) | approved | Owner, 2026-10-23, D2: "A) Note + mark". The verdict stays whatever it would be; a note counts the adapters; an amber mark sits on each joint; the preview and announcements say it. |

## Mode

SELECTIVE EXPANSION (owner, 2026-10-23, mode question). Approved decisions carried: R1, R2, R3, R4.

## Hold-scope checks

- Complexity: ~12 source files [estimated, see Accepted scope], over the 8-file bar; none can be dropped without the
  verdict and the placing paths disagreeing about the same joint.
- Minimum change: a third landing outcome, "joins with an adapter", beside joins and refused; the
  weld check splits peg-peg (IMPOSSIBLE) from socket-socket (adapter joints).
- Invariants: peg-peg stays IMPOSSIBLE; default placement still prefers alternation; adapter joints
  are exact, so closure figures do not change.

## Expansion candidates (decided)

| ID | Candidate | Effort | Risk | Status |
|---|---|---|---|---|
| X1 | Let the preview offer the socket-to-socket way round (R/F cycle), so an adapter can be chosen on purpose | S | low | ACCEPTED (D3:A): last in the cycle, the default stays alternation |
| X2 | Count adapters in "Your box": an owned count, and a shortfall when the layout needs more | M | low | ACCEPTED (D4:A, against the Defer recommendation): an adapters row; the loader must accept this one non-part key |
| X3 | Name adapter joints in the layout list ("joint 4: two sockets, needs an adapter") | S | low | ACCEPTED (D5:A) |

## Accepted scope

Everything below follows R1-R3 and X1-X3. A same-kind joint means one of two things from now on:

```
  two ends meet, facing, exactly
        |
        +-- peg + socket ------> joins                      (unchanged)
        +-- socket + socket ---> joins WITH AN ADAPTER      (new: buildable, flagged, exact, no length)
        +-- peg + peg ---------> refused / IMPOSSIBLE       (unchanged, R1)
```

1. **Engine.** One pass, `classifyWelds(graph, resolve, ports): { violations, adapters }`
   (eng review E1, D2:A), sorts every same-kind weld: peg-peg into `violations`, socket-socket
   into `adapters`. `findWeldPolarityViolations` (feasible.ts:560) becomes a wrapper returning
   `.violations`, so peg-peg only. The adapters list is `readonly AdapterJoint[]`, with
   `AdapterJoint = { weld: number; between: readonly [string, string] }`,
   lists every weld where two sockets meet. No position field: the canvas finds where to draw by
   weld index from `render.ports`, the same lookup `badJoints` uses (App.tsx:691-697). `GraphResult` gains `adapterJoints` on every branch,
   as it carries clashes and overlaps. Give at such a weld is unchanged (R4): `weldGiveMm` is not
   touched.
   `landingOf` (feasible.ts:186) keeps its order for pegs: peg on peg is still a `polarity`
   conflict whether or not it faces, so every peg-peg refusal keeps its wording
   ("two ends of the same kind would meet", layoutModel.ts:558; the preview's `polarity`
   conflict, :322). For SOCKET on socket it checks facing: facing is `{ kind: 'joins', with,
   adapter: true }`, not facing is a `facing` conflict. The `Landing` type's `joins` arm gains an
   optional `adapter?: true` (absent means a plain joint). Readers: `ghostFit` (sets `adapters`
   and keeps `joinsTo`), `autoJoin` and `moveRun` (join it like any `joins`); the drop guard
   needs no change, since an adapter landing is not a conflict. `autoJoin`,
   palette drops and `moveRun` join an adapter landing. `snapRunMove` (layoutModel.ts:608, its filter at :627) skips
   only peg-peg targets, so a dragged run snaps socket to socket too. Among candidate snaps
   within the radius that `moveRun` would ACCEPT (no conflict, no overlap), an alternating one
   beats an adapter one; if no alternating candidate is accepted, the nearest accepted adapter
   snap is used. A preference never turns a valid drop into a refusal (outside voice, finding 3).
   `autoJoin` and `moveRun` return an `adapters: number` beside `joined`, the count of joins they
   made that need one, for the announcements.
2. **Verdict (R3).** `impossible` (verdictView.ts:96) counts peg-peg violations only. Adapter
   joints never change the verdict kind. `VerdictView` gains `adapterCount: number` (0 in
   `EMPTY`), filled by `viewOf` on every branch, refusals included (they build from `EMPTY`,
   verdictView.ts:120). The note is exactly "Needs 1 male-male adapter: two sockets meet at 1
   joint." or "Needs N male-male adapters: two sockets meet at N joints." (N >= 2), and is passed into `notesFor` at every call site (VerdictLine.tsx:342, 381, 456, 467,
   518), so it shows on EXACT, NEEDS_GIVE, EXCEEDS, IMPOSSIBLE, NO_CYCLE, HEADING_MISMATCH,
   TOO_MANY_LOOPS, TOO_BIG_TO_CHECK and NUMERIC; never on NOTHING.
3. **Canvas (R3).** An amber mark (`--tight`, the existing caution colour, a distinct shape from the
   red refused-joint mark) on each adapter joint. Not a target; never the only signal (the note
   and the list carry it in words). Precedence: when a red clash or refused-joint mark sits on the
   same spot, the red mark is drawn and the amber one is not; the note still counts the adapter.
   Above `CANVAS_SEGMENT_CEILING` no amber mark is drawn, the same rule as the refused-joint
   marks (`badJoints`, App.tsx:688). Seams: `seamLines` takes refused welds from
   `polarityViolations` (App.tsx:709); adapter joints are no longer in it, so they draw a seam
   like any joint, which is right: there is a joint there.
4. **Placing (X1).** `fitOptions` (layoutModel.ts:196-228) keeps alternation first and adds the
   socket-to-socket ways round after them. Its dedupe key (:215) gains the polarity of the
   attaching end, or the socket-to-socket way, landing its ends on the same spots as an
   alternating one, is dropped as a duplicate and R/F never reach it. Peg-to-peg ways stay
   excluded. `orientation` (the default) never picks a socket-to-socket way when an alternating
   one exists; `ghostAt` (editorReducer.ts:391), used when a preview moves to another end (palette
   drag, stepGhost, moveGhost), keeps the previous turn only among fits that need no adapter, else
   `defaultFit` (eng review OV5, inside X1); `defaultFit` (layoutModel.ts:376-385) skips any fit whose `adapters` list is
   non-empty unless no other fit is left, so closing a gap never chooses an adapter over an
   alternating fit. A two-socket part (C, C1, C2; engine/data/brio.ts:142, 173, 189) placed on a
   free socket has ONLY socket-to-socket ways: those are offered with '!' (allowed by R1), and
   `refused` is true only when every way would put peg on peg. Rotate (R, the visible button)
   reaches every adapter way round, last in its cycle, whatever the turn: today `rotated` keeps
   to one turn (editorReducer.ts:408) and Flip is hidden for straights (App.tsx:829), so a
   straight's adapter way would otherwise be reachable only by an unadvertised F (outside voice,
   finding 1). Tested through the R key and the Rotate button, not only the options array. The attaching end's
   adapter status comes from its own check, the polarity of `ghost.port` against the end it goes
   on, not from `fitOptions(...).refused`, which is about the whole part (layoutModel.ts:310-314);
   the `here` conflict is then peg-on-peg only. `ghostFit`
   (layoutModel.ts:295) returns a new `adapters: readonly PortRef[]` listing every end of the
   preview that would need one: the attaching end (which its landing loop skips, `i ===
   ghost.port`) when it meets a socket with a socket, and any other end whose landing is an
   adapter join. The preview status type (App.tsx, `glyph: 'O' | 'X'`) gains a third glyph,
   `'!'`, drawn in `--tight`, for a fit with adapters and no conflict: "! Two sockets meet here:
   needs a male-male adapter.", and the join wording follows EACH connection: a plain join reads
   "Joins piece N.", an adapter join "Joins piece N with a male-male adapter."; when the
   attaching end needs one too, the status leads with "Needs a male-male adapter here." The
   count of adapters is the sum over connections. `ghostFit` therefore returns every joined end
   with its adapter flag (`joins: readonly { to: PortRef; adapter: boolean }[]`), not only the
   last `joinsTo` (layoutModel.ts:318), so a switch's several joins are all described (outside
   voice, finding 2). A conflict still wins ('X', red). Not a conflict, so Place and a
   drop both accept it.
5. **Announcements.** Placing, joining or moving into an adapter joint says so: "Added piece 5,
   joined to piece 4 with a male-male adapter."
6. **Your box (X2).** An "adapters" row (male-male), stored in the inventory blob under the
   reserved key `"__adapter_male_male"`. Catalogue ids are short codes; submitted ids are
   kept off the `__` prefix at both ways in (eng review E2, D3:A): the Add a part form refuses
   one ("Ids starting with __ are reserved.") and the submissions loader drops one, counted in the
   existing dropped-submission notice. Tests pin that no catalogue id, form submission or loaded
   submission starts with `__`. `loadInventory` (inventoryModel.ts:179, its unknown-id drop at :200) accepts that key explicitly, with the same
   non-negative-integer rule as a part count, instead of dropping it as an unknown id.
   `shortfalls()` (inventoryModel.ts:123) skips it as a part; a separate `adapterShortfall(inventory,
   needed)` reports it. Undeclared (null inventory) stays unconstrained; a declared inventory with
   no adapter count, or a count of 0, is a real "owns none" and shows a shortfall when the layout
   needs any. Shown in both places part shortfalls are: the line by the verdict (App.tsx:1115),
   "Short by 1 male-male adapter against what you own. Still fine to draw." (joined to part
   shortfalls with a comma when both exist), and the Your box panel (Inventory.tsx:138), "This
   layout needs 1 more male-male adapter." The panel's adapters row reads "Male-male adapters", with a used figure of `adapterCount`
   ("3 in use") like part rows (Inventory.tsx:118). Quick-fills (Inventory.tsx:154) keep the
   adapter count as it was: they are part counts and say nothing about adapters.
7. **Layout list (X3).** An adapter joint's row (GraphListing.tsx:279-280) reads "Joint 4: start of
   piece 3 to start of piece 4, two sockets, needs an adapter" (a socket is a piece's start,
   schema.ts:185-200).
8. **Saved layouts, presets, undo.** A saved layout that already holds a socket-to-socket weld
   loads as buildable with the note, where it read IMPOSSIBLE before; no migration, no notice (the
   blob is unchanged; only the rule changed). The shipped presets hold no same-kind weld (all
   alternate; a test pins it). Undo of an adapter join says "Undid the join." like any join; the
   joining step's announcement names the adapter.
9. **Switches.** `portPolarity` gives a switch's heel and roads their kinds, so a socket heel meeting
   a socket road is an adapter joint like any other; a test pins it.

Files [estimated]: about 12 changed (feasible.ts, solve.ts, verdictView.ts, VerdictLine.tsx,
layoutModel.ts, App.tsx, TrackCanvas.tsx, announce.ts, inventoryModel.ts, Inventory.tsx,
GraphListing.tsx, app.css) plus tests.

## NOT in scope

- Peg-to-peg joints (R1: declined). They stay IMPOSSIBLE.
- An adapter length or gap (R2: none; the owner states zero-length adapters exist).
- A separate amber verdict tier (R3: declined).
- The legacy chain engine (engine/src/feasible.ts:145, solver/result.ts:151,
  joints/evaluate.ts:88) keeps reporting a same-kind joint as a violation. That is an
  intentional DISAGREEMENT with the graph engine, not an impossibility: a chain can hold a
  socket-to-socket joint (A appended after C2, whose far end is a socket, engine/data/brio.ts:139;
  fromChain.ts:28 joins port 1 to port 0), and the legacy engine would call it a violation while
  the app calls it buildable. Only the crash repro's "legacy chain" debug line
  (app/src/repro.ts:189) and two test harnesses read it; no user-facing verdict does (outside
  voice, finding 4, which corrected the earlier claim that it could not occur).

## Temporal interrogation (0I)

```
  HOUR 1 (foundations):  the polarity convention (schema.ts:185-200: start = socket, end = peg;
                         a switch's roads take `end`); where the rule lives (audit table above).
  HOUR 2-3 (core logic): landingOf's two orders (pegs: polarity first; sockets: facing first);
                         fitOptions' dedupe key gaining the attaching polarity; defaultFit and
                         snapRunMove ranking alternation ahead of adapters.
  HOUR 4-5 (integration): VerdictView.adapterCount through all five notesFor sites; the third
                         preview glyph; amber marks drawn from render.ports like badJoints; the
                         inventory reserved key surviving load, quick-fill and save.
  HOUR 6+ (polish/tests): pins whose mutations are RUN (CLAUDE.md); a stored blob with a socket
                         weld loading as buildable; the shipped presets alternating.
```

Effort: human ~2 days / CC ~1.5 hours (features ~30x, tests ~50x). No feasibility blockers.
Pending, non-blocking: the amber mark's exact shape (owner: /plan-design-review or the
implementer, against DESIGN.md; must differ from the red refused-joint ring and the clash X).

## Review sections

### Section 1: Architecture

```
  engine/data (parts: ends.start=socket, ends.end=peg)
        |
  engine/src/graph/model.ts portPolarity ─────────────────────────────┐
        |                                                              |
  feasible.ts  landingOf ──(joins | joins+adapter | conflict)──┐       |
               findWeldPolarityViolations (peg-peg only)       |       |
               findAdapterJoints (NEW, socket-socket welds)    |       |
        |                                                      |       |
  solve.ts  GraphResult { ..., polarityViolations, adapterJoints (NEW) }
        |                                          |                   |
  app verdictView.ts  adapterCount (NEW) ── VerdictLine notesFor (note)|
  app layoutModel.ts  fitOptions (key + polarity) / ghostFit.adapters (NEW)
                      defaultFit, autoJoin, moveRun, snapRunMove ──────┘
  app App.tsx  preview glyph '!' (NEW) · amber marks · announce
  app inventoryModel.ts  "__adapter_male_male" (NEW) ── Inventory.tsx row · shortfall lines
  app GraphListing.tsx   joint row phrase (NEW)
```

- Boundaries hold: the engine decides what a socket-socket weld is; the app only presents it.
  One new engine export (`findAdapterJoints`), one new result field, no new module.
- Coupling: the inventory gains its first non-part key. Justified by X2; contained by the
  reserved `__` prefix and one explicit loader branch.
- Data flows: happy (socket weld -> adapterJoints -> note, mark, list); nil (no welds ->
  empty list -> no note); empty (adapterCount 0 -> no note, no mark); error: none new (pure
  functions over an in-memory graph; a malformed stored count follows the existing inventory
  discard path, Section 2).
- State: no new stateful object. The editor reducer's states are unchanged; landings gain a
  flag, not a state.
- Scale: `findAdapterJoints` is one pass over welds, O(welds); the dedupe-key change is
  constant per option. Nothing breaks first at 10x.
- Security surface: none (Section 3). Rollback: revert the PR (Section 9).
- Value test: no status artifact is added; the note, mark and list row are product.
- Cherry-pick fit: X1 and X3 fit the existing paths; X2 adds the one coupling above.

Findings: none needing a decision.

### Section 2: Error & Rescue Map

```
  CODEPATH                   | WHAT CAN GO WRONG                      | CLASS
  ---------------------------|----------------------------------------|----------------------
  loadInventory (adapter key)| stored count not a non-negative integer| malformed blob value
                             | key written by a newer build, read by  | unknown id (old build)
                             | an older one                           |
  findAdapterJoints          | weld names a missing piece/port        | stale weld (prevented
                             |                                        | by loadGraph, B1)
  fitOptions dedupe key      | polarity left out of the key           | logic error (test pin)

  CLASS                 | RESCUED | ACTION                                  | USER SEES
  ----------------------|---------|-----------------------------------------|------------------
  malformed blob value  | Y       | existing rule: blob discarded, notice   | "Your saved inventory had
                        |         |                                         | an unusable count ..."
  unknown id (old build)| Y       | existing rule: key dropped, notice      | "1 saved count was for parts
                        |         |                                         | no longer in the library..."
  stale weld            | Y       | skipped, as findWeldPolarityViolations  | nothing (cannot occur after
                        |         | does (feasible.ts:570)                  | loadGraph's refusal)
  logic error           | n/a     | caught by the pinned test, not at run   | n/a
```

No GAP: every failure lands on an existing, user-visible rescue.

### Section 3: Security & Threat Model

No new input surface beyond two number fields in Your box (the same `sanitizeCount` path as
part counts), no network, no auth, no secrets, no new dependency. localStorage stays per-origin.
No issues found.

### Section 4: Data Flow & Interaction Edge Cases

```
  stored inventory ─> loadInventory ─> validate "__adapter_male_male" (int >= 0)
       │ missing ─> no adapter count ─> declared inventory: owns none; undeclared: unchecked
       │ malformed ─> whole blob discarded + notice (existing rule)
       └─> state ─> saveInventory (same blob)

  graph ─> solveGraph ─> adapterJoints ─> adapterCount ─> note / marks / list rows
       └─ closing weld with a gap: still listed (it is a socket-socket weld); its mark is drawn
          at the render.ports position badJoints uses
```

| Interaction | Edge case | Handled? | How |
|---|---|---|---|
| Place / double-click at a socket end | only two-socket part fits (C, C1, C2) | Y | '!' offered (plan item 4) |
| R/F in the preview | adapter way round | Y | last in the cycle (X1) |
| Auto-join on Place | far end lands facing on a socket | Y | joins with an adapter, '!' status, announced |
| Drag-snap a run | adapter target nearer than a normal one | Y | normal target wins (plan item 1) |
| Move run by keys/R | socket lands facing a socket | Y | joins, announced |
| Undo / Redo | adapter join undone | Y | graph value restored; "Undid the join." |
| Reload | saved socket weld | Y | loads buildable with the note (item 8) |
| Quick-fill in Your box | adapter count present | Y | kept (item 6) |
| Double-click / rapid input | n/a | Y | reducer already serialises edits |

No unhandled edge case. No async state is shared; the reducer is synchronous.

### Section 5: Code Quality

- `findAdapterJoints` mirrors `findWeldPolarityViolations`'s loop: share the per-weld polarity
  read (one helper returning both lists) rather than two loops that could disagree. Non-blocking,
  implementer's call, same behaviour either way.
- No new method branches more than 5 times; `landingOf` gains one branch.
No issues needing a decision.

### Section 6: Tests

| New behaviour | Type | Assertion (rejects) | no_claim |
|---|---|---|---|
| socket-socket weld is not IMPOSSIBLE, is listed | unit (engine) | verdict kind unchanged; adapterJoints length 1 (rejects IMPOSSIBLE) | the real adapter fits; owner's fact |
| peg-peg weld still IMPOSSIBLE | unit (engine) | polarityViolations length 1 | none beyond protects |
| switch: socket heel meets socket road | unit (engine) | listed as an adapter joint | none beyond protects |
| landingOf: socket facing socket joins+adapter; not facing is `facing`; peg-peg (facing or not) is `polarity` | unit | each result exactly | none beyond protects |
| fitOptions offers the adapter way last; key includes polarity | unit | options list exact; mutation dropping polarity from the key RUN | R/F keypresses (dom spec) |
| defaultFit prefers alternation over a gap-closing adapter fit | unit | chosen fit is the alternating one | none beyond protects |
| snapRunMove ranks a normal target over a nearer adapter one | unit | chosen move exact | pointer drag (browser) |
| verdict note on every kind with a layout, never NOTHING | unit (verdictView + static markup) | exact strings, 1 and N | none beyond protects |
| amber mark drawn, suppressed under a red mark and above the ceiling | node (static markup) | mark count | the pixel colour |
| preview '!' status and wording | dom | exact text | none beyond protects |
| announcements name the adapter | unit (announce) | exact text | screen reader output |
| inventory: key survives load/save/quick-fill; malformed discards; declared 0 is short | unit + dom | exact | none beyond protects |
| list row phrase | unit (GraphListing) | exact text | none beyond protects |
| saved blob with a socket weld loads buildable; presets alternate | unit / dom | verdict kind; zero adapter joints in every preset | none beyond protects |

Every pin records a mutation that is RUN (CLAUDE.md). 2am test: the engine split plus the
fitOptions key pin. Hostile QA: a C piece on a socket end, then R/F through every option.
No flakiness sources (no time, randomness or network).

### Section 7: Performance

O(welds) for the new list; one extra solve field; marks capped by the existing canvas ceiling.
No issues found.

### Section 8: Observability

A client-only app with no telemetry. Debuggability: `repro.ts` prints `solveGraph`'s result,
which now includes `adapterJoints`, so a bug report carries them with no change. No issues found.

### Section 9: Deployment & Rollout

Static build; no migration (the graph blob is unchanged, only the rule). Rollback: revert the
PR. One mixed-version case: an inventory blob written by the new build and loaded by an older
one drops `__adapter_male_male` with the existing "1 saved count was for parts no longer in the
library" notice; nothing else is lost. Post-deploy check: load a layout with a socket weld and
read the note. No issues needing a decision.

### Section 10: Long-term trajectory

Reversibility 4/5 (one reserved inventory key outlives a revert as a dropped key). Debt: none
new; the legacy chain engine keeps the old rule, documented in NOT in scope. Phase 2 (12-month
ideal): other adapter kinds become parts, priced in a build list; the reserved-key pattern is
the bridge. Retrospective: X2 was accepted against my Defer recommendation; it is the only item
adding coupling, and that coupling is contained.

### Section 11: Design & UX

```
  pick piece ─> preview: O fits | ! needs adapter (amber) | X conflict (red)
        │                         │
        └─ Place / drop ──────────┴─> joint made ─> note under verdict + amber mark + list row
                                                    └─> Your box: "Short by 1 male-male adapter"
```

| Feature | Empty | Error | Success | Partial |
|---|---|---|---|---|
| Adapter note | hidden at 0 | n/a | "Needs 1 male-male adapter: ..." | shown on refusals too |
| Amber mark | none | red mark wins on a shared spot | amber mark | suppressed above the ceiling |
| Your box row | blank = undeclared | "needs a number" (existing) | count + "N in use" | quick-fill keeps it |

Accessibility: the colour is never the only signal (note, list row and preview text carry it);
`--tight` is the existing caution token with measured contrast. Pending (non-blocking): the
mark's shape; recommend /plan-design-review or a DESIGN.md check before building it.

### Outside voice (Codex, completed)

4 findings, 4 applied as corrections inside approved scope (ledger row OV1-OV4): R reaches the
adapter way round (Medium); wording follows each connection (Medium); snap prefers alternation
only among accepted moves (Medium); the legacy-engine note corrected to a documented
disagreement (Low). Cross-model: the three native (Claude) spec reviews caught data and wiring
gaps; Codex caught interaction-level gaps none of them did (hidden control, mislocated wording,
a preference that could refuse a valid drop) and one false premise. No disagreement remains.

Approval readiness: PASS. Checked rows: R1 ("i want option 1"), R2 ("without adding any
length..."), R3 (D2:A), R4 (D6:A), X1 (D3:A), X2 (D4:A), X3 (D5:A), OV1-OV4 (inside R1/X1/R3),
mode (selective expansion), documents (approved, A). No declined, deferred or unanswered change
is in accepted work.

## Reality rows

| premise | claim | receipt | verdict |
|---|---|---|---|
| same-kind welds are IMPOSSIBLE today | verdict rule | engine/src/graph/feasible.ts:560; app/src/verdictView.ts:96 | verified |
| placing refuses same-kind | fitOptions / landingOf | app/src/layoutModel.ts:211, feasible.ts:186 | verified |
| dedupe key ignores polarity | X1 would be a no-op unchanged | app/src/layoutModel.ts:215 | verified |
| give assumes one fit per weld | R4 question | engine/src/graph/model.ts:239 | verified |
| zero-length male-male adapters exist | R2 | owner statement, 2026-10-23 | unverified (owner-attested) |
| peg 11.5 mm, socket throat 5 mm | context only | woodenrailway.info track guide | unverified (web) |

REALITY: premise-table finding unverified=2 (owner-attested adapter length; web peg figures) docs/plan/2026-10-23-socket-adapter.md:409
REALITY: already-done pass no commits since 2026-10-23 on the touched files, none mention adapter ac4791a
REALITY: surface-check pass the plan names no CLI command, flag or route beyond `bun run test/typecheck/build` package.json:6-8
REALITY: binding-decisions pass D20 (facing ends) and the polarity convention (schema.ts:185-200) are kept; no decision searched conflicts
REALITY: numbers pass file counts tagged [estimated]; no measured figure is claimed docs/plan/2026-10-23-socket-adapter.md:179
REALITY: deferred-asks pass no linked issue; the ask is the owner's message docs/plan/2026-10-23-socket-adapter.md:3
REALITY: pr-count pass no .gstack/ship-policy.json, default one PR per wave: one PR docs/plan/2026-10-23-socket-adapter.md:481

PLAN_REALITY: phase=ceo rows=7/7 missing=none unverified=2 verdict=complete

## What already exists

- The weld polarity check (feasible.ts:560): split, not rebuilt.
- `landingOf`'s outcomes: one flag added to `joins`.
- The red refused-joint marks and their ceiling (App.tsx:688-709): the amber mark copies the lookup.
- The verdict notes (`notesFor`, five call sites): the adapter note joins them.
- Inventory shortfall wording and rows (App.tsx:1115, Inventory.tsx:118-138): reused.
- GraphListing joint rows (GraphListing.tsx:279-280): a phrase appended.

## Dream state delta

After this plan, the male-male adapter is a first-class part in every way but its catalogue
entry: verdict, canvas, preview, list and box all know it. Left for the 12-month ideal: other
adapter kinds (peg-to-peg, declined now) and a printable build list.

## Error & Rescue Registry

See Section 2's tables: 4 codepaths, 0 GAPS; every rescue is an existing, user-visible one.

## Failure Modes Registry

```
  CODEPATH              | FAILURE MODE                         | RESCUED? | TEST? | USER SEES?          | LOGGED?
  ----------------------|--------------------------------------|----------|-------|---------------------|--------
  loadInventory         | malformed adapter count              | Y        | Y     | discard notice      | n/a (no telemetry)
  loadInventory (old)   | newer blob on an older build         | Y        | N*    | dropped-count notice| n/a
  fitOptions key        | polarity dropped from the key        | n/a      | Y     | R/F miss adapter way| n/a
  snapRunMove ranking   | preference refuses a valid drop      | Y        | Y     | the drop is placed  | n/a
  findAdapterJoints     | stale weld                           | Y        | Y     | nothing (prevented) | n/a
```
(*) the old build's behaviour is existing, already-tested code. No CRITICAL GAP.

## Scope Expansion Decisions

CEO plan: ~/.gstack/projects/brio-designer/ceo-plans/2026-10-23-socket-adapter.md
- Accepted: X1 (adapter way in the preview), X2 (adapters in Your box), X3 (named in the list)
- Deferred: none
- Skipped: none

## Diagrams

Produced: system architecture (Section 1), data flow with shadow paths (Sections 1, 4), error
flow (Section 2), user flow (Section 11). State machine: none (no new state). Deployment and
rollback: one static build; rollback = revert the PR (Section 9), no sequence to draw.

## Stale Diagram Audit

- engine/src/parts/schema.ts:185-200 ("Real BRIO track has one male and one female end per
  piece... peg-to-peg is one click away"): accurate; add one sentence that socket-to-socket is
  buildable with a male-male adapter.
- engine/src/graph/model.ts:239 (`weldGiveMm`: "Every weld is a peg in a socket"): now false for
  an adapter weld; reword to "every weld is one or two peg-in-socket fits; give is counted once
  (R4)".
- engine/src/graph/feasible.ts docblock (POLARITY predicate, :1-22): reword to peg-peg only.

## Implementation Tasks

Synthesized from this review's findings. One PR (no ship policy: one per wave).

- [ ] **T1 (P1, human: ~3h / CC: ~15min)** — engine — Split the weld check: peg-peg violations, socket-socket adapter joints
  - Surfaced by: Accepted scope 1; Sections 1, 6
  - Files: engine/src/graph/feasible.ts, engine/src/graph/solve.ts, engine/src/graph/model.ts (comment), engine/src/parts/schema.ts (comment), engine/test/
  - Verify: bun run test; socket weld not IMPOSSIBLE and listed; peg weld IMPOSSIBLE; switch heel case; mutations RUN
- [ ] **T2 (P1, human: ~2h / CC: ~10min)** — engine — `landingOf`: sockets facing join with an adapter; pegs unchanged
  - Surfaced by: Accepted scope 1; spec review 2
  - Files: engine/src/graph/feasible.ts, engine/test/
  - Verify: the four landing outcomes exact
- [ ] **T3 (P1, human: ~4h / CC: ~20min)** — app/placing — fitOptions key + polarity, adapter ways last, R reaches them, defaultFit and snap ranking among accepted moves, `ghostFit.joins`
  - Surfaced by: X1; spec reviews 1-3; outside voice 1-3
  - Files: app/src/layoutModel.ts, app/src/editorReducer.ts, tests
  - Verify: options exact; R and the Rotate button reach the adapter way; C on a socket offered '!'; gap close prefers alternation; snap never refuses a valid drop
- [ ] **T4 (P1, human: ~3h / CC: ~15min)** — app/verdict+canvas — adapterCount, the note on every kind, amber marks (ceiling, red wins), seams
  - Surfaced by: R3; spec review 2
  - Files: app/src/verdictView.ts, app/src/VerdictLine.tsx, app/src/App.tsx, app/src/TrackCanvas.tsx, app/src/app.css, tests
  - Verify: exact note strings for 1 and N; NOTHING has none; mark counts
- [ ] **T5 (P1, human: ~2h / CC: ~10min)** — app/preview+announce — '!' status, per-connection wording, announcements
  - Surfaced by: R3, X1; outside voice 2
  - Files: app/src/App.tsx, app/src/announce.ts, tests
  - Verify: exact strings, including mixed plain and adapter joins on a switch
- [ ] **T6 (P1, human: ~3h / CC: ~15min)** — app/inventory — `__adapter_male_male`: load, save, quick-fill keep, row with "in use", both shortfall lines
  - Surfaced by: X2; spec reviews 1-3
  - Files: app/src/inventoryModel.ts, app/src/Inventory.tsx, app/src/App.tsx, tests
  - Verify: round trip; malformed discards; declared 0 is short; undeclared unchecked; no library id starts with `__`
- [ ] **T7 (P1, human: ~1h / CC: ~5min)** — app/list — adapter joint phrase in GraphListing
  - Surfaced by: X3
  - Files: app/src/GraphListing.tsx, tests
  - Verify: exact row text
- [ ] **T8 (P2, human: ~1h / CC: ~5min)** — app — saved socket weld loads buildable; presets alternate
  - Surfaced by: Accepted scope 8
  - Files: tests only
  - Verify: verdict kind; zero adapter joints in every preset

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | same-kind rule in 6 places; dedupe key bug  |
  |                      | would have made X1 a no-op                  |
  | Step 0               | R1-R4 approved; X1-X3 accepted              |
  | Section 1  (Arch)    | 0 issues found                              |
  | Section 2  (Errors)  | 4 error paths mapped, 0 GAPS                |
  | Section 3  (Security)| 0 issues found, 0 High severity             |
  | Section 4  (Data/UX) | 9 edge cases mapped, 0 unhandled            |
  | Section 5  (Quality) | 1 issue found (shared weld loop, optional)  |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 0 gaps found                                |
  | Section 9  (Deploy)  | 1 risk flagged (old build drops the key)    |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 0           |
  | Section 11 (Design)  | 1 pending (amber mark shape)                |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 4 rows, 0 CRITICAL GAPS                     |
  | Failure modes        | 5 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | 0 items proposed                            |
  | Scope proposals      | 3 proposed, 3 accepted (SEL)                |
  | CEO plan             | written                                     |
  | Outside voice        | codex: completed, 4 findings, 4 applied     |
  | Lake Score           | N/A (no coverage-scored questions)          |
  | Diagrams produced    | 4 (architecture, data flow, error, user flow)|
  | Stale diagrams found | 3                                           |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows (PLAN_REALITY), 2 unverified       |
  +====================================================================+
```

Spec review: 3 completed reviews (5, 7, 6 out of 10), plus one launch stopped before it read
the updated input. The third review's 12 fixes are applied and verified in the text, not
re-reviewed: spec not re-verified.

## Eng review (2026-10-23)

Target: docs/plan/2026-10-23-socket-adapter.md (this file). Report file: this file.

Scope record: feature answers: none proposed (all seven CEO decisions kept); structure: A
(D1, "A) Original arrangement"); accepted scope: the plan as approved by the CEO review, 15
source files [estimated, 2 comment-only], 0 new classes; pending remedies: none.

### Scope Challenge

A. Reuse: every sub-problem maps to existing code (see "What already exists"). Minimum change:
the plan as approved. Search check: no new architectural pattern, infrastructure or concurrency,
so no search. TODOS cross-reference: nothing in docs/plan/brio-TODOS.md blocks this; the overlap
and D7 entries it touches are DONE. Distribution: none (static build).
Findings: complexity (15 files) resolved by D1. No other Scope Challenge findings.
Result: scope accepted as-is.

REALITY: premise-table finding unverified=2 (owner-attested adapter length; web peg figures) docs/plan/2026-10-23-socket-adapter.md:409
REALITY: already-done pass nothing landed on the touched files since the CEO review ac4791a
REALITY: surface-check pass only `bun run test/typecheck/build` are named package.json:6-8
REALITY: binding-decisions pass D20 (facing ends), the polarity convention and R1-R4/X1-X3 are kept engine/src/parts/schema.ts:185
REALITY: numbers pass 15 files tagged [estimated] from the task list docs/plan/2026-10-23-socket-adapter.md:179
REALITY: deferred-asks pass no linked issue; the ask is the owner's message docs/plan/2026-10-23-socket-adapter.md:3
REALITY: pr-count pass one PR per wave, no ship policy docs/plan/2026-10-23-socket-adapter.md:481

### Regression contract (carried forward, not re-asked)

Approved by R1 ("i want option 1") and the CEO document approval (Section 6 table). Behaviour to
preserve: peg meets peg is a violation everywhere. Intentional changes, each spec rewritten in the
same PR, never deleted:
- engine/test/switches.test.ts:173 "a socket heel refuses a socket" -> an adapter joint, listed.
- app/src/layoutModel.test.ts:272 "cannot turn round a piece with no end of the other kind" (A,
  C2, C2) -> 0 bad joints, 1 adapter joint.
- app/src/ghostFit.test.ts:~108 socket landing facing a socket -> `joins` with `adapter: true`.
Kept exactly: engine/test/graphFeasible.test.ts:124 (B2 + B2), app/src/moveRun.test.ts:89 (peg on
peg move refused). The comment at graphFeasible.test.ts:120 ("adapter pieces that exist because
two pegs cannot be joined") gains that two sockets now can, with a male-male adapter.

## Decision ledger

### E1: one weld classifier or two loops
Finding: 1, P3, confidence 8/10, engine/src/graph/feasible.ts:560-580, eng review (Claude).
`findWeldPolarityViolations` reads both ports' polarity per weld (`const pa = portPolarity(...);
const pb = ...; if (pa !== pb) return;`); the plan adds `findAdapterJoints` doing the same read.
Plan baseline: two functions (Accepted scope 1, approved with the CEO documents).
Runtime evidence: one existing loop, feasible.ts:567-578; the second is proposed.
Comparison grid:

| Commitment | Current (plan) | A) One classifier | B) Two loops |
|---|---|---|---|
| Behaviour: peg-peg violation, socket-socket adapter | approved (R1) | same | same |
| Shape | two exported functions | `classifyWelds` returns `{ violations, adapters }`; `findWeldPolarityViolations` kept as a one-line wrapper for its callers | two functions, each with its own loop |
| Can the two disagree on a weld? | yes, if one loop changes | no, one read per weld | yes |
| Tests | Section 6 rows | same rows, plus one spec that every same-kind weld lands in exactly one list | same rows |
| Effort | n/a | human ~20 min / CC ~3 min | human ~20 min / CC ~3 min |

Question D2:
D2 - E1: One weld classifier, or two separate loops?
Project: brio-designer, main, eng review of docs/plan/2026-10-23-socket-adapter.md.
ELI10: The engine will sort same-kind joints into "impossible" (two pegs) and "needs an adapter" (two sockets). The plan does that with two functions that each walk every joint and read both ends. If someone later changes how one of them reads an end (a switch heel, say), the two lists can disagree, and a joint could be both impossible and adapter, or neither. One function that sorts each joint into exactly one list cannot drift that way.
Stakes if we pick wrong: a future edit makes a socket joint vanish from the adapter count while the verdict still calls it fine.
Recommendation: A) One classifier, because one read per joint makes "exactly one list" true by construction, at the same cost.
Note: options differ in kind, not coverage, so there is no completeness score.
Net: drift-proof by construction, or two simpler-looking loops that must be kept in step.
Header: Weld check
Options:
A) One classifier (recommended)
`classifyWelds` sorts every same-kind weld into violations (pegs) or adapters (sockets) in one pass; `findWeldPolarityViolations` stays as a thin wrapper so its callers don't change. Human ~20 min / CC ~3 min, risk low. ✅ A weld can never land in both lists or neither. ✅ One loop instead of two, less code. ❌ One more indirection for the existing callers.
B) Two loops
`findWeldPolarityViolations` keeps its loop and `findAdapterJoints` gets its own, as the plan says now. Human ~20 min / CC ~3 min, risk low. ✅ Each function reads on its own. ✅ No wrapper. ❌ Two copies of the polarity read that must be kept in step by hand.

State: approved
Actual answer: A) One classifier (owner, 2026-10-23, D2)
Accepted scope: `classifyWelds(graph, resolve, ports)` returns `{ violations, adapters }` in one
pass over the welds; `findWeldPolarityViolations` becomes a wrapper returning `.violations`;
`findAdapterJoints` is not added. Tests: the Section 6 rows, plus one spec that every same-kind
weld appears in exactly one of the two lists.
History: none

### Section 1: Architecture

- [P2] (confidence: 9/10) app/src/App.tsx:546 — `const move = snapRadiusMm > 0 ?
  snapRunMove(graph, ports, pieceId, asked, snapRadiusMm) : asked;` runs outside the reducer, so
  OV3's "prefer alternation among moves moveRun would accept" means `snapRunMove` gains the
  geometry and checks each in-radius candidate with `moveRun(...).refused === null`.
  Disposition: accepted under OV3 (mechanism recorded).
- [P3] (confidence: 8/10) app/src/layoutModel.ts:474 — `weldEnds` welds any two free ends with no
  polarity check and no landing, so a hand join's announcement reads the two ports' polarities
  (`portPolarity`) itself. Disposition: accepted under plan item 5 (mechanism recorded).
- [P3] (confidence: 8/10) App.tsx `canRotate: ... fit.options.filter((o) => o.turn ===
  ghost.turn).length > 1` and editorReducer.ts:408 `rotated` keep to one turn; with adapter ways
  listed, Rotate is enabled at socket ends and must cycle across turns. Disposition: accepted
  under OV1.

```
  ghost / drop / move ──> landingOf ──> joins | joins+adapter | conflict
                                │
  graph ──> solveGraph ──> classifyWelds ──> { violations (peg-peg), adapters (socket-socket) }
                                                  │                    │
                                       IMPOSSIBLE + red marks   note + amber marks + list rows
                                                                       │
                                                       Your box: adapters needed vs owned
```

### Section 2: Code quality

- [P3] (confidence: 8/10) engine/src/graph/feasible.ts:574-576 — `const pa = portPolarity(...);
  const pb = portPolarity(...); if (pa !== pb) return;` would be duplicated by a second loop.
  Disposition: E1, D2:A, one classifier.
- Stale comments in touched files: see Stale Diagram Audit (CEO section) plus
  engine/test/graphFeasible.test.ts:120. No other issues.

### Section 3: Tests

```
CODE PATHS                                              USER FLOWS
[+] engine feasible.ts                                  [+] Place at a socket end
  ├── classifyWelds()                                     ├── [GAP] C on a socket: '!' offered
  │   ├── [GAP] peg-peg -> violations                      ├── [GAP] R reaches the adapter way
  │   ├── [GAP] socket-socket -> adapters                  └── [★★ TESTED] normal fit default — ghostReducer.regression-1
  │   ├── [GAP] switch socket heel + socket road        [+] Drop / move / snap
  │   └── [GAP] every same-kind weld in exactly one     ├── [GAP] drop onto a socket end joins
  ├── landingOf()                                        ├── [GAP] snap prefers normal among accepted
  │   ├── [★★★ TESTED] joins / facing / crowded           └── [★★ TESTED] peg-peg move refused — moveRun.test:89
  │   ├── [REWRITE] socket facing socket -> joins+adapter [+] Verdict + box + list
  │   └── [GAP] socket not facing -> facing; peg-peg     ├── [GAP] note on each kind, never NOTHING
  │         facing or not -> polarity                     ├── [GAP] amber mark; red wins; ceiling
[+] app layoutModel.ts                                   ├── [GAP] box: key round trip, quick-fill keeps,
  ├── fitOptions() key + polarity  [GAP]                  │         declared 0 short, malformed discards
  ├── defaultFit() prefers alternation  [GAP]            ├── [GAP] list row phrase
  ├── ghostFit().joins / adapters  [GAP]                 └── [GAP] saved socket weld loads buildable
  ├── autoJoin()/moveRun() adapters count  [GAP]        [+] Announcements
  └── snapRunMove() among accepted  [GAP]                  └── [GAP] place / join / move / hand join
[+] specs to rewrite: switches.test:173, layoutModel.test:272, ghostFit.test:~108

COVERAGE (proposed): every new path has a planned ★★★ test; 3 existing specs rewritten, 2 kept
QUALITY target: ★★★ for engine and model; ★★ for strings (exact-text assertions)
```

Value cards (one per planned test; every pin records a RUN mutation, CLAUDE.md):
- Value: protects=peg-peg welds stay violations; fails_when=classifyWelds files a peg pair as adapter; why_new=the split is new; seam=none; no_claim=none beyond protects
- Value: protects=socket-socket welds are adapters, not violations; fails_when=the old same-kind rule returns; why_new=switches.test:173 pinned the opposite; seam=none; no_claim=that a real adapter fits (owner's fact)
- Value: protects=every same-kind weld lands in exactly one list; fails_when=the two lists drift; why_new=E1; seam=none; no_claim=none beyond protects
- Value: protects=a socket heel meeting a socket road is an adapter joint; fails_when=heels are special-cased; why_new=switch polarity is per port; seam=none; no_claim=real switch polarity (reproductions only)
- Value: protects=landingOf's four outcomes; fails_when=pegs lose the polarity refusal or sockets skip facing; why_new=ghostFit.test landing spec pins the old rule; seam=none; no_claim=none beyond protects
- Value: protects=R and the Rotate button reach the adapter way; fails_when=polarity left out of the dedupe key; why_new=options were never polarity-distinct; seam=none; no_claim=F-key parity (separate spec)
- Value: protects=defaultFit never prefers an adapter over alternation; fails_when=adapter fits count as closing; why_new=ghostReducer.regression-1 has no socket case; seam=none; no_claim=none beyond protects
- Value: protects=snap prefers a normal target only among accepted moves; fails_when=an unconditional preference refuses a valid drop; why_new=OV3; seam=none; no_claim=the pointer path (browser check)
- Value: protects=the adapter note's exact text on every verdict kind but NOTHING; fails_when=a notesFor site is missed; why_new=new copy; seam=none; no_claim=screen-reader reading order
- Value: protects=the box's adapter key survives load, save and quick-fill; fails_when=the loader drops it or a quick-fill wipes it; why_new=first non-part key; seam=none; no_claim=older builds (existing tested path)
- Value: protects=a saved socket weld loads buildable with the note; fails_when=load-time code keeps the old rule; why_new=reload.dom covers other losses; seam=none; no_claim=none beyond protects

Tests made obsolete: none deleted; the three specs above are rewritten to the new rule.

### Section 4: Performance

- classifyWelds: O(welds), replacing one existing pass. No issue.
- fitOptions at a socket end lists up to twice the options; `defaultFit` calls `ghostFit` per
  option, so up to twice the work on pick, still a handful of single-piece checks. No issue.
- snapRunMove: k in-radius candidates x one `moveRun` with the wood check, measured at 69 ms per
  check on 10,000 pieces (PR #34) [measured: plankOverlap timing probe]; k is typically 1-3 and
  layouts are hundreds of pieces, so release stays well under a frame budget at real sizes.
  Unknown at 10,000 pieces with many candidates; not a target size. No issue.

### Outside voice (Codex, eng review)

Completed: 2 findings (Medium, Medium). Plan body truncated to 30KB for the prompt; the owner's
decisions were passed alongside it.

- OV5 [Medium] (confidence: 9/10) app/src/editorReducer.ts:391 — `const fit = options.find((o) =>
  o.turn === turn) ?? defaultFit(graph, ports, at, partId);` keeps the previous turn first, so
  moving a straight's preview from a peg end to a socket end picks the adapter way over the
  alternating one. Disposition: applied as a correction inside X1 ("the default stays
  alternation", D3:A): `ghostAt` keeps the turn only among fits that need no adapter, else
  `defaultFit`. Tested by moving a preview (palette drag and stepGhost) from a peg to a socket end.
- OV6 [Medium] (confidence: 9/10) app/src/SubmitPart.tsx:76-77 — `const id = correcting !== '' ?
  correcting : ...` with `setCorrecting(e.target.value.trim())`, and library.ts:154 accepts any
  non-empty id, so a submitted part can be named `__adapter_male_male`. Decision: E2 below.

### E2: enforce the reserved inventory key
Finding: OV6, Medium, confidence 9/10, app/src/SubmitPart.tsx:76-77 and engine/data/library.ts:154, Codex outside voice.
Plan baseline: Accepted scope 6 claims a leading `__` cannot collide, pinned by "no library id
starts with `__`" (X2, D4:A). That premise is false for submitted parts.
Runtime evidence: the correcting field is free text; `looksLikePart` checks only a non-empty string id.
Comparison grid:

| Commitment | Current (plan) | A) Apply | B) Keep | C) Investigate | D) Defer |
|---|---|---|---|---|---|
| X2 adapter row and key `__adapter_male_male` | approved | unchanged | unchanged | unchanged | unchanged |
| Submission form | any id | refuses an id starting `__` with "Ids starting with __ are reserved." | any id | unchanged, pending | any id |
| Submissions loader | any non-empty id | drops an id starting `__`, counted in the existing dropped-submission notice | any id | unchanged, pending | any id |
| Collision possible | yes | no | yes | yes until answered | yes |
| Tests | "no catalogue id starts with __" | form refusal + loader drop + the existing notice text | the plan's test only | none yet | the plan's test only |
| Effort | n/a | human ~30 min / CC ~5 min | none | human ~15 min / CC ~3 min | none now |

Question D3:
D3 - E2: Enforce the reserved inventory key?
Project: brio-designer, main, eng review of docs/plan/2026-10-23-socket-adapter.md.
ELI10: Your box will store the adapter count under a special name, `__adapter_male_male`, next to the part counts. The plan assumed no part could ever have that name. Codex found one could: the "Correcting an existing part?" field in Add a part accepts any text as the part's id. Someone typing that exact name would make a track part and the adapters share one count, and that part's shortfall would be hidden.
Stakes if we pick wrong: an unlikely but silent mix-up of two counts in Your box.
Recommendation: A) Apply, because it makes the plan's guarantee true at the two places a name can enter, for minutes of work.
Note: options differ in kind, not coverage, so there is no completeness score.
Net: close the hole now at both entry points, or accept a very unlikely silent collision.
Header: Reserved key
Options:
A) Apply (recommended)
The Add a part form refuses an id starting with "__" ("Ids starting with __ are reserved."), and the submissions loader drops such an entry, counted in the existing dropped-submission notice. Human ~30 min / CC ~5 min, risk low. ✅ The adapter key can never collide, at either way in. ✅ Reuses the loader's existing drop-and-notice path. ❌ Two more small checks and their tests.
B) Keep
Leave both entry points as they are; the plan's test covers only the built-in catalogue. No added work, risk low. ✅ Nothing changes outside the box. ✅ The collision needs someone to type that exact name. ❌ The plan's "cannot collide" claim stays false.
C) Investigate
Check whether any saved submission today has an id starting with "__" before choosing; changes nothing yet. Human ~15 min / CC ~3 min. ✅ Grounds the choice in real data. ✅ No code yet. ❌ Only this machine's storage can be checked, so it proves little.
D) Defer
Leave this unresolved and decide later; the X2 work stays as planned. No work now. ✅ Keeps this PR smaller. ✅ Nothing is lost by waiting. ❌ The plan ships with a known false guarantee.

State: approved
Actual answer: A) Apply (owner, 2026-10-23, D3)
Accepted scope: SubmitPart refuses an id starting with "__" with "Ids starting with __ are
reserved."; the submissions loader drops such an entry, counted in the existing dropped-submission
notice. Tests: the form refusal, the loader drop, and the notice text. The X2 key is unchanged.
History: none

Approval readiness: PASS. Checked: D1 (structure A), E1 (D2:A), E2 (D3:A), OV5 (inside X1,
CEO D3:A), regression contract (R1 + CEO document approval A). No deferred or pending remedy.

### Eng review outputs

NOT in scope: unchanged from the CEO section (peg-to-peg, adapter length, an amber verdict tier,
the legacy chain engine). Nothing deferred by this review.

What already exists: unchanged; plus `weldEnds` (layoutModel.ts:474) for hand joins, reused as is.

Failure modes:

```
  PATH                     | REALISTIC FAILURE                          | TEST | HANDLING | USER SEES
  -------------------------|--------------------------------------------|------|----------|-------------------
  classifyWelds            | a weld lands in both lists or neither      | Y    | n/a      | wrong count (caught)
  fitOptions key           | polarity dropped, adapter way vanishes     | Y    | n/a      | R never offers it
  ghostAt                  | old turn picks the adapter way on a move   | Y    | n/a      | '!' by default
  snapRunMove              | preference refuses a valid adapter drop    | Y    | n/a      | drop placed
  inventory reserved key   | a part id collides with the adapter key    | Y    | refuse + | notice on load
                           |                                            |      | drop     |
  hand join announcement   | adapter not named                          | Y    | n/a      | plain "Joined"
```
No critical gap: every failure has a test, and none is silent once tested.

Worktree parallelization: two lanes.

| Step | Modules touched | Depends on |
|------|----------------|------------|
| Engine classify + landing | engine/src/graph | — |
| Inventory key + reserved ids | app/src (inventory, submit), engine/data | — |
| Placing, verdict, canvas, list, announce | app/src | Engine classify + landing |

Lane A: engine classify + landing -> app placing/verdict/canvas/list/announce (shared app/src).
Lane B: inventory key + reserved ids (independent).
Execution order: launch A + B; merge B; finish A. Conflict flag: both touch app/src/App.tsx (the
shortfall line), so merge B first and rebase A.

### Eng implementation tasks (amending T1-T8 above)

- [ ] **T1 (P1)** — engine — `classifyWelds` replaces the planned `findAdapterJoints` (E1, D2:A); add the exactly-one-list spec. Verify: bun run test; mutation RUN.
- [ ] **T3 (P1)** — app/placing — also `ghostAt` keeps the turn only among no-adapter fits (OV5); `snapRunMove` takes geometry and checks candidates with `moveRun` (Section 1). Verify: preview moved peg -> socket lands the normal way; snap spec.
- [ ] **T6 (P1)** — app/inventory — also the Add a part form refuses an id starting `__` and the submissions loader drops one (E2, D3:A). Files add app/src/SubmitPart.tsx, engine/data/library.ts. Verify: form refusal, loader drop, notice text.
- [ ] **T9 (P1, human: ~1h / CC: ~10min)** — tests — rewrite the three specs in the regression contract to the new rule; keep the two peg-peg specs untouched. Files: engine/test/switches.test.ts, app/src/layoutModel.test.ts, app/src/ghostFit.test.ts, engine/test/graphFeasible.test.ts (comment). Verify: each rewritten spec fails on the old rule (mutation RUN).

Unresolved decisions: none.

Test plan artifact: ~/.gstack/projects/brio-designer/radudiaconescu-main-eng-review-test-plan-20261023-110710.md

### Eng completion summary

- Step 0: Scope Challenge — scope accepted as-is (D1: original arrangement)
- Reality rows: 7/7 applicable rows emitted (PLAN_REALITY), 2 unverified premises
- Architecture Review: 3 issues found (all inside approved decisions)
- Code Quality Review: 1 issue found (E1, resolved D2:A)
- Test Review: diagram produced, 0 gaps identified (all paths have planned tests; 3 specs to rewrite)
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items proposed to user
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex, completed, 2 findings (OV5 applied inside X1; OV6 resolved as E2, D3:A)
- Parallelization: 2 lanes, 2 parallel / 1 sequential
- Lake Score: N/A (no completeness-scored questions)

## Design review (2026-10-23)

Target: this plan, as shipped (PR #39). DESIGN.md is the reference. No mockups: the gstack
designer has no OpenAI key (0 of 3 saved). Outside voices: Codex (completed) and a Claude
subagent; no hard rejections; the amber colour, groove contrast, scaling stroke and the
double-meaning '!' confirmed by both.

Initial ratings: Pass 1 IA 8/10; Pass 2 States 6/10; Pass 3 Journey 7/10; Pass 4 Specificity
8/10; Pass 5 Design system 4/10; Pass 6 Accessibility 6/10.

Pass 1, no issue: the adapter note sits after the basis line and before the generic trust
caveats, and the action stays last. Layout-specific facts before generic caveats, the thing to
do at the end: the existing hierarchy, correct for this line too (the subagent's "action first"
was weighed and not taken: the action is always the closing line by design).

Decisions (each its own question, owner answers 2026-10-23):
- DR1 (D1: 1A) When some adapter joints are not drawn because a red mark holds the spot, the note
  adds "N is/are not marked, because a clash is drawn there." Not above the canvas ceiling, where
  the canvas already says nothing is drawn.
- DR2 (D2: 2B) No "enough owned" line: silence means enough, as for parts.
- DR3 (D3: 3B) No explainer: "male-male adapter" is the name the part is sold under.
- DR4 (D4: 4A) The Your box adapters row leaves the source column blank.
- DR5 (D5: 5A) The canvas mark and the strip glyph use `--ink`, not `--tight`; amber stays the
  NEEDS_GIVE verdict only (rule 1). Ratios recorded in tokens.css (rule 5): --ink 8.30:1 on
  --track-fill, 3.94:1 on --track-groove.
- DR6 (D6: 6A) The strip's adapter glyph is ◇ (ink, aria-hidden), the shape of the canvas mark;
  '!' stays the serious-caveat glyph only. Statuses: O fits, ◇ fits with an adapter, X conflict.
- DR7 resolved by DR5: ink clears 3:1 on both wood and groove; no halo needed.
- DR8 (D7: 7A) `.adapter-joint-mark` in CSS: `vector-effect: non-scaling-stroke`, 2px (lighter
  than the armed end's 3px ring); the centre dot becomes a small filled diamond. Pinned by a
  stylesheet-text spec. Size stays 32 mm in the drawing (DR12).
- DR9 (D8: 8A) Counts in the adapter note and piece numbers in the preview status render in
  `.num`; announcements stay plain strings.
- DR10 (D9: 9A) Your box intro: "...Fill any number in, or start from a quick-fill." (no "below").
- DR11 (D10: 10A) The adapter note starts with an aria-hidden ◇ in ink: the key to the canvas mark.
- DR12 (D11: 11B) The diamond keeps its drawing size; on-screen sizing for all marks is a TODO
  (D12: A, added to docs/plan/brio-TODOS.md).

Ratings after: Pass 1 8/10; Pass 2 8/10; Pass 3 8/10; Pass 4 9/10; Pass 5 9/10 (the red marks'
shared stroke defect remains, TODO); Pass 6 9/10. Overall (lowest pass) 4/10 -> 8/10.

Journey storyboard:

```
  STEP | USER DOES                          | USER FEELS             | PLAN SPECIFIES?
  -----|------------------------------------|------------------------|----------------------------
  1    | picks a piece at a socket end      | "will this go on?"     | ◇ + "needs a male-male adapter"
  2    | presses R past the ordinary way    | in control             | R reaches the adapter way, last
  3    | places it                          | done                   | "...joined ... with a male-male adapter."
  4    | looks at the verdict               | reassured, not alarmed | kind unchanged; ◇ note in ink
  5    | scans the drawing                  | "where do they go?"    | ink diamonds; list rows name each
  6    | opens Your box                     | "do I have enough?"    | row + "Short by N" only when short
```

States:

```
  FEATURE          | EMPTY            | ERROR / CONFLICT          | SUCCESS            | PARTIAL
  -----------------|------------------|---------------------------|--------------------|---------------------------
  Adapter note     | absent at 0      | shown on refusals too     | "◇ Needs N ..."    | "+ N not marked" (red wins)
  Canvas mark      | none             | red mark wins the spot    | ink diamond        | none above the ceiling
  Strip glyph      | O fits           | X conflict (wins over ◇)  | ◇ with words       | n/a
  Your box row     | blank undeclared | "needs a number"          | "N in use"         | "Short by N" when short
```

NOT in scope (design): on-screen minimum size for marks (TODO, D12); a first-use explainer
(3B); an "enough owned" line (2B). What already exists and is reused: the notes list, the strip
status, the port-dot polarity language (filled peg, hollow socket), the inventory row pattern.

### Design implementation tasks

- [ ] **D-T1 (P2, human: ~1h / CC: ~10min)** — canvas — Ink diamond with a non-scaling 2px stroke and a filled inner diamond (DR5, DR8)
  - Files: app/src/TrackCanvas.tsx, app/src/app.css, app/src/tokens.css (ratio comment)
  - Verify: stylesheet-text spec on `.adapter-joint-mark` (stroke --ink, non-scaling, 2px); mark count specs unchanged
- [ ] **D-T2 (P2, human: ~1h / CC: ~10min)** — strip + note — ◇ glyph in ink for adapter fits; ◇ leading the note; `.num` on counts and piece numbers (DR6, DR9, DR11)
  - Files: app/src/App.tsx, app/src/VerdictLine.tsx, app/src/app.css
  - Verify: strip status reads "◇ Two sockets meet here..."; note markup has `.num` and an aria-hidden ◇; no '!' in the strip
- [ ] **D-T3 (P2, human: ~30min / CC: ~5min)** — note — "N not marked, because a clash is drawn there" when red wins (DR1)
  - Files: app/src/VerdictLine.tsx, app/src/verdictView.ts, app/src/App.tsx
  - Verify: the clash-on-adapter dom spec reads the clause; no clause when every adapter is marked
- [ ] **D-T4 (P3, human: ~15min / CC: ~3min)** — Your box — blank source cell; intro without "below" (DR4, DR10)
  - Files: app/src/Inventory.tsx
  - Verify: panel text has no "below" and no "adapter" in the source column

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present; UI: mark, glyph, note,  |
  |                      | box row, list phrase                        |
  | Step 0               | 6/10 initial; all 7 dimensions              |
  | Pass 1  (Info Arch)  | 8/10 → 8/10 after fixes (no issue)         |
  | Pass 2  (States)     | 6/10 → 8/10 after fixes                    |
  | Pass 3  (Journey)    | 7/10 → 8/10 after fixes                    |
  | Pass 4  (AI Slop)    | 8/10 → 9/10 after fixes                    |
  | Pass 5  (Design Sys) | 4/10 → 9/10 after fixes                    |
  | Pass 6  (Responsive) | 6/10 → 9/10 after fixes                    |
  | Pass 7  (Decisions)  | 1 resolved, 0 deferred (TODO logged)       |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (3 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 1 item proposed, 1 added                    |
  | Approved Mockups     | 0 generated (designer has no key), 0 approved|
  | Decisions made       | 11 added to plan                            |
  | Decisions deferred   | 0                                           |
  | Overall design score | 4/10 → 8/10                                 |
  +====================================================================+
```

Unresolved decisions: none.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 2 | CLEAR | 3 proposals, 3 accepted, 0 deferred |
| Outside Review | Codex (`codex exec`, plan review + design voices) | Independent 2nd opinion | 3 plan + 2 design | completed | plan: 6 findings, 6 resolved; design: 7 findings, 5 on this feature resolved, 2 pre-existing (caret motion, out of scope; rule 7 copy, fixed by 9A) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | ISSUES OPEN | 4 issues, 0 critical gaps (all 4 resolved: mapped work, not open defects) |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 | CLEAR | score: 4/10 → 8/10, 11 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** Codex completed the design-voice phase on 2026-10-23 (app UI, no hard rejections, 3 High, 1 Medium, 3 Low). A native Claude subagent ran alongside. Mockups unavailable: the gstack designer has no OpenAI key.
- **CROSS-MODEL:** Codex and the Claude subagent agree on the four mark/glyph findings (amber colour, groove contrast, scaling stroke, double-meaning '!'). The subagent alone raised the note-versus-marks count and the missing states; Codex alone raised `.num` and the positional copy. No disagreement remains.
- **VERDICT:** CEO + DESIGN CLEARED; eng review recorded ISSUES OPEN by rule (all findings resolved, 0 unresolved) — eng review required. The design fixes (D-T1 to D-T4) are not built yet.

NO UNRESOLVED DECISIONS
