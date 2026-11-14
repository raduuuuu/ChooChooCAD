/**
 * FINISH THE LOOP, ON SCREEN (plan 2026-11-14, E3).
 *
 * Value: protects=a layout with one joint that does not meet offers to find
 * the pieces that close it; the fills found are buttons; pressing one closes
 * the gap in one undoable step; an answer found for another layout, box or
 * library is never shown or applied
 * Value: fails_when=the offer is missing or shown where there is no single
 * gap, a fill does not close the loop, undo does not bring the gap back, or
 * a late result lands on a layout it was not found for
 * Value: seam=jsdom plus testing-library, in the `dom` project
 * Value: no_claim=nothing about how the offer looks or where it sits; that
 * was checked in a browser. The search itself is pinned in
 * finishLoop.test.ts and engine/test/fill.test.ts
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { portsOf, type Piece } from '../../engine/src/graph/model.js';
import { App } from './App.js';
import { FinishLoop, type FinishLoopProps } from './FillOffer.js';
import { presetByLabel } from './presets.js';
import { presetGraph } from './presetVerdict.js';

const FIND = 'Find pieces that close the 72mm gap';
const offer = () => screen.queryByRole('button', { name: FIND });
const preset = (label: string) =>
  screen.getAllByRole('button').find((b) => b.textContent === label && b.closest('.palette-controls'))!;

describe('finish the loop, in the app', () => {
  /*
   * MUTATION PROOF, run: `unmet.length !== 1` made `unmet.length === 1` in
   * App.tsx's `finishGap` (offered except where there is one gap): Near miss
   * then has no offer.
   */
  it('is offered for a loop with one joint that does not meet, and not for one that closes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(preset('Stadium'));
    expect(offer()).toBe(null);
    await user.click(preset('Near miss'));
    expect(offer()).not.toBe(null);
  });

  /*
   * MUTATION PROOF, run: `onFill` in App.tsx made to do nothing: the fill's
   * button is pressed and the layout still does not say it works.
   */
  it('finds the piece, closes the gap in one step, and undo brings the gap back', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(preset('Near miss'));
    expect(document.body.textContent).not.toContain('This works.');
    await user.click(offer()!);
    const add = await screen.findByRole('button', { name: 'Add 1 × Middle straight' });
    expect(document.body.textContent).toContain('This closes it exactly:');
    expect(document.body.textContent).toContain('Every plain piece was tried, not only the ones you own.');
    await user.click(add);
    expect(document.body.textContent).toContain('This works.');
    expect(offer()).toBe(null);
    await user.click(screen.getByRole('button', { name: 'Undo added pieces' }));
    expect(offer()).not.toBe(null);
    expect(document.body.textContent).not.toContain('This works.');
  });
});

describe('an answer belongs to the layout it was found for', () => {
  const resolve = makeResolver(BUILT_IN);
  const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
  const near = presetGraph(presetByLabel('Near miss'));
  const closing = near.welds[near.welds.length - 1]!;
  const props = (over: Partial<FinishLoopProps> = {}): FinishLoopProps => ({
    graph: near,
    ports,
    resolve,
    parts: BUILT_IN,
    brandFit,
    inventory: null,
    from: closing.a,
    to: closing.b,
    gapMm: 72,
    onFill: vi.fn(),
    ...over,
  });
  /** The same layout as a new object: what any edit produces, even one that changes nothing a fill cares about. */
  const edited = { ...near };

  /*
   * THE RESULT ARRIVES AFTER THE EDIT. MUTATION PROOF, run: the two
   * `same(basis, current.current)` checks in FillOffer.tsx removed, AND the
   * `shown` line made to trust `phase`: a fill found for the old layout is
   * then listed over the new one.
   */
  it('drops a result that comes back after the layout changed', async () => {
    const user = userEvent.setup();
    const view = render(<FinishLoop {...props()} />);
    await user.click(offer()!);
    view.rerender(<FinishLoop {...props({ graph: edited })} />);
    // Long enough for the search to have come back, had it been kept.
    await new Promise((done) => setTimeout(done, 150));
    expect(screen.queryByRole('button', { name: /^Add / })).toBe(null);
    expect(offer()).not.toBe(null);
  });

  /*
   * THE EDIT ARRIVES AFTER THE RESULT, and so does a change of box, with no
   * edit at all (eng review, finding 4). MUTATION PROOF, run: `same` made to
   * compare the layout only: the fill stays listed after the box changes.
   */
  it('takes an answer down when the layout or the box changes under it', async () => {
    const user = userEvent.setup();
    const view = render(<FinishLoop {...props()} />);
    await user.click(offer()!);
    await screen.findByRole('button', { name: 'Add 1 × Middle straight' });
    view.rerender(<FinishLoop {...props({ inventory: { E: 8, D: 1, A: 1 } })} />);
    expect(screen.queryByRole('button', { name: /^Add / })).toBe(null);
    expect(offer()).not.toBe(null);

    await user.click(offer()!);
    // That box has no middle straight to spare, and says so in the box's words.
    await waitFor(() => expect(document.body.textContent).toContain('Only pieces your box has spare were tried.'));
    view.rerender(<FinishLoop {...props({ inventory: { E: 8, D: 1, A: 1 }, graph: edited })} />);
    expect(document.body.textContent).not.toContain('Only pieces your box has spare were tried.');
  });

  /*
   * MUTATION PROOF, run: `onFill(fill, shown.basis.graph)` handing back no
   * layout (`undefined as never`): the reducer's guard compares against it,
   * so without it every fill is refused. (Handing back the layout ON SCREEN
   * instead cannot be told apart here: an answer is only shown while the two
   * are the same object. That version was tried and stayed green.)
   */
  it('hands back the layout the fill was found for', async () => {
    const user = userEvent.setup();
    const onFill = vi.fn();
    render(<FinishLoop {...props({ onFill })} />);
    await user.click(offer()!);
    await user.click(await screen.findByRole('button', { name: 'Add 1 × Middle straight' }));
    expect(onFill).toHaveBeenCalledTimes(1);
    expect(onFill.mock.calls[0]![1]).toBe(near);
    expect(onFill.mock.calls[0]![0].pieces.map((p: { partId: string }) => p.partId)).toEqual(['A3']);
  });
});
