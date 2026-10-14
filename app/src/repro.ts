/**
 * The crash repro (task K5).
 *
 * When the app throws, the user sees a dead screen and we learn nothing. What
 * actually reproduces a geometry bug is the chain, the inventory and the
 * submitted parts that were in play, so the boundary prints exactly those, as
 * a runnable TypeScript file rather than as a bug-report form.
 *
 * WHY A RUNNABLE FILE AND NOT A JSON DUMP. The reader of this text is whoever
 * fixes the bug, and what they want is not data, it is a failing case they can
 * run. Saving this as `crash-repro.ts` at the repo root and running it
 * re-executes the same solve against the same library. A JSON blob makes them
 * write that harness themselves, every time.
 *
 * NOT `try.ts`. That name is taken by a committed tool that does the same job
 * for a hand-written layout, and telling a user to save over it would destroy
 * it. `crash-repro.ts` is gitignored instead.
 *
 * RAW STRINGS, NOT PARSED STATE. The inputs are the raw localStorage values,
 * not the app's parsed state, for two reasons. The crash may BE a parse bug,
 * in which case the parsed state is the thing that is wrong or missing. And
 * the boundary runs after App has already failed, so App's state may never
 * have existed. Raw text is the only thing guaranteed to survive the crash.
 *
 * PURE. No `window`, no `localStorage`, no React. The caller passes everything
 * in, which is what makes `repro.test.ts` able to check the output exactly.
 */

export interface ReproInput {
  /** Raw `localStorage` values, exactly as read. `null` when the key is absent. */
  /** The live layout (`brio.graph.v1`). The one blob that reproduces a geometry crash. */
  readonly graph: string | null;
  /** The retired pre-graph chain. Kept so an old blob is still sent, never the only one. */
  readonly chain: string | null;
  readonly inventory: string | null;
  readonly submissions: string | null;
  /** Build identifier, injected at build time. */
  readonly version: string;
  readonly userAgent: string;
  readonly error: { readonly name: string; readonly message: string };
}

/**
 * A stored value, made safe to paste into source.
 *
 * The value is attacker-influenced in the sense that matters here: the user
 * can type anything into the submission form, and a crash dump that pasted it
 * raw could close the string literal and turn the repro into something else
 * when run. Round-tripping through JSON.stringify makes it a literal and
 * nothing more. Unparseable text is emitted as a quoted string with a note,
 * never dropped, because a blob that will not parse is often the bug.
 */
function literal(raw: string | null, fallback: string): string {
  if (raw === null) return fallback;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return `JSON.parse(${JSON.stringify(raw)}) /* NOTE: this did not parse */`;
  }
}

/**
 * One line, no escapes. Everything interpolated into the header goes through it.
 *
 * The header is a run of `//` comments, and a `//` comment ends at a newline.
 * `error.message` is attacker-influenced: `loadGraph` accepts any string as a
 * `pieceId`, and `frames.ts` throws ``piece ${id} was never placed``, so a
 * stored id of `p1\nconsole.log(1)//` put live code on its own line in a file
 * the crash screen tells the user to run with `bun run crash-repro.ts`.
 * Reproduced before the fix. The payoff is on the maintainer's machine, outside
 * the browser sandbox, which is what makes it worse than an ordinary
 * same-origin bug rather than better.
 *
 * `literal()` below already protected the three stored blobs; it was the
 * human-readable header nobody treated as data.
 */
const oneLine = (s: string) => s.replace(/[\r\n\u2028\u2029]+/g, ' ').slice(0, 300);

export function reproText(input: ReproInput): string {
  return `// brio-designer crash repro
// Save as crash-repro.ts in the repo root, then: bun run crash-repro.ts
//
// version   ${oneLine(input.version)}
// browser   ${oneLine(input.userAgent)}
// error     ${oneLine(input.error.name)}: ${oneLine(input.error.message)}
//
// NOTE: the graph below is the layout the app had. \`closed\` is not part of it
// any more -- a loop is a weld between two free ends, not a flag -- so the
// legacy branch is only reached when no graph was stored.

import { resolveLibrary, makeResolver } from './engine/data/library.js';
import { solveGraph } from './engine/src/graph/solve.js';
import { portsOf } from './engine/src/graph/model.js';
import { solveLayout } from './engine/src/solver/result.js';
import { layoutTrust } from './engine/src/joints/trust.js';
import { brandFit } from './engine/data/thirdParty.js';

// The layout the app actually had when it crashed.
const graph = ${literal(input.graph, 'null')};

const submissions = ${literal(input.submissions, '[]')};
const chain = ${literal(input.chain, '[]')};
const inventory = ${literal(input.inventory, 'null')};

const library = resolveLibrary(submissions as never);
const resolve = makeResolver(library);

console.log('inventory', inventory);

if (graph) {
  // THE LAYOUT THE APP ACTUALLY HAD. anchors serialize as [id, frame] pairs.
  const g = {
    pieces: (graph as never as { pieces: unknown[] }).pieces,
    welds: (graph as never as { welds: unknown[] }).welds,
    anchors: new Map((graph as never as { anchors?: [string, unknown][] }).anchors ?? []),
  } as never;
  const ports = (piece: never) => portsOf(resolve((piece as { partId: string }).partId), (piece as { turn?: never }).turn);
  const slop = (pieceId: string) => {
    const piece = (g as { pieces: { pieceId: string; partId: string }[] }).pieces.find((x) => x.pieceId === pieceId);
    return piece ? resolve(piece.partId).slop.axialMm : 0;
  };
  console.log('verdict', solveGraph(g, ports as never, resolve, slop));
  console.log('trust', layoutTrust({ placements: (g as { pieces: never[] }).pieces, closed: false } as never, resolve, brandFit));
} else if ((chain as unknown[]).length > 0) {
  // No graph stored, but an old pre-graph chain was. Solve that instead of
  // nothing, through the engine it belongs to.
  const layout = { placements: chain as never, closed: true };
  console.log('verdict (legacy chain)', solveLayout(layout, resolve));
  console.log('trust (legacy chain)', layoutTrust(layout, resolve, brandFit));
} else {
  console.log('no layout was stored when this crashed');
}
`;
}
