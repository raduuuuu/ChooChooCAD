# Plan: several saved layouts ("My layouts")

Task T5 of `docs/plan/2026-11-16-whats-next.md`: the design and engineering
pass for addition A2, accepted by the owner on 2026-11-16 ("name, keep and
reopen several layouts in the browser; no accounts, no sync, no change to the
layout format"). No code is written by this plan. On `main` at `0a39676`,
version 1.1.0.

**Versions (AGENTS.md).** This plan is a documents pull request: 1.1.0 to
**1.1.1**. The feature then lands as two pull requests, neither stacked:

| Pull request | What | Version |
|---|---|---|
| S1 | The store and its tests, and `openInEditor` made safe to reuse (checked roll-back, a confirmation bound to what was shown). No reader: nothing a visitor can reach, and nothing new in the first load beyond those fixes. | 1.1.1 to 1.1.2 (patch) |
| S2 | The panel on the wide editor and the phone, the kept-keys function and the crash screen's two buttons, switched on together, since the crash screen only matters once a saved layout can exist. | 1.1.2 to 1.2.0 (minor) |

Both run the first-load budget check; S1 too, because it touches code on that
path (outside finding O11).

If `main` moves in between, the part that goes up stays and the number
follows.

## What the owner decided (2026-11-16)

| # | Question | Answer |
|---|---|---|
| D1 | What happens to a saved layout when its reopened copy is edited | **Saved copies.** A saved layout stays exactly as kept. After editing a reopened one, Keep offers "Update <name>" or "Keep as new". |
| D2 | The existing "put aside" layout | **Shown in the list.** The single slot stays as it works today and appears as the first row, with Open and Keep. |
| D3 | Where the list lives | **A panel, like Your box:** a button beside Save to a file on the wide editor, a row in More on a phone; loaded only when opened. |
| D4 | The crash screen's "Clear saved data" | **Saved layouts are kept,** and a second button, "Delete my saved layouts too", removes them. The report carries them either way. (As planned below: that second button removes everything, the saved layouts included, or the crash could stay; O10.) |
| D5 | Removing and renaming | **Rename and Remove on each row.** Remove shows "Put it back" until the panel closes or another row is removed. |
| D6 | Your box and Your table | **The browser's, as today.** A saved layout holds the track and nothing else. |
| D7 | How many | **No fixed limit.** When one cannot be kept: say so, keep nothing half-saved, suggest removing one or saving to a file. |

## Choices made in this plan that the owner has not been asked

Each is small and each can be changed in review; none is settled by silence.

| # | Choice | Why |
|---|---|---|
| C1 | A new layout's name is prefilled "Layout 1", "Layout 2", the first number not in use, and can be typed over. | No name is ever required to be invented, and none is empty. |
| C2 | A name is 1 to 40 characters after trimming. Two layouts may share a name. | Rows also show the pieces and the day kept, which tell them apart; refusing a duplicate is one more message for little gain. |
| C3 | Rows are newest first. A row shows the name, the number of pieces and the day it was kept. | What a person needs to recognise their layout. No verdict and no drawing in the first version: both mean reading inside every layout on opening the panel. |
| C4 | Opening a saved layout replaces the working one. The layout ON SCREEN goes to the put-aside slot first, and when that slot already holds a different layout the person is asked before it is replaced, as when a shared link is opened in the editor. (Not as a ready layout does: that one neither asks nor waits, and leans on Undo. Opening from the list ends the undo history, so it asks.) | The one mechanism that asks, already built for links, made safe to reuse in S1. |
| C5 | "Keep this layout" is offered for a layout of one's own with at least one piece. Not on the first-visit example until it is edited, and never on a shared link, which stays read-only (DESIGN.md rule 13). | An example is not the person's; a link is somebody else's. |
| C6 | Nothing is sent to the usage counter. | The ten action names are a privacy promise; the review's default was none. |
| C7 | The words, all provisional: "My layouts", "Keep this layout", "Update <name>", "Keep as new", "Open", "Rename", "Remove", "Put it back", "Put aside, 12 pieces", "Kept." | They follow Your box and the put-aside notice. |

## The design

```
  WIDE EDITOR                               PHONE
  palette column                            More
   ...                                       This layout
   [Save to a file] [Open a layout file]      ...
   [My layouts]  ◀── new                      My layouts  ◀── new row
   [Your box] [Your table] [Add a part]
        │                                          │
        ▼  a panel across the editor               ▼  a full-screen panel: its name
           (as Your box)                              and Done in a row that does
                                                      not scroll (rule 14)
  ┌────────────────────────────────────────────────────────────┐
  │ My layouts                                           Done  │
  │                                                            │
  │ [ Layout 3            ]  [Keep this layout]                │   the working layout
  │   or, when it was opened from the list and then changed:   │
  │ [Update "Rug loop"]  [Keep as new]                         │
  │ what the last press did, in words            (role=status) │
  │                                                            │
  │ Put aside, 12 pieces                       [Open] [Keep]   │   D2: only when the slot holds one
  │ Rug loop        24 pieces   kept 14 Nov  [Open][Rename][Remove]
  │ Layout 2        10 pieces   kept 12 Nov  [Open][Rename][Remove]
  │ A layout that cannot be read, kept as saved  [Save to a file][Remove]
  └────────────────────────────────────────────────────────────┘
```

**Seen first:** the one action, Keep this layout, with its name. **Second:**
what it did. **Third:** the list.

| State | What the panel shows |
|---|---|
| No saved layouts, no put-aside | One sentence saying what the list is for: "Keep a layout here to come back to it. It stays in this browser." Keep is offered if there is a layout to keep. |
| Empty floor | No Keep control; the sentence "Nothing on the floor to keep yet." |
| The working layout is byte for byte a saved one | Keep is replaced by "This is <name>, as kept." Nothing to do. |
| Opened from the list, then changed | "Update <name>" and "Keep as new" (D1). |
| Keep worked | "Kept." in the status line; the row appears first. |
| Keep failed (the store is full) | The status line says so in full: "Couldn't keep this layout: the browser's storage is full. Remove a saved layout, or save this one to a file." Nothing is added. (D7) |
| A row removed | The row goes; the status line says "Removed <name>." with Put it back. Closing the panel or removing another row ends the offer. (D5) |
| A stored entry that cannot be read | Its own row, named as such, with Save to a file and Remove; never hidden, never a reason to hide the others. |
| A saved layout that uses a piece this browser no longer has (an added part since removed, or cleared by the crash screen) | The row is drawn as usual. Open is refused in the loader's own words ("uses a piece this version doesn't have"), nothing changes, and Save to a file is offered. |
| The tab is stale ("changed in another tab") or its saves are blocked | Keep still works: it keeps what is on screen. Open is refused with the notice's own sentence, because the layout on screen may not be the saved one and reloading would lose it. |
| A shared link on screen | The panel is not reachable: a link has no editor chrome. |
| The first-visit example | The list opens and layouts can be opened; Keep is absent until the example is edited (C5). |

**DESIGN.md.** No colour (rule 1): a failed Keep is a sentence, as a failed
save is. No direction words (7). No motion (8). Every target 44px on a touch
screen, and the name field 44px on every screen (10). On a phone it is a
panel like the others (14), and a failed Keep is never hidden. A shared link
stays read-only (13).

**Open for the design review on the live panel (after S2):** whether rows
need a small drawing to be recognised; whether "kept 14 Nov" should be "2
days ago"; how fifty rows scroll on a phone.

## The engineering

### Storage

```
  generic.graph.v1            the working layout          unchanged: still the truth
  generic.graph.v1.previous   the put-aside layout        unchanged
  generic.layouts.v1.<id>     ONE KEY PER SAVED LAYOUT    new
        value: { "name": "...", "keptAt": "2026-11-16T10:00:00.000Z",
                 "pieces": 24, "layout": "<the layout's stored bytes, as a string>" }
```

- **No index, on purpose.** The list is every key with the prefix, read when
  the panel opens. Two tabs that each keep a layout write two different
  keys, so neither can overwrite the other: the lost write the outside
  review found (O2) has no shared record to happen in. `<id>` is random
  (`crypto.randomUUID`), never a counter two tabs could both pick.
- **The layout is stored as the same bytes the working slot holds,** inside
  a string, never re-encoded. Opening one hands those bytes to the loader
  that already validates the working layout (`checkStored`, including the id
  bound of 1.0.3). No second validator, and no change to the layout format.
- **`name`, `keptAt` and `pieces` sit beside the bytes** so the list is drawn
  without reading inside any layout. `pieces` is a label, not trusted for
  anything: the loader counts for itself on opening.
- **The whole entry is validated, alone** (O6). `name` a string of 1 to 40
  characters once trimmed, `keptAt` a date that parses, `pieces` a whole
  number from zero, `layout` a string. Anything else is the "cannot be read"
  row: it never throws out of the list, never sorts wrongly, and never hides
  another entry. The inner layout is NOT checked when listing.
- **Keep takes the layout on screen,** serialized as the save effect would
  (`storedGraphOf`), never the working key's bytes (O1): that key is behind
  whenever saving is blocked or the tab is stale.
- **Every change to an existing entry re-reads its key first, in the same
  step as the write** (O4). Rename writes the name onto the bytes that are in
  storage NOW, not the ones the panel drew, so it cannot put an older layout
  back over another tab's Update. Update and Remove do the same. What is
  left is the gap between one tab's read and its own write, which the browser
  does not let a page close; the tests cover the re-read, and the pull
  request says the gap exists.
- **Failure is said per operation, and nothing recoverable is dropped** (O9):

  | Operation | When its write fails |
  |---|---|
  | Keep, Keep as new | no key is left behind; the working layout is untouched; the full-store sentence |
  | Update, Rename | the entry is put back as it was and read back; if even that fails, its bytes are offered as a file to download, as `restorePrevious` does for a stranded layout |
  | Remove | the row stays, with a sentence |
  | Put it back | the bytes stay in the panel's memory and are offered as a file; the sentence says the layout is not back in the list |

- **Which entry the working layout was opened from** is kept for the tab's
  session (`sessionStorage`, one id), so it survives the reload that opening
  causes and is gone on a new visit (O7). "Update <name>" is offered while
  that entry still exists and the layout on screen differs from its bytes.
  A session value is not a kept key: the crash screen's lists do not name it.

### Opening a saved layout

`openInEditor(bytes)` in `app/src/putAside.ts` does most of this for a shared
link: it writes the working slot, puts the old layout aside, and asks before
replacing a different put-aside layout. Three things in it are not good
enough to reuse as it stands, and S1 fixes them for links too:

- **Its roll-back is unchecked** (O2, `putAside.ts:73`). When a write fails it
  writes the old values back and returns "failed, nothing changed" without
  reading them back. S1 makes it check, and return the stranded bytes for a
  download when the roll-back fails too, as `restorePrevious` already does.
- **Its confirmation is not bound to what was shown** (O3,
  `OpenInEditor.tsx:83`). "Replace it" calls it again with a bare yes; if
  another tab changed the put-aside layout in between, a layout the person
  never saw is replaced. S1 passes the put-aside bytes that were shown, and
  asks again when they no longer match.
- **It validates nothing.** For a link the route has already decoded the
  layout. From the list, the entry's bytes go through `checkStored` BEFORE
  either slot is touched (O6); a refusal changes nothing.

Then, for the list:

- **What is put aside is the layout on screen** (O1), passed in, not the
  working key's bytes.
- **The editor takes up the opened layout by reloading,** as Restore and
  "Open in editor" do today (`PutAsideNotice.tsx:81`). The undo history ends
  there, which is why opening asks first where a ready layout does not. The
  entry's id is written to the session value before the reload.
- **The put-aside row's Open is Restore** (`restorePrevious`: the swap, with
  its stranded-bytes download), not `openInEditor`, which would be asking to
  overwrite the very slot being opened (O8). Its Keep copies the slot's bytes
  into a new entry and leaves the slot alone.
- **Refused while the tab is stale or saves are blocked** (O1), with the
  sentence already on screen for that state.

### The one list of kept keys

`MOVED_KEYS` (`app/src/oldNames.ts`) is a fixed list. Saved layouts are a
family of keys, so S1 adds one function beside it, "every key the app keeps
now": the fixed list plus every key with the saved-layout prefix. Three
readers use it:

- **The crash report** carries every saved entry, raw, in the same
  `otherStored` block added in 1.0.4 (never parsed, never interpolated bare).
- **"Clear saved data"** asks, as now, and the question has two answers
  (D4). The first removes the fixed list and keeps the saved layouts. The
  second removes EVERYTHING: the fixed list and the saved layouts (O10; a
  button that removed only the saved layouts would leave the crash in
  place). Each says what it removes. The test that today asserts every kept
  key is removed is split in two, one per answer, and both still leave a key
  the app does not own alone.
- **A saved layout can outlive a piece it uses** (O5). The first answer
  removes the parts a person added, as it does today, and a saved layout
  that uses one then cannot be opened until that part is added again: the
  loader refuses a layout with an unknown piece. The bytes are kept, the row
  says why it will not open, and Save to a file still works. The button's
  words say so: "…keeps my saved layouts; one that uses a part I added will
  not open until I add it again." **For the owner to confirm in S2:** this
  is the honest consequence of D4 as answered. The alternative, keeping
  added parts through the reset as well, weakens the reset's guarantee,
  because an added part is read at every start.
- **The old-name migration** is untouched: no saved layout ever existed under
  the old prefix.

### Other tabs, other versions, a full store

| Case | What must happen | How |
|---|---|---|
| Two tabs keep a layout at once | both are kept | one key each (above); a test interleaves them: both read the list, then both write |
| One tab renames or removes an entry another tab has just updated | the update survives a rename; Put it back restores what was actually removed | the re-read before every write (above); tests for Rename after Update and Remove after Update |
| The put-aside layout changes in another tab while the question is on screen | the person is asked again | the confirmation carries the bytes it showed (above) |
| Another tab keeps, renames or removes while this panel is open | the list is current | the `storage` event for a key with the prefix re-reads the list |
| Another tab opens a saved layout | this tab's existing "This layout was changed in another tab" notice | unchanged: it watches the working key |
| A tab still running 1.1.x | ignores keys it does not know; its working layout is untouched | the working key and its format do not change |
| A rollback to 1.1.x after people have saved layouts | nothing is lost | the keys stay in storage, unread, and are there again after the next release |
| The store is full on Keep | the full sentence (D7); the working layout is not at risk | Keep writes only its own new key, and removes it if the read-back fails |
| The store is full on Open | "couldn't be put aside, so nothing changed" | `openInEditor` already rolls back and says this |

### Size

The first load is 170.67 kB of a 171.90 kB budget [measured 2026-11-16]. The
panel and its store are their own chunk, imported when My layouts is first
opened, as the phone shell and build mode are. Only the button, its loading
line and its failure line are on the first-load path. If S2 does not fit, it
stops: the budget is re-measured only on the owner's word.

### Tests (each pin records its mutation, and the mutation is run)

| What | Kind | The case that matters |
|---|---|---|
| The store: keep, list, update, rename, remove, put back | node | Keep failing leaves no key; Update and Rename failing leave the entry as it was, or hand back its bytes; Put it back failing keeps the bytes to download |
| A damaged entry | node | bad JSON, a name that is not a string, a date that does not parse, a count that is not a number, an inner layout that is not a layout: each is one row, none hides another, and the last is refused only on Open |
| Two tabs | node | both read, then both write: two entries; Rename after another tab's Update keeps the update; Remove after Update puts back the update |
| `openInEditor` | node | a first write that lands, then a second and its roll-back both failing: stranded bytes, not "nothing changed"; a put-aside layout changed during the question: asked again |
| Keep while saving is blocked, and while the tab is stale | dom | what is kept is the layout on screen, not the working key's older bytes; Open is refused |
| After the crash screen's first answer | dom | a saved layout using an added part is still listed, will not open, says why, and saves to a file |
| Names | node | empty, 41 characters, markup, a line break: trimmed, bounded, drawn as text, safe in a downloaded file's name |
| Opening | dom | the layout on screen is put aside; the question when the slot is taken; a refused write changes nothing; an unreadable inner layout is refused before any slot is touched |
| Update or Keep as new | dom | Open, edit, close the panel, reload: Update is still offered and changes that entry and no other; Keep as new adds one; on a new visit plain Keep is offered |
| Remove and Put it back | dom | the entry returns byte for byte; the offer ends when the panel closes |
| The put-aside row | dom | shown only when the slot holds a layout; Open swaps as Restore does, with its download when stranded; Keep makes a saved entry and leaves the slot alone |
| The crash screen | dom | the report carries every entry; the first answer removes the fixed keys and keeps the saved layouts; the second removes both; neither touches a key the app does not own |
| A layout kept by 1.1.2 opens in 1.2.0 | node | a stored entry written by S1's code, read by S2's |
| The panel's chunk | build | the first-load budget holds |

Not provable here, and said so in each pull request: a real full store, two
real tabs, a real phone.

## Tasks

- [ ] **S1 (human: ~3 d / CC: ~1.5 h)** — the store with its node tests;
  `openInEditor`'s checked roll-back and bound confirmation, for links too,
  with their tests. No reader of the store. 1.1.1 to 1.1.2.
- [ ] **S2 (human: ~1 week / CC: ~3 h)** — the panel, lazy, on both screens;
  opening, Update and Keep as new, Rename, Remove and Put it back, the
  put-aside row; the kept-keys function and the crash screen's two answers
  and report; the owner's word on the added-parts consequence; looked at in
  a browser at wide and phone sizes. 1.1.2 to 1.2.0.
- [ ] **After S2:** `/design-review` on the live panel, and the owner's look
  on a real phone with the rest of the real-phone pass.

## Outside review

Codex (model gpt-6-astra, read-only, 2026-11-16) reviewed the first draft of
this plan against the repository. Eleven findings; each was checked against
the code, all eleven hold, and all are applied above. None reopens a decision
of the owner's; O5 adds a consequence of D4 for the owner to confirm.

| # | Severity | Finding | Where it is answered |
|---|---|---|---|
| O1 | High | Keep could save stale bytes and Open could lose unsaved work: the working key is behind whenever saving is blocked or the tab is stale (`App.tsx:576`) | Keep takes the layout on screen; Open puts the on-screen layout aside and is refused in those states |
| O2 | High | `openInEditor`'s roll-back is unchecked, so "nothing changed" can be false (`putAside.ts:73`) | S1: checked, with stranded bytes for download |
| O3 | High | Its confirmation is not bound to what was shown (`OpenInEditor.tsx:83`) | S1: the confirmation carries the bytes shown and asks again on a change |
| O4 | High | Rename from a drawn copy could undo another tab's Update | every change re-reads its key in the same step as the write |
| O5 | High | The crash screen's first answer keeps saved layouts and removes added parts they may use | said in the row, in the button's words, and put to the owner |
| O6 | Medium | Entry validation was underspecified, and Open validated nothing | the whole entry is validated; the inner layout goes through `checkStored` before any slot is touched |
| O7 | Medium | Remembering the opened entry in memory is lost by the reload that opening causes | a session value |
| O8 | Medium | The put-aside row had no contract of its own, and the ready-layout analogy in C4 was wrong | its Open is Restore; C4 corrected |
| O9 | Medium | Failure was specified for creation only | a row per operation |
| O10 | Medium | "Delete my saved layouts too" removed only the saved layouts | the second answer removes everything |
| O11 | Medium | S1 was not invisible: it changed the crash screen, and skipped the budget check | the crash screen moved to S2; both run the budget check |
