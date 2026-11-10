/**
 * A PIECE PREVIEW, FROM THE ADDRESS TO THE SCREEN (contributor-brief plan,
 * step 3, E1; "The preview screen, designed", D4 to D6; T4).
 *
 *   main.tsx: #p<n>.? ─yes─▶ storage: read-only, no key allowed at all
 *               ▼
 *   decodePreview (nothing for 300ms, then "Opening a piece preview…", D6)
 *       ├─ won't decode or unpack ─▶ "This link looks cut short…" (D5) + the way out
 *       ├─ refused by a check ─────▶ "Your chat's drawing can't be shown yet."
 *       │                            + its reasons + Copy for your chat (D4) + the way out
 *       ├─ no deflate in this browser ─▶ one sentence + the way out
 *       ▼ ok
 *   LinkBoundary ▶ PreviewScreen ─ crash ─▶ "This link couldn't be shown." + the way out
 *
 * WHICH REFUSALS ARE "CUT SHORT" (D5): the ones where the data itself does
 * not come back, base64url that isn't, deflate that won't unpack, bytes that
 * aren't JSON: a link cut in a chat or a copy. Everything that decodes and
 * then fails a rule (the validator, the size caps, a newer version) is D4's,
 * with the reasons, because the sender's chat can fix those.
 */

import { useEffect, useState } from 'react';
import type { Part } from '../../engine/src/parts/schema.js';
import { decodePreview, type PreviewRefusal } from '../../engine/data/previewLink.js';
import { AppName } from './AppName.js';
import { CopyButton } from './CopyButton.js';
import { LinkBoundary, LinkMessage } from './LinkMessage.js';
import { PreviewScreen } from './PreviewScreen.js';
import { COPY_FOR_CHAT, PREVIEW_CUT_SHORT, PREVIEW_LOADING, PREVIEW_OLD_BROWSER, PREVIEW_REFUSED, refusalForChat } from './previewWords.js';
import { LOADING_DELAY_MS } from './View3DPanel.js';

const CUT_SHORT: ReadonlySet<PreviewRefusal> = new Set(['bad-encoding', 'corrupt', 'not-json']);

type State =
  | { kind: 'decoding' }
  | { kind: 'refused'; reasons: readonly string[] }
  | { kind: 'cut' }
  | { kind: 'old' }
  | { kind: 'ok'; part: Part; data: unknown };

export function PreviewRoute({ fragment }: { fragment: string }) {
  const [state, setState] = useState<State>({ kind: 'decoding' });
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => setSlow(true), LOADING_DELAY_MS);
    void decodePreview(fragment).then((r) => {
      if (!live) return;
      clearTimeout(t);
      if (r.ok) setState({ kind: 'ok', part: r.part, data: r.data });
      else if (CUT_SHORT.has(r.code)) setState({ kind: 'cut' });
      else if (r.code === 'old-runtime') setState({ kind: 'old' });
      else setState({ kind: 'refused', reasons: r.reasons });
    });
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [fragment]);

  if (state.kind === 'ok') {
    return (
      <LinkBoundary>
        <PreviewScreen part={state.part} data={state.data} />
      </LinkBoundary>
    );
  }
  if (state.kind === 'cut') return <LinkMessage sentence={PREVIEW_CUT_SHORT} role="alert" />;
  if (state.kind === 'old') return <LinkMessage sentence={PREVIEW_OLD_BROWSER} role="alert" />;
  if (state.kind === 'refused') {
    return (
      <LinkMessage sentence={PREVIEW_REFUSED} role="alert">
        {/* At most 20, the rest counted: the validator caps them (MAX_REASONS). */}
        <ul className="preview-reasons">
          {state.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <CopyButton text={refusalForChat(state.reasons)} label={COPY_FOR_CHAT} />
      </LinkMessage>
    );
  }
  return (
    <div className="friend friend-message">
      <header className="friend-head">
        <AppName />
      </header>
      <main className="friend-main" role="status" aria-live="polite">
        {slow && <p className="friend-message-line">{PREVIEW_LOADING}</p>}
      </main>
    </div>
  );
}
