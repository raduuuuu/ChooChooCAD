/**
 * MY LAYOUTS, LOADED WHEN FIRST OPENED (plan 2026-11-16, saved layouts; D3).
 *
 *   App ──▶ this file, in the first load: the two sentences below, nothing else
 *   the panel ──▶ lazy(import('./MyLayouts.js')), with the store it reads
 *
 * The first load had about 1 kB of its budget left when this was built, so
 * the panel and the store cost a visitor nothing until they open it, as the
 * phone's shell and build mode do.
 */

import { Component, lazy, Suspense, type ReactNode } from 'react';
import type { MyLayoutsProps } from './MyLayouts.js';

export const LAYOUTS_LOADING = 'Opening your layouts…';
export const LAYOUTS_LOAD_FAILED = "Your layouts couldn't be loaded. Check your connection, then try again. They are still saved.";

const Panel = lazy(() => import('./MyLayouts.js'));

/** The chunk failing to arrive must not be a blank panel: say so, and that nothing was lost. */
class LoadFailure extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="inventory my-layouts" aria-label="My layouts" role="alert">
        <p className="inventory-undeclared">{LAYOUTS_LOAD_FAILED}</p>
        <div className="inventory-fills">
          <button onClick={this.props.onClose}>Done</button>
        </div>
      </section>
    );
  }
}

export function MyLayoutsPanel(props: MyLayoutsProps) {
  return (
    <LoadFailure onClose={props.onClose}>
      <Suspense
        fallback={
          <section className="inventory my-layouts" aria-label="My layouts" role="status">
            <p className="inventory-undeclared">{LAYOUTS_LOADING}</p>
          </section>
        }
      >
        <Panel {...props} />
      </Suspense>
    </LoadFailure>
  );
}
