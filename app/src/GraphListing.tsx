/**
 * THE LAYOUT AS A LIST (tasks U7a and U7b): every piece, every end and every
 * joint, in words.
 *
 * The canvas is sight-only. This says the same graph in text, so a screen
 * reader user can find out what is on the table, and so anyone can check what
 * the canvas drew against what the engine holds.
 *
 * OPERABLE WHERE THERE IS SOMETHING TO DO (task U7b), and read-only
 * otherwise. Given `onPortClick` and `onBreak`, every FREE end is a native
 * button that selects it or joins it to the selected one, and every joint has
 * a Break button: the same actions as the canvas, by name. A joined end stays
 * text, because a control there would do nothing, and an inert control that
 * announces itself as one is worse than none. Without handlers the list is
 * plain lists and list items, which is how U7a shipped it. Either way: no
 * `tabindex`, no `aria-activedescendant`; native buttons sit in the tab order
 * in reading order on their own. Each action is announced by App.tsx's region
 * 3 (`announce.ts`), and focus is kept inside the list when an action removes
 * the focused button (the effect below).
 *
 * VISIBLE, NOT VISUALLY HIDDEN, BUT FOLDED. A listing only a screen reader can
 * see is one nobody notices drifting from the canvas; a visible one gets
 * read, and doubles as a debug view of the graph. It is a `<details>` closed
 * by default because the plan's always-open version broke the layout twice
 * (measured 2026-10-22): on a wide window it stretched the page to 1890px on
 * a 720px screen, and on a narrow one it crushed the parts tray to nothing.
 * The summary line stays visible and carries the counts, which is itself a
 * check against the canvas.
 *
 * The summary is the one control here, and it is a REAL one: it opens and
 * closes the list. What the plan forbids is an inert control, and the list
 * inside stays free of every tabindex and interactive role.
 *
 * THE NAMES ARE THE PRODUCT HERE. Each item carries its name as `aria-label`
 * and its state (free, or what it is joined to) as a separate element
 * referenced by `aria-describedby`, so the name stays stable while the state
 * changes and the state is heard once, as the description, not twice. Both
 * are also visible text.
 * Pieces are numbered from 1 in the order they were placed. One worked
 * example per node type, for a two-piece run of E curves:
 *
 *   piece        "Piece 1: Large curve (E), turning left"
 *   turned round "Piece 2: Large curve (E), turning left, joined by its end"
 *   free end     "Start of piece 1, a socket"     described by "Free"
 *   welded end   "End of piece 1, a peg"          described by "Joined to the start of piece 2"
 *   joint        "Joint 1: end of piece 1 to start of piece 2"
 *
 * A switch's ends are its heel, straight road and curved road rather than a
 * start and an end, because "end 3 of piece 4" names nothing a builder can
 * find on the table.
 */

import type { Graph, Piece, Port, PortRef } from '../../engine/src/graph/model.js';
import { levelOf, portPolarity } from '../../engine/src/graph/model.js';
import { placeAll, portFrame } from '../../engine/src/graph/frames.js';
import { useLayoutEffect, useRef } from 'react';
import type { Part, Turn } from '../../engine/src/parts/schema.js';
import { shortCode } from '../../engine/src/parts/schema.js';

/** Above this many pieces the list is replaced by a sentence saying so. */
export const LISTING_CEILING = 2000;

/** What one end of a part is called. */
export function endName(part: Part, port: number, turn?: Turn): string {
  if (part.kind === 'switch') return ['heel', 'straight road', 'curved road'][port] ?? `end ${port + 1}`;
  // A ramp's ends say which way it climbs (design 11A). Flipped over (turn
  // 'right'), its high end is port 0.
  if (part.kind === 'straight' && part.rise !== undefined) {
    const high = turn === 'right' ? 0 : 1;
    return port === high ? 'high end' : 'low end';
  }
  return port === 0 ? 'start' : port === 1 ? 'end' : `end ${port + 1}`;
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A level in words (design 11A, eng re-run D3). Height words are allowed by
 * DESIGN.md rule 7; a level the layout may not use is named as such, so a
 * mismatch is heard, never smoothed over as "raised".
 */
function levelName(level: number): string {
  return level === 0 ? 'the floor' : level === 1 ? 'the raised level' : 'a third level, which is not allowed';
}

function levelWords(level: number): string {
  return level === 0 ? 'On the floor' : level === 1 ? 'Raised' : 'On a third level, which is not allowed';
}

/**
 * WHICH END EACH PIECE WENT ON BY: the port of its first joint to a piece
 * placed before it, in joint order. Absent for a piece that started a run.
 *
 * The editor turns a piece round when its start is the wrong kind for the end
 * it meets (`orientation` in layoutModel.ts), and flips its stored turn so it
 * bends the way the palette button asked as you build. Named from its own
 * start, that piece read "turning right" while the user watched it bend left.
 * Named from the end it went on by, it reads the way it bends along the track.
 */
export function laidFrom(graph: Graph): Map<string, number> {
  const order = new Map(graph.pieces.map((p, i) => [p.pieceId, i]));
  const from = new Map<string, number>();
  for (const w of graph.welds) {
    const ia = order.get(w.a.pieceId);
    const ib = order.get(w.b.pieceId);
    if (ia === undefined || ib === undefined || ia === ib) continue;
    const later = ia > ib ? w.a : w.b;
    if (!from.has(later.pieceId)) from.set(later.pieceId, later.port);
  }
  return from;
}

export function pieceName(n: number, piece: Piece, part: Part, from: number | undefined): string {
  const head = `Piece ${n}: ${part.name} (${shortCode(part)})`;
  const turnedRound = from !== undefined && from !== 0;
  const stored = piece.turn === 'right' ? 'right' : 'left';
  const side = turnedRound ? (stored === 'right' ? 'left' : 'right') : stored;
  const by = turnedRound ? `, joined by its ${endName(part, from, piece.turn)}` : '';
  if (part.kind === 'curve') return `${head}, turning ${side}${by}`;
  if (part.kind === 'straight' && part.rise !== undefined && piece.turn === 'right') return `${head}, flipped over${by}`;
  if (part.kind === 'switch') return `${head}, branching ${side}${by}`;
  return head;
}

export function GraphListing({
  graph,
  resolve,
  ports,
  onPortClick,
  onBreak,
  onRemove,
  armed = null,
  cursor = null,
}: {
  graph: Graph;
  resolve: (id: string) => Part;
  ports: (piece: Piece) => readonly Port[];
  /** Select a free end, or join it to the selected one (task U7b). Omit for read-only. */
  onPortClick?: (ref: PortRef) => void;
  /** Break a joint (task U7b). Omit for read-only. */
  onBreak?: (a: PortRef, b: PortRef) => void;
  /**
   * Remove this piece (decision R1/D2): the keyboard and screen-reader route
   * to removing any piece, beside the canvas. Omit for read-only.
   */
  onRemove?: (pieceId: string) => void;
  armed?: PortRef | null;
  cursor?: PortRef | null;
}) {
  const container = useRef<HTMLDetailsElement>(null);
  const focusInside = useRef(false);
  /*
   * KEEP THE KEYBOARD USER'S PLACE (task U7b). Joining an end removes its
   * button, and breaking a joint removes the joint's, so the element that had
   * focus is gone and the browser drops focus to the page body: the user is
   * back at the top with no idea where they were. When that happens to focus
   * that was inside this list, put it on the first control left in the list,
   * or on the summary if none is. The announcement says what the key did.
   */
  useLayoutEffect(() => {
    if (!focusInside.current) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    const target =
      container.current?.querySelector<HTMLElement>('li button') ??
      container.current?.querySelector<HTMLElement>('summary');
    target?.focus();
  });

  if (graph.pieces.length === 0) return null;

  if (graph.pieces.length > LISTING_CEILING) {
    return (
      <details className="graph-listing">
        <summary>This layout, as a list</summary>
        <p>
          {graph.pieces.length} pieces is more than this list shows. The canvas and the verdict
          still cover all of them.
        </p>
      </details>
    );
  }

  const number = new Map(graph.pieces.map((p, i) => [p.pieceId, i + 1]));
  const byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
  const where = (ref: PortRef): string => {
    const piece = byId.get(ref.pieceId);
    const name = piece ? endName(resolve(piece.partId), ref.port, piece.turn) : `end ${ref.port + 1}`;
    return `${name} of piece ${number.get(ref.pieceId) ?? '?'}`;
  };
  // Which end each end is joined to, both ways round.
  const partner = new Map<string, PortRef>();
  for (const w of graph.welds) {
    partner.set(`${w.a.pieceId}#${w.a.port}`, w.b);
    partner.set(`${w.b.pieceId}#${w.b.port}`, w.a);
  }

  const from = laidFrom(graph);

  /*
   * LEVELS, said only once a layout has any (design 11A): every end's
   * description names its level, and a raised piece says so in its
   * description, never its name, so names stay stable as the list's other
   * states do. A flat layout reads exactly as before.
   */
  const placement = placeAll(graph, ports);
  const levelAt = (ref: PortRef) => {
    const piece = byId.get(ref.pieceId);
    return piece ? levelOf(portFrame(placement, ports, piece, ref.port)) : 0;
  };
  const leveled = graph.pieces.some((p) => ports(p).some((_, port) => levelAt({ pieceId: p.pieceId, port }) !== 0));

  const same = (a: PortRef | null, b: PortRef) =>
    a !== null && a.pieceId === b.pieceId && a.port === b.port;

  return (
    <details
      className="graph-listing"
      ref={container}
      onFocus={() => {
        focusInside.current = true;
      }}
      onBlur={(e) => {
        const into = e.relatedTarget as Node | null;
        if (into) {
          // Focus moved to a real element: inside the list, or out of it.
          focusInside.current = e.currentTarget.contains(into);
          return;
        }
        /*
         * No new target: either the user clicked somewhere that takes no
         * focus, or the focused button was removed by the action it ran. Only
         * the second is ours to repair, and only the second leaves the old
         * element out of the document. Checked after the commit, so the
         * layout effect has already seen the flag for a removal.
         */
        const left = e.target as Node;
        setTimeout(() => {
          if (left.isConnected) focusInside.current = false;
        }, 0);
      }}
    >
      <summary>
        This layout, as a list: {graph.pieces.length}{' '}
        {graph.pieces.length === 1 ? 'piece' : 'pieces'}, {graph.welds.length}{' '}
        {graph.welds.length === 1 ? 'joint' : 'joints'}
      </summary>
      <h3 id="graph-listing-pieces">Pieces</h3>
      <ol aria-labelledby="graph-listing-pieces">
        {graph.pieces.map((piece, i) => {
          const part = resolve(piece.partId);
          const n = i + 1;
          const name = pieceName(n, piece, part, from.get(piece.pieceId));
          const raisedId = `graph-listing-raised-${piece.pieceId}`;
          const raised = levelOf(placement.frames.get(piece.pieceId)!) >= 1;
          return (
            <li key={piece.pieceId} aria-label={name} aria-describedby={raised ? raisedId : undefined}>
              {name}
              {raised && (
                <>
                  {' '}
                  <span id={raisedId} className="graph-listing-state">
                    Raised.
                  </span>
                </>
              )}
              <ul aria-label={`Ends of piece ${n}`}>
                {ports(piece).map((_, port) => {
                  const id = `graph-listing-end-${piece.pieceId}-${port}`;
                  const other = partner.get(`${piece.pieceId}#${port}`);
                  const name = `${capital(endName(part, port, piece.turn))} of piece ${n}, a ${portPolarity(part, port)}`;
                  const ref = { pieceId: piece.pieceId, port };
                  const plain = other
                    ? `Joined to the ${where(other)}`
                    : same(armed, ref)
                      ? 'Selected. Choose another free end to join it to'
                      : same(cursor, ref)
                        ? 'Free. The next piece attaches here'
                        : 'Free';
                  const state = leveled ? `${levelWords(levelAt(ref))}. ${plain}` : plain;
                  /*
                   * OPERABLE ONLY WHERE THERE IS SOMETHING TO DO (U7b): a free
                   * end is a real button, which selects it or joins it to the
                   * selected one, exactly like clicking it on the canvas. A
                   * joined end is plain text; breaking it is the joint's job,
                   * below, so no control here does nothing.
                   */
                  if (onPortClick && !other) {
                    return (
                      <li key={port}>
                        <button type="button" aria-describedby={id} onClick={() => onPortClick(ref)}>
                          {name}
                        </button>{' '}
                        <span id={id} className="graph-listing-state">
                          {state}
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={port} aria-label={name} aria-describedby={id}>
                      {name}:{' '}
                      <span id={id} className="graph-listing-state">
                        {state}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {/* After its ends, so the list reads name, ends, then what to do with it. */}
              {onRemove && (
                <button type="button" onClick={() => onRemove(piece.pieceId)}>
                  Remove piece {n}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <h3 id="graph-listing-joints">Joints</h3>
      {graph.welds.length === 0 ? (
        <p>No joints yet.</p>
      ) : (
        <ul aria-labelledby="graph-listing-joints">
          {graph.welds.map((w, k) => {
            // Two sockets meeting are joined with a male-male adapter (socket adapter
            // plan, X3): said here, the non-visual route to where each one goes.
            const kindOf = (ref: PortRef) => {
              const piece = graph.pieces.find((p) => p.pieceId === ref.pieceId);
              return piece ? portPolarity(resolve(piece.partId), ref.port) : undefined;
            };
            const adapter = kindOf(w.a) === 'socket' && kindOf(w.b) === 'socket';
            // A joint across levels names both, so the mismatch is heard (11A).
            const la = levelAt(w.a);
            const lb = levelAt(w.b);
            const across = la !== lb ? `, joins ${levelName(la)} to ${levelName(lb)}` : '';
            const name = `Joint ${k + 1}: ${where(w.a)} to ${where(w.b)}${adapter ? ', two sockets, needs an adapter' : ''}${across}`;
            return (
              <li key={`${w.a.pieceId}#${w.a.port}-${w.b.pieceId}#${w.b.port}`} aria-label={name}>
                {name}
                {onBreak && (
                  <>
                    {' '}
                    <button type="button" aria-label={`Break ${name}`} onClick={() => onBreak(w.a, w.b)}>
                      Break
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
