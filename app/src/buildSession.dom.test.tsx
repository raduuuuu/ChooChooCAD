/**
 * WHAT BUILD MODE DOES TO THE BROWSER (build mode plan: scope 5 and 6; D10,
 * D12, D13, D18, D21, D35).
 *
 * Value: protects=a build resumes on the same layout and restarts, saying
 * so, on a changed one; a bad stored value never crashes or skips; the screen
 * lock is released however the race resolves and is asked for again on the
 * next tap; the Back gesture leaves build mode once and only once
 * Value: fails_when=the key ignores anchors, the index is not clamped, a
 * late lock is kept, a dropped lock is never re-requested, or history is
 * left with an extra entry
 * Value: why_new=no build mode existed
 * Value: seam=a fake wake-lock API with a request the test resolves by hand;
 * jsdom's localStorage and history
 * Value: no_claim=real device sleep or WebKit's gesture rule (the scripted
 * browser pass), and storage quotas on devices
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromInt } from '../../engine/src/geom/cyclotomic.js';
import type { Graph } from '../../engine/src/graph/model.js';
import { clearResume, enterHistory, keepAwake, layoutKey, loadResume, saveResume, type WakeLockApi } from './buildSession.js';
import { BUILD_STORAGE_KEY } from './storageKeys.js';

const graph = (x = 0): Graph => ({
  pieces: [
    { pieceId: 'p1', partId: 'E', turn: 'left' },
    { pieceId: 'p2', partId: 'E', turn: 'left' },
  ],
  welds: [{ a: { pieceId: 'p1', port: 1 }, b: { pieceId: 'p2', port: 0 } }],
  anchors: new Map([['p1', { pos: fromInt(x), heading: 0 }]]),
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('where a build was left (scope 5, D18, D35)', () => {
  it('the same layout picks up where it was left', () => {
    saveResume(graph(), 7);
    expect(loadResume(graph(), 20)).toEqual({ kind: 'resumed', index: 7 });
  });

  /*
   * MUTATION PROOF, run: `layoutKey` hashes pieces and welds only (anchors
   * dropped): `expected { kind: 'resumed', index: 7 } to deeply equal
   * { kind: 'changed', index: +0 }`.
   */
  it('moving a run (only its anchor changes) starts again from the first piece, and says it changed', () => {
    saveResume(graph(0), 7);
    expect(loadResume(graph(500), 20)).toEqual({ kind: 'changed', index: 0 });
    expect(layoutKey(graph(0))).not.toBe(layoutKey(graph(500)));
  });

  /*
   * MUTATION PROOF, run: the range check removed (`o.index >= itemCount`
   * dropped): `expected { kind: 'resumed', index: 99 } to deeply equal
   * { kind: 'fresh', index: +0 }`.
   */
  it('a corrupt, mistyped or out-of-range value reads as no build at all', () => {
    for (const raw of ['{not json', '42', '{"layout":1,"index":3}', '{"layout":"x"}', JSON.stringify({ layout: layoutKey(graph()), index: 2.5 })]) {
      localStorage.setItem(BUILD_STORAGE_KEY, raw);
      expect(loadResume(graph(), 20)).toEqual({ kind: 'fresh', index: 0 });
    }
    localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify({ layout: layoutKey(graph()), index: 99 }));
    expect(loadResume(graph(), 20)).toEqual({ kind: 'fresh', index: 0 });
  });

  it('clearing forgets it; a blocked store reports false instead of throwing', () => {
    saveResume(graph(), 3);
    clearResume();
    expect(loadResume(graph(), 20)).toEqual({ kind: 'fresh', index: 0 });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveResume(graph(), 3)).toBe(false);
  });
});

/** A wake-lock API whose requests the test answers. */
function fakeLock() {
  const answers: { resolve: (s: { release: () => Promise<void>; addEventListener: (t: 'release', l: () => void) => void }) => void; reject: (e: unknown) => void }[] = [];
  const released: number[] = [];
  const dropListeners: (() => void)[] = [];
  let n = 0;
  const api: WakeLockApi = {
    request: () =>
      new Promise((resolve, reject) => {
        answers.push({ resolve: resolve as never, reject });
      }),
  };
  const sentinel = () => {
    const id = ++n;
    return {
      release: async () => {
        released.push(id);
      },
      addEventListener: (_: 'release', l: () => void) => dropListeners.push(l),
    };
  };
  return { api, answers, released, dropListeners, sentinel };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the screen stays awake (E3, D13, D21)', () => {
  it('asks once on entry and releases on leaving', async () => {
    const f = fakeLock();
    const awake = keepAwake(() => {}, f.api);
    expect(f.answers).toHaveLength(1);
    f.answers[0]!.resolve(f.sentinel());
    await settle();
    awake.stop();
    expect(f.released).toEqual([1]);
  });

  /*
   * MUTATION PROOF, run: the `if (!active)` release on a late answer
   * removed: `expected [] to deeply equal [ 1 ]`.
   */
  it('an answer that arrives after leaving is released at once (D13)', async () => {
    const f = fakeLock();
    const awake = keepAwake(() => {}, f.api);
    awake.stop();
    f.answers[0]!.resolve(f.sentinel());
    await settle();
    expect(f.released).toEqual([1]);
  });

  /*
   * MUTATION PROOF, run: `touch` made a no-op: `expected 1 to be 2 //
   * Object.is equality` (and the refusal case then finds no second request).
   */
  it('a lock the browser dropped is asked for again on the next tap, not before (D21)', async () => {
    const f = fakeLock();
    const awake = keepAwake(() => {}, f.api);
    f.answers[0]!.resolve(f.sentinel());
    await settle();
    awake.touch();
    expect(f.answers).toHaveLength(1); // still held: nothing to ask
    f.dropListeners[0]!();
    awake.touch();
    expect(f.answers.length).toBe(2);
  });

  it('a refusal is reported once, however often the tap asks again (D12)', async () => {
    const f = fakeLock();
    const refused = vi.fn();
    const awake = keepAwake(refused, f.api);
    f.answers[0]!.reject(new DOMException('no', 'NotAllowedError'));
    await settle();
    awake.touch();
    f.answers[1]!.reject(new DOMException('no', 'NotAllowedError'));
    await settle();
    expect(refused).toHaveBeenCalledTimes(1);
  });

  it('without a wake lock in the browser it does nothing and says nothing', () => {
    const refused = vi.fn();
    const awake = keepAwake(refused, undefined);
    awake.touch();
    awake.stop();
    expect(refused).not.toHaveBeenCalled();
  });
});

describe('the Back gesture (D10)', () => {
  it('pushes one entry; Back pops it and leaves build mode', async () => {
    const before = window.history.length;
    const back = vi.fn();
    enterHistory(back);
    expect(window.history.length).toBe(before + 1);
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(back).toHaveBeenCalledTimes(1);
    // A second popstate (any other navigation) no longer reaches build mode.
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  /*
   * MUTATION PROOF, run: the leave function no longer pops its entry
   * (`window.history.back()` removed): `expected "back" to be called 1
   * times, but got 0 times`.
   */
  it('leaving by a button pops the entry it pushed, without calling back into build mode', () => {
    const back = vi.fn();
    const histBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const h = enterHistory(back);
    h.leave();
    expect(histBack).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(back).not.toHaveBeenCalled();
  });
});

describe('unmounting (D10)', () => {
  it('detaching stops listening without navigating', () => {
    const back = vi.fn();
    const histBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    enterHistory(back).detach();
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(back).not.toHaveBeenCalled();
    expect(histBack).not.toHaveBeenCalled();
  });
});
