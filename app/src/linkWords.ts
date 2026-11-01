/**
 * WHAT A SHARED LINK SAYS WHEN IT CANNOT OPEN (share plan, eng D32; D9, D17,
 * D25). One table, the way `joinWords.ts` keeps the join sentences, so the
 * screens and the tests read the same words.
 *
 * Every refusal gets one plain sentence. Three name a fix the friend can try:
 * a newer link in an older (cached) app, a piece this version does not have,
 * and a browser too old to unpack links. The rest, a link cut short or
 * garbled in a chat app or anything else that does not read back, share one
 * sentence, because the friend's next step is the same: ask for the link
 * again.
 */

import type { LinkRefusal } from './shareLink.js';

export const LINK_REFUSED: Record<LinkRefusal, string> = {
  version: 'This link was made by a newer ChooChooCAD. Reloading usually fixes this.',
  'unknown-part': "This link uses a piece this version of ChooChooCAD doesn't have. Reloading usually fixes this.",
  'old-browser': "This browser can't open shared links. Updating it should fix this.",
  'too-long': "This link couldn't be opened.",
  'bad-encoding': "This link couldn't be opened.",
  corrupt: "This link couldn't be opened.",
  'too-large': "This link couldn't be opened.",
  malformed: "This link couldn't be opened.",
  'too-many-pieces': "This link couldn't be opened.",
  invalid: "This link couldn't be opened.",
};
