/**
 * THE COMMUNITY INTAKE (community-pieces plan, docs/plan/2026-11-08-community-pieces.md;
 * contributor-brief plan, P-3, T5): the published brief, the issue forms, the
 * label list, AGENTS.md, the drawing skill and the published photo guide.
 *
 * Value: protects=the brief's version moves with its text (E2); the brief
 * keeps its required steps (the preview link, colours needed, the forms, no
 * photos); no issue form takes a photo (photos never go on GitHub, owner
 * 2026-11-10); the two forms set labels from the one list, and the brief's
 * sections are the drawn-piece form's own labels; the piece labels agree
 * between the list, CONTRIBUTING.md and the drawing skill (eng D3), which
 * AGENTS.md links for agents that don't load Claude skills (eng E1-3); the
 * owner's rules live in AGENTS.md and CLAUDE.md loads them (eng D2); the photo
 * guide is built as a page and says photos stay off GitHub (design D11, P-3)
 * Value: fails_when=the brief changes without a new version, an upload field
 * comes back, a form section, a label, a rule or the guide's warning is
 * dropped or renamed in one place only
 * Value: why_new=none of these files existed
 * Value: seam=the files themselves, read as text (no YAML parser is installed)
 * Value: no_claim=that the wording is clear to a parent
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formFields } from '../../engine/tools/briefLink.js';
import { DONE } from '../../engine/tools/checkup.js';
import { BRIEF_URL } from '../src/ContributeLink.js';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const SKILL = '.claude/skills/draw-piece/SKILL.md';
/** Every `piece: ...` label a file names, in backticks or quotes, sorted. */
const namedLabels = (text: string) => [...new Set([...text.matchAll(/[`"](piece: [a-z ]+)[`"]/g)].map((m) => m[1]!))].sort();
const labels: string[] = (JSON.parse(read('.github/piece-labels.json')) as { labels: { name: string }[] }).labels.map((l) => l.name);
const DRAWN = read('.github/ISSUE_TEMPLATE/drawn-piece.yml');
const UNSUPPORTED = read('.github/ISSUE_TEMPLATE/unsupported-piece.yml');
/** A form's top-level labels. */
const formLabels = (yaml: string) => [...(yaml.match(/^labels: \[(.*)\]$/m)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
/** Every field id a form has, in order, checkboxes included. */
const ids = (yaml: string) => [...yaml.matchAll(/^ {4}id: ([\w-]+)$/gm)].map((m) => m[1]);

const BRIEF = 'app/public/contributor-brief.md';
const brief = read(BRIEF);
const VERSION_LINE = /^Brief version: \*\*(\d+), (\d{4}-\d{2}-\d{2})\*\*$/m;
/**
 * EVERY VERSION OF THE BRIEF (E2), oldest first, with the hash of its text
 * less the version line. Changing the brief's text: bump its version line and
 * add the next entry here, in the same commit. Version 1 is draft-7 published
 * with the T5 steps (2026-11-10).
 */
const BRIEF_VERSIONS = [{ version: 1, date: '2026-11-10', hash: 'cfac5aa7c277e40b' }];
const hashOf = (text: string) => createHash('sha256').update(text.replace(VERSION_LINE, '')).digest('hex').slice(0, 16);

describe('the contributor brief (contributor-brief plan, step 1, E2)', () => {
  /*
   * MUTATION PROOFS, run (2026-11-10):
   * - a word of the brief's text changed ("one sitting" to "a sitting"), the
   *   version left alone: `expected 'c333a69bcbf3e7f9' to be 'cfac5aa7c277e40b'`.
   * - the brief's version line bumped to 2, nothing recorded: `expected { version: 2, date: '2026-11-10' } to deeply equal { version: 1, date: '2026-11-10' }`.
   */
  it('carries the last version recorded, and its text hashes as recorded', () => {
    const [, version, date] = brief.match(VERSION_LINE) ?? [];
    const last = BRIEF_VERSIONS.at(-1)!;
    expect({ version: Number(version), date }).toEqual({ version: last.version, date: last.date });
    expect(hashOf(brief)).toBe(last.hash);
  });

  /*
   * MUTATION PROOF, run (2026-11-10): a version 2 recorded with version 1's
   * hash (the line bumped, the text unchanged): `expected 1 to be 2` (and the test before, `expected { version: 1, … } to deeply equal { version: 2, … }`).
   */
  it('changed its text at every version: the numbers count up by one, and no two hashes are the same', () => {
    expect(BRIEF_VERSIONS.map((v) => v.version)).toEqual(BRIEF_VERSIONS.map((_, i) => i + 1));
    expect(new Set(BRIEF_VERSIONS.map((v) => v.hash)).size).toBe(BRIEF_VERSIONS.length);
  });

  /*
   * MUTATION PROOFS, run (2026-11-10):
   * - step 10's `bun run brief:link encode` taken out: `expected '<!-- The contributor brief (docs/plan…' to match /bun run brief:link encode/` (and the hash test).
   * - step 1's old-copy check pointed back at docs/brief/draft.md: `expected 'docs/brief/draft.md' to be 'app/public/contributor-brief.md'` (and the hash test).
   */
  it('names its required steps: the preview link checked, colours needed, the forms, photos kept in the chat', () => {
    const text = brief.replace(/\s+/g, ' ');
    for (const step of [
      /Photos stay in this chat\./,
      /take the photos with its own camera app/,
      /focal length/,
      /bun run brief:link encode/,
      /tell me 'looks right', or what's wrong/,
      /PAINT_TOKENS/,
      /\*\*Colours needed\*\*/,
      /--template drawn-piece\.yml/,
      /--template unsupported-piece\.yml/,
      /Attach no photo/,
    ]) expect(text).toMatch(step);
    // S1-1: an old copy compares itself with this file in the clone.
    expect(text.match(/Compare the version line above with the one in `([^`]+)` in the clone/)?.[1]).toBe(BRIEF);
  });

  /*
   * MUTATION PROOF, run (2026-11-10): the drawn-piece form's "Figures" label
   * renamed "Measurements": `expected [ 'What is the piece?', …(10) ] to include 'Figures'` (and the skill's, `expected [ 'Measurements' ] to deeply equal []`).
   */
  it("writes its issue sections in the forms' own labels, every one a link can fill", () => {
    const drawn = formFields(DRAWN).map((f) => f.label);
    const unsupported = formFields(UNSUPPORTED).map((f) => f.label);
    const sections = [...new Set([...brief.matchAll(/^### (?!\d+\. )(.+)$/gm)].map((m) => m[1]!))];
    for (const s of sections) expect([...drawn, ...unsupported]).toContain(s);
    // Details for review is pasted from its own file, not filled by the link.
    expect([...drawn.filter((l) => l !== 'Details for review'), ...unsupported].filter((l) => !sections.includes(l))).toEqual([]);
  });

  /*
   * MUTATION PROOF, run (2026-11-10): ContributeLink's BRIEF_URL pointed back
   * at the GitHub draft: `expected 'https://github.com/raduuuuu/ChooChooC…' to be 'https://woodentrain.world/contributor…'`.
   */
  it('is served by the site, where the contribute link and CONTRIBUTING.md point', () => {
    expect(BRIEF_URL).toBe(`https://woodentrain.world/${BRIEF.replace('app/public/', '')}`);
    expect(read('CONTRIBUTING.md')).toContain(`[the contributor brief](${BRIEF_URL})`);
    expect(read('CONTRIBUTING.md')).toContain(`(${BRIEF})`);
  });
});

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

  /*
   * MUTATION PROOFS, run (2026-11-10):
   * - drawn-piece.yml's label renamed `piece: new`: `expected [ 'piece: new' ] to deeply equal [ 'piece: waiting' ]`.
   * - unsupported-piece.yml labelled `piece: waiting`: `expected [ 'piece: waiting' ] to deeply equal [ 'piece: unsupported' ]`.
   */
  it('label a drawn piece `piece: waiting` and one the app can\'t hold `piece: unsupported`, from the one list', () => {
    expect(formLabels(DRAWN)).toEqual(['piece: waiting']);
    expect(formLabels(UNSUPPORTED)).toEqual(['piece: unsupported']);
    for (const l of [...formLabels(DRAWN), ...formLabels(UNSUPPORTED)]) expect(labels).toContain(l);
  });

  /*
   * MUTATION PROOFS, run (2026-11-10):
   * - the drawn form's colours field's id spelt `colors`: `expected [ 'what', 'joins', 'markings', …(6) ] to deeply equal [ 'what', 'joins', 'markings', …(6) ]`.
   * - the no-photo box no longer required: `expected 1 to be 2`.
   */
  it('ask for what the review needs, and require the licence and no-photo boxes', () => {
    expect(ids(DRAWN)).toEqual(['what', 'joins', 'markings', 'preview', 'brief', 'figures', 'colours', 'details', 'checks']);
    expect(ids(UNSUPPORTED)).toEqual(['what', 'reason', 'brief', 'checks']);
    for (const [form, boxes] of [[DRAWN, [/I license this drawing under this repository's licence \(MIT\)\./, /No photo is attached/]], [UNSUPPORTED, [/No photo is attached/, /"the maker"/]]] as const) {
      const checks = form.slice(form.indexOf('id: checks'));
      expect([...checks.matchAll(/required: true/g)].length).toBe(boxes.length);
      for (const b of boxes) expect(checks).toMatch(b);
    }
    expect(DRAWN).toMatch(/written as "the maker"/);
  });
});

describe('the piece labels', () => {
  /*
   * MUTATION PROOFS, run:
   * - CONTRIBUTING.md's `piece: needs info` renamed `piece: question`:
   *   `expected [ 'piece: drawing', …(3) ] to deeply equal [ 'piece: drawing', …(3) ]`.
   * - (2026-11-10) CONTRIBUTING.md's `piece: reviewing` left as `piece: drawing`:
   *   `expected [ 'piece: drawing', …(3) ] to deeply equal [ 'piece: needs info', …(3) ]`.
   */
  it('come from one list, with `piece: reviewing`, that CONTRIBUTING.md agrees with', () => {
    expect(labels).toHaveLength(4);
    expect(labels).toContain('piece: reviewing');
    expect(namedLabels(read('CONTRIBUTING.md'))).toEqual([...labels].sort());
  });

  /*
   * MUTATION PROOFS, run:
   * - (2026-11-08) the skill's `piece: needs info` renamed `piece: question` in
   *   one step: `expected [ 'piece: drawing', …(4) ] to deeply equal [ 'piece: drawing', …(3) ]`.
   * - (2026-11-10) the skill's claim step left on `piece: drawing`: `expected [ 'piece: drawing', …(4) ] to deeply equal [ 'piece: needs info', …(3) ]`.
   */
  it('are the ones the drawing skill sets and names, all four', () => {
    expect(namedLabels(read(SKILL))).toEqual([...labels].sort());
  });
});

describe('the review path (/draw-piece) reads the drawn-piece form', () => {
  /*
   * MUTATION PROOFS, run (2026-11-10):
   * - the skill's **Colours needed** line taken out of its intake: `expected [ 'Colours needed' ] to deeply equal []`.
   * - the pull request's **Colours added** taken out: `expected '---\nname: draw-piece\ndescription: R…' to match /- \*\*Colours added\*\*: each new pai…/`.
   */
  it('names every section of the form, opens the preview link, and lists colours added', () => {
    const skill = read(SKILL);
    const intake = skill.slice(skill.indexOf('### A piece the brief drew'), skill.indexOf('## 2. Claim it'));
    const sections = [...DRAWN.matchAll(/^ {6}label: (.+)$/gm)].map((m) => m[1]!);
    expect(sections.filter((l) => !intake.includes(`**${l}**`))).toEqual([]);
    expect(skill).toMatch(/\*\*Open the preview link\*\*/);
    expect(skill).toMatch(/under \*\*Colours added\*\*/);
    expect(skill).toMatch(/- \*\*Colours added\*\*: each new paint token/);
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
   * - the contribute link removed (2026-11-10): `expected '<!doctype html>\n<html lang="en">\n<h…' to contain '<a href="https://woodentrain.world/co…'`.
   */
  it('is built as its own page and says photos never go on GitHub, where they would be public', () => {
    expect(read('vite.config.ts')).toMatch(/guide: 'app\/photo-guide\.html'/);
    const guide = read('app/photo-guide.html');
    expect(guide).toMatch(/Your photos never go on GitHub/);
    expect(guide).toMatch(/is <b>public<\/b>/);
    expect(guide).not.toMatch(/They stay on your machine \(the repo/);
    // The contribute link, in the app's words and to the app's address (ContributeLink.tsx): a phone reaches the brief here.
    expect(guide).toContain(`<a href="${BRIEF_URL}">Missing a piece? Have your Claude draw it for the library</a>`);
  });
});
