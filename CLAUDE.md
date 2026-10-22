# brio-designer

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## Testing

```bash
bun run test        # vitest run --config vitest.config.ts
bun run typecheck   # strict typecheck (tsc --noEmit), must be clean
bun run build       # vite build, rooted at app/
```

Tests live beside the code they cover. `vitest.config.ts` runs two projects:

- **node**: `engine/**/*.test.ts` and `app/**/*.test.ts`, NO DOM. Pure logic, plus
  markup through `react-dom/server`'s `renderToStaticMarkup`, which needs no DOM and
  renders hook-using components fine but dispatches no events. Do not widen this glob.
- **dom** (task E11): `app/**/*.dom.test.tsx` only, under jsdom with
  `@testing-library/react` and `@testing-library/user-event`. For clicks, keypresses,
  focus and state after an event. `app/test/domSetup.ts` clears storage around every
  test and works around Node 25+'s own `localStorage` global shadowing jsdom's.
  No jest-dom: assert on DOM properties (`.disabled`, `.textContent`) directly.

A `.tsx` file named anything but `*.dom.test.tsx` is never collected and would pass
by never running. Prefer the node project when static markup can answer the
question; reach for the dom project when the claim is about an event.

Conventions:
- `describe` / `it` / `expect` from vitest, imported explicitly. Relative imports keep their `.js` extension.
- Resolve parts with `makeResolver(BUILT_IN)` from `engine/data/library.ts`.
- In the node project, `localStorage` is stubbed per-test, not globally. See the `withStore` helper in `app/src/layoutStore.test.ts`. The dom project has jsdom's real storage, cleared around each test.
- **Every pin records the mutation that makes it fail, and that mutation is RUN, not asserted.** A test
  that restates the constant it claims to pin can never fail; this project shipped
  that defect four times and caught it only by mutation each time. If the mutation
  you documented does not break the test, the comment is wrong -- fix the comment.
- CSS behaviour is pinned by reading the stylesheet as TEXT (`readFileSync` on `app.css`, comments stripped, then a regex
  over the rules), because there is no DOM and no CSS engine to resolve a computed style. See the peg-fill specs in
  `app/src/trackCanvasPolarity.test.ts`. It is a blunt check: it proves a rule exists and what token it names, not
  that the pixel changed. Assert on the last matching declaration, since a later rule can override an earlier one.
- Test what the code does, never `expect(x).toBeDefined()`.
