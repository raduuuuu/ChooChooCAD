/**
 * THE SHEET (plan 2026-11-14, design DD4, DD11; eng ED1).
 *
 * Value: protects=the sheet opens as the browser's dialog and shows its
 * contents only while open; Close, a tap outside its box and the browser
 * closing it each ask the owner to close, once; a tap inside does not; the
 * scroll position is kept in the owner's ref and put back on the next opening;
 * the stylesheet gives it no motion and a first row that does not scroll
 * Value: fails_when=Close stops closing, a tap in the list closes the sheet,
 * a tap outside is ignored, the list forgets where it was, or the sheet is
 * given a slide
 * Value: why_new=the app's first dialog, and the phone's only way to the
 * pieces
 * Value: seam=the real component under jsdom, on the dialog stand-in in
 * `app/test/domSetup.ts` (showModal opens, close shuts and fires `close`);
 * the stylesheet as text
 * Value: no_claim=Escape, focus held in the sheet, focus going back to its
 * button, the plan behind being unreachable: the browser's own behaviour,
 * checked on a real phone (task T12), since here they would test the stand-in
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Sheet } from './Sheet.js';

/** An owner as the phone's shell will be: it holds `open` and the scroll ref. */
function Owner({ asked }: { asked: string[] }) {
  const [open, setOpen] = useState(false);
  const scroll = useRef(0);
  return (
    <>
      <button onClick={() => setOpen(true)}>Pieces</button>
      <Sheet
        open={open}
        title="Pieces"
        scroll={scroll}
        onClose={() => {
          asked.push('close');
          setOpen(false);
        }}
      >
        <button className="inside">A card</button>
      </Sheet>
    </>
  );
}
const mount = () => {
  const asked: string[] = [];
  const { container, getByText } = render(<Owner asked={asked} />);
  const dialog = container.querySelector('dialog')!;
  return { asked, dialog, openIt: () => fireEvent.click(getByText('Pieces')) };
};

describe('the sheet', () => {
  /*
   * MUTATION PROOFS, run:
   * - `showModal()` never called: `expected false to be true` (the dialog
   *   stays shut).
   * - contents drawn while shut (`open &&` dropped): `expected <button …>
   *   to be null`.
   */
  it('is shut and empty until opened, then a labelled dialog with its contents', () => {
    const { dialog, openIt } = mount();
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(dialog.querySelector('.inside')).toBeNull();
    openIt();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('aria-label')).toBe('Pieces');
    expect(dialog.querySelector('.sheet-title')?.textContent).toBe('Pieces');
    expect(dialog.querySelector('.inside')?.textContent).toBe('A card');
  });

  /*
   * MUTATION PROOFS, run:
   * - Close given no handler: `expected [] to deeply equal [ 'close' ]`.
   * - the effect not calling `close()`: `expected true to be false` (the
   *   owner said shut, the dialog stays open).
   * - `onClose` on the dialog not guarded by `open`: `expected [ 'close',
   *   'close' ] to deeply equal [ 'close' ]` (the dialog's own `close` event
   *   asks a second time).
   */
  it('Close asks once, and the dialog shuts', () => {
    const { asked, dialog, openIt } = mount();
    openIt();
    fireEvent.click(dialog.querySelector('.sheet-close')!);
    expect(asked).toEqual(['close']);
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(dialog.querySelector('.inside')).toBeNull();
  });

  /*
   * MUTATION PROOFS, run:
   * - the outside-tap handler removed: `expected [] to deeply equal
   *   [ 'close' ]`.
   * - the handler without its target check: every click inside reaches it,
   *   so Close asks twice (`expected [ 'close', 'close' ] to deeply equal
   *   [ 'close' ]`) and a tap on a card would close the sheet.
   */
  it('a tap outside its box asks to close; a tap inside does not', () => {
    const { asked, dialog, openIt } = mount();
    openIt();
    fireEvent.click(dialog.querySelector('.inside')!);
    fireEvent.click(dialog.querySelector('.sheet-body')!);
    expect(asked).toEqual([]);
    // The browser reports a tap on the backdrop as a click on the dialog itself.
    fireEvent.click(dialog);
    expect(asked).toEqual(['close']);
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  /*
   * MUTATION PROOF, run: the dialog's `onClose` removed: `expected [] to
   * deeply equal [ 'close' ]` (the browser shut it and the owner never heard).
   */
  it('the browser closing it (Escape) tells the owner', () => {
    const { asked, dialog, openIt } = mount();
    openIt();
    act(() => dialog.close());
    expect(asked).toEqual(['close']);
    expect(dialog.querySelector('.inside')).toBeNull();
  });

  /*
   * MUTATION PROOFS, run:
   * - the scroll not saved: `expected +0 to be 120`.
   * - not put back on opening: the same message.
   */
  it('remembers where its list was scrolled to', () => {
    const { dialog, openIt } = mount();
    openIt();
    const body = dialog.querySelector<HTMLElement>('.sheet-body')!;
    body.scrollTop = 120;
    fireEvent.scroll(body);
    fireEvent.click(dialog.querySelector('.sheet-close')!);
    openIt();
    expect(dialog.querySelector<HTMLElement>('.sheet-body')!.scrollTop).toBe(120);
  });
});

describe('the sheet in the stylesheet', () => {
  const css = readFileSync(join(__dirname, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1]!.trim() === selector).map((m) => m[2]!).join(';');

  /*
   * MUTATION PROOFS, run:
   * - `transition: transform 200ms` added to `.sheet`: `expected '…' not to
   *   match /transition|animation/`.
   * - `.sheet-head` given `flex: 1` in place of `flex: none`: `expected '…'
   *   to match /flex:\s*none/`.
   * - `.sheet-close` at `min-height: 36px`: `expected 36 to be greater than
   *   or equal to 44`.
   */
  it('has no motion, a first row that keeps its height, and a 44px Close', () => {
    expect(rule('.sheet')).not.toMatch(/transition|animation/);
    expect(rule('.sheet::backdrop')).not.toMatch(/transition|animation/);
    expect(rule('.sheet-head')).toMatch(/flex:\s*none/);
    expect(rule('.sheet-body')).toMatch(/overflow-y:\s*auto/);
    expect(Number(rule('.sheet-close').match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44);
  });
});
