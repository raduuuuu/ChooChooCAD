/**
 * `bun run brief:link`: the links the contributor brief hands over, built by
 * script, never by hand (contributor-brief plan, step 2, "The links, by a
 * script"; T3). The brief's Claude runs it in its sandbox; the maintainer
 * runs `decode` on the link an issue carries.
 *
 *   encode <piece.json> ──checkUntrustedPart──▶ #p1.<deflate + base64url> ≤ 4,096 chars
 *                       ──▶ https://woodentrain.world/#p1.…            (the preview link)
 *   issue --title <t> --body-file <f> ──▶ https://github.com/…/issues/new?title=…&body=…  ≤ 8,192 bytes
 *   decode <link or #p1.…> ──▶ the piece's JSON, checked as the preview checks it
 *
 * The codec and the validator are the app's own (engine/src/io/linkCodec.ts,
 * engine/data/untrustedPart.ts, engine/data/previewLink.ts), so what this
 * accepts the preview opens.
 *
 * Exit: 0 done; 1 refused (the piece, a cap, the link); 2 bad usage or a
 * file that can't be read. Every
 * refusal prints its code, what happened, and the fix on its last line, as
 * the photo tools do (photoMeasure.ts).
 */

import { readFileSync } from 'node:fs';
import { brandWords } from '../data/brandWords.js';
import { decodePreview, encodePreview, PREVIEW_MAX_CHARS, type PreviewRefusal } from '../data/previewLink.js';

/** Where the preview opens: the live app. */
export const SITE = 'https://woodentrain.world/';
/** Where an issue opens. */
export const NEW_ISSUE = 'https://github.com/raduuuuu/ChooChooCAD/issues/new';
/**
 * A prefilled issue link's cap, bytes: the share-link cap (LINK_MAX_CHARS,
 * app/src/shareLink.ts), which browsers and GitHub keep whole. Over it, a
 * link can arrive cut short, its body truncated without a word.
 */
export const ISSUE_MAX_BYTES = 8192;

const CODES = {
  usage: 'run with --help for the usage',
  unreadable: 'check the path: it is relative to where you run the command',
  'not-json': 'make the file valid JSON: one piece, as the library writes one (engine/src/parts/schema.ts)',
  invalid: 'fix each field named above in the piece file and run encode again',
  'too-long': 'the piece is too big for a preview link: stop here and say so in the chat (the brief\'s size budget)',
  'issue-too-long': 'shorten the body file: the figures table and the preview link go in the link; the points files, outputs and diff go in the body pasted from the file',
  brand: 'write "the maker" (or a trait, "small-peg") in place of the name, and run again',
  version: 'ask for the link again, copied whole; a newer link needs the newer app',
  'bad-encoding': 'ask for the link again, copied whole',
  corrupt: 'ask for the link again, copied whole',
  'too-large': 'refuse the link: no real piece unpacks that large',
  'old-runtime': 'run under Bun or Node 18 or newer',
  'not-json-link': 'ask for the link again, copied whole',
  internal: 're-run with the same input; if it happens again, report it with this message',
} as const;
export type BriefCode = keyof typeof CODES;

export interface BriefRefusal {
  readonly code: BriefCode;
  readonly reasons: readonly string[];
  readonly fix: string;
}

const refusal = (code: BriefCode, ...reasons: string[]): BriefRefusal => ({ code, reasons, fix: CODES[code] });

/** A refusal from the preview codec, under the script's own codes: the same names, but a link's JSON apart from a file's. */
const fromPreview = (code: PreviewRefusal, reasons: readonly string[]): BriefRefusal => {
  const own: BriefCode = code === 'not-json' ? 'not-json-link' : code;
  return { code: own, reasons, fix: CODES[own] };
};

/** The preview link for a piece's JSON text, or why not. */
export async function previewLink(json: string): Promise<{ ok: true; link: string } | { ok: false; refused: BriefRefusal }> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return { ok: false, refused: refusal('not-json', `the piece file is not JSON: ${(e as Error).message}`) };
  }
  const r = await encodePreview(data);
  return r.ok ? { ok: true, link: `${SITE}${r.fragment}` } : { ok: false, refused: fromPreview(r.code, r.reasons) };
}

/**
 * A prefilled new-issue link, or why not: over ISSUE_MAX_BYTES, or naming a
 * brand (the issue is public: AGENTS.md, plan S3-1). `template` is for the
 * issue forms (T5); without it the issue is a blank one.
 */
export function issueLink(title: string, body: string, template?: string): { ok: true; link: string } | { ok: false; refused: BriefRefusal } {
  for (const [what, text] of [['the title', title], ['the body', body]] as const) {
    if (brandWords(text).length > 0) return { ok: false, refused: refusal('brand', `${what} names a brand`) };
  }
  const params = [['title', title], ['body', body], ...(template ? [['template', template]] : [])];
  const link = `${NEW_ISSUE}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')}`;
  const bytes = new TextEncoder().encode(link).byteLength;
  if (bytes > ISSUE_MAX_BYTES) return { ok: false, refused: refusal('issue-too-long', `the issue link is ${bytes} bytes, over the ${ISSUE_MAX_BYTES} cap`) };
  return { ok: true, link };
}

/** The fragment in a link or a bare fragment: everything from its `#`. */
export const fragmentOf = (arg: string): string => {
  const at = arg.indexOf('#');
  return at < 0 ? arg : arg.slice(at);
};

export const HELP = `usage: bun engine/tools/briefLink.ts encode <piece.json>
       bun engine/tools/briefLink.ts issue --title <title> --body-file <body.md> [--template <form.yml>]
       bun engine/tools/briefLink.ts decode <preview link, or #p1.…>

  encode   checks the piece and prints its preview link, ${SITE}#p1.<data>
           (at most ${PREVIEW_MAX_CHARS} characters after the site). piece.json is one
           piece as the library writes one (engine/src/parts/schema.ts): a Part
           ("kind": straight, curve, multi-road or buffer; its own "decor" allowed)
           or a decorated piece's spec ("base": a built-in id, "decor", "id",
           "name", "dimensions"). dimensions.status is "unverified"; slop's
           calibrationStatus is "estimated"; no field the schema doesn't have.
  issue    prints a link that opens a new issue with the title and body filled
           in (at most ${ISSUE_MAX_BYTES} bytes). Put the preview link in the body.
           --template names an issue form, when the repository has them.
  decode   prints the piece's JSON back, checked as the preview checks it
           (for the maintainer's review).
  --help   this text

exit: 0 done · 1 refused · 2 bad usage, or a file that can't be read

A refusal prints its code, what happened, and the fix on its last line. Codes:
${Object.entries(CODES).map(([c, f]) => `  ${c.padEnd(16)}${f}`).join('\n')}`;

export interface Io {
  readonly read: (file: string) => string;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const IO: Io = { read: (f) => readFileSync(f, 'utf8'), out: (l) => console.log(l), err: (l) => console.error(l) };

/** Prints a refusal: code first, what happened, the fix last. */
const say = (io: Io, head: 'REFUSED' | 'USAGE', r: BriefRefusal) =>
  io.err(`${head} ${r.code}: ${r.reasons.length === 1 ? r.reasons[0] : `\n${r.reasons.map((x) => `  ${x}`).join('\n')}`}\n${r.fix}`);

/** The command line: parse, build or read the link, print, and the exit code. */
export async function main(argv: readonly string[], io: Io = IO): Promise<number> {
  const usage = (reason: string) => (say(io, 'USAGE', refusal('usage', reason)), 2);
  // A file that can't be read is bad usage, as photoMeasure.ts treats its points file.
  const refused = (r: BriefRefusal) => (say(io, r.code === 'unreadable' ? 'USAGE' : 'REFUSED', r), r.code === 'unreadable' ? 2 : 1);
  const read = (file: string): string | BriefRefusal => {
    try {
      return io.read(file);
    } catch (e) {
      return refusal('unreadable', `can't read ${file}: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`);
    }
  };
  try {
    if (argv.length === 0) return usage('no command given: encode, issue or decode');
    if (argv.includes('--help') || argv.includes('-h')) {
      io.out(HELP);
      return 0;
    }
    const [command, ...rest] = argv;
    if (command === 'encode' || command === 'decode') {
      if (rest.length !== 1 || rest[0]!.startsWith('--')) return usage(`${command} takes one ${command === 'encode' ? 'piece file' : 'link'}`);
      if (command === 'decode') {
        const r = await decodePreview(fragmentOf(rest[0]!));
        if (!r.ok) return refused(fromPreview(r.code, r.reasons));
        io.out(JSON.stringify(r.data, null, 2));
        return 0;
      }
      const text = read(rest[0]!);
      if (typeof text !== 'string') return refused(text);
      const r = await previewLink(text);
      if (!r.ok) return refused(r.refused);
      io.out(r.link);
      return 0;
    }
    if (command === 'issue') {
      const flags: Record<string, string> = {};
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i]!;
        if (a !== '--title' && a !== '--body-file' && a !== '--template') return usage(`unknown argument ${a}`);
        const v = rest[++i];
        if (v === undefined || v.startsWith('--')) return usage(`${a} needs a value after it`);
        flags[a] = v;
      }
      if (!flags['--title'] || !flags['--body-file']) return usage('issue needs --title and --body-file');
      const body = read(flags['--body-file']);
      if (typeof body !== 'string') return refused(body);
      const r = issueLink(flags['--title'], body, flags['--template']);
      if (!r.ok) return refused(r.refused);
      io.out(r.link);
      return 0;
    }
    return usage(`unknown command ${command}: encode, issue or decode`);
  } catch (e) {
    return refused(refusal('internal', (e as Error).message));
  }
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
