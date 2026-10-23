/**
 * TWO LEVELS WHILE PLACING AND MOVING (two-layer plan: E1, OV1, OV3, eng
 * section 1 finding 1, SC1).
 *
 * Value: protects=a ramp preview that would lift track to a third level is a
 * conflict; a descending ramp from the floor says it re-levels the run and is
 * checked whole; dragging a raised run keeps its level; a snap never reaches
 * an end on the other level
 * Value: fails_when=ghostFit skips the level check, moveRun rebuilds the
 * anchor without its level, or snapRunMove ignores level
 * Value: why_new=levels are new
 * Value: seam=none (the pure model)
 * Value: no_claim=the strip wording and the canvas (dom specs). SC1's
 * "never write level 0" needs no spec here: writing it always fails seven
 * existing ones, the auto-join specs in ghostFit, moveRun and paletteDrop
 * among them, run 2026-10-23
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { levelOf, portsOf, type Frame, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { ghostFit, moveRun, shiftMm, snapRunMove } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

const at = (x: number, y: number, heading: number, level = 0): Frame => {
  const pos = add(fromInt(x), scale(zetaPow(4), y)) as Cyc;
  return level === 0 ? { pos, heading } : { pos, heading, level };
};

/** A straight anchored at the given level, alone. */
const one = (level: number): Graph => ({
  pieces: [{ pieceId: 's', partId: 'A', turn: 'left' }],
  welds: [],
  anchors: new Map([['s', at(0, 0, 0, level)]]),
});

describe('a ramp preview that would lift track to a third level is a conflict (E1)', () => {
  /*
   * MUTATION PROOF, run: the third-level push removed from `ghostFit`: fails
   * with `expected [] to deeply equal [ { kind: 'level' } ]`.
   */
  it('climbing from a raised end', () => {
    const fit = ghostFit(one(1), ports, { partId: 'N', turn: 'left', at: { pieceId: 's', port: 1 }, frame: null, port: 0 });
    expect(fit.conflicts).toEqual([{ kind: 'level' }]);
  });

  it('climbing from a floor end is fine', () => {
    const fit = ghostFit(one(0), ports, { partId: 'N', turn: 'left', at: { pieceId: 's', port: 1 }, frame: null, port: 0 });
    expect(fit.conflicts).toEqual([]);
    expect(fit.relevels).toBe(false);
  });
});

describe('a ramp laid descending from the floor re-levels its run, and is checked whole (OV1)', () => {
  /*
   * A floor straight `s`, and a raised straight `u` crossing it at right
   * angles over its middle: a bridge. A ramp laid descending from `s`'s far
   * end raises `s` to the raised level, where `u` already is, so the two
   * would then lie on one level, one over the other.
   *
   * MUTATION PROOFS, run:
   * - `relevels` never set: the first spec fails with `expected false to be
   *   true`.
   * - the whole-run overlap check skipped: the first spec fails with
   *   `expected [] to deeply equal [ { kind: 'over', pieceId: 'u' } ]`.
   */
  // `s` is C, two sockets, so the ramp's high end (a peg) meets a socket.
  const crossed: Graph = {
    pieces: [
      { pieceId: 's', partId: 'C', turn: 'left' },
      { pieceId: 'u', partId: 'A', turn: 'left' },
    ],
    welds: [],
    anchors: new Map([
      ['s', at(0, 0, 0)],
      ['u', at(72, -72, 4, 1)],
    ]),
  };

  it('raising the floor straight into the raised one is refused, naming it', () => {
    const fit = ghostFit(
      crossed,
      ports,
      { partId: 'N', turn: 'left', at: { pieceId: 's', port: 1 }, frame: null, port: 1 },
      undefined,
      undefined,
      { resolve },
    );
    expect(fit.relevels).toBe(true);
    expect(fit.conflicts).toEqual([{ kind: 'over', pieceId: 'u' }]);
  });
});

describe('moving a raised run keeps its level (eng section 1, finding 1)', () => {
  /*
   * MUTATION PROOF, run: `moveRun` building its anchor with `{ pos, heading }`
   * again: fails with `expected +0 to be 1`.
   */
  it('a ramp-less raised straight dragged across the floor stays raised', () => {
    const r = moveRun(one(1), ports, 's', { turns: 0, by: shiftMm(300, 0) });
    expect(r.refused).toBeNull();
    expect(levelOf(placeAll(r.graph, ports).frames.get('s')!)).toBe(1);
  });
});

describe('a drag snaps only to an end on its own level (OV3)', () => {
  /*
   * A floor straight `f` from the origin, its far end at x = 144. A raised
   * straight `t` with its start right there, one level up. The dragged run
   * `r`, a floor straight, released with its start 10mm from that spot.
   *
   * MUTATION PROOF, run: the level filter removed from `snapRunMove`: fails
   * with `expected { turns: 8, by: [ 144, +0, +0, …(5) ] } to deeply equal {
   * Object (turns, by) }` (the run was turned and snapped onto the raised
   * end's spot).
   */
  it('a floor run is not pulled to a raised end', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 't', partId: 'A', turn: 'left' },
        { pieceId: 'r', partId: 'A', turn: 'left' },
      ],
      welds: [],
      anchors: new Map([
        ['t', at(144, 0, 0, 1)],
        ['r', at(0, 300, 0)],
      ]),
    };
    const asked = { turns: 0, by: shiftMm(154, -300) };
    expect(snapRunMove(g, ports, 'r', asked, 100, { resolve })).toEqual(asked);
  });
});
