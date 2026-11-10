# Parts from photos, and structure pieces (station, pier, tunnel)

Status: CEO review, scope agreed, spec review round 1 applied (2026-11-02). Nothing here is approved until its
ledger row says so.

## The ask (owner, verbatim)

> I want to be able to take pictures of a given track piece on milimeter paper
> (from all four sizes for example and have a process in which that piece is
> added to the library. If successful we can confirm and/or add all the basic
> track pieces. I also want to be able to add like this more complex pieces like
> for example an elevated train station that still has a footprint on layer 0
> (so no other track piece on layer 0 can pass through there), a normal medium
> straight on layer 1 and a rooftop on layer 2.

## Pre-review audit (what the repo says today)

- Parts: `PartKind` is straight | curve | multi-road | buffer
  (`engine/src/parts/schema.ts:205`). No general outline/footprint field; plank
  outlines are derived from centrelines (`overlap.ts:250`).
- Add a part: `app/src/SubmitPart.tsx` takes straight or curve only, typed
  numbers, status `userMeasured`; stored in `generic.library.submissions.v1`,
  validated per row by `looksLikePart` (`engine/data/library.ts:196-306`).
  Submissions can never rise (S1, `library.ts:91-139`).
- No photo, file or camera input anywhere. No backend, no vision API; static
  site on GitHub Pages; runtime deps react, react-dom, three only.
- Levels: `LEVEL_COUNT = 2` (`engine/src/graph/frames.ts:149`). Level is derived
  from ramps, not stored (L1). A ramp climbing to level 2 is a level fault
  (`frames.ts:181-209`).
- Overlap: same-level pairs only (`overlap.ts:188`); ramps clash on both levels
  (`overlap.ts:232-247`). Supports/piers not modelled (TODO "Support and pier
  modelling", `generic-TODOS.md:978`).
- 3D: `engine/src/view3d/mesh.ts` draws track, buffer beams, raised footprints,
  table slab. No buildings.
- Related TODOs: "A third layer" (`generic-TODOS.md:951`, text stale: levels are
  derived now), "Support and pier modelling" (:978), "Community custom-part
  registry" (:244), "Backend" P1 (:419), E9 photo-based inventory (:296).
- Joint give is 0.8mm / 1.5° (estimate until Q2, `engine/data/calibration.ts:106`).

## 0A. Premise challenge

**Real problem.** Two different problems share one sentence:

1. *Trust in the catalogue.* The Generic straights and curves come from the
   published guide; switches, crossings, ramps and third-party pieces are
   `unverified` (printed reproductions). The owner wants real pieces to confirm
   or correct them, without a caliper session per piece.
2. *Pieces that are not track.* An elevated station is track on level 1 plus
   wood on the floor that floor track cannot pass through, plus a roof. None of
   that is expressible today.

**Photo precision is the premise to check first.** [estimated] A phone 300mm
above the paper sees the top face of a 12mm plank 4% larger than the paper
grid (300/288). Scaled by the paper grid, a 144mm straight reads ~150mm: a 6mm
error, seven times a joint's give. Lens distortion and a non-frontal camera add
more. Any photo method must (a) take its scale at the plane it measures, or
(b) correct for the plank's height. The known 40mm plank width on the top face
is a free in-photo scale for that plane.

**What photos can and cannot confirm.** At ~0.5mm per click on a good photo,
a photo cannot beat the published straight lengths (already exact to the
catalogue). It CAN: catch a wrong piece class, measure switch and crossing
geometry (where our figures are weakest), measure third-party pieces, and give
outlines of non-track pieces (station footprint), where a millimetre does not
matter.

**Do-nothing cost.** Switch geometry stays unverified (each verdict says so);
no stations, bridges-with-piers or buildings; the owner keeps typing numbers
into Add a part.

**Rooftop on "layer 2".** The roof is not track. Nothing runs on it. Treating it
as a third track level would pull in the whole "A third layer" TODO (cap
enforcement, adjacent-vias rule, 3-way overlap). A roof is a height volume over
the level-1 deck: drawn in 3D, and it only matters if something tries to pass
over it (nothing can: there is no level 2 track).

## 0B. Existing code leverage

| Sub-problem | Reuse |
|---|---|
| Photo → numbers | `SubmitPart.tsx` already turns numbers into a stored, validated part with `userMeasured` status and a "correcting" id |
| Confirm a built-in | `resolveLibrary` trust ranking: userMeasured outranks published/unverified (`library.ts:110`) |
| Station deck | a medium straight `A` (144mm) |
| Station footprint blocking floor track | NEW CODE: polygon-vs-plank-quad test beside `findPlankOverlaps` (`overlap.ts:188`); today it only tests plank quads with level spans |
| Fixed-height ports | REUSE (C4 B): a structure spans [L, L+1] like a ramp's [lo, lo+rise] (`overlap.ts:232-247`, `frames.ts:123-140`); its footprint joins the lowest-point normalisation |
| Placing a portless pier | anchors make a portless component placeable (`model.ts:180`); route to confirm in eng review |
| 3D | buffer beams and raised footprints in `mesh.ts:346-373` are the pattern for boxes |

## 0C. Dream state

```
  CURRENT                         THIS PLAN                          12-MONTH IDEAL
  typed numbers, straight/curve   photo -> measured part,           any piece photographed
  only; switches unverified;      confirm built-ins; pieces with    by any user, measured,
  no buildings or piers           floor footprint + raised deck +   shared and corroborated;
                                  roof (stations, bridges w/ piers) stations/tunnels/piers
                                                                    in the catalogue; 3D shows
                                                                    the whole layout
```

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| R0 (owner) | Office hours before review | n/a | skip | approved | AUQ answer "Skip, review now (recommended)", 2026-11-02 |
| P1 (owner) | How a photo becomes measured figures. No backend, no vision API, bundle budget 139kB gz main chunk | B: owner photos measured in a Claude session, PR | (A in-app click-to-measure and C automatic CV declined) | approved | D1 answer "B) Measured in a session", 2026-11-02. Scope: the photo half is a process run by the owner and Claude; no app screen. Consequence: parts measured this way land as built-ins via PR, so they reach everyone. Pending for eng review: how pixel positions are read precisely (no PIL/OpenCV on this machine; only `sips`), and the photographing instructions with an engineering diagram (memory: measurements need diagrams) |
| M0 (owner) | Review mode | n/a | SELECTIVE EXPANSION | approved | D2 answer "Selective expansion (recommended)", 2026-11-02 |
| S1 (owner) | What "rooftop on layer 2" is in the model. `LEVEL_COUNT = 2` (`frames.ts:149`); third-layer TODO (`generic-TODOS.md:951`) | A: roof is a non-track height volume over the deck, drawn in 2D and 3D | (B third track level declined) | approved | D3 answer "A) Roof volume (recommended)", 2026-11-02. Levels stay two; third-layer TODO untouched |
| X1 (owner) | Expansion: bridge pier, a footprint-only piece under raised track | ADD | (defer, skip declined) | approved | D4 answer "A) Add (recommended)", 2026-11-02. Size estimated until photographed |
| X2 (owner) | Expansion: photograph and confirm switches, crossings and ramps (all `unverified` today), not just basic straights/curves | ADD | (defer, skip declined) | approved | D5 answer "A) Add (recommended)", 2026-11-02 |
| X3 (owner) | Expansion: tunnel, the inverse of a station: floor track passes through, a roof above, raised track may not | ADD | (defer recommended, declined by owner; skip declined) | approved | D6 answer "A) Add", 2026-11-02 (against the recommendation) |
| X4 (owner) | Expansion: raised track must stand on something (ramp, station or pier), TODO `generic-TODOS.md:978` | supports not checked | DEFER | deferred | D7 answer "B) Defer to TODOS (recommended)", 2026-11-02. Reason: the safe span length is unmeasured; piers must exist first |
| C1 (owner) | Spec review: what "confirm" does to a published part. userMeasured outranks published (`library.ts:110`); a photo cannot beat published lengths (0A) | A: published figure kept, photo agreement recorded as corroboration; only unverified figures, or published ones the photo contradicts beyond its uncertainty, are replaced | (B land every figure as measured, declined) | approved | D8 answer "A) Keep published (recommended)", 2026-11-02. Contradiction threshold: eng review |
| C2 (owner) | Spec review: when a photo figure is good enough to land | A: two independent photos (piece re-placed) agree within 0.5mm; the PR states each figure ± uncertainty; otherwise not landed | (B one photo, declined) | approved | D9 answer "A) Two agree ≤0.5mm (recommended)", 2026-11-02 |
| C3 (owner) | Spec review: heights (ramp rise, station deck) cannot come from a top-down photo | A: side-view photo against upright mm paper for every piece with height; a deck height that differs from the ramp rise beyond tolerance is noted on the part and refused for level 1 | (B heights stay estimates, declined) | approved | D10 answer "A) Side photos (recommended)", 2026-11-02 |
| C4 (owner) | Spec review: structures vs derived levels (`frames.ts:123-140`) | B: a structure spans two heights like a ramp: footprint at level L, deck at L+1; the existing lowest-piece-on-the-floor rule places it. Footprint counts toward the stretch's lowest point | (A pin an absolute level, declined) | approved | D11 re-asked after the owner's question exposed that the first framing of B was wrong (it assumed the footprint did not count); answer "B) Spans two heights (recommended)", 2026-11-02 |
| SEC1 (owner, Section 3) | Photos of the owner's home vs a PUBLIC repo (`gh repo view`: PUBLIC). Phone photos carry EXIF GPS location and whatever else is in frame | A: photos never committed; kept on the owner's machine and the session scratchpad; only figures + a reading record (photo ids, points, both readings, ±) go in the PR | (B commit with EXIF stripped, declined) | approved | D12 answer "A) Off the repo (recommended)", 2026-11-02. Includes: a .gitignore entry for the photo folder so a photo cannot be committed by accident |
| OV1 (outside #1) | Station after floor track gives no level fault | corrected | factual correction, Section 4 | approved (correction) | Outside voice #1 verified at `frames.ts:123-140`; no behaviour change |
| OV6 (outside #6) | Rollback claimed partial-load; actually whole-layout refusal | corrected: roll forward only | factual correction, Sections 1, 4, 9 | approved (correction) | Outside voice #6 verified at `layoutStore.ts:556`, `shareLink.ts:193` |
| OV3 (outside #3) | Two agreeing photos prove repeatability, not accuracy; 40mm-width rescale turns 0.5mm width error into ~1.8mm on 144mm | A: a published medium straight (144mm) beside the piece in every top photo, top faces in one plane, sets the scale; a reference not reading 144±0.5 rejects the photo | (B width rescale, C investigate declined) | approved | D13 answer "A) Reference straight (recommended)", 2026-11-02. Supersedes the 0A width-rescale idea |
| OV2 (outside #2) | A two-ended straight correction can replace a two-ended station (`library.ts:110`) | A: structures cannot be corrected by submissions, like rising parts; stored submissions targeting them dropped with a reason; mutation-proved test | (B leave as is, declined) | approved | D14 answer "A) Protect structures (recommended)", 2026-11-02 |
| OV4 (outside #4) | No structure-vs-structure check; welded-pair exemption is whole-piece (`overlap.ts:219`) | A: obstacle-vs-obstacle checks (footprint/body vs footprint/body per level); exemption only at the deck road's connector, not whole welded pairs | (B track only, declined) | approved | D15 answer "A) Obstacle checks (recommended)", 2026-11-02 |
| OV5 (outside #5) | Bent pass keeps only overlaps present after bending (`solve.ts:457`); footprints don't follow `bendRender` (`bendPose.ts:109`) | A: footprints and roofs transform with their piece's bend shift and enter both overlap passes | (B catalogue position, declined) | approved | D16 answer "A) Bend with piece (recommended)", 2026-11-02 |
| OV7 (outside #7) | Measured switch geometry may not fit 22.5° ports / road models (`schema.ts:323`) | A: a fitted model must match every port within 0.5mm, else the PR reports the mismatch and the part stays as it was; one switch proved before the batch | (B round in, declined) | approved | D17 answer "A) Fit or report (recommended)", 2026-11-02 |
| OV8 (outside #8) | Trust is one status per part (`schema.ts:80`); partial measurement could promote it | A: a part's status changes only when every required figure (heights included) passes C2; partial readings recorded | (B per-figure labels, declined) | approved | D18 answer "A) All-or-nothing (recommended)", 2026-11-02 |

## HOLD checks (part of SELECTIVE)

1. Complexity: ~13 files estimated, over 8. Fewer moving parts: the station is ONE
   new part kind (`structure`) carrying a deck road with ports fixed at level 1,
   floor footprints (polygons) and a roof box, rather than a composite of
   several parts welded together. A composite would need a grouping concept the
   graph does not have.
2. Minimum change: photo process (script + instructions + PRs) is independent of
   the station and ships first; the station needs schema, validation, level
   derivation (fixed-level ports), overlap (polygon vs plank), 2D draw, 3D boxes.
3. Invariants kept: levels stay two; submissions still cannot rise (S1 of the
   two-layer plan); verdict never refuses more than today for layouts without
   structures (differential over the 670-layout corpus).

### P1 comparison (answered D1 → B)

Commitment comparison:

```text
Commitment              | Source       | Current | A click-to-measure | B session + PR    | C automatic CV
Who can add a part      | ask          | anyone, typed | anyone in the app | owner only    | anyone
Photo leaves device     | static site  | n/a     | never              | into the repo/session | never
New dependency          | budget       | none    | none (4-pt homography, ~60 lines) | none | OpenCV.js ~8MB
Precision source        | 0A           | caliper | human clicks, ~0.5mm | my point reading, coarser | detection, fragile on wood grain
Parallax handling       | 0A           | n/a     | top-face 40mm width rescale | same, by hand | same
Footprint outlines      | station ask  | none    | click a polygon    | by hand           | contour detection
Built-ins for everyone  | ask          | PR      | export JSON -> PR  | PR directly       | export JSON -> PR
Effort                  |              |         | M                  | S                 | XL
```


## 0H outcome

Spec review round 1: score 6/10, 15 issues across completeness, consistency,
clarity and feasibility. Every issue was applied as a factual correction or
decided (C1–C4). Not re-reviewed by the subagent: `15 fixes unconfirmed by a
second review`, each checked against this text by the parent: issues verified
15 of 15.

## Accepted scope (working plan)

1. **Photo process (P1 B).** Owner photographs pieces on millimetre paper; Claude
   measures them in a session and opens a PR that adds a built-in, upgrades an
   unverified one to `userMeasured`, or records a photo confirmation on a
   published one without changing its figure (C1). A figure lands only when two
   photos agree within 0.5mm (C2); heights come from side-view photos (C3).
   Every top photo includes a published 144mm straight as the scale reference
   (OV3); a switch's fitted geometry must match within 0.5mm or is reported,
   never rounded (OV7); a part's status moves only when all its required
   figures pass (OV8). Photos never committed (SEC1). Covers straights and curves (the ask) and switches,
   crossings and ramps (X2). Needs: photographing instructions with an
   engineering diagram (memory: measurements need diagrams), a parallax rule
   (SUPERSEDED by OV3: the scale comes from a 144mm reference straight in frame, top faces in one plane), and a repeatable way to read
   pixel positions (eng review).
2. **Structure pieces (S1 A).** One new part kind carrying any of: roads with a
   fixed level (0 or 1) and their ports, floor footprints, and a roof volume
   (non-track, drawn in 2D and 3D). Levels stay two. What each blocks:

   | Piece | Level 0 | Level 1 |
   |---|---|---|
   | Elevated station | footprint blocks floor track | own deck road (medium straight); the rest of the body and roof block other level-1 track |
   | Bridge pier (X1) | footprint blocks floor track | nothing: raised track passes over |
   | Tunnel (X3, as answered in D6) | own floor road; the walls block other floor track | the roof blocks raised track crossing it |

   The S1 note "nothing passes over a roof" holds for the station; the tunnel
   roof is a level-1 obstacle, which D6's accepted option stated.
   First figures: estimated, status `unverified` (so verdicts using them say
   so) until the owner photographs a real piece through process 1.
   Structures: never correctable by submissions (OV2); checked against each
   other and against track per level, exempt only at the deck connector (OV4);
   footprints follow bends and enter both overlap passes (OV5).
3. **Format.** A new part kind appears in saved layouts and share links. Older
   app versions must refuse such a layout with a reason, never mis-draw it
   (eng review owns the mechanism; the loader already drops unknown part ids).
4. **Feasibility gate.** No repeatable pixel-reading method, no landing of any
   photo figure: finding one is the first eng-review task and gates X2.

## NOT in scope

- In-app click-to-measure and automatic CV (P1 A, C declined).
- A third track level (S1 B declined); the "A third layer" TODO stands.
- User-submitted structures: submissions stay straight/curve and cannot rise.
- Support check for raised track (X4, deferred to TODOS: span length unmeasured).

Document approval: owner answer "A) Approve, continue (recommended)", 2026-11-02
(documents only; implementation unapproved).

## 0I. Temporal interrogation

```
  HOUR 1 (foundations):  the pixel-reading method (gate). Without PIL/OpenCV the
                         options are a pure-TS JPEG decode (devDependency) with
                         grid-line intensity profiles, or Claude reading points
                         off sips crops. Decide and prove on one photo of a
                         straight whose length is known (144mm) BEFORE anything else.
  HOUR 2-3 (core logic): structure kind in schema + resolver; [L, L+1] span in
                         frames/overlap; polygon footprint vs plank quads,
                         level-aware (station/pier block level 0, tunnel walls
                         level 0 except its road, tunnel roof level 1).
  HOUR 4-5 (integration):every `kind === 'buffer'`-style branch (9 sites in 7
                         files) must learn the new kind; placement of a portless
                         pier; 2D drawing, 3D boxes, library preview.
  HOUR 6+ (polish/tests):670-layout differential unchanged; fixtures for each
                         row of the blocking table; the photo guide page with
                         its engineering diagram; first real photo PR.
```

Feasibility blockers: the pixel-reading gate (photo half only; the structure
half does not depend on it). Effort: photo process human ~3 days / CC ~3h;
structures human ~2 weeks / CC ~1 day.

# Review sections

## Current scope (Section 1 preamble)

Mode SELECTIVE EXPANSION (M0, D2). Accepted: P1 B, S1 A, X1, X2, X3, C1 A,
C2 A, C3 A, C4 B. Deferred: X4. Rejected: P1 A/C, S1 B, C1 B, C2 B, C3 B, C4 A.
Pending: none.

## Section 1: Architecture

```
  OWNER'S PHOTOS (local)            ENGINE (static site)
  top + side, 2 per piece           engine/src/parts/schema.ts  + kind 'structure'
        |                                 |   roads (offset 0|1), footprints (polygons),
        v                                 |   roof box; spans [L, L+1]
  scripts/photo* (gate method)            v
  homography from grid points     engine/data/structures.ts (station, pier, tunnel)
  scale from 144mm reference (OV3)       |
        |                                 +--> library.ts resolveLibrary (built-in only;
        v                                 |    looksLikePart still rejects structures)
  engine/data/photoReadings.ts           +--> graph/frames.ts  (span like a ramp, C4)
  (both readings, ± uncertainty)         +--> graph/overlap.ts (NEW polygon test,
        |                                 |    level-aware; existing quads untouched)
        v                                 +--> render.ts / TrackCanvas (2D outline+roof)
  PR: add / upgrade unverified /          +--> view3d/mesh.ts (boxes, like buffer beams)
      corroborate published (C1)          +--> previews, listing, ghost keys
```

Data flows:
- Photo -> figure. Happy: two photos agree <=0.5mm -> PR. Nil: no grid visible
  -> not measured, owner told which photo. Empty: piece outside the grid ->
  same. Error: readings disagree >0.5mm -> not landed, a third photo asked for.
- Layout -> verdict with a structure. Happy: placed, levels derived, overlaps
  tested. Nil: structure id unknown to an older bundle -> the loader's partial
  load notice (`layoutStore.ts:643`) names the dropped piece. Error: a ramp
  meets the deck at the wrong height -> existing level fault.

Coupling: the new kind touches every kind branch (9 sites, 7 files: model.ts,
pose.ts, render.ts, GraphListing.tsx, ghostKeys.ts, App.tsx, layoutModel.ts).
Justified: a structure is a part; a separate non-part layer would duplicate
placement, saving and sharing.

**WARNING A1:** a portless pier has no end to attach to; placement today is
append-at-the-cursor-end. The route (a new component via an anchor,
`model.ts:180`) is unproven in the UI. Owner: eng review; required check: a
pier placed beside a raised run, saved, reloaded, shared.

Rollback (CORRECTED, outside voice #6): roll forward only. Reverting the kind after visitors save structures clears their canvas (rescue slot keeps the bytes). Never remove a shipped part id. 10x/100x load: n/a (client-only, a few
structures per layout).

Elegance/platform: one `structure` kind with roads + footprints + roof makes
every later building (shed, crane, level crossing) a catalogue entry, no code.

Decision gate: no new choice needed; A1 goes to eng review with its check.

## Section 2: Error & Rescue Map

```
  CODEPATH                    | WHAT CAN GO WRONG                   | CLASS
  ----------------------------|-------------------------------------|----------------
  photo: grid detection       | grid lines not found / misread      | NoGrid
  photo: homography           | <4 usable grid points, near-collinear| Degenerate
  photo: parallax rescale     | top face width not visible          | NoTopFace
  photo: agreement (C2)       | two readings differ > 0.5mm         | Disagree
  photo: height (C3)          | side photo missing or tilted        | NoHeight
  structures.ts load          | self-intersecting / open polygon    | BadFootprint
  frames: span [L, L+1]       | deck meets a ramp at the wrong level| existing level fault
  overlap: polygon test       | footprint crosses floor track       | existing overlap verdict
  loader (older bundle)       | unknown structure id                | partial load notice

  CLASS        | RESCUED? | ACTION                                 | WHO SEES
  -------------|----------|----------------------------------------|----------------------
  NoGrid       | Y        | figure not measured; photo named       | owner, in the session
  Degenerate   | Y        | same                                   | owner
  NoTopFace    | Y        | same; guide says keep both edges in frame| owner
  Disagree     | Y        | not landed; third photo asked for      | owner
  NoHeight     | Y        | height stays estimated, labelled       | owner; verdict says estimated
  BadFootprint | Y        | test fails at build (built-ins only)   | CI, never a visitor
  level fault  | Y        | existing refusal text                  | visitor
  overlap      | Y        | existing "crosses" verdict, marked     | visitor
  unknown id   | Y        | partial load notice                    | visitor on a stale bundle
```

No GAP rows: every failure either stops the photo figure from landing (owner
sees why) or uses an existing visitor-facing path. Decision gate: no choice needed.

## Section 3: Security & Threat Model

| Threat | Likelihood | Impact | Mitigated? |
|---|---|---|---|
| Owner's photos (EXIF GPS, room contents) published in the public repo | Med | High | YES, SEC1 A (D12): photos never committed; a .gitignore entry for the photo folder |
| A photo file read in the session carries instructions (text in frame) | Low | Low | Treated as data; only point coordinates are taken from it |
| New part kind in share links: a crafted link with a forged structure | Low | Low | Structures are built-in only; a link carries part ids, unknown ids are dropped by the loader; `looksLikePart` still refuses non straight/curve submissions |
| New dependency for JPEG decoding (if the gate picks it) | Low | Med | devDependency only, never in the bundle; eng review names the package and checks it |
| Brand/source rule: PR text names a source | Low | Med | Memory "no individual sources": readings cite "the owner's photographs" only |

Decision gate: SEC1 asked and answered (D12 A); no other choice needed.

## Section 4: Data Flow & Interaction Edge Cases

```
  PHOTO -> GRID POINTS -> HOMOGRAPHY -> TOP-FACE RESCALE -> FIGURE -> AGREE? -> RECORD -> PR
   nil: no photo        <4 pts: Degenerate      no top face: NoTopFace      >0.5mm: Disagree
   blurry: NoGrid       collinear: Degenerate   side missing: NoHeight      dup piece: second
                                                                            pair becomes a
                                                                            third reading
```

No async state: the photo process is a session, and the engine is pure.

| Interaction | Edge case | Handled? | How |
|---|---|---|---|
| Append a station after floor track | no ramp before it | Y (CORRECTED by outside voice #1) | no fault: the footprint is the run's lowest point, so the whole run rises and the floor track is drawn at level 1, exactly as a descending ramp raises a floor loop today (`frames.ts:123-140`). Supports unchecked (X4) |
| Station in a closed loop, no ramps | whole loop rises to level 1 | Y | same as a raised loop today; supports unchecked (X4 deferred) |
| Two stations joined deck to deck | both decks level 1 | Y | same-level joint |
| Station, then two down ramps | deck pushed to level 2 | Y | existing third-level fault |
| Floor track under a station | footprint overlap | Y | NEW polygon test, existing crossing verdict |
| Raised track over a pier | allowed | Y | pier blocks level 0 only |
| Raised track over a tunnel | blocked | Y | tunnel roof blocks level 1 |
| Floor track through a tunnel on its own road | allowed | Y | the road is the tunnel's; walls block other floor track |
| Rotate/flip a station | footprint turns with it | Y | footprints are in part-local coordinates like ports |
| Remove a station mid-layout | its runs split | Y | existing remove-any-piece path |
| Undo after placing a structure | restores | Y | existing undo stack (graph snapshots) |
| Older bundle opens a link with a station | link refused | Y | unknown-part refusal (`shareLink.ts:193`); saved layouts only meet it on a revert, which is ruled out |
| Bend solver over a station | deck is a straight; give at its joints only | Y | structure roads are rigid like any part |

**WARNING E1:** a footprint that overlaps a ramp: a ramp spans both levels,
so floor-footprint vs ramp is an overlap. Correct physically (the ramp would
hit the station's legs) but must be in the fixtures. Owner: eng review.

Decision gate: no new choice needed.

## Section 5: Code Quality

- The new kind reaches 9 `kind ===` branches in 7 files (count above). Prefer an
  exhaustive `switch` with a `never` check at each, so the compiler lists every
  site; eng review owns the shape.
- Footprint polygons: reuse the plank-quad separating-axis test by treating a
  convex footprint as one more quad-like polygon; require convex footprints (a
  station body is a box), refuse concave ones at load. Avoids a general
  polygon library.
- Over-engineering watch: no general "composite part" grouping (HOLD check 1).

Decision gate: no new choice needed; shape decisions belong to eng review.

## Section 6: Test Review

```
  NEW THING                      | TYPE        | HAPPY                    | FAILURE                      | EDGE
  -------------------------------|-------------|--------------------------|------------------------------|-------------------
  structure kind in resolver     | unit        | station resolves         | concave footprint refused    | rotated/flipped
  [L, L+1] span (C4)             | unit        | ramp-station-ramp: 0,1,0 | station after floor track: fault | no ramps: loop at 1
  polygon vs plank (per table)   | unit        | floor track clear        | floor under station: crossing | ramp vs footprint (E1)
  tunnel road / walls / roof     | unit        | own road passes          | other floor track: crossing  | raised over roof: crossing
  pier                           | unit+dom    | raised over pier: fine   | floor through pier: crossing | placed alone (A1)
  verdict corpus                 | differential| 670 layouts unchanged    | any change fails             |
  2D/3D drawing                  | node markup | outline + roof drawn     |                              | flipped
  share link / reload            | dom         | station round-trips      | unknown id: notice           |
  photo method (gate)            | script test | 144mm straight reads 144±0.5 | tilted pair disagrees     | reference off 144±0.5: rejected (OV3)
  photo readings record          | unit        | every landed figure has 2 readings within 0.5mm | a single reading fails | corroboration only (C1)
```

Assertion notes: the photo-readings test pins C2 exactly (two readings,
|a−b| ≤ 0.5mm), not "at least one reading". no_claim for the photo method test:
it proves the script on one known photo, not every camera.

2am-Friday test: the differential (no layout without structures changes).
Hostile QA: a footprint exactly touching a plank edge (touching is not
crossing, same rule as planks today). Mutation rule from CLAUDE.md applies to
every pin.

Decision gate: coverage follows approved behaviour; no new choice.

## Section 7: Performance

Polygon tests add (structures × segments) checks per solve; a layout has a
handful of structures, so negligible next to the bend solver (650M budget). The
photo script runs offline. No issues found.

## Section 8: Observability

- `engine/data/photoReadings.ts` is the debug trail: per figure, both readings,
  photo ids (local names, not files), points, uncertainty, date. A wrong figure
  reported in three weeks is traceable to its two readings.
- Verdict wording names structure overlaps like any crossing ("piece 12, the
  station, crosses piece 4"), so a visitor's report is reproducible from a
  share link.
- Delight: the library card for a photo-confirmed part says "confirmed by
  photo" next to its figure.
No gaps found.

## Section 9: Deployment & Rollout

Static deploy via Pages; no migrations. Order: photo process (no app change)
can ship any time; structures ship in one PR wave behind no flag (built-in
catalogue entries; a layout without structures is unaffected, proven by the
differential). Rollback: roll forward only (outside voice #6); a revert would refuse every saved layout holding a structure. Post-deploy: open a share link with a station on
woodentrain.world in Chrome, check verdict and 3D. Risk window: a visitor on a
cached old bundle opens a new link with a station -> notice, not a crash.
No issues found.

## Section 10: Long-Term Trajectory

- Reversibility 3/5: once visitors save layouts with stations, removing the
  kind costs them pieces (partial load), so the schema addition is sticky.
- Debt: estimated structure dimensions until photographed (labelled
  `unverified`); X4 support check deferred; third-layer TODO text is stale
  (says "elevated boolean"): fix its wording when touched.
- Phase 2: support check (X4), more structures as catalogue entries, a level
  crossing. Platform: footprints are the first non-track obstacle.
- Cherry-pick retrospective: X1 pier is the cheapest, X3 tunnel brings the only
  level-1 obstacle rule; both fit the one kind. No rejected item is needed by
  an accepted one.

## Section 11: Design & UX

UI scope: new library section (Structures), previews, 2D outline + roof
hatching, 3D boxes, verdict wording.

```
  library: Structures section -> click station -> ghost at cursor end
     -> fits: drop (deck joined) -> verdict
     -> would raise the run: strip names it, preview shows it raised (design 4A)
     -> real level fault (third level): refused preview, existing red edge + reason
  pier: click -> placed as a new piece beside the cursor (A1, eng review) -> drag/rotate
```

| Feature | Empty | Error | Success | Partial |
|---|---|---|---|---|
| Station placement | n/a | level fault text | deck joined, outline drawn | dropped on stale bundle: notice |
| Pier placement | n/a | crossing marked | drawn under raised track | same |

Accessibility: the layout listing ("This layout, as a list") must name
structures and what they block. Consider running /plan-design-review for a
deep design review of this plan before implementation.

## Outside voice (Codex, plan-review, completed)

8 findings (#1-#6 High, #7-#8 Medium). Dispositions:
#1 corrected (OV1, factual), #6 corrected (OV6, factual: roll forward only),
#2 OV2 A, #3 OV3 A, #4 OV4 A, #5 OV5 A, #7 OV7 A, #8 OV8 A (D13-D18). 8 resolved,
0 unresolved. Cross-model: both reviews flagged the level model as the riskiest
seam; Codex additionally found the resolver, bend-pass and rollback facts this
review had wrong or missed.

## Remaining TODO choices

None new. X4 is already deferred (D7) and recorded in `generic-TODOS.md:978`.

Approval readiness: PASS. Checked rows and answers: R0 (AUQ skip), P1 (D1 B),
M0 (D2), S1 (D3 A), X1 (D4 A), X2 (D5 A), X3 (D6 A), X4 (D7 B, deferred),
C1 (D8 A), C2 (D9 A), C3 (D10 A), C4 (D11 B), SEC1 (D12 A), OV1/OV6
(factual corrections), OV3 (D13 A), OV2 (D14 A), OV4 (D15 A), OV5 (D16 A),
OV7 (D17 A), OV8 (D18 A). No pending rows.

## Reality rows

```
REALITY: premise-table finding unverified=1 (the 4% parallax figure is [estimated], to be measured by task P1) docs/plan/2026-11-02-photo-parts-and-stations.md:52
REALITY: already-done pass git log origin/main since 2026-11-02 shows only #110/#111, nothing on photos or structures cedcd44
REALITY: surface-check pass no CLI/route introduced; existing script reused scripts/verdictDiff.ts:1; repo visibility PUBLIC via gh repo view
REALITY: binding-decisions pass two-layer decisions honoured: levels derived (L1), submissions cannot rise (S1), LEVEL_COUNT 2 kept frames.ts:149
REALITY: numbers finding engine/data/calibration.ts:106 0.8mm/1.5° give [measured: calibration.ts:106, estimate until Q2]; 144mm [measured: engine/data/generic.ts:96]; 9 kind branches in 7 files [measured: grep]; ~13 files [estimated]; 4% parallax [estimated]
REALITY: deferred-asks pass no linked issue; the ask's layer 2 became a roof volume by D3 engine/src/graph/frames.ts:149
REALITY: pr-count pass engine/src/graph/frames.ts:123 default one PR per wave: wave 1 photo process (P1-P4), wave 2 structures (S1-S7), wave 3 photo data PRs (P5)
```
PLAN_REALITY: phase=ceo rows=7/7 missing=none unverified=1 verdict=complete

## What already exists

- `SubmitPart.tsx` + `resolveLibrary` trust ranking: reused for status rules (C1, OV8), not for photo input (P1 B).
- Ramp span `[lo, lo+rise]` in overlap and frames: reused for structures (C4 B).
- Plank-quad overlap and the bent-pass intersection rule (PR 109): extended, not replaced (OV4, OV5).
- Buffer beams / raised footprints in `mesh.ts`: pattern for 3D boxes.
- `verdictDiff.ts` 670-layout differential: the guard for every engine change.
- `calibration-sheet.html`: the pattern for the photo guide's drawings.

## Dream state delta

After this plan: owner-photographed figures with stated uncertainty flow into the
catalogue, switches can leave `unverified`, and three structures exist with
correct collision and height rules. Still short of the ideal: other visitors
cannot photograph pieces (in-app tool declined), supports are not checked (X4),
no level-2 track.

## Failure Modes Registry

```
  CODEPATH              | FAILURE MODE                  | RESCUED? | TEST?        | USER SEES?                 | LOGGED?
  ----------------------|-------------------------------|----------|--------------|----------------------------|--------
  photo grid reading    | grid not found / degenerate   | Y        | P1 script    | owner told in session      | readings record
  photo scale (OV3)     | reference not 144±0.5         | Y        | P1 script    | photo rejected             | readings record
  photo agreement (C2)  | readings differ > 0.5mm       | Y        | P4 unit      | not landed, third photo    | readings record
  switch fit (OV7)      | residual > 0.5mm              | Y        | P4 unit      | reported, part unchanged   | PR text
  partial figures (OV8) | height missing                | Y        | P4 unit      | status unchanged           | readings record
  resolver (OV2)        | correction targets structure  | Y        | S4 unit      | dropped with a reason      | n/a
  levels (C4)           | ramps push deck to level 2    | Y        | S2 unit      | existing third-level fault | n/a
  collisions (OV4/OV5)  | clash hidden by bend          | Y        | S3 unit      | crossing marked            | n/a
  old bundle            | unknown structure id in link  | Y        | existing     | unknown-part refusal       | n/a
  revert after ship     | saved layouts refused         | Y (rule) | n/a          | prevented: roll forward    | n/a
```
0 CRITICAL GAPS.

## Scope Expansion Decisions

Accepted: X1 pier, X2 switch/crossing/ramp photos, X3 tunnel. Deferred: X4
support check. Skipped: none. Full record: the CEO plan at
`~/.gstack/projects/raduuuuu-ChooChooCAD/ceo-plans/2026-11-02-photo-parts-and-stations.md`.

## Diagrams

Produced: system architecture (Section 1), photo data flow with shadow paths
(Section 4), error flow (Section 2), user flow (Section 11). No new stateful
object (no state machine needed). Deployment: static Pages, no sequence beyond
Section 9. Rollback: roll forward only (OV6).

Stale diagram audit: `frames.ts:123` level comment stays accurate under C4 B
(structures behave like ramps); the "A third layer" TODO text is stale
("elevated boolean"), noted in Section 10.

## Implementation Tasks

Synthesized from this review's findings.

- [ ] **P1 (P1, human: ~1d / CC: ~45min)** — photo — Prove a repeatable pixel-reading method on a photo of a known 144mm straight
  - Surfaced by: 0I gate, OV3. Verify: the reference reads 144±0.5 on two photos.
- [ ] **P2 (P1, human: ~4h / CC: ~30min)** — docs — Photo guide with an engineering diagram (top and side setups, reference straight, two photos per piece)
  - Surfaced by: P1 B, C2, C3, OV3. Verify: owner can follow it without questions.
- [ ] **P3 (P1, human: ~5min / CC: ~2min)** — repo — Ignore the photo folder
  - Surfaced by: SEC1. Verify: `git check-ignore photos/x.jpg`.
- [ ] **P4 (P1, human: ~4h / CC: ~30min)** — engine — Photo readings record with C1, C2, OV7, OV8 rules pinned
  - Verify: mutation-proved unit tests.
- [ ] **P5 (P2, human: ~2d / CC: ~2h)** — catalogue — First photo PRs: straights/curves, one switch proved, then the batch
  - Surfaced by: ask, X2, OV7. Verify: each PR lists both readings ± per figure.
- [ ] **S1 (P1, human: ~1d / CC: ~1h)** — engine — Structure kind, exhaustive kind switches
  - Files: schema.ts, model.ts, pose.ts, render.ts, GraphListing.tsx, ghostKeys.ts, App.tsx, layoutModel.ts. Verify: typecheck lists every site.
- [ ] **S2 (P1, human: ~4h / CC: ~30min)** — engine — Structures span [L, L+1]
  - Surfaced by: C4 B, OV1. Verify: ramp-station-ramp levels 0,1,0; no-ramp run rises.
- [ ] **S3 (P1, human: ~2d / CC: ~2h)** — engine — Collisions per the blocking table, obstacle vs obstacle, connector-local exemption, both bend passes
  - Surfaced by: OV4, OV5, E1. Verify: fixtures per table row, bent-loop fixture keeps the clash.
- [ ] **S4 (P1, human: ~2h / CC: ~15min)** — engine — Resolver refuses corrections targeting a structure
  - Surfaced by: OV2. Verify: mutation-proved test.
- [ ] **S5 (P2, human: ~2d / CC: ~2h)** — catalogue/app — Station, pier, tunnel entries with 2D, 3D, preview, listing
  - Verify: markup tests; browser check on woodentrain.world after deploy.
- [ ] **S6 (P2, human: ~4h / CC: ~30min)** — app — Place a portless pier
  - Surfaced by: A1. Verify: place, save, reload, share.
- [ ] **S7 (P1, human: ~1h / CC: ~10min)** — engine — 670-layout differential unchanged
  - Verify: `scripts/verdictDiff.ts` compare, zero changes.
- [ ] **T4 (P1, carried)** — analytics — GoatCounter, still waiting on the owner's site code.

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | 4 part kinds, 2 levels, no photo/backend,   |
  |                      | public repo, 9 kind branches in 7 files     |
  | Step 0               | P1 B session photos, S1 A roof volume,      |
  |                      | X1-X3 added, X4 deferred, C1-C4 decided     |
  | Section 1  (Arch)    | 1 issue (A1 pier placement -> eng)          |
  | Section 2  (Errors)  | 9 error paths mapped, 0 GAPS                |
  | Section 3  (Security)| 1 issue found (photos/EXIF), 1 High -> D12  |
  | Section 4  (Data/UX) | 13 edge cases mapped, 0 unhandled (1 corrected)|
  | Section 5  (Quality) | 2 issues found (exhaustive switch, convex)  |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 0 gaps found                                |
  | Section 9  (Deploy)  | 1 risk flagged (rollback, corrected)        |
  | Section 10 (Future)  | Reversibility: 3/5, debt items: 3           |
  | Section 11 (Design)  | 1 issue (listing must name structures)      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 9 rows, 0 CRITICAL GAPS                     |
  | Failure modes        | 10 total, 0 CRITICAL GAPS                   |
  | TODOS.md updates     | 1 item (X4 note on the support TODO)        |
  | Scope proposals      | 4 proposed, 3 accepted (SEL)                |
  | CEO plan             | written                                     |
  | Outside voice        | codex: completed, 8 findings, 8 resolved    |
  | Lake Score           | 9/9 recommendations chose complete option  |
  | Diagrams produced    | 4 (architecture, data flow, error, user flow)|
  | Stale diagrams found | 1 (third-layer TODO text)                   |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows, 1 unverified                      |
  +====================================================================+
```

### Unresolved Decisions

None.

# Eng review (2026-11-02)

Target: docs/plan/2026-11-02-photo-parts-and-stations.md (named in the
invocation). Source of truth for scope: the CEO plan of the same date; the
design doc the finder printed (share-and-polish.md) is unrelated.

## Eng scope record

feature answers: none proposed (every feature is CEO-approved);
structure: A Smaller arrangement (eng D1, 2026-11-02);
accepted scope: an optional `body` on parts, made of rectangles in the piece's
frame, each with a width, length, offset and a level range; emitted by
`render.ts` as segments flagged as body (the buffer-stop precedent,
`render.ts:123`), so overlap, bend transform, 2D and 3D reuse the segment
paths. Station and tunnel are a medium straight plus a body; the pier is one
new zero-end `block` kind with a body only. ~14 files, 2 new types (Body,
BlockPart).
pending remedies: E2 (photo pixel method), E3 (one source for a part's level range).

## Scope Challenge findings

1. [CRITICAL] (confidence: 8/10) docs/plan/2026-11-02-photo-parts-and-stations.md (0I HOUR 1, "the pixel-reading method (gate)") — no method exists to turn a photo into pixel coordinates on this machine: `python3 -c "import cv2"` and `import PIL` both fail; `sips` offers only `--cropToHeightWidth`/`--cropOffset`/`--resample*`. Every photo figure is blocked until one is chosen. Reviewer: native.
2. [INFORMATIONAL] (confidence: 8/10) engine/src/graph/frames.ts:135 `lowest.set(c, Math.min(lowest.get(c) ?? 0, levelOf(f)));` and engine/src/graph/overlap.ts:238 `const span = new Map<string, readonly [number, number]>();` — a piece's level range is worked out in two places (frames from the frame's level, overlap from the segment's level + rise). A body reaching one level below its deck (C4) must change both, a hand-synced pair (red flag 8). Reviewer: native.

## Decision ledger (eng)

### E2: how pixel positions are read from a photo
Finding: 1, CRITICAL, 8/10, plan 0I HOUR 1, native
Plan baseline: P1 B (CEO D1): Claude measures the owner's photos in a session; OV3 A: a 144mm reference straight in frame; C2 A: two photos agree within 0.5mm
Runtime evidence: no cv2, no PIL; sips crop/resample only (probe 2026-11-02)
Comparison grid:
| Choice | Current | A zoom crops + script | B JPEG decode + auto edges |
|---|---|---|---|
| E2 method | none | sips crops each point's neighbourhood at 4x; Claude reads the point inside the crop; a bun script does homography + figures from those points | jpeg-js devDependency; script finds grid lines and plank ends by intensity profiles |
| New dependency | none | none | one devDependency, never bundled |
| Accuracy guard | OV3, C2 | OV3 reference must read 144±0.5, C2 two photos | same |
| E3 | pending | pending | pending |
Question D2:
D2 — E2: How do I read exact pixel positions from your photos? (full brief as sent)
Header: E2 pixels
Options:
A) Zoom crops + script (recommended)
Effort S, risk low. sips cuts a small window around each point and enlarges it 4x; I read the point there; a script does the perspective maths and the figures. The 144mm reference must read 144±0.5 or the photo is rejected. No dependency.
B) Auto edge detection
Effort M, risk medium. A pure-JS JPEG decoder (dev-only) and a script that finds grid lines and plank ends itself. Repeatable, but wood grain and shadows can fool it; the reference check still guards it.

State: approved
Actual answer: A) Zoom crops + script (recommended), eng D2, 2026-11-02
Accepted scope: no new dependency; sips crops each point's neighbourhood at 4x, Claude reads the point inside the crop, a bun script computes the homography and figures from those points; a photo whose 144mm reference does not read 144±0.5 is rejected (OV3); figures land only per C2
History: none

### E3: one source for a piece's level range
Finding: 2, INFORMATIONAL, 8/10, frames.ts:135 and overlap.ts:238, native
Plan baseline: C4 B (CEO D11): a structure spans [L, L+1]; its footprint counts toward the run's lowest point
Runtime evidence: frames.ts:135 takes the lowest from `levelOf(f)`; overlap.ts:238-243 builds each piece's span from the segment's `level` and `rise`
Comparison grid:
| Choice | Current | A one helper | B patch both places |
|---|---|---|---|
| E3 | two places | `levelRange(part, turn)` in the part model returns [below, above] relative to the piece frame; frames' lowest and render's segment level/rise both read it | add body depth to frames.ts and to the body segments separately |
| E2 | approved A | approved A | approved A |
Question D3:
D3 — E3: Where does a piece's height range live? (full brief as sent)
Header: E3 levels
Options:
A) One helper (recommended)
Effort S, risk low. One function says how far a piece reaches below and above its frame (ramp: 0..rise, station body: -1..0); the floor rule and the collision spans both call it; a test pins that they agree.
B) Patch both places
Effort S, risk medium. Add the body's depth in frames.ts and in the body segments by hand. Same behaviour today; the next part kind can update one and forget the other.

State: approved
Actual answer: A) One helper (recommended), eng D3, 2026-11-02
Accepted scope: one `levelRange(part, turn)` giving each piece's reach below and above its frame; frames.ts lowest-point rule and render's segment level/rise (hence overlap spans) both read it; the ramp's existing span moves onto it; a catalogue-wide test pins that the two agree
History: none

## Section 1: Architecture (eng)

Design twice: shape 1 = a separate `structure` kind with polygon collisions
(original); shape 2 = `body` rectangles emitted as segments (buffer
precedent). Picked shape 2 (D1): it hides collision, bending and drawing
behind the existing segment interface, a deeper module for the same surface.

Findings:
3. [CRITICAL] (confidence: 8/10) engine/src/graph/render.ts:123 `if (part.kind === 'buffer') {` pushes body wood into the same `segments` list as track; 17 non-test files use render segments (grep, excluding bendWords.ts whose `segments` are text pieces, bendWords.ts:103): TrackCanvas, App, overlap, render, layoutModel, mesh, fk, solve, bendPose, BuildMode, previewGeometry, tableModel, LayoutThumb, buildSteps, assembly, editorReducer, VerdictLine. Some mean "all wood" (overlap and its bent pass, table fit, 2D, 3D, thumbnails, previews), some mean "track" (build steps, assembly, the segment-count ceiling); the exact split is part of the work. Mixing body rectangles into the track list makes every track-only consumer silently wrong until audited. Reviewer: native.
4. [INFORMATIONAL] (confidence: 9/10) app/src/layoutModel.ts:164-170 — WITHDRAWN by outside voice #2 (see EO2): the anchor half is right, but `newGhost` (editorReducer.ts:431) gives a free ghost `port: 0` and `moveRun` pivots on port 0 (layoutModel.ts:727), so a zero-end pier has no working placement or move. CEO WARNING A1 stands as EO2.
5. [INFORMATIONAL] (confidence: 8/10) red flag 8 (hand-synced list): a photographed figure would live in the part (generic.ts) and in its readings record. Required proof of C2 (CEO D9): a test that every part whose status came from photos equals its readings' agreed value. Carried, no new choice.

### E4: where body rectangles go in the render output
Finding: 3, CRITICAL, 8/10, render.ts:123, native
Plan baseline: D1 A (bodies emitted as segments, reusing overlap/bend/draw)
Runtime evidence: buffer bodies share `segments`; 2 consumers special-case `stop` (TrackCanvas.tsx:1508, mesh.ts:374); the others treat it as track
Comparison grid:
| Choice | Current | A separate `bodies` list | B flag in `segments` |
|---|---|---|---|
| E4 | n/a | render returns `bodies: Segment[]` beside `segments`; overlap, bend, 2D, 3D, table fit, thumbnails, previews opt in by reading both; track-only consumers untouched | body rectangles in `segments` with a `body` flag; all 18 consumers audited |
| D1 | approved A | kept: same Segment type, same transforms | kept |
| E2, E3 | approved | unchanged | unchanged |
Question D4:
D4 — E4: Do building bodies share the track's segment list? (full brief as sent)
Header: E4 bodies
Options:
A) Separate bodies list (recommended)
Effort S, risk low. render returns bodies beside segments, same Segment type; consumers that mean all wood (overlap and both bend passes, 2D, 3D, table fit, thumbnails, previews) read both; track-only consumers never see a body. Tests pin that each opt-in consumer includes bodies.
B) Flag in segments
Effort M, risk medium. Bodies go in the existing list with a flag, like the buffer stop; all 17 consumers are audited and given a case.

State: approved
Actual answer: A) Separate bodies list (recommended), eng D4, 2026-11-02
Accepted scope: render returns `bodies: Segment[]` beside `segments` (same type, same bend transform); overlap (both passes), 2D, 3D, table fit, thumbnails and previews read both; track-only consumers unchanged; tests pin each opt-in consumer
History: none

Dispositions (Section 1): finding 3 accepted as E4 A (D4); finding 4 factual
correction (A1 closed); finding 5 carried as required proof of C2.

```
  Part (schema.ts)                          render.ts
  ├─ straight/curve/multi-road/buffer       ├─ segments  (track; unchanged readers)
  ├─ block  (NEW, zero ends, pier)          └─ bodies    (NEW, rectangles as Segment)
  └─ body?: BodyBox[] (NEW)                        │
       each: length, width, offset, levels         ├─> overlap.ts  both passes (solve.ts:457)
  levelRange(part, turn)  (NEW, E3) ──┐            ├─> bendPose.ts bendSegments(bodies, shifts)
       ├─> frames.ts lowest rule      │            ├─> TrackCanvas outline + roof hatch
       └─> render level/rise ─────────┘            ├─> mesh.ts boxes
                                                   └─> tableModel / LayoutThumb / previews
```

## Section 2: Code quality (eng)

6. [INFORMATIONAL] (confidence: 8/10) app/src/App.tsx:151 `if (part.kind === 'buffer') return \`${part.lengthMm}mm\`;` and app/src/GraphListing.tsx:70 `if (part.kind === 'buffer') return 'end';` — the new `block` kind meets the same if-chains (9 `kind === 'buffer'` sites in 7 files). Mechanics of D1: write each as an exhaustive `switch` with a `never` default so the compiler lists every site. No new choice.
7. [INFORMATIONAL] (confidence: 8/10) engine/src/graph/overlap.ts:225-230 `for (const w of graph.welds) exempt.add(pairKey(w.a.pieceId, w.b.pieceId));` — welded pairs are exempt wholesale. OV4 A (CEO D15) already narrows this: exemption applies to plank-vs-plank only; a body rectangle is never exempt from its neighbour. Carried.
8. [INFORMATIONAL] (confidence: 7/10) engine/src/graph/overlap.ts:261 `plankQuads(s, plankHalfWidth(s.partId), s.pieceId)` — half-width comes from the part; body rectangles carry their own width. The body Segment needs a `halfWidthMm` read before `plankHalfWidth`. Mechanics of D1/E4. No new choice.

No error-handling gaps beyond the CEO Error & Rescue Map (Section 2 above):
built-in-only bodies are validated at load by a catalogue test (rectangle with
positive length/width, level range within [-1, 1]).

Dispositions (Section 2): 6, 8 mechanics of approved D1/E4; 7 carried from OV4.

## Section 3: Tests (eng)

Framework: vitest (CLAUDE.md "## Testing"), node + dom projects.

```
CODE PATHS                                              USER FLOWS
[+] engine/src/parts (levelRange, E3)                   [+] Place a station
  ├── [GAP] ramp 0..rise unchanged (refactor)             ├── [GAP] after a ramp: deck joins, levels 0,1
  ├── [GAP] station body -1..0                            ├── [GAP] after floor track: run rises (OV1)
  └── [GAP] frames lowest == render span, every part      └── [GAP] [→E2E dom] place, save, reload, share link
[+] render.ts bodies (E4)                               [+] Place a pier (block)
  ├── [GAP] station: deck in segments, body in bodies     ├── [GAP] new run at nextRunAnchor, move with run drag
  ├── [GAP] pier: no segments, body only                  └── [GAP] raised track over it: no crossing
  └── [GAP] flipped/rotated body follows the piece      [+] Tunnel
[+] overlap.ts (OV4, blocking table)                      ├── [GAP] floor track through own road: fine
  ├── [GAP] floor track under station: crossing           ├── [GAP] other floor track into wall: crossing
  ├── [GAP] pier vs pier, pier vs station: crossing       └── [GAP] raised track over roof: crossing
  ├── [GAP] welded neighbour plank vs body: not exempt  [+] Bend (OV5)
  ├── [GAP] ramp vs station footprint (E1): crossing      └── [GAP] bent loop with a station clash keeps it
  └── [GAP] touching edge: not a crossing               [+] Older bundle
[+] library.ts (OV2)                                      └── [★★ TESTED] unknown-part refusal (shareLink tests)
  └── [GAP] correction targeting a body part dropped
[+] photo readings (P4: C1, C2, OV7, OV8)
  ├── [GAP] two readings within 0.5mm land; 0.6mm not
  ├── [GAP] published figure kept, corroboration added (C1)
  ├── [GAP] fit residual >0.5mm reported, part unchanged (OV7)
  ├── [GAP] height missing: status unchanged (OV8)
  └── [GAP] part figure == readings' agreed value (finding 5)
[+] photo script (E2)
  └── [GAP] reference 144±0.5 accepted, 145.0 rejected
[+] verdict corpus
  └── [★★★ TESTED] scripts/verdictDiff.ts over 670 layouts: zero changes required

COVERAGE: 1/27 paths tested today (all new code)  |  GAPS: 26 (1 E2E-style dom flow)
```

REGRESSION (iron rule): E3 moves the ramp's span onto `levelRange`; behaviour
to preserve: every existing layout's verdict, levels and crossings. Contract:
the 670-layout differential shows zero changes (CEO HOLD check 3, carried),
plus the existing ramp/level suites unchanged. Intended differences: none for
layouts without bodies or blocks. No new question: this is the approved
invariant.

Value cards (main ones):
- Value: protects=floor rule and collision spans agree for every catalogue part; fails_when=levelRange is bypassed in frames or render; why_new=no test ties frames.ts to overlap spans; seam=none; no_claim=none beyond protects
- Value: protects=a station clash survives the bent pass; fails_when=bodies skip bendSegments or the second overlap pass; why_new=bentOverlap.test.ts covers planks only; seam=none; no_claim=real-floor bend amounts (fixture loop)
- Value: protects=a photo figure lands only with two readings within 0.5mm; fails_when=the agreement check is removed or loosened; why_new=nothing records readings today; seam=none; no_claim=camera accuracy (readings are fixtures)

Tests to retire: none.

Dispositions (Section 3): all gaps are required proof of approved behaviour
(D1, E3, E4, C1, C2, C4, OV2, OV4, OV5, OV7, OV8); no new choice.

## Section 4: Performance (eng)

Bodies add a handful of rectangles per structure to the overlap grid
(CELL = 100mm, overlap.ts:252): negligible next to the bend solver's 650M-unit
budget (bendRun.ts). The photo script runs offline, ~10 sips crops per photo.
No issues found.

## Outside voice (eng pass, Codex, completed)

7 findings (#1-#3 High, #4-#7 Medium), each verified in code by the parent:
#1 overlap.ts:238 `span.set(s.pieceId, ...)` per segment, last wins; #2
editorReducer.ts:431 `port: 0` and layoutModel.ts:727 `portFrame(..., 0)`;
#3 layoutModel.ts:486 `if (ends.some((e) => levelOf(e.at) !== 0))`; #4
solve.ts:72 `const count = forest.roots.length;`; #5 BuildMode.tsx:440
pictureOf filters segments only; #6 TrackCanvas.tsx:800
`segments.length > CANVAS_SEGMENT_CEILING`; #7 the E2 test checks supplied
numbers, not the crop-and-read path.

| ID | Finding | Proposed (A Apply) | Status | Answer |
|---|---|---|---|---|
| EO1 | one span per piece; bodies at other levels clash by emission order | per-shape level ranges through collisions; `levelRange` (E3) stays the aggregate for the floor rule only | approved | D5 "A) Apply (recommended)", 2026-11-02 |
| EO2 | pier cannot be placed or moved (port 0) | explicit unattached placement for zero-end parts; run moves pivot on the root frame when the grabbed piece has no ends | approved | D6 "A) Apply (recommended)", 2026-11-02 |
| EO3 | preview skips the whole-run relevel check for a station | run the relevel check when the part's `levelRange` reaches below 0, not only for raised ports | approved | D7 "A) Apply (recommended)", 2026-11-02 |
| EO4 | a pier counts as an unfinished track run | components made only of zero-end parts are excluded from run/loop reporting | approved | D8 "A) Apply (recommended)", 2026-11-02 |
| EO5 | build mode would show every structure from step 1 | bodies follow their piece's build visibility, highlight and camera bounds | approved | D9 "A) Apply (recommended)", 2026-11-02 |
| EO6 | drawing ceiling ignores bodies | the ceiling counts segments + bodies | approved | D10 "A) Apply (recommended)", 2026-11-02 |
| EO7 | photo gate never measures a known piece end to end | gate passes only when a known part not used as the reference (a 216mm long straight) reads within 0.5mm through the full crop-and-read path | approved | D11 "A) Apply (recommended)", 2026-11-02 |

Cross-model: the native eng pass and Codex agree that bodies must stay out of
track-only readers (E4) and that the level rule is the riskiest seam. Codex
alone found the per-piece span overwrite, the port-0 placement and move, the
ramp-only relevel trigger, the run summary, build mode and the drawing ceiling,
and the missing end-to-end photo trial. Native alone found the 17-reader
classification (E4) and the hand-synced readings record (finding 5). One native
factual correction (A1) was wrong and is withdrawn (EO2).

## TODO choices (eng)

None new: every gap was approved into scope (EO1-EO7) or is the CEO-deferred
X4 already in `generic-TODOS.md:978`.

Approval readiness: PASS. Checked: D1 structure (eng D1 A), E2 (D2 A),
E3 (D3 A), E4 (D4 A), EO1 (D5 A), EO2 (D6 A), EO3 (D7 A), EO4 (D8 A),
EO5 (D9 A), EO6 (D10 A), EO7 (D11 A); CEO rows carried unchanged. Regression
contract: the 670-layout differential (CEO HOLD check 3), carried.

## Reality rows (eng)

```
REALITY: premise-table finding unverified=1 (crop-reading precision ±3px is [estimated] until the EO7 trial) docs/plan/2026-11-02-photo-parts-and-stations.md:650
REALITY: already-done pass git log origin/main since 2026-11-02: only #110/#111, nothing on bodies or photos engine/src/graph/render.ts:123
REALITY: surface-check pass sips --cropToHeightWidth/--cropOffset verified by sips --help; scripts/verdictDiff.ts exists scripts/verdictDiff.ts:1
REALITY: binding-decisions pass CEO D1-D18 carried; L1 derived levels kept engine/src/graph/frames.ts:123
REALITY: numbers finding 17 segment readers [measured: grep]; 9 kind branches [measured: grep]; ~14 files [estimated]; ±3px [estimated] engine/src/graph/overlap.ts:238
REALITY: deferred-asks pass no linked issue; X4 deferred with trigger docs/plan/generic-TODOS.md:978
REALITY: pr-count pass three waves: photo gate+guide, bodies+block, photo data PRs engine/src/graph/solve.ts:72
```

PLAN_REALITY: phase=eng rows=7/7 missing=none unverified=1 verdict=complete

## NOT in scope (eng)

- Auto edge detection for photos (E2 B declined): wood grain fools it, needs a dependency.
- General polygon footprints (D1 B declined): rectangles cover station, pier, tunnel.
- A `body` flag inside `segments` (E4 B declined): opt-in list instead.
- Support check for raised track: CEO X4, deferred.

## What already exists (eng)

- Buffer body as a segment (`render.ts:123`): the pattern for bodies (D1).
- `clipConvex` and the overlap grid (`overlap.ts:157`, `:252`): rectangles fit as-is.
- `bendSegments` (`bendPose.ts`): applied to the bodies list too (OV5).
- New-run anchoring (`layoutModel.ts:164-170`, `nextRunAnchor`): the pier's run anchor; placement and move need EO2's branches.
- The 670-layout differential (`scripts/verdictDiff.ts`).

## Failure modes (eng)

| Path | Realistic failure | Test | Handling | User sees |
|---|---|---|---|---|
| levelRange refactor (E3) | ramp span shifts | differential + ramp suites | n/a | nothing (caught pre-merge) |
| per-shape spans (EO1) | footprint checked at deck level | blocking-table fixtures | n/a | crossing marked correctly |
| pier placement (EO2) | port-0 crash | dom pick/drop/drag/undo | branch for zero-end parts | pier placed |
| station preview (EO3) | silent run lift | ghost test | relevel check | preview names the lift |
| run summary (EO4) | false "not a loop" | loop+pier fixture | filter | closed loop |
| build mode (EO5) | buildings early | step test | filter | building at its step |
| ceiling (EO6) | freeze on many bodies | ceiling test | refusal screen | "too big to draw" |
| photo gate (EO7) | systematic error | 216mm trial | gate | figure not landed |

0 critical gaps.

## Worktree parallelization strategy

| Step | Modules touched | Depends on |
|---|---|---|
| P: photo gate, guide, readings | scripts/, docs/, engine/data/ (readings), .gitignore | — |
| S1: levelRange refactor (E3) | engine/src/parts, engine/src/graph | — |
| S2: bodies + block kind (D1, E4, EO1) | engine/src/parts, engine/src/graph, engine/src/view3d | S1 |
| S3: app wiring (EO2-EO6) | app/src | S2 |
| S4: catalogue entries | engine/data | S2 |

Lane A: P (independent). Lane B: S1 → S2 → S3 + S4. Launch A + B together;
S3 and S4 may run in parallel after S2. Conflict flags: engine/data is touched
by P (readings) and S4 (structures): different files, merge P first.

## Implementation Tasks (eng)

- [ ] **E-T1 (P1, human: ~4h / CC: ~30min)** — photo — Crop-and-read script (E2) + EO7 trial on a 216mm straight
  - Surfaced by: E2, EO7. Files: scripts/ (new). Verify: 216±0.5 on two photos.
- [ ] **E-T2 (P1, human: ~2h / CC: ~15min)** — engine — `levelRange` helper; frames and render read it
  - Surfaced by: E3. Files: engine/src/graph/frames.ts, engine/src/graph/render.ts. Verify: differential zero changes; agreement test.
- [ ] **E-T3 (P1, human: ~1d / CC: ~1h)** — engine — `body` rectangles, `block` kind, `bodies` list, per-shape spans, both bend passes
  - Surfaced by: D1, E4, EO1, OV4, OV5. Files: engine/src/parts/schema.ts, engine/src/graph/render.ts, engine/src/graph/overlap.ts, engine/src/graph/solve.ts, engine/src/graph/bendPose.ts, engine/src/geom/fk.ts. Verify: blocking-table fixtures, bent-loop clash.
- [ ] **E-T4 (P1, human: ~4h / CC: ~30min)** — app — Pier placement and move (EO2); station preview relevel (EO3)
  - Files: app/src/editorReducer.ts, app/src/layoutModel.ts. Verify: dom tests.
- [ ] **E-T5 (P1, human: ~2h / CC: ~15min)** — engine — Run summary skips end-less components (EO4)
  - Files: engine/src/graph/solve.ts. Verify: loop + pier fixture.
- [ ] **E-T6 (P2, human: ~4h / CC: ~30min)** — app — Bodies in 2D, 3D, build mode (EO5), ceiling (EO6), thumbnails, previews, table fit
  - Files: app/src/TrackCanvas.tsx, engine/src/view3d/mesh.ts, app/src/BuildMode.tsx, app/src/LayoutThumb.tsx, app/src/previewGeometry.ts, app/src/tableModel.ts. Verify: markup tests per consumer.
- [ ] **E-T7 (P1, human: ~1h / CC: ~10min)** — engine — Resolver refuses corrections to parts with a body (OV2)
  - Files: engine/data/library.ts. Verify: mutation-proved test.
- [ ] **E-T8 (P2, human: ~4h / CC: ~30min)** — catalogue — Station, pier, tunnel entries (unverified estimates)
  - Files: engine/data/ (new structures file). Verify: catalogue body validation test.

## Completion summary (eng)

- Step 0: Scope Challenge — scope accepted as-is (smaller arrangement, D1)
- Reality rows: 7/7 applicable rows emitted (PLAN_REALITY complete), 1 unverified premise
- Architecture Review: 3 issues found (findings 3, 4 withdrawn→EO2, 5)
- Code Quality Review: 3 issues found (6, 7, 8)
- Test Review: diagram produced, 26 gaps identified (all required proof of approved behaviour)
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items proposed to user
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex, completed, 7 findings, 7 resolved
- Parallelization: 2 lanes, 2 parallel / 3 sequential
- Lake Score: 2/2 (D3 and D4 were scored for completeness; both answers took the 10/10 option)

# Design review (2026-11-02)

Target: this plan (named in the invocation). DESIGN.md (13 rules) governs.
Mockups: not generated (designer: "No image API key found"; key never handled).
Outside voices: codex (completed) + Claude subagent (completed).
Factual correction: "level fault: red ghost" (Section 11) means the existing
refused-preview look, `.ghost.is-red` red edge + fail glyph (`app.css:1647`),
never tinted wood. No new treatment.

## Design decisions

| # | Decision | Answer |
|---|---|---|
| 1 | Canvas drawing of bodies: body = flat `--slab-side` fill, 1px `--ink-soft` edge, never wood, never filled ink, never dashed, no shadow (only track casts one). Roof = diagonal ink hatch only, no fill. Draw order: floor, bodies, floor track, roof hatch, raised track, faults and selection. Two new DESIGN.md rule-11 lines, each with its measured contrast (rule 5). | 1A, 2026-11-02 |
| 2 | Library: a Structures group after every track group. Each card: ink drawing to the same scale as track cards (body a thin ink rectangle, roof hatch at card scale), size, one functional line (station 'Raised road', tunnel 'Floor road', pier 'No track connections'), and 'Estimated size' under the name while the part is unverified. | 2A, 2026-11-02 |
| 3 | Pier: picking it shows the preview free at the next-run spot; placing it leaves it selected with the strip line 'Pier placed. Move it with the arrows, R to turn, or drag it.'; the dashed cursor stays where it was; selection = 3px `--ink` around the body over the paper halo; the existing move/rotate buttons (App.tsx:1129-1134), drag and announcements are reused. | 3A, 2026-11-02 |
| 4 | Station lift: while a station preview would raise a run, the strip says 'Placing this station raises this run of track (N pieces). Add a ramp to keep the rest on the floor.' The preview draws the affected run at its new height with its shadows. One click places; Undo reverses. Section 11's 'place a ramp first' is replaced by this. | 4A, 2026-11-02 |
| 5 | Building clashes keep the fail glyph and colour; the sentence names the building part and says 'Move either piece', never crossing/ramp advice: e.g. 'Piece 4 runs into the station's footprint (piece 12). Move either piece.', 'Raised track at piece 4 hits the tunnel roof (piece 9). Move either piece.', and the same shapes for a tunnel wall and a pier. Layout list: 'Piece 12: Elevated station, road raised, footprint on the floor'; 'Piece 7: Bridge pier, no track connections'. Floor/raised words only (rule 7 test). | 5A, 2026-11-03 |
| 6 | Build mode: `assemblyOrder` (assembly.ts:59) reads each piece's height from `levelRange` (E3), so piers join the floor band and stations come before the raised track joining their decks; a body appears at its piece's step with the 3px next-piece edge (rule 12); a pier's card shows name, code and 'Stand it on the floor. Nothing clips onto it.' with no ring. | 6A, 2026-11-03 |
| 7 | 3D: bodies matte in the 2D body colour (`--slab-side`) with `--ink-soft` edges; a roof is its outline plus a thin rim, never solid, so the deck and a train stay visible from every angle; no roof toggle. | 7A, 2026-11-03 |
| 8 | Photo guide: its own sheet, `docs/photo-guide.html`, A4/Letter, greyscale-safe, tokens.css colours, IBM Plex, the identity line. Five task headings, each with its drawing: Lay out the reference, Photograph from the top, Photograph the side, Move the piece and repeat, Check the 216mm trial; a 'What a rejected photo looks like' box; 'Not to scale' on schematic drawings. Owner addition: photos work on ANY standard millimetre paper (store-bought graph paper); the guide never requires a printed grid. Sound because the scale comes from the 144mm reference straight (OV3), not from the paper's printed spacing; the grid only fixes perspective. | 8A + owner note 'also allow users to do the photos on standard millimeter paper', 2026-11-03 |
| 9 | A part whose every required figure has an agreeing photo shows 'Confirmed by photo' in `--ink-soft` under its size on the library card; no colour, no icon; partly photographed parts show nothing new (OV8). | 9A, 2026-11-03 |

Pass 6 (responsive and accessibility): phones stay view-only for editing
(existing design 18A); the friend's screen and thumbnails draw bodies through
the E4 opt-in list; the pier reuses the existing 44px-floor move buttons
(rule 10) and announcements; the layout list carries the building words
(decision 5). No new issue.

Pass 7 (unresolved): none. A stale bundle meeting a structure uses the
existing unknown-part refusal; photo rejection reasons live in the guide's
rejected-photo box (decision 8).

## NOT in scope (design)

- A roof toggle in 3D (7B declined): roofs are frames instead.
- Snapping a pier under raised track (3B declined): moved with the existing tools.
- Refusing a station without a ramp (4B declined): contradicts C4.
- Photo guide inside the calibration sheet (8B declined).

## What already exists (design)

- DESIGN.md rules 1, 2, 5, 7, 10, 11, 12; `tokens.css` (`--slab-side`, `--ink-soft`, `--ghost-opacity`, `--fail`).
- Refused preview `.ghost.is-red` (app.css:1647) and red fault marks (app.css:1666).
- Run move strip and Rotate (App.tsx:1129-1134), drag, announcements.
- Part-card ink drawings (part previews, rule 11) and the unverified-brand note.
- Build-mode height bands (assembly.ts:54) and rule-12 sizes.
- The calibration sheet's drawing approach (docs/calibration-sheet.html), restyled.

## Implementation Tasks (design)

- [ ] **D-T1 (P1, human: ~3h / CC: ~20min)** — canvas — Body fill, roof hatch, draw order; two DESIGN.md rule-11 lines with measured contrast
  - Surfaced by: decision 1. Files: app/src/TrackCanvas.tsx, app/src/app.css, app/src/tokens.css, DESIGN.md. Verify: CSS-as-text pins (CLAUDE.md), contrast comment.
- [ ] **D-T2 (P2, human: ~3h / CC: ~20min)** — library — Structures group last, card drawing, functional line, 'Estimated size', 'Confirmed by photo'
  - Surfaced by: decisions 2, 9. Files: app/src/ (library cards, previewGeometry). Verify: markup tests.
- [ ] **D-T3 (P1, human: ~3h / CC: ~20min)** — app — Pier preview, placed-and-selected, strip line, selection outline
  - Surfaced by: decision 3. Files: app/src/App.tsx, app/src/TrackCanvas.tsx. Verify: dom test pick, place, arrow-move, R, undo.
- [ ] **D-T4 (P1, human: ~2h / CC: ~15min)** — app — Station-lift strip sentence and raised preview
  - Surfaced by: decision 4. Files: app/src/App.tsx, app/src/layoutModel.ts. Verify: dom test; copyPosition test passes.
- [ ] **D-T5 (P1, human: ~3h / CC: ~20min)** — verdict — Building clash sentences and layout-list lines
  - Surfaced by: decision 5. Files: app/src/VerdictLine.tsx, app/src/GraphListing.tsx. Verify: unit tests per sentence; copyPosition test.
- [ ] **D-T6 (P2, human: ~2h / CC: ~15min)** — build — Band order from levelRange, pier step card
  - Surfaced by: decision 6. Files: engine/src/graph/assembly.ts, app/src/BuildMode.tsx. Verify: order test (pier before raised track over it).
- [ ] **D-T7 (P2, human: ~3h / CC: ~20min)** — 3D — Matte bodies, frame roofs
  - Surfaced by: decision 7. Files: engine/src/view3d/mesh.ts, app/src/Viewer3D.tsx. Verify: mesh unit test; browser look.
- [ ] **D-T8 (P1, human: ~4h / CC: ~40min)** — docs — docs/photo-guide.html with five drawn steps; standard mm paper accepted
  - Surfaced by: decision 8. Files: docs/photo-guide.html. Verify: print preview A4 and Letter, greyscale.

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (13 rules); UI scope: canvas,|
  |                      | library, pier, 3D, build mode, copy, guide  |
  | Step 0               | 3/10 initial; focus: all 7                  |
  | Pass 1  (Info Arch)  | 3/10 → 9/10 after fixes                     |
  | Pass 2  (States)     | 3/10 → 8/10 after fixes                     |
  | Pass 3  (Journey)    | 3/10 → 9/10 after fixes                     |
  | Pass 4  (AI Slop)    | 4/10 → 9/10 after fixes                     |
  | Pass 5  (Design Sys) | 3/10 → 9/10 after fixes                     |
  | Pass 6  (Responsive) | 3/10 → 8/10 after fixes                     |
  | Pass 7  (Decisions)  | 9 resolved, 0 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated (no image key), 0 approved      |
  | Decisions made       | 9 added to plan                             |
  | Decisions deferred   | 0                                           |
  | Overall design score | 3/10 → 8/10                                 |
  +====================================================================+
```

Unresolved Decisions: none.

## E2 revisited after the 216mm trial (2026-11-03)

Trial results with six hand-read grid points (E2 A): two good photos read
215.98 and 217.35mm, 1.37mm apart (C2 needs 0.5mm). Cause: hand-read points
(±2-3px) and lens bowing a homography cannot hold. Owner answer to "Which way
forward?": "Automatic grid finding (recommended)", 2026-11-03, reversing E2 A.

Built (no new dependency: `sips` converts to BMP, read in TypeScript):
- `photoGrid.ts`: every 10mm crossing found from the hand seeds (red-channel
  darkness, sub-pixel), perspective + one radial bowing term, outliers dropped,
  three passes. On the trial photos: 269 and 311 crossings, rms 0.13-0.16mm.
- `photoEdges.ts`: each plank end found from its seed on the flat top face
  beside the peg/socket (26 edge samples, ~0.1mm spread).
- A piece must cross the middle of the photo, or its end nearer the middle
  shows its end face and reads long; the tool refuses such a photo and the
  guide says so (photo 84397's reference did not).

Result: photo 84401 reads 216.52mm; 84397 refused. Open: the trial needs a
second good photo, and 216.52 is 0.02mm outside 216 ± 0.5 (see the session).

## Tolerance 1mm (owner, 2026-11-03)

Third trial photo (84402, both pieces across the middle): 216.88mm. With
84401 (216.52mm): repeatable to 0.36mm, but both about 0.7mm long; the cause
(the method, e.g. rounded end edges, or the owner's pieces) is not settled:
plank widths read 38.6-39.8mm instead of 40, too inconsistent to correct with.

Owner: "what if we accept 1 mm of tolerance", then "yes, and on point 2 I
think we can accept 1 mm as well because the millimeter paper has the
smallest unit at 1 mm", then "ok, then revert point 2 to 0.5mm". Applied:
C2 agreement stays 0.5mm, EO7 trial 216 ± 1mm (was 0.5), C1 published figures overruled only beyond 1mm, OV7 fit
residual 1mm; every photo figure is recorded as ±1mm. The trial passes:
mean 216.70mm, spread 0.36mm (`TRIAL` in engine/data/photoReadings.ts).

Consequence: published straight and curve lengths will be confirmed, not
changed; switches, crossings and ramps (now from printed copies) can become
measured at ±1mm. Open, not blocking: a caliper reading of the two trial
pieces would say whether the 0.7mm is the method.

Looked into, 2026-11-10, on the four photos that read the long straight
(84401, 84402, 85844, 85845: 216.60, 216.95, 216.43, 216.58):
- A reading is 144 × long ÷ medium on one photo, so the paper's print size
  and the parallax cancel; only the ends or the pieces can move it.
- The ends are not it. Each end steps from wood to paper within about 0.4mm,
  with no strip of wood fading early. Moving the crossing from 25% to 75% of
  the step moves a reading about 0.2mm, either way.
- One cause fits every reading: a medium straight about 143.6mm long. The
  trials average 216.64 (a medium of 143.57), and the T switch's through road
  reads 216.50 (143.67 if that road is 216).
- The camera data (48mm equivalent) puts the top faces 10 to 12mm above the
  paper. That is not precise enough to rule out the two pieces differing in
  height by 1 to 2mm, which would also skew the ratio.
Settled the same day: the owner's medium straight is 143.6mm by ruler. Since
a contributor's may be off too, the camera now sets the scale (photo.ts,
`chooseScale`): the grid's homography and the photo's 35mm-equivalent focal
length give the camera's height, and that with the top faces' 12mm gives the
parallax. The medium straight is read like any figure and held to 144 ± 1mm.
The four trial photos then read 215.85 to 216.30 (mean 216.16), and the
medium straight 143.50 to 143.84. What it leans on now: the paper printed true
(the owner's two sheets differ by about 0.2%) and the focal length surviving
(a chat attachment loses it, so the brief asks for it, draft-6).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 4 proposals, 3 accepted, 1 deferred |
| Outside Review | codex (CEO, eng and design outside voices) | Independent 2nd opinion | 3 | completed | CEO: 8 findings, 8 resolved. Eng: 7 findings, 7 resolved. Design: 9 findings, all resolved in decisions 1-9 or by factual correction |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN | 32 issues, 0 critical gaps (all mapped into approved tasks) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 3/10 → 8/10, 9 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex plan-review (CEO pass, completed, 8 findings; eng pass, completed, 7 findings) and codex design voice (completed, 9 findings) plus a native Claude design subagent (12 findings). Image mockups unavailable (no image API key).
- **CROSS-MODEL:** codex and the Claude design subagent agree on the canvas drawing language, pier interaction, build order, building wording and the photo guide; both misread "red ghost" as new tint (factually the existing refused-preview edge). Earlier passes as recorded above.
- **VERDICT:** CEO + DESIGN CLEARED. Eng review complete with 0 unresolved and 0 critical gaps; its stored status is issues_open because its 32 findings became tasks; eng review required by the dashboard rule.

NO UNRESOLVED DECISIONS
