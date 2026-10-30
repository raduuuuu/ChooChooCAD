/**
 * One layout from the command line. Edit PIECES and run `bun try.ts`.
 *
 * Reports what the engine actually knows: whether the loop closes exactly, and
 * if not, whether the leftover gap could fit inside the joints' total give.
 * There is no per-joint ratio: decision R21 deleted the solver that produced
 * one, because it manufactured precision from tolerances the part data labels
 * `estimated`.
 */

import { getPart } from './engine/data/brio.js';
import { solveLayout } from './engine/src/solver/result.js';
import { evaluateLayout } from './engine/src/joints/evaluate.js';
import { computeResidual } from './engine/src/solver/residual.js';
import type { Layout, Turn } from './engine/src/parts/schema.js';

// ---- edit me -------------------------------------------------------------
const PIECES: Array<[string, Turn]> = Array(8).fill(0).map(() => ['E', 'left']);
const CLOSED = true;
// --------------------------------------------------------------------------

const layout: Layout = {
  placements: PIECES.map(([partId, turn]) => ({ partId, turn })),
  closed: CLOSED,
};

const res = computeResidual(layout, getPart);
console.log(`pieces            ${PIECES.length}  (${CLOSED ? 'closed' : 'open'})`);
console.log(`exact residual    [${res.exact.join(', ')}]`);
console.log(`closes exactly    ${res.closesExactly}`);
console.log(`gap               ${res.gapMm.toFixed(3)} mm`);
console.log(`heading mismatch  ${res.headingMismatchSteps} steps of 22.5 deg`);

const r = solveLayout(layout, getPart);
if (!r.ok) {
  console.log(`\nVERDICT           ${r.reason}: ${r.detail}`);
} else {
  const e = evaluateLayout(r, 'estimated');
  console.log(`bend              ${r.bend.status}, lambda ${r.bend.lambda?.toFixed(3) ?? '-'} across ${r.joints.length} joints`);
  console.log(`within the bound  ${r.withinBound}`);
  console.log(`\nVERDICT           ${e.verdict}`);
  for (const why of e.reasons) console.log(`                  - ${why}`);
}
