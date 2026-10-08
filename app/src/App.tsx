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

import { useEffect, useMemo, useState } from 'react';
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

/*
 * Keeping the chain across a refresh.
 *
 * This is deliberately NOT save/load. There is no file format here, no version
 * field and no semantics hash, because freezing a format while the schema is
 * still moving buys a migration you then owe forever. The shareable document
 * with its hash is a separate, deferred piece of work.
 *
 * What this does cover is losing twenty minutes of placing track to a refresh,
 * a closed tab, or a hang. The error boundary cannot help with any of those: it
 * catches throws, and none of them is a throw.
 *
 * A blob that no longer parses, or that names a part the catalogue no longer
 * has, is DISCARDED rather than repaired or reinterpreted. With no hash there is
 * nothing that could detect a stale blob from an older build, so the only honest
 * response to anything unexpected is to drop it and start empty.
 */
const STORAGE_KEY = 'brio.chain.v0';
const KNOWN_PART_IDS: ReadonlySet<string> = new Set(BRIO_PARTS.map((p) => p.id));

function loadPieces(): Piece[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const pieces: Piece[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) return [];
      const { partId, turn } = item as Record<string, unknown>;
      // An unknown part id means the catalogue moved under the blob. Discard the
      // whole chain rather than silently dropping pieces out of the middle of it,
      // which would change the layout's geometry without saying so.
      if (typeof partId !== 'string' || !KNOWN_PART_IDS.has(partId)) return [];
      if (turn !== 'left' && turn !== 'right') return [];
      pieces.push({ partId, turn });
    }
    return pieces;
  } catch {
    // Unavailable storage, a quota error, or malformed JSON. Start empty.
    return [];
  }
}

function savePieces(pieces: readonly Piece[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pieces));
  } catch {
    // Private browsing and full quotas both throw here. Losing persistence is
    // not worth losing the session over, so this is deliberately silent.
  }
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
  // Lazy initialiser, so the read happens once on mount rather than every render.
  const [pieces, setPieces] = useState<Piece[]>(loadPieces);
  const [closed, setClosed] = useState(true);

  // Only the chain is persisted. `closed` is a one-bit view toggle, not work.
  useEffect(() => {
    savePieces(pieces);
  }, [pieces]);

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
