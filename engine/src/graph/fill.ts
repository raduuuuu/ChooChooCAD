/**
 * THE PIECES THAT JOIN TWO FREE ENDS EXACTLY (plan 2026-11-14, E3; eng review
 * 2026-11-14, docs/plan/2026-11-14-additions-eng.md).
 *
 * `repair.ts` answers one narrow question on every edit: is the one failing
 * loop exactly one straight short or long. This answers the wider one, on the
 * user's click only: which short runs of plain pieces start on one free end
 * and land EXACTLY on another. Every position is a point of Z[zeta16] and
 * every heading a sixteenth of a turn, so "lands on" is an equality test, not
 * a tolerance, and the search is a countable list of options.
 *
 *   from (a free end)                                   to (another free end)
 *      │  piece 1 goes on by one of its ends ...            ▲
 *      ▼                                                     │ the last piece's far end must sit on
 *   [end] ─▶ piece 1 ─▶ [end] ─▶ piece 2 ─▶ ... ─▶ [end] ───┘ `to`'s spot, facing it, peg to socket
 *
 * WHAT THIS DOES NOT DECIDE. A sequence that lands is a CANDIDATE. Whether
 * the layout then works (no overlap, every loop still closing, the box
 * covering it) is the verdict's to say, and the caller asks it before showing
 * anything (app/src/finishLoop.ts). Nothing here is ever shown unchecked.
 *
 * FLAT, TWO-ENDED PIECES ONLY, ON ONE LEVEL (owner, choice C1): plain
 * straights and curves. No ramps, decks, humps, switches or decorated pieces:
 * a ramp would bring the level rules into the search, and the rest bring
 * bodies the search does not check. Ends on two levels are the caller's to
 * refuse with a sentence.
 *
 * EVERY JOINT IS A PEG IN A SOCKET, the two ends of the gap included. Two
 * sockets can be joined with an adapter elsewhere in the app; a suggestion
 * that quietly needed one would be a suggestion the box might not cover, so
 * the search does not make them. Polarity is checked at each new joint, which
 * is what lets a two-socket piece bridge two pegs.
 *
 * BOUNDED BY WORK, NOT BY TIME (`FILL_BUDGET`): one unit is one option tried
 * at one position. Past it the search says so and stops; it never returns a
 * partial list as if it were complete.
 */

import { ZERO as ORIGIN, equals, sub, toXY, type Cyc } from '../geom/cyclotomic.js';
import type { Part, Polarity, Turn } from '../parts/schema.js';
import type { PlacedPort } from './feasible.js';
import { compose, frameForPortAt, frameOf, opposed, portsOf, type Frame } from './model.js';

/** The longest fill searched for (owner, choice C1). */
export const MAX_FILL_PIECES = 4;

/**
 * Options tried before the search gives up. A unit is one piece tried at one
 * end, so the cap is the same on every machine. About twenty plain pieces in
 * up to four ways each, four deep, is at most 80^4 without pruning; the reach
 * bound cuts nearly all of it, and the gaps the tests build finish in a few
 * thousand units. Two hundred thousand is a ceiling a real gap does not meet.
 */
export const FILL_BUDGET = 200_000;

/** One piece of a fill: which part, which way it bends, and which of its ends goes on first. */
export interface FillPiece {
  readonly partId: string;
  readonly turn: Turn;
  /** The end that joins the piece before it (or the starting end). */
  readonly port: number;
}

/** What is left of the work allowance. Shared by a whole search, so the caller can see what it spent. */
export interface FillWork {
  left: number;
}

/** Whether a part is one a fill may use: flat, two-ended, nothing standing on it. */
export const isFillPart = (p: Part): boolean =>
  (p.kind === 'curve' ||
    (p.kind === 'straight' && p.rise === undefined && p.deck === undefined && p.hump === undefined)) &&
  p.decor === undefined;

/** One way of putting one part down: precomputed, since it is the same at every position. */
interface Option {
  readonly partId: string;
  readonly turn: Turn;
  readonly port: number;
  /** The end that goes on, in the piece's own frame. */
  readonly entry: Frame;
  readonly entryPolarity: Polarity;
  /** The far end, in the piece's own frame. */
  readonly exit: Frame;
  readonly exitPolarity: Polarity;
  /** How far the far end is from the near one, in millimetres: the most this piece can close of a gap. */
  readonly reachMm: number;
}

const distance = (a: Cyc, b: Cyc): number => {
  const [x, y] = toXY(sub(a, b));
  return Math.hypot(x, y);
};

/** Every distinct way each part can go on. A straight turned over is the same piece, so it is listed once. */
function optionsOf(parts: readonly Part[]): Option[] {
  const out: Option[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (!isFillPart(part)) continue;
    const turns: readonly Turn[] = part.kind === 'curve' ? ['left', 'right'] : ['left'];
    for (const turn of turns) {
      const local = portsOf(part, turn);
      if (local.length !== 2) continue;
      for (const port of [0, 1]) {
        const entry = local[port]!;
        const exit = local[1 - port]!;
        // Where the far end lands when the near end is put at the origin facing backwards.
        const frame = frameForPortAt(entry.at, frameOf(ORIGIN, 8, 0));
        const far = compose(frame, exit.at);
        const key = `${part.id}|${far.pos.join(',')}|${far.heading}|${entry.polarity}|${exit.polarity}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          partId: part.id,
          turn,
          port,
          entry: entry.at,
          entryPolarity: entry.polarity,
          exit: exit.at,
          exitPolarity: exit.polarity,
          reachMm: distance(far.pos, ORIGIN),
        });
      }
    }
  }
  return out;
}

/** A free end as the search holds it: where it is, which way it points, and what it is. */
interface End {
  readonly frame: Frame;
  readonly polarity: Polarity;
}

/**
 * Every run of at most `maxPieces` plain pieces that starts on `from` and
 * lands exactly on `to`, shortest first.
 *
 * A generator, so the caller can stop at the first few it keeps: each one
 * costs a full check of the layout, and listing them all first would spend
 * the work whether or not it was wanted (eng review, finding 5).
 *
 * `stock` is how many of a part may still be used (the box, less what the
 * layout already holds); return Infinity when there is no box. `work.left`
 * is counted down; the generator's return value says whether it finished
 * ('done') or ran out ('out of work').
 *
 * Both ends must be on one level; the caller checks that and says so.
 */
export function* gapFills(
  from: PlacedPort,
  to: PlacedPort,
  parts: readonly Part[],
  stock: (partId: string) => number,
  work: FillWork,
  maxPieces: number = MAX_FILL_PIECES,
): Generator<readonly FillPiece[], 'done' | 'out of work'> {
  const options = optionsOf(parts);
  if (options.length === 0) return 'done';
  const maxReach = Math.max(...options.map((o) => o.reachMm));
  const target = opposed(frameOf(to.pos, to.heading, to.level));
  const start: End = { frame: frameOf(from.pos, from.heading, from.level), polarity: from.polarity };
  const used = new Map<string, number>();
  const run: FillPiece[] = [];
  const found: (readonly FillPiece[])[] = [];

  /** Depth-first to exactly `left` more pieces. Returns false when the work ran out. */
  const extend = (end: End, left: number): boolean => {
    for (const o of options) {
      if (work.left <= 0) return false;
      work.left -= 1;
      // A peg goes in a socket: the same kind never meets (finding 2: per joint, not per gap).
      if (o.entryPolarity === end.polarity) continue;
      const count = used.get(o.partId) ?? 0;
      if (count + 1 > stock(o.partId)) continue;
      const frame = frameForPortAt(o.entry, opposed(end.frame));
      const far = compose(frame, o.exit);
      if (left === 1) {
        if (
          o.exitPolarity !== to.polarity &&
          far.heading === target.heading &&
          equals(far.pos, target.pos)
        ) {
          found.push([...run, { partId: o.partId, turn: o.turn, port: o.port }]);
        }
        continue;
      }
      // What is left cannot span what remains: no need to look further down here.
      if (distance(far.pos, target.pos) > (left - 1) * maxReach + 1e-6) continue;
      used.set(o.partId, count + 1);
      run.push({ partId: o.partId, turn: o.turn, port: o.port });
      const ok = extend({ frame: far, polarity: o.exitPolarity }, left - 1);
      run.pop();
      used.set(o.partId, count);
      if (!ok) return false;
    }
    return true;
  };

  for (let n = 1; n <= maxPieces; n++) {
    // Nothing n pieces long can span the gap at all.
    if (distance(start.frame.pos, target.pos) > n * maxReach + 1e-6) continue;
    found.length = 0;
    const finished = extend(start, n);
    // What was found before the work ran out is still exact, and still only a candidate.
    yield* found;
    if (!finished) return 'out of work';
  }
  return 'done';
}
