/**
 * MY LAYOUTS: THE PANEL (plan 2026-11-16, saved layouts; the owner's D1 to D7).
 *
 * Value: protects=the layout ON SCREEN is kept under a name and listed; a
 * kept layout is then named as kept, and after a change the panel offers to
 * update the entry it was opened from or keep a new one; opening puts the
 * layout on screen aside, writes the working slot, remembers the entry for
 * the tab and reloads; opening asks before replacing a different put-aside
 * layout; a layout the editor's loader would refuse is refused before any
 * slot is touched, and offered as a file; opening waits while the screen is
 * not saved, and keeping does not; remove can be put back until the panel
 * closes; rename; the put-aside slot is a row of its own; a damaged entry
 * is a row that hides no other; another tab's change re-reads the list; the
 * first-visit example and an empty floor offer no Keep; a phone reaches the
 * panel from More
 * Value: fails_when=Keep saves the stored slot's older bytes, an open loses
 * the layout on screen or replaces a put-aside layout unasked, a refusal
 * moves a slot, an update touches another entry, a removed layout cannot be
 * put back, or one bad entry empties the list
 * Value: why_new=the panel is new
 * Value: seam=the real App under jsdom, the panel's chunk loaded for real
 * through `lazy`; a reload is seen through jsdom (`watchReloads`) and then
 * acted out by mounting the App again
 * Value: no_claim=the look, a real reload, a real full store, two real tabs,
 * and the date's wording, which follows the browser's language
 */

import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchReloads } from '../test/reloads.js';
import { App } from './App.js';
import { PHONE_SHELL_QUERY } from './phoneEditor.js';
import { GRAPH_PREVIOUS_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';
import { TOUCH_QUERY } from './stripWords.js';
import { NARROW_QUERY } from './useMatchMedia.js';

const straights = (n: number, partId = 'A') =>
  JSON.stringify({
    pieces: Array.from({ length: n }, (_, i) => ({ pieceId: `p${i}`, partId, turn: 'left' })),
    welds: Array.from({ length: n - 1 }, (_, i) => ({ a: { pieceId: `p${i}`, port: 1 }, b: { pieceId: `p${i + 1}`, port: 0 } })),
    anchors: [],
  });
const ONE = straights(1);
const TWO = straights(2);
const THREE = straights(3);
const key = (id: string) => `generic.layouts.v1.${id}`;
const seed = (id: string, name: string, layout: string, pieces: number, day = 14) =>
  localStorage.setItem(key(id), JSON.stringify({ name, keptAt: new Date(Date.UTC(2026, 10, day, 10)).toISOString(), pieces, layout }));
const entry = (id: string) => JSON.parse(localStorage.getItem(key(id))!) as { name: string; pieces: number; layout: string };
const savedIds = () => Object.keys(localStorage).filter((k) => k.startsWith('generic.layouts.v1.')).map((k) => k.slice('generic.layouts.v1.'.length));
const panel = () => screen.getByRole('region', { name: 'My layouts' });
const said = () => panel().querySelector('.layouts-said')!.textContent;
const rowNames = () => [...panel().querySelectorAll('.layouts-row-name')].map((e) => e.textContent);
const inRow = (name: string) => within([...panel().querySelectorAll<HTMLElement>('.layouts-row')].find((r) => r.textContent!.includes(name))!);

async function open(working: string | null = ONE) {
  if (working !== null) localStorage.setItem(GRAPH_STORAGE_KEY, working);
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getAllByRole('button', { name: 'My layouts' })[0]!);
  await screen.findByRole('heading', { name: 'My layouts' });
  return user;
}
/** What a reload does: the page starts again from storage, the tab's session kept. */
async function reloadInto(user: ReturnType<typeof userEvent.setup>) {
  cleanup();
  render(<App />);
  await user.click(screen.getAllByRole('button', { name: 'My layouts' })[0]!);
  await screen.findByRole('heading', { name: 'My layouts' });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Which entry a tab opened is a session value; one spec's must not reach the next.
  sessionStorage.clear();
});

describe('keeping the layout on screen', () => {
  /*
   * MUTATION PROOFS, run:
   * - the default name not offered (an empty field): `expected '' to be 'Layout 1'`.
   * - "Kept." not said: `expected '' to be 'Kept.'`.
   * - the kept layout not recognised afterwards (`same` never found):
   *   `expected 'My layoutsDoneUpdate “Layout 1”…' to contain 'This is "Layout
   *   1", as kept.'`, an Update offered for a layout that has not changed.
   * - the new entry not remembered for the tab (`rememberOpened` dropped from
   *   Keep): `expected null to be '<id>'`.
   */
  it('keeps it under the offered name, lists it, and then says it is kept', async () => {
    const user = await open(TWO);
    const name = screen.getByLabelText('A name for this layout') as HTMLInputElement;
    expect(name.value).toBe('Layout 1');
    await user.click(screen.getByRole('button', { name: 'Keep this layout' }));
    expect(said()).toBe('Kept.');
    expect(rowNames()).toEqual(['Layout 1']);
    expect(inRow('Layout 1').getByText('2 pieces')).toBeTruthy();
    const [id] = savedIds();
    expect(entry(id!)).toMatchObject({ name: 'Layout 1', pieces: 2, layout: localStorage.getItem(GRAPH_STORAGE_KEY) });
    expect(screen.queryByRole('button', { name: 'Keep this layout' })).toBeNull();
    expect(panel().textContent).toContain('This is "Layout 1", as kept.');
    // The layout on screen IS this entry now: a later change offers to update it.
    expect(sessionStorage.getItem('generic.layouts.opened')).toBe(id);
  });

  /*
   * MUTATION PROOFS, run:
   * - a name that is not one kept anyway: `expected [ … ] to deeply equal []`.
   * - the next default counting rows in place of looking for a free number:
   *   `expected 'Layout 2' to be 'Layout 1'`.
   */
  it('takes a typed name, refuses an empty one in words, and offers the first free "Layout N"', async () => {
    seed('x', 'Layout 2', THREE, 3);
    const user = await open(TWO);
    const name = screen.getByLabelText('A name for this layout') as HTMLInputElement;
    expect(name.value).toBe('Layout 1');
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Keep this layout' }));
    expect(said()).toBe('A name needs 1 to 40 characters.');
    expect(savedIds()).toEqual(['x']);
    await user.type(name, '  Rug   loop ');
    await user.click(screen.getByRole('button', { name: 'Keep this layout' }));
    expect(rowNames()).toEqual(['Rug loop', 'Layout 2']);
  });

  /*
   * KEEP TAKES THE SCREEN, NOT THE SAVED SLOT (O1). Another tab changes the
   * saved slot; this tab is then stale and stops saving, and still shows two
   * pieces.
   *
   * MUTATION PROOFS, run:
   * - Keep given the working key's bytes: the other tab's three pieces match
   *   the entry already saved, so no Keep is offered at all: `Unable to find
   *   … "Keep this layout"`.
   * - Open allowed while the screen is not saved: `expected 'Kept.' to be
   *   'Restore waits until your changes are saved.'`, and the page reloads
   *   over the layout on screen.
   */
  it('keeps what is on screen while the tab is stale, and makes opening wait', async () => {
    seed('x', 'Other', THREE, 3);
    const reloaded = watchReloads();
    const user = await open(TWO);
    localStorage.setItem(GRAPH_STORAGE_KEY, THREE);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: GRAPH_STORAGE_KEY }));
    });
    await user.click(screen.getByRole('button', { name: 'Keep this layout' }));
    const mine = savedIds().find((id) => id !== 'x')!;
    expect(entry(mine).pieces).toBe(2);
    expect(JSON.parse(entry(mine).layout).pieces).toHaveLength(2);
    await user.click(inRow('Other').getByRole('button', { name: 'Open' }));
    expect(said()).toBe('Restore waits until your changes are saved.');
    expect(reloaded()).toBe(false);
  });

  /*
   * MUTATION PROOF, run: Keep offered whatever is on screen (`canKeep` true):
   * `expected <button> to be null`, for an empty floor.
   */
  it('offers no Keep on an empty floor, and says what the list is for', async () => {
    await open(JSON.stringify({ pieces: [], welds: [], anchors: [] }));
    expect(screen.queryByRole('button', { name: 'Keep this layout' })).toBeNull();
    expect(panel().textContent).toContain('Nothing on the floor to keep yet.');
  });
});

describe('opening a saved layout', () => {
  /*
   * MUTATION PROOFS, run:
   * - the layout on screen not put aside (`openInEditor` given no on-screen
   *   bytes and the slot emptied first): `expected null to be '{"pieces":[…'`.
   * - the entry not remembered for the tab: `expected null to be 'rug'`, so
   *   no "Update" would be offered once the layout is changed.
   * - no reload: `expected false to be true`.
   */
  it('puts the layout on screen aside, takes the saved one, remembers it and reloads', async () => {
    seed('rug', 'Rug loop', THREE, 3);
    const reloaded = watchReloads();
    const user = await open(TWO);
    const onScreen = localStorage.getItem(GRAPH_STORAGE_KEY);
    await user.click(inRow('Rug loop').getByRole('button', { name: 'Open' }));
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(THREE);
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(onScreen);
    expect(reloaded()).toBe(true);
    expect(entry('rug').layout).toBe(THREE);
    // Remembered for this tab, so a later change can offer to update this entry (D1, O7).
    expect(sessionStorage.getItem('generic.layouts.opened')).toBe('rug');

    await reloadInto(user);
    // The editor's own serialization of what it loaded is the entry's bytes: the kept layout is recognised.
    expect(panel().textContent).toContain('This is "Rug loop", as kept.');
    expect(rowNames()[0]).toBe('Put aside, 2 pieces');
  });

  /*
   * D1. The tab opened "Rug loop" (three pieces) and now shows two.
   *
   * MUTATION PROOFS, run:
   * - Update writing a new entry: `expected [ 'rug', … ] to deeply equal [ 'other', 'rug' ]`.
   * - Update changing the name: `expected 'Layout 1' to be 'Rug loop'`.
   * - "Keep as new" updating the opened entry: `expected 2 to be 3`.
   */
  it('after a change offers Update for the entry it came from, or Keep as new', async () => {
    seed('rug', 'Rug loop', THREE, 3);
    seed('other', 'Other', ONE, 1, 13);
    sessionStorage.setItem('generic.layouts.opened', 'rug');
    const user = await open(TWO);
    await user.click(screen.getByRole('button', { name: 'Update “Rug loop”' }));
    expect(said()).toBe('Updated.');
    expect(savedIds().sort()).toEqual(['other', 'rug']);
    expect(entry('rug')).toMatchObject({ name: 'Rug loop', pieces: 2, layout: localStorage.getItem(GRAPH_STORAGE_KEY) });
    expect(entry('other').layout).toBe(ONE);
    expect(panel().textContent).toContain('This is "Rug loop", as kept.');
  });

  it('Keep as new leaves the opened entry as it was', async () => {
    seed('rug', 'Rug loop', THREE, 3);
    sessionStorage.setItem('generic.layouts.opened', 'rug');
    const user = await open(TWO);
    await user.click(screen.getByRole('button', { name: 'Keep as new' }));
    expect(entry('rug').pieces).toBe(3);
    expect(savedIds()).toHaveLength(2);
    expect(rowNames()).toEqual(['Layout 1', 'Rug loop']);
  });

  /*
   * MUTATION PROOFS, run:
   * - the question skipped: `Unable to find role="group"`, and the earlier
   *   put-aside layout is replaced unasked.
   * - "Keep it" opening anyway: `expected '{"pieces":[…3' to be …2`.
   */
  it('asks before replacing a different layout that is already put aside', async () => {
    seed('rug', 'Rug loop', THREE, 3);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, ONE);
    const reloaded = watchReloads();
    const user = await open(TWO);
    const onScreen = localStorage.getItem(GRAPH_STORAGE_KEY);
    await user.click(inRow('Rug loop').getByRole('button', { name: 'Open' }));
    const ask = screen.getByRole('group', { name: 'Replace the layout you put aside last time?' });
    expect(ask.textContent).toContain('Put aside earlier (will be replaced): 1 piece');
    expect(ask.textContent).toContain('Your current layout (goes into its place): 2 pieces');
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(onScreen);
    await user.click(within(ask).getByRole('button', { name: 'Keep it' }));
    expect(said()).toBe('Nothing changed. To keep both, restore your earlier layout first.');
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(ONE);
    expect(reloaded()).toBe(false);

    await user.click(inRow('Rug loop').getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Replace it' }));
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(THREE);
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(onScreen);
    expect(reloaded()).toBe(true);
  });

  /*
   * NO QUESTION WHEN NOTHING WOULD BE LOST. The put-aside layout is also in
   * the list, so replacing it in the slot loses nothing.
   *
   * MUTATION PROOF, run: the shortcut taken for ANY put-aside layout (the
   * `layouts.some` test dropped): the spec before this one fails with
   * `Unable to find role="group"`, a layout kept nowhere else replaced unasked.
   */
  it('does not ask when the put-aside layout is also a saved one', async () => {
    seed('rug', 'Rug loop', THREE, 3);
    seed('one', 'Small', ONE, 1, 13);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, ONE);
    const reloaded = watchReloads();
    const user = await open(TWO);
    const onScreen = localStorage.getItem(GRAPH_STORAGE_KEY);
    await user.click(inRow('Rug loop').getByRole('button', { name: 'Open' }));
    expect(screen.queryByRole('group', { name: 'Replace the layout you put aside last time?' })).toBeNull();
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(THREE);
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(onScreen);
    expect(entry('one').layout).toBe(ONE);
    expect(reloaded()).toBe(true);
  });

  /*
   * REFUSED BEFORE ANY SLOT IS TOUCHED (O6, and the consequence of D4: a
   * part the person added and later lost).
   *
   * MUTATION PROOFS, run:
   * - the loader's check skipped: `expected '{"pieces":[{"pieceId":"p0","partId":"NOPE"…'
   *   to be …` (the working slot overwritten with a layout the editor
   *   cannot load).
   * - the file not offered: `Unable to find role="button" and name "Save to a file"`.
   */
  it.each([
    ['a piece this browser does not have', straights(2, 'NOPE'), "This layout uses a piece this browser doesn't have (NOPE). Add that part again, or save the layout to a file."],
    ['bytes that are not a layout', '{not a layout', "This layout can't be read. Save it to a file to keep it."],
  ])('a saved layout with %s is refused in words, offered as a file, and nothing moves', async (_, bad, sentence) => {
    seed('bad', 'Odd one', bad, 2);
    const reloaded = watchReloads();
    const user = await open(TWO);
    const before = { ...localStorage };
    await user.click(inRow('Odd one').getByRole('button', { name: 'Open' }));
    expect(said()).toContain(sentence);
    expect(within(panel()).getByRole('button', { name: 'Save to a file' })).toBeTruthy();
    expect({ ...localStorage }).toEqual(before);
    expect(reloaded()).toBe(false);
  });
});

describe('tidying the list', () => {
  /*
   * MUTATION PROOFS, run:
   * - "Put it back" writing a fresh entry: `expected '{"name":"Rug loop",…'
   *   to be …` on the byte-for-byte expectation.
   * - the offer surviving the panel: `expected <button> to be null`.
   */
  it('Remove takes the row out and can be put back, until the panel closes', async () => {
    seed('rug', 'Rug loop', THREE, 3);
    seed('other', 'Other', ONE, 1, 13);
    const user = await open(TWO);
    const before = localStorage.getItem(key('rug'));
    await user.click(inRow('Rug loop').getByRole('button', { name: 'Remove' }));
    expect(rowNames()).toEqual(['Other']);
    expect(localStorage.getItem(key('rug'))).toBeNull();
    expect(said()).toContain('Removed "Rug loop".');
    await user.click(screen.getByRole('button', { name: 'Put it back' }));
    expect(localStorage.getItem(key('rug'))).toBe(before);
    expect(rowNames()).toEqual(['Rug loop', 'Other']);

    await user.click(inRow('Rug loop').getByRole('button', { name: 'Remove' }));
    await user.click(within(panel()).getByRole('button', { name: 'Done' }));
    await user.click(screen.getAllByRole('button', { name: 'My layouts' })[0]!);
    await screen.findByRole('heading', { name: 'My layouts' });
    expect(screen.queryByRole('button', { name: 'Put it back' })).toBeNull();
    expect(rowNames()).toEqual(['Other']);
  });

  /*
   * MUTATION PROOFS, run:
   * - an empty new name saved: `expected 'Rug loop' …` fails on the stored name.
   * - rename changing the layout: `expected '…' to be THREE`.
   */
  it('Rename changes the name and nothing else, and refuses an empty one', async () => {
    seed('rug', 'Rug loop', THREE, 3);
    const user = await open(TWO);
    await user.click(inRow('Rug loop').getByRole('button', { name: 'Rename' }));
    const field = screen.getByLabelText('A new name for “Rug loop”') as HTMLInputElement;
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(said()).toBe('A name needs 1 to 40 characters.');
    expect(entry('rug').name).toBe('Rug loop');
    await user.type(field, 'Living room');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(said()).toBe('Renamed.');
    expect(entry('rug')).toMatchObject({ name: 'Living room', pieces: 3, layout: THREE });
    expect(rowNames()).toEqual(['Living room']);
  });
});

describe('the put-aside layout, in the list (D2)', () => {
  /*
   * MUTATION PROOFS, run:
   * - the row drawn when nothing is put aside: `expected [ 'Put aside, …' ] to deeply equal []`.
   * - its Keep emptying the slot: `expected null to be '{"pieces":[…'`.
   * - its Open going through `openInEditor` (which would ask to overwrite the
   *   slot being opened): `expected false to be true`, no reload.
   */
  it('is a row only when the slot holds one; Keep copies it under a name and leaves the slot', async () => {
    const user = await open(TWO);
    expect(rowNames()).toEqual([]);
    cleanup();
    localStorage.setItem(GRAPH_PREVIOUS_KEY, THREE);
    await reloadInto(user);
    expect(rowNames()).toEqual(['Put aside, 3 pieces']);
    await user.click(inRow('Put aside').getByRole('button', { name: 'Keep' }));
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(THREE);
    expect(entry(savedIds()[0]!)).toMatchObject({ name: 'Layout 1', pieces: 3, layout: THREE });
    expect(rowNames()).toEqual(['Put aside, 3 pieces', 'Layout 1']);
  });

  it('its Open swaps the two layouts, as Restore does, and reloads', async () => {
    localStorage.setItem(GRAPH_PREVIOUS_KEY, THREE);
    const reloaded = watchReloads();
    const user = await open(TWO);
    const onScreen = localStorage.getItem(GRAPH_STORAGE_KEY);
    await user.click(inRow('Put aside').getByRole('button', { name: 'Open' }));
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(THREE);
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(onScreen);
    expect(reloaded()).toBe(true);
  });
});

describe('the list itself', () => {
  /*
   * MUTATION PROOFS, run:
   * - a damaged entry left out of the list: `expected [ 'Rug loop' ] to deeply
   *   equal [ 'Rug loop', "A layout that can't be read, …" ]` (it could then
   *   never be removed or saved).
   * - the list not re-read on another tab's change: `expected [ … ] to deeply
   *   equal [ 'From the other tab', … ]`.
   */
  it('shows a damaged entry as its own row, and re-reads when another tab changes the list', async () => {
    seed('rug', 'Rug loop', THREE, 3);
    localStorage.setItem(key('bad'), '{not json');
    const user = await open(TWO);
    expect(rowNames()).toEqual(['Rug loop', "A layout that can't be read, kept exactly as saved"]);
    const bad = inRow("can't be read");
    expect(bad.getByRole('button', { name: 'Save to a file' })).toBeTruthy();
    expect(bad.queryByRole('button', { name: 'Open' })).toBeNull();
    await user.click(bad.getByRole('button', { name: 'Remove' }));
    expect(localStorage.getItem(key('bad'))).toBeNull();

    seed('new', 'From the other tab', ONE, 1, 16);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: key('new') }));
    });
    expect(rowNames()).toEqual(['From the other tab', 'Rug loop']);
  });

  /*
   * MUTATION PROOF, run: Keep offered on the first-visit example: `expected
   * <button> to be null` (an example is not the person's layout; C5).
   */
  it('on the first-visit example the list opens, and nothing is offered to keep', async () => {
    seed('rug', 'Rug loop', THREE, 3);
    const user = userEvent.setup();
    render(<App offerExample />);
    await user.click(screen.getAllByRole('button', { name: 'My layouts' })[0]!);
    await screen.findByRole('heading', { name: 'My layouts' });
    expect(rowNames()).toEqual(['Rug loop']);
    expect(screen.queryByRole('button', { name: 'Keep this layout' })).toBeNull();
    expect(panel().textContent).toContain('Keep a layout here to come back to it. It stays in this browser.');
  });

  /*
   * MUTATION PROOF, run: the row taken out of More: `Unable to find … "My layouts"`.
   */
  it('a phone reaches it from More, as a panel with its name and Done', async () => {
    const yes = new Set([PHONE_SHELL_QUERY, NARROW_QUERY, TOUCH_QUERY]);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: yes.has(q), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    seed('rug', 'Rug loop', THREE, 3);
    localStorage.setItem(GRAPH_STORAGE_KEY, TWO);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'More' }));
    await user.click([...screen.getByRole('dialog', { name: 'More' }).querySelectorAll<HTMLButtonElement>('button.more-row')].find((b) => b.textContent === 'My layouts')!);
    const phonePanel = document.querySelector('.phone-panel')!;
    expect(phonePanel.querySelector('.sheet-title')!.textContent).toBe('My layouts');
    await screen.findByText('Rug loop');
    // Read from the markup, as the other phone-panel specs do: the dialog stand-in hides the page from role queries.
    expect([...phonePanel.querySelectorAll('button')].map((b) => b.textContent)).toContain('Keep this layout');
    expect([...phonePanel.querySelectorAll('.layouts-row-name')].map((e) => e.textContent)).toEqual(['Rug loop']);
    await user.click(phonePanel.querySelector<HTMLButtonElement>('.sheet-head .sheet-close')!);
    expect(document.querySelector('.phone-panel')).toBeNull();
  });
});
