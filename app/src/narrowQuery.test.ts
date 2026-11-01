/**
 * THE CSS GATE AND THE JS GATE AGREE (share plan, eng D67, D73).
 *
 * Value: protects=the one media query marked `/* gate: NARROW_QUERY *\/` in
 * app.css is exactly NARROW_QUERY, so the stylesheet never hides the editor
 * at a width where App still shows it, or the other way round
 * Value: fails_when=either breakpoint moves alone, or the marker goes
 * Value: why_new=the breakpoint lived only in CSS until the phone screen
 * needed it in JS
 * Value: seam=app.css read with postcss; only the marked rule is checked, so
 * build mode's own 599px rule and the friend screen's are left alone
 * Value: no_claim=how either side looks
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type AtRule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { NARROW_QUERY } from './useMatchMedia.js';

const css = postcss.parse(readFileSync(join(__dirname, 'app.css'), 'utf8'));

/** Each media rule whose comment just before it starts `gate: NARROW_QUERY`. */
function gated(): AtRule[] {
  const out: AtRule[] = [];
  css.walkAtRules('media', (rule) => {
    const before = rule.prev();
    if (before?.type === 'comment' && before.text.startsWith('gate: NARROW_QUERY')) out.push(rule);
  });
  return out;
}

describe('the narrow gate', () => {
  /*
   * MUTATION PROOF, run: the marked rule changed to `(max-width: 600px)`:
   * `expected [ '(max-width: 600px)' ] to deeply equal [ '(max-width:
   * 620px)' ]`.
   */
  it('the marked media query is NARROW_QUERY, and there is exactly one', () => {
    expect(gated().map((r) => r.params)).toEqual([NARROW_QUERY]);
  });
});
