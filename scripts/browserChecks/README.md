# Browser checks

Checks that need a real browser: real layout, real hit-testing. jsdom has
neither, so these run against a dev server (`bun run dev`) in a browser driven
by gstack's browse tool, and each PR that relies on one records its output.

Each check is two page scripts: a fixture that writes a layout to
localStorage, and a check that returns a JSON verdict. Reload between them.

    $B goto http://localhost:5179/
    $B js "window.FIXTURE='two'; 'set'"        # or 'three'
    $B eval scripts/browserChecks/stackedEnds.fixture.js
    $B goto http://localhost:5179/
    $B js "$(grep -v '^//' scripts/browserChecks/stackedEnds.check.js | tr '\n' ' ')"

The check is async (it waits for React between clicks), and `$B js` awaits
it where `$B eval` does not.

`stackedEnds` (plan 2026-11-01, eng E1, OV3, X4): ends on one spot, at an
angle so no Join button covers them. Clicking the spot twice must join the
expected pair, going through `document.elementFromPoint`, which is what a
pointer reaches.

Recorded on 2026-11-01 (PR for T2): `two` and `three` both `ok: true`; with the
canvas switched back to each dot taking its own click, `two` returned
`ok: false` (the second click un-selected the end, nothing joined).
