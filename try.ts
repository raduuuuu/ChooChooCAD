// Scratch script: try any layout. Edit PIECES and re-run.
import { solveLayout } from './engine/src/solver/result.js';
import { evaluateJoint } from './engine/src/joints/evaluate.js';

// Piece ids: A2(54) A1(108) A(144) D(216) straights; E(r182) E1(r90) curves.
const PIECES = ['E','E','E','E','D','E','E','E','E','A'];

const r = solveLayout({
  placements: PIECES.map((partId) => ({ partId, turn: 'left' as const })),
  closed: true,
});

console.log(`\nlayout: ${PIECES.join(' ')}  (${PIECES.length} pieces)\n`);

if (!r.ok) {
  console.log(`  GREY  couldn't check this layout`);
  console.log(`        ${r.reason}: ${r.detail}`);
} else if (r.worstRatio <= 1) {
  const label = r.closesExactly ? 'closes exactly, no give needed' : `worst joint at ${(r.worstRatio*100).toFixed(0)}% of its give`;
  console.log(`  WORKS  ${label}`);
} else {
  console.log(`  WON'T FIT  ${r.gapMm.toFixed(1)}mm short; needs ${(r.worstRatio*100).toFixed(0)}% of the give available at the worst joint`);
}

if (r.ok) {
  console.log(`\n  nominal gap ${r.gapMm.toFixed(2)}mm -> ${r.remainingMm.toExponential(1)}mm after ${r.passes} passes\n`);
  for (const u of r.usage) {
    const e = evaluateJoint(u, r.joints[u.index]!, 'estimated');
    const glyph = { PASS:'O', TIGHT:'/\\', FAIL:'X', UNKNOWN:'?' }[e.verdict];
    console.log(`  joint ${String(u.index).padStart(2)}  ${glyph.padEnd(2)} ${e.verdict.padEnd(7)} ${(e.ratio*100).toFixed(0).padStart(4)}%  ${e.usedSlopMm.toFixed(2)}mm / ${e.usedSlopDeg.toFixed(2)}deg`);
  }
}
console.log('');
