# Plan and backlog: exported copies

**These three files are copies. They are not the originals and nothing here
writes to them.**

| File | Canonical location |
|---|---|
| `2026-10-06-brio-track-designer.md` | `~/.gstack/projects/radudiaconescu/ceo-plans/` |
| `brio-TODOS.md` | `~/.gstack/projects/radudiaconescu/` |
| `2026-10-13-open-work.md` | `~/.gstack/projects/brio-designer/ceo-plans/` |

The gstack review skills (`/plan-ceo-review`, `/plan-eng-review`,
`/plan-design-review`) read and append to the canonical paths above. They do not
know this directory exists. So every review run makes the copies here stale, and
a stale copy that looks authoritative is the failure mode to watch for: check the
dates and the last review section before trusting anything in here.

They are committed anyway, for one reason. The code in this repo is the result of
roughly twenty decisions whose reasoning is not recoverable from the diff: why
the residual is a necessary condition rather than an allocation, why the overlap
check compares positions for exact equality instead of measuring footprints, why
inventory stores counts rather than set manifests, why a piece rather than a
connector is the graph node. A clone with only the source answers none of that.

To refresh:

```sh
cp ~/.gstack/projects/radudiaconescu/ceo-plans/2026-10-06-brio-track-designer.md docs/plan/
cp ~/.gstack/projects/radudiaconescu/brio-TODOS.md docs/plan/
cp ~/.gstack/projects/brio-designer/ceo-plans/2026-10-13-open-work.md docs/plan/
```

Each copy is byte-identical to its source at the commit that added it, so `cmp`
against the canonical path tells you whether it has drifted.
