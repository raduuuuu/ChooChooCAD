/**
 * MEASURING A PHOTO: THE GRID AND REFERENCE FOUND, FIGURES BEYOND TWO POINTS,
 * ONE FIGURE REFUSED NOT THE RUN (measuring-tools plan 2026-11-09, items 2-6;
 * DX D1-D3, D6-D11; eng E1, E3, G2, G5b, G6, G6b, G11).
 *
 * Value: protects=figures read on a photo with no hand-read grid or
 * reference; offset and along exact; the scale chosen by the case table; an
 * end facing the camera refuses its figure alone (exit 3) and a reference end
 * the run (exit 1); a point without toward is provisional; a points file is
 * checked whole and names the bad field; a crop point maps back only from a
 * crop of this photo; every refusal has a code, its values and a fix
 * Value: fails_when=a case of the scale table, the facing rule, the status
 * rule, the crop-name check or an exit code is wrong
 * Value: why_new=photoMeasure needed hand-labelled grid seeds, read only
 * point to point, and ended the run on the first end facing the camera
 * Value: seam=the synthetic photo (photoSynthetic.ts) and an injected loader
 * and reader for main(); no real photo
 * Value: no_claim=accuracy on real photos (the measuring scoreboard and the
 * acceptance on 84405, PR c)
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { offsetAlong, type GridPoint, type Pt } from './photo.js';
import { CODES } from './photoCodes.js';
import { fromCrop } from './photoCrop.js';
import { facesAway } from './photoEdges.js';
import { paperToPixel, pixelToPaper } from './photoGrid.js';
import { PhotoError, type RgbImage } from './photoImage.js';
import { HELP, main, measure, parsePoints, resolvePoints, type Io, type MeasureResult } from './photoMeasure.js';
import { drawPhoto, H, mapFor, MEDIUM, W } from './photoSynthetic.js';

const map = mapFor(0);
const px = (u: number, v: number): Pt => paperToPixel(map, [u, v]);
const plain = drawPhoto(0);
/** The medium straight's end centres, and the long straight's. */
const MED: readonly [Pt, Pt] = [px(60, 60), px(60, 204)], LONG_ENDS: readonly [Pt, Pt] = [px(120, 30), px(120, 246)];
const seeds = (scale = 1): GridPoint[] => [[30, 30], [150, 30], [30, 230], [150, 230], [90, 130]].map(([u, v]) => ({ px: px(u!, v!), mm: [u! * scale, v! * scale] as Pt }));
const measured = (r: MeasureResult) => {
  if (r.kind !== 'measured') throw new Error(`refused: ${r.refused.code}: ${r.refused.reason}`);
  return r;
};
const value = (r: MeasureResult, name: string) => {
  const f = measured(r).figures[name]!;
  if ('refused' in f) throw new Error(`${name} refused: ${f.refused.reason}`);
  return f;
};

describe('offset and along', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): along taken as its absolute value:
   * `expected 5 to be close to -5`.
   */
  it('are exact on a slanted line, along negative before a, offset never negative', () => {
    // Line from (0, 0) towards (3, 4): unit (0.6, 0.8).
    expect(offsetAlong([5, 0], [0, 0], [3, 4])).toEqual({ offset: 4, along: 3 });
    const before = offsetAlong([-3, -4], [0, 0], [3, 4]);
    expect(before.along).toBeCloseTo(-5, 12);
    expect(before.offset).toBeCloseTo(0, 12);
    expect(offsetAlong([-4, 3], [0, 0], [3, 4]).offset).toBe(5);
  });
});

describe('an end facing the camera', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): facesAway on one axis only (the y
   * terms dropped): `expected true to be false` on the diagonal end.
   */
  it('is found on both axes: a curved end half turned to the lens faces it', () => {
    const photo = { width: 1000, height: 1000 };
    expect(facesAway(photo, [510, 100], [310, 50])).toBe(false);
    expect(facesAway(photo, [500, 100], [500, 300])).toBe(true);
    // Square to the centre (a dot product of exactly 0) does not count as facing away.
    expect(facesAway(photo, [500, 100], [400, 100])).toBe(false);
  });
});

describe('the grid and the reference, by the scale table', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): the found reference's refined ends
   * dropped (kept as hand readings): `expected 'provisional' to be 'checked'`:
   * every figure says its scale rests on a hand reading.
   */
  it('grid found, reference found: the long straight reads 216mm, offset 60, along -30, all checked', () => {
    const r = measure({ figures: {
      long: { kind: 'distance', ends: LONG_ENDS },
      out: { kind: 'offset', point: LONG_ENDS[0], toward: px(120, 50), line: MED },
      along: { kind: 'along', point: LONG_ENDS[0], toward: px(120, 50), line: MED },
    } }, plain);
    expect(measured(r).grid.source).toBe('found');
    expect(measured(r).reference.source).toBe('found');
    expect(Math.abs(value(r, 'long').valueMm - 216)).toBeLessThan(0.3);
    expect(Math.abs(value(r, 'out').valueMm - 60)).toBeLessThan(0.3);
    expect(Math.abs(value(r, 'along').valueMm + 30)).toBeLessThan(0.3);
    for (const n of ['long', 'out', 'along']) expect(value(r, n).status).toBe('checked');
    // Each end carries the point given and the point used, for the overlay (eng G4b).
    expect(value(r, 'long').ends[0]).toMatchObject({ seed: LONG_ENDS[0], refined: true });
  }, 60_000);

  it('grid found, reference given: scale 1 on plain paper', () => {
    const r = measured(measure({ reference: MED, figures: { long: { kind: 'distance', ends: LONG_ENDS } } }, plain));
    expect([r.grid.source, r.grid.scale, r.reference.source]).toEqual(['found', 1, 'given']);
    expect(Math.abs(value(r, 'long').valueMm - 216)).toBeLessThan(0.3);
  }, 60_000);

  /*
   * MUTATION PROOF, run (2026-11-09): the first scale with a grid kept
   * whatever its k: `refused: k-implausible: the reference reads 288.0mm on
   * the paper (k 0.500 …)`: on paper whose 5mm lines print as dark as 10mm,
   * scale 1 reads every length double.
   */
  it('grid found, reference given, on paper with 5mm lines as dark as 10mm: the scale whose k is plausible', () => {
    const r = measured(measure({ reference: MED, figures: { long: { kind: 'distance', ends: LONG_ENDS } } }, drawPhoto(0, 'flat')));
    expect(Math.abs(value(r, 'long').valueMm - 216)).toBeLessThan(0.3);
  }, 90_000);

  it('grid seeded, reference given or found', () => {
    for (const reference of [MED, undefined]) {
      const r = measured(measure({ grid: seeds(), ...(reference ? { reference } : {}), figures: { long: { kind: 'distance', ends: LONG_ENDS } } }, plain));
      expect([r.grid.source, r.reference.source]).toEqual(['seeded', reference ? 'given' : 'found']);
      expect(Math.abs(value(r, 'long').valueMm - 216)).toBeLessThan(0.3);
    }
  }, 60_000);

  /*
   * MUTATION PROOF, run (2026-11-09): the k check skipped on the seeded
   * path: `expected 'measured' to be 'refused'`.
   */
  it('grid seeded with millimetres twice too big: k-implausible, naming k', () => {
    const r = measure({ grid: seeds(2), reference: MED, figures: { long: { kind: 'distance', ends: LONG_ENDS } } }, plain);
    expect(r.kind).toBe('refused');
    if (r.kind === 'refused') {
      expect(r.refused.code).toBe('k-implausible');
      expect(r.refused.reason).toMatch(/k 0\.\d+/);
    }
  }, 60_000);

  /*
   * MUTATION PROOF, run (2026-11-09): the rms check removed: `expected
   * 'measured' to be 'refused'` for the seeded grid (eng E1: it had no limit
   * before this change).
   */
  it('a sheet that is not flat: grid-rms, seeded or found, naming the rms and the limit', () => {
    const wavy = drawPhoto(0, 'wavy');
    for (const grid of [seeds(), undefined]) {
      const r = measure({ ...(grid ? { grid } : {}), reference: MED, figures: { long: { kind: 'distance', ends: LONG_ENDS } } }, wavy);
      expect(r.kind).toBe('refused');
      if (r.kind === 'refused' && grid) {
        expect(r.refused.code).toBe('grid-rms');
        expect(r.refused.reason).toMatch(/disagree by 0\.\d\dmm rms \(limit 0\.3mm\)/);
      }
    }
  }, 120_000);

  /*
   * MUTATION PROOF, run (2026-11-09): a warm paper's failure not renamed:
   * `expected { kind: 'refused', …(3) } to match object …`, code `reference-unread`
   * instead of `paper-warm`.
   */
  it('no grid at any scale: grid-not-found; warm paper: paper-warm, naming its warmth', () => {
    const blank: RgbImage = { width: 400, height: 300, rgb: new Uint8Array(400 * 300 * 3).fill(200) };
    expect(measure({ figures: { x: { kind: 'distance', ends: [[10, 10], [200, 200]] } } }, blank)).toMatchObject({ kind: 'refused', refused: { code: 'grid-not-found' } });
    const warm = measure({ figures: { long: { kind: 'distance', ends: LONG_ENDS } } }, drawPhoto(0, 'cream'));
    expect(warm).toMatchObject({ kind: 'refused', refused: { code: 'paper-warm', recovery: 'retake' } });
    if (warm.kind === 'refused') expect(warm.refused.reason).toMatch(/reads \d+ green over blue/);
  }, 60_000);

  /*
   * MUTATION PROOF, run (2026-11-09): the reference facing check removed:
   * `expected 'k-implausible' to be 'reference-faces-camera'`: the run is
   * still refused, but with a fix that sends the agent to its points, not to
   * the photo.
   */
  it('a reference end facing the camera refuses the run', () => {
    const r = measure({ grid: seeds(), reference: [px(60, 60), px(60, 130)], figures: { long: { kind: 'distance', ends: LONG_ENDS } } }, plain);
    expect(r.kind).toBe('refused');
    if (r.kind === 'refused') {
      expect(r.refused.code).toBe('reference-faces-camera');
      expect(r.refused.reason).toContain('second end');
    }
  }, 60_000);

  it('no medium straight in the photo: reference-unread', () => {
    // The medium straight painted over with paper.
    const rgb = plain.rgb.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [u, v] = pixelToPaper(map, [x, y]);
      if (u >= MEDIUM.u0 - 1 && u <= MEDIUM.u1 + 1 && v >= MEDIUM.v0 - 1 && v <= MEDIUM.v1 + 1) rgb.set([196, 205, 214], (y * W + x) * 3);
    }
    const r = measure({ figures: { long: { kind: 'distance', ends: LONG_ENDS } } }, { width: W, height: H, rgb });
    expect(r).toMatchObject({ kind: 'refused', refused: { code: 'reference-unread' } });
  }, 60_000);
});

describe('a road\'s ends centred across the road', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): centring skipped (`centreAcross`
   * never centring): `expected 0.965… to be less than 0.15`: a line picked
   * 1mm off the medium straight's centreline reads its offset 1mm out, as the
   * Linux sandbox's picks did on 84405 (out +0.63mm).
   */
  it('a line picked 1mm off-centre reads the same offset as one picked on it', () => {
    const off = (p: Pt): Pt => [p[0] + 5, p[1]]; // 5px is 1mm on this photo, square to the line
    const r = measured(measure({ figures: {
      out: { kind: 'offset', point: LONG_ENDS[0], toward: px(120, 50), line: [off(MED[0]), off(MED[1])] },
    } }, plain));
    const f = value(r, 'out');
    expect(Math.abs(f.valueMm - 60)).toBeLessThan(0.15);
    expect(f.ends[0]!.acrossMm).toBeCloseTo(-1, 0);
    expect(f.status).toBe('checked');
  }, 60_000);

  /*
   * MUTATION PROOF, run (2026-11-09): the end-not-centred reason dropped:
   * `expected [ 'end-hand-read', 'end-hand-read' ] to include 'end-not-centred'`.
   */
  it('an end whose road can\'t be found either side is provisional: end-not-centred', () => {
    const r = measured(measure({ figures: { odd: { kind: 'distance', ends: [px(15, 132), LONG_ENDS[1]] } } }, plain));
    const f = r.figures.odd!;
    if ('refused' in f) throw new Error(f.refused.reason);
    expect(f.status).toBe('provisional');
    expect(f.why.map((w) => w.code)).toContain('end-not-centred');
  }, 60_000);
});

describe('one figure refused, not the run', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): a figure end facing the camera read
   * anyway (its facing check removed): `expected { kind: 'distance', …(5) }
   * to have property "refused"`.
   */
  it('an end facing the camera refuses that figure; the others are read', () => {
    const r = measured(measure({ figures: { long: { kind: 'distance', ends: LONG_ENDS }, near: { kind: 'distance', ends: [px(120, 30), px(120, 100)] } } }, plain));
    expect(r.figures.near).toHaveProperty('refused');
    expect(r.figures.near).toMatchObject({ refused: { code: 'faces-camera', reason: expect.stringContaining('second end'), recovery: 'retake' } });
    expect(r.figures.long).toHaveProperty('valueMm');
  }, 60_000);

  /*
   * MUTATION PROOF, run (2026-11-09): status 'checked' whatever `why` holds:
   * `expected [ 'checked', 'not checked' ] to deeply equal [ 'provisional',
   * 'not checked' ]`.
   */
  it('a point without toward is provisional, its facing not checked, and says why', () => {
    const f = value(measure({ figures: { out: { kind: 'offset', point: LONG_ENDS[0], line: MED } } }, plain), 'out');
    expect([f.status, f.facing]).toEqual(['provisional', 'not checked']);
    expect(f.why.map((w) => w.code)).toEqual(['facing-not-checked']);
  }, 60_000);

  it('a point outside the photo refuses its figure, naming the size; ends under 1mm apart: geometry', () => {
    const r = measured(measure({ figures: {
      off: { kind: 'distance', ends: [[-5, 10], LONG_ENDS[1]] },
      tiny: { kind: 'distance', ends: [LONG_ENDS[0], [LONG_ENDS[0][0] + 0.5, LONG_ENDS[0][1]]] },
    } }, plain));
    expect(r.figures.off).toMatchObject({ refused: { code: 'point-outside', reason: expect.stringContaining('1200×1600') } });
    expect(r.figures.tiny).toMatchObject({ refused: { code: 'geometry' } });
  }, 60_000);
});

describe('the points file', () => {
  it('not JSON, no figures, or a bad field: refused before any work, naming the field', () => {
    expect(parsePoints('{ figures:')).toMatchObject({ code: 'points-not-json' });
    expect(parsePoints('{"figures":{}}')).toMatchObject({ code: 'no-figures' });
    expect(parsePoints('{"figures":{"a":[[1,2,3],[4,5]]}}')).toMatchObject({ code: 'points-invalid', reason: expect.stringContaining('figures.a[0]') });
    expect(parsePoints('{"figures":{"out":{"point":[1,2],"line":[[0,0],[9,9]],"read":"across"}}}')).toMatchObject({ code: 'points-invalid', reason: expect.stringContaining('figures.out.read') });
    expect(parsePoints('{"figures":{"a":[[1,2],{"crop":"p.crop-1-2-30.png","at":[4,5]}]}}')).not.toHaveProperty('code');
    expect(parsePoints('{"camera":{"focal35mm":0},"figures":{"a":[[1,2],[4,5]]}}')).toMatchObject({ code: 'points-invalid', reason: expect.stringContaining('camera') });
  });

  /*
   * MUTATION PROOF, run (2026-11-10): the points file's camera not carried
   * through resolvePoints fails with `expected { kind: 'measured', …(5) } to
   * match object { kind: 'refused', …(1) }`.
   */
  it('a focal length given in the points file is used when the photo has none (a chat attachment)', () => {
    const file = parsePoints(JSON.stringify({ camera: { focal35mm: 48 }, figures: { long: LONG_ENDS } }));
    if ('code' in file) throw new Error(file.reason);
    const points = resolvePoints(file, '.', null);
    if ('code' in points) throw new Error(points.reason);
    // The synthetic photo was drawn by no 48mm camera: with that focal length its medium straight reads far off 144, and the photo is refused.
    expect(measure(points, plain)).toMatchObject({ kind: 'refused', refused: { code: 'reference-off-size' } });
    expect(measured(measure({ figures: points.figures }, plain)).scale).toMatchObject({ kind: 'medium', why: 'the photo carries no 35mm focal length' });
  }, 60_000);

  /*
   * MUTATION PROOF, run (2026-11-09): the stem compared as a prefix
   * (`m[1].startsWith(stem)`): `84405b.crop-…` accepted for 84405: `expected
   * [ 1210.25, 830 ] to match object { code: 'points-invalid' }`.
   */
  it('a crop point maps back as fromCrop does, only from a crop of this photo, inside the crop', () => {
    const file = (crop: string, at: Pt) => parsePoints(JSON.stringify({ figures: { a: [{ crop, at }, [100, 100]] } })) as Exclude<ReturnType<typeof parsePoints>, { code: string }>;
    const first = (r: ReturnType<typeof resolvePoints>) => ('code' in r ? r : (r.figures.a as { ends: readonly [Pt, Pt] }).ends[0]);
    expect(first(resolvePoints(file('84405.crop-1150-770-120.png', [241, 240]), '/p', '/p/84405.jpg'))).toEqual(fromCrop({ x0: 1150, y0: 770, side: 120 }, 241, 240));
    expect(first(resolvePoints(file('84405b.crop-1150-770-120.png', [241, 240]), '/p', '/p/84405.jpg'))).toMatchObject({ code: 'points-invalid' });
    expect(first(resolvePoints(file('../q/84405.crop-1150-770-120.png', [241, 240]), '/p', '/p/84405.jpg'))).toMatchObject({ code: 'points-invalid' });
    expect(first(resolvePoints(file('84405.crop-1150-770-120.png', [481, 10]), '/p', '/p/84405.jpg'))).toMatchObject({ code: 'points-invalid', reason: expect.stringContaining('outside the 480×480 crop') });
  });

  it('a point equal to its toward, or a line whose ends coincide, is points-invalid', () => {
    const f = parsePoints('{"figures":{"o":{"point":[5,5],"toward":[5,5],"line":[[0,0],[9,9]],"read":"offset"}}}');
    expect(resolvePoints(f as never, '/p', '/p/x.jpg')).toMatchObject({ code: 'points-invalid', reason: expect.stringContaining('figures.o.toward') });
    const g = parsePoints('{"figures":{"o":[[3,3],[3,3]]}}');
    expect(resolvePoints(g as never, '/p', null)).toMatchObject({ code: 'points-invalid' });
  });
});

describe('the command line', () => {
  /** An Io over the synthetic photo; files from a map; what was printed. */
  const io = (files: Record<string, unknown>, load: (p: string) => RgbImage = () => plain) => {
    const out: string[] = [], err: string[] = [];
    const loaded: string[] = [];
    const io: Io = {
      load: (p) => (loaded.push(p), load(p)),
      camera: () => undefined,
      read: (f) => {
        if (!(f in files)) throw Object.assign(new Error('no such file'), { code: 'ENOENT' });
        return typeof files[f] === 'string' ? (files[f] as string) : JSON.stringify(files[f]);
      },
      out: (l) => out.push(l),
      err: (l) => err.push(l),
    };
    return { io, out, err, loaded };
  };
  /*
   * MUTATION PROOF, run (2026-11-09): a code left out of HELP's list
   * (`Object.entries(CODES).slice(1)`): `expected 'usage: bun engine/tools/
   * photoMeasure.…' to contain 'photo-missing'`.
   */
  it('--help exits 0 and names every flag and code', () => {
    const t = io({});
    expect(main(['--help'], t.io)).toBe(0);
    for (const c of Object.keys(CODES)) expect(t.out.join('\n')).toContain(c);
    for (const flag of ['--photo', '--auto', '--help']) expect(HELP).toContain(flag);
  });

  it('every code in CODES is in the drawing skill\'s Measure codes table', () => {
    const skill = readFileSync('.claude/skills/draw-piece/SKILL.md', 'utf8');
    const table = skill.slice(skill.indexOf('Measure codes'));
    for (const c of Object.keys(CODES)) expect(table).toContain(`\`${c}\``);
  });

  it('bad usage exits 2 with USAGE and its code first, the fix last', () => {
    const t = io({ 'p.json': { figures: { o: { point: [1, 1], line: [[0, 0], [9, 9]], read: 'offset' } } } });
    expect(main(['p.json', '--jsn'], t.io)).toBe(2);
    expect(t.err[0]).toMatch(/^USAGE usage: unknown flag --jsn\n/);
    expect(main(['p.json'], t.io)).toBe(2);
    expect(t.err[1]).toMatch(/^USAGE needs-photo: /);
    expect(t.err[1]!.split('\n').at(-1)).toBe(CODES['needs-photo'].fix);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): figures refused counted as read (exit
   * 0 always): `expected +0 to be 3`.
   */
  it('--auto is --photo; a refused figure exits 3, even when every figure is refused', () => {
    const t = io({ 'p.json': { figures: { near: [px(120, 30), px(120, 100)] } } });
    expect(main(['p.json', '--auto', 'p.png'], t.io)).toBe(3);
    expect(t.loaded).toEqual(['p.png']);
    expect(t.out.join('\n')).toMatch(/near: REFUSED faces-camera: /);
  }, 60_000);

  it('a photo that cannot be read refuses the run with its code; anything unexpected is REFUSED internal with a trace file', () => {
    const t = io({ 'p.json': { figures: { a: [[1, 1], [9, 9]] } } }, () => {
      throw new PhotoError('no-converter', 'no converter to read p.png');
    });
    expect(main(['p.json', '--photo', 'p.png'], t.io)).toBe(1);
    expect(t.err[0]).toMatch(/^REFUSED no-converter: /);
    const u = io({ 'p.json': { figures: { a: [[1, 1], [9, 9]] } } }, () => {
      throw new Error('boom');
    });
    expect(main(['p.json', '--photo', 'p.png'], u.io)).toBe(1);
    const trace = u.err[0]!.match(/trace: (\S+)\)/)?.[1];
    expect(u.err[0]).toMatch(/^REFUSED internal: boom/);
    expect(trace && existsSync(trace)).toBe(true);
  });

  it('without --photo, a plain file with grid and reference runs as before', () => {
    const affine = (u: number, v: number): Pt => [100 + 5 * u, 100 + 5 * v];
    const file = {
      grid: [[0, 0], [180, 0], [0, 260], [180, 260], [90, 130]].map(([u, v]) => ({ px: affine(u!, v!), mm: [u, v] })),
      reference: [affine(60, 60), affine(60, 204)],
      figures: { long: [affine(120, 30), affine(120, 246)] },
    };
    const t = io({ 'p.json': file });
    expect(main(['p.json'], t.io)).toBe(0);
    expect(t.out).toContain('long: 216.00mm');
  });
});
