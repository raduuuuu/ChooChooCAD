/**
 * NOBODY READS `Frame.level` BUT `levelOf` (eng decision SC1 of the two-layer
 * review).
 *
 * The level is absent on the floor, so a raw `f.level` is `undefined` there
 * and arithmetic on it is NaN: `f.level + 1` on a floor frame silently loses
 * the track. `levelOf` answers 0. This walks every source file with the
 * TypeScript checker and fails on any property access named `level` whose
 * receiver is a `Frame`, outside model.ts where `levelOf` itself lives.
 *
 * A checker, not a regex (prior learning
 * four-regex-versions-of-an-import-guard-all-got-defeated, 2026-10-20): other
 * types have a legitimate `level` (`PlacedPort.level`, `Segment.level`), so
 * the question is about TYPES, and only the checker can answer it.
 *
 * Value: protects=every reader of a frame's level going through levelOf
 * Value: fails_when=a source file reads `.level` on a Frame directly
 * Value: why_new=Frame.level is new and optional
 * Value: seam=none
 * Value: no_claim=reads through a destructuring pattern (`const { level } =
 * f`), which this does not inspect
 */

import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** Every `x.level` where `x` is typed `Frame`, as `file:line`. */
function directFrameLevelReads(files: readonly string[]): string[] {
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const hits: string[] = [];
  for (const sf of program.getSourceFiles()) {
    if (!files.includes(sf.fileName) || sf.fileName.endsWith(join('graph', 'model.ts'))) continue;
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'level') {
        const type = checker.getTypeAtLocation(node.expression);
        const names = [type, ...(type.isUnion() ? type.types : [])].map((t) => (t.aliasSymbol ?? t.getSymbol())?.getName());
        if (names.includes('Frame')) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
          hits.push(`${relative(ROOT, sf.fileName)}:${line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return hits;
}

describe('Frame.level is read only through levelOf', () => {
  /*
   * MUTATION PROOF, run: `levelOf(f)` in `placeAll`'s normalisation loop
   * rewritten as `f.level ?? 0`: fails with `expected [
   * 'engine/src/graph/frames.ts:135' ] to deeply equal []`.
   */
  it('no source file outside model.ts reads it directly', { timeout: 60_000 }, () => {
    const files = [...sources(join(ROOT, 'engine', 'src')), ...sources(join(ROOT, 'engine', 'data')), ...sources(join(ROOT, 'app', 'src'))];
    expect(directFrameLevelReads(files)).toEqual([]);
  });
});
