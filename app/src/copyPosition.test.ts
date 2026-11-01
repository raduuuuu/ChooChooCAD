/**
 * NO SCREEN DIRECTIONS IN WHAT THE APP SAYS (share plan, design 16A; eng D73;
 * DESIGN.md rule 7).
 *
 * Value: protects=no sentence on screen points at a place ("the verdict
 * below"), which is wrong on a phone, where things stack differently, and
 * meaningless to a screen reader
 * Value: fails_when=visible text or a string literal in app or engine code
 * says below, above, underneath, on/to the left or right, left- or
 * right-hand, or at the top/bottom
 * Value: why_new=TrackCanvas said "the verdict below" until this change
 * Value: seam=none; read with the TypeScript parser, so comments never count
 * and movement commands ("turning left", "arrows turn") are not position
 * words
 * Value: no_claim=text built from fragments that only form a phrase when
 * joined; app/src/repro.ts, the crash-repro script read in a text editor,
 * where "the graph below" is true
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..');
const POSITION = /\b(below|above|underneath)\b|\b(on|to) the (left|right)\b|\b(left|right)-hand\b|\bat the (top|bottom)\b/i;
const NOT_UI = new Set(['app/src/repro.ts']);

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Every text node and string literal in `text` that names a screen position, as `file:line`. */
export function positionWords(file: string, text: string): string[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    const words =
      ts.isJsxText(n) || ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)
        ? n.getText()
        : null;
    if (words !== null && POSITION.test(words)) out.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

describe('the copy names no screen position', () => {
  /*
   * MUTATION PROOF, run: TrackCanvas's sentence put back to "the verdict
   * below applies to all of it": `expected [ 'app/src/TrackCanvas.tsx:772' ]
   * to deeply equal []`.
   */
  it('in any app or engine source', () => {
    const files = [...sources('app/src'), ...sources('engine/src'), ...sources('engine/data')].filter((f) => !NOT_UI.has(f));
    expect(files.flatMap((f) => positionWords(f, readFileSync(join(ROOT, f), 'utf8')))).toEqual([]);
  });

  it('catches the words in text and strings, and leaves comments and movement alone', () => {
    const src = [
      "const a = 'see the list below';",
      '// the verdict below',
      'const b = <p>Turning left, arrows turn</p>;',
      'const c = <p>tap the button on the right</p>;',
      'const d = `${1} pieces above`;',
    ].join('\n');
    expect(positionWords('x.tsx', src)).toEqual(['x.tsx:1', 'x.tsx:4', 'x.tsx:5']);
  });
});
