<!-- /autoplan restore point: "/Users/radudiaconescu/Developer/ChooChooCAD/.gstack/tmp/autoplan/measuring-tools-plan-autoplan-restore-20261109-173513.md" -->
# Plan: the measuring tools, made usable from a chat sandbox

Status: approved by the owner at the /autoplan gate (2026-11-09, `rec`): every
recommendation taken, including UC1 (b) below. Owner's ask: "run /autoplan for the
tool changes", the five changes the contributor-brief spike found
(`docs/plan/2026-11-09-contributor-brief.md`, step 0, spike results).

## Why

The spike (a claude.ai chat, Ubuntu 24.04, Bun 1.4.4, ImageMagick 6 and
ffmpeg present) ran the repo's photo tools and reproduced the Mac's trial
readings. A chat Claude picking its own points read the T switch (84405)'s
through road and curved end "along" within 0.24 mm of the library, but:

1. `engine/tools/photoCrop.ts` failed: it calls macOS's `sips` only.
2. `engine/tools/photoMeasure.ts` needs hand-labelled grid seeds (each seed's
   paper millimetres): on a tilted sheet Claude counted lines by script.
3. It measures only point to point: for "how far out from the straight road"
   Claude built a foot point by hand, unrefined, and that figure missed by
   0.57 mm on one of two passes.
4. A figure that breaks the across-the-middle rule ends the whole run
   (`process.exit(1)` in `photoMeasure.ts`); B passed by 2 px.
5. The chat shows a smaller preview than the photo's pixels; points must be in
   full-resolution pixels.

A brief can't ask a parent's Claude to write its own helpers around these.

## What already exists

- `engine/tools/photoImage.ts`: `loadPhoto` decodes any photo to RGB through
  `sips`, `magick`, `convert` or `ffmpeg` (`bmpConverters`); `readBmp`.
- `engine/tools/photoGridSeed.ts` `findGridAuto(img, scale)` and the scale
  retry in `photoCheck.ts` (`gridAndPlanks`, scales 1, 2, 0.5).
- `engine/tools/photoStraights.ts` `findWood`, `namePlanks`: the medium
  straight (the reference) found with refined ends.
- `engine/tools/photoEdges.ts` `refineEnd` (wood, and grey read steadily),
  `straddlesCentre`.
- `engine/tools/photo.ts` `scaleAndMeasure`, `PhotoInput`, `REFERENCE_MM`,
  `K_PLAUSIBLE`.
- `engine/tools/photoCrop.ts` `windowAround`, `fromCrop`, `cropPath`, `CROP`.

## Implementation plan

1. **Crops without `sips`** (`photoCrop.ts`, `photoImage.ts`). Cut the window
   from the upright pixels `loadUpright` returns (any converter), enlarge it ×4 in
   TypeScript (nearest neighbour, so a pixel stays a square the eye can
   split), and write it with a new `writePng` in `photoImage.ts` (8-bit RGB,
   `deflateSync` and `crc32` from `node:zlib`, no converter), so a crop is
   always a PNG and `CROP` keeps its one pattern. Converters stay for reading
   photos only, within one 60 s deadline for the whole read, not per
   converter (DX D5, eng G4). The decoder inside `photoImage.ts` is
   reworked (eng G7): the file's first bytes are read before anything runs,
   and only a JPEG (`FFD8`), PNG or BMP goes on, a HEIC (an `ftyp` box) is
   `heic` whatever its name, anything else `photo-unreadable` (eng G5:
   ImageMagick never sees an unknown format); converters get the absolute
   path with an explicit coder prefix (`jpg:/abs/path` for `magick` and
   `convert`); a spawn that fails with ENOENT means that converter is
   absent, any other failure means it was tried, and its stderr is kept
   (known deprecation lines stripped); the converter list, the deadline and
   the spawn are injectable for tests. A BMP is read directly and a
   malformed one is `photo-unreadable`. Reading a photo fails in one of
   three ways, each its own code (D4): `photo-missing` (the path doesn't
   exist or can't be read; names the path), checked first; `no-converter`
   (every converter absent); `photo-unreadable` (a converter ran and failed
   or ran out of time, naming each tried and the first line of its stderr;
   or the bytes aren't a photo it takes). `loadPhoto` returns the same
   pixels as today, so `photoCheck` reads every photo as before.
   The window maths (`windowAround`, `fromCrop`) stay.
   Orientation (CEO decisions 7, 20): a new `loadUpright` (`photoImage.ts`)
   wraps `loadPhoto` and returns the photo upright, as a phone and a chat
   preview show it, with `orientationOf` (`photoExif.ts`) read instead of
   `sips -g`; `loadPhoto` itself, and so `photoCheck`, keeps today's pixels
   and orientation. Orientation 1 is read as is; 6 and 8 (a
   portrait phone photo) are turned in TypeScript unless the decoded width
   and height show the converter already turned it, compared with the
   JPEG's stored size read from its frame header by a new `jpegSize` in
   `photoExif.ts` (beside `orientationOf`, on the same `segments`); 3, the
   mirrored orientations, and a square photo tagged 6 or 8, where the decoded
   size can't tell, are refused as today ("open and re-save the photo
   upright") (eng E2). Which way a converter turned a 6 or 8 can't be seen
   from the size; the code assumes it applied the tag, and says so. A PNG's
   `eXIf` orientation is ignored, by choice, and documented. `jpegSize` reads
   any SOF0-SOF15 frame header except C4, C8 and CC (progressive phone JPEGs
   are SOF2) and skips the EXIF thumbnail's. `photoImage.ts`'s header says which loader to use:
   `loadUpright` for anything that reads points, `loadPhoto` only for
   `photoCheck`, which looks at whole photos (eng E6). A HEIC photo is refused (convert
   to JPEG). The crop's JSON line gains the photo's upright `width` and
   `height`, and stderr says how to map back: "a point at (cx, cy) in this
   crop is (x0 + cx/4, y0 + cy/4) in the photo" with the numbers filled in
   (DX decision D2). A point in the points file may instead be given as
   `{ "crop": "<crop file>", "at": [cx, cy] }`, and `photoMeasure` maps it
   back from the window the crop's name records (`CROP`), so no point is
   converted by hand (taste, DX decision D6). The crop's path is resolved
   from the points file's folder, and only its name is read (no file opened):
   it must sit beside the photo and match `<photo's stem>.crop-x-y-side.png`
   exactly (so `84405b.crop-…` is not a crop of `84405`), and `at` must lie
   inside the enlarged crop (0 to 4 × side); otherwise `points-invalid`
   (eng E3, G6). `photoCrop`'s `half` must be a whole number, so a window is
   always whole pixels and its name matches `CROP` (eng G8).
2. **The grid and the reference found automatically** (`photoMeasure.ts`).
   With `--photo <photo>` (`--auto` kept as its alias, so today's command
   lines still run; DX decision D7): a points file that gives `grid` seeds `findGrid` as
   today; one that leaves it out gets `findGridAuto` with the scale retry
   `photoCheck` uses (`gridAndPlanks` moved to `photoStraights.ts` and shared,
   not copied; `AUTO_GRID_RMS_MAX_MM` and `paperTooWarm` move with it, so
   `photoMeasure` never imports the `photoCheck` command, eng G3). A points file without `reference` uses the medium straight
   `namePlanks` finds; if either of its ends was not refined, the run is
   refused ("the medium straight's <which> end couldn't be read: no shadow
   across it, nothing touching it"), as `photoCheck` refuses it. A given
   reference's ends, and every figure's ends, keep today's rule: an end that
   can't be refined keeps its hand reading, and says so (text and JSON). A
   grid, found or seeded from a given one, is held to `photoCheck`'s
   limits, one rule for both (eng E1): rms above
   `AUTO_GRID_RMS_MAX_MM` (0.3 mm) and paper as warm as the wood
   (`paperTooWarm`) each refuse the run (exit 1). With a given reference, the
   scale retry keeps the first scale at which that reference's `k` falls in
   `K_PLAUSIBLE`, with `k` read from that reference's refined ends at each
   scale (a hand reading where an end can't be refined). `--photo` reads the
   photo upright through the same `loadUpright` as the crop (item 1), so points
   picked off a crop or a chat preview match; an orientation it refuses, and
   a HEIC, refuse the run (exit 1); a PNG or BMP carries no orientation and
   is read as is.
   Which scale is used, by case (eng G6b):
   ```
                       reference given                 reference found
   grid seeded         the seeds' millimetres; k        the seeds' millimetres; the
                       outside K_PLAUSIBLE: k-implausible   medium straight namePlanks names
                                                        at that scale, else reference-unread
   grid found          scales 1, 2, 0.5: the first      scales 1, 2, 0.5: the first where
                       whose k falls in K_PLAUSIBLE,    namePlanks names a reference (as
                       else k-implausible               photoCheck), else reference-unread
   ```
   each cell tested.
   `PhotoInput`'s `grid` and `reference` become optional; without `--photo`,
   a points file missing either is a usage error (exit 2). The run says which
   grid and reference it used.
3. **Figures beyond two points** (`photo.ts`, `photoMeasure.ts`). A figure is
   either today's `[a, b]` (distance), or `{ point, toward?, line: [a, b],
   read: "offset" | "along" }`. `offset`: the point's distance from the line
   through `a` and `b`, never negative. `along`: how far along that line,
   from `a` towards `b`, the point's foot lies; negative when the foot falls
   before `a`. Both in paper millimetres times the scale. Line ends are
   refined as today (each against the other); a `point` is refined against
   `toward` when given, else its hand reading is kept and said.
4. **One figure refused, not the run** (`photoEdges.ts`, `photoMeasure.ts`).
   A new `facesAway(img, end, other)`: an end faces away from the camera
   when its outward direction (from `other` to `end`) points away from the
   photo's centre, on both axes: `(end − other) · (end − centre) > 0`
   (eng G2: a one-axis test passes a curved end whose face partly turns to
   the camera). For a figure's `point`, `other` is its `toward`.
   `straddlesCentre` stays as it is, so `photoCheck` and the scoreboard
   (84397) keep their whole-piece rule. In `photoMeasure`: a
   reference end facing the camera refuses the run (every figure depends on
   the scale); a figure end facing it refuses that figure alone, with a fix
   that changes what caused it (DX decision D8): for a line end, "lay the
   piece across the middle of the photo and retake"; for a `point`, "check
   that `toward` lies back along the same road; if it does, retake with the
   piece across the middle"; a `point` without `toward` is "facing not checked".
   Exit: 0 every figure read, 1 the run refused (a bad grid, a reference
   problem, a grid or reference point outside the photo, an orientation
   `loadUpright` refuses, a HEIC, a photo no converter reads),
   2 bad usage (including a new feature asked for without `--photo`), 3 some
   figures refused (a figure end facing the camera or outside the photo),
   including every figure refused (eng G11). Geometry is checked after
   mapping (eng G5b): a `point` equal to its `toward`, a reference whose two
   ends coincide, or a seeded grid whose map gives a non-finite value is
   `points-invalid` before work; a figure whose mapped or refined ends give a
   non-finite value, or ends closer than 1 mm, is refused alone
   (`geometry`), never a `NaN` reading.
   Every figure read carries a status (CEO decision 12): `checked` when each
   of its ends was refined and its facing checked, else `provisional`, with
   the reasons (an end kept as hand reading, "facing not checked"); a
   reference end kept as a hand reading makes every figure provisional. The
   exit code doesn't change; a catalogue figure still needs two photos to
   agree (`agreedFigure`, `photoReadings.ts`).
5. **Pixels said plainly.** `photoMeasure.ts` prints the photo's size and
   refuses a point outside it ("points are in the photo's full pixels, W×H;
   a point read off a smaller preview must be scaled"). Every new feature
   (automatic grid or reference, `offset`/`along`, facing, bounds, `--json`,
   `--overlay`) needs the photo, so it needs `--photo <photo>`; without it,
   only today's plain two-point figures with a given grid run, and asking for
   more is a usage error (exit 2) that says so. The pip note (`--break-system-packages`) is for the brief's
   draft (contributor-brief T2), not code.
6. **The command line** (`photoMeasure.ts`): flags parsed by name
   (`--photo <photo>`, `--json`, `--overlay <out.png>`), the points file the
   one positional argument; a usage error exits 2, and so does a points
   file that isn't valid JSON or has no figures, with the parse error or
   "no figures" named (CEO decision 17). A photo that can't be read
   refuses the run (exit 1) with one of item 1's three codes, which says
   whether to fix the path, install a converter or re-save the photo (CEO
   decision 18, refined by DX D4). The CLI only parses, loads and exits: a pure
   core takes the points and the image and returns one result object, which
   the text output, `--json` and `--overlay` all render (CEO decision 19).
   For an agent reading the output (DX decisions D1, D3): `--help` on
   `photoMeasure.ts` and `photoCrop.ts` prints the usage, every flag, the
   exit codes, the points-file format and a complete example, and exits 0.
   In text mode results go to stdout; a refused run's reason and a usage
   error go to stderr. Every run refusal and usage error has a stable code
   (`photo-missing`, `no-converter`, `photo-unreadable`, `orientation`,
   `heic`, `grid-not-found`, `grid-rms`, `paper-warm`, `reference-unread`,
   `reference-faces-camera`, `k-implausible`, `point-outside`, `usage`,
   `points-not-json`, `points-invalid`, `no-figures`, `needs-photo`,
   `overlay-path`, `internal`), one table shared by both tools, defined once as a `CODES` constant (each
   code's recovery class and fix) that the text, the JSON and `--help` all
   read, and a test fails when the skill's code table misses one (eng E5), printed
   first as `REFUSED <code>:` or `USAGE <code>:`, with the fix on the
   message's last line (retake how, re-save upright, install what, add
   `--photo <photo>`); a per-figure refusal carries `faces-camera` or
   `point-outside` the same way. Every refusal names the values that caused
   it (DX decision D9): the rms found and the 0.3 mm limit, `k` at each
   scale tried and `K_PLAUSIBLE`, the paper and wood colours compared, the
   EXIF orientation read, the size and the point. Each code has a recovery
   class, `retake`, `edit-points`, `install` or `human`, in the table and in
   the JSON. The points file is checked whole before any work
   (`points-invalid`, exit 2, D10): each point two finite numbers, `read`
   one of its two values, a line's two ends apart, the field's path named
   (`figures.out.line[1]`). `--json` is found anywhere in the arguments
   before anything else is checked, so a usage error is JSON too. An
   unexpected error is caught at the top: `REFUSED internal:`, exit 1, its
   trace written to a file in the temp folder and that path printed (D11);
   the trace never goes into `--json` (eng G13).
   `--help`'s last line points to the skill's code table
   (`.claude/skills/draw-piece/SKILL.md`, "Measure codes").
7. **The drawing skill** (`.claude/skills/draw-piece/SKILL.md` step 7): the
   new figure kinds, the automatic grid and reference, per-figure refusals
   and their exit codes, `--json`, `--overlay`, and crops on any system; and
   how to choose `toward`: a point on the same road's centreline, at least
   20 mm back from the end, so the end face is square to the line between
   them (for a switch's curved end, back along the curve, not along the
   straight road). A minimal points file first, one distance figure with
   `crop`/`at` points, with its command and both its text and `--json`
   output (D14); then a complete one (DX decision D2): the T
   switch's three figures, one distance and the `along` and `offset` of its
   curved end with `toward`, no `grid` or `reference` (found), with the
   command that reads it and what it prints. Also (CEO decisions 11, 13): the workflow from photo to
   figure, step by step (crop around each end, read the point off the
   enlarged crop, give it as `{ crop, at }` in the points file, then run);
   what the tools need (Bun, and one of `magick`, `convert` or `ffmpeg` to
   read a JPEG; macOS has `sips`; Windows is not supported, use WSL); and
   the conditions a measurement assumes, said again in the facing refusal:
   the reference is the 144 mm medium straight, lying flat beside the piece
   with its top face level with the piece's; the photo is uncropped, taken
   from roughly above the middle of the sheet.
8. **Tests**, each pin's mutation run and recorded (CLAUDE.md):
   - crop: a window from a BMP fixture enlarged ×4 maps back with `fromCrop`;
     `writePng`'s chunks carry correct CRCs and its image data inflates back
     to the pixels written; the converter list off macOS;
   - orientation: a synthetic image tagged 6 and 8 comes back upright (a
     marked corner where the phone shows it); one the converter already
     turned (decoded size swapped) isn't turned twice; 3 and a mirrored
     orientation are refused;
   - offset and along: exact on synthetic points, a slanted line, a foot
     before `a` (negative along);
   - the automatic grid and reference: `photoMeasure`'s core on the
     synthetic photo `photoCheck.test.ts` draws, figures within 0.3 mm; an
     unrefined reference end refuses the run;
   - facing: an end facing the camera refuses its figure alone (exit 3); a
     reference end facing it refuses the run (exit 1); `straddlesCentre`'s
     existing tests unchanged;
   - a point outside the photo refused with the size named;
   - `--json` parsed back for a run with one figure read and one refused;
   - `--overlay`: marker pixels land at the scaled points;
   - the measuring scoreboard's core (entries and a photo loader injected):
     on the synthetic photo `photoCheck.test.ts` draws, a stored entry passes
     within its tolerance, and the same entry
     with an `offset` point given without `toward` (never refined) moved 5 px
     square to its line fails (about 1 mm on that photo);
   - `checkFolder` skips `.overlay.png` beside a photo, as it skips crops;
   - status: a figure with every end refined and facing checked is
     `checked`; one with an end kept as hand reading, or a point without
     `toward`, is `provisional` and names why; a hand-read reference end
     makes every figure `provisional`;
   - refusals, each with its exit code: a HEIC and an orientation-3 JPEG in
     `photoMeasure` and in the crop (1); a found grid over 0.3 mm rms and warm
     paper (1); a points file missing `grid` or `reference` without `--photo`
     (2); an `--overlay` path that is neither a folder nor ends
     `.overlay.png` (2); a figure point outside the photo (3, its `End` reading "outside the
     photo");
   - the scale chosen with a given reference by `K_PLAUSIBLE`, on the
     synthetic photo with 5 mm lines as dark as 10 mm ones;
   - a `point` without `toward` reports "facing not checked";
   - a points file that isn't JSON, and one with no figures (2);
   - `photoCheck` on an orientation-3 photo still checks it (`loadPhoto`
     unchanged);
   - an overlay is drawn for a refused run;
   - `--help` on both tools exits 0 and names every flag and code; each
     refusal prints its code first and its fix last, on stderr in text mode
     and as `{ code, reason, fix, recovery }` in JSON, naming its values;
     the skill's example points files parse and run on the synthetic photo;
   - reading a photo, with the spawn injected: a missing path
     (`photo-missing`), every converter ENOENT (`no-converter`), a converter
     that fails and one that runs past a 200 ms deadline, both
     `photo-unreadable` naming the converter;
   - points-invalid: a three-number point, `read: "across"`, a line whose
     ends coincide, each naming its field; `--json` with an unknown flag
     prints `{ usage }`; a thrown error in the core prints `REFUSED internal`
     and a trace path;
   - a `{ crop, at }` point maps to the same photo pixel as `fromCrop`; a
     crop of another photo is `points-invalid`;
   - a seeded grid over 0.3 mm rms refuses the run like a found one; a
     square photo tagged 6 is refused; `jpegSize` reads a JPEG's stored size;
   - every code in `CODES` appears in the skill's code table;
   - eng: `loadUpright` equals `loadPhoto` on orientation 1; a 6 with a
     converter that turns it and one that doesn't; `jpegSize` on a
     progressive JPEG and one with a thumbnail; a HEIC named `.jpg`; a text
     file named `.jpg`; ENOENT vs a failing converter vs the deadline, with
     an injected spawn and a 200 ms deadline; `84405b.crop-…` refused for
     `84405`; `at` outside the crop; fractional `half`; an overlay written
     with its temp file in the target folder; each cell of the scale table;
     every figure refused exits 3; `point` equal to `toward`; an end at
     (510, 100) with `toward` (310, 50) on a 1000 × 1000 photo faces the
     camera; `facesAway` at a dot product of exactly 0 is false; the JSON
     carries each end's `seed` and `at`;
   - `--auto` still works as `--photo`;
   - an overlay given as `x/y.overlay.png` is written there; a refused run's
     JSON names the overlay it drew; a run that fails before drawing leaves
     no overlay file.
9. **Acceptance** (CEO decisions 9, 10). Two kinds of check, kept apart:
   repeating a photo's recorded reading shows the new code reads as the old
   did; reading a piece of known length shows it reads right.
   - **On the owner's Mac.** The T switch (84405) from fresh picks: the
     through road's socket end (S) and peg end (P) as a distance figure; the
     curved end's centre (C) with `toward` 20 mm back along its curve, read
     against the line S→P as `along` and `offset`; each within `AGREE_MM`
     (0.5 mm) of 84405's own recorded readings (216.49, 108.49, 105.34,
     `photoReadings.ts`). If C can't be refined, its hand reading is kept
     and the check still asks 0.5 mm. The measuring scoreboard (item 12)
     ran every entry and passed (`4/4 pass`), which includes the long
     straight of known length. The photo scoreboard (`bun run photos:score`)
     still 12/12.
   - **In a fresh Linux chat sandbox**, as the spike ran (the spike kit, no
     `sips`): crops of 84405, then the same three figures with `--photo`,
     `--json` and `--overlay`, each within 0.5 mm of the Mac's run, and the
     overlay a PNG. The install commands it needed and the time from the
     kit and photo to the first figure are written into the skill (item 7);
     the target is under 5 minutes (DX 0C), and a longer time is reported,
     not hidden (D14). On the Mac, a `--photo` run on a 12 MP photo takes
     under 30 s [estimated budget, eng E7]; its time is printed on stderr and
     recorded with the acceptance.
10. **Machine-readable results** (`photoMeasure.ts --json`, CEO E1): stdout is
    one JSON object, progress goes to stderr: `{ schema: 1, photo: {width, height},
    grid: {source: "seeded"|"found", points, rmsMm}, reference: {source:
    "given"|"found", k, ends: [End, End]}, figures: { <name>: { kind:
    "distance"|"offset"|"along", facing: "checked"|"not checked", valueMm,
    status: "checked"|"provisional", why: [{ code, end?, text }], ends:
    End[] } | { kind, facing, refused, ends: End[] } },
    overlay?: { path, key: [{ colour, figure, end }] } }`, where `End` is
    `{ seed, at, refined: true, samples, spreadMm } | { seed, at, refined:
    false, reason }`, with `seed` the point as given (after `crop` mapping)
    and `at` the point used, so the overlay draws from the result alone; a
    found reference keeps its ends' `samples` and `spreadMm`, which
    `photoStraights` drops today (eng G4b) (an
    end outside the photo is `{ refined: false, reason: "outside the photo" }`)
    and a
    three-point figure's ends are ordered line `a`, line `b`, `point`. A
    refused run prints `{ schema: 1, refused: { code, reason, fix, recovery
    }, photo?, grid?, overlay? }`, with whatever it found and the overlay it
    drew (D12); a usage error (exit 2) prints `{ schema: 1, usage: { code,
    message, fix } }`; a refused figure's `refused` is `{ code, reason, fix,
    recovery }` too (DX decision D3). `why` codes: `end-hand-read`,
    `facing-not-checked`, `reference-hand-read`. The text output stays the default.
11. **A picture of the points used** (`photoMeasure.ts --overlay <out.png>`,
    CEO E2): the photo shrunk to 1,600 px on its longest side, with each grid
    crossing used as a small dot, the reference's ends as squares and each
    figure end as a ring in its own colour from a fixed list of twelve (past
    twelve ends the colours repeat; the key lists every end); the key
    (colour → figure and end) is printed with the results and in `--json`.
    No text is drawn. Written with `writePng` to `<out>.tmp-<pid>` in the
    same folder (a rename from the temp folder fails across file systems),
    unlinked on failure, then renamed into place (eng G8b), so a failed run never leaves half an image; the JSON
    and text name the overlay only when it was written (D12). `--overlay`
    takes a folder (the file is `<points>.overlay.png` in it) or any path
    ending `.overlay.png`; anything else is `overlay-path` (exit 2), whose fix
    line prints the path that would be accepted (D13). `checkFolder` skips
    `*.overlay.png` beside `CROP`. A refused run still draws
    its overlay when the photo loaded, with whatever was found (grid
    crossings, reference ends) and the given points, since that is when the
    picture helps most.
12. **A measuring scoreboard** (`bun run photos:measure-score`, CEO E3):
    `engine/tools/photoMeasureScoreboard.ts` holds each known piece's points
    and expected figures hard-coded in its source (pixel coordinates only;
    the photos stay in the ignored `photos/`; each entry uses the automatic
    grid, and the automatic reference unless the entry gives one), as `photoScoreboard.ts` holds its verdicts; a
    missing photo is skipped and counted, as `photos:score` says "(n photos
    not in photos)"; it prints `<passed>/<ran> pass` and exits 1 on any miss
    or when none ran; `package.json` gains the script. Each entry states its
    expected figure, its tolerance and the basis for both (CEO decision 10):
    84405 and 84404, the T switch's three figures against each photo's own
    recorded reading within `AGREE_MM` (repeatability), 84404 with its
    reference given, since two pieces touch there and `photos:score` expects
    the automatic reference to be refused (eng G1); 84401 and 84402, the
    long straight against its known 216 mm within `TOLERANCE_MM` (1 mm, the
    216 mm trial's bound; those photos read about 0.7 mm long, and the entry
    says so). New pieces join as they're measured.

**Delivery** (taste, CEO decision 14; the owner confirms at the gate): three
PRs, each merged before the next is opened (none stacked): (a) `writePng`,
`loadUpright`, the photo-reading codes, and crops off macOS (item 1), with
today's `photoMeasure --auto` switched to `loadUpright` in the same PR, so
crops and measuring never disagree about which way up a photo is (DX
decision D15). `photoMeasure --auto` never checked orientation, so a
rotated photo's saved points would move; but all 35 of the owner's JPEGs in
`photos/` read orientation 1 (2 have none) [measured 2026-11-09, eng G1b],
so none do, and a test shows `loadUpright` gives `loadPhoto`'s pixels for
orientation 1; (b) `photoMeasure`'s
new core (items 2-6 and its tests); (c) `--json`, `--overlay`, the
measuring scoreboard and the skill (items 7, 10-12), with the acceptance
(item 9) run on (c).

## Not in scope

- The brief itself (contributor-brief T2 and T5).
- Measuring heights from photos (AGENTS.md: a ruler).
- A new image library: the converters already on the machine do the work.
- Figure kinds beyond distance, offset and along (a radius, an angle):
  added when a piece needs one.
- The tool proposing end points itself (deferred, a pending write to
  `docs/plan/generic-TODOS.md`; CEO decision 13): the overlay and `provisional` status show a bad pick first.
- Sharing the owner's photos as fixtures outside git (rejected, CEO
  decision 16): photos are never shared (SEC1); the synthetic photo covers
  the code, the owner's Mac covers the real ones.
- Proving the method on many contributors' pieces and references (CEO
  decision 11): that is the brief's pilot (contributor-brief T2, T5).


<!-- autoplan-accepted:ceo -->
- Items 1-9 as written in the Implementation plan, including: `writePng` (node:zlib) for every crop and overlay, converters for reading only, `CROP` unchanged; `loadUpright` returning the photo upright, `loadPhoto` and `photoCheck` unchanged (orientation 1 as is; 6 and 8 turned unless the decoded size shows the converter turned it; 3 and mirrored refused), HEIC refused; the crop's JSON with upright `width` and `height`; seeded `findGrid` when a grid is given, `findGridAuto` with the shared scale retry when not, held to AUTO_GRID_RMS_MAX_MM and paperTooWarm (exit 1); the scale with a given reference chosen by K_PLAUSIBLE from its refined ends; a found reference refused when an end isn't refined, other ends keeping their hand reading and saying so; `grid`/`reference` optional only with `--auto` (else exit 2); `offset` unsigned, `along` signed; `facesAway` per end on the dominant photo axis with `straddlesCentre` built on it (photoCheck unchanged), a point's `other` its `toward`; exits 0/1/2/3 mapped as written, a malformed or figure-less points file exit 2, an unreadable photo exit 1 with `NO_CONVERTER`; a pure core whose one result object every output renders; each figure `checked` or `provisional` with reasons, exit code unchanged; the skill's step 7 including how to choose `toward`, the crop-to-points workflow, the tools needed (Windows unsupported) and the measuring conditions; every listed test (item 8, including orientation, status, each refusal and its exit code) with its mutation run; acceptance on the Mac (84405 fresh picks within AGREE_MM of its own recorded readings 216.49/108.49/105.34; measuring scoreboard 4/4; `photos:score` 12/12) and in a fresh Linux chat sandbox (the same figures within 0.5 mm of the Mac's, `--json`, a PNG overlay).
- E1 (item 10): `--json` in the stated layout (kind values, facing, status and why, reference ends, end order, outside-the-photo End, overlay key), progress on stderr, `{ refused }` and `{ usage }`; tested.
- E2 (item 11, taste: the owner confirms at the gate): `--overlay`, 1,600 px, dots, squares, coloured rings from twelve colours repeating past twelve, key printed and in JSON, no text drawn, `<points>.overlay.png` via `writePng`, other paths exit 2, skipped by `checkFolder`, drawn for a refused run too; tested.
- E3 (item 12): `photoMeasureScoreboard.ts` with points, expected figures, tolerances and their basis hard-coded; entries 84405 and 84404 (T, own readings, AGREE_MM) and 84401 and 84402 (long straight, known 216 mm, TOLERANCE_MM); automatic grid and reference; missing photos skipped and counted; `<passed>/<ran> pass`; exit 1 on a miss or none ran; `package.json` script; its core tested on the synthetic photo with an unrefined offset point moved 5 px.
- Delivery (taste, decision 14): three PRs in turn, none stacked.
<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:dx -->
- DX D1-D3: `--help` on both tools (usage, flags, exits, format, minimal and full examples, pointer to the skill's code table), exit 0; the crop prints its mapping; one code table for both tools, code first, values named, fix last, recovery class, stderr in text mode, `{ code, reason, fix, recovery }` in JSON.
- D4, D5: `photo-missing`, `no-converter`, `photo-unreadable` (converters tried and their first stderr line); 60 s converter timeout; tested.
- D6 (taste): `{ crop, at }` points mapped from the crop's name; tested against `fromCrop`.
- D7: `--photo`, `--auto` as alias, `needs-photo`. D8: facing fix by end kind. D9: values in every refusal.
- D10: points file validated whole (`points-invalid`, field path); `--json` found before other checks. D11: `REFUSED internal` with a trace file.
- D12: overlay written atomically; JSON names it only when written; a refused run's JSON carries photo, grid and overlay. D13: `--overlay` a folder or any `*.overlay.png`, `overlay-path` shows the accepted path.
- JSON: `schema: 1`, ends nested in each figure, `why: [{ code, end?, text }]`.
- D14: the skill's minimal and full examples with text and JSON output; the Linux acceptance records install commands and time to first figure (target < 5 min). D15: PR (a) also moves `photoMeasure`'s loading to `loadUpright`.
- Every test listed in item 8 for these, each mutation run and recorded.
- D4 and D7 supersede the CEO block's `NO_CONVERTER` and `--auto` wording: three photo-reading codes, and `--photo` with `--auto` as its alias.
<!-- /autoplan-accepted:dx -->

<!-- autoplan-accepted:eng -->
- Eng E1-E7: one rms rule for seeded and found grids; `jpegSize` (SOF0-15 except C4/C8/CC), square 6/8 refused; crop of another photo `points-invalid`; one `CODES` constant tested against the skill; loader choice in photoImage's header; `--photo` run under 30 s on the Mac [estimated], timed per scale.
- G1: 84404's scoreboard entry gives its reference. G1b: orientation claim corrected (35/35 owner JPEGs at 1, measured), `loadUpright` equals `loadPhoto` on orientation 1, tested.
- G2: `facesAway` by `(end − other) · (end − centre) > 0`; `straddlesCentre` kept for photoCheck; diagonal and tie tests.
- G3: `gridAndPlanks`, `AUTO_GRID_RMS_MAX_MM`, `paperTooWarm` in photoStraights. G4b: End carries `seed` and `at`; found reference keeps its evidence.
- G4, G5, G7: decoder sniffs JPEG/PNG/BMP/HEIC first, coder prefix and absolute paths, one 60 s deadline, ENOENT vs failed with stderr kept, injectable converters/deadline/spawn, malformed BMP `photo-unreadable`; `loadPhoto`'s pixels unchanged.
- G5b: geometry checked after mapping (`points-invalid` before work, `geometry` per figure). G6: crop resolved from the points folder, exact stem, crop-local `at` bounds. G6b: the scale case table, each cell tested. G8: whole `half`. G8b: overlay temp beside target. G11: all refused exits 3. G13: no trace in JSON.
- Every test listed in item 8 for these, each mutation run and recorded.
- G2 supersedes the CEO block's single-axis `facesAway` built into `straddlesCentre`; G1 supersedes "automatic reference" for 84404 in E3.
<!-- /autoplan-accepted:eng -->
## Approval (2026-11-09)

The owner replied `rec` at the /autoplan gate (gate_rev 2):
- **UC1 → b.** Build these tools as planned; the contributor brief (T2)
  also offers a ruler route for straights and plain curves, and its pilot
  compares the two. This changes the brief, not this plan; it goes into
  `docs/plan/2026-11-09-contributor-brief.md` with T2.
- **d1 → a** keep `--overlay`; **d2 → a** three PRs in turn, none stacked;
  **d3 → a** keep `{ crop, at }` points.
- **p1 → a** the plan as amended (decisions 1-53).

## Review record

<!-- autoplan-baseline-edits:ceo {"sourceSha256":"5cd6e5c479cb102717532df3a7a6daab005868164da5f6710d4343a58e8e6a5d","replacements":[{"oldText":"1. **Crops without `sips`** (`photoCrop.ts`). Cut the window from the pixels\n   `loadPhoto` returns (any converter), enlarge it ×4 in TypeScript (nearest\n   neighbour, so a pixel stays a square the eye can split), and write it as a\n   BMP; then convert it to PNG with the first converter that works, keeping\n   the BMP when none can. The window maths (`windowAround`, `fromCrop`) and\n   the name pattern (`CROP`) stay; the EXIF-orientation refusal stays (read\n   with `orientationOf` from `photoExif.ts` instead of `sips -g`).\n2. **The grid and the reference found automatically** (`photoMeasure.ts`).\n   With `--auto`, a points file may leave out `grid` and `reference`: the\n   grid comes from `findGridAuto` with the same scale retry as `photoCheck`\n   (moved to one shared function, not copied), and the reference is the\n   medium straight `namePlanks` finds, ends already refined. A points file\n   that gives them keeps working as today. The run prints which it used.\n3. **Figures beyond two points** (`photo.ts`, `photoMeasure.ts`). A figure is\n   either today's `[a, b]` (distance), or `{ point, line: [a, b], read:\n   \"offset\" | \"along\" }`: the point's distance from the line through `a` and\n   `b` (offset), or how far along that line from `a` its foot lies (along),\n   both in paper millimetres times the scale. Each end is refined as today; a\n   `point` is refined when the figure also gives `toward` (a second point on\n   its road, the axis `refineEnd` needs), else its hand reading is kept and\n   said.\n4. **One figure refused, not the run.** Each refined end is checked on its\n   own: it faces away from the camera when it lies beyond the photo's centre\n   in the direction it points (the across-the-middle rule, per end). A figure\n   with an end that faces the camera is reported \"refused: <which end> faces\n   the camera; measure from the other end or move the piece across the\n   middle\", the other figures are still read, and the exit code says some\n   were refused (1), none (0).\n5. **Pixels said plainly.** `photoMeasure.ts` prints the photo's size in\n   pixels and refuses a point outside it (\"points are in the photo's full\n   pixels, W×H; a point read off a smaller preview must be scaled\");\n   `photoCrop.ts` prints the photo's size beside each crop. The pip note\n   (`--break-system-packages`) is for the brief's draft (contributor-brief\n   T2), not code.\n6. **The drawing skill** (`.claude/skills/draw-piece/SKILL.md` step 7): the\n   new figure kinds, the automatic grid and reference, per-figure refusals,\n   and crops on any system.\n7. **Tests**, each pin's mutation run and recorded (CLAUDE.md):\n   - crop: a window from a BMP fixture enlarged ×4 maps back with `fromCrop`;\n     orientation refusal from EXIF bytes; the converter chain off macOS\n     (the existing `bmpConverters` test pattern);\n   - offset and along: exact on synthetic points, including a slanted line;\n   - the automatic grid and reference: `photoMeasure`'s core on the\n     synthetic photo `photoCheck.test.ts` draws, figures within 0.3 mm;\n   - per-end facing: an end facing the camera refuses its figure alone;\n   - a point outside the photo refused with the size named.\n8. **Acceptance, on the owner's Mac:** the T switch (84405) measured with the\n   new figures from fresh picks: through road, curved end along and out, each\n   within 0.5 mm of the library (216.46, 108.50, 105.53); the scoreboard\n   (`bun run photos:score`) still 12/12.\n\n## Not in scope\n\n- The brief itself (contributor-brief T2 and T5).\n- Measuring heights from photos (AGENTS.md: a ruler).\n- A new image library: the converters already on the machine do the work.","newText":"1. **Crops without `sips`** (`photoCrop.ts`, `photoImage.ts`). Cut the window\n   from the upright pixels `loadUpright` returns (any converter), enlarge it ×4 in\n   TypeScript (nearest neighbour, so a pixel stays a square the eye can\n   split), and write it with a new `writePng` in `photoImage.ts` (8-bit RGB,\n   `deflateSync` and `crc32` from `node:zlib`, no converter), so a crop is\n   always a PNG and `CROP` keeps its one pattern. Converters stay for reading\n   photos only. The window maths (`windowAround`, `fromCrop`) stay.\n   Orientation (CEO decisions 7, 20): a new `loadUpright` (`photoImage.ts`)\n   wraps `loadPhoto` and returns the photo upright, as a phone and a chat\n   preview show it, with `orientationOf` (`photoExif.ts`) read instead of\n   `sips -g`; `loadPhoto` itself, and so `photoCheck`, is unchanged. Orientation 1 is read as is; 6 and 8 (a\n   portrait phone photo) are turned in TypeScript unless the decoded width\n   and height show the converter already turned it; 3 and the mirrored\n   orientations, where the decoded size can't tell, are refused as today\n   (\"open and re-save the photo upright\"). A HEIC photo is refused (convert\n   to JPEG). The crop's JSON line gains the photo's upright `width` and\n   `height`.\n2. **The grid and the reference found automatically** (`photoMeasure.ts`).\n   With `--auto <photo>`: a points file that gives `grid` seeds `findGrid` as\n   today; one that leaves it out gets `findGridAuto` with the scale retry\n   `photoCheck` uses (`gridAndPlanks` moved to `photoStraights.ts` and shared,\n   not copied). A points file without `reference` uses the medium straight\n   `namePlanks` finds; if either of its ends was not refined, the run is\n   refused (\"the medium straight's <which> end couldn't be read: no shadow\n   across it, nothing touching it\"), as `photoCheck` refuses it. A given\n   reference's ends, and every figure's ends, keep today's rule: an end that\n   can't be refined keeps its hand reading, and says so (text and JSON). A\n   found grid is held to `photoCheck`'s limits: rms above\n   `AUTO_GRID_RMS_MAX_MM` (0.3 mm) and paper as warm as the wood\n   (`paperTooWarm`) each refuse the run (exit 1). With a given reference, the\n   scale retry keeps the first scale at which that reference's `k` falls in\n   `K_PLAUSIBLE`, with `k` read from that reference's refined ends at each\n   scale (a hand reading where an end can't be refined). `--auto` reads the\n   photo upright through the same `loadUpright` as the crop (item 1), so points\n   picked off a crop or a chat preview match; an orientation it refuses, and\n   a HEIC, refuse the run (exit 1); a PNG or BMP carries no orientation and\n   is read as is.\n   `PhotoInput`'s `grid` and `reference` become optional; without `--auto`,\n   a points file missing either is a usage error (exit 2). The run says which\n   grid and reference it used.\n3. **Figures beyond two points** (`photo.ts`, `photoMeasure.ts`). A figure is\n   either today's `[a, b]` (distance), or `{ point, toward?, line: [a, b],\n   read: \"offset\" | \"along\" }`. `offset`: the point's distance from the line\n   through `a` and `b`, never negative. `along`: how far along that line,\n   from `a` towards `b`, the point's foot lies; negative when the foot falls\n   before `a`. Both in paper millimetres times the scale. Line ends are\n   refined as today (each against the other); a `point` is refined against\n   `toward` when given, else its hand reading is kept and said.\n4. **One figure refused, not the run** (`photoEdges.ts`, `photoMeasure.ts`).\n   A new `facesAway(img, end, other)`: an end faces away from the camera when\n   it lies beyond the photo's centre in the direction from `other` to `end`,\n   measured along whichever photo axis (rows or columns) that direction runs\n   mostly along, exactly as `straddlesCentre` picks its axis today. For a\n   figure's `point`, `other` is its `toward`. `straddlesCentre(a, b)` becomes\n   `facesAway(a, b) && facesAway(b, a)`, so `photoCheck` and the scoreboard\n   (84397) keep their whole-piece rule unchanged. In `photoMeasure`: a\n   reference end facing the camera refuses the run (every figure depends on\n   the scale); a figure end facing it refuses that figure alone (\"refused:\n   <which end> faces the camera; measure from the other end or move the piece\n   across the middle\"); a `point` without `toward` is \"facing not checked\".\n   Exit: 0 every figure read, 1 the run refused (a bad grid, a reference\n   problem, a grid or reference point outside the photo, an orientation\n   `loadUpright` refuses, a HEIC, a photo no converter reads),\n   2 bad usage (including a new feature asked for without `--auto`), 3 some\n   figures refused (a figure end facing the camera or outside the photo).\n   Every figure read carries a status (CEO decision 12): `checked` when each\n   of its ends was refined and its facing checked, else `provisional`, with\n   the reasons (an end kept as hand reading, \"facing not checked\"); a\n   reference end kept as a hand reading makes every figure provisional. The\n   exit code doesn't change; a catalogue figure still needs two photos to\n   agree (`agreedFigure`, `photoReadings.ts`).\n5. **Pixels said plainly.** `photoMeasure.ts` prints the photo's size and\n   refuses a point outside it (\"points are in the photo's full pixels, W×H;\n   a point read off a smaller preview must be scaled\"). Every new feature\n   (automatic grid or reference, `offset`/`along`, facing, bounds, `--json`,\n   `--overlay`) needs the photo, so it needs `--auto <photo>`; without it,\n   only today's plain two-point figures with a given grid run, and asking for\n   more is a usage error (exit 2) that says so. The pip note (`--break-system-packages`) is for the brief's\n   draft (contributor-brief T2), not code.\n6. **The command line** (`photoMeasure.ts`): flags parsed by name\n   (`--auto <photo>`, `--json`, `--overlay <out.png>`), the points file the\n   one positional argument; a usage error exits 2, and so does a points\n   file that isn't valid JSON or has no figures, with the parse error or\n   \"no figures\" named (CEO decision 17). A photo no converter can read\n   refuses the run (exit 1) with `NO_CONVERTER`'s text, which says what to\n   install (CEO decision 18). The CLI only parses, loads and exits: a pure\n   core takes the points and the image and returns one result object, which\n   the text output, `--json` and `--overlay` all render (CEO decision 19).\n7. **The drawing skill** (`.claude/skills/draw-piece/SKILL.md` step 7): the\n   new figure kinds, the automatic grid and reference, per-figure refusals\n   and their exit codes, `--json`, `--overlay`, and crops on any system; and\n   how to choose `toward`: a point on the same road's centreline, at least\n   20 mm back from the end, so the end face is square to the line between\n   them (for a switch's curved end, back along the curve, not along the\n   straight road). Also (CEO decisions 11, 13): the workflow from photo to\n   figure, step by step (crop around each end, read the point off the\n   enlarged crop, `fromCrop` back to photo pixels, then the points file);\n   what the tools need (Bun, and one of `magick`, `convert` or `ffmpeg` to\n   read a JPEG; macOS has `sips`; Windows is not supported, use WSL); and\n   the conditions a measurement assumes, said again in the facing refusal:\n   the reference is the 144 mm medium straight, lying flat beside the piece\n   with its top face level with the piece's; the photo is uncropped, taken\n   from roughly above the middle of the sheet.\n8. **Tests**, each pin's mutation run and recorded (CLAUDE.md):\n   - crop: a window from a BMP fixture enlarged ×4 maps back with `fromCrop`;\n     `writePng`'s chunks carry correct CRCs and its image data inflates back\n     to the pixels written; the converter list off macOS;\n   - orientation: a synthetic image tagged 6 and 8 comes back upright (a\n     marked corner where the phone shows it); one the converter already\n     turned (decoded size swapped) isn't turned twice; 3 and a mirrored\n     orientation are refused;\n   - offset and along: exact on synthetic points, a slanted line, a foot\n     before `a` (negative along);\n   - the automatic grid and reference: `photoMeasure`'s core on the\n     synthetic photo `photoCheck.test.ts` draws, figures within 0.3 mm; an\n     unrefined reference end refuses the run;\n   - facing: an end facing the camera refuses its figure alone (exit 3); a\n     reference end facing it refuses the run (exit 1); `straddlesCentre`'s\n     existing tests unchanged;\n   - a point outside the photo refused with the size named;\n   - `--json` parsed back for a run with one figure read and one refused;\n   - `--overlay`: marker pixels land at the scaled points;\n   - the measuring scoreboard's core (entries and a photo loader injected):\n     on the synthetic photo `photoCheck.test.ts` draws, a stored entry passes\n     within its tolerance, and the same entry\n     with an `offset` point given without `toward` (never refined) moved 5 px\n     square to its line fails (about 1 mm on that photo);\n   - `checkFolder` skips `.overlay.png` beside a photo, as it skips crops;\n   - status: a figure with every end refined and facing checked is\n     `checked`; one with an end kept as hand reading, or a point without\n     `toward`, is `provisional` and names why; a hand-read reference end\n     makes every figure `provisional`;\n   - refusals, each with its exit code: a HEIC and an orientation-3 JPEG in\n     `photoMeasure` and in the crop (1); a found grid over 0.3 mm rms and warm\n     paper (1); a points file missing `grid` or `reference` without `--auto`\n     (2); an `--overlay` path that is neither a folder nor the expected name\n     (2); a figure point outside the photo (3, its `End` reading \"outside the\n     photo\");\n   - the scale chosen with a given reference by `K_PLAUSIBLE`, on the\n     synthetic photo with 5 mm lines as dark as 10 mm ones;\n   - a `point` without `toward` reports \"facing not checked\";\n   - a points file that isn't JSON, and one with no figures (2); a photo no\n     converter reads, with the converter list injected empty (1, the\n     `NO_CONVERTER` text);\n   - `photoCheck` on an orientation-3 photo still checks it (`loadPhoto`\n     unchanged);\n   - an overlay is drawn for a refused run.\n9. **Acceptance** (CEO decisions 9, 10). Two kinds of check, kept apart:\n   repeating a photo's recorded reading shows the new code reads as the old\n   did; reading a piece of known length shows it reads right.\n   - **On the owner's Mac.** The T switch (84405) from fresh picks: the\n     through road's socket end (S) and peg end (P) as a distance figure; the\n     curved end's centre (C) with `toward` 20 mm back along its curve, read\n     against the line S→P as `along` and `offset`; each within `AGREE_MM`\n     (0.5 mm) of 84405's own recorded readings (216.49, 108.49, 105.34,\n     `photoReadings.ts`). If C can't be refined, its hand reading is kept\n     and the check still asks 0.5 mm. The measuring scoreboard (item 12)\n     ran every entry and passed (`4/4 pass`), which includes the long\n     straight of known length. The photo scoreboard (`bun run photos:score`)\n     still 12/12.\n   - **In a fresh Linux chat sandbox**, as the spike ran (the spike kit, no\n     `sips`): crops of 84405, then the same three figures with `--auto`,\n     `--json` and `--overlay`, each within 0.5 mm of the Mac's run, and the\n     overlay a PNG. What the sandbox needed installed is written into the\n     skill (item 7).\n10. **Machine-readable results** (`photoMeasure.ts --json`, CEO E1): stdout is\n    one JSON object, progress goes to stderr: `{ photo: {width, height},\n    grid: {source: \"seeded\"|\"found\", points, rmsMm}, reference: {source:\n    \"given\"|\"found\", k, ends: [End, End]}, figures: { <name>: { kind:\n    \"distance\"|\"offset\"|\"along\", facing: \"checked\"|\"not checked\", valueMm,\n    status: \"checked\"|\"provisional\", why: string[] } | { kind, facing,\n    refused: <reason> } }, ends: { <figure>: End[] },\n    overlay?: { path, key: [{ colour, figure, end }] } }`, where `End` is\n    `{ refined: true, samples, spreadMm } | { refined: false, reason }` (an\n    end outside the photo is `{ refined: false, reason: \"outside the photo\" }`)\n    and a\n    three-point figure's ends are ordered line `a`, line `b`, `point`. A\n    refused run prints `{ refused: <reason> }`; a usage error (exit 2) prints\n    `{ usage: <message> }`. The text output stays the default.\n11. **A picture of the points used** (`photoMeasure.ts --overlay <out.png>`,\n    CEO E2): the photo shrunk to 1,600 px on its longest side, with each grid\n    crossing used as a small dot, the reference's ends as squares and each\n    figure end as a ring in its own colour from a fixed list of twelve (past\n    twelve ends the colours repeat; the key lists every end); the key\n    (colour → figure and end) is printed with the results and in `--json`.\n    No text is drawn. Written with `writePng`, named `<points>.overlay.png`\n    beside the points file; `--overlay` takes a folder or that name, and any\n    other path is a usage error (exit 2). `checkFolder` skips that name\n    beside `CROP`. A refused run still draws\n    its overlay when the photo loaded, with whatever was found (grid\n    crossings, reference ends) and the given points, since that is when the\n    picture helps most.\n12. **A measuring scoreboard** (`bun run photos:measure-score`, CEO E3):\n    `engine/tools/photoMeasureScoreboard.ts` holds each known piece's points\n    and expected figures hard-coded in its source (pixel coordinates only;\n    the photos stay in the ignored `photos/`; each entry uses the automatic\n    grid and reference), as `photoScoreboard.ts` holds its verdicts; a\n    missing photo is skipped and counted, as `photos:score` says \"(n photos\n    not in photos)\"; it prints `<passed>/<ran> pass` and exits 1 on any miss\n    or when none ran; `package.json` gains the script. Each entry states its\n    expected figure, its tolerance and the basis for both (CEO decision 10):\n    84405 and 84404, the T switch's three figures against each photo's own\n    recorded reading within `AGREE_MM` (repeatability); 84401 and 84402, the\n    long straight against its known 216 mm within `TOLERANCE_MM` (1 mm, the\n    216 mm trial's bound; those photos read about 0.7 mm long, and the entry\n    says so). New pieces join as they're measured.\n\n**Delivery** (taste, CEO decision 14; the owner confirms at the gate): three\nPRs, each merged before the next is opened (none stacked): (a) `writePng`,\n`loadUpright` and crops off macOS (item 1); (b) `photoMeasure`'s\nnew core (items 2-6 and its tests); (c) `--json`, `--overlay`, the\nmeasuring scoreboard and the skill (items 7, 10-12), with the acceptance\n(item 9) run on (c).\n\n## Not in scope\n\n- The brief itself (contributor-brief T2 and T5).\n- Measuring heights from photos (AGENTS.md: a ruler).\n- A new image library: the converters already on the machine do the work.\n- Figure kinds beyond distance, offset and along (a radius, an angle):\n  added when a piece needs one.\n- The tool proposing end points itself (deferred, a pending write to\n  `docs/plan/generic-TODOS.md`; CEO decision 13): the overlay and `provisional` status show a bad pick first.\n- Sharing the owner's photos as fixtures outside git (rejected, CEO\n  decision 16): photos are never shared (SEC1); the synthetic photo covers\n  the code, the owner's Mac covers the real ones.\n- Proving the method on many contributors' pieces and references (CEO\n  decision 11): that is the brief's pilot (contributor-brief T2, T5)."}]} -->

<!-- autoplan-accepted:ceo -->
- Items 1-9 as written in the Implementation plan, including: `writePng` (node:zlib) for every crop and overlay, converters for reading only, `CROP` unchanged; `loadUpright` returning the photo upright, `loadPhoto` and `photoCheck` unchanged (orientation 1 as is; 6 and 8 turned unless the decoded size shows the converter turned it; 3 and mirrored refused), HEIC refused; the crop's JSON with upright `width` and `height`; seeded `findGrid` when a grid is given, `findGridAuto` with the shared scale retry when not, held to AUTO_GRID_RMS_MAX_MM and paperTooWarm (exit 1); the scale with a given reference chosen by K_PLAUSIBLE from its refined ends; a found reference refused when an end isn't refined, other ends keeping their hand reading and saying so; `grid`/`reference` optional only with `--auto` (else exit 2); `offset` unsigned, `along` signed; `facesAway` per end on the dominant photo axis with `straddlesCentre` built on it (photoCheck unchanged), a point's `other` its `toward`; exits 0/1/2/3 mapped as written, a malformed or figure-less points file exit 2, an unreadable photo exit 1 with `NO_CONVERTER`; a pure core whose one result object every output renders; each figure `checked` or `provisional` with reasons, exit code unchanged; the skill's step 7 including how to choose `toward`, the crop-to-points workflow, the tools needed (Windows unsupported) and the measuring conditions; every listed test (item 8, including orientation, status, each refusal and its exit code) with its mutation run; acceptance on the Mac (84405 fresh picks within AGREE_MM of its own recorded readings 216.49/108.49/105.34; measuring scoreboard 4/4; `photos:score` 12/12) and in a fresh Linux chat sandbox (the same figures within 0.5 mm of the Mac's, `--json`, a PNG overlay).
- E1 (item 10): `--json` in the stated layout (kind values, facing, status and why, reference ends, end order, outside-the-photo End, overlay key), progress on stderr, `{ refused }` and `{ usage }`; tested.
- E2 (item 11, taste: the owner confirms at the gate): `--overlay`, 1,600 px, dots, squares, coloured rings from twelve colours repeating past twelve, key printed and in JSON, no text drawn, `<points>.overlay.png` via `writePng`, other paths exit 2, skipped by `checkFolder`, drawn for a refused run too; tested.
- E3 (item 12): `photoMeasureScoreboard.ts` with points, expected figures, tolerances and their basis hard-coded; entries 84405 and 84404 (T, own readings, AGREE_MM) and 84401 and 84402 (long straight, known 216 mm, TOLERANCE_MM); automatic grid and reference; missing photos skipped and counted; `<passed>/<ran> pass`; exit 1 on a miss or none ran; `package.json` script; its core tested on the synthetic photo with an unrefined offset point moved 5 px.
- Delivery (taste, decision 14): three PRs in turn, none stacked.
<!-- /autoplan-accepted:ceo -->

### CEO phase: Step 0 (auto-decided, /autoplan)

Methodology read: `autoplan-ceo-methodology-oaH0Px/methodology.md` ranges
1-600, 601-1200, 1201-1800, 1801-2223 (EOF, 2,223 lines).

**0A. Premise.** The real problem: the contributor brief (T2 onward) needs a
chat Claude to measure a new piece with the repo's own tools, and the spike
showed four places where it had to write its own code instead
(`photoCrop.ts:65-90` calls `sips`; `photoMeasure.ts:45` needs labelled grid
seeds; only point-to-point figures, `photo.ts` `scaleAndMeasure`;
`photoMeasure.ts:49-51` exits on the first straddle failure). Direct, not a
proxy: each change removes a hand-written helper the spike needed. Do
nothing: the brief can't be written, or it asks parents' Claude to improvise
code, the "second pipeline" AGENTS.md forbids. Premises accepted (P6).

**0B. Leverage.** `loadPhoto` / `bmpConverters` (photoImage.ts) decode off
macOS; `findGridAuto` and `gridAndPlanks`' scale retry (photoCheck.ts:61);
`findWood` / `namePlanks` (photoStraights.ts) find the reference with
refined ends; `refineEnd` (photoEdges.ts:102); `orientationOf`
(photoExif.ts:92); `windowAround` / `fromCrop` / `CROP`. Nothing is rebuilt;
`gridAndPlanks` moves to be shared rather than copied (P4).

| Premise | Claim | Receipt | Verdict |
|---|---|---|---|
| P1 | photoCrop needs `sips` | engine/tools/photoCrop.ts:65-90 | true |
| P2 | photoMeasure needs labelled grid seeds | engine/tools/photoMeasure.ts:45 | true |
| P3 | a straddle failure ends the run | engine/tools/photoMeasure.ts:49-51 | true |
| P4 | photoImage already decodes off macOS | engine/tools/photoImage.ts (bmpConverters) | true |
| P5 | the spike's sandbox had ImageMagick 6 and ffmpeg | docs/plan/2026-11-09-contributor-brief.md (spike results) | true (reported by the sandbox) |

unverified=0

REALITY: premise-table pass 5 claims, 0 unverified engine/tools/photoCrop.ts:65
REALITY: already-done pass nothing on main since 2026-11-09 touches photoCrop or photoMeasure (last: cd6d335, the dry-run fixes) engine/tools/photoMeasure.ts:45
REALITY: surface-check pass ImageMagick 6 `convert` and ffmpeg are already in bmpConverters' order engine/tools/photoImage.ts:56
REALITY: binding-decisions pass AGENTS.md "Don't write a second pipeline" kept: every change extends engine/tools/photo*.ts AGENTS.md:46
REALITY: numbers pass 0.5 mm (photoReadings agreement), library figures 216.46/108.50/105.53 [measured: library T source note] engine/data/photoReadings.ts:1
REALITY: deferred-asks pass no linked issue; the pip note moves to the brief (contributor-brief T2) docs/plan/2026-11-09-contributor-brief.md:285
REALITY: pr-count pass three PRs in turn, none stacked (taste, decision 14; no ship policy) AGENTS.md:83

**0C. Dream state.**
```
  CURRENT                         THIS PLAN                          12-MONTH IDEAL
  tools work on the owner's  ---> any sandbox, any piece: crops, ---> a parent's Claude measures any
  Mac, with hand-labelled          automatic grid, offset/along,       piece with one command per photo,
  grids and 2-point figures        per-figure refusals, JSON,          checked against stored known
                                   overlay, measuring scoreboard       pieces on every change
```

**0D. Approach (auto).** A) the plan as written; B) only the crop fallback
and docs (Claude keeps writing helpers: fails the premise); C) a new
semantic CLI per piece type (overbuilt). Chose A (P1, P5). Mechanical.

**0E. Mode.** SELECTIVE EXPANSION (autoplan override).

**0G. HOLD checks.** About 9 files [estimated: photoCrop, photoMeasure,
photo.ts, photoCheck (shared retry), photoEdges (per-end rule), SKILL.md,
tests, package.json, scoreboard]; no new service. Nothing deferrable without
breaking the brief. Expansion candidates, each in the blast radius and under
a day: E1 `--json` (approve, P2), E2 `--overlay` (approve, TASTE: 3-5 files
and new drawing code), E3 measuring scoreboard (approve, P2: extends the
`photos:score` pattern; makes item 8 repeatable).

**0H.** CEO summary at `~/.gstack/projects/raduuuuu-ChooChooCAD/ceo-plans/2026-11-09-measuring-tools.md`.
Spec review: 3 passes (scores 6, 7, 7), 18 + 14 + 12 issues; all applied; the
third pass's 12 checked against the text (issues verified: 12 of 12), spec not
re-verified. Document approval auto-decided A (P6), decision 6.

**0I. Temporal interrogation.**
```
  HOUR 1:   writeBmp, converters(platform, format), the crop off sips (plus
            HEIC and orientation refusals); facesAway with straddlesCentre on it
  HOUR 2-3: photoMeasure's core: optional grid/reference, the shared scale
            retry moved from photoCheck, offset/along, per-figure refusals,
            exit codes, bounds; the argument parser
  HOUR 4-5: --json, --overlay (ring drawing on a shrunk copy), the measuring
            scoreboard and its synthetic test; the skill's step 7
  HOUR 6+:  every refusal's test and mutation; acceptance on 84405 on the Mac
```
No feasibility blocker. Effort: human ~4 days / CC + gstack ~3 h [estimated].

### CEO phase: Step 0.5, dual voices

Native CEO voice (Claude subagent, INPUT `ceo 35695d03…`, matching the
snapshot): 8 findings.

1. CRITICAL: refusing rotated JPEGs refuses most portrait phone photos;
   turn the pixels instead. (decision 7)
2. HIGH: no acceptance off macOS; say whether Windows works. (decision 9)
3. HIGH: write PNG in TypeScript (node:zlib) instead of BMP plus a
   converter; drop the `.bmp` fallbacks. (decision 8)
4. HIGH: a scoreboard of one entry; state the tolerance's basis; add pieces.
   (decision 10)
5. MEDIUM: spell out the crop-to-points workflow; later, propose end points
   automatically. (decision 13)
6. MEDIUM: split into three PRs. (decision 14, taste)
7. MEDIUM: say why photos rather than calipers; route simple pieces to
   calipers. (User Challenge UC1)
8. MEDIUM: state the uncropped, centred-camera assumption. (decision 11)

Codex CEO voice (gpt-6-astra, completed): 6 findings.

1. HIGH: acceptance partly circular: 84405 checked against figures read
   from 84405 and 84404; the 216 mm trial read 216.52 and 216.88, outside
   0.5 mm. Verified (`photoReadings.ts:43-47, 61-76`). (decision 10)
2. HIGH: the scale assumes the 144 mm reference and level top faces; a
   0.5 mm reference error is about 0.75 mm over 216 mm and no check sees
   it. Verified (`photo.ts:1-20`). (decision 11)
3. HIGH: Linux asserted, not tested; JPEG input still needs a converter.
   Verified (`photoImage.ts:67-90`, `NO_CONVERTER`). (decisions 9, 18)
4. HIGH: assumes tooling is the contributors' bottleneck; pilot against
   guided direct measurement first. (User Challenge UC1)
5. MEDIUM: exit 0 can hide hand readings; give results a provisional or
   checked status. (decision 12)
6. MEDIUM: the scoreboard keeps the owner as the only validator; missing
   photos skip silently. Verified (`photoScoreboard.ts:41-57`).
   (decision 10; shared fixtures rejected, decision 16)

```
CEO DUAL VOICES — CONSENSUS TABLE:
  Dimension                           Claude   Codex    Consensus
  1. Premises valid?                   partly   partly   CONFIRMED: orientation refusal (Claude) and the
                                                         reference/plane assumption (Codex) were unstated
  2. Right problem to solve?           yes, but yes, but CONFIRMED concern: photos vs calipers/direct
                                       calipers pilot    measurement → User Challenge UC1
  3. Scope calibration correct?        no       no       CONFIRMED: no Linux acceptance; scoreboard too thin
  4. Alternatives sufficiently explored? no     no       CONFIRMED: writePng (Claude), direct measuring (both)
  5. Competitive/market risks covered? no       no       CONFIRMED: real contributors' photos and pieces
                                                         (portrait photos; other references)
  6. 6-month trajectory sound?         partly   partly   CONFIRMED: acceptance must separate repeatability
                                                         from accuracy
CONFIRMED = completed subagent + outside. Single-voice critical: native 1
(orientation), flagged; accepted on P1 (decision 7).
```

### CEO phase: review sections

**Current scope.** Mode SELECTIVE EXPANSION (0E, autoplan override).
Accepted: items 1-9 (decision 1), E1 `--json` (3), E2 `--overlay` (4,
taste), E3 measuring scoreboard (5), and decisions 7-13, 17, 18, 20 below.
Taste: 4 (E2), 14 (three PRs). Deferred: end points proposed by the tool
(13; a pending write to `docs/plan/generic-TODOS.md`, made with this plan's PR because that file holds another session's uncommitted edits). Rejected: sharing the owner's photos (16). Pending the
owner: User Challenge UC1.

**Section 1: Architecture.**
```
  photo.jpg/png/bmp
     │
     ▼
  photoImage.loadPhoto ──(sips│magick│convert│ffmpeg, read only)──▶ RGB
     │                                    ▲
     │ photoCheck (unchanged)             │
     ▼                                    │
  photoImage.loadUpright ── orientationOf (photoExif) ── turn 6/8, refuse 3/mirrored
     │
     ├──▶ photoCrop: windowAround ×4 ──▶ photoImage.writePng ──▶ *.crop-x-y-side.png
     │
     └──▶ photoMeasure core (pure: input + image ──▶ result object)
            ├─ gridAndPlanks (moved photoCheck ──▶ photoStraights; photoCheck imports it)
            │    └─ findGrid (seeded) │ findGridAuto ×{1,2,0.5} ── rms, paperTooWarm
            ├─ reference: given │ namePlanks ── refineEnd ── K_PLAUSIBLE
            ├─ figures: distance │ offset │ along (photo.ts) ── refineEnd, facesAway (photoEdges)
            ├─ status checked │ provisional
            └─ render: text (default) │ --json ;  --overlay ──▶ writePng
  photoMeasureScoreboard ──▶ photoMeasure core (loader injected)
  photoCheck.straddlesCentre = facesAway(a,b) ∧ facesAway(b,a)
```
Data flows. Happy: a points file and photo give figures, exit 0. Nil: no
`grid`/`reference` without `--auto` gives exit 2; no photo gives exit 2.
Empty: a points file with no figures was unhandled (it would print nothing
and exit 0), **WARNING**, now exit 2 (decision 17). Error: no converter
threw an uncaught Error, now exit 1 with `NO_CONVERTER` (decision 18);
malformed JSON threw a stack trace, now exit 2 (decision 17).
Coupling: photoCheck imports `gridAndPlanks` from photoStraights (justified:
one retry, P4) and `straddlesCentre` sits on `facesAway` (photoCheck's
results pinned by `photos:score` 12/12). **WARNING** found here: putting
the turn in `loadPhoto` would make `photoCheck` refuse orientation-3 photos
it checks today; the turn moves to `loadUpright` (decision 20).
Scaling: one photo per run; 10x is ten runs. Single points of failure: the
converter for JPEG input (said by `NO_CONVERTER`, covered on Linux by the
sandbox acceptance). Security architecture: local CLI, no endpoints.
Rollback: revert the PR; no data or state changes. Value test: the
measuring scoreboard is consumed by the acceptance and by every later change
to the photo tools (it fails the build of confidence, not CI, since photos
are local); the overlay is read by the agent picking points.

**Section 2: Error & Rescue Map.**
```
  CODEPATH                    | WHAT CAN GO WRONG                  | CLASS
  ----------------------------|------------------------------------|---------------------
  loadUpright                 | no converter                       | Error(NO_CONVERTER)
                              | orientation 3/mirrored, HEIC       | refusal (value)
  photoMeasure args/parse     | unknown flag, missing points file  | usage
                              | not JSON, no figures               | SyntaxError / usage
  gridAndPlanks               | no grid at any scale, rms > 0.3,   | refusal (value)
                              | warm paper                         |
  reference                   | end not refined (found), k outside | refusal (value)
                              | K_PLAUSIBLE                        |
  figure                      | end faces camera, outside photo    | per-figure refusal
                              | end not refined                    | provisional (value)
  writePng (crop, overlay)    | folder not writable                | Error (fs)
  --overlay path              | neither folder nor expected name   | usage

  CLASS                 | RESCUED? | ACTION                          | USER SEES
  ----------------------|----------|---------------------------------|------------------------------
  Error(NO_CONVERTER)   | Y        | exit 1                          | what to install
  refusal (run)         | Y        | exit 1, overlay still drawn     | reason + `{ refused }`
  usage / SyntaxError   | Y        | exit 2                          | message + `{ usage }`
  per-figure refusal    | Y        | exit 3, other figures read      | "refused: <end> faces…"
  provisional           | Y        | exit 0, status + reasons        | "provisional: <why>"
  Error (fs) on write   | N ← ok   | uncaught, Bun prints the path   | the OS error (EACCES/ENOENT)
```
No silent failures. The one unrescued class (a write error) prints the OS
message and path and exits non-zero; acceptable for a local CLI (P5).

**Section 3: Security & Threat Model.** Inputs: a local points file and
photo given by the person running it. Converters are spawned with argument
arrays (`execFileSync`), no shell (`photoImage.ts:76-78`): no command
injection from a file name. The overlay path is restricted to a folder or
`<points>.overlay.png` (exit 2 otherwise): no write to an arbitrary path.
Data: photos may carry location; `writePng` writes pixels and no metadata,
so crops and overlays carry none (an improvement over a converter, which
may copy EXIF). Threat: a crafted BMP/PNG crashing a converter: low
likelihood, low impact (local, own files). No new dependencies, no secrets.
No issues found beyond what the plan covers.

**Section 4: Data flow and edge cases.**
```
  points.json ──▶ parse ──▶ validate (grid/reference/--auto, figures ≥ 1, in bounds)
              ──▶ measure (core) ──▶ render text│json ──▶ stdout; progress ──▶ stderr
      nil: no file ─▶ exit 2 │ empty: {} or no figures ─▶ exit 2 │ wrong type: not JSON ─▶ exit 2
      invalid: point outside photo ─▶ exit 1 (grid/reference) or 3 (figure)
      huge: 48 MP photo ─▶ 144 MB RGB, ×2 while turning (Section 7)
      stale: a crop's offsets from another photo ─▶ fromCrop maps wrong; caught by
             the overlay and the bounds check only if it lands outside
```
Interaction edge cases (a CLI run by an agent): rerun after a refusal is
idempotent (no state); two runs writing the same overlay name: last wins,
harmless; a preview-scaled point is caught only when outside the photo, and
the size line plus the overlay show the rest. No async or shared state.
Gaps found: empty figures and malformed JSON (decision 17), fixed.

**Section 5: Code quality.** `photoMeasure.ts`'s top level would grow past
five branches (flags, grid source, reference source, figure kinds,
refusals, renderers); the plan's tests already call "photoMeasure's core",
so the core is a pure function returning a result object that both text and
JSON render, and the CLI only parses, loads and exits (decision 19, P5).
`gridAndPlanks` moved, not copied (P4). Names say what they do
(`facesAway`, `loadUpright`, `writePng`). No over-engineering found: no
plugin system for figure kinds (radius/angle deferred).

**Section 6: Tests.**
```
  NEW THING                         TYPE   HAPPY                     FAILURE/EDGE
  writePng                          unit   CRCs, inflates to pixels  —
  loadUpright                       unit   6, 8 turned               already turned; 3/mirrored refused
  crop off macOS                    unit   window ×4 ↔ fromCrop      converter list off macOS
  grid/reference auto               unit*  synthetic, ≤0.3 mm        unrefined reference end; rms; warm
  K_PLAUSIBLE scale choice          unit*  5 mm lines dark           —
  offset/along                      unit   exact, slanted            foot before a (negative)
  facesAway / per-figure refusal    unit*  —                         figure exit 3; reference exit 1
  status                            unit*  checked                   provisional ×3 causes
  bounds                            unit*  —                         outside photo, size named
  CLI usage                         unit   —                         not JSON, no figures, missing grid, bad overlay path
  NO_CONVERTER                      unit   —                         empty converter list → exit 1
  --json                            unit*  parsed back               one figure refused
  --overlay                         unit*  marker pixels placed      refused run still drawn
  measuring scoreboard core         unit*  entry passes              point moved 5 px fails
  checkFolder skips overlay         unit   skipped                   —
  photoCheck unchanged              unit   orientation-3 still read  photos:score 12/12 (manual)
  Linux sandbox                     manual crops, 3 figures, json, PNG overlay
  (* on the synthetic photo photoCheck.test.ts draws)
```
2am-Friday test: the measuring scoreboard 4/4 on the Mac plus the Linux
sandbox run. Hostile QA: a portrait photo whose converter turned it (no
double turn), a preview-scaled point inside the photo (overlay shows it).
No flaky dependencies: no time, randomness or network; converters are
injected in tests. Gaps found and added: empty/malformed points, no
converter, photoCheck unchanged (decisions 17, 18, 20).

**Section 7: Performance.** The slowest paths: `findGridAuto` at up to
three scales (seconds, as `photoCheck` today); turning a 48 MP photo (one
copy, about 144 MB more); the overlay shrink (one pass). No caching needed
for a one-shot CLI. No issues found.

**Section 8: Observability.** Progress lines on stderr; the result (text or
JSON) records grid source, points, rms, `k`, reference source and ends,
each end's refinement and each figure's status, so a reported bad figure
can be rebuilt from the JSON and the overlay. No services, so no metrics or
alerts. No gaps beyond decision 12 (status), already applied.

**Section 9: Deployment.** No deploy: tools and a skill. Three PRs in turn
(taste, decision 14); each is green on CI (Linux, converters injected) and
leaves `photos:score` 12/12 on the Mac. Rollback: revert the PR; no
migration. Risk window: none (no running service). The skill (step 7)
lands in PR (c), with the features it describes, so it never documents
flags that don't exist yet.

**Section 10: Long-term trajectory.** Debt: per-entry tolerances in the
scoreboard source (documented basis); orientation 3 and mirrored still
refused (rare from phones). Reversibility 5/5 (tools only). Next: the brief
(T2) and its pilot (UC1 decides whether photos stay the main path), then
end points proposed by the tool (deferred). Platform: `--json` and the core
make the tools callable by any agent, which the brief needs.
Retrospective on cherry-picks: E1 and E3 load-bearing (the brief's agent
reads JSON; E3 now carries the independent accuracy check); E2 taste.

### NOT in scope (CEO)

- Deferred: the tool proposing end points (decision 13, pending write to `docs/plan/generic-TODOS.md`).
- Rejected: owner's photos as shared fixtures (decision 16; SEC1).
- Elsewhere: proving the method across contributors' pieces and references
  (contributor-brief pilot, decision 11); the brief itself (T2, T5).
- Pending the owner: UC1, photos vs direct measuring for simple pieces.

### What already exists (CEO)

| Sub-problem | Existing code | Reused? |
|---|---|---|
| decode any photo | `loadPhoto`, `bmpConverters` (photoImage.ts) | yes, read only; wrapped by `loadUpright` |
| no-converter message | `NO_CONVERTER` (photoImage.ts) | yes (decision 18) |
| orientation | `orientationOf` (photoExif.ts) | yes, replaces `sips -g` |
| grid and scale retry | `findGrid`, `findGridAuto`, `gridAndPlanks` | yes, moved and shared |
| reference | `namePlanks`, `refineEnd` | yes |
| across-the-middle | `straddlesCentre` | rebuilt on `facesAway`, same results |
| scale | `scaleAndMeasure`, `K_PLAUSIBLE`, `REFERENCE_MM` | yes |
| agreement rules | `AGREE_MM`, `TOLERANCE_MM`, `agreedFigure` | yes (scoreboard tolerances, status) |
| scoreboard pattern | `photoScoreboard.ts` | yes (E3) |

### Dream state delta (CEO)

After this plan: any Linux or Mac sandbox crops and measures a piece, with
the grid and reference found, per-figure refusals, a status per figure, JSON
and a picture of the points. Still short of the 12-month ideal: points are
still picked by eye (deferred), the method is proven on the owner's pieces
only (the pilot), and the scoreboard runs on the owner's Mac only.

### Error & Rescue Registry (CEO)

See Section 2's two tables: 9 codepaths, 6 classes, 0 CRITICAL GAPS.

### Failure Modes Registry (CEO)

```
  CODEPATH        | FAILURE MODE                 | RESCUED? | TEST? | USER SEES?                | LOGGED?
  ----------------|------------------------------|----------|-------|---------------------------|--------
  loadUpright     | no converter                 | Y        | Y     | what to install           | stderr
  loadUpright     | double turn                  | Y        | Y     | upright photo             | —
  loadUpright     | orientation 3 / mirrored     | Y        | Y     | re-save upright           | stderr
  photoCheck      | starts refusing rotated      | Y (20)   | Y     | unchanged                 | —
  args            | not JSON / no figures        | Y        | Y     | usage message             | stderr
  grid            | none, rms, warm paper        | Y        | Y     | refused + overlay         | stderr/JSON
  reference       | unrefined (found), k         | Y        | Y     | refused + overlay         | stderr/JSON
  figure          | faces camera / outside       | Y        | Y     | that figure refused       | JSON
  figure          | hand reading kept            | Y        | Y     | provisional + why         | JSON
  scoreboard      | photo missing                | Y        | Y     | "(n photos not in…)"      | stdout
  sandbox         | Linux decoder differs        | Y        | manual| within 0.5 mm of Mac      | —
```
11 rows, 0 CRITICAL GAPS.

### Implementation Tasks (CEO)

- [ ] **T1 (P1, human: ~1d / CC: ~30min)** — photoImage — `writePng`, `loadUpright`, crops off macOS
  - Surfaced by: Step 0.5 native 1, 3; Section 1 (decision 20)
  - Files: engine/tools/photoImage.ts, engine/tools/photoCrop.ts, their tests
  - Verify: `bun run test`; `photos:score` 12/12 on the Mac
- [ ] **T2 (P1, human: ~2d / CC: ~1h)** — photoMeasure — core, auto grid/reference, figures, refusals, status, CLI
  - Surfaced by: items 2-6; decisions 12, 17, 18, 19
  - Files: engine/tools/photoMeasure.ts, photo.ts, photoEdges.ts, photoStraights.ts, photoCheck.ts, tests
  - Verify: `bun run test`; each mutation recorded
- [ ] **T3 (P1, human: ~1.5d / CC: ~45min)** — photoMeasure — `--json`, `--overlay`, measuring scoreboard (4 entries), skill step 7
  - Surfaced by: E1-E3; decisions 10, 11, 13
  - Files: engine/tools/photoMeasure.ts, engine/tools/photoMeasureScoreboard.ts, package.json, .claude/skills/draw-piece/SKILL.md, tests
  - Verify: `bun run photos:measure-score` 4/4 on the Mac
- [ ] **T4 (P1, human: ~1h / CC: ~15min)** — acceptance — Linux chat sandbox run
  - Surfaced by: Step 0.5 native 2, Codex 3 (decision 9)
  - Files: none (the spike kit)
  - Verify: three figures within 0.5 mm of the Mac's, `--json`, PNG overlay

### Completion Summary (CEO)

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | photoCheck reads no orientation; loadPhoto  |
  |                      | throws NO_CONVERTER; trial reads ~0.7mm long|
  | Step 0               | approach A; E1, E3 accepted; E2 taste       |
  | Section 1  (Arch)    | 2 issues found (empty/error paths; turn in  |
  |                      | loadPhoto would change photoCheck)          |
  | Section 2  (Errors)  | 9 error paths mapped, 0 GAPS (after 17, 18) |
  | Section 3  (Security)| 0 issues found, 0 High severity             |
  | Section 4  (Data/UX) | 8 edge cases mapped, 0 unhandled (after 17) |
  | Section 5  (Quality) | 1 issue found (core split, decision 19)     |
  | Section 6  (Tests)   | Diagram produced, 3 gaps (added)            |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 0 gaps found                                |
  | Section 9  (Deploy)  | 1 risk flagged (skill lands with features)  |
  | Section 10 (Future)  | Reversibility: 5/5, debt items: 2           |
  | Section 11 (Design)  | SKIPPED (no UI scope)                       |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 9 rows, 0 CRITICAL GAPS                     |
  | Failure modes        | 11 total, 0 CRITICAL GAPS                   |
  | TODOS.md updates     | 1 item, pending write (decision 13)         |
  | Scope proposals      | 3 proposed, 3 accepted (E2 taste)           |
  | CEO plan             | written                                     |
  | Outside voice        | codex completed                             |
  | Lake Score           | N/A (auto-decided, no questions asked)      |
  | Diagrams produced    | 4 (architecture, error map, data flow, test)|
  | Stale diagrams found | 0 (photoImage.ts and photo.ts headers to    |
  |                      | update with loadUpright/writePng in T1, T2) |
  | Unresolved decisions | 1 (UC1, at the gate)                        |
  | Reality rows         | 7/7 rows (PLAN_REALITY), 0 unverified       |
  +====================================================================+
```

Approval readiness: PASS (decisions 1-20 each auto-decided under the six
principles per autoplan; 4 and 14 taste, UC1 pending the owner).

<!-- autoplan-baseline-edits:dx {"sourceSha256":"115d3d747739454689c4992261005c2c1a1f9150fddd378e8e6a3d30e1e382de","replacements":[{"oldText":"1. **Crops without `sips`** (`photoCrop.ts`, `photoImage.ts`). Cut the window\n   from the upright pixels `loadUpright` returns (any converter), enlarge it ×4 in\n   TypeScript (nearest neighbour, so a pixel stays a square the eye can\n   split), and write it with a new `writePng` in `photoImage.ts` (8-bit RGB,\n   `deflateSync` and `crc32` from `node:zlib`, no converter), so a crop is\n   always a PNG and `CROP` keeps its one pattern. Converters stay for reading\n   photos only. The window maths (`windowAround`, `fromCrop`) stay.\n   Orientation (CEO decisions 7, 20): a new `loadUpright` (`photoImage.ts`)\n   wraps `loadPhoto` and returns the photo upright, as a phone and a chat\n   preview show it, with `orientationOf` (`photoExif.ts`) read instead of\n   `sips -g`; `loadPhoto` itself, and so `photoCheck`, is unchanged. Orientation 1 is read as is; 6 and 8 (a\n   portrait phone photo) are turned in TypeScript unless the decoded width\n   and height show the converter already turned it; 3 and the mirrored\n   orientations, where the decoded size can't tell, are refused as today\n   (\"open and re-save the photo upright\"). A HEIC photo is refused (convert\n   to JPEG). The crop's JSON line gains the photo's upright `width` and\n   `height`, and stderr says how to map back: \"a point at (cx, cy) in this\n   crop is (x0 + cx/4, y0 + cy/4) in the photo\" with the numbers filled in\n   (DX decision D2).\n2. **The grid and the reference found automatically** (`photoMeasure.ts`).\n   With `--auto <photo>`: a points file that gives `grid` seeds `findGrid` as\n   today; one that leaves it out gets `findGridAuto` with the scale retry\n   `photoCheck` uses (`gridAndPlanks` moved to `photoStraights.ts` and shared,\n   not copied). A points file without `reference` uses the medium straight\n   `namePlanks` finds; if either of its ends was not refined, the run is\n   refused (\"the medium straight's <which> end couldn't be read: no shadow\n   across it, nothing touching it\"), as `photoCheck` refuses it. A given\n   reference's ends, and every figure's ends, keep today's rule: an end that\n   can't be refined keeps its hand reading, and says so (text and JSON). A\n   found grid is held to `photoCheck`'s limits: rms above\n   `AUTO_GRID_RMS_MAX_MM` (0.3 mm) and paper as warm as the wood\n   (`paperTooWarm`) each refuse the run (exit 1). With a given reference, the\n   scale retry keeps the first scale at which that reference's `k` falls in\n   `K_PLAUSIBLE`, with `k` read from that reference's refined ends at each\n   scale (a hand reading where an end can't be refined). `--auto` reads the\n   photo upright through the same `loadUpright` as the crop (item 1), so points\n   picked off a crop or a chat preview match; an orientation it refuses, and\n   a HEIC, refuse the run (exit 1); a PNG or BMP carries no orientation and\n   is read as is.\n   `PhotoInput`'s `grid` and `reference` become optional; without `--auto`,\n   a points file missing either is a usage error (exit 2). The run says which\n   grid and reference it used.\n3. **Figures beyond two points** (`photo.ts`, `photoMeasure.ts`). A figure is\n   either today's `[a, b]` (distance), or `{ point, toward?, line: [a, b],\n   read: \"offset\" | \"along\" }`. `offset`: the point's distance from the line\n   through `a` and `b`, never negative. `along`: how far along that line,\n   from `a` towards `b`, the point's foot lies; negative when the foot falls\n   before `a`. Both in paper millimetres times the scale. Line ends are\n   refined as today (each against the other); a `point` is refined against\n   `toward` when given, else its hand reading is kept and said.\n4. **One figure refused, not the run** (`photoEdges.ts`, `photoMeasure.ts`).\n   A new `facesAway(img, end, other)`: an end faces away from the camera when\n   it lies beyond the photo's centre in the direction from `other` to `end`,\n   measured along whichever photo axis (rows or columns) that direction runs\n   mostly along, exactly as `straddlesCentre` picks its axis today. For a\n   figure's `point`, `other` is its `toward`. `straddlesCentre(a, b)` becomes\n   `facesAway(a, b) && facesAway(b, a)`, so `photoCheck` and the scoreboard\n   (84397) keep their whole-piece rule unchanged. In `photoMeasure`: a\n   reference end facing the camera refuses the run (every figure depends on\n   the scale); a figure end facing it refuses that figure alone (\"refused:\n   <which end> faces the camera; measure from the other end or move the piece\n   across the middle\"); a `point` without `toward` is \"facing not checked\".\n   Exit: 0 every figure read, 1 the run refused (a bad grid, a reference\n   problem, a grid or reference point outside the photo, an orientation\n   `loadUpright` refuses, a HEIC, a photo no converter reads),\n   2 bad usage (including a new feature asked for without `--auto`), 3 some\n   figures refused (a figure end facing the camera or outside the photo).\n   Every figure read carries a status (CEO decision 12): `checked` when each\n   of its ends was refined and its facing checked, else `provisional`, with\n   the reasons (an end kept as hand reading, \"facing not checked\"); a\n   reference end kept as a hand reading makes every figure provisional. The\n   exit code doesn't change; a catalogue figure still needs two photos to\n   agree (`agreedFigure`, `photoReadings.ts`).\n5. **Pixels said plainly.** `photoMeasure.ts` prints the photo's size and\n   refuses a point outside it (\"points are in the photo's full pixels, W×H;\n   a point read off a smaller preview must be scaled\"). Every new feature\n   (automatic grid or reference, `offset`/`along`, facing, bounds, `--json`,\n   `--overlay`) needs the photo, so it needs `--auto <photo>`; without it,\n   only today's plain two-point figures with a given grid run, and asking for\n   more is a usage error (exit 2) that says so. The pip note (`--break-system-packages`) is for the brief's\n   draft (contributor-brief T2), not code.\n6. **The command line** (`photoMeasure.ts`): flags parsed by name\n   (`--auto <photo>`, `--json`, `--overlay <out.png>`), the points file the\n   one positional argument; a usage error exits 2, and so does a points\n   file that isn't valid JSON or has no figures, with the parse error or\n   \"no figures\" named (CEO decision 17). A photo no converter can read\n   refuses the run (exit 1) with `NO_CONVERTER`'s text, which says what to\n   install (CEO decision 18). The CLI only parses, loads and exits: a pure\n   core takes the points and the image and returns one result object, which\n   the text output, `--json` and `--overlay` all render (CEO decision 19).\n   For an agent reading the output (DX decisions D1, D3): `--help` on\n   `photoMeasure.ts` and `photoCrop.ts` prints the usage, every flag, the\n   exit codes, the points-file format and a complete example, and exits 0.\n   In text mode results go to stdout; a refused run's reason and a usage\n   error go to stderr. Every run refusal and usage error has a stable code\n   (`no-converter`, `orientation`, `heic`, `grid-not-found`, `grid-rms`,\n   `paper-warm`, `reference-unread`, `reference-faces-camera`,\n   `k-implausible`, `point-outside`, `usage`, `points-not-json`,\n   `no-figures`, `needs-auto`, `overlay-path`), printed first as\n   `REFUSED <code>:` or `USAGE <code>:`, with the fix on the message's last\n   line (retake how, re-save upright, install what, add `--auto <photo>`);\n   a per-figure refusal carries `faces-camera` or `point-outside` the same\n   way. The skill lists every code with its fix.\n7. **The drawing skill** (`.claude/skills/draw-piece/SKILL.md` step 7): the\n   new figure kinds, the automatic grid and reference, per-figure refusals\n   and their exit codes, `--json`, `--overlay`, and crops on any system; and\n   how to choose `toward`: a point on the same road's centreline, at least\n   20 mm back from the end, so the end face is square to the line between\n   them (for a switch's curved end, back along the curve, not along the\n   straight road). A complete points file to copy (DX decision D2): the T\n   switch's three figures, one distance and the `along` and `offset` of its\n   curved end with `toward`, no `grid` or `reference` (found), with the\n   command that reads it and what it prints. Also (CEO decisions 11, 13): the workflow from photo to\n   figure, step by step (crop around each end, read the point off the\n   enlarged crop, `fromCrop` back to photo pixels, then the points file);\n   what the tools need (Bun, and one of `magick`, `convert` or `ffmpeg` to\n   read a JPEG; macOS has `sips`; Windows is not supported, use WSL); and\n   the conditions a measurement assumes, said again in the facing refusal:\n   the reference is the 144 mm medium straight, lying flat beside the piece\n   with its top face level with the piece's; the photo is uncropped, taken\n   from roughly above the middle of the sheet.\n8. **Tests**, each pin's mutation run and recorded (CLAUDE.md):\n   - crop: a window from a BMP fixture enlarged ×4 maps back with `fromCrop`;\n     `writePng`'s chunks carry correct CRCs and its image data inflates back\n     to the pixels written; the converter list off macOS;\n   - orientation: a synthetic image tagged 6 and 8 comes back upright (a\n     marked corner where the phone shows it); one the converter already\n     turned (decoded size swapped) isn't turned twice; 3 and a mirrored\n     orientation are refused;\n   - offset and along: exact on synthetic points, a slanted line, a foot\n     before `a` (negative along);\n   - the automatic grid and reference: `photoMeasure`'s core on the\n     synthetic photo `photoCheck.test.ts` draws, figures within 0.3 mm; an\n     unrefined reference end refuses the run;\n   - facing: an end facing the camera refuses its figure alone (exit 3); a\n     reference end facing it refuses the run (exit 1); `straddlesCentre`'s\n     existing tests unchanged;\n   - a point outside the photo refused with the size named;\n   - `--json` parsed back for a run with one figure read and one refused;\n   - `--overlay`: marker pixels land at the scaled points;\n   - the measuring scoreboard's core (entries and a photo loader injected):\n     on the synthetic photo `photoCheck.test.ts` draws, a stored entry passes\n     within its tolerance, and the same entry\n     with an `offset` point given without `toward` (never refined) moved 5 px\n     square to its line fails (about 1 mm on that photo);\n   - `checkFolder` skips `.overlay.png` beside a photo, as it skips crops;\n   - status: a figure with every end refined and facing checked is\n     `checked`; one with an end kept as hand reading, or a point without\n     `toward`, is `provisional` and names why; a hand-read reference end\n     makes every figure `provisional`;\n   - refusals, each with its exit code: a HEIC and an orientation-3 JPEG in\n     `photoMeasure` and in the crop (1); a found grid over 0.3 mm rms and warm\n     paper (1); a points file missing `grid` or `reference` without `--auto`\n     (2); an `--overlay` path that is neither a folder nor the expected name\n     (2); a figure point outside the photo (3, its `End` reading \"outside the\n     photo\");\n   - the scale chosen with a given reference by `K_PLAUSIBLE`, on the\n     synthetic photo with 5 mm lines as dark as 10 mm ones;\n   - a `point` without `toward` reports \"facing not checked\";\n   - a points file that isn't JSON, and one with no figures (2); a photo no\n     converter reads, with the converter list injected empty (1, the\n     `NO_CONVERTER` text);\n   - `photoCheck` on an orientation-3 photo still checks it (`loadPhoto`\n     unchanged);\n   - an overlay is drawn for a refused run;\n   - `--help` on both tools exits 0 and names every flag and code; each\n     refusal prints its code first and its fix last, on stderr in text mode\n     and as `{ code, reason, fix }` in JSON; the skill's example points file\n     parses and runs on the synthetic photo.\n9. **Acceptance** (CEO decisions 9, 10). Two kinds of check, kept apart:\n   repeating a photo's recorded reading shows the new code reads as the old\n   did; reading a piece of known length shows it reads right.\n   - **On the owner's Mac.** The T switch (84405) from fresh picks: the\n     through road's socket end (S) and peg end (P) as a distance figure; the\n     curved end's centre (C) with `toward` 20 mm back along its curve, read\n     against the line S→P as `along` and `offset`; each within `AGREE_MM`\n     (0.5 mm) of 84405's own recorded readings (216.49, 108.49, 105.34,\n     `photoReadings.ts`). If C can't be refined, its hand reading is kept\n     and the check still asks 0.5 mm. The measuring scoreboard (item 12)\n     ran every entry and passed (`4/4 pass`), which includes the long\n     straight of known length. The photo scoreboard (`bun run photos:score`)\n     still 12/12.\n   - **In a fresh Linux chat sandbox**, as the spike ran (the spike kit, no\n     `sips`): crops of 84405, then the same three figures with `--auto`,\n     `--json` and `--overlay`, each within 0.5 mm of the Mac's run, and the\n     overlay a PNG. What the sandbox needed installed is written into the\n     skill (item 7).\n10. **Machine-readable results** (`photoMeasure.ts --json`, CEO E1): stdout is\n    one JSON object, progress goes to stderr: `{ photo: {width, height},\n    grid: {source: \"seeded\"|\"found\", points, rmsMm}, reference: {source:\n    \"given\"|\"found\", k, ends: [End, End]}, figures: { <name>: { kind:\n    \"distance\"|\"offset\"|\"along\", facing: \"checked\"|\"not checked\", valueMm,\n    status: \"checked\"|\"provisional\", why: string[] } | { kind, facing,\n    refused: <reason> } }, ends: { <figure>: End[] },\n    overlay?: { path, key: [{ colour, figure, end }] } }`, where `End` is\n    `{ refined: true, samples, spreadMm } | { refined: false, reason }` (an\n    end outside the photo is `{ refined: false, reason: \"outside the photo\" }`)\n    and a\n    three-point figure's ends are ordered line `a`, line `b`, `point`. A\n    refused run prints `{ refused: { code, reason, fix } }`; a usage error\n    (exit 2) prints `{ usage: { code, message, fix } }`; a refused figure's\n    `refused` is `{ code, reason, fix }` too (DX decision D3). The text output stays the default.\n11. **A picture of the points used** (`photoMeasure.ts --overlay <out.png>`,\n    CEO E2): the photo shrunk to 1,600 px on its longest side, with each grid\n    crossing used as a small dot, the reference's ends as squares and each\n    figure end as a ring in its own colour from a fixed list of twelve (past\n    twelve ends the colours repeat; the key lists every end); the key\n    (colour → figure and end) is printed with the results and in `--json`.\n    No text is drawn. Written with `writePng`, named `<points>.overlay.png`\n    beside the points file; `--overlay` takes a folder or that name, and any\n    other path is a usage error (exit 2). `checkFolder` skips that name\n    beside `CROP`. A refused run still draws\n    its overlay when the photo loaded, with whatever was found (grid\n    crossings, reference ends) and the given points, since that is when the\n    picture helps most.\n12. **A measuring scoreboard** (`bun run photos:measure-score`, CEO E3):\n    `engine/tools/photoMeasureScoreboard.ts` holds each known piece's points\n    and expected figures hard-coded in its source (pixel coordinates only;\n    the photos stay in the ignored `photos/`; each entry uses the automatic\n    grid and reference), as `photoScoreboard.ts` holds its verdicts; a\n    missing photo is skipped and counted, as `photos:score` says \"(n photos\n    not in photos)\"; it prints `<passed>/<ran> pass` and exits 1 on any miss\n    or when none ran; `package.json` gains the script. Each entry states its\n    expected figure, its tolerance and the basis for both (CEO decision 10):\n    84405 and 84404, the T switch's three figures against each photo's own\n    recorded reading within `AGREE_MM` (repeatability); 84401 and 84402, the\n    long straight against its known 216 mm within `TOLERANCE_MM` (1 mm, the\n    216 mm trial's bound; those photos read about 0.7 mm long, and the entry\n    says so). New pieces join as they're measured.\n\n**Delivery** (taste, CEO decision 14; the owner confirms at the gate): three\nPRs, each merged before the next is opened (none stacked): (a) `writePng`,\n`loadUpright` and crops off macOS (item 1); (b) `photoMeasure`'s\nnew core (items 2-6 and its tests); (c) `--json`, `--overlay`, the\nmeasuring scoreboard and the skill (items 7, 10-12), with the acceptance\n(item 9) run on (c).\n\n## Not in scope\n\n- The brief itself (contributor-brief T2 and T5).\n- Measuring heights from photos (AGENTS.md: a ruler).\n- A new image library: the converters already on the machine do the work.\n- Figure kinds beyond distance, offset and along (a radius, an angle):\n  added when a piece needs one.\n- The tool proposing end points itself (deferred, a pending write to\n  `docs/plan/generic-TODOS.md`; CEO decision 13): the overlay and `provisional` status show a bad pick first.\n- Sharing the owner's photos as fixtures outside git (rejected, CEO\n  decision 16): photos are never shared (SEC1); the synthetic photo covers\n  the code, the owner's Mac covers the real ones.\n- Proving the method on many contributors' pieces and references (CEO\n  decision 11): that is the brief's pilot (contributor-brief T2, T5).","newText":"1. **Crops without `sips`** (`photoCrop.ts`, `photoImage.ts`). Cut the window\n   from the upright pixels `loadUpright` returns (any converter), enlarge it ×4 in\n   TypeScript (nearest neighbour, so a pixel stays a square the eye can\n   split), and write it with a new `writePng` in `photoImage.ts` (8-bit RGB,\n   `deflateSync` and `crc32` from `node:zlib`, no converter), so a crop is\n   always a PNG and `CROP` keeps its one pattern. Converters stay for reading\n   photos only, each run with a 60 s timeout (DX decision D5). Reading a\n   photo fails in one of three ways, each its own code (D4): `photo-missing`\n   (the path doesn't exist or can't be read; names the path), checked before\n   any converter runs; `no-converter` (none of `sips`, `magick`, `convert`,\n   `ffmpeg` is on `PATH`); `photo-unreadable` (a converter ran and failed or\n   timed out; names each converter tried and the first line of its stderr).\n   The window maths (`windowAround`, `fromCrop`) stay.\n   Orientation (CEO decisions 7, 20): a new `loadUpright` (`photoImage.ts`)\n   wraps `loadPhoto` and returns the photo upright, as a phone and a chat\n   preview show it, with `orientationOf` (`photoExif.ts`) read instead of\n   `sips -g`; `loadPhoto` itself, and so `photoCheck`, is unchanged. Orientation 1 is read as is; 6 and 8 (a\n   portrait phone photo) are turned in TypeScript unless the decoded width\n   and height show the converter already turned it; 3 and the mirrored\n   orientations, where the decoded size can't tell, are refused as today\n   (\"open and re-save the photo upright\"). A HEIC photo is refused (convert\n   to JPEG). The crop's JSON line gains the photo's upright `width` and\n   `height`, and stderr says how to map back: \"a point at (cx, cy) in this\n   crop is (x0 + cx/4, y0 + cy/4) in the photo\" with the numbers filled in\n   (DX decision D2). A point in the points file may instead be given as\n   `{ \"crop\": \"<crop file>\", \"at\": [cx, cy] }`, and `photoMeasure` maps it\n   back from the window the crop's name records (`CROP`), so no point is\n   converted by hand (taste, DX decision D6).\n2. **The grid and the reference found automatically** (`photoMeasure.ts`).\n   With `--photo <photo>` (`--auto` kept as its alias, so today's command\n   lines still run; DX decision D7): a points file that gives `grid` seeds `findGrid` as\n   today; one that leaves it out gets `findGridAuto` with the scale retry\n   `photoCheck` uses (`gridAndPlanks` moved to `photoStraights.ts` and shared,\n   not copied). A points file without `reference` uses the medium straight\n   `namePlanks` finds; if either of its ends was not refined, the run is\n   refused (\"the medium straight's <which> end couldn't be read: no shadow\n   across it, nothing touching it\"), as `photoCheck` refuses it. A given\n   reference's ends, and every figure's ends, keep today's rule: an end that\n   can't be refined keeps its hand reading, and says so (text and JSON). A\n   found grid is held to `photoCheck`'s limits: rms above\n   `AUTO_GRID_RMS_MAX_MM` (0.3 mm) and paper as warm as the wood\n   (`paperTooWarm`) each refuse the run (exit 1). With a given reference, the\n   scale retry keeps the first scale at which that reference's `k` falls in\n   `K_PLAUSIBLE`, with `k` read from that reference's refined ends at each\n   scale (a hand reading where an end can't be refined). `--photo` reads the\n   photo upright through the same `loadUpright` as the crop (item 1), so points\n   picked off a crop or a chat preview match; an orientation it refuses, and\n   a HEIC, refuse the run (exit 1); a PNG or BMP carries no orientation and\n   is read as is.\n   `PhotoInput`'s `grid` and `reference` become optional; without `--photo`,\n   a points file missing either is a usage error (exit 2). The run says which\n   grid and reference it used.\n3. **Figures beyond two points** (`photo.ts`, `photoMeasure.ts`). A figure is\n   either today's `[a, b]` (distance), or `{ point, toward?, line: [a, b],\n   read: \"offset\" | \"along\" }`. `offset`: the point's distance from the line\n   through `a` and `b`, never negative. `along`: how far along that line,\n   from `a` towards `b`, the point's foot lies; negative when the foot falls\n   before `a`. Both in paper millimetres times the scale. Line ends are\n   refined as today (each against the other); a `point` is refined against\n   `toward` when given, else its hand reading is kept and said.\n4. **One figure refused, not the run** (`photoEdges.ts`, `photoMeasure.ts`).\n   A new `facesAway(img, end, other)`: an end faces away from the camera when\n   it lies beyond the photo's centre in the direction from `other` to `end`,\n   measured along whichever photo axis (rows or columns) that direction runs\n   mostly along, exactly as `straddlesCentre` picks its axis today. For a\n   figure's `point`, `other` is its `toward`. `straddlesCentre(a, b)` becomes\n   `facesAway(a, b) && facesAway(b, a)`, so `photoCheck` and the scoreboard\n   (84397) keep their whole-piece rule unchanged. In `photoMeasure`: a\n   reference end facing the camera refuses the run (every figure depends on\n   the scale); a figure end facing it refuses that figure alone, with a fix\n   that changes what caused it (DX decision D8): for a line end, \"lay the\n   piece across the middle of the photo and retake\"; for a `point`, \"check\n   that `toward` lies back along the same road; if it does, retake with the\n   piece across the middle\"; a `point` without `toward` is \"facing not checked\".\n   Exit: 0 every figure read, 1 the run refused (a bad grid, a reference\n   problem, a grid or reference point outside the photo, an orientation\n   `loadUpright` refuses, a HEIC, a photo no converter reads),\n   2 bad usage (including a new feature asked for without `--photo`), 3 some\n   figures refused (a figure end facing the camera or outside the photo).\n   Every figure read carries a status (CEO decision 12): `checked` when each\n   of its ends was refined and its facing checked, else `provisional`, with\n   the reasons (an end kept as hand reading, \"facing not checked\"); a\n   reference end kept as a hand reading makes every figure provisional. The\n   exit code doesn't change; a catalogue figure still needs two photos to\n   agree (`agreedFigure`, `photoReadings.ts`).\n5. **Pixels said plainly.** `photoMeasure.ts` prints the photo's size and\n   refuses a point outside it (\"points are in the photo's full pixels, W×H;\n   a point read off a smaller preview must be scaled\"). Every new feature\n   (automatic grid or reference, `offset`/`along`, facing, bounds, `--json`,\n   `--overlay`) needs the photo, so it needs `--photo <photo>`; without it,\n   only today's plain two-point figures with a given grid run, and asking for\n   more is a usage error (exit 2) that says so. The pip note (`--break-system-packages`) is for the brief's\n   draft (contributor-brief T2), not code.\n6. **The command line** (`photoMeasure.ts`): flags parsed by name\n   (`--photo <photo>`, `--json`, `--overlay <out.png>`), the points file the\n   one positional argument; a usage error exits 2, and so does a points\n   file that isn't valid JSON or has no figures, with the parse error or\n   \"no figures\" named (CEO decision 17). A photo that can't be read\n   refuses the run (exit 1) with one of item 1's three codes, which says\n   whether to fix the path, install a converter or re-save the photo (CEO\n   decision 18, refined by DX D4). The CLI only parses, loads and exits: a pure\n   core takes the points and the image and returns one result object, which\n   the text output, `--json` and `--overlay` all render (CEO decision 19).\n   For an agent reading the output (DX decisions D1, D3): `--help` on\n   `photoMeasure.ts` and `photoCrop.ts` prints the usage, every flag, the\n   exit codes, the points-file format and a complete example, and exits 0.\n   In text mode results go to stdout; a refused run's reason and a usage\n   error go to stderr. Every run refusal and usage error has a stable code\n   (`photo-missing`, `no-converter`, `photo-unreadable`, `orientation`,\n   `heic`, `grid-not-found`, `grid-rms`, `paper-warm`, `reference-unread`,\n   `reference-faces-camera`, `k-implausible`, `point-outside`, `usage`,\n   `points-not-json`, `points-invalid`, `no-figures`, `needs-photo`,\n   `overlay-path`, `internal`), one table shared by both tools, printed\n   first as `REFUSED <code>:` or `USAGE <code>:`, with the fix on the\n   message's last line (retake how, re-save upright, install what, add\n   `--photo <photo>`); a per-figure refusal carries `faces-camera` or\n   `point-outside` the same way. Every refusal names the values that caused\n   it (DX decision D9): the rms found and the 0.3 mm limit, `k` at each\n   scale tried and `K_PLAUSIBLE`, the paper and wood colours compared, the\n   EXIF orientation read, the size and the point. Each code has a recovery\n   class, `retake`, `edit-points`, `install` or `human`, in the table and in\n   the JSON. The points file is checked whole before any work\n   (`points-invalid`, exit 2, D10): each point two finite numbers, `read`\n   one of its two values, a line's two ends apart, the field's path named\n   (`figures.out.line[1]`). `--json` is found anywhere in the arguments\n   before anything else is checked, so a usage error is JSON too. An\n   unexpected error is caught at the top: `REFUSED internal:`, exit 1, its\n   trace written to a file in the temp folder and that path printed (D11).\n   `--help`'s last line points to the skill's code table\n   (`.claude/skills/draw-piece/SKILL.md`, \"Measure codes\").\n7. **The drawing skill** (`.claude/skills/draw-piece/SKILL.md` step 7): the\n   new figure kinds, the automatic grid and reference, per-figure refusals\n   and their exit codes, `--json`, `--overlay`, and crops on any system; and\n   how to choose `toward`: a point on the same road's centreline, at least\n   20 mm back from the end, so the end face is square to the line between\n   them (for a switch's curved end, back along the curve, not along the\n   straight road). A minimal points file first, one distance figure with\n   `crop`/`at` points, with its command and both its text and `--json`\n   output (D14); then a complete one (DX decision D2): the T\n   switch's three figures, one distance and the `along` and `offset` of its\n   curved end with `toward`, no `grid` or `reference` (found), with the\n   command that reads it and what it prints. Also (CEO decisions 11, 13): the workflow from photo to\n   figure, step by step (crop around each end, read the point off the\n   enlarged crop, give it as `{ crop, at }` in the points file, then run);\n   what the tools need (Bun, and one of `magick`, `convert` or `ffmpeg` to\n   read a JPEG; macOS has `sips`; Windows is not supported, use WSL); and\n   the conditions a measurement assumes, said again in the facing refusal:\n   the reference is the 144 mm medium straight, lying flat beside the piece\n   with its top face level with the piece's; the photo is uncropped, taken\n   from roughly above the middle of the sheet.\n8. **Tests**, each pin's mutation run and recorded (CLAUDE.md):\n   - crop: a window from a BMP fixture enlarged ×4 maps back with `fromCrop`;\n     `writePng`'s chunks carry correct CRCs and its image data inflates back\n     to the pixels written; the converter list off macOS;\n   - orientation: a synthetic image tagged 6 and 8 comes back upright (a\n     marked corner where the phone shows it); one the converter already\n     turned (decoded size swapped) isn't turned twice; 3 and a mirrored\n     orientation are refused;\n   - offset and along: exact on synthetic points, a slanted line, a foot\n     before `a` (negative along);\n   - the automatic grid and reference: `photoMeasure`'s core on the\n     synthetic photo `photoCheck.test.ts` draws, figures within 0.3 mm; an\n     unrefined reference end refuses the run;\n   - facing: an end facing the camera refuses its figure alone (exit 3); a\n     reference end facing it refuses the run (exit 1); `straddlesCentre`'s\n     existing tests unchanged;\n   - a point outside the photo refused with the size named;\n   - `--json` parsed back for a run with one figure read and one refused;\n   - `--overlay`: marker pixels land at the scaled points;\n   - the measuring scoreboard's core (entries and a photo loader injected):\n     on the synthetic photo `photoCheck.test.ts` draws, a stored entry passes\n     within its tolerance, and the same entry\n     with an `offset` point given without `toward` (never refined) moved 5 px\n     square to its line fails (about 1 mm on that photo);\n   - `checkFolder` skips `.overlay.png` beside a photo, as it skips crops;\n   - status: a figure with every end refined and facing checked is\n     `checked`; one with an end kept as hand reading, or a point without\n     `toward`, is `provisional` and names why; a hand-read reference end\n     makes every figure `provisional`;\n   - refusals, each with its exit code: a HEIC and an orientation-3 JPEG in\n     `photoMeasure` and in the crop (1); a found grid over 0.3 mm rms and warm\n     paper (1); a points file missing `grid` or `reference` without `--photo`\n     (2); an `--overlay` path that is neither a folder nor ends\n     `.overlay.png` (2); a figure point outside the photo (3, its `End` reading \"outside the\n     photo\");\n   - the scale chosen with a given reference by `K_PLAUSIBLE`, on the\n     synthetic photo with 5 mm lines as dark as 10 mm ones;\n   - a `point` without `toward` reports \"facing not checked\";\n   - a points file that isn't JSON, and one with no figures (2);\n   - `photoCheck` on an orientation-3 photo still checks it (`loadPhoto`\n     unchanged);\n   - an overlay is drawn for a refused run;\n   - `--help` on both tools exits 0 and names every flag and code; each\n     refusal prints its code first and its fix last, on stderr in text mode\n     and as `{ code, reason, fix, recovery }` in JSON, naming its values;\n     the skill's example points files parse and run on the synthetic photo;\n   - reading a photo: a missing path (`photo-missing`), no converter on an\n     empty `PATH` (`no-converter`), a converter that fails and one that\n     sleeps past the timeout, both `photo-unreadable` naming the converter;\n   - points-invalid: a three-number point, `read: \"across\"`, a line whose\n     ends coincide, each naming its field; `--json` with an unknown flag\n     prints `{ usage }`; a thrown error in the core prints `REFUSED internal`\n     and a trace path;\n   - a `{ crop, at }` point maps to the same photo pixel as `fromCrop`;\n     `--auto` still works as `--photo`;\n   - an overlay given as `x/y.overlay.png` is written there; a refused run's\n     JSON names the overlay it drew; a run that fails before drawing leaves\n     no overlay file.\n9. **Acceptance** (CEO decisions 9, 10). Two kinds of check, kept apart:\n   repeating a photo's recorded reading shows the new code reads as the old\n   did; reading a piece of known length shows it reads right.\n   - **On the owner's Mac.** The T switch (84405) from fresh picks: the\n     through road's socket end (S) and peg end (P) as a distance figure; the\n     curved end's centre (C) with `toward` 20 mm back along its curve, read\n     against the line S→P as `along` and `offset`; each within `AGREE_MM`\n     (0.5 mm) of 84405's own recorded readings (216.49, 108.49, 105.34,\n     `photoReadings.ts`). If C can't be refined, its hand reading is kept\n     and the check still asks 0.5 mm. The measuring scoreboard (item 12)\n     ran every entry and passed (`4/4 pass`), which includes the long\n     straight of known length. The photo scoreboard (`bun run photos:score`)\n     still 12/12.\n   - **In a fresh Linux chat sandbox**, as the spike ran (the spike kit, no\n     `sips`): crops of 84405, then the same three figures with `--photo`,\n     `--json` and `--overlay`, each within 0.5 mm of the Mac's run, and the\n     overlay a PNG. The install commands it needed and the time from the\n     kit and photo to the first figure are written into the skill (item 7);\n     the target is under 5 minutes (DX 0C), and a longer time is reported,\n     not hidden (D14).\n10. **Machine-readable results** (`photoMeasure.ts --json`, CEO E1): stdout is\n    one JSON object, progress goes to stderr: `{ schema: 1, photo: {width, height},\n    grid: {source: \"seeded\"|\"found\", points, rmsMm}, reference: {source:\n    \"given\"|\"found\", k, ends: [End, End]}, figures: { <name>: { kind:\n    \"distance\"|\"offset\"|\"along\", facing: \"checked\"|\"not checked\", valueMm,\n    status: \"checked\"|\"provisional\", why: [{ code, end?, text }], ends:\n    End[] } | { kind, facing, refused, ends: End[] } },\n    overlay?: { path, key: [{ colour, figure, end }] } }`, where `End` is\n    `{ refined: true, samples, spreadMm } | { refined: false, reason }` (an\n    end outside the photo is `{ refined: false, reason: \"outside the photo\" }`)\n    and a\n    three-point figure's ends are ordered line `a`, line `b`, `point`. A\n    refused run prints `{ schema: 1, refused: { code, reason, fix, recovery\n    }, photo?, grid?, overlay? }`, with whatever it found and the overlay it\n    drew (D12); a usage error (exit 2) prints `{ schema: 1, usage: { code,\n    message, fix } }`; a refused figure's `refused` is `{ code, reason, fix,\n    recovery }` too (DX decision D3). `why` codes: `end-hand-read`,\n    `facing-not-checked`, `reference-hand-read`. The text output stays the default.\n11. **A picture of the points used** (`photoMeasure.ts --overlay <out.png>`,\n    CEO E2): the photo shrunk to 1,600 px on its longest side, with each grid\n    crossing used as a small dot, the reference's ends as squares and each\n    figure end as a ring in its own colour from a fixed list of twelve (past\n    twelve ends the colours repeat; the key lists every end); the key\n    (colour → figure and end) is printed with the results and in `--json`.\n    No text is drawn. Written with `writePng` to a temporary file and then\n    renamed into place, so a failed run never leaves half an image; the JSON\n    and text name the overlay only when it was written (D12). `--overlay`\n    takes a folder (the file is `<points>.overlay.png` in it) or any path\n    ending `.overlay.png`; anything else is `overlay-path` (exit 2), whose fix\n    line prints the path that would be accepted (D13). `checkFolder` skips\n    `*.overlay.png` beside `CROP`. A refused run still draws\n    its overlay when the photo loaded, with whatever was found (grid\n    crossings, reference ends) and the given points, since that is when the\n    picture helps most.\n12. **A measuring scoreboard** (`bun run photos:measure-score`, CEO E3):\n    `engine/tools/photoMeasureScoreboard.ts` holds each known piece's points\n    and expected figures hard-coded in its source (pixel coordinates only;\n    the photos stay in the ignored `photos/`; each entry uses the automatic\n    grid and reference), as `photoScoreboard.ts` holds its verdicts; a\n    missing photo is skipped and counted, as `photos:score` says \"(n photos\n    not in photos)\"; it prints `<passed>/<ran> pass` and exits 1 on any miss\n    or when none ran; `package.json` gains the script. Each entry states its\n    expected figure, its tolerance and the basis for both (CEO decision 10):\n    84405 and 84404, the T switch's three figures against each photo's own\n    recorded reading within `AGREE_MM` (repeatability); 84401 and 84402, the\n    long straight against its known 216 mm within `TOLERANCE_MM` (1 mm, the\n    216 mm trial's bound; those photos read about 0.7 mm long, and the entry\n    says so). New pieces join as they're measured.\n\n**Delivery** (taste, CEO decision 14; the owner confirms at the gate): three\nPRs, each merged before the next is opened (none stacked): (a) `writePng`,\n`loadUpright`, the photo-reading codes, and crops off macOS (item 1), with\ntoday's `photoMeasure --auto` switched to `loadUpright` in the same PR, so\ncrops and measuring never disagree about which way up a photo is (DX\ndecision D15; no saved points change, since a rotated photo was refused\nuntil now); (b) `photoMeasure`'s\nnew core (items 2-6 and its tests); (c) `--json`, `--overlay`, the\nmeasuring scoreboard and the skill (items 7, 10-12), with the acceptance\n(item 9) run on (c).\n\n## Not in scope\n\n- The brief itself (contributor-brief T2 and T5).\n- Measuring heights from photos (AGENTS.md: a ruler).\n- A new image library: the converters already on the machine do the work.\n- Figure kinds beyond distance, offset and along (a radius, an angle):\n  added when a piece needs one.\n- The tool proposing end points itself (deferred, a pending write to\n  `docs/plan/generic-TODOS.md`; CEO decision 13): the overlay and `provisional` status show a bad pick first.\n- Sharing the owner's photos as fixtures outside git (rejected, CEO\n  decision 16): photos are never shared (SEC1); the synthetic photo covers\n  the code, the owner's Mac covers the real ones.\n- Proving the method on many contributors' pieces and references (CEO\n  decision 11): that is the brief's pilot (contributor-brief T2, T5)."}]} -->

<!-- autoplan-accepted:dx -->
- DX D1-D3: `--help` on both tools (usage, flags, exits, format, minimal and full examples, pointer to the skill's code table), exit 0; the crop prints its mapping; one code table for both tools, code first, values named, fix last, recovery class, stderr in text mode, `{ code, reason, fix, recovery }` in JSON.
- D4, D5: `photo-missing`, `no-converter`, `photo-unreadable` (converters tried and their first stderr line); 60 s converter timeout; tested.
- D6 (taste): `{ crop, at }` points mapped from the crop's name; tested against `fromCrop`.
- D7: `--photo`, `--auto` as alias, `needs-photo`. D8: facing fix by end kind. D9: values in every refusal.
- D10: points file validated whole (`points-invalid`, field path); `--json` found before other checks. D11: `REFUSED internal` with a trace file.
- D12: overlay written atomically; JSON names it only when written; a refused run's JSON carries photo, grid and overlay. D13: `--overlay` a folder or any `*.overlay.png`, `overlay-path` shows the accepted path.
- JSON: `schema: 1`, ends nested in each figure, `why: [{ code, end?, text }]`.
- D14: the skill's minimal and full examples with text and JSON output; the Linux acceptance records install commands and time to first figure (target < 5 min). D15: PR (a) also moves `photoMeasure`'s loading to `loadUpright`.
- Every test listed in item 8 for these, each mutation run and recorded.
- D4 and D7 supersede the CEO block's `NO_CONVERTER` and `--auto` wording: three photo-reading codes, and `--photo` with `--auto` as its alias.
<!-- /autoplan-accepted:dx -->

### DX phase: Step 0 (auto-decided, /autoplan)

Methodology read: `autoplan-dx-methodology-87LN3H/methodology.md` ranges
1-600, 601-1200, 1201-1800, 1801-1870 (EOF, 1,870 lines).

**Product type:** CLI tool (`photoCrop.ts`, `photoMeasure.ts`) plus a Claude
Code skill (`draw-piece` step 7). Auto-confirmed (P6).

**0A. Persona** (P6, from the contributor brief and this plan's Why):
```
TARGET DEVELOPER PERSONA
========================
Who:       an AI coding agent: a contributor's chat Claude in a Linux sandbox
           (primary), or the maintainer's draw-piece Claude on the Mac
Context:   has the spike kit or the repo, one top-view photo, and is asked
           for a piece's figures in millimetres
Tolerance: reads errors literally, can't ask, retries; a wrong-but-plausible
           number is worse than a refusal
Expects:   --help, a points-file example to copy, errors that say the fix,
           output it can parse
```

**0B. Empathy narrative** (from the spike results and today's code):
"I unzip the kit and run `photoCrop.ts`; it fails, because it calls `sips`
(`photoCrop.ts:80-90`). I write my own crop helper. `photoMeasure.ts` wants
grid seeds with paper millimetres; I count lines by script. There is no
`--help`; misuse prints one usage line (`photoMeasure.ts:37`). The points
format is in the script's header, so I read source. For "how far out" I
build a foot point by hand. A piece 2 px short of the middle ends the whole
run, on stdout, with exit 1 (`photoMeasure.ts:50-52`). I get two of three
figures, after writing three helpers." Observed in the spike; the
timings below are estimated.

**0C. Benchmark.**
| Tool | Start → result | Time + evidence | DX choice | Source |
|---|---|---|---|---|
| ImageJ (Set Scale) | open image → a length in mm | ~3-5 min, reported (lab guides) | draw a line on a known length, type it, measure | imagejdocu.list.lu set_scale; serc.carleton.edu |
| OpenCV reference-object script | install opencv → sizes printed | ~5-10 min, reported | one script, `--image` and `--width` of a reference | pyimagesearch.com 2016/03/28 |
| This plan, today | kit + photo → first figure | ~15-20 min agent time, estimated from the spike | hand grid seeds, own helpers | spike results |
| This plan, after | kit + photo → first figure | ~4-5 min, estimated (install Bun, 2 crops, points file, 1 run) | grid and reference found; only the ends picked | this plan |

Neither peer handles perspective or parallax the way this does; times are not
on equal boundaries (theirs end at a rough size, this one at ±0.5 mm).
Target: **Competitive (2-5 min)** (P5), for an agent with Bun installable.

**0D. Magical moment:** the agent opens `<points>.overlay.png` and sees its
picks ringed on the photo, beside `216.49 mm checked`. Vehicle: the
`--overlay` already in the plan (E2), lowest effort (P5). This is the
DX argument for E2 at the gate.

**0E. Mode:** DX POLISH (autoplan override).

**0F. Journey** (friction resolved by D1-D3):
```
STAGE           | DEVELOPER DOES                         | FRICTION                         | STATUS
----------------|----------------------------------------|----------------------------------|--------
1. Discover     | reads the brief / skill step 7         | no --help; format only in source | fixed (D1, D2)
2. Install      | npm i -g bun; has convert or ffmpeg    | a missing converter shows late   | ok (decision 18 names the install)
3. Hello World  | 2 crops, picks, points file, 1 run     | crop→photo maths by hand; no     | fixed (D2: mapping printed,
                |                                        | example file                     | example to copy)
4. Real Usage   | switch: along/offset with toward       | choosing toward                  | ok (item 7)
5. Debug        | a refusal, a provisional figure        | refusals on stdout, no code/fix  | fixed (D3)
6. Upgrade      | old points files, old command line     | none: same positional file, same | ok
                |                                        | --auto; old files run unchanged  |
```

**0G. First-time agent report.**
```
T+0:00  bun engine/tools/photoMeasure.ts --help → usage, codes, an example (D1)
T+0:30  photoCrop.ts photo 1210 830 → crop PNG, stderr gives the mapping (D2)
T+2:00  copies the example, puts in its three points
T+3:00  photoMeasure.ts t.json --auto photo --json --overlay . → figures
T+3:30  one figure "provisional: point has no toward" → adds toward, reruns
T+4:30  all checked; overlay shows the rings on the ends
```
Decisions: D1 `--help`; D2 the example points file and the crop mapping
line; D3 stable codes, fix lines, stderr for refusals (Mechanical, P1/P5,
within DX POLISH: the plan's existing outputs, made agent-ready).

### DX phase: Step 0.5, dual voices

Claude SUBAGENT (DX — independent review), INPUT `dx d0e8d273…`, matching
the snapshot: Getting started 5, CLI 6, Errors 4 (CAP4), Docs 8, Escape
hatches 6. Findings: CAP4 `no-converter` given for a missing or corrupt
photo (D4); CAP4 converters with no timeout (D5); CAP6 refusals without
their values (D9); CAP6 no trace for unexpected errors (D11); CAP6 overlay
side effects (D12); `--auto` misnamed (D7); crop arithmetic by hand (D6);
free-text `why`, split `ends`, no schema version, `--json` on parse errors,
the crop's codes, anchors, recovery class (D3, D9, D10); overlay path too
strict (D13); text-only example, timed sandbox run (D14); `--allow-rms` and
an orientation override (deferred, D16).

Codex SAYS (DX — developer experience challenge), gpt-6-astra, completed:
1. High: valid JSON with bad shapes or coincident ends crashes or gives
   non-finite figures (`photoMeasure.ts:40` only casts) (D10).
2. High: under the three PRs, crops turn upright in (a) while measuring
   reads raw until (b) (`photoMeasure.ts:43`) (D15).
3. Medium: `no-converter` for unreadable files (`photoImage.ts:76`) (D4).
4. Medium: "measure from the other end" can't fix a distance figure (D8).
5. Medium: refused-run JSON loses the overlay (D12).
6. Medium: `--overlay` rejects names it seems to invite (D13).
7. Medium: under 5 minutes unmeasured; no minimal example (D14).

```
DX DUAL VOICES — CONSENSUS TABLE:
  Dimension                           Claude  Codex  Consensus
  1. Getting started < 5 min?          no      no     CONFIRMED: unmeasured; crop arithmetic (D6, D14)
  2. API/CLI naming guessable?         no      no     CONFIRMED: --overlay rules (D13); --auto (Claude, D7)
  3. Error messages actionable?        no      no     CONFIRMED: converter errors (D4); facing fix (Codex, D8)
  4. Docs findable & complete?         mostly  partly CONFIRMED gap: minimal + JSON example (D14)
  5. Upgrade path safe?                partly  no     CONFIRMED: PR order (D15); schema version (D3)
  6. Dev environment friction-free?    no      n/a    single voice: converter timeout (CAP4, D5), flagged
CONFIRMED = native + outside agree. Single-voice criticals: D5 (timeout), flagged and accepted.
```

### DX phase: passes

**Pass 1, Getting started: 4 → 7.** Before: crops need `sips`, grid seeds by
hand, no example (TTHW ~15-20 min estimated). After: `--help`, a minimal
example with `crop`/`at` points, grid and reference found; ~4-5 min
estimated, measured in the Linux acceptance (D14). Not 10: Bun and a
converter are still the contributor's to install (the brief's job).

**Pass 2, CLI: 5 → 8.** `--photo` with `--auto` alias (D7); `--json`
`schema: 1`, ends nested under each figure, `why` codes (D3); overlay paths
(D13); one code table for both tools. Not 10: the points file has no
version field (deferred until its shape changes again).

**Pass 3, Errors: 3 → 8.**
```
ERROR PATH MATRIX (agent-ready-v1)
Path                 | Class      | what | fix | recovery | code | context | trace | redaction | channel | Cap
photo missing        | usage      | pass | pass| N/A      | pass | N/A     | N/A   | pass      | pass    | —   (was CAP4:fix)
converter hangs      | unexpected | pass | pass| pass     | pass | pass    | N/A   | pass      | pass    | —   (was CAP4:recovery)
grid-rms             | refusal    | pass | pass| pass     | pass | pass    | N/A   | pass      | pass    | —   (was CAP6:context)
core throws          | unexpected | pass | pass| pass     | pass | pass    | pass  | pass      | pass    | —   (was CAP6:trace)
```
Redaction: no secrets; paths and numbers only. Not 10: converter stderr is
cut to one line, which can hide the real cause.

**Pass 4, Docs: 6 → 8.** Minimal and full examples with text and JSON
output, the code table, `toward`, conditions, `--help` pointing at the
skill. Not 10: no picture of a good and a bad overlay in the skill.

**Pass 5, Upgrade: 6 → 8.** Old points files and `--auto` run unchanged;
no saved points change (rotated photos were refused before); the PR order
keeps crops and measuring agreeing (D15); `schema: 1`.

**Pass 6, Dev environment: 5 → 7.** Mac and Linux, converter timeout,
Windows via WSL stated. Not 10: no override when the grid is just over
0.3 mm (`--allow-rms` deferred, D16: a retake is the safe default).

**Pass 7, Community: 6/10, no change.** The contributor path (issues,
the brief) is outside this plan; the tools' part is the code table and
the skill. No issues in scope.

**Pass 8, Measurement: 3 → 6.** The Linux acceptance times kit-to-first
figure and records it (D14); the measuring scoreboard tracks accuracy.
Not more: no recurring timing; `/devex-review` after shipping.

### DX Review Scorecard
```
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                             |
+====================================================================+
| Dimension            | Score  | Prior  | Trend  |
| Getting Started      |  7/10  |  4/10  |  ↑     |
| API/CLI/SDK          |  8/10  |  5/10  |  ↑     |
| Error Messages       |  8/10  |  3/10  |  ↑     |
| Documentation        |  8/10  |  6/10  |  ↑     |
| Upgrade Path         |  8/10  |  6/10  |  ↑     |
| Dev Environment      |  7/10  |  5/10  |  ↑     |
| Community            |  6/10  |  6/10  |  =     |
| DX Measurement       |  6/10  |  3/10  |  ↑     |
| TTHW                 | ~5 min | ~15-20 min (estimated)  |
| Competitive Rank     | Competitive (target), unmeasured        |
| Magical Moment       | designed via --overlay (E2, taste)      |
| Product Type         | CLI tool + Claude Code skill            |
| Mode                 | POLISH                                  |
| Overall DX           |  7/10  |  4/10  |  ↑     |
+====================================================================+
| Zero Friction: gap (installs)  | Learn by Doing: covered           |
| Fight Uncertainty: covered     | Opinionated + Escape Hatches: gap |
| Code in Context: covered       | Magical Moments: covered (E2)     |
| Agents Are Users: covered      |                                   |
+====================================================================+
```

### DX Implementation Checklist
```
[ ] First figure in < 5 min from kit + photo, timed in the Linux acceptance
[ ] --help on both tools: usage, flags, exits, format, examples, code-table pointer
[ ] Every refusal: code first, values, fix last, recovery class; stderr / JSON
[ ] photo-missing / no-converter / photo-unreadable apart; converters time out at 60 s
[ ] points file checked whole (points-invalid with field path)
[ ] { crop, at } points; --photo with --auto alias; overlay paths as documented
[ ] JSON schema 1, ends nested, why codes, refused runs carry what they found
[ ] skill: minimal + full example with text and JSON output; code table
```

### DX Implementation Tasks
- [ ] **T5 (P1, human: ~1d / CC: ~30min)** — photoImage/photoCrop — photo-reading codes, converter timeout, `{crop, at}` mapping helper
  - Surfaced by: Pass 3 (D4, D5), Pass 1 (D6) · Files: engine/tools/photoImage.ts, engine/tools/photoCrop.ts, tests · Verify: `bun run test`
- [ ] **T6 (P1, human: ~1d / CC: ~30min)** — photoMeasure — validation, `--photo`, code table, values, recovery, internal handler, JSON schema
  - Surfaced by: Passes 2, 3 (D3, D7-D11) · Files: engine/tools/photoMeasure.ts, tests · Verify: `bun run test`
- [ ] **T7 (P2, human: ~2h / CC: ~10min)** — skill — minimal example, JSON output, code table, timed sandbox run
  - Surfaced by: Passes 1, 4, 8 (D14) · Files: .claude/skills/draw-piece/SKILL.md · Verify: the example test; the Linux acceptance time recorded

NOT in scope (DX): `--allow-rms` and an orientation override (deferred, D16;
pending write to `docs/plan/generic-TODOS.md`); a points-file version field
(until the format changes again); overlay example pictures in the skill.

<!-- autoplan-baseline-edits:eng {"sourceSha256":"7c71b355ab04cda36ae43cc65132be50afc6e08a81e84d26f9977675b4aae723","replacements":[{"oldText":"1. **Crops without `sips`** (`photoCrop.ts`, `photoImage.ts`). Cut the window\n   from the upright pixels `loadUpright` returns (any converter), enlarge it ×4 in\n   TypeScript (nearest neighbour, so a pixel stays a square the eye can\n   split), and write it with a new `writePng` in `photoImage.ts` (8-bit RGB,\n   `deflateSync` and `crc32` from `node:zlib`, no converter), so a crop is\n   always a PNG and `CROP` keeps its one pattern. Converters stay for reading\n   photos only, each run with a 60 s timeout (DX decision D5). Reading a\n   photo fails in one of three ways, each its own code (D4): `photo-missing`\n   (the path doesn't exist or can't be read; names the path), checked before\n   any converter runs; `no-converter` (none of `sips`, `magick`, `convert`,\n   `ffmpeg` is on `PATH`); `photo-unreadable` (a converter ran and failed or\n   timed out; names each converter tried and the first line of its stderr).\n   The window maths (`windowAround`, `fromCrop`) stay.\n   Orientation (CEO decisions 7, 20): a new `loadUpright` (`photoImage.ts`)\n   wraps `loadPhoto` and returns the photo upright, as a phone and a chat\n   preview show it, with `orientationOf` (`photoExif.ts`) read instead of\n   `sips -g`; `loadPhoto` itself, and so `photoCheck`, is unchanged. Orientation 1 is read as is; 6 and 8 (a\n   portrait phone photo) are turned in TypeScript unless the decoded width\n   and height show the converter already turned it, compared with the\n   JPEG's stored size read from its frame header by a new `jpegSize` in\n   `photoExif.ts` (beside `orientationOf`, on the same `segments`); 3, the\n   mirrored orientations, and a square photo tagged 6 or 8, where the decoded\n   size can't tell, are refused as today (\"open and re-save the photo\n   upright\") (eng E2). `photoImage.ts`'s header says which loader to use:\n   `loadUpright` for anything that reads points, `loadPhoto` only for\n   `photoCheck`, which looks at whole photos (eng E6). A HEIC photo is refused (convert\n   to JPEG). The crop's JSON line gains the photo's upright `width` and\n   `height`, and stderr says how to map back: \"a point at (cx, cy) in this\n   crop is (x0 + cx/4, y0 + cy/4) in the photo\" with the numbers filled in\n   (DX decision D2). A point in the points file may instead be given as\n   `{ \"crop\": \"<crop file>\", \"at\": [cx, cy] }`, and `photoMeasure` maps it\n   back from the window the crop's name records (`CROP`), so no point is\n   converted by hand (taste, DX decision D6). A crop named for another\n   photo is `points-invalid` (its name starts with the photo's own name, as\n   `cropPath` writes it) (eng E3).\n2. **The grid and the reference found automatically** (`photoMeasure.ts`).\n   With `--photo <photo>` (`--auto` kept as its alias, so today's command\n   lines still run; DX decision D7): a points file that gives `grid` seeds `findGrid` as\n   today; one that leaves it out gets `findGridAuto` with the scale retry\n   `photoCheck` uses (`gridAndPlanks` moved to `photoStraights.ts` and shared,\n   not copied). A points file without `reference` uses the medium straight\n   `namePlanks` finds; if either of its ends was not refined, the run is\n   refused (\"the medium straight's <which> end couldn't be read: no shadow\n   across it, nothing touching it\"), as `photoCheck` refuses it. A given\n   reference's ends, and every figure's ends, keep today's rule: an end that\n   can't be refined keeps its hand reading, and says so (text and JSON). A\n   grid, found or seeded from a given one, is held to `photoCheck`'s\n   limits, one rule for both (eng E1): rms above\n   `AUTO_GRID_RMS_MAX_MM` (0.3 mm) and paper as warm as the wood\n   (`paperTooWarm`) each refuse the run (exit 1). With a given reference, the\n   scale retry keeps the first scale at which that reference's `k` falls in\n   `K_PLAUSIBLE`, with `k` read from that reference's refined ends at each\n   scale (a hand reading where an end can't be refined). `--photo` reads the\n   photo upright through the same `loadUpright` as the crop (item 1), so points\n   picked off a crop or a chat preview match; an orientation it refuses, and\n   a HEIC, refuse the run (exit 1); a PNG or BMP carries no orientation and\n   is read as is.\n   `PhotoInput`'s `grid` and `reference` become optional; without `--photo`,\n   a points file missing either is a usage error (exit 2). The run says which\n   grid and reference it used.\n3. **Figures beyond two points** (`photo.ts`, `photoMeasure.ts`). A figure is\n   either today's `[a, b]` (distance), or `{ point, toward?, line: [a, b],\n   read: \"offset\" | \"along\" }`. `offset`: the point's distance from the line\n   through `a` and `b`, never negative. `along`: how far along that line,\n   from `a` towards `b`, the point's foot lies; negative when the foot falls\n   before `a`. Both in paper millimetres times the scale. Line ends are\n   refined as today (each against the other); a `point` is refined against\n   `toward` when given, else its hand reading is kept and said.\n4. **One figure refused, not the run** (`photoEdges.ts`, `photoMeasure.ts`).\n   A new `facesAway(img, end, other)`: an end faces away from the camera when\n   it lies beyond the photo's centre in the direction from `other` to `end`,\n   measured along whichever photo axis (rows or columns) that direction runs\n   mostly along, exactly as `straddlesCentre` picks its axis today. For a\n   figure's `point`, `other` is its `toward`. `straddlesCentre(a, b)` becomes\n   `facesAway(a, b) && facesAway(b, a)`, so `photoCheck` and the scoreboard\n   (84397) keep their whole-piece rule unchanged. In `photoMeasure`: a\n   reference end facing the camera refuses the run (every figure depends on\n   the scale); a figure end facing it refuses that figure alone, with a fix\n   that changes what caused it (DX decision D8): for a line end, \"lay the\n   piece across the middle of the photo and retake\"; for a `point`, \"check\n   that `toward` lies back along the same road; if it does, retake with the\n   piece across the middle\"; a `point` without `toward` is \"facing not checked\".\n   Exit: 0 every figure read, 1 the run refused (a bad grid, a reference\n   problem, a grid or reference point outside the photo, an orientation\n   `loadUpright` refuses, a HEIC, a photo no converter reads),\n   2 bad usage (including a new feature asked for without `--photo`), 3 some\n   figures refused (a figure end facing the camera or outside the photo).\n   Every figure read carries a status (CEO decision 12): `checked` when each\n   of its ends was refined and its facing checked, else `provisional`, with\n   the reasons (an end kept as hand reading, \"facing not checked\"); a\n   reference end kept as a hand reading makes every figure provisional. The\n   exit code doesn't change; a catalogue figure still needs two photos to\n   agree (`agreedFigure`, `photoReadings.ts`).\n5. **Pixels said plainly.** `photoMeasure.ts` prints the photo's size and\n   refuses a point outside it (\"points are in the photo's full pixels, W×H;\n   a point read off a smaller preview must be scaled\"). Every new feature\n   (automatic grid or reference, `offset`/`along`, facing, bounds, `--json`,\n   `--overlay`) needs the photo, so it needs `--photo <photo>`; without it,\n   only today's plain two-point figures with a given grid run, and asking for\n   more is a usage error (exit 2) that says so. The pip note (`--break-system-packages`) is for the brief's\n   draft (contributor-brief T2), not code.\n6. **The command line** (`photoMeasure.ts`): flags parsed by name\n   (`--photo <photo>`, `--json`, `--overlay <out.png>`), the points file the\n   one positional argument; a usage error exits 2, and so does a points\n   file that isn't valid JSON or has no figures, with the parse error or\n   \"no figures\" named (CEO decision 17). A photo that can't be read\n   refuses the run (exit 1) with one of item 1's three codes, which says\n   whether to fix the path, install a converter or re-save the photo (CEO\n   decision 18, refined by DX D4). The CLI only parses, loads and exits: a pure\n   core takes the points and the image and returns one result object, which\n   the text output, `--json` and `--overlay` all render (CEO decision 19).\n   For an agent reading the output (DX decisions D1, D3): `--help` on\n   `photoMeasure.ts` and `photoCrop.ts` prints the usage, every flag, the\n   exit codes, the points-file format and a complete example, and exits 0.\n   In text mode results go to stdout; a refused run's reason and a usage\n   error go to stderr. Every run refusal and usage error has a stable code\n   (`photo-missing`, `no-converter`, `photo-unreadable`, `orientation`,\n   `heic`, `grid-not-found`, `grid-rms`, `paper-warm`, `reference-unread`,\n   `reference-faces-camera`, `k-implausible`, `point-outside`, `usage`,\n   `points-not-json`, `points-invalid`, `no-figures`, `needs-photo`,\n   `overlay-path`, `internal`), one table shared by both tools, defined once as a `CODES` constant (each\n   code's recovery class and fix) that the text, the JSON and `--help` all\n   read, and a test fails when the skill's code table misses one (eng E5), printed\n   first as `REFUSED <code>:` or `USAGE <code>:`, with the fix on the\n   message's last line (retake how, re-save upright, install what, add\n   `--photo <photo>`); a per-figure refusal carries `faces-camera` or\n   `point-outside` the same way. Every refusal names the values that caused\n   it (DX decision D9): the rms found and the 0.3 mm limit, `k` at each\n   scale tried and `K_PLAUSIBLE`, the paper and wood colours compared, the\n   EXIF orientation read, the size and the point. Each code has a recovery\n   class, `retake`, `edit-points`, `install` or `human`, in the table and in\n   the JSON. The points file is checked whole before any work\n   (`points-invalid`, exit 2, D10): each point two finite numbers, `read`\n   one of its two values, a line's two ends apart, the field's path named\n   (`figures.out.line[1]`). `--json` is found anywhere in the arguments\n   before anything else is checked, so a usage error is JSON too. An\n   unexpected error is caught at the top: `REFUSED internal:`, exit 1, its\n   trace written to a file in the temp folder and that path printed (D11).\n   `--help`'s last line points to the skill's code table\n   (`.claude/skills/draw-piece/SKILL.md`, \"Measure codes\").\n7. **The drawing skill** (`.claude/skills/draw-piece/SKILL.md` step 7): the\n   new figure kinds, the automatic grid and reference, per-figure refusals\n   and their exit codes, `--json`, `--overlay`, and crops on any system; and\n   how to choose `toward`: a point on the same road's centreline, at least\n   20 mm back from the end, so the end face is square to the line between\n   them (for a switch's curved end, back along the curve, not along the\n   straight road). A minimal points file first, one distance figure with\n   `crop`/`at` points, with its command and both its text and `--json`\n   output (D14); then a complete one (DX decision D2): the T\n   switch's three figures, one distance and the `along` and `offset` of its\n   curved end with `toward`, no `grid` or `reference` (found), with the\n   command that reads it and what it prints. Also (CEO decisions 11, 13): the workflow from photo to\n   figure, step by step (crop around each end, read the point off the\n   enlarged crop, give it as `{ crop, at }` in the points file, then run);\n   what the tools need (Bun, and one of `magick`, `convert` or `ffmpeg` to\n   read a JPEG; macOS has `sips`; Windows is not supported, use WSL); and\n   the conditions a measurement assumes, said again in the facing refusal:\n   the reference is the 144 mm medium straight, lying flat beside the piece\n   with its top face level with the piece's; the photo is uncropped, taken\n   from roughly above the middle of the sheet.\n8. **Tests**, each pin's mutation run and recorded (CLAUDE.md):\n   - crop: a window from a BMP fixture enlarged ×4 maps back with `fromCrop`;\n     `writePng`'s chunks carry correct CRCs and its image data inflates back\n     to the pixels written; the converter list off macOS;\n   - orientation: a synthetic image tagged 6 and 8 comes back upright (a\n     marked corner where the phone shows it); one the converter already\n     turned (decoded size swapped) isn't turned twice; 3 and a mirrored\n     orientation are refused;\n   - offset and along: exact on synthetic points, a slanted line, a foot\n     before `a` (negative along);\n   - the automatic grid and reference: `photoMeasure`'s core on the\n     synthetic photo `photoCheck.test.ts` draws, figures within 0.3 mm; an\n     unrefined reference end refuses the run;\n   - facing: an end facing the camera refuses its figure alone (exit 3); a\n     reference end facing it refuses the run (exit 1); `straddlesCentre`'s\n     existing tests unchanged;\n   - a point outside the photo refused with the size named;\n   - `--json` parsed back for a run with one figure read and one refused;\n   - `--overlay`: marker pixels land at the scaled points;\n   - the measuring scoreboard's core (entries and a photo loader injected):\n     on the synthetic photo `photoCheck.test.ts` draws, a stored entry passes\n     within its tolerance, and the same entry\n     with an `offset` point given without `toward` (never refined) moved 5 px\n     square to its line fails (about 1 mm on that photo);\n   - `checkFolder` skips `.overlay.png` beside a photo, as it skips crops;\n   - status: a figure with every end refined and facing checked is\n     `checked`; one with an end kept as hand reading, or a point without\n     `toward`, is `provisional` and names why; a hand-read reference end\n     makes every figure `provisional`;\n   - refusals, each with its exit code: a HEIC and an orientation-3 JPEG in\n     `photoMeasure` and in the crop (1); a found grid over 0.3 mm rms and warm\n     paper (1); a points file missing `grid` or `reference` without `--photo`\n     (2); an `--overlay` path that is neither a folder nor ends\n     `.overlay.png` (2); a figure point outside the photo (3, its `End` reading \"outside the\n     photo\");\n   - the scale chosen with a given reference by `K_PLAUSIBLE`, on the\n     synthetic photo with 5 mm lines as dark as 10 mm ones;\n   - a `point` without `toward` reports \"facing not checked\";\n   - a points file that isn't JSON, and one with no figures (2);\n   - `photoCheck` on an orientation-3 photo still checks it (`loadPhoto`\n     unchanged);\n   - an overlay is drawn for a refused run;\n   - `--help` on both tools exits 0 and names every flag and code; each\n     refusal prints its code first and its fix last, on stderr in text mode\n     and as `{ code, reason, fix, recovery }` in JSON, naming its values;\n     the skill's example points files parse and run on the synthetic photo;\n   - reading a photo: a missing path (`photo-missing`), no converter on an\n     empty `PATH` (`no-converter`), a converter that fails and one that\n     sleeps past the timeout, both `photo-unreadable` naming the converter;\n   - points-invalid: a three-number point, `read: \"across\"`, a line whose\n     ends coincide, each naming its field; `--json` with an unknown flag\n     prints `{ usage }`; a thrown error in the core prints `REFUSED internal`\n     and a trace path;\n   - a `{ crop, at }` point maps to the same photo pixel as `fromCrop`; a\n     crop of another photo is `points-invalid`;\n   - a seeded grid over 0.3 mm rms refuses the run like a found one; a\n     square photo tagged 6 is refused; `jpegSize` reads a JPEG's stored size;\n   - every code in `CODES` appears in the skill's code table;\n     `--auto` still works as `--photo`;\n   - an overlay given as `x/y.overlay.png` is written there; a refused run's\n     JSON names the overlay it drew; a run that fails before drawing leaves\n     no overlay file.\n9. **Acceptance** (CEO decisions 9, 10). Two kinds of check, kept apart:\n   repeating a photo's recorded reading shows the new code reads as the old\n   did; reading a piece of known length shows it reads right.\n   - **On the owner's Mac.** The T switch (84405) from fresh picks: the\n     through road's socket end (S) and peg end (P) as a distance figure; the\n     curved end's centre (C) with `toward` 20 mm back along its curve, read\n     against the line S→P as `along` and `offset`; each within `AGREE_MM`\n     (0.5 mm) of 84405's own recorded readings (216.49, 108.49, 105.34,\n     `photoReadings.ts`). If C can't be refined, its hand reading is kept\n     and the check still asks 0.5 mm. The measuring scoreboard (item 12)\n     ran every entry and passed (`4/4 pass`), which includes the long\n     straight of known length. The photo scoreboard (`bun run photos:score`)\n     still 12/12.\n   - **In a fresh Linux chat sandbox**, as the spike ran (the spike kit, no\n     `sips`): crops of 84405, then the same three figures with `--photo`,\n     `--json` and `--overlay`, each within 0.5 mm of the Mac's run, and the\n     overlay a PNG. The install commands it needed and the time from the\n     kit and photo to the first figure are written into the skill (item 7);\n     the target is under 5 minutes (DX 0C), and a longer time is reported,\n     not hidden (D14). On the Mac, a `--photo` run on a 12 MP photo takes\n     under 30 s [estimated budget, eng E7]; its time is printed on stderr and\n     recorded with the acceptance.\n10. **Machine-readable results** (`photoMeasure.ts --json`, CEO E1): stdout is\n    one JSON object, progress goes to stderr: `{ schema: 1, photo: {width, height},\n    grid: {source: \"seeded\"|\"found\", points, rmsMm}, reference: {source:\n    \"given\"|\"found\", k, ends: [End, End]}, figures: { <name>: { kind:\n    \"distance\"|\"offset\"|\"along\", facing: \"checked\"|\"not checked\", valueMm,\n    status: \"checked\"|\"provisional\", why: [{ code, end?, text }], ends:\n    End[] } | { kind, facing, refused, ends: End[] } },\n    overlay?: { path, key: [{ colour, figure, end }] } }`, where `End` is\n    `{ refined: true, samples, spreadMm } | { refined: false, reason }` (an\n    end outside the photo is `{ refined: false, reason: \"outside the photo\" }`)\n    and a\n    three-point figure's ends are ordered line `a`, line `b`, `point`. A\n    refused run prints `{ schema: 1, refused: { code, reason, fix, recovery\n    }, photo?, grid?, overlay? }`, with whatever it found and the overlay it\n    drew (D12); a usage error (exit 2) prints `{ schema: 1, usage: { code,\n    message, fix } }`; a refused figure's `refused` is `{ code, reason, fix,\n    recovery }` too (DX decision D3). `why` codes: `end-hand-read`,\n    `facing-not-checked`, `reference-hand-read`. The text output stays the default.\n11. **A picture of the points used** (`photoMeasure.ts --overlay <out.png>`,\n    CEO E2): the photo shrunk to 1,600 px on its longest side, with each grid\n    crossing used as a small dot, the reference's ends as squares and each\n    figure end as a ring in its own colour from a fixed list of twelve (past\n    twelve ends the colours repeat; the key lists every end); the key\n    (colour → figure and end) is printed with the results and in `--json`.\n    No text is drawn. Written with `writePng` to a temporary file and then\n    renamed into place, so a failed run never leaves half an image; the JSON\n    and text name the overlay only when it was written (D12). `--overlay`\n    takes a folder (the file is `<points>.overlay.png` in it) or any path\n    ending `.overlay.png`; anything else is `overlay-path` (exit 2), whose fix\n    line prints the path that would be accepted (D13). `checkFolder` skips\n    `*.overlay.png` beside `CROP`. A refused run still draws\n    its overlay when the photo loaded, with whatever was found (grid\n    crossings, reference ends) and the given points, since that is when the\n    picture helps most.\n12. **A measuring scoreboard** (`bun run photos:measure-score`, CEO E3):\n    `engine/tools/photoMeasureScoreboard.ts` holds each known piece's points\n    and expected figures hard-coded in its source (pixel coordinates only;\n    the photos stay in the ignored `photos/`; each entry uses the automatic\n    grid and reference), as `photoScoreboard.ts` holds its verdicts; a\n    missing photo is skipped and counted, as `photos:score` says \"(n photos\n    not in photos)\"; it prints `<passed>/<ran> pass` and exits 1 on any miss\n    or when none ran; `package.json` gains the script. Each entry states its\n    expected figure, its tolerance and the basis for both (CEO decision 10):\n    84405 and 84404, the T switch's three figures against each photo's own\n    recorded reading within `AGREE_MM` (repeatability); 84401 and 84402, the\n    long straight against its known 216 mm within `TOLERANCE_MM` (1 mm, the\n    216 mm trial's bound; those photos read about 0.7 mm long, and the entry\n    says so). New pieces join as they're measured.\n\n**Delivery** (taste, CEO decision 14; the owner confirms at the gate): three\nPRs, each merged before the next is opened (none stacked): (a) `writePng`,\n`loadUpright`, the photo-reading codes, and crops off macOS (item 1), with\ntoday's `photoMeasure --auto` switched to `loadUpright` in the same PR, so\ncrops and measuring never disagree about which way up a photo is (DX\ndecision D15; no saved points change, since a rotated photo was refused\nuntil now); (b) `photoMeasure`'s\nnew core (items 2-6 and its tests); (c) `--json`, `--overlay`, the\nmeasuring scoreboard and the skill (items 7, 10-12), with the acceptance\n(item 9) run on (c).\n\n## Not in scope\n\n- The brief itself (contributor-brief T2 and T5).\n- Measuring heights from photos (AGENTS.md: a ruler).\n- A new image library: the converters already on the machine do the work.\n- Figure kinds beyond distance, offset and along (a radius, an angle):\n  added when a piece needs one.\n- The tool proposing end points itself (deferred, a pending write to\n  `docs/plan/generic-TODOS.md`; CEO decision 13): the overlay and `provisional` status show a bad pick first.\n- Sharing the owner's photos as fixtures outside git (rejected, CEO\n  decision 16): photos are never shared (SEC1); the synthetic photo covers\n  the code, the owner's Mac covers the real ones.\n- Proving the method on many contributors' pieces and references (CEO\n  decision 11): that is the brief's pilot (contributor-brief T2, T5).","newText":"1. **Crops without `sips`** (`photoCrop.ts`, `photoImage.ts`). Cut the window\n   from the upright pixels `loadUpright` returns (any converter), enlarge it ×4 in\n   TypeScript (nearest neighbour, so a pixel stays a square the eye can\n   split), and write it with a new `writePng` in `photoImage.ts` (8-bit RGB,\n   `deflateSync` and `crc32` from `node:zlib`, no converter), so a crop is\n   always a PNG and `CROP` keeps its one pattern. Converters stay for reading\n   photos only, within one 60 s deadline for the whole read, not per\n   converter (DX D5, eng G4). The decoder inside `photoImage.ts` is\n   reworked (eng G7): the file's first bytes are read before anything runs,\n   and only a JPEG (`FFD8`), PNG or BMP goes on, a HEIC (an `ftyp` box) is\n   `heic` whatever its name, anything else `photo-unreadable` (eng G5:\n   ImageMagick never sees an unknown format); converters get the absolute\n   path with an explicit coder prefix (`jpg:/abs/path` for `magick` and\n   `convert`); a spawn that fails with ENOENT means that converter is\n   absent, any other failure means it was tried, and its stderr is kept\n   (known deprecation lines stripped); the converter list, the deadline and\n   the spawn are injectable for tests. A BMP is read directly and a\n   malformed one is `photo-unreadable`. Reading a photo fails in one of\n   three ways, each its own code (D4): `photo-missing` (the path doesn't\n   exist or can't be read; names the path), checked first; `no-converter`\n   (every converter absent); `photo-unreadable` (a converter ran and failed\n   or ran out of time, naming each tried and the first line of its stderr;\n   or the bytes aren't a photo it takes). `loadPhoto` returns the same\n   pixels as today, so `photoCheck` reads every photo as before.\n   The window maths (`windowAround`, `fromCrop`) stay.\n   Orientation (CEO decisions 7, 20): a new `loadUpright` (`photoImage.ts`)\n   wraps `loadPhoto` and returns the photo upright, as a phone and a chat\n   preview show it, with `orientationOf` (`photoExif.ts`) read instead of\n   `sips -g`; `loadPhoto` itself, and so `photoCheck`, keeps today's pixels\n   and orientation. Orientation 1 is read as is; 6 and 8 (a\n   portrait phone photo) are turned in TypeScript unless the decoded width\n   and height show the converter already turned it, compared with the\n   JPEG's stored size read from its frame header by a new `jpegSize` in\n   `photoExif.ts` (beside `orientationOf`, on the same `segments`); 3, the\n   mirrored orientations, and a square photo tagged 6 or 8, where the decoded\n   size can't tell, are refused as today (\"open and re-save the photo\n   upright\") (eng E2). Which way a converter turned a 6 or 8 can't be seen\n   from the size; the code assumes it applied the tag, and says so. A PNG's\n   `eXIf` orientation is ignored, by choice, and documented. `jpegSize` reads\n   any SOF0-SOF15 frame header except C4, C8 and CC (progressive phone JPEGs\n   are SOF2) and skips the EXIF thumbnail's. `photoImage.ts`'s header says which loader to use:\n   `loadUpright` for anything that reads points, `loadPhoto` only for\n   `photoCheck`, which looks at whole photos (eng E6). A HEIC photo is refused (convert\n   to JPEG). The crop's JSON line gains the photo's upright `width` and\n   `height`, and stderr says how to map back: \"a point at (cx, cy) in this\n   crop is (x0 + cx/4, y0 + cy/4) in the photo\" with the numbers filled in\n   (DX decision D2). A point in the points file may instead be given as\n   `{ \"crop\": \"<crop file>\", \"at\": [cx, cy] }`, and `photoMeasure` maps it\n   back from the window the crop's name records (`CROP`), so no point is\n   converted by hand (taste, DX decision D6). The crop's path is resolved\n   from the points file's folder, and only its name is read (no file opened):\n   it must sit beside the photo and match `<photo's stem>.crop-x-y-side.png`\n   exactly (so `84405b.crop-…` is not a crop of `84405`), and `at` must lie\n   inside the enlarged crop (0 to 4 × side); otherwise `points-invalid`\n   (eng E3, G6). `photoCrop`'s `half` must be a whole number, so a window is\n   always whole pixels and its name matches `CROP` (eng G8).\n2. **The grid and the reference found automatically** (`photoMeasure.ts`).\n   With `--photo <photo>` (`--auto` kept as its alias, so today's command\n   lines still run; DX decision D7): a points file that gives `grid` seeds `findGrid` as\n   today; one that leaves it out gets `findGridAuto` with the scale retry\n   `photoCheck` uses (`gridAndPlanks` moved to `photoStraights.ts` and shared,\n   not copied; `AUTO_GRID_RMS_MAX_MM` and `paperTooWarm` move with it, so\n   `photoMeasure` never imports the `photoCheck` command, eng G3). A points file without `reference` uses the medium straight\n   `namePlanks` finds; if either of its ends was not refined, the run is\n   refused (\"the medium straight's <which> end couldn't be read: no shadow\n   across it, nothing touching it\"), as `photoCheck` refuses it. A given\n   reference's ends, and every figure's ends, keep today's rule: an end that\n   can't be refined keeps its hand reading, and says so (text and JSON). A\n   grid, found or seeded from a given one, is held to `photoCheck`'s\n   limits, one rule for both (eng E1): rms above\n   `AUTO_GRID_RMS_MAX_MM` (0.3 mm) and paper as warm as the wood\n   (`paperTooWarm`) each refuse the run (exit 1). With a given reference, the\n   scale retry keeps the first scale at which that reference's `k` falls in\n   `K_PLAUSIBLE`, with `k` read from that reference's refined ends at each\n   scale (a hand reading where an end can't be refined). `--photo` reads the\n   photo upright through the same `loadUpright` as the crop (item 1), so points\n   picked off a crop or a chat preview match; an orientation it refuses, and\n   a HEIC, refuse the run (exit 1); a PNG or BMP carries no orientation and\n   is read as is.\n   Which scale is used, by case (eng G6b):\n   ```\n                       reference given                 reference found\n   grid seeded         the seeds' millimetres; k        the seeds' millimetres; the\n                       outside K_PLAUSIBLE: k-implausible   medium straight namePlanks names\n                                                        at that scale, else reference-unread\n   grid found          scales 1, 2, 0.5: the first      scales 1, 2, 0.5: the first where\n                       whose k falls in K_PLAUSIBLE,    namePlanks names a reference (as\n                       else k-implausible               photoCheck), else reference-unread\n   ```\n   each cell tested.\n   `PhotoInput`'s `grid` and `reference` become optional; without `--photo`,\n   a points file missing either is a usage error (exit 2). The run says which\n   grid and reference it used.\n3. **Figures beyond two points** (`photo.ts`, `photoMeasure.ts`). A figure is\n   either today's `[a, b]` (distance), or `{ point, toward?, line: [a, b],\n   read: \"offset\" | \"along\" }`. `offset`: the point's distance from the line\n   through `a` and `b`, never negative. `along`: how far along that line,\n   from `a` towards `b`, the point's foot lies; negative when the foot falls\n   before `a`. Both in paper millimetres times the scale. Line ends are\n   refined as today (each against the other); a `point` is refined against\n   `toward` when given, else its hand reading is kept and said.\n4. **One figure refused, not the run** (`photoEdges.ts`, `photoMeasure.ts`).\n   A new `facesAway(img, end, other)`: an end faces away from the camera\n   when its outward direction (from `other` to `end`) points away from the\n   photo's centre, on both axes: `(end − other) · (end − centre) > 0`\n   (eng G2: a one-axis test passes a curved end whose face partly turns to\n   the camera). For a figure's `point`, `other` is its `toward`.\n   `straddlesCentre` stays as it is, so `photoCheck` and the scoreboard\n   (84397) keep their whole-piece rule. In `photoMeasure`: a\n   reference end facing the camera refuses the run (every figure depends on\n   the scale); a figure end facing it refuses that figure alone, with a fix\n   that changes what caused it (DX decision D8): for a line end, \"lay the\n   piece across the middle of the photo and retake\"; for a `point`, \"check\n   that `toward` lies back along the same road; if it does, retake with the\n   piece across the middle\"; a `point` without `toward` is \"facing not checked\".\n   Exit: 0 every figure read, 1 the run refused (a bad grid, a reference\n   problem, a grid or reference point outside the photo, an orientation\n   `loadUpright` refuses, a HEIC, a photo no converter reads),\n   2 bad usage (including a new feature asked for without `--photo`), 3 some\n   figures refused (a figure end facing the camera or outside the photo),\n   including every figure refused (eng G11). Geometry is checked after\n   mapping (eng G5b): a `point` equal to its `toward`, a reference whose two\n   ends coincide, or a seeded grid whose map gives a non-finite value is\n   `points-invalid` before work; a figure whose mapped or refined ends give a\n   non-finite value, or ends closer than 1 mm, is refused alone\n   (`geometry`), never a `NaN` reading.\n   Every figure read carries a status (CEO decision 12): `checked` when each\n   of its ends was refined and its facing checked, else `provisional`, with\n   the reasons (an end kept as hand reading, \"facing not checked\"); a\n   reference end kept as a hand reading makes every figure provisional. The\n   exit code doesn't change; a catalogue figure still needs two photos to\n   agree (`agreedFigure`, `photoReadings.ts`).\n5. **Pixels said plainly.** `photoMeasure.ts` prints the photo's size and\n   refuses a point outside it (\"points are in the photo's full pixels, W×H;\n   a point read off a smaller preview must be scaled\"). Every new feature\n   (automatic grid or reference, `offset`/`along`, facing, bounds, `--json`,\n   `--overlay`) needs the photo, so it needs `--photo <photo>`; without it,\n   only today's plain two-point figures with a given grid run, and asking for\n   more is a usage error (exit 2) that says so. The pip note (`--break-system-packages`) is for the brief's\n   draft (contributor-brief T2), not code.\n6. **The command line** (`photoMeasure.ts`): flags parsed by name\n   (`--photo <photo>`, `--json`, `--overlay <out.png>`), the points file the\n   one positional argument; a usage error exits 2, and so does a points\n   file that isn't valid JSON or has no figures, with the parse error or\n   \"no figures\" named (CEO decision 17). A photo that can't be read\n   refuses the run (exit 1) with one of item 1's three codes, which says\n   whether to fix the path, install a converter or re-save the photo (CEO\n   decision 18, refined by DX D4). The CLI only parses, loads and exits: a pure\n   core takes the points and the image and returns one result object, which\n   the text output, `--json` and `--overlay` all render (CEO decision 19).\n   For an agent reading the output (DX decisions D1, D3): `--help` on\n   `photoMeasure.ts` and `photoCrop.ts` prints the usage, every flag, the\n   exit codes, the points-file format and a complete example, and exits 0.\n   In text mode results go to stdout; a refused run's reason and a usage\n   error go to stderr. Every run refusal and usage error has a stable code\n   (`photo-missing`, `no-converter`, `photo-unreadable`, `orientation`,\n   `heic`, `grid-not-found`, `grid-rms`, `paper-warm`, `reference-unread`,\n   `reference-faces-camera`, `k-implausible`, `point-outside`, `usage`,\n   `points-not-json`, `points-invalid`, `no-figures`, `needs-photo`,\n   `overlay-path`, `internal`), one table shared by both tools, defined once as a `CODES` constant (each\n   code's recovery class and fix) that the text, the JSON and `--help` all\n   read, and a test fails when the skill's code table misses one (eng E5), printed\n   first as `REFUSED <code>:` or `USAGE <code>:`, with the fix on the\n   message's last line (retake how, re-save upright, install what, add\n   `--photo <photo>`); a per-figure refusal carries `faces-camera` or\n   `point-outside` the same way. Every refusal names the values that caused\n   it (DX decision D9): the rms found and the 0.3 mm limit, `k` at each\n   scale tried and `K_PLAUSIBLE`, the paper and wood colours compared, the\n   EXIF orientation read, the size and the point. Each code has a recovery\n   class, `retake`, `edit-points`, `install` or `human`, in the table and in\n   the JSON. The points file is checked whole before any work\n   (`points-invalid`, exit 2, D10): each point two finite numbers, `read`\n   one of its two values, a line's two ends apart, the field's path named\n   (`figures.out.line[1]`). `--json` is found anywhere in the arguments\n   before anything else is checked, so a usage error is JSON too. An\n   unexpected error is caught at the top: `REFUSED internal:`, exit 1, its\n   trace written to a file in the temp folder and that path printed (D11);\n   the trace never goes into `--json` (eng G13).\n   `--help`'s last line points to the skill's code table\n   (`.claude/skills/draw-piece/SKILL.md`, \"Measure codes\").\n7. **The drawing skill** (`.claude/skills/draw-piece/SKILL.md` step 7): the\n   new figure kinds, the automatic grid and reference, per-figure refusals\n   and their exit codes, `--json`, `--overlay`, and crops on any system; and\n   how to choose `toward`: a point on the same road's centreline, at least\n   20 mm back from the end, so the end face is square to the line between\n   them (for a switch's curved end, back along the curve, not along the\n   straight road). A minimal points file first, one distance figure with\n   `crop`/`at` points, with its command and both its text and `--json`\n   output (D14); then a complete one (DX decision D2): the T\n   switch's three figures, one distance and the `along` and `offset` of its\n   curved end with `toward`, no `grid` or `reference` (found), with the\n   command that reads it and what it prints. Also (CEO decisions 11, 13): the workflow from photo to\n   figure, step by step (crop around each end, read the point off the\n   enlarged crop, give it as `{ crop, at }` in the points file, then run);\n   what the tools need (Bun, and one of `magick`, `convert` or `ffmpeg` to\n   read a JPEG; macOS has `sips`; Windows is not supported, use WSL); and\n   the conditions a measurement assumes, said again in the facing refusal:\n   the reference is the 144 mm medium straight, lying flat beside the piece\n   with its top face level with the piece's; the photo is uncropped, taken\n   from roughly above the middle of the sheet.\n8. **Tests**, each pin's mutation run and recorded (CLAUDE.md):\n   - crop: a window from a BMP fixture enlarged ×4 maps back with `fromCrop`;\n     `writePng`'s chunks carry correct CRCs and its image data inflates back\n     to the pixels written; the converter list off macOS;\n   - orientation: a synthetic image tagged 6 and 8 comes back upright (a\n     marked corner where the phone shows it); one the converter already\n     turned (decoded size swapped) isn't turned twice; 3 and a mirrored\n     orientation are refused;\n   - offset and along: exact on synthetic points, a slanted line, a foot\n     before `a` (negative along);\n   - the automatic grid and reference: `photoMeasure`'s core on the\n     synthetic photo `photoCheck.test.ts` draws, figures within 0.3 mm; an\n     unrefined reference end refuses the run;\n   - facing: an end facing the camera refuses its figure alone (exit 3); a\n     reference end facing it refuses the run (exit 1); `straddlesCentre`'s\n     existing tests unchanged;\n   - a point outside the photo refused with the size named;\n   - `--json` parsed back for a run with one figure read and one refused;\n   - `--overlay`: marker pixels land at the scaled points;\n   - the measuring scoreboard's core (entries and a photo loader injected):\n     on the synthetic photo `photoCheck.test.ts` draws, a stored entry passes\n     within its tolerance, and the same entry\n     with an `offset` point given without `toward` (never refined) moved 5 px\n     square to its line fails (about 1 mm on that photo);\n   - `checkFolder` skips `.overlay.png` beside a photo, as it skips crops;\n   - status: a figure with every end refined and facing checked is\n     `checked`; one with an end kept as hand reading, or a point without\n     `toward`, is `provisional` and names why; a hand-read reference end\n     makes every figure `provisional`;\n   - refusals, each with its exit code: a HEIC and an orientation-3 JPEG in\n     `photoMeasure` and in the crop (1); a found grid over 0.3 mm rms and warm\n     paper (1); a points file missing `grid` or `reference` without `--photo`\n     (2); an `--overlay` path that is neither a folder nor ends\n     `.overlay.png` (2); a figure point outside the photo (3, its `End` reading \"outside the\n     photo\");\n   - the scale chosen with a given reference by `K_PLAUSIBLE`, on the\n     synthetic photo with 5 mm lines as dark as 10 mm ones;\n   - a `point` without `toward` reports \"facing not checked\";\n   - a points file that isn't JSON, and one with no figures (2);\n   - `photoCheck` on an orientation-3 photo still checks it (`loadPhoto`\n     unchanged);\n   - an overlay is drawn for a refused run;\n   - `--help` on both tools exits 0 and names every flag and code; each\n     refusal prints its code first and its fix last, on stderr in text mode\n     and as `{ code, reason, fix, recovery }` in JSON, naming its values;\n     the skill's example points files parse and run on the synthetic photo;\n   - reading a photo, with the spawn injected: a missing path\n     (`photo-missing`), every converter ENOENT (`no-converter`), a converter\n     that fails and one that runs past a 200 ms deadline, both\n     `photo-unreadable` naming the converter;\n   - points-invalid: a three-number point, `read: \"across\"`, a line whose\n     ends coincide, each naming its field; `--json` with an unknown flag\n     prints `{ usage }`; a thrown error in the core prints `REFUSED internal`\n     and a trace path;\n   - a `{ crop, at }` point maps to the same photo pixel as `fromCrop`; a\n     crop of another photo is `points-invalid`;\n   - a seeded grid over 0.3 mm rms refuses the run like a found one; a\n     square photo tagged 6 is refused; `jpegSize` reads a JPEG's stored size;\n   - every code in `CODES` appears in the skill's code table;\n   - eng: `loadUpright` equals `loadPhoto` on orientation 1; a 6 with a\n     converter that turns it and one that doesn't; `jpegSize` on a\n     progressive JPEG and one with a thumbnail; a HEIC named `.jpg`; a text\n     file named `.jpg`; ENOENT vs a failing converter vs the deadline, with\n     an injected spawn and a 200 ms deadline; `84405b.crop-…` refused for\n     `84405`; `at` outside the crop; fractional `half`; an overlay written\n     with its temp file in the target folder; each cell of the scale table;\n     every figure refused exits 3; `point` equal to `toward`; an end at\n     (510, 100) with `toward` (310, 50) on a 1000 × 1000 photo faces the\n     camera; `facesAway` at a dot product of exactly 0 is false; the JSON\n     carries each end's `seed` and `at`;\n   - `--auto` still works as `--photo`;\n   - an overlay given as `x/y.overlay.png` is written there; a refused run's\n     JSON names the overlay it drew; a run that fails before drawing leaves\n     no overlay file.\n9. **Acceptance** (CEO decisions 9, 10). Two kinds of check, kept apart:\n   repeating a photo's recorded reading shows the new code reads as the old\n   did; reading a piece of known length shows it reads right.\n   - **On the owner's Mac.** The T switch (84405) from fresh picks: the\n     through road's socket end (S) and peg end (P) as a distance figure; the\n     curved end's centre (C) with `toward` 20 mm back along its curve, read\n     against the line S→P as `along` and `offset`; each within `AGREE_MM`\n     (0.5 mm) of 84405's own recorded readings (216.49, 108.49, 105.34,\n     `photoReadings.ts`). If C can't be refined, its hand reading is kept\n     and the check still asks 0.5 mm. The measuring scoreboard (item 12)\n     ran every entry and passed (`4/4 pass`), which includes the long\n     straight of known length. The photo scoreboard (`bun run photos:score`)\n     still 12/12.\n   - **In a fresh Linux chat sandbox**, as the spike ran (the spike kit, no\n     `sips`): crops of 84405, then the same three figures with `--photo`,\n     `--json` and `--overlay`, each within 0.5 mm of the Mac's run, and the\n     overlay a PNG. The install commands it needed and the time from the\n     kit and photo to the first figure are written into the skill (item 7);\n     the target is under 5 minutes (DX 0C), and a longer time is reported,\n     not hidden (D14). On the Mac, a `--photo` run on a 12 MP photo takes\n     under 30 s [estimated budget, eng E7]; its time is printed on stderr and\n     recorded with the acceptance.\n10. **Machine-readable results** (`photoMeasure.ts --json`, CEO E1): stdout is\n    one JSON object, progress goes to stderr: `{ schema: 1, photo: {width, height},\n    grid: {source: \"seeded\"|\"found\", points, rmsMm}, reference: {source:\n    \"given\"|\"found\", k, ends: [End, End]}, figures: { <name>: { kind:\n    \"distance\"|\"offset\"|\"along\", facing: \"checked\"|\"not checked\", valueMm,\n    status: \"checked\"|\"provisional\", why: [{ code, end?, text }], ends:\n    End[] } | { kind, facing, refused, ends: End[] } },\n    overlay?: { path, key: [{ colour, figure, end }] } }`, where `End` is\n    `{ seed, at, refined: true, samples, spreadMm } | { seed, at, refined:\n    false, reason }`, with `seed` the point as given (after `crop` mapping)\n    and `at` the point used, so the overlay draws from the result alone; a\n    found reference keeps its ends' `samples` and `spreadMm`, which\n    `photoStraights` drops today (eng G4b) (an\n    end outside the photo is `{ refined: false, reason: \"outside the photo\" }`)\n    and a\n    three-point figure's ends are ordered line `a`, line `b`, `point`. A\n    refused run prints `{ schema: 1, refused: { code, reason, fix, recovery\n    }, photo?, grid?, overlay? }`, with whatever it found and the overlay it\n    drew (D12); a usage error (exit 2) prints `{ schema: 1, usage: { code,\n    message, fix } }`; a refused figure's `refused` is `{ code, reason, fix,\n    recovery }` too (DX decision D3). `why` codes: `end-hand-read`,\n    `facing-not-checked`, `reference-hand-read`. The text output stays the default.\n11. **A picture of the points used** (`photoMeasure.ts --overlay <out.png>`,\n    CEO E2): the photo shrunk to 1,600 px on its longest side, with each grid\n    crossing used as a small dot, the reference's ends as squares and each\n    figure end as a ring in its own colour from a fixed list of twelve (past\n    twelve ends the colours repeat; the key lists every end); the key\n    (colour → figure and end) is printed with the results and in `--json`.\n    No text is drawn. Written with `writePng` to `<out>.tmp-<pid>` in the\n    same folder (a rename from the temp folder fails across file systems),\n    unlinked on failure, then renamed into place (eng G8b), so a failed run never leaves half an image; the JSON\n    and text name the overlay only when it was written (D12). `--overlay`\n    takes a folder (the file is `<points>.overlay.png` in it) or any path\n    ending `.overlay.png`; anything else is `overlay-path` (exit 2), whose fix\n    line prints the path that would be accepted (D13). `checkFolder` skips\n    `*.overlay.png` beside `CROP`. A refused run still draws\n    its overlay when the photo loaded, with whatever was found (grid\n    crossings, reference ends) and the given points, since that is when the\n    picture helps most.\n12. **A measuring scoreboard** (`bun run photos:measure-score`, CEO E3):\n    `engine/tools/photoMeasureScoreboard.ts` holds each known piece's points\n    and expected figures hard-coded in its source (pixel coordinates only;\n    the photos stay in the ignored `photos/`; each entry uses the automatic\n    grid, and the automatic reference unless the entry gives one), as `photoScoreboard.ts` holds its verdicts; a\n    missing photo is skipped and counted, as `photos:score` says \"(n photos\n    not in photos)\"; it prints `<passed>/<ran> pass` and exits 1 on any miss\n    or when none ran; `package.json` gains the script. Each entry states its\n    expected figure, its tolerance and the basis for both (CEO decision 10):\n    84405 and 84404, the T switch's three figures against each photo's own\n    recorded reading within `AGREE_MM` (repeatability), 84404 with its\n    reference given, since two pieces touch there and `photos:score` expects\n    the automatic reference to be refused (eng G1); 84401 and 84402, the\n    long straight against its known 216 mm within `TOLERANCE_MM` (1 mm, the\n    216 mm trial's bound; those photos read about 0.7 mm long, and the entry\n    says so). New pieces join as they're measured.\n\n**Delivery** (taste, CEO decision 14; the owner confirms at the gate): three\nPRs, each merged before the next is opened (none stacked): (a) `writePng`,\n`loadUpright`, the photo-reading codes, and crops off macOS (item 1), with\ntoday's `photoMeasure --auto` switched to `loadUpright` in the same PR, so\ncrops and measuring never disagree about which way up a photo is (DX\ndecision D15). `photoMeasure --auto` never checked orientation, so a\nrotated photo's saved points would move; but all 35 of the owner's JPEGs in\n`photos/` read orientation 1 (2 have none) [measured 2026-11-09, eng G1b],\nso none do, and a test shows `loadUpright` gives `loadPhoto`'s pixels for\norientation 1; (b) `photoMeasure`'s\nnew core (items 2-6 and its tests); (c) `--json`, `--overlay`, the\nmeasuring scoreboard and the skill (items 7, 10-12), with the acceptance\n(item 9) run on (c).\n\n## Not in scope\n\n- The brief itself (contributor-brief T2 and T5).\n- Measuring heights from photos (AGENTS.md: a ruler).\n- A new image library: the converters already on the machine do the work.\n- Figure kinds beyond distance, offset and along (a radius, an angle):\n  added when a piece needs one.\n- The tool proposing end points itself (deferred, a pending write to\n  `docs/plan/generic-TODOS.md`; CEO decision 13): the overlay and `provisional` status show a bad pick first.\n- Sharing the owner's photos as fixtures outside git (rejected, CEO\n  decision 16): photos are never shared (SEC1); the synthetic photo covers\n  the code, the owner's Mac covers the real ones.\n- Proving the method on many contributors' pieces and references (CEO\n  decision 11): that is the brief's pilot (contributor-brief T2, T5)."}]} -->

<!-- autoplan-accepted:eng -->
- Eng E1-E7: one rms rule for seeded and found grids; `jpegSize` (SOF0-15 except C4/C8/CC), square 6/8 refused; crop of another photo `points-invalid`; one `CODES` constant tested against the skill; loader choice in photoImage's header; `--photo` run under 30 s on the Mac [estimated], timed per scale.
- G1: 84404's scoreboard entry gives its reference. G1b: orientation claim corrected (35/35 owner JPEGs at 1, measured), `loadUpright` equals `loadPhoto` on orientation 1, tested.
- G2: `facesAway` by `(end − other) · (end − centre) > 0`; `straddlesCentre` kept for photoCheck; diagonal and tie tests.
- G3: `gridAndPlanks`, `AUTO_GRID_RMS_MAX_MM`, `paperTooWarm` in photoStraights. G4b: End carries `seed` and `at`; found reference keeps its evidence.
- G4, G5, G7: decoder sniffs JPEG/PNG/BMP/HEIC first, coder prefix and absolute paths, one 60 s deadline, ENOENT vs failed with stderr kept, injectable converters/deadline/spawn, malformed BMP `photo-unreadable`; `loadPhoto`'s pixels unchanged.
- G5b: geometry checked after mapping (`points-invalid` before work, `geometry` per figure). G6: crop resolved from the points folder, exact stem, crop-local `at` bounds. G6b: the scale case table, each cell tested. G8: whole `half`. G8b: overlay temp beside target. G11: all refused exits 3. G13: no trace in JSON.
- Every test listed in item 8 for these, each mutation run and recorded.
- G2 supersedes the CEO block's single-axis `facesAway` built into `straddlesCentre`; G1 supersedes "automatic reference" for 84404 in E3.
<!-- /autoplan-accepted:eng -->

### Eng phase: Step 0, Scope Challenge (auto-decided, /autoplan)

Methodology read: `autoplan-eng-methodology-POxPrq/methodology.md` ranges
1-600, 601-1200, 1201-1800, 1801-2109 (EOF, 2,109 lines).

**A. What already solves each part** (read in the code): `gridAndPlanks`
(`photoCheck.ts:61-73`, private; scale 1, 2, 0.5 until a plank is named the
reference); `AUTO_GRID_RMS_MAX_MM` (`photoCheck.ts:52`); `paperTooWarm`
(`photoCheck.ts:84`); `straddlesCentre` (`photoEdges.ts:158-163`, axis by the
larger of |dx|, |dy|; ends either side of the centre); `scaleAndMeasure`
(`photo.ts:136-151`, `[a, b]` figures only, `k = 144 / reference on paper`);
`orientationOf` and `segments` (`photoExif.ts:92`); `loadPhoto`,
`NO_CONVERTER` (`photoImage.ts:67-90`). Import graph: `photoStraights`
imports `photo`, `photoEdges`, `photoGrid`, `photoImage`; moving
`gridAndPlanks` there adds `photoGridSeed`, which imports none of them back:
no cycle.

Geometry check: a top face 12 mm above the paper projects onto it scaled
about the camera's nadir by one factor, so perpendicular (`offset`) and
along-line (`along`) distances on the paper scale by the same `k` as
point-to-point ones; one `k` serves all three kinds.

**Complexity:** about 12 changed files (photoImage, photoCrop, photoMeasure,
photo, photoEdges, photoStraights, photoCheck, photoExif, the new
photoMeasureScoreboard, SKILL.md, package.json, tests) [estimated], one new
module (the scoreboard): over the 8-file bar. B, structure
(`plan-eng-review-structure`, auto-decided): **Original arrangement**, the
three PRs in turn (decision 14), since no smaller arrangement keeps the
accepted features; no feature cut (P2: never reduce). Scope accepted as-is.

**Findings (applied):** E1 a seeded grid had no rms limit while a found one
did (`photoMeasure.ts:44-45` prints rms, never checks it): one rule. E2 a
square photo tagged 6/8 can't show whether the converter turned it: refused;
the stored size comes from a new `jpegSize`. E3 a `{crop, at}` from another
photo's crop would map silently: `points-invalid`. E5 the code table would
live in code and in the skill: one `CODES` constant and a test against the
skill. E6 two loaders, `loadPhoto` and `loadUpright`: the header says which.
E7 no time budget on the `--photo` path: under 30 s on the Mac
[estimated], timed in the acceptance.

**Search check:** no new architectural pattern, infrastructure or concurrency:
skipped. **Distribution:** none (tools run from the repo with Bun).
**TODOS:** no root TODOS.md; `docs/plan/generic-TODOS.md` holds another
session's edits (pending writes listed under NOT in scope).

| Premise | Claim | Receipt | Verdict |
|---|---|---|---|
| E-P1 | `gridAndPlanks` is private to photoCheck | engine/tools/photoCheck.ts:61 | true |
| E-P2 | seeded grid has no rms limit in photoMeasure | engine/tools/photoMeasure.ts:44 | true |
| E-P3 | figures are `[a, b]` only | engine/tools/photo.ts:149 | true |
| E-P4 | straddlesCentre picks the axis by the larger delta | engine/tools/photoEdges.ts:159 | true |
| E-P5 | photoExif parses JPEG segments | engine/tools/photoExif.ts:94 | true |

unverified=0

REALITY: premise-table pass 5 claims, 0 unverified engine/tools/photoCheck.ts:61
REALITY: already-done pass `git log origin/main --since=2026-11-09 -- engine/tools/` empty engine/tools/photoMeasure.ts:1
REALITY: surface-check pass `photoMeasure.ts <points.json> [--auto <photo>]` and `photoCrop.ts <photo> <x> <y> [half]` as their usage lines say; `photos:score` in package.json engine/tools/photoMeasure.ts:37
REALITY: binding-decisions pass no branch decisions logged; AGENTS.md no second pipeline and no stacked PRs kept AGENTS.md:46
REALITY: numbers pass 216.49/108.49/105.34 [measured: engine/data/photoReadings.ts:45], 216.52/216.88 [measured: engine/data/photoReadings.ts:71], 0.3 mm [measured: engine/tools/photoCheck.ts:52], 30 s and 12 files [estimated] engine/data/photoReadings.ts:45
REALITY: deferred-asks pass no linked issue; deferrals listed under NOT in scope docs/plan/2026-11-09-contributor-brief.md:1
REALITY: pr-count pass no ship policy (default one PR per wave); three PRs in turn (taste 14), each extra PR one more CI run and merge; the skill lands in (c) with its features AGENTS.md:83

### Eng phase: Step 0.5, dual voices

Claude SUBAGENT (eng — independent review), INPUT `eng 1c38c72f…`, matching
the snapshot: 15 findings. High: the "rotated photos were refused" claim is
false for `photoMeasure` (G1b); the timeout/no-converter tests can't run
against today's catch-all loader (G7). Medium: shared module for the rms
limit and paper check (G3); per-converter timeouts add up to minutes, IM7
stderr noise (G4); untrusted photos through ImageMagick (G5); the scale case
table (G6b); crop-name prefix collision and path resolution (G6); overlay
temp file across file systems (G8b); `jpegSize` on progressive JPEGs; size
can't show 90° vs 270°, PNG `eXIf`. Low: all figures refused (G11); tie
rule; trace in JSON (G13); stale CEO block wording; time per scale.

Codex SAYS (eng — architecture challenge), gpt-6-astra, completed: 8.
1. High: 84404 can't both be refused by `photos:score` ("touch",
   `photoScoreboard.ts:30`, `photoCheck.ts:106`) and measured with an
   automatic reference (G1).
2. High: a one-axis facing test passes a curved end that partly faces the
   camera ((510,100), toward (310,50), centre (500,500)) (G2).
3. High: the orientation compatibility claim (= native G1b).
4. Medium: the result lacks the coordinates its renderers need; found
   reference refinement evidence dropped (`photoStraights.ts:212`) (G4b).
5. Medium: degenerate geometry after mapping: point = toward, coincident
   reference ends, singular seeded grids (G5b).
6. Medium: crop identity, exact stem, crop-local bounds (= native, G6).
7. Medium: an unchanged loader can't give the new errors (= native, G7).
8. Low: fractional `half` gives a fractional window (G8).

Checked against the code: 84404's expected refusal (`photoScoreboard.ts:30`)
true; `photoMeasure.ts:43` loads without an orientation check, true; owner's
JPEGs: 35 at orientation 1, 2 with none, true.

```
ENG DUAL VOICES — CONSENSUS TABLE:
  Dimension                           Claude  Codex  Consensus
  1. Architecture sound?               yes*    no     DISAGREE in degree: both accept the core; Codex adds
                                                      facing (G2) and result shape (G4b), applied
  2. Test coverage sufficient?         no      no     CONFIRMED: decoder seams, crop collisions, geometry
  3. Perf risks + budget/bench named?  no      n/a    single voice: summed timeouts (G4), applied
  4. Security threats covered?         no      n/a    single voice: ImageMagick input (G5), applied
  5. Error paths handled?              no      no     CONFIRMED: decoder classes (G7), degenerate geometry
  6. Deployment risk manageable?       no      no     CONFIRMED: orientation claim (G1b), measured harmless
CONFIRMED = native + outside agree. No single-voice critical findings.
```

### Eng phase: review sections

**1. Architecture.**
```
                 bytes ──sniff──▶ JPEG│PNG│BMP│HEIC│other
                                    │
  photoImage ─ decode (converters, one deadline, injectable) ─▶ RGB ─▶ loadPhoto ─▶ photoCheck (unchanged)
      │                                                          └─▶ loadUpright (photoExif: orientationOf, jpegSize)
      └─ writePng (node:zlib)                                            │
                                                                         ├─▶ photoCrop ─▶ *.crop-x-y-side.png
  photoStraights: gridAndPlanks, AUTO_GRID_RMS_MAX_MM, paperTooWarm      │
      ▲             (moved from photoCheck; photoCheck imports them)     ▼
      └──────────────────────────────────────────── photoMeasure core (pure) ── CODES
                                                       │  ├ photo.ts: distance/offset/along, k
                                                       │  └ photoEdges: refineEnd, facesAway (dot product)
                                                       ▼
                                              result ─▶ text │ --json │ --overlay (writePng)
  photoMeasureScoreboard ─▶ core (loader injected)
```
Design twice: shape A (chosen) turns photos in TypeScript after any decoder;
shape B asks each converter to orient (`-auto-orient`, ffmpeg's default).
A is deeper: one rule behind `loadUpright`, the same on every converter; B
spreads the rule across four command lines that disagree (sips doesn't).
Red flags: two ways to load (G6/E6, header says which); hand-synced code
table (E5, `CODES` plus test); shallow pass-through none; split ownership
none (rms limit has one home, G3). Failure per path: a converter hangs
(deadline), a crafted file (sniff + coder prefix), a crop from another
photo (exact stem). Rollback: revert the PR; no data.
Findings: [INFORMATIONAL] (9/10) photoEdges.ts:159 one-axis facing (G2);
[INFORMATIONAL] (8/10) photoCheck.ts:61 shared module (G3);
[INFORMATIONAL] (8/10) photoStraights.ts:212 evidence dropped (G4b).
Dispositions: all accepted (decisions 44-46).

**2. Code quality.** `photoImage.ts:79` `catch {}` hides why a converter
failed (G7, accepted); `photoCrop.ts:59` fractional half (G8, accepted);
stale CEO block wording (noted, superseded by the DX and eng blocks). No
shared-code extraction beyond the `gridAndPlanks` move (two callers:
photoCheck, photoMeasure; implementation lines moved, ~0 net).

**3. Tests.**
```
CODE PATHS                                              USER FLOWS (an agent)
[+] photoImage                                          [+] crop → points → measure
  ├ sniff: JPEG/PNG/BMP/HEIC/other   [GAP→planned ★★★]   ├ [planned ★★★] minimal example runs (synthetic)
  ├ decode: absent/failed/deadline   [GAP→planned ★★★]   ├ [planned ★★] T switch on 84405 (Mac, manual)
  ├ loadUpright 1/6/8/3/square/turned [GAP→planned ★★★]  └ [planned ★★] Linux sandbox, timed (manual)
  ├ jpegSize SOF0-15, thumbnail      [GAP→planned ★★★]  [+] refusals
  └ writePng CRC/inflate             [GAP→planned ★★]     ├ [planned ★★★] every code, values, fix, JSON
[+] photoCrop: window, {crop,at}, collision, half        └ [planned ★★★] --help lists every code
[+] photoMeasure core: scale table ×4, offset/along,
    facing (dot, tie, diagonal), status, geometry,
    bounds, exit 0/1/2/3, all-refused
[+] photoCheck unchanged: photos:score 12/12 (Mac), straddlesCentre tests
[+] scoreboard core: pass, 5 px fail; overlay pixels; atomic write
COVERAGE: today 0/31 new paths; planned 31/31 (27 unit, 4 manual)
```
No LLM or prompt files (no evals). Tests made obsolete: none (the
`straddlesCentre` tests stay). Test plan artifact:
`~/.gstack/projects/raduuuuu-ChooChooCAD/radudiaconescu-measuring-tools-plan-eng-review-test-plan-20261109.md`.

**4. Performance.** One photo per run. 12 MP RGB is ~36 MB, plus a BMP
buffer the same size, plus one turned copy [estimated]; `findGridAuto` at
up to three scales is the slow path, timed per scale in the acceptance
(G15); converter worst case bounded by one 60 s deadline (G4). No caching
needed for a one-shot tool.

**NOT in scope (eng):** tool-proposed end points, `--allow-rms`, an
orientation override (pending writes to `docs/plan/generic-TODOS.md`, held
because that file has another session's uncommitted edits); a points-file
version field.

**What already exists (eng):** `gridAndPlanks`, `paperTooWarm`,
`AUTO_GRID_RMS_MAX_MM` (moved, reused); `segments`/`orientationOf` (reused
for `jpegSize`); `refineEnd` (reused); `straddlesCentre` (kept for
photoCheck); `scaleAndMeasure` (extended); `photoScoreboard` (pattern for
E3); `NO_CONVERTER` (split into three codes).

**Failure modes (eng):**
```
  CODEPATH         | FAILURE                         | TEST | HANDLED          | USER SEES
  decode           | converter hangs                 | Y    | deadline         | photo-unreadable, which, why
  decode           | crafted non-photo               | Y    | sniff            | photo-unreadable
  loadUpright      | converter turned it, square     | Y    | refuse           | orientation + fix
  {crop, at}       | crop of 84405b used for 84405   | Y    | exact stem       | points-invalid, field
  core             | point = toward / NaN map        | Y    | validate         | points-invalid / geometry
  facing           | curved end half turned to lens  | Y    | dot product      | faces-camera + fix
  overlay          | /tmp on another file system     | Y    | temp beside out  | overlay written
  84404 scoreboard | automatic reference refused     | Y    | reference given  | entry passes
```
0 critical gaps (every row tested, handled and visible).

**Parallelization:** sequential; the three PRs share `photoImage` and
`photoMeasure` and merge in turn (AGENTS.md: no stacked PRs).

### Eng Implementation Tasks
- [ ] **T8 (P1, human: ~1d / CC: ~40min)** — photoImage — sniff, decoder rework, one deadline, injectable spawn, `jpegSize`, `loadUpright`
  - Surfaced by: G4, G5, G7, E2 · Files: engine/tools/photoImage.ts, engine/tools/photoExif.ts, tests · Verify: `bun run test`; `photos:score` 12/12
- [ ] **T9 (P1, human: ~1d / CC: ~40min)** — photoMeasure — scale table, dot-product facing, geometry checks, End coordinates, shared module
  - Surfaced by: G2, G3, G4b, G5b, G6b · Files: engine/tools/photoMeasure.ts, photoEdges.ts, photoStraights.ts, photoCheck.ts, photo.ts, tests · Verify: `bun run test`
- [ ] **T10 (P2, human: ~2h / CC: ~10min)** — scoreboard/crop — 84404 with given reference, exact crop names, whole `half`, overlay temp beside target
  - Surfaced by: G1, G6, G8, G8b · Files: engine/tools/photoMeasureScoreboard.ts, photoCrop.ts · Verify: `bun run photos:measure-score` 4/4

### Eng Completion summary
- Step 0: Scope Challenge — scope accepted as-is (structure: original arrangement)
- Reality rows: 7/7 applicable rows emitted, 0 unverified premises
- Architecture Review: 3 issues found
- Code Quality Review: 3 issues found
- Test Review: diagram produced, 31 gaps identified (all planned)
- Performance Review: 2 issues found
- NOT in scope: written · What already exists: written
- TODOS.md updates: 3 items, pending writes (file has another session's edits)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review (UC1 and taste items wait for the gate)
- Outside voice: codex, completed
- Parallelization: 1 lane, 0 parallel / 3 sequential
- Lake Score: N/A (auto-decided)

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Approach A (the plan as written) | Mechanical | P1, P5 | covers all five spike findings with existing tools | B (crop only), C (semantic CLI) |
| 2 | CEO | Mode SELECTIVE EXPANSION | Mechanical | override | autoplan's CEO override | - |
| 3 | CEO | E1 `--json` added | Mechanical | P2 | blast radius, under a day; an agent is the main reader | defer |
| 4 | CEO | E2 `--overlay` added | Taste | P2 | lets Claude see its picks (the spike's C miss); new drawing code, 3-5 files | defer to TODOS |
| 5 | CEO | E3 measuring scoreboard added | Mechanical | P2, P1 | repeatable acceptance; follows `photos:score` | keep item 8 manual |
| 6 | CEO | 0H documents approved (A) | Mechanical | P6 | spec fixes applied; no open scope question | revise, pause |
| 7 | CEO | Rotated phone photos turned upright, not refused (6, 8; 3 and mirrored refused) | Mechanical | P1 | single-voice critical (native 1), flagged; portrait photos are the common case | refuse all rotated |
| 8 | CEO | `writePng` via node:zlib; converters read only; no `.bmp` fallbacks | Mechanical | P5, P3 | removes a converter dependency and two fallback names | writeBmp + converter |
| 9 | CEO | Linux chat-sandbox acceptance; Windows unsupported (WSL), said in the skill | Mechanical | P1 | both voices: off-macOS is the point of the plan | Mac only |
| 10 | CEO | Acceptance split: repeatability vs own readings (AGREE_MM), accuracy on the 216 mm straight (TOLERANCE_MM); scoreboard 4 entries, missing counted | Mechanical | P1 | both voices: 84405 vs figures from 84405 is circular | 0.5 mm vs library only |
| 11 | CEO | Measuring conditions stated in the skill and the facing refusal; multi-piece proof left to the brief's pilot | Mechanical | P5 | Codex 2, native 8 | silent assumption |
| 12 | CEO | Per-figure status checked/provisional with reasons; exit code unchanged | Mechanical | P5 | Codex 5: exit 0 hid hand readings | new exit code |
| 13 | CEO | Crop-to-points workflow in the skill; tool-proposed end points deferred | Mechanical | P3 | native 5; outside this plan's radius | build now |
| 14 | CEO | Three PRs in turn, none stacked | Taste | P6 | native 6; Codex silent; owner's no-stacking rule kept | one PR |
| 15 | CEO | Photos vs direct measuring, pilot first | User Challenge | — | both voices; the owner decides at the gate | auto-decide |
| 16 | CEO | Owner's photos as shared fixtures | Mechanical | SEC1 | photos are never shared | controlled access |
| 17 | CEO | Malformed or figure-less points file exits 2 with the reason | Mechanical | P1 | Section 1/4 empty and error paths | stack trace / silent exit 0 |
| 18 | CEO | Unreadable photo exits 1 with `NO_CONVERTER` | Mechanical | P1 | Section 1/2 error path | uncaught Error |
| 19 | CEO | `photoMeasure` core is pure, returns a result both renderers use | Mechanical | P5 | Section 5 branching | logic in the CLI |
| 20 | CEO | Turning lives in `loadUpright`; `loadPhoto` and `photoCheck` unchanged | Mechanical | P1, P5 | Section 1: photoCheck would start refusing orientation 3 | turn in loadPhoto |
| 21 | DX | D1 `--help` on photoMeasure and photoCrop (usage, flags, exits, format, example), exit 0 | Mechanical | P5 | agents discover by `--help`; none today | source header only |
| 22 | DX | D2 example points file in the skill; crop prints its mapping back to the photo | Mechanical | P1 | the points format lived in a script header; crop maths by hand | leave to the agent |
| 23 | DX | D3 stable refusal/usage codes, fix last, stderr in text mode, `{code, reason, fix}` in JSON | Mechanical | P1 | agent-ready error contract; refusals printed on stdout today | free-text reasons |
| 24 | DX | D4 photo-missing / no-converter / photo-unreadable, converter stderr named | Mechanical | P1 | both voices: "install a converter" for a missing file is an unsafe fix | one message |
| 25 | DX | D5 converters time out at 60 s | Mechanical | P1 | single-voice CAP4 (native), flagged | no timeout |
| 26 | DX | D6 `{crop, at}` points mapped by the tool | Taste | P5 | removes hand arithmetic (native High; Codex timing); a new point form in POLISH | `photoCrop --map` |
| 27 | DX | D7 `--photo`, `--auto` kept as alias; `needs-photo` | Mechanical | P5 | `--auto` with a given grid isn't automatic | keep `--auto` only |
| 28 | DX | D8 facing fix specific to line end vs point | Mechanical | P1 | Codex: the old fix can't succeed | one fix text |
| 29 | DX | D9 refusals name their values; recovery class | Mechanical | P1 | CAP6 context | free text |
| 30 | DX | D10 points file validated whole (`points-invalid`); `--json` found first | Mechanical | P1 | Codex High: casts only | trust the shape |
| 31 | DX | D11 top-level `internal` with trace file | Mechanical | P1 | CAP6 trace | raw stack |
| 32 | DX | D12 atomic overlay; refused-run JSON carries photo/grid/overlay | Mechanical | P1 | both voices | overlay unnamed |
| 33 | DX | D13 `--overlay` folder or any `*.overlay.png`; error shows accepted path | Mechanical | P5 | both voices | exact name only |
| 34 | DX | D14 minimal + JSON examples; sandbox run timed to first figure | Mechanical | P1 | both voices: target unmeasured | numbers only |
| 35 | DX | D15 PR (a) switches `photoMeasure --auto` to `loadUpright` too | Mechanical | P1 | Codex High: mixed coordinates between PRs | wait for (b) |
| 36 | DX | D16 `--allow-rms`, orientation override deferred | Mechanical | P3 | a retake is the safe default; outside POLISH | build now |
| 37 | Eng | Structure: original arrangement (three PRs), scope as-is | Mechanical | P2 | no smaller arrangement keeps the features | cut features |
| 38 | Eng | E1 one rms rule for seeded and found grids | Mechanical | P5 | seeded grid unchecked today | two rules |
| 39 | Eng | E2 `jpegSize`; square 6/8 refused | Mechanical | P1 | decoded size can't tell a square | guess |
| 40 | Eng | E3 crop of another photo is points-invalid | Mechanical | P1 | silent wrong mapping | trust the name |
| 41 | Eng | E5 one `CODES` constant, skill table tested | Mechanical | P4 | hand-synced list | two copies |
| 42 | Eng | E6 loader choice in photoImage's header | Mechanical | P5 | two ways to load | none |
| 43 | Eng | E7 under 30 s budget on the --photo path, timed | Mechanical | P1 | hot path with no budget | none |
| 44 | Eng | G2 facing by dot product on both axes; straddlesCentre kept for photoCheck | Mechanical | P1 | Codex's diagonal case passes a one-axis rule | build on straddlesCentre |
| 45 | Eng | G3 rms limit and paperTooWarm move with gridAndPlanks | Mechanical | P4 | photoMeasure must not import a CLI | import photoCheck |
| 46 | Eng | G4b End carries seed and at; found reference keeps evidence | Mechanical | P5 | renderers need coordinates | recompute |
| 47 | Eng | G4/G5/G7 decoder: sniff, coder prefix, one 60 s deadline, ENOENT vs failed, injectable | Mechanical | P1 | both voices; untrusted input | per-converter timeouts |
| 48 | Eng | G5b geometry checked after mapping; `geometry` refusal | Mechanical | P1 | NaN readings | trust inputs |
| 49 | Eng | G6 exact crop stem, resolved from points folder, crop-local bounds; G8 whole half | Mechanical | P1 | both voices | prefix match |
| 50 | Eng | G6b scale case table, each cell tested | Mechanical | P5 | seeded path unspecified | implicit |
| 51 | Eng | G1 84404 scoreboard entry with given reference | Mechanical | P1 | conflicts with photos:score | auto reference |
| 52 | Eng | G1b orientation claim corrected; 35/35 at 1 measured; identity test | Mechanical | P1 | both voices | migration code |
| 53 | Eng | G8b overlay temp beside target; G11 all-refused exit 3; G13 no trace in JSON | Mechanical | P5 | native | — |
