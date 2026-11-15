/**
 * Undo and Redo (task U5; multi-step by decision D12, labels by decision 8A
 * of the 2026-10-22 editing plan).
 *
 * Each label names the step it will reverse or repeat, because one control
 * reverses different things and an unlabelled one would leave the user
 * guessing which. With nothing to reverse a button is DISABLED, reads only
 * "Undo" or "Redo", and its accessible name says "Nothing to undo": first
 * paint, a layout loaded from storage, and the end of either history all land
 * here, and a live control that does nothing would read as broken.
 *
 * Separate from "Remove last", which works on any layout, history or not.
 *
 * `short` (the phone's bottom row, plan 2026-11-14, design DD1): a quarter of
 * a 390px screen does not hold "Undo place and join" on one line, so the
 * button shows the one word and the step it names is its accessible name,
 * which still begins with the word shown.
 */

import type { Step } from './editorReducer.js';

const NAME: Record<Step['kind'], string> = {
  place: 'place',
  placeJoin: 'place and join',
  break: 'break',
  join: 'join',
  remove: 'remove',
  move: 'move',
  flip: 'other side',
  swap: 'swap',
  clear: 'clear',
  preset: 'preset',
  fill: 'added pieces',
};

export function undoLabel(step: Step | null): string {
  return step === null ? 'Undo' : `Undo ${NAME[step.kind]}`;
}

export function redoLabel(step: Step | null): string {
  return step === null ? 'Redo' : `Redo ${NAME[step.kind]}`;
}

export function UndoControl({
  last,
  next,
  onUndo,
  onRedo,
  short = false,
}: {
  /** The step Undo would reverse (`lastStep`), or null. */
  last: Step | null;
  /** The step Redo would repeat (`nextStep`), or null. */
  next: Step | null;
  onUndo: () => void;
  onRedo: () => void;
  /** Show only "Undo" and "Redo"; the step is in the accessible name. */
  short?: boolean;
}) {
  return (
    <>
      <button
        onClick={onUndo}
        disabled={last === null}
        aria-disabled={last === null}
        aria-label={last === null ? 'Nothing to undo' : short ? undoLabel(last) : undefined}
      >
        {short ? 'Undo' : undoLabel(last)}
      </button>
      <button
        onClick={onRedo}
        disabled={next === null}
        aria-disabled={next === null}
        aria-label={next === null ? 'Nothing to redo' : short ? redoLabel(next) : undefined}
      >
        {short ? 'Redo' : redoLabel(next)}
      </button>
    </>
  );
}
