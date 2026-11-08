# Contributing to ChooChooCAD

ChooChooCAD checks whether a wooden railway layout will actually work. It can
only check pieces it knows, and it only knows a piece once someone has
photographed or measured a real one. There are three ways to help:

1. **[Send photos of a piece](#send-photos-of-a-piece)** the app is missing. No
   tools needed beyond a phone.
2. **[Confirm sizes with a ruler](#confirm-sizes-with-a-ruler)** for a piece
   someone else sent.
3. **[Draw a piece](#draw-a-piece)** from the photos, for people comfortable
   with code.

Agents and LLMs: read [AGENTS.md](AGENTS.md) as well; it holds the rules every
change to this project follows.

## Send photos of a piece

Open a [new piece issue](https://github.com/raduuuuu/ChooChooCAD/issues/new?template=new-piece.yml).
You need a free GitHub account.

**Photos you post on GitHub are public, and GitHub keeps them online even if
the issue is deleted later.** Before posting, remove where each photo was taken
(below), and keep everything but the pieces and the paper out of the frame: no
people, faces, house numbers, letters or screens.

What to have ready, and how to take the photos, is in the
[photo guide](https://woodentrain.world/photo-guide.html): the piece, one
medium straight (144 mm) as the ruler, white, blue or pink millimetre or graph paper, the top
view twice and the underside. Side or end photos only if someone asks. If you don't have a medium or a long straight, send what you have;
someone will ask for what's missing.

### Remove where a photo was taken

Phones save the place a photo was taken inside the photo file (its "location"
or GPS data). GitHub does not remove it. Do one of these before posting:

- **iPhone:** in Photos, open the photo, tap Share, then **Options** at the
  top, and turn **Location** off before sharing or saving. To stop it for
  future photos: Settings, Privacy & Security, Location Services, Camera,
  **Never**.
- **Android:** in the Camera app's settings, turn off **Location tags** (some
  phones call it "Save location") before shooting. In Google Photos, Settings,
  turn on **Remove geo location** for photos you share.
- **Mac:** open the photo in Preview, Tools, Show Inspector, the **(i)**
  tab's GPS section, **Remove Location Info**. Or in Photos: Image, Location,
  **Hide Location** before exporting.
- **Windows:** right-click the photo, Properties, Details, **Remove Properties
  and Personal Information**, then "Create a copy with all possible properties
  removed", and post the copy.
- **Linux:** `exiftool -gps:all= photo.jpg` (or `mat2 photo.jpg`).

### What happens next

Each piece issue carries one label:

- `piece: waiting`: photos received; nobody is drawing it yet.
- `piece: drawing`: someone has started. You'll get a comment saying so.
- `piece: needs info`: a question is waiting for you, usually a figure to read
  with a ruler. With no reply in 30 days the issue closes; any reply reopens it.
- `piece: unsupported`: the app can't hold this piece's shape yet (its angles
  or ends don't fit the steps the layout check uses). The reply says why and
  names the closest piece the app already has.

Expect a few weeks: every piece is checked by hand before it joins the
library. When it does, you'll get a comment with a link to a layout that uses
it, and you're thanked by name in the pull request.

## Confirm sizes with a ruler

A piece drawn from photos shows "Unverified size" until people who own one
read its sizes with a ruler. On the piece's issue you'll find a drawing of
which figures to read. Reply with one line per figure, in this format:

```
E1: 162 mm
E2: 90 mm
```

Add a photo of the ruler against the piece, and the markings on its underside
(versions of the same piece can differ). When two people who own the same
version agree, and their readings match the piece as drawn, it shows "Sizes
from two readers".

## Draw a piece

For builders: you turn a piece issue's photos into a drawn piece and open a
pull request. You need Claude Code, [bun](https://bun.sh) and gstack's browser
for comparing the 3D render with each photo. Read [AGENTS.md](AGENTS.md)
first.

1. Pick an issue labelled `piece: waiting` from the pinned "Pieces wanted and
   in progress" issue.
2. In Claude Code, in its default permission mode (you approve each step), run
   `/draw-piece <issue number>`. Other agents can follow
   [the same steps](.claude/skills/draw-piece/SKILL.md).
3. It downloads the photos into the git-ignored `photos/` folder, checks them
   with `bun run photos`, measures, asks the sender for anything missing,
   draws the piece, compares its 3D render with every photo and opens a pull
   request from your fork. Builders can't set labels, so it comments on the
   issue instead.

## For the maintainer: removing a photo

If a posted photo shows a person, an address, location data or anything
private:

1. Edit the issue and delete the image from its text, then lock the issue if
   needed.
2. Ask the person to post a cleaned photo.
3. The file stays online at its attachment link after step 1. Ask GitHub
   Support to remove it (github.com/contact, "remove sensitive data from an
   issue attachment"), giving the attachment URL.

## Code changes

Pull requests are welcome. Run `bun run test` and `bun run typecheck` first;
[CLAUDE.md](CLAUDE.md) explains the test rules (every test records the change
that makes it fail) and [DESIGN.md](DESIGN.md) the design rules.
