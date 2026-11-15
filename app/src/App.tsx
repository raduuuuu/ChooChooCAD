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

import { Fragment, useCallback, useEffect, useMemo, useRef, useState , type ReactNode } from 'react';
import {
  BUILT_IN,
  droppedSubmissionsNotice,
  loadSubmissionsResult,
  makeResolver,
  resolveLibrary,
  saveSubmissions,
  type Submission,
} from '../../engine/data/library.js';

const BUILT_IN_IDS: ReadonlySet<string> = new Set(BUILT_IN.map((p) => p.id));
import { brandFit } from '../../engine/data/thirdParty.js';
import { layoutTrust } from '../../engine/src/joints/trust.js';
import { spanningForest } from '../../engine/src/graph/forest.js';
import { toXY } from '../../engine/src/geom/cyclotomic.js';
import { connectorSites } from '../../engine/src/graph/feasible.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { levelOf, portsOf, type Graph, type Piece as GPiece, type Port, type PortRef } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { bendRender, bentShifts } from '../../engine/src/graph/bendPose.js';
import { endsWithinReach, joinSuggestions, nextEndAfter, ringFor, type ClickableEnd, type EndRing, type GapMark, seamLines, weldTargets, type JoinSuggestion } from './trackPath.js';
import { useEditorKeys } from './useEditorKeys.js';
import { usePaletteDrag, type CanvasProbe } from './usePaletteDrag.js';
import { paletteSize, PieceShelves } from './Palette.js';
import { UndoControl } from './UndoControl.js';
import { endName, GraphListing } from './GraphListing.js';
import { describeAction } from './announce.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import {
  initialEditor,
  lastStep,
  nextStep,
  reduce,
  type EditorAction,
  type EditorState,
} from './editorReducer.js';
import { dropRescueCopy, holdsOwnLayout, loadGraph, partialLoadNotice, rescueCopy, saveGraph, savesSuppressed, storedGraphOf } from './layoutStore.js';
import { downloadBytes } from './downloadBytes.js';
import { LayoutFileControls, openLayoutFile } from './LayoutFileControls.js';
import { PHONE_SHELL_QUERY, PhoneEditor, SHORT_TOUCH_QUERY } from './phoneEditor.js';
import type { PhonePanel, PhoneSheet } from './PhoneShell.js';
import { PutAsideNotice } from './PutAsideNotice.js';
import { keepBeforeReplacing } from './putAside.js';
import { ShareControl } from './ShareControl.js';
import { rescueCopyLine, saveFailureNotice, type SavedStore } from './saveNotice.js';
import { bridgeNotesOf, buildingClashSentence, buildingWord, supportNoteOf, tunnelNotesOf, viewOf } from './verdictView.js';
import { codeOf, shortCode } from '../../engine/src/parts/schema.js';
import type { Turn } from '../../engine/src/parts/schema.js';
import { CANVAS_SEGMENT_CEILING, TrackCanvas } from './TrackCanvas.js';
import { AppName } from './AppName.js';
import { EMPTY_STATE_PRESET, PRESETS, presetByLabel, type Preset } from './presets.js';
import { presetAction } from './presetVerdict.js';
import { boxWords, byBox } from './canBuild.js';
import { FinishLoop } from './FillOffer.js';
import { TrainControl, TrainMark } from './TrainControl.js';
import type { TrainRun } from './trainRun.js';
import { JoinStart, VerdictCompact, VerdictLine, VerdictScope, type BridgeNote } from './VerdictLine.js';
import { markLists } from './markLists.js';
import { EMPTY_GRAPH, familyOf, ghostFit, joinRefusal, otherLevelEndNear, shiftMm, snapRunMove, swapPiece, swapsOf, woodOf, type JoinRefusal } from './layoutModel.js';
import { LIST_FROM, VersionList, type VersionRow } from './VersionList.js';
import { ghostKeys } from './ghostKeys.js';
import { InventoryPanel } from './Inventory.js';
import { TablePanel } from './TablePanel.js';
import { fitSentence, loadTable, saveTable, tableFit, trackExtent, type Table } from './tableModel.js';
import { SubmitPart } from './SubmitPart.js';
import { View3DPanel } from './View3DPanel.js';
import { BuildModeLoader } from './BuildModeLoader.js';
import { loadView, openingView, saveView, type View } from './viewChoice.js';
import { countAction, routeOf } from './linkFragment.js';
import { EXAMPLE_PRESET, exampleTitle, exitLabel, LINK_HELD, STALE_TAB } from './linkWords.js';
import { screenMode } from './screenMode.js';
import { useMatchMedia } from './useMatchMedia.js';
import { HINT_MOUSE, HINT_TOUCH, hintSeen, rememberHintSeen } from './selectHint.js';
import { stripWords, TOUCH_QUERY } from './stripWords.js';
import { FriendScreen } from './FriendScreen.js';
import { ContributeLink } from './ContributeLink.js';
import { leaveLink } from './leaveLink.js';
import { BUILD_LINK_STORAGE_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';
import { clearance } from '../../engine/data/calibration.js';
import { MEASUREMENTS } from '../../engine/data/measurements.js';
import type { SceneInput } from '../../engine/src/view3d/mesh.js';
import {
  loadInventory,
  saveInventory,
  shortfalls as computeShortfalls,
  adapterShortfall,
  usedCounts,
  type Inventory,
} from './inventoryModel.js';
import './tokens.css';
import './app.css';


/*
 * Keeping the layout across a refresh.
 *
 * The chain loader and saver that lived here are gone with the chain. Their
 * replacement is `layoutStore.ts`, which keeps the same discipline: a blob
 * that does not parse, or that names a part the library does not have, is
 * DISCARDED WHOLE and the user is told, because repairing it would change the
 * layout's geometry without saying so.
 *
 * It also recognises an old `generic.chain.v0` blob and says the layout could
 * not be carried over, rather than starting empty with no explanation. A
 * chain has no way to record which ends were joined, so there is nothing
 * faithful to migrate.
 */

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Stable empties, so a layout with no marks does not hand the canvas a new array each render. */
const NO_GAPS: readonly GapMark[] = [];
const NO_POINTS: readonly (readonly [number, number])[] = [];

/**
 * `link`: a shared layout, already decoded (share plan). The same App, told
 * it is showing somebody else's railway (eng D21): parts resolve against the
 * built-in catalogue only (D14), nothing is loaded from or saved to this
 * browser's layout (the link route started a read-only storage session, D31),
 * every graph change is refused in `dispatch`, and the screen is the friend's
 * (design 1A) rather than the editor.
 */
/*
 * `offerExample`: this is a real visit, so a browser with no layout of its own
 * opens on the first-visit example (design 3A). main.tsx passes it; a test
 * that wants the plain empty editor leaves it out.
 */
const TRAIN_WHY_NOT = 'The track does not join up yet, so no train is run on it.';

export function App({ link, offerExample = false }: { readonly link?: Graph; readonly offerExample?: boolean } = {}) {
  /*
   * ORDER MATTERS HERE. The library includes parts this user submitted, so it
   * cannot be a module constant any more. Submissions load first, the library
   * resolves from them, and only then can the chain and the inventory be
   * validated, because both reference part ids that may be user-submitted.
   */
  /*
   * The submissions loader reports its losses now. It used to return a bare
   * array and `continue` silently past every refused row, so a measurement
   * dropped by this release's stricter validation produced no notice, nothing
   * suppressed the mount save, and the survivors were written over the stored
   * bytes before anyone could be told.
   */
  // A link is read against the built-in catalogue only (eng D14): no submissions.
  const [submissionsLoad] = useState(() => (link ? { value: [], dropped: 0 } : loadSubmissionsResult()));
  const [submissions, setSubmissions] = useState<readonly Submission[]>(
    submissionsLoad.value,
  );
  const [submissionsDismissed, setSubmissionsDismissed] = useState(false);
  const submissionsNotice =
    submissionsLoad.discarded ??
    (submissionsLoad.dropped > 0
      ? droppedSubmissionsNotice(submissionsLoad.value.length, submissionsLoad.dropped)
      : undefined);
  const library = useMemo(() => resolveLibrary(submissions), [submissions]);
  const resolve = useMemo(() => makeResolver(library), [library]);
  const libraryIds = useMemo(() => new Set(library.map((p) => p.id)), [library]);
  // Switches, crossings and buffer stops: the correction form makes two-ended parts only.
  const notTwoEndedIds = useMemo(
    () => new Set(library.filter((p) => portsOf(p).length !== 2).map((p) => p.id)),
    [library],
  );

  /*
   * Both loaders now report whether they threw stored data away, and those
   * notices are held in state so they can be SHOWN. Previously a rejected blob
   * and an empty one were indistinguishable and the user watched their work
   * vanish in silence.
   */
  /*
   * The loader is handed port GEOMETRY, not just part ids. It needs that
   * twice over: to refuse a stored weld naming a port the part does not have
   * (finding B1), and to place a piece whose anchor was unreadable clear of
   * where the surviving track actually sits rather than clear of where its
   * anchors merely start (the orphan-lane P0).
   *
   * Same shape as the `ports` memo below, written out here because this runs
   * once in a `useState` initialiser, before that memo exists.
   */
  // Whether this browser holds a layout of its own, for the exit's wording (design 10A, eng D23).
  const [ownLayout] = useState(() => (link ? holdsOwnLayout() : true));
  const [graphLoad] = useState(() =>
    link
      ? { value: link, droppedAnchors: 0, rescued: false, uncopied: false }
      : loadGraph(libraryIds, (piece: GPiece) => portsOf(resolve(piece.partId), piece.turn)),
  );
  /*
   * WHETHER THIS BROWSER HAD A LAYOUT AT MOUNT (design 3A): a layout, a rescue
   * copy or legacy data. Without one, the floor starts with the example,
   * which is not saved until it is yours (eng D66, D68).
   */
  const [hadLayout] = useState(() => link !== undefined || !offerExample || holdsOwnLayout());
  const [inventoryLoad] = useState(() => loadInventory(libraryIds));
  const [tableLoad] = useState(loadTable);

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
  const [tableDismissed, setTableDismissed] = useState(false);

  /*
   * NOTHING IS PERSISTED WHILE AN UNREAD LOSS NOTICE IS ON SCREEN
   * (finding E1, extended by finding B4).
   *
   * E1 fixed the graph effect and left the inventory and the submissions
   * unguarded, which got the priority backwards. A lost layout is a minute of
   * clicking; `library.ts` says of the submissions that a bad blob "costs you
   * measurements you took with calipers, which you cannot" recreate.
   *
   * The reachable case needs no adversary and this branch created it. This
   * release tightened `looksLikePart` to require `ends`, a bounded `slop` with
   * a known `calibrationStatus`, and a known `dimensions.status`. A submission
   * written by a pre-tightening build can fail that. On the first load after
   * the upgrade it is dropped, the unguarded effect wrote the survivors back
   * over the stored bytes on mount, and the inventory counts keyed to its id
   * were pruned and persisted in the same tick -- all before the user could
   * read the notice describing it. `saveInventory(null)` is a `removeItem`, so
   * the whole-refusal case deleted the very evidence its notice calls a bug.
   *
   * SUPERSEDED, and kept here only so the reasoning is traceable: this block
   * used to end by arguing that one acknowledgement should cover all three,
   * because "the user reads one banner either way". Both halves were wrong.
   * All three banners can be on screen at once, and a single flag meant an
   * action about one store released the writes for the other two. The current
   * rule is three gates and three flags, stated at the declarations below.
   *
   * IT IS A CONDITION, NOT A ONE-SHOT FLAG, and that distinction is the whole
   * of E1. The first version used a `useRef` the first effect run cleared.
   * React 19 StrictMode double-invokes mount effects (mount, cleanup, mount),
   * so the second invocation found the flag spent and saved anyway: verified
   * in the browser, where the stored blob came back as
   * `{"pieces":[],"welds":[],"anchors":[]}` with the fix supposedly in place.
   * No unit test here could catch it -- there is no DOM, so no StrictMode.
   */
  /*
   * A DELIBERATE EDIT COUNTS AS ACKNOWLEDGEMENT, and that bound matters as
   * much as the suppression itself.
   *
   * Without it the suppression lasts the whole session: after any refused or
   * partial load the user could build for an hour with nothing saved, refresh,
   * and lose all of it, because only the Dismiss button cleared the condition.
   * The notice says the canvas started empty; it never says nothing is being
   * saved. That is a worse bug than the one the gate fixes.
   *
   * It is worse again for the submissions. A measurement the user has just
   * typed is NEW data, not a pruned rewrite of old data, so blocking it loses
   * the calipers figure this gate exists to protect -- exactly backwards. This
   * was my own error in the first version of the extension.
   *
   * The first deliberate action is the acknowledgement: the banner is on
   * screen by then, and `loadGraph` has already copied the refused bytes to
   * `GRAPH_RESCUE_KEY`, which is the thing the suppression was buying time
   * for. The banner stays up until it is dismissed; only persistence resumes.
   *
   * This is a CONDITION over state, not a one-shot ref, for the same reason
   * E1's is: React 19 StrictMode double-invokes mount effects and spends a
   * ref before the second invocation reads it.
   */
  /*
   * ONE ACKNOWLEDGEMENT PER STORE, not one for the app.
   *
   * The gates were split per store and this flag was left global, so an action
   * about one store released the other two. MEASURED: on a clean graph load
   * with one dropped submission row, a single palette click -- a GRAPH edit --
   * flipped the submissions gate from blocked to open and the effect wrote the
   * survivors over the stored blob. The caliper row has no rescue copy, so it
   * was gone, while a banner reading "Nothing is saved over them until you
   * dismiss this" was still on screen. The docstring's justification, that the
   * user's action "is about the thing it names", is only true when the action
   * and the notice concern the same store.
   */
  const [inventoryActed, setInventoryActed] = useState(false);
  const [tableActed, setTableActed] = useState(false);
  const [submissionsActed, setSubmissionsActed] = useState(false);
  /*
   * THREE INDEPENDENT GATES, one per store, because each store answers for
   * its own loss. A single global condition made one notice hold back all
   * three saves, and the `noRescueCopy` exception -- which only the graph has
   * a rescue key for -- then made an unread inventory or submissions notice
   * unreleasable by any user action.
   */
  const inventorySaveBlocked = savesSuppressed({
    notice: inventoryLoad.discarded,
    dismissed: inventoryDismissed,
    userHasActed: inventoryActed,
  });
  // The table is a fourth store with its own notice, so a fourth gate and flag.
  const tableSaveBlocked = savesSuppressed({
    notice: tableLoad.discarded,
    dismissed: tableDismissed,
    userHasActed: tableActed,
  });
  const submissionsSaveBlocked = savesSuppressed({
    notice: submissionsNotice,
    dismissed: submissionsDismissed,
    userHasActed: submissionsActed,
  });

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
   * not. Attaching a piece MOVES the cursor to its far end, so the two
   * values change together and must be computed together.
   *
   * There are now TWO selections, `cursor` and `armed`, for the reason
   * `editorReducer.ts` records: one field meaning both "attach here" and
   * "armed for a weld" sent the next piece off to start its own run whenever
   * anything cleared it.
   */
  const [editor, setEditor] = useState<EditorState>(() => {
    /*
     * The cursor is DERIVED from the restored graph, not left null. Same
     * inline `ports` shape `loadGraph` uses above, because the memoised one is
     * declared below and this initializer runs once.
     */
    const at = (piece: GPiece) => portsOf(resolve(piece.partId), piece.turn);
    if (hadLayout) return initialEditor(graphLoad.value, at);
    // The example, laid as its preset button lays it, with no history and not yet "edited".
    const { edited: _, ...example } = reduce(initialEditor(EMPTY_GRAPH, at), { kind: 'preset', ids: presetByLabel(EXAMPLE_PRESET).pieces }, at);
    return example;
  });
  const { graph, cursor, armed } = editor;
  /*
   * WHICH SCREEN (eng D65, D70): derived every render from the link, what was
   * stored, the width and whether the example has been made yours. Turning a
   * tablet across 620px changes the screen, never the layout.
   */
  const [exampleGraph] = useState(() => (hadLayout ? null : editor.graph));
  const [adopted, setAdopted] = useState(false);
  /*
   * THE PHONE'S EDITOR (plan 2026-11-14, eng ED2): the one read of its query.
   * It picks the shell and nothing else: what may be edited is `screenMode`'s
   * to say, and it does not ask the screen's size. A shared link is read-only
   * on every screen (DESIGN.md rule 13), so a link never gets this shell.
   */
  const phoneWanted = useMatchMedia(PHONE_SHELL_QUERY);
  const sideways = useMatchMedia(SHORT_TOUCH_QUERY);
  const phone = phoneWanted && link === undefined;
  const screen = screenMode({ link: link !== undefined, stored: hadLayout, adopted });
  // Held here, above both shells, so turning the phone keeps them (eng ED7).
  const [sheet, setSheet] = useState<PhoneSheet>(null);
  const piecesScroll = useRef(0);
  const moreScroll = useRef(0);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [selectionMore, setSelectionMore] = useState(false);
  const canEditNow = useRef(screen.canEdit);
  canEditNow.current = screen.canEdit;
  /*
   * WORDS FOR THE HAND BEING USED (design DD8): no key names and no "Click"
   * on a touch screen, in the strips and in what is read out. A ref beside
   * the value, because the reducer's updater describes each action and must
   * not be rebuilt when a tablet's keyboard is attached.
   */
  const coarsePointer = useMatchMedia(TOUCH_QUERY);
  const words = stripWords(coarsePointer);
  const touchNow = useRef(coarsePointer);
  touchNow.current = coarsePointer;
  // The first change to the example's layout makes it yours, and from then on it saves (D66).
  useEffect(() => {
    if (exampleGraph !== null && graph !== exampleGraph) setAdopted(true);
  }, [graph, exampleGraph]);
  const selected = editor.selected ?? null;
  // What F does to the selected piece, when it is a one-sided decorated straight (eng D5).
  const selectedFlip = useMemo(() => {
    const piece = selected === null ? undefined : graph.pieces.find((p) => p.pieceId === selected);
    const part = piece ? resolve(piece.partId) : null;
    return part?.kind === 'straight' && part.flip ? part.flip : null;
  }, [selected, graph, resolve]);
  // The versions the selected piece can be swapped for, plain or decorated (CEO E8, design 3A, O1).
  const selectedSwaps = useMemo(() => {
    const piece = selected === null ? undefined : graph.pieces.find((p) => p.pieceId === selected);
    return piece ? swapsOf(resolve(piece.partId), library, resolve) : [];
  }, [selected, graph, library, resolve]);

  const graphSaveBlocked = savesSuppressed({
    notice: layoutNotice,
    dismissed: layoutDismissed,
    // Decided by the reducer from its RESULT: only an action that changed the
    // graph acknowledges the graph notice (see `EditorState.edited`).
    userHasActed: editor.edited === true,
    noRescueCopy: graphLoad.uncopied,
  });

  /*
   * WHAT THE LAST ACTION DID, ANNOUNCED (task U7b): region 3 of the
   * announcement policy, polite and NOT atomic, separate from the verdict's
   * region 1. `dispatch` writes the sentence into `saidNext` from inside the
   * editor updater, the one place that sees the exact state the action ran
   * on; this publishes it once the new state has committed. A state set from
   * inside an updater would be a side effect React may repeat.
   */
  const saidNext = useRef<string | null>(null);
  // Whether the action that wrote `saidNext` removed a piece or made a joint, so it is also said on screen (design DR4, DR5).
  const saidKind = useRef<'removed' | 'joined' | null>(null);
  const [said, setSaid] = useState('');
  // What the layout-file row says, shared by its picker and a file dropped on the canvas.
  const [fileSaid, setFileSaid] = useState<string | null>(null);
  /*
   * WHAT THE LAST REMOVAL OR JOIN DID, ON SCREEN (plan 2026-11-01, design DR4,
   * DR5). The announcement only reached a screen reader; this shows the same
   * sentence in the canvas strip with Undo, for as long as the layout is the
   * one the action left. A join names the two ends, so a wrong pick between
   * stacked ends shows at once. Any later change to the layout clears it.
   */
  const [lastNote, setLastNote] = useState<{ readonly text: string; readonly graph: Graph } | null>(null);
  // Set by a pick made in 3D, so its announcement first says the view changed (design 12A).
  const backIn2d = useRef(false);
  useEffect(() => {
    if (saidNext.current !== null) {
      setSaid((backIn2d.current ? 'Back in 2D to place the piece. ' : '') + saidNext.current);
      if (saidKind.current !== null) setLastNote({ text: saidNext.current, graph: editor.graph });
      saidNext.current = null;
      saidKind.current = null;
      backIn2d.current = false;
    }
  }, [editor]);
  // `null` is UNDECLARED, which is not the same as owning none. See inventoryModel.ts.
  const [inventory, setInventory] = useState<Inventory>(inventoryLoad.value);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [table, setTable] = useState<Table>(tableLoad.value);
  const [tableOpen, setTableOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  /*
   * The stores whose last save the browser refused (saveNotice.ts). Each save
   * sets or clears only its own flag, and leaves the set unchanged when its
   * flag already says the same, so a save that keeps failing renders nothing.
   * An empty layout or parts list that fails to save loses nothing, so in
   * private browsing the notice waits for the first piece.
   */
  const [unsaved, setUnsaved] = useState<ReadonlySet<SavedStore>>(() => new Set());
  const saved = useCallback((store: SavedStore, ok: boolean) => {
    setUnsaved((prev) => {
      if (prev.has(store) === !ok) return prev;
      const next = new Set(prev);
      if (ok) next.delete(store);
      else next.add(store);
      return next;
    });
  }, []);
  const unsavedNotice = saveFailureNotice(unsaved);
  /*
   * EVERYTHING IS SAVED: no save failed AND none is being held back (share
   * plan, eng D34). One value for every reload that could lose work: build
   * mode's Reload and a pasted link. "No failure" alone is not enough, because
   * a save held back after a rescue fails nothing and stores nothing.
   */
  /*
   * ANOTHER TAB CHANGED THE LAYOUT (share plan, eng D37): opening a link in
   * the editor there, or editing there. This tab's next autosave would write
   * its older layout over that one, so from here it stops saving the layout
   * and says so; Reload shows the latest. A link's own tab saves nothing anyway.
   */
  const [staleTab, setStaleTab] = useState(false);
  useEffect(() => {
    if (link) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === GRAPH_STORAGE_KEY || e.key === null) setStaleTab(true);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [link]);
  const allSaved =
    unsaved.size === 0 && !graphSaveBlocked && !staleTab && !inventorySaveBlocked && !submissionsSaveBlocked && !tableSaveBlocked;
  const allSavedNow = useRef(allSaved);
  allSavedNow.current = allSaved;
  /*
   * A LINK PASTED INTO THIS TAB (share plan D8, D15, D34). The browser does
   * not reload for a new `#…`, so this does, and the link route at the top of
   * main.tsx handles it exactly as a fresh visit. Only when everything is
   * saved: otherwise the address goes back and the work stays on screen. A
   * piece preview's `#p1.…` is a link too (contributor-brief T4).
   */
  const [linkHeld, setLinkHeld] = useState(false);
  useEffect(() => {
    const onHash = (e: HashChangeEvent) => {
      if (routeOf(location.hash) === 'editor') return;
      if (allSavedNow.current) {
        location.reload();
        return;
      }
      history.replaceState(history.state, '', e.oldURL);
      setLinkHeld(true);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // Dismissing hides THIS sentence; another store failing changes it, and it shows again.
  const [unsavedDismissed, setUnsavedDismissed] = useState<string | undefined>(undefined);
  /*
   * THE RESCUE COPY, WHILE A SAVE FAILS (P2, "The rescue copy can fail on a
   * full storage"). It may be what fills the storage, so the notice offers it:
   * Download first, and only then Remove. Removing it re-runs every save
   * (`saveRetry`), so the notice goes as soon as there is room.
   *
   *   save fails ─▶ notice + rescue line ─▶ [Download it] ─▶ [Remove it] ─▶ saves re-run
   */
  const stuckRescue = unsavedNotice !== undefined ? rescueCopy() : null;
  const [rescueDownloaded, setRescueDownloaded] = useState(false);
  const [saveRetry, setSaveRetry] = useState(0);

  useEffect(() => {
    if (submissionsSaveBlocked) return;
    saved('submissions', saveSubmissions(submissions) || submissions.length === 0);
  }, [submissions, submissionsSaveBlocked, saved, saveRetry]);

  /*
   * On a whole-layout refusal an unguarded save wrote `EMPTY_GRAPH` over an
   * unreadable-but-present blob; on a dropped anchor it wrote the
   * anchor-stripped graph over the one that still had them. `loadGraph` also
   * rescues the raw bytes, so this is belt and braces.
   */
  /*
   * The example is never saved until it is yours (D68: only this key waits;
   * the box, table and parts save as always). An empty floor nobody has saved
   * yet is not written either, so Start my own leaves storage as it found it.
   */
  const layoutWritten = useRef(hadLayout);
  useEffect(() => {
    if (graphSaveBlocked || staleTab || !screen.saveLayout) return;
    if (graph.pieces.length === 0 && !layoutWritten.current) return;
    const ok = saveGraph(graph);
    if (ok) layoutWritten.current = true;
    saved('layout', ok || graph.pieces.length === 0);
  }, [graph, graphSaveBlocked, staleTab, screen.saveLayout, saved, saveRetry]);

  useEffect(() => {
    if (inventorySaveBlocked) return;
    saved('inventory', saveInventory(inventory));
  }, [inventory, inventorySaveBlocked, saved, saveRetry]);

  useEffect(() => {
    if (tableSaveBlocked) return;
    saved('table', saveTable(table));
  }, [table, tableSaveBlocked, saved, saveRetry]);

  const ports = useMemo(
    () => (piece: GPiece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn),
    [resolve],
  );

  /*
   * One placement per edit, shared by the drawing AND the verdict.
   *
   * `solveGraph` takes it as an argument rather than calling `placeAll`
   * itself, so the clash marks it reports (`findVertexClashes`' `at`) are in
   * the frame the canvas drew, by construction rather than because `placeAll`
   * happens to be deterministic. It used to place the layout a second time.
   */
  const placement = useMemo(() => placeAll(graph, ports), [graph, ports]);
  const render = useMemo(
    () => renderGraph(graph, ports, resolve, placement),
    [graph, ports, resolve, placement],
  );

  // What the canvas and 3D count against their ceiling: track and bodies (eng EO6).
  const woodCount = render.segments.length + render.bodies.length;

  /*
   * ONE MAP, NOT A SCAN PER CALL. This passed a callback that did
   * `graph.pieces.find(...)`, and `analyseCycles` calls it once per edge of
   * every cycle it examines, so the solve was O(welds x pieces) at the only
   * call site that matters. The engine prices its work budget in weld-slots
   * on the assumption a slot is O(1); a scanning callback breaks that
   * assumption from outside, and the engine cannot defend itself -- caching
   * inside it does not help, because the first lookup per piece still scans
   * and there are O(pieces) distinct pieces.
   *
   * MEASURED, the mechanism rather than a layout, one lookup per weld end on
   * a two-port catalogue:
   *
   *     4,000 pieces,  4,000 lookups     23ms  ->  0.4ms
   *     8,000 pieces,  8,000 lookups     84ms  ->  0.8ms
   *    16,000 pieces, 16,000 lookups    357ms  ->  1.7ms
   *    32,000 pieces, 32,000 lookups   1426ms  ->  2.2ms
   *
   * Clean quadratic against linear: four times the cost per doubling on the
   * left, and the budget never fires, so the user got a normal verdict after
   * the stall rather than a refusal. The suite could not see it: its specs
   * pass `() => slopMm`, which is O(1).
   *
   * This is deliberately the MECHANISM and not a layout. The table that stood
   * here before quoted `analyseCycles` on "identical graphs" at four piece
   * counts and named no fixture, so no row could be re-measured -- and four
   * other comments restated it. This version is reproducible from its own
   * description, and it is the only copy: the others now cite it.
   */
  const slopById = useMemo(
    () => new Map(graph.pieces.map((p: GPiece) => [p.pieceId, resolve(p.partId).slop.axialMm])),
    [graph, resolve],
  );
  // Synchronous and inside render on purpose: it keeps a React error boundary
  // able to catch a throw from the engine, which an event-handler trigger
  // would not. See the eng review's finding on the blank-page rescue.
  const result = useMemo(
    () =>
      graph.pieces.length === 0
        ? null
        : solveGraph(graph, ports, resolve, (pieceId: string) => slopById.get(pieceId) ?? 0, placement, {
            parts: library,
            brandFit,
          }, render.segments, render.bodies),
    [graph, ports, resolve, slopById, placement, library, render],
  );

  /*
   * THE TRACK AS IT SITS ON THE FLOOR (bendPose.ts). A run that closes by
   * bending its joints is drawn bent, closed, rather than at its catalogue
   * angles with the gap the joints take up: the picture says what the verdict
   * says. Everything the canvas draws reads this; the verdict, the editing
   * and the ghost's fit stay on the exact `render`.
   */
  const shifts = useMemo(
    () => (result && result.ok ? bentShifts(graph, placement, ports, result.bend) : new Map<string, never>()),
    [result, graph, placement, ports],
  );
  const drawn = useMemo(() => bendRender(render, shifts), [render, shifts]);

  /*
   * THE TABLE, CENTRED ON THE TRACK (backlog E4). Measured on the plank
   * edges, not the centreline, so "fits" is never said of wood that hangs
   * over; see tableModel.ts. Memoised so the canvas's framing only moves
   * when the track or the table does.
   */
  const tableView = useMemo(() => {
    if (table === null) return null;
    const extent = trackExtent([...drawn.segments, ...drawn.bodies], (id) => resolve(id).plankWidthMm / 2);
    if (extent === null) return null;
    const fit = tableFit(extent, table);
    return { outline: fit.outline, fits: fit.fits, note: fitSentence(fit, table) };
  }, [drawn, resolve, table]);

  /*
   * Ends piled up AND planks crossing, drawn with one marker: both are "track
   * where track cannot be". Only `at` is read, and the verdict counts the two
   * separately.
   */
  const clashMarks = useMemo(
    () => (result ? [...result.clashes, ...result.overlaps] : []),
    [result],
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
  const dispatch = (action: EditorAction) => {
    setEditor((e) => {
      /*
       * INSIDE THE UPDATER, which is also what gets an engine throw to the
       * crash screen: React computes an update eagerly only inside its own
       * try/catch, discards a throw there, and recomputes during render, where
       * `ErrorBoundary` sees it. Calling `reduce` in the handler instead would
       * throw where no boundary looks. Pinned by editFailure.dom.test.tsx.
       */
      const next = reduce(e, action, ports, { resolve, placed: { graph, placement, render } });
      // A shared link, or a phone's view, is read-only (eng D21, D65): THE one place the layout changes refuses it.
      if (!canEditNow.current && next.graph !== e.graph) {
        saidNext.current = null;
        return e;
      }
      // Described here, from the exact state the action ran on, because the
      // updater is the one place that sees it (see `said` below). Pure, so
      // StrictMode calling this twice writes the same sentence twice.
      saidNext.current = describeAction(e, action, next, resolve, touchNow.current);
      saidKind.current =
        action.kind === 'removePiece'
          ? 'removed'
          : (action.kind === 'clickPort' || action.kind === 'joinEnds') && next.graph.welds.length > e.graph.welds.length
            ? 'joined'
            : null;
      return next;
    });
  };

  const add = (partId: string, turn: Turn) => dispatch({ kind: 'add', partId, turn });
  const clickPort = (ref: PortRef) => dispatch({ kind: 'clickPort', ref });
  const removeLast = () => dispatch({ kind: 'removeLast' });
  const undo = () => dispatch({ kind: 'undo' });
  const redo = () => dispatch({ kind: 'redo' });
  const selectPiece = (pieceId: string | null) => dispatch({ kind: 'selectPiece', pieceId });
  const removePiece = (pieceId: string) => dispatch({ kind: 'removePiece', pieceId });
  /*
   * MOVE A RUN (decision E6): whole millimetres and sixteenths, snapped on
   * release onto a nearby end within the canvas's radius, then one exact move.
   */
  const moveRunBy = (pieceId: string, dx: number, dy: number, turns: number, snapRadiusMm = 0) => {
    const asked = { turns, by: shiftMm(dx, dy) };
    const move = snapRadiusMm > 0 ? snapRunMove(graph, ports, pieceId, asked, snapRadiusMm, { resolve }) : asked;
    const otherLevelNear = snapRadiusMm > 0 && otherLevelEndNear(graph, ports, pieceId, move, snapRadiusMm);
    dispatch({ kind: 'moveRun', pieceId, turns: move.turns, by: move.by, otherLevelNear });
  };
  const runOf = (pieceId: string): ReadonlySet<string> => {
    const component = placement.forest.component;
    const mine = component.get(pieceId);
    return new Set(graph.pieces.map((p) => p.pieceId).filter((id) => component.get(id) === mine));
  };
  const ghost = editor.ghost ?? null;
  /*
   * PLACING A PIECE (decision R3). Focus follows the flow (Codex OV6): Pick
   * moves it to Place, so R, F, Enter and Esc work straight away; Place or
   * Cancel hand it back to the palette button that started the pick.
   */
  const pickOrigin = useRef<HTMLElement | null>(null);
  const placeButton = useRef<HTMLButtonElement | null>(null);
  const pick = (partId: string, from: HTMLElement | null) => {
    pickOrigin.current = from;
    // Placing happens in 2D (eng D10); say so, since the view changes under the hand (design 12A).
    if (view === '3d') {
      setViewState('2d');
      saveView('2d');
      backIn2d.current = true;
    }
    dispatch({ kind: 'pick', partId });
  };
  const returnFocus = () => {
    const back = pickOrigin.current;
    pickOrigin.current = null;
    if (back?.isConnected) back.focus();
  };
  const placeGhost = () => {
    // On a phone the same piece stays ready and focus stays on Place (design DD6, eng ED3).
    dispatch({ kind: 'placeGhost', again: phone });
    if (!phone) returnFocus();
  };
  const cancelGhost = () => {
    dispatch({ kind: 'cancelGhost' });
    returnFocus();
  };
  /*
   * JOINING, AS A MODE (design review 27A, 28A, 2026-10-31). Arming an end was
   * the only sign a join was under way: a thin ring, no words, no Cancel.
   * `joining` also covers the step before an end is armed, after "Join two
   * ends" in the verdict. It ends when the join is made, the armed end is let
   * go, a piece is picked, or Cancel / Escape.
   */
  /*
   * 2D OR 3D (3D plan, eng D10, design 1A, 11A). The view is remembered per
   * browser, but an empty layout opens 2D, where you build. Pressing 3D
   * cancels a piece being placed and a join in progress (eng D17: no
   * invisible state that acts); a selection is kept and simply not shown
   * (design 10A).
   */
  // A shared link always opens in 2D, where the verdict's marks are (design 21A).
  const [view, setViewState] = useState<View>(() => (link ? '2d' : openingView(loadView(), editor.graph.pieces.length)));
  const [resetSignal, setResetSignal] = useState(0);
  /*
   * BUILD MODE (docs/plan/2026-10-31-build-mode.md). While building, the
   * editor's canvas, rail and keys are gone (D27); its state stays here, so
   * leaving returns to the editor exactly as it was, with focus on Build it.
   */
  const [building, setBuilding] = useState(false);
  const buildItButton = useRef<HTMLButtonElement | null>(null);
  const leftBuild = useRef(false);
  const [joiningStarted, setJoiningStarted] = useState(false);
  const joining = !ghost && (joiningStarted || armed !== null);
  const wasArmed = useRef<PortRef | null>(null);
  useEffect(() => {
    if (wasArmed.current !== null && armed === null) setJoiningStarted(false);
    wasArmed.current = armed;
  }, [armed]);
  useEffect(() => {
    if (ghost) setJoiningStarted(false);
  }, [ghost]);
  const cancelJoin = () => {
    if (armed) dispatch({ kind: 'clickPort', ref: armed });
    setJoiningStarted(false);
  };
  /*
   * FOCUS FOLLOWS THE SWITCH (design review FINDING-002). The two views are
   * different trees, so the button pressed is gone once the view changes and
   * focus fell to the page. Set by the switch only, so a part pick that
   * returns to 2D leaves focus where the pick put it.
   */
  const focusSwitch = useRef(false);
  useEffect(() => {
    if (!focusSwitch.current) return;
    focusSwitch.current = false;
    document.querySelector<HTMLButtonElement>('.view-switch button[aria-pressed="true"]')?.focus();
  }, [view]);
  const showView = (v: View) => {
    if (v === view) return;
    focusSwitch.current = true;
    if (v === '3d') {
      countAction('view-3d');
      if (ghost) dispatch({ kind: 'cancelGhost' });
      if (joining) cancelJoin();
    }
    setViewState(v);
    saveView(v);
  };
  /*
   * The switch and Reset, in the view's top-end corner (design 1A, 2A). Reset
   * comes BEFORE the switch, so the switch keeps its place against the corner:
   * appended after it, Reset pushed the switch 106px inward on pressing 3D, and
   * a quick second click landed on Reset (design review FINDING-001).
   */
  const viewSwitch = (
    <div className="view-switch" role="group" aria-label="View">
      <button aria-pressed={view === '2d'} onClick={() => showView('2d')}>
        2D
      </button>
      <button aria-pressed={view === '3d'} onClick={() => showView('3d')}>
        3D
      </button>
    </div>
  );
  // Into build mode (build mode plan scope 1): any layout with a piece, whatever the verdict (D9).
  const startBuild = () => {
    countAction('build-it');
    if (ghost) cancelGhost();
    if (joining) cancelJoin();
    setBuilding(true);
  };
  // Start my own (design 3A): an empty editor of your own; nothing is written until you place a piece.
  const startOwn = () => {
    setEditor(initialEditor(EMPTY_GRAPH, ports));
    setAdopted(true);
  };
  // In the example, "Build this" in its label line takes Build it's place (design 3A).
  const buildIt =
    graph.pieces.length > 0 && screen.mode !== 'example' ? (
      <button
        ref={buildItButton}
        className="build-it"
        onClick={startBuild}
      >
        Build it
      </button>
    ) : null;
  /*
   * SHARE (share plan, design 5A): first in the corner, so Build it stays the
   * stronger action next to the switch. A corrected built-in part keeps its
   * id, so the link carries the catalogue's size for it (eng D14), and Share
   * says so.
   */
  const corrected = useMemo(() => new Set(submissions.map((s) => s.part.id).filter((id) => BUILT_IN_IDS.has(id))), [submissions]);
  const usesCorrections = graph.pieces.some((p) => corrected.has(p.partId));
  const shareIt = <ShareControl graph={graph} usesCorrections={usesCorrections} announce={setSaid} />;
  // Shown by the 3D panel only while there is a view to reset (design review FINDING-005).
  const resetButton = (
    <button className="view-reset" onClick={() => setResetSignal((n) => n + 1)}>
      Reset view
    </button>
  );
  const startJoin = useCallback(() => {
    setJoiningStarted(true);
    if (editor.selected != null) selectPiece(null);
  }, [editor.selected]);
  /*
   * A PALETTE DRAG (decisions E6, 6A): the same pick, then the preview follows
   * the pointer; release over the canvas drops it, anywhere else cancels.
   */
  const canvasProbe = useRef<CanvasProbe | null>(null);
  const { handlers: paletteDrag } = usePaletteDrag({
    probe: canvasProbe,
    canDrag: (partId, pointerType) => pointerType !== 'touch' || ghost?.partId === partId,
    onStart: (partId, from) => pick(partId, from),
    onAttach: (ref) => dispatch({ kind: 'moveGhost', ref }),
    onFloat: (pos) => dispatch({ kind: 'floatGhost', pos }),
    onDrop: () => {
      dropped.current = true;
      dispatch({ kind: 'dropGhost' });
    },
    onCancel: cancelGhost,
  });
  // After a drop lands. Placed: focus goes home, as after Place. Refused: the
  // piece is still pending and focus stays on Place, where Enter or Esc
  // settle it. A refused drop is a new state object, so this runs for it too.
  const dropped = useRef(false);
  useEffect(() => {
    if (!dropped.current) return;
    dropped.current = false;
    if (!editor.ghost) returnFocus();
  }, [editor]);
  const hadGhost = useRef(false);
  useEffect(() => {
    if (ghost && !hadGhost.current) placeButton.current?.focus();
    hadGhost.current = ghost !== null;
  }, [ghost]);
  // A sheet or a full-screen panel is modal to the keyboard too (eng ED6).
  const phonePanelOpen = phone && (inventoryOpen || tableOpen || submitOpen || listOpen);
  useEditorKeys({
    enabled: !building && sheet === null && !phonePanelOpen,
    onUndo: undo,
    onRedo: redo,
    onEscape: () => {
      if (ghost) cancelGhost();
      else if (joining) cancelJoin();
      else if (editor.selected != null) selectPiece(null);
    },
    // F on a selected one-sided decorated piece (eng D5): the same as its button.
    onFlipSelected: !ghost && editor.selected != null && selectedFlip ? () => dispatch({ kind: 'flipPiece', pieceId: editor.selected! }) : null,
    placing: ghost
      ? {
          onRotate: () => dispatch({ kind: 'rotateGhost' }),
          onFlip: () => dispatch({ kind: 'flipGhost' }),
          onStep: (by) => dispatch({ kind: 'stepGhost', by }),
        }
      : null,
  });
  const breakJoint = (a: PortRef, b: PortRef) => dispatch({ kind: 'breakWeld', a, b });
  /*
   * CLEAR AND THE READY LAYOUTS KEEP WHAT THEY REPLACE (plan 2026-11-14, eng
   * ED10). Your own layout goes in the put-aside slot first, so it outlives
   * Undo's history. Not the example: it is not yours, and comes back by itself.
   */
  const layoutBytes = useMemo(() => JSON.stringify(storedGraphOf(graph)), [graph]);
  const keepFirst = () => {
    if (screen.mode === 'edit') keepBeforeReplacing(layoutBytes);
  };
  const clear = () => {
    keepFirst();
    dispatch({ kind: 'clear' });
  };
  const preset = (p: Preset) => {
    keepFirst();
    countAction('preset');
    dispatch(presetAction(p));
  };

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
   * "THIS WORKS", COUNTED ONCE (linkFragment.ts ACTIONS.works): the first time
   * this page load's own layout turns from not working to working. The
   * example, and a layout that already worked when the page opened, are not
   * counted: neither is something the user just did.
   */
  const workedBefore = useRef<boolean | null>(null);
  const works = verdictView.kind === 'EXACT' || verdictView.kind === 'NEEDS_GIVE';
  useEffect(() => {
    if (screen.mode === 'example') return;
    if (workedBefore.current === false && works) countAction('works');
    if (workedBefore.current !== true) workedBefore.current = works;
  }, [works, screen.mode]);

  // Every joint, where the canvas draws it, so a click can break it (U5).
  const welds = useMemo(() => weldTargets(graph.welds, drawn.ports), [graph, drawn]);

  /*
   * THE VERDICT'S MARKS, 2D AND 3D, decided in one place (`markLists`, 3D plan
   * eng E6/O2): gaps, refused joints at both ends, adapter diamonds, the two
   * level faults, each left out where a red mark holds the spot. The canvas
   * list is what these memos always drew; the scene list keeps each mark's
   * source and hides only behind red on its own level. Above the drawing
   * ceiling only gaps and clash rings are listed, as before.
   */
  const marks = useMemo(
    () =>
      result
        ? markLists(
            {
              ...result,
              // A loop drawn bent has no gap to mark: its joints take it up.
              residuals: result.residuals.filter((r) => !shifts.has(graph.welds[r.weld]?.a.pieceId ?? '')),
            },
            graph.welds,
            drawn.ports,
            woodCount <= CANVAS_SEGMENT_CEILING,
          )
        : null,
    [result, graph, drawn, render, shifts],
  );
  const gaps = marks?.canvas.gaps ?? NO_GAPS;
  const refusedMarks = { marks: marks?.canvas.badJoints ?? NO_POINTS, hidden: marks?.canvas.badJointsHidden ?? 0 };
  const badJoints = refusedMarks.marks;
  const adapterMarks = marks?.canvas.adapters ?? NO_POINTS;
  const levelMarks = {
    mismatches: marks?.canvas.levelMismatches ?? NO_POINTS,
    thirds: marks?.canvas.thirdLevels ?? NO_POINTS,
    hidden: marks?.canvas.levelHidden ?? 0,
  };

  /*
   * WHAT THE 3D VIEW DRAWS: the canvas's own drawing (bent loops closed), the
   * scene's mark list, the measured rise and plank (never restated), and the
   * table. Built only while 3D is shown.
   */
  const sceneInput = useMemo((): SceneInput | null => {
    if (view !== '3d') return null;
    const { riseMm, plankMm } = clearance(MEASUREMENTS);
    const partOf = new Map(graph.pieces.map((p) => [p.pieceId, p.partId]));
    return {
      segments: drawn.segments,
      bodies: drawn.bodies,
      ports: drawn.ports,
      welds: graph.welds,
      partOf: (id) => resolve(partOf.get(id)!),
      riseMm,
      plankMm,
      marks: marks?.scene ?? [],
      table: tableView
        ? {
            outline: [
              [tableView.outline.minX, tableView.outline.minY],
              [tableView.outline.maxX, tableView.outline.minY],
              [tableView.outline.maxX, tableView.outline.maxY],
              [tableView.outline.minX, tableView.outline.maxY],
            ],
            overhang: !tableView.fits,
          }
        : null,
      // The selection, marked in 3D as in 2D (P3, owner: ink outline only); never in build mode's scene below.
      ...(selected !== null && graph.pieces.some((p) => p.pieceId === selected) ? { selected } : {}),
    };
  }, [view, drawn, graph, resolve, marks, tableView, selected]);
  // Build mode draws its steps from the whole layout, whichever view the editor had open.
  const buildScene = useMemo((): SceneInput | null => {
    if (!building) return null;
    const { riseMm, plankMm } = clearance(MEASUREMENTS);
    const partOf = new Map(graph.pieces.map((p) => [p.pieceId, p.partId]));
    return { segments: drawn.segments, bodies: drawn.bodies, ports: drawn.ports, welds: graph.welds, partOf: (id) => resolve(partOf.get(id)!), riseMm, plankMm };
  }, [building, drawn, graph, resolve]);
  const exitBuild = useCallback(() => {
    leftBuild.current = true;
    setBuilding(false);
  }, []);
  useEffect(() => {
    if (building || !leftBuild.current) return;
    leftBuild.current = false;
    buildItButton.current?.focus();
  }, [building]);
  const sceneLabel = useMemo(() => {
    const levels = new Set(drawn.ports.map((p) => p.level ?? 0)).size;
    const faults = marks?.scene.length ?? 0;
    const n = graph.pieces.length;
    return `3D view of the layout: ${n} ${n === 1 ? 'piece' : 'pieces'}, ${levels} ${levels === 1 ? 'level' : 'levels'}, ${faults} ${faults === 1 ? 'mark' : 'marks'}`;
  }, [drawn, marks, graph]);

  // Adapter joints a red mark hides, said in the note (DR1). None above the
  // ceiling: there the canvas already says nothing is drawn.
  const adaptersUnmarked =
    result && woodCount <= CANVAS_SEGMENT_CEILING
      ? result.adapterJoints.length - adapterMarks.length
      : 0;

  /*
   * Where each piece ends (request 2). Refused joints are left to their own
   * marker, and nothing is built above the drawing ceiling, for the reason
   * `badJoints` gives.
   */
  const seams = useMemo(() => {
    if (woodCount > CANVAS_SEGMENT_CEILING) return [];
    const partOf = new Map(graph.pieces.map((p) => [p.pieceId, p.partId]));
    const refused = new Set(result ? result.polarityViolations.map((v) => v.weld) : []);
    return seamLines(
      graph.welds,
      drawn.ports,
      (pieceId) => resolve(partOf.get(pieceId)!).plankWidthMm,
      refused,
    );
  }, [result, drawn, graph, resolve]);

  /*
   * THE SELECTION, SPELLED OUT (decisions 2A and E5): the piece's name and
   * size, and how much track a move or rotate would carry with it, which is
   * its whole connected run (decision D10).
   */
  const pieceNumber = useMemo(() => new Map(graph.pieces.map((p, i) => [p.pieceId, i + 1])), [graph]);
  // Each bridge track passes under, once, for its clearance sentence (bridges design DD5).
  const bridgeNotes = useMemo((): BridgeNote[] => {
    if (!result) return [];
    const partOf = new Map(graph.pieces.map((p) => [p.pieceId, p.partId]));
    const numberOf = (id: string) => pieceNumber.get(id)!;
    return [
      ...bridgeNotesOf(result.underBridges, (id) => partOf.get(id)!, resolve, numberOf),
      ...tunnelNotesOf(graph.pieces, resolve, numberOf),
    ];
  }, [result, graph, pieceNumber, resolve]);
  const supportNote = useMemo(
    () => (result ? supportNoteOf(result.supports, (id) => pieceNumber.get(id)!) : null),
    [result, pieceNumber],
  );
  // Track that runs into a building, said with the building's name (design decision 5).
  const buildingClashes = useMemo(() => {
    if (!result) return [];
    const partOf = new Map(graph.pieces.map((p) => [p.pieceId, p.partId]));
    return result.overlaps.flatMap((o) => {
      const sentence = buildingClashSentence(o, (id) => pieceNumber.get(id), (id) => resolve(partOf.get(id)!));
      return sentence ? [sentence] : [];
    });
  }, [result, graph, pieceNumber, resolve]);
  const sizeOf = paletteSize;
  const canvasPieceName = (id: string): string => {
    const piece = graph.pieces.find((p) => p.pieceId === id)!;
    const part = resolve(piece.partId);
    return `Piece ${pieceNumber.get(id)}: ${part.name} (${shortCode(part)}), ${sizeOf(part)}`;
  };
  /*
   * A PIECE CLICKED IN 3D (P3, pick in 3D): selected in the editor, so 2D
   * shows it selected on the way back. The view stays in 3D, where the
   * selection is kept and not shown (design 10A); the selection's own
   * announcement says it, as for a click in 2D. A second click on the same
   * piece keeps it selected instead of letting it go: in 3D nothing would
   * show that it was let go.
   *
   *   Viewer3D click ──> onPick(pieceId) ──> selectPiece, unless already ──> "Selected Piece n: …"
   */
  const pickIn3d = (pieceId: string) => {
    if (pieceId !== selected) selectPiece(pieceId);
  };
  const selectedRun = useMemo(() => {
    if (selected === null) return new Set<string>();
    const component = spanningForest(graph).component;
    const mine = component.get(selected);
    return new Set(graph.pieces.map((p) => p.pieceId).filter((id) => component.get(id) === mine));
  }, [graph, selected]);
  const selectedPiece = selected === null ? undefined : graph.pieces.find((p) => p.pieceId === selected);
  const selectedPart = selectedPiece ? resolve(selectedPiece.partId) : undefined;
  const selectionMain = !phone || !selectionMore;
  const selectionExtra = !phone || selectionMore;
  const selectionStrip =
    selected !== null && graph.pieces.some((p) => p.pieceId === selected) ? (
      <div className="mode-strip" role="group" aria-label="Selected piece">
        <p className="mode-strip-text">
          {/*
            * A PIER (design decision 3): no ends, so no run to speak of. Just
            * put down, the strip says how to move it; after that, its name.
            */}
          {selectedPart?.kind === 'block' ? (
            lastStep(editor)?.kind === 'place' && graph.pieces[graph.pieces.length - 1]!.pieceId === selected
              ? words.pierPlaced(selectedPart.name)
              : canvasPieceName(selected)
          ) : (
            <>
              {canvasPieceName(selected)} · run of {selectedRun.size}{' '}
              {selectedRun.size === 1 ? 'piece' : 'pieces'}
            </>
          )}
          {editor.refusal && (
            /*
             * WHY A MOVE WAS REFUSED, until the next action (decision 6A). The
             * run is back where it was; this is the only trace, so it is
             * words with the verdict's X, never colour alone.
             */
            <span className="move-refusal">
              {' '}
              <span className="ghost-mark is-fail" aria-hidden="true">
                X
              </span>{' '}
              Can&rsquo;t {editor.refusalOf ?? 'move it there'}: {editor.refusal}.
            </span>
          )}
          {editor.dropHint && <span className="move-refusal"> {editor.dropHint}.</span>}
        </p>
        {/*
          * MOVE AND ROTATE THE RUN WITHOUT A DRAG (decisions 2A, E6 keyboard
          * and touch parity): a centimetre a press, a sixteenth of a turn.
          */}
        {/*
          * ON A PHONE THE STRIP IS ONE LINE (plan 2026-11-14, design DD2): turn,
          * flip and remove, and a More that swaps them for the arrows and the
          * versions. Everywhere else all of it shows at once, as before.
          */}
        {selectionExtra && (
        <span className="move-run" role="group" aria-label="Move run">
          <button aria-label="Move run left 1 cm" onClick={() => moveRunBy(selected, -10, 0, 0)}>←</button>
          <button aria-label="Move run up 1 cm" onClick={() => moveRunBy(selected, 0, 10, 0)}>↑</button>
          <button aria-label="Move run down 1 cm" onClick={() => moveRunBy(selected, 0, -10, 0)}>↓</button>
          <button aria-label="Move run right 1 cm" onClick={() => moveRunBy(selected, 10, 0, 0)}>→</button>
        </span>
        )}
        {selectionMain && <button onClick={() => moveRunBy(selected, 0, 0, 1)}>{words.button('Rotate run', 'R')}</button>}
        {/* A one-sided decorated piece: its decoration to the other side, ends unchanged (design 5A). */}
        {selectionMain && selectedFlip && <button onClick={() => dispatch({ kind: 'flipPiece', pieceId: selected })}>{words.button(selectedFlip.label, 'F')}</button>}
        {/* Dressed or plain, the joints kept (design 3A): one button per version, or from three the list (D4). */}
        {!selectionExtra ? null : selectedSwaps.length >= LIST_FROM && selectedPart ? (
          <VersionList
            key={selected}
            closeOn={graph}
            rowsOf={(): VersionRow[] =>
              familyOf(selectedPart, library, resolve).map((p) => ({
                partId: p.id,
                name: p.name,
                now: p.id === selectedPart.id,
                // The same check the swap runs (D5), once per row as the list opens.
                blocked: p.id === selectedPart.id ? null : swapPiece(graph, ports, selected, p.id, { resolve, placed: { graph, placement, render } }).refused,
              }))
            }
            onPick={(partId) => dispatch({ kind: 'swapPiece', pieceId: selected, partId })}
          />
        ) : (
          selectedSwaps.map((p) => (
            <button key={p.id} onClick={() => dispatch({ kind: 'swapPiece', pieceId: selected, partId: p.id })}>
              {p.decoratedFrom === undefined ? 'Make it plain' : `Make it a ${p.name}`}
            </button>
          ))
        )}
        {selectionMain && <button onClick={() => removePiece(selected)}>Remove piece</button>}
        {phone && (
          <button aria-expanded={selectionMore} onClick={() => setSelectionMore(!selectionMore)}>
            {selectionMore ? 'Back' : 'More'}
          </button>
        )}
      </div>
    ) : null;

  /*
   * THE PIECE BEING PLACED, DRAWN AND CHECKED (decisions R3, E1, 14A, 20A;
   * eng ENG-R4).
   *
   * Computed for the one piece, not by re-laying the layout: its frame is the
   * exact arithmetic Place uses (`frameAt`, held equal by ghostFit.test.ts),
   * and what its ends land on is a lookup in the committed layout's map of
   * ends (`connectorSites`). A landing that would JOIN costs a full check,
   * the placement simulated once to confirm nothing moves (eng D6, a
   * backstop since D7), and the wood check clips the piece against the track
   * already drawn (overlap.ts).
   */
  const sites = useMemo(() => connectorSites(graph, ports, placement), [graph, ports, placement]);
  /*
   * THE FREE ENDS THE ARMED ONE CAN'T JOIN (TODO "Offer only
   * polarity-compatible free ends"): dimmed on the canvas and named in the
   * list, so the editor stops inviting a join it would refuse. Keyed
   * `pieceId#port`, as the canvas keys its ends.
   */
  const unjoinable = useMemo(() => {
    const out = new Map<string, JoinRefusal>();
    if (!armed) return out;
    for (const p of sites.placed) {
      if (!p.free) continue;
      const why = joinRefusal(sites, armed, p);
      if (why) out.set(`${p.pieceId}#${p.port}`, why);
    }
    return out;
  }, [armed, sites]);

  /*
   * ENDS THAT NEARLY MEET, offered as one-press joins (design review 28B).
   * Not while placing, and nothing above the drawing ceiling.
   */
  const suggestions = useMemo(
    () =>
      ghost || woodCount > CANVAS_SEGMENT_CEILING
        ? []
        : joinSuggestions(drawn.ports, (a, b) => joinRefusal(sites, a, b) === null),
    [ghost, render, drawn, sites],
  );
  const endWords = (ref: PortRef): string => {
    const i = graph.pieces.findIndex((p) => p.pieceId === ref.pieceId);
    const piece = graph.pieces[i];
    return piece ? `the ${endName(resolve(piece.partId), ref.port, piece.turn)} of piece ${i + 1}` : 'an end';
  };
  /*
   * A TRAIN RUN (plan 2026-11-14, E5). Kept with the layout it was planned
   * for, and shown only while that is still the layout on screen: any edit
   * makes a new `graph`, and the run is over (eng review: stop on edit). The
   * walker and the playback load on the first press (`trainRun.js`).
   *
   * OFFERED ONLY WHERE EVERY JOINT MEETS (owner, choice C8): a joint in the
   * data is not proof two ends meet, so a layout whose loops do not close is
   * not run. A layout with no loop at all has no joint that could fail to
   * meet (each was made by putting a piece on an end), so it is run too.
   */
  const [train, setTrain] = useState<{ readonly graph: Graph; readonly run: TrainRun; readonly startedMs: number } | null>(null);
  const trainRun = train && train.graph === graph ? train.run : null;
  // One run on the plan and in 3D: both count from when it began, so changing view does not start it again.
  const trainShown = useMemo(() => (trainRun && train ? { run: trainRun, startedMs: train.startedMs } : null), [trainRun, train]);
  /*
   * AN EDIT ENDS THE RUN FOR GOOD. "Is this still the layout it was planned
   * for" is not enough by itself: Undo puts the very same layout object back,
   * and the old run would come back with it, started long ago. So every
   * change to the layout clears the run, and counts, so that a run still
   * loading for a layout that has since changed (and changed back) is dropped
   * too. Moving a preview is no change to the layout and ends nothing.
   */
  const layoutChanges = useRef(0);
  useEffect(() => {
    layoutChanges.current += 1;
    setTrain((t) => (t && t.graph !== graph ? null : t));
  }, [graph]);
  const stillMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  const canRunTrain = verdictView.kind === 'EXACT' || verdictView.kind === 'NEEDS_GIVE' || verdictView.kind === 'NO_CYCLE';
  const runTrain = () => {
    if (!result || !canRunTrain) return;
    const planned = { graph, ports, resolve, drawn, result, selected };
    const asked = layoutChanges.current;
    void import('./trainRun.js').then(({ planRun }) => {
      // The layout changed while the walker was loading: that run is for a layout no longer here.
      if (layoutChanges.current !== asked) return;
      const run = planRun(planned);
      if (run) setTrain({ graph: planned.graph, run, startedMs: performance.now() });
    });
  };
  const stopTrain = () => setTrain(null);
  // A hidden tab ends the run: nothing keeps moving where nobody is looking.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) setTrain(null);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  /**
   * The one joint that does not meet, or null when there is none or more
   * than one. Read from the solver's residuals, not from the canvas's gap
   * marks: a loop that closes with the joints' give is drawn bent and shows
   * no gap mark, and it is offered a fill all the same (owner, 2026-11-14).
   */
  const finishGap = useMemo(() => {
    const unmet = (result && 'residuals' in result ? result.residuals : []).filter(
      (r) => r.gapMm > 0 && r.headingSteps === 0,
    );
    if (unmet.length !== 1) return null;
    const gap = unmet[0]!;
    const weld = graph.welds[gap.weld];
    return weld ? { weld: gap.weld, from: weld.a, to: weld.b, gapMm: gap.gapMm } : null;
  }, [result, graph]);
  const suggestionName = (g: JoinSuggestion) => `Join ${endWords(g.a)} to ${endWords(g.b)}`;
  const freeEnds = useMemo(() => drawn.ports.filter((p) => p.free).length, [drawn]);
  const ghostView = useMemo(() => {
    if (!ghost) return null;
    const part = resolve(ghost.partId);
    const piece: GPiece = { pieceId: '\u0000ghost', partId: ghost.partId, turn: ghost.turn };
    const { frame, conflicts: found, joins, adapterHere, relevels, lifted } = ghostFit(graph, ports, ghost, placement, sites, {
      resolve,
      segments: woodOf(render),
    });
    const alone = { pieces: [piece], welds: [], anchors: new Map([[piece.pieceId, frame]]) };
    const own = placeAll(alone, ports);
    // On a free end of a run drawn bent, the preview moves with that run.
    const atShift = ghost.at ? shifts.get(ghost.at.pieceId) : undefined;
    const drawnAlone = atShift
      ? bendRender(renderGraph(alone, ports, resolve, own), new Map([[piece.pieceId, atShift]]))
      : renderGraph(alone, ports, resolve, own);
    /*
     * THE RUN IT WOULD LIFT, drawn in the preview at its new height with its
     * shadows (design decision 4), so what Place does is seen before it.
     */
    const ghostRender = (() => {
      if (!lifted) return drawnAlone;
      const ids = new Set(lifted.ids);
      const after = renderGraph(lifted.graph, ports, resolve, placeAll(lifted.graph, ports));
      const mine = (s: { pieceId?: string }) => s.pieceId !== undefined && ids.has(s.pieceId);
      return {
        ...drawnAlone,
        segments: [...drawnAlone.segments, ...after.segments.filter(mine)],
        bodies: [...drawnAlone.bodies, ...after.bodies.filter(mine)],
      };
    })();
    const ends = ports(piece);
    let status: { glyph: 'O' | 'X' | '◇'; text: ReactNode };
    // Piece numbers in the number face (DESIGN.md rule 4; design review DR9).
    const num = (id: string) => <span className="num">{pieceNumber.get(id)}</span>;
    const sentences = (parts: readonly ReactNode[]) =>
      parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          {p}
        </Fragment>
      ));
    const conflicts: ReactNode[] = found.map((c) => {
      switch (c.kind) {
        case 'here':
          return `${capitalise(c.polarity)} meets ${c.polarity} here.`;
        case 'polarity':
          return <>{capitalise(c.polarity)} meets {c.polarity} at piece {num(c.pieceId)}.</>;
        case 'crowded':
          return <>Ends would clash with piece {num(c.pieceId)}.</>;
        case 'loop':
          return 'Joining here would shift pieces of a loop that does not close.';
        case 'over':
          return <>It would lie over piece {num(c.pieceId)}.</>;
        case 'level':
          return 'It would lift track to a third level. Only two levels are supported.';
      }
    });
    /*
     * THE THIRD STATE, ◇ (socket adapter plan, item 4; design review DR6): it
     * fits, and a male-male adapter is needed, said per connection so the
     * sentence names the right joint (outside voice OV2). The diamond is the
     * canvas mark's shape, in ink: not a conflict, so Place and a drop both
     * accept it, and not '!', which is the serious-caveat glyph. A conflict
     * still wins.
     */
    if (conflicts.length > 0) {
      status = { glyph: 'X', text: sentences([...conflicts, 'You can still place it.']) };
    } else {
      const joined: ReactNode[] = joins.map((j) => (
        <>Joins piece {num(j.to.pieceId)}{j.adapter ? ' with a male-male adapter' : ''}.</>
      ));
      const adapter = adapterHere || joins.some((j) => j.adapter);
      const parts: ReactNode[] =
        adapterHere && joined.length === 0
          ? ['Two sockets meet here: needs a male-male adapter.']
          : [...(adapterHere ? ['Needs a male-male adapter here.'] : []), ...joined];
      /*
       * A RAMP SAYS WHICH WAY IT GOES before Place (design 2A): entered at its
       * low end it climbs, at its high end it comes down. Laid descending
       * from the floor it raises the run it joins (L1), and that is said too.
       * Only in this branch: when a level is wrong, the conflict's sentence is
       * the truth to show instead (eng re-run D3).
       */
      const rising = part.kind === 'straight' && part.rise !== undefined;
      // A raised deck on supports: a station, a riser, a tunnel with overpass.
      const raisedDeck = part.kind === 'straight' && part.deck !== undefined;
      const lift = lifted?.ids.length ?? 0;
      const level: string[] = raisedDeck
        ? lift > 0
          ? [`Placing this ${buildingWord(part)} raises this run of track (${lift} ${lift === 1 ? 'piece' : 'pieces'}). Add a ramp to keep the rest on the floor.`]
          : []
        : !rising
        ? []
        : levelOf(ends[ghost.port]!.at) === 0
          ? ['Climbs from the floor to the raised level.']
          : ['Comes down to the floor.', ...(relevels ? ['Placing it raises the whole run.'] : [])];
      const all = [...level, ...parts];
      status = { glyph: adapter ? '◇' : 'O', text: all.length > 0 ? sentences(all) : 'Fits here.' };
    }
    const reach =
      Math.max(...ends.map((e) => Math.hypot(...toXY(e.at.pos)))) + part.plankWidthMm;
    return {
      render: ghostRender,
      red: conflicts.length > 0,
      status,
      reach,
      // What R and F do here, in words (the label says the result, not the key's name).
      keys: ghostKeys(graph, ports, ghost, part),
      name: `${part.name} (${shortCode(part)})`,
    };
  }, [ghost, graph, ports, placement, render, resolve, sites, pieceNumber, shifts]);

  /*
   * WHAT THE LAST DROP DID, when no piece is selected (design 5A, eng re-run
   * D1). A dragged run is not selected, so the selection strip's refusal line
   * never showed for a drag and only a screen reader heard why it was
   * refused. Shown on release, until the next action; nothing is checked
   * while the run moves.
   */
  const dropStrip =
    editor.refusal || editor.dropHint ? (
      <div className="mode-strip" role="group" aria-label="Last move">
        <p className="mode-strip-text">
          {editor.refusal ? (
            <span className="move-refusal">
              <span className="ghost-mark is-fail" aria-hidden="true">
                X
              </span>{' '}
              Can&rsquo;t {editor.refusalOf ?? 'move it there'}: {editor.refusal}.
            </span>
          ) : (
            <span className="move-refusal">{editor.dropHint}.</span>
          )}
        </p>
      </div>
    ) : null;

  // The removal or join, said on screen until the layout changes again (design DR4, DR5).
  const lastStrip =
    lastNote !== null && lastNote.graph === graph ? (
      <div className="mode-strip" role="group" aria-label="Last move">
        <p className="mode-strip-text">{lastNote.text}</p>
        <button onClick={undo}>Undo</button>
      </div>
    ) : null;

  /*
   * THE "CLICK A PIECE" HINT (plan 2026-11-01, design DR2, DR3, DR8): the
   * strip's lowest priority, in the 2D editor only, with a piece on the floor
   * (the empty floor draws its own panel and no strip) and none being placed. Any selection, from the canvas, the keyboard or the
   * layout list, retires it in this browser for good. Plain text: the strip is
   * not a live region, so it is never announced.
   */
  const [hintDone, setHintDone] = useState(hintSeen);
  useEffect(() => {
    if (selected === null || hintDone) return;
    rememberHintSeen();
    setHintDone(true);
  }, [selected, hintDone]);
  const hintStrip =
    !hintDone && !ghost ? (
      <div className="mode-strip" role="group" aria-label="Tip">
        <p className="mode-strip-text">{coarsePointer ? HINT_TOUCH : HINT_MOUSE}</p>
      </div>
    ) : null;

  /*
   * "NEXT END" (plan 2026-11-14, design DD7; eng ED4), on a phone: where free
   * ends crowd under one fingertip, step the preview (or, while joining, the
   * chosen end) round the ends within a tap's reach, nearest first.
   *
   *   chosen end ──▶ the ring: `endsWithinReach(anchor)` ──▶ `nextEndAfter(chosen)`
   *   a tap, a pick, Place ──▶ the chosen end becomes the anchor of a new ring
   *   Next end ────────────▶ the anchor stays, so every end in it gets its turn
   *
   * Measured from the anchor, not from each end in turn: from each end in
   * turn, two ends 3mm apart would hand the choice back and forth and a third
   * a little further off would never be reached. Moving the preview is not an
   * edit: no Undo step.
   */
  const [reach, setReach] = useState<{ readonly ends: readonly ClickableEnd[]; readonly pxPerMm: number } | null>(null);
  const onReachable = useCallback((ends: readonly ClickableEnd[], pxPerMm: number) => setReach({ ends, pxPerMm }), []);
  const chosenEnd = ghost ? ghost.at : armed;
  const ringOf = useRef<EndRing | null>(null);
  const nextEnd = useMemo(() => {
    if (!phone || !chosenEnd || !reach) return null;
    const ring = ringFor(ringOf.current, chosenEnd);
    ringOf.current = ring;
    return nextEndAfter(chosenEnd, endsWithinReach(ring.anchor, reach.ends, reach.pxPerMm));
  }, [phone, chosenEnd, reach]);
  const nextEndButton = nextEnd ? (
    <button
      onClick={() => {
        ringOf.current = { anchor: ringOf.current?.anchor ?? nextEnd, stepped: nextEnd };
        dispatch(ghost ? { kind: 'moveGhost', ref: nextEnd } : { kind: 'armEnd', ref: nextEnd });
      }}
    >
      Next end
    </button>
  ) : null;

  /*
   * THE JOINING STRIP (design review 27A): what is happening and how to stop.
   * Escape cancels too (useEditorKeys).
   */
  const joinStrip = joining ? (
    <div
      className="mode-strip"
      role="group"
      aria-label="Joining two ends"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelJoin();
        }
      }}
    >
      <p className="mode-strip-text">
        {armed ? words.joinNext(endWords(armed)) : words.joinFirst}
      </p>
      {armed && nextEndButton}
      <button onClick={cancelJoin}>{words.button('Cancel', 'Esc')}</button>
    </div>
  ) : null;

  const placingStrip = ghostView ? (
    <div
      className="mode-strip"
      role="group"
      aria-label="Placing a piece"
      onKeyDown={(e) => {
        // Enter on a strip button activates it natively; nothing else here.
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelGhost();
        }
      }}
    >
      <p className="mode-strip-text">
        Placing: {ghostView.name}{' '}
        <span className="ghost-status" role="status" aria-live="polite">
          <span
            className={`ghost-mark${ghostView.red ? ' is-fail' : ghostView.status.glyph === '◇' ? ' adapter-glyph' : ''}`}
            aria-hidden="true"
          >
            {ghostView.status.glyph}
          </span>{' '}
          {ghostView.status.text}
        </span>
      </p>
      <button onClick={() => dispatch({ kind: 'rotateGhost' })} disabled={!ghostView.keys.rotate.enabled}>
        {words.button(ghostView.keys.rotate.label, 'R')}
      </button>
      {/* Shown greyed when it can't act here, so F is always discoverable on a part that has it. */}
      {ghostView.keys.flip && (
        <button onClick={() => dispatch({ kind: 'flipGhost' })} disabled={!ghostView.keys.flip.enabled}>
          {words.button(ghostView.keys.flip.label, 'F')}
        </button>
      )}
      {nextEndButton}
      <button onClick={cancelGhost}>{words.button('Cancel', 'Esc')}</button>
      <button ref={placeButton} className="primary" onClick={placeGhost}>
        {words.button('Place', 'Enter')}
      </button>
    </div>
  ) : null;

  /*
   * ABOVE THE DRAWING LIMIT, PLACING PAUSES (decision 7A): there is no canvas
   * to show a preview on, and placing blind would put down a piece nobody
   * saw. Removing pieces in the layout list still works, as do Undo and Redo.
   */
  const overLimit = woodCount > CANVAS_SEGMENT_CEILING;

  const counts = usedCounts(graph.pieces.map((p) => p.partId));
  const shortfalls = computeShortfalls(inventory, counts);
  const adaptersUsed = result ? result.adapterJoints.length : 0;
  const adapterShort = adapterShortfall(inventory, adaptersUsed);

  // The empty state's first step, shared by the 2D canvas and the 3D view (design 5A).
  const emptyAction = (
            <>
              <button
                className="primary"
                onClick={() => preset(presetByLabel(EMPTY_STATE_PRESET))}
              >
                Build a {EMPTY_STATE_PRESET.toLowerCase()}
              </button>
              <span className="canvas-empty-note">
                {presetByLabel(EMPTY_STATE_PRESET).note}
              </span>
            </>
  );

  if (building && buildScene) {
    const shortOf = new Map(shortfalls.map((sf) => [sf.partId, sf.shortBy]));
    return (
      <BuildModeLoader
        graph={graph}
        segments={woodOf(render)}
        result={result}
        scene={buildScene}
        partName={(id) => resolve(id).name}
        pull={{
          rows: Object.entries(counts).map(([partId, count]) => ({ partId, name: resolve(partId).name, count, short: shortOf.get(partId) ?? 0 })),
          adapters: { count: adaptersUsed, short: adapterShort },
        }}
        verdict={
          <VerdictLine
            view={verdictView}
            trust={trust}
            adaptersUnmarked={adaptersUnmarked}
            levelUnmarked={levelMarks.hidden}
            polarityUnmarked={refusedMarks.hidden}
            buildings={buildingClashes}
            bridgeNotes={bridgeNotes}
            supportNote={supportNote}
          />
        }
        verdictPass={verdictView.kind === 'EXACT' || verdictView.kind === 'NEEDS_GIVE'}
        segmentCount={woodCount}
        ceiling={CANVAS_SEGMENT_CEILING}
        allSaved={allSaved}
        onExit={exitBuild}
        resumeKey={screen.ownBuild ? undefined : BUILD_LINK_STORAGE_KEY}
      />
    );
  }

  // A SHARED LINK: the friend's screen, read-only, on every screen (DESIGN.md rule 13).
  if (link) {
    const verdictLine = (
      <VerdictLine
        view={verdictView}
        trust={trust}
        adaptersUnmarked={adaptersUnmarked}
        levelUnmarked={levelMarks.hidden}
        polarityUnmarked={refusedMarks.hidden}
        buildings={buildingClashes}
        bridgeNotes={bridgeNotes}
        supportNote={supportNote}
      />
    );
    const n = graph.pieces.length;
    const shared = {
      pieces: n,
      picture:
        view === '3d' && sceneInput ? (
          <View3DPanel
            input={sceneInput}
            pieceCount={n}
            segmentCount={woodCount}
            ceiling={CANVAS_SEGMENT_CEILING}
            allSaved
            emptyAction={null}
            tableNote={null}
            label={sceneLabel}
            resetSignal={resetSignal}
            corner={null}
          />
        ) : (
          <TrackCanvas
            render={drawn}
            resolve={resolve}
            seams={seams}
            clashes={clashMarks}
            gaps={gaps}
            badJoints={badJoints}
            adapterJoints={adapterMarks}
            levelMismatches={levelMarks.mismatches}
            thirdLevels={levelMarks.thirds}
            pieceName={canvasPieceName}
          />
        ),
      planLabel: `Plan of the railway, ${n} ${n === 1 ? 'piece' : 'pieces'}.`,
      verdict: verdictLine,
      parts: Object.entries(counts).map(([partId, count]) => ({ partId, name: resolve(partId).name, count })),
      unmeasured: trust.find((t) => t.kind === 'unverified-size')?.pieces ?? 0,
      adapters: adaptersUsed,
      view,
      onView: setViewState,
      onBuild: () => setBuilding(true),
    };
    return (
      <FriendScreen
        {...shared}
        linkBytes={layoutBytes}
        exitLabel={exitLabel(ownLayout)}
        onExit={leaveLink}
      />
    );
  }

  const putAside = <PutAsideNotice allSaved={allSaved} current={screen.mode === 'edit' ? layoutBytes : undefined} />;
  const strip = placingStrip ?? joinStrip ?? selectionStrip ?? dropStrip ?? lastStrip ?? hintStrip;
  const identity = (
      <header className="identity">
        <AppName />
        {/* On a phone it is a row of More (eng ED10), not a line taken from the plan. */}
        {!phone && putAside}
        {screen.mode === 'example' && (
          /*
           * THE FIRST-VISIT EXAMPLE (design 3A): labelled as one, with its
           * verdict below as always. Build this is the solid action; Start my
           * own clears to an empty editor and writes nothing. Editing the
           * example makes it yours instead.
           */
          <div className="example-line" role="group" aria-label="An example">
            <span className="example-title">{exampleTitle(graph.pieces.length)}</span>
            <button ref={buildItButton} className="example-build" onClick={startBuild}>
              Build this
            </button>
            <button className="example-own" onClick={startOwn}>
              Start my own
            </button>
          </div>
        )}
      </header>
  );
  const stage = (
      <main
        className="stage"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={(e) => {
          const file = e.dataTransfer.files[0];
          if (!file) return;
          e.preventDefault();
          void openLayoutFile(file, setFileSaid);
        }}
      >
        {view === '3d' && sceneInput ? (
          <View3DPanel
            input={sceneInput}
            pieceCount={graph.pieces.length}
            segmentCount={woodCount}
            ceiling={CANVAS_SEGMENT_CEILING}
            allSaved={allSaved}
            emptyAction={emptyAction}
            tableNote={tableView ? { text: tableView.note, fits: tableView.fits } : null}
            label={sceneLabel}
            resetSignal={resetSignal}
            corner={<>{shareIt}{buildIt}{viewSwitch}</>}
            reset={resetButton}
            onPick={pickIn3d}
            train={stillMotion ? null : trainShown}
          />
        ) : (
          <TrackCanvas
            render={drawn}
            resolve={resolve}
            cursor={cursor}
            armed={armed}
            unjoinable={unjoinable}
            joining={joining}
            suggestions={suggestions}
            onSuggest={(g) => dispatch({ kind: 'joinEnds', a: g.a, b: g.b })}
            suggestionName={suggestionName}
            onPortClick={clickPort}
            welds={welds}
            onWeldClick={breakJoint}
            seams={seams}
            selected={selected}
            selectedRun={selectedRun}
            onPieceSelect={selectPiece}
            onPieceRemove={removePiece}
            onFloorClick={() => {
              // The floor un-selects a piece, and an end being joined (plan 2026-11-01, eng R2, X2).
              if (selected !== null) selectPiece(null);
              if (armed !== null || joiningStarted) cancelJoin();
            }}
            pieceName={canvasPieceName}
            // On a phone the strip has a row of its own under the verdict, so the plan never resizes (design DD2).
            strip={phone ? null : strip}
            onReachable={phone ? onReachable : undefined}
            ghost={ghostView ? { render: ghostView.render, red: ghostView.red, reach: ghostView.reach } : null}
            onRunMove={(d, radius) => moveRunBy(d.pieceId, d.dx, d.dy, d.turns, radius)}
            runOf={runOf}
            probe={canvasProbe}
            table={tableView}
            /*
              * `result`, not `result?.ok`. The clash list lives on BOTH branches
              * of GraphResult, and gating the DRAWING on `ok` undid half of the
              * reason it was put on the failure branch: `viewOf` reports
              * IMPOSSIBLE with a clash count on a failed solve, so the verdict
              * said "2 pairs of track ends land in exactly the same spot" while
              * the canvas marked none of them. A count you cannot locate is not
              * actionable, which was decision A4's whole point.
              */
            clashes={clashMarks}
            gaps={gaps}
            badJoints={badJoints}
            adapterJoints={adapterMarks}
            levelMismatches={levelMarks.mismatches}
            thirdLevels={levelMarks.thirds}
            emptyAction={emptyAction}
            corner={<div className="view-corner">{shareIt}{buildIt}{viewSwitch}</div>}
            overlay={trainShown && !stillMotion ? <TrainMark run={trainShown.run} startedMs={trainShown.startedMs} /> : null}
          />
        )}
      </main>
  );
  /*
   * THE NOTICES, as a list: the wide editor draws them all, in this order; a
   * phone shows the most serious and folds the rest (design DD5).
   */
  const notices: ReactNode[] = [
      staleTab && (
        <div key="stale" className="notice" role="alert">
          <div>
            <p className="notice-line">{STALE_TAB}</p>
          </div>
          <button className="notice-close" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      ),

      unsavedNotice !== undefined && unsavedDismissed !== unsavedNotice && (
        <div key="unsaved" className="notice" role="status" aria-live="polite" aria-atomic="false">
          <div>
            <p className="notice-line">{unsavedNotice}</p>
            {stuckRescue !== null && (
              <>
                <p className="notice-line">{rescueCopyLine(stuckRescue.length)}</p>
                <div className="put-aside-buttons">
                  <button
                    className="put-aside-button"
                    onClick={() => {
                      downloadBytes(stuckRescue, 'choochoocad-unreadable-layout.json');
                      setRescueDownloaded(true);
                    }}
                  >
                    Download it
                  </button>
                  {rescueDownloaded && (
                    <button
                      className="put-aside-button"
                      onClick={() => {
                        dropRescueCopy();
                        setSaveRetry((n) => n + 1);
                      }}
                    >
                      Remove it
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <button className="notice-close" onClick={() => setUnsavedDismissed(unsavedNotice)}>
            Dismiss
          </button>
        </div>
      ),

      linkHeld && (
        <div key="link-held" className="notice" role="status" aria-live="polite" aria-atomic="false">
          <div>
            <p className="notice-line">{LINK_HELD}</p>
          </div>
          <button className="notice-close" onClick={() => setLinkHeld(false)}>
            Dismiss
          </button>
        </div>
      ),

      layoutNotice !== undefined && !layoutDismissed && (
        <div key="layout" className="notice" role="status" aria-live="polite" aria-atomic="false">
          <div>
            <p className="notice-line">{layoutNotice}</p>
          </div>
          <button className="notice-close" onClick={() => setLayoutDismissed(true)}>
            Dismiss
          </button>
        </div>
      ),

      tableLoad.discarded !== undefined && !tableDismissed && (
        <div key="table" className="notice" role="status" aria-live="polite" aria-atomic="false">
          <div>
            <p className="notice-line">{tableLoad.discarded}</p>
          </div>
          <button className="notice-close" onClick={() => setTableDismissed(true)}>
            Dismiss
          </button>
        </div>
      ),

      inventoryLoad.discarded !== undefined && !inventoryDismissed && (
        <div key="inventory" className="notice" role="status" aria-live="polite" aria-atomic="false">
          <div>
            <p className="notice-line">{inventoryLoad.discarded}</p>
          </div>
          <button className="notice-close" onClick={() => setInventoryDismissed(true)}>
            Dismiss
          </button>
        </div>
      ),

      /*
        * THE THIRD NOTICE, and the one with the most at stake. A dropped
        * submission is a measurement somebody took with calipers. It had no
        * notice at all until now, which also meant nothing held back the save
        * that overwrote it.
        */
      submissionsNotice !== undefined && !submissionsDismissed && (
        <div key="submissions" className="notice" role="status" aria-live="polite" aria-atomic="false">
          <div>
            <p className="notice-line">{submissionsNotice}</p>
          </div>
          <button className="notice-close" onClick={() => setSubmissionsDismissed(true)}>
            Dismiss
          </button>
        </div>
      ),

  ];
  const verdictBlock = (
      <JoinStart.Provider value={!ghost && !joining && freeEnds >= 2 ? startJoin : null}>
      <VerdictScope.Provider value={ghost ? 'Placed track:' : null}>
        <VerdictLine
          view={verdictView}
          trust={trust}
          adaptersUnmarked={adaptersUnmarked}
          levelUnmarked={levelMarks.hidden}
          polarityUnmarked={refusedMarks.hidden}
        />
      </VerdictScope.Provider>
      </JoinStart.Provider>
  );
  const finishLoop = (
    <>
      {finishGap && !ghost && !joining && screen.canEdit && (
        <FinishLoop
          key={`${finishGap.weld}`}
          graph={graph}
          ports={ports}
          resolve={resolve}
          parts={library}
          brandFit={brandFit}
          inventory={inventory}
          from={finishGap.from}
          to={finishGap.to}
          gapMm={finishGap.gapMm}
          onFill={(plan, forGraph) => dispatch({ kind: 'fill', plan, graph: forGraph })}
        />
      )}
    </>
  );
  const trainControl = (
    <>
      {graph.pieces.length > 0 && !ghost && !joining && (
        <TrainControl
          run={trainRun}
          whyNot={canRunTrain ? null : TRAIN_WHY_NOT}
          onRun={runTrain}
          onStop={stopTrain}
        />
      )}
    </>
  );
  const hasShortfall = screen.mode !== 'example' && (shortfalls.length > 0 || adapterShort > 0);
  const shortfallLine = (
    <>
      {screen.mode !== 'example' && (shortfalls.length > 0 || adapterShort > 0) && (
        <p className="shortfall">
          Short by{' '}
          {shortfalls.map((sf, i) => (
            <span key={sf.partId}>
              {i > 0 && ', '}
              <span className="num">{sf.shortBy}</span>&nbsp;{codeOf(sf.partId)}
            </span>
          ))}
          {adapterShort > 0 && (
            <span>
              {shortfalls.length > 0 && ', '}
              <span className="num">{adapterShort}</span>&nbsp;male-male{' '}
              {adapterShort === 1 ? 'adapter' : 'adapters'}
            </span>
          )}{' '}
          against what you own. Still fine to draw.
        </p>
      )}
    </>
  );

  const fileControls = (
        <LayoutFileControls
          graph={graph}
          usesCorrections={usesCorrections}
          announce={setSaid}
          said={fileSaid}
          setSaid={setFileSaid}
        />
  );
  const submitPanel = (
    <>
        {submitOpen && (
          <SubmitPart
            existingIds={libraryIds}
            notTwoEndedIds={notTwoEndedIds}
            onSubmit={(sub) => {
              countAction('add-part');
              setSubmissionsActed(true);
              setSubmissions((prev) => [...prev, sub]);
              setSubmitOpen(false);
            }}
            onCancel={() => setSubmitOpen(false)}
          />
        )}
    </>
  );
  const tablePanel = (
    <>
        {tableOpen && graph.pieces.length > 0 && (
          <TablePanel
            table={table}
            onChange={(next) => {
              setTableActed(true);
              setTable(next);
            }}
            onClose={() => setTableOpen(false)}
          />
        )}
    </>
  );
  const inventoryPanel = (
    <>
        {inventoryOpen && (
          <InventoryPanel
            library={library}
            inventory={inventory}
            used={counts}
            adaptersUsed={adaptersUsed}
            adapterShort={adapterShort}
            onChange={(next) => {
              setInventoryActed(true);
              setInventory(next);
            }}
            onClose={() => setInventoryOpen(false)}
          />
        )}
    </>
  );
  const listing = (
        <GraphListing
          startOpen={phone}
          graph={graph}
          resolve={resolve}
          ports={ports}
          onPortClick={clickPort}
          onBreak={breakJoint}
          onRemove={removePiece}
          armed={armed}
          unjoinable={unjoinable}
          cursor={cursor}
        />
  );

  /*
   * THE PHONE'S EDITOR (plan 2026-11-14, E4). The same plan, verdict, strip,
   * notices and panels as the wide editor, from the same state, laid out by
   * `PhoneShell`; only Pieces and More are put together here.
   */
  if (phone) {
    const closeSheet = () => setSheet(null);
    const empty = graph.pieces.length === 0;
    // Most serious first: a save that failed, then a tab gone stale, then the rest (design DD5).
    const warnings = [notices[1], notices[0], ...notices.slice(2), hasShortfall && shortfallLine].filter(Boolean);
    const panel: PhonePanel | null = inventoryOpen
      ? { title: 'Your box', body: inventoryPanel, onDone: () => setInventoryOpen(false) }
      : tableOpen && !empty
        ? { title: 'Your table', body: tablePanel, onDone: () => setTableOpen(false) }
        : submitOpen
          ? { title: 'Add a part', body: submitPanel, onDone: () => setSubmitOpen(false) }
          : listOpen
            ? { title: 'This layout as a list', body: listing, onDone: () => setListOpen(false) }
            : null;
    return (
      <PhoneEditor
        sideways={sideways}
        identity={identity}
        warnings={warnings}
        warningsOpen={warningsOpen}
        onWarnings={setWarningsOpen}
        stage={stage}
        verdict={<VerdictCompact.Provider value={true}>{verdictBlock}</VerdictCompact.Provider>}
        strip={strip ?? (trainRun ? trainControl : null)}
        history={<UndoControl last={lastStep(editor)} next={nextStep(editor)} onUndo={undo} onRedo={redo} />}
        sheet={sheet}
        onSheet={setSheet}
        piecesScroll={piecesScroll}
        moreScroll={moreScroll}
        said={said}
        panel={panel}
        pieces={
          // No drag: in the sheet a card is picked by a tap and nothing else (design DD13).
          <PieceShelves
            library={library}
            resolve={resolve}
            inventory={inventory}
            counts={counts}
            overLimit={overLimit}
            pickedId={ghost?.partId ?? null}
            onPick={(partId) => {
              pick(partId, null);
              closeSheet();
            }}
            onAdd={() => {}}
          />
        }
        more={
          <div className="more">
            <h3 className="more-heading">This layout</h3>
            {/* Remove last is repeatable, so the sheet stays; the plan is in view over it. */}
            <button className="more-row" onClick={removeLast} disabled={empty}>
              Remove last
            </button>
            <button
              className="more-row"
              onClick={() => {
                clear();
                closeSheet();
              }}
              disabled={empty}
            >
              Clear
            </button>
            {!empty && !trainRun && (
              <button
                className="more-row"
                onClick={() => {
                  runTrain();
                  closeSheet();
                }}
                disabled={!canRunTrain}
              >
                Run a train
                {!canRunTrain && <span className="more-note">{TRAIN_WHY_NOT}</span>}
              </button>
            )}
            {finishLoop}
            {fileControls}
            {!empty && (
              <button
                className="more-row"
                onClick={() => {
                  setListOpen(true);
                  closeSheet();
                }}
              >
                This layout as a list
              </button>
            )}
            {putAside}
            <h3 className="more-heading">Your things</h3>
            <button
              className="more-row"
              onClick={() => {
                countAction('your-box');
                setInventoryOpen(true);
                closeSheet();
              }}
            >
              Your box
            </button>
            {!empty && (
              <button
                className="more-row"
                onClick={() => {
                  setTableOpen(true);
                  closeSheet();
                }}
              >
                Your table
              </button>
            )}
            {!empty && (
              <button
                className="more-row"
                onClick={() => {
                  setSubmitOpen(true);
                  closeSheet();
                }}
              >
                Add a part
              </button>
            )}
            <h3 className="more-heading">Ready layouts</h3>
            {byBox(PRESETS, inventory).map(({ preset: p, short }) => {
              const box = boxWords(short, (id) => resolve(id).name);
              return (
                <button
                  key={p.label}
                  className="more-row"
                  onClick={() => {
                    preset(p);
                    closeSheet();
                  }}
                >
                  {p.label}
                  <span className="more-note">{box ? `${p.note}. ${box.line}` : p.note}</span>
                </button>
              );
            })}
          </div>
        }
      />
    );
  }

  return (
    <div className="shell">
      {/*
        * THE IDENTITY LINE (share plan, design 2A, 22A): the app's name at the
        * top of the stage, where every screen has it, editor, friend's screen
        * and first visit alike. A layout put aside is named right under it.
        */}
      {identity}
      {/*
        * A LAYOUT FILE DROPPED ON THE CANVAS opens as "Open a layout file" does:
        *
        *   drag over ─▶ carries files? ─▶ no: left alone (the browser's default)
        *                               └ yes: accepted as a drop
        *   drop ─▶ first file ─▶ openLayoutFile ─▶ refused: said on the file row
        *                                          └ ok: the address takes the fragment
        *
        * Only HTML drag events are taken, so the canvas's pointer handling (and
        * the palette's pointer drag) never sees a difference.
        */}
      {stage}

      {notices}

      {verdictBlock}

      {/*
        * FINISH THE LOOP (plan 2026-11-14, E3). Offered for a layout with
        * exactly ONE joint that does not meet, whether its loop fails or only
        * closes with the joints' give (owner, 2026-11-14): with two or more,
        * which gap a fill belongs to would need saying, and it is not offered.
        * Not while placing or joining, and never where the layout cannot change.
        */}
      {finishLoop}

      {/* Run a train (plan 2026-11-14, E5): not while placing or joining, and not on an empty floor. */}
      {trainControl}

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="false">
        {said}
      </p>

      {/*
        * The shortfall line sits with the verdict, not in the palette, because it
        * answers the same question the verdict does: can I build this? It is a
        * separate sentence rather than part of the verdict because it is about
        * the BOX, not the geometry, and merging them would let a stock problem
        * read as a layout problem. Advice, never a gate (D8).
        */}
      {/* Not under the example: it is not the user's layout, so their box says nothing about it (2026-11-05, seen on the live site). */}
      {shortfallLine}

      <section className="palette" aria-label="Track pieces">
        {/*
          * GROUPED BY BRAND, because the brands are not interchangeable.
          *
          * This is not organisation for its own sake. Generic and small-peg connectors
          * are documented as not fitting each other, and no manufacturer
          * publishes piece dimensions for small-peg or look-alike at all, so those
          * parts carry unverified sizes. Mixing them in one undifferentiated row
          * would say they are equivalent, and they are not. Each non-Generic group
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
          * Generic SCROLLS; THE OTHER SHELVES DO NOT.
          *
          * Two attempts got this wrong. Capping the palette hid small-peg and
          * look-alike below an invisible fold. Collapsing them to one line each
          * helped but they were still inside the scrolling region, so with the
          * full Generic list above them they were still off-screen, and styling
          * the scrollbar was decorating the problem rather than fixing it.
          *
          * The scrolling region now holds ONE homogeneous list, the Generic
          * catalogue, which is the only one long enough to need scrolling and
          * the one a user expects to scroll. The other brands are navigation,
          * one line each, pinned where they are always visible.
          */}
        <PieceShelves
          library={library}
          resolve={resolve}
          inventory={inventory}
          counts={counts}
          overLimit={overLimit}
          pickedId={ghost?.partId ?? null}
          paletteDrag={paletteDrag}
          onPick={pick}
          onAdd={(partId) => add(partId, 'left')}
        />

        <div className="palette-row palette-controls">
          {/*
            * `Closed loop` is GONE. It was a property of a list, answering
            * "does the last piece join the first?", and that question has no
            * meaning once a layout can be a tree, a forest, or two loops
            * sharing a switch. Closing a loop is now clicking the two free
            * ends you want joined, which is also what you do with real track.
            */}
          <UndoControl last={lastStep(editor)} next={nextStep(editor)} onUndo={undo} onRedo={redo} />
          <button onClick={removeLast} disabled={graph.pieces.length === 0}>
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
          {/*
            * With a box declared, each says whether the box can build it, and
            * the ones it can come first (plan 2026-11-14, E2). The words are
            * text, not colour: nothing here is a verdict (DESIGN.md rule 1).
            */}
          {byBox(PRESETS, inventory).map(({ preset: p, short }) => {
            const box = boxWords(short, (id) => resolve(id).name);
            return (
              <button
                key={p.label}
                className={box ? 'has-box' : undefined}
                onClick={() => preset(p)}
                title={box ? `${p.note}. ${box.line}` : p.note}
              >
                {p.label}
                {box && <span className="ready-box">{box.tag}</span>}
              </button>
            );
          })}
        </div>

        {fileControls}

        {/*
          * YOUR BOX IS ALWAYS OFFERED (owner, 2026-11-05: "always reachable";
          * docs/plan/2026-11-05-inventory-by-part.md B1). D10 hid it until a
          * layout existed; that still holds for Your table and Add a part, which
          * only mean something once there is track.
          */}
        {!inventoryOpen && (
          <div className="palette-row palette-controls">
            <button
              onClick={() => {
                countAction('your-box');
                setInventoryOpen(true);
              }}
            >
              Your box
            </button>
            {graph.pieces.length > 0 && !tableOpen && <button onClick={() => setTableOpen(true)}>Your table</button>}
            {graph.pieces.length > 0 && <button onClick={() => setSubmitOpen(true)}>Add a part</button>}
            {/* Beside Add a part (contributor-brief D15; on since T6). */}
            {graph.pieces.length > 0 && <ContributeLink />}
            {graph.pieces.length > 0 && inventory === null && (
              <span className="inventory-hint">
                Nothing is checked against your box yet.
              </span>
            )}
          </div>
        )}

        {submitPanel}

        {tablePanel}

        {inventoryPanel}

        {/*
          * THE LAYOUT AS A LIST (task U7a). In the sidebar rather than a new
          * row of the shell grid, which would take height from the canvas.
          * Read-only until U7b; see GraphListing.tsx.
          */}
        {listing}

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
