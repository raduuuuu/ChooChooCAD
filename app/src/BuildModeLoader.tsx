/**
 * BUILD MODE, LOADED ON DEMAND (build mode plan D11, D19). The build screen,
 * its step list and the bend sentences stay out of the editor's main chunk
 * (`scripts/chunkBudget.ts`); this small loader is all the editor carries.
 *
 * A failed download gets the 3D view's recovery: "Couldn't load build mode."
 * with Try again, then, on a second failure, Reload only when everything is
 * saved. The editor's state is never touched by any of it.
 */

import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BuildModeProps } from './BuildMode.js';
import { LOADING_DELAY_MS } from './View3DPanel.js';

/** A fresh `lazy` per attempt, since React keeps a failed one failed. */
const loadBuild = () => lazy(() => import('./BuildMode.js'));

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error('Build mode failed to load:', error);
    this.props.onError();
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
    <div className="build-mode build-loading" role="status" aria-live="polite">
      {shown && <p className="canvas-empty-lead">Opening build mode…</p>}
    </div>
  );
}

export function BuildModeLoader(props: BuildModeProps & { readonly reload?: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [failures, setFailures] = useState(0);
  const [failed, setFailed] = useState(false);
  const Build = useMemo(() => loadBuild(), [attempt]);
  if (failed) {
    return (
      <div className="build-mode build-failed" role="alert">
        <div className="build-pull-col">
          {failures >= 2 ? (
            props.allSaved ? (
              <>
                <p className="canvas-empty-lead">Still couldn&rsquo;t load build mode. Reloading the app usually fixes this. Your layout is saved.</p>
                <div className="build-actions">
                  <button className="build-primary" onClick={props.reload ?? (() => window.location.reload())}>
                    Reload
                  </button>
                  <button className="build-text" onClick={props.onExit}>
                    Back to editor
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="canvas-empty-lead">
                  Still couldn&rsquo;t load build mode. Reloading now would lose changes that aren&rsquo;t saved.
                </p>
                <div className="build-actions">
                  <button className="build-primary" onClick={props.onExit}>
                    Back to editor
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              <p className="canvas-empty-lead">Couldn&rsquo;t load build mode.</p>
              <div className="build-actions">
                <button
                  className="build-primary"
                  onClick={() => {
                    setFailed(false);
                    setAttempt((a) => a + 1);
                  }}
                >
                  Try again
                </button>
                <button className="build-text" onClick={props.onExit}>
                  Back to editor
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  return (
    <Boundary
      key={attempt}
      onError={() => {
        setFailures((n) => n + 1);
        setFailed(true);
      }}
    >
      <Suspense fallback={<Loading />}>
        <Build {...props} />
      </Suspense>
    </Boundary>
  );
}
