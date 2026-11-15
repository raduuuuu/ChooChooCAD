import { useEffect, useState } from 'react';

/**
 * A narrow screen: at or under this width the editor is the phone's (plan
 * 2026-11-14, E4; `PHONE_SHELL_QUERY` in phoneEditor.tsx adds short touch
 * screens). It gates nothing by itself any more: the stylesheet's "needs a
 * larger screen" block went when a phone got its own editor.
 */
export const NARROW_QUERY = '(max-width: 620px)';

/** Whether `query` matches now, following it as the window changes. False where matchMedia is missing. */
export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches === true);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia(query);
    if (typeof q.addEventListener !== 'function') return;
    const on = () => setMatches(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [query]);
  return matches;
}
