/**
 * A SHEET: THE HALF OF THE SCREEN THAT OPENS OVER THE CONTROLS ON A PHONE
 * (plan 2026-11-14, design DD4, DD11, DD14; eng ED1;
 * docs/plan/2026-11-14-additions-eng.md).
 *
 *   [Pieces] or [More] ──▶ open ──▶ <dialog>.showModal()
 *                                      │  first row: the name, and Close (never scrolls)
 *                                      │  the body: scrolls by itself
 *      a pick ─────────────┐           │
 *      Close ──────────────┤           ▼
 *      a tap outside it ───┼──▶ onClose ──▶ the owner sets `open` false ──▶ <dialog>.close()
 *      Escape (the browser)┘
 *
 * THE BROWSER'S OWN DIALOG (DD11), the app's first: `showModal()` moves focus
 * in, holds it there, makes everything behind it unreachable by pointer,
 * keyboard and screen reader, closes on Escape and hands focus back to the
 * button that opened it. None of that is written here, which is why it is
 * checked on a real phone (plan task T12) and not in the DOM tests, where the
 * element is a stand-in (`app/test/domSetup.ts`).
 *
 * A TAP OUTSIDE IT is a tap on the dialog's backdrop, which the browser
 * reports as a click on the dialog element itself; the body fills the
 * dialog's box, so a click that lands on the element and not in the body is
 * outside. The plan behind never sees it: a modal dialog takes it.
 *
 * IT OPENS AND CLOSES AT ONCE (DESIGN.md rule 8): no slide, no fade.
 *
 * ITS SCROLL IS REMEMBERED (DD4) in `scroll`, a ref its owner holds, so it
 * outlives the sheet being closed and the shell being swapped (eng ED7).
 */

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

export interface SheetProps {
  readonly open: boolean;
  /** Its name, shown in the first row and read as the dialog's label: "Pieces". */
  readonly title: string;
  /** Asked to close: Close, a tap outside, or Escape. The owner sets `open` false. */
  readonly onClose: () => void;
  /** Where the body's scroll position is kept between openings. */
  readonly scroll?: RefObject<number>;
  readonly children: ReactNode;
}

export function Sheet({ open, title, onClose, scroll, children }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Put the list back where it was left, before the first paint of this opening.
  useLayoutEffect(() => {
    if (open && body.current && scroll) body.current.scrollTop = scroll.current;
  }, [open, scroll]);

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-label={title}
      // Escape, and any other way the browser closes it: tell the owner.
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="sheet-box">
          <div className="sheet-head">
            <h2 className="sheet-title">{title}</h2>
            <button className="sheet-close" onClick={onClose}>
              Close
            </button>
          </div>
          <div
            ref={body}
            className="sheet-body"
            onScroll={(e) => {
              if (scroll) scroll.current = e.currentTarget.scrollTop;
            }}
          >
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
