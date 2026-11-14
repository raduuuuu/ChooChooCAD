/**
 * EVERY OPENING A TRAIN RUNS UNDER OR THROUGH, AND WHETHER IT FITS (plan
 * 2026-11-14, E5; eng review finding 8, docs/plan/2026-11-14-additions-eng.md).
 *
 * The judgement used to live in three places in the app: bridges and decks
 * read their part's stated opening (verdictView.ts), tunnels their lowest
 * vault (verdictView.ts), and plain raised track the ramp's rise
 * (VerdictLine.tsx), each then subtracting the plank and the train in the
 * verdict line's own code. A route walker needs the same answers, and two
 * copies of "does the train fit" can disagree. So it is here, once, and the
 * verdict line and the route both read it.
 *
 *   plain raised track over floor track ── opening = the ramp's rise ─────────┐
 *   a bridge or deck with a stated opening ── opening = the part's figure ────┼─▶ margin = opening - plank - train
 *   a tunnel piece ── opening = its LOWEST vault, floor to underside ─────────┘    fits when margin > 0
 *
 * THE MARGIN IS JUDGED UNROUNDED (app-focus review 2026-11-04, eng D1):
 * rounding first let -0.2mm read as "about 0mm to spare". At 0mm or less the
 * roof touches. Nothing here changes a layout's verdict: the layout can be
 * built, and only the train may not pass.
 *
 * NO NAMES AND NO PIECE NUMBERS: this says which pieces and how much room.
 * What the sentence calls them is the app's (verdictView.ts).
 */

import type { Segment } from '../geom/fk.js';
import type { Part } from '../parts/schema.js';
import type { PlankOverlap } from './overlap.js';

/** The three numbers the subtraction uses (engine/data/calibration.ts `clearance`). */
export interface TrainFigures {
  /** Floor to the underside of plain raised track: the ramp's rise. */
  readonly riseMm: number;
  /** The track the train stands on. */
  readonly plankMm: number;
  /** The tallest train. */
  readonly trainMm: number;
}

/** The room left over the train under an opening of this height, unrounded. Zero or less: the roof touches. */
export const trainMargin = (openingMm: number, f: TrainFigures): number => openingMm - f.plankMm - f.trainMm;

/** Whether the train passes with room to spare. The one comparison, for the verdict line and the route alike. */
export const trainFits = (openingMm: number, f: TrainFigures): boolean => trainMargin(openingMm, f) > 0;

export interface Opening {
  /** Plain raised track, a bridge or deck with its own stated opening, or a tunnel the train goes through. */
  readonly kind: 'raised' | 'bridge' | 'tunnel';
  /** The piece overhead. For a tunnel, the tunnel piece itself. */
  readonly over: string;
  /** The piece the train is on there. For a tunnel, the tunnel piece itself. */
  readonly under: string;
  /** Where the two cross on the plan, in millimetres. Null for a tunnel: the opening is the whole piece. */
  readonly at: readonly [number, number] | null;
  /** Floor to the underside of what is overhead. */
  readonly openingMm: number;
  /** True when that height was not read off a real piece. */
  readonly estimated: boolean;
  /** `trainMargin` of the opening. */
  readonly marginMm: number;
  readonly fits: boolean;
}

const made = (
  kind: Opening['kind'],
  over: string,
  under: string,
  at: Opening['at'],
  openingMm: number,
  estimated: boolean,
  f: TrainFigures,
): Opening => ({ kind, over, under, at, openingMm, estimated, marginMm: trainMargin(openingMm, f), fits: trainFits(openingMm, f) });

/** A bridge's or a raised deck's own stated opening, or undefined when the part states none. */
export function statedOpening(part: Part): { readonly openingMm: number; readonly estimated: boolean } | undefined {
  if (part.kind !== 'straight') return undefined;
  const openingMm = part.hump?.clearanceMm ?? part.deckClearanceMm;
  if (openingMm === undefined) return undefined;
  return { openingMm, estimated: part.hump?.clearanceEstimated === true };
}

/**
 * The room in a tunnel piece: floor to the underside of its LOWEST vault
 * (decorated-pieces eng D7). A tunnel can be several vaults (two portals and
 * a tube between them); the first one found overstated the room by 2mm. An
 * opening on a piece nobody has measured is an estimate.
 */
export function tunnelOpening(part: Part): { readonly openingMm: number; readonly estimated: boolean } | undefined {
  const vaults = (part.decor ?? []).flatMap((d) => (d.kind === 'vault' ? [d.topMm - d.wallMm] : []));
  if (vaults.length === 0) return undefined;
  return { openingMm: Math.min(...vaults), estimated: part.dimensions.status === 'unverified' };
}

/**
 * Each place track passes under a bridge or deck that states its opening. One
 * per crossing, in the order given. `crossings` is every different-level
 * crossing with its place (solve.ts `crossings`); a pair not found there has
 * no place (`at` null).
 */
export function bridgeOpenings(
  underBridges: readonly { readonly bridge: string; readonly under: string }[],
  partOf: (pieceId: string) => Part,
  f: TrainFigures,
  crossings: readonly PlankOverlap[] = [],
): Opening[] {
  const placeOf = (x: string, y: string) => crossings.find((c) => (c.a === x && c.b === y) || (c.a === y && c.b === x))?.at ?? null;
  return underBridges.flatMap(({ bridge, under }) => {
    const stated = statedOpening(partOf(bridge));
    return stated ? [made('bridge', bridge, under, placeOf(bridge, under), stated.openingMm, stated.estimated, f)] : [];
  });
}

/** Each tunnel piece, in the order given. The train goes through it whatever else is on the table. */
export function tunnelOpenings(
  pieces: readonly { readonly pieceId: string; readonly partId: string }[],
  resolve: (partId: string) => Part,
  f: TrainFigures,
): Opening[] {
  return pieces.flatMap((p) => {
    const tunnel = tunnelOpening(resolve(p.partId));
    return tunnel ? [made('tunnel', p.pieceId, p.pieceId, null, tunnel.openingMm, tunnel.estimated, f)] : [];
  });
}

/**
 * Each place plain raised track crosses over floor track. The opening is the
 * ramp's rise, a measured figure, so never an estimate here. Which piece is
 * overhead is read from the drawn track: the one whose track reaches higher.
 */
export function raisedOpenings(crossings: readonly PlankOverlap[], segments: readonly Segment[], f: TrainFigures): Opening[] {
  const top = new Map<string, number>();
  for (const sg of segments) {
    if (sg.pieceId === undefined) continue;
    top.set(sg.pieceId, Math.max(top.get(sg.pieceId) ?? 0, (sg.level ?? 0) + (sg.rise ?? 0)));
  }
  return crossings.map((c) => {
    const aOver = (top.get(c.a) ?? 0) >= (top.get(c.b) ?? 0);
    return made('raised', aOver ? c.a : c.b, aOver ? c.b : c.a, c.at, f.riseMm, false, f);
  });
}

/**
 * Every opening on the layout: plain raised crossings, bridges, tunnels, in
 * that order. A crossing under a bridge that states its own opening is that
 * bridge's, not plain raised track: it is listed once, with the bridge's figure.
 */
export function openings(
  facts: {
    readonly bridges: readonly PlankOverlap[];
    readonly underBridges: readonly { readonly bridge: string; readonly under: string }[];
    /** Every different-level crossing with its place; absent, bridges have none. */
    readonly crossings?: readonly PlankOverlap[];
  },
  pieces: readonly { readonly pieceId: string; readonly partId: string }[],
  resolve: (partId: string) => Part,
  segments: readonly Segment[],
  f: TrainFigures,
): Opening[] {
  const partId = new Map(pieces.map((p) => [p.pieceId, p.partId]));
  const partOf = (pieceId: string) => resolve(partId.get(pieceId)!);
  const bridged = bridgeOpenings(facts.underBridges, partOf, f, facts.crossings);
  const own = new Set(bridged.map((o) => `${o.over}|${o.under}`));
  const raised = raisedOpenings(facts.bridges, segments, f).filter((o) => !own.has(`${o.over}|${o.under}`));
  return [...raised, ...bridged, ...tunnelOpenings(pieces, resolve, f)];
}
