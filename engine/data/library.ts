/**
 * The part library: everything a layout can be built from, across every brand.
 *
 * THE SHAPE, AND WHY IT IS NOT THE OLD ONE
 *
 * Until now there was one array of parts that served as the catalogue, the
 * palette, and the set of things inventory could count. That works for one brand
 * whose dimensions are published. It breaks the moment the answer to "what track
 * exists" is "more than anyone has written down", which is the real situation:
 * nobody publishes piece dimensions for IKEA Lillabo or Lidl Playtive, and the
 * reference says there is no dimensional standard because brands deviate
 * deliberately to avoid patents.
 *
 * So the library is now three tiers that resolve into one list:
 *
 *   BUILT-IN       BRIO, published figures from an established reference.
 *   SEEDS          third-party parts whose dimensions are UNVERIFIED. Present so
 *                  someone who owns the track has a row to correct rather than a
 *                  blank form. Any user submission overrides a seed.
 *   SUBMISSIONS    parts a user measured, or that reached the shared library from
 *                  someone else. Highest trust available for third-party track,
 *                  because the only reliable source is somebody with the piece
 *                  in their hand.
 *
 * A submission for an id that already exists WINS if its source is more trusted,
 * which is what makes a seed correctable. See `resolveLibrary`.
 *
 * LOCAL TODAY, SHARED LATER. Submissions persist in browser storage. The decision
 * to make the library shared between users is recorded and accepted; the server,
 * accounts, moderation and the children's-privacy posture it needs do not exist
 * yet. Everything here is shaped so that turning sharing on is a transport
 * change: every submission carries a stable id, a provenance record and a
 * timestamp, and nothing depends on the submitter being the only author.
 */

import type { DimensionSource, Part } from '../src/parts/schema.js';
import { DIMENSION_TRUST, trustRank, type DimensionStatus } from '../src/parts/schema.js';
import { BRIO_PARTS } from './brio.js';
import { THIRD_PARTY_SEEDS } from './thirdParty.js';

/** Built-in parts: published BRIO plus unverified third-party seeds. */
export const BUILT_IN: readonly Part[] = [...BRIO_PARTS, ...THIRD_PARTY_SEEDS];

/**
 * One submitted part. A `Part` plus the bookkeeping a shared library needs.
 *
 * `id` follows the same brand-prefixed scheme as the seeds, so a submission can
 * correct a seed by reusing its id. A brand-new piece gets a new id.
 */
export interface Submission {
  readonly part: Part;
  /** Stable across machines, so the server can dedupe without guessing. */
  readonly submissionId: string;
  /** ISO timestamp. */
  readonly at: string;
}

/**
 * Resolve the library: built-ins, then submissions, better source wins.
 *
 * The override rule is the whole reason the tiers exist. A seed says "IKEA
 * straights are about 150mm, nobody has measured one"; the moment a user
 * measures theirs, that figure replaces the seed for them, and later for
 * everyone. Equal trust keeps the newer submission, because a person
 * re-measuring their own piece is correcting themselves.
 *
 * Trust beats recency, never the other way round. A community submission cannot
 * overwrite a published BRIO figure by arriving later, because one stranger's
 * word is weaker than a reference. An earlier draft of this had those two
 * reversed and a test caught it.
 *
 * NOT IMPLEMENTED, and it matters: several independent submitters agreeing
 * SHOULD outrank a single published figure, because published figures are
 * occasionally wrong and this project has already hit one. `corroborations` is
 * recorded on every submission so that comparison can be added without
 * re-modelling anything, but nothing reads it yet. Until it does, a corroborated
 * community figure is treated exactly like an uncorroborated one.
 */
export function resolveLibrary(submissions: readonly Submission[]): readonly Part[] {
  const byId = new Map<string, { part: Part; rank: number; at: string }>();
  for (const part of BUILT_IN) {
    byId.set(part.id, { part, rank: trustRank(part.dimensions.status), at: '' });
  }
  for (const s of submissions) {
    const rank = trustRank(s.part.dimensions.status);
    const held = byId.get(s.part.id);
    if (!held || rank < held.rank || (rank === held.rank && s.at >= held.at)) {
      byId.set(s.part.id, { part: s.part, rank, at: s.at });
    }
  }
  return [...byId.values()].map((v) => v.part);
}

/**
 * A resolver for the engine, over a resolved library.
 *
 * The engine already takes `resolve` as a parameter everywhere, so the library
 * plugs in with no change to the solver, the walkers or the feasibility checks.
 * That was worth the earlier design and is why this file adds no engine churn.
 */
export function makeResolver(parts: readonly Part[]): (id: string) => Part {
  const byId = new Map(parts.map((p) => [p.id, p]));
  return (id: string) => {
    const p = byId.get(id);
    if (!p) throw new Error(`unknown part id: ${id}`);
    return p;
  };
}

/** The provenance record for something this user measured themselves. */
export function userMeasured(note?: string): DimensionSource {
  return {
    status: 'user-measured',
    source: 'measured by this user',
    note,
    submittedAt: new Date().toISOString(),
    corroborations: 1,
  };
}

/*
 * Persistence. Same discipline as the chain and the inventory: anything
 * unexpected is DISCARDED rather than repaired.
 *
 * One deliberate difference. A bad chain blob costs you a layout you can rebuild
 * in a minute. A bad submission blob costs you measurements you took with
 * calipers, which you cannot. So this validates PER SUBMISSION and keeps the
 * ones that parse, rather than discarding the whole set on one bad row.
 */
/** Exported so the error boundary's repro reads the same key the app wrote. */
export const SUBMISSIONS_STORAGE_KEY = 'brio.library.submissions.v1';
const STORAGE_KEY = SUBMISSIONS_STORAGE_KEY;

function looksLikePart(v: unknown): v is Part {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id.length === 0) return false;
  if (typeof p.brand !== 'string') return false;
  if (p.kind !== 'straight' && p.kind !== 'curve') return false;
  if (typeof p.dimensions !== 'object' || p.dimensions === null) return false;
  /*
   * THE PROVENANCE IS VALIDATED, not just the shape. Without this a stored
   * submission with `dimensions: {}` reached `trustRank`, which returned -1 and
   * outranked every published figure in the catalogue. The two halves are
   * independent on purpose: this rejects the row, and `trustRank` failing
   * closed means a second caller cannot reintroduce the inversion.
   */
  const dims = p.dimensions as Record<string, unknown>;
  if (!DIMENSION_TRUST.includes(dims.status as DimensionStatus)) return false;
  if (typeof dims.source !== 'string') return false;
  /*
   * `ends` and `slop` are dereferenced unconditionally by the engine
   * (`portPolarity` reads part.ends.start; the solver reads part.slop.axialMm),
   * so a row missing either is an app-wide crash on load rather than a dropped
   * row -- the opposite of what this file promises.
   */
  const ends = p.ends as Record<string, unknown> | undefined;
  if (!ends || (ends.start !== 'peg' && ends.start !== 'socket')) return false;
  if (ends.end !== 'peg' && ends.end !== 'socket') return false;
  const slop = p.slop as Record<string, unknown> | undefined;
  /*
   * SLOP IS BOUNDED, AND ITS CALIBRATION STATUS IS NOT SELF-ASSERTED
   * (finding B2, the most serious of the adversarial pass).
   *
   * `calibrationStatus` went unvalidated entirely, and `trust.ts`'s rule 4
   * reads `parts.some((p) => p.slop.calibrationStatus !== 'measured')` with a
   * comment saying it is always true today and "must stay true in EVERY
   * verdict state". MEASURED: a stored row claiming
   * `calibrationStatus: 'measured'` with `axialMm: 999` was accepted here, and
   * the `estimated-give` caveat -- the one that says the give total and any
   * verdict resting on it are provisional -- DISAPPEARED from the trust
   * register. 999mm of give also makes every layout "might fit", which
   * switches off the one definite claim the engine exists to make: that a gap
   * exceeding the give definitely will not fit. A confidently wrong verdict
   * with no visible qualification is worse than a crash.
   *
   * `SubmitPart.tsx:88` hardcodes `'estimated'`, so nothing the app writes can
   * ever carry `'measured'`. A stored row that does was not produced by this
   * app.
   *
   * COERCED, NOT REFUSED. The first version of this fix dropped the whole row,
   * which contradicted the priority stated at the top of this section: a
   * submission's dimensions are measurements somebody took with calipers, and
   * destroying them to reject a self-asserted calibration flag throws away the
   * data to punish the claim. `loadSubmissionsResult` now forces every stored
   * row to `'estimated'`, so rule 4's invariant holds BY CONSTRUCTION -- no
   * stored row can ever read `'measured'` -- and the user keeps the figures
   * they measured. The status is only validated for shape here.
   *
   * THE CEILING IS NEAR THE REAL FIGURE, not two orders of magnitude above it.
   *
   * The first version of this fix used 50mm and 45 degrees, reasoning that the
   * harm needed something absurd like 999mm. MEASURED: it does not. On eight
   * large curves plus one straight -- a ring with a 216mm gap and no clashes --
   * a stored row at exactly 50mm per joint gives 450mm of total give across 9
   * joints, and the verdict goes from EXCEEDS (`withinBound: false`, a definite
   * "this will not fit") to NEEDS_GIVE (`withinBound: true`, a "this might").
   * The ceiling as chosen permitted the exact harm the paragraph above
   * describes, which is the third invariant: a failed check must never be
   * styled as a pass.
   *
   * 5mm and 5 degrees are about 6x and 3x the published figures (0.8mm axial,
   * 1.5 degrees in `brio.ts`). A BRIO joint's real slop is sub-millimetre, so
   * this is already generous for somebody measuring their own worn track, and
   * 5mm across 9 joints is 45mm against that 216mm gap.
   *
   * It is a plausibility bound, NOT a guarantee. Give scales with joint count,
   * so a large enough layout of legitimate-looking rows can still soften a
   * definite claim; that is filed as the P2 on provenance rather than pretended
   * away with a constant. What keeps the verdict honest meanwhile is the
   * `calibrationStatus` refusal below: `estimated-give` always fires, so the
   * user is always told the give is a guess.
   */
  const SLOP_CEILING_MM = 5;
  const SLOP_CEILING_DEG = 5;
  const bounded = (x: unknown, ceiling: number) =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= ceiling;
  if (!slop) return false;
  if (!bounded(slop.axialMm, SLOP_CEILING_MM)) return false;
  if (!bounded(slop.angularDeg, SLOP_CEILING_DEG)) return false;
  if (typeof slop.calibrationStatus !== 'string') return false;
  const finite = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0;
  if (!finite(p.gaugeWidthMm) || !finite(p.plankWidthMm) || !finite(p.plankThicknessMm)) return false;
  if (p.kind === 'straight') return finite(p.lengthMm);
  if (!finite(p.innerRadiusMm)) return false;
  if (typeof p.arcSteps !== 'number' || !Number.isInteger(p.arcSteps)) return false;
  /*
   * A CURVE TURNS SOME OF THE WAY ROUND, so its arc is 1..15 of the 16
   * headings. This checked only that the value was an integer, which let a
   * submission declare a 360 degree "curve": MEASURED, `arcSteps` of 0, 16,
   * 32 or -16 all give displacement exactly ZERO and heading 0, so the piece
   * occupies no length and makes no turn, and a chain of them puts every
   * port of every piece on one lattice point. Bounded the same way `slop` is
   * a few lines up, because a value this engine could not have written
   * belongs refused rather than drawn.
   */
  return p.arcSteps >= 1 && p.arcSteps <= 15;
}

/**
 * What `loadSubmissionsResult` returns.
 *
 * `dropped` EXISTS SO THE LOSS CAN BE SHOWN. Before it, every drop here was a
 * bare `continue`: the row vanished, `App.tsx` had no notice for it, so
 * `savesSuppressed` saw no loss and the mount effect wrote the survivors
 * straight over the stored bytes. The scenario the save gate was written for
 * was the one scenario it could not see, because the loss never reached it.
 *
 * It matters most for exactly this loader. A dropped layout is a minute of
 * clicking; the comment at the top of this section says a dropped submission
 * "costs you measurements you took with calipers, which you cannot" recreate.
 */
export interface SubmissionsLoadResult {
  readonly value: readonly Submission[];
  /** How many stored rows were refused. Zero on a clean load. */
  readonly dropped: number;
  /** Set when the whole blob was unreadable, as opposed to some rows. */
  readonly discarded?: string;
}

export function loadSubmissionsResult(): SubmissionsLoadResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { value: [], dropped: 0 };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        value: [],
        dropped: 0,
        discarded:
          'Your submitted part measurements could not be read, so none of them ' +
          'were loaded. The original is kept until you dismiss this.',
      };
    }
    const out: Submission[] = [];
    let dropped = 0;
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) {
        dropped++;
        continue;
      }
      const s = item as Record<string, unknown>;
      if (typeof s.submissionId !== 'string' || typeof s.at !== 'string') {
        dropped++;
        continue;
      }
      if (!looksLikePart(s.part)) {
        dropped++;
        continue;
      }
      /*
       * THE ONE FIELD A STORED ROW DOES NOT GET TO ASSERT.
       *
       * `trust.ts` rule 4 emits the `estimated-give` caveat only while some
       * part reads other than `'measured'`, and its comment says that must
       * stay true in every verdict state. Forcing it here makes that true by
       * construction: no row that came out of storage can claim its give was
       * measured, whatever the bytes said, and the row's dimensions survive.
       */
      out.push({
        part: { ...s.part, slop: { ...s.part.slop, calibrationStatus: 'estimated' } },
        submissionId: s.submissionId,
        at: s.at,
      });
    }
    return { value: out, dropped };
  } catch {
    return {
      value: [],
      dropped: 0,
      discarded:
        'Your submitted part measurements could not be read, so none of them ' +
        'were loaded. The original is kept until you dismiss this.',
    };
  }
}

/** The sentence shown when some rows were refused and the rest were kept. */
export function droppedSubmissionsNotice(kept: number, dropped: number): string {
  const rows = dropped === 1 ? '1 saved measurement' : `${dropped} saved measurements`;
  const was = dropped === 1 ? 'was' : 'were';
  const rest =
    kept === 0
      ? 'Nothing was loaded.'
      : `The other ${kept === 1 ? 'one' : kept} loaded normally.`;
  return (
    `${rows} ${was} in a format this version does not accept, so ${dropped === 1 ? 'it' : 'they'} ` +
    `${dropped === 1 ? 'was' : 'were'} not loaded. ${rest} ` +
    'Nothing is saved over them until you dismiss this.'
  );
}

/** Kept for callers that do not care why rows are missing. */
export function loadSubmissions(): readonly Submission[] {
  return loadSubmissionsResult().value;
}

export function saveSubmissions(subs: readonly Submission[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
  } catch {
    // Private browsing and full quotas both throw. Losing persistence is not
    // worth losing the session over, but unlike the chain this IS data the user
    // cannot trivially recreate, so the caller should surface a failure.
  }
}

/** Stable enough to dedupe on a server without coordinating ids. */
export function newSubmissionId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `sub-${Date.now().toString(36)}-${rand}`;
}
