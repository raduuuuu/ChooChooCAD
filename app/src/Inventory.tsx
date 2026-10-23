/**
 * The inventory panel.
 *
 * Offered AFTER the first layout exists, never in the empty state (decision D10).
 * A blank canvas has one job, which is to get a working layout on screen in one
 * click; asking a new user to do data entry before they have seen the tool do
 * anything spends goodwill for a payoff several steps away. Once there is a
 * layout, the same question has something to be useful about: this is what you
 * would need to build THAT.
 *
 * Counts are editable text fields, not a set picker, because counts are the
 * stored truth (D6). The quick-fills write counts and are then forgotten.
 */


import { useState } from 'react';
import { isUncorroborated, isUnverified, type Part } from '../../engine/src/parts/schema.js';
import {
  ADAPTER_INVENTORY_KEY,
  QUICK_FILLS,
  sanitizeCount,
  type Inventory as InventoryCounts,
  type Shortfall,
} from './inventoryModel.js';

export interface InventoryPanelProps {
  /** The resolved library: built-ins, seeds, and this user's submissions. */
  readonly library: readonly Part[];
  readonly inventory: InventoryCounts;
  readonly used: Readonly<Record<string, number>>;
  readonly shortfalls: readonly Shortfall[];
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
  shortfalls,
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
          You haven&rsquo;t said what you own, so nothing is being checked against it. Every
          piece stays available. Fill any number in, or start from a quick-fill.
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
              <span className="inventory-row-id num">{part.id}</span>
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
              <span className="inventory-row-src" title={part.dimensions.source}>
                {isUnverified(part)
                  ? 'size unverified'
                  : part.dimensions.status === 'user-measured'
                    ? 'you measured this'
                    : isUncorroborated(part)
                      ? 'one source'
                      : ''}
              </span>
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
          {/* No source: an adapter has no size the app uses (design review DR4). */}
          <span className="inventory-row-src" />
        </label>
      </div>

      {adapterShort > 0 && (
        <p className="inventory-shortfall">
          This layout needs <span className="num">{adapterShort}</span> more male-male{' '}
          {adapterShort === 1 ? 'adapter' : 'adapters'}.
        </p>
      )}

      {shortfalls.length > 0 && (
        <p className="inventory-shortfall">
          This layout needs{' '}
          {shortfalls.map((s, i) => (
            <span key={s.partId}>
              {i > 0 && ', '}
              <span className="num">{s.shortBy}</span> more {s.partId}
            </span>
          ))}
          . You can still place them; the drawing does not care what is in your box.
        </p>
      )}

      <div className="inventory-fills">
        <span className="inventory-fills-label">Quick-fill:</span>
        {QUICK_FILLS.map((q) => (
          // A quick-fill is part counts; it says nothing about adapters, so it keeps theirs.
          <button
            key={q.label}
            title={q.note}
            onClick={() =>
              onChange({
                ...q.counts,
                ...(inventory?.[ADAPTER_INVENTORY_KEY] !== undefined
                  ? { [ADAPTER_INVENTORY_KEY]: inventory[ADAPTER_INVENTORY_KEY] }
                  : {}),
              })
            }
          >
            {q.label}
          </button>
        ))}
        {declared && (
          <button onClick={() => onChange(null)} title="Back to not saying what you own">
            Forget this
          </button>
        )}
      </div>

      <p className="inventory-note">
        These quick-fills are described in terms of this catalogue. They are{' '}
        <strong>not official BRIO set contents</strong>, which are not transcribed here.
        Whatever you pick becomes a set of counts you can edit; nothing remembers which
        quick-fill you used.
      </p>
    </section>
  );
}
