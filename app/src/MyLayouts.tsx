/**
 * MY LAYOUTS (plan 2026-11-16, saved layouts; the owner's D1 to D7).
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │ My layouts                                              Done  │
 *   │ [ Layout 3          ] [Keep this layout]      the layout on   │
 *   │   or: [Update "Rug loop"] [Keep as new]       screen (D1)     │
 *   │ what the last press did, in words             role=status     │
 *   │ Put aside, 12 pieces                  [Open] [Keep]     (D2)  │
 *   │ Rug loop   24 pieces · kept 14 Nov   [Open][Rename][Remove]   │
 *   │ A layout that cannot be read …  [Save to a file][Remove]      │
 *   └───────────────────────────────────────────────────────────────┘
 *
 *   Open ─▶ the entry's bytes through the editor's own loader (`check`)
 *        ─▶ refused: said, nothing touched, the file offered
 *        ─▶ `openInEditor`: the layout ON SCREEN is put aside first; if the
 *           put-aside slot holds another layout, the question, bound to the
 *           two layouts it shows; a failed write is rolled back and checked
 *        ─▶ opened: the entry's id is kept for this tab's session, and the
 *           editor reloads into it (the undo history ends, as with Restore)
 *
 * It keeps a COPY (D1): a saved layout changes only by "Update". Which entry
 * the layout on screen was opened from is a session value, so the offer to
 * update survives the reload that opening causes and is gone on a new visit.
 *
 * Its own chunk, with the store: loaded when the panel is first opened
 * (`myLayoutsLoader.tsx`). Nothing here is on the first-load path.
 */

import { useEffect, useState } from 'react';
import { downloadBytes } from './downloadBytes.js';
import { ASK_REPLACE, ASIDE_CURRENT, ASIDE_EARLIER, KEPT_BOTH, piecesWord, PUT_ASIDE_FAILED, RESTORE_FAILED, RESTORE_WAITS, STRANDED, STRANDED_OPENING, UNREADABLE_LAYOUT } from './linkWords.js';
import { openInEditor, putAside, restorePrevious, summaryOf, type Shown } from './putAside.js';
import {
  cleanName,
  defaultName,
  fileNameOf,
  keepLayout,
  listSaved,
  NAME_MAX,
  putBackLayout,
  removeLayout,
  renameLayout,
  SAVED_PREFIX,
  updateLayout,
  type Row,
  type SavedLayout,
} from './savedLayouts.js';
import { GRAPH_PREVIOUS_KEY } from './storageKeys.js';
import { useArrival } from './useArrival.js';

export const MY_LAYOUTS = 'My layouts';
export const LAYOUTS_FOR = 'Keep a layout here to come back to it. It stays in this browser.';
export const NOTHING_TO_KEEP = 'Nothing on the floor to keep yet.';
export const KEPT = 'Kept.';
export const UPDATED = 'Updated.';
export const RENAMED = 'Renamed.';
export const KEEP_FULL = "Couldn't keep this layout: the browser's storage is full. Remove a saved layout, or save this one to a file.";
export const NAME_REFUSED = `A name needs 1 to ${NAME_MAX} characters.`;
export const CHANGE_FAILED = "That couldn't be saved: the browser's storage is full. The layout is as it was.";
export const GONE = 'That layout is no longer in the list. It was removed in another tab.';
export const REMOVE_FAILED = "That layout couldn't be removed. It is still in the list.";
export const PUT_BACK_FAILED = "Couldn't put it back: the browser's storage is full. Save it to a file to keep it.";
export const ONLY_HERE = 'Storage is full, so that layout is only in this tab now. Save it to a file to keep it.';
export const UNREADABLE_ROW = "A layout that can't be read, kept exactly as saved";
export const PUT_ASIDE_ROW = 'Put aside';
export const asKept = (name: string) => `This is "${name}", as kept.`;
export const removedLine = (name: string) => `Removed "${name}".`;
/** The loader's two refusals, said for a saved layout. */
export const cannotOpen = (why: { readonly reason: 'unreadable' } | { readonly reason: 'unknown-part'; readonly partId: string }) =>
  why.reason === 'unknown-part'
    ? `This layout uses a piece this browser doesn't have (${why.partId}). Add that part again, or save the layout to a file.`
    : "This layout can't be read. Save it to a file to keep it.";

/** Which saved layout this tab's working layout was opened from, for "Update" (D1; O7). Per tab, gone on a new visit. */
const OPENED_KEY = 'generic.layouts.opened';
const openedId = (): string | null => {
  try {
    return sessionStorage.getItem(OPENED_KEY);
  } catch {
    return null;
  }
};
const rememberOpened = (id: string) => {
  try {
    sessionStorage.setItem(OPENED_KEY, id);
  } catch {
    // The layout still opens; the panel then offers a plain Keep.
  }
};

/** The layout inside a stored entry's bytes, for a file "Open a layout file" can read; the bytes themselves when there is none. */
function layoutOf(raw: string): string {
  try {
    const layout = (JSON.parse(raw) as { layout?: unknown } | null)?.layout;
    return typeof layout === 'string' ? layout : raw;
  } catch {
    return raw;
  }
}

/** "kept 14 Nov": the day, in the reader's own language. Never a time, never a year unless it differs. */
function dayOf(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export type CheckResult = { readonly ok: true } | { readonly ok: false; readonly reason: 'unreadable' } | { readonly ok: false; readonly reason: 'unknown-part'; readonly partId: string };

export interface MyLayoutsProps {
  /** The layout ON SCREEN, serialized as the editor saves it (O1). */
  readonly layoutBytes: string;
  readonly pieces: number;
  /** A layout of the person's own: not the first-visit example (C5). */
  readonly own: boolean;
  /** Everything on screen is saved. Opening waits for it: opening reloads. */
  readonly allSaved: boolean;
  /** Whether the editor's own loader would take these bytes (O6). */
  readonly check: (bytes: string) => CheckResult;
  readonly onClose: () => void;
}

type Said =
  | { readonly kind: 'none' }
  | { readonly kind: 'line'; readonly text: string }
  /** Removed, and can be put back until the panel closes or another row is removed (D5). */
  | { readonly kind: 'removed'; readonly id: string; readonly name: string; readonly raw: string }
  /** Bytes that are in storage nowhere now: offered as a file, with why. */
  | { readonly kind: 'file'; readonly text: string; readonly bytes: string; readonly name: string };

type Ask = (Shown & { readonly id: string }) | null;

export default function MyLayouts({ layoutBytes, pieces, own, allSaved, check, onClose }: MyLayoutsProps) {
  const [rows, setRows] = useState<readonly Row[]>(listSaved);
  const [aside, setAside] = useState(putAside);
  const [said, setSaid] = useState<Said>({ kind: 'none' });
  const [draft, setDraft] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ readonly id: string; readonly name: string } | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const arrival = useArrival<HTMLElement>();
  const refresh = () => {
    setRows(listSaved());
    setAside(putAside());
  };
  // Another tab kept, renamed, removed or put aside: the list is re-read, never patched from memory.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === GRAPH_PREVIOUS_KEY || e.key.startsWith(SAVED_PREFIX)) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const layouts = rows.filter((r): r is { readonly kind: 'layout' } & SavedLayout => r.kind === 'layout');
  const same = layouts.find((r) => r.layout === layoutBytes);
  const opened = layouts.find((r) => r.id === openedId());
  const canKeep = own && pieces > 0;
  const name = draft ?? defaultName(layouts.map((r) => r.name));
  const line = (text: string) => setSaid({ kind: 'line', text });

  const keep = (bytes: string, count: number, as: string) => {
    const r = keepLayout(as, bytes, count);
    if (r.kind === 'kept') {
      setDraft(null);
      line(KEPT);
    } else line(r.kind === 'bad-name' ? NAME_REFUSED : KEEP_FULL);
    refresh();
    return r;
  };
  const keepThis = () => {
    const r = keep(layoutBytes, pieces, name);
    // The layout on screen is now this entry: a later change offers to update it.
    if (r.kind === 'kept') rememberOpened(r.id);
  };
  /** What a change to an entry came to, said; bytes that are stored nowhere now are offered as a file. */
  const settle = (r: ReturnType<typeof updateLayout>, done: string, entry: SavedLayout) => {
    if (r.kind === 'done') line(done);
    else if (r.kind === 'stranded') setSaid({ kind: 'file', text: ONLY_HERE, bytes: layoutOf(r.raw), name: entry.name });
    else line(r.kind === 'bad-name' ? NAME_REFUSED : r.kind === 'gone' ? GONE : CHANGE_FAILED);
    refresh();
  };
  const remove = (row: Row) => {
    const r = removeLayout(row.id);
    const label = row.kind === 'layout' ? row.name : UNREADABLE_ROW;
    if (r.kind === 'removed') setSaid({ kind: 'removed', id: row.id, name: label, raw: r.raw });
    else line(r.kind === 'gone' ? GONE : REMOVE_FAILED);
    refresh();
  };
  const putBack = (was: Extract<Said, { kind: 'removed' }>) => {
    if (putBackLayout(was.id, was.raw)) setSaid({ kind: 'none' });
    else setSaid({ kind: 'file', text: PUT_BACK_FAILED, bytes: layoutOf(was.raw), name: was.name });
    refresh();
  };
  const open = (entry: SavedLayout, shown: Shown | false) => {
    if (!allSaved) return line(RESTORE_WAITS);
    const ok = check(entry.layout);
    if (!ok.ok) return setSaid({ kind: 'file', text: cannotOpen(ok), bytes: entry.layout, name: entry.name });
    // What is put aside is the layout on screen, and only a layout of the person's own.
    const r = openInEditor(entry.layout, shown, own ? layoutBytes : undefined);
    if (r.kind === 'opened') {
      rememberOpened(entry.id);
      return location.reload();
    }
    if (r.kind === 'ask') {
      // A put-aside layout that is also in this list loses nothing by being replaced: no question for it.
      if (shown === false && layouts.some((l) => l.layout === r.previous)) return open(entry, { previous: r.previous, current: r.current });
      return setAsk({ id: entry.id, previous: r.previous, current: r.current });
    }
    setAsk(null);
    if (r.kind === 'stranded') setSaid({ kind: 'file', text: STRANDED_OPENING, bytes: r.bytes, name: 'layout' });
    else line(PUT_ASIDE_FAILED);
    refresh();
  };
  /** The put-aside row's Open is Restore: the swap, with its own download when a layout is stranded (O8). */
  const restore = () => {
    if (!allSaved) return line(RESTORE_WAITS);
    const r = restorePrevious();
    if (r.kind === 'restored') return location.reload();
    if (r.kind === 'stranded') setSaid({ kind: 'file', text: STRANDED, bytes: r.bytes, name: 'layout' });
    else line(RESTORE_FAILED);
    refresh();
  };
  const keepAside = () => {
    let bytes: string | null = null;
    try {
      bytes = localStorage.getItem(GRAPH_PREVIOUS_KEY);
    } catch {
      bytes = null;
    }
    const s = summaryOf(bytes);
    if (bytes === null || s.kind !== 'layout') return refresh();
    // The slot is left alone: this is a copy of it, under a name.
    keep(bytes, s.pieces, defaultName(layouts.map((r) => r.name)));
  };
  const count = (bytes: string) => {
    const s = summaryOf(bytes);
    return s.kind === 'layout' ? piecesWord(s.pieces) : UNREADABLE_LAYOUT;
  };

  return (
    <section className="inventory my-layouts" aria-label={MY_LAYOUTS} ref={arrival} tabIndex={-1}>
      <header className="inventory-head">
        <h2 className="inventory-title">{MY_LAYOUTS}</h2>
        <button className="inventory-close" onClick={onClose}>
          Done
        </button>
      </header>

      {/* THE LAYOUT ON SCREEN: one of four states, never two. */}
      {!canKeep ? (
        <p className="inventory-undeclared">{pieces > 0 ? LAYOUTS_FOR : NOTHING_TO_KEEP}</p>
      ) : same ? (
        <p className="inventory-undeclared">{asKept(same.name)}</p>
      ) : (
        <div className="layouts-keep">
          {opened && (
            <button className="layouts-primary" onClick={() => settle(updateLayout(opened.id, layoutBytes, pieces), UPDATED, opened)}>
              Update “{opened.name}”
            </button>
          )}
          <label className="layouts-name">
            <span className="sr-only">A name for this layout</span>
            <input type="text" autoComplete="off" maxLength={NAME_MAX} value={name} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button className={opened ? undefined : 'layouts-primary'} onClick={keepThis}>
            {opened ? 'Keep as new' : 'Keep this layout'}
          </button>
        </div>
      )}

      {/* What the last press did, in words, and read out. */}
      <p className="inventory-said layouts-said" role="status" aria-live="polite">
        {said.kind === 'line' && said.text}
        {said.kind === 'removed' && (
          <>
            {removedLine(said.name)} <button onClick={() => putBack(said)}>Put it back</button>
          </>
        )}
        {said.kind === 'file' && (
          <>
            {said.text} <button onClick={() => downloadBytes(said.bytes, fileNameOf(said.name))}>Save to a file</button>
          </>
        )}
      </p>

      {ask && (
        <div className="layouts-ask" role="group" aria-labelledby="layouts-ask-question">
          <p id="layouts-ask-question" tabIndex={-1} ref={(el) => el?.focus()}>
            {ASK_REPLACE}
          </p>
          <ul>
            <li>
              {ASIDE_EARLIER}
              <span className="num">{count(ask.previous)}</span>
            </li>
            <li>
              {ASIDE_CURRENT}
              <span className="num">{count(ask.current)}</span>
            </li>
          </ul>
          <div className="layouts-keep">
            <button
              className="layouts-primary"
              onClick={() => {
                const entry = layouts.find((r) => r.id === ask.id);
                // The yes goes with the two layouts this question showed (O3).
                if (entry) open(entry, { previous: ask.previous, current: ask.current });
                else {
                  setAsk(null);
                  line(GONE);
                }
              }}
            >
              Replace it
            </button>
            <button
              onClick={() => {
                setAsk(null);
                line(KEPT_BOTH);
              }}
            >
              Keep it
            </button>
          </div>
        </div>
      )}

      <ul className="layouts-rows">
        {/* D2: the one put-aside slot, where people now look for layouts. */}
        {aside.kind !== 'none' && (
          <li className="layouts-row">
            {/* The same three parts as a kept row: a name, its facts, its buttons. */}
            <span className="layouts-row-name">{PUT_ASIDE_ROW}</span>
            <span className="layouts-row-facts">{aside.kind === 'layout' ? <span className="num">{piecesWord(aside.pieces)}</span> : UNREADABLE_LAYOUT}</span>
            <span className="layouts-row-buttons">
              <button onClick={restore}>Open</button>
              {aside.kind === 'layout' && <button onClick={keepAside}>Keep</button>}
            </span>
          </li>
        )}
        {rows.map((row) =>
          row.kind === 'unreadable' ? (
            <li key={row.id} className="layouts-row">
              <span className="layouts-row-name">{UNREADABLE_ROW}</span>
              <span className="layouts-row-buttons">
                <button onClick={() => downloadBytes(row.raw, 'layout.json')}>Save to a file</button>
                <button onClick={() => remove(row)}>Remove</button>
              </span>
            </li>
          ) : renaming?.id === row.id ? (
            <li key={row.id} className="layouts-row">
              <label className="layouts-name">
                <span className="sr-only">A new name for “{row.name}”</span>
                <input
                  type="text"
                  autoComplete="off"
                  maxLength={NAME_MAX}
                  value={renaming.name}
                  ref={(el) => el?.focus()}
                  onChange={(e) => setRenaming({ id: row.id, name: e.target.value })}
                />
              </label>
              <span className="layouts-row-buttons">
                <button
                  onClick={() => {
                    if (cleanName(renaming.name) === null) return line(NAME_REFUSED);
                    settle(renameLayout(row.id, renaming.name), RENAMED, row);
                    setRenaming(null);
                  }}
                >
                  Save name
                </button>
                <button onClick={() => setRenaming(null)}>Cancel</button>
              </span>
            </li>
          ) : (
            <li key={row.id} className="layouts-row">
              <span className="layouts-row-name">{row.name}</span>
              <span className="layouts-row-facts">
                <span className="num">{piecesWord(row.pieces)}</span> · kept <span className="num">{dayOf(row.keptAt)}</span>
              </span>
              <span className="layouts-row-buttons">
                <button onClick={() => open(row, false)}>Open</button>
                <button onClick={() => setRenaming({ id: row.id, name: row.name })}>Rename</button>
                <button onClick={() => remove(row)}>Remove</button>
              </span>
            </li>
          ),
        )}
      </ul>
      {rows.length === 0 && aside.kind === 'none' && canKeep && <p className="inventory-undeclared">{LAYOUTS_FOR}</p>}
    </section>
  );
}
