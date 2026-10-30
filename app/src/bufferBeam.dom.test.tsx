/**
 * A BUFFER STOP READS AS A STOP: the canvas caps its far end with a beam.
 *
 * Value: protects=every buffer stop on the canvas carries one buffer beam at
 * its far end, across the plank; no other piece carries one
 * Value: fails_when=the beam is dropped, drawn at the joined end, or drawn on
 * pieces that are not stops
 * Value: why_new=a buffer stop drew as a short plank (PR #67, "Not done")
 * Value: seam=App mounted from a stored layout under jsdom; the beam's
 * placement read from its transform
 * Value: no_claim=how the beam looks, which was checked in the browser
 */

import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

/** A straight along x from the origin, and S on its far end. */
function mount(withStop: boolean) {
  localStorage.setItem(
    GRAPH_STORAGE_KEY,
    JSON.stringify({
      pieces: [{ pieceId: 'a', partId: 'A', turn: 'left' }, ...(withStop ? [{ pieceId: 's', partId: 'S', turn: 'left' }] : [])],
      welds: withStop ? [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 's', port: 0 } }] : [],
      anchors: [['a', { pos: [0, 0, 0, 0, 0, 0, 0, 0], heading: 0 }]],
    }),
  );
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

describe('the buffer beam', () => {
  /*
   * MUTATION PROOFS, run:
   * - the beam drawn at the joined end (`translate(${seg.from.x}, …)`): fails
   *   with `expected 'translate(144, 0) rotate(0)' to be 'translate(184, 0)
   *   rotate(0)'`.
   * - no beam (`if (true || !seg.stop …) return null`): fails with `expected
   *   +0 to be 1`.
   */
  it('caps a buffer stop at its far end, 40mm past the joint', () => {
    mount(true);
    const beams = document.querySelectorAll('svg[aria-label="Track layout"] g.buffer-beam');
    expect(beams.length).toBe(1);
    expect(beams[0]!.getAttribute('transform')).toBe('translate(184, 0) rotate(0)');
    expect(beams[0]!.querySelector('rect')!.getAttribute('height')).toBe('40');
  });

  it('is on no other piece', () => {
    mount(false);
    expect(document.querySelectorAll('g.buffer-beam').length).toBe(0);
  });
});
