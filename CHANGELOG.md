# Changelog

What changed in each version of ChooChooCAD, newest first. Every merge to
`main` is deployed to [woodentrain.world](https://woodentrain.world) and gets
its own version; the app shows the one it is running. Which part of the
number goes up is in [AGENTS.md](AGENTS.md).

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
