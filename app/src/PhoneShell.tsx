/**
 * THE PHONE'S EDITOR: ONE SCREEN THAT NEVER SCROLLS (plan 2026-11-14, design
 * DD1, DD2, DD3, DD4, DD9, DD10, DD14; eng ED7, ED8).
 *
 *   +----------------------------+
 *   | identity line              |
 *   | a warning, when there is   |   one line; "and 1 more" opens the rest (DD5)
 *   |          the plan          |   all the height that is left; never resized
 *   |                            |   by anything under it
 *   | O verdict         Show less|   the sentence and next step, whole (DD3);
 *   |                            |   "Show less" folds it to its first line
 *   | [ strip: Place Turn Cancel]|   always reserved, so the plan does not jump (DD2)
 *   |----------------------------|
 *   | [Pieces] [Undo][Redo][More]|   every target 44px or more
 *   +----------------------------+
 *        Pieces, More ─▶ a half-height sheet over the controls (Sheet.tsx)
 *        Your box, Your table, Add a part, the list ─▶ a full-screen panel:
 *                                                      its name and Done, then the form
 *
 * IT HOLDS NO STATE (ED7). Which sheet or panel is open, where the list was
 * scrolled to, the layout and every draft are App's, handed in. So turning
 * the phone, or the keyboard shrinking a sideways tablet into this shell,
 * swaps the shell and loses nothing.
 *
 * IT DRAWS WHAT IT IS GIVEN. The plan, the verdict, the strip and the rows of
 * More are built by App, from the same state the wide editor uses; this file
 * only says where they go. That keeps it small: it is its own chunk (ED8).
 *
 * Seen first: the plan. Second: the verdict. Third: Pieces, the heaviest
 * button in its row by weight, never by colour (DESIGN.md rule 1).
 */

import type { ReactNode, RefObject } from 'react';
import { Sheet } from './Sheet.js';

export type PhoneSheet = 'pieces' | 'more' | null;

export interface PhonePanel {
  /** Its name, in the fixed first row: "Your box". */
  readonly title: string;
  readonly body: ReactNode;
  readonly onDone: () => void;
}

export interface PhoneShellProps {
  /** A phone held sideways: the plan, and beside it one column of controls (DD9). */
  readonly sideways: boolean;
  readonly identity: ReactNode;
  /** Live warnings, most serious first, each with its own buttons (DD5, ED12). */
  readonly warnings: readonly ReactNode[];
  readonly warningsOpen: boolean;
  readonly onWarnings: (open: boolean) => void;
  /** The plan: the canvas or the 3D view, with its corner. */
  readonly stage: ReactNode;
  readonly verdict: ReactNode;
  /** False when the person folded the verdict to one line, to see more of the plan. */
  readonly verdictOpen: boolean;
  /** Folds and unfolds the verdict; null where there is nothing to fold or room for it all. */
  readonly onVerdict: ((open: boolean) => void) | null;
  /** The placing, joining or selection strip, or the hint; null leaves the row empty. */
  readonly strip: ReactNode;
  /** Undo and Redo, as the wide editor draws them. */
  readonly history: ReactNode;
  readonly sheet: PhoneSheet;
  readonly onSheet: (sheet: PhoneSheet) => void;
  readonly pieces: ReactNode;
  readonly piecesScroll: RefObject<number>;
  readonly more: ReactNode;
  readonly moreScroll: RefObject<number>;
  /** The full-screen panel that is open, or null. */
  readonly panel: PhonePanel | null;
  /** What was last announced, for a screen reader. */
  readonly said: string;
}

export default function PhoneShell(props: PhoneShellProps) {
  const { warnings, panel, sheet, onSheet } = props;
  const [first, ...rest] = warnings;
  const onVerdict = props.onVerdict;
  const folded = onVerdict !== null && !props.verdictOpen;
  return (
    <div className={`phone${props.sideways ? ' is-sideways' : ''}`}>
      <div className="phone-top">
        {props.identity}
        {first !== undefined && (
          <div className="phone-warnings">
            {first}
            {rest.length > 0 && (
              <button className="phone-warnings-more" aria-expanded={props.warningsOpen} onClick={() => props.onWarnings(!props.warningsOpen)}>
                {props.warningsOpen ? 'Show less' : `and ${rest.length} more`}
              </button>
            )}
            {props.warningsOpen && rest}
          </div>
        )}
      </div>
      <div className="phone-plan">{props.stage}</div>
      <div className="phone-controls">
        {/*
          * THE VERDICT FOLDS TO ONE LINE (owner, 2026-11-15). Whole, the
          * sentence, the lines nobody may miss and the next step took a
          * fifth of a phone's height from the plan. Folded, the mark and the
          * start of the sentence stay, cut by the stylesheet only: every
          * word is still in the markup, so a screen reader hears it whole.
          * It starts whole, and only the person's own tap folds it.
          */}
        <div className={`phone-verdict${onVerdict ? ' can-fold' : ''}${folded ? ' is-folded' : ''}`}>
          {props.verdict}
          {onVerdict && (
            <button className="phone-verdict-fold" aria-expanded={!folded} onClick={() => onVerdict(folded)}>
              {folded ? 'Show all' : 'Show less'}
            </button>
          )}
        </div>
        <div className="phone-strip">{props.strip}</div>
        <div className="phone-row" role="group" aria-label="Editing">
          <button className="phone-pieces" onClick={() => onSheet('pieces')}>
            Pieces
          </button>
          {props.history}
          <button onClick={() => onSheet('more')}>More</button>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="false">
        {props.said}
      </p>
      <Sheet open={sheet === 'pieces'} title="Pieces" scroll={props.piecesScroll} onClose={() => onSheet(null)}>
        {props.pieces}
      </Sheet>
      <Sheet open={sheet === 'more'} title="More" scroll={props.moreScroll} onClose={() => onSheet(null)}>
        {props.more}
      </Sheet>
      {panel && (
        <section className="phone-panel" aria-label={panel.title}>
          <div className="sheet-head">
            <h2 className="sheet-title">{panel.title}</h2>
            <button className="sheet-close" onClick={panel.onDone}>
              Done
            </button>
          </div>
          <div className="phone-panel-body">{panel.body}</div>
        </section>
      )}
    </div>
  );
}
