/**
 * SOCKET TO SOCKET IN THE APP (socket adapter plan, items 3, 4 and 6; X2;
 * eng review E2).
 *
 * Value: protects=an adapter joint gets an amber mark unless a red mark holds
 * the spot; the preview says "!" and needs-an-adapter for a two-socket piece
 * on a socket; Your box counts adapters, shows the shortfall in both places
 * and keeps the count through a quick-fill; Add a part refuses a reserved id
 * Value: fails_when=App stops passing the marks, the preview's third state,
 * the box's adapter row or the form's reserved-id check
 * Value: why_new=all new with the socket adapter
 * Value: seam=jsdom plus user-event, App mounted in StrictMode, layouts
 * seeded through storage as a reload would load them
 * Value: no_claim=the mark's pixels (no layout in jsdom; checked in a browser)
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY, INVENTORY_STORAGE_KEY } from './storageKeys.js';

/** Eight lattice coefficients: whole mm along x, and along y (zeta^4 is i). */
const pos = (x: number, y: number) => [x, 0, 0, 0, y, 0, 0, 0];

type Seed = { id: string; part: string; x: number; y: number; heading: number };
function mount(pieces: readonly Seed[], welds: readonly [string, number, string, number][], inventory?: object) {
  localStorage.setItem(
    GRAPH_STORAGE_KEY,
    JSON.stringify({
      pieces: pieces.map((p) => ({ pieceId: p.id, partId: p.part, turn: 'left' })),
      welds: welds.map(([a, ap, b, bp]) => ({ a: { pieceId: a, port: ap }, b: { pieceId: b, port: bp } })),
      anchors: pieces.map((p) => [p.id, { pos: pos(p.x, p.y), heading: p.heading }]),
    }),
  );
  if (inventory) localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return userEvent.setup();
}

/** Two medium straights start to start: their sockets meet at the origin. */
const START_TO_START: readonly Seed[] = [
  { id: 'a', part: 'A', x: 0, y: 0, heading: 0 },
  { id: 'r', part: 'A', x: 0, y: 0, heading: 8 },
];
const marks = (cls: string) => document.querySelectorAll(`g.${cls}`).length;
const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;

describe('the canvas marks where an adapter goes', () => {
  /*
   * MUTATION PROOFS, run:
   * - App not passing `adapterJoints` to the canvas: `expected +0 to be 1`.
   * - App not leaving out spots a red mark holds: the precedence spec fails
   *   with `expected 1 to be +0`.
   */
  it('one amber mark on a socket-to-socket joint, and the note', () => {
    mount(START_TO_START, [['a', 0, 'r', 0]]);
    expect(marks('adapter-joint-mark')).toBe(1);
    expect(document.body.textContent).toContain('Needs 1 male-male adapter: two sockets meet at 1 joint.');
  });

  it('a red clash on the same spot wins: no amber mark there', () => {
    // A third straight starting at the same spot, unjoined: a clash there.
    mount([...START_TO_START, { id: 'c', part: 'A', x: 0, y: 0, heading: 4 }], [['a', 0, 'r', 0]]);
    expect(marks('clash-mark')).toBeGreaterThan(0);
    expect(marks('adapter-joint-mark')).toBe(0);
    // ...and the note says why the count and the drawing differ (DR1).
    expect(document.body.textContent).toContain('1 is not marked, because a clash is drawn there.');
  });
});

describe('the preview says ◇ for a piece that needs an adapter', () => {
  /*
   * MUTATION PROOF, run: the third state removed (`adapter` forced false in
   * ghostView): fails with `expected 'O Two sockets meet here: needs a male…'
   * to match /^◇ Two sockets meet here: needs a mal…/`.
   */
  it('a two-socket piece on a straight’s start', async () => {
    const user = mount([{ id: 'a', part: 'A', x: 0, y: 0, heading: 0 }], []);
    // Select the start end as the cursor, then pick a two-socket straight.
    await user.click(screen.getByRole('button', { name: /start of piece 1/i }));
    await user.click(button(/^Add Medium straight, two sockets/));
    const status = within(screen.getByRole('group', { name: /Placing/ })).getByRole('status').textContent!;
    expect(status).toMatch(/^◇ Two sockets meet here: needs a male-male adapter\./);
    expect(status).not.toContain('!');
    expect(document.querySelector('.ghost')!.getAttribute('class')).toBe('ghost');
  });
});

describe('Your box counts male-male adapters', () => {
  /*
   * MUTATION PROOFS, run:
   * - the App shortfall line without the adapter part: fails with
   *   `expected 'Grid: 10 cm?Not a loop yet. 2 pieces,…' to match /Short
   *   by\s1\smale-male adapter\s+agai…/`.
   */
  it('a declared box with none: the verdict line says short by one, the panel shows it in use', async () => {
    const user = mount(START_TO_START, [['a', 0, 'r', 0]], { A: 2 });
    // A non-breaking space binds the number to its noun, as on the part line.
    expect(document.body.textContent).toMatch(/Short by\s1\smale-male adapter\s+against what you own\./);
    await user.click(button('Your box'));
    const panel = screen.getByRole('region', { name: 'What you own' });
    // The panel is plain counts (2026-11-05, B2): the shortfall is said by the verdict's line only.
    expect(panel.textContent).toContain('1 in use');
    expect(panel.textContent).not.toContain('This layout needs');
  });

  /*
   * MUTATION PROOF, run: the intro given "Fill the fields below." (2026-11-05):
   * fails with `expected 'What you ownDoneType how many of each…' not to match
   * /\bbelow\b/`.
   */
  it('the undeclared intro names no direction (DESIGN.md rule 7)', async () => {
    const user = mount(START_TO_START, [['a', 0, 'r', 0]]);
    await user.click(button('Your box'));
    const panel = screen.getByRole('region', { name: 'What you own' });
    expect(panel.textContent).toContain('Type how many of each piece you own.');
    expect(panel.textContent).not.toMatch(/\bbelow\b/);
  });

  /*
   * MUTATION PROOF, run: `setOne` writing only the typed count (`onChange({
   * [partId]: value })`): `expected undefined to be 2`.
   */
  it('typing a part count keeps the adapter count', async () => {
    const user = mount(START_TO_START, [['a', 0, 'r', 0]], { A: 2, __adapter_male_male: 2 });
    await user.click(button('Your box'));
    const first = screen.getAllByRole('spinbutton')[0]!;
    await user.clear(first);
    await user.type(first, '4');
    const stored = JSON.parse(localStorage.getItem(INVENTORY_STORAGE_KEY)!) as Record<string, number>;
    expect(stored.__adapter_male_male).toBe(2);
  });
});

describe('Add a part refuses a reserved id', () => {
  /*
   * MUTATION PROOF, run: `reserved` left out of `blocked`: fails with
   * `expected false to be true` (the submit button enabled).
   */
  it('"__adapter_male_male" in the correcting field is refused, and says why', async () => {
    const user = mount(START_TO_START, [['a', 0, 'r', 0]]);
    await user.click(button('Add a part'));
    const form = screen.getByRole('region', { name: 'Submit a part' });
    await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Fake');
    await user.type(within(form).getByRole('spinbutton', { name: 'Length, mm' }), '144');
    await user.type(within(form).getByRole('textbox', { name: 'Correcting an existing part?' }), '__adapter_male_male');
    expect(form.textContent).toContain('Ids starting with __ are reserved.');
    expect((within(form).getByRole('button', { name: 'Add to the library' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
