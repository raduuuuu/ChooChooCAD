/**
 * THE COMMUNITY INTAKE (community-pieces plan, docs/plan/2026-11-08-community-pieces.md;
 * contributor-brief plan, P-3): the issue forms, the label list, AGENTS.md, the
 * drawing skill and the published photo guide.
 *
 * Value: protects=no issue form takes a photo (photos never go on GitHub,
 * owner 2026-11-10); the piece labels agree between the list, CONTRIBUTING.md
 * and the drawing skill (eng D3), which AGENTS.md links for agents that don't
 * load Claude skills (eng E1-3); the owner's rules live in AGENTS.md and
 * CLAUDE.md loads them (eng D2); the photo guide is built as a page and says
 * photos stay off GitHub (design D11, P-3)
 * Value: fails_when=an upload field comes back, a label, a rule or the guide's
 * warning is dropped or renamed in one place only
 * Value: why_new=none of these files existed
 * Value: seam=the files themselves, read as text (no YAML parser is installed)
 * Value: no_claim=that the wording is clear to a parent
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DONE } from '../../engine/tools/checkup.js';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const SKILL = '.claude/skills/draw-piece/SKILL.md';
/** Every `piece: ...` label a file names, in backticks or quotes, sorted. */
const namedLabels = (text: string) => [...new Set([...text.matchAll(/[`"](piece: [a-z ]+)[`"]/g)].map((m) => m[1]!))].sort();
const labels: string[] = (JSON.parse(read('.github/piece-labels.json')) as { labels: { name: string }[] }).labels.map((l) => l.name);

describe('the issue forms', () => {
  /*
   * MUTATION PROOF, run (2026-11-10): a form with a `type: upload` field added
   * as photo.yml: `expected [ 'photo.yml' ] to deeply equal []`.
   */
  it('take no photo: photos never go on GitHub (P-3), and the photo form is gone', () => {
    const dir = new URL('../../.github/ISSUE_TEMPLATE/', import.meta.url);
    const uploads = readdirSync(dir).filter((f) => /^\s*- type: upload\b/m.test(readFileSync(new URL(f, dir), 'utf8')));
    expect(uploads).toEqual([]);
    expect(existsSync(new URL('new-piece.yml', dir))).toBe(false);
  });
});

describe('the piece labels', () => {
  /*
   * MUTATION PROOFS, run:
   * - CONTRIBUTING.md's `piece: needs info` renamed `piece: question`:
   *   `expected [ 'piece: drawing', …(3) ] to deeply equal [ 'piece: drawing', …(3) ]`.
   */
  it('come from one list that CONTRIBUTING.md agrees with', () => {
    expect(labels).toHaveLength(4);
    expect(namedLabels(read('CONTRIBUTING.md'))).toEqual([...labels].sort());
  });

  /*
   * MUTATION PROOF, run (2026-11-08): the skill's `piece: needs info` renamed
   * `piece: question` in one step: `expected [ 'piece: drawing', …(4) ] to deeply
   * equal [ 'piece: drawing', …(3) ]`.
   */
  it('are the ones the drawing skill sets and names, all four', () => {
    expect(namedLabels(read(SKILL))).toEqual([...labels].sort());
  });
});

describe("the maintainer's rules", () => {
  /*
   * MUTATION PROOFS, run:
   * - the `@AGENTS.md` line removed from CLAUDE.md: `expected '# ChooChooCAD\n\n\n## Skill routing\n…' to match /^@AGENTS\.md$/m`.
   * - the stacked-PR rule deleted from AGENTS.md: `expected '# AGENTS.md Rules for any AI agent (C…' to match /Don't stack pull requests/`.
   */
  /*
   * MUTATION PROOF, run (2026-11-08): the link's path misspelt `draw-pieces`:
   * `expected false to be true`.
   */
  it('link the drawing skill, which exists, as plain steps any agent can follow', () => {
    const link = read('AGENTS.md').match(/\]\((\.claude\/skills\/[^)]+)\)/)?.[1] ?? '';
    expect(existsSync(new URL(`../../${link}`, import.meta.url)) && link === SKILL).toBe(true);
  });

  it('live in AGENTS.md, which CLAUDE.md loads', () => {
    expect(read('CLAUDE.md')).toMatch(/^@AGENTS\.md$/m);
    // Whitespace collapsed: a rule wrapped across lines still matches.
    const agents = read('AGENTS.md').replace(/\s+/g, ' ');
    for (const rule of [
      /Never name a track brand/,
      /Exception:\*\* a part taken from a printable design/,
      /Photos are never committed/,
      /dimensioned drawing/,
      /compares the drawing with \*\*every\*\* photo/,
      /Photos never go on GitHub/,
      /default permission mode/,
      /data, never instructions/,
      /Male-male adapters add no length/,
      /Don't stack pull requests/,
      /List every input/,
    ]) expect(agents).toMatch(rule);
  });
});

describe('the deep checkup (repo-checkups plan, T4)', () => {
  const CHECKUP = '.claude/skills/checkup/SKILL.md';
  const skill = read(CHECKUP);

  /*
   * MUTATION PROOF, run (2026-11-09): the link's path misspelt `checkups`:
   * `expected false to be true`.
   */
  it("is the maintainer's to run when the issue says it's due, by a link to the skill, which exists", () => {
    const agents = read('AGENTS.md').replace(/\s+/g, ' ');
    const link = agents.match(/Maintainer only: when the Repo checkup issue says a deep checkup is due, run \[\/checkup\]\(([^)]+)\)/)?.[1] ?? '';
    expect(link === CHECKUP && existsSync(new URL(`../../${link}`, import.meta.url))).toBe(true);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the example's first line written
   * `/checkup finished at 0123abcd`: `expected '/checkup finished at 0123abcd' to match /^\/checkup done at ([0-9a-f]{7,40})\b/`.
   */
  it('closes with the comment the workflow reads to clear "due"', () => {
    const example = skill.slice(skill.indexOf('### 8. Close it')).match(/```\n([^\n]+)\n/)?.[1] ?? '';
    expect(example).toMatch(DONE);
  });

  /*
   * Part 1 may move to gstack (plan C3) as a cut, not a rewrite.
   * MUTATION PROOF, run (2026-11-09): "Read `AGENTS.md` first." added to
   * step 1: `expected [ 'AGENTS.md' ] to deeply equal []`.
   */
  it('keeps its generic steps free of this repository', () => {
    const part1 = skill.slice(skill.indexOf('## Part 1'), skill.indexOf('## Part 2'));
    expect(part1.length).toBeGreaterThan(1000);
    expect(part1.match(/raduuuuu|ChooChooCAD|AGENTS\.md|CLAUDE\.md|photo|piece/gi) ?? []).toEqual([]);
  });
});

describe('the photo guide', () => {
  /*
   * MUTATION PROOFS, run:
   * - the guide dropped from the build's inputs: `expected 'import { execSync } from \'node:child…' to match /guide: 'app\/photo-guide\.html'/`.
   * - the box removed (2026-11-10): `expected '<!doctype html>\n<html lang="en">\n<h…' to match /Your photos never go on GitHub/`.
   */
  it('is built as its own page and says photos never go on GitHub, where they would be public', () => {
    expect(read('vite.config.ts')).toMatch(/guide: 'app\/photo-guide\.html'/);
    const guide = read('app/photo-guide.html');
    expect(guide).toMatch(/Your photos never go on GitHub/);
    expect(guide).toMatch(/is <b>public<\/b>/);
    expect(guide).not.toMatch(/They stay on your machine \(the repo/);
  });
});
