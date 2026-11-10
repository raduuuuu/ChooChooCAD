/**
 * A PIECE PREVIEW OPENS READ-ONLY, SAYS WHAT ARRIVED, AND JUDGES NOTHING
 * (contributor-brief plan, "The preview screen, designed", D1 to D15; T4).
 *
 * Value: protects=a `#p1.` link shows the sent piece between two medium
 * straights at its ends' heights, writes no key, says a refusal's reasons
 * with Copy for your chat, tells a cut link apart, shows no verdict, draws a
 * paint the app lacks as wood and says so, says when its track matches a
 * library piece's, offers From the side, and keeps the contribute link off
 * Value: fails_when=the route mounts the editor, a refusal loses its reasons,
 * a cut link reads as a refusal, the straights all sit on the floor, a
 * verdict line appears, an unknown paint reaches the 3D view, the duplicate
 * rule matches on more than the track, or the contribute switch is ignored
 * Value: why_new=the preview screen is new (T4)
 * Value: seam=`Viewer3D.js` mocked as in friendScreen.dom.test.tsx (no WebGL
 * in jsdom); its props are recorded, so the scene the 3D view is handed is
 * checked whole. Fragments are packed with the link codec directly, so a
 * piece the validator refuses can still be sent
 * Value: no_claim=how the 3D view looks from the side (a browser check), the
 * phone layout (CSS, checked in a browser), the live site
 */

import { StrictMode, useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { deflate, toBase64Url } from '../../engine/src/io/linkCodec.js';
import type { SceneInput } from '../../engine/src/view3d/mesh.js';
import { asSubmission } from '../../engine/test/submissions.js';
import { App } from './App.js';
import { BRIEF_URL, ContributeLink } from './ContributeLink.js';
import { PreviewRoute } from './PreviewRoute.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

const seen: { input: SceneInput; sideSignal?: number }[] = [];
vi.mock('./Viewer3D.js', () => ({
  default: (props: { label: string; onDrawn?: () => void; input: SceneInput; sideSignal?: number }) => {
    seen.push({ input: props.input, ...(props.sideSignal !== undefined ? { sideSignal: props.sideSignal } : {}) });
    useEffect(() => {
      props.onDrawn?.();
    }, [props.input]);
    return <div data-testid="viewer3d" aria-label={props.label} />;
  },
}));

const builtIn = makeResolver(BUILT_IN);
/** Any JSON as a `#p1.` fragment, checked or not: what a sender's chat could paste. */
const fragmentOf = async (data: unknown) => `#p1.${toBase64Url(await deflate(JSON.stringify(data)))}`;
const open = (fragment: string) =>
  render(
    <StrictMode>
      <PreviewRoute fragment={fragment} />
    </StrictMode>,
  );
const lastScene = () => seen[seen.length - 1]!.input;
const everything = () => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
const OWN = JSON.stringify({ pieces: [{ pieceId: 'mine', partId: 'A', turn: 'left' }], welds: [], anchors: [] });

beforeEach(() => {
  seen.length = 0;
});
afterEach(() => vi.restoreAllMocks());

describe('opening a piece preview', () => {
  /*
   * MUTATION PROOF, run: PreviewRoute rendering `<App />` (the editor) for
   * an accepted piece instead of the preview: `expected "setItem" to not be
   * called at all, but actually been called 4 times`, the editor's mount
   * saves.
   */
  it('opens the preview, focuses its heading, announces it, and writes no key', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    const before = everything();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const user = userEvent.setup();
    open(await fragmentOf(asSubmission(builtIn('A'), 'A9')));
    // Whatever screen the route mounts (the preview, or the editor's shell), it has written nothing by now.
    await waitFor(() => expect(document.querySelector('.preview, .shell')).not.toBe(null));
    expect(setItem).not.toHaveBeenCalled();
    const heading = await screen.findByRole('heading', { name: 'Piece preview · Medium straight' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByText("This piece isn't in the library: your chat drew it, and nothing here is saved.")).toBeTruthy();
    expect(screen.getByText('Piece preview, Medium straight.').getAttribute('role')).toBe('status');
    expect(screen.getByRole('img', { name: 'Medium straight, 144 mm long, socket and peg, between two medium straights' })).toBeTruthy();
    await user.click(screen.getByText('Details for review'));
    await user.click(screen.getByRole('button', { name: 'From the side' }));
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(everything()).toEqual(before);
    // The way out, worded for where it goes.
    expect(screen.getByRole('button', { name: 'Back to my layout' })).toBeTruthy();
  });

  /*
   * MUTATION PROOF, run: PreviewScreen showing the shared screen's catalogue
   * line (`<p>{CATALOGUE_SIZES}</p>` after the standing line): `expected
   * 'ChooChooCADwooden railway layoutsPiec…' not to contain 'Checked with
   * catalogue sizes.'`.
   */
  it('shows no verdict: no strip, no glyph, no catalogue line (D10)', async () => {
    open(await fragmentOf(asSubmission(builtIn('A'), 'A9')));
    await screen.findByRole('heading', { name: 'Piece preview · Medium straight' });
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Checked with catalogue sizes.');
    expect(text).not.toMatch(/This works|won't close|Build it/);
    expect(document.querySelector('.verdict, .verdict-glyph, .friend-verdict')).toBe(null);
  });
});

describe('the picture: medium straight, the piece, medium straight (D2)', () => {
  /*
   * MUTATION PROOF, run: previewGraph welding every straight to the piece's
   * end 0 (`port` replaced by `0` in the weld): `expected [ +0, +0 ] to
   * deeply equal [ +0, 1 ]`, both straights on the floor.
   */
  it("a ramp's straights sit at its ends' heights: one on the floor, one raised", async () => {
    open(await fragmentOf(asSubmission(builtIn('N'), 'N9')));
    await screen.findByRole('heading', { name: 'Piece preview · Ramp' });
    const levels = ['before', 'after'].map((id) => lastScene().segments.find((s) => s.pieceId === id)!.level ?? 0);
    expect(levels).toEqual([0, 1]);
    // The piece itself climbs from its floor end.
    expect(lastScene().segments.find((s) => s.pieceId === 'piece')!.rise).toBe(1);
    // Its sizes say the heights in millimetres (one level is 61mm, calibration).
    expect(screen.getByText('raised 61 mm').className).toBe('num');
    expect(screen.getByText('216 mm').className).toBe('num');
  });
});

describe('a refused or cut link', () => {
  /*
   * MUTATION PROOF, run: PreviewRoute treating every refusal as cut short
   * (`CUT_SHORT.has(r.code) || true`): `Unable to find an element with the
   * text: Your chat's drawing can't be shown yet..`.
   */
  it("a refused piece shows the sentence, its reasons and Copy for your chat (D4)", async () => {
    const bad = { ...asSubmission(builtIn('A'), 'A9'), slop: { axialMm: 9, angularDeg: 1, calibrationStatus: 'estimated' } };
    const user = userEvent.setup();
    open(await fragmentOf(bad));
    const sentence = await screen.findByText("Your chat's drawing can't be shown yet.");
    expect(sentence.getAttribute('role')).toBe('alert');
    await waitFor(() => expect(document.activeElement).toBe(sentence));
    const reasons = [...document.querySelectorAll('.preview-reasons li')].map((li) => li.textContent);
    expect(reasons).toEqual(['slop.axialMm: must be a number from 0 to 5, not 9']);
    await user.click(screen.getByRole('button', { name: 'Copy for your chat' }));
    expect(await navigator.clipboard.readText()).toBe("Your chat's drawing can't be shown yet.\n- slop.axialMm: must be a number from 0 to 5, not 9");
    expect(await screen.findByText('Copied.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start your own' })).toBeTruthy();
  });

  /*
   * MUTATION PROOF, run: `CUT_SHORT` emptied (`new Set([])`): `Unable to
   * find an element with the text: This link looks cut short. Ask your chat
   * for it again, as a file or in one piece..`, the cut link read as a
   * refusal of the drawing.
   */
  it('a link cut short says so, apart from a refusal (D5)', async () => {
    const whole = await fragmentOf(asSubmission(builtIn('DA'), 'DA9'));
    open(whole.slice(0, Math.floor(whole.length / 2)));
    const sentence = await screen.findByText('This link looks cut short. Ask your chat for it again, as a file or in one piece.');
    expect(sentence.getAttribute('role')).toBe('alert');
    expect(screen.queryByText("Your chat's drawing can't be shown yet.")).toBe(null);
  });
});

describe('paint and duplicates', () => {
  /*
   * MUTATION PROOF, run: withKnownPaint returning the piece as sent (its
   * `return { part: { ...part, … }, unknown }` made `return { part, unknown
   * }`): `expected [ '--paint-teal' ] to deeply equal []`, the unknown paint
   * handed to the 3D view.
   */
  it("a paint the app lacks draws as wood and the details say so; one it has still shows (D12)", async () => {
    const da = asSubmission(builtIn('DA'), 'DA9') as { decor: { paint?: { fill: string } }[] };
    da.decor[0]!.paint!.fill = '--paint-teal';
    open(await fragmentOf(da));
    await screen.findByRole('heading', { name: 'Piece preview · Double-arch bridge' });
    expect(screen.getByText("Paint --paint-teal isn't one the app has yet; drawn as wood.")).toBeTruthy();
    const fills = lastScene().bodies!.flatMap((b) => (b.decor?.paint ? [b.decor.paint.fill] : []));
    expect(fills.filter((f) => f === '--paint-teal')).toEqual([]);
    expect(fills).toContain('--paint-orange');
  });

  /*
   * MUTATION PROOF, run: trackKey also keying on the piece's `name`:
   * `Unable to find an element with the text: Its track matches A Medium
   * straight, already in the library. Is it the same piece?.`.
   */
  it("says when the piece's track matches a library piece's, and only then (D7)", async () => {
    const first = open(await fragmentOf({ ...asSubmission(builtIn('A'), 'A9'), name: 'My straight' }));
    await screen.findByRole('heading', { name: 'Piece preview · My straight' });
    expect(screen.getByText('Its track matches A Medium straight, already in the library. Is it the same piece?')).toBeTruthy();
    first.unmount();
    open(await fragmentOf({ ...asSubmission(builtIn('A'), 'A9'), lengthMm: 150 }));
    await screen.findByRole('heading', { name: 'Piece preview · Medium straight' });
    expect(screen.queryByText(/Its track matches/)).toBe(null);
  });
});

describe('From the side (D13)', () => {
  /*
   * MUTATION PROOF, run: `.preview-side`'s min-height 36px in app.css:
   * `expected '36px' to be '44px' // Object.is equality`.
   */
  it('is one 44px button that turns the 3D view', async () => {
    const user = userEvent.setup();
    open(await fragmentOf(asSubmission(builtIn('A'), 'A9')));
    const side = await screen.findByRole('button', { name: 'From the side' });
    expect(side.className).toBe('preview-side');
    await user.click(side);
    expect(seen[seen.length - 1]!.sideSignal).toBe(1);
    const css = readFileSync(join(process.cwd(), 'app/src/app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/\.preview-side\s*\{([^}]*)\}/g)].map((m) => m[1]!);
    const heights = rules.flatMap((r) => [...r.matchAll(/min-height:\s*([^;]+);/g)].map((m) => m[1]!.trim()));
    expect(heights[heights.length - 1]).toBe('44px');
  });
});

describe('the contribute link (D15)', () => {
  /*
   * MUTATION PROOF, run: CONTRIBUTE_LINK_ON set to true: `expected <a
   * class="contribute-link" …(3)></a> to be null // Object.is equality`.
   */
  it('is absent from the editor while its switch is off, and present when turned on', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(screen.getAllByRole('button', { name: 'Add a part' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Missing a piece/ })).toBe(null);
    render(<ContributeLink on />);
    const link = screen.getByRole('link', { name: 'Missing a piece? Have your Claude draw it for the library' });
    expect(link.getAttribute('href')).toBe(BRIEF_URL);
  });
});
