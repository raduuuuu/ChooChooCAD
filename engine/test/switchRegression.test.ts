/**
 * THE FOUR SWITCHES ARE WHAT THEY WERE (eng review D10, 2026-10-30).
 *
 * Value: protects=L, M, O1 and P1 keep every port pose, polarity and drawn
 * segment through the change that replaced `SwitchPart` with the multi-road
 * kind; saved layouts name switch ends by number, so a moved end breaks them
 * Value: fails_when=a switch's port order, pose, polarity, arc radius or arc
 * side drifts, on either turn
 * Value: why_new=switch segments were pinned nowhere, and the change rewrote
 * the loop that draws them
 * Value: seam=none: the fixture was written by `switchSnapshot` at 86e3eaa,
 * before the change, through public calls only
 * Value: no_claim=nothing about pieces added after the freeze
 *
 * The fixture is a witness from the old code, not a restatement of the new
 * data. Regenerate it only for a deliberate change to a switch, and say so.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { switchSnapshot } from './switchSnapshot.js';

const frozen = JSON.parse(
  readFileSync(new URL('./fixtures/switches-86e3eaa.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

describe('the switches as frozen at 86e3eaa', () => {
  const now = JSON.parse(JSON.stringify(switchSnapshot())) as Record<string, unknown>;
  for (const key of Object.keys(frozen)) {
    it(key, () => {
      expect(now[key]).toEqual(frozen[key]);
    });
  }
  it('covers both turns of all four', () => {
    expect(Object.keys(now).sort()).toEqual(Object.keys(frozen).sort());
    expect(Object.keys(frozen)).toHaveLength(8);
  });
});
