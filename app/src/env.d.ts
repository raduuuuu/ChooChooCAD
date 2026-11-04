/// <reference types="vite/client" />

/** Injected by vite.config.ts at build time. The short commit, or 'unknown'. */
declare const __APP_VERSION__: string;

/** GoatCounter's settings object, read by app/public/count.js (linkFragment.ts). */
interface Window {
  goatcounter?: { path?: (counted: string) => string; allow_local?: boolean };
}
