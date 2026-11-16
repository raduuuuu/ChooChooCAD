/**
 * A PANEL THAT OPENS ARRIVES WHERE THE PERSON IS LOOKING (design review of
 * My layouts, 2026-11-16).
 *
 *   press "My layouts" ─▶ the button is replaced by a panel further along the
 *                          column ─▶ at 1280 by 800, 4px of it was on screen,
 *                          and the keyboard's place was the page itself
 *
 *   on arrival ─▶ scrolled into view: a short panel whole, a tall one from
 *                 its heading ("nearest" does both)
 *              ─▶ takes the focus, only when the press left it nowhere; a
 *                 panel that is already in view, as on a phone, does not move
 *
 * Once, when the panel is first drawn: never on a later render, which would
 * pull the page back while someone scrolls its rows.
 */

import { useEffect, useRef } from 'react';

export function useArrival<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Not in jsdom, and not worth failing a panel over anywhere else.
    el.scrollIntoView?.({ block: 'nearest' });
    if (document.activeElement === document.body) el.focus({ preventScroll: true });
  }, []);
  return ref;
}
