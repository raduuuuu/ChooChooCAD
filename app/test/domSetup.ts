/**
 * Runs before every file in the `dom` test project (see vitest.config.ts).
 *
 * Each test starts from an empty document and empty storage. The app persists
 * its layout to `localStorage`, so a test that leaves a graph behind would
 * hand the next one a restored layout, which is exactly the kind of coupling
 * that passes alone and fails in a suite.
 */

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/*
 * NODE'S OWN WEB STORAGE SHADOWS JSDOM'S. Node 25 and later define
 * `localStorage` and `sessionStorage` accessors on the global object, which
 * return undefined unless Node is started with `--localstorage-file`. Vitest's
 * jsdom environment copies the jsdom window's properties onto the global but
 * leaves keys that already exist, so the app saw `localStorage` as undefined.
 * Measured on Node 26.7.0: the global descriptor was a get/set accessor, while
 * `jsdom.window.localStorage` was a working Storage. Point both at jsdom's.
 */
const jsdomWindow = (globalThis as unknown as { jsdom?: { window: Window & typeof globalThis } }).jsdom?.window;
if (!jsdomWindow) throw new Error('domSetup.ts expects the jsdom environment');
for (const key of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, key, {
    value: jsdomWindow[key],
    configurable: true,
    writable: true,
  });
}

/*
 * THE BROWSER'S DIALOG, STOOD IN FOR (plan 2026-11-14, eng ED1). jsdom's
 * HTMLDialogElement is an empty class: no `showModal`, no `close`. This gives
 * it just enough for the app's own logic to be tested: `showModal` opens it,
 * `close` shuts it and fires `close`, as a browser does. It holds no focus,
 * blocks nothing behind it and knows no Escape key, so a test of those would
 * only test this stand-in: they are checked in a real browser (task T12).
 */
const dialogProto = jsdomWindow.HTMLDialogElement.prototype as HTMLDialogElement;
if (typeof dialogProto.showModal !== 'function') {
  dialogProto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new jsdomWindow.Event('close'));
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
