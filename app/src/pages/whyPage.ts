/**
 * WHY A LOOP WILL NOT CLOSE (`/why-a-loop-will-not-close/`; owner,
 * 2026-11-22). The one thing the app does that nothing else does is say why
 * a loop misses, and until this page that explanation was three paragraphs
 * repeated on every layout page.
 *
 *   three small loops ──▶ the same solver the app runs ──▶ its verdict, in its own words
 *        │                                                        │
 *        └── the drawing ─────────────────────────────────────────┴──▶ one section each
 *
 * NOTHING HERE IS WRITTEN BY HAND THAT THE ENGINE CAN SAY. Each example's
 * sentence is the verdict's own line, each gap is the solver's figure, and
 * each drawing is the track as the engine places it. If the model changes,
 * the page changes with it, and the test holds each example to the verdict
 * it is filed under.
 *
 * WHICH MAKES FIT TOGETHER is answered by trait only, never by a maker's
 * name (AGENTS.md), and only as far as the library's own notes go: no
 * shared standard, small differences between makers, one system with a
 * smaller peg. Every figure for those systems is unmeasured, and the page
 * says so.
 */

import type { Graph } from '../../../engine/src/graph/model.js';
import { presetGraph, verdictOf } from '../presetVerdict.js';
import type { VerdictKind } from '../verdictView.js';
import { draw } from './drawing.js';
import { esc, EXPLANATION, shell, SITE, SIZES_PATH } from './shell.js';

export const WHY_PATH = '/why-a-loop-will-not-close/';
/** When this page's words last changed, for the sitemap. Raise it when they do. */
export const WHY_CHANGED = '2026-11-24';
export const WHY_TITLE = 'Why won’t my wooden train track loop close? | ChooChooCAD';
const DESCRIPTION =
  'Why the two ends of a wooden toy-train track loop do not meet: three loops drawn and checked, what causes each, and what to change so it closes.';

const E = (n: number): string[] => Array<string>(n).fill('E');

export interface Example {
  readonly id: string;
  /** The verdict the example is here to show; the test holds the solver to it. */
  readonly kind: VerdictKind;
  readonly heading: string;
  readonly pieces: readonly string[];
  /** What it is made of, in words. */
  readonly made: string;
  /** Why the solver says what it says, and what to change. `{gap}` is the solver's own figure. */
  readonly why: string;
}

/**
 * The same oval three times, with one straight changed. The first is the
 * Stadium the app opens with; the second is its "Near miss".
 */
export const EXAMPLES: readonly Example[] = [
  {
    id: 'closes',
    kind: 'EXACT',
    heading: 'It closes exactly',
    pieces: [...E(4), 'D', ...E(4), 'D'],
    made: 'Eight large curves and two long straights.',
    why: 'Four curves make a half circle, so the two ends of each half face each other, and the two straights between them are the same length. The last end lands on the first with nothing to force.',
  },
  {
    id: 'bends',
    kind: 'NEEDS_GIVE',
    heading: 'It closes, but only by bending the joints',
    pieces: [...E(4), 'D', ...E(4), 'A'],
    made: 'The same loop with one long straight swapped for a medium one.',
    why: 'One side is now {gap} mm shorter than the other, so the ends no longer meet on paper. Wooden joints are loose enough that each can bend a little, and round a whole loop that is enough to pull these ends together. The track goes together, but tightly. To make it close exactly, make the two sides the same length again.',
  },
  {
    id: 'beyond',
    kind: 'EXCEEDS',
    heading: 'It asks more of the joints than anyone has tested',
    pieces: [...E(4), 'D', ...E(4), 'A2'],
    made: 'The same loop with one long straight swapped for a mini one.',
    why: 'Now one side is {gap} mm shorter. Closing it would need each joint to bend further than a built loop has been seen to bend. It may still go together; only building it will tell. The fix is the same: the two sides must be the same length.',
  },
];

export const exampleGraph = (e: Example): Graph => presetGraph({ label: e.id, pieces: e.pieces, note: '', expect: e.kind === 'EXACT' ? 'exact' : 'miss' });

function section(e: Example): string {
  const graph = exampleGraph(e);
  const verdict = verdictOf(graph);
  if (verdict.bend === null) throw new Error(`the ${e.id} example got no verdict line`);
  const drawn = draw(graph, e.heading).svg;
  return `<h2>${esc(e.heading)}</h2>
<div class="floor">${drawn}</div>
<p>${esc(e.made)}</p>
<p>The planner says: <strong>${esc(verdict.bend.line)}</strong></p>
<p>${esc(e.why.replace('{gap}', String(verdict.gapMm)))}</p>`;
}

export function whyHtml(): string {
  return shell(
    WHY_TITLE,
    DESCRIPTION,
    WHY_PATH,
    `<h1>Why won’t my wooden train track loop close?</h1>
<p>A loop closes when two things are true. The curves must turn the track through one full circle, and the lengths must bring the last end back to exactly where the first one is. Get the first wrong and the ends point past each other. Get the second wrong and they face each other with a gap between them, or overlap.</p>
<p>Here is the same oval three times, with one straight changed each time. Every drawing and every sentence in bold comes from the planner’s own check.</p>
${EXAMPLES.map(section).join('\n')}
<h2>The usual causes</h2>
<ul>
<li><strong>Two sides of different length.</strong> Whatever goes out along one side has to come back along the other. Count the straights on each side: the lengths must add up to the same.</li>
<li><strong>Curves that do not add up to a full circle.</strong> Eight large curves make a circle. A curve that bends the other way takes away what one curve added, so a loop with an S in it needs extra curves to get round.</li>
<li><strong>Two ends of the same kind.</strong> A peg needs a socket. Two pegs can never join. Two sockets can, with a small adapter that has a peg at both ends.</li>
<li><strong>Sizes that are not what the box says.</strong> A piece a few millimetres off its stated length is enough to open a gap. The planner marks every size nobody has measured, and <a href="${SIZES_PATH}">the size of every piece</a> is listed with its mark.</li>
</ul>
<h2>Mixing track from different makes</h2>
<p>There is no shared standard for wooden track. Makers work to roughly the same sizes, and each differs a little, so a loop that closes with one make can come out a few millimetres off with pieces from another. One system has a smaller peg and socket, and its pieces may not join the usual kind without forcing.</p>
<p>The planner keeps such systems apart and names them by what sets them apart, “Small-peg” and “Look-alike”, and it treats every size it holds for them as an estimate: nobody publishes those sizes.</p>
<h2>Check your own layout</h2>
<p>${esc(EXPLANATION[0]!)}</p>
<p><a class="open" href="/">Plan your own layout</a></p>
<p><a href="/layouts/">Layouts that close, with the pieces each takes</a></p>`,
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Why won’t my wooden train track loop close?',
      description: DESCRIPTION,
      url: `${SITE}${WHY_PATH}`,
      dateModified: WHY_CHANGED,
    },
  );
}
