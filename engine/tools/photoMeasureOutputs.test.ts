/**
 * WHAT A MEASURING RUN GIVES BACK: --json, --overlay AND THE MEASURING
 * SCOREBOARD (measuring-tools plan 2026-11-09, items 10-12; CEO E1-E3; DX
 * D10, D12, D13; eng G8b, G13).
 *
 * Value: protects=--json is one object an agent can parse, for a read run, a
 * refused run and bad usage; the overlay puts each ring where its end was
 * read, draws for a refused run too, is written whole to an accepted path and
 * named only when written; the scoreboard passes a known figure and fails a
 * point 5px off
 * Value: fails_when=the JSON drops a field or mixes text in, the overlay's
 * scale or colours slip, a temp file is left, or the scoreboard's tolerance
 * or tally is wrong
 * Value: why_new=the text output was the only output, there was no picture
 * of the points, and no repeatable check of measuring
 * Value: seam=the synthetic photo (photoSynthetic.ts) and an injected loader
 * and reader; real temp folders for the overlay
 * Value: no_claim=the owner's photos (bun run photos:measure-score, 4/4 on
 * 2026-11-09, in the PR description)
 */

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GridPoint, Pt } from './photo.js';
import { paperToPixel } from './photoGrid.js';
import { PhotoError, type RgbImage } from './photoImage.js';
import { main, measure, overlayPath, parsePoints, resolvePoints, type Io, type Points } from './photoMeasure.js';
import { scoreMeasure, type Entry } from './photoMeasureScoreboard.js';
import { COLOURS, drawOverlay, OVERLAY_SIDE } from './photoOverlay.js';
import { drawPhoto, mapFor } from './photoSynthetic.js';

const map = mapFor(0);
const px = (u: number, v: number): Pt => paperToPixel(map, [u, v]);
const plain = drawPhoto(0);
const MED: readonly [Pt, Pt] = [px(60, 60), px(60, 204)], LONG_ENDS: readonly [Pt, Pt] = [px(120, 30), px(120, 246)];
const seeds = (scale: number): GridPoint[] => [[30, 30], [150, 30], [30, 230], [150, 230], [90, 130]].map(([u, v]) => ({ px: px(u!, v!), mm: [u! * scale, v! * scale] as Pt }));

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'measure-out-'));
  dirs.push(d);
  return d;
};
const io = (files: Record<string, unknown>, load: (p: string) => RgbImage = () => plain) => {
  const out: string[] = [], err: string[] = [];
  const io: Io = {
    load,
    camera: () => undefined,
    read: (f) => {
      if (!(f in files)) throw Object.assign(new Error('no such file'), { code: 'ENOENT' });
      return JSON.stringify(files[f]);
    },
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  };
  return { io, out, err };
};

describe('--json', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): the grid's crossings left in the JSON
   * (`grid: r.grid`): `expected { source: 'found', points: 229, …(2) } to not
   * have property "crossings"`.
   */
  it('prints one object: photo, grid, reference, each figure read or refused, nothing else on stdout', () => {
    const t = io({ 'p.json': { figures: { long: LONG_ENDS, near: [px(120, 30), px(120, 100)] } } });
    expect(main(['p.json', '--photo', 'p.png', '--json'], t.io)).toBe(3);
    expect(t.out).toHaveLength(1);
    const j = JSON.parse(t.out[0]!);
    expect(j).toMatchObject({ schema: 1, photo: { width: 1200, height: 1600 }, grid: { source: 'found' }, reference: { source: 'found' } });
    expect(j.grid).not.toHaveProperty('crossings');
    expect(j.figures.long).toMatchObject({ kind: 'distance', facing: 'checked', status: 'checked', why: [] });
    expect(Math.abs(j.figures.long.valueMm - 216)).toBeLessThan(0.3);
    expect(j.figures.long.ends[0]).toMatchObject({ seed: [...LONG_ENDS[0]], refined: true });
    expect(j.figures.near.refused).toMatchObject({ code: 'faces-camera', recovery: 'retake' });
  }, 60_000);

  /*
   * MUTATION PROOF, run (2026-11-09): --json missed when it comes first
   * (`argv.indexOf('--json') > 1`): `SyntaxError: "undefined" is not valid
   * JSON` (the usage went to stderr as text, nothing on stdout).
   */
  it('a refused run and bad usage are JSON too', () => {
    const t = io({ 'p.json': { grid: seeds(2), reference: MED, figures: { long: LONG_ENDS } } });
    expect(main(['p.json', '--photo', 'p.png', '--json'], t.io)).toBe(1);
    expect(JSON.parse(t.out[0]!)).toMatchObject({ schema: 1, refused: { code: 'k-implausible', recovery: 'edit-points' }, photo: { width: 1200 } });
    const u = io({});
    expect(main(['--json', 'p.json', '--bogus'], u.io)).toBe(2);
    expect(JSON.parse(u.out[0]!)).toEqual({ schema: 1, usage: { code: 'usage', message: 'unknown flag --bogus', fix: 'run with --help for the usage' } });
  }, 60_000);
});

describe('the overlay', () => {
  const ringAt = (img: RgbImage, p: Pt, s: number): number[] => {
    const [cx, cy] = [Math.round(p[0] * s), Math.round(p[1] * s)];
    const i = ((cy - 9) * img.width + cx) * 3; // on the ring, 9px above its centre
    return [...img.rgb.subarray(i, i + 3)];
  };

  /*
   * MUTATION PROOF, run (2026-11-09): the scale not applied to the ring's
   * centre: `expected [ 200, 200, 200 ] to deeply equal [ 230, 25, 75 ]`.
   */
  it('puts each figure end\'s ring where it was read, in the key\'s colour, on the photo shrunk to 1600px', () => {
    const big: RgbImage = { width: 4000, height: 3000, rgb: new Uint8Array(4000 * 3000 * 3).fill(200) };
    const end = (at: Pt) => ({ seed: at, at, refined: true as const, samples: 26, spreadMm: 0.1 });
    const points: Points = { figures: { long: { kind: 'distance', ends: [[1000, 500], [3000, 2500]] } } };
    const result = {
      kind: 'measured' as const, photo: { width: 4000, height: 3000 },
      grid: { source: 'found' as const, points: 1, rmsMm: 0.1, crossings: [[2000, 1500]] as Pt[] },
      reference: { source: 'found' as const, k: 1, ends: [end([500, 500]), end([500, 2500])] as const },
      scale: { kind: 'medium' as const, k: 1, why: 'none' },
      figures: { long: { kind: 'distance' as const, facing: 'checked' as const, valueMm: 1, status: 'checked' as const, why: [], ends: [end([1000, 500]), end([3000, 2500])] } },
    };
    const { image, key } = drawOverlay(big, points, result);
    expect([image.width, image.height]).toEqual([OVERLAY_SIDE, 1200]);
    const s = OVERLAY_SIDE / 4000;
    expect(key).toEqual([{ colour: '#e6194b', figure: 'long', end: 'first end' }, { colour: '#3cb44b', figure: 'long', end: 'second end' }]);
    expect(ringAt(image, [1000, 500], s)).toEqual([...COLOURS[0]!]);
    expect(ringAt(image, [3000, 2500], s)).toEqual([...COLOURS[1]!]);
    const dot = ((1500 * s) * image.width + 2000 * s) * 3;
    expect([...image.rgb.subarray(dot, dot + 3)]).toEqual([255, 0, 0]);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): a refused run's reference ends not
   * drawn: `expected [ 205, 165, 115 ] to deeply equal [ +0, +0, +0 ]`.
   */
  it('draws a refused run with what it found: the grid and the reference', () => {
    const points: Points = { grid: seeds(2), reference: MED, figures: { long: { kind: 'distance', ends: LONG_ENDS } } };
    const r = measure(points, plain);
    expect(r).toMatchObject({ kind: 'refused', refused: { code: 'k-implausible' } });
    const { image } = drawOverlay(plain, points, r);
    if (r.kind !== 'refused' || !r.referenceEnds) throw new Error('no reference ends');
    const [x, y] = r.referenceEnds[0].at.map((v) => Math.round(v)) as [number, number];
    expect([...image.rgb.subarray(((y + 6) * image.width + x) * 3, ((y + 6) * image.width + x) * 3 + 3)]).toEqual([0, 0, 0]);
    expect(r.grid?.crossings.length).toBeGreaterThan(50);
  }, 60_000);

  /*
   * MUTATION PROOF, run (2026-11-09): the rename dropped (the temp file left
   * where it was written): `ENOENT: no such file or directory, open
   * '…/p.overlay.png'`.
   */
  it('--overlay takes a folder or a path ending .overlay.png, writes a PNG whole, and names it in the output', () => {
    const d = tempDir();
    const t = io({ [join(d, 'p.json')]: { figures: { long: LONG_ENDS } } });
    expect(main([join(d, 'p.json'), '--photo', 'p.png', '--overlay', d, '--json'], t.io)).toBe(0);
    const j = JSON.parse(t.out[0]!);
    expect(j.overlay.path).toBe(join(d, 'p.overlay.png'));
    expect(j.overlay.key).toHaveLength(2);
    expect([...readFileSync(join(d, 'p.overlay.png')).subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(readdirSync(d)).toEqual(['p.overlay.png']);
    expect(overlayPath(join(d, 'x.overlay.png'), 'p.json')).toBe(join(d, 'x.overlay.png'));
  }, 60_000);

  /*
   * MUTATION PROOF, run (2026-11-09): any path accepted (`return arg`):
   * `expected 'debug.png' to match object { code: 'overlay-path' }`.
   */
  it('refuses any other path, its fix naming one that would be accepted; a run that fails before drawing leaves no file', () => {
    expect(overlayPath('debug.png', 'photos/p.json')).toMatchObject({ code: 'overlay-path', fix: expect.stringContaining('photos/p.overlay.png') });
    const d = tempDir();
    const t = io({ [join(d, 'p.json')]: { figures: { long: LONG_ENDS } } }, () => {
      throw new PhotoError('photo-unreadable', 'p.png could not be read');
    });
    expect(main([join(d, 'p.json'), '--photo', 'p.png', '--overlay', d], t.io)).toBe(1);
    expect(readdirSync(d)).toEqual([]);
  });
});

describe('the measuring scoreboard', () => {
  const entry = (points: Entry['points'], expect: Entry['expect']): Entry => ({ photo: 'syn.jpg', what: 'synthetic', basis: 'drawn', points, expect });

  /*
   * MUTATION PROOF, run (2026-11-09): the tolerance ignored (every figure
   * passes): `expected +0 to be 1` for the point moved 5px.
   */
  it('passes a known figure, fails an unrefined point 5px off its line (about 1mm here), and counts missing photos', () => {
    const d = tempDir();
    writeFileSync(join(d, 'syn.jpg'), '');
    const lines: string[] = [];
    const ok = entry({ figures: { long: [LONG_ENDS[0], LONG_ENDS[1]] } }, { long: { mm: 216, tolMm: 0.5 } });
    expect(scoreMeasure(d, [ok, { ...ok, photo: 'gone.jpg' }], () => plain, (l) => lines.push(l))).toBe(0);
    expect(lines.at(-1)).toBe('1/1 pass (1 photos not in ' + d + ')');
    // An offset point given without toward is never refined, so a 5px slip square to the line stays in the figure.
    const p = px(120, 30);
    const off = entry({ figures: { out: { point: [p[0] + 5, p[1]], line: [MED[0], MED[1]], read: 'offset' } } }, { out: { mm: 60, tolMm: 0.5 } });
    const more: string[] = [];
    expect(scoreMeasure(d, [off], () => plain, (l) => more.push(l))).toBe(1);
    expect(more[0]).toMatch(/^FAIL syn\.jpg .*out 61\.\d\d \(\+1\.\d\d, within 0\.5\)/);
  }, 120_000);

  it('none ran is a failure', () => {
    const d = tempDir();
    mkdirSync(join(d, 'empty'));
    expect(scoreMeasure(join(d, 'empty'), [entry({ figures: { a: [[1, 1], [9, 9]] } }, {})], () => plain, () => {})).toBe(1);
  });
});

describe('the drawing skill\'s examples', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): a comma dropped from the skill's T
   * switch example: `expected { code: 'points-not-json', …(3) } to not have
   * property "code"`.
   */
  it('parse, and resolve against the photo they name', () => {
    const skill = readFileSync('.claude/skills/draw-piece/SKILL.md', 'utf8');
    const step7 = skill.slice(skill.indexOf('## 7. Measure'), skill.indexOf('## 8. Draw it'));
    const blocks = [...step7.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(blocks).toHaveLength(2);
    for (const b of blocks) {
      const parsed = parsePoints(b);
      expect(parsed).not.toHaveProperty('code');
      expect(resolvePoints(parsed as Exclude<typeof parsed, { code: string }>, '/p', '/p/84405.jpg')).not.toHaveProperty('code');
    }
  });
});
