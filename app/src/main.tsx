import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startReadOnlySession } from '../../engine/data/storage.js';
import { App } from './App.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { counterPath, counterTag, GOATCOUNTER_CODE, routeOf } from './linkFragment.js';
import { linkScreen } from './linkRoutes.js';
import { moveOldNames } from './oldNames.js';
import { BUILD_LINK_STORAGE_KEY } from './storageKeys.js';

/*
 * A SHARED LINK IS DECIDED HERE, BEFORE ANYTHING MOUNTS (share plan, eng D17,
 * D31). Any `#v<digits>.` is a link, so the editor never mounts for one and
 * the storage session is on before any component could save. The link route
 * and its decoder are their own chunk: the editor never downloads them
 * (linkRoutes.tsx).
 * Everything else is the editor, which opens on the first-visit example when
 * this browser has no layout of its own (design 3A).
 *
 * A PIECE PREVIEW (`#p<digits>.`, contributor-brief plan T4) is decided the
 * same way, in its own lazy chunk with the validator, and its session allows
 * no key at all: a preview writes nothing, not even build progress (it has
 * no Build it).
 */

// Saved data under the old key names moves first, before anything reads it.
moveOldNames();

const root = createRoot(document.getElementById('root')!);
const route = routeOf(location.hash);
if (route === 'piece' || route === 'layout') {
  startReadOnlySession(route === 'piece' ? [] : [BUILD_LINK_STORAGE_KEY]);
  // Each link screen in its own lazy chunk, caught if it never arrives, and reloaded on a pasted link (linkRoutes.tsx).
  root.render(<StrictMode>{linkScreen(route, location.hash)}</StrictMode>);
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App offerExample />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// Visits only, counted after the page is up, in production builds with a site
// code (linkFragment.ts). The path is ours, so a shared layout or piece is never sent.
const counter = counterTag(GOATCOUNTER_CODE, import.meta.env.PROD);
if (counter) {
  window.goatcounter = { path: counterPath };
  const script = document.createElement('script');
  script.async = true;
  script.src = counter.src;
  script.dataset.goatcounter = counter.endpoint;
  document.body.appendChild(script);
}
