# What the editor says aloud while track is placed (2026-11-05)

For the P2 "Nothing has ever verified what the verdict announces" (generic-TODOS.md).
The machine half is done: `app/src/verdictAnnouncement.dom.test.tsx` drives a real
session and pins the exact words each live region holds, read the way a screen
reader reads them (marks marked `aria-hidden` left out). The human half, hearing
VoiceOver, is the checklist at the end.

## Two regions speak on every placement

```
  place a piece ─▶ verdict region  role=status, polite, ATOMIC   "Not a loop yet. 3 pieces, open at both ends"
               └─▶ action region   role=status, polite           "Added piece 3, Large curve (E), joined to the end of piece 2."
```

## The transcript (from the test, 2026-11-05)

| Step | Verdict region (spoken) | Action region (spoken) |
|---|---|---|
| start | Nothing to check yet. | (empty) |
| curve 1 | Not a loop yet. 1 piece, open at both ends | Added piece 1, Large curve (E), starting a new run. |
| curves 2-7 | Not a loop yet. N pieces, open at both ends | Added piece N, Large curve (E), joined to the end of piece N-1. |
| curve 8 (closes) | This works. Closes exactly, no give needed at any joint. | Added piece 8, Large curve (E), joined to the end of piece 7. It also joined the start of piece 1. |
| a stray straight | This works. Closes exactly, no give needed at any joint. 1 other run of track is not a loop yet. | Added piece 9, Mini straight (A2), starting a new run. |
| Remove last | This works. Closes exactly, no give needed at any joint. | Removed piece 9, Mini straight (A2). |
| preset Near miss | Tight. Closes with bend: needs up to 2.7° at a joint. | Loaded a layout of 10 pieces. |
| preset Stadium | This works. Closes exactly, no give needed at any joint. | (unchanged, so not re-read) |

Longest verdict in the session: 97 characters. Longest action line: 98.

## Findings

1. **Pass: the marks are silent.** `?`, `O` and `/\` are `aria-hidden`, so the
   sentence starts with its words.
2. **Pass: the region holds the sentence alone.** Trust, action and clearance notes
   are a sibling the region points at with `aria-describedby`; they are not re-read
   on an edit.
3. **Finding: every placement is said twice.** While a run is still open, the
   verdict region changes on every placement only because its piece count changes,
   and the action region says the same count ("Added piece 3"). A screen-reader
   user hears about 105 characters per placement, the count twice. Polite and
   atomic collapse fast placements into one, but a deliberate one-at-a-time build
   (the keyboard route) hears both lines every time.
   **Possible fix (not made; the owner decides after listening):** drop the piece
   count from the spoken not-a-loop verdict, so the verdict region stays silent
   until the state changes (not a loop, works, tight, can't be built). The count
   stays visible, and the action line already says it.
4. **Minor: a second preset of the same size is not re-announced as a load.**
   "Loaded a layout of 10 pieces." is the same text twice, so nothing changes in the
   region and nothing is read. The verdict still speaks when it changes.

Not checked by the test: whether VoiceOver reads both regions, in which order, or
drops one; its pauses; whether the region is reachable by keyboard.

## VoiceOver checklist (about 30 minutes, Safari on the Mac)

1. Turn VoiceOver on: Cmd+F5. Open the site in Safari.
2. Tab to the palette, press Enter on "Large curve", then Enter on Place. Write down
   exactly what VoiceOver says.
3. Repeat until the eighth curve closes the loop. Write down what is said at pieces
   2, 7 and 8.
4. Does VoiceOver read the verdict line, the "Added piece" line, or both? In which
   order? Does one cut off the other?
5. Place one more piece quickly, then another quickly. Is anything skipped?
6. Press Near miss. What is said?
7. Move to the verdict line with VO+arrow keys. Is "This works…" reachable? Are the
   notes read as its description (VO+Shift+H, or VoiceOver's hint)?
8. Turn VoiceOver off: Cmd+F5.

Bring back the notes from steps 2-7. If finding 3 is as bad as it reads, the fix is
small; if VoiceOver already drops the duplicate, nothing changes.

## Outcome

2026-11-05: the owner chose not to run the listen or make the fix (won't do). The test stays as the record of what is announced.
