/**
 * A HALF-TYPED FORM OUTLIVES THE SCREEN BEING REARRANGED (plan 2026-11-14,
 * eng ED7).
 *
 * Your table and Add a part are drawn in a different place by the wide editor
 * and by the phone's, so turning a phone, or the keyboard shrinking a sideways
 * tablet into the phone's editor, unmounts the form and mounts it again. With
 * plain `useState` what was typed is gone.
 *
 *   useDraft(panel, field, initial)  ── like useState, kept outside the tree
 *
 *   the form is moved:  unmount ─▶ mount again, in the same commit ─▶ the draft is still there
 *   the form is closed: unmount ─▶ nothing mounts ─▶ the draft is dropped
 *
 * So closing a panel and opening it again still starts fresh, as it always
 * did, and no close button has to remember to say so. "Still mounted?" is
 * asked a moment after the unmount (a microtask), by which time a move has
 * mounted the form again.
 */

import { useEffect, useState } from 'react';

const drafts = new Map<string, unknown>();
const mounted = new Map<string, number>();

export function useDraft<T>(panel: string, field: string, initial: T): [T, (next: T | ((was: T) => T)) => void] {
  const key = `${panel}.${field}`;
  const [value, setValue] = useState<T>(() => (drafts.has(key) ? (drafts.get(key) as T) : initial));
  useEffect(() => {
    mounted.set(panel, (mounted.get(panel) ?? 0) + 1);
    return () => {
      mounted.set(panel, (mounted.get(panel) ?? 1) - 1);
      queueMicrotask(() => {
        if ((mounted.get(panel) ?? 0) === 0) drafts.delete(key);
      });
    };
  }, [panel, key]);
  const set = (next: T | ((was: T) => T)) =>
    setValue((was) => {
      const to = typeof next === 'function' ? (next as (was: T) => T)(was) : next;
      drafts.set(key, to);
      return to;
    });
  return [value, set];
}
