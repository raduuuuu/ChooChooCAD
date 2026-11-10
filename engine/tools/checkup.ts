/**
 * `bun run checkup`: the whole repo against its own rules, not just a pull
 * request's diff (repo-checkups plan, C1). Deterministic: no AI, no secrets
 * (community plan D2).
 *
 *   git ls-files ──▶ text files ──▶ brand names (outside the allowlist's tokens)
 *        │                     └──▶ dead repo paths in the rules files
 *        ├──▶ private files tracked (photos/, CALIBRATION.md)
 *        └──▶ images and videos outside the allowlist; a JPEG's location
 *   git branches, gh api (with a token) ──▶ stale branches, aging PRs,
 *        needs-info issues: report-only (contributors' work, not drift)
 *
 *   --issue (checkup.yml, on main only): the tracking issue's hidden state
 *        ──▶ big push since lastSeen? 30 days since the last deep checkup?
 *        the owner's "/checkup done at <sha>"? a stale weekly run?
 *        ──▶ the issue body rewritten, with the new state
 *
 * Public text (the issue, the job summary, a pull request's check) never says
 * where a photo was taken or names a located file (O3, AGENTS.md): it says a
 * committed image needs the maintainer, and a local run names it.
 *
 * Exit: 2 on a checker error (the issue still gets an error line), else 1 on
 * a red finding, else 0. `--content`: the offline checks alone, for ci.yml's
 * pull request step (C6).
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { brandWords, SPLIT, TERMS } from '../data/brandWords.js';
import { hasLocation } from './photoExif.js';

/** The brand words and how text is split into words: shared with the untrusted-part validator (engine/data/brandWords.ts). */
export { SPLIT, TERMS };

/** More files than this changed since the last run make a deep checkup due [estimated; tune after four runs]. */
export const BIG_PUSH = 15;
/** A deep checkup is also due this many days after the last (C8). */
export const DEEP_EVERY_DAYS = 30;
/** A weekly run older than this is a dead schedule (R2). */
export const SCHEDULE_STALE_DAYS = 10;
/** Report-only ages, days. */
export const PR_AGE_DAYS = 14, NEEDS_INFO_DAYS = 30, BRANCH_IDLE_DAYS = 30;
/** Files past this size, or with a NUL byte, aren't read as text. */
const MAX_TEXT_BYTES = 2_000_000;

const IMAGE = /\.(png|jpe?g|gif|webp|svg|ico|heic|heif|mp4|mov)$/i;
const RULES_FILES = /^(AGENTS\.md|CLAUDE\.md|CONTRIBUTING\.md|\.claude\/skills\/[^/]+\/SKILL\.md)$/;
const ALLOWLIST = '.github/checkup-allow.json';
const NEEDS_MAINTAINER = 'a committed image needs the maintainer: run `bun run checkup` locally';

export class CheckerError extends Error {}

export type Check = 'brand' | 'private' | 'image' | 'link' | 'schedule' | 'state' | 'github';

export interface Finding {
  readonly check: Check;
  /** Red findings fail the run; the rest are reported only. */
  readonly red: boolean;
  /** Safe for public text. */
  readonly text: string;
  /** Said instead of `text` only on a local run (a located file's name). */
  readonly local?: string;
}

export interface TextFile {
  readonly path: string;
  readonly text: string;
}

export interface Allowlist {
  readonly allow: readonly { readonly file: string; readonly token: string; readonly why: string }[];
  readonly images: readonly { readonly file: string; readonly why: string }[];
}

/** The allowlist from its JSON; none when the file is missing; a CheckerError naming the bad entry when it's malformed. */
export function parseAllowlist(json: string | null): Allowlist {
  if (json === null) return { allow: [], images: [] };
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch (e) {
    throw new CheckerError(`${ALLOWLIST} is not valid JSON: ${(e as Error).message}`);
  }
  const o = d as { allow?: unknown; images?: unknown };
  const allow = o.allow ?? [], images = o.images ?? [];
  if (!Array.isArray(allow) || !Array.isArray(images)) throw new CheckerError(`${ALLOWLIST}: "allow" and "images" must be lists`);
  const str = (x: unknown) => typeof x === 'string' && x.length > 0;
  allow.forEach((a: { file?: unknown; token?: unknown; why?: unknown }, i) => {
    if (!str(a.file) || !str(a.token) || !str(a.why)) throw new CheckerError(`${ALLOWLIST}: allow entry ${i + 1} needs a file, a token and a why`);
  });
  images.forEach((a: { file?: unknown; why?: unknown }, i) => {
    if (!str(a.file) || !str(a.why)) throw new CheckerError(`${ALLOWLIST}: images entry ${i + 1} needs a file and a why`);
  });
  return { allow, images } as Allowlist;
}

/**
 * Lines naming a brand outside `docs/plan/` (dated records) and the
 * allowlist itself. A brand word passes only inside one of its file's allowed
 * tokens, so a new comment in an allowed file is still found. The finding
 * gives the line, not the word.
 */
export function checkBrands(files: readonly TextFile[], allowlist: Allowlist): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (f.path.startsWith('docs/plan/') || f.path === ALLOWLIST) continue;
    const tokens = allowlist.allow.filter((a) => a.file === f.path).map((a) => a.token);
    f.text.split('\n').forEach((line, i) => {
      if (brandWords(line).length === 0) return;
      let rest = line;
      for (const t of tokens) rest = rest.split(t).join(' '.repeat(t.length));
      if (brandWords(rest).length > 0) out.push({ check: 'brand', red: true, text: `\`${f.path}:${i + 1}\` names a brand (AGENTS.md "Names and sources"; an internal id that must stay goes in \`${ALLOWLIST}\`)` });
    });
  }
  return out;
}

/** Files that must never be committed: photos and the private calibration notes. */
export function checkPrivate(paths: readonly string[]): Finding[] {
  return paths.filter((p) => p.startsWith('photos/') || p === 'CALIBRATION.md').map((p) => p.startsWith('photos/')
    ? { check: 'private' as const, red: true, text: 'a file under `photos/` is committed (AGENTS.md: photos are never committed): run `bun run checkup` locally', local: `\`${p}\` is committed (AGENTS.md: photos are never committed)` }
    : { check: 'private' as const, red: true, text: `\`${p}\` is committed; it is private` });
}

/**
 * Images and videos (C7): any not in the allowlist's `images` is red, and so
 * is a JPEG carrying a location, listed or not. A located file is never named
 * in public text.
 */
export function checkImages(paths: readonly string[], allowlist: Allowlist, bytesOf: (path: string) => Uint8Array): Finding[] {
  const listed = new Set(allowlist.images.map((i) => i.file));
  const out: Finding[] = [];
  for (const p of paths.filter((q) => IMAGE.test(q))) {
    if (/\.jpe?g$/i.test(p)) {
      let located: boolean;
      try {
        located = hasLocation(bytesOf(p));
      } catch {
        out.push({ check: 'image', red: true, text: `\`${p}\` is named .jpg but isn't a JPEG` });
        continue;
      }
      if (located) {
        out.push({ check: 'image', red: true, text: NEEDS_MAINTAINER, local: `\`${p}\` says where it was taken: remove it from the repository` });
        continue;
      }
    }
    if (!listed.has(p)) out.push({ check: 'image', red: true, text: `\`${p}\` is an image or video not listed in \`${ALLOWLIST}\` (AGENTS.md: photos are never committed)` });
  }
  return out;
}

/**
 * Repo paths in the rules files that lead nowhere: Markdown links, relative to
 * the file, and backticked paths whose first segment is a top-level tracked
 * entry, from the repo root. A trailing `:N` or `:N-M` is a line number;
 * anything with `*`, `<` or `{` is a pattern or a placeholder, skipped.
 */
export function checkLinks(files: readonly TextFile[], tracked: readonly string[]): Finding[] {
  const files_ = new Set(tracked);
  const dirs = new Set<string>();
  for (const f of tracked) {
    const parts = f.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  const top = new Set(tracked.map((f) => f.split('/')[0]!));
  const exists = (p: string) => files_.has(p.replace(/\/$/, '')) || dirs.has(p.replace(/\/$/, ''));
  const out: Finding[] = [];
  for (const f of files.filter((q) => RULES_FILES.test(q.path))) {
    const base = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
    f.text.split('\n').forEach((line, i) => {
      const dead = (shown: string) => out.push({ check: 'link', red: true, text: `\`${f.path}:${i + 1}\` points at \`${shown}\`, which isn't in the repository` });
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1]!;
        if (/^[a-z][a-z+.-]*:|^#/i.test(target)) continue;
        const path = resolve(base, target.split('#')[0]!);
        if (path === null || !exists(path)) dead(target); // null: it climbs out of the repository
      }
      for (const m of line.matchAll(/`([^`\s]+)`/g)) {
        const path = m[1]!.replace(/:\d+(-\d+)?$/, '');
        if (/[*<{]/.test(path) || !top.has(path.split('/')[0]!)) continue;
        if (!exists(path)) dead(m[1]!);
      }
    });
  }
  return out;
}

/** `target` relative to the folder `base`, normalised; null when it climbs out of the repo. */
function resolve(base: string, target: string): string | null {
  const parts = base === '' ? [] : base.split('/');
  for (const seg of target.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join('/');
}

export interface GithubState {
  /** Remote branches merged into main and not deleted (Dependabot's left out by the caller or here). */
  readonly merged: readonly string[];
  /** Unmerged remote branches and their last commit's date. */
  readonly unmerged: readonly { readonly name: string; readonly lastCommit: string }[];
  readonly pulls: readonly { readonly number: number; readonly createdAt: string }[];
  readonly needsInfo: readonly { readonly number: number; readonly updatedAt: string }[];
}

const DAY = 86_400_000;
/** Branch names listed in one finding before "and N more". */
const LIST_MAX = 10;
const days = (from: string, now: Date) => (now.getTime() - Date.parse(from)) / DAY;
const notDependabot = (b: string) => !b.startsWith('dependabot/');

/** Report-only: contributors' branches, pull requests and issues aren't the owner's drift, and a main kept red stops meaning anything. Numbers only, never titles. */
export function checkGithub(s: GithubState, now: Date): Finding[] {
  const out: Finding[] = [];
  const merged = s.merged.filter(notDependabot);
  const named = merged.slice(0, LIST_MAX).map((b) => `\`${b}\``).join(', ') + (merged.length > LIST_MAX ? ` and ${merged.length - LIST_MAX} more` : '');
  if (merged.length > 0) out.push({ check: 'github', red: false, text: `${merged.length} merged branch${merged.length === 1 ? '' : 'es'} not deleted: ${named}` });
  for (const b of s.unmerged.filter((q) => notDependabot(q.name) && days(q.lastCommit, now) > BRANCH_IDLE_DAYS)) {
    out.push({ check: 'github', red: false, text: `branch \`${b.name}\` is unmerged with no commit for ${Math.floor(days(b.lastCommit, now))} days` });
  }
  for (const p of s.pulls.filter((q) => days(q.createdAt, now) > PR_AGE_DAYS)) {
    out.push({ check: 'github', red: false, text: `pull request #${p.number} has been open ${Math.floor(days(p.createdAt, now))} days` });
  }
  for (const i of s.needsInfo.filter((q) => days(q.updatedAt, now) > NEEDS_INFO_DAYS)) {
    out.push({ check: 'github', red: false, text: `issue #${i.number} has waited on "piece: needs info" for ${Math.floor(days(i.updatedAt, now))} days` });
  }
  return out;
}

// ── The tracking issue's state ──────────────────────────────────────────────

export interface State {
  /** The last commit a run measured from. */
  readonly lastSeen: string;
  /** The oldest big push not yet covered by a deep checkup. */
  readonly due: string | null;
  /** The newest big push: a deep checkup at or after it clears `due` (O2). */
  readonly latestBig: string | null;
  readonly lastDeep: string | null;
  readonly lastScheduled: string | null;
}

const MARKER = /<!-- checkup-state (\{.*?\}) -->/s;

/** The state hidden at the end of the issue body; null when it's missing or malformed (the run starts fresh). */
export function parseMarker(body: string): State | null {
  const m = body.match(MARKER);
  if (!m) return null;
  try {
    const s = JSON.parse(m[1]!) as State;
    const ok = (x: unknown) => x === null || typeof x === 'string';
    return typeof s.lastSeen === 'string' && ok(s.due) && ok(s.latestBig) && ok(s.lastDeep) && ok(s.lastScheduled) ? s : null;
  } catch {
    return null;
  }
}

export const marker = (s: State) => `<!-- checkup-state ${JSON.stringify(s)} -->`;

export interface Git {
  /** Files changed between two commits. */
  changed(from: string, to: string): number;
  /** Whether `a` is an ancestor of (or is) `b`; 'unknown' when either sha isn't in the clone. */
  isAncestor(a: string, b: string): boolean | 'unknown';
}

export interface IssueComment {
  readonly body: string;
  /** GitHub's author_association: only OWNER can clear a due checkup. */
  readonly association: string;
  readonly createdAt: string;
}

/** The owner's closing comment (the checkup skill's last step): its first line. */
export const DONE = /^\/checkup done at ([0-9a-f]{7,40})\b/;
const short = (sha: string) => sha.slice(0, 7);

/**
 * One run's step of the state: a push counted from `lastSeen` (O1: a run
 * GitHub replaced loses nothing), the owner's newest "/checkup done at <sha>"
 * applied, the weekly run's date kept. Returns the new state, its findings
 * and why a deep checkup is due (empty when it isn't).
 */
export function advance(prev: State | null, ctx: { head: string; now: Date; scheduled: boolean; git: Git; comments: readonly IssueComment[] }): { state: State; findings: Finding[]; dueWhy: string[] } {
  const { head, now, git } = ctx;
  const findings: Finding[] = [];
  const today = now.toISOString();
  let s: State;
  if (prev === null) {
    findings.push({ check: 'state', red: false, text: 'no saved state in this issue (the first run, or the body was edited by hand): starting from here' });
    s = { lastSeen: head, due: head, latestBig: head, lastDeep: null, lastScheduled: ctx.scheduled ? today : null };
  } else {
    const known = git.isAncestor(prev.lastSeen, head);
    let big: boolean;
    if (known === true) big = git.changed(prev.lastSeen, head) > BIG_PUSH;
    else {
      big = true;
      findings.push({ check: 'state', red: true, text: `the last commit checked, \`${short(prev.lastSeen)}\`, isn't in main's history any more: history was rewritten` });
    }
    s = { ...prev, lastSeen: head, lastScheduled: ctx.scheduled ? today : prev.lastScheduled, ...(big ? { due: prev.due ?? head, latestBig: head } : {}) };
  }

  const done = ctx.comments
    .filter((c) => c.association === 'OWNER' && DONE.test(c.body.trim()))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (done) {
    const sha = DONE.exec(done.body.trim())![1]!;
    if (git.isAncestor(sha, head) === 'unknown') {
      findings.push({ check: 'state', red: true, text: `"/checkup done at ${sha}" names a commit this clone doesn't know (mistyped, or history rewritten)` });
    } else {
      s = { ...s, lastDeep: s.lastDeep !== null && s.lastDeep > done.createdAt ? s.lastDeep : done.createdAt };
      if (s.latestBig === null || git.isAncestor(s.latestBig, sha) === true) s = { ...s, due: null, latestBig: null };
    }
  }

  // A cleared due always records lastDeep, so with none recorded `due` is still set.
  const dueWhy: string[] = [];
  if (s.due !== null) dueWhy.push(s.lastDeep === null ? 'no deep checkup recorded yet' : `more than ${BIG_PUSH} files changed since \`${short(s.due)}\``);
  if (s.lastDeep !== null && days(s.lastDeep, now) > DEEP_EVERY_DAYS) dueWhy.push(`the last deep checkup was ${Math.floor(days(s.lastDeep, now))} days ago`);

  if (!ctx.scheduled) {
    if (s.lastScheduled === null) findings.push({ check: 'schedule', red: false, text: 'no weekly run recorded yet' });
    else if (days(s.lastScheduled, now) > SCHEDULE_STALE_DAYS) {
      findings.push({ check: 'schedule', red: true, text: `the weekly run last ran ${s.lastScheduled.slice(0, 10)}: GitHub may have disabled it (\`gh workflow enable checkup.yml\`)` });
    }
  }
  return { state: s, findings, dueWhy };
}

// ── The report ──────────────────────────────────────────────────────────────

const HEADINGS: Record<Check, string> = {
  brand: 'Brand names',
  private: 'Private files',
  image: 'Images',
  link: 'Paths in the rules files',
  schedule: 'Weekly run',
  state: 'Checkup state',
  github: 'Branches, pull requests and issues (report only)',
};

export interface Run {
  readonly date: Date;
  readonly findings: readonly Finding[];
  /** Files not read as text: binary or too large. */
  readonly skipped: number;
  /** Why the GitHub checks didn't run, when they didn't. */
  readonly githubSkipped?: string;
  readonly error?: string;
  readonly dueWhy?: readonly string[];
  readonly state?: State;
}

/** The markdown report. `local`: name located files (never in public text). */
export function report(r: Run, local: boolean): string {
  const lines = [`## Repo checkup, ${r.date.toISOString().slice(0, 10)}`, ''];
  if (r.error) lines.push(`**The checker failed:** ${r.error}`, '');
  const red = r.findings.filter((f) => f.red).length;
  lines.push(red === 0 ? 'No red findings.' : `**${red} red finding${red === 1 ? '' : 's'}.**`, '');
  if (r.dueWhy) {
    lines.push(r.dueWhy.length > 0 ? `**A deep checkup is due** (\`/checkup\`): ${r.dueWhy.join('; ')}.` : 'No deep checkup due.');
    if (r.state) lines.push(`Last deep checkup: ${r.state.lastDeep?.slice(0, 10) ?? 'none recorded'}. Last weekly run: ${r.state.lastScheduled?.slice(0, 10) ?? 'none recorded'}.`);
    lines.push('');
  }
  for (const check of Object.keys(HEADINGS) as Check[]) {
    const fs = r.findings.filter((f) => f.check === check);
    if (fs.length === 0) continue;
    // Several located images read the same in public: said once.
    lines.push(`### ${HEADINGS[check]}`, '', ...new Set(fs.map((f) => `- ${f.red ? '🔴 ' : ''}${(local && f.local) || f.text}`)), '');
  }
  if (r.githubSkipped) lines.push(`GitHub checks skipped: ${r.githubSkipped}.`, '');
  if (r.skipped > 0) lines.push(`${r.skipped} file${r.skipped === 1 ? '' : 's'} not read as text (binary or over 2 MB).`, '');
  return lines.join('\n');
}

export const exitCode = (r: Pick<Run, 'findings' | 'error'>) => (r.error ? 2 : r.findings.some((f) => f.red) ? 1 : 0);

/** Issue writes only from main (O6): a dispatch on a branch reports to its job summary alone. */
export const mayWriteIssue = (ref: string | undefined) => ref === 'refs/heads/main';

// ── The command line: the only place with I/O ───────────────────────────────

const run = (cmd: string, args: string[], input?: string) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, input, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });

function contentFindings(): { findings: Finding[]; skipped: number } {
  let tracked: string[];
  try {
    tracked = run('git', ['ls-files', '-z']).split('\0').filter(Boolean);
  } catch (e) {
    throw new CheckerError(`git ls-files failed: ${(e as Error).message.split('\n')[0]}`);
  }
  let allowJson: string | null = null;
  try {
    allowJson = readFileSync(ALLOWLIST, 'utf8');
  } catch {
    allowJson = null;
  }
  const allowlist = parseAllowlist(allowJson);
  const texts: TextFile[] = [];
  let skipped = 0;
  for (const path of tracked) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch {
      continue; // deleted in the working tree
    }
    if (bytes.length > MAX_TEXT_BYTES || bytes.includes(0)) {
      if (!IMAGE.test(path)) skipped++;
      continue;
    }
    if (!IMAGE.test(path)) texts.push({ path, text: bytes.toString('utf8') });
  }
  return {
    findings: [
      ...checkBrands(texts, allowlist),
      ...checkPrivate(tracked),
      ...checkImages(tracked, allowlist, (p) => new Uint8Array(readFileSync(p))),
      ...checkLinks(texts, tracked),
    ],
    skipped,
  };
}

function repoSlug(): string {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = run('git', ['remote', 'get-url', 'origin']).trim();
  const m = url.match(/github\.com[:/](.+?)(\.git)?$/);
  if (!m) throw new CheckerError(`origin isn't a GitHub remote: ${url}`);
  return m[1]!;
}

function token(): string | null {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN!;
  try {
    return run('gh', ['auth', 'token']).trim() || null;
  } catch {
    return null;
  }
}

const ghLines = (path: string, jq: string) => run('gh', ['api', '--paginate', path, '--jq', jq]).split('\n').filter(Boolean).map((l) => JSON.parse(l));

function githubState(repo: string): GithubState {
  // Only branches GitHub still has: a local clone keeps refs to deleted ones until `git fetch --prune`
  // (the plan counted 186 such stale refs as merged branches, 2026-11-08; GitHub had none).
  const live = new Set(run('git', ['ls-remote', '--heads', 'origin']).split('\n').filter(Boolean).map((l) => l.split('\trefs/heads/')[1]!));
  live.delete('main');
  const merged = run('git', ['branch', '-r', '--merged', 'origin/main']).split('\n').map((l) => l.trim().replace(/^origin\//, '')).filter((b) => live.has(b));
  const unmerged = run('git', ['for-each-ref', 'refs/remotes/origin', '--format=%(refname:short) %(committerdate:iso-strict)']).split('\n').filter(Boolean)
    .map((l) => { const [ref, date] = l.split(' '); return { name: ref!.replace(/^origin\//, ''), lastCommit: date! }; })
    .filter((b) => live.has(b.name) && !merged.includes(b.name));
  return {
    merged,
    unmerged,
    pulls: ghLines(`repos/${repo}/pulls?state=open&per_page=100`, '.[] | {number, createdAt: .created_at}'),
    needsInfo: ghLines(`repos/${repo}/issues?state=open&labels=${encodeURIComponent('piece: needs info')}&per_page=100`, '.[] | select(.pull_request | not) | {number, updatedAt: .updated_at}'),
  };
}

const realGit: Git = {
  changed: (from, to) => run('git', ['diff', '--name-only', from, to]).split('\n').filter(Boolean).length,
  isAncestor(a, b) {
    try {
      run('git', ['merge-base', '--is-ancestor', a, b]);
      return true;
    } catch (e) {
      return (e as { status?: number }).status === 1 ? false : 'unknown';
    }
  },
};

/** The open tracking issue (oldest when there are two), created with its label when there's none. */
function trackingIssue(repo: string): { number: number; body: string; duplicates: number[] } {
  const open = ghLines(`repos/${repo}/issues?state=open&labels=checkup&per_page=100`, '.[] | select(.pull_request | not) | {number, body}') as { number: number; body: string | null }[];
  open.sort((a, b) => a.number - b.number);
  if (open.length > 0) return { number: open[0]!.number, body: open[0]!.body ?? '', duplicates: open.slice(1).map((i) => i.number) };
  try {
    run('gh', ['api', `repos/${repo}/labels`, '--input', '-'], JSON.stringify({ name: 'checkup', color: '5319e7', description: 'The repo checkup tracking issue' }));
  } catch {
    // the label exists already
  }
  const made = JSON.parse(run('gh', ['api', `repos/${repo}/issues`, '--input', '-'], JSON.stringify({ title: 'Repo checkup', body: 'The first run is writing this.', labels: ['checkup'] }))) as { number: number };
  return { number: made.number, body: '', duplicates: [] };
}

function main(args: string[]): number {
  const contentOnly = args.includes('--content'), issue = args.includes('--issue');
  const local = process.env.GITHUB_ACTIONS !== 'true';
  const now = new Date();
  let findings: Finding[] = [], skipped = 0, error: string | undefined, githubSkipped: string | undefined;
  try {
    ({ findings, skipped } = contentFindings());
  } catch (e) {
    if (!(e instanceof CheckerError)) throw e;
    error = e.message;
  }
  const out = (r: Run) => {
    const text = report(r, local);
    console.log(text);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
    return exitCode(r);
  };
  if (contentOnly) return out({ date: now, findings, skipped, error, githubSkipped: 'content checks only (--content)' });

  let repo: string | null = null;
  const tok = token();
  if (!tok) githubSkipped = 'no GitHub token (set GH_TOKEN, or sign in with `gh auth login`)';
  else {
    try {
      repo = repoSlug();
      process.env.GH_TOKEN = tok;
      findings.push(...checkGithub(githubState(repo), now));
    } catch (e) {
      githubSkipped = (e as Error).message.split('\n')[0];
    }
  }
  if (!issue) return out({ date: now, findings, skipped, error, githubSkipped });

  if (!mayWriteIssue(process.env.GITHUB_REF)) {
    return out({ date: now, findings, skipped, error: error ?? `--issue writes only from main; this is ${process.env.GITHUB_REF ?? 'not a workflow run'}`, githubSkipped });
  }
  if (!repo) return out({ date: now, findings, skipped, error: error ?? `the tracking issue needs GitHub: ${githubSkipped}`, githubSkipped });
  const head = run('git', ['rev-parse', 'HEAD']).trim();
  const t = trackingIssue(repo);
  const comments = ghLines(`repos/${repo}/issues/${t.number}/comments?per_page=100`, '.[] | {body, association: .author_association, createdAt: .created_at}') as IssueComment[];
  const step = advance(parseMarker(t.body), { head, now, scheduled: process.env.GITHUB_EVENT_NAME === 'schedule', git: realGit, comments });
  for (const d of t.duplicates) step.findings.push({ check: 'state', red: false, text: `issue #${d} also has the \`checkup\` label: close it, this one (#${t.number}) is kept` });
  const r: Run = { date: now, findings: [...findings, ...step.findings], skipped, error, githubSkipped, dueWhy: step.dueWhy, state: step.state };
  const body = `${report(r, false)}\n${marker(step.state)}\n`;
  run('gh', ['api', '-X', 'PATCH', `repos/${repo}/issues/${t.number}`, '--input', '-'], JSON.stringify({ body }));
  return out(r);
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
