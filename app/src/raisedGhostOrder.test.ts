/**
 * A FLOOR PREVIEW PASSES UNDER RAISED TRACK (owner, 2026-10-24: "an elevated
 * track portion should allow tracks on the lower level to pass").
 *
 * The model already let floor track pass under raised track: placing,
 * dropping and dragging all checked levels. But the piece being placed was
 * drawn after everything, so a floor straight laid under a bridge was painted
 * over the raised wood and looked like it crossed it on the same level. A
 * floor preview is now drawn between the floor and raised passes; a raised
 * piece or a ramp stays on top.
 *
 * Value: protects=the paint order of the preview against the raised pass
 * Value: fails_when=the preview is drawn after the raised pass while on the
 * floor, or under it while raised
 * Value: why_new=the preview was always last
 * Value: seam=renderToStaticMarkup; document order is paint order in SVG
 * Value: no_claim=the painted pixels
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { fromInt } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { IDENTITY, portsOf, type Frame, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { TrackCanvas } from './TrackCanvas.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

const lone = (id: string, frame: Frame): Graph => ({
  pieces: [{ pieceId: id, partId: 'A', turn: 'left' }],
  welds: [],
  anchors: new Map([[id, frame]]),
});
const drawn = (g: Graph) => renderGraph(g, ports, resolve, placeAll(g, ports));

/** Where the preview and the raised pass's bridge casing fall in the markup. */
const order = (ghostLevel: number) => {
  const html = renderToStaticMarkup(
    createElement(TrackCanvas, {
      render: drawn(lone('u', { pos: fromInt(0), heading: 4, level: 1 })),
      resolve,
      ghost: {
        render: drawn(lone('g', ghostLevel === 0 ? IDENTITY : { ...IDENTITY, level: ghostLevel })),
        red: false,
        reach: 300,
      },
    }),
  );
  return { ghost: html.indexOf('class="ghost'), raised: html.indexOf('class="bridge-casing"') };
};

describe('the preview against raised track', () => {
  /*
   * MUTATION PROOFS, run:
   * - `ghostOnFloor` always false (the preview always last, as before):
   *   fails with `expected 1728 to be less than 722`.
   * - `ghostOnFloor` always true: the second spec fails with `expected 611 to
   *   be greater than 1443`.
   */
  it('a floor preview is drawn before the raised pass, so raised wood covers it', () => {
    const { ghost, raised } = order(0);
    expect(raised).toBeGreaterThan(-1);
    expect(ghost).toBeLessThan(raised);
  });

  it('a raised preview stays on top', () => {
    const { ghost, raised } = order(1);
    expect(ghost).toBeGreaterThan(raised);
  });
});
