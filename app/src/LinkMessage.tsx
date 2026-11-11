/**
 * WHAT A LINK SAYS WHEN IT CANNOT OPEN, AND ITS CRASH SCREEN (share plan, eng
 * D7; design 20A), shared by the shared-layout route and the piece preview
 * (contributor-brief T4), so both leave the same way and neither ever
 * reaches the app-wide crash screen, whose only exit clears the browser's
 * saved layout.
 */

import { Component, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AppName } from './AppName.js';
import { holdsOwnLayout } from './layoutStore.js';
import { leaveLink } from './leaveLink.js';
import { exitLabel, LINK_CRASHED, RELOAD } from './linkWords.js';

/**
 * A sentence and the way out. Focus lands on the sentence (design 20A).
 * `children` sit between the two: a piece preview's reasons and its Copy.
 */
export function LinkMessage({ sentence, role, children }: { sentence: string; role: 'alert' | 'status'; children?: ReactNode }) {
  const [own] = useState(holdsOwnLayout);
  return (
    <div className="friend friend-message">
      <header className="friend-head">
        <AppName />
      </header>
      <main className="friend-main">
        <p className="friend-message-line" role={role} tabIndex={-1} ref={(el) => el?.focus()}>
          {sentence}
        </p>
        {children}
        <button className="friend-build" onClick={leaveLink}>
          {exitLabel(own)}
        </button>
      </main>
    </div>
  );
}

/** `reload` adds a Reload button: for a screen that may not have arrived at all (LinkRouteShell). */
export class LinkBoundary extends Component<{ children: ReactNode; reload?: boolean }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error('A shared link crashed:', error);
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <LinkMessage sentence={LINK_CRASHED} role="alert">
        {this.props.reload && (
          <div className="friend-quiet">
            <button onClick={() => location.reload()}>{RELOAD}</button>
          </div>
        )}
      </LinkMessage>
    );
  }
}

/**
 * AROUND EITHER LINK SCREEN, FROM main.tsx (eng review 2026-11-11, R1 and R2).
 *
 *   lazy screen ─ download fails (weak signal, a deploy replaced the chunk) ─▶ the crash sentence, Reload, the way out
 *   a new #… pasted into this tab ─hashchange─▶ reload: main.tsx routes the new address as a fresh visit
 *
 * Without the boundary a failed download reached the root and the page went
 * blank. Without the listener the address changed and the screen didn't: the
 * old piece stayed under the new link. A link screen holds nothing unsaved,
 * so the reload is always safe, as the editor's is when everything is saved
 * (App.tsx). `leaveLink` changes the address with replaceState, which fires
 * no hashchange, so leaving reloads once.
 */
export function LinkRouteShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onHash = () => location.reload();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <LinkBoundary reload>
      <Suspense fallback={null}>{children}</Suspense>
    </LinkBoundary>
  );
}
