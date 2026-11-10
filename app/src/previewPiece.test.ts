/**
 * WHEN A SENT PIECE IS A LIBRARY PIECE AGAIN (contributor-brief plan, D7).
 *
 * Value: protects=the duplicate line names a library piece only when the sent
 * piece's track AND decoration match it, so a new bridge on a plain
 * straight's track is not called that straight, or another bridge on it
 * Value: fails_when=the match keys on the track alone
 * Value: why_new=found rendering the preview, 2026-11-10
 * Value: seam=trackMatch over the built-in library
 * Value: no_claim=that the line's words read well (the dom test)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { trackMatch } from './previewPiece.js';

const part = makeResolver(BUILT_IN);

describe('the duplicate line (D7)', () => {
  /*
   * MUTATION PROOF, run (2026-11-10): the decoration left out of trackKey: `expected { Object (id, brand, ...) } to be null // Object.is equality`.
   */
  it('names a library piece with the same track and decoration, and not one with the same track alone', () => {
    const bridge = part('DA');
    expect(trackMatch({ ...bridge, id: 'DA-mine' })?.id).toBe('DA');
    // The bridge's arches on the plain medium straight's track: a new piece, not the medium straight.
    const decorated = { ...part('A'), id: 'new-bridge', decor: bridge.decor };
    expect(trackMatch(decorated)).toBe(null);
  });
});
