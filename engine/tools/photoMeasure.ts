/**
 * `bun engine/tools/photoMeasure.ts <points.json>`: every figure in one photo,
 * from points read off its crops (plan 2026-11-02, P1 B, E2). Read-only.
 *
 * points.json is a `PhotoInput` (photo.ts): grid points with their paper
 * millimetres, the reference straight's two end centres, and each figure's
 * two end points, all in photo pixels. It lives beside the photo in the
 * ignored photos/ folder (SEC1).
 */

import { readFileSync } from 'node:fs';
import { measurePhoto, type PhotoInput } from './photo.js';

if (import.meta.main) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: bun engine/tools/photoMeasure.ts <points.json>');
    process.exit(2);
  }
  const r = measurePhoto(JSON.parse(readFileSync(file, 'utf8')) as PhotoInput);
  if (r.kind === 'refused') {
    console.log(`REFUSED: ${r.reason}`);
    process.exit(1);
  }
  console.log(`scale k = ${r.k.toFixed(4)}, grid agrees to ${r.gridResidualMm.toFixed(2)}mm`);
  for (const [name, mm] of Object.entries(r.figures)) console.log(`${name}: ${mm.toFixed(2)}mm`);
}
