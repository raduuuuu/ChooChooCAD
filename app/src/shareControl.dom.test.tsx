/**
 * SHARE (share plan; eng D5, D9, D10, D14, D16, D26; design 5A, 7A, 12A).
 *
 * Value: protects=an empty layout cannot be shared and says so; the copied
 * link opens as the same layout; "Link copied" appears only once the
 * clipboard agrees; a refused clipboard shows the link to copy by hand; a
 * layout a friend could not open is never handed out, and one sentence says
 * why; on touch the share sheet gets the link and its text, and cancelling it
 * does nothing; a corrected part is named
 * Value: fails_when=the label claims a copy before it happens, Share skips its
 * own decode, or a cancelled sheet falls through to the clipboard
 * Value: why_new=nothing could hand a layout to anyone until now
 * Value: seam=user-event's clipboard stub; `navigator.share` and `matchMedia`
 * stubbed for a touch device; `CompressionStream` removed for an old browser
 * Value: no_claim=which layouts App marks as corrected (checked in a browser);
 * the real share sheet on a phone
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Graph } from '../../engine/src/graph/model.js';
import { App } from './App.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { storedGraphOf } from './layoutStore.js';
import { decodeLink, LINK_MAX_PIECES } from './shareLink.js';
import { ShareControl } from './ShareControl.js';

const pieces = (n: number, partId = 'A'): Graph => ({
  ...EMPTY_GRAPH,
  pieces: Array.from({ length: n }, (_, i) => ({ pieceId: `p${i}`, partId })),
});
const TWO = pieces(2);
const said = vi.fn();
const fragmentOf = (url: string) => url.slice(url.indexOf('#'));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Share', () => {
  /*
   * MUTATION PROOF, run: `disabled={empty}` removed: `expected false to be
   * true // Object.is equality`.
   */
  it('an empty layout cannot be shared, and says so (D26)', () => {
    render(<App />);
    const share = screen.getByRole('button', { name: 'Share' }) as HTMLButtonElement;
    expect(share.disabled).toBe(true);
    expect(share.title).toBe('Nothing to share yet.');
    expect(screen.getByText('Nothing to share yet.')).toBeTruthy();
  });

  /*
   * MUTATION PROOF, run: `setState({ kind: 'copied' })` moved before the
   * `await` on writeText: `expected <button …(1)></button> to be null`, the
   * label claiming a copy the clipboard had not agreed to yet.
   */
  it('copies a link that opens as the same layout, then says so (7A)', async () => {
    const user = userEvent.setup();
    render(<ShareControl graph={TWO} usesCorrections={false} announce={said} />);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    let resolveWrite: () => void = () => undefined;
    write.mockImplementation(() => new Promise<void>((r) => (resolveWrite = r)));
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Link copied' })).toBe(null);
    await act(async () => resolveWrite());
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeTruthy();
    expect(said).toHaveBeenLastCalledWith('Link copied');
    const url = write.mock.calls[0]![0];
    expect(url.startsWith(`${location.origin}${location.pathname}#v1.`)).toBe(true);
    const back = await decodeLink(fragmentOf(url));
    expect(back.ok && storedGraphOf(back.graph).pieces.map((p) => p.partId)).toEqual(['A', 'A']);
  });

  it('"Link copied" goes back to Share after 2s (7A)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ShareControl graph={TWO} usesCorrections={false} announce={said} />);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await screen.findByRole('button', { name: 'Link copied' });
    // The 2s timer starts in an effect after "Link copied" renders. Flush it
    // first, or the advance can run before the timer exists (CI flake,
    // 2026-11-01: "Unable to find … button … Share").
    await act(async () => {});
    await act(async () => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    vi.useRealTimers();
  });

  /*
   * MUTATION PROOF, run: the catch setting `copied` instead of `by-hand`:
   * `Unable to find a label with the text of: Copy it from here.`.
   */
  it('a refused clipboard shows the link, selected, to copy by hand (D10)', async () => {
    const user = userEvent.setup();
    render(<ShareControl graph={TWO} usesCorrections={false} announce={said} />);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    await user.click(screen.getByRole('button', { name: 'Share' }));
    const field = (await screen.findByLabelText('Copy it from here.')) as HTMLInputElement;
    expect(field.readOnly).toBe(true);
    expect(field.value).toContain('#v1.');
    expect(document.activeElement === field || field.selectionEnd === field.value.length).toBe(true);
    expect(screen.queryByRole('button', { name: 'Link copied' })).toBe(null);
  });

  /*
   * MUTATION PROOF, run: Share skipping its own decode (straight to the
   * clipboard): `Unable to find an element with the text: This layout is too
   * big for a link: links carry 500 pieces at most.`.
   */
  it(`more than ${LINK_MAX_PIECES} pieces: no link, and it says why (D16)`, async () => {
    const user = userEvent.setup();
    render(<ShareControl graph={pieces(LINK_MAX_PIECES + 1)} usesCorrections={false} announce={said} />);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByText('This layout is too big for a link: links carry 500 pieces at most.')).toBeTruthy();
    expect(write).not.toHaveBeenCalled();
  });

  it("a part the catalogue doesn't have: no link, and it says why (D16)", async () => {
    const user = userEvent.setup();
    render(<ShareControl graph={pieces(1, 'MY-PART')} usesCorrections={false} announce={said} />);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByText("This layout uses a part you added, and links can only carry the catalogue's parts.")).toBeTruthy();
  });

  it('an old browser is told sharing needs a newer one (D9)', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const user = userEvent.setup();
    render(<ShareControl graph={TWO} usesCorrections={false} announce={said} />);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByText('Sharing needs a newer browser.')).toBeTruthy();
  });

  it('a corrected part is named next to the link (D14)', async () => {
    const user = userEvent.setup();
    render(<ShareControl graph={TWO} usesCorrections={true} announce={said} />);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByText('The link uses standard part sizes; your corrected sizes stay with you.')).toBeTruthy();
  });
});

describe('Share on a touch screen (D5, 12A)', () => {
  const touch = (share: (d: ShareData) => Promise<void>) => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)', media: q }));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  };
  afterEach(() => {
    delete (navigator as { share?: unknown }).share;
  });

  it('hands the link and its text to the share sheet', async () => {
    const share = vi.fn(async (_: ShareData) => undefined);
    touch(share);
    const user = userEvent.setup();
    render(<ShareControl graph={TWO} usesCorrections={false} announce={said} />);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0]![0].text).toBe('A wooden railway for you to build:');
    expect(share.mock.calls[0]![0].url).toContain('#v1.');
  });

  /*
   * MUTATION PROOF, run: the AbortError return removed (a cancel falls through
   * to the clipboard): `expected "writeText" to not be called at all, but
   * actually been called 1 times`.
   */
  it('a cancelled sheet does nothing', async () => {
    touch(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    const user = userEvent.setup();
    render(<ShareControl graph={TWO} usesCorrections={false} announce={said} />);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(write).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });
});
