/**
 * THE CONTRIBUTE LINK (contributor-brief plan, C5, D15; T4 built it, T6 turned
 * it on, 2026-11-10, the owner's dry run counting as the pilot, P-1). Beside
 * the editor's Add a part: someone missing a piece is pointed at the brief
 * their own Claude follows to draw it.
 *
 * ONE SWITCH, no build flag: `CONTRIBUTE_LINK_ON`. Set it false to take the
 * link down again; while it is false nothing renders, not even an empty element.
 */

import { CONTRIBUTE_WORDS } from './linkWords.js';

/** The switch: on since T6 (2026-11-10). */
export const CONTRIBUTE_LINK_ON = true;

/**
 * Where the link opens: the brief, served by the site from
 * `app/public/contributor-brief.md` (plan step 1, T5), so the download and the
 * repository copy are one file.
 */
export const BRIEF_URL = 'https://woodentrain.world/contributor-brief.md';

/** `on` is the switch, a parameter so a test can turn it without editing the constant. */
export function ContributeLink({ on = CONTRIBUTE_LINK_ON }: { readonly on?: boolean }) {
  if (!on) return null;
  return (
    <a className="contribute-link" href={BRIEF_URL} target="_blank" rel="noreferrer">
      {CONTRIBUTE_WORDS}
    </a>
  );
}
