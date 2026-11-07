/**
 * A MISSING COLOUR TOKEN DRAWS IN INK AND SAYS SO (design review of the 3D
 * view, D2).
 *
 * Value: protects=a renamed or deleted CSS token paints its 3D surface in
 * `--ink`, inside the palette, and names itself on the console
 * Value: fails_when=the fallback goes back to a silent `#000`
 * Value: why_new=found by the design review; nothing read the fallback
 * Value: seam=`tokenColors` reads a real element's computed style under jsdom,
 * with the tokens set inline
 * Value: no_claim=which tokens the stylesheet actually defines; the browser
 * pass and `tokens.css` are that
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAINT_TOKENS } from '../../engine/data/library.js';
import { tokenColors } from './Viewer3D.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('3D colour tokens (design review D2)', () => {
  /*
   * MUTATION PROOF, run: the fallback restored to `|| '#000'` with no log:
   * `expected '#000' to be '#2a2724'`.
   */
  it('a missing token falls back to --ink and logs its name', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = document.createElement('div');
    root.style.setProperty('--ink', '#2a2724');
    root.style.setProperty('--floor', '#ece6da');
    document.body.appendChild(root);
    const c = tokenColors(root);
    expect(c.floor).toBe('#ece6da');
    expect(c.slabSide).toBe('#2a2724');
    expect(err).toHaveBeenCalledWith('3D view: the colour token --slab-side is missing; drawing it in --ink.');
    root.remove();
  });

  /*
   * MUTATION PROOF, run: no paint read at mount (`paints: {}`): `expected []
   * to deeply equal [ '--ink', '--ink-soft', …(6) ]`. The panel handing the
   * list in is view3d.dom.test.tsx's.
   */
  it('reads every built-in paint once, so a station added later is coloured; a missing one is ink and named (paint plan O2)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = document.createElement('div');
    root.style.setProperty('--ink', '#2a2724');
    root.style.setProperty('--paint-roof', '#638e70');
    document.body.appendChild(root);
    const c = tokenColors(root, PAINT_TOKENS);
    expect(Object.keys(c.paints ?? {}).sort()).toEqual([...PAINT_TOKENS].sort());
    expect(c.paints?.['--paint-roof']).toBe('#638e70');
    expect(c.paints?.['--paint-red']).toBe('#2a2724');
    expect(err).toHaveBeenCalledWith('3D view: the colour token --paint-red is missing; drawing it in --ink.');
    root.remove();
  });
});
