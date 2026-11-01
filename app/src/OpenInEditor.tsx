/**
 * OPEN IN EDITOR, ON THE FRIEND'S SCREEN (share plan, design doc step 3; eng
 * D23, D27, D29, D35, D72; design 11A, 18A).
 *
 *   tap ─▶ guard (D27: a second tap does nothing) ─▶ openInEditor
 *     opened ─▶ leaveLink (the `#v…` comes off, the page reloads into the editor)
 *     ask    ─▶ the two layouts at stake, drawn ─▶ Replace it ─▶ opened / failed
 *                                              └▶ Keep it ─▶ "Nothing changed…" (D29)
 *     failed ─▶ one sentence; every key as it was
 *
 * On a phone the button is not shown (CSS, under 620px) and one sentence says
 * where to change the layout instead (18A): phones view and build only.
 */

import { useRef, useState } from 'react';
import { LayoutThumb } from './LayoutThumb.js';
import { leaveLink } from './leaveLink.js';
import {
  ASIDE_CURRENT,
  ASIDE_EARLIER,
  ASK_REPLACE,
  KEPT_BOTH,
  OPEN_IN_EDITOR,
  PHONE_CANNOT_EDIT,
  piecesWord,
  PUT_ASIDE_FAILED,
  UNREADABLE_LAYOUT,
} from './linkWords.js';
import { openInEditor, summaryOf } from './putAside.js';

type State =
  | { kind: 'idle' }
  | { kind: 'ask'; previous: string; current: string }
  | { kind: 'said'; sentence: string };

function Row({ label, bytes }: { label: string; bytes: string }) {
  const s = summaryOf(bytes);
  return (
    <li className="friend-ask-row">
      {s.kind === 'layout' && <LayoutThumb bytes={bytes} />}
      <span>
        {label}
        {s.kind === 'layout' ? <span className="num">{piecesWord(s.pieces)}</span> : UNREADABLE_LAYOUT}
      </span>
    </li>
  );
}

/** `linkBytes`: the shared layout in the saved format, exactly what the editor will load. */
export function OpenInEditor({ linkBytes }: { readonly linkBytes: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  // A ref, not state: a second tap in the same frame must see it (D27).
  const busy = useRef(false);

  const open = (replace: boolean) => {
    if (busy.current) return;
    busy.current = true;
    const r = openInEditor(linkBytes, replace);
    if (r.kind === 'opened') {
      leaveLink();
      return; // The guard stays up until the reload.
    }
    busy.current = false;
    setState(r.kind === 'ask' ? r : { kind: 'said', sentence: PUT_ASIDE_FAILED });
  };

  return (
    <>
      <button className="friend-open" onClick={() => open(false)} disabled={state.kind === 'ask'}>
        {OPEN_IN_EDITOR}
      </button>
      <p className="friend-phone-note">{PHONE_CANNOT_EDIT}</p>
      {state.kind === 'ask' && (
        <div className="friend-ask" role="group" aria-labelledby="friend-ask-question">
          <p id="friend-ask-question" className="friend-ask-question" tabIndex={-1} ref={(el) => el?.focus()}>
            {ASK_REPLACE}
          </p>
          <ul className="friend-ask-rows">
            <Row label={ASIDE_EARLIER} bytes={state.previous} />
            <Row label={ASIDE_CURRENT} bytes={state.current} />
          </ul>
          <div className="friend-ask-buttons">
            <button className="friend-build" onClick={() => open(true)}>
              Replace it
            </button>
            <button className="friend-ask-keep" onClick={() => setState({ kind: 'said', sentence: KEPT_BOTH })}>
              Keep it
            </button>
          </div>
        </div>
      )}
      {state.kind === 'said' && (
        <p className="friend-said" role="status">
          {state.sentence}
        </p>
      )}
    </>
  );
}
