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
  /**
   * The refused bytes `loadGraph` copied aside (`brio.graph.v1.rejected`).
   *
   * It carries the ONE blob that is already known to have broken something,
   * and `ErrorBoundary`'s clear button deletes it. Before this field, the
   * sequence was: the loader refuses a damaged blob and rescues it, the save
   * effect later writes a sanitized graph over the live key, the app crashes,
   * the dump the user is told to send carries graph/chain/inventory/
   * submissions but NOT the rescue copy, and then the user clicks "delete my
   * track" and the only surviving copy of the bytes that broke is gone.
   * `storageKeys.ts` says the key "exists so a user who loses a layout has
   * something to send"; it now actually leaves with the dump.
   */
  readonly rescue: string | null;
  readonly inventory: string | null;
  readonly submissions: string | null;
  /** Build identifier, injected at build time. */
  readonly version: string;
  readonly userAgent: string;
  readonly error: { readonly name: string; readonly message: string };
}

/**
 * A stored blob emitted so the generated file RUNS even when the bytes do not
 * parse.
 *
 * `literal` emits `JSON.parse("...")` for unparseable bytes, which throws at
 * module top level and kills the whole program before a single line prints.
 * That is fine for a blob that parses and fatal for one that does not -- and
 * the crash screen tells the user to run this file, so a dump that cannot run
 * is worse than no dump.
 *
 * It bit the rescue key first and hardest, because `GRAPH_RESCUE_KEY` holds by
 * definition the bytes `loadGraph` REFUSED, and `JSON.parse` throwing is one
 * of the main reasons it refuses. MEASURED before this fix: a rescue blob of
 * `{"pieces":[ truncated` produced `SyntaxError: JSON Parse error: Unexpected
 * identifier "truncated"` at line 28 and printed nothing at all.
 *
 * The same latent bug sat on the graph, chain, inventory and submissions
 * blobs. A crash dump exists to carry exactly the data that broke something,
 * so every one of them gets the raw text plus a guarded parse. The raw string
 * is kept beside the parsed value, because when the parse fails the raw bytes
 * are the entire payload.
 */
function guardedBlob(name: string, raw: string | null): string {
  return `const ${name}Raw: string | null = ${JSON.stringify(raw)};
let ${name}: unknown = null;
try {
  ${name} = ${name}Raw === null ? null : JSON.parse(${name}Raw);
} catch (e) {
  console.log('${name}: stored bytes did not parse --', (e as Error).message);
  console.log('${name}: raw bytes follow', ${name}Raw);
}`;
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
  return `// ChooChooCAD crash repro
// Save as crash-repro.ts in the repo root, then: bun run crash-repro.ts
//
// version   ${oneLine(input.version)}
// browser   ${oneLine(input.userAgent)}
// error     ${oneLine(input.error.name)}: ${oneLine(input.error.message)}
//
// NOTE: the graph below is the layout the app had. \`closed\` is not part of it
// any more -- a loop is a weld between two free ends, not a flag -- so the
// legacy branch is only reached when no graph was stored.

import { BUILT_IN, resolveLibrary, makeResolver } from './engine/data/library.js';
import { solveGraph } from './engine/src/graph/solve.js';
import { portsOf } from './engine/src/graph/model.js';
import { solveLayout } from './engine/src/solver/result.js';
import { layoutTrust } from './engine/src/joints/trust.js';
import { brandFit } from './engine/data/thirdParty.js';

// The layout the app actually had when it crashed. Every blob below is parsed
// defensively: these are the bytes that broke something, so any of them may be
// unparseable, and this file has to RUN to be worth sending.
${guardedBlob('graph', input.graph)}

// The bytes a previous load REFUSED, if any. Usually the real culprit: the
// live graph above may be a sanitized rewrite of this.
${guardedBlob('rescued', input.rescue)}

${guardedBlob('submissions', input.submissions)}
${guardedBlob('chain', input.chain)}
${guardedBlob('inventory', input.inventory)}

// PRINTED FIRST, BEFORE ANYTHING CAN THROW. The guarded parses above stop an
// unparseable blob from killing this file, but a blob that PARSES into the
// wrong shape still throws: resolveLibrary on a submissions value of 7, or of
// a list of empty objects, does. Measured: that exited 1 having printed
// nothing, the same "printed nothing at all" failure the guards were added to
// end. The payload is these two lines, so they go out first.
console.log('inventory', inventory);
// The RAW bytes, deliberately. The parsed form is null whenever the parse
// failed, which is the case this key exists for, so the bytes are the
// payload. The guarded parse above already reports a failure separately.
console.log('refused bytes from an earlier load', rescuedRaw);
// And the parsed form when the bytes DID parse, which is the useful shape for
// reading a layout. It also keeps that local read: an unused one would trip
// noUnusedLocals in the editor of anyone who saves this file where the header
// above tells them to put it.
if (rescued !== null) console.log('refused layout, parsed', rescued);

// The submissions may parse and still be the wrong shape, and resolveLibrary
// dereferences each row. A bad row must not stop this file solving the graph:
// fall back to the built-in catalogue and say so.
let library = BUILT_IN as never;
try {
  library = resolveLibrary(
    (Array.isArray(submissions) ? submissions : []) as never,
  ) as never;
} catch (e) {
  console.log('submissions: could not be resolved --', (e as Error).message);
  console.log('submissions: falling back to the built-in catalogue');
}
const resolve = makeResolver(library as never);

if (graph) {
  // THE LAYOUT THE APP ACTUALLY HAD. anchors serialize as [id, frame] pairs.
  const g = {
    pieces: (graph as never as { pieces: unknown[] }).pieces,
    welds: (graph as never as { welds: unknown[] }).welds,
    anchors: new Map((graph as never as { anchors?: [string, unknown][] }).anchors ?? []),
  } as never;
  const ports = (piece: never) => portsOf(resolve((piece as { partId: string }).partId), (piece as { turn?: never }).turn);
  // Built once, for the same reason App.tsx builds it once: a scanning slop
  // callback makes the solve quadratic in pieces, and a repro script runs on
  // exactly the oversized layouts where that matters most.
  const slopById = new Map((g as { pieces: { pieceId: string; partId: string }[] }).pieces.map((x) => [x.pieceId, resolve(x.partId).slop.axialMm]));
  const slop = (pieceId: string) => slopById.get(pieceId) ?? 0;
  console.log('verdict', solveGraph(g, ports as never, resolve, slop));
  console.log('trust', layoutTrust({ placements: (g as { pieces: never[] }).pieces, closed: false } as never, resolve, brandFit));
} else if (Array.isArray(chain) && chain.length > 0) {
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
