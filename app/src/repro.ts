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

export function reproText(input: ReproInput): string {
  return `// brio-designer crash repro
// Save as crash-repro.ts in the repo root, then: bun run crash-repro.ts
//
// version   ${input.version}
// browser   ${input.userAgent}
// error     ${input.error.name}: ${input.error.message}
//
// NOTE: \`closed\` is not persisted (it is a view toggle), so it is set to the
// app's default of true here. If the crash needed an open chain, set it false.

import { resolveLibrary, makeResolver } from './engine/data/library.js';
import { solveLayout } from './engine/src/solver/result.js';
import { layoutTrust } from './engine/src/joints/trust.js';
import { brandFit } from './engine/data/thirdParty.js';

const submissions = ${literal(input.submissions, '[]')};
const chain = ${literal(input.chain, '[]')};
const inventory = ${literal(input.inventory, 'null')};

const library = resolveLibrary(submissions as never);
const resolve = makeResolver(library);
const layout = { placements: chain as never, closed: true };

console.log('inventory', inventory);
console.log('verdict', solveLayout(layout, resolve));
console.log('trust', layoutTrust(layout, resolve, brandFit));
`;
}
