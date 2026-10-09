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

import { BRIO_PARTS } from '../../engine/data/brio.js';
import {
  QUICK_FILLS,
  type Inventory as InventoryCounts,
  type Shortfall,
} from './inventoryModel.js';

export interface InventoryPanelProps {
  readonly inventory: InventoryCounts;
  readonly used: Readonly<Record<string, number>>;
  readonly shortfalls: readonly Shortfall[];
  readonly onChange: (next: InventoryCounts) => void;
  readonly onClose: () => void;
}

export function InventoryPanel({
  inventory,
  used,
  shortfalls,
  onChange,
  onClose,
}: InventoryPanelProps) {
  const declared = inventory !== null;

  const setOne = (partId: string, value: number) => {
    const base = inventory ?? {};
    onChange({ ...base, [partId]: Math.max(0, Math.floor(value)) });
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
          piece stays available. Fill any number in below, or start from a quick-fill.
        </p>
      )}

      <div className="inventory-rows">
        {BRIO_PARTS.map((part) => {
          const owned = inventory?.[part.id];
          const usedN = used[part.id] ?? 0;
          const short = declared && usedN > (owned ?? 0);
          return (
            <label key={part.id} className={short ? 'inventory-row is-short' : 'inventory-row'}>
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
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    // Blanking one field means zero of that part, not undeclared.
                    // Undeclared is the whole inventory, and "Forget this" clears it.
                    setOne(part.id, 0);
                  } else {
                    setOne(part.id, Number(v));
                  }
                }}
              />
              <span className="inventory-row-used num">
                {usedN > 0 ? `${usedN} in use` : ''}
              </span>
            </label>
          );
        })}
      </div>

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
          <button key={q.label} title={q.note} onClick={() => onChange({ ...q.counts })}>
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
