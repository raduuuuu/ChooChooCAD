/**
 * THE LAYOUT AS A LIST (task U7a): every piece, every end and every joint, in
 * words.
 *
 * The canvas is sight-only. This says the same graph in text, so a screen
 * reader user can find out what is on the table, and so anyone can check what
 * the canvas drew against what the engine holds.
 *
 * READ-ONLY, ON PURPOSE, AND IT MUST LOOK IT. Nothing here responds to
 * anything yet; operating the layout from this list is U7b, blocked on a real
 * DOM to test events (E11). An inert control that announces itself as a
 * control is worse than none: the user cannot tell whether the product, their
 * key or their screen reader is at fault. So it is plain lists and list items,
 * with no `tabindex`, no button, link or option role, and no
 * `aria-activedescendant`. `GraphListing.test.ts` proves the absence.
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
 *   free end     "Start of piece 1, a socket"     described by "Free"
 *   welded end   "End of piece 1, a peg"          described by "Joined to the start of piece 2"
 *   joint        "Joint 1: end of piece 1 to start of piece 2"
 *
 * A switch's ends are its heel, straight road and curved road rather than a
 * start and an end, because "end 3 of piece 4" names nothing a builder can
 * find on the table.
 */

import type { Graph, Piece, Port, PortRef } from '../../engine/src/graph/model.js';
import { portPolarity } from '../../engine/src/graph/model.js';
import type { Part } from '../../engine/src/parts/schema.js';
import { shortCode } from '../../engine/src/parts/schema.js';

/** Above this many pieces the list is replaced by a sentence saying so. */
export const LISTING_CEILING = 2000;

/** What one end of a part is called. */
export function endName(part: Part, port: number): string {
  if (part.kind === 'switch') return ['heel', 'straight road', 'curved road'][port] ?? `end ${port + 1}`;
  return port === 0 ? 'start' : port === 1 ? 'end' : `end ${port + 1}`;
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function pieceName(n: number, piece: Piece, part: Part): string {
  const head = `Piece ${n}: ${part.name} (${shortCode(part)})`;
  const side = piece.turn === 'right' ? 'right' : 'left';
  if (part.kind === 'curve') return `${head}, turning ${side}`;
  if (part.kind === 'switch') return `${head}, branching ${side}`;
  return head;
}

export function GraphListing({
  graph,
  resolve,
  ports,
}: {
  graph: Graph;
  resolve: (id: string) => Part;
  ports: (piece: Piece) => readonly Port[];
}) {
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
    const name = piece ? endName(resolve(piece.partId), ref.port) : `end ${ref.port + 1}`;
    return `${name} of piece ${number.get(ref.pieceId) ?? '?'}`;
  };
  // Which end each end is joined to, both ways round.
  const partner = new Map<string, PortRef>();
  for (const w of graph.welds) {
    partner.set(`${w.a.pieceId}#${w.a.port}`, w.b);
    partner.set(`${w.b.pieceId}#${w.b.port}`, w.a);
  }

  return (
    <details className="graph-listing">
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
          const name = pieceName(n, piece, part);
          return (
            <li key={piece.pieceId} aria-label={name}>
              {name}
              <ul aria-label={`Ends of piece ${n}`}>
                {ports(piece).map((_, port) => {
                  const id = `graph-listing-end-${piece.pieceId}-${port}`;
                  const other = partner.get(`${piece.pieceId}#${port}`);
                  const name = `${capital(endName(part, port))} of piece ${n}, a ${portPolarity(part, port)}`;
                  return (
                    <li key={port} aria-label={name} aria-describedby={id}>
                      {name}:{' '}
                      <span id={id} className="graph-listing-state">
                        {other ? `Joined to the ${where(other)}` : 'Free'}
                      </span>
                    </li>
                  );
                })}
              </ul>
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
            const name = `Joint ${k + 1}: ${where(w.a)} to ${where(w.b)}`;
            return (
              <li key={`${w.a.pieceId}#${w.a.port}-${w.b.pieceId}#${w.b.port}`} aria-label={name}>
                {name}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
