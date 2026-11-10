/**
 * THE CONTRIBUTE LINK, OFF UNTIL THE PILOT (contributor-brief plan, C5, D15;
 * T4 builds it, T6 turns it on). Beside the editor's Add a part: someone
 * missing a piece is pointed at the brief their own Claude follows to draw it.
 *
 * ONE SWITCH, no build flag: `CONTRIBUTE_LINK_ON`, flipped by its own pull
 * request once one outside sender has finished the brief (plan step 3, "The
 * switch"). While it is false nothing renders, not even an empty element.
 */

import { CONTRIBUTE_WORDS } from './linkWords.js';

/** The switch (T6 flips it). */
export const CONTRIBUTE_LINK_ON = false;

/**
 * Where the link opens: the brief's draft on GitHub, for now. The plan has the
 * brief served by the site (`app/public/`, step 1) so the download and the
 * repository copy are one file; when T5 moves it there, this follows.
 */
export const BRIEF_URL = 'https://github.com/raduuuuu/ChooChooCAD/blob/main/docs/brief/draft.md';

/** `on` is the switch, a parameter so a test can turn it without editing the constant. */
export function ContributeLink({ on = CONTRIBUTE_LINK_ON }: { readonly on?: boolean }) {
  if (!on) return null;
  return (
    <a className="contribute-link" href={BRIEF_URL} target="_blank" rel="noreferrer">
      {CONTRIBUTE_WORDS}
    </a>
  );
}
