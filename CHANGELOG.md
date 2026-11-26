# Changelog

What changed in each version of ChooChooCAD, newest first. Every merge to
`main` is deployed to [woodentrain.world](https://woodentrain.world) and gets
its own version; the app shows the one it is running. Which part of the
number goes up is in [AGENTS.md](AGENTS.md).

## 1.7.3 (2026-11-26)

Nothing a person using the app will see. The guide for people who want to
help now has a short section for anyone designing a piece to print: it
points to a separate free project with the rules for a model that prints
cleanly, the ones the printed stations were designed by.

## 1.7.2 (2026-11-26)

Nothing a person using the app will see. The list of open work says what
is true today, and what comes next:

- The visit counter was read for the first time.
- Other track tools were tried first hand. One already makes layouts from a
  count of pieces, so that idea stays on the list of things not built yet.
- The app was checked on a real phone by its owner.
- The counts of unmeasured pieces in the list of open work were out of
  date and are corrected: 59 of 73.

## 1.7.1 (2026-11-24)

Nothing a person using the app will see. Three notes in the code still
described the layout pages as they were a week ago (a file that has since
moved, the size of the list of layouts, and what the page-writing script
writes); the deep checkup found them and they now say what is true.

## 1.7.0 (2026-11-24)

Eight more [layouts that close](https://woodentrain.world/layouts/), each
with its own page, picture and list of pieces: a figure eight, three loops
in a row, a passing loop, an oval with a siding, two stations, a double
circle, a double oval, and two bridges with a second loop running under
them. Each opens in the planner from its page.

- These use switches, crossings, bridges and stations, whose sizes nobody
  has measured yet. Each page says so, in the planner's own words, and marks
  every such piece in its list.
- The pictures now show what the planner shows: a bridge casts a shadow and
  cuts a gap in the track under it, a station is drawn as a building, and a
  buffer stop has its beam.
- A layout gets a page only if it closes exactly with nothing left loose:
  no free end, no open run, and no raised track whose supports were not
  checked.
- Pieces are counted by what they are (curves, switches, crossings, bridges,
  stations), and the Circle's page now reads "an 8-piece", not "a 8-piece".

## 1.6.0 (2026-11-24)

A new page: [Wooden train track
dimensions](https://woodentrain.world/sizes/). It lists the size of every
piece the planner knows, in millimetres: the length of each straight, the
radius and angle of each curve, and each road through a switch or a crossing.
Every figure is the one the check itself uses, and each says whether it was
measured against a real piece, taken from a published reference, or is
unverified.

- The tables come first, shortest piece first, with a list of sections to
  jump to. What a length is measured between is said once per kind: from one
  end face of the wood to the other, the peg not counted.
- On a phone each piece is a block of its own at full-size type, not a
  squeezed table.
- A piece drawn from a printable design is credited once, under "Printable
  models", with a link to where it can be printed.
- The page shows the date its sizes last changed, and prints cleanly.

On every page a search engine reads: the name now carries the planner's
mark, a link you have opened is drawn lighter, and on a touch screen every
link has a full-size tap area. The list of layouts, the page on why a loop
will not close and the home page link to the new page. DESIGN.md gains
rule 15, which records these choices for the next such page.

## 1.5.0 (2026-11-22)

A new page: [Why won't my wooden train track loop
close?](https://woodentrain.world/why-a-loop-will-not-close/) It shows the
same oval three times, with one straight changed each time: one that closes
exactly, one that closes only by bending the joints, and one that asks more
of the joints than anyone has tested. Each drawing and each verdict comes
from the planner's own check, with what causes it and what to change. It
also lists the usual causes, and says what is known about mixing track from
different makes.

The pages of ready layouts and their list no longer repeat three paragraphs
about the app; each has one line and a link to the new page.

## 1.4.0 (2026-11-22)

Each ready layout's page now has a picture of its own, and says more about
the layout. The picture is a file a search engine can list, and a link to a
layout pasted into a chat shows that layout, with its name, piece count and
size, where every page used to show the same picture.

Each page also says how big the layout is on the floor in centimetres
("66 × 45 cm") and counts its pieces by kind ("8 curves and 2 straight
pieces"). The size comes from the same placement the checker uses, plank
edges included, rounded up. To check it against your own table, open the
layout in the planner.

The list of layouts loads faster: it is less than half the size it was.

## 1.3.2 (2026-11-22)

Nothing changes in the app. The site now carries the small file a search
engine's console asks for to prove whose site it is, so its owner can see
which pages are indexed and what people searched for.

## 1.3.1 (2026-11-22)

The pages of ready layouts are easier for a search engine to place. Each
one's title and heading now say how many pieces it takes ("a 10-piece
layout"), the list shows the layouts fewest pieces first, and the sitemap
gives each page the date its words last changed. The home page, the list and
each layout page describe themselves to search engines in the standard way.

These pages now count their visits, as the editor already did, with the same
script and nothing new sent; the README's "What the site sends" says so.

Nothing changes in the editor. Behind it, an address the site has published
can no longer disappear without a check failing, and every address in the
sitemap is checked to exist in the built site.

## 1.3.0 (2026-11-21)

Two new pieces: the Gstaad station and the Lausanne station, each a long
straight (216 mm) with a station on a base beside it. Both are printable
designs, and each piece links to its model page. A second track cannot lie
on the base, and raised track cannot cross the building. Lausanne has a
socket at both ends, so the app asks for an adapter where it joins. Their
sizes are read off the design's files, not measured on a printed one, so
both show "Unverified size".

## 1.2.5 (2026-11-17)

The steps for drawing a sent piece into the library are current: they now
raise the version and add the changelog entry, a ruler reading from another
owner is typed and never needs a photo, and the `piece: needs info` label no
longer says its issue closes after 30 days.

## 1.2.4 (2026-11-17)

The contributing guide matches the project again: a first piece also needs a
long straight (216 mm), the second issue form is named, a reviewer comments
before starting, and the checks a pull request runs are all listed. It no
longer says an unanswered question closes its issue after 30 days: nothing
did that.

## 1.2.3 (2026-11-16)

On a wide screen, the column of pieces now reaches the foot of the screen in
every state. With a note under the verdict and a "short by" line both
showing, it stopped 48px short, leaving an empty strip beside "Run a train".

## 1.2.2 (2026-11-16)

The README now says what the site sends and what it never does: what stays
in your browser, what the visit counter is given for a visit and for each of
the ten counted actions, and how to leave your own visits out. The counter
itself is unchanged.

## 1.2.1 (2026-11-16)

From a design review of My layouts on the live site.

- **A panel you open now comes into view.** On a laptop-sized screen,
  pressing My layouts opened the panel almost wholly off screen (4px of it
  showed at 1280 by 800), so the press seemed to do nothing. My layouts, Your
  box, Your table and Add a part are now scrolled into view when they open,
  and the keyboard's place moves to the panel instead of being lost.
- The put-aside row reads like every other row: its name, then its piece
  count in the small number face, where the count used to sit in heavy type
  inside the name.
- Every row's buttons sit at the same edge, on a phone too.

## 1.2.0 (2026-11-16)

**My layouts.** Keep several layouts in this browser, each under a name, and
open any of them again.

- **Keep this layout** saves a copy of what is on screen. A saved layout
  changes only when you press **Update**; after changing one you opened, you
  can update it or keep the change as a new layout.
- **Open** brings a saved layout back. The layout on screen is put aside
  first, so nothing is lost; if another layout is already put aside and kept
  nowhere else, the app asks before replacing it.
- **Rename** and **Remove** on each row. A removed layout can be put back
  until you close the panel.
- The layout the app has put aside for you shows as the first row.
- It is a button on a wide screen and a row in More on a phone. Nothing
  leaves your browser, and Your box and Your table stay shared by every
  layout.
- If the app ever crashes, "Clear saved data" now keeps your saved layouts;
  a second button deletes everything.

Fixed: on a wide screen "Run a train" sat over the plan when no notice was
showing (since 1.0.3). It is back under the verdict.

## 1.1.2 (2026-11-16)

- **Opening a shared layout in the editor is safer.** When it asks whether
  to replace a layout you put aside earlier, your yes now applies only to
  the layouts it showed: if another tab changed one meanwhile, it asks
  again. And if storage fills part-way and a layout ends up saved nowhere,
  it is offered as a file to download, where before the screen said nothing
  had changed.
- Groundwork for keeping several named layouts: the code that stores them,
  with nothing to see yet.

## 1.1.1 (2026-11-16)

- A plan for keeping several named layouts in the browser
  (`docs/plan/2026-11-16-saved-layouts.md`). Nothing in the app changed.

## 1.1.0 (2026-11-16)

Two new buttons in Your box.

- **These are mine.** One tap raises your counts to the pieces of the layout
  on screen, adapters included, so you do not count track by hand. It only
  ever raises a count, says how many it raised, and "Put it back" undoes it.
- **Copy what is short.** When a layout needs more than your box holds, this
  copies the list (pieces and adapters, one a line) to paste into a note or
  a search. If the browser will not copy, the list is shown to copy by hand.

## 1.0.4 (2026-11-16)

- **If the app crashes,** its report now shows everything the app keeps, and
  "Clear saved data" removes everything it keeps. Six things were missing
  from both: your table, the 2D or 3D choice, where a build was left (yours
  and a shared link's), the layout you put aside and the selection hint. A
  crash one of them caused could not be reported, and clearing did not
  recover from it. The button that confirms the clearing now names all of
  what goes, the layout put aside included.
- For the repository: every GitHub Action is pinned to an exact commit, and
  six pieces of code nothing used are removed.

## 1.0.3 (2026-11-16)

Fixes only.

- **Add a part** reads a decimal comma: `12,5` is 12.5. Anything it cannot
  read as a size gets a sentence under the field; before, the only sign was
  a greyed button.
- **Your box** no longer turns a slip of the finger into "I own none". A
  count that is not a number stays in the field with "needs a number" on a
  line of its own, and the count you had is kept. The field is a finger's
  size on every screen.
- **On a wide screen** a notice (a layout that could not be saved, a change
  in another tab) now sits over the plan, where it is seen. It used to fall
  to the foot of the screen under the pieces. The "Short by" line sits under
  the verdict.
- **The editor has a first heading** for screen readers: the identity line.
- **A saved layout, a link or a file with a malformed piece id** is refused
  as unreadable and kept as a copy to download. No layout the app itself
  wrote is affected.

## 1.0.2 (2026-11-16)

- The backlog (`docs/plan/generic-TODOS.md`) lists only open work again.
  Finished, superseded and shelved entries moved word for word to the
  archive; nothing was cut.
- A plan for what comes next (`docs/plan/2026-11-16-whats-next.md`):
  hardening, the checkup's leftovers, a buy list with "These are mine", and
  several saved layouts.
- README's licence section now says the maintainer considers the use of the
  published piece sizes to raise no issue. Nothing in the app changed.

## 1.0.1 (2026-11-15)

- A rule for whoever plans work on the app: every plan names the version it
  will take the app to. Nothing in the app itself changed.

## 1.0.0 (2026-11-15)

The first numbered version: the app as it stood, plus the number itself.

- The app shows its version, as a link to this list: with the ready layouts
  on a wide screen, and in More on a phone.
- Every pull request raises the version and says what changed here; the
  checks refuse one that does not.
- Each deploy is tagged and published as a release on GitHub.
- A crash report now carries the version as well as the commit.

What was already there: the layout check (does the loop close, exactly or
with the joints' give), the 2D plan and the 3D view, raised track and
bridges, a train that runs the layout, sharing by link and by file, your box
and your table, ready layouts, and the editor on a phone.
