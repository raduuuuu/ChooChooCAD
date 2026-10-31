/**
 * THE 3D VIEW'S FRAME, in the main bundle (docs/plan/2026-10-31-3d-viewer.md).
 *
 * Everything that must work when the 3D code has not loaded, cannot load or
 * has failed lives here, outside the lazy chunk: the states and their words
 * (eng D9, D13, D14; design 4A-8A), and the error boundary that keeps a 3D
 * failure from taking the 2D editor with it. `Viewer3D` and Three.js are
 * loaded only when this panel first shows a layout.
 */

import { Component, lazy, Suspense, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { SceneInput } from '../../engine/src/view3d/mesh.js';
import type { BuildView, Viewer3DProps } from './Viewer3D.js';

/** Load the viewer; a fresh `lazy` per attempt, since React keeps a failed one failed. */
const loadViewer = () => lazy(() => import('./Viewer3D.js'));

/** Shown only if loading takes longer than this, so a cached chunk never flashes it (design 4A). */
export const LOADING_DELAY_MS = 300;

type Failure = 'download' | 'webgl' | 'lost';

/** Which failure an error is: a chunk that did not arrive, or a browser without WebGL. */
export function failureOf(error: unknown): Failure {
  if (error instanceof Error && error.name === 'WebGLUnavailable') return 'webgl';
  return 'download';
}

class Boundary extends Component<{ onError: (f: Failure, e: unknown) => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    // The cause, as the app's own ErrorBoundary logs it (eng Section 8).
    console.error('3D view failed:', error);
    this.props.onError(failureOf(error), error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Loading() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), LOADING_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="canvas-empty" role="status" aria-live="polite">
      {shown && <p className="canvas-empty-lead">Opening the 3D view…</p>}
    </div>
  );
}

export interface View3DPanelProps {
  readonly input: SceneInput;
  /** Pieces in the layout: none shows the empty state (eng D9, design 5A). */
  readonly pieceCount: number;
  /** Segments, against the canvas's drawing ceiling (eng D12, design 6A). */
  readonly segmentCount: number;
  readonly ceiling: number;
  /** Whether every store saved, so a reload is safe to offer (eng D14). */
  readonly allSaved: boolean;
  /** The 2D empty state's preset button, reused (design 5A). */
  readonly emptyAction: ReactNode;
  /** The table-fit caption, kept in 3D (design 3A, 9A). */
  readonly tableNote: { readonly text: string; readonly fits: boolean } | null;
  readonly label: string;
  readonly resetSignal: number;
  /** The 2D/3D switch, drawn in the frame's corner (design 1A). */
  readonly corner: ReactNode;
  /**
   * The Reset view button, shown before the switch only while a view is drawn:
   * on the empty, too-big and failed states there is nothing to reset
   * (design 2A; design review FINDING-005).
   */
  readonly reset?: ReactNode;
  /** Reloading the page, for a second failed download (eng D13). */
  readonly reload?: () => void;
  /**
   * Build mode (docs/plan/2026-10-31-build-mode.md): the viewer frames and
   * locks each step; no how-to, no Reset, and the failure states drop the
   * sentences that point at the editor (scope 7).
   */
  readonly build?: BuildView | null;
  /** Passed to the viewer: a new scene is on screen (D37). */
  readonly onDrawn?: () => void;
  /** Build mode's way on when 3D cannot draw: Print the sheet (scope 7). */
  readonly failureAction?: ReactNode;
}

export function View3DPanel(props: View3DPanelProps) {
  const { input, pieceCount, segmentCount, ceiling, allSaved, emptyAction, tableNote, label, resetSignal, corner, reset } = props;
  const [attempt, setAttempt] = useState(0);
  const Viewer = useMemo(() => loadViewer(), [attempt]);
  const [failure, setFailure] = useState<{ kind: Failure; downloads: number } | null>(null);
  const retry = () => {
    setFailure(null);
    setAttempt((a) => a + 1);
  };
  const [downloads, setDownloads] = useState(0);
  const onError = (kind: Failure) => {
    if (kind === 'download') setDownloads((n) => n + 1);
    setFailure({ kind, downloads: kind === 'download' ? downloads + 1 : downloads });
  };
  const onContextLost = () => setFailure({ kind: 'lost', downloads });

  // A view is drawn (or loading): not empty, not too big, not failed.
  const live = pieceCount > 0 && segmentCount <= ceiling && failure === null && !props.build;
  const inBuild = !!props.build;
  // The how-to also describes the canvas, so its keys are announced (design review FINDING-006).
  const howToId = useId();
  let body: ReactNode;
  if (pieceCount === 0) {
    body = (
      <div className="canvas-empty">
        <p className="canvas-empty-lead">Nothing to show in 3D yet.</p>
        {emptyAction && <div className="canvas-empty-action">{emptyAction}</div>}
      </div>
    );
  } else if (segmentCount > ceiling) {
    body = (
      <div className="canvas-empty">
        <p className="canvas-empty-lead">
          This layout has <span className="num">{segmentCount.toLocaleString('en')}</span> pieces of track, more than 3D can
          draw (<span className="num">{ceiling.toLocaleString('en')}</span>).{inBuild ? '' : ' The 2D plan and the verdict still cover all of it.'}
        </p>
      </div>
    );
  } else if (failure?.kind === 'webgl') {
    body = (
      <div className="canvas-empty" role="alert">
        <p className="canvas-empty-lead">This browser can&rsquo;t draw 3D.{inBuild ? '' : ' The 2D plan has everything.'}</p>
      </div>
    );
  } else if (failure?.kind === 'lost') {
    body = (
      <div className="canvas-empty" role="alert">
        <p className="canvas-empty-lead">The 3D view stopped. Try again.</p>
        <div className="canvas-empty-action">
          <button onClick={retry}>Try again</button>
        </div>
      </div>
    );
  } else if (failure?.kind === 'download' && failure.downloads >= 2) {
    body = (
      <div className="canvas-empty" role="alert">
        {allSaved ? (
          <>
            <p className="canvas-empty-lead">
              Still couldn&rsquo;t load the 3D view. Reloading the app usually fixes this. Your layout is saved.
            </p>
            <div className="canvas-empty-action">
              <button onClick={props.reload ?? (() => window.location.reload())}>Reload</button>
            </div>
          </>
        ) : (
          <p className="canvas-empty-lead">
            Still couldn&rsquo;t load the 3D view. Reloading now would lose changes that aren&rsquo;t saved{inBuild ? '.' : '; keep working in 2D.'}
          </p>
        )}
      </div>
    );
  } else if (failure?.kind === 'download') {
    body = (
      <div className="canvas-empty" role="alert">
        <p className="canvas-empty-lead">Couldn&rsquo;t load the 3D view.</p>
        <div className="canvas-empty-action">
          <button onClick={retry}>Try again</button>
        </div>
      </div>
    );
  } else {
    const viewerProps: Viewer3DProps = {
      input,
      label,
      resetSignal,
      onContextLost,
      ...(live ? { describedBy: howToId } : {}),
      build: props.build ?? null,
      ...(props.onDrawn ? { onDrawn: props.onDrawn } : {}),
    };
    body = (
      <Boundary key={attempt} onError={onError}>
        <Suspense fallback={<Loading />}>
          <Viewer {...viewerProps} />
        </Suspense>
      </Boundary>
    );
  }

  return (
    <div className="canvas-frame">
      <div className="canvas-area viewer3d-area">
        {body}
        {live && (
          <p className="viewer3d-howto" id={howToId}>
            3D view: drag to turn, scroll or pinch to zoom. Keys: arrows turn, + and &minus; zoom, 0 resets. Pick a part
            to place it in 2D.
          </p>
        )}
        {inBuild && pieceCount > 0 && (segmentCount > ceiling || failure !== null) && props.failureAction && (
          <div className="build-failure-action">{props.failureAction}</div>
        )}
        {tableNote && <p className={`table-caption${tableNote.fits ? '' : ' is-over'}`}>{tableNote.text}</p>}
        <div className="view-corner">
          {live && reset}
          {corner}
        </div>
      </div>
    </div>
  );
}
