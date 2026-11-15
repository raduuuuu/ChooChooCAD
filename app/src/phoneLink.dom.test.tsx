/**
 * A SHARED LINK STAYS READ-ONLY ON A PHONE (DESIGN.md rule 13; plan
 * 2026-11-14, design DD12, eng ED2).
 *
 * Value: protects=with the phone's editor switched on, a shared link on a
 * narrow screen still opens the friend's read-only screen: no Pieces, no
 * shell, nothing of the friend's own layout written
 * Value: fails_when=the phone's editor is drawn over somebody else's layout
 * Value: why_new=the phone's editor is chosen by screen size, and a link is
 * the one case where screen size must not decide
 * Value: seam=the real link route under jsdom, in main.tsx's read-only
 * session; matchMedia stubbed to a narrow touch screen
 * Value: no_claim=the friend's screen itself (friendScreen.dom.test.tsx)
 */

import { StrictMode, useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startReadOnlySession } from '../../engine/data/storage.js';
import { LinkRoute } from './LinkRoute.js';
import { PHONE_SHELL, PHONE_SHELL_QUERY } from './phoneEditor.js';
import { BUILD_LINK_STORAGE_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';
import { TOUCH_QUERY } from './stripWords.js';
import { NARROW_QUERY } from './useMatchMedia.js';

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

beforeAll(() => startReadOnlySession([BUILD_LINK_STORAGE_KEY]));
beforeEach(() => {
  PHONE_SHELL.on = true;
  const yes = new Set([PHONE_SHELL_QUERY, NARROW_QUERY, TOUCH_QUERY]);
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: yes.has(q), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => {
  PHONE_SHELL.on = false;
  vi.unstubAllGlobals();
});

describe('a shared link on a phone, with the phone’s editor on', () => {
  /*
   * MUTATION PROOF, run: the phone's editor chosen before the link is looked
   * at (`phone` without `link === undefined`, and the friend's screen skipped
   * when `phone`): `expected <div class="phone">…(6)</div> to be null`.
   */
  it('is the friend’s read-only screen, never the editor', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    render(
      <StrictMode>
        <LinkRoute fragment={STADIUM} />
      </StrictMode>,
    );
    expect(await screen.findByRole('button', { name: /Build it/ })).toBeTruthy();
    expect(document.querySelector('.phone')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pieces' })).toBeNull();
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(OWN);
  });
});
