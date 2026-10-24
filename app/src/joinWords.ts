/**
 * WHY A JOIN WAS REFUSED, as the end of a sentence (`joinRefusal` in
 * layoutModel.ts). The announcement says the fix too; the canvas and the list
 * use the short form after "Can't join the selected end: ". One table, so the
 * three never disagree.
 */

import type { JoinRefusal } from './layoutModel.js';

export const JOIN_REFUSED: Readonly<Record<JoinRefusal, string>> = {
  pegs: 'both are pegs, and two pegs never join',
  levels: 'one is raised and the other is on the floor. Only a ramp joins the two levels',
};

export const JOIN_REFUSED_SHORT: Readonly<Record<JoinRefusal, string>> = {
  pegs: 'both are pegs',
  levels: 'it is on the other level',
};
