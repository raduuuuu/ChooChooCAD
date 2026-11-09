# Community track pieces: intake, a drawing agent, a contributing guide

Plan under review by /plan-ceo-review, 2026-11-08, on `main`. Owner's ask
(verbatim): "time to open up submission of track pieces to the community.
Evaluate whether we should spin a separate agent that draws the pieces from
the drawings that anyone can install. Evaluate whether we should have the
community open up an issue on github with the picks they snaped, then the agent
draws and if needed asks the submitter questions and/or aditional info via
comments on the issue. We also need a "how to contribute" document readable by
both humans and agents/llms".

Three asks: (1) evaluate an installable drawing agent; (2) evaluate GitHub
issues with photos as intake, the agent drawing and asking questions in
comments; (3) a contributing guide for humans and agents (requested outright,
not an evaluation).

Not legal advice anywhere below. The owner's standing rule (2026-11-05,
docs/plan/2026-11-05-see-shared-layouts.md:120): "any legal risk, scrap it".

## Step 0 evidence

### 0A. Premise

- **Real problem:** the library grows only as fast as the owner photographs
  pieces they own and steers the drawing. 13 drawing commits for 7 pieces over
  2026-11-07 to 11-08 [measured: git log 6dd867f^..95e310e], each piece's shape
  corrected by the owner against their photos, several rounds per piece (the
  station's roof: 7 rounds across #176 to #188). Pieces the owner does not own
  never arrive.
- **Target outcome:** a person who owns a piece the library lacks can get it
  drawn without the owner owning it, and the result is as trustworthy as the
  owner's own photo pieces (marked "Unverified size" until measured).
- **Do-nothing cost:** the library stays the owner's own box. No harm today.
- **Direct or proxy:** intake solves "who has the piece"; it does not solve
  the real bottleneck, which is review. KiCad (2022: ~473 open merge requests,
  ~2 active reviewers) and LDraw (a handful of reviewers casting most
  certifications) stall at review, not intake [research, sources below]. Here
  the reviewer is one person, and the review is the render-against-photo
  comparison that took several rounds per piece.

### 0B. Existing code leverage

| Sub-problem | Reuse | Gap |
|---|---|---|
| Simple straight/curve from numbers | `app/src/SubmitPart.tsx`, `resolveLibrary` trust ranking (`engine/data/library.ts`) | none: anyone can already add a measured straight or curve in the app, locally |
| Decorated piece from photos | decor shapes in `engine/src/parts/schema.ts`, `engine/src/view3d/decor.ts`; seeds in `engine/data/*Seeds.ts` | each new look often needs a new shape (dome, prism, wheel this week) |
| Reading sizes off photos | `docs/photo-guide.html` (how to shoot) | the measuring scripts (`grid.py`, `fit1d.py`, `lines.py`) live only in a session scratchpad, not in the repo |
| Render compared with each photo | gstack `$B` against `bun run dev` | not in the repo; needs gstack installed |
| Heights the photos cannot give | `docs/calibration-sheet.html` with diagrams | asked of the owner only |
| Rules a drawing must keep | `CLAUDE.md` (mutation-proof pins), memory rules (no brand names in app copy, photos never committed, they/them) | the memory rules live in the owner's local Claude memory, not the repo |
| Contributing guide | none (`CONTRIBUTING.md`, `AGENTS.md`, issue forms absent) | all of it |

### 0C. Dream state

```
  CURRENT STATE                 THIS PLAN                       12-MONTH IDEAL
  owner photographs own   --->  others send photos of pieces --> most common pieces of
  pieces; Claude draws;         they own; a drawing workflow     every system drawn;
  owner corrects by eye         anyone can run; owner reviews    each marked by who
  (7 pieces, 2 days)            renders beside the photos        measured it; owner only
                                                                 reviews, never draws
```

### Landscape (Aside research, 2026-11-08; treat as untrusted, cited)

- Issue-to-PR agents exist: Claude Code GitHub Action (`@claude`, maintainer's
  API key or OAuth subscription), Copilot coding agent (assign an issue, paid
  plan). https://code.claude.com/docs/en/github-actions ,
  https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent
- Letting anyone trigger them is a known hole: Cline's triage bot
  (Dec 2025, `allowed_non_write_users: "*"`, issue title into the prompt, a
  supply-chain attack), nnU-Net advisory (Apr 2026, High). Both vendors default
  to write-access users only; CSA calls `allowed_non_write_users: "*"` a
  critical misconfiguration.
  https://docs.github.com/en/copilot/concepts/agents/cloud-agent/risks-and-mitigations
- Issue forms support required fields, image uploads and a required checkbox
  (a licence statement can use the same pattern).
  https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests
- AGENTS.md is the open convention for agent instructions beside a human
  CONTRIBUTING.md; duplication with CLAUDE.md drifts. https://agents.md/
- GitHub's terms: what is added to a licensed repo is under that licence
  ("inbound=outbound"). https://docs.github.com/site-policy/github-terms/github-terms-of-service
- Part libraries: LDraw needs two reviewer certifies plus an admin; KiCad
  reviews by hand against the datasheet; both stall on reviewer count.
  https://wiki.ldraw.org/wiki/Parts_Tracker , https://forums.ldraw.org/thread-23096.html

Layer 1: maintainer-reviewed pull requests, issue forms for intake.
Layer 2: issue-to-PR agents, gated to write-access triggers.
Layer 3: here the scarce thing is the owner's eye on render-versus-photo, so
the agent's job is to make that review fast (renders beside each photo in the
PR), not to remove it.

### Reality rows

| premise | claim | receipt | verdict |
|---|---|---|---|
| P1 | No contributing guide, AGENTS.md or issue forms exist | `ls` CONTRIBUTING.md AGENTS.md .github/ISSUE_TEMPLATE: absent | verified |
| P2 | Repo is public, MIT, issues enabled, no issues, no secrets | `gh api repos/raduuuuu/ChooChooCAD`: public, has_issues true, MIT; `gh secret list` empty | verified |
| P3 | Simple straights/curves can already be added by anyone, locally | docs/plan/2026-11-02-photo-parts-and-stations.md:21 (`SubmitPart.tsx`) | verified |
| P4 | Photo-measuring tools are not in the repo | `ls scripts`: browserChecks chunkBudget.ts ogImage.ts verdictDiff.ts | verified |
| P5 | Drawing a decorated piece took several owner-corrected rounds | git log 6dd867f^..95e310e, 13 commits, 7 pieces | verified |
| P6 | Owner scrapped a public builds page on legal risk | docs/plan/2026-11-05-see-shared-layouts.md:120-135 | verified |
| P7 | GitHub strips location data from uploaded images | none | unverified |
| P8 | Submissions cannot rise or replace structures | docs/plan/2026-11-02-photo-parts-and-stations.md:121,137 | verified |

unverified=1

REALITY: premise-table pass 8 premises, unverified=1 (P7) docs/plan/2026-11-08-community-pieces.md:1
REALITY: already-done pass no CONTRIBUTING/AGENTS/issue forms on origin/main since 2026-11-01 (git log empty) .github/workflows/ci.yml:1
REALITY: surface-check finding `@claude` trigger and `allowed_non_write_users` named from vendor docs, not verified locally (no Action installed) docs/plan/2026-11-08-community-pieces.md:1
REALITY: binding-decisions finding the 2026-11-05 "any legal risk, scrap it" rule and the self-asserted `dimensions.status` blocker bind this plan docs/plan/generic-TODOS.md:761
REALITY: numbers pass 13 commits / 7 pieces [measured: git log]; 5 to 13 files per piece PR [measured: git show --stat f8f6108 d7d4166 6dd867f] docs/plan/2026-11-08-community-pieces.md:1
REALITY: deferred-asks pass no linked issue docs/plan/2026-11-08-community-pieces.md:1
REALITY: pr-count pass no ship-policy.json; default one PR per wave .github/workflows/ci.yml:1

### Section 2: Code quality

- [INFORMATIONAL] (confidence: 9/10) scratch `fit1d.py:3` —
  `subprocess.run(['python3','lines.py',...],env={'PYTHONPATH':'pylib'})`
  depends on the current folder and replaces the whole environment (PATH
  included) with a session-only library folder; moved as is, it fails.
  Correction inside the D1 arrangement (the scripts must run): `fit1d` imports
  `lines`' peak finder as a function; dependencies come from
  `requirements.txt`; no subprocess.
- [INFORMATIONAL] (confidence: 8/10) scratch `lines.py:3-4`, `fit1d.py:18` —
  bare positional `sys.argv` integers, no usage text. Correction: argparse
  with named arguments and `--help`, since builders run them (CONTRIBUTING.md).
- [INFORMATIONAL] (confidence: 9/10) `app/src/linkFragment.ts:12-14` — the
  counter diagram goes stale with item 12; updated in the same commit (T10).
- Accepted by D1: the regroup grows App.tsx (2,200+ lines); recorded, not
  re-asked.
No shared-code extraction proposed: the only similar code (label names) is
settled by E1-2.

### Section 3: Tests

```
CODE PATHS                                              USER FLOWS
[+] engine/src/joints/trust.ts                          [+] File a piece issue (GitHub)
  ├── unverified-size note       [★★★ TESTED] existing    ├── [GAP] form fields pinned (T3 test planned)
  ├── modelled-switch note       [★★★ TESTED] existing    └── [GAP] labels agree (E1-2 test planned)
  ├── single-source note         [★★  TESTED] existing  [+] Builder runs the skill
  └── community caveat (R3)      [GAP] planned T8           ├── [GAP] [→E2E] dry run on a fake issue (T6, manual)
[+] app/src/App.tsx                                         └── [GAP] outside pilot (T6, manual)
  ├── card line "confirmed by N"  [GAP] planned T9      [+] Open a shared link
  ├── palette groups + order      [GAP] planned T12         ├── [★★★ TESTED] /shared-link counted today
  └── palette link, read-only     [GAP] planned T7          │     (counter.dom.test.tsx, linkFragment.test.ts)
[+] app/src/main.tsx                                        └── [GAP] CRITICAL after item 12: nothing
  └── beacon tag (prod only)      [GAP] planned T10               stops the layout reaching Cloudflare (E3-1)
[+] scripts/photo
  ├── check: GPS reported, stripped [GAP] planned T4
  ├── no grid / no straight         [GAP] planned T4
  └── HEIC, repeat pair, 216 trial  [GAP] planned T4
[+] AGENTS.md / CONTRIBUTING.md     [GAP] planned T2 (rules + EXIF steps present)

COVERAGE today: 4/20 paths (new code not built)  |  all GAPs have a planned test except E3-1
```

REGRESSION RULE: item 12 deletes the only code and tests that keep a shared
layout (the `#v1.` fragment) out of analytics (`countedPath`,
`app/src/linkFragment.ts:25-26`; `counter.dom.test.tsx`). Cloudflare's script
is not ours (D16), and its handling of the fragment is unverified (V4).
Decision E3-1 (D4).

Tests made obsolete: `app/src/counter.dom.test.tsx`,
`app/src/actions.dom.test.tsx`, the counter cases of
`app/src/linkFragment.test.ts` (with GoatCounter, D14), each replaced as
the E3-1 answer decides.

### Section 4: Performance

No issues found. The beacon loads async after first paint, where the counter
loads today; the regrouped palette renders the same 70 cards; the photo
scripts run offline on a handful of images per piece.

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| A1 intake (owner) | Ask (2); legal rule P6; Layer 2 risk | A: both doors, issue form with photos (licence and photo-safety checkboxes) and PRs from builders; the guide tells people and agents how to strip EXIF before upload | B) PRs only; C) scrap | approved | Owner, 2026-11-08, D1: "1 but in the instructions could we instruct the user/llm how to remove the exif from the photos as well". Scope: intake channel and EXIF-stripping instructions in the guide (A3); P7 no longer relied on. |
| A2 agent (owner) | Ask (1) and (2); Layer 2 risk; A1 | A: a drawing skill committed to the repo (with the measuring scripts), run by hand by the owner or a builder; it posts questions as issue comments and opens a PR | B) labelled Action (later, on the same skill); C) declined | approved | Owner, 2026-11-08, D2: "A drawing skill in the repo, run by hand (recommended)". Scope: no hosted bot, no secrets in GitHub. |
| A3 guide (owner) | Ask (3), requested outright | CONTRIBUTING.md (humans) + AGENTS.md (agents), with EXIF steps (A1) | none | approved | Owner's request in the /plan-ceo-review arguments, 2026-11-08: "We also need a \"how to contribute\" document readable by both humans and agents/llms". |
| AD1 library review (owner) | Owner, 2026-11-08 at D12: "I want a complete review of the library and categorization of parts." 70 built-ins: GENERIC 53 (straight 14, curve 2, multi-road 21, buffer 2, decorated straight 11, block 1, decorated multi-road 2), Small-peg 12, Look-alike 5 [measured: bun BUILT_IN count]; palette groups by brand shelf, then Structures, then Decorated (`app/src/App.tsx:166`); the Action Tunnel Station sits on the track shelf, the Cargo crane in Decorated | A: audit all 70 parts (name, shelf, group, status, origin, short code), fix every inconsistency, then regroup the palette by what a piece does within each system; mock + /plan-design-review before building; saved layouts unaffected | B) audit only; C) regroup only | approved | Owner, 2026-11-08, D13: "Audit every part, then regroup the palette (recommended)". | Owner, D12 reply "1 but I want other things to be added as well", then the sentence quoted. Scope: a complete review of the library and its categorisation. |
| AD2 analytics on Cloudflare (owner) | Owner, 2026-11-08 at D12: "I want to move analytics to cloudflare instead." Today: GoatCounter, visits plus 10 action events (`app/src/linkFragment.ts:22`, `app/src/main.tsx:45`), actions asked for by the owner on 2026-11-05. Research: Cloudflare Web Analytics is free, cookieless, works without proxying, but has no custom events (FAQ: "Not yet"); Zaraz `track` needs a proxied domain; a Worker + Analytics Engine sees each visitor's IP (`CF-Connecting-IP`). Site: GitHub Pages, DNS at the registrar | B: Cloudflare Web Analytics replaces GoatCounter (visits, referrers, Web Vitals); the 10 action events, `count.js`, `ACTIONS` and the GoatCounter tag are removed; reverses the owner's 2026-11-05 "what people do in the app" decision | A) CF + GoatCounter actions; C) CF + own Worker | approved | Owner, 2026-11-08, D14: "Cloudflare only, drop the action events" (recommendation was A). | Same D12 reply. Scope: analytics moved to Cloudflare. |
| S3-1 skill permission mode (Section 3) | A2's approved guarantee "you approve each step it takes"; auto/bypass modes break it | none | the skill requires default permission mode on issues, checks at start, never runs commands quoted from an issue | approved (correction inside D2's exact scope) | D2 answer "A drawing skill in the repo, run by hand (recommended)", whose description states "you approve each step it takes". |
| S4-1 HEIC photos (Section 4) | A1 requires phone photos to work | none | check.py handles HEIC or asks for JPEG; guide names the camera setting | approved (correction inside D1's scope) | D1 answer (intake from phone photos). |
| S3-2 beacon source (Section 3) | count.js precedent: reviewed, pinned | GoatCounter reviewed copy | B: Cloudflare's hosted snippet | approved | Owner, 2026-11-08, D16: "Cloudflare's own copy from their server" (recommendation was A). |
| OV-2 lengths too (Codex) | VerdictLine.tsx:232 unmeasured count; D8 | heights promote the piece | readers confirm every figure the check uses; stays unverified until then | approved | Owner, 2026-11-08, D17: "Readers confirm lengths too (recommended)". |
| OV-3 unsupported gate (Codex) | thirdParty.ts:43 (10-degree curves) | none | early representability gate, `piece: unsupported` | approved | Owner, 2026-11-08, D18: "Check early, label 'piece: unsupported' (recommended)". |
| OV-6 rollout + pilot (Codex) | Section 9 draft | analytics and library before the link; owner-photo dry run | three tracks; one outside pilot gates X2 | approved | Owner, 2026-11-08, D19: "Community flow first, one outside pilot gates the link (recommended)". |
| OV-1, OV-4, OV-5 (Codex) | pages.yml/ci.yml upload app/dist only (sheet 404); photo-guide.html:147-157; vitest globs | as drafted | diagram PNG dragged in; guide protocol enforced; CI runs script tests | approved (factual corrections inside D2, D1/A1, D4 scope) | Corrections of false plan claims and of approved requirements' enforcement; no behaviour change beyond the approved items. |

## Answered: A1 (D1)
Commitment comparison:

```text
Commitment                         | Source/approval or pending | Current | A (issue + PR)   | B (PR only)        | C (scrap)
Where submitter photos live        | pending                    | none    | public, on GitHub| submitter's machine| nowhere
Who draws                          | pending A2                 | Claude, owner session | owner's or contributor's agent | contributor's agent | owner only
Owner reviews every merge          | fixed (branch protection)  | yes     | yes              | yes                | yes
Render beside each photo in review | memory rule                | yes     | yes              | renders; photos optional | yes
Licence/consent statement          | pending                    | none    | form checkbox + PR sign-off | PR sign-off | none
Reachable by non-developers        | ask (2)                    | no      | yes              | no                 | no
New legal surface vs 2026-11-05    | legal rule                 | none    | low, GitHub hosts| lowest             | none
```

Question: D1 — A1: Where do community pieces come in?
Project/branch/task: ChooChooCAD on main, opening the track library to pieces the owner does not own.
ELI10: Today only pieces you own get drawn, because the drawing needs photos of the real piece. Opening up means strangers send photos (as GitHub issues anyone can file) or send finished drawings (as pull requests, which needs developer tools). Photos on a public issue are public, and your rule from 2026-11-05 is "any legal risk, scrap it". GitHub hosts issue photos, not you, and every GitHub user is 13+ by its terms, which is far smaller than the scrapped builds page (your own server, IP addresses, you as publisher). Not legal advice.
Stakes if we pick wrong: either a public photo of someone's living room with a child in it sits on your repo, or nobody but developers can ever add a piece.
Recommendation: A because the people who own the pieces are parents, not developers, and the photo-safety checkbox plus your review before anything merges keeps the new risk small.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: reach (A) against the smallest legal surface (B) against none at all (C).
Header: Intake
A) Issue with photos, plus PR for builders (recommended)
Both doors. Anyone with a GitHub account opens an issue from a form (photos, the piece's name in their words, a licence checkbox, a "no people, no faces, no addresses in the photo" checkbox); builders can instead run the drawing workflow and open a PR. Effort M, risk low. ✅ Reaches the parents who own the pieces, not only developers who can run an agent. ✅ GitHub, not the owner, hosts the photos, and every GitHub user is 13 or older by its terms. ❌ Photos of people's homes become public on the repo; the owner moderates them.
B) Pull requests only, photos stay private
Contributors run the drawing workflow on their own machine and open a PR with numbers and renders; photos never leave their computer unless they choose. Effort S, risk low. ✅ The smallest legal surface: nothing personal is posted by the process. ✅ The drawing cost sits with the contributor. ❌ Only people who can install Claude Code, bun and gstack can contribute, which is few toy-train owners.
C) Scrap community submission for now
Keep the library to the owner's photos; write the contributing guide for code changes only. Effort S, risk none. ✅ Zero new legal or moderation surface under the "any legal risk" rule. ✅ No review queue to fall behind on. ❌ Pieces the owner does not own never arrive.

## Answered: A2 (D2)
Commitment comparison:

```text
Commitment                         | Source/approval or pending | Current | A (skill, by hand) | B (skill + labelled Action) | C (Action on any issue)
Drawing workflow committed to repo | pending                    | no      | yes                | yes                | yes
Who starts a drawing               | pending                    | owner   | owner or builder, locally | owner adds a label; builders locally | anyone filing an issue
Questions to submitter as comments | ask (2)                    | none    | yes, posted from the run | yes, from the Action | yes
Who pays for the model             | pending                    | owner's subscription | whoever runs it | owner's key or OAuth token in repo secrets | owner, unbounded
Untrusted issue text reaches agent | Layer 2 risk               | n/a     | yes, owner approves each tool call | yes, read-only token, no secrets in reach | yes, the known hole
Render beside each photo           | memory rule                | yes     | yes (local browser)| yes; CI needs a headless browser | yes
Owner reviews every merge          | fixed                      | yes     | yes                | yes                | yes
```

Question: D2 — A2: What is "the agent" that draws a submitted piece?
Project/branch/task: ChooChooCAD on main, the drawing step after a photo issue (D1 A) or for a builder's PR.
ELI10: Drawing a piece today is me in your session: read the photos, measure them with scripts that live only in a scratch folder, draw, render, compare with every photo, write tests that are proven to fail, open a PR. To let anyone do it, that workflow has to live in the repo as a skill any Claude Code user can run. The open choice is whether it also runs by itself on GitHub. A bot that any stranger's issue can start is a known attack (Cline, Dec 2025; nnU-Net, Apr 2026): text in the issue steers an agent that holds repo permissions.
Stakes if we pick wrong: a stranger's issue text steering an agent with your repo's keys, or a bill that grows with every issue filed.
Recommendation: A because a piece takes several review rounds with your eye on the photos anyway, so a robot first draft saves little until issues arrive faster than you can run the skill yourself; the Action can be added later on the same skill.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: no hosted bot now (A), a bot only you can start (B), or a bot anyone can start (C).
Header: Agent
A) A drawing skill in the repo, run by hand (recommended)
Commit the workflow as a Claude Code skill plus the measuring scripts; you (or a builder) run it on an issue, it reads the photos, asks questions as issue comments, draws, renders beside each photo and opens a PR. Effort M (human ~1 week / CC ~3 h), risk low. ✅ No secrets in GitHub and no bot a stranger can start; you approve each step it takes. ✅ The same skill serves builders on their own machines and their own model budget. ❌ Nothing happens on an issue until you, or a builder, sits down and runs it.
B) The skill, plus a GitHub Action you start with a label
Everything in A, and a workflow that runs the skill when you add a "draw" label: read-only token, a separate step opens the PR, questions posted as comments, re-run when you re-label after the submitter answers. Effort L (human ~2 weeks / CC ~6 h), risk medium. ✅ Drafts appear while you are away; you only review. ✅ Only you can start it, which closes the known hole. ❌ Your API key or subscription token sits in repo secrets, and the headless browser render check in CI is new work.
C) A GitHub Action any new issue starts
Every new piece issue starts a drawing run automatically. Effort L, risk high. ✅ Fully hands-off for you until review. ✅ Fastest first answer for the submitter. ❌ The exact setup behind the Cline and nnU-Net incidents: untrusted issue text driving an agent, at your cost per issue.

## Mode

Mode: SELECTIVE EXPANSION; approved decisions: A1 (D1), A2 (D2). Provenance:
D3 asked, answer "Selective expansion (recommended)", 2026-11-08.

## Working plan (accepted scope)

1. **Issue form** `.github/ISSUE_TEMPLATE/new-piece.yml` (A1): a photos
   field (a required textarea people drag photos into; `type: upload` only if
   a test form proves GitHub supports it, task V2), the minimum set named in
   the field (top view on grid paper with a medium straight beside it, one
   side view, one end view), what the piece is in the submitter's own words,
   which pieces it joins, required checkboxes: "I took these photos and
   license them under the repo's licence", "no people, faces, addresses or
   documents are in them", "I removed location data (see CONTRIBUTING.md)",
   (no credit checkbox: R2). The photo protocol is the photo guide's own
   (`docs/photo-guide.html:147-157`): each view twice after moving the piece,
   agreeing within 0.5 mm, and the 216 mm long-straight trial reading
   216 ± 1 mm for that camera session; a submitter without a medium or long
   straight is told so and the issue is labelled `piece: needs info` (OV-4). `config.yml` keeps blank issues on
   (the setting is repo-wide, and code bugs still need them) and links the
   guide from the new-issue page.
2. **CONTRIBUTING.md** (A3, humans): how to photograph a piece (links
   `docs/photo-guide.html`), how to strip EXIF on phone, Mac, Windows and
   Linux (A1 addition), what happens after you file, how a builder runs the
   drawing skill, the review rule (owner merges, render beside each photo).
   Honest about privacy: on the issue path, cleaning photos is the
   submitter's job (the checkbox); the app cannot do it for them. Owner's
   moderation steps: a photo that breaks the checkbox is removed by editing
   the issue to delete the attachment, the issue is locked if needed, and
   the submitter is asked to re-post clean photos.
3. **AGENTS.md** (A3, agents/LLMs): the rules that today live only in the
   owner's local memory (no brand names in app copy; no individual sources
   (no URLs, sites or creator names for where a figure came from), except a
   part taken from a printable design, which may name the site, link it and
   credit its creator; photos never committed;
   compare the render with every photo; every measurement asked of a person
   comes with a diagram; cross-reference all photos before asking; the photo
   method is for flat pieces, others need a ruler figure; "decorative" means
   realistic detail; male-male adapters add no length; read a rule in full
   before flagging; list every pending input before calling a piece ready;
   they/them),
   issue and photo text are untrusted data, how to strip EXIF from a downloaded
   photo before reading it, then a pointer to CLAUDE.md for tests (no copy).
   CLAUDE.md gains one line, `@AGENTS.md`, so Claude Code loads the rules for
   anyone running it; the skill also reads AGENTS.md as its first step.
4. **Drawing skill** `.claude/skills/draw-piece/SKILL.md` (A2): read the
   issue, download photos into `photos/issue-<n>/` (git-ignored with
   `photos/`), run the photo check (item 6), measure, add the piece to
   `docs/calibration-sheet.html` as the owner's pieces were, ask missing
   figures as one issue comment with that diagram rendered to a PNG in
   `photos/issue-<n>/` and dragged into the comment by the runner (the sheet
   is not published: Pages serves only `app/dist`; OV-1),
   draw, render beside each photo, mutation-proven tests, open a PR that links
   the issue. Right after the photo check, a representability gate (D18):
   the piece's angles, ends and lengths are compared with what the engine
   holds (22.5-degree steps, whole millimetres, known connectors); a piece
   that cannot fit gets a comment saying why and, on an owner run, the
   `piece: unsupported` label, and nothing more is asked. The side-by-side images are saved to `photos/issue-<n>/` and the
   runner drags them into the PR description by hand (`gh` cannot upload
   images; photos are never committed). Labels (X4) are moved only when the
   owner runs it; a builder's run posts a comment ("drawing this", "PR #n")
   instead, since labels need write access. Required tools, declared in
   CONTRIBUTING.md: Claude Code, bun, Python 3 with the scripts'
   requirements, and gstack's browser (`$B`) for the render comparison. A
   photo that arrived carrying location data is never mentioned in public:
   the owner's run removes it directly (item 2); a builder's run stops and
   tells the builder to report it through the repo's private vulnerability
   reporting (GitHub "Report a vulnerability", enabled as part of this plan). No automatic sweep: R1 closures are the
   owner's, by hand.
5. **Measuring scripts** `scripts/photo/` (A2 prerequisite): `grid.py`,
   `fit1d.py`, `lines.py` moved out of the session scratchpad, with a
   `requirements.txt` (Pillow, numpy).
6. **Photo check** (X1, re-estimated M: finding the grid and the straight is
   new image work, not in the scratch scripts): `bun run photos <dir>` (a
   `package.json` script wrapping `scripts/photo/check.py`) first REPORTS any
   location data, then strips EXIF in place, then reports per photo whether
   the reference straight and the grid paper were found, and whether the
   repeat pair and the 216 mm trial are present (OV-4). CI installs
   `scripts/photo/requirements.txt` and runs `scripts/photo/test_check.py`
   on committed fixture images (no faces, no location) as a step in
   `.github/workflows/ci.yml` (OV-5). Builders run it
   before upload; the drawing skill runs it on every downloaded photo.
   Submitters don't need it: their path is the guide's phone and computer
   steps. It can't clean a photo already posted, so on the issue path
   privacy still rests on the checkbox.
7. **"Missing a piece?" link** (X2): one line at the end of the palette,
   opening `issues/new?template=new-piece.yml` in a new tab; no app storage.
8. **Credit on GitHub** (X3, amended by R2/D10): no name in the app. The PR
   description and a closing comment on the issue thank the contributor by
   handle; the guide says credit lives there. The form's credit checkbox is
   dropped. The no-individual-sources rule stays as written.
9. **Wanted-pieces labels** (X4): `piece: waiting`, `piece: drawing`,
   `piece: needs info`, and one pinned issue "Pieces wanted and in progress"
   holding the three label searches as links (so it never goes stale) and how
   to claim one, kept by the owner. The owner's runs move the label; builders
   comment. Stale and duplicate issues: R1 (30 days, then closed; reopen any
   time; duplicates link the first).
10. **Community-confirmed heights** (X5): ruler readings posted on the
    piece's issue in a fixed reply format the skill's question comment gives
    (`E1: 162 mm` per line, one line per figure on the diagram). Readings
    count only from distinct GitHub accounts, none of them the submitter's;
    each reading comes with a photo of the ruler against the piece, and the
   owner checks each photo and the account (not created that week, some other
   GitHub activity) before counting it in the PR. At least two agreeing readers
    (`isUncorroborated` treats one or fewer as uncorroborated). Mapping onto
    what exists: `dimensions.status` becomes `'community'` and
    `dimensions.corroborations` the number of agreeing readers
    (`engine/src/parts/schema.ts:60-81,121`; `isUncorroborated` at :921).
    One status covers the whole part, so the readers' diagram asks for
    every figure the layout check uses, lengths as well as heights, and the
    piece stays `'unverified'` (still counted by the verdict's unmeasured
    line, `VerdictLine.tsx:232`) until every one of them is corroborated
    (D17, OV-2).
    Readings after a merge: a new owner PR updates `corroborations`, and the
    issue stays open (R1 doesn't apply) until the confirmation lands.
    Agreement threshold: the calibration sheet states no reading error
    today, so a stated error per figure is a dependency, set with the owner
    when the first piece needs it. Trust boundary: status changes only in an
    owner-merged built-in seed, never through the in-app submission store,
    so `generic-TODOS.md:761` stays closed. `'community'` ranks below
    `published`, so the app says "confirmed by N readers", not "measured"
    App work, in scope: the piece card and tooltip show that line for a
    `'community'` piece (nothing in `app/src` shows the status today),
    depending only on `status` and `corroborations`, with a test. Verdict
    behaviour (R3/D11): a `'community'` piece always adds a verdict note,
    "<code> rests on readers' measurements, not a published figure",
    however many agree, in `engine/src/joints/trust.ts` beside the
    single-source note, pinned by a mutation-proven trust test. Parsing: the skill reads each reply line
    by `^([A-Z]\d+):\s*(\d+(\.\d+)?)\s*mm$`; a malformed line is asked
    again; two readers disagreeing beyond the threshold means a third reading
    is asked for and nothing is counted until two agree. Form checkboxes are
    read as `- [X]` lines in the issue body; a required box unticked stops the
    skill with a comment.
    Dependencies, listed before "ready": the piece on the calibration sheet;
    a stated reading error per figure; a first community piece to confirm.
    A submitted piece starts as `status: 'unverified'`, like the owner's 20
    photo seeds. The calibration sheet is edited by hand, as today.

11. **Library review** (AD1/D13): an audit table of all 70 built-ins (name,
    shelf, group, status, origin, short code), each inconsistency fixed (for
    example the Action Tunnel Station on the track shelf while the Cargo crane
    is under Decorated); then a palette grouped by what a piece does within
    each system (straights, curves, switches and crossings, ramps, buffers;
    structures; decorated), shown as a mock and put through
    /plan-design-review before it is built. Part ids and saved layouts are
    untouched; a test loads the saved-layout fixtures before and after.
    Community pieces (A1) land in the group their kind defines.
12. **Analytics on Cloudflare** (AD2/D14): add the Cloudflare Web Analytics
    beacon in production only (where `main.tsx:45` inserts the counter
    today); remove GoatCounter: `app/public/count.js`, `GOATCOUNTER_CODE`,
    `counterPath`/`counterTag`, `ACTIONS` and every `count` call, and their
    tests (rewritten for the beacon tag). The shared-link path rule
    (`/shared-link`, so a layout in the URL fragment is never sent) must
    hold: Cloudflare's beacon records the path without the fragment, checked
    in V4. The site token is public. The 2026-11-04 TODO entry is updated.
    Dependency: a Cloudflare account and the site added in its dashboard
    (the owner's step; Claude never handles credentials).

### Scope-check findings (repairs inside accepted scope)

- H1: the owner's working rules are in local Claude memory only; an agent run
  by anyone else cannot see them. AGENTS.md carries them (item 3).
- H2: AGENTS.md references CLAUDE.md rather than copying it (drift, research).
- H3: the measuring scripts are a hard prerequisite of the skill (item 5).

## Pending decisions

- R2 approved (D10, "Credit on GitHub only (recommended)", 2026-11-08):
  reverses D6's in-app credit; credit on the PR and issue only.
- R3 approved (D11, "Keep a caveat for community pieces (recommended)",
  2026-11-08): a community piece always adds a verdict note.
- R1 approved (D9, "Close after 30 days, reopen any time (recommended)",
  2026-11-08): a `piece: needs info` issue with no reply in 30 days is closed
  by the owner with a comment that any reply reopens it; a duplicate closes
  linking the first.

## Verification tasks (before building)

- V1: download one issue attachment (`user-attachments` URL) with `gh`/curl
  from a test issue; the skill depends on it.
- V2: a test issue form with `type: upload`; fall back to a textarea.
- V3: upload a photo with location data to a test issue, download it, and
  record whether GitHub kept the data (P7). Informs the guide's wording only.

- V4: confirm in the beacon's request that the URL fragment (`#…`, which
  carries a shared layout) is not sent, before removing GoatCounter's
  `countedPath` guard.

## Verification results (community track step 1, 2026-11-08)

- V1 PASS: an issue attachment (`https://github.com/user-attachments/assets/…`)
  downloads with plain `curl`, no sign-in; the file is byte-identical to the
  upload.
- V2 PASS: issue forms accept `type: upload`; GitHub's form preview on a
  branch rendered it as an "Upload files" button with its required marker and
  no error. The form uses it for photos.
- V3: GitHub KEEPS location data. A synthetic test photo with fake GPS
  (0°N 0°E) came back byte-identical, GPS included, and is downloadable by
  anyone without signing in.
- New finding: the attachment URL still answered 200 after the test issue was
  deleted, so deleting an issue or editing out an image does not take a photo
  offline.
- Owner's decision on these findings (2026-11-08): "Keep photos, harden the
  form": the form's first step is removing location data, it states that
  posted photos can't be removed later, and the maintainer's removal steps add
  a GitHub Support request for the attachment itself (CONTRIBUTING.md).
  Declined: photos via a builder only; pausing intake.
- Test artifacts removed: issue #192, branch `intake-form-test`, the test photo.

## Deferred: none. NOT in scope: a hosted bot (A2 C declined; B later on the same skill, not recorded as a TODO because it was not asked as a deferral).

## Expansion candidates (each asked separately)

| ID | Proposal | Effort | Risk | Status |
|---|---|---|---|---|
| X1 | One command that strips EXIF and checks the photo set (reference straight and grid present) before upload | M (re-estimated) | low | ACCEPTED (D4, "Add to this plan's scope (recommended)") |
| X2 | "Missing a piece?" link in the app's palette that opens the issue form | S | low | ACCEPTED (D5, "Add to this plan's scope (recommended)") |
| X3 | Opt-in credit: "Photographed by @handle" on a piece's origin note | S | low | ACCEPTED (D6, "Add to this plan's scope (recommended)") |
| X4 | A wanted-pieces list: label + pinned issue so builders pick open requests | S | low | ACCEPTED (D7, "Add to this plan's scope (recommended)") |
| X5 | A second contributor's ruler reading lifts a piece toward measured | M | medium | ACCEPTED (D8, "Add to this plan's scope"; recommendation was Defer) |

## Spec review

Round 1: score 5/10, FAIL on all five dimensions, 18 issues. Applied as
corrections: issue-path privacy stated honestly and the owner's removal
steps added (items 2, 4, 6); X5 guarded against fake agreement and mapped onto
the existing `'community'` status and `corroborations` (item 10); every
drawing-relevant memory rule listed (item 3); A3 ledger row approved; labels
moved by the owner only (items 4, 9); photos field, minimum photo set and the
repo-wide blank-issue setting (item 1); credit field named (item 8); reading
format fixed (item 10); dependencies listed (item 10); gstack declared, PR
images dragged in by hand, the photo check's language and dependencies named
(items 4 to 6); attachment download and upload support moved to V1 to V3.
New decision: R1 (stale and duplicate issues).

Round 2: score 6/10, FAIL (scope PASS), 14 issues, all applied as
corrections: reader minimum and late readings; status only once every figure
is read (the conservative reading, no new trust); calibration-sheet step;
photo folder named; pinned issue content; GPS reported before stripping; no
sweep; DESIGN.md rule 4; reading error as a dependency (no invented number);
diagram linked from the published sheet; `@AGENTS.md` in CLAUDE.md; the app's
"confirmed by N readers" line as a task; photo check re-estimated M;
submitters use the guide's steps.

Round 3 (the last of three): score 6/10, FAIL (scope PASS), 12 issues.
Applied as corrections: the no-individual-sources rule in AGENTS.md; a
private channel for location-data leaks; the owner's per-reading check
(ruler photo, account age and activity); which figures the status vouches
for; X1's effort in the table; DESIGN.md rule 4 citation dropped (it is
typography); parse and disagreement rules; the app line depends only on
status and corroborations; the starting status; the sheet is hand-edited.
Two reopened decisions: R2 (credit vs the sources rule), R3 (verdict
caveat for community pieces).

Additions after the spec review (owner at D12: AD1, AD2) were not
spec-reviewed: the three-review cap was reached (spec not re-verified for
items 11 and 12). Issues verified against the amended text by
the parent: 10 of 10 corrections; 2 pending as R2 and R3.

## Answered: R1 (D9)
Commitment comparison:

```text
Commitment                     | Source/approval or pending | Current | A (30 days)        | B (never close)   | C (14 days)
needs-info issue with no reply | pending                    | none    | closed after 30 days, "reopen any time" | stays open, labelled | closed after 14 days
duplicate piece issue          | pending                    | none    | closed, linking the first, photos welcome there | same as A | same as A
who closes                     | A2 (owner runs)            | owner   | owner, by hand | nobody | owner
```

Question: D9 — R1: What happens to a piece issue nobody answers?
Header: Stale issues
A) Close after 30 days, reopen any time (recommended)
B) Never close, leave them labelled
C) Close after 14 days

## Answered: AD1 (D13)
Commitment comparison:

```text
Commitment                         | Source/approval or pending | Current | A (audit + new grouping) | B (audit, keep grouping) | C (grouping only)
Every part checked (name, shelf, group, status, origin, short code) | AD1 "complete review" | no | yes | yes | no
Palette grouping redesigned        | AD1 "categorization"       | brand shelves + Structures + Decorated | by what a piece does, within each system | unchanged, misplacements fixed | by what a piece does
Owner sees a mock before building  | DESIGN.md rule set         | n/a     | yes (/plan-design-review) | n/a | yes
Where community pieces land        | A1                         | undefined | a defined group per kind | current rules | a defined group per kind
```

Question: D13 — AD1: What should the library review produce?
Header: Library
A) Audit every part, then regroup the palette (recommended)
B) Audit every part, keep today's grouping
C) Regroup the palette only

## Answered: AD2 (D14)
Commitment comparison:

```text
Commitment                     | Source/approval or pending | Current | A (CF visits + GoatCounter actions) | B (CF visits only) | C (CF visits + own Worker for actions)
Visit counts                   | AD2                        | GoatCounter | Cloudflare Web Analytics | Cloudflare | Cloudflare
The 10 action events (2026-11-05 ask) | owner, 2026-11-05     | GoatCounter | GoatCounter, unchanged | dropped | Worker -> Analytics Engine
Owner's code receives visitor IPs | 2026-11-05 legal rule   | no      | no                  | no                 | yes (the Worker sees CF-Connecting-IP; not stored)
DNS moved to Cloudflare        | research                   | no      | no                  | no                 | no (workers.dev)
Tools to look at               |                            | 1       | 2                   | 1                  | 1 dashboard + SQL queries
```

Question: D14 — AD2: How do analytics move to Cloudflare, given it has no custom events?
Header: Analytics
A) Cloudflare for visits, GoatCounter keeps the actions (recommended)
B) Cloudflare only, drop the action events
C) Cloudflare for everything, with your own Worker

## Outside voice

Codex (gpt-6-astra, plan-review tier frontier), completed. Six findings: OV-1
High (diagram not deliverable: corrected), OV-2 High (geometry laundering:
D17), OV-3 High (unrepresentable pieces: D18), OV-4 High (photo protocol:
corrected), OV-5 Medium (script tests not in CI: corrected), OV-6 Medium
(rollout and pilot: D19). All verified against the repo before acting.

## 0I. Temporal interrogation

```
HOUR 1 (foundations)   V1-V4 first: attachment download, issue-form upload
                       field, GitHub's handling of location data, the beacon's
                       URL. Each can change the guide's wording or item 12.
HOUR 2-3 (core)        Ambiguities: which figures a piece's calibration diagram
                       asks for (item 10); how the photo check finds the grid
                       and the straight (item 6, new image work).
HOUR 4-5 (integration) Surprises: the drawing skill depends on gstack's
                       browser, which builders may not have; regrouping the
                       palette touches App.tsx's shelf code and the
                       structures dom tests that pin the group lists.
HOUR 6+ (polish/tests) Wishes: a dry-run of the whole skill on a fake issue
                       with the owner's own photos before announcing it.
```

Effort, human team / CC+gstack: guide + AGENTS + form + labels S/S; drawing
skill + scripts M/M; photo check M/S; palette link S/S; community heights +
caveat M/S; library audit + regroup L/M; analytics swap S/S.

## Review sections

### Current scope

Mode SELECTIVE EXPANSION (D3, asked). Accepted: A1 (D1), A2 (D2), A3
(requested), X1 (D4), X2 (D5), X3 (D6 amended by D10: credit on GitHub only),
X4 (D7), X5 (D8) with R3 caveat (D11), R1 (D9), AD1 (D13), AD2 (D14).
Rejected: hosted bot on any issue (A2 C). Deferred: none. Pending: none
before Section 1.

### Section 1: Architecture

```
                        GitHub (hosts photos, issues, labels, PRs)
   submitter ──form──▶  issue #n ◀──comments── drawing skill run (owner/builder,
   (13+, photos,          │  ▲                  local Claude Code, own budget)
    checkboxes)           │  └─ readings (E1: 162 mm) from other accounts
                          ▼
              photos/issue-<n>/ (git-ignored) ─▶ scripts/photo (check, measure)
                          │
                          ▼
     engine/data/*Seeds.ts + decor shapes + tests + calibration sheet ─▶ PR
                          │                                      owner merges
                          ▼
              library.ts (BUILT_IN) ─▶ palette groups (AD1) ─▶ app
                          │
                trust.ts: community caveat (R3)
   app ──beacon (AD2)──▶ Cloudflare Web Analytics      (GoatCounter removed)
```

- Boundaries: nothing new runs on a server the owner controls. The only new
  runtime code in the app is the palette link (X2), the "confirmed by N
  readers" line and caveat (X5, R3), the regrouped palette (AD1) and the
  beacon tag (AD2).
- Coupling: the skill couples to GitHub's issue body format (checkbox lines,
  attachment URLs, V1/V2) and to gstack's browser. Justified; declared in
  CONTRIBUTING.md.
- Scaling: what breaks first at 10x issues is the owner's review, not code
  (KiCad, LDraw). At 100x, the labels and the 30-day rule (R1) keep the queue
  readable; drawing throughput depends on builders.
- Single points of failure: the owner (only merger, only label mover);
  accepted by D2.
- Security architecture: see Section 3.
- Rollback: every piece is its own PR, revertable; the analytics swap is one
  PR, revertable in minutes by `git revert` and redeploy.
- Value test: the audit table (AD1) is consumed by the regroup and retires
  when the regroup ships; the owner asked for it. The spec-review notes in
  this file are review history, not product.
- Platform: the drawing skill plus AGENTS.md is the same path the owner's own
  pieces now take; the owner's sessions should use it too, so it is
  exercised every week.

Findings: S1-1, the owner's own piece work should go through the skill too,
or it rots (OK, applied as a note in item 4: no new behaviour).
No other issues found.

### Section 2: Error & Rescue Map (capability level for the skill, codepath level for app code)

```
CODEPATH                         | WHAT CAN GO WRONG                     | CLASS
---------------------------------|---------------------------------------|---------------------
skill: fetch issue (gh)          | not logged in, rate limit, 404        | GhError
skill: download attachment       | private/expired URL, not an image     | DownloadError (V1)
skill: parse checkboxes          | box unticked, form edited by hand     | FormIncomplete
scripts/photo/check.py           | no EXIF / GPS present / no grid found | PhotoCheckResult
skill: parse readings            | malformed line, disagreement          | ReadingRejected
skill: open PR (gh)              | no push rights (builder), CI red      | GhError
App palette link                 | popup blocked                         | none (plain link)
beacon tag (main.tsx)            | blocked by ad blocker, CF down        | none (fire and forget)
trust.ts community caveat        | part status unknown value             | trustRank fails closed (existing)

CLASS             | RESCUED? | RESCUE ACTION                                  | USER SEES
------------------|----------|------------------------------------------------|-----------------------------
GhError           | Y        | stop, print the gh error and the command       | runner sees why; nothing posted
DownloadError     | Y        | stop; comment asks for re-upload (owner run)   | submitter asked to re-post
FormIncomplete    | Y        | stop; comment names the unticked box           | submitter told which box
PhotoCheckResult  | Y        | GPS: owner removes photo (item 2); no grid:    | asked to reshoot, with the
                  |          | comment with the photo guide link              | guide link
ReadingRejected   | Y        | ask again / ask a third reader; count nothing  | reader asked again
beacon blocked    | Y (by design) | none; the app never waits on it            | nothing; visits undercount
```

No silent failures in new app code: the link and beacon cannot fail the app;
the caveat reuses the fail-closed trust ranking.
Finding S2-1 (WARNING): ad blockers block the Cloudflare beacon (research),
so visit counts will undercount; GoatCounter's self-hosted copy was blocked
less. Accepted consequence of D14; recorded, no remedy proposed.

### Section 3: Security & Threat Model

| Threat | Likelihood | Impact | Mitigated? |
|---|---|---|---|
| Prompt injection: issue text or a photo's embedded text steers the drawing skill on the runner's machine | Med | High | Partly. Item 3 says issue text is data. Gap S3-1 below. |
| Photos with location data or people posted publicly | Med | Med | Checkbox, guide steps, the skill reporting it, owner removal (items 1, 2, 4, 6) |
| Sockpuppet readings raising a piece to community | Low | Med | Distinct accounts, ruler photos, account check, owner confirms, verdict caveat (item 10, R3) |
| A malicious PR from a builder (code, not only seeds) | Med | High | Owner reviews every PR; CI; branch protection. OK |
| Third-party beacon script changes unreviewed or sends the layout fragment | Low | High | Gap S3-2 below (decision D16), V4 |
| Credentials | n/a | n/a | No secrets added (D2 A). OK |
| New dependencies | Low | Low | Python Pillow, numpy for scripts only, not shipped. OK |

S3-1 (CRITICAL GAP, repair inside A2's approved guarantee "you approve each
step it takes"): Claude Code can run in auto or bypass permission modes, in
which nobody approves each step. Applied as a correction: the skill and
AGENTS.md require default permission mode when an issue is being processed,
the skill checks for it at start and stops otherwise, and it never runs
commands quoted from an issue.

S3-2: the beacon's provenance and URL. Decision D16.

### Section 4: Data flow and interaction edge cases

```
photo ─▶ download ─▶ check.py ──GPS?──▶ report to owner (private), stop using it
           │ nil: no attachments ─▶ FormIncomplete comment
           │ empty: 0-byte / not JPEG/PNG/HEIC ─▶ DownloadError comment
           ▼
        strip EXIF ─▶ grid+straight found? ──no──▶ reshoot comment
           ▼
        measure ─▶ seed ─▶ tests ─▶ PR (owner merges) ─▶ BUILT_IN
reading "E1: 162 mm" ─▶ regex ─▶ distinct account? not submitter? ─▶ agree within
   stated error? ─▶ count; dup reply from same account ─▶ counted once
```

| INTERACTION | EDGE CASE | HANDLED? | HOW |
|---|---|---|---|
| File a piece issue | the same piece twice | Y | R1: duplicate closed, linking the first |
| File a piece issue | HEIC photos from an iPhone | GAP S4-1 | applied: check.py converts HEIC with Pillow's plugin or asks for JPEG; guide says "Most Compatible" camera setting |
| Skill run | two builders start the same issue | Y | X4 comment "drawing this" before work; second run reads it and stops |
| Skill run | submitter edits photos after drawing started | Y | the PR lists the attachment URLs it used |
| Palette link | clicked on a phone (read-only view) | Y | link hidden where the palette is hidden |
| Readings | same account posts twice, different numbers | Y | latest counts, once |
| Readings | arrive after R1's 30 days | Y | X5 issues are exempt from R1 (item 10) |
| Regrouped palette | saved layouts | Y | ids untouched; fixture load test (item 11) |

S4-1 applied as a correction (required by A1: the most common phone photo
format must work). No async shared state in new app code.

### Section 5: Code quality

- Reuse: trust caveat sits beside the single-source note in `trust.ts`; the
  credit is GitHub-only (no new field); the palette regroup reuses
  `partsByBrand`'s shape with a group key, no second listing path.
- S5-1 (WARNING): AGENTS.md and CLAUDE.md overlap; item 3 already keeps
  tests in CLAUDE.md only. OK.
- S5-2 (WARNING): the measuring scripts are Python in a TypeScript repo;
  they stay tools, never imported by the app; `requirements.txt` pins
  versions. OK.
No other issues found.

### Section 6: Tests

```
NEW THING                         | TYPE        | HAPPY                    | FAILURE                      | EDGE
issue form YAML                   | unit (node) | required fields present  | a required box removed fails | blank-issues setting
AGENTS.md rules                   | unit (node) | each memory rule present | a rule deleted fails         | CLAUDE.md imports it
scripts/photo/check.py            | script test | GPS reported then gone   | no grid -> nonzero exit      | HEIC, no EXIF at all
palette link                      | dom         | opens the form URL       | absent in read-only view     | -
"confirmed by N readers"          | node/dom    | community, 2 -> line     | unverified -> no line        | corroborations 0/1
community verdict caveat (R3)     | node        | note present, N=5        | removed note fails           | mixed layout
library regroup                   | dom + node  | groups and order pinned  | a part in two groups fails   | saved fixtures load
beacon tag                        | node        | prod only, token, src    | dev build has no tag         | shared-link page
GoatCounter removal               | node        | no goatcounter strings   | -                            | -
drawing skill                     | manual dry run on a fake issue (owner's photos), recorded in the PR
```

Every pin records its run mutation (CLAUDE.md). Flakiness: none time- or
network-dependent; the skill's GitHub steps are manual, not CI.
2am-Friday test: the R3 caveat spec, because a missing caveat is the one
silent wrong answer here.

### Section 7: Performance

No new hot paths. The regrouped palette renders the same 70 cards. The beacon
loads async after first paint (same place as today's counter). check.py runs
offline on a handful of photos. No issues found.

### Section 8: Observability

- Visits: Cloudflare dashboard (AD2). What the app no longer tells the owner:
  which actions people take (D14, accepted).
- Community flow: the labels (X4) are the dashboard: counts per label give
  waiting, drawing and stuck pieces.
- Runbooks: photo removal steps (item 2); stale issues (R1).
S8-1 (WARNING): with action events dropped, nothing measures whether the
palette link (X2) is used. Accepted consequence of D14; issue counts are the
proxy.

### Section 9: Deployment and rollout

Three independent tracks (D19), one PR per step, never stacked (owner's
rule). Community: (1) V1-V3 checks; (2) guide, AGENTS.md, form, labels;
(3) scripts, photo check, drawing skill, dry run on the owner's photos;
(4) one invited outside contributor completes a piece end to end (issue,
questions, PR), with notes on where they got stuck, before (5) the palette
link (X2); (6) community figures + caveat when the first piece needs them.
Analytics: V4, then the swap. Library: audit, /plan-design-review on the
mock, then regroup. Rollback: revert the PR;
Pages redeploys in about two minutes. Post-deploy: open woodentrain.world,
confirm the beacon request in the network panel carries no `#` fragment and
the Cloudflare dashboard shows the visit. No feature flags needed.

### Section 10: Long-term trajectory

Reversibility: 4/5 (the public issues and their photos are the one-way part:
once posted, others may have copied them). Debt: the skill and scripts must
track every new decor shape (S10-1: the skill reads `schema.ts`, not a copy
of it). Phase 2: the labelled Action on the same skill (D2's B, not recorded
as a TODO). Retrospective: X5 (accepted against Defer) brought two reopened
decisions (R2, R3); the others integrated cleanly.

### Section 11: Design and UX

```
palette ─▶ (missing piece) ─▶ "Missing a piece? Send photos" ─▶ GitHub form
   │                                                           (new tab)
   └▶ groups: System ▸ Straights | Curves | Switches & crossings | Ramps |
              Buffers ▸ Structures      (AD1; decorated inside, D3)
piece card ─▶ status line: "Unverified size" | "confirmed by N readers" | ✓
verdict    ─▶ notes include the community caveat when such a piece is used
```

| FEATURE | EMPTY | ERROR | SUCCESS | PARTIAL |
|---|---|---|---|---|
| Regrouped palette | a group with no parts is hidden | n/a | groups in pinned order | a system with only straights shows one group |
| Palette link | n/a | popup blocked: plain link still works | form opens | n/a |
| Community line | n/a | unknown status: fails closed | "confirmed by 2 readers" | 1 reader: "Unverified size" stays |

Recommendation recorded: run /plan-design-review on the regroup mock (AD1
already requires it). DESIGN.md: the community line and caveat are words,
not a new canvas mark. No other issues found.

## Answered: S3-2 (D16)
D16 — S3-2: Where does the Cloudflare beacon script come from? Answer:
"Cloudflare's own copy from their server" (recommendation was A, a reviewed
pinned copy). Item 12 uses the standard snippet from
static.cloudflareinsights.com; V4 (no `#` fragment sent) still gates removing
GoatCounter's `countedPath` guard. This ends the rule that only reviewed,
pinned code runs on the page (count.js, 2026-11-04) for analytics.

## Approval readiness

Approval readiness: PASS. Rows checked with their answers: A1 (D1), A2 (D2),
A3 (owner's request), X1 (D4), X2 (D5), X3 (D6 amended by D10), X4 (D7),
X5 (D8, with D17), R1 (D9), R2 (D10), R3 (D11), AD1 (D13), AD2 (D14),
S3-1 (correction inside D2), S4-1 (correction inside D1), S3-2 (D16),
OV-1/OV-4/OV-5 (corrections inside D2, D1, D4), OV-2 (D17), OV-3 (D18),
OV-6 (D19). Mode D3 and document approvals D12 (with additions) and D15
approve no remedies. Declined: A2 C. Deferred: none.

## Reality rows

REALITY: premise-table pass 8 premises, unverified=1 (P7, now checked by V3) docs/plan/2026-11-08-community-pieces.md:1
REALITY: already-done pass no CONTRIBUTING/AGENTS/issue forms on origin/main since 2026-11-01 .github/workflows/ci.yml:1
REALITY: surface-check finding vendor flags named from docs, unverified locally; Pages serves app/dist only (verified) .github/workflows/ci.yml:127
REALITY: binding-decisions finding "any legal risk, scrap it" and generic-TODOS.md:761 bind this plan; both honoured (D1 rationale, item 10) docs/plan/generic-TODOS.md:761
REALITY: numbers pass 13 commits / 7 pieces [measured]; 70 built-ins [measured: bun count] engine/data/library.ts:276
REALITY: deferred-asks pass no linked issue docs/plan/2026-11-08-community-pieces.md:1
REALITY: pr-count pass one PR per step, three independent tracks, never stacked (D19) docs/plan/2026-11-08-community-pieces.md:1
PLAN_REALITY: phase=ceo rows=7/7 missing=none unverified=1 verdict=complete

## NOT in scope

- A GitHub Action that any new issue starts (A2 C, declined in D2: the
  Cline/nnU-Net prompt-injection pattern).
- A labelled Action the owner starts (A2 B): not chosen in D2; possible later
  on the same skill. Not recorded as a TODO because it was not asked as a
  deferral.
- In-app credit for contributors (D10 reversed D6's in-app part).
- Rounding unsupported pieces to the nearest supported angle (D18 C).

## What already exists

- `app/src/SubmitPart.tsx` + `resolveLibrary` trust ranking: simple
  straights/curves, local only; unchanged, not reused for photo intake.
- `docs/photo-guide.html`: the photo protocol, now enforced (OV-4).
- `docs/calibration-sheet.html`: per-piece height diagrams; the skill adds
  each piece there (hand-edited).
- `engine/src/parts/schema.ts:60-81,121,921`: `'community'` status,
  `corroborations`, `isUncorroborated`: reused for X5.
- `engine/src/joints/trust.ts:96-103`: single-source note; the community
  caveat sits beside it.
- `app/src/linkFragment.ts` + `app/public/count.js`: GoatCounter; removed by
  AD2.
- Scratchpad scripts `grid.py`, `fit1d.py`, `lines.py`: moved into the repo.

## Dream state delta

After this plan: anyone can send a piece; builders or the owner draw it with
one skill; the owner only reviews; pieces climb from unverified to
community as every figure is read. Still short of the 12-month ideal: the
owner still runs every owner-side skill step by hand (no Action), and no
piece is "measured" without the owner's ruler.

## Error & Rescue Registry

See Section 2's tables (9 codepaths, every class rescued; no GAP rows).

## Failure Modes Registry

```
CODEPATH            | FAILURE MODE                    | RESCUED? | TEST?        | USER SEES?                 | LOGGED?
--------------------|---------------------------------|----------|--------------|----------------------------|--------
skill fetch/upload  | gh error, no push rights        | Y        | dry run (T6) | runner sees the gh error   | terminal
skill download      | expired/non-image attachment    | Y        | dry run      | re-upload comment          | issue
check.py            | GPS present                     | Y        | test_check   | owner removes photo        | private report
check.py            | no grid / straight / repeat     | Y        | test_check   | reshoot comment            | issue
skill gate          | unrepresentable piece           | Y        | dry run      | 'piece: unsupported'       | issue
readings parse      | malformed / disagreeing         | Y        | skill spec   | asked again / third reader | issue
trust caveat        | community piece used            | Y        | trust test   | verdict note               | n/a
beacon              | blocked / CF down               | Y        | tag test     | nothing (undercount)       | n/a
palette link        | popup blocked                   | Y        | dom test     | plain link works           | n/a
```

No CRITICAL GAP rows (S3-1 was repaired in the plan).

## Scope Expansion Decisions

CEO plan: ~/.gstack/projects/raduuuuu-ChooChooCAD/ceo-plans/2026-11-08-community-pieces.md
- Accepted: X1 (D4), X2 (D5), X3 as GitHub-only credit (D6, D10), X4 (D7),
  X5 (D8, D17); owner additions AD1 (D13) and AD2 (D14).
- Deferred: none.
- Skipped: none of the cherry-picks; A2 C declined.

## Diagrams

System architecture (Section 1), data flow with shadow paths (Section 4),
error flow (Section 2), deployment sequence (Section 9), user flow
(Section 11). Issue label state machine:

```
 new ─▶ piece: waiting ─▶ piece: drawing ─▶ PR merged ─▶ closed (credited)
            │                  │   ▲
            │                  ▼   │ answered
            │            piece: needs info ──30 days, no reply (R1)──▶ closed
            │                                   (any reply reopens)
            └─▶ piece: unsupported (D18) ─▶ closed with reason
 invalid: drawing ─▶ waiting without a comment; unsupported ─▶ drawing
 (prevented: only owner runs move labels)
```

Rollback: revert the step's PR; Pages redeploys (about two minutes).

## Stale Diagram Audit

- `app/src/linkFragment.ts:12-14` (counter flow): stale once AD2 lands;
  updated in T10.
- `.github/workflows/pages.yml` header: still accurate.
- `engine/src/parts/schema.ts:60` comment ("one other user's submission"):
  stale for X5's meaning; updated in T9.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.
Effort assumption: docs ~30x, scripts and features ~30x, verification ~3x.

- [ ] **T1 (P1, human: ~2h / CC: ~30min)** — verification — Run V1-V4
  - Surfaced by: spec review rounds 1-2; AD2/D16
  - Files: none
  - Verify: each result written into this plan
- [ ] **T2 (P1, human: ~1d / CC: ~45min)** — docs — CONTRIBUTING.md, AGENTS.md, `@AGENTS.md` in CLAUDE.md
  - Surfaced by: A3, A1/D1, H1-H2, S3-1, OV-4
  - Files: CONTRIBUTING.md, AGENTS.md, CLAUDE.md
  - Verify: node test that every owner rule and the EXIF steps are present (mutation run)
- [ ] **T3 (P1, human: ~3h / CC: ~20min)** — github — issue form, config, labels, pinned issue
  - Surfaced by: A1/D1, X4/D7, R1/D9, OV-3/D18
  - Files: .github/ISSUE_TEMPLATE/new-piece.yml, config.yml
  - Verify: node test pins required fields and checkboxes (mutation run)
- [ ] **T4 (P1, human: ~3d / CC: ~2h)** — scripts — scripts/photo and the photo check, in CI
  - Surfaced by: A2, X1/D4, S4-1, OV-4, OV-5
  - Files: scripts/photo/*, package.json, .github/workflows/ci.yml
  - Verify: `bun run photos` on fixtures; CI step green, red on a broken fixture
- [ ] **T5 (P1, human: ~2d / CC: ~1.5h)** — skill — draw-piece
  - Surfaced by: A2/D2, S3-1, OV-1, OV-3/D18, X4/D7
  - Files: .claude/skills/draw-piece/SKILL.md
  - Verify: T6
- [ ] **T6 (P1, human: ~1d / CC: ~30min)** — pilot — dry run, then one outside contributor
  - Surfaced by: OV-6/D19
  - Owner, 2026-11-08: "the photos from that POV are very hard to be taken with a grid background. Let's make that as an optional step and requested only if needed." Side and end photos are now optional, asked for by the skill only when the top views and the underside leave the shape unclear, with no paper or ruler (heights come from a ruler reading, as AGENTS.md already says). `bun run photos --location-only` strips location from every photo before anyone looks; the full check runs on the top views only. Owner, 2026-11-08: "let's make the underside photo as optional": the typed markings field stays required; the skill asks for an underside photo only when the markings are empty or unclear, or two readers disagree. Found while preparing the dry run: the check treated every photo as a top view, so it would have refused every side photo taken as the guide said.
  - Files: none
  - Verify: a merged piece from an outside contributor, their notes recorded
- [ ] **T7 (P2, human: ~3h / CC: ~20min)** — app — palette link (after T6)
  - Surfaced by: X2/D5, D19
  - Files: app/src/App.tsx
  - Verify: dom test, link present in the editor, absent read-only (mutation run)
- [ ] **T8 (P2, human: ~4h / CC: ~25min)** — engine — community verdict caveat
  - Surfaced by: R3/D11
  - Files: engine/src/joints/trust.ts
  - Verify: trust test with 5 corroborations still notes (mutation run)
- [ ] **T9 (P2, human: ~4h / CC: ~25min)** — app — "confirmed by N readers"; lengths in the readers' diagram
  - Surfaced by: X5/D8, OV-2/D17
  - Files: app/src/App.tsx, engine/src/parts/schema.ts (comment)
  - Verify: node/dom test for 'community' with 2 and 'unverified' (mutation run)
- [ ] **T10 (P2, human: ~4h / CC: ~30min)** — analytics — Cloudflare beacon, GoatCounter removed
  - Surfaced by: AD2/D14, S3-2/D16, stale diagram audit
  - Files: app/src/main.tsx, app/src/linkFragment.ts, app/public/count.js, docs/plan/generic-TODOS.md
  - Verify: tag test (prod only); network panel shows no `#` fragment (V4)
- [ ] **T11 (P2, human: ~2d / CC: ~1h)** — library — audit table, fixes
  - Surfaced by: AD1/D13
  - Files: engine/data/library.ts and seed files as the audit finds
  - Verify: verdict diff 0 changed; saved-layout fixtures load
- [ ] **T12 (P2, human: ~3d / CC: ~2h)** — library — regroup after /plan-design-review
  - Surfaced by: AD1/D13, Section 11
  - Files: app/src/App.tsx, app/src/structures.dom.test.tsx
  - Verify: dom test pins groups and order; fixtures load (mutation run)

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | legal rule binds; tools only in scratchpad; |
  |                      | owner's rules only in local memory          |
  | Step 0               | SELECTIVE EXPANSION; D1 issue+PR, D2 skill  |
  |                      | by hand; additions AD1, AD2                 |
  | Section 1  (Arch)    | 1 issue found                               |
  | Section 2  (Errors)  | 9 error paths mapped, 0 GAPS                |
  | Section 3  (Security)| 2 issues found, 2 High severity             |
  | Section 4  (Data/UX) | 8 edge cases mapped, 0 unhandled (1 fixed)  |
  | Section 5  (Quality) | 2 issues found                              |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 1 gap found (accepted, D14)                 |
  | Section 9  (Deploy)  | 2 risks flagged                             |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 1           |
  | Section 11 (Design)  | 0 issues (design review recommended)        |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 9 rows, 0 CRITICAL GAPS                     |
  | Failure modes        | 9 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | 0 items proposed                            |
  | Scope proposals      | 5 proposed, 5 accepted (EXP + SEL)          |
  | CEO plan             | written                                     |
  | Outside voice        | codex completed, 6 findings, 6 resolved     |
  | Lake Score           | 1/1 recommendations chose complete option   |
  | Diagrams produced    | 6 (system, data flow, error, deploy, user   |
  |                      | flow, label state machine)                  |
  | Stale diagrams found | 2                                           |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows (PLAN_REALITY), 1 unverified       |
  +====================================================================+
```

### Unresolved Decisions

None.

## Eng review (2026-11-08, /plan-eng-review, target: this file)

### Scope record

feature answers: none asked (CEO review settled the feature list, D1-D19 of
that review); structure: A, "Original arrangement" (eng D1, 2026-11-08);
accepted scope: the CEO-approved work in its drafted layout: scripts/photo as
separate scripts (grid.py, fit1d.py, lines.py, check.py, test_check.py,
requirements.txt), palette regroup inside App.tsx, about 27 files; pending
remedies: none at the time of the answer.
Scope Challenge result: scope accepted as-is.

### Scope Challenge findings

No issues found beyond the complexity gate (D1, answered). Reuse map:
`trust.ts:57-103` (unmeasured, modelled-switch, single-source notes) hosts
the R3 caveat; `App.tsx:1590-1640` hosts the card status line; `partsByBrand`
(`App.tsx:166`) is the grouping the regroup replaces; `main.tsx:45-54` is the
counter the beacon replaces. TODOS: "Finish splitting App.tsx" (P3) is
touched, not blocked; the analytics P2 entry is updated by T10.

### Section 1: Architecture

Design-twice: the plan adds two public surfaces, the drawing skill (a
contract read by agents) and the photo scripts (a CLI). Shape A (as planned):
skill instructions in `.claude/skills/draw-piece/SKILL.md`, rules in
AGENTS.md, scripts called by path. Shape B: the skill is a thin pointer and
AGENTS.md holds the whole workflow, so any agent (Claude, Codex, others) gets
it. Pick: A for Claude Code, with E1-3 below making AGENTS.md link the skill
file so other agents can read the same steps; depth is the same.

Findings:

- [INFORMATIONAL] (confidence: 8/10) docs/plan/2026-11-08-community-pieces.md
  item 3 — red flag 8, hand-synced list: the owner's rules live in the local
  memory files (MEMORY.md index: "No individual sources, no brand names",
  "Compare render to each photo", ...) and will be copied into AGENTS.md; a
  rule the owner gives later lands in memory only. Decision E1-1 (D2).
- [INFORMATIONAL] (confidence: 8/10) items 1, 4, 9 — red flag 8 again: the
  label names (`piece: waiting`, `piece: drawing`, `piece: needs info`,
  `piece: unsupported`) are written in the form's guide text, CONTRIBUTING.md,
  the skill and the pinned issue. Decision E1-2 (D3).
- [INFORMATIONAL] (confidence: 9/10) app/src/App.tsx, app/src/shareLink.ts —
  correction, no decision: removing GoatCounter (item 12) must keep
  `LINK_FRAGMENT` (shareLink.ts imports it) and remove the action call sites
  in App.tsx along with `ACTIONS`; env.d.ts loses the `goatcounter` type.
- [INFORMATIONAL] (confidence: 8/10) item 3 — correction inside A3 ("readable
  by both humans and agents/llms"): AGENTS.md links
  `.claude/skills/draw-piece/SKILL.md` as plain steps, so agents that don't
  load Claude skills can follow it (E1-3).
- [INFORMATIONAL] (confidence: 9/10) engine/src/joints/trust.ts:84-93 — no
  change: every multi-road piece keeps "modelled, not measured" whatever its
  status, so a community-confirmed switch or crane still carries that note.
  Consistent with D17/D11.

Realistic production failures: an issue's attachment URL expires before a
builder runs the skill (DownloadError, re-upload comment, Section 2 of the
CEO review); the Cloudflare beacon is blocked (undercount, accepted D14).

## Decision ledger

### E1-1: Where the owner's working rules live
Finding: INFORMATIONAL, confidence 8/10, plan item 3, reviewer: eng review (Claude)
Plan baseline: item 3 copies the owner's memory rules into AGENTS.md (CEO H1, approved inside A3)
Runtime evidence: 10 memory files under the owner's Claude memory folder; no AGENTS.md exists
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| Rules in AGENTS.md | planned copy | AGENTS.md is the one source | copy, memory stays the source |
| Owner's memory entries for these rules | full text | replaced by one pointer memory: "working rules live in AGENTS.md" | unchanged |
| New rules the owner gives later | memory only | written into AGENTS.md (by PR) | memory only, AGENTS.md drifts |
| Test that AGENTS.md carries each rule | planned (T2) | unchanged | unchanged |
Question D2:
D2 — E1-1: Should AGENTS.md become the one place your working rules live?
Project/branch/task: ChooChooCAD on main, AGENTS.md (plan item 3).
ELI10: Your rules for me (no brand names, photos never committed, compare the render with every photo, diagrams with every measurement) live in my private memory on this machine. The plan copies them into AGENTS.md so other contributors' agents follow them. Two copies drift: the next rule you give me would land in memory only, and outside contributors would never see it.
Stakes if we pick wrong: contributors' agents follow last month's rules while yours have moved on.
Recommendation: A because one copy in the repo is what every agent, mine included, reads, and a pointer in memory sends me there.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: one source in the repo against two copies to keep in step.
Header: Rules
Options:
A) AGENTS.md is the one source (recommended)
Move the rules into AGENTS.md; replace their memory entries with one pointer memory; new rules go in by PR. Effort S (human ~1 hour / CC ~10 min), risk low. ✅ Contributors' agents and mine read the same rules. ✅ A new rule is reviewable in a PR. ❌ A new rule takes a PR instead of a sentence to me.
B) Copy, memory stays the source
AGENTS.md gets a copy; memory keeps the originals. No extra work. ✅ New rules still take one sentence to me. ✅ Nothing changes in memory. ❌ AGENTS.md falls behind every time you add a rule.

State: approved
Actual answer: A, "AGENTS.md is the one source (recommended)" (eng D2, 2026-11-08)
Accepted scope: the owner's working rules move into AGENTS.md as the one source; their memory entries are replaced by one pointer memory ("working rules live in AGENTS.md"); new rules go in by PR; T2's AGENTS.md test unchanged.
History: none

### E1-2: One list of piece labels
Finding: INFORMATIONAL, confidence 8/10, plan items 1, 4, 9, reviewer: eng review (Claude)
Plan baseline: label names written in the issue form text, CONTRIBUTING.md and SKILL.md (CEO X4/D7, OV-3/D18)
Runtime evidence: none exist yet; the repo has no .github/labels file
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| Where label names are defined | in each of 3 files | `.github/piece-labels.json`, the one list | in each of 3 files |
| Check that the files agree | none | node test: form, CONTRIBUTING.md and SKILL.md name exactly the listed labels | none |
| Pinned issue | label search links (item 9) | unchanged | unchanged |
Question D3:
D3 — E1-2: Should the piece labels come from one list with a test?
Project/branch/task: ChooChooCAD on main, the issue labels (X4, D18).
ELI10: Four labels (waiting, drawing, needs info, unsupported) will be named in the issue form's text, the contributing guide and the drawing skill. If someone renames one in one place, the skill applies a label the guide doesn't mention, or searches for one that no longer exists. A single list plus a small test that the three files agree catches that.
Stakes if we pick wrong: a renamed label silently splits the queue: issues waiting under one name, the guide pointing at another.
Recommendation: A because a two-minute test removes a whole class of drift in files agents will edit.
Completeness: A=9/10, B=6/10
Pros / cons: see each option.
Net: one small test against keeping three files in step by eye.
Header: Labels
Options:
A) One list and a test (recommended)
`.github/piece-labels.json` holds the four names; a node test reads the form, CONTRIBUTING.md and SKILL.md and fails if any names a label not in the list or misses one. Effort S (human ~1 hour / CC ~10 min), risk low. ✅ A rename in one place fails CI until all three agree. ✅ The skill and the guide can't drift apart. ❌ One more small file and test to keep.
B) Keep them in step by hand
Names written in each file; no test. No work. ✅ Nothing extra to build. ✅ Fewest files. ❌ A rename in one file goes unnoticed until the queue looks wrong.

State: approved
Actual answer: A, "One list and a test (recommended)" (eng D3, 2026-11-08)
Accepted scope: `.github/piece-labels.json` lists the four piece labels; a node test fails if the issue form, CONTRIBUTING.md or SKILL.md names a label not in the list or omits one.
History: none

### E3-1: Keep shared layouts out of analytics after GoatCounter goes
Finding: CRITICAL (regression), confidence 9/10, app/src/linkFragment.ts:25-26 `return LINK_FRAGMENT.test(hash) ? '/shared-link' : pathname || '/';`, reviewer: eng review (Claude)
Plan baseline: item 12 removes GoatCounter and `countedPath`; V4 checks once, by hand, that the beacon sends no `#` fragment (D14, D16)
Runtime evidence: today every shared-link visit is counted as `/shared-link` and the fragment is never sent (counter.dom.test.tsx); Cloudflare's beacon behaviour with `#` and with its single-page mode is unknown
Comparison grid:
| Commitment | Current | A | B | C |
|---|---|---|---|---|
| Beacon on a page opened from a shared link | n/a (GoatCounter guarded) | not loaded | loaded | loaded |
| Beacon's single-page mode (reports later URL changes) | n/a | off (`"spa": false`) | default | default |
| Automated proof | counter tests | node test: no beacon tag when the hash is a shared layout; tag carries `spa:false` | browser check in scripts/browserChecks recording the beacon request, run per release | none |
| V4 manual check | planned | still run once | still run once | the only check |
| Shared-link visits counted | yes, as /shared-link | no | yes | yes |
Question D4:
D4 — E3-1: How do we keep shared layouts out of Cloudflare once GoatCounter goes?
Project/branch/task: ChooChooCAD on main, the analytics swap (item 12, D14, D16).
ELI10: A shared layout travels in the link itself, after the # sign. Today our own counter code rewrites every such visit to "/shared-link", and tests prove the layout never leaves the browser. Removing GoatCounter deletes that code and those tests, and Cloudflare's script, loaded from their server, is not ours to fix. Simplest safe rule: don't load the beacon at all when the page was opened from a shared link, and turn off its mode that reports later address changes.
Stakes if we pick wrong: people's shared layouts end up in a third party's logs, with nothing in the tests to notice.
Recommendation: A because it guarantees the layout is never sent, with a fast node test, at the cost of not counting shared-link visits.
Completeness: A=10/10, B=8/10, C=4/10
Pros / cons: see each option.
Net: a guarantee in code (A), a measured check per release (B), or a one-time manual check (C).
Header: Shared links
Options:
A) No beacon on shared-link pages (recommended)
main.tsx inserts the beacon only when the address has no shared-layout fragment (reusing `LINK_FRAGMENT`), with `"spa": false`; a node test pins both; V4 still runs once. Effort S (human ~2 hours / CC ~15 min), risk low. ✅ The layout can't reach Cloudflare, whatever their script does. ✅ A fast test fails if anyone removes the guard. ❌ Visits that arrive through a shared link are no longer counted.
B) Load it everywhere, check per release
Beacon on every page; a browser check in scripts/browserChecks opens a shared link on a production build and asserts the beacon's request has no `#` or layout text. Effort M (human ~1 day / CC ~45 min), risk medium. ✅ Shared-link visits still counted. ✅ Catches what Cloudflare's script actually sends. ❌ Only as safe as the last run; Cloudflare can change its script between runs.
C) The one-time V4 check only
Beacon everywhere; V4 checked once by hand before GoatCounter goes. No extra work. ✅ Nothing to build or maintain. ✅ Shared-link visits counted. ❌ No test at all once the old counter tests are deleted.

State: approved
Actual answer: A, "No beacon on shared-link pages (recommended)" (eng D4, 2026-11-08)
Accepted scope: main.tsx inserts the Cloudflare beacon only when `location.hash` does not match `LINK_FRAGMENT`, with `"spa": false` in its settings; a node test pins both (no tag for a `#v1.` address; tag present with spa false otherwise; none in dev); V4 still runs once; shared-link visits are not counted. Replaces the counter tests made obsolete.
History: none

## Outside voice (eng)

Codex (gpt-6-astra), completed, 4 findings, all verified in the repo:
OV-E1 High (promotion never checks readings against the seed;
`engine/data/photoReadings.test.ts:104` does this for the owner's pieces);
OV-E2 High (a shared link pasted into an open editor reloads the page,
`app/src/App.tsx:558-566`, while the beacon is loaded); OV-E3 Medium (a
TypeScript photo toolchain already exists: `engine/tools/photoMeasure.ts`,
`photoGrid.ts`, `photoEdges.ts`, `photo.ts`, `TOLERANCE_MM`/`agreedFigure`
in `engine/data/photoReadings.ts:62,78`; images load through macOS `sips`,
`engine/tools/photoImage.ts`); OV-E4 Medium (no variant identity; dimensions
differ by country, `engine/data/thirdParty.ts:22-23`).

### OV-E3: Build on engine/tools/photo* instead of moving Python scripts
Finding: Medium, confidence 9/10, engine/tools/photoMeasure.ts:1 "`bun engine/tools/photoMeasure.ts <points.json> [--auto <photo>]`", reviewer: Codex
Plan baseline: eng D1 "Original arrangement": scripts/photo Python scripts moved from the scratchpad, check.py, test_check.py, requirements.txt; CI installs Python (OV-1/OV-5 of the CEO review)
Runtime evidence: engine/tools has photo.ts, photoGrid.ts (findGrid, perspective and lens fit), photoEdges.ts, photoCrop.ts, photoMeasure.ts CLI and tests; photoImage.ts needs macOS `sips`; TOLERANCE_MM = 1 and agreedFigure exist
Comparison grid:
| Commitment | Current (D1) | A | B | C | D |
|---|---|---|---|---|---|
| Measuring code | Python scripts moved in | engine/tools/photo* reused | Python scripts | unchanged until investigated | unchanged, row stays open |
| Photo check (X1) | check.py (Pillow) | engine/tools/photoCheck.ts: reports GPS, strips EXIF by JPEG segments in TS, grid via findGrid, reference straight found automatically (new: beech plank against paper by colour, then the existing refineEnd), repeat pair and 216 trial via agreedFigure | check.py | — | — |
| Portability | Python + Pillow | photoImage.ts gains a non-macOS path (named in T4; tests use BMP fixtures, which readBmp reads anywhere) | Python + Pillow | — | — |
| CI | new Python step | existing vitest node project (engine/**) | new Python step | — | — |
| `bun run photos` | wraps check.py | runs photoCheck.ts | wraps check.py | — | — |
| Python, requirements.txt, scratch scripts | added | none | added | — | — |
Question D5:
D5 — OV-E3: Reuse the photo-measuring code that's already in the repo?
Project/branch/task: ChooChooCAD on main, the photo tools (items 5 and 6, eng D1).
ELI10: Codex found what both earlier reviews missed: the repo already has a tested TypeScript toolchain for measuring pieces from photos (finds the grid, corrects perspective and lens bowing, refines ends, checks readings agree within 1 mm). The plan was going to move my rougher Python scratch scripts in beside it, a second copy of the same maths in another language, with its own CI setup. The existing code's one weakness is that it reads images with a macOS-only tool.
Stakes if we pick wrong: two measuring pipelines that can disagree, Python in CI for no gain, and builders confused about which to run.
Recommendation: A because it reuses tested code, drops Python entirely, and the only new work is a portable image path and the check itself.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: one tested toolchain (A) against the drafted second one (B).
Header: Photo tools
Options:
A) Apply this change (recommended)
Drop the Python scripts; the skill uses engine/tools/photo*; the check (X1) becomes engine/tools/photoCheck.ts (GPS report then EXIF strip in TypeScript, grid via findGrid, the reference straight found automatically by new code that hands its rough ends to the existing refineEnd, repeat pair and 216 trial via agreedFigure); photoImage.ts gains a non-macOS path; tests run in the existing vitest suite on BMP fixtures. Effort M (human ~4 days / CC ~2.5 h), risk low. ✅ One measuring pipeline, already tested, in the repo's own language. ✅ No Python, no new CI step, no requirements file. ❌ The automatic straight finder is still new image code that needs its own fixtures.
B) Keep this row's current value
Move the Python scripts in as eng D1 chose. Effort M, risk medium. ✅ Keeps the arrangement you picked an hour ago. ✅ The scripts already worked in my sessions. ❌ A second pipeline beside a tested one, plus Python in CI.
C) Investigate before choosing
Spend up to an hour comparing both pipelines on three of your existing photos and report the readings side by side; nothing is built. Effort S. ✅ Decides on measured agreement. ✅ Shows whether the TypeScript path handles phone photos. ❌ The photo track waits for the comparison.
D) Defer this proposed change only
Leave this row open; D1 stays the plan of record for now. No work. ✅ No change today. ✅ Can be revisited at build time. ❌ The build could start on the duplicate pipeline.

State: approved
Actual answer: A, "Apply this change (recommended)" (eng D5, 2026-11-08)
Accepted scope: no Python scripts; the skill uses engine/tools/photo*; engine/tools/photoCheck.ts reports GPS then strips EXIF (TypeScript JPEG segments), finds the grid with findGrid, finds the reference straight automatically (new colour step handing rough ends to refineEnd), checks the repeat pair and the 216 trial with agreedFigure/TOLERANCE_MM; photoImage.ts gains a non-macOS path; tests in the existing vitest suite on BMP fixtures; `bun run photos` runs photoCheck.ts. Supersedes eng D1's Python layout and CEO OV-5's Python CI step.
History: D1 answer "Original arrangement" (eng D1), reopened by Codex OV-E3: contradictory evidence (an existing tested toolchain the plan's reuse map missed). First D5 send rejected for clarification; owner asked why A dropped automatic straight detection (it need not: neither pipeline has it today); owner, 2026-11-08: "yes, keep automatic detection", so A now keeps it as new TypeScript on top of refineEnd.

### OV-E1: Readings must confirm the seed's own figures
Finding: High, confidence 9/10, engine/data/photoReadings.test.ts:104 "it('the recorded 216mm trial passes the rules it cleared (EO7)'" and the "A PART HELD AS MEASURED MATCHES ITS PHOTOS" spec below it, reviewer: Codex
Plan baseline: item 10 / D17: every figure read by 2+ distinct readers agreeing within the tolerance; then status 'community'
Runtime evidence: for the owner's pieces, a spec fails when a part's figure drifts from its readings (photoReadings.test.ts); nothing like it exists for community readings
Comparison grid:
| Commitment | Current (D17) | A | B | C | D |
|---|---|---|---|---|---|
| Readers agree with each other | required | required | required | unchanged | unchanged |
| Agreed figure matches the seed's figure within TOLERANCE_MM | unspecified | required; if not, the seed is corrected in the same PR and re-rendered against the photos | not required | — | — |
| Readings kept as evidence | unspecified | recorded beside the seed like the owner's photo readings (photoReadings.ts) | no | — | — |
| A later geometry change | unspecified | a spec fails until readings match again, which drops the piece back to 'unverified' | no check | — | — |
Question D6:
D6 — OV-E1: Must agreeing readers also match the piece's own figures?
Project/branch/task: ChooChooCAD on main, community-confirmed pieces (item 10, D17).
ELI10: The plan promotes a piece when two readers agree with each other. But the piece in the library holds its own numbers, read off photos. If two readers agree on 162 mm and the piece says 170, promoting it would vouch for the wrong number. For your own pieces a test already fails when a part's figure drifts from its photo readings; Codex's point is that community readings need the same rule.
Stakes if we pick wrong: a piece marked "confirmed by 2 readers" while its drawn size is the one they didn't measure.
Recommendation: A because it reuses the rule and test shape your own measured pieces already follow.
Completeness: A=10/10, B=6/10
Pros / cons: see each option.
Net: confirmations that confirm the shipped number (A) against confirmations of a number the piece may not hold (B).
Header: Seed match
Options:
A) Apply this change (recommended)
The agreed reading must match the seed's figure within TOLERANCE_MM (1 mm), or the seed is corrected in the same PR and re-rendered beside the photos; readings are stored like the owner's photo readings; a spec (photoReadings.test.ts shape) fails if a community piece's figure and readings drift apart. Effort S (human ~4 hours / CC ~25 min), risk low. ✅ "Confirmed" always refers to the number the layout check uses. ✅ Same evidence trail as your own measured pieces. ❌ A correction PR needs a fresh render comparison, more review per piece.
B) Keep this row's current value
Readers agreeing with each other is enough, as D17 states. No work. ✅ Simpler promotion. ✅ No stored readings. ❌ A piece can be promoted while holding a figure nobody measured.
C) Investigate before choosing
Check, on your 7 photo pieces, how far photo-read figures sit from ruler readings, then decide; nothing built. Effort S. ✅ Shows how often a mismatch would happen. ✅ Cheap. ❌ X5 waits on it.
D) Defer this proposed change only
Leave the row open; D17 stands. No work. ✅ Nothing today. ✅ Revisit at build time. ❌ X5 could be built without the check.

State: approved
Actual answer: A, "Apply this change (recommended)" (eng D6, 2026-11-08)
Accepted scope: the agreed reading must match the seed's figure within TOLERANCE_MM (1 mm) or the seed is corrected in the same PR and re-rendered beside the photos; community readings are stored beside the seed like the owner's photo readings; a spec in the photoReadings.test.ts shape fails when a community piece's figure and its readings drift apart.
History: none

### OV-E2: A shared link pasted into an open editor while the beacon is loaded
Finding: High, confidence 8/10, app/src/App.tsx:558-566 "A LINK PASTED INTO THIS TAB ... The browser does not reload for a new `#…`, so this does", reviewer: Codex
Plan baseline: eng D4: no beacon on pages loaded from a shared link; `"spa": false`; node test on the tag
Runtime evidence: an editor tab with the beacon loaded receives the new `#v1.…` address before it reloads; whether Cloudflare's script sends the current address on unload is unknown
Comparison grid:
| Commitment | Current (D4) | A | B | C | D |
|---|---|---|---|---|---|
| Fresh shared-link load | no beacon | no beacon | no beacon | unchanged | unchanged |
| Link pasted into an open editor | beacon loaded, URL holds the layout until reload | the hashchange handler moves the fragment to sessionStorage and strips it from the address (history.replaceState) before reloading; main.tsx restores it after load | unchanged; the plan states the gap and V4 also checks this path | — | — |
| Proof | node tag test | plus a dom test: after a pasted link, the address holds no fragment before reload, and the link route still opens it | V4 manual only | — | — |
| Guarantee wording | "whatever their script does" | holds for both paths | narrowed to fresh loads | — | — |
Question D7:
D7 — OV-E2: Close the pasted-link path too?
Project/branch/task: ChooChooCAD on main, the analytics guard (eng D4).
ELI10: D4 keeps Cloudflare's script off any page opened from a shared link. But if you paste a shared link into a tab where the editor is already open, the app reloads the page itself (App.tsx:558), and for a moment the address bar holds the layout while Cloudflare's script is running. If that script reports the address as the page unloads, the layout leaks. We can close this by moving the layout out of the address into the tab's own session storage before reloading.
Stakes if we pick wrong: a layout someone pasted reaches Cloudflare's logs through the one path the guard didn't cover.
Recommendation: A because it makes D4's guarantee true on both ways a shared link arrives, with a test for each.
Completeness: A=10/10, B=6/10
Pros / cons: see each option.
Net: a guarantee on both paths (A) against a documented gap (B).
Header: Pasted links
Options:
A) Apply this change (recommended)
On a pasted shared link, the existing hashchange handler stores the fragment in sessionStorage, strips it from the address, then reloads; main.tsx restores it and the link route opens as today; a dom test proves the address has no fragment before reload and the link still opens. Effort S (human ~4 hours / CC ~25 min), risk low. ✅ No address the beacon can see ever holds a layout. ✅ The paste-a-link flow still works the same for the user. ❌ Touches the link-pasting code that shipped with the share feature.
B) Keep this row's current value
Leave the paste path as is; the plan says the guard covers fresh loads only and V4 also checks the paste path once. No work. ✅ No change to working share code. ✅ Smallest diff. ❌ A known path where a layout may reach Cloudflare.
C) Investigate before choosing
Record the beacon's requests on the paste path in a production build first, then decide; nothing built. Effort S. ✅ Shows whether the leak is real. ✅ Cheap. ❌ Only true for Cloudflare's script today.
D) Defer this proposed change only
Leave the row open; D4 stands. No work. ✅ Nothing today. ✅ Revisit at build time. ❌ The swap could ship with the gap.

State: approved
Actual answer: A, "Apply this change (recommended)" (eng D7, 2026-11-08)
Accepted scope: the hashchange handler (App.tsx:558-566) stores a pasted shared fragment in sessionStorage, strips it from the address with history.replaceState, then reloads; main.tsx restores it and the link route opens as today; a dom test proves the address holds no fragment before the reload and the link still opens.
History: none

### OV-E4: Variants of the same piece
Finding: Medium, confidence 8/10, engine/data/thirdParty.ts:22-23 "The same brand varies by country. \"in some countries, dimensions of the tracks may differ a little bit\"", reviewer: Codex
Plan baseline: item 10: readings pooled per issue; disagreement beyond tolerance means a third reader is asked and nothing counts until two agree
Runtime evidence: pieces of one kind differ by country (thirdParty.ts:22-23); the form asks for a description and the pieces it joins, not markings
Comparison grid:
| Commitment | Current | A | B | C | D |
|---|---|---|---|---|---|
| Form asks for identifying markings (underside marks, country bought, year) | no | yes, required text field plus a photo of the underside | no | unchanged | unchanged |
| Readings pooled | per issue | per variant: only readers whose markings match | per issue | — | — |
| Readers disagree beyond tolerance | ask a third reader | ask both for markings first; differing markings split the issue into variants | ask a third reader | — | — |
Question D8:
D8 — OV-E4: Should readings be grouped by variant of a piece?
Project/branch/task: ChooChooCAD on main, community readings (item 10) and the issue form (item 1).
ELI10: The same piece can differ slightly by country or production run; your own notes record this for one maker. If two readers own different versions, their numbers disagree and the plan would just ask a third reader until two match, quietly throwing away a real variant. Asking for the markings on the underside (and where it was bought) lets the skill pool only like with like, and split an issue when there really are two versions.
Stakes if we pick wrong: a real variant is discarded as "noise", or two versions are averaged into a size neither has.
Recommendation: A because a markings field is cheap and turns a disagreement into information instead of noise.
Completeness: A=9/10, B=6/10
Pros / cons: see each option.
Net: like-with-like readings (A) against simpler pooling that can hide variants (B).
Header: Variants
Options:
A) Apply this change (recommended)
The form adds a required markings field and an underside photo; readings pool only across matching markings; a disagreement first asks both readers for markings, and differing markings split the issue into variants (each its own piece if both fit). Effort S (human ~3 hours / CC ~20 min), risk low. ✅ Real variants are kept, not voted away. ✅ Disagreements get explained instead of out-voted. ❌ One more field and photo for submitters and readers.
B) Keep this row's current value
Pool readings per issue; a third reader settles disagreements. No work. ✅ Simplest for submitters. ✅ No variant handling in the skill. ❌ Two real versions can be averaged or one silently dropped.
C) Investigate before choosing
Check how often variants appear in the pieces you own before deciding; nothing built. Effort S. ✅ Grounds the choice. ✅ Cheap. ❌ Your own box may not show what strangers own.
D) Defer this proposed change only
Leave the row open; item 10 stands. No work. ✅ Nothing today. ✅ Revisit when readings arrive. ❌ The first disagreement is handled by vote.

State: approved
Actual answer: A, "Apply this change (recommended)" (eng D8, 2026-11-08)
Accepted scope: the issue form adds a required markings field (underside marks, where and when bought) and an underside photo; readings pool only across matching markings; a disagreement beyond TOLERANCE_MM first asks both readers for markings, and differing markings split the issue into variants, each its own piece if both fit.
History: none

## Eng review outputs

### Reality rows (eng)

REALITY: premise-table pass 8 CEO premises plus E-premises: engine/tools photo toolchain exists (verified, engine/tools/photoMeasure.ts:1); TOLERANCE_MM = 1 (engine/data/photoReadings.ts:62); unverified=1 (P7, V3) engine/tools/photoMeasure.ts:1
REALITY: already-done finding the measuring pipeline was already built (engine/tools/photo*); plan revised by eng D5 engine/tools/photoGrid.ts:1
REALITY: surface-check pass `bun engine/tools/photoMeasure.ts <points.json> [--auto <photo>]` matches its usage line; `bun run calibration` exists engine/tools/photoMeasure.ts:38
REALITY: binding-decisions pass CEO D1-D19 and eng D1-D8 honoured; self-asserted status stays closed (built-in seeds only) docs/plan/generic-TODOS.md:761
REALITY: numbers pass about 27 files [estimated]; 70 built-ins [measured]; TOLERANCE_MM 1 [measured] engine/data/photoReadings.ts:62
REALITY: deferred-asks pass no linked issue docs/plan/2026-11-08-community-pieces.md:1
REALITY: pr-count pass three tracks, one PR per step, never stacked (CEO D19) docs/plan/2026-11-08-community-pieces.md:1

### NOT in scope (eng)

- The Python photo scripts (superseded by eng D5).
- A per-release browser check of the beacon (eng D4 B, not chosen).
- Counting shared-link visits (given up by eng D4).

### What already exists (eng, corrects the CEO list)

- `engine/tools/photo.ts`, `photoGrid.ts` (findGrid, perspective and lens
  fit), `photoEdges.ts` (refineEnd), `photoCrop.ts`, `photoMeasure.ts` CLI,
  with tests: reused for every measurement (eng D5). The CEO list named only
  the scratch scripts; that was wrong.
- `engine/data/photoReadings.ts` (`TOLERANCE_MM`, `agreedFigure`) and its
  spec: reused for the photo check and for community readings (D5, D6).
- `app/src/App.tsx:558-566` paste handler: changed by D7.
- `LINK_FRAGMENT` (`app/src/linkFragment.ts:6`): kept; reused by the beacon
  guard (D4, D7).

### Failure modes (eng)

```
PATH                         | REALISTIC FAILURE                        | TEST / HANDLING             | USER SEES
-----------------------------|------------------------------------------|-----------------------------|------------------------
beacon, fresh shared link    | layout in URL                            | not loaded (D4), node test  | nothing
beacon, pasted shared link   | layout in URL at unload                  | stripped first (D7), dom    | link opens as today
photoCheck, straight finder  | plank not found on a busy background     | fixture tests; asks for a   | reshoot comment
                             |                                          | plain background            |
photoImage on Linux/Windows  | no sips                                  | portable path (D5) or a     | clear error naming
                             |                                          | clear "use JPEG/BMP" error  | the format
community promotion          | readers agree, seed differs              | drift spec (D6)             | seed corrected in PR
variants                     | two versions pooled                      | markings (D8)               | issue split
```

Critical gaps: 0.

### Worktree parallelization strategy

| Step | Modules touched | Depends on |
|------|----------------|------------|
| T1 verification | none | — |
| T2-T3 docs, form, labels | repo root docs, .github/ | T1 |
| T4 photo check | engine/tools/ | — |
| T5-T6 skill, pilot | .claude/skills/ | T2, T3, T4 |
| T7 palette link | app/src/ | T6 |
| T8-T9 trust, readings | engine/src/joints/, engine/data/, app/src/ | — |
| T10 analytics | app/src/, app/public/ | T1 (V4) |
| T11-T12 library | engine/data/, app/src/ | design review |

Lane A: T2 → T3 (docs, .github). Lane B: T4 (engine/tools). Lane C: T8 → T9
(engine). Lane D: T10 (app). Then T5 → T6 → T7, and T11 → T12.
Execution order: launch A + B + C + D; merge; then T5, T6, T7; library last.
Conflict flags: app/src/App.tsx is touched by T7, T9, T10 and T12: sequence
them, never in parallel lanes.

## Implementation Tasks (eng review; supersedes the CEO list above where they differ)
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.
Effort assumption: features ~30x, tests ~50x, verification ~3x.

- [ ] **T1 (P1, human: ~2h / CC: ~30min)** — verification — Run V1-V4
  - Surfaced by: CEO spec review; eng D4
  - Files: none
  - Verify: each result written into this plan
- [ ] **T2 (P1, human: ~1d / CC: ~45min)** — docs — AGENTS.md as the one rules source, linking the skill; CONTRIBUTING.md; CLAUDE.md imports AGENTS.md; memory replaced by a pointer
  - Surfaced by: eng D2, E1-3; CEO A3
  - Files: AGENTS.md, CONTRIBUTING.md, CLAUDE.md
  - Verify: node test that each rule and the EXIF steps are present (mutation run)
- [ ] **T3 (P1, human: ~4h / CC: ~25min)** — github — issue form (markings, underside photo), config, piece-labels.json + agreement test, pinned issue
  - Surfaced by: eng D3, D8; CEO A1, X4, D18
  - Files: .github/ISSUE_TEMPLATE/new-piece.yml, config.yml, .github/piece-labels.json
  - Verify: node tests for required fields and label agreement (mutation run)
- [x] **T4 (P1, human: ~4d / CC: ~2.5h)** — engine-tools — photoCheck.ts on engine/tools/photo*, automatic straight finder, portable photoImage, BMP fixtures, `bun run photos`
  - Surfaced by: eng D5 (Codex OV-E3); CEO X1, OV-4
  - Files: engine/tools/photoCheck.ts, engine/tools/photoImage.ts, package.json
  - Verify: vitest on fixtures (GPS reported then stripped; straight found; repeat pair; 216 trial), mutation run
  - Done 2026-11-08: vitest on synthetic photos and BMP fixtures, each test's mutation run and recorded. The real-photo fixes (red ink on pink paper, wood across the middle, shadows, perspective, two sheets) are guarded by `bun run photos:score`, 10/10 on the owner's ten photos, which stay uncommitted; the 216 trial read 216.57 and 216.85mm. Cream or yellow paper is refused (the owner's choice: it is as warm a colour as the wood); the guide, form and CONTRIBUTING.md now ask for white, blue or pink paper.
- [ ] **T5 (P1, human: ~2d / CC: ~1.5h)** — skill — draw-piece on engine/tools
  - Surfaced by: CEO A2, S3-1, OV-1, D18; eng D5, D8
  - Files: .claude/skills/draw-piece/SKILL.md
  - Verify: T6
  - Written 2026-11-08: the skill (steps 0 to 12 and the comment templates), linked from AGENTS.md, described in CONTRIBUTING.md; a test pins its labels to the one list and AGENTS.md's link to it. Not yet run on an issue: that is T6's dry run.
- [ ] **T6 (P1, human: ~1d / CC: ~30min)** — pilot — dry run, then one outside contributor
  - Surfaced by: CEO D19
  - Files: none
  - Verify: a merged outside piece with the contributor's notes
  - Dry run 1, 2026-11-09, on #204 (the station a train drives through): location pass, sorting, trial (216.71 mm) and the can-the-app-hold-it gate worked; it stopped where a real run would, asking for a second top view. One of the two "top views" sent was the piece on its side, which the photo check passed: it finds the grid and the medium straight, not which way the piece lies. The one top view read the track at 285.96 mm against the library's 288 mm (ends hand-read), not settled by one photo. Skill fixed: Claude looks at each photo before sorting, trial photos go in `top/`. Open: a second top view and the typed markings, then dry run 2.
  - Photo check fixed after dry run 1 (2026-11-09): the paper's colour is read from the whole photo, so a large orange piece over the middle no longer reads as warm paper; the grid lines are looked for across nearly the whole photo when the middle shows none; a grid found only at a retry scale is reported as found; crops are left out of a folder; the end finder reads grey plastic by darkness. (Those two readings, 287.50 and 287.69 mm, agreed by luck: dry run 2 found the grey ends moved with the seed.)
  - Dry run 2, 2026-11-09: everything up to measuring passed (two top views, a side photo set aside, trial 216.71 mm, markings typed). The track read 287.50 and 288.26 mm, past 0.5 mm; one grey end moved 286.80 to 288.61 mm as its seed moved 3 to 6 px. Fixed: a grey end is kept only when seven seeds 0.5 mm apart agree within 0.3 mm. Read that way the photos give 286.85 and 288.24 mm. Their scales (0.980 and 0.988, the medium straight's top about 12 mm up) put the camera about 600 and 1030 mm up, and both readings fit the track's face sitting about 7 mm below the straight's, which would make it about 290 mm (inferred, not measured): the photo method assumes the measured face is at the straight's height. Skill: an **Another top view** template, and a ruler instead of a third photo when the faces differ in height. The station's length needs a ruler.
- [ ] **T7 (P2, human: ~3h / CC: ~20min)** — app — palette link after T6
  - Surfaced by: CEO X2, D19
  - Files: app/src/App.tsx
  - Verify: dom test, absent in read-only view (mutation run)
- [ ] **T8 (P2, human: ~4h / CC: ~25min)** — engine — community verdict caveat
  - Surfaced by: CEO R3/D11
  - Files: engine/src/joints/trust.ts
  - Verify: trust test with 5 readers still notes (mutation run)
- [ ] **T9 (P2, human: ~1d / CC: ~45min)** — engine+app — readings beside the seed, seed match, markings pooling, card line
  - Surfaced by: eng D6, D8; CEO X5, D17
  - Files: engine/data/photoReadings.ts, app/src/App.tsx, engine/src/parts/schema.ts
  - Verify: drift spec in the photoReadings.test.ts shape; card test (mutation run)
- [ ] **T10 (P2, human: ~1d / CC: ~45min)** — analytics — beacon guard (D4), paste-path strip (D7), GoatCounter removed
  - Surfaced by: eng D4, D7; CEO AD2, D16
  - Files: app/src/main.tsx, app/src/App.tsx, app/src/linkFragment.ts, app/public/count.js, app/src/env.d.ts, docs/plan/generic-TODOS.md
  - Verify: node tag test, dom paste test (mutation run); V4 by hand
- [ ] **T11 (P2, human: ~2d / CC: ~1h)** — library — audit table and fixes
  - Surfaced by: CEO AD1/D13
  - Files: engine/data/library.ts and seeds as found
  - Verify: verdict diff 0 changed; saved fixtures load
- [ ] **T12 (P2, human: ~3d / CC: ~2h)** — library — regroup inside App.tsx after /plan-design-review
  - Surfaced by: CEO AD1/D13; eng D1
  - Files: app/src/App.tsx, app/src/structures.dom.test.tsx
  - Verify: dom test pins groups and order; fixtures load (mutation run)

### Eng approval readiness

Approval readiness: PASS. Checked: E1-1 (eng D2), E1-2 (eng D3), E3-1 (eng
D4), OV-E3 (eng D5, superseding D1's photo layout), OV-E1 (eng D6), OV-E2
(eng D7), OV-E4 (eng D8); structure eng D1 (scope record). Corrections with
no decision: Section 1 (LINK_FRAGMENT kept, action call sites, env.d.ts;
AGENTS.md links the skill), Section 2 (script corrections, now moot after
D5; diagram update in T10).

### Eng completion summary

- Step 0: Scope Challenge — scope accepted as-is (structure: original arrangement, eng D1; photo layout later replaced by eng D5)
- Reality rows: 7/7 applicable rows emitted, 1 unverified premise
- Architecture Review: 4 issues found
- Code Quality Review: 3 issues found
- Test Review: diagram produced, 1 gap identified (E3-1, resolved by D4)
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items proposed to user
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex (gpt-6-astra), completed, 4 findings, 4 resolved (D5-D8)
- Parallelization: 4 lanes, 4 parallel / then 3 sequential steps
- Lake Score: 3/5

Test plan artifact: ~/.gstack/projects/raduuuuu-ChooChooCAD/radudiaconescu-main-eng-review-test-plan-20261108-110812.md

## Design review (2026-11-08, /plan-design-review, target: this file)

System audit: DESIGN.md (13 rules) present; UI scope: palette regroup,
request link, community card note, verdict caveat, friend-screen sentence,
shelf summaries, plus the GitHub issue form, CONTRIBUTING.md and the photo
guide. Mockups: not generated (the design tool has no image key on this
machine; the owner runs its setup, Claude never handles keys). Outside voices:
Codex (APP UI, no hard rejections, 6 findings) and a Claude design subagent
(9 findings); both flagged the card's trust presentation, the link's place,
the submission burden and the regroup spec.

### Approved design decisions

Pass 1, information architecture (3 → 7):
- D3 (1A): decorated pieces sit in their function group; Structures is for
  pieces with no track job of their own; the rule is written for
  contributors. Supersedes the earlier "Decorated after Structures" group.
- D4 (1A, against the recommendation): every Generic function group is open
  under a plain `.palette-subhead` heading; only other systems fold.
  Order: Straights, Curves, Switches and crossings, Ramps, Buffer stops,
  Structures.
- D5 (1A): the request link sits inside the parts list after the last group
  and the key line, before the editor buttons; editor only (hidden in build
  mode, the read-only phone view and the friend screen).

Pass 2, states (4 → 8):
- D6 (2A): a community card has a solid border, no `*`, no tick, and a note
  line "Sizes from two readers" after any "Works like" line; the key line
  adds "Sizes from readers: confirmed by people who own one."
- D7 (2A): the readers' caveat folds under "N notes"; the always-shown
  unmeasured count stays for unverified pieces only (rule 3 as written).
- D8 (2A): the friend screen says "Checked with catalogue sizes and readers'
  measurements." when a community piece is in the layout; a test pins both.

Pass 3, journey (4 → 8):
- D9 (3A): link text "Missing a piece? Request it on GitHub", a soft second
  line "Needs a free GitHub account; what you post there is public.", spoken
  name ending "(opens in a new tab)".
- D10 (3A): the issue form opens with a five-line checklist and the photo
  guide link, a "No medium or long straight?" path to `piece: needs info`,
  then photos, words, markings, checkboxes in plain words ("where the photo
  was taken"); CONTRIBUTING.md has three sections: Send photos, Confirm sizes,
  Draw a piece (tools only in the last).
- D11 (3A): the photo guide is published at
  woodentrain.world/photo-guide.html (font paths fixed), and its line 151 is
  split into the two paths; its first section says GitHub posts are public.
- D12 (3A): CONTRIBUTING.md states the expected wait; the skill comments
  "Started drawing this", then a link to a layout using the piece on merge;
  an unsupported reply names the closest existing piece.

Pass 4, generic-UI risk (7 → 8):
- 4.1 (owner's own wording, given in place of the question): "Add a part"
  becomes "Place a part". Note: the canvas strip already says "Placing a
  piece"; its tests must keep the two apart.

Pass 5, design system (6 → 9):
- D14 (5A): reader counts are words in the text face ("two readers"), never
  `.num`; DESIGN.md rule 4 gains one sentence saying so.
- D15 (5A): a shelf row's summary is computed from its pieces: "unverified"
  while any is, plus "N of M confirmed by readers"; the in-shelf warning is
  unchanged.

Pass 6, responsive and accessibility (5 → 8):
- D16 (6A): the card note has its own line, wraps instead of truncating, and
  ends the card's aria-label and tooltip; a dom test checks it at 320px.
- D17 (6A): the link is `--ink-soft` underlined text, the tokens.css focus
  ring, a 44px hit area on coarse pointers, in tab order after the key line.
Phones get the read-only view, which hides the palette: no phone palette.

Pass 7, unresolved decisions:
- D18 (7A, then reversed to 7B by the owner, 2026-11-08: "skip this step,
  the process you shared is not working (refuses a valid Gemini key)"): no
  mock first. The regroup (T12) is built from this review's written spec on
  its own branch; the owner checks it live in the browser and /design-review
  checks the 320px rail before it merges. History: 7A (mock first after the
  owner set up the design tool) was chosen, then dropped when the design
  tool's setup refused a valid Gemini key.

### Interaction states

```
FEATURE                | LOADING | EMPTY                      | ERROR                    | SUCCESS                         | PARTIAL
-----------------------|---------|----------------------------|--------------------------|---------------------------------|-------------------------------
Regrouped palette      | n/a     | a group with no parts is   | n/a                      | groups in the D4 order, open    | a system with only straights
                       |         | not shown                  |                          |                                 | shows one group
Request link           | n/a     | n/a                        | n/a (a plain link)       | GitHub form opens in a new tab  | n/a
Community card note    | n/a     | no note (not community)    | unknown status fails     | "Sizes from two readers"        | one reader: "Unverified size"
                       |         |                            | closed (trustRank)       |                                 | stays
Readers' caveat        | n/a     | none                       | n/a                      | in "N notes"                    | n/a
Friend-screen sentence | n/a     | n/a                        | n/a                      | catalogue / catalogue+readers   | n/a
Shelf summary          | n/a     | n/a                        | n/a                      | "unverified" / "N of M ..."     | mixed shelf shows both
```

### Submitter journey

```
STEP | USER DOES                          | USER FEELS              | PLAN SPECIFIES
-----|------------------------------------|-------------------------|-----------------------------------------
1    | Misses a piece in the palette      | mild frustration        | the request link right there (D5, D9)
2    | Reads "needs a GitHub account..."  | informed, not tricked   | second line (D9)
3    | Opens the form: checklist first    | "I can do this"         | checklist, no-reference path (D10)
4    | Shoots photos with the guide       | guided                  | published guide (D11)
5    | Waits                              | patient (knows the wait)| stated wait, "Started drawing" (D12)
6    | Sees the piece in the app          | proud, credited         | merge comment with a layout link (D12, D10 of CEO)
6b   | Piece unsupported                  | let down, but helped    | reason plus nearest existing piece (D12)
```

### Design NOT in scope

- A drawn community mark (D6 B).
- An always-shown readers line in the verdict (D7 B).
- Folding function groups (D4 B).
- Fixing "Checked with catalogue sizes." for photo-read pieces: recorded as a
  P2 TODO (D19).

### What already exists (design)

DESIGN.md rules 1, 3, 4, 7, 9, 10, 11, 13; the brand shelf `<details>` and
its in-shelf warning; `.palette-subhead`; the card's `.piece-note` and the key
line; the verdict's "N notes" fold; `linkWords.ts` sentences;
`docs/photo-guide.html`.

## Implementation Tasks (design review; adds to the eng list)
Synthesized from this review's findings. Effort assumption: features ~30x.

- [ ] **D-T1 (P1, human: ~4h / CC: ~25min)** — docs+github — form checklist and order; CONTRIBUTING.md in three sections; stated wait
  - Surfaced by: Pass 3 — D10, D12
  - Files: .github/ISSUE_TEMPLATE/new-piece.yml, CONTRIBUTING.md
  - Verify: the T3 form test pins the checklist and order (mutation run)
- [ ] **D-T2 (P1, human: ~3h / CC: ~20min)** — docs — publish the photo guide, fix line 151
  - Surfaced by: Pass 3 — D11
  - Files: docs/photo-guide.html, app/public/photo-guide.html
  - Verify: the built site serves /photo-guide.html with its fonts; no "stay on your machine" for the issue path
- [ ] **D-T3 (P1, human: ~2h / CC: ~15min)** — skill — comment templates
  - Surfaced by: Pass 3 — D12
  - Files: .claude/skills/draw-piece/SKILL.md
  - Verify: the T6 dry run shows each comment
  - Written 2026-11-08 in the skill's "Comment templates"; the dry run is pending.
- [ ] **D-T4 (P2, human: ~3h / CC: ~20min)** — app — request link spec
  - Surfaced by: Pass 1 D5, Pass 3 D9, Pass 6 D17
  - Files: app/src/App.tsx, app/src/app.css
  - Verify: dom test (place, editor only, name); CSS test (token, 44px coarse) (mutation run)
- [ ] **D-T5 (P2, human: ~4h / CC: ~25min)** — app — community card note
  - Surfaced by: Pass 2 D6, Pass 5 D14, Pass 6 D16
  - Files: app/src/App.tsx, app/src/app.css, DESIGN.md
  - Verify: dom test at 320px, aria-label ends with the note (mutation run)
- [ ] **D-T6 (P2, human: ~3h / CC: ~20min)** — app — caveat folded; friend-screen sentence
  - Surfaced by: Pass 2 D7, D8
  - Files: app/src/VerdictLine.tsx, app/src/linkWords.ts
  - Verify: tests for the fold and both sentences (mutation run)
- [ ] **D-T7 (P2, human: ~30min / CC: ~5min)** — app — "Place a part"
  - Surfaced by: Pass 4 (owner's wording)
  - Files: app/src/App.tsx
  - Verify: tests distinguish it from the "Placing a piece" strip
- [ ] **D-T8 (P2, human: ~2h / CC: ~15min)** — app — shelf summaries derived
  - Surfaced by: Pass 5 D15
  - Files: app/src/App.tsx
  - Verify: test with a mixed shelf (mutation run)
- [ ] **D-T9 (P2, human: ~1d / CC: ~45min)** — library — regroup from the written spec, reviewed live
  - Surfaced by: Pass 1 D3, D4; Pass 7 D18
  - Files: app/src/App.tsx
  - Verify: owner checks the branch live and /design-review passes on the 320px rail before merge; dom test pins groups and order

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (13 rules); UI: palette,  |
  |                      | cards, verdict, friend screen, GitHub form  |
  | Step 0               | 4/10; all 7 passes (D1)                     |
  | Pass 1  (Info Arch)  | 3/10 → 7/10 after fixes                     |
  | Pass 2  (States)     | 4/10 → 8/10 after fixes                     |
  | Pass 3  (Journey)    | 4/10 → 8/10 after fixes                     |
  | Pass 4  (AI Slop)    | 7/10 → 8/10 after fixes                     |
  | Pass 5  (Design Sys) | 6/10 → 9/10 after fixes                     |
  | Pass 6  (Responsive) | 5/10 → 8/10 after fixes                     |
  | Pass 7  (Decisions)  | 1 resolved, 0 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 1 item proposed (added, D19)                |
  | Approved Mockups     | 0 generated, 0 approved (no image key)      |
  | Decisions made       | 16 added to plan                            |
  | Decisions deferred   | 0                                           |
  | Overall design score | 3/10 → 7/10                                 |
  +====================================================================+
```

Pass 1 stays at 7: the regroup is specified in words only, with no visual
mock (D18 reversed to review-live), and all groups open means a long scroll
past 21 switches (D4, the owner's choice).

### Unresolved Decisions

None.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 5 proposals, 5 accepted, 0 deferred (plus 2 owner additions) |
| Outside Review | codex (CEO, eng and design outside voices) | Independent 2nd opinion | 3 | completed | CEO: 6 findings, 6 resolved; eng: 4 findings, 4 resolved; design: 6 findings, 6 resolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN | 8 issues, 0 critical gaps (all mapped to approved tasks) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | ISSUES OPEN | score: 3/10 → 7/10, 16 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, three completed runs: plan-review after CEO (6 findings), plan-review after eng (4 findings), design phase (APP UI, no hard rejections, 6 findings). Plus a native Claude design subagent (9 findings; native, not outside coverage). All findings resolved into decisions D3-D18 of the design review or earlier.
- **CROSS-MODEL:** Codex (gpt-6-astra) and the Claude design subagent (Claude Opus 5.5) agreed on the card's trust presentation, the link's placement, the submission burden and the thin regroup spec; Codex alone flagged the photo guide's privacy sentence and the "Add a part" confusion; the subagent alone flagged the friend-screen sentence and rule 4's units.
- **VERDICT:** CEO CLEARED. Eng review complete (0 unresolved, 0 critical gaps; issues_open because its findings became tasks). Design review complete (0 unresolved); overall 7/10 because the regroup is reviewed live after it is built rather than mocked first (D18, reversed by the owner). Eng review required.

NO UNRESOLVED DECISIONS
