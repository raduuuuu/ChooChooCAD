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
import { useArrival } from './useArrival.js';
import { codeOf, type Part } from '../../engine/src/parts/schema.js';
import {
  ADAPTER_INVENTORY_KEY,
  BUY_LIST_COPIED,
  BUY_LIST_BY_HAND,
  buyListText,
  raiseToLayout,
  sanitizeCount,
  shortfalls,
  type Inventory as InventoryCounts,
} from './inventoryModel.js';

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
  /**
   * What was typed into each field whose last keystroke was refused, by part
   * id. Per-field, not global. The text is kept so the field goes on showing
   * what the person typed beside the sentence that refuses it; the stored
   * count is untouched until the field holds a number again.
   */
  const [invalid, setInvalid] = useState<Record<string, string>>({});

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
  /*
   * "THESE ARE MINE" AND THE LIST OF WHAT IS SHORT (plan 2026-11-16, A3).
   *
   *   layout uses more than the box holds ─▶ [These are mine]  raises those
   *        │                                   counts, says how many, and
   *        │                                   offers [Put it back] (one step)
   *        └─ and the box is declared ──────▶ [Copy what is short]  the list
   *                                            as text; refused by the
   *                                            browser ─▶ shown to copy by hand
   *
   * `putBack` is the box as it was before the last "These are mine". Typing a
   * count, or forgetting the box, ends the offer: it would undo that too.
   */
  const [putBack, setPutBack] = useState<{ readonly box: InventoryCounts; readonly raised: number } | null>(null);
  const [copy, setCopy] = useState<{ readonly said: string; readonly byHand: string | null }>({ said: '', byHand: null });
  const mine = raiseToLayout(inventory, used, adaptersUsed);
  const nameOf = new Map(library.map((p) => [p.id, p.name]));
  const short = buyListText(
    shortfalls(inventory, used).map((s) => ({ name: nameOf.get(s.partId) ?? s.partId, code: codeOf(s.partId), shortBy: s.shortBy })),
    adapterShort,
  );
  const takeAsMine = () => {
    setPutBack({ box: inventory, raised: mine.raised.length });
    setCopy({ said: '', byHand: null });
    onChange(mine.next);
  };
  const copyShort = async () => {
    if (short === null) return;
    try {
      await navigator.clipboard.writeText(short);
      setCopy({ said: BUY_LIST_COPIED, byHand: null });
    } catch {
      // Never silent: the list is put on screen to select and copy by hand.
      setCopy({ said: BUY_LIST_BY_HAND, byHand: short });
    }
  };

  const setOne = (partId: string, raw: string) => {
    setPutBack(null);
    const value = sanitizeCount(raw);
    if (value === null) {
      setInvalid((prev) => ({ ...prev, [partId]: raw }));
      return;
    }
    setInvalid((prev) => {
      if (prev[partId] === undefined) return prev;
      const next = { ...prev };
      delete next[partId];
      return next;
    });
    const base = inventory ?? {};
    onChange({ ...base, [partId]: value });
  };

  const arrival = useArrival<HTMLElement>();
  return (
    <section className="inventory" aria-label="What you own" ref={arrival} tabIndex={-1}>
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

      {/*
        * BEFORE THE ROWS, not after them: the list is some seventy pieces
        * long, and "These are mine" is what saves typing into it.
        */}
      {(declared || mine.raised.length > 0 || putBack !== null) && (
        <div className="inventory-fills">
          {mine.raised.length > 0 && (
            <button onClick={takeAsMine} title="Raise each count to what this layout uses">
              These are mine
            </button>
          )}
          {short !== null && <button onClick={() => void copyShort()}>Copy what is short</button>}
          {putBack !== null && (
            <button
              onClick={() => {
                onChange(putBack.box);
                setPutBack(null);
              }}
            >
              Put it back
            </button>
          )}
          {declared && (
            <button
              onClick={() => {
                setPutBack(null);
                onChange(null);
              }}
              title="Back to not saying what you own"
            >
              Forget this
            </button>
          )}
        </div>
      )}
      {/* What the two buttons did, said in words and read out (never colour, never silence). */}
      <p className="inventory-said" role="status" aria-live="polite">
        {putBack !== null && (
          <>
            <span className="num">{putBack.raised}</span> {putBack.raised === 1 ? 'count' : 'counts'} raised to match this
            layout.{' '}
          </>
        )}
        {copy.said}
      </p>
      {copy.byHand !== null && (
        <textarea
          className="inventory-list num"
          readOnly
          rows={copy.byHand.split('\n').length}
          value={copy.byHand}
          aria-label="What this layout is short of"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
      <div className="inventory-rows">
        {library.map((part) => {
          const owned = inventory?.[part.id];
          const usedN = used[part.id] ?? 0;
          const short = declared && usedN > (owned ?? 0);
          const bad = invalid[part.id] !== undefined;
          return (
            <label
              key={part.id}
              className={
                'inventory-row' + (short ? ' is-short' : '') + (bad ? ' is-invalid' : '')
              }
            >
              <span className="inventory-row-id num">{codeOf(part.id)}</span>
              <span className="inventory-row-name">{part.name}</span>
              {/*
                * A TEXT FIELD WITH THE NUMBER KEYPAD, not `type="number"`
                * (hardening, 2026-11-16). A number field hands the page an
                * empty string for anything it dislikes, and an empty field
                * means zero here: a slip of the finger was stored as "I own
                * none of these" with no word, the exact outcome the guard
                * above exists to prevent, and "needs a number" could never be
                * shown in a browser at all.
                */}
              <input
                className="inventory-row-input num"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={invalid[part.id] ?? owned ?? ''}
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
        <label className={'inventory-row' + (declared && adapterShort > 0 ? ' is-short' : '') + (invalid[ADAPTER_INVENTORY_KEY] !== undefined ? ' is-invalid' : '')}>
          <span className="inventory-row-id num">MM</span>
          <span className="inventory-row-name">Male-male adapters</span>
          <input
            className="inventory-row-input num"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={invalid[ADAPTER_INVENTORY_KEY] ?? inventory?.[ADAPTER_INVENTORY_KEY] ?? ''}
            placeholder="—"
            aria-label="How many male-male adapters you own"
            aria-invalid={invalid[ADAPTER_INVENTORY_KEY] !== undefined}
            onChange={(e) => setOne(ADAPTER_INVENTORY_KEY, e.target.value)}
          />
          <span className="inventory-row-used num">{adaptersUsed > 0 ? `${adaptersUsed} in use` : ''}</span>
          {invalid[ADAPTER_INVENTORY_KEY] !== undefined && <span className="inventory-row-bad">needs a number</span>}
        </label>
      </div>

    </section>
  );
}
