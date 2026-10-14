import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUBMISSIONS_STORAGE_KEY } from '../../engine/data/library.js';
import { reproText, type ReproInput } from './repro.js';
import { CHAIN_STORAGE_KEY, INVENTORY_STORAGE_KEY } from './storageKeys.js';

const base: ReproInput = {
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

  it('carries the chain and the inventory', () => {
    const t = reproText(base);
    expect(t).toContain('"partId": "E"');
    expect(t).toContain('"E": 8');
  });

  it('absent keys become empty values, not the word null in the chain', () => {
    const t = reproText({ ...base, chain: null, inventory: null, submissions: null });
    expect(t).toContain('const chain = [];');
    expect(t).toContain('const inventory = null;');
    expect(t).toContain('const submissions = [];');
  });

  /*
   * A blob that will not parse is frequently the bug, so it must survive into
   * the repro rather than being dropped as unusable.
   */
  it('keeps a blob that does not parse, and says so', () => {
    const t = reproText({ ...base, chain: '{not json' });
    expect(t).toContain('this did not parse');
    expect(t).toContain('{not json');
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

  it('the three keys are distinct and namespaced', () => {
    const keys = [CHAIN_STORAGE_KEY, INVENTORY_STORAGE_KEY, SUBMISSIONS_STORAGE_KEY];
    expect(new Set(keys).size).toBe(3);
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

  it('exits clean and prints a verdict for the chain it carries', () => {
    writeFileSync(file, reproText({ ...base, chain: '[{"partId":"E","turn":"left"}]' }));
    try {
      const out = execFileSync('bun', ['run', file], {
        cwd: root,
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...process.env, NO_COLOR: '1' },
      });
      expect(out).toContain('verdict');
      expect(out).toContain('trust');
    } finally {
      rmSync(file, { force: true });
    }
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
