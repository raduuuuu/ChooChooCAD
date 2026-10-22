/**
 * THE EDITOR'S DOCUMENT-WIDE KEYS (decisions D12 and E6 keyboard parity; eng
 * structure decision: keys and pointer drags live in separate modules).
 *
 * Only the keys that make sense wherever focus is: Cmd/Ctrl+Z undoes,
 * Shift+Cmd/Ctrl+Z (and Ctrl+Y) redoes, Esc clears a selection. Keys that act
 * on one thing (Enter, Delete, Alt+arrows) belong to the focused element that
 * thing is, so they live on the canvas's piece buttons, not here.
 *
 * A key typed into a text field is the field's. The inventory counts and the
 * Add-a-part form have their own undo and their own Esc, and a layout edit
 * fired from inside one would be a nasty surprise. So an editable target is
 * skipped entirely.
 */

import { useEffect } from 'react';

export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useEditorKeys(handlers: {
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onEscape: () => void;
}): void {
  const { onUndo, onRedo, onEscape } = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditable(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
      } else if (e.ctrlKey && !e.metaKey && key === 'y') {
        e.preventDefault();
        onRedo();
      } else if (e.key === 'Escape') {
        onEscape();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onUndo, onRedo, onEscape]);
}
