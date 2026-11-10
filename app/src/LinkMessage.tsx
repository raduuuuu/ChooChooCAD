/**
 * WHAT A LINK SAYS WHEN IT CANNOT OPEN, AND ITS CRASH SCREEN (share plan, eng
 * D7; design 20A), shared by the shared-layout route and the piece preview
 * (contributor-brief T4), so both leave the same way and neither ever
 * reaches the app-wide crash screen, whose only exit clears the browser's
 * saved layout.
 */

import { Component, useState, type ReactNode } from 'react';
import { AppName } from './AppName.js';
import { holdsOwnLayout } from './layoutStore.js';
import { leaveLink } from './leaveLink.js';
import { exitLabel, LINK_CRASHED } from './linkWords.js';

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

export class LinkBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error('A shared link crashed:', error);
  }
  override render() {
    return this.state.failed ? <LinkMessage sentence={LINK_CRASHED} role="alert" /> : this.props.children;
  }
}
