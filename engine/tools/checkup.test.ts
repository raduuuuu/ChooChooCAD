/**
 * THE REPO CHECKUP (repo-checkups plan, C1, C6 to C8, O1 to O3, O6, R2).
 *
 * Value: protects=a brand word is found however it's written (`fooBar`,
 * `FOOBar`, `FOO_BAR`, `foo2`) and nowhere inside another word; an allowed
 * token passes while a new comment in the same file doesn't; private files,
 * unlisted images and located JPEGs are red and a located file is never named
 * in public; dead paths in the rules files are found; the tracking issue's
 * state counts a push from lastSeen, clears only on the owner's done comment
 * covering the newest big push, falls due after 30 days, and flags a stale
 * weekly run; GitHub findings never fail the run; issue writes only from main
 * Value: fails_when=the word split, the token mask, the location check, the
 * public text, the link resolution, any state rule or the exit codes change
 * Value: why_new=no repo-wide check existed (drift found by eye, 2026-11-08)
 * Value: seam=every check is a pure function over injected files, git answers
 * and GitHub JSON; the CLI around them is checked by one workflow_dispatch run
 * Value: no_claim=git, gh and GitHub's API themselves; the workflow's YAML is
 * pinned as text in checkupWorkflow.test.ts
 */

import { describe, expect, it } from 'vitest';
import {
  advance, checkBrands, CheckerError, checkGithub, checkImages, checkLinks, checkPrivate, exitCode, marker,
  mayWriteIssue, parseAllowlist, parseMarker, report, TERMS, type Allowlist, type Git, type IssueComment, type State,
} from './checkup.js';

const NONE: Allowlist = { allow: [], images: [] };
const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1);

describe('brand names', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): the split without its case-change
   * lookarounds (`/[^A-Za-z]+/`): `expected [ …(3) ] to deeply equal [ …(5) ]`
   * (`xFoo` and `XFoo` missed).
   */
  // By number: a title with the word in it would name a brand in every test log.
  it.each(TERMS.map((t, i) => [i + 1, t] as const))('finds term %i however it is written', (_, t) => {
    const lines = [`const ${t}Foo = 1;`, `const ${t.toUpperCase()}Foo = 1;`, `${t.toUpperCase()}_DOUG`, `${t}2`, `// made by ${cap(t)}`];
    const found = checkBrands([{ path: 'app/src/x.ts', text: lines.join('\n') }], NONE);
    expect(found.map((f) => f.text)).toEqual([1, 2, 3, 4, 5].map((n) => expect.stringContaining(`app/src/x.ts:${n}`)));
    expect(found.every((f) => f.red)).toBe(true);
    // Never the word itself in the finding: the report is public.
    expect(found.some((f) => f.text.toLowerCase().includes(t))).toBe(false);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): words matched as substrings
   * (`line.toLowerCase().includes(term)`): `expected [ { check: 'brand', red: true, …(1) } ] to deeply equal []`.
   */
  it('passes a word that merely contains one, and dated plans', () => {
    const inside = TERMS.map((t) => `x${t}y`).join(' ');
    expect(checkBrands([{ path: 'app/src/x.ts', text: `the shape of ${inside}` }], NONE)).toEqual([]);
    expect(checkBrands([{ path: 'docs/plan/2026-11-08-x.md', text: `${cap(TERMS[0]!)} track` }], NONE)).toEqual([]);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): a file with any allowed token passing
   * whole (`if (tokens.length > 0) rest = ''`): `expected [] to deeply equal [ Array(1) ]`.
   */
  it('passes an allowed token, and still finds a new comment in the same file', () => {
    const id = `'${TERMS[1]!.toUpperCase()}'`;
    const allow: Allowlist = { allow: [{ file: 'app/src/App.tsx', token: id, why: 'saved-layout id' }], images: [] };
    const text = [`type Shelf = ${id};`, `// ${cap(TERMS[1]!)} pieces go here (${id})`].join('\n');
    expect(checkBrands([{ path: 'app/src/App.tsx', text }], allow).map((f) => f.text)).toEqual([expect.stringContaining('app/src/App.tsx:2')]);
  });
});

describe('the allowlist file', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): allow entries not checked:
   * `expected [Function] to throw an error`.
   */
  it('is empty when missing, and a checker error naming the entry when malformed', () => {
    expect(parseAllowlist(null)).toEqual(NONE);
    expect(() => parseAllowlist('{')).toThrow(CheckerError);
    const bad = JSON.stringify({ allow: [{ file: 'a', token: 'b', why: 'c' }, { file: 'a', token: 'b' }], images: [] });
    expect(() => parseAllowlist(bad)).toThrow(/allow entry 2 needs a file, a token and a why/);
  });
});

// A JPEG whose XMP says where it was taken, and one that says nothing.
const seg = (marker_: number, body: number[]) => [0xff, marker_, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
const text = (s: string) => [...s].map((c) => c.charCodeAt(0));
const DATA = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0x12, 0x34, 0x56, 0xff, 0xd9];
const LOCATED = Uint8Array.from([0xff, 0xd8, ...seg(0xe1, [...text('http://ns.adobe.com/xap/1.0/\0'), ...text('<x:xmpmeta exif:GPSLatitude="51,30N"/>')]), ...DATA]);
const PLAIN = Uint8Array.from([0xff, 0xd8, ...DATA]);

describe('private files and images', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): CALIBRATION.md dropped from the private
   * list: `expected [ [ true, …(1) ] ] to deeply equal [ [ true, StringMatching{…} ], …(1) ]`.
   */
  it('finds photos and the private notes, never naming a photo in public', () => {
    const found = checkPrivate(['photos/issue-3/1.jpg', 'CALIBRATION.md', 'app/src/App.tsx']);
    expect(found.map((f) => [f.red, f.text])).toEqual([
      [true, expect.stringMatching(/^a file under `photos\/` is committed/)],
      [true, '`CALIBRATION.md` is committed; it is private'],
    ]);
    expect(found[0]!.text).not.toContain('issue-3');
    expect(found[0]!.local).toContain('photos/issue-3/1.jpg');
  });

  /*
   * MUTATION PROOFS, run (2026-11-09):
   * - listed JPEGs not checked for location: `expected [ Array(1) ] to deeply equal [ …(2) ]`.
   * - the located file named in public text (`${NEEDS_MAINTAINER}: ${p}`):
   *   `expected [ …(2) ] to deeply equal [ …(2) ]`, the exact public text.
   */
  it('passes listed images, finds the rest, and a located JPEG even when listed, without saying so in public', () => {
    const allow: Allowlist = { allow: [], images: [{ file: 'app/public/og.png', why: 'preview' }, { file: 'app/public/shot.jpg', why: 'a screenshot' }] };
    const bytes: Record<string, Uint8Array> = { 'app/public/shot.jpg': LOCATED, 'app/src/new.jpeg': PLAIN };
    const found = checkImages(['app/public/og.png', 'app/public/shot.jpg', 'app/src/new.jpeg', 'app/src/a.ts'], allow, (p) => bytes[p]!);
    expect(found.map((f) => f.text)).toEqual([
      'a committed image needs the maintainer: run `bun run checkup` locally',
      expect.stringMatching(/^`app\/src\/new\.jpeg` is an image or video not listed/),
    ]);
    for (const f of found) {
      expect(f.red).toBe(true);
      expect(f.text).not.toMatch(/location|where it was taken/i);
      expect(f.text).not.toContain('shot.jpg');
    }
    expect(found[0]!.local).toContain('app/public/shot.jpg');
  });

  it('reports a .jpg that is not a JPEG instead of failing the run', () => {
    expect(checkImages(['x.jpg'], NONE, () => Uint8Array.of(1, 2, 3)).map((f) => f.text)).toEqual(['`x.jpg` is named .jpg but isn\'t a JPEG']);
  });
});

describe('repo paths in the rules files', () => {
  const tracked = ['AGENTS.md', 'CLAUDE.md', 'engine/tools/photoCheck.ts', '.claude/skills/draw-piece/SKILL.md', 'app/photo-guide.html'];

  /*
   * MUTATION PROOF, run (2026-11-09): Markdown links resolved from the repo
   * root, not the file's folder: `expected [ …(2) ] to deeply equal [ StringMatching{…} ]`
   * (`../../../AGENTS.md` from the skill climbs out of the repo, so reads as dead).
   */
  it('finds a dead link or path, resolving links from the file and ignoring line numbers, patterns and other files', () => {
    const files = [
      { path: 'AGENTS.md', text: 'See [the check](engine/tools/photoCheck.ts) and `engine/tools/photoCheck.ts:12-30`.\nGone: [old](engine/tools/old.ts), `engine/tools/*.ts`, `photos/issue-<N>/`, `bun run test`.' },
      { path: '.claude/skills/draw-piece/SKILL.md', text: 'Rules: [AGENTS.md](../../../AGENTS.md), the [guide](https://example.com), [top](#top).' },
      { path: 'docs/notes.md', text: '[dead](nowhere.md)' },
    ];
    expect(checkLinks(files, tracked).map((f) => f.text)).toEqual([expect.stringMatching(/^`AGENTS\.md:2` points at `engine\/tools\/old\.ts`/)]);
  });
});

describe('GitHub state', () => {
  const now = new Date('2026-11-30T12:00:00Z');

  /*
   * MUTATION PROOF, run (2026-11-09): Dependabot's branches kept:
   * `expected [ …(4) ] to deeply equal [ …(4) ]` (2 merged branches, not 1).
   */
  it('reports merged and idle branches, old pull requests and waiting issues, and never fails the run', () => {
    const found = checkGithub({
      merged: ['old-fix', 'dependabot/bun/x'],
      unmerged: [{ name: 'idle', lastCommit: '2026-10-01T00:00:00Z' }, { name: 'busy', lastCommit: '2026-11-25T00:00:00Z' }],
      pulls: [{ number: 7, createdAt: '2026-11-10T00:00:00Z' }, { number: 9, createdAt: '2026-11-20T00:00:00Z' }],
      needsInfo: [{ number: 12, updatedAt: '2026-10-20T00:00:00Z' }, { number: 13, updatedAt: '2026-11-20T00:00:00Z' }],
    }, now);
    expect(found.map((f) => f.text)).toEqual([
      '1 merged branch not deleted: `old-fix`',
      'branch `idle` is unmerged with no commit for 60 days',
      'pull request #7 has been open 20 days',
      'issue #12 has waited on "piece: needs info" for 41 days',
    ]);
    expect(found.some((f) => f.red)).toBe(false);
    expect(exitCode({ findings: found })).toBe(0);
  });
});

// ── The tracking issue's state ──────────────────────────────────────────────

/** A straight history A → B → C → D, with how many files each step changed. */
const [A, B, C, D] = ['aaaaaaa', 'bbbbbbb', 'ccccccc', 'ddddddd'];
const ORDER = [A, B, C, D];
function fakeGit(filesPerStep: number, calls: [string, string][] = []): Git {
  return {
    changed(from, to) {
      calls.push([from, to]);
      return (ORDER.indexOf(to) - ORDER.indexOf(from)) * filesPerStep;
    },
    isAncestor: (x, y) => (!ORDER.includes(x) || !ORDER.includes(y) ? 'unknown' : ORDER.indexOf(x) <= ORDER.indexOf(y)),
  };
}
const NOW = new Date('2026-11-20T00:00:00Z');
const owner = (body: string, createdAt = '2026-11-19T00:00:00Z'): IssueComment => ({ body, association: 'OWNER', createdAt });
const base: State = { lastSeen: A, due: null, latestBig: null, lastDeep: '2026-11-15T00:00:00Z', lastScheduled: '2026-11-17T06:17:00Z' };
const step = (prev: State | null, head: string, git: Git, comments: IssueComment[] = [], scheduled = false, now = NOW) => advance(prev, { head, now, scheduled, git, comments });

describe('the hidden state', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): lastScheduled not required to be a
   * string or null: `expected { Object (lastSeen, due, ...) } to be null`.
   */
  it('reads back what it wrote, and anything else starts fresh', () => {
    expect(parseMarker(`report\n${marker(base)}\n`)).toEqual(base);
    expect(parseMarker('edited by hand')).toBeNull();
    expect(parseMarker('<!-- checkup-state {"lastSeen": "a", -->')).toBeNull();
    expect(parseMarker(`<!-- checkup-state ${JSON.stringify({ ...base, lastScheduled: 3 })} -->`)).toBeNull();
  });

  /*
   * MUTATION PROOF, run (2026-11-09): a fresh start not making a deep checkup
   * due (`due: null, latestBig: null`): `expected { Object (lastSeen, due, ...) }
   * to deeply equal { lastSeen: 'ccccccc', …(4) }`.
   */
  it('on a first run starts at HEAD with a deep checkup due', () => {
    const r = step(null, C, fakeGit(1));
    expect(r.state).toEqual({ lastSeen: C, due: C, latestBig: C, lastDeep: null, lastScheduled: null });
    expect(r.dueWhy).toEqual(['no deep checkup recorded yet']);
  });
});

describe('a big push', () => {
  /*
   * O1: GitHub replaced the run for b's push, so this run (at d) must count
   * from lastSeen (a), not from its own push.
   * MUTATION PROOF, run (2026-11-09): changes counted from HEAD, not lastSeen
   * (`changed(head, head)`): `expected [ [ 'ddddddd', 'ddddddd' ] ] to deeply
   * equal [ [ 'aaaaaaa', 'ddddddd' ] ]`.
   */
  it('is counted from lastSeen, so a replaced run loses nothing', () => {
    const calls: [string, string][] = [];
    const r = step(base, D, fakeGit(6, calls));
    expect(calls).toEqual([[A, D]]);
    expect(r.state).toMatchObject({ lastSeen: D, due: D, latestBig: D });
    expect(r.dueWhy).toEqual(['more than 15 files changed since `ddddddd`']);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): a second big push moving due:
   * `expected 'ccccccc' to be 'bbbbbbb'`.
   */
  it('keeps the older due on a second big push, and moves latestBig', () => {
    const first = step(base, B, fakeGit(16)).state;
    const second = step(first, C, fakeGit(16)).state;
    expect(second.due).toBe(B);
    expect(second.latestBig).toBe(C);
  });

  it('on rewritten history counts as big and is red', () => {
    const r = step({ ...base, lastSeen: 'gone' }, B, fakeGit(1));
    expect(r.state.due).toBe(B);
    expect(r.findings.filter((f) => f.red).map((f) => f.text)).toEqual([expect.stringMatching(/isn't in main's history any more/)]);
  });
});

describe('the owner clearing a due deep checkup', () => {
  const pending: State = { ...base, lastSeen: C, due: B, latestBig: C };

  /*
   * O2: an older checkup can't clear newer work.
   * MUTATION PROOF, run (2026-11-09): cleared when done covers `due` instead
   * of `latestBig`: `expected null to be 'bbbbbbb'`.
   */
  it('clears only when done covers the newest big push', () => {
    expect(step(pending, C, fakeGit(1), [owner(`/checkup done at ${B}`)]).state.due).toBe(B);
    const cleared = step(pending, C, fakeGit(1), [owner(`/checkup done at ${C}`)]);
    expect(cleared.state).toMatchObject({ due: null, latestBig: null, lastDeep: '2026-11-19T00:00:00Z' });
    expect(cleared.dueWhy).toEqual([]);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the OWNER association not required:
   * `expected null to be 'bbbbbbb'`.
   */
  it('ignores anyone but the owner, and reads the newest done comment', () => {
    const stranger = { ...owner(`/checkup done at ${C}`), association: 'CONTRIBUTOR' };
    expect(step(pending, C, fakeGit(1), [stranger]).state.due).toBe(B);
    const older = owner(`/checkup done at ${C}`, '2026-11-18T00:00:00Z'), newer = owner(`/checkup done at ${B}`, '2026-11-19T00:00:00Z');
    expect(step(pending, C, fakeGit(1), [older, newer]).state.due).toBe(B);
  });

  it('keeps due and reports a sha this clone does not know', () => {
    const r = step(pending, C, fakeGit(1), [owner('/checkup done at 0123abc')]);
    expect(r.state.due).toBe(B);
    expect(r.findings.filter((f) => f.red).map((f) => f.text)).toEqual([expect.stringMatching(/names a commit this clone doesn't know/)]);
  });
});

describe('time', () => {
  /*
   * C8. MUTATION PROOF, run (2026-11-09): the 30-day rule removed:
   * `expected [] to deeply equal [ Array(1) ]`.
   */
  it('makes a deep checkup due 30 days after the last one', () => {
    const r = step({ ...base, lastDeep: '2026-10-20T00:00:00Z' }, A, fakeGit(1));
    expect(r.dueWhy).toEqual(['the last deep checkup was 31 days ago']);
  });

  /*
   * R2. MUTATION PROOF, run (2026-11-09): a scheduled run not recording its
   * date: `expected '2026-11-17T06:17:00Z' to be '2026-11-20T00:00:00.000Z'`.
   */
  it('records each weekly run, and a push run reports a weekly run older than 10 days as red', () => {
    expect(step(base, B, fakeGit(1), [], true).state.lastScheduled).toBe(NOW.toISOString());
    const later = new Date('2026-11-28T12:00:00Z');
    expect(step(base, B, fakeGit(1), [], false, later).findings.filter((f) => f.red).map((f) => f.text))
      .toEqual(['the weekly run last ran 2026-11-17: GitHub may have disabled it (`gh workflow enable checkup.yml`)']);
  });
});

describe('the run', () => {
  /*
   * O6. MUTATION PROOF, run (2026-11-09): any ref allowed
   * (`ref !== undefined`): `expected true to be false`.
   */
  it('writes the issue only from main', () => {
    expect(mayWriteIssue('refs/heads/main')).toBe(true);
    expect(mayWriteIssue('refs/heads/checkup')).toBe(false);
    expect(mayWriteIssue(undefined)).toBe(false);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the checker error not winning over red
   * findings: `expected 1 to be 2`.
   */
  it('exits 2 on a checker error, 1 on a red finding, 0 on report-only findings', () => {
    const red = { check: 'brand' as const, red: true, text: 'x' }, note = { check: 'github' as const, red: false, text: 'y' };
    expect(exitCode({ findings: [red], error: 'git failed' })).toBe(2);
    expect(exitCode({ findings: [red, note] })).toBe(1);
    expect(exitCode({ findings: [note] })).toBe(0);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the local text used in public:
   * `expected '## Repo checkup, 2026-11-20\n\n**2 re…' not to contain 'photos/2.jpg'`.
   */
  it('reports located files by name only locally, and says once what several of them share', () => {
    const findings = checkImages(['a/1.jpg', 'photos/2.jpg'], NONE, () => LOCATED);
    const run = { date: NOW, findings, skipped: 0 };
    const pub = report(run, false);
    expect(pub).not.toContain('photos/2.jpg');
    expect(pub.match(/needs the maintainer/g)).toHaveLength(1);
    expect(report(run, true)).toContain('photos/2.jpg');
  });
});
