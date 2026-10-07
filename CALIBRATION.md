# V2 — The afternoon on the floor

Four unknowns gate every number this engine prints. All four are settled by one
afternoon with real BRIO track, a caliper and a tape measure. Nothing else in
the plan needs doing first.

Record answers directly in this file. Then `engine/data/brio.ts` gets the real
numbers and `calibrationStatus` can finally move off `estimated`.

Why this comes first: the engine's verdict is dominated by the ANGULAR budget,
not the axial one. The lever arms are on the order of 300mm while axial budgets
are around 1mm, so a joint's small rotation moves the far end of a layout far
more than its pull-apart does. The angular figure is also the vaguest thing in
evidence ("a few degrees"). Measuring it is the single highest-information act
available on this project.

---

## Q1 — Does the 72mm-gap layout actually seat?

Build this closed loop, in order:

```
  E  E  E  E  D  E  E  E  E  A
  (4 large curves, long straight, 4 large curves, medium straight)
```

E = large curve r182 (#33342), D = 216mm straight (#33341), A = 144mm straight (#33335).

The engine says this has an exact residual of **72mm** (216 − 144) that the
joints must absorb between them: 7.2mm per joint across 10 joints.

- [ ] Does it close with every joint seated? ............ YES / NO
- [ ] If yes, does it feel strained, or comfortable? ..... STRAINED / COMFORTABLE
- [ ] If no, roughly how big is the leftover gap? ........ ______ mm
- [ ] Does a train run round it without derailing? ....... YES / NO

**Why it matters:** this is the single data point that tells you whether the
whole slop model is in the right ballpark. The engine currently reports this
layout as FAIL. If it seats comfortably on the floor, the budgets are far too
tight and every FAIL verdict the tool has ever given is suspect.

## Q2 — How much does ONE joint actually give?

Take two straights. Join them. Then, without forcing anything to the point of
damage:

- [ ] Pull apart. Gap at the limit of comfortable travel? .... ______ mm
- [ ] Push together. Does the gap close to zero, or is there
      a hard stop with the pieces still apart? ............... ZERO / STOP AT ______ mm
- [ ] Bend in the plane of the floor. Angle at the limit? ..... ______ degrees
      (measure the far end's sideways travel over the piece's
      length instead, if that is easier: ______ mm over ______ mm)

**Why it matters:** `schema.ts` defines `axialMm` as ONE-SIDED give, while the
published "2 to 3mm" figure is almost certainly TOTAL. That factor of two is
unresolved and it is the difference between the current numbers being 1.5x
wrong and 3x wrong. Q2 settles it directly. The push-together answer also
settles whether the budget is symmetric: if there is a hard stop, wood cannot
compress past contact and the budget is one-sided POSITIVE, which the LP
currently does not model.

## Q3 — What datum is the printed length?

Take the 216mm straight (D, #33341).

- [ ] Overall length, end face to end face .............. ______ mm
- [ ] Length from the base of the peg to the opposite
      end face (i.e. excluding the protruding peg) ...... ______ mm
- [ ] Peg (plug) head diameter ........................... ______ mm
- [ ] Peg neck diameter .................................. ______ mm
- [ ] Peg neck length .................................... ______ mm
- [ ] Socket (nest) hole diameter ........................ ______ mm
- [ ] Socket throat width ................................ ______ mm
- [ ] Socket throat depth ................................ ______ mm
- [ ] Plank width (NOT the 40mm gauge — the wood's width) ______ mm

**Why it matters:** two different plug/nest pairs appear in the plan (11.5 vs
15–17mm, and 6.25 vs 6.4mm) and they give answers 23x apart. Which pair bounds
pulling a joint apart is unknown. Separately, if 216 is measured to the butted
face then the usable length when joined is LESS than 216 and every closure
calculation inherits the error. And the angular lever needs plank width, which
is not the gauge and is currently not recorded anywhere.

## Q4 — Is the ascending track's 216mm the run or the plank?

Take the ascending track (N, #33332), which rises 64mm.

- [ ] Horizontal distance covered, measured flat on the
      floor from end to end (the RUN) ................... ______ mm
- [ ] Length along the sloping surface itself (the PLANK)  ______ mm

**Why it matters, and this one is load-bearing for the whole approach:** if 216
is the plank length, the horizontal run is sqrt(216² − 64²) ≈ **206.34mm**,
which is irrational and therefore OUTSIDE the exact lattice. Exact closure
would silently die for any layout containing a ramp, and that exactness is the
product's one novel claim. If 216 is the run, everything is fine. The code
comment at `engine/data/brio.ts:11` asserts "216 run" but nobody has checked.
One tape measure settles it.

---

## After the afternoon

1. Write the measured numbers into `engine/data/brio.ts`, replacing
   `ESTIMATED_SLOP`, with the measurement date and method recorded beside them
   (task V3 and T46's provenance requirement).
2. Set `calibrationStatus: 'measured'` ONLY for values genuinely measured here.
   Anything still inferred stays `estimated` and keeps its dotted ring.
3. Re-run `bun run test`. If Q1 seated comfortably and the engine still says
   FAIL, that is the bug, and it is the most important one on the project.
4. Then run `/plan-eng-review` with real numbers in hand.

A caliper is ideal. A steel rule and a phone camera will answer Q1, Q3 and Q4
well enough to be decisive; only Q2's bend angle really wants care.
