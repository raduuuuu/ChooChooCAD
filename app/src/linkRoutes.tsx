/**
 * THE TWO LINK SCREENS, AS main.tsx MOUNTS THEM (share plan, eng D17, D31;
 * contributor-brief T4; eng review 2026-11-11, R1 and R2). Each is its own
 * lazy chunk, so the editor never downloads a decoder, and each sits in
 * LinkRouteShell, which catches a chunk that never arrives and reloads on a
 * pasted link. Here, not in main.tsx, so a test can mount them.
 */

import { lazy, type ReactElement } from 'react';
import { LinkRouteShell } from './LinkMessage.js';

const LinkRoute = lazy(() => import('./LinkRoute.js').then((m) => ({ default: m.LinkRoute })));
const PreviewRoute = lazy(() => import('./PreviewRoute.js').then((m) => ({ default: m.PreviewRoute })));

/** A shared layout (`#v…`) or a piece preview (`#p…`) for `fragment`. */
export function linkScreen(route: 'layout' | 'piece', fragment: string): ReactElement {
  return <LinkRouteShell>{route === 'piece' ? <PreviewRoute fragment={fragment} /> : <LinkRoute fragment={fragment} />}</LinkRouteShell>;
}
