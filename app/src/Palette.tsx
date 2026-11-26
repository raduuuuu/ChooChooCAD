/**
 * THE PIECES YOU CAN PLACE: the cards and their shelves (cut out of App.tsx
 * with no behaviour change; plan 2026-11-14, E4, choice C6,
 * docs/plan/2026-11-14-additions-eng.md).
 *
 *   App.tsx ── library, box, what is on the floor, the picked piece ──▶ PieceShelves
 *                                                                        │ the Generic list (scrolls)
 *                                                                        │ one closed shelf per other system
 *   pick / place-at-once / drag ◀── onPick, onAdd, paletteDrag ◀─────────┘ a card per part
 *
 * It holds no state of its own: what is picked, what the box holds and what
 * is on the floor are App's, handed in. That is what lets another screen (a
 * phone's sheet) show the same shelves somewhere else.
 *
 * The controls under the shelves (undo, the ready layouts, files, your box)
 * are still in App.tsx: they are plain buttons on App's own state.
 */

import { useMemo, type ReactNode } from 'react';
import { isStructure } from '../../engine/data/library.js';
import { isMeasured } from '../../engine/data/measured.js';
import { originLabel, originOf, originUrl } from '../../engine/data/origins.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { SYSTEM_NAME, centrelineRadiusMm, isUnverified, shortCode } from '../../engine/src/parts/schema.js';
import type { Brand, Part } from '../../engine/src/parts/schema.js';
import { wouldExceed, type Inventory } from './inventoryModel.js';
import { MeasuredTick, OriginGlyph, PartPreview } from './PartPreview.js';
import { previews } from './previewGeometry.js';
import type { usePaletteDrag } from './usePaletteDrag.js';

/** Generic first, because it is the only brand whose dimensions are published. */
const BRAND_ORDER: readonly Brand[] = ['GENERIC', 'IKEA', 'PLAYTIVE', 'HAPE', 'THOMAS', 'MELISSA_DOUG'];
/**
 * A brand's parts in library order, except that a ramp sits right after the
 * long straight it shares a length with (design 12A): the ascending track is
 * a seed outside `GENERIC_PARTS`, so library order would put it after the curves.
 */
/** A part's size on its palette card: a length, a radius, or a multi-road piece's own label (eng review D8). */
export function paletteSize(part: Part): string {
  if (part.kind === 'straight') return `${part.lengthMm}mm`;
  if (part.kind === 'curve') return `r${centrelineRadiusMm(part)}`;
  if (part.kind === 'buffer') return `${part.lengthMm}mm`;
  return part.sizeLabel;
}
const isRamp = (p: Part) => p.kind === 'straight' && p.rise !== undefined;
/** What a structure carries, in the floor/raised words (design decision 2, rule 7). */
const structureUse = (p: Part): string =>
  p.kind === 'block'
    ? 'Holds raised track'
    : p.kind === 'straight' && (p.hump !== undefined || p.deckClearanceMm !== undefined)
      ? 'Road over, track passes under'
      : p.kind === 'straight' && p.deck !== undefined ? 'Raised road' : 'Floor road';
/** A decorated card's line: the plain piece it behaves as, by code and name (decorated-pieces design 2A). */
const worksLike = (p: Part, resolve: (id: string) => Part): string | null => {
  if (p.decoratedFrom === undefined) return null;
  const base = resolve(p.decoratedFrom);
  return `Works like ${shortCode(base)}, ${base.name}`;
};
const partsByBrand = (lib: readonly Part[], b: Brand) => {
  // Structures and decorated pieces have their own headings (design 2; decorated-pieces design 1A).
  const own = lib.filter((p) => p.brand === b && !isStructure(p) && p.decoratedFrom === undefined);
  const ramps = own.filter(isRamp);
  const flat = own.filter((p) => !isRamp(p));
  const at = flat.findIndex((p) => p.id === 'D');
  return at === -1 ? [...flat, ...ramps] : [...flat.slice(0, at + 1), ...ramps, ...flat.slice(at + 1)];
};


/**
 * A brand's shelf in the palette.
 *
 * Generic is a plain open group. Every other brand is a `<details>` that starts
 * CLOSED, so its pieces cost one line until you want them.
 *
 * The first attempt capped the palette and let it scroll, which gave the
 * canvas its space back and then hid the small-peg and look-alike systems entirely below an
 * invisible fold: on macOS the overlay scrollbar does not show until you
 * scroll, so a third of the catalogue simply looked absent. Collapsing is
 * better than clipping, because a closed row still says the brand is there
 * and still carries its warning.
 *
 * It also matches the actual hierarchy. Generic is the only brand whose
 * dimensions are published, so it is the default; the others are opt-in, and
 * their summary line states that their sizes are unverified before you can
 * reach a single one of their pieces.
 */
function BrandGroup({ brand, children }: { brand: Brand; children: ReactNode }) {
  if (brand === 'GENERIC') return <div className="brand-group">{children}</div>;
  return (
    <details className="brand-group is-collapsible">{children}</details>
  );
}

export interface PieceShelvesProps {
  /** Every part that can be placed: the built-ins and the user's own. */
  readonly library: readonly Part[];
  readonly resolve: (id: string) => Part;
  /** The user's box, or null when none is declared. */
  readonly inventory: Inventory;
  /** How many of each part are on the floor. */
  readonly counts: Readonly<Record<string, number>>;
  /** Placing is paused: there is too much track to draw. */
  readonly overLimit: boolean;
  /** The part whose preview is out, or null. */
  readonly pickedId: string | null;
  /**
   * The drag handlers for a card (`usePaletteDrag`). Left out, a card is
   * picked by a tap and nothing else: the phone's sheet, where a list that
   * scrolls under the finger must never grab a piece (plan 2026-11-14, DD13).
   */
  readonly paletteDrag?: ReturnType<typeof usePaletteDrag>['handlers'];
  /** One click: the piece appears where it would go. */
  readonly onPick: (partId: string, from: HTMLElement | null) => void;
  /** A double-click or Shift+Enter: placed at once, in its first orientation. */
  readonly onAdd: (partId: string) => void;
}

/** The Generic list, which scrolls, and under it one closed shelf for each other system. */
export function PieceShelves({ library, resolve, inventory, counts, overLimit, pickedId, paletteDrag, onPick, onAdd }: PieceShelvesProps) {
  const structures = useMemo(() => library.filter(isStructure), [library]);
  const decorated = useMemo(() => library.filter((p) => p.decoratedFrom !== undefined), [library]);
  // Pieces a check on a real piece backs, for the card's tick (verified-mark plan, 9A).
  const measuredIds = useMemo(() => new Set(library.filter((p) => isMeasured(p)).map((p) => p.id)), [library]);
  // Each card's drawing, rebuilt when the library is (eng D1: a correction keeps the id).
  const partPreviews = useMemo(() => previews(library), [library]);

  /* One part's card in the palette. A structure's card adds what it is for and, while it is a guess, says so (design decision 2). */
  const renderCard = (part: Part) => {
            /*
             * ADVICE, NEVER A GATE (decision D8).
             *
             * `is-unowned` greys the button and nothing else. It stays clickable,
             * stays focusable, and carries no `disabled`, because a shortfall is
             * information about the real world rather than an error in the
             * layout: people borrow track, buy more, and sketch layouts they
             * cannot build yet. Hiding or disabling the piece would teach the
             * user nothing and read as a bug. `aria-describedby` is not used
             * here either; the state is carried in the accessible name below so
             * it is announced with the control rather than after it.
             */
            const unowned = wouldExceed(inventory, counts, part.id);
            const unverified = isUnverified(part);
            const measured = measuredIds.has(part.id);
            const origin = originOf(part);
            const likeLine = worksLike(part, resolve);
            return (
            <div
              key={part.id}
              className={
                'piece' + (unowned ? ' is-unowned' : '') + (unverified ? ' is-unverified' : '')
              }
            >
              <button
                className="piece-main"
                /*
                 * One click PICKS: the piece appears where it would go, to be
                 * turned and then placed (decision R3). A double-click, or
                 * Shift+Enter, places it straight away in its first
                 * orientation (decision 9A), which is how eight clicks still
                 * build a circle.
                 */
                {...(paletteDrag
                  ? (({ swallowsClick, ...h }) => ({
                      ...h,
                      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                        if (!swallowsClick()) onPick(part.id, e.currentTarget);
                      },
                    }))(paletteDrag(part.id))
                  : { onClick: (e: React.MouseEvent<HTMLButtonElement>) => onPick(part.id, e.currentTarget) })}
                onDoubleClick={() => onAdd(part.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    onAdd(part.id);
                  }
                }}
                disabled={overLimit}
                // The picked piece's button takes a touch drag (see usePaletteDrag).
                data-picked={pickedId === part.id ? '' : undefined}
                // The pick is said, not only drawn: "pressed" while its ghost is out.
                aria-pressed={pickedId === part.id}
                // The full code and name, which the card may cut short (11A, eng D5).
                title={`${shortCode(part)} ${part.name}.${measured ? ' Measured.' : ''}${likeLine ? ` ${likeLine}.` : ''} Double-click to place directly`}
                aria-label={[
                  // The name, then each note as its own sentence.
                  `Add ${part.name}${isRamp(part) || isStructure(part) || likeLine || unverified || unowned || measured ? '.' : ''}`,
                  // Checked against a real piece (verified-mark plan, 6C).
                  ...(measured ? ['Measured.'] : []),
                  ...(isRamp(part) ? ['Climbs one level.'] : []),
                  ...(isStructure(part) ? [`${structureUse(part)}.`] : []),
                  ...(likeLine ? [`${likeLine}.`] : []),
                  ...(unverified ? ['Unverified size.'] : []),
                  ...(unowned ? ['More than you own.'] : []),
                ].join(' ')}
              >
                {/* The part's drawing, first in the row (1A); a ramp's chevron is in it (9A). */}
                <PartPreview preview={partPreviews.get(part.id) ?? null} />
                <span className="piece-id num">
                  {shortCode(part)}
                  {/* The tick sits where `*` does (3A). */}
                  {measured && <MeasuredTick />}
                </span>
                {isStructure(part) ? (
                  <span className="piece-name has-notes">
                    <span className="piece-name-text">{part.name}</span>
                    <span className="piece-note">{structureUse(part)}</span>
                    {unverified && <span className="piece-note">Estimated size</span>}
                  </span>
                ) : likeLine ? (
                  <span className="piece-name has-notes">
                    <span className="piece-name-text">{part.name}</span>
                    <span className="piece-note">{likeLine}</span>
                  </span>
                ) : (
                  <span className="piece-name">{part.name}</span>
                )}
                <span className="piece-dim num">{paletteSize(part)}</span>
              </button>
              {/*
                * THE MODEL LINK (printable-mark plan, 4B): beside the card, never
                * inside its button, and live even while placing is paused (9A).
                */}
              {origin && (
                <a
                  className="piece-origin"
                  href={originUrl(origin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={originLabel(origin)}
                  title={originLabel(origin)}
                >
                  <OriginGlyph />
                </a>
              )}
              {counts[part.id] ? <span className="piece-count num">{counts[part.id]}</span> : null}
            </div>
            );
  };

  /* One brand's shelf. Used twice: Generic inside the scrolling region, the
     rest pinned below it. See the comment at the call site. */
  const renderBrand = (brand: Brand) => (
    <BrandGroup key={brand} brand={brand}>
          {brand !== 'GENERIC' && (
            /*
              * ONE LINE, not a paragraph, and it doubles as the group's
              * disclosure control.
              *
              * This was four lines of running prose between two rows of
              * buttons, twice over, and it was most of why the palette ate 70%
              * of the screen. The content was right and the placement was not:
              * a tool's parts bin is scanned, not read.
              *
              * Nothing is hidden that matters. The summary keeps both facts
              * that change what you click, the sizes are unverified and
              * whether the brand joins Generic, and it says them BEFORE you can
              * reach one of the pieces. Provenance and the pieces themselves
              * are one click away. The full consequence still arrives
              * unprompted at the moment it matters: place one and the
              * verdict's trust register spells out the mismatch for THAT
              * layout. Same move K4 made with the provisional note.
              */
            <>
            <summary className="brand-note">
              <span className="brand-name">{SYSTEM_NAME[brand]} track</span>
              <span className="brand-warn">unverified</span>
              <span className="brand-count">
                {partsByBrand(library, brand).length}
                {partsByBrand(library, brand).length === 1 ? ' piece' : ' pieces'}
              </span>
            </summary>
            {/*
              * The full warning sits INSIDE the shelf, above its pieces.
              *
              * The summary has to fit one line in a 320px rail, and the whole
              * sentence does not. Putting it here loses nothing, because the
              * shelf has to be opened before any of its pieces can be clicked:
              * the warning is still read before the part is chosen, which is
              * the thing that actually matters. The summary keeps the word
              * that makes you look.
              */}
            <p className="brand-detail">
              {brandFit('GENERIC', brand).fit === 'does-not-join'
                ? 'These are reported not to join Generic track.'
                : 'Whether these join Generic track is undocumented.'}{' '}
              Nobody publishes dimensions for them; the figures come from 3D-print
              reproductions. Place one and the verdict says what that means for your
              layout.
            </p>
            </>
          )}
        <div className="palette-row">
          {partsByBrand(library, brand).map(renderCard)}
        </div>
        {/*
          * THE KEY to the two card signs (verified-mark plan, 10A, 14A): read
          * where they are seen, not only on hover.
          */}
        {brand === 'GENERIC' && (
          <p className="palette-key">
            <span>
              <MeasuredTick /> Measured.
            </span>{' '}
            <span>
              <span className="palette-key-star">*</span> Unverified size.
            </span>{' '}
            <span>
              <OriginGlyph /> Printable model.
            </span>
          </p>
        )}
        {/*
          * STRUCTURES, after every track group (design decision 2): wood that
          * is not track, so it is not mixed in with the pieces a run is built
          * from.
          */}
        {brand === 'GENERIC' && structures.length > 0 && (
          <>
            <h3 className="palette-subhead">Structures</h3>
            <div className="palette-row">{structures.map(renderCard)}</div>
          </>
        )}
        {/*
          * DECORATED PIECES (decorated-pieces design 1A): pieces that work like
          * a plain part, with decoration on them; after Structures, so the
          * track lists stay the plain pieces a run is built from.
          */}
        {brand === 'GENERIC' && decorated.length > 0 && (
          <>
            <h3 className="palette-subhead">Decorated</h3>
            <div className="palette-row">{decorated.map(renderCard)}</div>
          </>
        )}
    </BrandGroup>
  );

  return (
    <>
        <div className="palette-parts">
          {overLimit && (
            <p className="palette-paused">
              Placing is paused: too much track to draw. Remove pieces in the layout list to continue.
            </p>
          )}
          {renderBrand('GENERIC')}
        </div>
        <div className="palette-shelves">
          {BRAND_ORDER.filter((b) => b !== 'GENERIC' && partsByBrand(library, b).length > 0)
            .map(renderBrand)}
        </div>
    </>
  );
}
