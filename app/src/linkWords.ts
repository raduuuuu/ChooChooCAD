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

/** A link pasted into a tab whose last changes are not saved (eng D15, D34). */
export const LINK_HELD = "Your last changes couldn't be saved, so the link wasn't opened. Your changes are still here.";

/** The friend's screen (design 1A, 6A, 7A, 10A; eng D7, D69). */
export const linkTitle = (pieces: number) => `A wooden railway · ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`;
export const LINK_LOADING = 'Opening a shared railway…';
export const LINK_CRASHED = "This link couldn't be shown.";
export const CATALOGUE_SIZES = 'Checked with catalogue sizes.';
/** The exit, worded for where it goes: D23's empty check picks one (design 10A). */
export const exitLabel = (holdsOwn: boolean) => (holdsOwn ? 'Back to my layout' : 'Start your own');

/** Opening a link in the editor (design doc step 3; eng D23, D29, D72; design 11A, 18A). */
export const OPEN_IN_EDITOR = 'Open in editor';
export const PHONE_CANNOT_EDIT = 'Open this link on a tablet or computer to change it.';
export const PUT_ASIDE_FAILED = "Your layout couldn't be put aside, so nothing changed.";
export const ASK_REPLACE = 'Replace the layout you put aside last time?';
export const ASIDE_EARLIER = 'Put aside earlier (will be replaced): ';
export const ASIDE_CURRENT = 'Your current layout (goes into its place): ';
export const KEPT_BOTH = 'Nothing changed. To keep both, restore your earlier layout first.';
export const UNREADABLE_LAYOUT = "A layout that couldn't be read (kept exactly as saved)";
export const piecesWord = (n: number) => `${n} ${n === 1 ? 'piece' : 'pieces'}`;

/** The put-aside notice in the editor (design 9A, 13A, 22A; eng D24, D36). */
export const putAsideLine = (pieces: number | null) =>
  pieces === null
    ? "An earlier layout that couldn't be read is put aside, kept exactly as saved."
    : `Your earlier layout (${piecesWord(pieces)}) is put aside.`;
export const discardQuestion = (pieces: number | null) =>
  pieces === null
    ? "Discard the put-aside layout that couldn't be read? This can't be undone."
    : `Discard the put-aside layout (${piecesWord(pieces)})? This can't be undone.`;
export const RESTORE_FAILED = "Storage is full, so your layouts couldn't be swapped. Both are as they were.";
export const STRANDED =
  "Storage is full, so your previous layout is only in this tab now. Download a copy to keep it safe. ChooChooCAD can't open these files yet, so keep this tab open until you've freed some space.";
export const RESTORE_WAITS = "Restore waits until your changes are saved.";
export const STALE_TAB = 'This layout was changed in another tab. Reload to see the latest.';
