/**
 * A GAP'S FIGURE IS NEVER CUT IN 3D (design review of the 3D view, FINDING-007).
 *
 * Value: protects=a long figure such as "1000mm" gets a label wide enough for
 * its text, while glyph marks stay square
 * Value: fails_when=every mark is forced back to the 44px square
 * Value: why_new=found by the design review; the scene tests did not look at
 * mark sizes
 * Value: seam=none: `syncScene` with real three objects; in node there is no
 * canvas to measure, so the label width is the viewer's own monospace estimate
 * Value: no_claim=the measured width in a browser; the review's screenshot of
 * a "216mm" label is that
 */

import { Group, Sprite } from 'three';
import { describe, expect, it } from 'vitest';
import type { SceneArrays } from '../../engine/src/view3d/mesh.js';
import { estimateTextPx, figureText, labelAspect, MARK_PX, syncScene, type SceneColors } from './Viewer3D.js';

const empty = { positions: new Float32Array(0), indices: new Uint32Array(0) };
const C = Object.fromEntries(
  ['floor', 'trackFill', 'trackEdge', 'trackGroove', 'trackShadow', 'seam', 'ink', 'inkSoft', 'paper', 'paperSunk', 'fail', 'slabSide'].map((k) => [k, '#888888']),
) as unknown as SceneColors;

const scene = (marks: SceneArrays['marks']): SceneArrays => ({
  plankTop: empty, plankSide: empty, grooves: empty, beams: empty, footprints: empty,
  seams: { positions: new Float32Array(0) }, slab: null, marks, pieceRanges: new Map(),
  bounds: { min: [0, 0, 0], max: [1, 1, 1] },
});

describe('mark labels', () => {
  /*
   * MUTATION PROOF, run: `labelAspect` returns 1 whatever the text: `expected
   * 1 to be greater than 1.2`.
   */
  it('a long gap figure is wider than a mark; a short one and every glyph stay square', () => {
    const group = new Group();
    syncScene(group, scene([
      { kind: 'gap', at: [0, 0, 12], figure: 999.2 },
      { kind: 'gap', at: [0, 0, 12], figure: 3 },
      { kind: 'clash', at: [0, 0, 12] },
    ]), C);
    const aspects = group.children.filter((o): o is Sprite => o instanceof Sprite).map((s) => s.userData.aspect as number);
    expect(figureText(999.2)).toBe('1000mm');
    expect(aspects[0]).toBeGreaterThan(1.2);
    expect(aspects[0]! * MARK_PX).toBeGreaterThanOrEqual(estimateTextPx('1000mm'));
    expect(aspects[1]).toBe(1);
    expect(aspects[2]).toBe(1);
    expect(labelAspect(0)).toBe(1);
  });
});
