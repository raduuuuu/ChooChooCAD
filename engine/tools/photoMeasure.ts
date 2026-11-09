/**
 * `bun engine/tools/photoMeasure.ts <points.json> [--auto <photo>]`: every
 * figure in one photo (plan 2026-11-02, P1 B, E2). Read-only.
 *
 * points.json is a `PhotoInput` (photo.ts): grid points with their paper
 * millimetres, the reference straight's two end centres, and each figure's
 * two end points, all in photo pixels. It lives beside the photo in the
 * ignored photos/ folder (SEC1).
 *
 * With --auto, the grid points in points.json are only seeds: the script
 * finds every 10mm crossing in `paper` (default 0..180 by 0..280mm, step 10)
 * and fits perspective plus lens bowing (photoGrid.ts).
 */

import { readFileSync } from 'node:fs';
import { measurePhoto, scaleAndMeasure, type PhotoInput, type PhotoResult, type Pt } from './photo.js';
import { refineEnd, straddlesCentre } from './photoEdges.js';
import { findGrid, pixelToPaper } from './photoGrid.js';
import { loadUpright, PhotoError, type RgbImage } from './photoImage.js';

type Input = PhotoInput & { readonly paper?: { readonly cols: readonly [number, number]; readonly rows: readonly [number, number] } };

const steps = ([lo, hi]: readonly [number, number]) => Array.from({ length: Math.floor((hi - lo) / 10) + 1 }, (_, i) => lo + 10 * i);

function report(r: PhotoResult): void {
  if (r.kind === 'refused') {
    console.log(`REFUSED: ${r.reason}`);
    process.exit(1);
  }
  console.log(`scale k = ${r.k.toFixed(4)}, grid agrees to ${r.gridResidualMm.toFixed(2)}mm`);
  for (const [name, mm] of Object.entries(r.figures)) console.log(`${name}: ${mm.toFixed(2)}mm`);
}

if (import.meta.main) {
  const [file, flag, photo] = process.argv.slice(2);
  if (!file || (flag !== undefined && (flag !== '--auto' || !photo))) {
    console.error('usage: bun engine/tools/photoMeasure.ts <points.json> [--auto <photo>]');
    process.exit(2);
  }
  const input = JSON.parse(readFileSync(file, 'utf8')) as Input;
  if (flag !== '--auto') report(measurePhoto(input));
  else {
    // Upright, as the crop reads it (photoCrop.ts), so a point picked off a crop means the same pixel here.
    let img: RgbImage;
    try {
      img = loadUpright(photo!);
    } catch (e) {
      if (!(e instanceof PhotoError)) throw e;
      console.error(`REFUSED ${e.code}: ${e.message}\n${e.fix}`);
      process.exit(1);
    }
    const paper = input.paper ?? { cols: [0, 180] as const, rows: [0, 280] as const };
    const g = findGrid(img, input.grid, { cols: steps(paper.cols), rows: steps(paper.rows) });
    console.log(`grid: ${g.points.length} of ${g.tried} crossings, rms ${g.rmsMm.toFixed(3)}mm, worst ${g.maxMm.toFixed(3)}mm, lens k1 ${g.map.k1.toFixed(4)}`);
    // Each end refined from its hand-read seed; a piece not across the middle may show an end face.
    const refine = (name: string, [a, b]: readonly [Pt, Pt]): [Pt, Pt] => {
      if (!straddlesCentre(img, a, b)) {
        console.log(`REFUSED: the ${name} does not cross the middle of the photo, so one end shows its end face and reads long. Lay every piece across the middle and retake.`);
        process.exit(1);
      }
      const ra = refineEnd(img, g.map, a, b), rb = refineEnd(img, g.map, b, a);
      for (const [end, r] of [['first', ra], ['second', rb]] as const) {
        console.log(`  ${name} ${end} end: ${r ? `${r.samples} edge samples, spread ${r.spreadMm.toFixed(3)}mm` : 'NOT FOUND, hand reading kept'}`);
      }
      return [ra?.px ?? a, rb?.px ?? b];
    };
    const reference = refine('reference', input.reference);
    const figures = Object.fromEntries(Object.entries(input.figures).map(([n, ends]) => [n, refine(n, ends)]));
    report(scaleAndMeasure((p) => pixelToPaper(g.map, p), g.rmsMm, { reference, figures }));
  }
}
