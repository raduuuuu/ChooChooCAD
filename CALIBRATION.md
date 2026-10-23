# V2 — The afternoon on the floor

Four unknowns gate every number this engine prints. All four are settled by one
afternoon with real BRIO track, a caliper and a tape measure. Nothing else in
the plan needs doing first.

Record answers directly in this file. Then `engine/data/brio.ts` gets the real
numbers and `calibrationStatus` can finally move off `estimated`.

Why this comes first, corrected 2026-10-14: **the engine does not currently use
the angular budget at all.** `totalGiveMm` (`engine/src/solver/residual.ts:135`)
sums `axialMaxMm` alone, and `angularMaxDeg` is recorded on every `Joint` and
read nowhere. This paragraph used to assert that the verdict was "dominated by
the ANGULAR budget, not the axial one", which was true of the minimax LP deleted
at decision R21 and has been false of the shipped engine ever since.

Measuring the angular figure is still the highest-information act available, and
now for a sharper reason. The lever arms are on the order of 300mm against axial
budgets around 1mm, so a joint's small rotation moves the far end of a layout
much further than its pull-apart does. If that is right, the engine is currently
ignoring the larger of the two effects. It is also the vaguest thing in evidence
("a few degrees"), which is exactly why nobody has modelled it: there is no
number to model with. Measuring it is what would let the engine use it.

**OPEN, and the thing this afternoon decides:** whether the axial-only bound is
sound in the meantime. `totalGiveMm` backs a NECESSARY condition -- "the gap
exceeds the give, therefore this definitely will not fit" -- and that claim is
only valid if the give figure is an upper bound on the give really available.
Ignoring a real angular contribution makes the figure too SMALL, which makes the
engine claim "will not fit" about layouts that would. Filed in
`docs/plan/brio-TODOS.md`.

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
compress past contact and the budget is one-sided POSITIVE, which the engine
does not model either way (it sums a single `axialMaxMm` per joint, with no
sign). The LP this sentence used to name was deleted at R21.

## Q3 — What datum is the printed length?

Take the 216mm straight (D, #33341).

- [ ] Overall length, end face to end face .............. ______ mm
- [ ] Length from the base of the peg to the opposite
      end face (i.e. excluding the protruding peg) ...... ______ mm
- [x] Peg (plug) head diameter ............................ **11.5 mm** PUBLISHED
- [ ] Peg neck diameter .................................. ______ mm
- [x] Peg neck length ..................................... **7 mm** PUBLISHED
- [x] Socket (nest) hole diameter .......................... **15-17 mm** PUBLISHED, a RANGE
- [ ] Socket throat width ................................ ______ mm
- [x] Socket throat depth ................................. **5 mm** PUBLISHED

> **PARTLY ANSWERED 2026-10-09 from the primary source.** Verbatim: "The male
> connector is an 11.5mm peg on a 7mm long neck, and the female connector ranges
> from 15 to 17mm in diameter with a 5mm long throat."
> (woodenrailway.info/track/brio-track-guide)
>
> Note the socket is a RANGE, 15 to 17mm, not a value. That 2mm spread is
> probably most of the axial slop this sheet exists to quantify: an 11.5mm peg in
> a 15mm hole and the same peg in a 17mm hole are different joints. So the
> published figures narrow the question without closing it, and the two
> still-blank rows, peg neck diameter and socket throat width, are the ones that
> actually bound the pull-apart.
>
> This also settles which plug/nest pair the note below refers to: 11.5 against
> 15-17 is the published pair. Where 6.25 and 6.4 came from is unrecorded, and
> 6mm is the GROOVE width from the same sentence, so those two figures are
> plausibly the groove, not the connector, and the plan conflated them.
- [x] Plank width ......................................... **40 mm** PUBLISHED
- [x] Plank THICKNESS, floor to railhead .................. **12 mm** PUBLISHED

> **ANSWERED 2026-10-09 from the primary source, no measuring needed.** Verbatim:
> "A typical piece of BRIO track is 40mm wide and 12mm high, with two 6mm wide
> grooves that are 3mm deep, spaced 20mm apart, measuring 26mm from center to
> center." (woodenrailway.info/track/brio-track-guide)
>
> The parenthetical this question used to carry, "NOT the 40mm gauge", was itself
> the error. The 40mm WAS the plank width, sitting in a field named
> `gaugeWidthMm`. The real gauge is 26mm. Both are now in the part records as
> published values, along with the 12mm thickness, so this question is closed
> without calipers.

**Why it matters:** two different plug/nest pairs appear in the plan (11.5 vs
15–17mm, and 6.25 vs 6.4mm) and they give answers 23x apart. Which pair bounds
pulling a joint apart is unknown. Separately, if 216 is measured to the butted
face then the usable length when joined is LESS than 216 and every closure
calculation inherits the error. The angular lever needs plank width, which is now
recorded as a published 40mm (see above; this sentence previously said it "is not
the gauge and is currently not recorded anywhere", and both halves were wrong:
it WAS the 40mm, recorded under the name gaugeWidthMm). What remains unmeasured
is the SLOP: `engine/data/brio.ts` records it as `ESTIMATED_SLOP`, 0.8mm axial
and 1.5 degrees angular, with `calibrationStatus: 'estimated'` saying in the
data itself that nobody has measured it. It is recorded, and it is a guess.

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
comment at `engine/data/brio.ts:12` asserts "216 run" but nobody has checked.
One tape measure settles it.

> **Built on estimates, 2026-10-23.** Two-layer circuits shipped without this
> afternoon (owner decisions L2 and L3 of `docs/plan/2026-10-23-two-layers.md`):
> the ascending track takes 216mm as its RUN (Q4 open, so the part is marked
> unverified), and the clearance note states 64 - 12 - 44 = 8mm as an estimate
> with supports not checked. The constants are `CLEARANCE` in
> `engine/data/rampSeeds.ts`. Measuring Q4 and Q5 replaces them; nothing else
> has to change.

## Q5 — The three numbers that decide whether a bridge works

The layer feature lives or dies on one subtraction. A bridge sits one ramp-rise
above the floor; the wood of that bridge takes up some of the gap; a train has to
fit through what is left.

- [ ] Ramp rise: floor to railhead at the top of the ascending
      track (#33332) ..................................... ______ mm
- [x] Plank thickness, from Q3 above .....................  12 mm
      (PUBLISHED, not measured. Q3 closed this one without calipers, and the
      worked figure below already uses it. Re-measure it if you are checking
      the margin for real: a published figure and your own planks are not the
      same claim.)
- [ ] Tallest vehicle you care about, wheels to roof ..... ______ mm
      (measure the tallest one you actually own, not the catalogue)

Then compute:

```
  air under the bridge   = ramp rise  -  plank thickness   = ______ mm
  clearance margin       = air        -  vehicle height    = ______ mm
```

**Why this is the whole feature:** with the numbers currently in the code the
margin is **8mm**. Two of the three are guesses (a 64mm rise that exists only in
a docblock, with no constant and no N part in the catalogue, and a 44mm vehicle
height); the 12mm plank is PUBLISHED, per Q3 and Q5 above. None of those three
has been measured. A vehicle 6mm taller, or a plank 4mm thicker, and the margin
is gone: every single-level bridge becomes illegal, and the only legal bridging
would be two levels up, which the two-layer model does not have.

---

## Q6 — The switch: nobody has published its geometry

**Added 2026-10-13 by task T1 of the fifth eng review.** This file previously
asked nothing about switches, which is what decision D9 and finding C1 both
flagged. T1 searched for a citable figure and did not find one; the enumerated
search is below so nobody repeats it.

### What we need

| Field | Why it matters |
|---|---|
| diverging-leg arc, in 22.5-degree steps | decides whether a switch is expressible in Z[zeta16] at all |
| diverging-leg radius, to the inner edge | the centreline radius derives from it, like every curve |
| through-road length, heel to straight end | the straight road's displacement |
| lateral offset at the heel, if any | whether the two roads share an origin or are offset |

### The search, 2026-10-13, all four source classes

| # | Source class | What was checked | Outcome |
|---|---|---|---|
| 1 | Manufacturer | `brio.com` product pages for 33344 (Mechanical Switches) and 33346 (Curved Switching Tracks), via retail mirrors | **Nothing.** Marketing copy, age rating, FSC beech. No dimensioned figure |
| 2 | Retailer specs | walmart.com/ip/127085366, aio.lv BRIO 33344, desertcart, toottoottoys | **Packaging only.** "approximately 19 x 3 x 9 cm, 144 g" is box size, not track geometry |
| 3 | Dimensioned drawings / patents | patent search returned US6371418B1, a real-railway switch curve patent | **Wrong domain.** No BRIO toy-track drawing found |
| 4 | woodenrailway.info | the BRIO track guide, our existing citation for plank, grooves, gauge and the 45-degree curve | **Silent on switches.** Covers straights, curves and connectors only |

Community 3D-print reproductions DO exist (Printables "Short Curved Switching
Track - O1" and "- P", MakerWorld track customizers, several "45deg switch"
models). Those are reproductions, not manufacturer figures, so they sit at the
same `unverified` tier as the IKEA and Playtive seeds and cannot carry a switch
into the catalogue on their own.

### Conclusion: outcome (c)

**No citable switch geometry exists.** Per the plan's own disposition for this
outcome, task T2 (the switch catalogue row) is **BLOCKED, NOT SCHEDULED**, and
the physical measurement goes to `docs/plan/brio-TODOS.md` under the existing
calibration deferral rather than becoming new scope.

### What to measure, when someone has a switch and calipers

1. Lay the switch's through road against a known straight. Is the through
   length one of 54, 72, 108, 144 or 216mm, or something else?
2. Lay the diverging road against an E (r202 centreline, 2 steps) and an E1
   (r110, 2 steps). Does either match? If neither, measure the chord between
   the heel and the diverging end, and the perpendicular offset.
3. Compute the arc from chord and offset, then check whether it lands on a
   multiple of 22.5 degrees. **Record the rounding residual in millimetres**,
   because E1 of the eng review makes that number the thing a verdict is
   checked against.
4. If the residual exceeds the ceiling E1 sets, the switch is not modellable
   on this lattice and that is a real answer, not a failure.

## Contingency: what each bad answer changes

Write the answer in, then follow the row. These are decided in advance so a
measurement cannot quietly invalidate work that is already built.

| If the measurement says | Then |
|---|---|
| **Clearance margin is comfortably positive** (say 5mm or more) | The layer feature proceeds as planned. Record the three numbers in the engine's constant table. |
| **Clearance margin is thin** (0 to 5mm) | The layer feature proceeds, but the verdict must say the margin is thin and name it in millimetres. A thin margin is a real build risk: track flexes. |
| **Clearance margin is zero or negative** | **Single-level bridges are impossible.** The two-layer model cannot express a legal bridge, so layers are deferred entirely and the third-layer TODO becomes the only path. Stop before building the layer work; this is a design change, not a tuning change. |
| **Q4 says 216mm is the RUN** | Everything proceeds. The ramp stays a straight piece whose length is its run, `fk.ts` needs no changes, and exact closure survives ramps. |
| **Q4 says 216mm is the PLANK** | The horizontal run is sqrt(216² − 64²) ≈ **206.34mm**, which is irrational and outside the exact lattice. Exact closure does NOT survive any layout containing a ramp. Two sub-options, and this needs a decision before any ramp code: either ramps leave the exact walk and carry a stated per-ramp closure error, or the run is rounded to 206mm with the error recorded per ramp. `fk.ts` also needs changes, because the ramp can no longer be a plain straight. |
| **Q2 says the joint gives much less than 1mm** | The bound becomes very tight and most near-miss layouts will read as definite failures. Re-examine whether the bound's threshold is useful before building the UI copy around it. |
| **Q2 says the joint gives much more than 3mm** | The bound becomes very loose and will rarely say no. Still correct, but the product's value shifts almost entirely onto exact closure and the gap report. |
| **Q1 seats comfortably but the engine says the bound is exceeded** | That is the most important single result on this sheet. It means the per-joint give is larger than anything recorded, and the numbers in the code are not merely imprecise but wrong in direction. |

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
