/**
 * DRAGGING A PIECE OUT OF THE PALETTE (decisions E6, 6A, 16A; plan task T7).
 *
 * A pointerdown on a palette button starts nothing. Past 4 CSS pixels it picks
 * the piece, and the preview follows the pointer over the canvas: within the
 * snap radius of a free end it goes on there (as `moveGhost`), elsewhere it
 * stands free with its origin on the pointer, snapped to whole centimetres,
 * pointing the way it already did. R turns it as usual.
 *
 * Release over the canvas DROPS it: placed if it fits clean, else left pending
 * and red with the reason in the Placing strip (6A). Release off the canvas,
 * Esc, `pointercancel` or a failure to capture the pointer cancels it, and
 * nothing is placed.
 *
 * On touch only the piece already picked drags (as 16A does for placed
 * track): a first tap picks, and a swipe over any other button still scrolls
 * the palette, which `touch-action: none` on every button would forbid.
 *
 * The button captures the pointer, so the moves keep coming to it after the
 * pointer leaves the palette for the canvas. The canvas answers where the
 * pointer is through a `CanvasProbe`, which it refreshes every render, so the
 * hook never reads a stale view.
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { Cyc } from '../../engine/src/geom/cyclotomic.js';
import type { PortRef } from '../../engine/src/graph/model.js';
import { shiftMm } from './layoutModel.js';
import { DRAG_THRESHOLD_PX, snapMm } from './useDragSession.js';

/** How far from a free end, in CSS pixels, a dragged piece goes on there. */
export const ATTACH_RADIUS_PX = 24;

/** What the canvas tells a drag about a point on screen. */
export interface CanvasProbe {
  /** Client pixels to model millimetres, or null when the point is off the canvas. */
  readonly toModel: (clientX: number, clientY: number) => readonly [number, number] | null;
  /** The nearest free end within `radiusPx` CSS pixels of a model point, or null. */
  readonly freeEndNear: (x: number, y: number, radiusPx: number) => PortRef | null;
}

export function usePaletteDrag(options: {
  readonly probe: RefObject<CanvasProbe | null>;
  /** Whether this part may start a drag for this pointer type. */
  readonly canDrag: (partId: string, pointerType: string) => boolean;
  readonly onStart: (partId: string, from: HTMLElement) => void;
  readonly onAttach: (ref: PortRef) => void;
  readonly onFloat: (pos: Cyc) => void;
  readonly onDrop: () => void;
  readonly onCancel: () => void;
}) {
  const { probe, canDrag, onStart, onAttach, onFloat, onDrop, onCancel } = options;
  const press = useRef<{
    partId: string;
    pointerId: number;
    start: [number, number];
    target: HTMLElement;
    active: boolean;
    /** Where the preview was last sent, so a move inside the same spot sends nothing. */
    last: string | null;
  } | null>(null);
  /** Set when a drag ended, so the click the browser fires after it is no pick. */
  const swallowClick = useRef(false);

  const end = (drop: boolean, at?: [number, number]) => {
    const p = press.current;
    press.current = null;
    if (!p?.active) return;
    swallowClick.current = true;
    try {
      p.target.releasePointerCapture?.(p.pointerId);
    } catch {
      // Already released by the browser; nothing to undo.
    }
    if (drop && at && probe.current?.toModel(at[0], at[1])) onDrop();
    else onCancel();
  };

  // Esc cancels a live drag. The editor's own Esc also cancels the preview;
  // this one ends the press, so the release that follows drops nothing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && press.current?.active) end(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  });

  const handlers = (partId: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || !canDrag(partId, e.pointerType)) return;
      press.current = {
        partId,
        pointerId: e.pointerId,
        start: [e.clientX, e.clientY],
        target: e.currentTarget,
        active: false,
        last: null,
      };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      if (!p.active) {
        if (Math.hypot(e.clientX - p.start[0], e.clientY - p.start[1]) < DRAG_THRESHOLD_PX) return;
        try {
          p.target.setPointerCapture(e.pointerId);
        } catch {
          // The pointer is already gone: a drag that never started.
          press.current = null;
          return;
        }
        p.active = true;
        onStart(p.partId, p.target);
      }
      const at = probe.current?.toModel(e.clientX, e.clientY);
      // Off the canvas the preview stays where it last was.
      if (!at) return;
      const near = probe.current!.freeEndNear(at[0], at[1], ATTACH_RADIUS_PX);
      if (near) {
        const key = `end:${near.pieceId}#${near.port}`;
        if (key !== p.last) onAttach(near);
        p.last = key;
        return;
      }
      const x = snapMm(at[0]);
      const y = snapMm(at[1]);
      const key = `free:${x},${y}`;
      if (key !== p.last) onFloat(shiftMm(x, y));
      p.last = key;
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      if (press.current?.pointerId === e.pointerId) end(true, [e.clientX, e.clientY]);
    },
    onPointerCancel: () => end(false),
    /** A click that ends a drag is not a pick. */
    swallowsClick: () => {
      const s = swallowClick.current;
      swallowClick.current = false;
      return s;
    },
  });

  return { handlers };
}
