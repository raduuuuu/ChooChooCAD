/**
 * WHICH SCREENS GET THE PHONE'S EDITOR, AND LOADING IT (plan 2026-11-14,
 * design DD9; eng ED2, ED8, ED9; docs/plan/2026-11-14-additions-eng.md).
 *
 *   matchMedia(PHONE_SHELL_QUERY) ── read ONCE, in App.tsx ──▶ wide shell | phone shell
 *        narrow, or short and touch                              (chosen by rendering it)
 *
 *   phone shell ──▶ lazy(import('./PhoneShell.js'))   its own chunk: a wide screen never loads it
 *                     ├─ loading ─▶ "Opening the editor…"
 *                     └─ the chunk did not arrive ─▶ one sentence, and Reload
 *
 * A shared link never gets it: a link is read-only on every screen (DESIGN.md
 * rule 13), and App looks at the link before it looks at the screen.
 */

import { Component, lazy, Suspense, type ReactNode } from 'react';
import type { PhoneShellProps } from './PhoneShell.js';
import { NARROW_QUERY } from './useMatchMedia.js';

/** A touch screen too short for the wide editor: a phone held sideways (DD9). */
export const SHORT_TOUCH_QUERY = '(max-height: 499px) and (pointer: coarse)';
/** Every screen that gets the phone's editor: narrow, or short and touch. */
export const PHONE_SHELL_QUERY = `${NARROW_QUERY}, ${SHORT_TOUCH_QUERY}`;

export const PHONE_LOADING = 'Opening the editor…';
export const PHONE_LOAD_FAILED = "The editor couldn't be loaded. Check your connection, then reload.";

const Shell = lazy(() => import('./PhoneShell.js'));

/** The chunk failing to arrive must not be a blank screen (ED8): say so, and offer Reload. */
class LoadFailure extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="phone-wait" role="alert">
        <p>{PHONE_LOAD_FAILED}</p>
        <button className="primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}

/** The phone's editor, loaded on first use. */
export function PhoneEditor(props: PhoneShellProps) {
  return (
    <LoadFailure>
      <Suspense
        fallback={
          <div className="phone-wait" role="status">
            <p>{PHONE_LOADING}</p>
          </div>
        }
      >
        <Shell {...props} />
      </Suspense>
    </LoadFailure>
  );
}
