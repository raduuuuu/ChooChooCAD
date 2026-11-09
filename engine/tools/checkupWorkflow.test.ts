/**
 * THE CHECKUP WORKFLOWS, READ AS TEXT (repo-checkups plan, eng pass 7; C6, O1, O6, D2).
 *
 * Value: protects=checkup.yml asks for exactly contents read, issues write and
 * pull-requests read; runs one at a time without cancelling; writes the issue
 * only from main; reads no secret and never runs on pull_request_target;
 * fetches all history; and ci.yml's step runs the content checks alone, with
 * no token, under ci.yml's read-only permissions
 * Value: fails_when=a permission, the concurrency group, the main-only guard,
 * the fetch depth or the C6 step's scope changes
 * Value: why_new=the YAML had no test (eng pass); there is no Actions runner
 * here, so the text is the contract, as CLAUDE.md does for CSS
 * Value: seam=the files read as text, comments stripped
 * Value: no_claim=GitHub running it; one workflow_dispatch on main does
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** A workflow's lines, comments and blank lines dropped. */
const lines = (file: string) => readFileSync(new URL(`../../.github/workflows/${file}`, import.meta.url), 'utf8')
  .split('\n').map((l) => l.replace(/\s+#.*$/, '').replace(/^\s*#.*$/, '')).filter((l) => l.trim() !== '');

/** A top-level key's block: its line and the indented lines under it. */
function block(ls: readonly string[], key: string): string[] {
  const at = ls.findIndex((l) => l === `${key}:` || l.startsWith(`${key}: `));
  if (at < 0) return [];
  const out = [ls[at]!];
  for (const l of ls.slice(at + 1)) {
    if (!l.startsWith(' ')) break;
    out.push(l.trim());
  }
  return out;
}

/** Each step as its lines, trimmed. */
function steps(ls: readonly string[]): string[][] {
  const out: string[][] = [];
  for (const l of ls.slice(ls.findIndex((q) => q.trim() === 'steps:') + 1)) {
    if (l.trimStart().startsWith('- ')) out.push([l.trim().slice(2)]);
    else out.at(-1)?.push(l.trim());
  }
  return out;
}

const checkup = lines('checkup.yml'), ci = lines('ci.yml');

describe('checkup.yml', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): `actions: write` added under
   * permissions: `expected [ 'permissions:', …(4) ] to deeply equal [ 'permissions:', …(3) ]`.
   */
  it('asks for exactly what it uses, once', () => {
    expect(block(checkup, 'permissions')).toEqual(['permissions:', 'contents: read', 'issues: write', 'pull-requests: read']);
    expect(checkup.filter((l) => l.trim().startsWith('permissions:'))).toHaveLength(1);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): cancel-in-progress true: `expected
   * [ 'concurrency:', …(2) ] to deeply equal [ 'concurrency:', …(2) ]`.
   */
  it('runs one at a time and never cancels a run mid-write', () => {
    expect(block(checkup, 'concurrency')).toEqual(['concurrency:', 'group: checkup', 'cancel-in-progress: false']);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the main-only `if` removed from the
   * issue step: `expected [ [ …(4) ] ] to deeply equal [ [ …(5) ] ]` (its
   * lines without the guard).
   */
  it('writes the issue only from main, and only reports elsewhere', () => {
    const issueSteps = steps(checkup).filter((s) => s.some((l) => l.includes('--issue')));
    expect(issueSteps).toEqual([[
      'name: Checkup and the tracking issue',
      "if: github.ref == 'refs/heads/main'",
      'env:',
      'GH_TOKEN: ${{ github.token }}',
      'run: bun run checkup --issue',
    ]]);
    const reportStep = steps(checkup).find((s) => s.includes('run: bun run checkup'));
    expect(reportStep).toContain("if: github.ref != 'refs/heads/main'");
  });

  /*
   * MUTATION PROOF, run (2026-11-09): `pull_request_target:` added to `on:`:
   * `expected [ 'on:', 'push:', …(5) ] to deeply equal [ 'on:', 'push:', …(4) ]`.
   */
  it('runs on push to main, weekly and by hand, and reads no secret', () => {
    expect(block(checkup, 'on')).toEqual(['on:', 'push:', 'branches: [main]', 'schedule:', "- cron: '17 6 * * 1'", 'workflow_dispatch:']);
    expect(checkup.filter((l) => l.includes('secrets.'))).toEqual([]);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): fetch-depth 0 removed: `expected [ 'uses:
   * actions/checkout@v5' ] to include 'fetch-depth: 0'`.
   */
  it('fetches every branch and all history', () => {
    expect(steps(checkup)[0]).toContain('fetch-depth: 0');
  });
});

describe("ci.yml's content step (C6)", () => {
  /*
   * MUTATION PROOFS, run (2026-11-09):
   * - the step running `bun run checkup` (GitHub checks too): `expected [ [ …(2) ] ] to deeply equal [ [ …(2) ] ]`.
   * - `issues: write` added to ci.yml: `expected [ 'permissions:', …(2) ] to deeply equal [ 'permissions:', 'contents: read' ]`.
   */
  it('runs the content checks alone, with no token, under read-only permissions', () => {
    expect(steps(ci).filter((s) => s.some((l) => l.includes('bun run checkup')))).toEqual([['name: Repo content checks', 'run: bun run checkup --content']]);
    expect(block(ci, 'permissions')).toEqual(['permissions:', 'contents: read']);
  });
});
