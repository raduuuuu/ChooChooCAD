/**
 * THE "CLICK A PIECE" HINT (plan 2026-11-01; design DR2, DR3, DR8).
 *
 * Removing any piece already worked, by selecting it, but nothing on screen
 * said a piece could be selected. One line in the canvas strip says so, in
 * words for the hand being used, until this browser has selected a piece once.
 * Both sentences are copy, so copyPosition.test.ts reads them too.
 */

import { write } from '../../engine/data/storage.js';
import { SELECT_HINT_STORAGE_KEY } from './storageKeys.js';

export const HINT_MOUSE = 'Click a piece to select it; Remove piece or Delete takes it out.';
export const HINT_TOUCH = 'Tap a piece to select it; Remove piece takes it out.';

/** True once a piece has been selected in this browser. Blocked storage reads as not yet. */
export function hintSeen(): boolean {
  try {
    return localStorage.getItem(SELECT_HINT_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Remember that a piece has been selected. A refused write only means the hint may come back. */
export function rememberHintSeen(): void {
  write(SELECT_HINT_STORAGE_KEY, '1');
}
