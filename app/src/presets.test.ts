import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { solveLayout } from '../../engine/src/solver/result.js';
import {
  EMPTY_STATE_PRESET,
  PRESETS,
  presetByLabel,
  presetLayout,
} from './presets.js';

const resolve = makeResolver(BUILT_IN);

describe('presets', () => {
  it('every preset names parts that exist in the built-in library', () => {
    for (const p of PRESETS) {
      for (const id of p.pieces) {
        expect(() => resolve(id), `${p.label} -> ${id}`).not.toThrow();
      }
    }
  });

  it('the preset offered on the blank canvas exists', () => {
    expect(() => presetByLabel(EMPTY_STATE_PRESET)).not.toThrow();
  });

  /*
   * THE PIN. Runs the real solver, not a restated constant.
   *
   * A first-time user clicks one button and the result has to be a layout that
   * closes with nothing to argue about. Point EMPTY_STATE_PRESET at 'Near miss'
   * and this fails on gapMm (72); change a straight length under it and it
   * fails too.
   *
   * What it CANNOT catch, and no closure test can: a radius error. Verified by
   * mutation, +1mm on E's innerRadiusMm leaves all four tests green. That is
   * the radius-difference invariant, not a gap here. A left arc from heading h
   * displaces by i*r*(e^ih - e^i(h+t)), straights preserve heading, so for a
   * heading-closed loop every curve of one radius cancels; with one radius
   * class the absolute radius drops out of the equation entirely. All three
   * presets are single-radius-class (E only, or E plus straights), so none of
   * them can see a radius change. The two-class case is covered where it
   * belongs, in the engine's 8L+8R tests. This is also why a symmetric 20mm
   * radius error survived six review passes.
   */
  it('the blank-canvas preset closes exactly, with no tolerance argument', () => {
    const res = solveLayout(presetLayout(presetByLabel(EMPTY_STATE_PRESET)), resolve);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.gapMm).toBe(0);
  });

  it('Near miss really does not close, so it stays off the empty state', () => {
    const res = solveLayout(presetLayout(presetByLabel('Near miss')), resolve);
    const gap = res.ok ? res.gapMm : res.gapMm;
    expect(gap).toBeGreaterThan(0);
    expect(EMPTY_STATE_PRESET).not.toBe('Near miss');
  });
});
