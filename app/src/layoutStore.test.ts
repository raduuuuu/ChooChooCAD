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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { removeWeld } from '../../engine/src/graph/edit.js';
import { findVertexClashes } from '../../engine/src/graph/feasible.js';
import { portFrame } from '../../engine/src/graph/frames.js';
import { toXY } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { CHAIN_STORAGE_KEY, GRAPH_RESCUE_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';
import { loadGraph, partialLoadNotice, saveGraph, savesSuppressed } from './layoutStore.js';

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
/*
 * REAL PORT GEOMETRY, which is the only thing `loadGraph` accepts now.
 *
 * The parameter used to be an OPTIONAL port count, so a helper that omitted
 * it ran a weaker branch than production -- every pre-existing E2/E9 case
 * included. It is required geometry since the orphan placement needs to know
 * where components actually sit, not just how many ends they have, so the
 * suite and the shipped path cannot diverge here any more.
 */
const load = (seed: Record<string, string>) => withStore(seed, () => loadGraph(KNOWN, ports));

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
      const out = loadGraph(KNOWN, ports);
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
      const out = loadGraph(KNOWN, ports);
      expect(store.get(GRAPH_RESCUE_KEY)).toBe(raw);
      return out;
    });
    expect(r.rescued).toBe(true);
  });

  it('rescues unparseable bytes too, which are exactly the ones a human must read', () => {
    withStore({ [GRAPH_STORAGE_KEY]: '{not json' }, (store) => {
      loadGraph(KNOWN, ports);
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
      const out = loadGraph(KNOWN, ports);
      expect(store.get(GRAPH_RESCUE_KEY)).toBe(raw);
      return out;
    });
    expect(r.droppedAnchors).toBe(1);
    expect(r.rescued).toBe(true);
  });

  it('does not write a rescue copy when the load was clean', () => {
    withStore({ [GRAPH_STORAGE_KEY]: storedRun() }, (store) => {
      loadGraph(KNOWN, ports);
      expect(store.has(GRAPH_RESCUE_KEY)).toBe(false);
    });
  });
});

describe('`uncopied`: the save is held only for live bytes that have no copy', () => {
  /** A store whose rescue write fails, as a full quota or private browsing makes it. */
  const fullQuota = (seed: Record<string, string>) =>
    withStore(seed, (store) => {
      const ls = (globalThis as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage;
      ls.setItem = (k, v) => {
        if (k === GRAPH_RESCUE_KEY) throw new Error('QuotaExceededError');
        store.set(k, v);
      };
      return loadGraph(KNOWN, ports);
    });
  /** One refused by a check, one by the parser: two different return paths. */
  const refused = blob({ pieces: [{ pieceId: 'a', partId: 'NOPE' }], welds: [] });
  const unparseable = { [GRAPH_STORAGE_KEY]: '{not json' };
  const partial = blob({
    pieces: [{ pieceId: 'a', partId: 'E' }],
    welds: [],
    anchors: [['a', { pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 400 }]],
  });

  /*
   * MUTATION PROOF, run: the legacy path back to the old gate
   * (`uncopied: !rescue(legacy)`): fails with `expected true to be false //
   * Object.is equality`, the filed bug, a full quota holding the save of a
   * user upgrading from the chain format.
   */
  it('an old chain blob is never at risk, because no save writes the chain key', () => {
    const r = fullQuota({ [CHAIN_STORAGE_KEY]: '[{"partId":"E"}]' });
    expect(r.rescued).toBe(false);
    expect(r.discarded).toContain('older format');
    expect(r.uncopied).toBe(false);
  });

  /*
   * MUTATION PROOFS, run:
   * - `refuse` reporting `uncopied: false`: fails with `expected false to be
   *   true // Object.is equality`.
   * - the parse failure's `catch` reporting `uncopied: false`: same failure.
   * - the partial load reporting `uncopied: false`: same failure.
   */
  it('refused, unreadable or partly lost bytes with no copy hold the save', () => {
    expect(fullQuota(refused).uncopied).toBe(true);
    expect(fullQuota(unparseable).uncopied).toBe(true);
    expect(fullQuota(partial).uncopied).toBe(true);
  });

  it('a copy made, a clean load, or nothing stored never holds it', () => {
    expect(load(refused).uncopied).toBe(false);
    expect(load(unparseable).uncopied).toBe(false);
    expect(load(partial).uncopied).toBe(false);
    expect(fullQuota({ [GRAPH_STORAGE_KEY]: storedRun() }).uncopied).toBe(false);
    expect(fullQuota({}).uncopied).toBe(false);
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
   * THE FRONTIER COVERS EVERY COMPONENT, including one with no anchor at all.
   *
   * This fixture has three: `p1` with no stored anchor, which `placeAll` puts
   * at the identity; `p2` anchored at lane 1; and `p3`, the orphan. Both of
   * the first two have to be cleared, and the unanchored one is easy to
   * forget because it never appears in the anchor map.
   *
   * The docblock that stood here was about `anchorMap.size + k + 1`, a
   * `while` branch and an occupancy search -- three mechanisms this commit
   * deleted. It was the same rot the commit removed from the sibling
   * docblock below and left here, which is how these survive: you fix the
   * copy you are looking at.
   *
   * MUTATION PROOF, run: clear anchor POINTS rather than footprints and 6
   * tests fail, this one among them.
   *
   * What this fixture does NOT pin, and a previous version of this comment
   * wrongly claimed it did: skipping unanchored roots in the frontier. That
   * mutation fails the NEXT test, not this one, and the arithmetic below says
   * why -- `p1` spans y 0 to 59.2 while the survivor spans 216 to 275.2, so
   * the frontier is 275.2 whether `p1` counts or not. The claim was written
   * from a mental model and never run, in the commit whose whole subject was
   * that failure mode. It is now stated where it is true.
   *
   * Not pinned, deliberately: `let frontier = 0` versus `-Infinity` is not
   * observable, because `Math.max(1, ...)` already forces lane >= 1. A test
   * for it would assert a difference that cannot exist.
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
          ['p2', { pos: [0, 0, 0, 0, 216, 0, 0, 0], heading: 0 }],
          ['p3', { pos: 'rubbish', heading: 0 }],
        ],
      }),
    );
    expect(r.droppedAnchors).toBe(1);
    /*
     * PAST THE FOOTPRINT, not past the anchor point, which is the P0 fix.
     * MEASURED for this fixture: the unanchored root occupies y 0 to 59.2 and
     * the survivor at lane 1 occupies 216 to 275.2, so the frontier is 275.2.
     * The orphan's bottom edge goes one full spacing above that, 491.2, which
     * rounds up to lane 3. The old rule said 432 -- clear here by luck, since
     * it only ever looked at where anchors START.
     */
    expect(r.value.anchors?.get('p3')?.pos.join(',')).toBe('0,0,0,0,648,0,0,0');

    const placement = placeAll(r.value, ports);
    const frames = placement.forest.roots.map((id) => placement.frames.get(id)!);
    const distinct = new Set(frames.map((f) => f.pos.join(',')));
    expect(distinct.size).toBe(frames.length);
    expect(findVertexClashes(r.value, ports, placement)).toHaveLength(0);
  });

  /*
   * EACH ORPHAN CLEARS THE ONE BEFORE IT, not just the survivors.
   *
   * A survivor at lane 2 and TWO orphans. MEASURED: the survivor occupies
   * y 432 to 491.2, the first orphan is placed at 864 (occupying 864 to
   * 923.2) and the second at 1296 -- each one AT LEAST a full 216mm spacing
   * clear of the previous component's TOP edge, not of its anchor. The actual
   * gaps are 372.8mm, because the required clearance is then rounded up to
   * the next whole lane.
   *
   * This case used to pin the arithmetic bug that preceded the footprint rule
   * (`anchorMap.size + n + 1`, which put the first orphan on the survivor's
   * exact frame). That code no longer exists, so the comment claiming it was
   * the only case in the file that failed under it would have rotted into
   * another unrunnable mutation proof. Replaced with two that do run.
   *
   * MUTATION PROOF, run: measure the frontier only over survivors and never
   * advance it between orphans, and this fails -- both orphans land on the
   * same lane. Revert to clearing anchor POINTS rather than footprints and it
   * fails too, with the first orphan back at lane 1.
   */
  /*
   * A NON-ROOT ORPHAN LEAVES NO ANCHOR, and the cost of getting this wrong is
   * the P0 coming back one user action later.
   *
   * `captureAnchors` (`graph/edit.ts:37`) keeps an existing anchor in
   * preference to the frame a piece was actually at. So an inert anchor left
   * on a non-root is not inert at all: the moment a weld break makes that
   * piece a component root, the stale lane wins.
   *
   * MEASURED before the fix: this exact fixture loaded clean with 0 clashes
   * and reported 2 clashes at [1.32e-14, 216] after one `removeWeld` -- the
   * same coordinate and the same manufactured "can't be built" the whole
   * footprint rule exists to prevent.
   *
   * MUTATION PROOF, run: replace the `anchors.delete(id)` with `continue` and
   * this fails on the post-break clash count.
   */
  it('a non-root orphan leaves no anchor to collide with later', () => {
    const r = load(
      blob({
        pieces: [
          { pieceId: 's1', partId: 'E', turn: 'left' },
          { pieceId: 'a1', partId: 'E', turn: 'left' },
          { pieceId: 'a2', partId: 'E', turn: 'left' },
        ],
        welds: [{ a: { pieceId: 'a1', port: 1 }, b: { pieceId: 'a2', port: 0 } }],
        anchors: [
          ['s1', { pos: [0, 0, 0, 0, 216, 0, 0, 0], heading: 0 }],
          ['a2', { pos: 'rubbish', heading: 0 }],
        ],
      }),
    );
    // a2 is welded to a1, so a1 is the root and a2 has no position of its own.
    expect(r.value.anchors?.has('a2')).toBe(false);
    // No two anchors may share a position.
    const positions = [...(r.value.anchors ?? [])].map(([, f]) => f.pos.join(','));
    expect(new Set(positions).size).toBe(positions.length);

    expect(findVertexClashes(r.value, ports, placeAll(r.value, ports))).toHaveLength(0);
    // And it stays clean through the edit that promotes a2 to a root.
    const broken = removeWeld(r.value, ports, 0);
    expect(findVertexClashes(broken, ports, placeAll(broken, ports))).toHaveLength(0);
  });

  /*
   * THE `- s.min` TERM, which is the only thing making this a FOOTPRINT rule
   * rather than an anchor-point rule for a component that extends BELOW its
   * own anchor. A right-hand curve run marches downward from heading 0.
   *
   * MUTATION PROOF, run: replace `- s.min` with `- provisionalY`, which is
   * what "assume every component's bottom edge is its anchor" means in code,
   * and exactly this test fails. Said as "drop `- s.min`" it does NOT
   * reproduce -- `Math.ceil` puts the correct 836.0 and the mutated 707.2 in
   * the same lane 4, and four other tests fail instead. Before this case existed that mutation kept
   * the whole suite green while producing a 188mm overlap, because the overlap
   * is mid-span and `findVertexClashes` only compares endpoints.
   *
   * Asserts the PROPERTY, not a lane number: every orphan component's lowest
   * point clears the highest point of everything before it by a full spacing.
   */
  it('an orphan run that descends below its anchor still clears the survivor', () => {
    const r = load(
      blob({
        pieces: [
          { pieceId: 's1', partId: 'E', turn: 'left' },
          { pieceId: 'o0', partId: 'E', turn: 'right' },
          { pieceId: 'o1', partId: 'E', turn: 'right' },
          { pieceId: 'o2', partId: 'E', turn: 'right' },
        ],
        welds: [
          { a: { pieceId: 'o0', port: 1 }, b: { pieceId: 'o1', port: 0 } },
          { a: { pieceId: 'o1', port: 1 }, b: { pieceId: 'o2', port: 0 } },
        ],
        anchors: [
          ['s1', { pos: [0, 0, 0, 0, 216, 0, 0, 0], heading: 0 }],
          ['o0', { pos: 'rubbish', heading: 0 }],
        ],
      }),
    );
    const placement = placeAll(r.value, ports);
    const yOf = (id: string) => {
      const piece = r.value.pieces.find((p) => p.pieceId === id)!;
      const ys: number[] = [];
      for (let i = 0; i < ports(piece).length; i++) {
        ys.push(toXY(portFrame(placement, ports, piece, i).pos)[1]);
      }
      return ys;
    };
    const survivorTop = Math.max(...yOf('s1'));
    const orphanBottom = Math.min(...yOf('o0'), ...yOf('o1'), ...yOf('o2'));
    expect(orphanBottom - survivorTop).toBeGreaterThanOrEqual(216);
  });

  /*
   * THE SAME ID TWICE. `anchors` is an ARRAY out of an untrusted blob, so it
   * can name one piece twice. Each entry is counted and each goes into the
   * orphan list, and the placement loop recovers a component's provisional
   * position from its INDEX -- so a duplicate makes the index and the lane
   * disagree unless the list is de-duplicated first.
   *
   * MUTATION PROOF, run: replace `[...new Set(orphans)]` with
   * `orphans.slice()` and this fails, with the lanes shifted out by one
   * duplicate. Nothing else in the suite notices.
   *
   * Honest about the stakes: the direction is conservative either way. The
   * last write for a duplicated id uses the matching provisional y, so the
   * stored anchor is right regardless, and the frontier is over-estimated
   * rather than under. This pins the lanes, not a near-miss.
   */
  it('a duplicated orphan id does not shift the lanes', () => {
    const r = load(
      blob({
        pieces: [
          { pieceId: 's1', partId: 'E', turn: 'left' },
          { pieceId: 'o1', partId: 'E', turn: 'left' },
          { pieceId: 'o2', partId: 'E', turn: 'left' },
        ],
        welds: [],
        anchors: [
          ['s1', { pos: [0, 0, 0, 0, 216, 0, 0, 0], heading: 0 }],
          ['o1', { pos: 'rubbish', heading: 0 }],
          ['o1', { pos: 'rubbish again', heading: 0 }],
          ['o2', { pos: 'rubbish', heading: 0 }],
        ],
      }),
    );
    expect(r.value.anchors?.get('o1')?.pos.join(',')).toBe('0,0,0,0,648,0,0,0');
    expect(r.value.anchors?.get('o2')?.pos.join(',')).toBe('0,0,0,0,1080,0,0,0');
    expect(findVertexClashes(r.value, ports, placeAll(r.value, ports))).toHaveLength(0);
  });

  it('two orphans each clear the footprint of everything before them', () => {
    const r = load(
      blob({
        pieces: [
          { pieceId: 's1', partId: 'E', turn: 'left' },
          { pieceId: 'o1', partId: 'E', turn: 'left' },
          { pieceId: 'o2', partId: 'E', turn: 'left' },
        ],
        welds: [],
        anchors: [
          ['s1', { pos: [0, 0, 0, 0, 432, 0, 0, 0], heading: 0 }],
          ['o1', { pos: 'rubbish', heading: 0 }],
          ['o2', { pos: 'rubbish', heading: 0 }],
        ],
      }),
    );
    expect(r.droppedAnchors).toBe(2);
    expect(r.value.anchors?.get('o1')?.pos.join(',')).toBe('0,0,0,0,864,0,0,0');
    expect(r.value.anchors?.get('o2')?.pos.join(',')).toBe('0,0,0,0,1296,0,0,0');

    const placement = placeAll(r.value, ports);
    const frames = placement.forest.roots.map((id) => placement.frames.get(id)!);
    expect(new Set(frames.map((f) => f.pos.join(','))).size).toBe(frames.length);
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
    /*
     * p1 is unanchored, so `placeAll` puts it at the identity, where it
     * occupies y 0 to 59.2. The orphan clears that footprint by a full
     * spacing, which rounds to lane 2. Under the old anchor-point rule it was
     * lane 1, which only cleared the identity POINT.
     *
     * THIS is the case that pins the unanchored-root term. MUTATION PROOF,
     * run: skip roots with no anchor when computing the frontier
     * (`if (!isOrphan.has(root) && anchors.has(root) && ...)`) and exactly
     * this test fails -- nothing else in the suite notices, because every
     * other fixture has an anchored survivor that dominates the frontier.
     */
    expect(r.value.anchors?.get('p2')?.pos.join(',')).toBe('0,0,0,0,432,0,0,0');
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
    /*
     * INTEGRAL BUT ABSURD. Every coefficient here is a whole number, so the
     * integer check passes; what rejects it is the safe-integer BOUND.
     *
     * MEASURED without that bound: `toXY` sums the eight terms to Infinity,
     * the orphan placement computes an infinite lane, and the stored anchor
     * comes out as [NaN, ..., Infinity, ...]. `equals` and `isZero` are both
     * false for NaN, so every closure and clash test downstream silently
     * answers "no" -- a layout that reports no problems because the
     * arithmetic stopped working, which is the worst shape a bug can take in
     * this engine.
     *
     * MUTATION PROOF, run: relax `isCyc` to `Number.isFinite` and 3 rows fail
     * -- these two and the non-integer one above, since both checks now live
     * in `isCyc`. They were in two places when this was written, and the
     * bound was the half nothing tested.
     */
    ['a pos too large to sum without overflowing', { pos: Array(8).fill(1e308), heading: 0 }],
    ['a pos above the safe-integer bound', { pos: [2 ** 53, 0, 0, 0, 0, 0, 0, 0], heading: 0 }],
    /*
     * A SAFE INTEGER THAT STILL BREAKS EXACTNESS. 2^53 - 1 passes every
     * integrality and finiteness check, and composing poses from it loses
     * precision: MEASURED, an eight-curve loop that closes EXACTLY reports
     * `closesExactly: false` with a non-zero gap when anchored there, and
     * closes exactly at 2^31. A false "can't be built", which is the same
     * invariant the orphan-lane P0 inverted.
     *
     * MUTATION PROOF, run: drop `Math.abs(n) <= COEFFICIENT_CEILING` and 2
     * rows fail -- this one and the negative one below it. The two above
     * still pass, caught by the safe-integer half, which is why these are
     * separate rows rather than a tighter version of those.
     */
    ['a safe integer still too large to compose exactly', { pos: [2 ** 53 - 1, 0, 0, 0, 0, 0, 0, 0], heading: 0 }],
    ['a large NEGATIVE coefficient', { pos: [-(2 ** 53 - 1), 0, 0, 0, 0, 0, 0, 0], heading: 0 }],
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

  /*
   * PIECES, NOT ENTRIES (filed 2026-10-15). The anchors are an array out of an
   * untrusted blob and may name a piece twice.
   *
   * MUTATION PROOF, run: `unreadable` kept as a list that remembers every
   * entry instead of a set: fails with `expected 2 to be 1 // Object.is
   * equality`.
   */
  it('one piece named twice with bad positions is one loss', () => {
    const r = load(
      blob({
        pieces: [{ pieceId: 'a', partId: 'E', turn: 'left' }],
        welds: [],
        anchors: [
          ['a', { pos: 'rubbish', heading: 0 }],
          ['a', { pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 99 }],
        ],
      }),
    );
    expect(r.droppedAnchors).toBe(1);
  });

  /*
   * A READABLE POSITION WINS over a bad entry for the same piece, in either
   * order. It used to be taken into the anchors and then re-laned anyway.
   *
   * MUTATION PROOF, run: `orphans` taking every `unreadable` id (the
   * `!anchorMap.has(id)` filter dropped): fails with `expected 1 to be +0 //
   * Object.is equality`, the good position thrown away for a lane.
   */
  it('a piece with one good position and one bad keeps the good one, and nothing is reported lost', () => {
    const good = ['a', { pos: [0, 0, 0, 0, 432, 0, 0, 0], heading: 0 }];
    const bad = ['a', { pos: 'rubbish', heading: 0 }];
    for (const anchors of [[good, bad], [bad, good]]) {
      const r = load(
        blob({ pieces: [{ pieceId: 'a', partId: 'E', turn: 'left' }], welds: [], anchors }),
      );
      expect(r.droppedAnchors).toBe(0);
      expect(r.value.anchors?.get('a')?.pos.join(',')).toBe('0,0,0,0,432,0,0,0');
    }
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
/**
 * A PORT HOLDS ONE WELD, and the loader was the one place that did not say so.
 *
 * Value: protects=a stored layout cannot claim the same track end twice, so it
 * cannot inflate the cycle rank or make the fundamental-sharing graph dense
 * Value: fails_when=the occupancy check goes away, or it stops refusing the
 * whole layout and starts dropping welds instead
 * Value: why_new=`isPort` checked a port index's RANGE and never its
 * OCCUPANCY. `weldEnds` refuses a port that is not free and `addPiece` welds
 * only free ports, so this is a value the engine could not have written --
 * but every claim that the dense-sharing-graph case was "unreachable" rested
 * on the in-app path alone, and storage is how layouts actually arrive.
 * Value: seam=none
 * Value: no_claim=nothing about the cycle enumeration's own cost, which is
 * bounded by `CYCLE_WORK_BUDGET` whatever arrives. This closes the route, not
 * the bound: both are needed and neither replaces the other.
 *
 * MEASURED before the check existed, through this loader: 3000 pieces with 20
 * duplicate welds on one port is a 303,940-byte blob that loaded with NO
 * discarded sentence, after which the solve blocked the main thread for
 * 11,058ms. A freeze is not a throw, so `ErrorBoundary` never fired and the
 * key was never cleared, so every reload did it again.
 */
describe('a stored weld cannot claim a port another weld already holds', () => {
  const load = (seed: Record<string, string>) => withStore(seed, () => loadGraph(KNOWN, ports));

  const base = [
    { pieceId: 'p0', partId: 'D' },
    { pieceId: 'p1', partId: 'D' },
    { pieceId: 'p2', partId: 'D' },
  ];

  /*
   * MUTATION PROOF, run: delete the `claimed` checks and all four cases below
   * load cleanly -- `expected undefined to be type of 'string'`, quoted as
   * `toBeTypeOf` prints it rather than paraphrased. The duplicate then
   * becomes a second closing weld, which is what inflated the rank.
   */
  const cases = {
    'the very same weld twice': [
      { a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p1', port: 0 } },
      { a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p1', port: 0 } },
    ],
    'the same end reused by a different weld': [
      { a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p1', port: 0 } },
      { a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p2', port: 0 } },
    ],
    'the same end reached from the other side of the weld': [
      { a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p1', port: 0 } },
      { a: { pieceId: 'p2', port: 1 }, b: { pieceId: 'p0', port: 1 } },
    ],
    'an end welded to itself': [{ a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p0', port: 1 } }],
  };

  for (const [name, welds] of Object.entries(cases)) {
    it(`refuses the whole layout for ${name}, and rescues the bytes`, () => {
      const r = load(blob({ pieces: base, welds, anchors: [] }));
      expect(r.discarded).toBeTypeOf('string');
      expect(r.value.pieces).toHaveLength(0);
      expect(r.value.welds).toHaveLength(0);
      expect(r.rescued).toBe(true);
    });
  }

  it('still accepts a chain that uses each end once, so this is not a blanket refusal', () => {
    const welds = [
      { a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p1', port: 0 } },
      { a: { pieceId: 'p1', port: 1 }, b: { pieceId: 'p2', port: 0 } },
    ];
    const r = load(blob({ pieces: base, welds, anchors: [] }));
    expect(r.discarded).toBeUndefined();
    expect(r.value.welds).toHaveLength(2);
  });

  it('accepts a closed loop, where every end is used exactly once', () => {
    const welds = [
      { a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p1', port: 0 } },
      { a: { pieceId: 'p1', port: 1 }, b: { pieceId: 'p2', port: 0 } },
      { a: { pieceId: 'p2', port: 1 }, b: { pieceId: 'p0', port: 0 } },
    ];
    const r = load(blob({ pieces: base, welds, anchors: [] }));
    expect(r.discarded).toBeUndefined();
    expect(r.value.welds).toHaveLength(3);
  });
});

describe('a stored weld cannot name a port the part does not have', () => {
  /** Port counts, the way App.tsx supplies them. */
  const loadWithCounts = (seed: Record<string, string>) =>
    withStore(seed, () => loadGraph(KNOWN, ports));

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
   * five refusal cases, the count-driven case, and the default-count case.
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
   * with port geometry that reports three ends: port 2 is accepted for that
   * part and refused for the two-port straight beside it, in the same layout.
   */
  it('port 2 is accepted on a three-port part and refused on a two-port one', () => {
    // A real third end, not a padded array: the loader now measures geometry
    // with these, so a fake entry would be placed as well as counted.
    const asIfSwitch: typeof ports = (piece) =>
      piece.partId === 'D' ? [...ports(piece), ports(piece)[1]!] : ports(piece);
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
    expect(withStore(layout(2), () => loadGraph(KNOWN, ports)).discarded).toBeTypeOf('string');
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
  /*
   * THERE IS NO WEAK BRANCH ANY MORE. `loadGraph` used to take an OPTIONAL
   * port count defaulting to unbounded, so a caller with only part ids got a
   * looser check than production, and the suite's own helper took that branch
   * for every pre-existing case. Port geometry is required now -- the loader
   * needs it to place orphans clear of real footprints anyway -- so the test
   * that proved the fallback still bit has nothing left to prove.
   *
   * What replaces it: the integer and non-negative checks are exercised by
   * the refusal matrix above, which runs through the same required parameter
   * production uses.
   */
  it('a non-integer or negative port is refused, on the production path', () => {
    for (const port of [-1, 2.5, Number.NaN]) {
      expect(load(blob(twoPieces(port))).discarded).toBeTypeOf('string');
    }
  });
});

/**
 * THE ORPHAN LANE AND THE SURVIVOR'S FOOTPRINT. This was a SKIPPED spec
 * pinning a P0; the P0 is fixed (`06e513f`) and it runs.
 *
 * Value: protects=a recovered layout never manufactures a "can't be built"
 * verdict about track the user built correctly
 * Value: fails_when=orphans go back to being placed by stepping over
 * OCCUPIED ROOT POINTS rather than past the bounding box of everything
 * already placed
 * Value: why_new=the occupancy search de-duplicates root anchor points; a run
 * marching along the lane axis occupies lanes its root does not name
 * Value: seam=none
 * Value: no_claim=nothing about pieces that cross mid-span, which
 * findVertexClashes does not check and the verdict copy says so
 *
 * MEASURED on the parent of the fix: MANUFACTURED CLASHES = 1, at
 * [1.3226185430791415e-14, 216]. Zero now.
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
 * HOW IT WAS FIXED: the loader was given the port geometry it lacked
 * (`PortsOf` instead of a port count) and now clears the FOOTPRINT of
 * everything already placed, which is what `layoutModel.nextRunAnchor` has
 * always done for the in-app path.
 *
 * It took three commits and the first two were wrong, which is why this
 * docblock is long: the footprint rule landed in `57b891e` and left a stale
 * provisional anchor on orphans that are not component roots, re-manufacturing
 * the same clash one user action later. `06e513f` deletes the anchor instead.
 *
 * MUTATION PROOF, run: restore the anchor-point rule in
 * `clearOfEveryFootprint` -- take the frontier from each non-orphan root's own
 * ANCHOR y instead of its measured footprint -- and SIX specs fail, two here
 * and four in E2 below. This one reports
 * `expected [ { ...(3) } ] to have a length of +0 but got 1`, which is the
 * manufactured clash, and its sibling reports
 * `expected '0,0,0,0,216,0,0,0' to be '0,0,0,0,648,0,0,0'`: the orphan is
 * handed a lane inside the run instead of past it.
 */
describe('an orphan lane clears a survivor RUN, not just its anchor', () => {
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

/**
 * When persistence stays suppressed, and when it must resume.
 *
 * Value: protects=nothing is written over stored bytes before the user has
 * seen what the load lost, AND suppression does not outlive their first
 * deliberate action
 * Value: fails_when=`savesSuppressed` stops consulting `userHasActed`, stops
 * consulting either dismissal, or starts ignoring the inventory notice
 * Value: why_new=the condition lived inline in App.tsx where no test in this
 * suite can reach it; both StrictMode bugs this logic has produced were in
 * the condition rather than the wiring
 * Value: seam=none, this is a pure function by construction
 * Value: no_claim=nothing about the effects themselves firing or which
 * action sets which store's flag; `suppression.dom.test.tsx` mounts the App
 * for that
 */
describe('savesSuppressed, one store at a time', () => {
  const clean = {
    notice: undefined,
    dismissed: false,
    userHasActed: false,
  } as const;

  it('nothing lost means save', () => {
    expect(savesSuppressed(clean)).toBe(false);
  });

  /*
   * MUTATION PROOF, run, and the first version of this comment was wrong about
   * its own first half. Deleting the `state.notice === undefined` arm does NOT
   * fail this test -- with the arm gone, `{notice: 'lost'}` still returns
   * `!userHasActed`, which is true. It fails 2 others: 'nothing lost means
   * save' and the 24-state table. Deleting the `state.dismissed` arm fails 3,
   * 'a dismissal releases it' among them.
   */
  it('an unread notice holds the save, which is what E1 is for', () => {
    expect(savesSuppressed({ ...clean, notice: 'lost' })).toBe(true);
  });

  it('a dismissal releases it', () => {
    expect(savesSuppressed({ ...clean, notice: 'lost', dismissed: true })).toBe(false);
  });

  /*
   * THE BOUND. Unbounded suppression is worse than the bug it fixes: the user
   * builds for an hour with nothing saved and no notice says so. For a
   * submission it is worse again, since a measurement just typed is NEW data.
   *
   * MUTATION PROOF, run: replace `!state.userHasActed` with `true` and this
   * fails.
   */
  it('a deliberate action releases it, banner still up', () => {
    expect(savesSuppressed({ ...clean, notice: 'lost', userHasActed: true })).toBe(false);
  });

  /*
   * THE GRAPH-ONLY EXCEPTION, and the reason it is per store.
   *
   * `rescue()` writes only `GRAPH_RESCUE_KEY` and swallows a quota or
   * private-browsing failure. With no copy aside, the live bytes are the only
   * record of a whole refused layout, so a stray click must not overwrite
   * them. MEASURED when this flag was applied GLOBALLY instead: a clean graph
   * load reports `rescued: false`, so an unread inventory or submissions
   * notice became unreleasable by any action -- the user built a track, typed
   * a new caliper measurement, and nothing was written.
   *
   * MUTATION PROOF, run: delete the `noRescueCopy` arm and the first case
   * here fails.
   */
  it('with no rescue copy, only a dismissal releases, not an action', () => {
    const noCopy = { ...clean, notice: 'lost', noRescueCopy: true };
    expect(savesSuppressed({ ...noCopy, userHasActed: true })).toBe(true);
    expect(savesSuppressed({ ...noCopy, dismissed: true })).toBe(false);
  });

  /*
   * THE WHOLE TABLE, because this function has now been wrong three times and
   * each time the bug was a state nobody enumerated. 24 states: notice set or
   * not, dismissed or not, acted or not, and `noRescueCopy` undefined / false
   * / true.
   *
   * The two properties that matter are asserted directly rather than left to
   * be read off the cases above:
   *
   * 1. NO STATE IS UNRELEASABLE. For every state that holds, dismissing
   *    releases it. The second bug was a whole branch where no user action
   *    released and only a dismissal did -- which was at least escapable; a
   *    state where neither worked would strand the user's data for good.
   * 2. `noRescueCopy` CHANGES EXACTLY ONE ROW: unread loss plus an action.
   *    The second bug was this flag reaching stores that have no rescue key,
   *    where it turned every acted row into a hold. If a future change makes
   *    it matter anywhere else, this fails.
   */
  it('every one of the 24 states is escapable, and holds only where intended', () => {
    const states = [];
    for (const notice of [undefined, 'lost'] as const) {
      for (const dismissed of [false, true]) {
        for (const userHasActed of [false, true]) {
          for (const noRescueCopy of [undefined, false, true]) {
            states.push({ notice, dismissed, userHasActed, noRescueCopy });
          }
        }
      }
    }
    expect(states).toHaveLength(24);

    for (const st of states) {
      const held = savesSuppressed(st);

      // Intended rule, written out independently of the implementation.
      const lost = st.notice !== undefined && !st.dismissed;
      const expected = lost && (st.noRescueCopy === true || !st.userHasActed);
      expect(held, JSON.stringify(st)).toBe(expected);

      // Property 1: a dismissal always releases.
      if (held) {
        expect(savesSuppressed({ ...st, dismissed: true }), JSON.stringify(st)).toBe(false);
      }

      // Property 2: the flag only matters on unread-loss-plus-action.
      const withoutFlag = savesSuppressed({ ...st, noRescueCopy: undefined });
      const onlyRow = lost && st.userHasActed;
      if (!onlyRow) expect(held, JSON.stringify(st)).toBe(withoutFlag);
    }
  });

  /*
   * AN ACTION ABOUT ONE STORE MUST NOT RELEASE ANOTHER.
   *
   * This is the assertion that could not be written while a single global
   * `userHasActed` fed all three gates, and its absence is why the bug
   * shipped. MEASURED before the split, on a clean graph load with one
   * dropped submission row: a palette click took the submissions gate from
   * blocked to open, and the effect wrote the survivors over a caliper
   * measurement that has no rescue copy -- while the banner on screen read
   * "Nothing is saved over them until you dismiss this".
   *
   * The call sites are pinned separately, in the App.tsx wiring describe:
   * three distinct flags, one per gate, asserted to be distinct.
   *
   * MUTATION PROOF, run: feed any two gates the same flag in App.tsx and the
   * wiring test fails; collapse them here and this fails.
   */
  it('acknowledging one store leaves the others held', () => {
    const lost = { notice: 'lost', dismissed: false } as const;
    // The graph store is acknowledged; the other two are not.
    const graphActed = true;
    const submissionsActed = false;
    const inventoryActed = false;

    expect(savesSuppressed({ ...lost, userHasActed: graphActed })).toBe(false);
    expect(savesSuppressed({ ...lost, userHasActed: submissionsActed })).toBe(true);
    expect(savesSuppressed({ ...lost, userHasActed: inventoryActed })).toBe(true);
  });

  it('the exception is opt-in, so a store without a rescue key is not stuck', () => {
    // Omitted entirely, which is how App.tsx calls it for inventory and
    // submissions. An action must release.
    expect(savesSuppressed({ notice: 'lost', dismissed: false, userHasActed: true })).toBe(
      false,
    );
    expect(
      savesSuppressed({
        notice: 'lost',
        dismissed: false,
        userHasActed: true,
        noRescueCopy: false,
      }),
    ).toBe(false);
  });
});

/**
 * THE SOLVE'S SLOP CALLBACK IS A LOOKUP, NOT A SCAN.
 *
 * Value: protects=App.tsx hands `solveGraph` a constant-time slop callback, so
 * the engine's work budget -- which is priced in weld-slots on the assumption
 * that a slot is O(1) -- is not made quadratic in pieces from outside it
 * Value: fails_when=the callback goes back to scanning `graph.pieces` for each
 * lookup, or rebuilds the map on every call, either of which reintroduces the
 * measured stall
 * Value: why_new=nothing in the suite could see this. Every spec passes
 * `() => slopMm` or `() => 0.8`, which is O(1), so the engine specs measure a
 * cost the product did not pay. A scanning callback is quadratic in pieces
 * and the budget never fires, because the cost sits outside the slots being
 * charged, so the user got a normal verdict after the stall rather than a
 * refusal. The measurement lives once, in `App.tsx` beside the callback
 * itself; this spec reads source text and asserts no timing of its own.
 * Value: seam=none
 * Value: no_claim=nothing about the rendered component, which needs a DOM this
 * suite does not have, and no timing claim of its own: this reads source text,
 * so it pins the SHAPE of the call. A behaviour-preserving rewrite of the memo
 * has to keep a `<map>.get(pieceId)` callback or update this spec, which is
 * the price of pinning a `.tsx` file at all, and the same one the crash-screen
 * specs in `repro.test.ts` pay. (The save-gate wiring paid it too, until
 * `suppression.dom.test.tsx` replaced that text check with a mounted App.)
 *
 * MUTATION PROOF, run: both specs below, applied to `App.tsx` exactly as it
 * stands at `origin/main` -- the scanning callback this change replaced, which
 * is the real regression rather than a synthetic one -- fail. TWO specs, with
 * these messages:
 *
 *   expected 'const result = useMemo(\n    () =>\n …' to match
 *   /=>\s*\w+\.get\(pieceId\)/
 *
 *   expected '/**\n * Layout-as-home.\n *\n * You a…' to match
 *   /useMemo\(\s*\(\)\s*=>\s*new Map\(grap…/
 *
 * The POSITIVE assertion is what fires on that text, not the `.find(` one:
 * vitest stops at the first failure and the lookup match comes first. The two
 * negative assertions are for the variants the positive one would let past --
 * a `.get(pieceId)` callback that also scans, or one that builds its map
 * inside itself. Nothing else in the suite moves under this mutation, because
 * nothing else reads this call.
 */
describe('the solve is handed a constant-time slop lookup', () => {
  const source = readFileSync(join(import.meta.dirname, 'App.tsx'), 'utf8');

  it('the callback looks the piece up, and does not scan or rebuild per call', () => {
    const at = source.indexOf('const result = useMemo(');
    expect(at, 'the solve is no longer computed in a useMemo').toBeGreaterThan(-1);
    const block = source.slice(at, source.indexOf('\n  );', at));
    expect(block).toContain('solveGraph(graph, ports, resolve,');
    // Anchored at BOTH ends: the dependency list is the memo's last line, so a
    // slice that stopped early would fail here rather than go vacuously green
    // on the two negative assertions below.
    expect(block, 'the slice did not reach the dependency list').toMatch(/\[graph, ports, resolve/);
    // A lookup on something that has one, whatever it is called.
    expect(block).toMatch(/=>\s*\w+\.get\(pieceId\)/);
    expect(block, 'the slop callback scans the pieces array').not.toContain('.find(');
    expect(block, 'the slop callback rebuilds its map per call').not.toContain('new Map(');
  });

  it('the map is built once per graph, in its own memo', () => {
    expect(source).toMatch(/useMemo\(\s*\(\)\s*=>\s*new Map\(graph\.pieces\.map\(/);
  });
});
