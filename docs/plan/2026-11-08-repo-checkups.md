# Plan: whole-repo checkups, on a rhythm and after big features

Status: CEO review, Step 0 complete (2026-11-08). Owner's ask: "make sure whole
github repo checkups happen frequently, especially after large feature
implementations", then "evaluate if improving how a repo is maintained is
something that needs to be forked back into gstack".

## The problem

Per-PR CI (`.github/workflows/ci.yml`: typecheck, tests, build, chunk budget)
proves a change works. It never looks at the rest of the repo, so drift between
the rules and the repo builds up between features, unseen. Found on 2026-11-08
alone:

| Drift | Receipt | Found by |
|---|---|---|
| A private file public for weeks, with brand names and item numbers | `CALIBRATION.md` (PR #197) | the owner, by eye |
| Brand names in code and comments, against AGENTS.md "Never name a track brand" | 167 word-bounded lines in 27 tracked files outside `docs/plan`, 15 of them tests; 202 lines counting compound names such as `ikeaFoo` [measured: `git grep -i -w -E` and without `-w` minus "shape", the term list in step 2, 2026-11-08; an earlier 106 was wrong: `git grep -E` ignores `\b`]; some are allowed internal ids (`'IKEA'` in `App.tsx:139`) | this review |
| A rules file pointing at retired skills | CLAUDE.md, fixed in PR #190 | the gstack upgrade notes |
| A private doc a week stale | `CALIBRATION.md` last edited 2026-11-01, the sheet 2026-11-08 | the owner |
| Secret scanning, push protection and Dependabot all off on a public repo | `gh api repos/raduuuuu/ChooChooCAD --jq .security_and_analysis` (2026-11-08) | this review |
| 186 merged branches never deleted | `git branch -r --merged origin/main` [measured]; auto-delete is on now (`delete_branch_on_merge: true`), so these predate it | this review |

Do nothing: the repo is opening to community contributors (the community
pieces plan) whose agents read AGENTS.md and copy what they see. Each unnoticed
violation teaches the next contributor the wrong pattern, and a privacy slip
on a public repo can't be fully undone (git history, forks, caches).

The outcome that matters is not "checkups run often". It is: **drift is found
within a week of landing, and becomes a fix, without the owner having to
remember**.

## Binding decisions this plan must keep

- Community plan CEO D2 (2026-11-08): no API key or subscription token in repo
  secrets; no bot a stranger can start. An AI checkup inside GitHub Actions
  would break it.
- AGENTS.md: brand and source rules (with the printable-design exception);
  photos never committed; don't stack PRs; every test pin's mutation is run.
- Owner rule: merge only on "merge when green"; never `--admin`.

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| C1 approach (owner) | who runs checkups and how findings become fixes | A: GitHub scanners on; deterministic repo-wide checks in CI on a weekly cron and on every push to main (a big push also flags a deep checkup due); findings in one tracking issue; a `/checkup` project skill run by hand | B and C declined | approved | D1 answer 2026-11-08: "CI checks + issue + /checkup by hand (recommended)"; scope: the A column of the C1 grid |
| C2 mode (owner) | review mode | SELECTIVE EXPANSION | — | approved | D2 answer 2026-11-08: "SELECTIVE EXPANSION (recommended)" |
| C3 upstream to gstack (owner) | the owner's second ask | not evaluated | B: deferred; `/checkup` built generic-first here (generic steps apart from this repo's rules), proposed to gstack after four weekly runs with what each check caught and its false alarms | deferred | D3 answer 2026-11-08: "Defer: prove it here, then propose (recommended)" |
| C4 merged-branch cleanup (owner) | 186 merged remote branches [measured] | left | delete them once (auto-delete stops new ones), listed and confirmed first | approved | D4 answer 2026-11-08: "Add: delete them once (recommended)" |
| C5 OpenSSF Scorecard (owner) | research: weekly scorecard is the common baseline | none | deferred: decide after four weekly checkup runs | deferred | D5 answer 2026-11-08: "Defer: decide after four runs (recommended)" |
| C6 content checks on pull requests (owner, Section 1) | checks run after merge only; a contributor PR adding a brand turns main red | A: also a `bun run checkup --content` step in ci.yml's job on pull requests (read-only, no issue writes, message names the rule and the allowlist) | approved | D7 answer 2026-11-08: "Also on pull requests (recommended)". Correction to its pitch: a PR's commits are already public on the PR; checking before merge keeps a slip out of main's history and stops it at review, it does not keep it private. |
| O1 big push lost to concurrency (outside, Codex, High) | GitHub keeps one pending run per group; a newer one replaces it (GitHub docs, concurrency) | each run diffs its own before..after | each run diffs from `lastSeen` (in the state marker) to HEAD, so a replaced run's push is still counted | correction (approved behavior made true) | C1's "a big push flags a deep checkup due" |
| O2 an older /checkup clears newer work (outside, High) | due keeps the oldest sha only | clear when done ≥ due | also keep `latestBig`; clear when done is at or after `latestBig` | correction | C1, as O1 |
| O3 public report names located photos (outside, High) | AGENTS.md: location is reported privately, never in public | report lists the photo | the report, job log and PR check never say "location" or name the file: "a committed image needs the maintainer: run `bun run checkup` locally" | correction (existing rule) | AGENTS.md "Untrusted input" |
| O6 branch dispatch overwrites the report (outside, Medium) | pages.yml:42 documents the same trap | no guard | issue writes only when the ref is main | correction | C1 |
| C7 images policy (outside O4, Medium) | AGENTS.md: photos are never committed; the check allows a location-free JPEG anywhere | A: any committed image or video outside the allowlist is red; listed JPEGs still checked for location, reported only as "needs the maintainer" | approved | D8 answer 2026-11-08: "Any image outside the allowlist fails (recommended)" |
| C8 deep-checkup deadline (outside O5, Medium) | deep checkup due only after a big push; small merges never make it due | A: due after a big push or 30 days after the last deep checkup, whichever first | approved | D9 answer 2026-11-08: "Also due 30 days after the last one (recommended)" |
| C9 settings first (outside O7, Medium) | the scanners don't depend on R1 or the checkup | A: settings, R1, checkup, C4 | approved | D10 answer 2026-11-08: "Settings first (recommended)" |
| R1 brand baseline (repair inside C1) | the brand check can't go green over today's 167 lines (202 with compound names) | — | fix brand comments; list allowed internal ids (saved-layout ids) in an allowlist the check reads | in scope as a repair | C1's approved scope requires a green check |
| R2 schedule liveness (repair inside C1) | research: 60-day auto-disable; failures mail only the cron's last editor | — | the tracking issue records each run's date; every push run flags a scheduled run older than 10 days; /checkup checks it too; workflow_dispatch kept | in scope as a repair | outcome "found within a week" |

## Landscape (research 2026-11-08, via Aside; untrusted, cited)

- Weekly OpenSSF Scorecard via its GitHub Action is the common baseline;
  free for public repos (github.com/ossf/scorecard-action).
- Secret scanning plus push protection is the recommended default for public
  repos (best.openssf.org SCM best practices).
- Dependabot is noisy on daily checks; group updates and go monthly; it pauses
  itself when its PRs are ignored for 90 days (GitHub blog 2026-07-29; GitHub docs).
- Scheduled workflows on a public repo are disabled after 60 days without
  activity, and a failed scheduled run notifies only whoever last edited the
  cron line (GitHub Actions docs, "events that trigger workflows").
- AI whole-repo reviews on a weekly schedule, report-only, are now common
  (Claude Code routines docs; Upkeep).

Layer 3: the conventional answer is "add more scanners". The failure mode is
that nobody reads them. What decides success here is a single place findings
land, and a forcing moment to act (the next "merge when green").

## Dream state

```
  CURRENT STATE                      THIS PLAN                          12-MONTH IDEAL
  per-PR CI on the diff only;  --->  repo-wide checks on a rhythm  --->  every drift class has a check;
  drift found by luck, by eye;       and after big merges; findings      findings land in one place and
  security settings off              in one issue; a /checkup skill      become PRs; contributors' agents
                                                                         follow rules the checks enforce
```

## Answered: C1 (D1, 2026-11-08: A)
Commitment comparison:

Commitment | Source/approval or pending | Current | A | B | C
---|---|---|---|---|---
GitHub settings: secret scanning, push protection, Dependabot (grouped, monthly) | research; pending | off | on | on | on
Repo-wide rule checks (brand allowlist, private files, links) as code | pending | none | weekly cron + big merges | none | weekly cron + big merges
Where findings land | pending | nowhere | one tracking issue, updated in place | the owner's memory | one tracking issue
`/checkup` project skill (gstack audits over the whole repo) | pending | none | run by hand when the issue says one is due | run by hand when the owner remembers | run weekly by a Claude Code cloud routine, and by hand
AI in GitHub Actions / repo secrets | D2 | none | none | none | none (the routine runs on the owner's account)
One-off cleanups (186 merged branches, brand comments) | pending | — | separate tasks | separate tasks | separate tasks

Question: D1 — C1: Who runs the whole-repo checkups, and where do findings go?
Header: Approach
A) CI checks + issue + /checkup by hand (recommended)
B) Settings and a rule only
C) A, plus a weekly AI routine


## Mode: SELECTIVE EXPANSION (D2). HOLD checks on approach A

1. Complexity: 9 new or changed files for the checkup itself
   (`engine/tools/checkup.ts`, its test, `.github/workflows/checkup.yml`,
   `.github/dependabot.yml`, `.github/checkup-allow.json`,
   `.claude/skills/checkup/SKILL.md`, AGENTS.md, `package.json` for
   `bun run checkup`, this plan), plus R1's edits across up to 27 files with
   brand lines [measured], 15 of them tests. No new service. Effort M to L
   (human: ~3 days / CC: ~2.5 h).
2. Minimum for the goal: scanners on; one scheduled workflow; one check script
   with its test; one tracking issue; the `/checkup` skill; AGENTS.md lines.
3. Repairs inside approved scope: R1 (brand baseline) and R2 (schedule liveness).

## Expansion candidates (each asked separately)

- C3 upstream to gstack, C4 merged-branch cleanup, C5 Scorecard.
- Delight scan, noted, not proposed: the tracking issue shows the finding count
  against last run; the big-merge run comments "checkup due" on the merged PR;
  `/checkup --since <commit>`; the brand check suggests the generic name; a
  link check over the published photo guide.

## Accepted scope (C1 A, C4, repairs R1 and R2)

```
  push to main ─┐                                  ┌─ weekly cron (Mon 06:17 UTC) / workflow_dispatch
                ▼                                  ▼
        .github/workflows/checkup.yml (contents: read, issues: write, pull-requests: read; no secrets, no AI)
                │  bun run checkup  (engine/tools/checkup.ts: deterministic, repo-wide)
                │    brand names (allowlist) · private files tracked · unlisted images
                │    · doc links to repo paths · GitHub: stale branches,
                │      aging PRs, needs-info issues past 30 days
                │  big push? (more than 15 files since lastSeen) or 30 days ──▶ "deep checkup due"
                ▼
        the "Repo checkup" tracking issue (pinned, label `checkup`): body rewritten each run
        (date, findings by check, deep-checkup-due line, last deep checkup)
                │  job red on repo-content findings only (a red X on main is seen)
                ▼
        owner runs /checkup (.claude/skills/checkup/SKILL.md) when the issue says it is due
            generic steps: bun run checkup; gstack /health, /cso, /test-audit; docs drift
            against code; the rules file against the repo; then one fix PR per finding class
            this repo's steps: AGENTS.md's brand, source, photo and privacy rules
            ──▶ a comment on the tracking issue: date, what ran, what was found, PRs opened
```

1. GitHub settings, by the owner's `gh` (their sign-in): secret scanning, push
   protection, Dependabot alerts and security updates on;
   `.github/dependabot.yml` for `bun` (the repo has only `bun.lock`) and
   GitHub Actions, monthly, grouped (one PR per ecosystem). The settings are checked by `/checkup` on the owner's sign-in:
   GitHub shows `security_and_analysis` only to admins, which the workflow's
   `GITHUB_TOKEN` is not (surface check, 2026-11-08).
2. `engine/tools/checkup.ts` + `checkup.test.ts` (engine/tools: the vitest node
   glob already covers it; CLAUDE.md forbids widening the glob), `bun run checkup`:
   each check a pure function over injected data (file list and contents,
   GitHub state as JSON), so `checkup.test.ts` runs offline on fixtures; a thin
   CLI gathers the data (`git`, and `gh api` when a token is set). Prints a
   markdown report. Exit 1 on **red** findings: brand, private files,
   location, links, a stale schedule (R2) and an unknown done-sha (step 3),
   all the owner's to fix. **Report-only**: the GitHub-state findings
   (contributors' aging PRs and issues are not the owner's drift, and a main
   that stays red stops meaning anything). Exit 2 on a checker error: the
   workflow still rewrites the issue, with an error line in place of the
   findings, and fails the job.
   - Brand names over `git ls-files` text files, minus `docs/plan/**` (dated
     records). Terms: brio, ikea, lillabo, playtive, hape, thomas, melissa,
     lidl, bigjigs, tesco, case-insensitive. Each line is split into words on
     non-letters and on lower-to-upper case changes (`ikeaFoo` is `ikea foo`),
     then whole words are compared, so `shape` never matches. The split, exactly:
     `line.split(/[^A-Za-z]+|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)`
     (digits and punctuation split; `ikeaFoo`, `IKEAFoo`, `MELISSA_DOUG` and
     `ikea2` all yield the brand word), with each of those as a test fixture.
     AGENTS.md says never name a brand in code, so the term list is stored
     base64-encoded in `checkup.ts` and the test builds its fixtures from the
     decoded list: no file names a brand in plain text, and the checker needs
     no exemption. Only `.github/checkup-allow.json` is exempt by path: its
     entries mirror ids AGENTS.md already allows.
   - Allowed lines in `.github/checkup-allow.json`:
     `{"allow": [{"file": "app/src/App.tsx", "token": "'MELISSA_DOUG'", "why": "saved-layout brand id"}]}`,
     one entry per id: `App.tsx:139`'s `BRAND_ORDER` holds five ids, each
     allowed on its own.
     `token` is a literal substring of the line (not a regex); a brand word on
     a line is allowed only when it falls inside an allowed token of that file.
     Keyed by token, not by term, so a new comment in an allowed file is still
     found. R1 decides per test file: rename where no saved layout depends on
     the name, else allowlist the id.
   - Private files tracked: `photos/`, `CALIBRATION.md`.
   - Images (C7): any committed image or video (png, jpg, jpeg, gif, webp,
     svg, ico, heic, heif, mp4, mov) not listed in the allowlist's `images`
     (`{"file": "app/public/...", "why": "..."}`; the two app assets start it)
     is red. A listed JPEG is still read with `hasLocation`. Public output
     (issue, job summary, logs, the PR check) never says "location" or names
     a located file (O3, AGENTS.md): "a committed image needs the maintainer:
     run `bun run checkup` locally", where the local run names it.
   - Repo-path links in AGENTS.md, CLAUDE.md, CONTRIBUTING.md and
     `.claude/skills/*/SKILL.md` resolve: Markdown links `[..](path)` and
     backticked paths whose first segment is a top-level entry of
     `git ls-files` (folder or root file). A trailing `:N` or `:N-M` is
     stripped; anything with `*`, `<` or `{` (globs, placeholders) is skipped.
   - GitHub state, with a token (`GITHUB_TOKEN` in CI, else `gh auth token`
     locally; none: the GitHub checks are skipped and the report says so):
     branches merged but not deleted, or unmerged with no commit for 30 days
     (Dependabot's branches excluded: Dependabot manages them); PRs open past 14
     days; `piece: needs info` issues past 30 days (community plan R1).
3. `.github/workflows/checkup.yml`: the triggers above; permissions
   `contents: read, issues: write, pull-requests: read`, nothing else (the
   run's state comes from the issue body, not the Actions API); `concurrency:
   checkup` (a push run and a cron run never rewrite the issue together);
   `fetch-depth: 0` (every branch and all history, so merged branches are
   read with `git branch -r --merged origin/main`). A "big push" is more than
   15 files changed between `lastSeen` and HEAD [estimated threshold; tune
   after four runs]; see the state marker below.
   - The tracking issue is found by its `checkup` label; the first run creates
     the label if missing, then the issue; the owner pins it once by hand.
   - Issue writes happen only when the ref is main (O6; pages.yml:42 guards
     the same trap): a `workflow_dispatch` on a branch prints its report to
     the job summary and writes nothing.
   - The body is rewritten each run: date, findings by check, the last
     scheduled run's date, "deep checkup due" with its reason, and the last
     deep checkup. State between runs lives in a hidden marker at the body's end,
     `<!-- checkup-state {"lastSeen": "<sha>", "due": "<sha>|null", "latestBig": "<sha>|null", "lastDeep": "<ISO date>|null", "lastScheduled": "<ISO date>"} -->`.
     Each run measures the change from `lastSeen` to HEAD (O1: GitHub replaces
     a pending run in the group, so a run's own `before..after` can miss a big
     push); more than 15 files sets `due` (kept if already set) and moves
     `latestBig`. A deep checkup is also due 30 days after `lastDeep` (C8). A
     scheduled run updates `lastScheduled`. A body edited by hand without the
     marker starts fresh and says so. A fresh start (the first run, or no
     marker) sets `lastSeen` to HEAD and makes a deep checkup due ("first
     run"); a `lastSeen` that isn't an ancestor of HEAD (history rewritten)
     counts as a big push and is a red finding. The last deep checkup is read from the newest comment on the
     issue that starts `/checkup done at <sha>` **and whose author association
     is OWNER** (a stranger's comment can't clear it). The due line clears when
     `git merge-base --is-ancestor <latestBig> <done>` succeeds (O2: covering
     the newest big push, not the oldest), and `lastDeep` becomes the
     comment's date; a sha the clone
     doesn't know (mistyped, or history rewritten) leaves the line in place and
     is itself a finding.
4. R2 liveness: the issue body carries the last scheduled run's date; every
   push run flags a scheduled run older than 10 days as a finding, and
   `/checkup` checks it too (the cron-editor-only failure email can't hide a
   dead schedule). Limit: the 60-day auto-disable needs 60 days with no
   activity, pushes included, so only `/checkup` or a look at the issue can
   catch that one.
5. `.claude/skills/checkup/SKILL.md`, generic steps first, this repo's rules
   in their own section (so C3's later upstream move is a cut, not a rewrite).
   It ends by commenting `/checkup done at <sha>` on the tracking issue.
6. The owner's rule, worded for the maintainer only (contributors' agents
   read AGENTS.md but have no gstack or admin sign-in): in AGENTS.md's Git
   section, "Maintainer only: when the Repo checkup issue says a deep checkup
   is due, run /checkup before starting the next plan's work."
7. R1: fix the brand-name comments; allowlist the saved-layout ids.
8. C4: delete the 186 merged branches, listed and confirmed first.
9. C6: ci.yml's job gains a `bun run checkup --content` step (content checks
   only: offline, read-only, no issue writes), so a pull request that adds a
   brand name, a private file or an unlisted image fails before merge; the
   message names the AGENTS.md rule and `.github/checkup-allow.json`, and never
   says "location" (O3).

## NOT in scope

- AI in GitHub Actions or any repo secret (D2).
- C3 upstream to gstack: deferred to TODOS (after four weekly runs).
- C5 OpenSSF Scorecard: deferred to TODOS (after four weekly runs).
- Rewriting git history to remove `CALIBRATION.md` (raised in PR #197; main is
  protected against force pushes).

## Order of pull requests (AGENTS.md: don't stack)

1. Settings (C9): the scanners turned on by the owner's `gh`;
   `.github/dependabot.yml`.
2. R1: brand cleanup and `.github/checkup-allow.json` (brand tokens and the
   two app images), so the check starts green.
3. The checkup: `engine/tools/checkup.ts` and its test (each pin's mutation
   run and recorded, CLAUDE.md), `bun run checkup`, the workflow, the C6 step
   in ci.yml, the `/checkup` skill, the maintainer-only AGENTS.md line.
4. C4: the 186 merged branches, listed and confirmed, then deleted.

Each waits for the one before it to merge.

## Temporal interrogation (0I)

```
  HOUR 1 (foundations):   the vitest node glob covers engine/tools (CLAUDE.md: don't widen it);
                          bun runs checkup.ts with no install (pure TS, imports photoExif.ts only);
                          the workflow pins the same bun as ci.yml (1.3.14)
  HOUR 2-3 (core logic):  the word-split regex and its fixtures; the token allowlist; the
                          hidden state marker (parse, write, missing, edited by hand)
  HOUR 4-5 (integration): gh is preinstalled on GitHub runners; author_association OWNER on
                          the done comment; creating the label needs issues: write (granted);
                          ancestry needs fetch-depth: 0
  HOUR 6+ (polish/tests): each pin's mutation run; R1 merged first or main goes red on the
                          checkup's first push
```

Effort: human ~3 days / CC + gstack ~2.5 h (unchanged from the HOLD check).

## Section 1: Architecture

```
  EXISTING                                   NEW
  .github/workflows/ci.yml (push, PR) ──┐    .github/workflows/checkup.yml (push to main, weekly, dispatch)
     typecheck · test · build · budget  │         │ bun engine/tools/checkup.ts
  .github/workflows/pages.yml ──calls───┘         │   ├─ reads: git ls-files, file bytes, .github/checkup-allow.json
                                                  │   ├─ reuses: engine/tools/photoExif.ts hasLocation
                                                  │   └─ GitHub API via gh (branches, PRs, issues) ── report-only
                                                  ▼
                                         "Repo checkup" issue (label checkup) ◀── /checkup done at <sha> (owner)
                                                  ▲                                   ▲
  AGENTS.md (rules) ── maintainer line ───────────┘      .claude/skills/checkup/SKILL.md (owner, by hand)
                                                            generic: bun run checkup, /health, /cso,
                                                            /test-audit, docs drift, settings (admin)
                                                            this repo: AGENTS.md rules
```

- Coupling: checkup.ts depends on photoExif.ts (one pure function) and on the
  rules in AGENTS.md (by content, not by import). OK.
- Single points of failure: the scheduled trigger (R2 covers it); the one
  issue (found by label, recreated if missing). OK.
- Rollback: disable the workflow (`gh workflow disable checkup.yml`) or revert
  its PR; nothing else depends on it. Minutes. OK.
- Value test (the tracking issue is an artifact about the work): consumer, the
  owner (explicit request); it changes what gets fixed next; it is the
  smallest useful version (one issue, no dashboard); it retires if the checks
  move upstream into gstack (C3) or if four runs find nothing. OK.
- **Resolved (C6, D7: A):** the checks ran only after merge. A contributor's
  PR that adds a brand name merges, then main turns red. The content checks
  (brand, private files, location, links) are cheap and offline, and could
  also run on pull requests in ci.yml, before the merge.

## Answered: C6 (D7, 2026-11-08: A)
Commitment comparison:

Commitment | Source/approval or pending | Current | A | B
---|---|---|---|---
Content checks after merge (push, weekly) | C1 approved | yes | yes | yes
Content checks on every pull request, in ci.yml, before merge | pending | no | yes (read-only job step) | no
GitHub-state checks and issue writes | C1 approved | push and weekly only | unchanged | unchanged

Question: D7 — C6: Also run the content checks on pull requests, before merge?
Header: PR checks
A) Also on pull requests (recommended)
B) After merge only

## Section 2: Error & Rescue Map

```
  METHOD/CODEPATH              | WHAT CAN GO WRONG                          | CLASS
  -----------------------------|--------------------------------------------|---------------------
  gatherFiles (git ls-files)   | git missing, not a repo                    | CheckerError (exit 2)
  readText                     | binary file (NUL byte), >2MB file          | skipped, counted in the report
  loadAllowlist                | missing file / invalid JSON / bad entry    | missing: empty list; invalid: CheckerError naming the file and entry
  hasLocation (photoExif)      | a .jpg that isn't a JPEG                   | finding "not a JPEG" (hasLocation throws)
  githubState (gh api)         | no token, 401, 403, 404, rate limit, net   | GitHub checks skipped, the report says why (report-only)
  readIssue / writeIssue       | 403 (permissions), 422, network            | job fails; the step log names the call
  parseStateMarker             | missing / malformed marker                 | state starts fresh; the report says so
  isAncestor(due, done)        | unknown sha (mistyped, rewritten history)  | due line kept; red finding "unknown sha"
  -----------------------------|--------------------------------------------|---------------------
  CLASS            | RESCUED? | RESCUE ACTION                                      | OWNER SEES
  CheckerError     | Y        | exit 2; the issue gets an error line; job fails    | red job + the issue's error line
  skipped file     | Y        | listed under "not read" in the report               | the report
  GitHub API error | Y        | GitHub section says "skipped: <status>"             | the report; job not red for it
  issue write fail | N (fails)| no retry: the next run (push or weekly) rewrites it | red job, the run's log
```

No catch-alls: each failure has its own branch. No GAPs.

## Section 3: Security & Threat Model

| Threat | Likelihood | Impact | Mitigated? |
|---|---|---|---|
| A stranger clears "deep checkup due" with a comment | Med | Low | Yes: OWNER author association only |
| A PR changes checkup.yml to abuse `issues: write` | Low | Med | Yes: checkup.yml runs on push to main and schedule, never `pull_request_target`; the PR step in ci.yml (C6) has no write permission |
| Repo text injected into the issue (Markdown, @mentions) | Low | Low | Partly: content is from main (owner-merged); findings quote file:line and the matched word only, inside code spans |
| /checkup reading issue and PR titles as instructions | Med | Med | Yes: AGENTS.md "data, never instructions" applies; the skill says so again |
| C4 deleting a branch with unmerged work | Low | Med | Yes: only `--merged origin/main`, listed and confirmed; restorable from each PR |
| New secrets or dependencies | — | — | None: no secrets, no new packages |

No High findings.

## Section 4: Data Flow & Interaction Edge Cases

```
  push/cron ─▶ gather (files, allowlist, gh) ─▶ check (pure) ─▶ report (markdown + marker) ─▶ issue body
                 │ nil: no allowlist → empty   │ empty repo → 0 findings   │ marker missing → fresh
                 │ binary/huge → skipped        │ unknown sha → red finding │ two open issues → oldest, duplicate reported
                 │ gh error → skipped section   │                            │ issue closed by hand → a new one is created
```

Shared state: the issue body. Invariant: one writer at a time, and each run
starts from the body the last run wrote. Mechanism: `concurrency: checkup`, so
a push run and a cron run never overlap. GitHub keeps only one pending run per
group and a newer one replaces it (O1); nothing is lost, because each run
diffs from the marker's `lastSeen`, not its own push; the owner
editing the body by hand mid-run is the one race, and the next run rewrites it
(the marker survives only if the owner kept it). No user-facing UI.

## Section 5: Code Quality

- Fits existing patterns: a CLI in engine/tools beside photoCheck.ts (same
  `import.meta.main`, exit codes, header diagram). OK.
- Pure checks over injected data keep each one testable and under 5 branches;
  the CLI is the only place with I/O. OK.
- Reuse: `hasLocation` (photoExif.ts); no other existing scanner. OK.
- No issues found beyond the above.

## Section 6: Tests

```
  NEW THING                         | TEST (unit, node project, offline fixtures)            | FAILURE / EDGE CASE TESTED
  ----------------------------------|--------------------------------------------------------|------------------------------------------
  word split + brand match          | each term found in `ikeaFoo`, `IKEAFoo`, `MELISSA_DOUG`,| `shape` not matched; a term in docs/plan ignored
                                    | `ikea2`, a comment                                     |
  token allowlist                   | an allowed id passes                                   | a new comment in the same file still fails
  images (C7) / private files       | an unlisted PNG fails; a listed JPEG with GPS fails     | a listed image passes; no public text says "location"
  state marker (O1, O2, C8)         | a replaced run's push still counted from lastSeen       | done at the older big push leaves due; 30 days sets due
  main-only writes (O6)             | a branch dispatch writes nothing                        | —
  first run / rewritten history     | no marker: lastSeen = HEAD, deep checkup due            | lastSeen not an ancestor: big push + red finding
  workflow text (node test, read    | checkup.yml: permissions exactly contents read, issues  | each pinned line's mutation run (CLAUDE.md's
  as text, like CLAUDE.md's CSS)    | write, pull-requests read; concurrency group; issue     | CSS-as-text pattern)
                                    | writes guarded by ref main; ci.yml's step has no write  |
  repo-path links                   | a dead Markdown link fails                             | `:N` stripped; globs and <placeholders> skipped
  GitHub state (injected JSON)      | a merged undeleted branch, a 15-day PR reported         | Dependabot branches ignored; report-only exit
  state marker                      | round trip                                             | missing or malformed starts fresh; second big push keeps older due
  due clearing (ancestry injected)  | owner's done at/after due clears                       | a non-owner comment ignored; unknown sha is a red finding
  exit codes                        | red findings exit 1, report-only exit 0                | CheckerError exits 2
  --content mode (C6)               | GitHub checks not run, no issue write                  | —
```

Each pin records its mutation, run (CLAUDE.md). Assertions: exact finding
lists, not counts. no_claim: the workflow's YAML (triggers, permissions,
concurrency) and the issue writes against real GitHub; verified once by a
`workflow_dispatch` run after merge, recorded in the PR. Flakiness: none (no
clock: "now" is injected; no network). 2am-Friday test: a fixture repo with one
of each finding class gives exactly that report.

## Section 7: Performance

`git ls-files` text scan of this repo, about 1,500 files [estimated]: a few
seconds at most. The PR step adds that to ci.yml's job. GitHub calls: a handful
per run, paginated. No issues found.

## Section 8: Observability

- The tracking issue is the dashboard; the job summary carries the same report
  per run.
- Broken-ness signals: a red job on main (red findings or a checker error);
  the last scheduled run's date in the issue (R2).
- Runbook, in the `/checkup` skill: red job → open the issue, fix or allowlist
  with a reason; schedule stale → re-enable the workflow
  (`gh workflow enable checkup.yml`).
- No issues found.

## Section 9: Deployment & Rollout

Order: settings, then R1, then the checkup (and C6's step), then C4 (see
"Order of pull requests"). After the checkup PR merges: run it once by
`workflow_dispatch`, check the issue it creates, pin it. Rollback: disable the
workflow, revert the PR; the C6 step reverts with ci.yml. C4's deletions are
the one hard-to-undo step: restorable per branch from each PR page. No issues
found.

## Section 10: Long-Term Trajectory

- Debt: the allowlist can grow into a way around the rule; each entry carries
  a reason, and `/checkup` reviews the list.
- The term list needs new names as other systems are added (the brand shelf
  in App.tsx).
- Reversibility: 4/5 (C4 is the one step that is harder to undo).
- Next phase: C3 upstream to gstack and C5 Scorecard after four weekly runs
  (TODOS). The generic-first `/checkup` keeps C3 a cut, not a rewrite.
- Retrospective on the cherry-picks: C4 is what makes the stale-branch check
  readable; deferring C5 costs nothing the scanners don't cover.

## Section 11: Design & UX

SKIPPED (no UI scope).

## Outside voice (Codex, gpt-6-astra, plan review, completed)

7 findings (3 High, 4 Medium); full output kept in the review session.
1. High: concurrency replaces a pending run, losing a big push. → O1, corrected.
2. High: an older /checkup done clears newer unaudited work. → O2, corrected.
3. High: the public report names located photos, against AGENTS.md. → O3, corrected.
4. Medium: the photo check allows location-free JPEGs and PNGs; AGENTS.md says photos are never committed. → C7, D8: A.
5. Medium: small merges never make a deep checkup due. → C8, D9: A.
6. Medium: a branch dispatch can overwrite the canonical report (as pages.yml:42). → O6, corrected.
7. Medium: settings wait behind unrelated PRs. → C9, D10: A.

Approval readiness: PASS. Checked rows: C1 (D1), C2 (D2), C3 (D3, deferred),
C4 (D4), C5 (D5, deferred), C6 (D7), C7 (D8), C8 (D9), C9 (D10), documents
(D6); corrections O1, O2, O3, O6 and repairs R1, R2 sit inside C1's approved
behavior or an existing AGENTS.md rule. No unanswered rows.

## Reality rows

REALITY: premise-table pass 6 drift claims each with a command or file receipt (problem table); 0 unverified after the 167-line re-measure docs/plan/2026-11-08-repo-checkups.md:18
REALITY: already-done pass no checkup, scorecard, dependabot or stale-branch work on main since 2026-11-01 (2 grep hits, both an unrelated library audit) .github/workflows/ci.yml:47
REALITY: surface-check finding GITHUB_TOKEN can't read security_and_analysis (admin only): moved to /checkup; Dependabot needs `bun`, not npm; codex, gh and git merge-base verified .github/workflows/ci.yml:79
REALITY: binding-decisions pass community D2 (no AI or secrets in GitHub) kept: no AI in Actions; AGENTS.md rules kept AGENTS.md:18
REALITY: numbers pass 167 lines / 27 files / 15 tests [measured: git grep -i -w -E]; 186 merged branches [measured]; 2 committed images [measured]; 15-file threshold and ~1,500 files [estimated] docs/plan/2026-11-08-repo-checkups.md:18
REALITY: deferred-asks pass no linked issue; the owner's two asks are covered (checkups: C1; gstack: C3 deferred with a trigger) docs/plan/generic-TODOS.md:1053
REALITY: pr-count pass four PRs in order (settings, R1, checkup, C4), each waits for the last (AGENTS.md: don't stack) AGENTS.md:79

## What already exists

- `ci.yml` (per-PR tests): reused, gains the C6 step.
- `pages.yml`'s main-only guard: the model for O6.
- `photoExif.ts` `hasLocation`: reused for listed JPEGs.
- `photoCheck.ts` CLI shape (header diagram, exit codes): copied in form.
- gstack `/health`, `/cso`, `/test-audit`, `/document-release`: run by
  `/checkup`, not rebuilt.
- GitHub secret scanning, push protection, Dependabot: native, switched on.

## Dream state delta

After this plan: every drift class found on 2026-11-08 has a check (brand,
private files, images, links, stale branches, settings, schedule liveness),
findings sit in one issue, and a deep checkup falls due monthly or after a big
push. Still short of the ideal: findings don't open fix PRs on their own (the
owner runs /checkup), and docs-versus-behavior drift is caught only by the
deep checkup.

## Failure Modes Registry

```
  CODEPATH            | FAILURE MODE                       | RESCUED? | TEST? | USER SEES?               | LOGGED?
  --------------------|------------------------------------|----------|-------|--------------------------|--------
  scheduled trigger   | auto-disabled / silently not firing | Y (R2)   | Y     | finding in the issue     | Y
  concurrency         | pending run replaced                | Y (O1)   | Y     | push still counted       | Y
  issue write         | 403 / 422 / network                 | N (fail) | N     | red job                  | Y
  checker             | git missing, bad allowlist JSON     | Y        | Y     | red job + issue error    | Y
  GitHub API          | token missing, rate limit           | Y        | Y     | "skipped: <status>"      | Y
  due clearing        | stranger comment, unknown sha       | Y        | Y     | due stays / red finding  | Y
  located image       | public text names it                | Y (O3)   | Y     | "needs the maintainer"   | Y
  branch dispatch     | overwrites main's report            | Y (O6)   | Y     | job summary only         | Y
```

0 CRITICAL GAPS (the issue-write failure is visible as a red job).

## Scope Expansion Decisions

- Accepted: C4 merged-branch cleanup (D4); C6 PR checks (D7); C7 image
  allowlist (D8); C8 30-day deadline (D9); C9 settings first (D10).
- Deferred: C3 upstream to gstack (D3); C5 Scorecard (D5).
- Skipped: none.

## Stale Diagram Audit

`ci.yml` and `pages.yml` header comments: still accurate (C6 adds one step;
its comment goes in that PR). AGENTS.md has no diagrams. 0 stale.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~1h / CC: ~10min)** — github — scanners on; `.github/dependabot.yml` (bun, actions; monthly, grouped)
  - Surfaced by: problem table (scanners off); C9 (D10)
  - Files: .github/dependabot.yml
  - Verify: `gh api repos/raduuuuu/ChooChooCAD --jq .security_and_analysis` shows enabled; Dependabot's first run in the Insights tab reads `bun.lock` (the `bun` ecosystem is unverified here; if it isn't supported, say so in the PR and keep only GitHub Actions updates)
- [ ] **T2 (P1, human: ~1d / CC: ~45min)** — repo — R1 brand cleanup and `.github/checkup-allow.json` (brand tokens, two images)
  - Surfaced by: problem table (167 lines); R1; C7
  - Files: up to 27 files with brand lines, .github/checkup-allow.json
  - Verify: `bun run checkup --content` (T3) exits 0; `bun run test` green
- [ ] **T3 (P1, human: ~1.5d / CC: ~1.5h)** — engine-tools + github — `checkup.ts`, its test, `bun run checkup`, `checkup.yml`, the C6 step in ci.yml
  - Surfaced by: C1, C6, C7, C8, O1, O2, O3, O6, R2; Sections 2, 4, 6
  - Files: engine/tools/checkup.ts, engine/tools/checkup.test.ts, engine/tools/checkupWorkflow.test.ts, package.json, .github/workflows/checkup.yml, .github/workflows/ci.yml
  - Verify: vitest with each pin's mutation run (including the workflow-text test); one `workflow_dispatch` on main creates the issue; a branch dispatch writes nothing
- [ ] **T4 (P1, human: ~3h / CC: ~20min)** — skill + docs — `/checkup` skill (generic steps apart) and the maintainer-only AGENTS.md line
  - Surfaced by: C1, C3 (generic-first), Section 8 runbook
  - Files: .claude/skills/checkup/SKILL.md, AGENTS.md
  - Verify: a docs test pins the AGENTS.md line and the skill's link (mutation run); one /checkup run posts `/checkup done at <sha>`
- [ ] **T5 (P2, human: ~30min / CC: ~10min)** — github — delete the 186 merged branches (C4)
  - Surfaced by: C4 (D4)
  - Files: none
  - Verify: `git branch -r --merged origin/main` lists only main; the stale-branch check reports none

## Eng pass (manual, 2026-11-08; not a recorded /autoplan eng review)

The owner chose a hand-run eng-checklist pass over /autoplan (D2 of that run:
its scope scan wanted design and DX phases, about 14 h, for a plan whose only
App.tsx change is comments). Nine findings; corrections applied in place:

1. The diagram and step 3 still measured a big push by `before..after`
   (superseded by O1) and said "photos with location" (O3). Fixed.
2. Item 9 (C6) said a located photo fails; under C7 any unlisted image does,
   and public text never says location. Fixed.
3. Section 4 claimed runs queue without replacement; GitHub replaces a pending
   run (O1). Fixed: the `lastSeen` diff is what makes it safe.
4. The first run (no marker) was undefined: now `lastSeen` = HEAD and a deep
   checkup is due. Also covers C8's empty `lastDeep`.
5. A `lastSeen` that isn't an ancestor of HEAD: now a big push and a red finding.
6. Merged branches are read with `git branch -r --merged` (full fetch), not the API.
7. The workflow YAML had no test: a node test now reads checkup.yml and
   ci.yml as text and pins the permissions, the concurrency group, the main-only
   guard and the C6 step's read-only scope (CLAUDE.md's CSS-as-text pattern).
8. Dependabot's `bun` ecosystem is unverified here: T1's verify step checks it,
   with a fallback stated.
9. Checked, no change: `lastScheduled` is set only by cron runs, so the R2
   finding compares against the right date.

Architecture, error map, security and performance otherwise hold as written in
Sections 1 to 7. Not covered by this pass: a recorded eng review (the dashboard
still says eng review required).

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | brand drift 167 lines; scanners off; 186    |
  |                      | merged branches; no scheduled checks        |
  | Step 0               | C1 A; C3, C5 deferred; C4 added             |
  | Section 1  (Arch)    | 1 issue (C6, resolved)                      |
  | Section 2  (Errors)  | 8 error paths mapped, 0 GAPS                |
  | Section 3  (Security)| 6 threats, 0 High severity                  |
  | Section 4  (Data/UX) | 7 edge cases mapped, 0 unhandled            |
  | Section 5  (Quality) | 0 issues found                              |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 0 gaps found                                |
  | Section 9  (Deploy)  | 1 risk flagged (C4 hard to undo)            |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 2           |
  | Section 11 (Design)  | SKIPPED (no UI scope)                       |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 8 rows, 0 CRITICAL GAPS                     |
  | Failure modes        | 8 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | 2 items (C3, C5)                            |
  | Scope proposals      | 8 proposed, 6 accepted (EXP + SEL)          |
  | CEO plan             | written                                     |
  | Outside voice        | codex: completed, 7 findings, 7 resolved    |
  | Lake Score           | 1/1 recommendations chose complete option   |
  | Diagrams produced    | 5 (architecture, data flow, dream state,    |
  |                      | error map, temporal)                        |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows, 0 unverified                      |
  +====================================================================+
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 8 proposals, 6 accepted, 2 deferred |
| Outside Review | codex (plan review, automatic) | Independent 2nd opinion | 1 | completed | 7 findings; 7 resolved; 0 unresolved |
| Eng Review | `/autoplan` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | no UI scope |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex (gpt-6-astra), plan-review phase, completed: 7 findings (3 High, 4 Medium), all resolved (4 corrections, 3 answered D8 to D10).
- **CROSS-MODEL:** the native review and codex agreed on the shape (CI checks plus a manual deep checkup); codex found what the native review and its three spec passes missed: the concurrency drop, the older-done clearing, public photo naming and the branch-dispatch overwrite.
- **ENG PASS:** manual eng-checklist pass, 9 findings, all corrected in place; not a recorded eng review.
- **VERDICT:** CEO CLEARED; eng review required.

NO UNRESOLVED DECISIONS
