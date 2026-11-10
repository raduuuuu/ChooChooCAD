/**
 * THE BRIEF'S LINKS, BY SCRIPT (contributor-brief plan, step 2; T3).
 *
 * Value: protects=a piece's preview link decodes to exactly the JSON sent; a
 * piece the validator refuses gets no link either way; the fragment stays
 * under 4,096 characters and the prefilled issue link under 8,192 bytes, with
 * the largest preview and a big figures table inside it
 * Value: fails_when=the codec, a cap, or the size budget drifts
 * Value: why_new=links were going to be built by hand in a chat sandbox
 * Value: seam=encodePreview / decodePreview / issueLink, and main() with an
 * injected reader
 * Value: no_claim=that GitHub keeps a prefilled link through sign-in (spike)
 */

import { describe, expect, it } from 'vitest';
import { DECORATED_SEEDS } from '../data/decoratedSeeds.js';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { decodePreview, encodePreview, PREVIEW_MAX_CHARS, PREVIEW_PREFIX } from '../data/previewLink.js';
import { asSubmission, specAs } from '../test/submissions.js';
import { ISSUE_MAX_BYTES, issueLink, main, NEW_ISSUE, previewLink, SITE, type Io } from './briefLink.js';

const builtIn = makeResolver(BUILT_IN);

async function fragmentOf(data: unknown): Promise<string> {
  const r = await encodePreview(data);
  if (!r.ok) throw new Error(r.reasons.join('; '));
  return r.fragment;
}

describe('a piece in a link and back', () => {
  /*
   * MUTATION PROOF, run: `fromBase64Url` in linkCodec.ts without its `-` to
   * `+` mapping. Every case fails with `AssertionError: expected false to be
   * true // Object.is equality`, and shareLink's own round-trip with
   * `Error: Circle: bad-encoding`: one codec, both links.
   */
  it.each([
    ['a straight', () => asSubmission(builtIn('A'), 'A9')],
    ['a curve', () => asSubmission(builtIn('E'), 'E9')],
    ['a multi-road piece', () => asSubmission(builtIn('TJ'), 'TJ9')],
    ['a piece with its own decoration (the double-arch bridge)', () => asSubmission(builtIn('DA'), 'DA9')],
    ['a decorated piece\'s spec', () => specAs('LC9')],
  ])('%s round-trips exactly', async (_, make) => {
    const data = make();
    const fragment = await fragmentOf(data);
    expect(fragment.startsWith(PREVIEW_PREFIX)).toBe(true);
    const back = await decodePreview(fragment);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.data).toEqual(data);
  });

  /*
   * MUTATION PROOF, run: decode printing `r.part` (derived) in place of
   * `r.data`. Fails with `AssertionError: expected { id: 'DA9', brand:
   * 'GENERIC', …(13) } to deeply equal { id: 'DA9', brand: 'GENERIC',
   * …(12) }`: the maintainer reads what was sent, not decorBody.
   */
  it('the CLI prints the link, and decode prints the JSON back from it', async () => {
    const data = asSubmission(builtIn('DA'), 'DA9');
    const out: string[] = [];
    const io: Io = { read: () => JSON.stringify(data), out: (l) => out.push(l), err: (l) => out.push(`ERR ${l}`) };
    expect(await main(['encode', 'piece.json'], io)).toBe(0);
    expect(out[0]!.startsWith(`${SITE}#p1.`)).toBe(true);
    expect(await main(['decode', out[0]!], io)).toBe(0);
    expect(JSON.parse(out[1]!)).toEqual(data);
  });
});

describe('refused either way', () => {
  /*
   * MUTATION PROOF, run: decodePreview's check replaced by `{ ok: true,
   * part: data }`. Fails with `AssertionError: expected true to be false //
   * Object.is equality`.
   */
  it('a link to a piece the validator refuses decodes to the same refusal, and encode prints none', async () => {
    const bad = { ...asSubmission(builtIn('A'), 'A9'), dimensions: { status: 'published', source: 'x' } };
    // Packed by hand, as a tampered link would be: the encoder refuses it.
    const { deflate, toBase64Url } = await import('../src/io/linkCodec.js');
    const fragment = `${PREVIEW_PREFIX}${toBase64Url(await deflate(JSON.stringify(bad)))}`;
    const r = await decodePreview(fragment);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toMatch(/^dimensions.status: must be "unverified"/);
    expect((await previewLink(JSON.stringify(bad))).ok).toBe(false);
    const errs: string[] = [];
    expect(await main(['decode', fragment], { read: () => '', out: () => undefined, err: (l) => errs.push(l) })).toBe(1);
    expect(errs[0]).toMatch(/^REFUSED invalid: dimensions.status/);
  });

  /*
   * MUTATION PROOF, run: PREVIEW_FRAGMENT as /^#[pv](\d+)\./. Fails with
   * `AssertionError: expected { ok: false, code: 'corrupt', …(1) } to match
   * object { ok: false, code: 'version' }`.
   */
  it('a layout link, a later version, and a broken link are refused with their own codes', async () => {
    expect(await decodePreview('#v1.abc')).toMatchObject({ ok: false, code: 'version' });
    expect(await decodePreview('#p2.abc')).toMatchObject({ ok: false, code: 'version' });
    expect(await decodePreview('#p1.a$c')).toMatchObject({ ok: false, code: 'bad-encoding' });
    expect(await decodePreview('#p1.AAAA')).toMatchObject({ ok: false, code: 'corrupt' });
  });
});

/** `n` digits from a fixed linear congruential sequence: text deflate can barely shrink, the same on every run. */
function noise(n: number): string {
  let x = 1;
  return Array.from({ length: n }, () => String(((x = (x * 1103515245 + 12345) % 2 ** 31) >> 16) % 10)).join('');
}

/**
 * THE LARGEST PREVIEW A PIECE CAN HAVE: the metro station's spec (the
 * biggest built-in, about 3,840 characters) with its note grown, in digits
 * that barely compress, to just under the fragment cap.
 */
async function largestPreview(): Promise<string> {
  const seed = DECORATED_SEEDS.find((s) => s.id === 'MS')!;
  const withNote = (n: number) => ({ ...specAs('MS9', seed), dimensions: { status: 'unverified', source: seed.dimensions.source, note: noise(n) } });
  let lo = 0, hi = 1000, best = '';
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = await encodePreview(withNote(mid));
    if (r.ok) [best, lo] = [r.fragment, mid + 1];
    else hi = mid - 1;
  }
  return best;
}

/** The draft brief's issue body (docs/brief/draft.md, step 9) with `figures` rows and the preview link, minus what goes in by file. */
const issueBody = (link: string, figures: number) => `**What is the piece?** A double-arch bridge over a straight, two orange arches each side

**Which pieces does it join?** Any straight, both ends

**Markings:** "Made in" and a six-digit number, the maker's name left out

**Medium and long straight:** yes, both

Drawn with the contributor brief 0.6 (2026-11-10), repository 7f2f516.
Measured from 3 photos that stay with the sender.

Preview: ${link}

| Figure | Value | Source |
|---|---|---|
${Array.from({ length: figures }, (_, i) => `| figure ${i + 1}, end to end | ${(200 + i * 1.37).toFixed(2)} mm | photo ${(i % 3) + 1}, line ${i + 1} |`).join('\n')}

Started 14:02, first figure 14:50.

- [ ] I license this drawing under this repository's licence (MIT).`;

describe('the size budget', () => {
  /*
   * MUTATION PROOF, run: the PREVIEW_MAX_CHARS check in encodePreview made
   * `if (false)`. Fails with `AssertionError: expected true to be false //
   * Object.is equality` (and the worst case below, its preview then over the
   * cap, with `expected false to be true`).
   */
  it('a fragment over 4,096 characters is refused', async () => {
    const seed = DECORATED_SEEDS.find((s) => s.id === 'MS')!;
    const over = { ...specAs('MS9', seed), dimensions: { status: 'unverified', source: seed.dimensions.source, note: noise(1000) } };
    const r = await encodePreview(over);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toMatch(/^the preview fragment is \d+ characters, over the 4096 cap$/);
    expect(await decodePreview(`${PREVIEW_PREFIX}${'A'.repeat(PREVIEW_MAX_CHARS)}`)).toMatchObject({ ok: false, code: 'too-long' });
  });

  /*
   * MUTATION PROOF, run: each value encoded twice in issueLink
   * (`encodeURIComponent(encodeURIComponent(v!))`). Fails with
   * `AssertionError: expected false to be true // Object.is equality`: the
   * link grows past the cap and is refused. Measured as written: the
   * fragment is 4,096 characters and the link 7,983 bytes.
   */
  it('the worst case: the largest preview and 30 figures, URL-encoded, fits under 8,192 bytes', async () => {
    const fragment = await largestPreview();
    expect(fragment.length).toBeGreaterThan(PREVIEW_MAX_CHARS - 16);
    const r = issueLink('Piece: a double-arch bridge over a straight', issueBody(`${SITE}${fragment}`, 30));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.link.startsWith(`${NEW_ISSUE}?title=Piece%3A%20a%20double-arch`)).toBe(true);
      expect(new TextEncoder().encode(r.link).byteLength).toBeLessThanOrEqual(ISSUE_MAX_BYTES);
      expect(decodeURIComponent(new URL(r.link).searchParams.get('body')!)).toContain(fragment);
    }
  });

  /*
   * MUTATION PROOF, run: the ISSUE_MAX_BYTES check in issueLink made
   * `if (false)`. Fails with `AssertionError: expected true to be false //
   * Object.is equality`.
   */
  it('one over the cap is refused, saying by how much', async () => {
    const fragment = await largestPreview();
    const r = issueLink('Piece: a double-arch bridge over a straight', issueBody(`${SITE}${fragment}`, 60));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refused).toMatchObject({ code: 'issue-too-long', reasons: [expect.stringMatching(/^the issue link is \d+ bytes, over the 8192 cap$/)] });
  });

  /*
   * MUTATION PROOF, run: issueLink's brand check made `if (false)`. Fails
   * with `AssertionError: expected { ok: true, …(1) } to match object { ok:
   * false, …(1) }`.
   */
  it('a brand name in the issue text is refused, and a template is passed on', async () => {
    const { TERMS } = await import('../data/brandWords.js');
    expect(issueLink(`Piece: a ${TERMS[0]} bridge`, 'x')).toMatchObject({ ok: false, refused: { code: 'brand' } });
    const r = issueLink('Piece: x', 'y', 'drawn-piece.yml');
    expect(r.ok && r.link.endsWith('&template=drawn-piece.yml')).toBe(true);
  });
});

describe('the command line', () => {
  const run = async (argv: string[], read: (f: string) => string = () => { throw Object.assign(new Error('no'), { code: 'ENOENT' }); }) => {
    const out: string[] = [], err: string[] = [];
    const code = await main(argv, { read, out: (l) => out.push(l), err: (l) => err.push(l) });
    return { code, out, err };
  };

  /*
   * MUTATION PROOF, run: `refused` always exiting 1. Fails with
   * `AssertionError: expected 1 to be 2 // Object.is equality` on the
   * unreadable file.
   */
  it('exit 0 done, 1 refused, 2 usage; every refusal ends with its fix', async () => {
    expect((await run(['--help'])).code).toBe(0);
    const none = await run([]);
    expect(none.code).toBe(2);
    expect(none.err[0]).toMatch(/^USAGE usage: no command given/);
    expect((await run(['encode', 'missing.json'])).code).toBe(2);
    expect((await run(['issue', '--title', 'x'])).code).toBe(2);
    const notJson = await run(['encode', 'piece.json'], () => '{');
    expect(notJson.code).toBe(1);
    expect(notJson.err[0]!.split('\n').at(-1)).toBe('make the file valid JSON: one piece, as the library writes one (engine/src/parts/schema.ts)');
    const issue = await run(['issue', '--title', 'Piece: x', '--body-file', 'b.md'], () => 'body');
    expect(issue).toMatchObject({ code: 0, out: [`${NEW_ISSUE}?title=Piece%3A%20x&body=body`] });
  });
});
