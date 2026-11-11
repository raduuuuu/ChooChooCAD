/**
 * A SHARED LINK OPENS READ-ONLY AND LEAVES THE FRIEND'S STORAGE ALONE (share
 * plan; eng D7, D17, D21, D23, D28, D31; design 1A, 10A, 20A).
 *
 * Value: protects=opening a link, building it for a few steps and coming back
 * changes no key but the link's own build progress; a newer link is refused
 * with its sentence and the editor never mounts; the exit is worded for where
 * it goes and leaves by taking the link off the address and reloading; the
 * title takes focus and the screen says the sizes are the catalogue's
 * Value: fails_when=the route stops starting the read-only session (the
 * editor's mount save then writes the link over the friend's layout), the
 * build writes the friend's own slot, the exit keeps the `#v…`, or the label
 * ignores whether a layout is stored
 * Value: why_new=links have no screen until now
 * Value: seam=`Viewer3D.js` mocked as in buildMode.dom.test.tsx (no WebGL in
 * jsdom). A reload is observed through jsdom's own "Not implemented:
 * navigation" report, since `location.reload` cannot be replaced there
 * Value: no_claim=how a phone lays the screen out (CSS, checked in a browser),
 * and the time a phone takes (the plan's D38 device run)
 */

import { StrictMode, useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { watchReloads } from '../test/reloads.js';
import { startReadOnlySession } from '../../engine/data/storage.js';
import { LinkRoute } from './LinkRoute.js';
import { encodeLink } from './shareLink.js';
import type { Graph } from '../../engine/src/graph/model.js';
import { BUILD_LINK_STORAGE_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';

vi.mock('./Viewer3D.js', () => ({
  default: (props: { label: string; onDrawn?: () => void; input: unknown }) => {
    useEffect(() => {
      props.onDrawn?.();
    }, [props.input]);
    return <div data-testid="viewer3d" aria-label={props.label} />;
  },
}));

/** The frozen Stadium link (shareLink.frozen.test.ts). */
const STADIUM = '#v1.hcy5DcAwDEPRXVy78H30yRSC9l8j3-xSBIEKPoCEzCzcIWaP33n99K8dsBQzl-DJIhVUpYqa1FCXOhrSQFOaaEkLbWmfvwi6Pw';
const OWN = JSON.stringify({ pieces: [{ pieceId: 'mine', partId: 'A', turn: 'left' }], welds: [], anchors: [] });

/** Every key and value, so "nothing changed" is checked whole, not key by key. */
const everything = () => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));

// What main.tsx does before it mounts a link.
beforeAll(() => startReadOnlySession([BUILD_LINK_STORAGE_KEY]));

const open = (fragment: string) =>
  render(
    <StrictMode>
      <LinkRoute fragment={fragment} />
    </StrictMode>,
  );

describe('a shared link', () => {
  /*
   * MUTATION PROOF, run: this file's `startReadOnlySession` removed (what
   * main.tsx would do without it): `expected { …(5) } to deeply equal { …(4)
   * }`, a key the session holds back written by the editor's mount saves.
   */
  it('opens, builds a few steps and comes back without touching any key but its own build progress', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem('generic.view.v0', '3d');
    localStorage.setItem('generic.build.v0', JSON.stringify({ layout: 'own-build', index: 3 }));
    localStorage.setItem('generic.inventory.v0', JSON.stringify({ A: 4 }));
    const before = everything();
    const user = userEvent.setup();
    open(STADIUM);
    await screen.findByRole('heading', { name: 'A wooden railway · 10 pieces' });
    expect(screen.getByText('Checked with catalogue sizes.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Build it' }));
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    await user.click(screen.getByRole('button', { name: 'Back to editor' }));
    await screen.findByRole('heading', { name: 'A wooden railway · 10 pieces' });
    const after = everything();
    expect(after[BUILD_LINK_STORAGE_KEY]).toBeTruthy();
    delete after[BUILD_LINK_STORAGE_KEY];
    expect(after).toEqual(before);
  });

  it('puts focus on the title, so a screen reader hears what arrived (design 20A)', async () => {
    open(STADIUM);
    const title = await screen.findByRole('heading', { name: 'A wooden railway · 10 pieces' });
    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  /*
   * MUTATION PROOF, run: LinkRoute rendering `<App />` for any refusal instead
   * of the message: `Unable to find an element with the text: This link was
   * made by a newer ChooChooCAD. Reloading usually fixes this.`.
   */
  it('a newer link is refused with its sentence, and the editor never mounts (D17)', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    const before = everything();
    open('#v2.abc');
    expect(await screen.findByText('This link was made by a newer ChooChooCAD. Reloading usually fixes this.')).toBeTruthy();
    expect(document.querySelector('.palette')).toBe(null);
    expect(screen.getByRole('button', { name: 'Back to my layout' })).toBeTruthy();
    expect(everything()).toEqual(before);
  });

  /*
   * MUTATION PROOF, run: `holdsOwnLayout` returning true always: `Unable to
   * find role="button" and name "Start your own"`.
   */
  it('with no layout of their own, the exit says Start your own (design 10A)', async () => {
    open('#v2.abc');
    expect(await screen.findByRole('button', { name: 'Start your own' })).toBeTruthy();
  });

  /*
   * MUTATION PROOF, run: `leaveLink` without its `replaceState`: `expected
   * '#v1.hcy5DcAwDEPRXVy78H30yRSC9l8j3-xSB…' to be '' // Object.is equality`.
   */
  it('leaving takes the link off the address and reloads into the editor (D28)', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reloaded = watchReloads();
    history.replaceState(null, '', `/${STADIUM}`);
    const user = userEvent.setup();
    open(STADIUM);
    await user.click(await screen.findByRole('button', { name: 'Start your own' }));
    expect(location.hash).toBe('');
    expect(reloaded()).toBe(true);
    quiet.mockRestore();
  });
});

describe('what the check rests on (DESIGN.md rule 13; TODO D19, 2026-11-08)', () => {
  /** Loose pieces, each anchored apart: `MT` is the metro tunnel, sized from photos. */
  const linkOf = (partIds: readonly string[]) => {
    const graph: Graph = {
      pieces: partIds.map((partId, i) => ({ pieceId: `p${i}`, partId, turn: 'left' as const })),
      welds: [],
      anchors: new Map(partIds.map((_, i) => [`p${i}`, { pos: [0, 0, 0, 300 * i, 0, 0, 0, 0], heading: 0, level: 0 }])),
    };
    return encodeLink(graph);
  };

  /*
   * MUTATION PROOF, run: FriendScreen told no piece is unmeasured
   * (`sizesLine(0, …)`, the catalogue line alone): `Unable to find an element
   * with the text: Checked with catalogue sizes, and estimates for the pieces
   * nobody has measured.`
   */
  it('says estimates when some pieces are unmeasured, and estimated sizes when all are', async () => {
    const some = open(await linkOf(['A', 'MT']));
    await screen.findByRole('heading', { name: 'A wooden railway · 2 pieces' });
    expect(screen.getByText('Checked with catalogue sizes, and estimates for the pieces nobody has measured.')).toBeTruthy();
    some.unmount();
    open(await linkOf(['MT']));
    await screen.findByRole('heading', { name: 'A wooden railway · 1 piece' });
    expect(screen.getByText('Checked with estimated sizes: nobody has measured these pieces.')).toBeTruthy();
  });
});
