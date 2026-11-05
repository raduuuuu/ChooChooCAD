/**
 * SHARE, IN THE CANVAS CORNER (share plan; eng D5, D9, D10, D14, D16, D26;
 * design 5A, 7A, 12A).
 *
 *   [Share] [Build it] [2D|3D]
 *     empty layout ─▶ disabled, "Nothing to share yet." (D26)
 *     tap ─▶ browser can't compress ─▶ "Sharing needs a newer browser." (D9)
 *         ─▶ encode ─▶ decode it again, every cap and refusal (D16)
 *              refused ─▶ one sentence naming why
 *              ok ─▶ touch with a share sheet ─▶ the sheet (D5); cancelled = nothing
 *                    otherwise ─▶ clipboard ─ resolves ─▶ "Link copied", 2s (7A)
 *                                            └ rejects ─▶ the link in a selected field,
 *                                                         "Copy it from here." (D10)
 *     a corrected part in the layout ─▶ "The link uses standard part sizes;
 *                                        your corrected sizes stay with you." (D14)
 *
 * "Link copied" shows only after the write resolves: a label that says so
 * before the clipboard agrees would be a promise, not a fact.
 */

import { useEffect, useRef, useState } from 'react';
import type { Graph } from '../../engine/src/graph/model.js';
import { countAction } from './linkFragment.js';
import { canCompress, decodeLink, encodeLink } from './shareLink.js';
import { COPIED, COPY_BY_HAND, NOTHING_TO_SHARE, SHARE_REFUSED, SHARE_TEXT, SHARING_NEEDS_NEWER, USES_CORRECTIONS } from './linkWords.js';

const COPIED_MS = 2000;

type State =
  | { kind: 'idle' }
  | { kind: 'copied' }
  | { kind: 'by-hand'; url: string }
  | { kind: 'said'; sentence: string };

/** A phone or tablet with a share sheet (D5); a desktop copies. */
const sheet = () => typeof navigator.share === 'function' && window.matchMedia?.('(pointer: coarse)').matches === true;

export interface ShareControlProps {
  readonly graph: Graph;
  readonly usesCorrections: boolean;
  /** The app's one polite announcer: "Link copied" is said there, not in a second region (7A). */
  readonly announce: (sentence: string) => void;
}

export function ShareControl({ graph, usesCorrections, announce }: ShareControlProps) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const field = useRef<HTMLInputElement | null>(null);
  const empty = graph.pieces.length === 0;

  // A changed layout makes what was said about the old one stale.
  useEffect(() => setState({ kind: 'idle' }), [graph]);
  useEffect(() => {
    if (state.kind !== 'copied') return;
    const t = setTimeout(() => setState({ kind: 'idle' }), COPIED_MS);
    return () => clearTimeout(t);
  }, [state]);
  useEffect(() => {
    if (state.kind === 'by-hand') field.current?.select();
  }, [state]);

  const share = async () => {
    if (!canCompress()) return setState({ kind: 'said', sentence: SHARING_NEEDS_NEWER });
    const fragment = await encodeLink(graph);
    const check = await decodeLink(fragment);
    if (!check.ok) return setState({ kind: 'said', sentence: SHARE_REFUSED[check.reason] });
    const url = `${location.origin}${location.pathname}${fragment}`;
    // Counted once the link exists, whichever way it then leaves: sheet, clipboard or by hand.
    countAction('share');
    if (sheet()) {
      try {
        await navigator.share({ text: SHARE_TEXT, url });
        return setState({ kind: 'idle' });
      } catch (e) {
        // Cancelling the sheet is an answer, not a failure (D5).
        if (e instanceof DOMException && e.name === 'AbortError') return setState({ kind: 'idle' });
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState({ kind: 'copied' });
      announce(COPIED);
    } catch {
      setState({ kind: 'by-hand', url });
    }
  };

  const panel = state.kind === 'by-hand' || state.kind === 'said' || (usesCorrections && state.kind === 'copied');
  return (
    <span className="share">
      <button
        className="view-reset share-button"
        onClick={() => void share()}
        disabled={empty}
        title={empty ? NOTHING_TO_SHARE : undefined}
        aria-describedby={empty ? 'share-empty' : undefined}
      >
        {state.kind === 'copied' ? COPIED : 'Share'}
      </button>
      {empty && (
        <span id="share-empty" className="sr-only">
          {NOTHING_TO_SHARE}
        </span>
      )}
      {panel && (
        <span className="share-panel" role="group" aria-label="Share">
          {state.kind === 'said' && <span className="share-line">{state.sentence}</span>}
          {state.kind === 'by-hand' && (
            <>
              <label className="share-line" htmlFor="share-url">
                {COPY_BY_HAND}
              </label>
              <input id="share-url" ref={field} className="share-url" readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} />
            </>
          )}
          {usesCorrections && state.kind !== 'said' && <span className="share-line">{USES_CORRECTIONS}</span>}
          <button className="share-close" onClick={() => setState({ kind: 'idle' })}>
            Close
          </button>
        </span>
      )}
    </span>
  );
}
