/**
 * THE PRINTED SHEET AND HOW IT GETS PRINTED (build mode plan: sheet 1-7;
 * D29, D47, D48, D53).
 *
 * Value: protects=the sheet opens with "Build order", the count, the date and
 * the verdict; draws the plan the same way up as the canvas, numbers
 * upright; lists every step with its note marked; and prints from the
 * editor (then returns) and from inside build mode (and stays)
 * Value: fails_when=the flip goes, a note loses its asterisk, the verdict
 * leaves page 1, or Print the sheet prints without the sheet in the page
 * Value: why_new=no sheet existed
 * Value: seam=`window.print` is replaced by a spy that records whether the
 * sheet is in the page at that moment; `Viewer3D.js` is mocked as in
 * buildMode.dom.test.tsx
 * Value: no_claim=what a printer makes of it (the PDF check in the PR)
 */

import { StrictMode, useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import type { Segment } from '../../engine/src/geom/fk.js';
import type { BuildItem } from '../../engine/src/graph/buildSteps.js';
import { App } from './App.js';
import { BuildSheet, bandName } from './BuildSheet.js';

vi.mock('./Viewer3D.js', () => ({
  default: (props: { label: string; onDrawn?: () => void; input: unknown }) => {
    useEffect(() => {
      props.onDrawn?.();
    }, [props.input]);
    return <div data-testid="viewer3d" aria-label={props.label} />;
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const resolve = makeResolver(BUILT_IN);

/** Two straights, one high on the floor (y = 400), one low (y = 0). */
function twoPieces(): { items: BuildItem[]; segments: Segment[] } {
  const segments = [
    { kind: 'straight', from: { x: 0, y: 400, h: 0 }, to: { x: 144, y: 400, h: 0 }, partId: 'A', pieceId: 'hi' },
    { kind: 'straight', from: { x: 0, y: 0, h: 0 }, to: { x: 144, y: 0, h: 0 }, partId: 'A', pieceId: 'lo' },
  ] as Segment[];
  const items: BuildItem[] = [
    { kind: 'pull' },
    { kind: 'piece', step: 1, pieceId: 'hi', partId: 'A', band: 0, phase: 'floor', onto: [], adapter: false, note: null },
    { kind: 'piece', step: 2, pieceId: 'lo', partId: 'A', band: 0, phase: 'floor', onto: [], adapter: true, note: { kind: 'unchecked', reason: null } },
    { kind: 'last', pieces: 2 },
  ];
  return { items, segments };
}

describe('the sheet (D29, D47, D53)', () => {
  function sheet() {
    const { items, segments } = twoPieces();
    render(
      <BuildSheet
        items={items}
        segments={segments}
        partOf={() => resolve('A')}
        partName={(id) => resolve(id).name}
        verdict={<p>VERDICT LINE</p>}
        pull={{ rows: [{ partId: 'A', name: 'Medium straight', count: 2, short: 1 }], adapters: { count: 1, short: 0 } }}
        noteText={(s) => (s.note ? 'This run of track couldn’t be checked.' : null)}
        date={new Date(2026, 9, 31)}
      />,
    );
    return document.querySelector('.build-sheet')!;
  }

  it('page 1: the title, the count, the date and the app, then the verdict and the parts', () => {
    const root = sheet();
    expect(root.querySelector('.sheet-title')!.textContent).toBe('Build order');
    expect(root.querySelector('.sheet-meta')!.textContent).toBe('2 pieces · 31 Oct 2026 · ChooChooCAD');
    expect(root.querySelector('.sheet-verdict')!.textContent).toBe('VERDICT LINE');
    expect(root.textContent).toContain('Male-male adapter');
    expect(root.textContent).toContain('1 short');
  });

  /*
   * MUTATION PROOF, run: the flip group's transform removed and `fy`
   * returning y unchanged: `expected 400 to be less than 0`, the piece high
   * on the floor printed low on the page.
   */
  it('the plan is the same way up as the canvas: the piece higher on the floor is higher on the page', () => {
    const root = sheet();
    const cy = (step: string) =>
      Number([...root.querySelectorAll('.sheet-drawing g')].find((g) => g.querySelector('text')?.textContent?.startsWith(step))!.querySelector('circle')!.getAttribute('cy'));
    expect(cy('1')).toBeLessThan(cy('2'));
    expect(root.querySelector('.sheet-drawing > g')!.getAttribute('transform')).toMatch(/scale\(1, -1\)$/);
  });

  /*
   * MUTATION PROOF, run: the table's `{note ? '*' : ''}` removed: `expected
   * '2' to be '2*' // Object.is equality`.
   */
  it('the step list marks a noted step with an asterisk, says the note, and names the adapter', () => {
    const root = sheet();
    const rows = [...root.querySelectorAll('.sheet-list tbody tr')].map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent));
    expect(rows[0]).toEqual(['1', 'Medium straight', 'A', 'Floor', '']);
    expect(rows[1]![0]).toBe('2*');
    expect(rows[1]![1]).toBe('Medium straight (adapter first: male-male)');
    expect(rows[1]![4]).toBe('This run of track couldn’t be checked.');
  });

  it('band names', () => {
    expect([0, 1, 2, 3, 4].map(bandName)).toEqual(['Floor', 'Ramps that climb to level 1', 'Level 1', 'Ramps that climb to level 2', 'Level 2']);
  });
});

describe('printing (sheet 4-5)', () => {
  const printing = () => {
    const seen: boolean[] = [];
    vi.spyOn(window, 'print').mockImplementation(() => {
      seen.push(document.querySelector('.build-sheet .sheet-title') !== null);
    });
    return seen;
  };

  /*
   * MUTATION PROOF, run: the editor's button opens build mode without
   * `printOnly`: `expected [] to deeply equal [ true ]`, nothing printed.
   */
  it('from the editor: prints with the sheet in the page, then returns to the editor', async () => {
    const seen = printing();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await user.click(screen.getAllByRole('button', { name: 'Stadium' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Print the sheet' })[0]!);
    await waitFor(() => expect(seen).toEqual([true]));
    await waitFor(() => expect(document.querySelector('.build-mode')).toBe(null));
    expect(document.querySelector('.build-sheet')).toBe(null);
  });

  it('from the pull list: prints and stays in build mode', async () => {
    const seen = printing();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await user.click(screen.getAllByRole('button', { name: 'Stadium' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Build it' })[0]!);
    await screen.findByRole('heading', { name: 'Get these out of the box' });
    await user.click(screen.getAllByRole('button', { name: 'Print the sheet' })[0]!);
    await waitFor(() => expect(seen).toEqual([true]));
    expect(screen.getByRole('heading', { name: 'Get these out of the box' })).toBeTruthy();
  });
});
