/**
 * A RELOADED LAYOUT CONTINUES WHERE IT LEFT OFF.
 *
 * Value: protects=after a reload, the next piece joins the saved run instead
 * of starting a second one beside it
 * Value: fails_when=App's editor state is initialised without a cursor, from
 * a narrowed port list, or by anything that drops the cursor
 * initialEditor derives
 * Value: why_new=REPLACES the source-text pin in editorReducer.test.ts, which
 * matched App.tsx's bytes, was defeated four times by an adversarial review,
 * and could never prove the initializer runs. This mounts the real App
 * (task E11's dom project) and checks the behaviour the reported bug broke
 * Value: seam=`saveGraph` writes the stored layout exactly as the app does,
 * then App mounts in StrictMode as `main.tsx` mounts it
 * Value: no_claim=nothing about which free end is chosen on a branching
 * layout; `editorReducer.test.ts` pins `resumeCursor` itself
 *
 * THE REPORTED BUG (2026-10-20): a reload restored the graph without a cursor,
 * so the next palette click started a separate run 648mm away.
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Piece } from '../../engine/src/graph/model.js';
import { place } from '../test/place.js';
import { App } from './App.js';
import { reduce, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { saveGraph } from './layoutStore.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const verdict = () => screen.getAllByRole('status').find((el) => el.classList.contains('verdict'))!;
const announced = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!;

describe('a reload', () => {
  /*
   * MUTATION PROOF, run: in App.tsx, replace the `useState<EditorState>`
   * initializer with `({ graph: graphLoad.value, cursor: null, armed: null,
   * lastAction: null })`. Fails with `expected '?Not a loop yet. 2 separate
   * runs of t…' to match /4 pieces, open at both ends/`. Narrowing the ports
   * instead (append `.slice(0, 1)` to the `portsOf` call) keeps one run but
   * resumes on the only port it can see free, the START of piece 1, so the
   * piece goes on the wrong end: the verdict still passes and the announcement
   * fails with `expected 'Added piece 4, Large curve (E), joine…' to be
   * 'Added piece 4, Large curve (E), joine…'` (the tail differs).
   */
  it('keeps the cursor, so the next piece joins the saved run', async () => {
    let s: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
    for (let i = 0; i < 3; i++) s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    saveGraph(s.graph);

    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(verdict().textContent).toMatch(/3 pieces, open at both ends/);

    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(verdict().textContent).toMatch(/4 pieces, open at both ends/);
    expect(verdict().textContent).not.toMatch(/separate runs/);
    expect(announced().textContent).toBe(
      'Added piece 4, Large curve (E), joined to the end of piece 3.',
    );
  });
});
