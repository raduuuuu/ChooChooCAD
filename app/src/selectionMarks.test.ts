/**
 * WHAT A SELECTION DRAWS (decisions 10A, 17A, 21A, 2A, E5).
 *
 * Value: protects=the selected piece and the rest of its run are outlined
 * along the true plank edges with their own weights; keyboard focus is a
 * dotted line shown only for :focus-visible; the label sits outward, else
 * inward, else nowhere; a removal that opens a gappy join says so
 * Value: fails_when=an edge is offset the wrong way or to the wrong radius,
 * the marks reuse another state's channel (dashes, the armed 3px), focus is
 * always visible, the label covers a gap figure, or the announcement omits
 * the opened join
 * Value: why_new=all new with remove-any
 * Value: seam=none (pure helpers, renderToStaticMarkup, stylesheet as text)
 * Value: no_claim=the painted result; there is no layout engine here
 */

import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import type { Segment } from '../../engine/src/geom/fk.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { describeAction } from './announce.js';
import { reduce, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { PRESETS } from './presets.js';
import { TrackCanvas } from './TrackCanvas.js';
import { labelSpot, plankEdges } from './trackPath.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };

const numbers = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) => Number(m[0]));

describe('the plank edges', () => {
  /*
   * MUTATION PROOFS, run:
   * - the x offset's sign flipped: the along-y spec fails with `expected [ 20,
   *   20 ] to deeply equal [ -20, -20 ]`. (The along-x spec cannot see it:
   *   at heading 0 the x offset is zero. Found by running it.)
   * - the curve's inner and outer radii swapped: `expected 202 to be 162`.
   */
  it('of a straight along x are the centreline moved half a plank either side', () => {
    const s: Segment = { kind: 'straight', from: { x: 0, y: 0, h: 0 }, to: { x: 144, y: 0, h: 0 }, partId: 'A' };
    const [left, right] = plankEdges(s, 20);
    expect(numbers(left)).toEqual([0, 20, 144, 20]);
    expect(numbers(right)).toEqual([0, -20, 144, -20]);
  });

  it('of a straight along y move along x: its left is -x', () => {
    const s: Segment = {
      kind: 'straight',
      from: { x: 0, y: 0, h: Math.PI / 2 },
      to: { x: 0, y: 144, h: Math.PI / 2 },
      partId: 'A',
    };
    const [left] = plankEdges(s, 20);
    const [x1, y1, x2, y2] = numbers(left);
    expect([x1, x2]).toEqual([-20, -20]);
    expect(y1).toBeCloseTo(0, 9);
    expect(y2).toBeCloseTo(144, 9);
  });

  it('of a left curve are concentric: the left edge inside (r - half), the right outside', () => {
    const r = 182;
    const s: Segment = {
      kind: 'curve',
      from: { x: 0, y: 0, h: 0 },
      to: { x: r * Math.sin(Math.PI / 4), y: r - r * Math.cos(Math.PI / 4), h: Math.PI / 4 },
      centrelineRadiusMm: r,
      sweep: 'left',
      partId: 'E',
    };
    const [left, right] = plankEdges(s, 20);
    // `A rx ry rotation large sweep x y`: the radius is the 3rd number after M x y.
    expect(numbers(left)[2]).toBe(r - 20);
    expect(numbers(right)[2]).toBe(r + 20);
  });
});

describe('the label beside a selected piece', () => {
  const s: Segment = { kind: 'straight', from: { x: 0, y: 0, h: 0 }, to: { x: 100, y: 0, h: 0 }, partId: 'A' };
  const view = { minX: -200, minY: -200, width: 400, height: 400 };

  /*
   * MUTATION PROOFS, run:
   * - no inward fallback (outward only): `expected null to deeply equal [ 50,
   *   -35 ]`, in both specs.
   * - gap figures ignored: `expected [ 50, 35 ] to deeply equal [ 50, -35 ]`.
   */
  it('goes outward when it fits, inward when a gap figure is there, else nowhere', () => {
    // Clearance 30 along +y, then half the box (5) further: centre at y = 35.
    expect(labelSpot(s, 5, 30, [20, 5], view, [])).toEqual([50, 35]);
    expect(labelSpot(s, 5, 30, [20, 5], view, [[50, 35]])).toEqual([50, -35]);
    expect(labelSpot(s, 5, 30, [20, 5], view, [[50, 35], [50, -35]])).toBeNull();
  });

  /*
   * Seen in a browser: centred on the clearance point, a long name ran back
   * across the plank. MUTATION PROOF, run: drop the half-size push. Fails
   * with `expected [ 50, 30 ] to deeply equal [ 50, 35 ]`; and for a piece
   * whose outward side is along x, the box starts beside it.
   */
  it('starts beside the piece, not across it', () => {
    const vertical: Segment = { kind: 'straight', from: { x: 0, y: 0, h: Math.PI / 2 }, to: { x: 0, y: 100, h: Math.PI / 2 }, partId: 'A' };
    const [x] = labelSpot(vertical, 5, 30, [20, 5], view, [])!;
    // Outward is -x here; the box's near edge sits at the clearance, 30 out.
    expect(x + 20).toBeCloseTo(-30, 9);
  });

  it('goes inward when the outward side leaves the view', () => {
    const tight = { minX: -200, minY: -40, width: 400, height: 60 };
    expect(labelSpot(s, 5, 30, [20, 5], tight, [])).toEqual([50, -35]);
  });
});

describe('the canvas draws a selection', () => {
  const near = PRESETS.find((p) => p.label === 'Stadium')!;
  const graph = reduce(START, { kind: 'preset', ids: near.pieces }, ports).graph;
  const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
  const html = (selected: string | null) =>
    renderToStaticMarkup(
      createElement(TrackCanvas, {
        render,
        resolve,
        selected,
        selectedRun: new Set(graph.pieces.map((p) => p.pieceId)),
        onPieceSelect: () => undefined,
        pieceName: (id: string) => `name of ${id}`,
      }),
    );
  const count = (h: string, needle: string) => h.split(needle).length - 1;

  /*
   * MUTATION PROOFS, run:
   * - only the selected piece outlined, not its run: `expected +0 to be 18`.
   * - every piece a tab stop: `expected 10 to be 1`.
   */
  it('two strong edges on the piece, two quiet edges on each other piece of its run', () => {
    const h = html(graph.pieces[0]!.pieceId);
    expect(count(h, 'class="piece-selected"')).toBe(2);
    expect(count(h, 'class="piece-run"')).toBe(2 * (graph.pieces.length - 1));
    expect(h).toContain('name of p0');
  });

  it('nothing at all with no selection, and one focusable button per piece, one tab stop', () => {
    const h = html(null);
    expect(count(h, 'piece-selected')).toBe(0);
    expect(count(h, 'class="piece"')).toBe(graph.pieces.length);
    expect(count(h, 'tabindex="0"')).toBeGreaterThan(0);
    expect(count(h, 'class="piece" role="button" tabindex="0"')).toBe(1);
  });
});

/*
 * Stylesheet as TEXT, comments stripped, LAST matching declaration (CLAUDE.md).
 */
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The last value of `prop` in a rule whose selector list names exactly `selector`. */
const last = (selector: string, prop: string): string | undefined => {
  const values = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter((rule) => (rule[1] ?? '').split(',').some((sel) => sel.trim() === selector))
    .flatMap((rule) =>
      [...(rule[2] ?? '').matchAll(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`, 'g'))].map((d) =>
        (d[1] ?? '').trim(),
      ),
    );
  return values[values.length - 1];
};

describe('each selection mark owns its channel', () => {
  /*
   * MUTATION PROOFS, run:
   * - `.piece-selected` at 3px, the armed ring's weight: `expected '3' to be
   *   '2'`.
   * - `.piece-run` dashed (the cursor's channel): `expected '3 3' to be
   *   undefined`. Survived until that assertion was added.
   * - the `:focus-visible` rule deleted: `expected undefined to be
   *   'visible'`.
   */
  it('selected: 2px solid ink; run: 1px solid ink-soft; neither dashed, both fixed size', () => {
    expect(last('.piece-selected', 'stroke')).toBe('var(--ink)');
    expect(last('.piece-selected', 'stroke-width')).toBe('2');
    expect(last('.piece-run', 'stroke')).toBe('var(--ink-soft)');
    expect(last('.piece-run', 'stroke-width')).toBe('1');
    expect(last('.piece-selected', 'stroke-dasharray')).toBeUndefined();
    expect(last('.piece-run', 'stroke-dasharray')).toBeUndefined();
    expect(last('.piece-run', 'vector-effect')).toBe('non-scaling-stroke');
  });

  it('focus: dotted ink, hidden until :focus-visible, and the browser box suppressed', () => {
    expect(last('.piece-focus', 'stroke-dasharray')).toBe('1 3');
    expect(last('.piece-focus', 'visibility')).toBe('hidden');
    expect(last('.piece:focus-visible .piece-focus', 'visibility')).toBe('visible');
    expect(last('.piece:focus', 'outline')).toBe('none');
  });
});

describe('removing from a loop that does not close says what it opened', () => {
  /*
   * MUTATION PROOF, run: drop the opened-join sentence from `removed` in
   * announce.ts: `expected 'Removed piece 5, Long straight (D).' to be
   * 'Removed piece 5, Long straight (D). T…'`.
   */
  it('names the join that never met', () => {
    const near = PRESETS.find((p) => p.label === 'Near miss')!;
    const s = reduce(START, { kind: 'preset', ids: near.pieces }, ports);
    const action = { kind: 'removePiece', pieceId: s.graph.pieces[4]!.pieceId } as const;
    const next = reduce(s, action, ports);
    expect(describeAction(s, action, next, resolve)).toBe(
      'Removed piece 5, Long straight (D). The join between piece 10 and piece 1 never met, so it was opened.',
    );
  });
});
