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

import { useLayoutEffect, useRef } from 'react';
import type { TrainRun } from './trainRun.js';
import { TRAIN_CARS, TRAIN_WIDTH_MM } from './trainShape.js';

/**
 * The train on the plan: an engine and two wagons seen from above (owner,
 * 2026-11-15), solid ink with a paper edge so it reads over wood and over a
 * seam. Each car lies ALONG the track and is placed by its own middle, so the
 * train bends where the road does (DESIGN.md rule 11: the only mark that lies
 * along the plank and the only one that moves; a buffer's beam lies across
 * it). Ink and paper only: a run is not a verdict (rule 1). Rendered inside
 * the canvas's own drawing group, in millimetres.
 *
 *   travel ──▶      cab   boiler  chimney
 *   [▭▭▭]-[▭▭▭]-[ ▇▇ ▬▬▬▬▬▬ ● ]
 */
export function TrainMark({ run, startedMs }: { run: Pick<TrainRun, 'carsAt'>; /** When the run began (`performance.now()`), so the plan and the 3D view show one run. Absent: now. */ startedMs?: number }) {
  const mark = useRef<SVGGElement | null>(null);
  // Before the first paint, not after it: the mark is never seen at the drawing's corner, waiting to be placed.
  useLayoutEffect(() => {
    const started = startedMs ?? performance.now();
    let frame = 0;
    const place = (now: number) => {
      const cars = run.carsAt(now - started);
      const g = mark.current;
      if (g) {
        cars.forEach((at, i) => {
          const car = g.children[i];
          if (!car) return;
          car.setAttribute('transform', `translate(${at.pose.x} ${at.pose.y}) rotate(${(at.pose.h * 180) / Math.PI})`);
          car.removeAttribute('visibility');
        });
        if (cars[0]) g.dataset.piece = cars[0].pieceId;
      }
      // A journey that stops leaves the train where it stopped; one that runs on keeps going until the run is over.
      if (!cars[0]?.done) frame = requestAnimationFrame(place);
    };
    place(performance.now());
    return () => {
      // Only a frame that was asked for: a run that was done at once asked for none.
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [run, startedMs]);
  const w = TRAIN_WIDTH_MM / 2;
  return (
    <g ref={mark} className="train-mark" aria-hidden="true">
      {TRAIN_CARS.map((car, i) => {
        const l = car.lengthMm / 2;
        return (
          // Hidden until it has a place: never seen at the drawing's corner.
          <g key={i} className={`train-car is-${car.kind}`} visibility="hidden">
            {/* The coupling to the car in front. */}
            {i > 0 && <rect className="train-body" x={l} y={-2} width={6} height={4} />}
            {car.kind === 'engine' ? (
              <>
                {/* The footplate, then the cab at the back and the boiler running to the front. */}
                <rect className="train-body" x={-l} y={-w} width={car.lengthMm} height={TRAIN_WIDTH_MM} rx={3} />
                <rect className="train-part" x={-l + 3} y={-w + 2} width={20} height={TRAIN_WIDTH_MM - 4} rx={1.5} />
                <rect className="train-part" x={-l + 25} y={-7} width={car.lengthMm - 29} height={14} rx={7} />
                {/* The dome and the chimney, the two marks that say "engine" from above. */}
                <circle className="train-part" cx={4} cy={0} r={3} />
                <circle className="train-light" cx={l - 11} cy={0} r={4} />
              </>
            ) : (
              <>
                {/* An open wagon: its sides, and the floor inside them. */}
                <rect className="train-body" x={-l} y={-w} width={car.lengthMm} height={TRAIN_WIDTH_MM} rx={2} />
                <rect className="train-part" x={-l + 4} y={-w + 4} width={car.lengthMm - 8} height={TRAIN_WIDTH_MM - 8} rx={1} />
              </>
            )}
          </g>
        );
      })}
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
