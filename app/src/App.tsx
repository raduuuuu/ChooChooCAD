/**
 * Layout-as-home.
 *
 * You are always in a layout. Inventory, library and build mode will be
 * full-screen modes you go into and come back from, not a permanent sidebar:
 * the canvas is meant to dominate and build mode is meant to be nothing but
 * the next piece, and persistent navigation furniture fights both.
 *
 * Hierarchy, in order: the canvas, then the verdict line, then the palette.
 *
 * MVP constraints worth knowing, each a recorded decision rather than an
 * oversight:
 *   - A layout is ONE connected chain, optionally closed (Y1). Several separate
 *     tracks need a per-component origin, which the engine has no field for.
 *   - Pieces append to the end and remove from the end (X1b). Drag-and-drop,
 *     undo and keyboard parity are one body of deferred work.
 *   - The verdict reports a necessary condition, not a per-joint allocation
 *     (R21). There is no per-joint ratio and no per-joint glyph.
 */

import { useMemo, useState } from 'react';
import { BRIO_PARTS } from '../../engine/data/brio.js';
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

  const layout: Layout = useMemo(
    () => ({ placements: pieces.map((p) => ({ partId: p.partId, turn: p.turn })), closed }),
    [pieces, closed],
  );

  // One solve per layout change. Synchronous and inside render on purpose: it
  // keeps a React error boundary able to catch a throw from the engine, which
  // an event-handler trigger would not. See the eng review's finding on the
  // blank-page rescue.
  const result = useMemo(() => (pieces.length === 0 ? null : solveLayout(layout)), [layout, pieces.length]);

  const add = (partId: string, turn: Turn) => setPieces((p) => [...p, { partId, turn }]);
  const undo = () => setPieces((p) => p.slice(0, -1));
  const clear = () => setPieces([]);
  const preset = (ids: string[]) => {
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
        <TrackCanvas layout={layout} />
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
              {counts[part.id] ? <span className="piece-count num">{counts[part.id]}</span> : null}
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
          Joint give is <strong>estimated</strong>, not measured. Nobody has put calipers on
          real track yet, so the verdict reports whether the gap could fit inside the total
          give, not that it will.
        </p>
      </section>
    </div>
  );
}
