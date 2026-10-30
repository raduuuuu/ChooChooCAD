/**
 * The app's name at the top of the parts rail (brio-TODOS.md, "The app's name
 * is not on screen"). Screenshots and first visits showed a track tool without
 * saying which one.
 *
 * The mark is the logo's open loop: a ring of track with one joint left open,
 * a peg on the top end and its socket cut into the bottom end. It draws in
 * `currentColor` and no wood, because chrome gets no colour (DESIGN.md rule
 * 1); the full-colour mark is the favicon, app/public/favicon.svg.
 */

export function AppName() {
  return (
    <p className="app-name">
      <svg className="app-name-mark" width="18" height="18" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <defs>
          <mask id="app-name-socket">
            <rect width="200" height="200" fill="white" />
            <line x1="157.34" y1="140.15" x2="146" y2="156.5" stroke="black" strokeWidth="12" />
            <circle cx="146" cy="156.5" r="13" fill="black" />
          </mask>
        </defs>
        <path
          d="M157.34 140.15 A70 70 0 1 1 157.34 59.85"
          fill="none"
          stroke="currentColor"
          strokeWidth="40"
          mask="url(#app-name-socket)"
        />
        <line x1="157.34" y1="59.85" x2="168.8" y2="76.2" stroke="currentColor" strokeWidth="12" />
        <circle cx="168.8" cy="76.2" r="13" fill="currentColor" />
      </svg>
      <span className="app-name-title">ChooChooCAD</span>
      <span className="app-name-tag">wooden railway layouts</span>
    </p>
  );
}
