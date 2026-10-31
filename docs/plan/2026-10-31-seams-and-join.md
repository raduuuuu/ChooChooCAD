# Seams you can count by, and joining you can find (2026-10-31)

Owner request: "1/ 2 or more straights together don't show the delimitation.
2/ i want the join feature to be more prominently displayed."

Reviewed in the 3D viewer's design review session (decisions 26-28).

## Findings

1. Seams were drawn (`.seam`, 1.5px `--seam`) but inside the 40mm plank, the
   same brown as the grooves; on a straight run three pieces read as one plank.
2. Joining was invisible: clicking a free end drew a thin ring and nothing else.
   No words, no Cancel, no sign of which ends a join could go to. The only clue
   was the verdict's "Click the two free ends you want joined."

## Decisions

- **26A**: seams 2.5px `--seam`, running `SEAM_OVERHANG_PX` (4px) past both plank
  edges, non-scaling. The 3D seams follow (3D plan, 17A).
- **27A**: joining is a mode: a strip "Joining from the end of piece N. Click
  another free end to join it." with Cancel (Esc); every end the join can go to
  gets a 2px `--ink` ring at r=12 (the armed end keeps its 3px r=16 ring).
- **28C** (both of):
  - **28A**: when the layout has two or more free ends, the verdict's join
    instruction carries a "Join two ends" button that starts joining mode ("Click
    the first free end.").
  - **28B**: two free ends on one level, at most `SUGGEST_JOIN_MM` apart, facing
    within 30°, and joinable, get a "Join" button between them; one press joins.
    `SUGGEST_JOIN_MM` is 100, not the 60 first proposed: the Near miss loop opened
    at its closing joint leaves 72mm, the very case the button is for.

## Tests

`canvasSeamsGrid.test.ts` (seam weight, overhang), `joinSuggest.test.ts` (which
ends are offered, `joinEnds`), `joining.dom.test.tsx` (verdict button, strip,
targets, Escape, Cancel, one-press join). Each pin's mutation was run.
