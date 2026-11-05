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
import { countAction, counterPath } from './linkFragment.js';

const COUNT_JS = readFileSync(join(process.cwd(), 'app/public/count.js'), 'utf8');
const LAYOUT = 'ZQX7layoutTEXTnotToLeave';

afterEach(() => {
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
