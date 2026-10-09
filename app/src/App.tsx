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
import {
  loadSubmissions,
  makeResolver,
  resolveLibrary,
  saveSubmissions,
  type Submission,
} from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { layoutTrust } from '../../engine/src/joints/trust.js';
import { solveLayout } from '../../engine/src/solver/result.js';
import { centrelineRadiusMm, isUnverified, shortCode } from '../../engine/src/parts/schema.js';
import type { Brand, Layout, Part, Turn } from '../../engine/src/parts/schema.js';
import { TrackCanvas } from './TrackCanvas.js';
import { CHAIN_STORAGE_KEY } from './storageKeys.js';
import { EMPTY_STATE_PRESET, PRESETS, presetByLabel } from './presets.js';
import { VerdictLine } from './VerdictLine.js';
import { InventoryPanel } from './Inventory.js';
import { SubmitPart } from './SubmitPart.js';
import {
  type LoadResult,
  loadInventory,
  saveInventory,
  shortfalls as computeShortfalls,
  usedCounts,
  wouldExceed,
  type Inventory,
} from './inventoryModel.js';
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
// The key itself lives in storageKeys.ts; see that file for why.
const STORAGE_KEY = CHAIN_STORAGE_KEY;

function loadPieces(knownPartIds: ReadonlySet<string>): LoadResult<Piece[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { value: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { value: [], discarded: 'Your saved track could not be read, so the canvas started empty.' };
    }
    const pieces: Piece[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) {
        return { value: [], discarded: 'Your saved track could not be read, so the canvas started empty.' };
      }
      const { partId, turn } = item as Record<string, unknown>;
      // An unknown part id means the catalogue moved under the blob. Discard the
      // whole chain rather than silently dropping pieces out of the middle of it,
      // which would change the layout's geometry without saying so.
      if (typeof partId !== 'string' || !knownPartIds.has(partId)) {
        return {
          value: [],
          discarded:
            `Your saved track used a part the library no longer has (${String(partId)}), ` +
            'so the whole layout was cleared. Dropping one piece would have changed its shape.',
        };
      }
      if (turn !== 'left' && turn !== 'right') {
        return { value: [], discarded: 'Your saved track could not be read, so the canvas started empty.' };
      }
      pieces.push({ partId, turn });
    }
    return { value: pieces };
  } catch {
    // Unavailable storage, a quota error, or malformed JSON.
    return { value: [], discarded: 'Your saved track could not be read, so the canvas started empty.' };
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

/** BRIO first, because it is the only brand whose dimensions are published. */
const BRAND_ORDER: readonly Brand[] = ['BRIO', 'IKEA', 'PLAYTIVE', 'HAPE', 'THOMAS', 'MELISSA_DOUG'];
const BRAND_LABEL: Record<Brand, string> = {
  BRIO: 'BRIO',
  IKEA: 'IKEA Lillabo',
  PLAYTIVE: 'Lidl Playtive',
  HAPE: 'Hape',
  THOMAS: 'Thomas',
  MELISSA_DOUG: 'Melissa & Doug',
};
const partsByBrand = (lib: readonly Part[], b: Brand) => lib.filter((p) => p.brand === b);


export function App() {
  /*
   * ORDER MATTERS HERE. The library includes parts this user submitted, so it
   * cannot be a module constant any more. Submissions load first, the library
   * resolves from them, and only then can the chain and the inventory be
   * validated, because both reference part ids that may be user-submitted.
   */
  const [submissions, setSubmissions] = useState<readonly Submission[]>(loadSubmissions);
  const library = useMemo(() => resolveLibrary(submissions), [submissions]);
  const resolve = useMemo(() => makeResolver(library), [library]);
  const libraryIds = useMemo(() => new Set(library.map((p) => p.id)), [library]);

  /*
   * Both loaders now report whether they threw stored data away, and those
   * notices are held in state so they can be SHOWN. Previously a rejected blob
   * and an empty one were indistinguishable and the user watched their work
   * vanish in silence.
   */
  const [chainLoad] = useState(() => loadPieces(libraryIds));
  const [inventoryLoad] = useState(() => loadInventory(libraryIds));
  const [dismissed, setDismissed] = useState(false);
  const notices = [chainLoad.discarded, inventoryLoad.discarded].filter(
    (x): x is string => typeof x === 'string',
  );

  const [pieces, setPieces] = useState<Piece[]>(chainLoad.value);
  const [closed, setClosed] = useState(true);
  // `null` is UNDECLARED, which is not the same as owning none. See inventoryModel.ts.
  const [inventory, setInventory] = useState<Inventory>(inventoryLoad.value);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    saveSubmissions(submissions);
  }, [submissions]);

  // Only the chain is persisted. `closed` is a one-bit view toggle, not work.
  useEffect(() => {
    savePieces(pieces);
  }, [pieces]);

  useEffect(() => {
    saveInventory(inventory);
  }, [inventory]);

  const layout: Layout = useMemo(
    () => ({ placements: pieces.map((p) => ({ partId: p.partId, turn: p.turn })), closed }),
    [pieces, closed],
  );

  // One solve per layout change. Synchronous and inside render on purpose: it
  // keeps a React error boundary able to catch a throw from the engine, which
  // an event-handler trigger would not. See the eng review's finding on the
  // blank-page rescue.
  const result = useMemo(
    () => (pieces.length === 0 ? null : solveLayout(layout, resolve)),
    [layout, pieces.length, resolve],
  );

  const add = (partId: string, turn: Turn) => setPieces((p) => [...p, { partId, turn }]);
  const undo = () => setPieces((p) => p.slice(0, -1));
  const clear = () => setPieces([]);
  const preset = (ids: readonly string[]) => {
    setPieces(ids.map((partId) => ({ partId, turn: 'left' as Turn })));
    setClosed(true);
  };

  // The trust register. Computed from the library, so it knows what the solver
  // cannot: how good the numbers under the verdict actually are.
  const trust = useMemo(
    () => (pieces.length === 0 ? [] : layoutTrust(layout, resolve, brandFit)),
    [layout, resolve, pieces.length],
  );

  const counts = usedCounts(pieces.map((p) => p.partId));
  const shortfalls = computeShortfalls(inventory, counts);

  return (
    <div className="shell">
      <main className="stage">
        <TrackCanvas
          layout={layout}
          resolve={resolve}
          emptyAction={
            <>
              <button
                className="primary"
                onClick={() => preset(presetByLabel(EMPTY_STATE_PRESET).pieces)}
              >
                Build a {EMPTY_STATE_PRESET.toLowerCase()}
              </button>
              <span className="canvas-empty-note">
                {presetByLabel(EMPTY_STATE_PRESET).note}
              </span>
            </>
          }
        />
      </main>

      {notices.length > 0 && !dismissed && (
        <div className="notice" role="status">
          <div>
            {notices.map((n) => (
              <p key={n} className="notice-line">{n}</p>
            ))}
          </div>
          <button className="notice-close" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
      )}

      <VerdictLine result={result} trust={trust} />

      {/*
        * The shortfall line sits with the verdict, not in the palette, because it
        * answers the same question the verdict does: can I build this? It is a
        * separate sentence rather than part of the verdict because it is about
        * the BOX, not the geometry, and merging them would let a stock problem
        * read as a layout problem. Advice, never a gate (D8).
        */}
      {shortfalls.length > 0 && (
        <p className="shortfall">
          Short by{' '}
          {shortfalls.map((sf, i) => (
            <span key={sf.partId}>
              {i > 0 && ', '}
              <span className="num">{sf.shortBy}</span>&nbsp;{sf.partId}
            </span>
          ))}{' '}
          against what you own. Still fine to draw.
        </p>
      )}

      <section className="palette" aria-label="Track pieces">
        {/*
          * GROUPED BY BRAND, because the brands are not interchangeable.
          *
          * This is not organisation for its own sake. BRIO and IKEA connectors
          * are documented as not fitting each other, and no manufacturer
          * publishes piece dimensions for IKEA or Playtive at all, so those
          * parts carry unverified sizes. Mixing them in one undifferentiated row
          * would say they are equivalent, and they are not. Each non-BRIO group
          * states its provenance once, above its pieces.
          */}
        {BRAND_ORDER.filter((b) => partsByBrand(library, b).length > 0).map((brand) => (
        <div key={brand} className="brand-group">
          {brand !== 'BRIO' && (
            <p className="brand-note">
              <span className="brand-name">{BRAND_LABEL[brand]}</span>{' '}
              <span className="brand-warn">unverified sizes</span>{' '}
              {brandFit('BRIO', brand).fit === 'does-not-join'
                ? 'and these do not physically join BRIO track.'
                : 'and compatibility with BRIO is undocumented.'}{' '}
              Nobody publishes dimensions for these; the figures come from 3D-print reproductions.
            </p>
          )}
        <div className="palette-row">
          {partsByBrand(library, brand).map((part) => {
            /*
             * ADVICE, NEVER A GATE (decision D8).
             *
             * `is-unowned` greys the button and nothing else. It stays clickable,
             * stays focusable, and carries no `disabled`, because a shortfall is
             * information about the real world rather than an error in the
             * layout: people borrow track, buy more, and sketch layouts they
             * cannot build yet. Hiding or disabling the piece would teach the
             * user nothing and read as a bug. `aria-describedby` is not used
             * here either; the state is carried in the accessible name below so
             * it is announced with the control rather than after it.
             */
            const unowned = wouldExceed(inventory, counts, part.id);
            const unverified = isUnverified(part);
            return (
            <div
              key={part.id}
              className={
                'piece' + (unowned ? ' is-unowned' : '') + (unverified ? ' is-unverified' : '')
              }
            >
              <button
                className="piece-main"
                onClick={() => add(part.id, 'left')}
                aria-label={
                  `Add ${part.name}` +
                  (unverified ? '. Unverified size.' : '') +
                  (unowned ? '. More than you own.' : '')
                }
              >
                <span className="piece-id num">{shortCode(part)}</span>
                <span className="piece-name">{part.name}</span>
                <span className="piece-dim num">
                  {part.kind === 'straight' ? `${part.lengthMm}mm` : `r${centrelineRadiusMm(part)}`}
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
            );
          })}
        </div>
        </div>
        ))}

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
          {/*
            * All three presets, including the one the empty state offers. Once a
            * layout exists these are "replace what I have", a different act from
            * the blank canvas's "give me something to look at", so the overlap
            * is not a duplicate invitation.
            */}
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => preset(p.pieces)} title={p.note}>
              {p.label}
            </button>
          ))}
        </div>

        {/*
          * The inventory invitation appears only once a layout EXISTS (D10). On a
          * blank canvas three things were competing to be first: the hint, the
          * presets and this. One click to a working layout beats a data-entry
          * chore whose payoff arrives several steps later.
          */}
        {pieces.length > 0 && !inventoryOpen && (
          <div className="palette-row palette-controls">
            <button onClick={() => setInventoryOpen(true)}>
              {inventory === null ? 'Say what you own' : 'What you own'}
            </button>
            <button onClick={() => setSubmitOpen(true)}>Add a part you own</button>
            {inventory === null && (
              <span className="inventory-hint">
                Nothing is checked against your box yet.
              </span>
            )}
          </div>
        )}

        {submitOpen && (
          <SubmitPart
            existingIds={libraryIds}
            onSubmit={(sub) => {
              setSubmissions((prev) => [...prev, sub]);
              setSubmitOpen(false);
            }}
            onCancel={() => setSubmitOpen(false)}
          />
        )}

        {inventoryOpen && (
          <InventoryPanel
            library={library}
            inventory={inventory}
            used={counts}
            shortfalls={shortfalls}
            onChange={setInventory}
            onClose={() => setInventoryOpen(false)}
          />
        )}

        {/*
          * The provisional note used to sit here, under the palette, saying
          * that joint give is estimated and that the verdict reports what
          * could fit rather than what will. Both sentences are caveats on a
          * VERDICT, and here they were a footnote about the product, far
          * enough from the verdict line to be read as neither. They now ride
          * in the trust register, next to the claim they qualify, where the
          * engine emits them per layout (kind: 'estimated-give'). Task K4.
          */}
      </section>
    </div>
  );
}
