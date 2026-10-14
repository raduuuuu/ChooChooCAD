/**
 * The crash screen (task K5).
 *
 * Before this, a throw anywhere under App unmounted the tree and left a white
 * page. No message, no way back, and nothing a user could send that would let
 * anyone reproduce it. If the cause was a stored blob, every reload crashed
 * again on the same data, which is a permanently dead app rather than a bug.
 *
 * Three things, in the order they matter to the person looking at it:
 *
 *   1. Say what happened, plainly, and that their track is still saved.
 *   2. Give them a way out. Reload first; clearing stored data second, behind
 *      a confirm, because it throws away work and is only worth it when the
 *      stored data is what crashes.
 *   3. Print the repro. See repro.ts for why it is a runnable file.
 *
 * A CLASS COMPONENT, deliberately. React has no hook equivalent of
 * componentDidCatch; this is the one place the class API is still required.
 *
 * It reads localStorage directly rather than taking App's state as a prop,
 * because by the time this renders App's state may never have existed. Every
 * read is wrapped: storage throws in private mode, and a crash screen that
 * crashes is worse than the crash.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SUBMISSIONS_STORAGE_KEY } from '../../engine/data/library.js';
import { reproText } from './repro.js';
import {
  CHAIN_STORAGE_KEY,
  GRAPH_RESCUE_KEY,
  GRAPH_STORAGE_KEY,
  INVENTORY_STORAGE_KEY,
} from './storageKeys.js';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

interface State {
  readonly error: Error | null;
  readonly confirmingClear: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, confirmingClear: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Still log it. The on-screen repro is for the user to send; this is for
    // whoever has the devtools open right now.
    console.error('brio-designer crashed', error, info.componentStack);
  }

  /*
   * EVERY KEY THE APP WRITES, and the list was wrong in the way that mattered.
   *
   * It cleared CHAIN_STORAGE_KEY -- the retired key storageKeys.ts says nothing
   * writes any more -- and left GRAPH_STORAGE_KEY, which is the only key
   * saveGraph writes. So the button labelled "Yes, delete my track" did not
   * delete the track, and when the stored graph was what crashed, clearing and
   * reloading re-read the same crashing blob: the permanently dead app this
   * file's own header says it exists to prevent.
   *
   * GRAPH_RESCUE_KEY goes too. It holds a blob the loader already refused, so
   * if the user has reached the point of discarding everything, keeping a copy
   * of the thing that broke helps nobody and may itself be the crash.
   *
   * CHAIN_STORAGE_KEY stays as legacy cleanup.
   */
  private clearAndReload = () => {
    for (const key of [
      GRAPH_STORAGE_KEY,
      GRAPH_RESCUE_KEY,
      CHAIN_STORAGE_KEY,
      INVENTORY_STORAGE_KEY,
      SUBMISSIONS_STORAGE_KEY,
    ]) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing useful to do; the reload below is still worth attempting.
      }
    }
    location.reload();
  };

  render() {
    const { error, confirmingClear } = this.state;
    if (!error) return this.props.children;

    const text = reproText({
      /*
       * THE GRAPH IS THE LAYOUT NOW. Passing only the retired chain key meant
       * every crash dump reported an empty layout for a crash that happened
       * with a full one -- verbatim the failure storageKeys.ts's header names
       * as the reason these keys have one owner. The chain is still read, so an
       * old blob is not lost, but it is no longer the only thing sent.
       */
      graph: read(GRAPH_STORAGE_KEY),
      chain: read(CHAIN_STORAGE_KEY),
      inventory: read(INVENTORY_STORAGE_KEY),
      submissions: read(SUBMISSIONS_STORAGE_KEY),
      version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown',
      userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
      error: { name: error.name, message: error.message },
    });

    return (
      <div className="crash">
        <h1 className="crash-title">Something broke.</h1>
        <p className="crash-lead">
          Your track is still saved. Reloading usually brings it back. If it crashes
          again straight away, the saved data is probably what broke it.
        </p>

        <div className="crash-actions">
          <button className="primary" onClick={() => location.reload()}>
            Reload
          </button>
          {confirmingClear ? (
            <>
              <button onClick={this.clearAndReload}>
                Yes, delete my track, inventory and submitted parts
              </button>
              <button onClick={() => this.setState({ confirmingClear: false })}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => this.setState({ confirmingClear: true })}>
              Clear saved data
            </button>
          )}
        </div>

        <p className="crash-lead">
          This is what you were working on when it broke. Send it to whoever maintains
          this, or save it as <code>crash-repro.ts</code> and run it yourself.
        </p>
        {/*
          * A textarea, not a <pre>. Click it and cmd-A selects the repro and
          * nothing else; in a <pre> the same keystroke takes the whole page.
          * readOnly rather than disabled, because a disabled field cannot be
          * selected at all, which would defeat the point.
          */}
        <textarea
          className="crash-repro num"
          readOnly
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          spellCheck={false}
          aria-label="Crash details to copy"
        />
      </div>
    );
  }
}
