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
  const nonNeg = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  if (!slop || !nonNeg(slop.axialMm) || !nonNeg(slop.angularDeg)) return false;
  const finite = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0;
  if (!finite(p.gaugeWidthMm) || !finite(p.plankWidthMm) || !finite(p.plankThicknessMm)) return false;
  if (p.kind === 'straight') return finite(p.lengthMm);
  return finite(p.innerRadiusMm) && typeof p.arcSteps === 'number' && Number.isInteger(p.arcSteps);
}

export function loadSubmissions(): readonly Submission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Submission[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const s = item as Record<string, unknown>;
      if (typeof s.submissionId !== 'string' || typeof s.at !== 'string') continue;
      if (!looksLikePart(s.part)) continue;
      out.push({ part: s.part, submissionId: s.submissionId, at: s.at });
    }
    return out;
  } catch {
    return [];
  }
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
