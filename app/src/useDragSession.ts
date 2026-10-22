/**
 * DRAGGING A RUN OF PLACED TRACK (decisions E6, D10, D14, 16A; eng structure
 * decision: pointer drags and keys live in separate modules).
 *
 * A pointerdown on a piece starts nothing. Past 4 CSS pixels of movement it
 * becomes a drag of that piece's whole run; below that, the pointerup is an
 * ordinary click and selects. On touch a drag starts only on the piece that
 * is already selected, so the first tap selects and the page can still scroll.
 *
 * While dragging, the run follows the pointer as a RIGID PREVIEW: the canvas
 * moves its ink with one transform and nothing is solved. The offset snaps to
 * whole centimetres; R turns it by 22.5 degrees about the grabbed piece's
 * first end. Releasing commits ONE move; Esc, `pointercancel` or a failure to
 * capture the pointer cancels and nothing changes.
 *
 * Screen to model goes through the flipped drawing group's own screen matrix,
 * so the y-flip and the fitted scale are both in it. With no matrix (jsdom, a
 * detached svg) a drag never starts and clicks still work.
 */

import { useEffect, useRef, useState } from 'react';

/** How far a press must travel before it is a drag, in CSS pixels. */
export const DRAG_THRESHOLD_PX = 4;
/** Free positions snap to this, in millimetres (decision D14). */
export const SNAP_MM = 10;

export interface RunDrag {
  readonly pieceId: string;
  /** Snapped offset in whole millimetres, model axes. */
  readonly dx: number;
  readonly dy: number;
  /** Sixteenths of a turn about the grabbed piece's first end. */
  readonly turns: number;
}

export function snapMm(v: number): number {
  return Math.round(v / SNAP_MM) * SNAP_MM;
}

export function useDragSession(options: {
  /** The drawing group whose screen matrix maps client pixels to model mm. */
  readonly group: SVGGraphicsElement | null;
  /** Whether a piece may start a drag for this pointer type. */
  readonly canDrag: (pieceId: string, pointerType: string) => boolean;
  readonly onCommit: (drag: RunDrag) => void;
}) {
  const { group, canDrag, onCommit } = options;
  const [drag, setDragState] = useState<RunDrag | null>(null);
  // The latest drag, readable outside a render: committing from inside a
  // state updater would run twice under StrictMode.
  const latest = useRef<RunDrag | null>(null);
  const setDrag = (d: RunDrag | null) => {
    latest.current = d;
    setDragState(d);
  };
  const press = useRef<{
    pieceId: string;
    pointerId: number;
    pointerType: string;
    startClient: [number, number];
    startModel: [number, number];
    target: Element;
    active: boolean;
  } | null>(null);
  const turns = useRef(0);
  /** Set when a drag ended, so the click the browser fires after it is ignored. */
  const swallowClick = useRef(false);

  const toModel = (x: number, y: number): [number, number] | null => {
    const m = group?.getScreenCTM?.();
    if (!m) return null;
    const p = new DOMPoint(x, y).matrixTransform(m.inverse());
    return [p.x, p.y];
  };

  const end = (commit: boolean) => {
    const p = press.current;
    press.current = null;
    if (p?.active) {
      swallowClick.current = true;
      try {
        p.target.releasePointerCapture?.(p.pointerId);
      } catch {
        // Already released by the browser; nothing to undo.
      }
      const d = latest.current;
      setDrag(null);
      if (commit && d && (d.dx !== 0 || d.dy !== 0 || d.turns !== 0)) onCommit(d);
    }
    turns.current = 0;
  };

  // Esc cancels and R turns, only while a drag is live.
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        end(false);
      } else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        turns.current = (turns.current + 1) % 16;
        if (latest.current) setDrag({ ...latest.current, turns: turns.current });
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  });

  const handlers = (pieceId: string) => ({
    onPointerDown: (e: React.PointerEvent<Element>) => {
      if (e.button !== 0 || !canDrag(pieceId, e.pointerType)) return;
      const model = toModel(e.clientX, e.clientY);
      if (!model) return;
      press.current = {
        pieceId,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startClient: [e.clientX, e.clientY],
        startModel: model,
        target: e.currentTarget,
        active: false,
      };
    },
    onPointerMove: (e: React.PointerEvent<Element>) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      if (!p.active) {
        const moved = Math.hypot(e.clientX - p.startClient[0], e.clientY - p.startClient[1]);
        if (moved < DRAG_THRESHOLD_PX) return;
        try {
          p.target.setPointerCapture(e.pointerId);
        } catch {
          // The pointer is already gone: treat as a drag that never finished.
          press.current = null;
          return;
        }
        p.active = true;
      }
      const model = toModel(e.clientX, e.clientY);
      if (!model) return;
      setDrag({
        pieceId: p.pieceId,
        dx: snapMm(model[0] - p.startModel[0]),
        dy: snapMm(model[1] - p.startModel[1]),
        turns: turns.current,
      });
    },
    onPointerUp: (e: React.PointerEvent<Element>) => {
      if (press.current?.pointerId === e.pointerId) end(true);
    },
    onPointerCancel: () => end(false),
    /** A click that ends a drag is not a selection. */
    swallowsClick: () => {
      const s = swallowClick.current;
      swallowClick.current = false;
      return s;
    },
  });

  return { drag, handlers };
}
