/**
 * YOUR EARLIER LAYOUT, PUT ASIDE (share plan, design doc step 3; eng D24,
 * D36; design 9A, 13A, 22A, D72).
 *
 *   "Your earlier layout (N pieces) is put aside."  [Restore it] [Discard]
 *     Restore it ─▶ swap the two (putAside.ts) ─▶ restored ─▶ reload, fresh undo history
 *                                             ├▶ failed   ─▶ one sentence, both as they were
 *                                             └▶ stranded ─▶ the storage-full warning +
 *                                                            Download a copy (the exact bytes)
 *     Discard ─▶ "Discard the put-aside layout (N pieces)? This can't be undone."
 *                [Discard] [Keep it] ─▶ the slot empties and the notice goes
 *
 * Restore reloads, so it waits for `allSaved`: a reload with an unsaved
 * change would lose it. Another tab putting a layout aside, or taking one
 * back, updates this line through the storage event.
 */

import { useEffect, useState } from 'react';
import { discardQuestion, putAsideLine, RESTORE_FAILED, RESTORE_WAITS, STRANDED } from './linkWords.js';
import { discardPrevious, putAside, restorePrevious, type Summary } from './putAside.js';
import { GRAPH_PREVIOUS_KEY } from './storageKeys.js';

/** The exact bytes as a file, so nothing about them is changed on the way out (D36). */
function download(bytes: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'choochoocad-layout.json';
  a.click();
  URL.revokeObjectURL(url);
}

const piecesOf = (s: Summary) => (s.kind === 'layout' ? s.pieces : null);

export function PutAsideNotice({ allSaved }: { readonly allSaved: boolean }) {
  const [summary, setSummary] = useState(putAside);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stranded, setStranded] = useState<string | null>(null);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === GRAPH_PREVIOUS_KEY || e.key === null) setSummary(putAside());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // The warning stays for as long as a layout exists only in this tab (13A).
  if (stranded !== null) {
    return (
      <div className="notice" role="alert">
        <div>
          <p className="notice-line">{STRANDED}</p>
        </div>
        <button className="notice-close" onClick={() => download(stranded)}>
          Download a copy
        </button>
      </div>
    );
  }
  if (summary.kind === 'none') return null;

  const restore = () => {
    const r = restorePrevious();
    if (r.kind === 'restored') location.reload();
    else if (r.kind === 'stranded') setStranded(r.bytes);
    else setFailed(true);
  };
  const discard = () => {
    // A failed removal leaves the slot, so the notice simply stays.
    if (discardPrevious()) setSummary({ kind: 'none' });
    setConfirming(false);
  };
  const pieces = piecesOf(summary);

  return (
    <div className="notice put-aside" role="status" aria-live="polite" aria-atomic="false">
      <div>
        {confirming ? (
          <p className="notice-line" tabIndex={-1} ref={(el) => el?.focus()}>
            {discardQuestion(pieces)}
          </p>
        ) : (
          <p className="notice-line">{putAsideLine(pieces)}</p>
        )}
        {failed && <p className="notice-line">{RESTORE_FAILED}</p>}
        {!allSaved && !confirming && <p className="notice-line">{RESTORE_WAITS}</p>}
      </div>
      <div className="put-aside-buttons">
        {confirming ? (
          <>
            <button className="put-aside-button" onClick={discard}>
              Discard
            </button>
            <button className="put-aside-button" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </>
        ) : (
          <>
            <button className="put-aside-button" onClick={restore} disabled={!allSaved}>
              Restore it
            </button>
            <button className="put-aside-button" onClick={() => setConfirming(true)}>
              Discard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
