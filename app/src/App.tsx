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
 * WHAT THIS FILE CAN AND CANNOT BUILD, which are now two different lists.
 *
 * The ENGINE is a graph. A layout is pieces joined by declared welds, it can
 * branch, it can hold several separate runs of track, each component carries
 * its own captured anchor, and every independent loop is checked against its
 * own give. Switches are three-ported pieces the model already handles.
 *
 * The UI edits that graph directly now, through FREE-END CLICKING (D5): click
 * a free end to arm it, click a piece to attach there, click a second free
 * end to weld the two together. `closed: boolean` is retired, because closing
 * a loop is declaring a weld like any other. What is still missing is
 * dragging a placed piece, undo, and keyboard parity beyond Enter and Space
 * on a free end.
 *
 * This header used to claim a layout was ONE connected chain and that the
 * engine had no field for a per-component origin. Both were true when written
 * and neither is now; `Graph.anchors` is that field.
 *
 * Still true, and still a recorded decision rather than an oversight:
 *   - The verdict reports a necessary condition, not a per-joint allocation
 *     (R21). There is no per-joint ratio and no per-joint glyph.
 */

import { useEffect, useMemo, useState , type ReactNode } from 'react';
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
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece as GPiece, type Port, type PortRef } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { reduce, type EditorAction } from './editorReducer.js';
import { loadGraph, partialLoadNotice, saveGraph } from './layoutStore.js';
import { viewOf } from './verdictView.js';
import { centrelineRadiusMm, isUnverified, shortCode } from '../../engine/src/parts/schema.js';
import type { Brand, Layout, Part, Turn } from '../../engine/src/parts/schema.js';
import { TrackCanvas } from './TrackCanvas.js';
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
 * Keeping the layout across a refresh.
 *
 * The chain loader and saver that lived here are gone with the chain. Their
 * replacement is `layoutStore.ts`, which keeps the same discipline: a blob
 * that does not parse, or that names a part the library no longer has, is
 * DISCARDED WHOLE and the user is told, because repairing it would change the
 * layout's geometry without saying so.
 *
 * It also recognises an old `brio.chain.v0` blob and says the layout could
 * not be carried over, rather than starting empty with no explanation. A
 * chain has no way to record which ends were joined, so there is nothing
 * faithful to migrate.
 */

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


/**
 * A brand's shelf in the palette.
 *
 * BRIO is a plain open group. Every other brand is a `<details>` that starts
 * CLOSED, so its pieces cost one line until you want them.
 *
 * The first attempt capped the palette and let it scroll, which gave the
 * canvas its space back and then hid IKEA and Playtive entirely below an
 * invisible fold: on macOS the overlay scrollbar does not show until you
 * scroll, so a third of the catalogue simply looked absent. Collapsing is
 * better than clipping, because a closed row still says the brand is there
 * and still carries its warning.
 *
 * It also matches the actual hierarchy. BRIO is the only brand whose
 * dimensions are published, so it is the default; the others are opt-in, and
 * their summary line states that their sizes are unverified before you can
 * reach a single one of their pieces.
 */
function BrandGroup({ brand, children }: { brand: Brand; children: ReactNode }) {
  if (brand === 'BRIO') return <div className="brand-group">{children}</div>;
  return (
    <details className="brand-group is-collapsible">{children}</details>
  );
}

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
  const [graphLoad] = useState(() => loadGraph(libraryIds));
  const [inventoryLoad] = useState(() => loadInventory(libraryIds));

  /*
   * TWO NOTICES, TWO DISMISSALS (task T5, finding E12).
   *
   * These shared one `dismissed` boolean and one block, so dismissing an
   * inventory message also hid a layout-loss message and the other way round.
   * Y1 decision 3 requires the load notice to persist until it is explicitly
   * dismissed or a clean load replaces it, which one shared flag cannot do.
   */
  const layoutNotice =
    graphLoad.discarded ??
    (graphLoad.droppedAnchors > 0
      ? partialLoadNotice(graphLoad.value.pieces.length, graphLoad.droppedAnchors)
      : undefined);
  const [layoutDismissed, setLayoutDismissed] = useState(false);
  const [inventoryDismissed, setInventoryDismissed] = useState(false);

  /*
   * THE GRAPH AND THE SELECTION ARE ONE PIECE OF STATE, and that is not
   * tidiness.
   *
   * They were two `useState`s and every handler read `selected` from the
   * render closure. Clicking the palette eight times in a row then produced
   * EIGHT SEPARATE RUNS instead of one run of eight: React batches the
   * updates, so all eight handlers saw the same stale `selected` of null and
   * each started a new run. The pure model was correct throughout; the
   * wiring was not, which is why the unit tests passed and the browser did
   * not. Attaching a piece MOVES the selection to its far end, so the two
   * values change together and must be computed together.
   */
  const [editor, setEditor] = useState<{ graph: Graph; selected: PortRef | null }>(() => ({
    graph: graphLoad.value,
    selected: null,
  }));
  const { graph, selected } = editor;
  // `null` is UNDECLARED, which is not the same as owning none. See inventoryModel.ts.
  const [inventory, setInventory] = useState<Inventory>(inventoryLoad.value);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    saveSubmissions(submissions);
  }, [submissions]);

  /*
   * THE FIRST SAVE IS SKIPPED WHEN THE LOAD LOST SOMETHING (finding E1).
   *
   * This effect ran on mount with no guard, so React wrote the sanitized
   * graph straight back over the stored bytes after the first paint: on a
   * whole-layout refusal that meant `EMPTY_GRAPH` overwriting an
   * unreadable-but-present blob, and on a dropped anchor it meant the
   * anchor-stripped graph replacing the one that still had them. The loss was
   * permanent before the user had done anything at all, and the notice was a
   * eulogy. `loadGraph` also rescues the raw bytes, so this is belt AND
   * braces.
   *
   * IT IS A CONDITION, NOT A ONE-SHOT FLAG, and that distinction is the whole
   * fix. The first version used a `useRef` that the first effect run cleared.
   * React 19 StrictMode double-invokes mount effects (mount, cleanup, mount),
   * so the second invocation found the flag already spent and saved anyway:
   * verified in the browser, where the stored blob came back as
   * `{"pieces":[],"welds":[],"anchors":[]}` with the fix supposedly in place.
   * No unit test in this suite could have caught it, because there is no DOM
   * and therefore no StrictMode. Suppression now lasts until the user
   * acknowledges the loss, which is also what Y1 decision 3 says in words.
   */
  const lossUnacknowledged = layoutNotice !== undefined && !layoutDismissed;
  useEffect(() => {
    if (lossUnacknowledged) return;
    saveGraph(graph);
  }, [graph, lossUnacknowledged]);

  useEffect(() => {
    saveInventory(inventory);
  }, [inventory]);

  const ports = useMemo(
    () => (piece: GPiece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn),
    [resolve],
  );

  // One placement per edit, shared by the verdict and the drawing. The whole
  // point of T4's single forest is that these cannot disagree about where a
  // piece is, so they are computed once here and passed down.
  const placement = useMemo(() => placeAll(graph, ports), [graph, ports]);
  const render = useMemo(
    () => renderGraph(graph, ports, resolve, placement),
    [graph, ports, resolve, placement],
  );

  // Synchronous and inside render on purpose: it keeps a React error boundary
  // able to catch a throw from the engine, which an event-handler trigger
  // would not. See the eng review's finding on the blank-page rescue.
  const result = useMemo(
    () =>
      graph.pieces.length === 0
        ? null
        : solveGraph(graph, ports, resolve, (pieceId: string) => {
            const piece = graph.pieces.find((x: GPiece) => x.pieceId === pieceId);
            return piece ? resolve(piece.partId).slop.axialMm : 0;
          }),
    [graph, ports, resolve],
  );

  /*
   * EVERY EDIT GOES THROUGH THE REDUCER (task T4).
   *
   * `editorReducer.ts` holds the five transitions and is unit-tested without
   * a DOM. What stays here is the `resolve`/`ports` wiring, which is the only
   * part that needs the part library. `dispatch` hands the reducer the state
   * it is given, which is what makes eight rapid palette clicks build one run
   * instead of eight: a handler that read `selected` from its render closure
   * saw the same stale `null` eight times.
   */
  const dispatch = (action: EditorAction) => setEditor((e) => reduce(e, action, ports));

  const add = (partId: string, turn: Turn) => dispatch({ kind: 'add', partId, turn });
  const clickPort = (ref: PortRef) => dispatch({ kind: 'clickPort', ref });
  const undo = () => dispatch({ kind: 'undo' });
  const clear = () => dispatch({ kind: 'clear' });
  const preset = (ids: readonly string[]) => dispatch({ kind: 'preset', ids });

  // The trust register. Computed from the library, so it knows what the solver
  // cannot: how good the numbers under the verdict actually are. It reads only
  // the parts in play, so a flat list of them is the honest input.
  const trust = useMemo(
    () =>
      graph.pieces.length === 0
        ? []
        : layoutTrust(
            { placements: graph.pieces.map((p) => ({ partId: p.partId, turn: p.turn })), closed: false },
            resolve,
            brandFit,
          ),
    [graph, resolve],
  );

  const verdictView = useMemo(() => viewOf(result), [result]);

  /*
   * WHICH WELDS THE CANVAS ANNOTATES (task W2, decision D4).
   *
   * One per closing weld whose two ends are apart, resolved to the positions
   * the canvas already drew them at. The engine's `gapMm` is passed through
   * untouched: the drawing must not be able to disagree with the sentence
   * under it.
   *
   * A rotated weld is SKIPPED. `headingSteps !== 0` means the loop comes back
   * pointing the wrong way, and a distance there would promise a fix that does
   * not exist: closing those millimetres still leaves the track turned. The
   * verdict says that in words and the canvas stays quiet rather than
   * contradicting it with a number.
   */
  const gaps = useMemo(() => {
    if (!result) return [];
    const byPort = new Map(render.ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
    return result.residuals.flatMap((r) => {
      if (!(r.gapMm > 0) || r.headingSteps !== 0) return [];
      const w = graph.welds[r.weld];
      if (!w) return [];
      const a = byPort.get(`${w.a.pieceId}#${w.a.port}`);
      const b = byPort.get(`${w.b.pieceId}#${w.b.port}`);
      if (!a || !b) return [];
      return [{ a: [a.x, a.y] as const, b: [b.x, b.y] as const, gapMm: r.gapMm }];
    });
  }, [result, render, graph]);

  const counts = usedCounts(graph.pieces.map((p) => p.partId));
  const shortfalls = computeShortfalls(inventory, counts);

  /* One brand's shelf. Used twice: BRIO inside the scrolling region, the
     rest pinned below it. See the comment at the call site. */
  const renderBrand = (brand: Brand) => (
    <BrandGroup key={brand} brand={brand}>
          {brand !== 'BRIO' && (
            /*
              * ONE LINE, not a paragraph, and it doubles as the group's
              * disclosure control.
              *
              * This was four lines of running prose between two rows of
              * buttons, twice over, and it was most of why the palette ate 70%
              * of the screen. The content was right and the placement was not:
              * a tool's parts bin is scanned, not read.
              *
              * Nothing is hidden that matters. The summary keeps both facts
              * that change what you click, the sizes are unverified and
              * whether the brand joins BRIO, and it says them BEFORE you can
              * reach one of the pieces. Provenance and the pieces themselves
              * are one click away. The full consequence still arrives
              * unprompted at the moment it matters: place one and the
              * verdict's trust register spells out the mismatch for THAT
              * layout. Same move K4 made with the provisional note.
              */
            <>
            <summary className="brand-note">
              <span className="brand-name">{BRAND_LABEL[brand]}</span>
              <span className="brand-warn">unverified</span>
              <span className="brand-count">
                {partsByBrand(library, brand).length}
                {partsByBrand(library, brand).length === 1 ? ' piece' : ' pieces'}
              </span>
            </summary>
            {/*
              * The full warning sits INSIDE the shelf, above its pieces.
              *
              * The summary has to fit one line in a 320px rail, and the whole
              * sentence does not. Putting it here loses nothing, because the
              * shelf has to be opened before any of its pieces can be clicked:
              * the warning is still read before the part is chosen, which is
              * the thing that actually matters. The summary keeps the word
              * that makes you look.
              */}
            <p className="brand-detail">
              {brandFit('BRIO', brand).fit === 'does-not-join'
                ? 'These do not physically join BRIO track.'
                : 'Whether these join BRIO track is undocumented.'}{' '}
              Nobody publishes dimensions for them; the figures come from 3D-print
              reproductions. Place one and the verdict says what that means for your
              layout.
            </p>
            </>
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
    </BrandGroup>
  );

  return (
    <div className="shell">
      <main className="stage">
        <TrackCanvas
          render={render}
          resolve={resolve}
          selected={selected}
          onPortClick={clickPort}
          /*
            * `result`, not `result?.ok`. The clash list lives on BOTH branches
            * of GraphResult, and gating the DRAWING on `ok` undid half of the
            * reason it was put on the failure branch: `viewOf` reports
            * IMPOSSIBLE with a clash count on a failed solve, so the verdict
            * said "2 pairs of track ends land in exactly the same spot" while
            * the canvas marked none of them. A count you cannot locate is not
            * actionable, which was decision A4's whole point.
            */
          clashes={result ? result.clashes : []}
          gaps={gaps}
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

      {layoutNotice !== undefined && !layoutDismissed && (
        <div className="notice" role="status" aria-live="polite" aria-atomic="false">
          <div>
            <p className="notice-line">{layoutNotice}</p>
          </div>
          <button className="notice-close" onClick={() => setLayoutDismissed(true)}>
            Dismiss
          </button>
        </div>
      )}

      {inventoryLoad.discarded !== undefined && !inventoryDismissed && (
        <div className="notice" role="status" aria-live="polite" aria-atomic="false">
          <div>
            <p className="notice-line">{inventoryLoad.discarded}</p>
          </div>
          <button className="notice-close" onClick={() => setInventoryDismissed(true)}>
            Dismiss
          </button>
        </div>
      )}

      <VerdictLine view={verdictView} trust={trust} />

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
        {/*
          * The parts region scrolls only as a last resort; the controls below
          * it never do. Capping the palette gave the canvas its space back,
          * but it also put Clear, Remove last, the presets and the inventory
          * buttons inside the clipped region. Primary controls that scroll out
          * of sight are worse than a tall palette, so only this region can.
          */}
        {/*
          * BRIO SCROLLS; THE OTHER SHELVES DO NOT.
          *
          * Two attempts got this wrong. Capping the palette hid IKEA and
          * Playtive below an invisible fold. Collapsing them to one line each
          * helped but they were still inside the scrolling region, so with the
          * full BRIO list above them they were still off-screen, and styling
          * the scrollbar was decorating the problem rather than fixing it.
          *
          * The scrolling region now holds ONE homogeneous list, the BRIO
          * catalogue, which is the only one long enough to need scrolling and
          * the one a user expects to scroll. The other brands are navigation,
          * one line each, pinned where they are always visible.
          */}
        <div className="palette-parts">
          {renderBrand('BRIO')}
        </div>
        <div className="palette-shelves">
          {BRAND_ORDER.filter((b) => b !== 'BRIO' && partsByBrand(library, b).length > 0)
            .map(renderBrand)}
        </div>

        <div className="palette-row palette-controls">
          {/*
            * `Closed loop` is GONE. It was a property of a list, answering
            * "does the last piece join the first?", and that question has no
            * meaning once a layout can be a tree, a forest, or two loops
            * sharing a switch. Closing a loop is now clicking the two free
            * ends you want joined, which is also what you do with real track.
            */}
          <button onClick={undo} disabled={graph.pieces.length === 0}>
            Remove last
          </button>
          <button onClick={clear} disabled={graph.pieces.length === 0}>
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
        {graph.pieces.length > 0 && !inventoryOpen && (
          <div className="palette-row palette-controls">
            <button onClick={() => setInventoryOpen(true)}>
              {inventory === null ? 'Your box' : 'Your box'}
            </button>
            <button onClick={() => setSubmitOpen(true)}>Add a part</button>
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
