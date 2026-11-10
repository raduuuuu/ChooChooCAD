/**
 * ONE SENT PIECE, READ-ONLY (contributor-brief plan, "The preview screen,
 * designed", D1 to D3, D7 to D14; T4). Built on the shared-layout screen's
 * column (FriendScreen, D1): no library rail, works on a phone.
 *
 *   ChooChooCAD · wooden railway layouts            (1) identity
 *   Piece preview · Double-arch bridge              (2) h1, focused on load
 *   This piece isn't in the library: …              (3) never folded
 *   ┌───────────────────────────────────────────┐
 *   │ medium straight · piece · medium straight │   (4) 2D first, then 3D
 *   └───────────────────────────────────────────┘       with From the side
 *   Length 240 mm · Ends … · Tallest part …         (5) .num mm; D7's line
 *   Looks like your piece? … / Something's wrong? … (6) back to the chat
 *   ▸ Details for review                            (7) folded: checks, data, Copy
 *   Back to my layout / Start your own              (8) the way out
 *
 * NO VERDICT (D10): no strip, no glyph, no "Checked with catalogue sizes.":
 * a pass beside an unverified drawing would read as approval. ORDINARY WOOD
 * (D11): the piece is drawn as placed track, never as the placement ghost.
 * Nothing here writes to storage, and the piece lives only in this screen's
 * resolver: it is never added to the library.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { clearance } from '../../engine/data/calibration.js';
import { BUILT_IN } from '../../engine/data/library.js';
import { MEASUREMENTS } from '../../engine/data/measurements.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { codeOf, type Part } from '../../engine/src/parts/schema.js';
import type { SceneInput } from '../../engine/src/view3d/mesh.js';
import { AppName } from './AppName.js';
import { CopyButton } from './CopyButton.js';
import { holdsOwnLayout } from './layoutStore.js';
import { leaveLink } from './leaveLink.js';
import { exitLabel } from './linkWords.js';
import {
  checksPassed,
  heightWords,
  joinedEnds,
  mmText,
  previewGraph,
  previewResolver,
  previewSizes,
  sizePhrase,
  trackMatch,
  withKnownPaint,
} from './previewPiece.js';
import {
  COPY,
  DETAILS_CHECKS,
  DETAILS_DATA,
  DETAILS_SUMMARY,
  duplicateLine,
  FROM_THE_SIDE,
  NEXT_LOOKS_RIGHT,
  NEXT_WRONG,
  pictureLabel,
  PREVIEW_STANDING,
  previewAnnounce,
  previewTitle,
  sceneWords,
  SIZE_ENDS,
  SIZE_LABEL,
  SIZE_LENGTH,
  SIZE_RADIUS,
  SIZE_TALLEST,
  endWords,
  unknownPaint,
  withMm,
} from './previewWords.js';
import { seamLines } from './trackPath.js';
import { CANVAS_SEGMENT_CEILING, TrackCanvas } from './TrackCanvas.js';
import { View3DPanel } from './View3DPanel.js';

const SIZE_NAMES = { length: SIZE_LENGTH, radius: SIZE_RADIUS, size: SIZE_LABEL } as const;

export function PreviewScreen({ part: sent, data }: { readonly part: Part; readonly data: unknown }) {
  // D12: paints the app lacks come off before anything draws; the details name them.
  const { part, unknown } = useMemo(() => withKnownPaint(sent), [sent]);
  const resolve = useMemo(() => previewResolver(part), [part]);
  const graph = useMemo(() => previewGraph(part), [part]);
  const ports = useMemo(() => (p: Piece): readonly Port[] => portsOf(resolve(p.partId), p.turn), [resolve]);
  const drawn = useMemo(() => renderGraph(graph, ports, resolve, placeAll(graph, ports)), [graph, ports, resolve]);
  const partOf = useMemo(() => new Map(graph.pieces.map((p) => [p.pieceId, p.partId])), [graph]);
  const seams = useMemo(
    () => seamLines(graph.welds, drawn.ports, (id) => resolve(partOf.get(id)!).plankWidthMm, new Set()),
    [graph, drawn, resolve, partOf],
  );
  const { riseMm, plankMm } = clearance(MEASUREMENTS);
  const scene = useMemo(
    (): SceneInput => ({
      segments: drawn.segments,
      bodies: drawn.bodies,
      ports: drawn.ports,
      welds: graph.welds,
      partOf: (id) => resolve(partOf.get(id)!),
      riseMm,
      plankMm,
      marks: [],
    }),
    [drawn, graph, resolve, partOf, riseMm, plankMm],
  );
  const sizes = useMemo(() => previewSizes(part, riseMm), [part, riseMm]);
  const match = useMemo(() => trackMatch(part, BUILT_IN), [part]);
  const checks = useMemo(() => checksPassed(part, resolve), [part, resolve]);
  const json = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const [own] = useState(holdsOwnLayout);
  const [side, setSide] = useState(0);

  const title = useRef<HTMLHeadingElement | null>(null);
  // D14: focus starts at the heading, so a screen reader arriving from a chat hears what this is.
  useEffect(() => title.current?.focus(), []);

  const label = pictureLabel(
    part.name,
    sizePhrase(sizes.size),
    sizes.ends.map((e) => e.polarity),
    joinedEnds(part).length,
  );
  const woodCount = drawn.segments.length + drawn.bodies.length;

  return (
    <div className="friend preview">
      <header className="friend-head">
        <AppName />
      </header>
      <main className="friend-main">
        <h1 className="friend-title" ref={title} tabIndex={-1}>
          {previewTitle(part.name)}
        </h1>
        <p className="preview-standing">{PREVIEW_STANDING}</p>
        <div className="friend-picture" role="img" aria-label={label}>
          <div className="friend-picture-inner" inert>
            <TrackCanvas render={drawn} resolve={resolve} seams={seams} />
          </div>
        </div>
        <div className="preview-3d">
          <View3DPanel
            input={scene}
            pieceCount={graph.pieces.length}
            segmentCount={woodCount}
            ceiling={CANVAS_SEGMENT_CEILING}
            allSaved
            emptyAction={null}
            tableNote={null}
            label={sceneWords(part.name)}
            resetSignal={0}
            sideSignal={side}
            corner={null}
            reset={
              <button className="preview-side" onClick={() => setSide((n) => n + 1)}>
                {FROM_THE_SIDE}
              </button>
            }
          />
        </div>
        <dl className="preview-sizes">
          <div>
            <dt>{SIZE_NAMES[sizes.size.label]}</dt>
            <dd className="num">{sizes.size.label === 'size' ? sizes.size.value : withMm(sizes.size.value)}</dd>
          </div>
          <div>
            <dt>{SIZE_ENDS}</dt>
            <dd>
              <ul>
                {sizes.ends.map((e, i) => (
                  <li key={i}>
                    {endWords(e.name, e.polarity)}
                    {e.heightMm === 0 ? heightWords(e) : <span className="num">{heightWords(e)}</span>}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          {sizes.tallestMm !== null && (
            <div>
              <dt>{SIZE_TALLEST}</dt>
              <dd className="num">{withMm(mmText(sizes.tallestMm))}</dd>
            </div>
          )}
        </dl>
        {match && <p className="preview-duplicate">{duplicateLine(codeOf(match.id), match.name)}</p>}
        <div className="preview-next">
          <p>{NEXT_LOOKS_RIGHT}</p>
          <p>{NEXT_WRONG}</p>
        </div>
        <details className="friend-parts preview-details">
          <summary>{DETAILS_SUMMARY}</summary>
          {unknown.map((t) => (
            <p key={t} className="preview-paint">
              {unknownPaint(t)}
            </p>
          ))}
          <h2>{DETAILS_CHECKS}</h2>
          <ul>
            {checks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <h2>{DETAILS_DATA}</h2>
          <pre className="preview-data" tabIndex={0} aria-label={DETAILS_DATA}>
            {json}
          </pre>
          <CopyButton text={json} label={COPY} />
        </details>
        <div className="friend-quiet">
          <button onClick={leaveLink}>{exitLabel(own)}</button>
        </div>
      </main>
      <p className="sr-only" role="status" aria-live="polite">
        {previewAnnounce(part.name)}
      </p>
    </div>
  );
}
