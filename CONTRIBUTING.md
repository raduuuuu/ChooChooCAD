# Contributing to ChooChooCAD

ChooChooCAD checks whether a wooden railway layout will actually work. It can
only check pieces it knows, and it only knows a piece once someone has
photographed or measured a real one. There are three ways to help:

1. **[Send a piece](#send-a-piece)** the app is missing: your own Claude
   measures it from your photos and draws it, and you post the result. Your
   photos never go on GitHub.
2. **[Confirm sizes with a ruler](#confirm-sizes-with-a-ruler)** for a piece
   someone else sent.
3. **[Review a drawn piece](#review-a-drawn-piece)**, for people comfortable
   with code.

Agents and LLMs: read [AGENTS.md](AGENTS.md) as well; it holds the rules every
change to this project follows.

## Send a piece

Download [the contributor brief](docs/brief/draft.md), upload it into a new
chat on claude.ai with **code execution** turned on (in Claude's settings),
and say "follow this brief". Its first section says what to have ready: the
piece, one medium straight (144 mm), white, blue or pink millimetre or graph
paper, and about an hour. To post the result you need a free GitHub account.

- **Take the photos with your phone's own camera app**, at its normal lens
  (1x), then attach them in the chat. Your Claude asks which focal length the
  phone recorded (in the photo's details): that sets the scale.
- **Your photos stay in the chat.** The issue you post carries what was read
  from them and the drawing, never a photo. Don't attach a photo to an issue
  or a comment: GitHub keeps it public even after the issue is deleted.
- Your Claude removes where each photo was taken from its own copies before
  measuring. To keep it out of your photos altogether:
  - **iPhone:** Settings, Privacy & Security, Location Services, Camera,
    **Never**.
  - **Android:** in the Camera app's settings, turn off **Location tags** (some
    phones call it "Save location").

### What happens next

Each piece issue carries one label:

- `piece: waiting`: a drawn piece sent; nobody is reviewing it yet.
- `piece: drawing`: someone is reviewing it and drawing it into the library.
  You'll get a comment saying so.
- `piece: needs info`: a question is waiting for you, usually whether a render
  matches your piece, or a figure to read with a ruler. With no reply in 30
  days the issue closes; any reply reopens it.
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

Add the markings on its underside (versions of the same piece can differ),
typed, not photographed. When two people who own the same version agree, and
their readings match the piece as drawn, it shows "Sizes from two readers".

## Review a drawn piece

For builders: a piece issue holds a drawing made by the sender's Claude, with
its figures, points files and tool outputs. You check it and draw it into the
library. You need Claude Code, [bun](https://bun.sh) and a browser that draws
3D (for the render). Read [AGENTS.md](AGENTS.md) first.

1. Pick an issue labelled `piece: waiting` from the pinned "Pieces wanted and
   in progress" issue.
2. In Claude Code, in its default permission mode (you approve each step), run
   `/draw-piece <issue number>`. Other agents can follow
   [the same steps](.claude/skills/draw-piece/SKILL.md).
3. It checks the figures against the tool outputs and the diff against the
   tests, draws the piece in, renders it, asks the sender whether the render
   matches their piece, and opens a pull request from your fork. Builders
   can't set labels, so it comments on the issue instead.

## For the maintainer: removing a photo

No photo belongs on GitHub. If one is posted anyway (it may show a person, an
address, location data or anything private):

1. Edit the issue and delete the image from its text, then lock the issue if
   needed.
2. Tell the person their photos stay in their own chat, and that the issue
   needs only what their Claude read from them.
3. The file stays online at its attachment link after step 1. Ask GitHub
   Support to remove it (github.com/contact, "remove sensitive data from an
   issue attachment"), giving the attachment URL.

## Code changes

Pull requests are welcome. Run `bun run test` and `bun run typecheck` first;
[CLAUDE.md](CLAUDE.md) explains the test rules (every test records the change
that makes it fail) and [DESIGN.md](DESIGN.md) the design rules.
