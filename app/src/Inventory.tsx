/**
 * YOUR BOX: the parts you own, one count per part (owner, 2026-11-05: "simple
 * first", "always reachable and stripped back";
 * docs/plan/2026-11-05-inventory-by-part.md B1, B2).
 *
 *   [code] [name] [count]  N in use      one row per part, then the adapters
 *   [Forget this]                        back to "not said", once anything is entered
 *
 * Counts are the stored truth (D6). Nothing else lives here: what a layout is
 * short of is said by the verdict's shortfall line, and the palette greys what
 * you have used up (D8).
 */

import { useState } from 'react';
import { codeOf, type Part } from '../../engine/src/parts/schema.js';
import { ADAPTER_INVENTORY_KEY, sanitizeCount, type Inventory as InventoryCounts } from './inventoryModel.js';

export interface InventoryPanelProps {
  /** The resolved library: built-ins, seeds, and this user's submissions. */
  readonly library: readonly Part[];
  readonly inventory: InventoryCounts;
  readonly used: Readonly<Record<string, number>>;
  /** Male-male adapters the layout needs (its socket-to-socket joints). */
  readonly adaptersUsed: number;
  /** How many more adapters it needs than are owned; 0 when undeclared. */
  readonly adapterShort: number;
  readonly onChange: (next: InventoryCounts) => void;
  readonly onClose: () => void;
}

export function InventoryPanel({
  library,
  inventory,
  used,
  adaptersUsed,
  adapterShort,
  onChange,
  onClose,
}: InventoryPanelProps) {
  const declared = inventory !== null;
  /** Part ids whose last keystroke was refused. Per-field, not global. */
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});

  /*
   * THE GUARD. `Math.max(0, Math.floor(value))` passes NaN and Infinity straight
   * through, because Math.max(0, NaN) is NaN. JSON.stringify then wrote `null`,
   * the loader correctly refused a non-integer count, and every declared count
   * was discarded with no message. Typing one bad character destroyed the lot.
   *
   * Rejecting at the INPUT is the fix, not relaxing the loader: the loader was
   * right. A rejected keystroke is also shown rather than swallowed, so the
   * field does not just appear to ignore you. See `invalid` below.
   */
  const setOne = (partId: string, raw: string) => {
    const value = sanitizeCount(raw);
    if (value === null) {
      setInvalid((prev) => ({ ...prev, [partId]: true }));
      return;
    }
    setInvalid((prev) => {
      if (!prev[partId]) return prev;
      const next = { ...prev };
      delete next[partId];
      return next;
    });
    const base = inventory ?? {};
    onChange({ ...base, [partId]: value });
  };

  return (
    <section className="inventory" aria-label="What you own">
      <header className="inventory-head">
        <h2 className="inventory-title">What you own</h2>
        <button className="inventory-close" onClick={onClose}>
          Done
        </button>
      </header>

      {!declared && (
        <p className="inventory-undeclared">
          Type how many of each piece you own. Until you do, nothing is checked against your box.
        </p>
      )}

      <div className="inventory-rows">
        {library.map((part) => {
          const owned = inventory?.[part.id];
          const usedN = used[part.id] ?? 0;
          const short = declared && usedN > (owned ?? 0);
          const bad = invalid[part.id] === true;
          return (
            <label
              key={part.id}
              className={
                'inventory-row' + (short ? ' is-short' : '') + (bad ? ' is-invalid' : '')
              }
            >
              <span className="inventory-row-id num">{codeOf(part.id)}</span>
              <span className="inventory-row-name">{part.name}</span>
              <input
                className="inventory-row-input num"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={owned ?? ''}
                placeholder="—"
                aria-label={`How many ${part.name} you own`}
                aria-invalid={bad}
                // The raw string goes to the model; the component does no
                // arithmetic and makes no decision about what is valid.
                onChange={(e) => setOne(part.id, e.target.value)}
              />
              <span className="inventory-row-used num">
                {usedN > 0 ? `${usedN} in use` : ''}
              </span>
              {bad && (
                <span className="inventory-row-bad">needs a number</span>
              )}
            </label>
          );
        })}
      </div>

      {/*
        * MALE-MALE ADAPTERS (socket adapter plan, X2): not a catalogue part, so
        * a row of its own after the parts, kept under a reserved key. Same
        * field, same guard, same "in use" figure as a part row.
        */}
      <div className="inventory-rows">
        <label className={'inventory-row' + (declared && adapterShort > 0 ? ' is-short' : '') + (invalid[ADAPTER_INVENTORY_KEY] ? ' is-invalid' : '')}>
          <span className="inventory-row-id num">MM</span>
          <span className="inventory-row-name">Male-male adapters</span>
          <input
            className="inventory-row-input num"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={inventory?.[ADAPTER_INVENTORY_KEY] ?? ''}
            placeholder="—"
            aria-label="How many male-male adapters you own"
            aria-invalid={invalid[ADAPTER_INVENTORY_KEY] === true}
            onChange={(e) => setOne(ADAPTER_INVENTORY_KEY, e.target.value)}
          />
          <span className="inventory-row-used num">{adaptersUsed > 0 ? `${adaptersUsed} in use` : ''}</span>
          {invalid[ADAPTER_INVENTORY_KEY] && <span className="inventory-row-bad">needs a number</span>}
        </label>
      </div>

      {declared && (
        <div className="inventory-fills">
          <button onClick={() => onChange(null)} title="Back to not saying what you own">
            Forget this
          </button>
        </div>
      )}
    </section>
  );
}
