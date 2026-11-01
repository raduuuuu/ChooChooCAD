/**
 * LINKS ALREADY SENT KEEP OPENING (share plan, eng D12).
 *
 * Value: protects=four v1 links made on 2026-11-01 decode, forever, to the
 * layouts they carried: the Stadium, a two-level loop with a raised position,
 * a switch, and a socket-to-socket joint
 * Value: fails_when=anything about v1 changes: the packing, the turn codes,
 * the anchor form, base64url, deflate-raw, a check that starts refusing what
 * v1 wrote, or a part id the links name
 * Value: why_new=shareLink.test.ts encodes and decodes with the same, current
 * code, so a change to both halves stays green there and breaks every link in
 * every chat
 * Value: seam=none; the strings are what `encodeLink` produced on 2026-11-01
 * Value: no_claim=that these layouts are buildable; they are format fixtures
 *
 * A NEW FORMAT IS v2, NOT A NEW v1. If one of these ever has to change, the
 * fix is a decoder for the new version beside this one, not new strings here.
 */

import { describe, expect, it } from 'vitest';
import { storedGraphOf } from './layoutStore.js';
import { decodeLink } from './shareLink.js';

const p = (i: number, partId: string, turn = 'left') => ({ pieceId: `p${i}`, partId, turn });
const w = (a: number, ap: number, b: number, bp: number) => ({ a: { pieceId: `p${a}`, port: ap }, b: { pieceId: `p${b}`, port: bp } });

const FROZEN: { name: string; link: string; stored: unknown }[] = [
  {
    name: 'the Stadium',
    link: '#v1.hcy5DcAwDEPRXVy78H30yRSC9l8j3-xSBIEKPoCEzCzcIWaP33n99K8dsBQzl-DJIhVUpYqa1FCXOhrSQFOaaEkLbWmfvwi6Pw',
    stored: {
      pieces: ['E', 'E', 'E', 'E', 'D', 'E', 'E', 'E', 'E', 'D'].map((id, i) => p(i, id)),
      welds: [...Array(10).keys()].map((i) => w(i, 1, (i + 1) % 10, 0)),
      anchors: [],
    },
  },
  {
    name: 'a two-level loop with a raised position',
    link: '#v1.hc7BDYAwCAXQXXquCVCqdQCvLkDYf43-Yj30YAwkvAAhmFm6UmbP3_X-mS97gFFmBIGjSkigEiqQhhSqoQrtoQNqoQad0HMRuYTPbduU22wKyTtkGb94Bw',
    stored: {
      pieces: ['E', 'E', 'E', 'E', 'N', 'E', 'E', 'E', 'E', 'N'].map((id, i) => p(i, id)),
      welds: [w(0, 1, 1, 0), w(1, 1, 2, 0), w(2, 1, 3, 0), w(3, 1, 4, 0), w(4, 1, 5, 0), w(5, 1, 6, 0), w(7, 1, 8, 0), w(8, 1, 9, 0)],
      anchors: [
        ['p0', { pos: [0, 0, 0, 0, 0, 0, 0, 0], heading: 0 }],
        ['p7', { pos: [-418, 0, 0, 0, 202, 0, 0, 0], heading: 12, level: 1 }],
      ],
    },
  },
  {
    name: 'a switch with both roads used',
    link: '#v1.i46OVvJR0jGM1YlWcoTSrko6RrFARrSBjiEQGgCZBjpGQGgAEo2NBQA',
    stored: {
      pieces: [p(0, 'L'), p(1, 'A'), p(2, 'E', 'right')],
      welds: [w(0, 1, 1, 0), w(0, 2, 2, 0)],
      anchors: [],
    },
  },
  {
    name: 'two sockets meeting (an adapter joint)',
    link: '#v1.i46OVnJW0jGM1YHSQEa0gY4hEBqA2LGxAA',
    stored: { pieces: [p(0, 'C'), p(1, 'C')], welds: [w(0, 1, 1, 0)], anchors: [] },
  },
];

describe('v1 links made on 2026-11-01', () => {
  /*
   * MUTATION PROOF, run: the turn codes swapped in `shareLink.ts` (1 right, 2
   * left): `expected { pieces: [ { …(3) }, …(9) ], …(2) } to deeply equal {
   * pieces: [ { …(3) }, …(9) ], …(2) }` on the Stadium, while every round
   * trip in shareLink.test.ts stays green.
   */
  for (const f of FROZEN) {
    it(`${f.name} still opens to the same layout`, async () => {
      const back = await decodeLink(f.link);
      if (!back.ok) throw new Error(back.reason);
      expect(storedGraphOf(back.graph)).toEqual(f.stored);
    });
  }
});
