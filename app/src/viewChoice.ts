/**
 * THE REMEMBERED VIEW (3D plan, eng D10, design 11A): 2D or 3D, per browser.
 * A convenience, so every read and write is wrapped: private windows, blocked
 * storage and tests all fall back to 2D without a word.
 */

import { VIEW_STORAGE_KEY } from './storageKeys.js';

export type View = '2d' | '3d';

export function loadView(): View {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === '3d' ? '3d' : '2d';
  } catch {
    return '2d';
  }
}

export function saveView(view: View): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Remembering the view is a convenience; nothing is lost without it.
  }
}

/** The view to open with: the remembered one, except that an empty layout opens 2D (design 11A). */
export function openingView(remembered: View, pieces: number): View {
  return remembered === '3d' && pieces > 0 ? '3d' : '2d';
}
