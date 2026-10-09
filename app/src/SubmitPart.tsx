/**
 * Submit a part the library does not have, or correct one it has wrong.
 *
 * This is the mechanism that makes the library work at all. No manufacturer
 * publishes piece dimensions for IKEA Lillabo or Lidl Playtive, and the
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
 * the exact mistake that shipped in this project's own BRIO data.
 *
 * It refuses non-finite and non-positive numbers at the INPUT rather than on
 * save, because a strict loader plus an unguarded input is how an earlier
 * version of this app silently destroyed a whole saved inventory.
 */

import { useState } from 'react';
import { newSubmissionId, userMeasured, type Submission } from '../../engine/data/library.js';
import type { Brand, Part, Polarity } from '../../engine/src/parts/schema.js';

const BRANDS: readonly Brand[] = ['BRIO', 'IKEA', 'PLAYTIVE', 'HAPE', 'THOMAS', 'MELISSA_DOUG'];
const BRAND_LABEL: Record<Brand, string> = {
  BRIO: 'BRIO',
  IKEA: 'IKEA Lillabo',
  PLAYTIVE: 'Lidl Playtive',
  HAPE: 'Hape',
  THOMAS: 'Thomas',
  MELISSA_DOUG: 'Melissa & Doug',
};

/** Published BRIO profile, used as the default for a brand nobody has measured. */
const PROFILE_DEFAULTS = { gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12 };

export interface SubmitPartProps {
  readonly existingIds: ReadonlySet<string>;
  readonly onSubmit: (s: Submission) => void;
  readonly onCancel: () => void;
}

/** A positive finite number, or null. Never NaN or Infinity into state. */
function parseMm(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function SubmitPart({ existingIds, onSubmit, onCancel }: SubmitPartProps) {
  const [brand, setBrand] = useState<Brand>('IKEA');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'straight' | 'curve'>('straight');
  const [lengthRaw, setLengthRaw] = useState('');
  const [innerRadiusRaw, setInnerRadiusRaw] = useState('');
  const [arcSteps, setArcSteps] = useState(2);
  const [startEnd, setStartEnd] = useState<Polarity>('socket');
  const [endEnd, setEndEnd] = useState<Polarity>('peg');
  const [correcting, setCorrecting] = useState('');

  const lengthMm = parseMm(lengthRaw);
  const innerRadiusMm = parseMm(innerRadiusRaw);

  const dimensionOk = kind === 'straight' ? lengthMm !== null : innerRadiusMm !== null;
  const nameOk = name.trim().length > 0;
  const ready = dimensionOk && nameOk;

  // Correcting an existing part reuses its id, which is what makes the override
  // rule fire. A new part gets a brand-prefixed id derived from its name.
  const id = correcting !== ''
    ? correcting
    : `${brand}-${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20) || 'PART'}`;
  const idCollides = correcting === '' && existingIds.has(id);

  const submit = () => {
    if (!ready || idCollides) return;
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

  return (
    <section className="submit" aria-label="Submit a part">
      <header className="inventory-head">
        <h2 className="inventory-title">Add a part you own</h2>
        <button className="inventory-close" onClick={onCancel}>Cancel</button>
      </header>

      <p className="submit-why">
        Nobody publishes piece sizes for IKEA or Lidl track, so the only reliable source
        is someone measuring their own. Yours will outrank anything we shipped.
      </p>

      <div className="submit-grid">
        <label className="submit-field">
          <span>Brand</span>
          <select value={brand} onChange={(e) => setBrand(e.target.value as Brand)}>
            {BRANDS.map((b) => <option key={b} value={b}>{BRAND_LABEL[b]}</option>)}
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
            <input
              className="num" type="number" min={1} step={1} inputMode="numeric"
              value={lengthRaw} onChange={(e) => setLengthRaw(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="submit-field">
              <span>
                Radius to the <strong>inner edge</strong>, mm
              </span>
              <input
                className="num" type="number" min={1} step={1} inputMode="numeric"
                value={innerRadiusRaw} onChange={(e) => setInnerRadiusRaw(e.target.value)}
              />
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

      {idCollides && (
        <p className="submit-err">
          <span className="num">{id}</span> already exists. Put its id in the
          correcting field to replace its sizes, or change the name.
        </p>
      )}

      <div className="submit-actions">
        <button onClick={submit} disabled={!ready || idCollides}>
          Add to the library
        </button>
        <span className="submit-id">
          {ready && !idCollides ? <>will be saved as <span className="num">{id}</span></> : null}
        </span>
      </div>
    </section>
  );
}
