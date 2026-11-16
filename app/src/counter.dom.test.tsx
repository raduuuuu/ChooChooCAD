/**
 * WHAT THE COUNTER SENDS FOR A SHARED LAYOUT (plan 2026-11-01, eng X3; wired
 * by the app-focus review, D8).
 *
 * Value: protects=opened at a shared layout's address, the committed count.js
 * sends exactly one request, counted as `/shared-link`, and no field of it
 * carries the fragment, a `#`, a `%23` or the layout's own text
 * Value: fails_when=the path callback lets the fragment through, or count.js
 * starts sending the address or the hash
 * Value: seam=jsdom running the committed app/public/count.js against a
 * captured `navigator.sendBeacon`; `allow_local` stands in for the real
 * host, which jsdom's localhost is not
 * Value: no_claim=a real browser's network stack; that the request reaches
 * GoatCounter (owner's dashboard)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ACTIONS, countAction, counterPath } from './linkFragment.js';

const COUNT_JS = readFileSync(join(process.cwd(), 'app/public/count.js'), 'utf8');
const README = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
const LAYOUT = 'ZQX7layoutTEXTnotToLeave';

afterEach(() => {
  localStorage.removeItem('skipgc');
  delete window.goatcounter;
  document.querySelector('script[data-goatcounter]')?.remove();
  history.replaceState(null, '', '/');
});

describe('the counter on a shared layout', () => {
  /*
   * MUTATION PROOF, run: `counterPath` returning `location.pathname +
   * location.hash`: `expected '/#v1.ZQX7layoutTEXTnotToLeave' to be
   * '/shared-link' // Object.is equality`.
   */
  it('sends one request, as /shared-link, with nothing of the layout in it', () => {
    history.replaceState(null, '', `/#v1.${LAYOUT}`);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const sent: string[] = [];
    Object.defineProperty(navigator, 'sendBeacon', { value: (url: string) => (sent.push(url), true), configurable: true });
    const tag = document.createElement('script');
    tag.dataset.goatcounter = 'https://woodentrain.goatcounter.com/count';
    document.head.appendChild(tag);
    window.goatcounter = { path: counterPath, allow_local: true };

    new Function(COUNT_JS)();

    expect(sent).toHaveLength(1);
    const url = new URL(sent[0]!);
    expect(url.origin + url.pathname).toBe('https://woodentrain.goatcounter.com/count');
    expect(url.searchParams.get('p')).toBe('/shared-link');
    const fields = [...url.searchParams.values()].join('\n');
    expect([fields.includes('#'), sent[0]!.includes('%23'), sent[0]!.includes(LAYOUT)]).toEqual([false, false, false]);
  });

  /*
   * AN ACTION SENDS ITS NAME AND NOTHING OF THE PAGE (owner, 2026-11-05).
   * MUTATION PROOF, run: `actionEvent` without `title` (count.js then falls
   * back to the page title): `expected 'A wooden railway · 7 pieces' to be
   * 'Shared a link'`.
   */
  it('an action on a shared layout sends its fixed name, as an event, and nothing of the layout', () => {
    history.replaceState(null, '', `/#v1.${LAYOUT}`);
    document.title = 'A wooden railway · 7 pieces';
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const sent: string[] = [];
    Object.defineProperty(navigator, 'sendBeacon', { value: (url: string) => (sent.push(url), true), configurable: true });
    const tag = document.createElement('script');
    tag.dataset.goatcounter = 'https://woodentrain.goatcounter.com/count';
    document.head.appendChild(tag);
    window.goatcounter = { path: counterPath, allow_local: true, no_onload: true } as typeof window.goatcounter;

    new Function(COUNT_JS)();
    countAction('share');

    expect(sent).toHaveLength(1);
    const url = new URL(sent[0]!);
    expect(url.searchParams.get('p')).toBe('action/share');
    expect(url.searchParams.get('e')).toBe('true');
    expect(url.searchParams.get('t')).toBe('Shared a link');
    expect([sent[0]!.includes('%23'), sent[0]!.includes(LAYOUT), sent[0]!.includes('pieces')]).toEqual([false, false, false]);
  });
});

describe('what the README says the site sends (owner, 2026-11-16)', () => {
  /** Run the committed count.js for one visit and hand back what it sent. */
  function visit(address: string): URL[] {
    history.replaceState(null, '', address);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const sent: string[] = [];
    Object.defineProperty(navigator, 'sendBeacon', { value: (url: string) => (sent.push(url), true), configurable: true });
    const tag = document.createElement('script');
    tag.dataset.goatcounter = 'https://woodentrain.goatcounter.com/count';
    document.head.appendChild(tag);
    window.goatcounter = { path: counterPath, allow_local: true } as typeof window.goatcounter;
    new Function(COUNT_JS)();
    return sent.map((u) => new URL(u));
  }

  /*
   * MUTATION PROOFS, run:
   * - a field added to count.js's `get_data` (`w: window.innerWidth`): `expected
   *   [ 'b', 'p', 'q', 'rnd', 's', 't', 'w' ] to deeply equal [ 'b', 'p', 'q', 'rnd', 's', 't' ]`.
   * - the `?` part no longer sent (`q: ''`): `expected [ 'b', 'p', 'rnd', 's', 't' ]
   *   to deeply equal [ 'b', 'p', 'q', 'rnd', 's', 't' ]`.
   */
  it('a visit sends the fields the README lists, and no others', () => {
    const [url] = visit('/?from=a-friend');
    // automated, path, query, a random string against caching, screen width, title. The page it came
    // from (`r`) joins them when the browser gives one, which jsdom does not; `e` marks an action.
    expect([...url!.searchParams.keys()].sort()).toEqual(['b', 'p', 'q', 'rnd', 's', 't']);
    expect(url!.searchParams.get('p')).toBe('/');
    expect(url!.searchParams.get('q')).toBe('?from=a-friend');
    expect(url!.searchParams.get('s')).toBe(String(window.screen.width));
  });

  /*
   * MUTATION PROOF, run: count.js's `skipgc` check taken out of `filter`:
   * `expected [ …(1) ] to deeply equal []`.
   */
  it('with skipgc set to t in local storage, nothing is sent', () => {
    localStorage.setItem('skipgc', 't');
    expect(visit('/')).toEqual([]);
  });

  /*
   * MUTATION PROOFS, run:
   * - an action added to ACTIONS and not to the README (`kept: 'Kept a
   *   layout'`): `expected [ 'Kept a layout' ] to deeply equal []`.
   * - the README's count left at ten with an eleventh action listed: `expected 10 to be 11`.
   * - a README line removed ("- Switched to 3D"): `expected [ 'Switched to 3D' ]
   *   to deeply equal []`.
   */
  it('the README names every action that is counted, and how many', () => {
    const labels = Object.values(ACTIONS);
    expect(labels.filter((label) => !README.includes(`\n- ${label}\n`))).toEqual([]);
    const said = /each of these (\w+) actions/.exec(README)![1];
    expect(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'].indexOf(said!)).toBe(labels.length);
  });
});
