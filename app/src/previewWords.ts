/**
 * WHAT A PIECE PREVIEW SAYS (contributor-brief plan, "The preview screen,
 * designed", D3 to D15; T4). One table beside `linkWords.ts`, which keeps the
 * shared-layout screen's words, so the screen and its tests read the same
 * sentences. No screen directions (DESIGN.md rule 7): floor and raised are
 * heights, not places on the screen.
 */

/** D3 (2): the heading, focused on load (D14). */
export const previewTitle = (name: string) => `Piece preview · ${name}`;
/** D14: what a screen reader hears when the screen arrives. */
export const previewAnnounce = (name: string) => `Piece preview, ${name}.`;
/** D3 (3): the standing line, never folded. */
export const PREVIEW_STANDING = "This piece isn't in the library: your chat drew it, and nothing here is saved.";
/** D6: after 300ms of decoding, as a shared link says its own. */
export const PREVIEW_LOADING = 'Opening a piece preview…';

/** D4: a piece the checks refused. */
export const PREVIEW_REFUSED = "Your chat's drawing can't be shown yet.";
/** D5: a link that does not decode or unpack: cut short or changed in the chat. */
export const PREVIEW_CUT_SHORT = 'This link looks cut short. Ask your chat for it again, as a file or in one piece.';
/** A browser without the streams that unpack a link (the shared-link sentence, about a preview). */
export const PREVIEW_OLD_BROWSER = "This browser can't open piece previews. Updating it should fix this.";
export const COPY_FOR_CHAT = 'Copy for your chat';
export const COPY = 'Copy';
/** D14: every Copy announces this. */
export const COPIED_ANNOUNCE = 'Copied.';
export const COPY_FAILED = "Couldn't copy. Select the text and copy it instead.";
/** What Copy for your chat copies: the sentence, then one reason a line. */
export const refusalForChat = (reasons: readonly string[]) => [PREVIEW_REFUSED, ...reasons.map((r) => `- ${r}`)].join('\n');

/** D3 (5): the sizes' row names. */
export const SIZE_LENGTH = 'Length';
export const SIZE_RADIUS = 'Radius, centre line';
export const SIZE_LABEL = 'Size';
export const SIZE_ENDS = 'Ends';
export const SIZE_TALLEST = 'Tallest part, from its floor';
export const START_END = 'start';
export const FAR_END = 'far end';
export const ON_FLOOR = 'on the floor';
/** "start: socket, ", before the end's height. */
export const endWords = (name: string, polarity: string) => `${name}: ${polarity}, `;
export const withMm = (figure: string) => `${figure} mm`;
export const RAISED = 'raised';
/** "socket and peg", "peg, socket and socket". */
export const listWords = (words: readonly string[]) =>
  words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;

/** D14: the 2D picture's label, its sizes in words. */
export function pictureLabel(name: string, size: string, ends: readonly string[], straights: number): string {
  const around = straights === 1 ? 'beside one medium straight' : 'between two medium straights';
  return `${name}, ${size}, ${listWords(ends)}, ${around}`;
}
export const lengthWords = (mm: string) => `${mm} mm long`;
export const radiusWords = (mm: string) => `radius ${mm} mm`;
export const sizeWords = (label: string) => `size ${label}`;

/** D7: one plain line when the piece's track matches a library piece's. */
export const duplicateLine = (code: string, name: string) => `Its track matches ${code} ${name}, already in the library. Is it the same piece?`;

/** D8: the next step is back in the chat; nothing here submits. */
export const NEXT_LOOKS_RIGHT = 'Looks like your piece? Tell your chat, and it gives you the issue to post.';
export const NEXT_WRONG = "Something's wrong? Tell your chat what.";

/** D9: the details for review, folded. */
export const DETAILS_SUMMARY = 'Details for review';
export const DETAILS_CHECKS = 'Checks it passed';
export const DETAILS_DATA = 'The piece as sent';
export const CHECK_FIELDS = 'Every field is one a piece can have, and every number is in range.';
export const CHECK_TEXT = 'Its names and notes are within their lengths and name no maker.';
export const CHECK_ID = 'Its id is new: no library piece has it.';
export const CHECK_UNVERIFIED = 'Its sizes are marked unverified, and its joint give estimated, until review.';
export const CHECK_ROADS = 'Every road ends on one of its ends, placed either way up.';
export const checkDerived = (code: string, name: string) => `Its decoration is built on ${code} ${name}, whose track it keeps.`;
export const CHECK_DECOR = "Its decoration's boxes were worked out from its shapes.";
/** D12: a paint the app has no colour for draws as wood, and says so here. */
export const unknownPaint = (token: string) => `Paint ${token} isn't one the app has yet; drawn as wood.`;

/** D13: turns the 3D view level and side-on. */
export const FROM_THE_SIDE = 'From the side';
/** The 3D view's label. */
export const sceneWords = (name: string) => `3D view of ${name} between medium straights.`;
