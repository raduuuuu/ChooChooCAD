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
 */

import type { Step } from './editorReducer.js';

const NAME: Record<Step['kind'], string> = {
  place: 'place',
  placeJoin: 'place and join',
  break: 'break',
  join: 'join',
  remove: 'remove',
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
}: {
  /** The step Undo would reverse (`lastStep`), or null. */
  last: Step | null;
  /** The step Redo would repeat (`nextStep`), or null. */
  next: Step | null;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <>
      <button
        onClick={onUndo}
        disabled={last === null}
        aria-disabled={last === null}
        aria-label={last === null ? 'Nothing to undo' : undefined}
      >
        {undoLabel(last)}
      </button>
      <button
        onClick={onRedo}
        disabled={next === null}
        aria-disabled={next === null}
        aria-label={next === null ? 'Nothing to redo' : undefined}
      >
        {redoLabel(next)}
      </button>
    </>
  );
}
