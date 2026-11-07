/**
 * THE VERSION LIST (design review 2026-11-04, D3-D7,
 * docs/plan/2026-11-04-version-list-and-trait-names.md): what the selected
 * piece's strip shows once it has three or more versions to swap to.
 *
 *   [Make it… ▾]            aria-expanded; opens the group below, in the strip
 *     Long straight now     the current one: text, not a button
 *     [Tunnel straight]     a pickable version
 *     Metro station unavailable: its station would sit on piece 3
 *                           a blocked one: greyed, its reason on the row
 *
 * The rows are checked when the list opens (D5), so a row never offers a
 * version that the swap would refuse. Opening moves focus to the first
 * pickable row; arrows walk the pickable rows; Escape or a pick closes it and
 * focus returns to "Make it…" (D7). Selecting another piece, an undo or a
 * click on the canvas closes it too: they change the selection or the
 * layout, and either remounts or closes the list.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface VersionRow {
  readonly partId: string;
  readonly name: string;
  readonly now: boolean;
  /** Why the swap would be refused, or null when it can be picked. */
  readonly blocked: string | null;
}

/** From this many swaps the strip shows "Make it…" and the list, not a button each (D4). */
export const LIST_FROM = 3;

export function VersionList({ rowsOf, onPick, closeOn }: {
  /** The family's rows, checked now (called when the list opens). */
  readonly rowsOf: () => readonly VersionRow[];
  readonly onPick: (partId: string) => void;
  /** Any change here closes the list (the layout, after an undo or a swap). */
  readonly closeOn: unknown;
}) {
  const [rows, setRows] = useState<readonly VersionRow[] | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const group = useRef<HTMLSpanElement>(null);
  const pickable = () => [...(group.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  const close = (refocus: boolean) => {
    setRows(null);
    if (refocus) toggle.current?.focus();
  };

  useEffect(() => setRows(null), [closeOn]);
  // Opening moves focus to the first pickable row (D7).
  useEffect(() => {
    if (rows !== null) pickable()[0]?.focus();
  }, [rows]);

  const onKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    // The strip's own arrows move the run; inside the list they walk its rows.
    e.preventDefault();
    e.stopPropagation();
    const all = pickable();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    all[(at + step + all.length) % all.length]?.focus();
  };

  return (
    <>
      <button ref={toggle} type="button" aria-expanded={rows !== null} aria-controls="version-list" onClick={() => (rows === null ? setRows(rowsOf()) : close(false))}>
        Make it&hellip;
      </button>
      {rows !== null && (
        <span id="version-list" ref={group} className="version-list" role="group" aria-label="Versions" onKeyDown={onKey}>
          {rows.map((r) =>
            r.now ? (
              <span key={r.partId} className="version-row">
                {r.name} <span className="version-note">now</span>
              </span>
            ) : r.blocked !== null ? (
              <span key={r.partId} className="version-row is-blocked">
                {r.name}, <span className="version-note">unavailable: {r.blocked}</span>
              </span>
            ) : (
              <button
                key={r.partId}
                type="button"
                onClick={() => {
                  close(true);
                  onPick(r.partId);
                }}
              >
                {r.name}
              </button>
            ),
          )}
        </span>
      )}
    </>
  );
}
