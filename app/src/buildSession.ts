/**
 * WHAT BUILD MODE DOES TO THE BROWSER WHILE IT IS OPEN (build mode plan, eng
 * D20: one owner for the session's side effects).
 *
 *   enter ─▶ history entry (D10) ─▶ wake lock (E3) ─▶ steps … ─▶ leave
 *                                      ▲   │ dropped (tab hidden)
 *                                      └───┘ asked again on the next tap (D21)
 *   every step ─▶ resume saved (D18) …  last step ─▶ resume cleared
 *
 * Three small parts, each exported for its own test: where the build was
 * left, the wake lock, and the history entry that makes the system Back
 * gesture return to the editor instead of leaving the site.
 */

import type { Graph } from '../../engine/src/graph/model.js';
import { storedGraphOf } from './layoutStore.js';
import { BUILD_STORAGE_KEY } from './storageKeys.js';

/* ------------------------------------------------------------------------- */
/* Resume (scope 5, D18, D35)                                                */
/* ------------------------------------------------------------------------- */

/** FNV-1a, 32 bits, as hex: enough to tell one saved layout from another. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The layout's identity for resuming: its exact saved form, anchors included, so moving a run counts (D18). */
export function layoutKey(graph: Graph): string {
  const text = JSON.stringify(storedGraphOf(graph));
  return `${fnv1a(text)}-${text.length}`;
}

export type ResumeState =
  /** No build was left for any layout: start at the first item. */
  | { readonly kind: 'fresh'; readonly index: 0 }
  /** This layout was being built: pick up there (D35). */
  | { readonly kind: 'resumed'; readonly index: number }
  /** A build was left for a layout that has since changed: start over, and say so (D35). */
  | { readonly kind: 'changed'; readonly index: 0 };

/**
 * Where to start. A stored value that is not `{ layout: string, index:
 * integer }` reads as no build at all; an index outside the list reads as the
 * start (scope 5).
 */
export function loadResume(graph: Graph, itemCount: number): ResumeState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(BUILD_STORAGE_KEY);
  } catch {
    return { kind: 'fresh', index: 0 };
  }
  if (raw === null) return { kind: 'fresh', index: 0 };
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { kind: 'fresh', index: 0 };
  }
  const o = v as { layout?: unknown; index?: unknown } | null;
  if (!o || typeof o.layout !== 'string' || typeof o.index !== 'number' || !Number.isInteger(o.index)) return { kind: 'fresh', index: 0 };
  if (o.layout !== layoutKey(graph)) return { kind: 'changed', index: 0 };
  if (o.index <= 0 || o.index >= itemCount) return { kind: 'fresh', index: 0 };
  return { kind: 'resumed', index: o.index };
}

/** Whether the browser kept it. False is said once, quietly (D12, D36). */
export function saveResume(graph: Graph, index: number): boolean {
  try {
    localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify({ layout: layoutKey(graph), index }));
    return true;
  } catch {
    return false;
  }
}

export function clearResume(): void {
  try {
    localStorage.removeItem(BUILD_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

/* ------------------------------------------------------------------------- */
/* Wake lock (E3, D12, D13, D21)                                             */
/* ------------------------------------------------------------------------- */

interface Sentinel {
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}
export interface WakeLockApi {
  request(type: 'screen'): Promise<Sentinel>;
}

export interface Awake {
  /** Call inside every tap or key that moves the build: asks again when the lock was dropped (D21). */
  touch(): void;
  /** Leaving build mode: release, and release later too if a request is still out (D13). */
  stop(): void;
}

/**
 * Keep the screen on while build mode is open. Where the browser has no wake
 * lock this does nothing and says nothing. A refusal is reported once.
 *
 * THE RACE (D13): a request answered after build mode closed would hold the
 * screen on in the editor, so an answer that arrives inactive is released at
 * once. iPad Safari grants the lock only inside a user gesture, so a lock the
 * browser dropped is asked for again on the next tap, not on
 * `visibilitychange` (D21).
 */
export function keepAwake(onRefused: () => void, api: WakeLockApi | undefined = navigatorWakeLock()): Awake {
  let active = true;
  let held: Sentinel | null = null;
  let pending = false;
  let refused = false;
  const request = () => {
    if (!api || pending || held || !active) return;
    pending = true;
    api.request('screen').then(
      (s) => {
        pending = false;
        if (!active) {
          void s.release();
          return;
        }
        held = s;
        s.addEventListener?.('release', () => {
          if (held === s) held = null;
        });
      },
      () => {
        pending = false;
        if (!refused) {
          refused = true;
          onRefused();
        }
      },
    );
  };
  request();
  return {
    touch: request,
    stop() {
      active = false;
      const s = held;
      held = null;
      if (s) void s.release();
    },
  };
}

function navigatorWakeLock(): WakeLockApi | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
}

/* ------------------------------------------------------------------------- */
/* History (D10)                                                             */
/* ------------------------------------------------------------------------- */

const MARK = 'choochoo-build';

export interface BuildHistory {
  /** Leaving by a button or Esc: stop listening, then pop the entry if it is still on top, so Back is never needed twice. */
  leave(): void;
  /** Unmounting: stop listening only. (React's development double mount must not navigate.) */
  detach(): void;
}

/**
 * One history entry for build mode, so the system Back gesture returns to the
 * editor. `onBack` runs when that entry is popped.
 */
export function enterHistory(onBack: () => void): BuildHistory {
  window.history.pushState({ [MARK]: true }, '');
  const pop = () => {
    window.removeEventListener('popstate', pop);
    onBack();
  };
  window.addEventListener('popstate', pop);
  const detach = () => window.removeEventListener('popstate', pop);
  return {
    detach,
    leave() {
      detach();
      const state = window.history.state as Record<string, unknown> | null;
      if (state?.[MARK]) window.history.back();
    },
  };
}
