/**
 * THE FRIEND'S SCREEN: a shared railway, read-only (share plan; design 1A,
 * 20A, 21A, 18A; eng D21).
 *
 *   ChooChooCAD · wooden railway layouts           (identity, 2A)
 *   A wooden railway · 14 pieces                   (h1, focused on load)
 *   ┌─────────────────────────────────────────┐
 *   │  the plan, 2D first; 3D on request      │    (the anchor)
 *   └─────────────────────────────────────────┘
 *   O This works. …                               (the editor's own verdict)
 *   Checked with catalogue sizes.                  (D14, 8A)
 *   [ Build it ]                                   (the one solid button)
 *   Open in editor                                 (desktop; a sentence on a phone)
 *   ▸ Parts: 14 pieces                             (folded)
 *   3D · Back to my layout / Start your own        (quiet)
 *
 * App renders this in link mode and owns every value in it; this file is the
 * arrangement only. The canvas is `inert`: nothing on it is a control here,
 * so nothing on it takes a pointer or focus, and the plan is described to a
 * screen reader by `planLabel` instead.
 *
 * Under 620px the same order stacks in one column (app.css, the phone friend
 * screen, design 18A); the editor's "needs a larger screen" message is not
 * shown for a link.
 *
 * THE SAME COMPOSITION ON A PHONE WITH NO LINK (design 19A, eng D65): `own`
 * swaps the title, the build label and the announcement, drops the catalogue
 * line, Open in editor and the exit, and says where to design instead. It
 * shows the first-visit example, or the user's own layout read-only.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { AppName } from './AppName.js';
import { CATALOGUE_SIZES, linkTitle, PHONE_DESIGN_ELSEWHERE } from './linkWords.js';
import { OpenInEditor } from './OpenInEditor.js';

export interface FriendPartRow {
  readonly partId: string;
  readonly name: string;
  readonly count: number;
}

export interface FriendScreenProps {
  readonly pieces: number;
  /** The plan (2D canvas) or the 3D view. */
  readonly picture: ReactNode;
  /** What the picture shows, for screen readers (design 20A). */
  readonly planLabel: string;
  /** The editor's own verdict line, so the friend reads exactly what the sender did. */
  readonly verdict: ReactNode;
  readonly parts: readonly FriendPartRow[];
  readonly adapters: number;
  readonly view: '2d' | '3d';
  readonly onView: (v: '2d' | '3d') => void;
  readonly onBuild: () => void;
  /** The shared layout in the saved format, for Open in editor. */
  readonly linkBytes: string;
  readonly exitLabel: string;
  readonly onExit: () => void;
}

/** The phone screen for this browser's own layout or the example (19A). */
export interface OwnScreenWords {
  readonly title: string;
  readonly build: string;
  readonly status: string;
}

export type PhoneScreenProps = Omit<FriendScreenProps, 'linkBytes' | 'exitLabel' | 'onExit'> & { readonly own: OwnScreenWords };

const isOwn = (p: FriendScreenProps | PhoneScreenProps): p is PhoneScreenProps => 'own' in p;

export function FriendScreen(props: FriendScreenProps | PhoneScreenProps) {
  const own = isOwn(props) ? props.own : null;
  const title = useRef<HTMLHeadingElement | null>(null);
  // Focus starts at the title, so a screen reader arriving from a chat hears what this is (20A).
  useEffect(() => title.current?.focus(), []);
  const total = props.parts.reduce((n, r) => n + r.count, 0);
  return (
    <div className="friend">
      <header className="friend-head">
        <AppName />
      </header>
      <main className="friend-main">
        <h1 className="friend-title" ref={title} tabIndex={-1}>
          {own ? own.title : linkTitle(props.pieces)}
        </h1>
        <div className="friend-picture" role="img" aria-label={props.planLabel}>
          <div className="friend-picture-inner" inert>
            {props.picture}
          </div>
        </div>
        <div className="friend-verdict">
          {props.verdict}
          {!own && <p className="friend-sizes">{CATALOGUE_SIZES}</p>}
        </div>
        <div className="friend-actions">
          <button className="friend-build" onClick={props.onBuild}>
            {own ? own.build : 'Build it'}
          </button>
          {isOwn(props) ? <p className="friend-own-note">{PHONE_DESIGN_ELSEWHERE}</p> : <OpenInEditor linkBytes={props.linkBytes} />}
          <details className="friend-parts">
            <summary>
              Parts: <span className="num">{total}</span> {total === 1 ? 'piece' : 'pieces'}
            </summary>
            <table>
              <tbody>
                {props.parts.map((r) => (
                  <tr key={r.partId}>
                    <td>{r.name}</td>
                    <td className="num">{r.partId}</td>
                    <td className="num">{r.count}</td>
                  </tr>
                ))}
                {props.adapters > 0 && (
                  <tr>
                    <td>Male-male adapter</td>
                    <td />
                    <td className="num">{props.adapters}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </details>
          <div className="friend-quiet">
            <button onClick={() => props.onView(props.view === '2d' ? '3d' : '2d')}>
              {props.view === '2d' ? 'See it in 3D' : 'Back to the plan'}
            </button>
            {!isOwn(props) && <button onClick={props.onExit}>{props.exitLabel}</button>}
          </div>
        </div>
      </main>
      <p className="sr-only" role="status" aria-live="polite">
        {/* The verdict line announces itself in its own region; this names what arrived. */}
        {own ? own.status : `Shared railway, ${props.pieces} ${props.pieces === 1 ? 'piece' : 'pieces'}.`}
      </p>
    </div>
  );
}
