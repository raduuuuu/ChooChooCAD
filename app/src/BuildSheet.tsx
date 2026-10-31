/**
 * THE PRINTED BUILD SHEET (build mode plan, sheet scope 1-7; D2, D24, D29,
 * D30, D47, D48, D53). Printed from the browser: this renders into a
 * print-only container at the body's root, and `@media print` shows only it.
 *
 *   page 1   "Build order", count, date, app; the verdict (D29, D53); the parts
 *   band     one page per band (more when dense, D30): earlier bands in
 *            --rule, this band in ink outline, numbers in rings, leader
 *            lines where a number had to move (D47, D48), a page map when
 *            the band spans several pages
 *   list     every step: number, piece, code, band, note (D24, D47)
 *
 * Nothing here is coloured but the verdict line, which carries its glyph so
 * it survives a greyscale printer (DESIGN.md rule 2).
 */

import { createPortal } from 'react-dom';
import { useMemo, type ReactNode } from 'react';
import type { Segment } from '../../engine/src/geom/fk.js';
import type { BuildItem } from '../../engine/src/graph/buildSteps.js';
import type { Part } from '../../engine/src/parts/schema.js';
import type { PullRow } from './BuildMode.js';
import { DISC_MM, PAGE_MM, sheetPages, tileName, type SheetPage } from './sheetLayout.js';
import { plankEdges, segmentPath } from './trackPath.js';

/** An 8pt number, in paper mm. */
const NUMBER_MM = 2.822;

export interface BuildSheetProps {
  readonly items: readonly BuildItem[];
  readonly segments: readonly Segment[];
  readonly partOf: (pieceId: string) => Part;
  readonly partName: (partId: string) => string;
  readonly verdict: ReactNode;
  readonly pull: { readonly rows: readonly PullRow[]; readonly adapters: { readonly count: number; readonly short: number } };
  /** The note sentence for a step, as build mode words it (D7, D14, D52). */
  readonly noteText: (item: Extract<BuildItem, { kind: 'piece' }>) => string | null;
  /** Today, for the title line (D53). Passed in so a test can fix it. */
  readonly date: Date;
}

/** "Floor", "Ramps that climb to level 1", "Level 1". */
export function bandName(band: number): string {
  if (band === 0) return 'Floor';
  return band % 2 === 1 ? `Ramps that climb to level ${(band + 1) / 2}` : `Level ${band / 2}`;
}

export function BuildSheet(props: BuildSheetProps) {
  const { items, segments } = props;
  const pages = useMemo(() => sheetPages(items, segments), [items, segments]);
  const steps = items.filter((i): i is Extract<BuildItem, { kind: 'piece' }> => i.kind === 'piece');
  const total = pages.length + 2;
  const date = props.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const head = (n: number, what: string) => (
    <p className="sheet-running">
      Build order · {what} · sheet <span className="num">{n}</span> of <span className="num">{total}</span>
    </p>
  );
  return createPortal(
    <div className="build-sheet">
      <section className="sheet-page">
        <h1 className="sheet-title">Build order</h1>
        <p className="sheet-meta">
          <span className="num">{steps.length}</span> pieces · {date} · ChooChooCAD
        </p>
        <div className="sheet-verdict">{props.verdict}</div>
        <h2 className="sheet-h2">Get these out of the box</h2>
        <table className="sheet-table">
          <tbody>
            {props.pull.rows.map((r) => (
              <tr key={r.partId}>
                <td>{r.name}</td>
                <td className="num">{r.partId}</td>
                <td className="num">{r.count}</td>
                <td>{r.short > 0 && <><span className="num">{r.short}</span> short</>}</td>
              </tr>
            ))}
            {props.pull.adapters.count > 0 && (
              <tr>
                <td>Male-male adapter</td>
                <td />
                <td className="num">{props.pull.adapters.count}</td>
                <td>{props.pull.adapters.short > 0 && <><span className="num">{props.pull.adapters.short}</span> short</>}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      {pages.map((p, i) => (
        <section className="sheet-page" key={`${p.band}-${p.tile.row}-${p.tile.col}`}>
          {head(i + 2, p.tile.rows * p.tile.cols > 1 ? `${bandName(p.band)}, ${tileName(p.tile.row, p.tile.col)}` : bandName(p.band))}
          <BandDrawing page={p} segments={segments} partOf={props.partOf} />
          {p.tile.rows * p.tile.cols > 1 && <PageMap page={p} />}
        </section>
      ))}
      <section className="sheet-page sheet-list">
        {head(total, 'Step list')}
        <table className="sheet-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Piece</th>
              <th>Code</th>
              <th>Band</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => {
              const note = props.noteText(s);
              return (
                <tr key={s.pieceId}>
                  <td className="num">
                    {s.step}
                    {note ? '*' : ''}
                  </td>
                  <td>{s.adapter ? `${props.partName(s.partId)} (adapter first: male-male)` : props.partName(s.partId)}</td>
                  <td className="num">{s.partId}</td>
                  <td>{bandName(s.band)}</td>
                  <td>{note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>,
    document.body,
  );
}

function BandDrawing({ page, segments, partOf }: { page: SheetPage; segments: readonly Segment[]; partOf: (id: string) => Part }) {
  const { view, scale } = page;
  const earlier = new Set(page.earlier);
  const current = new Set(page.current);
  const r = DISC_MM / scale;
  const font = NUMBER_MM / scale;
  const width = (s: Segment) => (s.pieceId ? partOf(s.pieceId).plankWidthMm : 40);
  // Flipped like the canvas, so the plan reads as it does on screen and on the floor; text stays upright.
  const fy = (y: number) => 2 * view.minY + view.h - y;
  return (
    <svg
      className="sheet-drawing"
      viewBox={`${view.minX} ${view.minY} ${view.w} ${view.h}`}
      width={`${PAGE_MM.w}mm`}
      height={`${PAGE_MM.h}mm`}
      role="img"
      aria-label={`Track for ${page.labels.length} steps`}
    >
      <g transform={`translate(0, ${2 * view.minY + view.h}) scale(1, -1)`}>
      {segments
        .filter((s) => s.pieceId !== undefined && earlier.has(s.pieceId))
        .map((s, i) => (
          <path key={`e${i}`} d={segmentPath(s)} className="sheet-earlier" strokeWidth={width(s)} />
        ))}
      {segments
        .filter((s) => s.pieceId !== undefined && current.has(s.pieceId))
        .map((s, i) => (
          <g key={`c${i}`}>
            <path d={segmentPath(s)} className="sheet-plank" strokeWidth={width(s)} />
            {plankEdges(s, width(s) / 2).map((d, k) => (
              <path key={k} d={d} className="sheet-edge" />
            ))}
          </g>
        ))}
      </g>
      {page.labels.map((l) =>
        l.leader ? <line key={`l${l.step}`} x1={l.at[0]} y1={fy(l.at[1])} x2={l.disc[0]} y2={fy(l.disc[1])} className="sheet-leader" /> : null,
      )}
      {page.labels.map((l) => (
        <g key={`n${l.step}`}>
          <circle cx={l.disc[0]} cy={fy(l.disc[1])} r={r} className="sheet-disc" />
          <text x={l.disc[0]} y={fy(l.disc[1])} fontSize={font} className="sheet-number" textAnchor="middle" dominantBaseline="central">
            {l.step}
            {l.note ? '*' : ''}
          </text>
        </g>
      ))}
      <EdgeNames page={page} font={font} />
    </svg>
  );
}

/** Neighbouring pages' names at this page's edges, so split pages assemble (D48). */
function EdgeNames({ page, font }: { page: SheetPage; font: number }) {
  const { row, col, rows, cols } = page.tile;
  if (rows * cols === 1) return null;
  const { minX, minY, w, h } = page.view;
  const pad = font * 1.2;
  const out: { x: number; y: number; name: string }[] = [];
  if (col > 0) out.push({ x: minX + pad, y: minY + h / 2, name: tileName(row, col - 1) });
  if (col < cols - 1) out.push({ x: minX + w - pad, y: minY + h / 2, name: tileName(row, col + 1) });
  if (row > 0) out.push({ x: minX + w / 2, y: minY + pad, name: tileName(row - 1, col) });
  if (row < rows - 1) out.push({ x: minX + w / 2, y: minY + h - pad, name: tileName(row + 1, col) });
  return (
    <>
      {out.map((e) => (
        <text key={e.name} x={e.x} y={e.y} fontSize={font} className="sheet-edge-name" textAnchor="middle" dominantBaseline="central">
          {e.name}
        </text>
      ))}
    </>
  );
}

/** The whole band, small, with this page's part outlined (D48). */
function PageMap({ page }: { page: SheetPage }) {
  const b = page.bandBox;
  const { rows, cols, row, col } = page.tile;
  const tw = page.view.w;
  const th = page.view.h;
  return (
    <svg className="sheet-map" viewBox={`${b.minX} ${b.minY} ${tw * cols} ${th * rows}`} width="40mm" role="img" aria-label={`Page ${tileName(row, col)} of the band`}>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <g key={`${r}-${c}`}>
            <rect x={b.minX + c * tw} y={b.minY + r * th} width={tw} height={th} className={r === row && c === col ? 'sheet-map-here' : 'sheet-map-cell'} />
            <text x={b.minX + (c + 0.5) * tw} y={b.minY + (r + 0.5) * th} fontSize={Math.min(tw, th) * 0.3} className="sheet-map-name" textAnchor="middle" dominantBaseline="central">
              {tileName(r, c)}
            </text>
          </g>
        )),
      )}
    </svg>
  );
}
