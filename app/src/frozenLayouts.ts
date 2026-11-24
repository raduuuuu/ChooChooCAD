/**
 * LAYOUTS BUILT BY HAND AND FROZEN AS LINKS (owner, 2026-11-22: "eight now,
 * rest after a reading"). The app's ready layouts (`presets.ts`) are chains:
 * a list of pieces, each joined to the last. A figure eight, a siding or a
 * bridge over a second loop is not a chain, so each of these is kept as the
 * link that opens it, which holds any layout.
 *
 *   an entry ──▶ decodeLink ──▶ graph ──▶ the same verdict the screen shows
 *                                              │
 *                              closes exactly, nothing loose? ── no: NO PAGE
 *                                              ▼ yes
 *                              a page under /layouts/ (pages/layoutPage.ts)
 *
 * A FROZEN LINK IS NEVER EDITED. To change a layout, open its link in the
 * planner, change it there, copy the new link here and raise `changed`. A
 * slug is an address the site has published (pages/published.ts): renaming a
 * layout keeps its slug.
 *
 * WHICH PIECES A LAYOUT MAY USE (owner, 2026-11-22): any built-in piece but
 * the short curve. A layout that holds a piece nobody has measured says so
 * on its page and marks each such piece.
 *
 * Each was laid out piece by piece and checked by the planner's own verdict
 * before it was frozen; `pages/pages.test.ts` holds every one to that
 * verdict on every run, so a size that changes cannot leave a page behind.
 */

export interface FrozenLayout {
  /** What the page calls it. */
  readonly name: string;
  /** The last part of its address. Published: never changed once shipped. */
  readonly slug: string;
  /** When the layout last changed, for the sitemap. */
  readonly changed: string;
  /** What it is, in one sentence, for the page. */
  readonly note: string;
  /** The link that opens it, from its `#`. */
  readonly fragment: string;
}

/** Part ids no page may rest on. */
export const NOT_FOR_PAGES: readonly string[] = ['E1'];

/** Fewest pieces first. */
export const FROZEN_LAYOUTS: readonly FrozenLayout[] = [
  {
    name: 'Double circle',
    slug: 'double-circle',
    changed: '2026-11-24',
    note: 'Eight double curves: two circles, one inside the other.',
    fragment:
      '#v1.pc45EQAxDARBLo4n0OMHgVGoxJ_GlZfCRepEU1tV496BN__QVBmOY029G1LgpJQ4U5o4S1o4W9o4RzKMo7QRHFJ636FyElKQzyonU5okS1okW9okh3gLuz8',
  },
  {
    name: 'Two stations',
    slug: 'two-stations',
    changed: '2026-11-24',
    note: 'An oval with a station on each long side; a mini straight beside each makes the sides equal.',
    fragment:
      '#v1.jc0rEgJBEIPhu4z-RWf2LaGKWoNDdvX9r0FNFjSofCZJZrbz1VCR7dY_ePzI57dx_6tRZAZCRJEju9URkzUhZmtGLNaCWK0VsVkbYrd2xGEdYzmuab9cN0EM-r3qDQ',
  },
  {
    name: 'Oval with a siding',
    slug: 'oval-with-a-siding',
    changed: '2026-11-24',
    note: 'An oval with a curved switch and a spur that ends in a buffer stop.',
    fragment:
      '#v1.hc07CgNBDATRu0xcgXr2Hxp2M2cOhe5_DbM9dmpH9UCgzsz2bPQi29XQrz7-3L89P33dLTIDIaLIu93qiMmaELM1IxZrQazWitisDbFbO-Kwgo5ivPbKmAmCY4xXvQE',
  },
  {
    name: 'Double oval',
    slug: 'double-oval',
    changed: '2026-11-24',
    note: 'Two tracks side by side all the way round: eight double curves and four long straights.',
    fragment:
      '#v1.lc87DsNACEXRvbi-BR97Pn1mFWj2vw0L7CpFpFQcIcGDiDjWOtDNT3y-6vp3ZhMhKIpsIquVDMVLjnK-cq7SidJKDaWXOsooDZRZmrlZXjr6pAiS3TxCsOw-zCSrKxwrGZmZuiox1XB6qeOM0sCZWH6z9w0',
  },
  {
    name: 'Passing loop',
    slug: 'passing-loop',
    changed: '2026-11-24',
    note: 'An oval whose one side splits in two between a pair of parallel switches.',
    fragment:
      '#v1.fY47DsMwDEPv4vkNop3vWKBNDyH4_tcoJCdLgHTiAyGRdPdyqKCOl_dNvyrUgM9pPOn18Lrp37-OuyGEddyo1KRwWt41jCm9CTEnzYglaUGsSStiS9oQe9IeyTYCs2XUKNJ1FtXgNrgFjzLDAmNBXDRqbO39Bw',
  },
  {
    name: 'Figure eight',
    slug: 'figure-eight',
    changed: '2026-11-24',
    note: 'Two loops through one crossing.',
    fragment:
      '#v1.rc-xDYUwDEXRXVLfwi9AgJLiS38HK_uvgWyzABKVrxTFR3b39ldDE2_XM38v5_XF_4m7sSBs4kL0rI5YsuJtzVoRW9aGGFkDsWftiCPL6JxZJ0JWqy36YcJRQQpJRSksFabQVJzCU4GGceQBuXDUDXPe',
  },
  {
    name: 'Three loops',
    slug: 'three-loops',
    changed: '2026-11-24',
    note: 'Three loops in a row through two crossings.',
    fragment:
      '#v1.rZA7DgMxCETvsvUUDP7tliki5Q7I979GBLN9EimVn8DmMY6I48UD3IjjcZ_PH8_Hh_ff9v-zyEaEoYGwjSAIL3IQrSh7vaiDGEUDxCyaIFbRAnEWGRxX0QWCptGWfGvSQ4mq3GojNhjYxT15iEfyFOdilJELDsrJM-uyMrUured8l9Yr3p0v57gSekZ0ZfQM6UppMJyyztxgoclaN-rv9n4D',
  },
  {
    name: 'Two bridges',
    slug: 'two-bridges',
    changed: '2026-11-24',
    note: 'An oval with a stone arch bridge on each side, and a second loop that runs under both.',
    fragment:
      '#v1.pdBNCgIxFAPgu3QdoYnT-VmOOCdwWXr_a0jem4UIIuIqobTva9t7L4-9gAO93HSW40v-fuJ-5v6WR4Fe89P6X-cHeq8giDrQnYomENdoVxBTtAlEi9ZAzNFmEEu0BcQabQWxRds8ueboUE7G05nj6flMgBaYBG0wEVphMrTDhGiJSdGW0pItpaV40_kou0pXdpWu7Cpd2VW6sqt0K6qv7x-kUL3M-D3KGxu8oeLSMuvANMZ4Ag',
  },
];
