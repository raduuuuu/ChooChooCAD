/**
 * THE APP'S VERSION (owner, 2026-11-15): one number, in `package.json`, that
 * goes up with every merge to `main`, because every merge deploys.
 *
 *   a pull request ─▶ raises "version" in package.json
 *                  ─▶ adds its entry to the top of CHANGELOG.md
 *        ci.yml    ─▶ `check --base origin/main`: the number went up, and the
 *                     first entry in the changelog is that number, with words
 *        merge     ─▶ pages.yml deploys, then tags `v<number>` and publishes a
 *                     GitHub release whose notes are that entry (`notes`)
 *        the build ─▶ vite.config.ts stamps the number into the app, which
 *                     shows it ("Version 1.0.0")
 *
 * WHICH PART GOES UP (AGENTS.md has the same three lines):
 *   major  something people rely on stops working: a saved layout, a shared
 *          link or a layout file no longer opens, or a thing they use is gone
 *   minor  something new a person can do or see: a piece, a check, a control
 *   patch  everything else: a fix, wording, the look, docs, tests, tooling
 *
 *   bun run version:check                      the file and the changelog agree
 *   bun run version:check --base origin/main   and the number is above that ref's
 *   bun engine/tools/version.ts current        prints the number
 *   bun engine/tools/version.ts notes          prints the number's changelog entry
 *
 * No dependency beyond Node's own modules: the release job runs it without
 * an install.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Version = readonly [major: number, minor: number, patch: number];

/** `1.4.2` and nothing else: no `v`, no pre-release tag, no leading zeros. */
export function parseVersion(text: string): Version | null {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Negative when `a` is the older, zero when they are the same. */
export const compareVersions = (a: Version, b: Version) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export interface ChangelogEntry {
  readonly version: string;
  readonly date: string;
  /** The words under the heading, trimmed. */
  readonly notes: string;
}

const HEADING = /^## (\S+) \((\d{4}-\d{2}-\d{2})\)$/;

/** Every `## 1.4.2 (2026-11-15)` entry, in the file's order: newest first. */
export function changelogEntries(text: string): ChangelogEntry[] {
  const entries: { version: string; date: string; lines: string[] }[] = [];
  for (const line of text.split('\n')) {
    const m = HEADING.exec(line);
    if (m) entries.push({ version: m[1]!, date: m[2]!, lines: [] });
    else entries.at(-1)?.lines.push(line);
  }
  return entries.map((e) => ({ version: e.version, date: e.date, notes: e.lines.join('\n').trim() }));
}

/**
 * What is wrong, one sentence each; empty when nothing is. `base` is the
 * version on the branch being merged into: undefined when not asked for,
 * null when that branch has none yet (the first versioned merge).
 */
export function versionProblems(version: string | undefined, changelog: string, base?: string | null): string[] {
  if (version === undefined) return ['package.json has no "version".'];
  const parsed = parseVersion(version);
  if (!parsed) return [`package.json's version "${version}" is not three numbers like 1.4.2.`];
  const problems: string[] = [];
  const entries = changelogEntries(changelog);
  const first = entries[0];
  if (!first) problems.push(`CHANGELOG.md has no entry. Add "## ${version} (YYYY-MM-DD)" with what changed.`);
  else if (first.version !== version) problems.push(`CHANGELOG.md's first entry is ${first.version}, and package.json says ${version}. Add this version's entry first in the file.`);
  else if (first.notes === '') problems.push(`CHANGELOG.md's entry for ${version} says nothing. Write what changed.`);
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.version)) problems.push(`CHANGELOG.md has two entries for ${e.version}.`);
    seen.add(e.version);
  }
  if (typeof base === 'string') {
    const was = parseVersion(base);
    if (was && compareVersions(parsed, was) <= 0) problems.push(`The version is ${version} and the branch this merges into is already at ${base}. Raise it: every merge gets its own version.`);
  }
  return problems;
}

const ROOT = join(import.meta.dirname, '..', '..');
const versionIn = (json: string) => (JSON.parse(json) as { version?: string }).version;

function main(args: string[]): number {
  const version = versionIn(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  const [command] = args;
  if (command === 'current') {
    console.log(version ?? '');
    return version === undefined ? 1 : 0;
  }
  if (command === 'notes') {
    const entry = changelogEntries(changelog).find((e) => e.version === version);
    console.log(entry?.notes ?? '');
    return entry ? 0 : 1;
  }
  if (command === 'check') {
    const ref = args.includes('--base') ? args[args.indexOf('--base') + 1] : undefined;
    let base: string | null | undefined;
    if (ref !== undefined) {
      // A ref whose package.json has no version yet is the first versioned merge.
      base = versionIn(execFileSync('git', ['show', `${ref}:package.json`], { cwd: ROOT, encoding: 'utf8' })) ?? null;
    }
    const problems = versionProblems(version, changelog, base);
    for (const p of problems) console.error(p);
    if (problems.length === 0) console.log(`Version ${version}${typeof base === 'string' ? `, up from ${base}` : ''}.`);
    return problems.length === 0 ? 0 : 1;
  }
  console.error('Usage: bun engine/tools/version.ts check [--base <ref>] | current | notes');
  return 2;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
