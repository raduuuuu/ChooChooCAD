/**
 * WHICH READY LAYOUTS YOUR BOX CAN BUILD (plan 2026-11-14, E2).
 *
 * A ready layout replaces what is on the floor, so the question is only its
 * own pieces against the box: `shortfalls` over the preset's piece list,
 * nothing new to store. With no box declared there is nothing to say, and
 * this says nothing (`null`), the same rule `shortfalls` follows: an
 * undeclared box constrains nothing.
 *
 * No React here, so the test needs no DOM.
 */

import { shortfalls, usedCounts, type Inventory, type Shortfall } from './inventoryModel.js';
import type { Preset } from './presets.js';

/** What the box lacks for this layout: `null` with no box, empty when it has every piece. */
export function canBuild(inventory: Inventory, preset: Preset): readonly Shortfall[] | null {
  if (inventory === null) return null;
  return shortfalls(inventory, usedCounts(preset.pieces));
}

const pieces = (n: number) => (n === 1 ? '1 piece' : `${n} pieces`);

/** How many pieces short, summed over every part. */
export const shortBy = (short: readonly Shortfall[]): number => short.reduce((n, s) => n + s.shortBy, 0);

export interface BoxWords {
  /** The few words on the layout's button. */
  readonly tag: string;
  /** The whole sentence, for the button's title. */
  readonly line: string;
}

/** What to say of one layout, or nothing when no box is declared. */
export function boxWords(short: readonly Shortfall[] | null, nameOf: (partId: string) => string): BoxWords | null {
  if (short === null) return null;
  if (short.length === 0) return { tag: 'in your box', line: 'Your box has every piece.' };
  const n = shortBy(short);
  const list = short.map((s) => `${s.shortBy} × ${nameOf(s.partId)}`).join(', ');
  return { tag: `short of ${n}`, line: `Short of ${pieces(n)}: ${list}.` };
}

/**
 * The layouts in the order to offer them: those the box covers first, each
 * group keeping its own order. With no box, the order they were written in.
 */
export function byBox<P extends Preset>(
  presets: readonly P[],
  inventory: Inventory,
): readonly { readonly preset: P; readonly short: readonly Shortfall[] | null }[] {
  const rows = presets.map((preset) => ({ preset, short: canBuild(inventory, preset) }));
  if (inventory === null) return rows;
  return [...rows.filter((r) => r.short!.length === 0), ...rows.filter((r) => r.short!.length > 0)];
}
