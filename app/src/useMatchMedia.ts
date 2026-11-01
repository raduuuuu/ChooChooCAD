import { useEffect, useState } from 'react';

/**
 * Below this width the editor is not offered: phones view and build (share
 * plan, design 18A, 19A; eng D67). The CSS gate marked `/* gate:
 * NARROW_QUERY *\/` in app.css must use exactly this query, and
 * `narrowQuery.test.ts` reads the stylesheet to hold it there.
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
