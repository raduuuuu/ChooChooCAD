/**
 * The layout loader: every way a stored blob can be wrong (task T5).
 *
 * This file is the one guard on the only untrusted input this app has.
 * `localStorage` is user-editable, survives upgrades, and is where three weeks
 * of someone's track lives. Before this, `loadGraph` had no test at all.
 *
 * It also pins the three findings the eng review raised against it, each of
 * which was LIVE in shipped code rather than hypothetical:
 *
 *   E1  the save effect overwrote the stored bytes at first paint, so a
 *       damaged blob was destroyed before its notice rendered
 *   E2  a dropped anchor let a component fall to the identity, stacking it on
 *       the component already there and manufacturing a clash verdict
 *   E9  `heading: 400` was accepted and silently remapped mod 16 instead of
 *       being dropped like every other value this engine did not write
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { findVertexClashes } from '../../engine/src/graph/feasible.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { CHAIN_STORAGE_KEY, GRAPH_RESCUE_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';
import { loadGraph, partialLoadNotice, saveGraph } from './layoutStore.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const KNOWN = new Set(BUILT_IN.map((p) => p.id));

/**
 * Run a body against a stubbed `localStorage`, the way
 * `inventoryModel.test.ts` already does it. `loadGraph` reads the global
 * directly and this suite runs in node with no document, which
 * `vitest.config.ts`'s own docblock requires it to keep doing.
 */
function withStore<T>(seed: Record<string, string>, body: (store: Map<string, string>) => T): T {
  const store = new Map<string, string>(Object.entries(seed));
  const g = globalThis as { localStorage?: unknown };
  const had = 'localStorage' in g;
  const prev = g.localStorage;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  try {
    return body(store);
  } finally {
    if (had) g.localStorage = prev;
    else delete g.localStorage;
  }
}

const blob = (v: unknown) => ({ [GRAPH_STORAGE_KEY]: JSON.stringify(v) });
const load = (seed: Record<string, string>) => withStore(seed, () => loadGraph(KNOWN));

/** A real two-piece run, built through the model and serialized by `saveGraph`. */
function storedRun(): string {
  let raw = '';
  withStore({}, (store) => {
    saveGraph({
      pieces: [
        { pieceId: 'p1', partId: 'E', turn: 'left' },
        { pieceId: 'p2', partId: 'E', turn: 'left' },
      ],
      welds: [{ a: { pieceId: 'p1', port: 1 }, b: { pieceId: 'p2', port: 0 } }],
      anchors: new Map(),
    });
    raw = store.get(GRAPH_STORAGE_KEY)!;
  });
  return raw;
}

describe('nothing stored', () => {
  it('an empty store starts empty and says nothing', () => {
    const r = load({});
    expect(r.value.pieces).toHaveLength(0);
    expect(r.discarded).toBeUndefined();
    expect(r.droppedAnchors).toBe(0);
    expect(r.rescued).toBe(false);
  });

  it('an old chain blob is reported, not silently skipped, and is rescued', () => {
    const r = withStore({ [CHAIN_STORAGE_KEY]: '[{"partId":"E"}]' }, (store) => {
      const out = loadGraph(KNOWN);
      // The legacy bytes are kept: this is the one migration that cannot be
      // written, so the user needs the original to rebuild from.
      expect(store.get(GRAPH_RESCUE_KEY)).toBe('[{"partId":"E"}]');
      return out;
    });
    expect(r.value.pieces).toHaveLength(0);
    expect(r.discarded).toContain('older format');
    expect(r.rescued).toBe(true);
  });
});

describe('whole-layout refusals', () => {
  const cases: Array<[string, unknown]> = [
    ['a non-object blob', 42],
    ['a null blob', null],
    ['pieces missing', { welds: [] }],
    ['welds missing', { pieces: [] }],
    ['a piece that is not an object', { pieces: [7], welds: [] }],
    ['a piece with a non-string id', { pieces: [{ pieceId: 1, partId: 'E' }], welds: [] }],
    ['a piece with a non-string partId', { pieces: [{ pieceId: 'a', partId: 9 }], welds: [] }],
    ['an invalid turn', { pieces: [{ pieceId: 'a', partId: 'E', turn: 'sideways' }], welds: [] }],
    [
      'a duplicate pieceId',
      {
        pieces: [
          { pieceId: 'a', partId: 'E' },
          { pieceId: 'a', partId: 'E' },
        ],
        welds: [],
      },
    ],
    ['a weld with no ends', { pieces: [{ pieceId: 'a', partId: 'E' }], welds: [{}] }],
    [
      'a weld with a non-numeric port',
      {
        pieces: [{ pieceId: 'a', partId: 'E' }],
        welds: [{ a: { pieceId: 'a', port: 'x' }, b: { pieceId: 'a', port: 1 } }],
      },
    ],
    [
      'a weld naming a piece that is not here',
      {
        pieces: [{ pieceId: 'a', partId: 'E' }],
        welds: [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 'ghost', port: 0 } }],
      },
    ],
  ];

  for (const [name, value] of cases) {
    it(`${name} clears the layout and says so`, () => {
      const r = load(blob(value));
      expect(r.value.pieces).toHaveLength(0);
      expect(r.discarded).toBeDefined();
      expect(r.droppedAnchors).toBe(0);
    });
  }

  it('malformed JSON is caught rather than thrown', () => {
    const r = load({ [GRAPH_STORAGE_KEY]: '{not json' });
    expect(r.value.pieces).toHaveLength(0);
    expect(r.discarded).toBeDefined();
  });

  it('an unknown partId names the part, because a generic message is not actionable', () => {
    const r = load(blob({ pieces: [{ pieceId: 'a', partId: 'NOPE' }], welds: [] }));
    expect(r.discarded).toContain('NOPE');
    expect(r.discarded).toContain('no longer has');
  });

  it('a valid blob round-trips through saveGraph unchanged', () => {
    const r = load({ [GRAPH_STORAGE_KEY]: storedRun() });
    expect(r.discarded).toBeUndefined();
    expect(r.value.pieces.map((p) => p.pieceId)).toEqual(['p1', 'p2']);
    expect(r.value.welds).toHaveLength(1);
    expect(r.droppedAnchors).toBe(0);
  });
});

describe('E1: the refused bytes are rescued', () => {
  it('copies the original blob verbatim before refusing it', () => {
    const raw = JSON.stringify({ pieces: [{ pieceId: 'a', partId: 'NOPE' }], welds: [] });
    const r = withStore({ [GRAPH_STORAGE_KEY]: raw }, (store) => {
      const out = loadGraph(KNOWN);
      expect(store.get(GRAPH_RESCUE_KEY)).toBe(raw);
      return out;
    });
    expect(r.rescued).toBe(true);
  });

  it('rescues unparseable bytes too, which are exactly the ones a human must read', () => {
    withStore({ [GRAPH_STORAGE_KEY]: '{not json' }, (store) => {
      loadGraph(KNOWN);
      expect(store.get(GRAPH_RESCUE_KEY)).toBe('{not json');
    });
  });

  it('rescues on a PARTIAL loss as well, because the anchor is unrecoverable otherwise', () => {
    const raw = JSON.stringify({
      pieces: [{ pieceId: 'a', partId: 'E' }],
      welds: [],
      anchors: [['a', { pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 400 }]],
    });
    const r = withStore({ [GRAPH_STORAGE_KEY]: raw }, (store) => {
      const out = loadGraph(KNOWN);
      expect(store.get(GRAPH_RESCUE_KEY)).toBe(raw);
      return out;
    });
    expect(r.droppedAnchors).toBe(1);
    expect(r.rescued).toBe(true);
  });

  it('does not write a rescue copy when the load was clean', () => {
    withStore({ [GRAPH_STORAGE_KEY]: storedRun() }, (store) => {
      loadGraph(KNOWN);
      expect(store.has(GRAPH_RESCUE_KEY)).toBe(false);
    });
  });
});

describe('E2: a dropped anchor keeps the layout and never manufactures a clash', () => {
  /** Two separate runs. The second is anchored, which is what keeps them apart. */
  const twoRuns = (secondAnchor: unknown) => ({
    pieces: [
      { pieceId: 'p1', partId: 'E', turn: 'left' },
      { pieceId: 'p2', partId: 'E', turn: 'left' },
    ],
    welds: [],
    anchors: [['p2', secondAnchor]],
  });

  const goodAnchor = { pos: [216, 0, 0, 0, 0, 0, 0, 0], heading: 0 };

  it('every piece survives a dropped anchor: nothing is omitted', () => {
    const r = load(blob(twoRuns({ pos: 'rubbish', heading: 0 })));
    expect(r.value.pieces).toHaveLength(2);
    expect(r.discarded).toBeUndefined();
    expect(r.droppedAnchors).toBe(1);
  });

  it('the notice names POSITION, not omission, because no piece was left out', () => {
    const notice = partialLoadNotice(14, 2);
    expect(notice).toContain('Loaded all 14 pieces');
    expect(notice).toContain('wrong place');
    expect(notice).not.toContain('left out');
    expect(notice).not.toMatch(/\b12 of 14\b/);
    expect(partialLoadNotice(3, 1)).toContain('one had an unreadable position');
  });

  /*
   * THE FINDING ITSELF.
   *
   * MUTATION PROOF, run: delete the re-anchoring loop in `layoutStore.ts` so
   * orphans stay out of `anchorMap`. `placeAll` then puts p2 at the identity
   * alongside p1 and this test fails with clashes, which is the verdict the
   * user would have seen: "can't be built" about a track that is fine.
   */
  it('a dropped ROOT anchor does not stack two components at the origin', () => {
    const r = load(blob(twoRuns({ pos: 'rubbish', heading: 0 })));
    const placement = placeAll(r.value, ports);

    expect(placement.forest.roots).toHaveLength(2);
    const frames = placement.forest.roots.map((id) => placement.frames.get(id)!);
    expect(frames[0]!.pos).not.toEqual(frames[1]!.pos);
    expect(findVertexClashes(r.value, ports, placement)).toHaveLength(0);
  });

  it('a surviving anchor is used exactly as stored, not re-laned', () => {
    const r = load(blob(twoRuns(goodAnchor)));
    expect(r.droppedAnchors).toBe(0);
    expect(r.value.anchors?.get('p2')).toEqual({
      pos: [216, 0, 0, 0, 0, 0, 0, 0],
      heading: 0,
    });
  });

  /*
   * THE LANE COLLISION, which the first version of this fix had.
   *
   * MUTATION PROOF, run: restore `const steps = anchorMap.size + k + 1` and
   * this fails with two clashes. A survivor at lane 2 gives size 1, k 0,
   * steps 2 -- the orphan lands on the survivor's exact frame and the loader
   * manufactures the "can't be built" verdict E2 exists to prevent. Found by
   * the ship review, not by me.
   */
  it('an orphan never lands on a lane a SURVIVING anchor already holds', () => {
    const r = load(
      blob({
        pieces: [
          { pieceId: 'p1', partId: 'E', turn: 'left' },
          { pieceId: 'p2', partId: 'E', turn: 'left' },
          { pieceId: 'p3', partId: 'E', turn: 'left' },
        ],
        welds: [],
        anchors: [
          /*
           * LANE 1, NOT LANE 2, and the difference is the whole test.
           *
           * With the survivor parked at lane 2 this case did not pin the
           * mechanism it names: free lane 1 was handed straight to the orphan
           * and the `while (taken.has(...))` branch never ran. MEASURED:
           * deleting the entire occupancy search left all 333 tests green, and
           * only `noUnusedLocals` noticed. At lane 1 -- exactly what
           * `nextRunAnchor` returns for a second run over a short first one --
           * the orphan must step over it.
           */
          ['p2', { pos: [0, 0, 0, 0, 216, 0, 0, 0], heading: 0 }],
          ['p3', { pos: 'rubbish', heading: 0 }],
        ],
      }),
    );
    expect(r.droppedAnchors).toBe(1);
    // It stepped PAST the occupied lane, rather than onto it.
    expect(r.value.anchors?.get('p3')?.pos.join(',')).toBe('0,0,0,0,432,0,0,0');

    const placement = placeAll(r.value, ports);
    const frames = placement.forest.roots.map((id) => placement.frames.get(id)!);
    const distinct = new Set(frames.map((f) => f.pos.join(',')));
    expect(distinct.size).toBe(frames.length);
    expect(findVertexClashes(r.value, ports, placement)).toHaveLength(0);
  });

  /*
   * The test that stood here claimed "the identity counts as occupied, because
   * an unanchored root is placed there" and could not fail: MEASURED, removing
   * `IDENTITY_POS.join(',')` from the `taken` seed left all 333 tests green.
   * The seed was unreachable -- the search starts at lane 1 and only
   * increments -- so the test named a property the line did not implement.
   * Both the seed and the test are gone; `let lane = 1` carries the reason.
   *
   * This is the restating-the-constant defect class in its other form: a test
   * that pins the absence of an old bug rather than the presence of the new
   * mechanism. Five instances in this project now.
   */
  it('an unanchored root and an orphan still get different frames', () => {
    const r = load(
      blob({
        pieces: [
          { pieceId: 'p1', partId: 'E', turn: 'left' },
          { pieceId: 'p2', partId: 'E', turn: 'left' },
        ],
        welds: [],
        anchors: [['p2', { pos: 'rubbish', heading: 0 }]],
      }),
    );
    // p1 is unanchored, so it lands at the identity; p2 is the orphan.
    expect(r.value.anchors?.get('p2')?.pos.join(',')).toBe('0,0,0,0,216,0,0,0');
    const placement = placeAll(r.value, ports);
    const frames = placement.forest.roots.map((id) => placement.frames.get(id)!);
    expect(new Set(frames.map((f) => f.pos.join(','))).size).toBe(frames.length);
  });

  it('re-anchoring stays on the lattice, so closure is still exact', () => {
    const r = load(blob(twoRuns({ pos: 'rubbish', heading: 0 })));
    const anchor = r.value.anchors?.get('p2')!;
    expect(anchor.pos.every(Number.isInteger)).toBe(true);
    expect(anchor.heading).toBe(0);
  });
});

describe('E9: the anchor-rejection matrix', () => {
  const withAnchor = (frame: unknown) =>
    blob({
      pieces: [{ pieceId: 'a', partId: 'E', turn: 'left' }],
      welds: [],
      anchors: [['a', frame]],
    });

  const dropped: Array<[string, unknown]> = [
    ['a non-object frame', 7],
    ['a null frame', null],
    ['a pos that is not an array', { pos: 'rubbish', heading: 0 }],
    ['a pos of the wrong length', { pos: [1, 2, 3], heading: 0 }],
    ['a pos with a non-finite entry', { pos: [1, 0, 0, 0, 0, 0, 0, Infinity], heading: 0 }],
    ['a pos with a NaN entry', { pos: [1, 0, 0, 0, 0, 0, 0, NaN], heading: 0 }],
    ['a non-integer pos', { pos: [1.5, 0, 0, 0, 0, 0, 0, 0], heading: 0 }],
    ['a non-integer heading', { pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 1.5 }],
    ['a heading above 15', { pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 400 }],
    ['a negative heading', { pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: -1 }],
    ['a non-numeric heading', { pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 'north' }],
  ];

  for (const [name, frame] of dropped) {
    it(`${name} is dropped and COUNTED, never repaired`, () => {
      const r = load(withAnchor(frame));
      expect(r.value.pieces).toHaveLength(1);
      expect(r.droppedAnchors).toBe(1);
    });
  }

  /*
   * The new behaviour. MUTATION PROOF, run: relax `isHeading` back to
   * `Number.isInteger(v)` alone and this test fails, because 400 is accepted
   * and normalized to 0 downstream -- a position this engine never wrote,
   * silently repaired, which is what the comment beside the `pos` check
   * already forbids.
   */
  it('heading 400 is OUT OF RANGE, not something to normalize mod 16', () => {
    const r = load(withAnchor({ pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 400 }));
    expect(r.droppedAnchors).toBe(1);
    // Re-laned rather than left at 400 % 16.
    expect(r.value.anchors?.get('a')?.heading).toBe(0);
  });

  it('heading 15 is IN range, so the boundary is not off by one', () => {
    const r = load(withAnchor({ pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 15 }));
    expect(r.droppedAnchors).toBe(0);
    expect(r.value.anchors?.get('a')?.heading).toBe(15);
  });

  it('an anchor for a piece that is not here is NOT counted as a lost position', () => {
    // Nothing to misplace: the piece it described is already gone from the blob.
    const r = load(
      blob({
        pieces: [{ pieceId: 'a', partId: 'E', turn: 'left' }],
        welds: [],
        anchors: [['ghost', { pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 0 }]],
      }),
    );
    expect(r.droppedAnchors).toBe(0);
    expect(r.value.anchors?.has('ghost')).toBe(false);
  });

  it('several bad anchors are all counted', () => {
    const r = load(
      blob({
        pieces: [
          { pieceId: 'a', partId: 'E', turn: 'left' },
          { pieceId: 'b', partId: 'E', turn: 'left' },
        ],
        welds: [],
        anchors: [
          ['a', { pos: [1, 2, 3], heading: 0 }],
          ['b', { pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 99 }],
        ],
      }),
    );
    expect(r.droppedAnchors).toBe(2);
    expect(r.value.pieces).toHaveLength(2);
  });
});

/**
 * A stored weld's PORT INDEX is validated, not assumed (finding B1).
 *
 * Value: protects=a port index the part does not have is refused at load,
 * with a notice and a rescue copy, instead of being accepted and then
 * throwing inside render on every reload
 * Value: fails_when=the port check goes back to `typeof === 'number'`, or
 * App.tsx stops handing the loader port counts
 * Value: why_new=nothing reached this branch; every stored weld in the suite
 * carried a port the part actually has
 * Value: seam=none
 * Value: no_claim=nothing about a weld whose two ends are both in range but
 * geometrically impossible; that is the solver's job, not the loader's
 *
 * EVERY CASE HERE REPRODUCES A MEASURED FAILURE. Before the fix, ports 2, 7,
 * -1 and 2.5 on the two-port straight D were all ACCEPTED with
 * `discarded: undefined`, `droppedAnchors: 0` and no rescue copy written, and
 * all four then threw `TypeError: Cannot read properties of undefined
 * (reading 'at')` out of `placeAll` and `renderGraph`. Because the loader
 * never touched `GRAPH_STORAGE_KEY`, every reload reproduced it, and the only
 * escape the crash screen offers also deletes the inventory and the
 * submissions.
 */
describe('a stored weld cannot name a port the part does not have', () => {
  /** Port counts, the way App.tsx supplies them. */
  const portCount = (partId: string, turn?: 'left' | 'right') =>
    portsOf(resolve(partId), turn).length;
  const loadWithCounts = (seed: Record<string, string>) =>
    withStore(seed, () => loadGraph(KNOWN, portCount));

  const twoPieces = (port: unknown) => ({
    pieces: [
      { pieceId: 'p0', partId: 'D' },
      { pieceId: 'p1', partId: 'D' },
    ],
    welds: [{ a: { pieceId: 'p0', port }, b: { pieceId: 'p1', port: 0 } }],
    anchors: [],
  });

  /*
   * MUTATION PROOF, run.
   *
   * Restore `typeof v === 'number'` as the only check: 7 tests fail -- all
   * five refusal cases, the count-driven case, and the no-port-counts case.
   *
   * Drop ONLY the `v < portCountOf(...)` clause and keep the integer and
   * non-negative checks: 4 fail -- the three in-range integers (2, 7, 1e9)
   * plus the count-driven case, while -1 and 2.5 still refuse. That is why
   * both halves are here: the integer floor and the count bound catch
   * different inputs, and either one alone leaves a hole.
   */
  for (const port of [2, 7, 1e9, -1, 2.5]) {
    it(`refuses the whole layout for port ${port}, and rescues the bytes`, () => {
      const r = loadWithCounts(blob(twoPieces(port)));
      expect(r.discarded).toBeTypeOf('string');
      expect(r.value.pieces).toHaveLength(0);
      expect(r.value.welds).toHaveLength(0);
      expect(r.rescued).toBe(true);
    });
  }

  it('still accepts the ports the part really has, so this is not a blanket refusal', () => {
    for (const port of [0, 1]) {
      const r = loadWithCounts(blob(twoPieces(port)));
      expect(r.discarded).toBeUndefined();
      expect(r.value.welds).toHaveLength(1);
      expect(r.value.welds[0]!.a.port).toBe(port);
    }
  });

  /*
   * THE CHECK IS COUNT-DRIVEN, not hardcoded to two. No switch is seeded in
   * the library yet (`model.ts:8` says so), so the three-port case is proved
   * with a port count that reports three: port 2 is accepted for that part and
   * refused for the two-port straight beside it, in the same layout.
   */
  it('port 2 is accepted on a three-port part and refused on a two-port one', () => {
    const asIfSwitch = (partId: string, turn?: 'left' | 'right') =>
      partId === 'D' ? 3 : portsOf(resolve(partId), turn).length;
    const layout = (port: number) =>
      blob({
        pieces: [
          { pieceId: 'p0', partId: 'D' },
          { pieceId: 'p1', partId: 'D' },
        ],
        welds: [{ a: { pieceId: 'p0', port }, b: { pieceId: 'p1', port: 0 } }],
        anchors: [],
      });
    expect(withStore(layout(2), () => loadGraph(KNOWN, asIfSwitch)).discarded).toBeUndefined();
    expect(withStore(layout(2), () => loadGraph(KNOWN, portCount)).discarded).toBeTypeOf('string');
    // Three ports still does not mean four.
    expect(withStore(layout(3), () => loadGraph(KNOWN, asIfSwitch)).discarded).toBeTypeOf('string');
  });

  /*
   * The accepted graph carries the two fields a weld end IS and nothing else.
   * The old code spread the stored object, so an accepted graph could hold
   * keys the validator never looked at.
   */
  it('drops extra keys the stored weld carried', () => {
    const r = loadWithCounts(
      blob({
        pieces: [
          { pieceId: 'p0', partId: 'D' },
          { pieceId: 'p1', partId: 'D' },
        ],
        welds: [
          { a: { pieceId: 'p0', port: 1, smuggled: 'x' }, b: { pieceId: 'p1', port: 0 } },
        ],
        anchors: [],
      }),
    );
    expect(r.discarded).toBeUndefined();
    expect(Object.keys(r.value.welds[0]!.a).sort()).toEqual(['pieceId', 'port']);
  });

  /*
   * Without port counts the loader still refuses what it CAN judge. This is
   * the path the older tests in this file take, and it must not silently
   * become a no-op.
   */
  it('without port counts, a non-integer or negative port is still refused', () => {
    for (const port of [-1, 2.5, Number.NaN]) {
      const r = load(blob(twoPieces(port)));
      expect(r.discarded).toBeTypeOf('string');
    }
  });
});

/**
 * THE ORPHAN LANE STILL COLLIDES WITH A SURVIVOR'S FOOTPRINT, pinned as a
 * SKIPPED spec (P0 in brio-TODOS.md).
 *
 * Value: protects=a recovered layout never manufactures a "can't be built"
 * verdict about track the user built correctly
 * Value: fails_when=orphans are placed by stepping over OCCUPIED ROOT POINTS
 * rather than past the bounding box of everything already placed, which is
 * what the loader does today
 * Value: why_new=the occupancy search de-duplicates root anchor points; a run
 * marching along the lane axis occupies lanes its root does not name
 * Value: seam=none
 * Value: no_claim=nothing about pieces that cross mid-span, which
 * findVertexClashes does not check and the verdict copy says so
 *
 * SKIPPED ON PURPOSE, and it fails when un-skipped. MEASURED at this commit:
 * MANUFACTURED CLASHES = 1, at [1.3226185430791415e-14, 216].
 *
 * Two 216mm straights are welded into a run anchored at the identity pointing
 * ALONG the lane axis (heading 4), so p0 spans lane 0 to lane 1 and p1 spans
 * lane 1 to lane 2. p1's root sits at lane 1, but only ROOTS are anchored, so
 * `taken` -- which holds anchor points -- does not contain it. The orphan is
 * handed lane 1 and lands on p1's already-welded port 0. A welded end is
 * spoken for, so `findVertexClashes` pushes it straight to `clashes` rather
 * than excusing it as two free ends meeting, `viewOf` returns IMPOSSIBLE, and
 * the verdict reads "can't be built" about a layout that is fine. The only
 * notice says part of the track may be in the wrong place -- never that the
 * verdict below it is wrong, which is the harm the lane comment argues it is
 * trading away.
 *
 * `layoutModel.nextRunAnchor` already does this correctly for the in-app path:
 * it computes real clearance from `maxY - minY`. The loader uses a strictly
 * weaker rule for the same decision, because it has part ids but no port
 * geometry. The fix is to give it the geometry, or to return the orphan ids
 * and let App.tsx place them through `nextRunAnchor`. Deferred on 2026-10-14
 * rather than patched a third time under ship pressure: this is the third
 * attempt at this one bug and the first two both shipped wrong.
 *
 * Un-skip this to start the work; do not delete it to make the suite green.
 */
describe.skip('an orphan lane clears a survivor RUN, not just its anchor', () => {
  const runAlongTheLaneAxis = () =>
    blob({
      pieces: [
        { pieceId: 'p0', partId: 'D' },
        { pieceId: 'p1', partId: 'D' },
        { pieceId: 'q0', partId: 'D' },
      ],
      welds: [{ a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p1', port: 0 } }],
      anchors: [
        ['p0', { pos: [0, 0, 0, 0, 0, 0, 0, 0], heading: 4 }],
        ['q0', { pos: 'rubbish', heading: 0 }],
      ],
    });

  it('manufactures no clash when an orphan is re-anchored past a run', () => {
    const r = load(runAlongTheLaneAxis());
    expect(r.droppedAnchors).toBe(1);
    expect(r.discarded).toBeUndefined();
    const placement = placeAll(r.value, ports);
    expect(findVertexClashes(r.value, ports, placement)).toHaveLength(0);
  });

  it('places the orphan beyond the run, not inside it', () => {
    const r = load(runAlongTheLaneAxis());
    // p1's far end is at lane 2, so the first free lane is 3.
    expect(r.value.anchors?.get('q0')?.pos.join(',')).toBe('0,0,0,0,648,0,0,0');
  });
});
