/**
 * SAVE TO A FILE, OPEN A LAYOUT FILE (layoutFile.ts).
 *
 *   [Save to a file] ─▶ fileOf ─▶ refused: one sentence (FILE_SAVE_REFUSED)
 *                              └ ok: layout.choochoo downloads, "Saved to a file." is announced
 *   [Open a layout file] ─▶ picker ─┐
 *   a file dropped on the canvas ───┴▶ openLayoutFile ─▶ over FILE_MAX_BYTES: refused, unread
 *                                       ─▶ fragmentOfFile ─▶ refused: one sentence (FILE_REFUSED)
 *                                                         └ ok: the address takes the fragment
 *
 * OPENING GOES THROUGH THE ADDRESS. A pasted link already arrives as a
 * `hashchange`, which App answers by reloading into the read-only view when
 * everything is saved and by holding the link back when not (D8, D15, D34).
 * A file gets that whole path, its exits included, by taking the same road.
 * The one difference from the design doc: the address then carries the
 * fragment, as a pasted link's does.
 *
 * ONE WAY IN, TWO DOORS. The picker and a drop on the canvas both hand their
 * file to `openLayoutFile`, and both say a refusal on this row's status line.
 * App owns that sentence, since the drop happens outside this row.
 */

import { useEffect, useRef } from 'react';
import type { Graph } from '../../engine/src/graph/model.js';
import { downloadBytes } from './downloadBytes.js';
import { countAction } from './linkFragment.js';
import { FILE_ACCEPT, FILE_MAX_BYTES, FILE_NAME, fileOf, fragmentOfFile } from './layoutFile.js';
import { FILE_REFUSED, FILE_SAVE_REFUSED, FILE_SAVED, FILE_USES_CORRECTIONS } from './linkWords.js';

export interface LayoutFileControlsProps {
  readonly graph: Graph;
  readonly usesCorrections: boolean;
  /** The app's one polite announcer. */
  readonly announce: (sentence: string) => void;
  /** What this row says now, shared with a drop on the canvas. */
  readonly said: string | null;
  readonly setSaid: (sentence: string | null) => void;
}

/**
 * Opens a layout file, from the picker or a drop: a refusal is said through
 * `say`, a good file puts its fragment in the address.
 */
export async function openLayoutFile(file: File, say: (sentence: string | null) => void): Promise<void> {
  if (file.size > FILE_MAX_BYTES) return say(FILE_REFUSED['too-large']);
  const read = await fragmentOfFile(await file.text());
  if (!read.ok) return say(FILE_REFUSED[read.reason]);
  say(null);
  countAction('open-file');
  location.hash = read.fragment;
}

export function LayoutFileControls({ graph, usesCorrections, announce, said, setSaid }: LayoutFileControlsProps) {
  const picker = useRef<HTMLInputElement | null>(null);
  // A changed layout makes what was said about the old one stale.
  useEffect(() => setSaid(null), [graph, setSaid]);

  const save = async () => {
    const file = await fileOf(graph);
    if (!file.ok) return setSaid(FILE_SAVE_REFUSED[file.reason]);
    downloadBytes(file.text, FILE_NAME, 'text/plain');
    countAction('save-file');
    announce(FILE_SAVED);
    setSaid(usesCorrections ? FILE_USES_CORRECTIONS : null);
  };

  return (
    <div className="palette-row palette-controls layout-file">
      {graph.pieces.length > 0 && <button onClick={() => void save()}>Save to a file</button>}
      <button onClick={() => picker.current?.click()}>Open a layout file</button>
      <input
        ref={picker}
        type="file"
        accept={FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Layout file"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          // Cleared, so choosing the same file again still opens it.
          e.currentTarget.value = '';
          if (file) void openLayoutFile(file, setSaid);
        }}
      />
      {said !== null && (
        <span className="inventory-hint" role="status">
          {said}
        </span>
      )}
    </div>
  );
}
