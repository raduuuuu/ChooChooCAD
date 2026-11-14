/**
 * RUN A TRAIN (plan 2026-11-14, E5, step 6): the one button, what the run
 * says, and the mark that moves.
 *
 *   [Run a train] ── press ──▶ the route is planned (loaded on first use)
 *        │                         │
 *        │ not offered: the        ▼
 *        │ track does not      the sentences, and the train on the plan
 *        ▼ join up yet             │ any edit, the tab hidden, or Stop
 *     a sentence, button off       ▼
 *                               the run is over; nothing is left moving
 *
 * THE SECOND AUTHORED MOTION (DESIGN.md rule 8, amended 2026-11-14 by the
 * owner): a train run the user starts. It never starts itself, it stops on
 * any edit, and under `prefers-reduced-motion` nothing moves: the same
 * sentences are shown with no train.
 *
 * ONE ELEMENT MOVES, AND REACT DOES NOT RE-RENDER PER FRAME. `TrainMark` sets
 * its own `transform` from an animation frame; nothing else on the canvas is
 * touched while the train runs.
 */

import { useEffect, useRef } from 'react';
import type { TrainRun } from './trainRun.js';

/** The train's size on the plan, in millimetres: inside the 26mm gauge, about a small engine long. */
const TRAIN_LENGTH_MM = 64;
const TRAIN_WIDTH_MM = 22;

/**
 * The train on the plan: a solid ink lozenge lying ALONG the track, with a
 * paper edge so it reads over wood and over a seam (DESIGN.md rule 11: the
 * only mark that lies along the plank and the only one that moves; a buffer's
 * beam lies across it). Rendered inside the canvas's own drawing group, in
 * millimetres.
 */
export function TrainMark({ run }: { run: TrainRun }) {
  const mark = useRef<SVGGElement | null>(null);
  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const place = (now: number) => {
      const at = run.at(now - started);
      const g = mark.current;
      if (at && g) {
        g.setAttribute('transform', `translate(${at.pose.x} ${at.pose.y}) rotate(${(at.pose.h * 180) / Math.PI})`);
        g.dataset.piece = at.pieceId;
      }
      // A route that ends leaves the train where it stopped; a loop keeps going until the run is over.
      if (!at?.done) frame = requestAnimationFrame(place);
    };
    place(started);
    return () => {
      // Only a frame that was asked for: a run that was done at once asked for none.
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [run]);
  return (
    <g ref={mark} className="train-mark" aria-hidden="true">
      <rect x={-TRAIN_LENGTH_MM / 2} y={-TRAIN_WIDTH_MM / 2} width={TRAIN_LENGTH_MM} height={TRAIN_WIDTH_MM} rx={TRAIN_WIDTH_MM / 2} />
    </g>
  );
}

export interface TrainControlProps {
  /** The run in progress, or null. */
  readonly run: TrainRun | null;
  /** Why a run is not offered, or null when it is. */
  readonly whyNot: string | null;
  readonly onRun: () => void;
  readonly onStop: () => void;
}

/** The button and what the run says. The mark is drawn by the canvas (`TrainMark`). */
export function TrainControl({ run, whyNot, onRun, onStop }: TrainControlProps) {
  if (run) {
    return (
      <div className="train-run" role="group" aria-label="A train run">
        <button type="button" className="train-button" onClick={onStop}>
          Stop the train
        </button>
        <div role="status">
          {run.words.map((line, i) => (
            <p key={i} className={i === 0 ? 'train-line' : 'train-note'}>
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="train-run">
      <button type="button" className="train-button" onClick={onRun} disabled={whyNot !== null}>
        Run a train
      </button>
      {whyNot && <p className="train-note">{whyNot}</p>}
    </div>
  );
}
