/**
 * A SHARED LINK, FROM THE ADDRESS TO THE SCREEN (share plan; eng D7, D17,
 * D31; design 6A, 10A).
 *
 *   main.tsx: #v<n>.? ─no─▶ the editor
 *               │yes
 *               ▼
 *   storage: read-only session (only the link's build progress may be written)
 *               ▼
 *   decodeLink ─ refused ─▶ one sentence + Back to my layout / Start your own
 *       │ (nothing for 300ms, then "Opening a shared railway…")
 *       ▼ ok
 *   LinkBoundary ▶ App link={graph} ─ crash ─▶ "This link couldn't be shown." + the same exit
 *
 * The app-wide ErrorBoundary is never used for a link: its only way out
 * clears the browser's saved layout and reloads, which here would delete the
 * friend's own work and land on the same link again (D7).
 */

import { useEffect, useState } from 'react';
import type { Graph } from '../../engine/src/graph/model.js';
import { App } from './App.js';
import { AppName } from './AppName.js';
import { LinkBoundary, LinkMessage } from './LinkMessage.js';
import { LINK_LOADING, LINK_REFUSED } from './linkWords.js';
import { decodeLink, type LinkRefusal } from './shareLink.js';
import { LOADING_DELAY_MS } from './View3DPanel.js';

type State = { kind: 'decoding' } | { kind: 'refused'; reason: LinkRefusal } | { kind: 'ok'; graph: Graph };

export function LinkRoute({ fragment }: { fragment: string }) {
  const [state, setState] = useState<State>({ kind: 'decoding' });
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => setSlow(true), LOADING_DELAY_MS);
    void decodeLink(fragment).then((r) => {
      if (!live) return;
      clearTimeout(t);
      if (r.ok) setState({ kind: 'ok', graph: r.graph });
      else {
        // The reason, for whoever is helping the friend; the screen says one sentence (S8-1).
        console.info(`Shared link refused: ${r.reason}${r.partId ? ` (${r.partId})` : ''}`);
        setState({ kind: 'refused', reason: r.reason });
      }
    });
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [fragment]);

  if (state.kind === 'ok') {
    return (
      <LinkBoundary>
        <App link={state.graph} />
      </LinkBoundary>
    );
  }
  if (state.kind === 'refused') return <LinkMessage sentence={LINK_REFUSED[state.reason]} role="alert" />;
  return (
    <div className="friend friend-message">
      <header className="friend-head">
        <AppName />
      </header>
      <main className="friend-main">
        {/* The status is the line, not the page: `role` on <main> would take its landmark away while loading. */}
        <p className="friend-message-line" role="status" aria-live="polite">
          {slow && LINK_LOADING}
        </p>
      </main>
    </div>
  );
}
