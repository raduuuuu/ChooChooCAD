/**
 * THE 3D VIEW'S MARKS KEEP THEIR SOURCE AND HIDE ONLY BEHIND RED ON THEIR OWN
 * LEVEL (3D plan, eng E6/D24, O2/D26, O3).
 *
 * Value: protects=a clash on the floor no longer hides an adapter or a
 * refused joint on the deck directly above it in 3D, while 2D still hides it
 * by position; every 3D mark carries the weld, ends or piece it is about
 * Value: fails_when=the 3D list reuses the 2D position-only rule, drops a
 * source, or lists marks above the drawing ceiling
 * Value: why_new=the marks were bare points; no list existed for 3D
 * Value: seam=none (pure function over synthetic facts and ports)
 * Value: no_claim=that the 2D lists are unchanged; the existing mark specs
 * (badJointMarks, socketAdapter, twoLevels, bufferBeam) are that check, and
 * passed untouched
 */

import { describe, expect, it } from 'vitest';
import type { RenderedPort } from '../../engine/src/graph/render.js';
import { markLists, type MarkFacts } from './markLists.js';

const NONE: MarkFacts = {
  residuals: [], clashes: [], overlaps: [], polarityViolations: [], adapterJoints: [], levelMismatches: [], thirdLevels: [],
};
const port = (pieceId: string, port: number, x: number, y: number, level = 0): RenderedPort => ({
  pieceId, port, x, y, h: 0, free: false, polarity: 'socket', ...(level ? { level } : {}),
});

/*
 * Under a bridge: two raised pieces meet socket to socket (an adapter joint)
 * at (0, 0), and two floor pieces' ends clash at the same floor position.
 */
const ports = [port('up1', 0, 0, 0, 1), port('up2', 0, 0, 0, 1), port('lo1', 0, 0, 0), port('lo2', 0, 0, 0)];
const welds = [{ a: { pieceId: 'up1', port: 0 }, b: { pieceId: 'up2', port: 0 } }];
const clash = { a: { pieceId: 'lo1', port: 0 }, b: { pieceId: 'lo2', port: 0 }, at: [0, 0] as [number, number] };

describe('hiding behind a red mark', () => {
  /*
   * MUTATION PROOF, run: the 3D adapter check falls back to the 2D
   * position-only test (`allRed.some((s) => same(s.at, ...))`): `expected
   * [ 'clash' ] to deeply equal [ 'clash', 'adapter' ]`.
   */
  it('a floor clash hides the deck adapter above it in 2D, not in 3D', () => {
    const facts: MarkFacts = { ...NONE, clashes: [clash], adapterJoints: [{ weld: 0, between: ['up1', 'up2'] }] };
    const lists = markLists(facts, welds, ports);
    expect(lists.canvas.adapters).toEqual([]);
    expect(lists.scene.map((m) => m.kind)).toEqual(['clash', 'adapter']);
  });

  it('a clash on the same level hides it in 3D too', () => {
    const sameLevel = { ...clash, a: { pieceId: 'up1', port: 0 }, b: { pieceId: 'up2', port: 0 } };
    const facts: MarkFacts = { ...NONE, clashes: [sameLevel], adapterJoints: [{ weld: 0, between: ['up1', 'up2'] }] };
    expect(markLists(facts, welds, ports).scene.map((m) => m.kind)).toEqual(['clash']);
  });

  it('a floor clash does not hide a refused joint on the deck in 3D', () => {
    const facts: MarkFacts = { ...NONE, clashes: [clash], polarityViolations: [{ weld: 0, between: ['up1', 'up2'], polarity: 'peg' }] };
    const lists = markLists(facts, welds, ports);
    expect(lists.canvas.badJoints).toEqual([]);
    expect(lists.canvas.badJointsHidden).toBe(1);
    expect(lists.scene.map((m) => m.kind)).toEqual(['clash', 'refused']);
  });
});

describe('every 3D mark keeps its source', () => {
  /*
   * MUTATION PROOF, run: the level mismatch's source carries end `a` twice
   * (`b: w.a`): `expected { kind: 'levels', …(2) } to deeply equal
   * { kind: 'levels', …(2) }`.
   */
  it('a level mismatch names both ends; a third-level mark names its ramp', () => {
    const p = [port('lo', 1, 100, 0), port('up', 0, 100, 0, 1)];
    const w = [{ a: { pieceId: 'lo', port: 1 }, b: { pieceId: 'up', port: 0 } }];
    const facts: MarkFacts = {
      ...NONE,
      levelMismatches: [{ weld: 0, at: [100, 0] }],
      thirdLevels: [{ pieceId: 'ramp', at: [300, 0] }],
    };
    const scene = markLists(facts, w, p).scene;
    expect(scene[0]!.source).toEqual({ kind: 'levels', a: { pieceId: 'lo', port: 1 }, b: { pieceId: 'up', port: 0 } });
    expect(scene[1]!.source).toEqual({ kind: 'ramp', pieceId: 'ramp' });
  });

  it('above the drawing ceiling nothing but gaps and clash rings is listed, in either view', () => {
    const facts: MarkFacts = { ...NONE, clashes: [clash], adapterJoints: [{ weld: 0, between: ['up1', 'up2'] }] };
    const lists = markLists(facts, welds, ports, false);
    expect(lists.canvas.clashes).toHaveLength(1);
    expect(lists.canvas.adapters).toEqual([]);
    expect(lists.scene).toEqual([]);
  });
});
