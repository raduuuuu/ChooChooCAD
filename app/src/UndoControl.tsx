/**
 * The one-step Undo (task U5, Y1 decision 5).
 *
 * Its label names the step it will reverse, because one control now reverses
 * different things and an unlabelled one would leave the user guessing which.
 * With nothing to reverse it is DISABLED and says only "Undo": first paint,
 * a layout loaded from storage, and the moment after one undo all land here,
 * and a live control that does nothing would read as broken.
 *
 * Separate from "Remove last", which stays repeatable and works on any layout.
 */

import type { LastAction } from './editorReducer.js';

const LABEL: Record<LastAction['kind'], string> = {
  place: 'Undo last piece',
  break: 'Undo break',
  join: 'Undo join',
};

export function undoLabel(last: LastAction | null): string {
  return last === null ? 'Undo' : LABEL[last.kind];
}

export function UndoControl({
  lastAction,
  onUndo,
}: {
  lastAction: LastAction | null;
  onUndo: () => void;
}) {
  const disabled = lastAction === null;
  return (
    <button onClick={onUndo} disabled={disabled} aria-disabled={disabled}>
      {undoLabel(lastAction)}
    </button>
  );
}
