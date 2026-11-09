/**
 * THE COMMUNITY INTAKE (community-pieces plan, docs/plan/2026-11-08-community-pieces.md):
 * the issue form, the label list, AGENTS.md, the drawing skill and the published
 * photo guide.
 *
 * Value: protects=the form asks for photos with a real upload field and puts
 * removing location data first (CEO D1, the V3 check: GitHub keeps it); the
 * piece labels agree between the list, the form, CONTRIBUTING.md and the
 * drawing skill (eng D3), which AGENTS.md links for agents that don't load
 * Claude skills (eng E1-3);
 * the owner's rules live in AGENTS.md and CLAUDE.md loads them (eng D2); the
 * photo guide is built as a page and says GitHub posts are public (design D11)
 * Value: fails_when=a field, a required box, a label, a rule or the guide's
 * public warning is dropped or renamed in one place only
 * Value: why_new=none of these files existed
 * Value: seam=the files themselves, read as text (no YAML parser is installed)
 * Value: no_claim=that GitHub renders the form as written (checked once by
 * hand, V2), or that the wording is clear to a parent (the outside pilot, T6)
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DONE } from '../../engine/tools/checkup.js';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const form = read('.github/ISSUE_TEMPLATE/new-piece.yml');
const SKILL = '.claude/skills/draw-piece/SKILL.md';
/** Every `piece: ...` label a file names, in backticks or quotes, sorted. */
const namedLabels = (text: string) => [...new Set([...text.matchAll(/[`"](piece: [a-z ]+)[`"]/g)].map((m) => m[1]!))].sort();
const labels: string[] = (JSON.parse(read('.github/piece-labels.json')) as { labels: { name: string }[] }).labels.map((l) => l.name);

describe('the new-piece issue form', () => {
  /*
   * MUTATION PROOF, run: the photos field as a textarea: `expected 'textarea' to be 'upload'`.
   */
  it('asks in order: photos (an upload field), the piece, what it joins, markings, reference pieces, checks', () => {
    const ids = [...form.matchAll(/^ {4}id: (\w+)$/gm)].map((m) => m[1]);
    expect(ids).toEqual(['photos', 'what', 'joins', 'markings', 'reference', 'checks']);
    const typeOf = (id: string) => form.slice(0, form.indexOf(`id: ${id}`)).match(/type: (\w+)\s*$/)?.[1];
    expect(typeOf('photos')).toBe('upload');
  });

  /*
   * MUTATION PROOFS, run:
   * - the location step moved to second place: `expected '        1. The piece, and one **mediu…' to match /location/i`.
   * - the location checkbox no longer required: `expected 2 to be 3`.
   */
  it('puts removing location data first, and requires the three checks', () => {
    const firstStep = form.match(/^ {8}1\. .*$/m)?.[0] ?? '';
    expect(firstStep).toMatch(/location/i);
    const checks = form.slice(form.indexOf('id: checks'));
    expect([...checks.matchAll(/required: true/g)].length).toBe(3);
    expect(checks).toMatch(/location data/);
    expect(checks).toMatch(/licen[cs]e/);
    expect(checks).toMatch(/No people, faces/);
  });
});

describe('the piece labels', () => {
  /*
   * MUTATION PROOFS, run:
   * - CONTRIBUTING.md's `piece: needs info` renamed `piece: question`:
   *   `expected [ 'piece: drawing', …(3) ] to deeply equal [ 'piece: drawing', …(3) ]`.
   * - the form's label renamed `piece: new`: `expected [ 'piece: waiting', …(3) ] to include 'piece: new'`.
   */
  it('come from one list that the form and CONTRIBUTING.md agree with', () => {
    expect(labels).toHaveLength(4);
    const formLabels = [...(form.match(/^labels: \[(.*)\]$/m)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    for (const l of formLabels) expect(labels).toContain(l);
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
      /compare the render with \*\*every\*\* photo/,
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
   * - the public box removed: `expected '<!doctype html>\n<html lang="en">\n<h…' to match /are <b>public<\/b>/`.
   */
  it('is built as its own page and says photos sent on GitHub are public', () => {
    expect(read('vite.config.ts')).toMatch(/guide: 'app\/photo-guide\.html'/);
    const guide = read('app/photo-guide.html');
    expect(guide).toMatch(/are <b>public<\/b>/);
    expect(guide).not.toMatch(/They stay on your machine \(the repo/);
  });
});
