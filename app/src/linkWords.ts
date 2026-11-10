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

/**
 * The contribute link beside Add a part (contributor-brief D15; ContributeLink.tsx).
 * Here, not in previewWords.ts, because the editor shows it: a word from that
 * module would pull the whole preview's table into the editor's chunk.
 */
export const CONTRIBUTE_WORDS = 'Missing a piece? Have your Claude draw it for the library';
/** Opening a link in the editor (design doc step 3; eng D23, D29, D72; design 11A, 18A). */
export const OPEN_IN_EDITOR = 'Open in editor';
export const PHONE_CANNOT_EDIT = 'Open this link on a tablet or computer to change it.';
/** The first visit's example (design 3A, 19A): the Stadium, labelled as an example, never saved until it is yours. */
export const EXAMPLE_PRESET = 'Stadium';
export const exampleTitle = (pieces: number) => `An example · ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`;
export const ownTitle = (pieces: number) => `Your railway · ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`;
/** On a phone with no link: phones view and build, and this says where to design (19A). */
export const PHONE_DESIGN_ELSEWHERE = 'Open ChooChooCAD on a tablet or computer to design your own.';
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
  'Storage is full, so your previous layout is only in this tab now. Download a copy to keep it safe: Open a layout file brings it back.';
export const RESTORE_WAITS = "Restore waits until your changes are saved.";
export const STALE_TAB = 'This layout was changed in another tab. Reload to see the latest.';

/** Share, in the canvas corner (eng D9, D10, D14, D16, D26; design 5A, 7A, 12A). */
export const NOTHING_TO_SHARE = 'Nothing to share yet.';
export const COPIED = 'Link copied';
export const COPY_BY_HAND = 'Copy it from here.';
export const SHARING_NEEDS_NEWER = 'Sharing needs a newer browser.';
export const USES_CORRECTIONS = 'The link uses standard part sizes; your corrected sizes stay with you.';
/** What the share sheet sends before the link (12A). */
export const SHARE_TEXT = 'A wooden railway for you to build:';
const SHARE_FAILED = "This layout couldn't be turned into a link.";
const SHARE_TOO_BIG = `This layout is too big for a link: links carry 500 pieces at most.`;
/** Share decodes its own link first (D16); a refusal says why, from the sender's side. */
export const SHARE_REFUSED: Record<LinkRefusal, string> = {
  'unknown-part': "This layout uses a part you added, and links can only carry the catalogue's parts.",
  'old-browser': SHARING_NEEDS_NEWER,
  'too-many-pieces': SHARE_TOO_BIG,
  'too-long': SHARE_TOO_BIG,
  'too-large': SHARE_TOO_BIG,
  version: SHARE_FAILED,
  'bad-encoding': SHARE_FAILED,
  corrupt: SHARE_FAILED,
  malformed: SHARE_FAILED,
  invalid: SHARE_FAILED,
};

/*
 * A LAYOUT FILE (layoutFile.ts). Opening says what a link would, about a file;
 * saving says what Share would, about a file.
 */
const FILE_UNREADABLE = "This file isn't a layout ChooChooCAD can open.";
const FILE_TOO_BIG = 'This layout is too big for a file: files carry 500 pieces at most.';
export const FILE_REFUSED: Record<LinkRefusal, string> = {
  version: 'This file was made by a newer ChooChooCAD. Reloading usually fixes this.',
  'unknown-part': "This file uses a piece this version of ChooChooCAD doesn't have, or one added in another browser.",
  'old-browser': "This browser can't open layout files. Updating it should fix this.",
  'too-long': FILE_TOO_BIG,
  'too-large': FILE_TOO_BIG,
  'too-many-pieces': FILE_TOO_BIG,
  'bad-encoding': FILE_UNREADABLE,
  corrupt: FILE_UNREADABLE,
  malformed: FILE_UNREADABLE,
  invalid: FILE_UNREADABLE,
};
const SAVE_FAILED = "This layout couldn't be saved to a file.";
export const FILE_SAVE_REFUSED: Record<LinkRefusal, string> = {
  'unknown-part': "This layout uses a part you added, and a file can only carry the catalogue's parts.",
  'old-browser': 'Saving to a file needs a newer browser.',
  'too-long': FILE_TOO_BIG,
  'too-large': FILE_TOO_BIG,
  'too-many-pieces': FILE_TOO_BIG,
  version: SAVE_FAILED,
  'bad-encoding': SAVE_FAILED,
  corrupt: SAVE_FAILED,
  malformed: SAVE_FAILED,
  invalid: SAVE_FAILED,
};
export const FILE_USES_CORRECTIONS = 'The file uses standard part sizes; your corrected sizes stay with you.';
export const FILE_SAVED = 'Saved to a file.';
