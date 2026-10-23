/**
 * THE TABLE OUTLINE'S ARITHMETIC (backlog E4, owner ruling 2026-10-23).
 *
 * Value: protects=the fit answer: the track's extent is where its wood
 * reaches, plank edges and curve bulges included; the table is tried both
 * ways round; overhangs never round down to "0 cm"; and a stored size that is
 * not exactly valid is discarded with a sentence, not repaired
 * Value: fails_when=the extent is the centreline's, an arc's bulge past its
 * ends is missed, the table is only tried as entered, or a bad blob loads
 * Value: why_new=no fit existed before
 * Value: seam=none (pure functions, plus a stubbed localStorage)
 * Value: no_claim=that the outline is drawn; tableOutline.dom.test.tsx covers that
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import type { Segment } from '../../engine/src/geom/fk.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { TABLE_STORAGE_KEY } from './storageKeys.js';
import {
  fitSentence,
  loadTable,
  sanitizeSideCm,
  saveTable,
  tableFit,
  trackExtent,
  type Extent,
} from './tableModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const half = (id: string) => resolve(id).plankWidthMm / 2;
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };

/*
 * Every BRIO curve turns 45 degrees, so a run laid from the origin always
 * ends a curve on a compass point or a diagonal, and no arc's extreme falls
 * mid-piece. Turning a run by one step (22.5 degrees, as R does to a selected
 * run) is what puts one there, so this turns real segments the same way.
 */
function turned(segments: readonly Segment[], steps: number): readonly Segment[] {
  const a = (steps * Math.PI) / 8;
  const pose = (p: Segment['from']) => ({
    x: p.x * Math.cos(a) - p.y * Math.sin(a),
    y: p.x * Math.sin(a) + p.y * Math.cos(a),
    h: p.h + a,
  });
  return segments.map((s) => ({ ...s, from: pose(s.from), to: pose(s.to) }));
}

function segmentsOf(parts: readonly (readonly [string, 'left' | 'right'])[]): readonly Segment[] {
  let s = START;
  for (const [partId, turn] of parts) {
    s = reduce(s, { kind: 'add', partId, turn } as EditorAction, ports);
  }
  return renderGraph(s.graph, ports, resolve, placeAll(s.graph, ports)).segments;
}

/*
 * The reference: walk each plank edge in small exact chords from the
 * segment's start pose, never using the centre formula under test, and take
 * the box of every point visited.
 */
function sampledExtent(segments: readonly Segment[]): Extent {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const take = (x: number, y: number) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };
  for (const s of segments) {
    const hw = half(s.partId);
    const edges = (x: number, y: number, h: number) => {
      take(x - Math.sin(h) * hw, y + Math.cos(h) * hw);
      take(x + Math.sin(h) * hw, y - Math.cos(h) * hw);
    };
    if (s.kind === 'straight') {
      edges(s.from.x, s.from.y, s.from.h);
      edges(s.to.x, s.to.y, s.to.h);
      continue;
    }
    const r = s.centrelineRadiusMm!;
    let turn = s.to.h - s.from.h;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn <= -Math.PI) turn += 2 * Math.PI;
    const n = 4000;
    const d = turn / n;
    const chord = 2 * r * Math.sin(Math.abs(d) / 2);
    let x = s.from.x, y = s.from.y, h = s.from.h;
    edges(x, y, h);
    for (let i = 0; i < n; i++) {
      x += Math.cos(h + d / 2) * chord;
      y += Math.sin(h + d / 2) * chord;
      h += d;
      edges(x, y, h);
    }
    // The walk must land where the segment ends, or the reference is wrong.
    expect(Math.hypot(x - s.to.x, y - s.to.y)).toBeLessThan(1e-6);
  }
  return { minX, minY, maxX, maxY };
}

describe('the track extent is where the wood reaches', () => {
  /*
   * MUTATION PROOFS, run:
   * - the cardinal crossings dropped (`crossings` left empty): the three
   *   turned cases fail, the large curve with `minY: expected
   *   -18.47759065022578 to be close to -35.37633443272092`.
   * - a straight's half plank dropped (`half` set to 0 for straights): "one
   *   straight" fails with `minY: expected +0 to be close to -20`, and the
   *   size spec below with `expected +0 to be close to 40`.
   */
  const cases: readonly (readonly [string, readonly Segment[]])[] = [
    ['one straight', segmentsOf([['A', 'left']])],
    ['one large curve', segmentsOf([['E', 'left']])],
    ['a large curve turned a step, its lowest point mid-piece', turned(segmentsOf([['E', 'left']]), -1)],
    ['a short curve turned a step', turned(segmentsOf([['E1', 'right']]), 1)],
    ['a circle of eight large curves', segmentsOf(Array(8).fill(['E', 'left'] as const))],
    ['an S of curves with a straight between, turned three steps',
      turned(segmentsOf([['E', 'left'], ['A', 'left'], ['E', 'right'], ['E', 'right']]), 3)],
  ];
  for (const [name, segs] of cases) {
    it(`${name}: matches a fine walk along both plank edges`, () => {
      const got = trackExtent(segs, half)!;
      const want = sampledExtent(segs);
      for (const k of ['minX', 'minY', 'maxX', 'maxY'] as const) {
        expect(got[k], k).toBeCloseTo(want[k], 1);
      }
    });
  }

  it('one straight is exactly its length by its plank width', () => {
    const e = trackExtent(segmentsOf([['A', 'left']]), half)!;
    // A medium straight is 144 mm long (engine/data/brio.ts).
    expect(e.maxX - e.minX).toBeCloseTo(144, 6);
    expect(e.maxY - e.minY).toBeCloseTo(resolve('A').plankWidthMm, 6);
  });

  it('an empty floor has no extent', () => {
    expect(trackExtent([], half)).toBeNull();
  });
});

describe('the table is tried both ways round, centred on the track', () => {
  const track: Extent = { minX: 0, minY: 0, maxX: 1400, maxY: 700 };

  /*
   * MUTATION PROOF, run: `best` always `asEntered`: "fits turned" fails with
   * `expected false to be true`, and the overhang spec with `expected
   * [ 800, +0 ] to deeply equal [ 200, 100 ]`.
   */
  it('fits turned: an 80 x 150 table under a 140 x 70 track', () => {
    const fit = tableFit(track, { widthMm: 800, depthMm: 1500 });
    expect(fit.fits).toBe(true);
    expect([fit.drawnW, fit.drawnD]).toEqual([1500, 800]);
    expect(fit.outline).toEqual({ minX: -50, minY: -50, maxX: 1450, maxY: 750 });
  });

  it('too big either way: the smaller overhang wins, and the outline is centred', () => {
    const fit = tableFit(track, { widthMm: 600, depthMm: 1200 });
    // As entered: 800 over and 100 over; turned: 200 over and 100 over.
    expect(fit.fits).toBe(false);
    expect([fit.overW, fit.overD]).toEqual([200, 100]);
    expect(fit.outline).toEqual({ minX: 100, minY: 50, maxX: 1300, maxY: 650 });
  });

  it('a tie keeps the order as entered', () => {
    const fit = tableFit({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, { widthMm: 300, depthMm: 200 });
    expect([fit.drawnW, fit.drawnD]).toEqual([300, 200]);
  });
});

describe('the fit sentence', () => {
  it('says it fits, with the track size rounded up', () => {
    const fit = tableFit({ minX: 0, minY: 0, maxX: 1021, maxY: 640 }, { widthMm: 1200, depthMm: 800 });
    expect(fitSentence(fit, { widthMm: 1200, depthMm: 800 })).toBe(
      'Fits your 120 × 80 cm table: the track is 103 × 64 cm.',
    );
  });

  /*
   * MUTATION PROOF, run: `cmUp` as `Math.round(mm / 10)`: this spec and
   * "says it fits" fail with `expected 'Too big for your 120 × 80 cm table:
   * t…' to be 'Too big for your 120 × 80 cm table: t…'` (and the "Fits"
   * twin), the track reading 102 cm and the overhang 0 cm.
   */
  it('never says "0 cm too long" of an overhang under a centimetre', () => {
    const table = { widthMm: 1200, depthMm: 800 };
    const fit = tableFit({ minX: 0, minY: 0, maxX: 1200.3, maxY: 500 }, table);
    expect(fitSentence(fit, table)).toBe(
      'Too big for your 120 × 80 cm table: the track is 121 × 50 cm, 1 cm over its 120 cm side.',
    );
  });

  it('names both overhangs', () => {
    const table = { widthMm: 1200, depthMm: 805 };
    const fit = tableFit({ minX: 0, minY: 0, maxX: 1420, maxY: 960 }, table);
    expect(fitSentence(fit, table)).toBe(
      'Too big for your 120 × 80.5 cm table: the track is 142 × 96 cm, 22 cm over its 120 cm side and 16 cm over its 80.5 cm side.',
    );
  });

  /*
   * MUTATION PROOF, run: `fitSentence` ignoring `turned` (both pairs taken as
   * drawn): fails with `expected 'Too big for your 40 × 60 cm table: t…' to
   * be 'Too big for your 40 × 60 cm table: t…'`, naming the 40 cm side for
   * an overhang that is on the 60 cm one.
   */
  it('names the right side of a table drawn turned, and orders the track to match', () => {
    // A 40 x 60 table under a 70 x 45 track is drawn turned: 60 along x.
    const table = { widthMm: 400, depthMm: 600 };
    const fit = tableFit({ minX: 0, minY: 0, maxX: 700, maxY: 450 }, table);
    expect(fit.turned).toBe(true);
    expect(fitSentence(fit, table)).toBe(
      'Too big for your 40 × 60 cm table: the track is 45 × 70 cm, 5 cm over its 40 cm side and 10 cm over its 60 cm side.',
    );
  });

  it('a square table too small both ways names its sides once', () => {
    const table = { widthMm: 600, depthMm: 600 };
    const fit = tableFit({ minX: 0, minY: 0, maxX: 700, maxY: 650 }, table);
    expect(fitSentence(fit, table)).toBe(
      'Too big for your 60 × 60 cm table: the track is 70 × 65 cm, 10 cm and 5 cm over its 60 cm sides.',
    );
  });
});

describe('a side as typed', () => {
  it.each([
    ['120', 1200],
    ['80.5', 805],
    ['10', 100],
    ['2000', 20000],
    ['', null],
    ['9.9', null],
    ['2001', null],
    ['abc', null],
    ['1e309', null],
  ])('%j -> %j', (raw, want) => {
    expect(sanitizeSideCm(raw)).toBe(want);
  });
});

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

describe('the stored table', () => {
  it('round-trips, and removing it deletes the key', () => {
    withStore({}, (store) => {
      saveTable({ widthMm: 1200, depthMm: 805 });
      expect(loadTable()).toEqual({ value: { widthMm: 1200, depthMm: 805 } });
      saveTable(null);
      expect(store.has(TABLE_STORAGE_KEY)).toBe(false);
      expect(loadTable()).toEqual({ value: null });
    });
  });

  /*
   * MUTATION PROOF, run: `validSide` reduced to `typeof v === 'number'`: the
   * 12.5, -100 and 99 rows fail, the first with `expected { value: {
   * widthMm: 12.5, …(1) } } to deeply equal { value: null, …(1) }`.
   */
  it.each([
    ['not JSON', '{'],
    ['an array', '[1200, 800]'],
    ['a missing side', '{"widthMm":1200}'],
    ['a fractional mm', '{"widthMm":12.5,"depthMm":800}'],
    ['a negative side', '{"widthMm":-100,"depthMm":800}'],
    ['a side under 10 cm', '{"widthMm":99,"depthMm":800}'],
    ['a string side', '{"widthMm":"1200","depthMm":800}'],
  ])('%s is discarded with a sentence', (_name, raw) => {
    withStore({ [TABLE_STORAGE_KEY]: raw }, () => {
      expect(loadTable()).toEqual({
        value: null,
        discarded: 'Your saved table size could not be read, so the table outline was removed.',
      });
    });
  });
});
