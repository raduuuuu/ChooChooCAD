# Changelog

What changed in each version of ChooChooCAD, newest first. Every merge to
`main` is deployed to [woodentrain.world](https://woodentrain.world) and gets
its own version; the app shows the one it is running. Which part of the
number goes up is in [AGENTS.md](AGENTS.md).

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
