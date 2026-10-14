import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUBMISSIONS_STORAGE_KEY } from '../../engine/data/library.js';
import { reproText, type ReproInput } from './repro.js';
import {
  CHAIN_STORAGE_KEY,
  GRAPH_RESCUE_KEY,
  GRAPH_STORAGE_KEY,
  INVENTORY_STORAGE_KEY,
} from './storageKeys.js';

const base: ReproInput = {
  graph: null,
  rescue: null,
  chain: '[{"partId":"E","turn":"left"}]',
  inventory: '{"E":8}',
  submissions: '[]',
  version: 'abc1234',
  userAgent: 'TestAgent/1.0',
  error: { name: 'TypeError', message: 'x is not a function' },
};

describe('reproText', () => {
  it('carries the version, the browser and the error', () => {
    const t = reproText(base);
    expect(t).toContain('abc1234');
    expect(t).toContain('TestAgent/1.0');
    expect(t).toContain('TypeError: x is not a function');
  });

  it('carries the chain and the inventory as raw bytes', () => {
    const t = reproText(base);
    expect(t).toContain('[{\\"partId\\":\\"E\\",\\"turn\\":\\"left\\"}]');
    expect(t).toContain('{\\"E\\":8}');
  });

  it('absent keys emit a null raw string, not the text of a default', () => {
    const t = reproText({ ...base, chain: null, inventory: null, submissions: null });
    for (const name of ['chain', 'inventory', 'submissions']) {
      expect(t).toContain(`const ${name}Raw: string | null = null;`);
    }
  });

  /*
   * A blob that will not parse is frequently the bug, so it must survive into
   * the repro rather than being dropped as unusable -- AND the file must still
   * run. See the runnable cases below, which is where the first version of
   * this failed.
   */
  it('keeps a blob that does not parse', () => {
    const t = reproText({ ...base, chain: '{not json' });
    expect(t).toContain('{not json');
    expect(t).toContain('const chainRaw: string | null =');
  });

  /*
   * THE INJECTION CASE. A user can type anything into the submission form, and
   * that text lands in localStorage and then in this file. If it were pasted
   * raw it could close the string literal and append statements that run when
   * the maintainer executes the repro. Everything goes through JSON.stringify.
   */
  it('a stored value cannot break out of its literal', () => {
    const hostile = '";\nprocess.exit(1);//';
    const t = reproText({ ...base, chain: hostile });
    expect(t).not.toContain('\nprocess.exit(1)');
    expect(t).toContain(JSON.stringify(hostile));
  });

  it('names every import it uses, so the file runs as written', () => {
    const t = reproText(base);
    for (const sym of ['resolveLibrary', 'makeResolver', 'solveLayout', 'layoutTrust', 'brandFit']) {
      expect(t.split('\n').filter((l) => l.startsWith('import')).join(' '), sym).toContain(sym);
    }
  });
});

/*
 * THE STRAY-LITERAL CHECK.
 *
 * The repro is only truthful if it reads the keys the app actually wrote.
 * Three modules write to localStorage, and each used to declare its key
 * inline. This fails if any localStorage call anywhere passes a string
 * literal: a fourth key added that way would be invisible to the repro, which
 * would then report an empty layout for a crash that happened with a full one.
 *
 * Scans source, not a list of files kept by hand, so a new module is covered
 * the moment it is written.
 */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') sourceFiles(p, out); }
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('storage keys have one owner each', () => {
  const root = join(import.meta.dirname, '..', '..');
  const files = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'engine'))];

  it('no localStorage call passes a string literal as its key', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/localStorage\s*\.\s*(getItem|setItem|removeItem)\s*\(\s*(['"`])/g)) {
        offenders.push(`${f.slice(root.length + 1)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /*
   * THE ONE PLACE A STORAGE-KEY LITERAL BELONGS.
   *
   * MUTATION PROOF, run: bump every key's version while keeping the `brio.`
   * prefix (`brio.graph.v1` -> `brio.graph.v2` and so on) and this is the only
   * test in the suite that fails. Before it existed, that rename passed all
   * 333 tests -- measured -- and silently orphaned every saved track, every
   * declared inventory and every hand-measured submission on every existing
   * install.
   *
   * `inventoryModel.test.ts` used to hold `'brio.inventory.v0'` as a literal.
   * This branch replaced it with the constant, for single ownership, and in
   * doing so converted the last real pin in the repo into a circular one: a
   * test that reads the constant it claims to pin cannot fail when the
   * constant changes. That is the defect class `storageKeys.ts`'s own docblock
   * names, and this project has now shipped it five times.
   *
   * A key rename is sometimes correct -- it is how you deliberately abandon an
   * old format. It must never be silent. Changing a value here is the cost of
   * doing it on purpose.
   */
  it('every storage key still has the exact value shipped installs look for', () => {
    expect({
      CHAIN_STORAGE_KEY,
      GRAPH_STORAGE_KEY,
      GRAPH_RESCUE_KEY,
      INVENTORY_STORAGE_KEY,
      SUBMISSIONS_STORAGE_KEY,
    }).toEqual({
      CHAIN_STORAGE_KEY: 'brio.chain.v0',
      GRAPH_STORAGE_KEY: 'brio.graph.v1',
      GRAPH_RESCUE_KEY: 'brio.graph.v1.rejected',
      INVENTORY_STORAGE_KEY: 'brio.inventory.v0',
      SUBMISSIONS_STORAGE_KEY: 'brio.library.submissions.v1',
    });
  });

  it('the keys are distinct, and all five are namespaced', () => {
    const keys = [
      CHAIN_STORAGE_KEY,
      GRAPH_STORAGE_KEY,
      GRAPH_RESCUE_KEY,
      INVENTORY_STORAGE_KEY,
      SUBMISSIONS_STORAGE_KEY,
    ];
    expect(new Set(keys).size).toBe(5);
    for (const k of keys) expect(k).toMatch(/^brio\./);
  });
});

/*
 * THE REPRO ACTUALLY RUNS.
 *
 * The crash screen tells the user "save it as crash-repro.ts and run it".
 * That sentence is a promise about four import paths and five exported names
 * in other modules, none of which this file controls. Move
 * `solver/result.ts`, rename `layoutTrust`, change `makeResolver`'s shape, and
 * the crash screen keeps printing a file that throws on line one. Nothing else
 * in the suite would notice, because the repro is a STRING here and a program
 * only once a human pastes it.
 *
 * So the test pastes it. It writes the generated text to the repo root, where
 * its relative imports resolve, runs it, and asserts it exits 0 and prints the
 * verdict. Slower than the rest of the suite and worth it: this is the only
 * check that the product's on-screen claim is true.
 */
describe('the generated repro runs', () => {
  const root = join(import.meta.dirname, '..', '..');
  const file = join(root, '.repro-check.ts');

  const run = (input: Parameters<typeof reproText>[0]) => {
    writeFileSync(file, reproText(input));
    try {
      const raw = execFileSync('bun', ['run', file], {
        cwd: root,
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...process.env, NO_COLOR: '1' },
      });
      // bun's inspector colours object keys even under NO_COLOR, so a plain
      // `key: value` assertion would never match. Strip the escapes.
      // eslint-disable-next-line no-control-regex
      return raw.replace(/\u001b\[[0-9;]*m/g, '');
    } finally {
      rmSync(file, { force: true });
    }
  };

  it('exits clean and prints a verdict for the legacy chain it carries', () => {
    const out = run({ ...base, chain: '[{"partId":"E","turn":"left"}]' });
    expect(out).toContain('verdict');
    expect(out).toContain('trust');
  });

  /*
   * AN UNPARSEABLE BLOB MUST NOT KILL THE FILE, and this is the case that
   * shipped broken.
   *
   * `literal()` emitted `JSON.parse("...")` at module top level for bytes that
   * do not parse. MEASURED before the fix: a rescue blob of
   * `{"pieces":[ truncated` produced `SyntaxError: JSON Parse error: Unexpected
   * identifier "truncated"` on line 28 and the program printed NOTHING. The
   * crash screen tells the user to run this file, so a dump that cannot run is
   * worse than a dump missing a field.
   *
   * The rescue key is the worst case and the reason it was found: it holds by
   * definition the bytes `loadGraph` REFUSED, and a JSON.parse failure is one
   * of the main reasons it refuses. So the field added to make the dump useful
   * made it unrunnable in exactly the case it was added for.
   *
   * MUTATION PROOF, run: put any blob back through a bare
   * `JSON.parse(<literal>)` at top level and the matching case here fails with
   * a non-zero exit.
   */
  for (const key of ['graph', 'rescue', 'chain', 'inventory', 'submissions'] as const) {
    it(`still runs when the ${key} blob does not parse`, () => {
      /*
       * A VALID graph AND a valid chain, so whichever one is not the broken
       * blob still produces a verdict. Without that the chain case fails for
       * the wrong reason -- nothing left to solve -- which this test caught
       * about itself on the first run.
       */
      const out = run({
        ...base,
        graph: '{"pieces":[{"pieceId":"p0","partId":"E","turn":"left"}],"welds":[],"anchors":[]}',
        chain: '[{"partId":"E","turn":"left"}]',
        [key]: '{"pieces":[ truncated',
      });
      // It ran to the end rather than dying at the top.
      expect(out).toContain('verdict');
      // And it said which blob was broken, with the bytes.
      expect(out).toContain('stored bytes did not parse');
      expect(out).toContain('truncated');
    });
  }

  /*
   * A BLOB THAT PARSES INTO THE WRONG SHAPE still has to let the file print.
   * The guarded parses only catch a throw FROM JSON.parse; `resolveLibrary`
   * on a submissions value of `7` threw afterwards, and the file exited 1
   * having printed nothing -- the same failure, one line later.
   *
   * MUTATION PROOF, run: move the two console.log lines back below
   * `resolveLibrary` and drop its try/catch -- 5 tests fail, all five cases
   * here.
   */
  for (const submissions of ['7', '"abc"', '{}', '[null]', '[{}]']) {
    it(`prints the payload even when submissions parses to ${submissions}`, () => {
      const out = run({
        ...base,
        graph: '{"pieces":[{"pieceId":"p0","partId":"E","turn":"left"}],"welds":[],"anchors":[]}',
        chain: '[{"partId":"E","turn":"left"}]',
        submissions,
      });
      expect(out).toContain('inventory');
      expect(out).toContain('refused bytes from an earlier load');
    });
  }

  /*
   * The rescue bytes actually leave with the dump. Before this, every fixture
   * in this file passed `rescue: null`, so the field's VALUE was never
   * exercised and the bug above shipped green.
   */
  it('prints the refused bytes when they are present and valid', () => {
    const out = run({
      ...base,
      chain: '[{"partId":"E","turn":"left"}]',
      rescue: '{"pieces":[{"pieceId":"ghost","partId":"E"}],"welds":[],"anchors":[]}',
    });
    expect(out).toContain('refused bytes from an earlier load');
    expect(out).toContain('ghost');
  });

  /*
   * THE GRAPH IS SOLVED, NOT JUST PRINTED.
   *
   * The first version of this fix carried the graph into the generated file and
   * then solved the retired chain anyway, so `const graph` was declared and
   * never read: the repro printed the data and reproduced nothing. Caught by
   * re-reviewing the fix rather than by the fix itself.
   *
   * Eight large curves welded into a circle, which closes exactly. Asserting
   * the VERDICT rather than the presence of the word is what makes this bite:
   * a repro that solves an empty chain cannot print closesExactly true.
   */
  it('solves the GRAPH it carries, not an empty chain', () => {
    const pieces = Array.from({ length: 8 }, (_, i) => ({
      pieceId: `p${i}`,
      partId: 'E',
      turn: 'left',
    }));
    const welds = Array.from({ length: 8 }, (_, i) => ({
      a: { pieceId: `p${i}`, port: 1 },
      b: { pieceId: `p${(i + 1) % 8}`, port: 0 },
    }));
    const out = run({
      ...base,
      graph: JSON.stringify({ pieces, welds, anchors: [] }),
      chain: null,
    });
    expect(out).toContain('verdict');
    /*
     * `closesExactly: true` ALONE IS VACUOUS and the mutation proved it: an
     * empty chain also reports ok true / closesExactly true, so that assertion
     * passed whether the repro solved the real graph or nothing at all. The
     * discriminators are the graph engine's own fields -- `rank` counts the
     * independent loops and the chain engine never emits it -- and a give total
     * that only eight real joints produce.
     */
    expect(out).toContain('rank: 1');
    expect(out).toMatch(/totalGiveMm: 6\.[0-9]/);
    expect(out).toContain('closesExactly: true');
    expect(out).not.toContain('no layout was stored');
  });

  it('says so plainly when nothing was stored, rather than solving an empty chain', () => {
    const out = run({ ...base, graph: null, chain: null });
    expect(out).toContain('no layout was stored');
  });
});

/**
 * The generated file's HEADER is data too.
 *
 * Value: protects=every line of the repro header stays a `//` comment, so a
 * stored value cannot become executable code in a file the crash screen tells
 * the user to run
 * Value: fails_when=an interpolated header field stops being passed through
 * oneLine(), or a new raw ${...} is added to the header
 * Value: why_new=the existing "cannot break out of its literal" test covers
 * only literal()'s three blobs; the human-readable header was never treated as
 * untrusted, and its green masked the gap
 * Value: seam=none
 * Value: no_claim=nothing about what the generated program then does when run,
 * and nothing about the blobs themselves, which literal() already owns
 *
 * REPRODUCED BEFORE THE FIX. A stored pieceId of `p1\nconsole.log(...)//`
 * survives loadGraph verbatim, reaches frames.ts's `piece ${id} was never
 * placed` throw, and landed on its own line in crash-repro.ts.
 */
describe('the repro header cannot be escaped', () => {
  const base = {
    graph: null,
    rescue: null,
    chain: null,
    inventory: null,
    submissions: null,
    version: 'abc123',
    userAgent: 'UA',
    error: { name: 'Error', message: 'boom' },
  };

  it('a newline in the error message does not start a new line of code', () => {
    const t = reproText({
      ...base,
      error: { name: 'Error', message: 'piece p1\nconsole.log("PWNED")//' },
    });
    const header = t.slice(0, t.indexOf('\nimport '));
    for (const l of header.split('\n')) {
      expect(l === '' || l.startsWith('//'), `escaped the comment: ${l}`).toBe(true);
    }
    expect(t).not.toContain('\nconsole.log("PWNED")');
  });

  it('every interpolated header field is sanitised, not just the message', () => {
    for (const field of ['version', 'userAgent'] as const) {
      const t = reproText({ ...base, [field]: 'x\nprocess.exit(1)' });
      const header = t.slice(0, t.indexOf('\nimport '));
      for (const l of header.split('\n')) {
        expect(l === '' || l.startsWith('//'), `${field} escaped: ${l}`).toBe(true);
      }
    }
    const named = reproText({ ...base, error: { name: 'E\nprocess.exit(1)', message: 'm' } });
    const header = named.slice(0, named.indexOf('\nimport '));
    for (const l of header.split('\n')) expect(l === '' || l.startsWith('//')).toBe(true);
  });

  it('carriage returns and the unicode line separators are covered too', () => {
    for (const nl of ['\r', '\u2028', '\u2029']) {
      const t = reproText({ ...base, error: { name: 'Error', message: `a${nl}process.exit(1)` } });
      const header = t.slice(0, t.indexOf('\nimport '));
      for (const l of header.split(/[\n\r\u2028\u2029]/)) {
        expect(l === '' || l.startsWith('//'), `${JSON.stringify(nl)} escaped: ${l}`).toBe(true);
      }
    }
  });

  it('a long message is truncated rather than filling the file', () => {
    const t = reproText({ ...base, error: { name: 'Error', message: 'x'.repeat(5000) } });
    expect(t.slice(0, t.indexOf('\nimport ')).length).toBeLessThan(1000);
  });
});

/**
 * The crash-recovery path must know about every key the app writes.
 *
 * Value: protects=the crash screen's clear list and the repro both cover every
 * storage key this app owns, so a new key cannot be added without landing here
 * Value: fails_when=a key is exported from storageKeys.ts (or library.ts) and
 * ErrorBoundary's clear list or the repro does not name it
 * Value: why_new=the clear list was wrong for the whole life of the graph
 * rewrite and nothing noticed: it cleared the retired chain key and left the
 * live one, so "delete my track" did not delete the track
 * Value: seam=none, this reads the source text rather than rendering the
 * component, because the component needs a DOM and this suite has none
 * Value: no_claim=nothing about the button actually being clickable or about
 * what the browser does on reload; that is E11 territory
 */
describe('the crash screen knows every key the app writes', () => {
  const source = readFileSync(join(import.meta.dirname, 'ErrorBoundary.tsx'), 'utf8');

  it('names every storage key in its clear list', () => {
    const clearBlock = source.slice(
      source.indexOf('private clearAndReload'),
      source.indexOf('location.reload'),
    );
    const owned = [
      'GRAPH_STORAGE_KEY',
      'GRAPH_RESCUE_KEY',
      'CHAIN_STORAGE_KEY',
      'INVENTORY_STORAGE_KEY',
      'SUBMISSIONS_STORAGE_KEY',
    ];
    const missing = owned.filter((name) => !clearBlock.includes(name));
    expect(missing, `the clear list does not name: ${missing.join(', ')}`).toEqual([]);
  });

  it('clears the LIVE layout key, not only the retired one', () => {
    const clearBlock = source.slice(
      source.indexOf('private clearAndReload'),
      source.indexOf('location.reload'),
    );
    // The specific regression: CHAIN was cleared and GRAPH was not.
    expect(clearBlock).toContain('GRAPH_STORAGE_KEY');
  });

  /*
   * SYMMETRIC, and it was not. This describe's stated value is that the clear
   * list AND the repro both cover every key, but only the clear list was
   * enforced by name while the repro side asserted the single `graph` line.
   * GRAPH_RESCUE_KEY was therefore required to be DELETED and not required to
   * be sent, so the test actively blessed the delete-without-sending path that
   * finding R4 found. Every owned key must now appear on both sides.
   *
   * MUTATION PROOF, run: delete the `rescue: read(GRAPH_RESCUE_KEY)` line from
   * ErrorBoundary and this fails; before the change it passed.
   */
  it('sends every key it is willing to delete', () => {
    const owned = [
      'GRAPH_STORAGE_KEY',
      'GRAPH_RESCUE_KEY',
      'CHAIN_STORAGE_KEY',
      'INVENTORY_STORAGE_KEY',
      'SUBMISSIONS_STORAGE_KEY',
    ];
    const unsent = owned.filter((name) => !source.includes(`read(${name})`));
    expect(unsent, `the repro does not send: ${unsent.join(', ')}`).toEqual([]);
  });

  it('sends the live layout in the repro, not only the retired chain', () => {
    expect(source).toContain('graph: read(GRAPH_STORAGE_KEY)');
  });
});

describe('the repro carries the layout the app actually saved', () => {
  it('emits the graph blob rather than reporting an empty layout', () => {
    const t = reproText({
      graph: '{"pieces":[{"pieceId":"p0","partId":"E","turn":"left"}],"welds":[],"anchors":[]}',
      rescue: null,
      chain: null,
      inventory: null,
      submissions: null,
      version: 'abc123',
      userAgent: 'UA',
      error: { name: 'Error', message: 'boom' },
    });
    expect(t).toContain('const graphRaw: string | null =');
    expect(t).toContain('\\"partId\\":\\"E\\"');
  });

  it('a missing graph emits null rather than a silent empty default', () => {
    const t = reproText({
      graph: null,
      rescue: null,
      chain: null,
      inventory: null,
      submissions: null,
      version: 'abc123',
      userAgent: 'UA',
      error: { name: 'Error', message: 'boom' },
    });
    expect(t).toContain('const graphRaw: string | null = null;');
  });
});
