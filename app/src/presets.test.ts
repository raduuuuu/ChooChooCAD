import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { EMPTY_STATE_PRESET, PRESETS, presetByLabel } from './presets.js';
import { presetGraph, verdictKind } from './presetVerdict.js';

const resolve = makeResolver(BUILT_IN);

/*
 * THE READY LAYOUTS, JUDGED ON THE PATH THE APP TAKES (plan 2026-11-14, E2).
 *
 * These pins used to ask the old chain engine (`solveLayout(presetLayout(...))`),
 * which the app stopped calling: a break in the reducer's preset step left them
 * green. They now build each preset through the reducer step its button
 * dispatches and read the verdict the screen would show (`presetVerdict.ts`).
 * Each pin names the change that fails it, and each was run.
 */
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
   * THE PIN. Asks the real solver, not a restated constant.
   *
   * Fails when: a preset's pieces or turns change so it stops being what its
   * `expect` says. Run: Stadium's second 'D' made an 'A' (it then reads
   * EXCEEDS where 'exact' is declared); and the reducer made to ignore
   * `action.turns` (the Bean then bends all one way and is the first to
   * stop closing).
   *
   * What it CANNOT catch, and no closure test can: a radius error. A left arc
   * from heading h displaces by i*r*(e^ih - e^i(h+t)), straights preserve
   * heading, so for a heading-closed loop every curve of one radius cancels;
   * with one radius class the absolute radius drops out. Every preset uses one
   * curve radius, so none can see a radius change. The two-class case is
   * covered in the engine's 8L+8R tests.
   */
  it('every preset is what it says: closes exactly, or misses', () => {
    for (const p of PRESETS) {
      const kind = verdictKind(presetGraph(p));
      if (p.expect === 'exact') expect(kind, p.label).toBe('EXACT');
      else expect(kind, p.label).not.toBe('EXACT');
    }
  });

  /*
   * Fails when: the reducer places a piece the other way from the preset's
   * list. Closure alone would miss a mirrored layout, which closes just as
   * well. Run: `turn` forced to 'left' in the reducer's preset case.
   */
  it('places every piece bending the way the preset says', () => {
    for (const p of PRESETS) {
      const graph = presetGraph(p);
      expect(graph.pieces.map((piece) => piece.partId), p.label).toEqual([...p.pieces]);
      expect(graph.pieces.map((piece) => piece.turn ?? 'left'), p.label).toEqual(
        p.pieces.map((_, i) => p.turns?.[i] ?? 'left'),
      );
    }
  });

  /*
   * Fails when: EMPTY_STATE_PRESET is pointed at 'Near miss'. A first-time
   * user clicks one button and the result has to close with nothing to argue.
   */
  it('the blank-canvas preset closes exactly, and Near miss stays off the empty state', () => {
    expect(presetByLabel(EMPTY_STATE_PRESET).expect).toBe('exact');
    expect(presetByLabel('Near miss').expect).toBe('miss');
  });

  /*
   * Fails when: a ready layout is added that uses a piece whose size nobody
   * published, or the short curve, whose centreline is inferred
   * (docs/plan/generic-TODOS.md, "E1's centreline"). Run: one 'E' of Bean made 'E1'.
   */
  it('builds ready layouts only from pieces with published sizes and centrelines', () => {
    for (const p of PRESETS) {
      for (const id of new Set(p.pieces)) {
        expect(resolve(id).dimensions.status, `${p.label} ${id}`).toBe('published');
        expect(id, p.label).not.toBe('E1');
      }
    }
  });
});
