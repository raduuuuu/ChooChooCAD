/**
 * The presets: one click from a blank canvas to a working layout.
 *
 * Lives outside App.tsx on purpose. The empty state now leads with ONE of
 * these (design D10), which makes the choice of WHICH one a product decision
 * worth a test rather than a comment. `presets.test.ts` runs the real solver
 * over `EMPTY_STATE_PRESET` and fails if the layout we put in front of a
 * first-time user stops closing exactly. A comment claiming "8 large curves,
 * exact" cannot do that; this project has already shipped three pins that
 * declared their own copy of the thing they claimed to pin and so could never
 * fail.
 *
 * No React here, so the test needs no DOM.
 */

import type { Layout, Placement, Turn } from '../../engine/src/parts/schema.js';

export interface Preset {
  readonly label: string;
  readonly pieces: readonly string[];
  /** Shown as the button's title, and under the empty state's lead. */
  readonly note: string;
}

export const PRESETS: readonly Preset[] = [
  { label: 'Circle', pieces: Array(8).fill('E'), note: '8 large curves, exact' },
  {
    label: 'Stadium',
    pieces: [...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'D'],
    note: 'exact',
  },
  {
    label: 'Near miss',
    pieces: [...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'A'],
    note: '72mm short',
  },
];

/**
 * The one preset the blank canvas offers. The others stay in the palette row.
 *
 * The circle, because it is the shortest honest path to the thing this tool is
 * for: eight identical pieces, an exact closure, and a verdict that says so
 * without a tolerance argument. Stadium is also exact but needs two part types
 * to read; Near miss is deliberately broken and is the wrong first impression.
 */
export const EMPTY_STATE_PRESET = 'Circle';

export function presetByLabel(label: string): Preset {
  const found = PRESETS.find((p) => p.label === label);
  if (!found) throw new Error(`no preset labelled ${label}`);
  return found;
}

/** A preset's piece list as a closed layout. Curves all bend the same way. */
export function presetLayout(preset: Preset): Layout {
  const placements: Placement[] = preset.pieces.map((partId) => ({
    partId,
    turn: 'left' as Turn,
  }));
  return { placements, closed: true };
}
