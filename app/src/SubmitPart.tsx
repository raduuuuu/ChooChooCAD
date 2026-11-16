/**
 * Submit a part the library does not have, or correct one it has wrong.
 *
 * This is the mechanism that makes the library work at all. No manufacturer
 * publishes piece dimensions for small-peg or look-alike track, and the
 * authoritative reference says there is no dimensional standard because brands
 * deviate deliberately to avoid patents. So the only reliable source for
 * third-party track is somebody holding the piece. This is that somebody.
 *
 * Two deliberate choices in the form.
 *
 * It asks for the radius to the INNER EDGE of a curve, not the centreline,
 * because that is what a person with a ruler can actually measure: the
 * centreline is a line through the middle of the wood with nothing to put a
 * ruler against. The engine derives the centreline. Getting this backwards is
 * the exact mistake that shipped in this project's own Generic data.
 *
 * It refuses non-finite and non-positive numbers at the INPUT rather than on
 * save, because a strict loader plus an unguarded input is how an earlier
 * version of this app silently destroyed a whole saved inventory.
 */

import { useDraft } from './useDraft.js';
import { useArrival } from './useArrival.js';
import { newSubmissionId, RESERVED_ID_PREFIX, userMeasured, type Submission } from '../../engine/data/library.js';
import { SYSTEM_NAME, type Brand, type Part, type Polarity } from '../../engine/src/parts/schema.js';

// Named by trait, never by maker (design review 2026-11-04, D2). The three
// systems with no pieces read "Another system"; one option stands for them.
const BRANDS: readonly Brand[] = ['GENERIC', 'IKEA', 'PLAYTIVE', 'HAPE'];

/** Published Generic profile, used as the default for a brand nobody has measured. */
const PROFILE_DEFAULTS = { gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12 };

export interface SubmitPartProps {
  readonly existingIds: ReadonlySet<string>;
  /** Ids of switches, which this form cannot correct: it has no third end. */
  /** Ids of pieces with more than two ends, which this form cannot correct. */
  readonly notTwoEndedIds: ReadonlySet<string>;
  readonly onSubmit: (s: Submission) => void;
  readonly onCancel: () => void;
}

/**
 * A positive finite number, or null. Never NaN or Infinity into state.
 *
 * A DECIMAL COMMA IS A DECIMAL POINT (hardening, 2026-11-16). `12,5` is how
 * much of the world writes twelve and a half, and it used to be refused with
 * no word: the only sign was a greyed button. One comma and no point is read
 * as the decimal mark. Anything with both, or two commas, could be a
 * thousands separator and is not guessed at.
 */
export function parseMm(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(/^[^,.]*,[^,.]*$/.test(t) ? t.replace(',', '.') : t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Said under a size field that holds something `parseMm` cannot read. */
export const SIZE_REFUSED = 'Needs a number greater than zero, like 144 or 12.5.';

export function SubmitPart({ existingIds, notTwoEndedIds, onSubmit, onCancel }: SubmitPartProps) {
  const [brand, setBrand] = useDraft<Brand>('submit', 'brand', 'IKEA');
  const [name, setName] = useDraft('submit', 'name', '');
  const [kind, setKind] = useDraft<'straight' | 'curve'>('submit', 'kind', 'straight');
  const [lengthRaw, setLengthRaw] = useDraft('submit', 'lengthRaw', '');
  const [innerRadiusRaw, setInnerRadiusRaw] = useDraft('submit', 'innerRadiusRaw', '');
  const [arcSteps, setArcSteps] = useDraft('submit', 'arcSteps', 2);
  const [startEnd, setStartEnd] = useDraft<Polarity>('submit', 'startEnd', 'socket');
  const [endEnd, setEndEnd] = useDraft<Polarity>('submit', 'endEnd', 'peg');
  const [correcting, setCorrecting] = useDraft('submit', 'correcting', '');

  const lengthMm = parseMm(lengthRaw);
  const innerRadiusMm = parseMm(innerRadiusRaw);

  const dimensionOk = kind === 'straight' ? lengthMm !== null : innerRadiusMm !== null;
  // Something typed that is not a size: said in words, never only a greyed button.
  const lengthBad = lengthRaw.trim() !== '' && lengthMm === null;
  const radiusBad = innerRadiusRaw.trim() !== '' && innerRadiusMm === null;
  const nameOk = name.trim().length > 0;
  const ready = dimensionOk && nameOk;

  // Correcting an existing part reuses its id, which is what makes the override
  // rule fire. A new part gets a brand-prefixed id derived from its name.
  const id = correcting !== ''
    ? correcting
    : `${brand}-${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20) || 'PART'}`;
  const idCollides = correcting === '' && existingIds.has(id);
  const correctsOtherEnds = notTwoEndedIds.has(correcting);
  // Not a part id, ever: the inventory keeps its adapter count under one (eng review E2).
  const reserved = id.startsWith(RESERVED_ID_PREFIX);
  const blocked = idCollides || correctsOtherEnds || reserved;

  const submit = () => {
    if (!ready || blocked) return;
    const base = {
      id,
      brand,
      name: name.trim(),
      dimensions: userMeasured(
        correcting !== '' ? `corrects ${correcting}` : undefined,
      ),
      slop: { axialMm: 0.8, angularDeg: 1.5, calibrationStatus: 'estimated' as const },
      ends: { start: startEnd, end: endEnd },
      heightMm: 0,
      ...PROFILE_DEFAULTS,
    };
    const part: Part = kind === 'straight'
      ? { ...base, kind: 'straight', lengthMm: lengthMm! }
      : { ...base, kind: 'curve', innerRadiusMm: innerRadiusMm!, arcSteps };
    onSubmit({ part, submissionId: newSubmissionId(), at: new Date().toISOString() });
  };

  const arrival = useArrival<HTMLElement>();
  return (
    <section className="submit" aria-label="Submit a part" ref={arrival} tabIndex={-1}>
      <header className="inventory-head">
        <h2 className="inventory-title">Add a part you own</h2>
        <button className="inventory-close" onClick={onCancel}>Cancel</button>
      </header>

      <p className="submit-why">
        Nobody publishes piece sizes for small-peg or look-alike track, so the only reliable source
        is someone measuring their own. Yours will outrank anything we shipped.
      </p>

      <div className="submit-grid">
        <label className="submit-field">
          <span>Track system</span>
          <select value={brand} onChange={(e) => setBrand(e.target.value as Brand)}>
            {BRANDS.map((b) => <option key={b} value={b}>{SYSTEM_NAME[b]}</option>)}
          </select>
        </label>

        <label className="submit-field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. medium straight"
          />
        </label>

        <label className="submit-field">
          <span>Shape</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as 'straight' | 'curve')}>
            <option value="straight">Straight</option>
            <option value="curve">Curve</option>
          </select>
        </label>

        {kind === 'straight' ? (
          <label className="submit-field">
            <span>Length, mm</span>
            {/*
              * A text field with the decimal keypad, not `type="number"`: a
              * number field hands the page an EMPTY string for anything it
              * dislikes (a comma, in most browsers), so the page could neither
              * read `12,5` nor say what was wrong with it.
              */}
            <input
              className="num" type="text" inputMode="decimal" autoComplete="off"
              aria-invalid={lengthBad}
              value={lengthRaw} onChange={(e) => setLengthRaw(e.target.value)}
            />
            {/* Inside the label, so it is read with the field's name. */}
            {lengthBad && <span className="submit-field-bad">{SIZE_REFUSED}</span>}
          </label>
        ) : (
          <>
            <label className="submit-field">
              <span>
                Radius to the <strong>inner edge</strong>, mm
              </span>
              <input
                className="num" type="text" inputMode="decimal" autoComplete="off"
                aria-invalid={radiusBad}
                value={innerRadiusRaw} onChange={(e) => setInnerRadiusRaw(e.target.value)}
              />
              {radiusBad && <span className="submit-field-bad">{SIZE_REFUSED}</span>}
            </label>
            <label className="submit-field">
              <span>Turn</span>
              <select value={arcSteps} onChange={(e) => setArcSteps(Number(e.target.value))}>
                <option value={1}>22.5 degrees</option>
                <option value={2}>45 degrees (most curves)</option>
                <option value={4}>90 degrees</option>
              </select>
            </label>
          </>
        )}

        <label className="submit-field">
          <span>Start end</span>
          <select value={startEnd} onChange={(e) => setStartEnd(e.target.value as Polarity)}>
            <option value="socket">Socket (hole)</option>
            <option value="peg">Peg</option>
          </select>
        </label>
        <label className="submit-field">
          <span>Other end</span>
          <select value={endEnd} onChange={(e) => setEndEnd(e.target.value as Polarity)}>
            <option value="peg">Peg</option>
            <option value="socket">Socket (hole)</option>
          </select>
        </label>

        <label className="submit-field">
          <span>Correcting an existing part?</span>
          <input
            value={correcting}
            onChange={(e) => setCorrecting(e.target.value.trim())}
            placeholder="its id, or leave blank"
          />
        </label>
      </div>

      {kind === 'curve' && (
        <p className="submit-hint">
          Measure to the inside of the wood, not down the middle. The middle is what the
          app needs, but it has no edge to hold a ruler against, so it works it out from
          your figure and the plank width.
        </p>
      )}

      {correctsOtherEnds && (
        <p className="submit-err">
          <span className="num">{correcting}</span> does not have two ends: it is a switch, a
          crossing or a buffer stop. This form measures straights and curves, so it cannot
          correct one without changing the ends a layout may already be joined to.
        </p>
      )}

      {reserved && (
        <p className="submit-err">Ids starting with __ are reserved.</p>
      )}

      {idCollides && (
        <p className="submit-err">
          <span className="num">{id}</span> already exists. Put its id in the
          correcting field to replace its sizes, or change the name.
        </p>
      )}

      <div className="submit-actions">
        <button onClick={submit} disabled={!ready || blocked}>
          Add to the library
        </button>
        <span className="submit-id">
          {ready && !blocked ? <>will be saved as <span className="num">{id}</span></> : null}
        </span>
      </div>
    </section>
  );
}
