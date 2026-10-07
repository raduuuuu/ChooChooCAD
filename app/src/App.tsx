/**
 * Layout-as-home.
 *
 * You are always in a layout. Inventory, library and build mode will be
 * full-screen modes you go into and come back from, not a permanent sidebar:
 * the canvas is meant to dominate and build mode is meant to be nothing but
 * the next piece, and persistent navigation furniture fights both.
 *
 * Hierarchy, in order: the canvas, then the verdict line, then the palette.
 * Everything else sits behind a deliberate affordance.
 *
 * MVP constraint worth knowing: the engine models a single chain, optionally
 * closed. So pieces append and remove from the end rather than being dragged
 * anywhere. Free placement needs arbitrary topology and a coupled solve over a
 * full cycle basis, which is not built.
 */

import { useMemo, useState } from 'react';
import { BRIO_PARTS, getPart } from '../../engine/data/brio.js';
import { evaluateJoint, unknownJoint, type JointEvaluation } from '../../engine/src/joints/evaluate.js';
import { computeResidual } from '../../engine/src/solver/residual.js';
import { solveLayout } from '../../engine/src/solver/result.js';
import type { Layout, Turn } from '../../engine/src/parts/schema.js';
import { TrackCanvas } from './TrackCanvas.js';
import { VerdictLine } from './VerdictLine.js';
import './tokens.css';
import './app.css';

interface Piece {
  partId: string;
  turn: Turn;
}

const PRESETS: ReadonlyArray<{ label: string; pieces: string[]; note: string }> = [
  { label: 'Circle', pieces: Array(8).fill('E'), note: '8 large curves, exact' },
  {
    label: 'Stadium',
    pieces: [...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'D'],
    note: 'exact',
  },
  {
    label: 'Near miss',
    pieces: [...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'A'],
    note: '72mm short',
  },
];

export function App() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [closed, setClosed] = useState(true);
  const [changedAt, setChangedAt] = useState<number | null>(null);

  const layout: Layout = useMemo(
    () => ({ placements: pieces.map((p) => ({ partId: p.partId, turn: p.turn })), closed }),
    [pieces, closed],
  );

  const result = useMemo(
    () => (pieces.length === 0 ? null : solveLayout(layout)),
    [layout, pieces.length],
  );

  // One shared predicate drives every joint on screen. When the solve fails,
  // joints read UNKNOWN rather than inheriting a stale pass.
  const evals: JointEvaluation[] = useMemo(() => {
    if (pieces.length === 0 || !closed) return [];
    if (result?.ok) {
      return result.usage.map((u) => evaluateJoint(u, result.joints[u.index]!, 'estimated'));
    }
    const res = computeResidual(layout, getPart);
    return res.joints.map((j) => unknownJoint(j, 'estimated', 'layout could not be checked'));
  }, [result, layout, closed, pieces.length]);

  const add = (partId: string, turn: Turn) => {
    setChangedAt(pieces.length);
    setPieces((p) => [...p, { partId, turn }]);
  };
  const undo = () => {
    setChangedAt(Math.max(0, pieces.length - 2));
    setPieces((p) => p.slice(0, -1));
  };
  const clear = () => {
    setChangedAt(null);
    setPieces([]);
  };
  const preset = (ids: string[]) => {
    setChangedAt(null);
    setPieces(ids.map((partId) => ({ partId, turn: 'left' as Turn })));
    setClosed(true);
  };

  const counts = pieces.reduce<Record<string, number>>((acc, p) => {
    acc[p.partId] = (acc[p.partId] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="shell">
      <main className="stage">
        <TrackCanvas layout={layout} evals={evals} changedAt={changedAt} />
      </main>

      <VerdictLine result={result} />

      <section className="palette" aria-label="Track pieces">
        <div className="palette-row">
          {BRIO_PARTS.map((part) => (
            <div key={part.id} className="piece">
              <button className="piece-main" onClick={() => add(part.id, 'left')}>
                <span className="piece-id num">{part.id}</span>
                <span className="piece-name">{part.name}</span>
                <span className="piece-dim num">
                  {part.kind === 'straight' ? `${part.lengthMm}mm` : `r${part.radiusMm}`}
                </span>
              </button>
              {part.kind === 'curve' && (
                <button
                  className="piece-mirror"
                  onClick={() => add(part.id, 'right')}
                  title={`Add ${part.name} turning right`}
                >
                  ↻
                </button>
              )}
              {counts[part.id] ? (
                <span className="piece-count num">{counts[part.id]}</span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="palette-row palette-controls">
          <label className="toggle">
            <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
            Closed loop
          </label>
          <button onClick={undo} disabled={pieces.length === 0}>
            Remove last
          </button>
          <button onClick={clear} disabled={pieces.length === 0}>
            Clear
          </button>
          <span className="spacer" />
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => preset(p.pieces)} title={p.note}>
              {p.label}
            </button>
          ))}
        </div>

        <p className="provisional">
          Every tolerance here is <strong>estimated</strong>, not measured. Dotted rings mark
          verdicts that rest on a guessed number. Nobody has put calipers on real track yet.
        </p>
      </section>
    </div>
  );
}
