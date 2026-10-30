/**
 * A LOOP THAT CLOSES WITH BEND IS DRAWN CLOSED.
 *
 * Value: protects=the canvas agrees with the verdict: a run that closes by
 * bending its joints is drawn bent, with no gap mark; a loop beyond the bend
 * keeps its gap mark
 * Value: fails_when=the canvas draws the exact, unbent render, or marks the
 * gap the joints take up
 * Value: why_new=the owner saw the Q1 loop drawn with a 72mm gap under
 * "Tight. Closes with bend" (2026-10-30)
 * Value: seam=App mounted from a stored layout under jsdom; the gap marks
 * counted on the canvas
 * Value: no_claim=how the bent loop looks, which was checked in the browser
 */

import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

/** A closed loop of the given parts, built in order. */
function mount(ids: readonly string[]) {
  const n = ids.length;
  localStorage.setItem(
    GRAPH_STORAGE_KEY,
    JSON.stringify({
      pieces: ids.map((partId, i) => ({ pieceId: `p${i}`, partId, turn: 'left' })),
      welds: ids.map((_, i) => ({ a: { pieceId: `p${i}`, port: 1 }, b: { pieceId: `p${(i + 1) % n}`, port: 0 } })),
      anchors: [['p0', { pos: [0, 0, 0, 0, 0, 0, 0, 0], heading: 0 }]],
    }),
  );
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

const gaps = () => document.querySelectorAll('svg[aria-label="Track layout"] g.gap').length;

/**
 * The track's open ends as drawn: wood ends (read off the plank paths) with
 * no other wood end within 3mm. A loop drawn closed has none.
 */
function openEnds(): number {
  const ds = new Set(
    [...document.querySelectorAll('svg[aria-label="Track layout"] path[stroke-linecap="butt"]')].map((p) => p.getAttribute('d')!),
  );
  const ends = [...ds].flatMap((d, k) => {
    const n = d.match(/-?[\d.e-]+/g)!.map(Number);
    return [
      { k, x: n[0]!, y: n[1]! },
      { k, x: n[n.length - 2]!, y: n[n.length - 1]! },
    ];
  });
  return ends.filter((e) => !ends.some((o) => o.k !== e.k && Math.hypot(o.x - e.x, o.y - e.y) < 3)).length;
}

describe('the canvas draws the bend the verdict counts on', () => {
  /*
   * MUTATION PROOFS, run:
   * - the canvas given the exact render (`render={drawn}` in App.tsx read as
   *   `render={render}`): fails with `expected 2 to be +0` (the open ends).
   * - the gap marks left unfiltered (`result.residuals.filter(...)` read as
   *   `result.residuals`): fails with `expected 1 to be +0` (the gap mark).
   */
  it('draws the Q1 loop closed, with no gap mark', () => {
    mount(['E', 'E', 'E', 'E', 'D', 'E', 'E', 'E', 'E', 'A']);
    expect(document.body.textContent).toContain('Closes with bend');
    expect(gaps()).toBe(0);
    expect(openEnds()).toBe(0);
  });

  it('still marks the gap of a loop beyond the bend', () => {
    mount(['E1', 'E1', 'E1', 'E1', 'D', 'E1', 'E1', 'E1', 'E1', 'A']);
    expect(document.body.textContent).toContain('Beyond the tested bend');
    expect(gaps()).toBe(1);
    expect(openEnds()).toBe(2);
  });
});
