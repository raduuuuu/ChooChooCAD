/**
 * A LINK STILL HAS ITS MAIN LANDMARK WHILE IT OPENS (design review,
 * 2026-11-10).
 *
 * Value: protects=while a layout link or a piece preview loads, the page keeps
 * one `main` landmark and the loading sentence is announced from its own line
 * Value: fails_when=`role="status"` goes back on <main>, replacing the landmark
 * Value: why_new=found by /design-review on the preview screen
 * Value: seam=both decoders mocked to never settle; fake timers
 * Value: no_claim=what a given screen reader says
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LinkRoute } from './LinkRoute.js';
import { PreviewRoute } from './PreviewRoute.js';

vi.mock('./shareLink.js', async (original) => ({
  ...(await original<typeof import('./shareLink.js')>()),
  decodeLink: () => new Promise(() => undefined),
}));
vi.mock('../../engine/data/previewLink.js', async (original) => ({
  ...(await original<typeof import('../../engine/data/previewLink.js')>()),
  decodePreview: () => new Promise(() => undefined),
}));

afterEach(() => vi.useRealTimers());

/*
 * MUTATION PROOF, run (2026-11-10): `role="status"` put back on the preview's
 * <main>: `TestingLibraryElementError: Unable to find an accessible element
 * with the role "main"`.
 */
it.each([
  ['a layout link', () => <LinkRoute fragment="#v1.abc" />, 'Opening a shared railway…'],
  ['a piece preview', () => <PreviewRoute fragment="#p1.abc" />, 'Opening a piece preview…'],
])('%s keeps its main landmark while it opens', (_name, route, words) => {
  vi.useFakeTimers();
  render(route());
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByRole('main')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe(words);
});
