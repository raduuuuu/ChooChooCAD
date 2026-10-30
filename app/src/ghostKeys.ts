/**
 * WHAT R AND F DO TO THE PIECE BEING PLACED, IN WORDS.
 *
 * "Rotate" and "Flip" alone did not say what would happen, and R does two
 * different things: at a track end it changes which end of the piece goes on,
 * on open floor it turns the piece a sixteenth. F turns the piece over: a curve
 * bends the other way, a switch branches to the other side, a ramp climbs
 * instead of coming down. The buttons, the pick announcement and the sentence
 * after a press all take their words from here, so they never disagree.
 *
 * Pure: the caller passes the graph, its ports and the pending piece.
 */

import type { PortsOf } from '../../engine/src/graph/frames.js';
import { levelOf, portsOf, type Graph } from '../../engine/src/graph/model.js';
import type { Part } from '../../engine/src/parts/schema.js';
import { endName } from './GraphListing.js';
import { fitOptions, hasFlip, rotateCycle, type PendingPiece } from './layoutModel.js';

/** One key's effect: a button label and the same thing as a verb phrase. */
export interface KeyWords {
  readonly label: string;
  readonly verb: string;
  /** False when pressing it would change nothing here. */
  readonly enabled: boolean;
}

const isRamp = (part: Part): boolean => part.kind === 'straight' && part.rise !== undefined;

/** A ramp at a track end climbs when it goes on by its low end. */
export function climbs(part: Part, ghost: PendingPiece): boolean {
  return levelOf(portsOf(part, ghost.turn)[ghost.port]!.at) === 0;
}

/**
 * R and F for the pending piece. `flip` is null for a part that has nothing
 * to turn over (a plain straight reads the same either way up).
 */
export function ghostKeys(
  graph: Graph,
  ports: PortsOf,
  ghost: PendingPiece,
  part: Part,
): { readonly rotate: KeyWords; readonly flip: KeyWords | null } {
  const options = ghost.at ? fitOptions(graph, ports, ghost.at, ghost.partId).options : null;
  const cycle = options ? rotateCycle(options, ghost.turn, hasFlip(part)).length : 0;

  const rotate: KeyWords =
    options === null
      ? { label: 'Turn 1/16', verb: 'turn it a sixteenth', enabled: true }
      // A piece with more than two ends always steps to its NEXT way: a
      // crossing's two ways at a peg end use the same end, so "other end"
      // would be wrong there.
      : (cycle > 2 || portsOf(part).length > 2)
        ? { label: 'Next end on', verb: 'put its next end on', enabled: cycle > 1 }
        : { label: 'Other end on', verb: 'put its other end on', enabled: cycle > 1 };

  const canFlip = options === null || options.some((o) => o.turn !== ghost.turn);
  let flip: KeyWords | null = null;
  if (part.kind === 'curve') flip = { label: 'Bend the other way', verb: 'bend it the other way', enabled: canFlip };
  // A multi-road piece says in its data what F does, or has no F (eng review D8).
  else if (part.kind === 'multi-road')
    flip = part.flip ? { label: part.flip.label, verb: part.flip.verb, enabled: canFlip } : null;
  else if (isRamp(part)) {
    flip =
      options === null
        ? { label: 'Turn over', verb: 'turn it over', enabled: canFlip }
        : climbs(part, ghost)
          ? { label: 'Turn over: come down', verb: 'turn it over to come down', enabled: canFlip }
          : { label: 'Turn over: climb', verb: 'turn it over to climb', enabled: canFlip };
  }
  return { rotate, flip };
}

/** The pick announcement's key list: only the keys that do something here. */
export function keyHelp(keys: ReturnType<typeof ghostKeys>): string {
  const said = [
    ...(keys.rotate.enabled ? [`R to ${keys.rotate.verb}`] : []),
    ...(keys.flip?.enabled ? [`F to ${keys.flip.verb}`] : []),
    'Enter to place',
    'Escape to cancel',
  ];
  return `Press ${said.slice(0, -1).join(', ')} or ${said[said.length - 1]}.`;
}

/** What a press of R or F left the piece doing, said after it. */
export function afterKey(kind: 'rotateGhost' | 'flipGhost', part: Part, ghost: PendingPiece): string {
  const ramp = isRamp(part) && ghost.at !== null ? (climbs(part, ghost) ? ' It climbs.' : ' It comes down.') : '';
  if (kind === 'rotateGhost') {
    if (ghost.at === null) return 'Turned it a sixteenth.';
    return `Now joins the track by its ${endName(part, ghost.port, ghost.turn)}.${ramp}`;
  }
  if (part.kind === 'curve') return 'Now bends the other way.';
  if (part.kind === 'multi-road') return part.flip?.after ?? 'It looks the same turned over.';
  if (part.kind === 'buffer') return 'A buffer stop looks the same turned over.';
  // F still reaches a plain straight from the keyboard; it reads the same either way up.
  if (!isRamp(part)) return 'A straight looks the same turned over.';
  return `Turned over.${ramp}`;
}
