/**
 * THE SWITCH SEEDS SAY WHAT THE REPRODUCTIONS SAY, AND NO MORE.
 *
 * Value: protects=the four switches read off MakerWorld reproductions stay
 * unverified, keep the road geometry that was measured, and keep the
 * peg/socket arrangement that was measured
 * Value: fails_when=a seed is promoted past `unverified` without a new source,
 * a road stops being the catalogue straight or curve it measured as, or the
 * heel polarity of a pair is swapped
 * Value: seam=the measurements are in `engine/data/switchSeeds.ts`'s docblock;
 * the road witnesses are the PUBLISHED catalogue parts, so a road is checked
 * against a part this file does not define
 * Value: no_claim=nothing about real BRIO switches, which nobody has measured
 * (`CALIBRATION.md` Q6)
 */

import { describe, expect, it } from 'vitest';
import { getPart } from '../data/brio.js';
import { BUILT_IN } from '../data/library.js';
import { SWITCH_SEEDS } from '../data/switchSeeds.js';
import { portsOf } from '../src/graph/model.js';
import { isUnverified } from '../src/parts/schema.js';

/*
 * What the meshes showed, transcribed from the measurement rather than from
 * the seed file: which catalogue straight and curve each switch's two roads
 * matched, and whether the heel had a peg (something protruding 18mm past the
 * end face) or a socket.
 */
const MEASURED = [
  { id: 'L', through: 'A', diverging: 'E', heel: 'socket' },
  { id: 'M', through: 'A', diverging: 'E', heel: 'peg' },
  { id: 'O1', through: 'A1', diverging: 'E1', heel: 'socket' },
  { id: 'P1', through: 'A1', diverging: 'E1', heel: 'peg' },
] as const;

describe('switch seeds', () => {
  /*
   * MUTATION PROOF, run: set `REPRODUCTION.status` to 'community' in
   * switchSeeds.ts. Fails with `L: expected false to be true`.
   */
  it('are all unverified, because a reproduction is not a measurement', () => {
    expect(SWITCH_SEEDS.map((p) => p.id)).toEqual(MEASURED.map((m) => m.id));
    for (const p of SWITCH_SEEDS) expect(isUnverified(p), p.id).toBe(true);
  });

  /*
   * MUTATION PROOF, run: give L `throughLengthMm: 150` (the F/G length). Fails
   * with `L straight road` on the position. Run again with O1 `innerRadiusMm:
   * 88` (the T/X radius): fails with `O1 diverging road`.
   */
  it('have the roads that were measured: a catalogue straight and curve from one heel', () => {
    for (const m of MEASURED) {
      for (const turn of ['left', 'right'] as const) {
        const sw = portsOf(getPart(m.id), turn);
        expect(sw[1]!.at, `${m.id} straight road`).toEqual(portsOf(getPart(m.through))[1]!.at);
        expect(sw[2]!.at, `${m.id} diverging road`).toEqual(
          portsOf(getPart(m.diverging), turn)[1]!.at,
        );
      }
    }
  });

  /*
   * MUTATION PROOF, run: build M with heel 'socket' in switchSeeds.ts. Fails
   * with `M heel: expected 'socket' to be 'peg'`.
   */
  it('keep the measured polarity: the roads are the opposite of the heel', () => {
    for (const m of MEASURED) {
      const p = getPart(m.id);
      if (p.kind !== 'multi-road') throw new Error(`${m.id} is not a multi-road piece`);
      expect(p.ports[0]!.polarity, `${m.id} heel`).toBe(m.heel);
      for (const road of [1, 2]) {
        expect(p.ports[road]!.polarity, `${m.id} road ${road}`).toBe(m.heel === 'peg' ? 'socket' : 'peg');
      }
    }
  });

  /*
   * MUTATION PROOF, run: drop `...SWITCH_SEEDS` from `BUILT_IN` in library.ts.
   * Fails with `L: expected false to be true`.
   */
  it('are in the library the palette draws from', () => {
    const ids = new Set(BUILT_IN.map((p) => p.id));
    for (const m of MEASURED) expect(ids.has(m.id), m.id).toBe(true);
  });
});
