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
  /**
   * Which way each piece bends, one per piece (plan 2026-11-14, E2). Absent
   * means every piece bends left, which is all the first three need.
   */
  readonly turns?: readonly Turn[];
  /** Shown as the button's title, and under the empty state's lead. */
  readonly note: string;
  /**
   * What the verdict says of it: closes exactly, or misses on purpose.
   * `presets.test.ts` asks the solver, through the reducer the button uses,
   * and fails when a preset stops being what it says here.
   */
  readonly expect: 'exact' | 'miss';
}

const E = (n: number): string[] => Array<string>(n).fill('E');
const L = (n: number): Turn[] => Array<Turn>(n).fill('left');
const R = (n: number): Turn[] => Array<Turn>(n).fill('right');
const twice = <T>(half: readonly T[]): T[] => [...half, ...half];

/*
 * THE READY LAYOUTS. The first three are the originals and keep their order:
 * tests and the first-visit example look them up by place and by name.
 *
 * The five after them (plan 2026-11-14, E2) use only the large curve and the
 * plain straights: pieces whose sizes AND centrelines are published. The
 * short curve is left out on purpose, because its centreline is inferred from
 * an outer radius nobody published (docs/plan/generic-TODOS.md, "E1's
 * centreline"), and a ready layout should not rest on an inferred figure.
 *
 * Each was found by building it in the solver, not by arithmetic on paper.
 * A shape made of one half walked twice, where the half turns through half
 * a circle in all, closes whatever is in the half: the second half undoes the
 * first half's travel. Whether its track then overlaps itself is the solver's
 * to say, which is why every one of them is checked.
 */
export const PRESETS: readonly Preset[] = [
  { label: 'Circle', pieces: E(8), note: '8 large curves, exact', expect: 'exact' },
  {
    label: 'Stadium',
    pieces: [...E(4), 'D', ...E(4), 'D'],
    note: 'exact',
    expect: 'exact',
  },
  {
    label: 'Near miss',
    pieces: [...E(4), 'D', ...E(4), 'A'],
    note: '72mm short',
    expect: 'miss',
  },
  {
    label: 'Long oval',
    pieces: twice([...E(4), 'D', 'D']),
    note: '8 large curves and 4 long straights, exact',
    expect: 'exact',
  },
  {
    label: 'Rounded square',
    pieces: [...twice(twice(['E', 'E', 'A']))],
    note: '8 large curves and 4 medium straights, exact',
    expect: 'exact',
  },
  {
    label: 'Bean',
    pieces: E(12),
    turns: twice([...L(5), ...R(1)]),
    note: '12 large curves, bending both ways, exact',
    expect: 'exact',
  },
  {
    label: 'Peanut',
    pieces: E(16),
    turns: twice([...L(5), ...R(2), ...L(1)]),
    note: '16 large curves, bending both ways, exact',
    expect: 'exact',
  },
  {
    label: 'Dog bone',
    pieces: twice([...E(7), 'D', 'E']),
    turns: twice([...L(6), ...R(1), ...L(1), ...R(1)]),
    note: '16 large curves and 2 long straights, exact',
    expect: 'exact',
  },
];

// A turns list of the wrong length would silently bend the rest left; refuse it where it is written.
for (const p of PRESETS) {
  if (p.turns && p.turns.length !== p.pieces.length) {
    throw new Error(`preset ${p.label}: ${p.turns.length} turns for ${p.pieces.length} pieces`);
  }
}

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

/**
 * A preset's piece list as a closed layout for the old chain engine. Only the
 * verdict corpus (app/test/verdictCorpus.ts) still reads it; the app and the
 * pins build presets through the reducer.
 */
export function presetLayout(preset: Preset): Layout {
  const placements: Placement[] = preset.pieces.map((partId, i) => ({
    partId,
    turn: preset.turns?.[i] ?? 'left',
  }));
  return { placements, closed: true };
}
