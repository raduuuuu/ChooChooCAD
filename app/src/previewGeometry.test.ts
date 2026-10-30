/**
 * THE DRAWINGS ON THE PART CARDS (docs/plan/2026-10-30-part-previews.md).
 *
 * Value: protects=every built-in part has a drawing; the drawing's pose is the
 * one a first placement lands in (5A); look-alike families draw differently
 * (8A); a corrected part's drawing changes (eng D1); a part that cannot be
 * drawn gets an empty box instead of breaking the list (4A)
 * Value: fails_when=a part stops drawing, the first placement and the drawing
 * stop agreeing on pose, end marks are dropped, drawings are cached by id, or
 * the per-part catch goes
 * Value: why_new=no part drawings existed
 * Value: seam=none: the real catalogue, reducer and renderer
 * Value: no_claim=how the drawings look or the card's row height, which were
 * checked in the browser (eng D2)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver, resolveLibrary } from '../../engine/data/library.js';
import { IDENTITY, portsOf, type Piece } from '../../engine/src/graph/model.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import type { Part } from '../../engine/src/parts/schema.js';
import { reduce, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { previews } from './previewGeometry.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

describe('every part card has a drawing', () => {
  it('for every built-in part', () => {
    const map = previews(BUILT_IN);
    for (const part of BUILT_IN) expect(map.get(part.id), part.id).not.toBeNull();
  });

  /*
   * THE DRAWING IS THE FIRST PLACEMENT (5A). The preview draws each part at
   * the identity frame, turned left; this holds the editor to that: the first
   * piece put on an empty floor lands exactly there.
   *
   * MUTATION PROOF, run: `addPiece`'s unattached branch starting a run turned
   * right (`{ port: 0, turn: 'right' }`): fails with `A2: expected 'right' to
   * be 'left'`.
   */
  it('is drawn in the pose a double-click on an empty floor places it in', () => {
    for (const part of BUILT_IN) {
      const empty: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
      const s = reduce(empty, { kind: 'add', partId: part.id, turn: 'left' }, ports);
      const piece = s.graph.pieces[0]!;
      expect(piece.turn ?? 'left', part.id).toBe('left');
      expect(placeAll(s.graph, ports).frames.get(piece.pieceId), part.id).toEqual(IDENTITY);
    }
  });
});

describe('look-alike parts draw differently (8A)', () => {
  const families = [
    ['A', 'B', 'C'], ['A1', 'B1', 'C1'], ['A2', 'B2', 'C2'], ['L', 'M'], ['O1', 'P1'],
    ['I', 'J'], ['O', 'P'], ['F1', 'G1'], ['N', 'N1'],
  ];

  /*
   * MUTATION PROOF, run: every end drawn as a peg (`polarity: 'peg'` in
   * `previewOf`'s `ends`): fails with `A and B: expected '{"transform":…' not
   * to be '{"transform":…'`.
   */
  it('each family member has its own end marks', () => {
    const map = previews(BUILT_IN);
    for (const family of families) {
      for (let i = 0; i < family.length; i++) {
        for (let j = i + 1; j < family.length; j++) {
          const [a, b] = [family[i]!, family[j]!];
          expect(JSON.stringify(map.get(a)), `${a} and ${b}`).not.toBe(JSON.stringify(map.get(b)));
        }
      }
    }
  });
});

describe('the drawings follow the library', () => {
  /*
   * A CORRECTION KEEPS ITS ID AND CHANGES ITS SHAPE, which is why the
   * drawings are rebuilt per library and not cached by id (eng D1). A Lillabo
   * 45-degree curve corrected to 67.5 degrees must draw differently.
   */
  it('a corrected curve draws its corrected shape', () => {
    const c45 = BUILT_IN.find((p) => p.id === 'IKEA-C45') as Extract<Part, { kind: 'curve' }>;
    const corrected = resolveLibrary([
      {
        submissionId: 'sub',
        at: '2026-10-30T10:00:00Z',
        part: {
          ...c45,
          arcSteps: 3,
          dimensions: { status: 'user-measured', source: 'test', submittedAt: '2026-10-30T10:00:00Z', corroborations: 1 },
        },
      },
    ]);
    expect(JSON.stringify(previews(corrected).get('IKEA-C45'))).not.toBe(JSON.stringify(previews(BUILT_IN).get('IKEA-C45')));
  });

  /*
   * MUTATION PROOF, run: no try/catch in `previews`: fails with `BROKEN
   * draws nothing`.
   */
  it('a part that cannot be drawn gets an empty box and the rest still draw', () => {
    const broken = {
      ...(BUILT_IN.find((p) => p.id === 'H') as Extract<Part, { kind: 'multi-road' }>),
      id: 'BROKEN',
      ports: [],
      roads: [],
    };
    const map = previews([...BUILT_IN, broken]);
    expect(map.get('BROKEN')).toBeNull();
    expect(map.get('A')).not.toBeNull();
  });
});
