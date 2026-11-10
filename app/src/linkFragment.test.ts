/**
 * WHAT A VISIT IS COUNTED AS, AND WHEN THERE IS A COUNTER AT ALL (plan
 * 2026-11-01, P4, R4, eng X3; wired by the app-focus review, D8).
 *
 * Value: protects=a shared layout's address is counted as `/shared-link`,
 * never with its fragment; the counter exists only in a production build with
 * a well-formed site code; the committed count.js is the copy that was read
 * Value: fails_when=the path carries the fragment, a dev build or a missing
 * code gets a counter, a code can bend the endpoint, or count.js changes
 * unreviewed
 * Value: why_new=analytics is new
 * Value: seam=none: pure functions and the file's bytes
 * Value: no_claim=what count.js sends (counter.dom.test.tsx)
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PREVIEW_FRAGMENT } from '../../engine/data/previewLink.js';
import { counterTag, countedPath, PIECE_FRAGMENT, routeOf } from './linkFragment.js';

describe('the counted path', () => {
  /*
   * MUTATION PROOF, run: `countedPath` returning `pathname + hash`:
   * `expected '' to be '/' // Object.is equality`.
   */
  it('is /shared-link for every shared-layout address and the page path otherwise', () => {
    expect(countedPath('', '/')).toBe('/');
    expect(countedPath('', '')).toBe('/');
    expect(countedPath('#v1.abcDEF', '/')).toBe('/shared-link');
    expect(countedPath('#v9.xyz', '/')).toBe('/shared-link');
    // Not a link (no dot): the editor opens, and its path is the page's.
    expect(countedPath('#v1', '/')).toBe('/');
  });

  /*
   * MUTATION PROOF, run: `countedPath` without its piece branch (a preview
   * counted under the page's path): `expected '/' to be '/piece-preview'`.
   */
  it('is /piece-preview for every piece preview, so a sent piece is never sent on (contributor-brief T4)', () => {
    expect(countedPath('#p1.abcDEF', '/')).toBe('/piece-preview');
    expect(countedPath('#p2.xyz', '/')).toBe('/piece-preview');
    expect(countedPath('#p1', '/')).toBe('/');
  });
});

describe('which screen an address opens (main.tsx)', () => {
  /*
   * MUTATION PROOF, run: `routeOf` testing only LINK_FRAGMENT (`'piece'`
   * branch dropped, so a preview opens the editor): `expected 'editor' to be
   * 'piece'`.
   */
  it('a #p<n>. address opens the piece preview, #v<n>. the shared layout, anything else the editor', () => {
    expect(routeOf('#p1.abc')).toBe('piece');
    expect(routeOf('#p9.abc')).toBe('piece');
    expect(routeOf('#v1.abc')).toBe('layout');
    expect(routeOf('')).toBe('editor');
    expect(routeOf('#p1')).toBe('editor');
  });

  /*
   * The app's copy of the pattern (kept out of the validator's chunk) is the
   * engine's. MUTATION PROOF, run: PIECE_FRAGMENT written `/^#p(\d+)/`
   * (no dot): `expected '^#p(\d+)' to be '^#p(\d+)\.'`.
   */
  it('recognises a preview exactly as the engine decodes one', () => {
    expect(PIECE_FRAGMENT.source).toBe(PREVIEW_FRAGMENT.source);
  });
});

describe('the counter tag', () => {
  /*
   * MUTATION PROOF, run: the production check dropped: `expected { src:
   * '/count.js', …(1) } to be null`.
   */
  it('exists only in production with a well-formed code', () => {
    expect(counterTag('', true)).toBeNull();
    expect(counterTag('woodentrain', false)).toBeNull();
    expect(counterTag('woodentrain', true)).toEqual({ src: '/count.js', endpoint: 'https://woodentrain.goatcounter.com/count' });
    expect(counterTag('evil.example/x?', true)).toBeNull();
    expect(counterTag('Upper', true)).toBeNull();
  });

  /*
   * THE COMMITTED COPY IS THE ONE THAT WAS READ (2026-11-04: from
   * https://gc.zgo.at/count.js, 9,213 bytes, ISC). It reads `location.hash`
   * only for its own `#toggle-goatcounter` switch and sends the path we set,
   * the referrer, the page title, the screen width, a bot flag and
   * `location.search`. A refresh is a new review, then a new hash here.
   * MUTATION PROOF, run: count.js edited (`is_bot` renamed): `expected
   * '2731479cf1cfb86e01da111e36b2c43018e13…' to be '792b7abd26c1fb6ae62906833e09a301251e2…'`.
   */
  it('count.js is the reviewed copy', () => {
    const sha = createHash('sha256').update(readFileSync(join(process.cwd(), 'app/public/count.js'))).digest('hex');
    expect(sha).toBe('792b7abd26c1fb6ae62906833e09a301251e2641816e69e4f95aba518f3fe3f0');
  });
});
