# Design system

`app/src/tokens.css` **is** the design system. Every colour, type role, spacing
step and motion value lives there and nowhere else, and nothing outside that
file hardcodes a colour.

This document holds no values. It exists for the rules a token cannot express:
the ones a contributor breaks by writing perfectly reasonable CSS that happens
to violate a decision nobody wrote down. If you want to know what a colour *is*,
read `tokens.css`. If you want to know what you are allowed to do with it, read
this.

Changing a value is a change to `tokens.css`. Changing a rule below is a change
to this file, and both deserve the same scrutiny, because the rules are the part
that keeps the values meaning anything.

## 1. Colour is spent only on verdicts

Colour carries meaning in exactly one place: whether a layout can be built.
Thumbnails, chrome, labels, buttons and the palette get none. The track's warmth
is data, not decoration: it is the only non-verdict colour on screen and it
exists because the thing being designed is made of beech.

Adding an accent colour to a control is the most likely way to break this
product's one piece of visual grammar. If something needs emphasis, it gets
weight, size or space.

## 2. No verdict may be colour-only

All four verdict colours flatten into one narrow greyscale band, which is
measured and recorded in `tokens.css` next to the values. A printed plan and a
colour-blind reader therefore get nothing from the hue. The glyph shapes
`O`, `/\`, `X` and `?` carry the entire signal, and the sentence beside them
says it in words.

The glyph is `aria-hidden`, because read aloud "slash backslash" is noise in
front of a sentence that already names the verdict. Print and screen readers
need opposite things here; that is why there are three channels and not one.

## 3. Grey is not green

A check that could not run renders grey and says it could not run. It never
renders as a pass, and it never renders as a near-pass. A threshold comparison
against a missing number quietly yields "fine", which is the single most
dangerous output this product could produce.

Related: never claim more than was checked. The middle verdict is deliberately
hedged, because the engine knows a gap fits inside the joints' total give and
does not know that the give can be distributed to absorb it.

## 4. Every number is a measurement

Numbers get `.num`: the mono face with tabular figures. Not for looks. A
measurement column that reflows while you read it is a column you cannot
compare down, and every number in this product is millimetres or a part count.

This is also why `font-display` is `optional` and never `swap`. Swap repaints
those columns in a different face mid-load, which is the exact jitter tabular
figures exist to prevent. `optional` either has the face by first paint or skips
it for that load, so the columns never move.

## 5. Contrast is measured against the surface the thing actually sits on

Every colour in `tokens.css` carries its measured ratio in a comment, against
the specific ground it appears on, not against the page background by default.
A verdict colour is measured against the band it sits in. The plank edge is
measured against the floor, and the floor is a different colour from the paper
for exactly this reason.

Floors: 4.5:1 for text, 3:1 for a graphical object you must see to understand
the content (WCAG 1.4.11). A new colour arrives with its ratio or it does not
arrive. Three colours in this file have already been corrected once for failing
a floor nobody had checked.

A colour may sit below those floors only when it is decorative, and then its
comment says so and names what carries the meaning instead. The floor grid is
the one such colour: 1.24:1, faint on purpose, with the scale stated in words
by the caption under the canvas. "Decorative" is a claim to defend in the
comment, not an escape from measuring.

## 6. The product is light, and says so

`color-scheme: light` is declared. There is no dark theme, and that is a
decision with a recorded ceiling, not an omission: see `dec-2508388b`. Every
ratio in rule 5 is measured against a light ground, so a dark mode means
re-deriving all of them. An unmeasured dark palette is worse than none, because
it drops verdict text below the readable floor silently.

## 7. Copy names no direction

No sentence in the UI says "below", "on the right", or "above". Copy that names
a position has a dependency on a breakpoint, and nothing asserts that
dependency, so it goes silently wrong the next time the layout moves. It already
did once: the empty state pointed at a palette that had become a right-hand
rail.

Words for track HEIGHT are allowed: floor, raised, climbs, comes down. They
are physical facts about the track, not screen positions, and no layout can
make them wrong. "Above" and "below" stay banned even for height, because
they read as screen positions (design review of the two-layer plan, 7A,
2026-10-23).

## 8. One authored motion

There is one deliberate moment of movement, and `prefers-reduced-motion` turns
it off. Nothing else animates. A drafting tool that moves while you are reading
a measurement is working against its own purpose.

## 9. Browser surfaces carry the design too

Selection, caret, focus ring and scrollbars ship with defaults that belong to no
design system. They are themed in `tokens.css`. Leaving them at their defaults
is the cheapest tell that a page was assembled rather than designed, and it is
the thing a reviewer notices without being able to say why.

## 10. Touch targets have a floor, unconditionally on data entry

Coarse pointers raise every target to the 44px floor. The data-entry form holds
that floor at every pointer type, because a mis-tapped number in an inventory is
a wrong answer the user will not know is wrong.

## 11. Every mark on the canvas means one thing

Each state on the canvas owns one channel, and a new mark takes a channel
nothing else uses:

- **Dashed means the cursor**, where the next piece attaches. Nothing else on
  the canvas is dashed.
- **Weight means importance.** The armed end's 3px ring is the heaviest port
  mark; a selection is drawn by line weight, not by a new colour.
- **A preview is translucent wood with a SOLID edge** (`--ghost-opacity`).
  Only its wood is translucent; its edge, glyph and words stay opaque, so no
  contrast depends on the opacity.
- **An offset shadow means raised.** Track on the raised level casts a
  shadow onto the floor (`--track-shadow`, 3.03:1 on `--floor`), a ramp's
  tapering from its low end to its high end; floor track casts none. Depth,
  not hue, because colour is spent on verdicts. Where raised track crosses
  floor track, a gap in the floor plank (the bridge casing) says it too.
- **A solid ink block across the plank means a buffer stop**: the beam at
  its far end, 6mm deep, in the wood's millimetres. Ends are circles and
  seams hairlines, so nothing else on the canvas is a filled bar; round
  buffers were tried and read as port dots.
- **Strokes keep their device size** (`vector-effect: non-scaling-stroke`),
  because the canvas fits the whole layout into a fixed box and a stroke in
  millimetres thins to nothing on a big board.
- **Marks keep a floor size.** The fault marks and the adapter diamond stop
  shrinking below 0.75px per millimetre (`MARK_MIN_PX_PER_MM`), all by one
  factor, so on a big board they stay findable and keep their sizes relative
  to each other. Above that zoom they keep their size on the wood.

Controls for a mode the canvas is in (placing a piece, a selected piece) live
in a strip on the canvas edge, not in the parts rail, so they sit next to the
thing they act on.

## What is NOT settled

Nothing in the editor's operability. The canvas, its ends and joints are
operable from the keyboard through the layout list, and every action is
announced in its own polite region (tasks U7a and U7b, `dec-cc66dbf5`). What
remains open is recorded with its decision in `docs/plan/`, not here.
