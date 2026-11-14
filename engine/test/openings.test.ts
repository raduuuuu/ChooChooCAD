import { describe, expect, it } from 'vitest';
import { BUILT_IN } from '../data/library.js';
import type { Segment } from '../src/geom/fk.js';
import { bridgeOpenings, openings, raisedOpenings, statedOpening, trainFits, trainMargin, tunnelOpening, tunnelOpenings } from '../src/graph/openings.js';
import type { PlankOverlap } from '../src/graph/overlap.js';

/*
 * WHETHER THE TRAIN FITS, IN ONE PLACE (plan 2026-11-14, E5). Each pin names
 * the change that fails it, and each was run. The figures are written here by
 * hand, not read from calibration, so a change to the arithmetic cannot hide
 * behind the same change to the numbers.
 */

const part = (id: string) => BUILT_IN.find((p) => p.id === id)!;
const F = { riseMm: 61, plankMm: 12, trainMm: 55 } as const;
const cross = (a: string, b: string, x = 0, y = 0): PlankOverlap => ({ a, b, at: [x, y], areaMm2: 1600 });
/** A drawn piece of track at a level, as far as `raisedOpenings` reads one. */
const drawn = (pieceId: string, level: number, rise = 0): Segment => ({ pieceId, level, ...(rise ? { rise } : {}) }) as unknown as Segment;

describe('the train and an opening', () => {
  /*
   * Fails when: the margin is rounded before it is judged (`Math.round` put
   * round the subtraction): 67.2 - 12 - 55 = 0.2 then reads 0 and the train
   * "may not pass" an opening it clears; and 66.8 reads 0 where it is -0.2.
   * Also fails when the comparison lets 0 through (`>= 0`): at 0 the roof
   * touches. Both run.
   */
  it('is the opening less the track and the train, unrounded, and 0 does not fit', () => {
    expect(trainMargin(69, F)).toBe(2);
    expect(trainMargin(67.2, F)).toBeCloseTo(0.2, 10);
    expect(trainFits(67.2, F)).toBe(true);
    expect(trainMargin(66.8, F)).toBeCloseTo(-0.2, 10);
    expect(trainFits(66.8, F)).toBe(false);
    expect(trainMargin(67, F)).toBe(0);
    expect(trainFits(67, F)).toBe(false);
  });

  /*
   * Fails when: a tunnel's FIRST vault is taken, not its lowest (`Math.min`
   * dropped for `vaults[0]`). The metro tunnel is two portals 71mm clear and a
   * tube 69mm clear between them (calibration sheet M1, T1 to T4); the first
   * one found overstated the room by 2mm. Run.
   */
  it("reads a tunnel's room from its lowest vault", () => {
    expect(tunnelOpening(part('MT'))).toEqual({ openingMm: 69, estimated: true });
    expect(tunnelOpening(part('TT'))?.openingMm).toBe(79.5);
    expect(tunnelOpening(part('A'))).toBe(undefined);
  });

  /*
   * Fails when: a deck's stated opening is ignored (only `hump` read): the
   * harbour arch bridge then states none and track under it is judged as
   * plain raised track. Run.
   */
  it("reads a bridge's or a deck's own stated opening, and says when it is an estimate", () => {
    expect(statedOpening(part('SA'))).toEqual({ openingMm: 69.2, estimated: false });
    expect(statedOpening(part('SB'))).toEqual({ openingMm: 61, estimated: true });
    expect(statedOpening(part('HB'))).toEqual({ openingMm: 60.8, estimated: false });
    expect(statedOpening(part('D'))).toBe(undefined);
  });
});

describe('openings', () => {
  const partOf = (id: string) => part(id.split('#')[0]!);
  const resolve = (partId: string) => part(partId);

  /*
   * Fails when: which piece is overhead is taken from the order the crossing
   * was listed in (`aOver` fixed true): the floor straight is then "over"
   * the raised one. Run.
   */
  it('says which piece is overhead at a raised crossing, from the drawn track', () => {
    const segments = [drawn('floor', 0), drawn('up', 1), drawn('ramp', 0, 1)];
    const found = raisedOpenings([cross('floor', 'up', 324, 0), cross('up', 'floor'), cross('ramp', 'floor')], segments, F);
    expect(found.map((o) => [o.over, o.under])).toEqual([['up', 'floor'], ['up', 'floor'], ['ramp', 'floor']]);
    expect(found[0]).toMatchObject({ kind: 'raised', at: [324, 0], openingMm: 61, estimated: false, marginMm: -6, fits: false });
  });

  it('gives each bridge crossing the bridge\'s own figure, and where it is', () => {
    const found = bridgeOpenings(
      [{ bridge: 'SA#1', under: 'D#2' }, { bridge: 'D#3', under: 'D#2' }],
      partOf,
      F,
      [cross('D#2', 'SA#1', 238, 0)],
    );
    // The plain straight states no opening, so it is not a bridge here.
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'bridge', over: 'SA#1', under: 'D#2', at: [238, 0], openingMm: 69.2, fits: true });
    expect(found[0]!.marginMm).toBeCloseTo(2.2, 10);
  });

  /*
   * Fails when: a crossing under a bridge is ALSO listed as plain raised
   * track (the `own` filter in `openings` removed): the train is then
   * stopped there by the ramp's 61mm rise under an arch that is 69mm clear.
   * Run.
   */
  it('lists a crossing under a bridge once, as the bridge\'s, and every tunnel', () => {
    const pieces = [
      { pieceId: 'arch', partId: 'SA' },
      { pieceId: 'under', partId: 'D' },
      { pieceId: 'up', partId: 'D' },
      { pieceId: 'low', partId: 'D' },
      { pieceId: 'tube', partId: 'MT' },
    ];
    const facts = {
      bridges: [cross('arch', 'under', 238, 0), cross('up', 'low', 900, 0)],
      underBridges: [{ bridge: 'arch', under: 'under' }],
      crossings: [cross('arch', 'under', 238, 0), cross('up', 'low', 900, 0)],
    };
    const segments = [drawn('arch', 0, 1), drawn('under', 0), drawn('up', 1), drawn('low', 0), drawn('tube', 0)];
    const found = openings(facts, pieces, resolve, segments, F);
    expect(found.map((o) => [o.kind, o.over, o.under])).toEqual([
      ['raised', 'up', 'low'],
      ['bridge', 'arch', 'under'],
      ['tunnel', 'tube', 'tube'],
    ]);
    expect(found.map((o) => o.fits)).toEqual([false, true, true]);
    expect(tunnelOpenings(pieces, resolve, F).map((o) => o.at)).toEqual([null]);
  });
});
