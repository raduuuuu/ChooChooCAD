/**
 * THE VERSION, SHOWN (owner, 2026-11-15): "Version 1.4.2", a link to the list
 * of what changed in each. With the ready layouts on a wide screen and in
 * More on a phone, so a person reporting a problem can say which version
 * they saw. The number is package.json's, stamped in by vite.config.ts; how
 * it moves is in engine/tools/version.ts.
 *
 * Read when drawn, not when this file loads, so a test can set the number.
 * Where nothing stamped it (a test, a tool), no line is drawn: a made-up
 * number would be a claim nobody checked (DESIGN.md rule 3).
 */

/** Each version's release, with what changed in it. */
export const RELEASES_URL = 'https://github.com/raduuuuu/ChooChooCAD/releases';

export const appNumber = (): string | null => (typeof __APP_NUMBER__ === 'string' && __APP_NUMBER__ !== '' ? __APP_NUMBER__ : null);

export function VersionLine({ className }: { className: string }) {
  const number = appNumber();
  if (number === null) return null;
  return (
    <a className={`${className} app-version`} href={RELEASES_URL}>
      {/*
        * One span round both: the rows this sits in are flex boxes, where the
        * word and the number as two children lost the space between them (and,
        * in More, stacked). The number is in the number face (DESIGN.md rule 4).
        */}
      <span>
        Version <span className="num">{number}</span>
      </span>
    </a>
  );
}
