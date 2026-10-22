/**
 * THE JOINT YOU CAN BREAK, AND THE UNDO THAT NAMES WHAT IT WILL REVERSE (U5).
 *
 * Value: protects=joints are drawn as targets UNDER the free ends, so a free
 * end wins any overlap; a joint shows nothing idle and an open bracket pair
 * on hover or focus; the Undo control names the step it reverses and is
 * disabled, by attribute and by ARIA, when there is none
 * Value: fails_when=the joints are painted over the free ends, the hit radii
 * swap, the brackets show at rest or stop showing on hover, or the control
 * ships live-but-dead or mislabelled
 * Value: why_new=U5 adds the joint target and the control
 * Value: seam=`renderToStaticMarkup` for markup, and the stylesheet read as
 * TEXT for the hover rule, because there is no DOM and no CSS engine here
 * Value: no_claim=nothing about a real pointer: hit-testing by paint order is
 * the browser's, and it was checked once by hand in a browser rather than
 * here (E11)
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { graphFromChain } from '../../engine/src/graph/fromChain.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { lastStep, nextStep, reduce, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { TrackCanvas } from './TrackCanvas.js';
import { weldTargets } from './trackPath.js';
import { UndoControl, undoLabel } from './UndoControl.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const open = (ids: string[]): Graph =>
  graphFromChain({ placements: ids.map((partId) => ({ partId, turn: 'left' as const })), closed: false });
const drawn = (g: Graph) => renderGraph(g, ports, resolve, placeAll(g, ports));

describe('weldTargets', () => {
  /*
   * MUTATION PROOF, run: place the target at end `a` alone
   * (`at: [a.x, a.y]`). Fails with `expected [ +0, +0 ] to deeply equal [ 90,
   * +0 ]` on the closing weld.
   */
  it('puts each joint where its two ends meet, and a gapped joint mid-gap', () => {
    const chain = open(['A', 'A']);
    const targets = weldTargets(chain.welds, drawn(chain).ports);
    expect(targets).toHaveLength(1);
    expect(targets[0]!.at[0]).toBeCloseTo(144, 9);
    expect(targets[0]!.at[1]).toBeCloseTo(0, 9);

    // A3 then A1 welded back onto the A3's start: the ends are 36mm apart
    // along the axis, so the target sits halfway, where the gap label points.
    const g: Graph = {
      ...open(['A3', 'A1']),
      welds: [
        ...open(['A3', 'A1']).welds,
        { a: { pieceId: 'p0', port: 0 }, b: { pieceId: 'p1', port: 1 } },
      ],
    };
    const closing = weldTargets(g.welds, drawn(g).ports)[1]!;
    expect(closing.at.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([90, 0]);
  });
});

describe('the canvas draws joints under the free ends', () => {
  const markup = (withHandler: boolean) => {
    const g = open(['E', 'E', 'E']);
    return renderToStaticMarkup(
      createElement(TrackCanvas, {
        render: drawn(g),
        resolve,
        welds: weldTargets(g.welds, drawn(g).ports),
        onWeldClick: withHandler ? () => undefined : undefined,
        onPortClick: () => undefined,
      }),
    );
  };

  /*
   * PAINT ORDER IS THE PRECEDENCE RULE: the later element takes the click.
   *
   * MUTATION PROOF, run: move the joints block below the free-ends block in
   * `TrackCanvas.tsx`. Fails with `expected 2821 to be less than 2056`
   * (string offsets of the last joint and the first free end).
   */
  it('paints every joint before the first free end, with the smaller hit circle', () => {
    const html = markup(true);
    const lastWeld = html.lastIndexOf('class="weld"');
    const firstPort = html.indexOf('class="port');
    expect(lastWeld).toBeGreaterThan(-1);
    expect(lastWeld).toBeLessThan(firstPort);
    expect(html).toMatch(/<circle r="14" class="weld-hit"/);
    expect(html).toMatch(/r="26" class="port-hit"/);
    expect(html.match(/aria-label="Break this joint"/g)).toHaveLength(2);
  });

  it('draws no joint target when nothing can break it', () => {
    expect(markup(false)).not.toContain('class="weld"');
  });
});

describe('a joint shows its brackets on hover and focus, and nothing at rest', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  /** The last `prop` declared by a rule whose selector list contains `selector` exactly. */
  const last = (selector: string, prop: string): string | undefined => {
    const hits = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter((m) => m[1]!.split(',').map((x) => x.trim()).includes(selector))
      .flatMap((m) => [...m[2]!.matchAll(new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'g'))].map((d) => d[1]!.trim()));
    return hits[hits.length - 1];
  };

  /*
   * MUTATION PROOF, run: delete `visibility: hidden;` from `.weld-bracket`.
   * Fails with `expected undefined to be 'hidden'`. Deleting the
   * `.weld:focus-visible .weld-bracket` selector fails with `expected
   * undefined to be 'visible'`: keyboard users would never see which joint
   * they are about to break.
   */
  it('hides the brackets at rest and shows them on hover and keyboard focus', () => {
    expect(last('.weld-bracket', 'visibility')).toBe('hidden');
    expect(last('.weld:hover .weld-bracket', 'visibility')).toBe('visible');
    expect(last('.weld:focus-visible .weld-bracket', 'visibility')).toBe('visible');
    expect(last('.weld', 'cursor')).toBe('pointer');
  });
});

describe('the Undo and Redo controls', () => {
  const html = (s: EditorState) =>
    renderToStaticMarkup(
      createElement(UndoControl, {
        last: lastStep(s),
        next: nextStep(s),
        onUndo: () => undefined,
        onRedo: () => undefined,
      }),
    );
  const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };

  /*
   * MUTATION PROOF, run: drop `aria-disabled` from the Undo button. Fails
   * with `expected 1 to be 2`: only Redo still says it is disabled.
   */
  it('are disabled, by attribute and by ARIA, with nothing to undo or redo, which is first paint', () => {
    const first = html(START);
    expect(first.split('disabled=""').length - 1).toBe(2);
    expect(first.split('aria-disabled="true"').length - 1).toBe(2);
    expect(first).toContain('aria-label="Nothing to undo"');
    expect(first).toContain('aria-label="Nothing to redo"');
    expect(first).toContain('>Undo<');
    expect(first).toContain('>Redo<');
  });

  /*
   * Decision 8A names every step. MUTATION PROOF, run: name a break "joint" in
   * `UndoControl`. Fails with `expected '<button aria-disabled="false">Undo
   * jo…' to contain '>Undo break<'`.
   */
  it('name the step each would take, through several steps back and forward', () => {
    const placed = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    expect(html(placed)).toContain('>Undo place<');
    expect(html(placed)).toContain('aria-disabled="false"');

    const two = reduce(placed, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    const w = two.graph.welds[0]!;
    const broken = reduce(two, { kind: 'breakWeld', a: w.a, b: w.b }, ports);
    expect(html(broken)).toContain('>Undo break<');

    const undone = reduce(broken, { kind: 'undo' }, ports);
    expect(html(undone)).toContain('>Undo place<');
    expect(html(undone)).toContain('>Redo break<');

    const empty = reduce(reduce(undone, { kind: 'undo' }, ports), { kind: 'undo' }, ports);
    expect(undoLabel(lastStep(empty))).toBe('Undo');
    expect(html(empty)).toContain('>Redo place<');
  });
});

