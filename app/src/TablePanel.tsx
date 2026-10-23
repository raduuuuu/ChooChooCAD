/**
 * The table panel (backlog E4): the table or room size, in centimetres.
 *
 * Offered beside "Your box", so only once a layout exists (decision D10): a
 * fit has nothing to say about an empty floor.
 *
 * Each field keeps the text as typed, and the table changes only when BOTH
 * sides are valid. A half-typed "1" on the way to "120" is refused and shown
 * as refused rather than stored, the same rule the inventory's counts follow:
 * the model decides what is valid, and nothing invalid reaches storage.
 */

import { useState } from 'react';
import { sanitizeSideCm, TABLE_MAX_CM, TABLE_MIN_CM, type Table } from './tableModel.js';

export interface TablePanelProps {
  readonly table: Table;
  readonly onChange: (next: Table) => void;
  readonly onClose: () => void;
}

const asCm = (mm: number | undefined): string => (mm === undefined ? '' : String(mm / 10));

export function TablePanel({ table, onChange, onClose }: TablePanelProps) {
  const [width, setWidth] = useState(asCm(table?.widthMm));
  const [depth, setDepth] = useState(asCm(table?.depthMm));
  // A blank field is not yet wrong; it becomes wrong once the user has typed in it.
  const [touched, setTouched] = useState({ width: false, depth: false });

  const update = (nextWidth: string, nextDepth: string) => {
    const w = sanitizeSideCm(nextWidth);
    const d = sanitizeSideCm(nextDepth);
    if (w !== null && d !== null) onChange({ widthMm: w, depthMm: d });
  };
  const bad = (raw: string, wasTouched: boolean) => wasTouched && sanitizeSideCm(raw) === null;
  const badWidth = bad(width, touched.width);
  const badDepth = bad(depth, touched.depth);

  return (
    <section className="inventory" aria-label="Your table">
      <header className="inventory-head">
        <h2 className="inventory-title">Your table</h2>
        <button className="inventory-close" onClick={onClose}>
          Done
        </button>
      </header>
      <p className="inventory-undeclared">
        The table or floor space you have, in centimetres. It is drawn centred under the track.
      </p>
      <div className="inventory-rows">
        <label className={'inventory-row' + (badWidth ? ' is-invalid' : '')}>
          <span className="inventory-row-name">Width</span>
          <input
            className="inventory-row-input num"
            type="number"
            min={TABLE_MIN_CM}
            max={TABLE_MAX_CM}
            inputMode="decimal"
            value={width}
            aria-label="Table width in centimetres"
            aria-invalid={badWidth}
            onChange={(e) => {
              setWidth(e.target.value);
              setTouched((t) => ({ ...t, width: true }));
              update(e.target.value, depth);
            }}
          />
          <span className="inventory-row-used">cm</span>
          {badWidth && <span className="inventory-row-bad">{TABLE_MIN_CM} to {TABLE_MAX_CM} cm</span>}
        </label>
        <label className={'inventory-row' + (badDepth ? ' is-invalid' : '')}>
          <span className="inventory-row-name">Depth</span>
          <input
            className="inventory-row-input num"
            type="number"
            min={TABLE_MIN_CM}
            max={TABLE_MAX_CM}
            inputMode="decimal"
            value={depth}
            aria-label="Table depth in centimetres"
            aria-invalid={badDepth}
            onChange={(e) => {
              setDepth(e.target.value);
              setTouched((t) => ({ ...t, depth: true }));
              update(width, e.target.value);
            }}
          />
          <span className="inventory-row-used">cm</span>
          {badDepth && <span className="inventory-row-bad">{TABLE_MIN_CM} to {TABLE_MAX_CM} cm</span>}
        </label>
      </div>
      {table !== null && (
        // The quick-fills' row, for its outline button at the touch height.
        <div className="inventory-fills">
          <button
            onClick={() => {
              onChange(null);
              setWidth('');
              setDepth('');
              setTouched({ width: false, depth: false });
            }}
          >
            Remove table
          </button>
        </div>
      )}
    </section>
  );
}
