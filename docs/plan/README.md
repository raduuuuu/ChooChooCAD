# Plan and backlog: which copy is authoritative

**Read this before running any `cp`. For two of these three files the repo copy
is the ORIGINAL, and the "canonical" gstack path holds something smaller and
older. Copying the wrong way destroys work.**

| File | Authoritative |
|---|---|
| `2026-10-13-open-work.md` | **the repo copy** |
| `brio-TODOS.md` | **the repo copy** |
| `2026-10-06-brio-track-designer.md` | the gstack path |

No byte counts in this table, on purpose. The first version of it carried
them, and the figure for `brio-TODOS.md` was already wrong in the commit that
wrote it -- it recorded the parent commit's size, because that commit edited
the file too. A number that the act of stating it invalidates is the exact rot
this file was rewritten to stop. The direction is the durable claim; run the
`wc -c` below when you want the sizes.

This file previously said all three were exported copies and gave three `cp`
commands to refresh them. Two of those commands destroy content:

- `2026-10-13-open-work.md` in this repo is the authored plan. The file at
  `~/.gstack/projects/brio-designer/ceo-plans/` with the same name is a
  `/plan-ceo-review` RECORD whose own header lists the repo file as "Plan under
  review". Copying it over the repo file replaces a 224KB plan with a 7KB
  review of that plan.
- `brio-TODOS.md` in this repo carries the 2026-10-14 entries, including
  both filed P0s (the cycle enumeration freeze and the orphan lane collision).
  The gstack copy is from 2026-10-09, has none of them, and still opens "No
  repo exists yet". Copying it over the repo file deletes every finding this
  ship recorded.

Only the 2026-10-06 plan is a genuine export, and even there the two files
differ by 40 bytes, so `cmp` will report drift.

## Refreshing, safely

There is no safe blanket refresh. Check the direction first, every time:

```sh
# Compare before copying ANYTHING. The bigger, newer file is usually the one
# you want to keep, but look at the content rather than trusting the size.
f=docs/plan/2026-10-13-open-work.md
c=~/.gstack/projects/brio-designer/ceo-plans/2026-10-13-open-work.md
wc -c "$f" "$c" && head -20 "$c"
```

Only the 2026-10-06 plan has a canonical source worth pulling from:

```sh
cp ~/.gstack/projects/radudiaconescu/ceo-plans/2026-10-06-brio-track-designer.md docs/plan/
```

For the other two, edit the repo copy. It is the original.

## Why they are committed at all

The code in this repo is the result of roughly twenty decisions whose reasoning
is not recoverable from the diff: why the residual is a necessary condition
rather than an allocation, why the overlap check compares positions for exact
equality instead of measuring footprints, why inventory stores counts rather
than set manifests, why a piece rather than a connector is the graph node. A
clone with only the source answers none of that.

The gstack review skills (`/plan-ceo-review`, `/plan-eng-review`,
`/plan-design-review`) read and append to their own paths and do not know this
directory exists. That is why the relationship drifted and then inverted
without anybody noticing: the sentence describing it was written once and never
re-measured.
