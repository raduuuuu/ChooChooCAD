/**
 * WHERE A PRINTED PART COMES FROM (docs/plan/2026-11-03-printable-mark.md).
 *
 * The standing rule (no source names, links or creators) is lifted for part
 * origin by the owner (2026-11-03): a part whose shape comes from one
 * printable model names the site, links to the model page and credits its
 * creator. Never the model's TITLE: several carry the brand name the app
 * shows as "Generic".
 *
 * Only parts traced to ONE model are here (decision 7A): a part sized from
 * several reproductions has no single page to send anyone to. The T switch
 * keeps the model it was first drawn from even though its figures now come
 * from the owner's photos (8A): the link is about where to print one.
 */

import type { Part } from '../src/parts/schema.js';

export interface PartOrigin {
  readonly site: 'MakerWorld';
  /** The site's model number; the page's address is built from it. */
  readonly modelId: string;
  /** The model's creator, as the site credits them. */
  readonly creator: string;
}

const MW = (modelId: string, creator: string): PartOrigin => ({ site: 'MakerWorld', modelId, creator });

const REPLICAS = MW('1001504', 'Cactus 973');
const AU3D_T = MW('904802', 'AU3D');
const LILLABO = MW('2181560', 'Vamuss');

export const PART_ORIGINS: Readonly<Record<string, PartOrigin>> = {
  L: REPLICAS, M: REPLICAS, O1: REPLICAS, P1: REPLICAS,
  H: REPLICAS, H1: REPLICAS, H2: REPLICAS,
  I: REPLICAS, J: REPLICAS, O: REPLICAS, P: REPLICAS,
  T: AU3D_T,
  TJ: MW('3225419', 'Flame'),
  X: MW('795599', 'Fantastic Plastic Person'),
  EE: MW('887239', 'AU3D'),
  F: MW('3121622', 'Isaxon'), G: MW('3121622', 'Isaxon'),
  F1: MW('892305', 'AU3D'), G1: MW('892305', 'AU3D'),
  'IKEA-50': LILLABO, 'IKEA-100': LILLABO, 'IKEA-145': LILLABO, 'IKEA-205': LILLABO,
  'IKEA-240': LILLABO, 'IKEA-C22': LILLABO, 'IKEA-C45': LILLABO, 'IKEA-C90': LILLABO,
  'IKEA-SW': LILLABO, 'IKEA-SW-P': LILLABO, 'IKEA-X145': LILLABO,
  N: MW('1238767', 'Cactus 973'),
  HH: MW('889540', 'AU3D'),
  HP: MW('681643', 'Martin'),
  LC: MW('681643', 'Martin'),
  SS: MW('1995429', 'CreatorPaul'),
  RS: MW('597436', 'historicc'),
  TS: MW('1238767', 'Cactus 973'),
  TO: MW('1033476', 'hubi'),
  SA: MW('1248551', 'Sarlix'),
  SB: MW('639571', 'Ren_Studio'),
  HB: MW('1124746', 'hubi'),
};

/** The model page's address. */
export const originUrl = (o: PartOrigin): string => `https://makerworld.com/en/models/${o.modelId}`;

/** The link's words, said and shown on hover (decision 6A). */
export const originLabel = (o: PartOrigin): string => `Model by ${o.creator} on ${o.site} (opens in a new tab)`;

export const originOf = (part: Part): PartOrigin | undefined => PART_ORIGINS[part.id];
