/**
 * ONLY THE VIEWER LOADS THREE.JS (3D plan, eng D11).
 *
 * Value: protects=Three.js and the 3D mesh builder stay in the lazy chunk:
 * no source file but `app/src/Viewer3D.tsx` imports them for real, and only a
 * dynamic `import()` reaches the viewer
 * Value: fails_when=any production file gains a value import of `three`,
 * `three/...`, `engine/src/view3d/...` or `./Viewer3D`
 * Value: why_new=the editor's size depended on nobody writing one import
 * Value: seam=none; read with the TypeScript parser, not a regex, because
 * four regex versions of an import guard were defeated in this repo
 * (`engine/test/sources.test.ts`)
 * Value: no_claim=the bundle's actual size; `scripts/chunkBudget.ts` in CI is
 * that check
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..');
const VIEWER = 'app/src/Viewer3D.tsx';
const VIEW3D_DIR = 'engine/src/view3d/';

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Each import a file makes at run time (type-only ones vanish), with whether it is a dynamic `import()`. */
export function valueImports(file: string, text: string): { spec: string; dynamic: boolean }[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { spec: string; dynamic: boolean }[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause;
      const typeOnly =
        c !== undefined &&
        (c.isTypeOnly ||
          (c.name === undefined &&
            c.namedBindings !== undefined &&
            ts.isNamedImports(c.namedBindings) &&
            c.namedBindings.elements.length > 0 &&
            c.namedBindings.elements.every((e) => e.isTypeOnly)));
      if (!typeOnly) out.push({ spec: n.moduleSpecifier.text, dynamic: false });
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly) {
      out.push({ spec: n.moduleSpecifier.text, dynamic: false });
    } else if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteralLike(n.arguments[0]!)) {
      const callee = n.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword) out.push({ spec: (n.arguments[0] as ts.StringLiteral).text, dynamic: true });
      else if (ts.isIdentifier(callee) && callee.text === 'require') out.push({ spec: (n.arguments[0] as ts.StringLiteral).text, dynamic: false });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Why `file` importing `spec` breaks the rule, or null. */
export function offence(file: string, spec: string, dynamic: boolean): string | null {
  if (file === VIEWER) return null;
  if (spec === 'three' || spec.startsWith('three/')) return `${file} imports ${spec}`;
  if (!spec.startsWith('.')) return null;
  const target = relative(ROOT, resolvePath(ROOT, dirname(file), spec)).replace(/\\/g, '/');
  if (target.startsWith(VIEW3D_DIR) && !file.startsWith(VIEW3D_DIR)) return `${file} imports ${spec}`;
  if (/^app\/src\/Viewer3D(\.js|\.tsx)?$/.test(target) && !dynamic) return `${file} imports the viewer statically`;
  return null;
}

describe('only the viewer loads three (eng D11)', () => {
  /*
   * MUTATION PROOF, run: `import 'three';` added at the top of App.tsx:
   * `expected [ 'app/src/App.tsx imports three' ] to deeply equal []`.
   */
  it('no production file but Viewer3D.tsx imports three, the mesh builder, or the viewer itself', () => {
    const found = [...sources('app/src'), ...sources('engine/src')].flatMap((file) =>
      valueImports(file, readFileSync(join(ROOT, file), 'utf8')).flatMap(({ spec, dynamic }) => {
        const why = offence(file, spec, dynamic);
        return why ? [why] : [];
      }),
    );
    expect(found).toEqual([]);
  });

  it('catches every way in, and lets the allowed ones through', () => {
    const check = (text: string, file = 'app/src/App.tsx') =>
      valueImports(file, text).flatMap(({ spec, dynamic }) => (offence(file, spec, dynamic) ? [spec] : []));
    expect(check(`import { Scene } from 'three';`)).toEqual(['three']);
    expect(check(`import x from "three/examples/jsm/controls/OrbitControls.js";`)).toEqual(['three/examples/jsm/controls/OrbitControls.js']);
    expect(check(`export { buildScene } from '../../engine/src/view3d/mesh.js';`)).toEqual(['../../engine/src/view3d/mesh.js']);
    expect(check(`import V from './Viewer3D.js';`)).toEqual(['./Viewer3D.js']);
    expect(check(`const t = require('three');`)).toEqual(['three']);
    // Allowed: types only, and the lazy import.
    expect(check(`import type { SceneInput } from '../../engine/src/view3d/mesh.js';`)).toEqual([]);
    expect(check(`import { type Viewer3DProps } from './Viewer3D.js';`)).toEqual([]);
    expect(check(`const V = lazy(() => import('./Viewer3D.js'));`)).toEqual([]);
    // And the viewer itself may import anything.
    expect(check(`import { Scene } from 'three';`, VIEWER)).toEqual([]);
  });
});
