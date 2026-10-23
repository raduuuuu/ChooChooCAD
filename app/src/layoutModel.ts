/**
 * The layout the app edits: a graph, not a chain.
 *
 * FREE-END CLICKING is the interaction this exists for. Decision D5 cut full
 * drag-and-drop and named this as "the smallest interaction that makes a
 * branch buildable": select a free end, click a piece, it attaches there. Two
 * free ends can be welded to each other, which is how a loop closes.
 *
 * `closed: boolean` is RETIRED. It was a property of a list, and the question
 * it answered ("does the last piece join the first?") has no meaning once a
 * layout can be a tree, a forest, or two loops sharing a switch. Closure is
 * now a weld a user declares like any other, which is also why the engine
 * never has to guess whether two coincident ends are joined.
 *
 * Everything here is pure: no React, no localStorage reads at module scope,
 * no `window`. The operations take a graph and return a new one.
 */

import { add, fromInt, mulZetaPow, scale, sub, toXY, zetaPow, type Cyc } from '../../engine/src/geom/cyclotomic.js';
import { removePiece, removeWeld } from '../../engine/src/graph/edit.js';
import { connectorSites, landingOf } from '../../engine/src/graph/feasible.js';
import { findPlankOverlaps } from '../../engine/src/graph/overlap.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import type { Segment } from '../../engine/src/geom/fk.js';
import { findLevelFaults, placeAll, portFrame, type PortsOf } from '../../engine/src/graph/frames.js';
import {
  compose,
  frameForPortAt,
  frameOf,
  levelOf,
  norm16,
  opposed,
  type Frame,
  type Graph,
  type Piece,
  type PortRef,
  type Weld,
} from '../../engine/src/graph/model.js';
import type { Part, Polarity, Turn } from '../../engine/src/parts/schema.js';

export const EMPTY_GRAPH: Graph = { pieces: [], welds: [] };

/** Stable within a session; the graph stores it, so it must not be an index. */
export function newPieceId(existing: readonly Piece[]): string {
  let n = existing.length;
  const taken = new Set(existing.map((p) => p.pieceId));
  // Linear probe rather than a counter in state: deleting piece 3 and adding
  // another must not reuse id 3 while a weld or anchor still names it.
  while (taken.has(`p${n}`)) n++;
  return `p${n}`;
}

export function isFree(graph: Graph, ref: PortRef): boolean {
  return !graph.welds.some(
    (w) =>
      (w.a.pieceId === ref.pieceId && w.a.port === ref.port) ||
      (w.b.pieceId === ref.pieceId && w.b.port === ref.port),
  );
}

/**
 * Add a piece, welding its port 0 to `at` when one is given.
 *
 * Returns the new graph and the port a user would most likely want selected
 * next: the new piece's far end, so clicking piece after piece builds a run
 * without reselecting. For a switch there are two far ends and the through
 * road is the one offered, because continuing straight is the common case
 * and the diverging road is one more click away rather than a guess.
 */
/**
 * The grid new runs are spaced on. One long straight.
 *
 * EXPORTED because `layoutStore` re-anchors orphaned components onto the same
 * lanes. It was declared privately in both files, with layoutStore's copy
 * commenting "matching layoutModel's" and nothing enforcing it -- the
 * retyped-constant pattern `storageKeys.ts` was created to end. This module
 * owns lane assignment, so it owns the number.
 */
export const RUN_SPACING_MM = 216;

/**
 * Where to start a run so it does not land on the track already there.
 *
 * Without this every component anchors at the identity and a second run is
 * drawn straight through the first. The canvas showed two runs crossing at
 * the origin, and because they were separate pieces with no weld between them
 * the overlap was a real feasibility clash as well.
 *
 * PERPENDICULAR, and far enough to clear what exists. Offsetting along the
 * track direction was the first attempt and it put a new run exactly where
 * the old one ended: three 144mm straights are 432mm, and the offset was
 * 216 x 2. Runs go side by side now, cleared by the existing layout's own
 * height.
 *
 * The DISTANCE is chosen with floats, which is fine: picking where to put
 * something is not computing geometry. What is stored is an integer multiple
 * of an exact lattice vector, so the anchor itself stays exact and the
 * engine never sees a rounded number.
 */
export function nextRunAnchor(graph: Graph, ports: PortsOf): Frame {
  const place = placeAll(graph, ports);
  let maxY = 0;
  let minY = 0;
  for (const piece of graph.pieces) {
    const count = ports(piece).length;
    for (let i = 0; i < count; i++) {
      const [, y] = toXY(portFrame(place, ports, piece, i).pos);
      if (y > maxY) maxY = y;
      if (y < minY) minY = y;
    }
  }
  const clearance = maxY - minY + RUN_SPACING_MM;
  const steps = Math.max(1, Math.ceil(clearance / RUN_SPACING_MM));
  // zeta^4 is a quarter turn: straight across from the track already down.
  return { pos: scale(zetaPow(4), RUN_SPACING_MM * steps), heading: 0 };
}

export function addPiece(
  graph: Graph,
  partId: string,
  turn: Turn,
  portCount: number,
  at: PortRef | null,
  /*
   * REQUIRED, not optional (task T4, gate decision d6).
   *
   * It was optional, and the anchoring below is gated on having it, so the
   * two call sites disagreed in a way nothing could see: `add` passed it and
   * `preset` did not, which meant a preset step that failed to attach started
   * a run with NO anchor and `placeAll` then put that component at the
   * identity, on top of whatever was already at the origin. The solver reads
   * that as a clash in a layout the user built correctly. Required is what
   * stops the two paths drifting again when a one-port buffer or T2's
   * three-port switch makes the unattached step reachable.
   */
  ports: PortsOf,
  /**
   * Which end goes on, and which way it bends: a choice from `fitOptions`,
   * made with the preview (decision R3). Omitted, the automatic choice of
   * `orientation` applies, so presets and the existing callers are unchanged.
   */
  choice?: Fit,
  /**
   * Where a piece that starts a run goes (a free preview or a drop). Always
   * applied when given, including to the first piece on an empty layout.
   */
  anchor?: Frame,
): { graph: Graph; select: PortRef | null } {
  const pieceId = newPieceId(graph.pieces);
  const attaching = at !== null && isFree(graph, at);
  const { port: joinBy, turn: placedTurn } = attaching
    ? (choice ?? orientation(graph, ports, at, pieceId, partId, turn))
    : { port: 0, turn: choice?.turn ?? turn };
  const piece: Piece = { pieceId, partId, turn: placedTurn };
  const pieces = [...graph.pieces, piece];
  const welds: Weld[] = attaching
    ? [...graph.welds, { a: at, b: { pieceId, port: joinBy } }]
    : [...graph.welds];

  // A piece that attaches joins an existing component and needs no anchor.
  // One that starts a new run gets put down beside what is already there.
  const anchors = new Map(graph.anchors ?? []);
  if (!attaching && anchor !== undefined) {
    anchors.set(pieceId, anchor);
  } else if (!attaching && graph.pieces.length > 0) {
    anchors.set(pieceId, nextRunAnchor(graph, ports));
  }

  /*
   * The far end to continue from: port 1 when the piece went on by its start,
   * and its start (a switch's heel) when it went on turned round.
   */
  const select: PortRef | null =
    portCount > 1 ? { pieceId, port: joinBy === 0 ? 1 : 0 } : null;
  return { graph: { pieces, welds, anchors }, select };
}

const flip = (t: Turn): Turn => (t === 'left' ? 'right' : 'left');

/** One way a piece can go on at an end: which of its ends, and its turn. */
export interface Fit {
  readonly port: number;
  readonly turn: Turn;
  /** Its attaching end is a socket meeting a socket: needs a male-male adapter (X1). */
  readonly adapter?: true;
}

/**
 * EVERY WAY THIS PART CAN GO ON AT THIS END (decision R3; spec amendments
 * "fitOptions"; decision 18A splits the turn out as Flip).
 *
 * The pairs (end, turn) whose end is the opposite kind to the one it meets,
 * de-duplicated by where the piece then lies (a straight's left and right are
 * the same piece), with `orientation`'s own choice first so a preview starts
 * where a click used to land. When nothing fits (a two-peg piece onto a peg)
 * the one automatic choice comes back flagged `refused`, so there is always
 * an option to show and the preview can say why it is red.
 *
 * SOCKET ON SOCKET is a way too, with a male-male adapter (X1, 2026-10-23):
 * flagged `adapter` and listed AFTER every ordinary way, so the default and
 * the first R stop are never an adapter when an ordinary way exists. The
 * de-duplication key includes that flag: an adapter way can land its ends on
 * exactly the spots an ordinary way does (a straight turned round), and
 * without the flag it was dropped as a duplicate and R never reached it.
 * Peg on peg is never a way.
 */
export function fitOptions(
  graph: Graph,
  ports: PortsOf,
  at: PortRef,
  partId: string,
): { readonly options: readonly Fit[]; readonly refused: boolean } {
  const target = graph.pieces.find((p) => p.pieceId === at.pieceId);
  const probe: Piece = { pieceId: '\u0000fit', partId, turn: 'left' };
  const first = orientation(graph, ports, at, probe.pieceId, partId, 'left');
  if (!target) return { options: [first], refused: true };
  const meeting = ports(target)[at.port]?.polarity;
  const place = placeAll(graph, ports);
  const targetFrame = opposed(portFrame(place, ports, target, at.port));
  const seen = new Set<string>();
  const out: Fit[] = [];
  const consider = (fit: Fit) => {
    const own = ports({ ...probe, turn: fit.turn });
    const attaching = own[fit.port]?.polarity;
    if (attaching === meeting && meeting === 'peg') return;
    const adapter = attaching === meeting;
    const frame = frameForPortAt(own[fit.port]!.at, targetFrame);
    // Where every end of the piece lands, as a set: the same set is the same
    // piece. Prefixed with the adapter flag, so the two kinds never merge.
    const key = (adapter ? 'adapter|' : '') + own
      .map((p) => JSON.stringify(compose(frame, p.at)))
      .sort()
      .join('|');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(adapter ? { port: fit.port, turn: fit.turn, adapter: true } : { port: fit.port, turn: fit.turn });
  };
  consider(first);
  for (const turn of ['left', 'right'] as const) {
    const count = ports({ ...probe, turn }).length;
    for (let port = 0; port < count; port++) consider({ port, turn });
  }
  // Ordinary ways first, in the order found (so `orientation`'s own leads), then adapter ways.
  const ordered = [...out.filter((o) => !o.adapter), ...out.filter((o) => o.adapter)];
  return ordered.length > 0 ? { options: ordered, refused: false } : { options: [first], refused: true };
}

/**
 * The ways R steps through (X1, outside voice OV1): every way with the
 * current turn, plus any way of the other turn at an end the current turn has
 * no way for; ordinary ways first, adapter ways last.
 *
 * The second part is for a straight, whose two turns lie the same, so its
 * ordinary and adapter ways can be stored with different turns. Without it, a
 * straight's adapter way was reachable only by an unadvertised F (Flip is
 * hidden for straights). Defined by ends, not by which way is current, so
 * every way in a cycle sees the same cycle and R always comes back round.
 */
export function rotateCycle(options: readonly Fit[], turn: Turn): readonly Fit[] {
  const same = options.filter((o) => o.turn === turn);
  const lone = options.filter((o) => o.turn !== turn && !same.some((s) => s.port === o.port));
  const cycle = [...same, ...lone];
  return [...cycle.filter((o) => !o.adapter), ...cycle.filter((o) => o.adapter)];
}

/**
 * The frame a piece takes when it goes on at `at` by `fit` (decision ENG-R4):
 * the same exact arithmetic `placeAll` uses for a tree weld, done for one
 * piece, so a preview costs nothing however big the layout is. A spec holds
 * it equal to where Place actually puts the piece.
 */
export function frameAt(
  graph: Graph,
  ports: PortsOf,
  placement: ReturnType<typeof placeAll>,
  at: PortRef,
  partId: string,
  fit: Fit,
): Frame {
  const target = graph.pieces.find((p) => p.pieceId === at.pieceId)!;
  const own = ports({ pieceId: '\u0000fit', partId, turn: fit.turn });
  return frameForPortAt(own[fit.port]!.at, opposed(portFrame(placement, ports, target, at.port)));
}

/** A piece being placed, as `ghostFit` reads it (the reducer's `Ghost`). */
export interface PendingPiece {
  readonly partId: string;
  readonly at: PortRef | null;
  readonly frame: Frame | null;
  readonly turn: Turn;
  readonly port: number;
}

/** Why a pending piece would not sit right, in data; the app words it. */
export type FitConflict =
  /** The end it goes on by meets an end of its own kind. */
  | { readonly kind: 'here'; readonly polarity: Polarity }
  /** Another of its ends lands on a free end of its own kind. */
  | { readonly kind: 'polarity'; readonly polarity: Polarity; readonly pieceId: string }
  /** Another of its ends lands where it cannot join (crowded, or not facing). */
  | { readonly kind: 'crowded'; readonly pieceId: string }
  /**
   * It would join, but the join would move placed track (eng D6). A backstop
   * since backlog D7: the forest picks a loop's gap by weld order, so an exact
   * join moves nothing and nothing reaches this today.
   */
  | { readonly kind: 'loop' }
  /** Its wood would lie over a placed piece's (overlap.ts). Needs `geometry`. */
  | { readonly kind: 'over'; readonly pieceId: string }
  /** A ramp that would lift track to a third level (two-layer plan, E1). */
  | { readonly kind: 'level' };

/**
 * What the wood check needs that ports alone do not carry: plank widths and
 * curve radii, through the part. `segments` is the placed layout's render,
 * when the caller already has it; otherwise it is drawn here.
 */
export interface FitGeometry {
  readonly resolve: (id: string) => Part;
  readonly segments?: readonly Segment[];
}

/**
 * WHETHER A PENDING PIECE FITS WHERE IT IS SHOWN (decisions E1, D13, D20, eng
 * D6, 6A). Its frame, every conflict, and the end it would join. No
 * conflicts means Place would put it down clean; the preview turns red
 * otherwise, and a palette drop then leaves it pending instead of placing.
 *
 * One function for both readers: the Placing strip words the conflicts, and
 * the reducer's drop decides on them, so the two cannot disagree.
 */
export function ghostFit(
  graph: Graph,
  ports: PortsOf,
  ghost: PendingPiece,
  placement: ReturnType<typeof placeAll> = placeAll(graph, ports),
  sites: ReturnType<typeof connectorSites> = connectorSites(graph, ports, placement),
  /** Without it, wood over wood goes unchecked: only ends are compared. */
  geometry?: FitGeometry,
): {
  readonly frame: Frame;
  readonly conflicts: readonly FitConflict[];
  /** The last end it would join, or null. Kept for callers that only ask "does it join". */
  readonly joinsTo: PortRef | null;
  /** Every end it would join, each with whether that joint needs a male-male adapter. */
  readonly joins: readonly { readonly to: PortRef; readonly adapter: boolean }[];
  /** True when the end it goes on by is a socket meeting a socket. */
  readonly adapterHere: boolean;
  /**
   * True when placing it would change the level of track already placed: a
   * ramp laid descending from a floor end raises that whole run (L1). The
   * placing strip says so before Place (design 2A).
   */
  readonly relevels: boolean;
} {
  const piece: Piece = { pieceId: '\u0000ghost', partId: ghost.partId, turn: ghost.turn };
  const frame = ghost.at
    ? frameAt(graph, ports, placement, ghost.at, ghost.partId, { port: ghost.port, turn: ghost.turn })
    : ghost.frame!;
  const own = placeAll({ pieces: [piece], welds: [], anchors: new Map([[piece.pieceId, frame]]) }, ports);
  const ends = ports(piece);
  const conflicts: FitConflict[] = [];
  let joinsTo: PortRef | null = null;
  let joins: { to: PortRef; adapter: boolean }[] = [];
  /*
   * THE END IT GOES ON BY, checked on its own (eng review): peg on peg is the
   * `here` conflict; socket on socket needs an adapter. Not from
   * `fitOptions(...).refused`, which is about the whole part, now that a
   * socket-to-socket way is a real option.
   */
  let adapterHere = false;
  if (ghost.at) {
    const target = graph.pieces.find((p) => p.pieceId === ghost.at!.pieceId);
    const meeting = target ? ports(target)[ghost.at.port]?.polarity : undefined;
    const attaching = ends[ghost.port]!.polarity;
    if (meeting === attaching && attaching === 'peg') conflicts.push({ kind: 'here', polarity: attaching });
    else if (meeting === attaching) adapterHere = true;
  }
  for (let i = 0; i < ends.length; i++) {
    if (ghost.at && i === ghost.port) continue;
    const landing = landingOf(sites, portFrame(own, ports, piece, i), ends[i]!.polarity);
    if (landing.kind === 'joins') {
      joinsTo = landing.with;
      joins.push({ to: landing.with, adapter: landing.adapter === true });
    }
    else if (landing.kind === 'conflict') {
      const pieceId = landing.with[0]!.pieceId;
      conflicts.push(
        landing.reason === 'polarity' ? { kind: 'polarity', polarity: ends[i]!.polarity, pieceId } : { kind: 'crowded', pieceId },
      );
    }
  }
  if (joinsTo && conflicts.length === 0) {
    // Would the join move anything? Only then is it refused (eng D6; a backstop since D7).
    const placed = ghost.at
      ? addPiece(graph, ghost.partId, ghost.turn, ends.length, ghost.at, ports, { port: ghost.port, turn: ghost.turn })
      : addPiece(graph, ghost.partId, ghost.turn, ends.length, null, ports, { port: 0, turn: ghost.turn }, frame);
    const id = placed.graph.pieces[placed.graph.pieces.length - 1]!.pieceId;
    if (autoJoin(placed.graph, ports, id).joined === 0) {
      conflicts.push({ kind: 'loop' });
      joinsTo = null;
      joins = [];
    }
  }
  if (geometry) {
    /*
     * WOOD ON WOOD, for the preview AND the drop guard, decided once here so
     * the two cannot disagree. The piece it goes on by and the one it would
     * join only meet it at a joint, so they are welds here, as they would be
     * once placed. Only pairs with the new piece are read: the layout's own
     * overlaps are the verdict's. A piece its ends already clash with is
     * named once, by that conflict.
     */
    const { resolve } = geometry;
    const alone = placeAll({ pieces: [piece], welds: [], anchors: new Map([[piece.pieceId, frame]]) }, ports);
    const welds = [ghost.at, joinsTo]
      .filter((r): r is PortRef => r !== null)
      .map((r) => ({ a: r, b: { pieceId: piece.pieceId, port: 0 } }));
    const named = new Set(conflicts.flatMap((c) => ('pieceId' in c ? [c.pieceId] : [])));
    const over = findPlankOverlaps(
      { pieces: [...graph.pieces, piece], welds },
      [
        ...(geometry.segments ?? renderGraph(graph, ports, resolve, placement).segments),
        ...renderGraph({ pieces: [piece], welds: [] }, ports, resolve, alone).segments,
      ],
      (id) => resolve(id).plankWidthMm / 2,
      sites,
    );
    for (const o of over) {
      if (o.a !== piece.pieceId && o.b !== piece.pieceId) continue;
      const other = o.a === piece.pieceId ? o.b : o.a;
      if (!named.has(other)) conflicts.push({ kind: 'over', pieceId: other });
    }
  }
  /*
   * LEVELS (two-layer plan, E1 and OV1). Only a ramp changes a level, so only
   * a ramp pays for this: the placement simulated once, then two questions the
   * local checks above cannot answer. Would it lift track to a third level,
   * its own high end or, by raising a whole run, a ramp already there? And
   * would raising that run lay it over track it used to pass under or beside?
   * The local check above only sees the new piece; a run that changes level
   * is checked whole.
   */
  let relevels = false;
  if (ends.some((e) => levelOf(e.at) !== 0)) {
    const placed = ghost.at
      ? addPiece(graph, ghost.partId, ghost.turn, ends.length, ghost.at, ports, { port: ghost.port, turn: ghost.turn })
      : addPiece(graph, ghost.partId, ghost.turn, ends.length, null, ports, { port: 0, turn: ghost.turn }, frame);
    const id = placed.graph.pieces[placed.graph.pieces.length - 1]!.pieceId;
    const candidate = autoJoin(placed.graph, ports, id).graph;
    const after = placeAll(candidate, ports);
    relevels = graph.pieces.some((p) => levelOf(placement.frames.get(p.pieceId)!) !== levelOf(after.frames.get(p.pieceId)!));
    const thirdBefore = findLevelFaults(graph, ports, placement).thirdLevels.length;
    if (findLevelFaults(candidate, ports, after).thirdLevels.length > thirdBefore) conflicts.push({ kind: 'level' });
    if (relevels && geometry) {
      const { resolve } = geometry;
      const half = (pid: string) => resolve(pid).plankWidthMm / 2;
      const pair = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
      const had = new Set(
        findPlankOverlaps(graph, renderGraph(graph, ports, resolve, placement).segments, half, sites).map((o) => pair(o.a, o.b)),
      );
      const moved = new Set(graph.pieces.filter((p) => levelOf(placement.frames.get(p.pieceId)!) !== levelOf(after.frames.get(p.pieceId)!)).map((p) => p.pieceId));
      const named = new Set(conflicts.flatMap((c) => ('pieceId' in c ? [c.pieceId] : [])));
      for (const o of findPlankOverlaps(candidate, renderGraph(candidate, ports, resolve, after).segments, half, connectorSites(candidate, ports, after))) {
        if (had.has(pair(o.a, o.b))) continue;
        const other = moved.has(o.a) || o.a === id ? o.b : o.a;
        if (!named.has(other)) {
          named.add(other);
          conflicts.push({ kind: 'over', pieceId: other });
        }
      }
    }
  }
  return { frame, conflicts, joinsTo, joins, adapterHere, relevels };
}

/**
 * WHICH WAY A NEW PIECE GOES ON BY DEFAULT (the owner's ruling after QA
 * ISSUE-002, 2026-10-22): the first fit option that would also join a facing
 * end cleanly, so a piece offered at the edge of a one-piece gap closes it;
 * else the first option, `orientation`'s own choice. The preview starts here
 * and a double-click places here, so the two routes cannot disagree.
 */
export function defaultFit(graph: Graph, ports: PortsOf, at: PortRef, partId: string): Fit {
  const { options } = fitOptions(graph, ports, at, partId);
  const placement = placeAll(graph, ports);
  const sites = connectorSites(graph, ports, placement);
  /*
   * Never an adapter when an ordinary way would do (X1): a fit that closes a
   * gap only by needing an adapter, at either end, does not count as closing.
   * `options[0]` is already ordinary when one exists.
   */
  const closes = options.find((o) => {
    const fit = ghostFit(graph, ports, { partId, at, frame: null, ...o }, placement, sites);
    return fit.joinsTo !== null && fit.conflicts.length === 0 && !fit.adapterHere && fit.joins.every((j) => !j.adapter);
  });
  return closes ?? options[0]!;
}

/**
 * JOIN WHAT A NEW OR MOVED PIECE LANDED ON, WHEN THAT IS A REAL JOINT
 * (decisions D13, D20 and eng D6).
 *
 * Each free end of `pieceId` that lands exactly on one free end of the other
 * kind, facing it, is welded, one weld at a time, each checked against the
 * frames before it: a weld that would move anything is left unwelded, which
 * the preview reports as a conflict. That check was written because a join
 * could re-lay a loop that does not close (measured 600mm). Backlog D7 fixed
 * the cause in the forest, so it is now a backstop that nothing reaches.
 */
export function autoJoin(
  graph: Graph,
  ports: PortsOf,
  pieceId: string,
): { graph: Graph; joined: number; adapters: number } {
  const piece = graph.pieces.find((p) => p.pieceId === pieceId);
  if (!piece) return { graph, joined: 0, adapters: 0 };
  let current = graph;
  let joined = 0;
  // Of those joins, how many put two sockets together (for the announcement).
  let adapters = 0;
  const own = ports(piece);
  for (let port = 0; port < own.length; port++) {
    const ref = { pieceId, port };
    if (!isFree(current, ref)) continue;
    const place = placeAll(current, ports);
    const sites = connectorSites(current, ports, place);
    const landing = landingOf(sites, portFrame(place, ports, piece, port), own[port]!.polarity, new Set([pieceId]));
    if (landing.kind !== 'joins') continue;
    const next = weldEnds(current, ref, landing.with);
    if (movesAnything(current, next, ports)) continue;
    current = next;
    joined++;
    if (landing.adapter) adapters++;
  }
  return { graph: current, joined, adapters };
}

/** Whether any piece's exact frame differs between two versions of a layout. */
export function movesAnything(before: Graph, after: Graph, ports: PortsOf): boolean {
  const was = placeAll(before, ports).frames;
  const now = placeAll(after, ports).frames;
  for (const [id, frame] of was) {
    const f = now.get(id);
    if (f && JSON.stringify(f) !== JSON.stringify(frame)) return true;
  }
  return false;
}

/**
 * WHICH WAY ROUND THE NEW PIECE GOES ON (the auto-flip).
 *
 * A piece attaches by its start, port 0. When that start is the same kind as
 * the end it is meeting -- a socket on a socket, the M switch's road then an
 * E, say -- real track would simply be turned round so its other end goes in.
 * Before this the editor built the one joint that cannot exist and the
 * verdict, correctly, refused it. So: attach by the first port of the
 * OPPOSITE kind instead.
 *
 * Turned round, a curve laid with `turn: 'left'` bends right along the
 * direction you are building in. So the stored turn flips too, and the piece
 * bends the way the palette button asked as you travel along the track. The
 * same holds for a switch's diverging road.
 *
 * A piece with no end of the opposite kind (B, C, B2, C2 onto the wrong
 * end) goes on by its start as before, and the joint is refused honestly:
 * there is no way round that makes it fit.
 */
function orientation(
  graph: Graph,
  ports: PortsOf,
  at: PortRef,
  pieceId: string,
  partId: string,
  turn: Turn,
): { port: number; turn: Turn } {
  const target = graph.pieces.find((p) => p.pieceId === at.pieceId);
  const meeting = target ? ports(target)[at.port]?.polarity : undefined;
  const own = ports({ pieceId, partId, turn });
  if (meeting === undefined || own[0]?.polarity !== meeting) return { port: 0, turn };
  const other = own.findIndex((p) => p.polarity !== meeting);
  return other === -1 ? { port: 0, turn } : { port: other, turn: flip(turn) };
}

/**
 * Weld two free ends to each other. This is what closing a loop now is.
 *
 * Refuses a port to itself and refuses a pair already welded. It does NOT
 * refuse a weld whose geometry does not meet: that is the verdict's job, and
 * declaring a join the track cannot make is exactly the thing the user is
 * asking to be told about.
 */
export function weldEnds(graph: Graph, a: PortRef, b: PortRef): Graph {
  if (a.pieceId === b.pieceId && a.port === b.port) return graph;
  if (!isFree(graph, a) || !isFree(graph, b)) return graph;
  return { ...graph, welds: [...graph.welds, { a, b }] };
}

/** Delete a piece and everything that pointed at it (T11). */
export function deletePiece(graph: Graph, ports: PortsOf, pieceId: string): Graph {
  return removePiece(graph, ports, pieceId);
}

/** Break one declared join, leaving both halves where they are (T3). */
export function breakWeld(graph: Graph, ports: PortsOf, weldIndex: number): Graph {
  return removeWeld(graph, ports, weldIndex);
}

/** The most recently added piece, for an undo-shaped "remove last". */
export function lastPieceId(graph: Graph): string | null {
  return graph.pieces.length === 0 ? null : graph.pieces[graph.pieces.length - 1]!.pieceId;
}

/** A rigid move of a run: turn by `turns` sixteenths about `pivot`, then shift by `by`. */
export interface RunMove {
  readonly turns: number;
  /** Exact lattice displacement (whole millimetres, or an exact end-to-end snap). */
  readonly by: Cyc;
}

/** The exact displacement of whole millimetres along x and y. */
export const shiftMm = (dx: number, dy: number): Cyc =>
  add(fromInt(Math.round(dx)), scale(zetaPow(4), Math.round(dy)));

/**
 * MOVE A WHOLE RUN, RIGIDLY AND EXACTLY (decisions E6, D10, D14; eng D6).
 *
 * The run is every piece connected to `pieceId`. It turns about that piece's
 * first end, which is a lattice point, and shifts by a lattice vector, so
 * every frame stays exact and a loop that closed still closes: the move only
 * rewrites the anchor of the run's root, and the forest lays the rest from it.
 *
 * REFUSED, with a reason, when any end of the moved run would then sit on
 * another end that it cannot join (crowded, same kind, or not facing), or,
 * given `geometry`, when its wood would lie over track outside the run. A
 * refused move changes nothing. Otherwise every exact, facing landing joins.
 * A join that would move placed track is refused too, as a backstop: since
 * backlog D7 none does.
 */
export function moveRun(
  graph: Graph,
  ports: PortsOf,
  pieceId: string,
  move: RunMove,
  /** Plank shapes, so a run is not moved onto track. Without it, only ends are compared. */
  geometry?: FitGeometry,
): { graph: Graph; refused: string | null; joined: number; adapters: number } {
  const place = placeAll(graph, ports);
  const grabbed = graph.pieces.find((p) => p.pieceId === pieceId);
  const comp = place.forest.component.get(pieceId);
  if (!grabbed || comp === undefined) return { graph, refused: null, joined: 0, adapters: 0 };
  const root = place.forest.roots[comp]!;
  const members = new Set(graph.pieces.map((p) => p.pieceId).filter((id) => place.forest.component.get(id) === comp));
  const pivot = portFrame(place, ports, grabbed, 0).pos;
  const rootFrame = place.frames.get(root)!;
  // A move turns and shifts a run; it never changes its level (I1: a raised
  // run with no ramp keeps its level only here, in its root's anchor).
  const moved: Frame = frameOf(
    add(add(pivot, mulZetaPow(sub(rootFrame.pos, pivot), move.turns)), move.by),
    norm16(rootFrame.heading + move.turns),
    levelOf(rootFrame),
  );
  const anchors = new Map(graph.anchors ?? []);
  anchors.set(root, moved);
  const next: Graph = { ...graph, anchors };

  // What each moved free end now lands on, among the ends that did not move.
  const nextPlace = placeAll(next, ports);
  const sites = connectorSites(next, ports, nextPlace);
  let joins = 0;
  for (const piece of next.pieces) {
    if (!members.has(piece.pieceId)) continue;
    const own = ports(piece);
    for (let port = 0; port < own.length; port++) {
      if (!isFree(next, { pieceId: piece.pieceId, port })) continue;
      const landing = landingOf(sites, portFrame(nextPlace, ports, piece, port), own[port]!.polarity, members);
      if (landing.kind === 'conflict') {
        return {
          graph,
          refused: landing.reason === 'polarity' ? 'two ends of the same kind would meet' : 'its ends would land on other track ends',
          joined: 0,
          adapters: 0,
        };
      }
      if (landing.kind === 'joins') joins++;
    }
  }
  let joined = next;
  let count = 0;
  let adapters = 0;
  for (const id of members) {
    const step = autoJoin(joined, ports, id);
    joined = step.graph;
    count += step.joined;
    adapters += step.adapters;
  }
  if (count < joins) {
    return { graph, refused: 'joining there would shift pieces of a loop that does not close', joined: 0, adapters: 0 };
  }
  if (geometry) {
    /*
     * WOOD ON WOOD (overlap.ts), as a drop is refused for it: the run, where
     * it would end up, against every piece outside it. Overlaps inside the
     * run, or between pieces it does not touch, are the verdict's to report;
     * a move is refused only for what the move itself would cause or keep.
     */
    const { resolve } = geometry;
    const placed = placeAll(joined, ports);
    const over = findPlankOverlaps(
      joined,
      renderGraph(joined, ports, resolve, placed).segments,
      (id) => resolve(id).plankWidthMm / 2,
      connectorSites(joined, ports, placed),
    );
    if (over.some((o) => members.has(o.a) !== members.has(o.b))) {
      return { graph, refused: 'it would lie over other track', joined: 0, adapters: 0 };
    }
  }
  return { graph: joined, refused: null, joined: count, adapters };
}

/**
 * SNAP A DROPPED RUN ONTO A NEARBY END (eng spec amendments, "Drag details").
 *
 * When one of the moved run's free ends would come to rest within
 * `radiusMm` of a free end of the other kind on other track, the move is
 * replaced by the exact one that makes the two meet, facing: the turn that
 * opposes their headings, then the lattice shift that lands one on the other.
 * The nearest such pair wins. Otherwise the move is returned unchanged. Exact
 * arithmetic throughout, so a snapped join is a real joint, and `moveRun`
 * then joins it.
 */
/**
 * Whether a free end on ANOTHER level lies within `radiusMm` of one of the
 * run's free ends once `move` is applied (two-layer plan, design 5A). Snapping
 * never reaches such an end (OV3); this is what lets the drop say why.
 */
export function otherLevelEndNear(graph: Graph, ports: PortsOf, pieceId: string, move: RunMove, radiusMm: number): boolean {
  const place = placeAll(graph, ports);
  const grabbed = graph.pieces.find((p) => p.pieceId === pieceId);
  const comp = place.forest.component.get(pieceId);
  if (!grabbed || comp === undefined) return false;
  const pivot = portFrame(place, ports, grabbed, 0).pos;
  const sites = connectorSites(graph, ports, place);
  const mine = sites.placed.filter((p) => p.free && place.forest.component.get(p.pieceId) === comp);
  const others = sites.placed.filter((p) => p.free && place.forest.component.get(p.pieceId) !== comp);
  return mine.some((end) => {
    const [x, y] = toXY(add(add(pivot, mulZetaPow(sub(end.pos, pivot), move.turns)), move.by));
    return others.some((t) => {
      if (t.level === end.level) return false;
      const [tx, ty] = toXY(t.pos);
      return Math.hypot(tx - x, ty - y) <= radiusMm;
    });
  });
}

export function snapRunMove(
  graph: Graph,
  ports: PortsOf,
  pieceId: string,
  move: RunMove,
  radiusMm: number,
  /** Plank shapes, so a candidate that would lie over track is passed over. */
  geometry?: FitGeometry,
): RunMove {
  const place = placeAll(graph, ports);
  const grabbed = graph.pieces.find((p) => p.pieceId === pieceId);
  const comp = place.forest.component.get(pieceId);
  if (!grabbed || comp === undefined) return move;
  const pivot = portFrame(place, ports, grabbed, 0).pos;
  const sites = connectorSites(graph, ports, place);
  const mine = sites.placed.filter((p) => p.free && place.forest.component.get(p.pieceId) === comp);
  const others = sites.placed.filter((p) => p.free && place.forest.component.get(p.pieceId) !== comp);
  /*
   * Every end-to-end snap within the radius. Peg on peg is never one; socket
   * on socket is, with an adapter. Ranked ordinary-first, then by distance,
   * and the first that `moveRun` would ACCEPT wins (outside voice OV3): a
   * preference for ordinary joints must never turn a drop that fits into a
   * refusal. With none accepted, the nearest is returned, as before, so the
   * move is refused and says why.
   */
  const candidates: { d: number; adapter: boolean; move: RunMove }[] = [];
  for (const end of mine) {
    const landed = toXY(add(add(pivot, mulZetaPow(sub(end.pos, pivot), move.turns)), move.by));
    for (const target of others) {
      if (target.polarity === end.polarity && end.polarity === 'peg') continue;
      // Only an end on the same level can ever be joined (eng OV3).
      if (target.level !== end.level) continue;
      const [tx, ty] = toXY(target.pos);
      const d = Math.hypot(tx - landed[0], ty - landed[1]);
      if (d > radiusMm) continue;
      const turns = norm16(target.heading + 8 - end.heading);
      const rotated = add(pivot, mulZetaPow(sub(end.pos, pivot), turns));
      candidates.push({ d, adapter: target.polarity === end.polarity, move: { turns, by: sub(target.pos, rotated) } });
    }
  }
  if (candidates.length === 0) return move;
  const ranked = [...candidates].sort((a, b) => (a.adapter === b.adapter ? a.d - b.d : a.adapter ? 1 : -1));
  const accepted = ranked.find((c) => moveRun(graph, ports, pieceId, c.move, geometry).refused === null);
  if (accepted) return accepted.move;
  return [...candidates].sort((a, b) => a.d - b.d)[0]!.move;
}
