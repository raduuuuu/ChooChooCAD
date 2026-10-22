/**
 * HOW A PIECE BEING PLACED IS DRAWN (decisions 10A, 13A, DESIGN.md rule 11).
 *
 * Value: protects=the preview is translucent wood with an opaque SOLID edge,
 * ink when it fits and --fail when it would not, never a target, and nothing
 * the editing plan added animates
 * Value: fails_when=the edge is dashed (the cursor's channel), the red state
 * keeps ink, the wood ignores --ghost-opacity, the preview takes clicks, or a
 * transition sneaks onto a new mark
 * Value: why_new=the preview and the selection marks are new
 * Value: seam=none (renderToStaticMarkup, stylesheet as text)
 * Value: no_claim=the painted result
 */

import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { IDENTITY, portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { TrackCanvas } from './TrackCanvas.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

const ghostRender = () => {
  const alone = { pieces: [{ pieceId: 'g', partId: 'E', turn: 'left' as const }], welds: [], anchors: new Map([['g', IDENTITY]]) };
  return renderGraph(alone, ports, resolve, placeAll(alone, ports));
};
const html = (red: boolean) =>
  renderToStaticMarkup(
    createElement(TrackCanvas, {
      render: renderGraph(EMPTY_GRAPH, ports, resolve, placeAll(EMPTY_GRAPH, ports)),
      resolve,
      ghost: { render: ghostRender(), red, reach: 300 },
    }),
  );

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const last = (selector: string, prop: string): string | undefined => {
  const values = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter((rule) => (rule[1] ?? '').split(',').some((sel) => sel.trim() === selector))
    .flatMap((rule) =>
      [...(rule[2] ?? '').matchAll(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`, 'g'))].map((d) => (d[1] ?? '').trim()),
    );
  return values[values.length - 1];
};

describe('the preview on the canvas', () => {
  /*
   * MUTATION PROOFS, run:
   * - the preview group without `pointerEvents="none"`: `expected '<div
   *   class="canvas-frame">…' to contain 'pointer-events="none"'`.
   * - the red edge keeps ink: `expected undefined to be 'var(--fail)'`.
   * - the edge dashed: `expected '3 3' to be undefined`.
   * - the wood at a literal 0.5: `expected '0.5' to be 'var(--ghost-opacity)'`.
   * - a height transition on `.mode-strip`: `.mode-strip: expected 'height
   *   120ms ease' to be undefined`.
   */
  it('is drawn on an empty floor, as wood plus two edges, and takes no clicks', () => {
    const h = html(false);
    expect(h).toContain('class="ghost"');
    expect(h).toContain('pointer-events="none"');
    expect(h.split('class="ghost-edge"').length - 1).toBe(2);
    expect(h).toContain('class="ghost-wood"');
  });

  it('is marked red when it would conflict', () => {
    expect(html(true)).toContain('class="ghost is-red"');
  });

  it('wood at --ghost-opacity; edge solid ink at a fixed weight; red edge in --fail', () => {
    expect(last('.ghost-wood', 'opacity')).toBe('var(--ghost-opacity)');
    expect(last('.ghost-edge', 'stroke')).toBe('var(--ink)');
    expect(last('.ghost-edge', 'stroke-dasharray')).toBeUndefined();
    expect(last('.ghost-edge', 'vector-effect')).toBe('non-scaling-stroke');
    expect(last('.ghost.is-red .ghost-edge', 'stroke')).toBe('var(--fail)');
  });

  /*
   * DECISION 13A: nothing new animates. DESIGN.md rule 8 allows one authored
   * motion, and snapping, Place and a refused move are all instant.
   */
  it('no new mark carries a transition or an animation', () => {
    const marks = ['.ghost', '.ghost-wood', '.ghost-edge', '.seam', '.grid', '.piece', '.piece-selected', '.piece-run', '.piece-focus', '.piece-label', '.mode-strip'];
    for (const m of marks) {
      expect(last(m, 'transition'), m).toBeUndefined();
      expect(last(m, 'animation'), m).toBeUndefined();
    }
  });
});
