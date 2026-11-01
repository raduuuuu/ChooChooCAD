import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { startReadOnlySession } from '../../engine/data/storage.js';
import { App } from './App.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { LINK_FRAGMENT } from './linkFragment.js';
import { BUILD_LINK_STORAGE_KEY } from './storageKeys.js';

/*
 * A SHARED LINK IS DECIDED HERE, BEFORE ANYTHING MOUNTS (share plan, eng D17,
 * D31). Any `#v<digits>.` is a link, so the editor never mounts for one and
 * the storage session is on before any component could save. The link route
 * and its decoder are their own chunk: the editor never downloads them.
 * Everything else is the editor, which opens on the first-visit example when
 * this browser has no layout of its own (design 3A).
 */
const LinkRoute = lazy(() => import('./LinkRoute.js').then((m) => ({ default: m.LinkRoute })));

const root = createRoot(document.getElementById('root')!);
if (LINK_FRAGMENT.test(location.hash)) {
  startReadOnlySession([BUILD_LINK_STORAGE_KEY]);
  root.render(
    <StrictMode>
      <Suspense fallback={null}>
        <LinkRoute fragment={location.hash} />
      </Suspense>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App offerExample />
      </ErrorBoundary>
    </StrictMode>,
  );
}
