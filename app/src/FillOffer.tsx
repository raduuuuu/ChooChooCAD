/**
 * FINISH THE LOOP (plan 2026-11-14, E3): for a joint that does not meet, find
 * the pieces that close its gap exactly, and put them in.
 *
 *   [Find pieces that close the 72mm gap]
 *        │ press
 *        ▼
 *   "Looking..."  ── painted first; the search runs after, in a timeout ──▶  the answer
 *        │                                                                      │
 *        │ the layout, the box or the library changed meanwhile                 ▼
 *        ▼                                                          fills as buttons, or a sentence
 *   the result is dropped, the button is back                                   │ press one
 *                                                                               ▼
 *                                                             `fill` action: one step, one undo
 *
 * AN OFFER BELONGS TO THE LAYOUT IT WAS FOUND FOR (eng review, finding 4).
 * Each answer is kept with the layout, the box and the library it searched.
 * When any of the three is no longer the one on screen, the answer is not
 * shown: a fill checked against another layout, or counted against another
 * box, is not a checked fill. The reducer refuses a stale one too.
 *
 * THE SEARCH LOADS ON FIRST USE (`import('./finishLoop.js')`): it and its
 * solver calls stay out of the editor's first load (plan choice C7).
 */

import { useEffect, useRef, useState } from 'react';
import type { PortsOf } from '../../engine/src/graph/frames.js';
import type { Graph, PortRef } from '../../engine/src/graph/model.js';
import type { BrandFitLookup } from '../../engine/src/joints/trust.js';
import type { Part } from '../../engine/src/parts/schema.js';
import type { FillAnswer } from './finishLoop.js';
import { fillName, findLabel, finishWords, SEARCHING } from './finishWords.js';
import type { Inventory } from './inventoryModel.js';
import type { FillPlan } from './layoutModel.js';

/** What a search was run against. An answer is shown only while all three are still current. */
interface Basis {
  readonly graph: Graph;
  readonly inventory: Inventory;
  readonly parts: readonly Part[];
}

type Phase =
  | { readonly at: 'idle' }
  | { readonly at: 'searching'; readonly basis: Basis }
  | { readonly at: 'answer'; readonly basis: Basis; readonly answer: FillAnswer; readonly maxPieces: number };

const same = (a: Basis, b: Basis) => a.graph === b.graph && a.inventory === b.inventory && a.parts === b.parts;

export interface FinishLoopProps {
  readonly graph: Graph;
  readonly ports: PortsOf;
  readonly resolve: (id: string) => Part;
  readonly parts: readonly Part[];
  readonly brandFit: BrandFitLookup;
  readonly inventory: Inventory;
  /** The two ends of the joint that does not meet, and how far apart they are. */
  readonly from: PortRef;
  readonly to: PortRef;
  readonly gapMm: number;
  readonly onFill: (plan: FillPlan, graph: Graph) => void;
}

export function FinishLoop(props: FinishLoopProps) {
  const { graph, ports, resolve, parts, brandFit, inventory, from, to, gapMm, onFill } = props;
  const [phase, setPhase] = useState<Phase>({ at: 'idle' });
  const now: Basis = { graph, inventory, parts };
  // What is on screen at the moment a late result arrives, read from a ref because the timeout outlives the render.
  const current = useRef(now);
  current.current = now;
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  // An answer for another layout, box or library is not an answer for this one.
  const shown = phase.at !== 'idle' && same(phase.basis, now) ? phase : ({ at: 'idle' } as const);

  const find = () => {
    const basis = now;
    setPhase({ at: 'searching', basis });
    // After a paint, so "Looking..." is on screen before the work starts.
    setTimeout(() => {
      void import('./finishLoop.js').then(({ findFills, MAX_FILL_PIECES }) => {
        if (!alive.current || !same(basis, current.current)) return;
        const answer = findFills({ graph, ports, resolve, parts, brandFit, inventory, from, to });
        if (!alive.current || !same(basis, current.current)) return;
        setPhase({ at: 'answer', basis, answer, maxPieces: MAX_FILL_PIECES });
      });
    }, 0);
  };

  if (shown.at === 'idle') {
    return (
      <div className="finish-loop">
        <button type="button" className="finish-find" onClick={find}>
          {findLabel(gapMm)}
        </button>
      </div>
    );
  }
  if (shown.at === 'searching') {
    return (
      <div className="finish-loop" role="status">
        <p className="finish-line">{SEARCHING}</p>
      </div>
    );
  }
  const words = finishWords(shown.answer, shown.maxPieces, inventory !== null);
  return (
    <div className="finish-loop" role="group" aria-label="Pieces that close the gap">
      <p className="finish-line" role="status">
        {words.line}
      </p>
      {shown.answer.status === 'found' && (
        <ul className="finish-fills">
          {shown.answer.fills.map((fill) => {
            const name = fillName(
              fill.pieces.map((p) => p.partId),
              (id) => resolve(id).name,
            );
            return (
              <li key={fill.pieces.map((p) => `${p.partId}${p.turn}${p.port}`).join('-')}>
                <button type="button" className="finish-fill" onClick={() => onFill(fill, shown.basis.graph)}>
                  Add {name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {words.note && <p className="finish-note">{words.note}</p>}
    </div>
  );
}
