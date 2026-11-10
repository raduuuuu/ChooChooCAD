/**
 * ONE SENT PIECE, READY TO DRAW (contributor-brief plan, "The preview screen,
 * designed", D2, D3, D7, D9, D12; T4). Pure: what the preview screen draws
 * and says about a piece the validator accepted, and nothing it stores.
 *
 *   checked part ─▶ known paints only (D12) ─▶ resolver: BUILT_IN + this piece,
 *                                               for this screen only, never stored
 *                ─▶ medium straight · piece · medium straight (D2)
 *                ─▶ sizes (D3 (5)), a duplicate's line (D7), checks in words (D9)
 */

import { BUILT_IN, makeResolver, PAINT_TOKENS } from '../../engine/data/library.js';
import { levelOf, portsOf, roadsOf, type Graph, type Weld } from '../../engine/src/graph/model.js';
import { centrelineRadiusMm, codeOf, type DecorBox, type DecorShape, type Paint, type Part } from '../../engine/src/parts/schema.js';
import {
  CHECK_DECOR,
  CHECK_FIELDS,
  CHECK_ID,
  CHECK_ROADS,
  CHECK_TEXT,
  CHECK_UNVERIFIED,
  checkDerived,
  FAR_END,
  lengthWords,
  ON_FLOOR,
  RAISED,
  radiusWords,
  sizeWords,
  START_END,
  withMm,
} from './previewWords.js';

/** The straight each side of the piece: the medium straight, socket to peg, the size the brief's photos are taken with. */
export const PREVIEW_STRAIGHT = 'A';
/** The piece's id in the preview's graph; the straights are `before` and `after`. */
export const PREVIEW_PIECE = 'piece';

/**
 * THE PAINTS THE APP HAS (D12): every token a built-in piece already paints
 * with. It is exactly the set the 3D view resolves from tokens.css
 * (`View3DPanel` hands it `PAINT_TOKENS`), and each was measured against rule
 * 1 and 5 before it arrived. Any other token, even one tokens.css declares for
 * something else (`--fail`), would draw in ink or in a verdict's colour, so it
 * draws as wood and the details name it.
 */
export const KNOWN_PAINTS: ReadonlySet<string> = new Set(PAINT_TOKENS);

const known = (p: Paint | undefined, ok: ReadonlySet<string>) => p === undefined || (ok.has(p.fill) && ok.has(p.line));

/**
 * The piece with every paint the app lacks taken off (both tokens, or the
 * paint goes whole: an unknown line would draw in ink), and the tokens it
 * lacked, in the order they appear.
 */
export function withKnownPaint(part: Part, ok: ReadonlySet<string> = KNOWN_PAINTS): { readonly part: Part; readonly unknown: readonly string[] } {
  const unknown: string[] = [];
  const note = (p: Paint | undefined) => {
    if (p === undefined || known(p, ok)) return;
    for (const t of [p.fill, p.line]) if (!ok.has(t) && !unknown.includes(t)) unknown.push(t);
  };
  const plainShape = <S extends DecorShape>(s: S): S => {
    if (!('paint' in s)) return s;
    note(s.paint);
    if (known(s.paint, ok)) return s;
    const { paint: _p, ...rest } = s;
    return rest as S;
  };
  const plainBox = (b: DecorBox): DecorBox => {
    note(b.paint);
    const shape = b.shape ? plainShape(b.shape) : undefined;
    const { paint, shape: _s, ...rest } = b;
    return { ...rest, ...(known(paint, ok) && paint ? { paint } : {}), ...(shape ? { shape } : {}) };
  };
  const decor = part.decor?.map(plainShape);
  const decorBody = part.decorBody?.map(plainBox);
  if (unknown.length === 0) return { part, unknown };
  return { part: { ...part, ...(decor ? { decor } : {}), ...(decorBody ? { decorBody } : {}) } as Part, unknown };
}

/** The library for this screen: the built-in catalogue and the sent piece, nothing stored. */
export const previewResolver = (part: Part) => makeResolver([...BUILT_IN, part]);

/**
 * WHICH ENDS THE STRAIGHTS JOIN (D2): a two-ended piece's two; a multi-road
 * piece's entry and the end its first road leads to; a buffer stop's one.
 */
export function joinedEnds(part: Part): readonly number[] {
  if (part.kind === 'buffer') return [0];
  const ports = portsOf(part, 'left');
  if (part.kind === 'multi-road') return [0, ports[0]?.along?.[0] ?? 1];
  return ports.length >= 2 ? [0, 1] : [0];
}

/**
 * MEDIUM STRAIGHT · PIECE · MEDIUM STRAIGHT (D2), as a graph: the piece is
 * placed first, so it is the root, and each straight is welded to one of its
 * ends by the straight's opposite end (a socket on a peg, a peg in a socket).
 * A weld carries the end's level, so a straight on a ramp's high end is
 * raised and one on its low end is on the floor: placement does it, nothing
 * here sets a height.
 */
export function previewGraph(part: Part): Graph {
  const ports = portsOf(part, 'left');
  const names = ['before', 'after'];
  const ends = joinedEnds(part);
  const welds: Weld[] = ends.map((port, i) => ({
    a: { pieceId: PREVIEW_PIECE, port },
    // The medium straight is socket (0) to peg (1): its peg goes into a socket end, its socket onto a peg.
    b: { pieceId: names[i]!, port: ports[port]?.polarity === 'peg' ? 0 : 1 },
  }));
  return {
    pieces: [{ pieceId: PREVIEW_PIECE, partId: part.id, turn: 'left' }, ...ends.map((_, i) => ({ pieceId: names[i]!, partId: PREVIEW_STRAIGHT, turn: 'left' as const }))],
    welds,
  };
}

/** Millimetres for a person: whole when whole, else up to a tenth, never understated (DESIGN.md rule 4). */
export const mmText = (mm: number): string => (Number.isInteger(mm) ? String(mm) : (Math.ceil(mm * 10 - 1e-9) / 10).toFixed(1));

export interface PreviewEnd {
  readonly name: string;
  readonly polarity: 'peg' | 'socket';
  /** Millimetres above the piece's floor: 0 on the floor, a level's rise when raised. */
  readonly heightMm: number;
}

export interface PreviewSizes {
  /** Length, radius, or a multi-road piece's own size label. */
  readonly size: { readonly label: 'length' | 'radius' | 'size'; readonly value: string };
  readonly ends: readonly PreviewEnd[];
  /** The top of its tallest decoration, from its floor; null with none. */
  readonly tallestMm: number | null;
}

/** D3 (5): what the sizes say, from the drawn piece. `riseMm` is one level's height (calibration). */
export function previewSizes(part: Part, riseMm: number): PreviewSizes {
  const size: PreviewSizes['size'] =
    part.kind === 'curve'
      ? { label: 'radius', value: mmText(centrelineRadiusMm(part)) }
      : part.kind === 'multi-road'
        ? { label: 'size', value: part.sizeLabel }
        : part.kind === 'block'
          ? { label: 'size', value: '' }
          : { label: 'length', value: mmText(part.lengthMm) };
  const ports = portsOf(part, 'left');
  const ends = ports.map((p, i) => ({
    name: part.kind === 'multi-road' ? part.ports[i]!.name : i === 0 ? START_END : FAR_END,
    polarity: p.polarity,
    heightMm: levelOf(p.at) * riseMm,
  }));
  const tops = (part.decorBody ?? []).map((b) => b.topMm);
  return { size, ends, tallestMm: tops.length > 0 ? Math.max(...tops) : null };
}

/** The size as the picture's label says it (D14): "240 mm long", "radius 202 mm", "size r202". */
export function sizePhrase(s: PreviewSizes['size']): string {
  return s.label === 'length' ? lengthWords(s.value) : s.label === 'radius' ? radiusWords(s.value) : sizeWords(s.value);
}

/** An end's height in words: on the floor, or raised and how far. */
export const heightWords = (e: PreviewEnd): string => (e.heightMm === 0 ? ON_FLOOR : `${RAISED} ${withMm(mmText(e.heightMm))}`);

/**
 * THE TRACK, AS A DUPLICATE IS JUDGED (D7). Two pieces' tracks match when
 * they are of the same system and kind and have the same ends (each end's
 * position, heading, level and peg or socket, in order) and the same roads
 * between them, both placed the same way up. Nothing else: not the name, the
 * plank's width, the decoration or the sizes' source, which is what lets a
 * piece the library already holds, drawn again, be noticed. Blocks have no
 * track, so match nothing.
 */
export function trackKey(part: Part): string | null {
  if (part.kind === 'block') return null;
  const ends = portsOf(part, 'left').map((p) => ({ pos: p.at.pos, heading: p.at.heading, level: levelOf(p.at), polarity: p.polarity, kind: p.kind }));
  // The decoration is part of what a piece IS: a bridge on a plain straight's track is not that straight, nor another bridge on it.
  return JSON.stringify({ brand: part.brand, kind: part.kind, ends, roads: roadsOf(part, 'left'), decor: part.decor ?? null });
}

/**
 * The first library piece whose track matches (D7), or null. A piece sent as
 * a decorated spec is not compared with its own base: it declares that track
 * (`deriveDecorated`), so the line would always show.
 */
export function trackMatch(part: Part, library: readonly Part[] = BUILT_IN): Part | null {
  const key = trackKey(part);
  if (key === null) return null;
  return library.find((p) => p.id !== part.id && p.id !== part.decoratedFrom && trackKey(p) === key) ?? null;
}

/** D9: the checks the piece passed, in words, in the order the validator runs them. */
export function checksPassed(part: Part, resolve: (id: string) => Part): readonly string[] {
  const out = [CHECK_FIELDS, CHECK_TEXT, CHECK_ID, CHECK_UNVERIFIED];
  if (part.kind === 'multi-road') out.push(CHECK_ROADS);
  if (part.decoratedFrom !== undefined) {
    const base = resolve(part.decoratedFrom);
    out.push(checkDerived(codeOf(base.id), base.name));
  } else if (part.decor !== undefined) out.push(CHECK_DECOR);
  return out;
}
