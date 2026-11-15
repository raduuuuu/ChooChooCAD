/**
 * THE APP'S VERSION (owner, 2026-11-15).
 *
 * Value: protects=a version is three plain numbers and compares part by part;
 * the changelog's entries are read newest first with their words; a pull
 * request is refused when the number is missing, malformed, not the
 * changelog's first entry, wordless, entered twice, or not above the branch
 * it merges into; this repository's own files pass; ci.yml compares against
 * the base on a pull request, and pages.yml publishes after the deploy, from
 * main only, in the one job that may write
 * Value: fails_when=a merge can reach main without its own version and its
 * words, 1.10.0 sorts under 1.9.0, a release is published before the deploy
 * or from a branch, or the write permission spreads to the whole workflow
 * Value: why_new=the app had no version
 * Value: seam=the pure functions; the workflows read as text, as
 * checkupWorkflow.test.ts does
 * Value: no_claim=GitHub running the jobs, or the tag and release appearing:
 * the first merge to main shows that
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { changelogEntries, compareVersions, parseVersion, versionProblems } from './version.js';

const LOG = `# Changelog

Words before the first entry belong to none.

## 1.4.2 (2026-11-15)

- A fix.

## 1.4.1 (2026-11-14)

- An older fix.
`;

describe('a version', () => {
  /*
   * MUTATION PROOFS, run:
   * - the pattern without its anchors: `expected [ 1, 4, 2 ] to be null` (for "v1.4.2").
   * - leading zeros allowed: `expected [ 1, 4, 2 ] to be null` (for "1.04.2").
   */
  it('is three plain numbers and nothing else', () => {
    expect(parseVersion('1.4.2')).toEqual([1, 4, 2]);
    expect(parseVersion('10.0.0')).toEqual([10, 0, 0]);
    for (const bad of ['v1.4.2', '1.4', '1.4.2.1', '1.04.2', '1.4.2-beta', ' 1.4.2', '']) expect(parseVersion(bad)).toBeNull();
  });

  /*
   * MUTATION PROOF, run: the parts compared as text (`String(a) < String(b)`
   * in place of the subtraction): `expected false to be true` (1.10.0 against 1.9.0).
   */
  it('compares part by part, as numbers', () => {
    expect(compareVersions([1, 10, 0], [1, 9, 0]) > 0).toBe(true);
    expect(compareVersions([2, 0, 0], [1, 99, 99]) > 0).toBe(true);
    expect(compareVersions([1, 4, 2], [1, 4, 3]) < 0).toBe(true);
    expect(compareVersions([1, 4, 2], [1, 4, 2])).toBe(0);
  });
});

describe('the changelog', () => {
  /*
   * MUTATION PROOF, run: every line pushed to the first entry instead of the
   * last: `expected [ { version: '1.4.2', …(2) }, …(1) ] to deeply equal
   * [ { version: '1.4.2', …(2) }, …(1) ]` (the older entry's words under the newer).
   */
  it('is read as entries, newest first, each with its own words', () => {
    expect(changelogEntries(LOG)).toEqual([
      { version: '1.4.2', date: '2026-11-15', notes: '- A fix.' },
      { version: '1.4.1', date: '2026-11-14', notes: '- An older fix.' },
    ]);
    expect(changelogEntries('# Changelog\n\nNothing yet.\n')).toEqual([]);
  });
});

describe('what is refused', () => {
  const one = (version: string | undefined, log: string, base?: string | null) => versionProblems(version, log, base);

  /*
   * MUTATION PROOFS, run:
   * - the base comparison `< 0` in place of `<= 0`: `expected [] to have a
   *   length of 1` (the same number as main let through).
   * - the first-entry check removed: `expected [] to have a length of 1`.
   * - the empty-notes check removed: `expected [] to have a length of 1`.
   * - the duplicate check removed: `expected [] to have a length of 1`.
   */
  it('a number that is missing, malformed, not first in the changelog, wordless, doubled, or not raised', () => {
    expect(one('1.4.2', LOG)).toEqual([]);
    expect(one('1.4.2', LOG, '1.4.1')).toEqual([]);
    // The first versioned merge: the branch it merges into has no number yet.
    expect(one('1.4.2', LOG, null)).toEqual([]);

    expect(one(undefined, LOG)).toEqual(['package.json has no "version".']);
    expect(one('1.4', LOG)[0]).toContain('is not three numbers');
    expect(one('1.4.3', LOG)).toHaveLength(1);
    expect(one('1.4.3', LOG)[0]).toContain("first entry is 1.4.2, and package.json says 1.4.3");
    expect(one('1.4.2', '# Changelog\n')[0]).toContain('has no entry');
    expect(one('1.4.2', '## 1.4.2 (2026-11-15)\n\n## 1.4.1 (2026-11-14)\n\n- Older.\n')).toHaveLength(1);
    expect(one('1.4.2', '## 1.4.2 (2026-11-15)\n\n## 1.4.1 (2026-11-14)\n\n- Older.\n')[0]).toContain('says nothing');
    expect(one('1.4.2', `${LOG}\n## 1.4.2 (2026-11-13)\n\n- Again.\n`)).toHaveLength(1);
    expect(one('1.4.2', `${LOG}\n## 1.4.2 (2026-11-13)\n\n- Again.\n`)[0]).toContain('two entries for 1.4.2');
    expect(one('1.4.2', LOG, '1.4.2')).toHaveLength(1);
    expect(one('1.4.2', LOG, '1.4.2')[0]).toContain('already at 1.4.2');
    expect(one('1.4.2', LOG, '1.5.0')).toHaveLength(1);
  });

  /*
   * MUTATION PROOF, run: package.json's version set to 1.0.1 with no new
   * changelog entry: `expected [ "CHANGELOG.md's first entry is …" ] to deeply equal []`.
   */
  it('this repository passes: its number is the first entry of its changelog', () => {
    const root = new URL('../../', import.meta.url);
    const version = (JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { version?: string }).version;
    expect(versionProblems(version, readFileSync(new URL('CHANGELOG.md', root), 'utf8'))).toEqual([]);
  });
});

describe('the workflows, read as text', () => {
  const text = (file: string) =>
    readFileSync(new URL(`../../.github/workflows/${file}`, import.meta.url), 'utf8')
      .split('\n')
      .map((l) => l.replace(/^\s*#.*$/, ''))
      .filter((l) => l.trim() !== '')
      .join('\n');
  const ci = text('ci.yml'), pages = text('pages.yml');
  const release = pages.slice(pages.indexOf('\n  release:'));

  /*
   * MUTATION PROOFS, run:
   * - `--base FETCH_HEAD` dropped from ci.yml: `expected false to be true`.
   * - `${{ github.base_ref }}` pasted into the script: `expected 1 to be 0`.
   */
  it('ci.yml compares with the branch a pull request merges into, and takes its name through env', () => {
    expect(ci.includes('bun run version:check --base FETCH_HEAD')).toBe(true);
    expect(ci.includes('BASE: ${{ github.base_ref }}')).toBe(true);
    const script = ci.slice(ci.indexOf('- name: Version'), ci.indexOf('- name: Typecheck'));
    expect(script.slice(script.indexOf('run: |')).split('${{').length - 1).toBe(0);
  });

  /*
   * MUTATION PROOFS, run:
   * - `needs: deploy` changed to `needs: gate`: `expected false to be true`.
   * - the main-only guard removed from the release job: `expected false to be true`.
   * - `contents: write` moved to the workflow's own permissions: `expected 2 to be 1`
   *   (and the top block no longer reads `contents: read`).
   */
  it('pages.yml publishes after the deploy, from main only, in the one job that may write', () => {
    expect(release.includes('\n    needs: deploy\n')).toBe(true);
    expect(release.includes("\n    if: github.ref == 'refs/heads/main'\n")).toBe(true);
    expect(release.includes('\n    permissions:\n      contents: write\n')).toBe(true);
    expect(pages.split('contents: write').length - 1).toBe(1);
    expect(pages.includes('\npermissions:\n  contents: read\n')).toBe(true);
    expect(release.includes('gh release create "v$version" --target "$GITHUB_SHA"')).toBe(true);
  });
});
