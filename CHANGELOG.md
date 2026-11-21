# Changelog

What changed in each version of ChooChooCAD, newest first. Every merge to
`main` is deployed to [woodentrain.world](https://woodentrain.world) and gets
its own version; the app shows the one it is running. Which part of the
number goes up is in [AGENTS.md](AGENTS.md).

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
