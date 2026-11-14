/**
 * THE SHELVES STAND ON THEIR OWN (plan 2026-11-14, E4, choice C6).
 *
 * Value: protects=`PieceShelves` draws every placeable part from what it is
 * handed, with no App around it: the picked card says it is pressed, a paused
 * layout disables every card and says why, a part past what the box holds is
 * marked and still pressable, and the other systems are closed shelves
 * Value: fails_when=the shelves read the picked piece, the box or the pause
 * from anywhere but their props, or a card past the box is disabled
 * Value: why_new=the palette was inline in App.tsx and could only be drawn
 * with the whole editor; a phone's sheet will draw it by itself
 * Value: seam=none: static markup through `react-dom/server`
 * Value: no_claim=clicks and drags; the editor's own DOM tests cover those
 * through App, unchanged by the cut
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { PieceShelves, paletteSize, type PieceShelvesProps } from './Palette.js';

const resolve = makeResolver(BUILT_IN);
const noDrag = (() => ({ swallowsClick: () => false })) as unknown as PieceShelvesProps['paletteDrag'];
const shelves = (over: Partial<PieceShelvesProps> = {}) =>
  renderToStaticMarkup(
    createElement(PieceShelves, {
      library: BUILT_IN,
      resolve,
      inventory: null,
      counts: {},
      overLimit: false,
      pickedId: null,
      paletteDrag: noDrag,
      onPick: () => {},
      onAdd: () => {},
      ...over,
    }),
  );
const cards = (html: string) => html.match(/<button class="piece-main"[^>]*>/g) ?? [];
const cardOf = (html: string, name: string) => cards(html).find((c) => c.includes(`aria-label="Add ${name}`))!;

describe('the shelves, drawn by themselves', () => {
  /*
   * MUTATION PROOF, run: the Structures row drawn empty in `renderBrand`:
   * `expected [ …(63) ] to have a length of 71 but got 63` (71 is the
   * library's own length, not a number written here).
   */
  it('has one card for every part in the library, and the other systems as closed shelves', () => {
    const html = shelves();
    expect(cards(html)).toHaveLength(BUILT_IN.length);
    expect(html.match(/<details class="brand-group is-collapsible">/g)!.length).toBeGreaterThan(0);
    expect(html).not.toContain('<details class="brand-group is-collapsible" open');
  });

  /*
   * MUTATION PROOF, run: `aria-pressed={pickedId === part.id}` made
   * `aria-pressed={false}`: `expected 'false' to be 'true'`.
   */
  it('says which card is picked, from the prop', () => {
    const pressed = (html: string, name: string) => /aria-pressed="(\w+)"/.exec(cardOf(html, name))![1];
    const html = shelves({ pickedId: 'D' });
    expect(pressed(html, 'Long straight')).toBe('true');
    expect(pressed(html, 'Short straight')).toBe('false');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  /*
   * MUTATION PROOF, run: `disabled={overLimit}` removed from the card:
   * `expected [] to have a length of 71 but got +0`.
   */
  it('paused, disables every card and says why', () => {
    const html = shelves({ overLimit: true });
    expect(cards(html).filter((c) => c.includes('disabled=""'))).toHaveLength(BUILT_IN.length);
    expect(html).toContain('Placing is paused: too much track to draw.');
    expect(shelves()).not.toContain('Placing is paused');
  });

  /*
   * ADVICE, NEVER A GATE (decision D8). MUTATION PROOF, run: the card given
   * `disabled={overLimit || unowned}`: `expected true to be false`.
   */
  it('marks a part past what the box holds, and leaves it pressable', () => {
    const html = shelves({ inventory: { D: 1 }, counts: { D: 1 } });
    const card = cardOf(html, 'Long straight');
    expect(card).toContain('More than you own.');
    expect(card.includes('disabled')).toBe(false);
    expect(html).toContain('<span class="piece-count num">1</span>');
  });
});

describe('a card\'s size', () => {
  /*
   * MUTATION PROOF, run: `paletteSize` returns the length for a curve too
   * (its `curve` line removed): `.toMatch() expects to receive a string,
   * but got undefined` (a curve has no size label to fall back on).
   */
  it('is a length for a straight and a radius for a curve', () => {
    expect(paletteSize(resolve('D'))).toBe('216mm');
    expect(paletteSize(resolve('E'))).toMatch(/^r\d+/);
  });
});
