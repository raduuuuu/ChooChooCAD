/**
 * Whether the page tried to reload since `watchReloads()` was called.
 *
 * jsdom can't navigate and won't let `location.reload` be replaced, so a
 * reload shows only as jsdom's own "not-implemented" error. It is read from
 * jsdom's virtual console, which vitest exposes as the `jsdom` global. The
 * specs used to spy on `console.error` for it, but under vitest 5 jsdom
 * reports to the console vitest had at setup, not the one a test spies on: a
 * reload went unseen, and every "no reload" check passed by never looking
 * (found 2026-11-09, moving to vitest 5).
 */

interface JsdomError {
  readonly type: string;
  readonly message: string;
}

interface VirtualConsole {
  on(event: 'jsdomError', listener: (e: JsdomError) => void): void;
}

export function watchReloads(): () => boolean {
  const virtualConsole = (globalThis as { jsdom?: { virtualConsole?: VirtualConsole } }).jsdom?.virtualConsole;
  if (!virtualConsole) throw new Error('watchReloads needs the jsdom test environment (a *.dom.test.tsx file)');
  let reloaded = false;
  virtualConsole.on('jsdomError', (e) => {
    if (e.type === 'not-implemented' && e.message.includes('navigation')) reloaded = true;
  });
  return () => reloaded;
}
