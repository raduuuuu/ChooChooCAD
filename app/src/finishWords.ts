/**
 * WHAT FINISH-THE-LOOP SAYS (plan 2026-11-14, E3). One table of its
 * sentences, the way `linkWords.ts` keeps the link's, so every answer the
 * search can give has words and a test can read them.
 *
 * Two rules from the plan hold the wording: a search that did not finish
 * never says nothing fits, and no answer says "impossible". The search looks
 * at plain pieces on one level, up to a few at a time; what it did not look
 * at, it does not rule out.
 *
 * Types only from the search's module, so these words do not pull the search
 * into the editor's first load.
 */

import type { FillAnswer } from './finishLoop.js';

/** A gap's size as the verdict writes sizes: whole millimetres unless it is not whole. */
export const gapSize = (gapMm: number): string => `${+gapMm.toFixed(1)}mm`;

export const findLabel = (gapMm: number): string => `Find pieces that close the ${gapSize(gapMm)} gap`;

export const SEARCHING = 'Looking for pieces that close it exactly.';

/** The pieces of one fill, counted: "1 × Middle straight" or "2 × Large curve, 1 × Long straight". */
export function fillName(partIds: readonly string[], nameOf: (partId: string) => string): string {
  const counts = new Map<string, number>();
  for (const id of partIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => `${n} × ${nameOf(id)}`).join(', ');
}

export interface FinishWords {
  /** The sentence over the list, or the whole answer when there is no list. */
  readonly line: string;
  /** A second sentence about what was and was not tried, or null. */
  readonly note: string | null;
}

/**
 * The words for an answer. `boxed` is whether a box is declared: with one,
 * only spare pieces were tried; with none, every plain piece was.
 */
export function finishWords(answer: FillAnswer, maxPieces: number, boxed: boolean): FinishWords {
  const tried = boxed
    ? 'Only pieces your box has spare were tried.'
    : 'Every plain piece was tried, not only the ones you own.';
  switch (answer.status) {
    case 'found':
      return {
        line: answer.fills.length === 1 ? 'This closes it exactly:' : 'These close it exactly:',
        note: answer.complete ? tried : `${tried} The search stopped early, so there may be other ways.`,
      };
    case 'none':
      return {
        line: `No run of up to ${maxPieces} plain pieces closes this gap exactly.`,
        note: `${tried} Ramps, switches and decorated pieces were not.`,
      };
    case 'out of work':
      return {
        line: 'The search ran out of work before it finished.',
        note: 'Nothing is ruled out: it stopped looking, it did not find that nothing fits.',
      };
    case 'refused':
      return answer.why === 'levels'
        ? {
            line: 'These two ends are on different levels.',
            note: 'Joining them needs a ramp, and this does not look for ramps.',
          }
        : { line: 'These two ends cannot be filled between.', note: null };
  }
}
