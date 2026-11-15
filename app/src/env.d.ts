/// <reference types="vite/client" />

/** Injected by vite.config.ts at build time. The version and its short commit, "1.4.2+e198b4d". */
declare const __APP_VERSION__: string;
/** Injected by vite.config.ts at build time. The version in package.json, "1.4.2". */
declare const __APP_NUMBER__: string;

/** GoatCounter's settings object, read by app/public/count.js (linkFragment.ts). */
interface Window {
  goatcounter?: {
    path?: (counted: string) => string;
    allow_local?: boolean;
    /** Set by count.js once it loads. */
    count?: (vars: { path: string; title: string; referrer: string; event: boolean }) => void;
  };
}
