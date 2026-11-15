/**
 * THE STRIPS' WORDS, FOR THE HAND BEING USED (plan 2026-11-14, design DD8;
 * docs/plan/2026-11-14-additions-eng.md).
 *
 * The strips named keys ("Cancel (Esc)", "Place (Enter)", "R to turn") and
 * said "Click". A phone or a tablet has no Esc and nothing to click, so on a
 * touch screen the same sentences and buttons say only what they do. A mouse
 * or a keyboard keeps the wording with its keys: there the key is the fast
 * way and the label is where it is learned.
 *
 * One list with both wordings, as `selectHint.ts` has for its one sentence,
 * so no strip can be given a key name on touch by being written in place.
 * All of it is copy, so copyPosition.test.ts reads it too.
 */

/** The query that says a finger is the main pointer. The stylesheet's 44px targets use the same one. */
export const TOUCH_QUERY = '(pointer: coarse)';

export interface StripWords {
  /** A button's label: with its key for a keyboard, bare for touch. */
  readonly button: (label: string, key: string) => string;
  /** The joining strip, before any end is chosen. */
  readonly joinFirst: string;
  /** The joining strip once one end is chosen; `from` names that end. */
  readonly joinNext: (from: string) => string;
  /** A pier just put down: how to move it. */
  readonly pierPlaced: (name: string) => string;
  /** What the verdict says to do with a layout that is not a loop yet. */
  readonly joinTwoEnds: string;
  /** Read out when a piece is picked: `keys` is the list of what each key does, for a keyboard only. */
  readonly picked: (name: string, keys: string) => string;
  /** Read out when a dropped piece does not fit and stays pending. */
  readonly dropRefused: string;
}

const KEYS: StripWords = {
  button: (label, key) => `${label} (${key})`,
  joinFirst: 'Joining two ends. Click the first free end.',
  joinNext: (from) => `Joining from ${from}. Click another free end to join it.`,
  pierPlaced: (name) => `${name} placed. Move it with the arrows, R to turn, or drag it.`,
  joinTwoEnds: 'Click the two free ends you want joined.',
  picked: (name, keys) => `Placing ${name}. ${keys}`,
  dropRefused: "Didn't place it: it doesn't fit there. Enter places it anyway, Escape cancels.",
};

const TOUCH: StripWords = {
  button: (label) => label,
  joinFirst: 'Joining two ends. Tap the first free end.',
  joinNext: (from) => `Joining from ${from}. Tap another free end to join it.`,
  pierPlaced: (name) => `${name} placed. Move it with the arrow buttons, Rotate run to turn, or drag it.`,
  joinTwoEnds: 'Tap the two free ends you want joined.',
  picked: (name) => `Placing ${name}.`,
  dropRefused: "Didn't place it: it doesn't fit there. Place puts it down anyway, Cancel stops.",
};

export const stripWords = (touch: boolean): StripWords => (touch ? TOUCH : KEYS);
