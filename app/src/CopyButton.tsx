/**
 * A COPY BUTTON THAT SAYS IT COPIED (contributor-brief D4, D9, D14): copies
 * `text` and announces "Copied." in its own polite region, or that it could
 * not, since the text is on screen to select by hand.
 */

import { useState } from 'react';
import { COPIED_ANNOUNCE, COPY_FAILED } from './previewWords.js';

export function CopyButton({ text, label }: { readonly text: string; readonly label: string }) {
  const [said, setSaid] = useState('');
  const copy = async () => {
    setSaid('');
    try {
      await navigator.clipboard.writeText(text);
      setSaid(COPIED_ANNOUNCE);
    } catch {
      setSaid(COPY_FAILED);
    }
  };
  return (
    <span className="preview-copy">
      <button type="button" onClick={() => void copy()}>
        {label}
      </button>
      <span role="status" aria-live="polite">
        {said}
      </span>
    </span>
  );
}
