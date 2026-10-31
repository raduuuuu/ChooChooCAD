/**
 * BUILD MODE (docs/plan/2026-10-31-build-mode.md): the layout, one piece at a
 * time, for building on the floor. Loaded lazily, like the 3D view (D11).
 *
 *   pull list ─Start─▶ piece … ─▶ band card ─▶ piece … ─▶ last screen
 *        ▲  ◀────────────── swipe back / Left ───────────────┘
 *   Back to editor, Esc or the system Back gesture leave from anywhere (D10).
 *
 * The list comes from `buildSteps`; this file only shows it. What it decides:
 *
 * - THE PICTURE AND ITS LABEL CHANGE TOGETHER (D37). The scene asked for is
 *   `target`; the label shows `shown`, which follows only when the viewer
 *   says the new scene is on screen. Past 300 ms the counter says "Drawing…".
 * - A CHILD'S DOUBLE TAP MOVES ONE STEP (D40): taps are ignored for 400 ms
 *   after a step has drawn, and key auto-repeat is ignored.
 * - A TAP ANYWHERE ADVANCES, outside buttons and the corner's dead zone
 *   (D50); a horizontal swipe of 50 px or more goes back when it moves
 *   right and on when it moves left; under 10 px is a tap (D25).
 * - THE SCREEN DOES NOT ANIMATE (D46): every change is a cut.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { bendLimit } from '../../engine/data/bendLimit.js';
import type { Segment } from '../../engine/src/geom/fk.js';
import { buildSteps, type BuildItem, type BuildVerdict } from '../../engine/src/graph/buildSteps.js';
import type { Graph, PortRef } from '../../engine/src/graph/model.js';
import type { GraphResult } from '../../engine/src/graph/solve.js';
import { bendWords } from '../../engine/src/joints/bendWords.js';
import type { MarkInput, SceneInput } from '../../engine/src/view3d/mesh.js';
import { clearResume, enterHistory, keepAwake, loadResume, saveResume, type Awake, type BuildHistory } from './buildSession.js';
import type { BuildView } from './Viewer3D.js';
import { View3DPanel } from './View3DPanel.js';

/** Taps ignored after a step draws (D40), the "Drawing…" delay (D37), and the tap and swipe distances (D25). */
export const TAP_GUARD_MS = 400;
export const DRAWING_AFTER_MS = 300;
export const TAP_PX = 10;
export const SWIPE_PX = 50;

export interface PullRow {
  readonly partId: string;
  readonly name: string;
  readonly count: number;
  /** How many fewer Your box holds; 0 when it holds enough or no box is set. */
  readonly short: number;
}

export interface BuildModeProps {
  readonly graph: Graph;
  /** The layout as drawn, for the assembly order's levels (assemblyOrder reads them). */
  readonly segments: readonly Segment[];
  readonly result: GraphResult | null;
  /** The 3D view's input for the whole layout; each step draws a part of it. */
  readonly scene: SceneInput;
  readonly partName: (partId: string) => string;
  readonly pull: { readonly rows: readonly PullRow[]; readonly adapters: { readonly count: number; readonly short: number } };
  /** The editor's own verdict line, so build mode never words a verdict a second time (D32, D38). */
  readonly verdict: ReactNode;
  /** Whether the verdict is a pass (closes exactly or within the joints' bend): the last screen repeats it only when not (D38). */
  readonly verdictPass: boolean;
  readonly segmentCount: number;
  readonly ceiling: number;
  readonly allSaved: boolean;
  readonly onExit: () => void;
}

type Piece = Extract<BuildItem, { kind: 'piece' }>;

const verdictOf = (r: GraphResult | null): BuildVerdict =>
  r === null ? { ok: true, bend: [], adapterJoints: [] } : r.ok ? r : { ok: false, detail: r.detail, adapterJoints: r.adapterJoints };

/** "Floor done." / "Level 1 done." for the band that just ended; "Now …" for the one starting (D41). */
export function bandWords(item: Extract<BuildItem, { kind: 'band' }>, before: number): { done: string; now: string } {
  const name = (band: number) => (band === 0 ? 'Floor' : band % 2 === 0 ? `Level ${band / 2}` : 'Ramps');
  const now =
    item.phase === 'ramp'
      ? `Now the ramps that climb to level ${item.level + 1}.`
      : item.level === 0
        ? 'Now the floor.'
        : `Now the track on level ${item.level}.`;
  return { done: `${name(before)} done.`, now };
}

export default function BuildMode(props: BuildModeProps) {
  const { graph, segments, result, scene, partName, onExit } = props;
  const items = useMemo(() => buildSteps(graph, segments, verdictOf(result)), [graph, segments, result]);
  const pieces = useMemo(() => items.filter((i): i is Piece => i.kind === 'piece'), [items]);
  const [resume] = useState(() => loadResume(graph, items.length));
  // Always the pull list first; Continue goes to where the build was left (D35).
  const [target, setTarget] = useState(0);
  const [shown, setShown] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [quiet, setQuiet] = useState<{ sleep: boolean; place: boolean }>({ sleep: false, place: false });
  const drawnAt = useRef(0);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const awake = useRef<Awake | null>(null);
  const history = useRef<BuildHistory | null>(null);
  const liveId = useId();

  const item = items[target]!;
  const pictured = item.kind !== 'pull';
  // The label follows the picture; before the first picture has drawn there is no old one to contradict.
  const labelItem = items[shown]!.kind === 'pull' && pictured ? item : items[shown]!;

  /* ---- session: history, wake lock, focus ------------------------------ */
  const exit = useCallback(() => {
    history.current?.leave();
    onExit();
  }, [onExit]);
  useEffect(() => {
    const h = enterHistory(onExit);
    history.current = h;
    const a = keepAwake(() => setQuiet((q) => ({ ...q, sleep: true })));
    awake.current = a;
    regionRef.current?.focus();
    return () => {
      h.detach();
      a.stop();
    };
  }, [onExit]);

  /* ---- where we are is saved; the end clears it ------------------------ */
  useEffect(() => {
    if (items[target]!.kind === 'last') {
      clearResume();
      return;
    }
    if (target === 0) return;
    if (!saveResume(graph, target)) setQuiet((q) => ({ ...q, place: true }));
  }, [target, items, graph]);

  /* ---- moving ---------------------------------------------------------- */
  const settled = () => target === shown || !pictured;
  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= items.length) return;
      awake.current?.touch();
      setTarget(to);
      if (items[to]!.kind === 'pull') setShown(to);
    },
    [items],
  );
  const forward = (fromTap: boolean) => {
    if (item.kind === 'pull' || item.kind === 'last') return; // Start, and the end, are buttons (D32, D38)
    if (!settled()) return;
    if (fromTap && performance.now() - drawnAt.current < TAP_GUARD_MS) return;
    go(target + 1);
  };
  const backward = () => {
    if (!settled() || target === 0) return;
    go(target - 1);
  };
  const onDrawn = useCallback(() => {
    drawnAt.current = performance.now();
    setShown((s) => (s === target ? s : target));
    setDrawing(false);
  }, [target]);
  useEffect(() => {
    if (!pictured || target === shown) return;
    const t = setTimeout(() => setDrawing(true), DRAWING_AFTER_MS);
    return () => clearTimeout(t);
  }, [target, shown, pictured]);

  /* ---- keys (D51): Right and Space on, Left back, Esc out; no auto-repeat */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const onButton = e.target instanceof HTMLElement && e.target.closest('button') !== null;
      if (e.key === 'Escape') {
        e.preventDefault();
        exit();
      } else if (e.key === 'ArrowRight' || (e.key === ' ' && !onButton)) {
        e.preventDefault();
        forward(false);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        backward();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  /* ---- taps and swipes (D25, D40, D50) --------------------------------- */
  const down = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = down.current;
    down.current = null;
    if (!start) return;
    if (e.target instanceof Element && e.target.closest('button, .build-dead')) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) < TAP_PX) forward(true);
    else if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) backward();
      else forward(false);
    }
  };

  /* ---- the picture for the target -------------------------------------- */
  const view = useMemo(() => pictureOf(items, target, scene), [items, target, scene]);

  /* ---- words ------------------------------------------------------------ */
  const stepCount = pieces.length;
  const said = announce(labelItem, stepCount, partName, items, shown);

  if (item.kind === 'pull' && labelItem.kind === 'pull') {
    return (
      <div className="build-mode build-pull" ref={regionRef} tabIndex={-1} role="region" aria-label="Build mode, the parts to get out">
        <div className="build-pull-col">
          <h1 className="build-heading">Get these out of the box</h1>
          <div className="build-verdict">{props.verdict}</div>
          {resume.kind === 'resumed' && (
            <p className="build-resume">
              Picking up at step <span className="num">{stepOf(items, resume.index)}</span>.
            </p>
          )}
          {resume.kind === 'changed' && <p className="build-resume">This layout changed since last time. Starting from the first piece.</p>}
          <table className="build-parts">
            <tbody>
              {props.pull.rows.map((r) => (
                <tr key={r.partId}>
                  <td>{r.name}</td>
                  <td className="num">{r.partId}</td>
                  <td className="num">{r.count}</td>
                  <td className="build-short">{r.short > 0 && <><span className="num">{r.short}</span> short</>}</td>
                </tr>
              ))}
              {props.pull.adapters.count > 0 && (
                <tr>
                  <td>Male-male adapter</td>
                  <td />
                  <td className="num">{props.pull.adapters.count}</td>
                  <td className="build-short">
                    {props.pull.adapters.short > 0 && <><span className="num">{props.pull.adapters.short}</span> short</>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="build-actions">
            <button className="build-primary" onClick={() => go(resume.kind === 'resumed' ? resume.index : 1)}>
              {resume.kind === 'resumed' ? 'Continue' : 'Start'}
            </button>
            {resume.kind === 'resumed' && (
              <button className="build-text" onClick={() => go(1)}>
                Start again
              </button>
            )}
            <button className="build-text" onClick={exit}>
              Back to editor
            </button>
          </div>
          <p className="build-hint">Tap anywhere for the next piece. Swipe back to go back.</p>
          <Quiet quiet={quiet} />
        </div>
        <p className="sr-only" role="status" aria-live="polite" id={liveId}>
          {said}
        </p>
      </div>
    );
  }

  const n = labelItem.kind === 'piece' ? labelItem.step : null;
  return (
    <div
      className="build-mode build-step"
      ref={regionRef}
      tabIndex={-1}
      role="region"
      aria-label={n !== null ? `Build mode, step ${n} of ${stepCount}` : 'Build mode'}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="build-picture">
        <View3DPanel
          input={view.input}
          pieceCount={graph.pieces.length}
          segmentCount={props.segmentCount}
          ceiling={props.ceiling}
          allSaved={props.allSaved}
          emptyAction={null}
          tableNote={null}
          label={said}
          resetSignal={0}
          corner={null}
          build={view.build}
          onDrawn={onDrawn}
        />
      </div>
      <div className="build-label">
        <Label item={labelItem} partName={partName} before={bandBefore(items, shown)} pass={props.verdictPass} verdict={props.verdict} />
        {labelItem.kind !== 'last' && (
          <p className="build-meta">
            {drawing && target !== shown ? 'Drawing…' : n !== null ? <>Step <span className="num">{n}</span> of <span className="num">{stepCount}</span></> : null}
          </p>
        )}
        <Quiet quiet={quiet} />
        <div className="build-sr-nav">
          <button onClick={backward}>Previous step</button>
          <button onClick={() => forward(false)}>Next step</button>
        </div>
        <div className="build-dead">
          <button className={labelItem.kind === 'last' ? 'build-primary' : 'build-outline'} onClick={exit}>
            Back to editor
          </button>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite" id={liveId}>
        {said}
      </p>
    </div>
  );
}

function Quiet({ quiet }: { quiet: { sleep: boolean; place: boolean } }) {
  return (
    <p className="build-quiet" aria-live="polite">
      {quiet.sleep && 'This browser may let the screen sleep. '}
      {quiet.place && 'Your place won’t be remembered here.'}
    </p>
  );
}

function Mark({ glyph }: { glyph: string }) {
  return (
    <span className="verdict-mark" aria-hidden="true">
      {glyph}
    </span>
  );
}

function Label(props: { item: BuildItem; partName: (id: string) => string; before: number; pass: boolean; verdict: ReactNode }) {
  const { item } = props;
  if (item.kind === 'band') {
    const w = bandWords(item, props.before);
    return (
      <>
        <p className="build-name">{w.done}</p>
        <p className="build-code-line">{w.now}</p>
      </>
    );
  }
  if (item.kind === 'last') {
    const count = props.before; // reused: the piece count
    return (
      <>
        <p className="build-name">That&rsquo;s the last piece.</p>
        <p className="build-code-line">
          All <span className="num">{count}</span> pieces are down.
        </p>
        {!props.pass && <div className="build-verdict">{props.verdict}</div>}
      </>
    );
  }
  if (item.kind !== 'piece') return null;
  return (
    <>
      {item.adapter && <p className="build-name build-adapter">Adapter first: male-male</p>}
      <p className="build-name">{props.partName(item.partId)}</p>
      <p className="build-code num">{item.partId}</p>
      <Note item={item} />
    </>
  );
}

function Note({ item }: { item: Piece }) {
  const note = item.note;
  if (!note) return null;
  if (note.kind === 'bends') return <p className="build-note">This piece closes this run of track. The joints around it bend a little to meet.</p>;
  if (note.kind === 'beyond') {
    const w = bendWords(note.run, bendLimit(), 1, 1);
    return (
      <p className="build-note build-warn verdict-fail">
        <Mark glyph="X" />{' '}
        {w.segments.map((s, i) => (typeof s === 'string' ? <span key={i}>{s}</span> : <span key={i} className="num">{s.num}</span>))}
      </p>
    );
  }
  return (
    <p className="build-note build-warn verdict-unknown">
      <Mark glyph="?" /> This run of track couldn&rsquo;t be checked.
      {note.reason && <span className="build-reason"> {note.reason}</span>}
    </p>
  );
}

/** The band before item `i`, for a card's "… done." line; for the last item, the piece count. */
function bandBefore(items: readonly BuildItem[], i: number): number {
  const it = items[i]!;
  if (it.kind === 'last') return it.pieces;
  for (let k = i - 1; k >= 0; k--) {
    const p = items[k]!;
    if (p.kind === 'piece') return p.band;
  }
  return 0;
}

function stepOf(items: readonly BuildItem[], index: number): number {
  for (let k = index; k >= 0; k--) {
    const p = items[k]!;
    if (p.kind === 'piece') return p.step;
  }
  return 1;
}

function announce(item: BuildItem, steps: number, partName: (id: string) => string, items: readonly BuildItem[], i: number): string {
  switch (item.kind) {
    case 'pull':
      return 'The parts to get out of the box.';
    case 'band': {
      const w = bandWords(item, bandBefore(items, i));
      return `${w.done} ${w.now}`;
    }
    case 'last':
      return `That's the last piece. All ${item.pieces} pieces are down.`;
    case 'piece': {
      const adapter = item.adapter ? 'Adapter first: male-male. ' : '';
      const note =
        item.note?.kind === 'bends'
          ? ' This piece closes this run of track. The joints around it bend a little to meet.'
          : item.note?.kind === 'beyond'
            ? ` ${bendWords(item.note.run, bendLimit(), 1, 1).line}`
            : item.note?.kind === 'unchecked'
              ? ` This run of track couldn't be checked.${item.note.reason ? ` ${item.note.reason}` : ''}`
              : '';
      return `${adapter}${partName(item.partId)}, ${item.partId}. Step ${item.step} of ${steps}.${note}`;
    }
  }
}

/** The part of the layout a step shows, and how the camera frames it (D17, D34, D43). */
export function pictureOf(items: readonly BuildItem[], i: number, scene: SceneInput): { input: SceneInput; build: BuildView } {
  const item = items[i]!;
  const down = new Set<string>();
  for (let k = 0; k <= i; k++) {
    const p = items[k]!;
    if (p.kind === 'piece' && (k < i || item.kind === 'piece')) down.add(p.pieceId);
  }
  const next = item.kind === 'piece' ? item.pieceId : undefined;
  const portAt = new Map(scene.ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
  const marks: MarkInput[] =
    item.kind === 'piece'
      ? item.onto.flatMap((end: PortRef) => {
          const p = portAt.get(`${end.pieceId}#${end.port}`);
          return p ? [{ kind: 'join' as const, at: [p.x, p.y] as const, source: { kind: 'weld' as const, a: end } }] : [];
        })
      : [];
  const input: SceneInput = {
    ...scene,
    segments: scene.segments.filter((s) => s.pieceId !== undefined && down.has(s.pieceId)),
    ports: scene.ports.filter((p) => down.has(p.pieceId)),
    welds: scene.welds.filter((w) => down.has(w.a.pieceId) && down.has(w.b.pieceId)),
    marks,
    ...(next !== undefined ? { highlight: next } : {}),
  };
  if (item.kind === 'piece' && item.onto.length > 0) {
    return { input, build: { focus: [item.pieceId, ...item.onto.map((o) => o.pieceId)] } };
  }
  // A new run, a band card or the end: everything down so far (D17), with a close-up of a new run's piece (D34).
  return { input, build: { focus: [...down], inset: item.kind === 'piece' && down.size > 1 ? item.pieceId : null } };
}
