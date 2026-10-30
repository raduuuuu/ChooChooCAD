/**
 * The app's name at the top of the parts rail (brio-TODOS.md, "The app's name
 * is not on screen"). Screenshots and first visits showed a track tool without
 * saying which one.
 *
 * The mark is the logo's open loop: a ring of track with one joint left open.
 * It draws in `currentColor` and no wood, because chrome gets no colour
 * (DESIGN.md rule 1); the full-colour mark is the favicon, app/public/favicon.svg.
 */

export function AppName() {
  return (
    <p className="app-name">
      <svg className="app-name-mark" width="18" height="18" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <path d="M157.34 140.15 A70 70 0 1 1 157.34 59.85" fill="none" stroke="currentColor" strokeWidth="40" />
        <circle cx="164" cy="69" r="13" fill="currentColor" />
      </svg>
      <span className="app-name-title">ChooChooCAD</span>
      <span className="app-name-tag">wooden railway layouts</span>
    </p>
  );
}
