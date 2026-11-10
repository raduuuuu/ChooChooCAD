# Review: one repository or several, and a woodentrain.world organisation

/plan-ceo-review, 2026-11-10. Depth: strategy only. Mode: HOLD SCOPE (the
owner's answer to the mode question, 2026-11-10). The owner's question: "Is
there an advantage in having a monorepo or should we move to a modular
architecture (e.g. the draw skill in a separate repo), Also would it be better
if we create a Woodentrain.world github organization and choochoocad becomes a
project there."

## Step 0 evidence

### 0A. Premise
- Splitting a repository pays off when parts have different owners, release
  rhythms or outside users. Today: one owner (`gh` lists 2 contributors, the
  owner and the Actions bot), 1 star, 0 forks, every issue the owner's.
- An organisation pays off in a name that matches the site, a home not tied to
  a personal account, room for more repositories and shared ownership later.
- Do-nothing cost: none for the structure; for the organisation, it grows with
  every outside link to `github.com/raduuuuu/ChooChooCAD`, and the contributor
  flow went public today (#251), so the links start now.

### 0B. What exists (receipts)
- The drawing skill is the engine's client, not a separate product:
  `.claude/skills/draw-piece/SKILL.md` names `engine/tools/photoMeasure.ts`,
  `photoCrop.ts`, `engine/src/parts/schema.ts`, `engine/data/library.ts`,
  `engine/data/photoReadings.ts`, `app/src/shareLink.ts`, and runs the engine's
  tests on a contributor's diff. The brief (`app/public/contributor-brief.md:66`)
  clones this repository to run the same tools.
- One test keeps the skill, the brief, the labels and the issue forms in step
  (`app/test/contributing.test.ts`): today a change to the measuring rules, the
  skill and the brief is one commit and one CI run.
- The account name appears in 23 files (the brief's clone line, `briefLink.ts:31`
  `NEW_ISSUE`, `.github/ISSUE_TEMPLATE/config.yml:5`, CONTRIBUTING, AGENTS, the
  pinned issue). `app/public/CNAME` holds `woodentrain.world`; Pages deploys from
  `.github/workflows/pages.yml`. `app/src/linkFragment.ts:37` `GOATCOUNTER_CODE`
  is a GoatCounter site code, not a GitHub name.
- Already planned modular piece: the generic steps of `/checkup` go to gstack
  after four weekly and one deep run (`docs/plan/generic-TODOS.md`, C3).
- Free names on GitHub (2026-11-10, `gh api users/<name>` 404): `woodentrain`,
  `woodentrain-world`, `woodentrainworld`, `choochoocad`.

### 0C. Dream state
```
  CURRENT                          THIS DECISION                   12-MONTH IDEAL
  one repo under a personal  --->  keep one repo; decide the  ---> the app, its engine, the brief and
  account, flow just public        home before links spread        the skill versioned together, under a
                                                                   home named for the product, with
                                                                   other people able to own it too
```

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| R1 repository structure (owner) | 0B: the skill and the brief call the engine's tools and tests; one test holds them in step | one repository | A: keep one; B: move the skill to its own repository; C: publish the engine as a package, app and skill depend on it | approved | D1 answer 2026-11-10: "Keep one repository (recommended)"; scope: no split of the skill or the engine |
| R2 GitHub home (owner) | 0A, 0B: 23 files name the account; the flow went public today | `raduuuuu/ChooChooCAD` | A: create an organisation and transfer now; B: later, when a second person or repository needs it; C: stay | approved | D2 answer 2026-11-10: "Organisation now (recommended)"; scope: create the organisation, transfer, update the links, brief version 2, verify the domain on the organisation |
| R3 organisation name (owner, Section 1) | free on 2026-11-10: `woodentrain`, `woodentrain-world`, `woodentrainworld`, `choochoocad` | none | A: `woodentrain`; B: `woodentrain-world`; C: `choochoocad` | approved | D3 answer 2026-11-10: "woodentrain (recommended)"; scope: the organisation's name |

## currentDecision (R1)
Commitment comparison:

```text
Commitment                         | Source        | Current     | A keep one        | B skill apart              | C engine as package
One commit changes rule+skill+test | 0B            | yes         | yes               | no: two PRs, two CIs       | no: publish, then bump
Brief clones one thing             | brief:66      | yes         | yes               | yes (app) + skill separate | yes
Skill runs the engine's tests      | SKILL.md      | in place    | in place          | needs the app repo too     | needs a pinned version
Versioning                         | -             | the commit  | the commit        | two, kept in step by hand  | semver for the engine
Reuse outside ChooChooCAD          | -             | no need yet | no                | no gain (skill is specific)| yes, if anyone wants it
Effort                             | -             | -           | S (none)          | M                          | L
```

Question: D1 — R1: Keep one repository, or split the drawing skill (or the engine) out?
Header: Structure
A) Keep one repository (recommended)
The skill, the brief, the engine and the app stay together. Effort S (no work), risk low. ✅ A rule change, the skill and their tests land in one commit and one CI run. ✅ Contributors' Claude clones one thing and runs everything. ❌ Nothing is reusable by another project without copying.
B) Move the drawing skill to its own repository
The skill lives apart and points at ChooChooCAD. Effort M, risk medium. ✅ The skill's history is separate. ✅ Could be installed on its own. ❌ Every rule change becomes two PRs kept in step by hand, and the test that holds them together goes.
C) Publish the engine as a package
Engine in its own repository on npm; app and skill depend on a version. Effort L, risk medium. ✅ Another app could use the measuring tools. ✅ Clear engine API. ❌ A release step for every change, and nobody needs the engine elsewhere yet.

## currentDecision (R2)
Commitment comparison:

```text
Commitment                       | Source      | Current            | A org now                   | B org later                 | C stay
Name matches the site            | 0A          | no                 | yes                         | later                       | no
Old links keep working           | GitHub      | -                  | redirects (transfer)        | redirects, more links to fix| -
Links to update                  | 0B (23)     | -                  | 23 files + brief v2 + #194  | more by then                | none
Pages + woodentrain.world        | pages.yml   | personal account   | re-check custom domain;     | same, later                 | unchanged
                                 |             |                    | verify domain on the org    |                             |
Room for more repos / co-owners  | 0A          | personal           | yes                         | later                       | no
Effort                           | -           | -                  | S (about an hour)           | S, growing                  | S (none)
```

Question: D2 — R2: Create a woodentrain.world organisation and move ChooChooCAD there, and when?
Header: GitHub home
A) Organisation now (recommended)
Create the organisation, transfer the repository, update the 23 links, bump the brief to version 2, verify woodentrain.world on the organisation. Effort S, risk low. ✅ Cheapest moment: the flow went public today, almost no outside links yet. ✅ GitHub redirects old git and web links after a transfer. ❌ An hour of link updates and a Pages domain re-check, and a redirect breaks if a new repository ever takes the old name.
B) Organisation later
Wait until a second person or repository needs it. Effort S now, risk low. ✅ Nothing to do today. ✅ Decide with a real need in hand. ❌ Every week the brief and issues spread more links to the personal URL.
C) Stay on the personal account
Keep `raduuuuu/ChooChooCAD`. Effort S (no work), risk low. ✅ No change at all. ✅ Nothing to re-verify. ❌ The product's home stays tied to one person's account and name.

## currentDecision (R3)
Commitment comparison:

```text
Commitment                   | Source | A woodentrain           | B woodentrain-world      | C choochoocad
Matches the site             | 0A     | its stem                | in full                  | the app, not the site
Short in links and clones    | -      | yes                     | longer                   | yes
Room for other products      | 0C     | yes (any wooden-train)  | yes                      | ties the org to one app
Pages subdomain for www      | DNS    | woodentrain.github.io   | woodentrain-world.github.io | choochoocad.github.io
```

Question: D3 — R3: What should the organisation be called?
Header: Org name
A) woodentrain (recommended)
github.com/woodentrain/ChooChooCAD. Effort S, risk low. ✅ Short, and the site's own name minus its ending. ✅ Fits any later wooden-train project, not only this app. ❌ Doesn't spell out the .world domain.
B) woodentrain-world
github.com/woodentrain-world/ChooChooCAD. Effort S, risk low. ✅ Matches the domain exactly. ✅ Unmistakable. ❌ Longer in every link and clone line.
C) choochoocad
github.com/choochoocad/ChooChooCAD. Effort S, risk low. ✅ Matches the app's name. ✅ Short. ❌ Ties the organisation to one app, and reads oddly doubled in links.

## Advice and review (HOLD SCOPE, strategy depth)

**One repository (R1).** The drawing skill and the brief are the engine's
clients: they run its photo tools, read its schema and library, and run its tests
on a contributor's diff, and one test keeps the skill, the brief, the labels and
the forms in step. Split them and each rule change becomes coordinated pull
requests across repositories with nothing checking they still agree; nobody
outside needs the engine or the skill on their own. Splitting is reversible later
(a `git subtree split` keeps history) if a second consumer appears. The one piece
already headed out is right to go: `/checkup`'s generic steps to gstack, once the
runs prove them (generic-TODOS, C3).

**An organisation now, `woodentrain` (R2, R3).** Cheapest the day the
contributor flow went public; GitHub redirects git and web links after a
transfer.

### Section 1: Architecture
```
  github.com/woodentrain (org)                 woodentrain.world (DNS, unchanged registrar)
    └─ ChooChooCAD (transferred: issues, PRs,    apex A ──▶ 185.199.108-111.153 (GitHub Pages; unchanged)
       labels, Actions, Pages config move)       www CNAME ──▶ raduuuuu.github.io  ← must become woodentrain.github.io
    └─ (later) any other wooden-train repo
  github.com/raduuuuu/ChooChooCAD ──redirect──▶ github.com/woodentrain/ChooChooCAD (until a repo takes the old name)
```
- **WARNING:** `www.woodentrain.world` is a CNAME to `raduuuuu.github.io`; after
  the transfer it must point at `woodentrain.github.io`, or www stops serving.
- **WARNING (corrected after the outside review):** domain verification is
  exclusive. Verifying woodentrain.world on the organisation releases it from
  sites owned by other accounts, and fails if the personal account already
  holds the verification. So the order matters (Section 9): check whether the
  personal account verified it; transfer first; then move the verification to
  the organisation; rollback moves it back.
- **WARNING (corrected):** with Actions deployments, GitHub ignores
  `app/public/CNAME`; the custom domain lives in the repository's Pages
  settings. Record them before the move and re-set the custom domain after it
  if the transfer or the verification detaches it.
- OK: the apex A records are GitHub's shared Pages addresses;
  `GOATCOUNTER_CODE` is GoatCounter's, unaffected.

### Section 2: Error and rescue map (capability level)
| What can fail | When | Rescue | Who sees it |
|---|---|---|---|
| www stops serving | after transfer, before the DNS change | change the www CNAME first thing; apex keeps serving | visitors to www |
| HTTPS certificate re-issued | Pages re-provisions after the move | wait (minutes); keep "Enforce HTTPS" | brief certificate warning |
| A contributor's draft-1 brief clones the old URL | anytime | git redirect | nobody |
| Someone creates `raduuuuu/ChooChooCAD` again | ever | never reuse the name; note it in AGENTS.md | every old link |
| Workflows or secrets referencing the owner | after transfer | none found in `.github/workflows` (no owner in them); re-check Pages and Actions settings on the org | CI |
Implementation owner must prove: the live site, www, HTTPS and a prefilled
drawn-piece link all work on the new home. DNS and the HTTPS certificate can
take up to 24 hours (GitHub's docs), so judge by those checks passing, not a
clock: roll back only for a failure that settling won't fix (a refused
verification, a detached domain that won't re-attach).

### Section 3: Security
- Domain takeover (Med likelihood if forgotten, High impact): mitigated by
  verifying the domain on the org (Section 1).
- Org access: enable two-factor for members; the owner alone at first.
- No new secrets; Actions permissions on the org default to read-only tokens:
  check `pages.yml`'s `permissions` still apply.

### Section 4: Data flow and edge cases
- Open PRs, branches and issues move with the repository (0 open PRs today).
- Local clones keep pushing through the redirect; update `origin` anyway
  (`git remote set-url origin https://github.com/woodentrain/ChooChooCAD.git`).
- The brief's old-copy check reads the clone's own path, unaffected.

### Section 5: Code quality
- 23 files carry `github.com/raduuuuu/ChooChooCAD`: one search-and-replace,
  plus `NEW_ISSUE` in `engine/tools/briefLink.ts:31` and the forms' contact link.
- The brief's text changes, so its version goes to 2 with its hash (the test
  enforces it).

### Section 6: Tests
- Existing: `contributing.test.ts` (brief hash, forms, labels), `briefLink.test.ts`
  (`NEW_ISSUE`). Add a test that no tracked file links to the old GitHub
  repository (`github.com/raduuuuu/`), outside `docs/plan/` history and the
  AGENTS.md never-reuse rule; `GOATCOUNTER_CODE` is not a GitHub link and stays.
  Mutation: leave one link unchanged.

### Section 7: Performance
No issues found: no runtime change.

### Section 8: Observability
- After the move: the Pages deploy run green; `curl -I` on the apex, www and
  `/contributor-brief.md`; one prefilled drawn-piece link opened.

### Section 9: Deployment and rollout (the runbook)
0. Record: the repository's Pages settings (custom domain, HTTPS), whether the
   personal account has woodentrain.world verified (Settings, Pages), the DNS
   records.
1. Create the organisation `woodentrain` (owner, by hand; free plan; two-factor on).
2. Transfer `raduuuuu/ChooChooCAD` to `woodentrain` (Settings, Danger zone).
3. Change the www CNAME to `woodentrain.github.io`.
4. On the moved repository, check Pages' custom domain is still woodentrain.world;
   re-set it if detached.
5. Move the verification: remove it from the personal account if it holds it,
   then verify woodentrain.world on the organisation (DNS TXT record).
6. One PR: the 23 links, `NEW_ISSUE`, brief version 2, the no-old-repo-link test,
   AGENTS.md's "never reuse the old name", the pinned issue's links.
7. Update local `origin`; check the apex, www, HTTPS, `/contributor-brief.md`
   and a prefilled drawn-piece link, allowing up to 24 hours for DNS and the
   certificate.
Rollback: transfer back to `raduuuuu`, restore the www CNAME, move the
verification back to the personal account, re-set the custom domain; allow the
same settling time.

### Section 10: Long-term
- Reversibility 4/5 (a transfer back works, with the verification moved back; links updated twice).
- Knowledge: the runbook above; AGENTS.md names the home and the never-reuse rule.
- Path: more repositories (a printed-parts repo, a gstack checkup repo if not
  upstreamed) fit under the organisation without another move.

### Section 11: Design and UX
SKIPPED (no UI scope).

## NOT in scope
- Splitting the skill, the brief or the engine out (R1: declined).
- Publishing the engine on npm (R1: declined).

## Outside voice (codex, 2026-11-10): 4 findings, all corrections to the draft runbook
1. High: domain verification is exclusive and can fail or detach the live site;
   the runbook now orders it after the transfer and the rollback moves it back.
2. Medium: Actions deployments ignore `app/public/CNAME`; the runbook records
   and re-sets the custom domain instead.
3. Medium: the "no old owner" test would trip on the GoatCounter code; it now
   checks GitHub repository links only.
4. Medium: DNS and HTTPS can take up to 24 hours; acceptance is by checks, not
   a one-hour clock.
None reopened R1 to R3.

## Implementation tasks
- [ ] **T1 (P1, human: ~1h / CC: ~10min + owner's clicks)**: the move, Section 9 steps 0 to 5 (the owner creates the organisation, transfers, and changes DNS and the verification; GitHub settings and DNS are the owner's).
- [ ] **T2 (P1, human: ~1h / CC: ~15min)**: one PR, Section 9 step 6: the 23 links, `NEW_ISSUE`, brief version 2, the no-old-repo-link test with its mutation, AGENTS.md's never-reuse rule, the pinned issue.
- [ ] **T3 (P2, human: ~30min / CC: ~5min)**: Section 9 step 7's checks, recorded in this plan.

Approval readiness: PASS (R1, R2, R3 approved by the owner's answers D1 to D3, 2026-11-10; no pending rows).

## CEO Review Completion Summary
```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | HOLD SCOPE (owner's answer)                 |
  | Depth                | strategy only                               |
  | System audit         | 1 owner, 1 star, 0 forks; skill and brief   |
  |                      | call the engine; 23 files name the account; |
  |                      | www CNAME to raduuuuu.github.io             |
  | Decisions            | 3 (R1 one repo, R2 org now, R3 woodentrain) |
  | Sections 1-10        | done; 11 skipped (no UI)                    |
  | Critical gaps        | 0 (the domain handoff, found by codex,      |
  |                      | corrected in the runbook)                   |
  | Outside voice        | codex: completed, 4 findings, all applied   |
  | TODOS.md updates     | 0                                           |
  | Reversibility        | 4/5                                         |
  | Unresolved decisions | 0                                           |
  +====================================================================+
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | mode: HOLD SCOPE, 0 critical gaps; 3 decisions |
| Outside Review | codex (plan review, automatic) | Independent 2nd opinion | 1 | completed (findings) | 4 findings (1 High, 3 Medium), all applied to the runbook; none reopened a decision |
| Eng Review | `/autoplan` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — (no UI scope) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex (gpt-6-astra), plan-review phase: completed, 4 findings, all integrated as corrections.
- **VERDICT:** CEO CLEARED; eng review required before T2's code changes (small: links, a test, the brief's version).

NO UNRESOLVED DECISIONS
