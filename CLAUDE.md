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
bun x tsc --noEmit  # strict typecheck, must be clean
bun run build       # vite build, rooted at app/
```

Tests live beside the code they cover: `app/src/*.test.ts` and `engine/test/*.test.ts`.
`vitest.config.ts` collects **`.test.ts` only** and runs in the node environment with
NO DOM; its own docblock forbids widening that glob as a substitute for a real
testing-library setup (task E11). A `.tsx` test is never collected and would pass by
never running.

React components are still testable: `react-dom/server`'s `renderToStaticMarkup`
needs no DOM and renders hook-using components fine. What it cannot do is dispatch
an event, so anything asserting a click, a keypress or focus order waits for E11.

Conventions:
- `describe` / `it` / `expect` from vitest, imported explicitly. Relative imports keep their `.js` extension.
- Resolve parts with `makeResolver(BUILT_IN)` from `engine/data/library.ts`.
- `localStorage` is stubbed per-test, not globally. See the `withStore` helper in `app/src/layoutStore.test.ts`.
- **Every pin records the mutation that makes it fail, and that mutation is RUN, not asserted.** A test
  that restates the constant it claims to pin can never fail; this project shipped
  that defect four times and caught it only by mutation each time. If the mutation
  you documented does not break the test, the comment is wrong -- fix the comment.
- Test what the code does, never `expect(x).toBeDefined()`.
