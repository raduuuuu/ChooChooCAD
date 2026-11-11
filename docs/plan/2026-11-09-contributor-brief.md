# Plan: a contributor brief, so the contributor's own Claude draws the piece

Status: built and live (T1 to T6, #244 to #254, 2026-11-10); eng review of the
built code 2026-11-11 found ten fixes, T7 to T10, all approved. Reopens the
intake (A1) and agent (A2) of `docs/plan/2026-11-08-community-pieces.md`.

Owner's ask (the /plan-ceo-review arguments, 2026-11-09): "let's completely
rethink community contributions. Let's have and MD file that people can
download from the github repo. That user then uploads that file into their
favourite LLM (Only Claude in the beginning but we can do it for others
afterwards). The file should contain instructions for the LLM on what to ask
from the user, what skills to install, then build the model and only after the
part is drawn, then it opens a github issue. There needs to also be a link on
the main website. Also in the current Contributing.md file, it says a side
photo is optional. It should be mandatory"

## Step 0 evidence

### 0A. Premise

- **The real problem.** One person draws every piece. A piece issue waits
  until the maintainer (or a builder with Claude Code, bun and macOS) runs
  `/draw-piece`, and each question back to the sender (a reshoot, a ruler
  figure) is an issue comment answered days later. The two dry runs on #204
  (2026-11-09) needed a reshoot round and a ruler round before any drawing.
- **The proposal moves the drawing to the sender's own Claude**, in one
  sitting: it asks, checks, measures, draws, and only then is an issue opened,
  carrying a drawn piece for the maintainer to review instead of draw.
- **Direct or proxy.** Direct only if the sender's Claude measures to the
  library's standard: two top views agreeing within 0.5 mm, read by the repo's
  tested photo tools (`engine/tools/photo*.ts`, `agreedFigure`). A chat Claude
  reading figures by eye produces a drawing the maintainer must re-measure:
  then it's a proxy, and the bottleneck stays.
- **Do-nothing cost.** Pieces arrive as photo issues; the maintainer draws
  each. No outside contributor has used the flow yet (the T6 pilot is open).

### 0B. Existing code leverage

| Sub-problem | Existing | Reuse |
|---|---|---|
| What to ask, which photos, reshoot words | `app/photo-guide.html`, `.github/ISSUE_TEMPLATE/new-piece.yml`, `/draw-piece` steps 4 to 7 and its comment templates | The brief points the chat Claude at the same steps; one source of the rules (AGENTS.md, eng D2) |
| Location data | `engine/tools/photoExif.ts` (`hasLocation`, `stripMetadata`), pure TypeScript | Runs wherever TypeScript runs |
| Grid, scale, ends, agreement | `engine/tools/photoCheck.ts`, `photoMeasure.ts`, `photoEdges.ts`, `photoReadings.ts` | Must run in the chat's sandbox, or the drawing is by eye (0A) |
| Image decoding | `engine/tools/photoImage.ts`: sips on macOS, ImageMagick or ffmpeg elsewhere | Unverified in the sandbox |
| Can the app hold it | `/draw-piece` step 6, `piece: unsupported` | Reused as the brief's early gate |
| A drawn piece the app can show | `app/src/SubmitPart.tsx`: straights and curves typed in, kept in the browser | Covers simple pieces only; a decorated piece is code (a seed entry) |
| Render beside every photo | gstack's browser on the maintainer's machine | Not in a chat sandbox |
| Labels, intake form, checkup checks | `.github/piece-labels.json`, the form, `bun run checkup --content` | Kept |

### Landscape (Aside, 2026-11-09; untrusted, cited)

- Skills in the Claude apps: uploaded as a ZIP in Customize > Skills, code
  execution on. The help center (updated 2026-10-30) lists Free; the developer
  docs list paid plans only. support.claude.com/en/articles/12512180,
  platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Code execution in the apps: every plan, on by default for personal plans;
  network to an allowlist that includes github.com, npm and PyPI, not
  raw.githubusercontent.com. support.claude.com/en/articles/12111783 (2026-11-05)
- Node runs in the sandbox; Bun and reading EXIF there are not documented.
- A prefilled GitHub issue URL fails at 8,192 bytes (one project's test,
  github.com/ALCops/rulebook-engine/issues/25, 2026-10-03); a URL cannot
  attach images (github.com/orgs/community/discussions/189735, 2026-03-16).

Layer 3: the conventional move is "let an LLM fill in a form". What decides
this one is whether the sender's Claude runs the same measuring code the
maintainer does. If it does, the sender's chat becomes the drawing session and
the maintainer reviews. If it doesn't, the brief is a better intake form.

### 0C. Dream state

```
  CURRENT                            THIS PLAN                            12-MONTH IDEAL
  photos in an issue; the            a brief the sender gives their     a piece arrives drawn, measured by
  maintainer draws each piece   ---> Claude: asks, checks, measures, ---> the repo's own tools, with its photos
  through comment rounds             draws; the issue carries the        and ruler figures; the maintainer
                                     drawing                             reviews and merges; any LLM
```

### Reality rows

| Premise | Claim | Receipt | Verdict |
|---|---|---|---|
| P1 | CONTRIBUTING says side photos only if asked | CONTRIBUTING.md:30-31 | true |
| P2 | The photo guide says the same | app/photo-guide.html:114-115 | true |
| P3 | The site has no contribute link today | no match in app/src/App.tsx, app/index.html | true |
| P4 | The site link is gated by an outside pilot | docs/plan/2026-11-08-community-pieces.md:190 (D19) | true; conflicts with the ask |
| P5 | The app shows only typed straights and curves as submissions | app/src/SubmitPart.tsx:52-60 | true |
| P6 | The sandbox can clone github.com and run the photo tools | Aside research only | unverified |
| P7 | Free plans can upload a skill | sources disagree | unverified |

unverified=2

REALITY: premise-table finding 7 claims, 2 unverified (P6 sandbox runs the tools, P7 Free skills) docs/plan/2026-11-09-contributor-brief.md:90
REALITY: already-done pass no contributor brief on main since 2026-11-09; the side-photo text is from 30ad7ed (2026-11-08) CONTRIBUTING.md:30
REALITY: surface-check finding the sandbox commands (git clone, bun, ImageMagick) are unprobed; a spike verifies them engine/tools/photoImage.ts:1
REALITY: binding-decisions finding D19 gates the site link on an outside pilot; D2 (no AI or secrets in GitHub) is kept: the AI runs on the sender's account docs/plan/2026-11-08-community-pieces.md:190
REALITY: numbers pass 8,192-byte URL limit [cited, 2026-10-03]; 0.5 mm agreement [measured: engine/data/photoReadings.ts]; effort figures [estimated] engine/data/photoReadings.ts:1
REALITY: deferred-asks pass no linked issue; "others afterwards" deferred by the owner's own words docs/plan/2026-11-09-contributor-brief.md:12
REALITY: pr-count pass no ship policy: one PR per step, never stacked (AGENTS.md) AGENTS.md:83

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| C1 approach (owner) | The ask; 0A direct-or-proxy; P5, P6 | A: the brief has the sender's Claude measure with the repo's tools in its sandbox and draw; a spike decides first; no fallback (C7) | B, C declined | approved | C7 (D6) later removed the fallback to B. Owner, 2026-11-09, D1: "1 but don't neccesarrily test against the photos in 204. See if there aren't any other better photos to be used". Scope: A; the spike's photos are the best available, not #204's: the 216 mm trial pair (84401, 84402, a known answer) as the accuracy gate, and one wooden library piece end to end (not the station: its track sits below the straight's top and reads short, 2026-11-09). |
| C2 side photo (owner) | P1, P2; reverses the 2026-11-08 T6 decision ("make that as an optional step and requested only if needed") | optional, asked when needed | mandatory, still without grid paper (the reason it was made optional) | approved | Owner, 2026-11-09: "in the current Contributing.md file, it says a side photo is optional. It should be mandatory". Scope: CONTRIBUTING.md, the photo guide, the form and the skill's required views. |
| C3 Claude first (owner) | The ask | n/a | the brief targets Claude; other LLMs later | approved | Owner, 2026-11-09: "Only Claude in the beginning but we can do it for others afterwards". Other LLMs deferred by that sentence. |
| C4 issue after drawing (owner) | The ask | issue first, drawing after | the issue is opened only once the piece is drawn | approved | Owner, 2026-11-09: "only after the part is drawn, then it opens a github issue". |
| C5 site link (owner) | The ask; P3, P4 (D19 gate) | A: the link is built and merged with the brief, switched on after one outside sender finishes the brief; D19 stands | B declined | approved | Owner, 2026-11-09, D2: "Built now, on after one pilot (recommended)". |
| C6 the file itself (owner) | The ask | none | a Markdown file in the repo, downloadable | approved | Owner, 2026-11-09: "an MD file that people can download from the github repo". |
| E1 preview link (owner) | 0G candidate; P5; AGENTS untrusted input | A: the brief's Claude ends with a link that opens the drawn piece in woodentrain.world, read-only, beside the library; the maintainer opens it from the issue; same checks as submissions, caps like share links | B, C declined | approved | Owner, 2026-11-09, D4: "Add to this plan's scope (recommended)". |
| E2 brief version (owner) | 0G candidate | A: the brief starts with a version and date; its Claude copies them into the issue; a test keeps the version in step | B, C declined | approved | Owner, 2026-11-09, D5: "Add to this plan's scope (recommended)". |
| C7 the photo-only form (owner) | "completely rethink" (the ask); C1's fallback B; senders without code execution | B: retired; the brief is the only way to contribute; /draw-piece keeps only its review path | A declined | approved | Owner, 2026-11-09, D6: "Retire it" (recommendation was A). Consequence for C1: no automatic fallback; if the spike fails, the plan returns to the owner. |
| C8 photos off GitHub (owner) | The owner's own pilot run, 2026-11-09: the chat asked for a side photo retaken for privacy "as it goes on GitHub publicly" | photos posted with the issue, location removed (C4, step 2) | photos stay in the sender's chat; the issue carries the figures, the points files, the `--json` outputs and the diff, never a photo, crop or overlay | approved | Owner, 2026-11-09: "keep photos off GitHub, update the brief". Done in the brief (draft-2): a blank issue, no location step. Consequences for T3 on: the maintainer can no longer re-measure from attachments or render beside the photos; review checks the outputs' consistency and the drawing against the figures. The drawn-piece and unsupported-piece forms lose their photo fields and checkboxes; the spike's GitHub re-upload item and the phone path's "drag them into GitHub" are dropped. Each needs rework at T3. |
| C9 the bare minimum measured (owner) | The owner's pilot run, 2026-11-09: a bridge got nine ruler readings (E1 to E9), and a side drawing that didn't match its side photo | every figure the drawing lacks, by ruler; straights and plain curves also by ruler, to compare (UC1 b) | the track from the top views; a figure matching the library suggested for a yes or no; a ruler only for a clear height or width a train could hit, when the side photo's estimate is within 15 mm of the 55 mm train; everything else inferred, the side view traced off the side photo scaled by the piece's own length; no grid paper for the side photo | approved | Owner, 2026-11-09: "Apart from the essential measurements like track length and anything that can potentially block a passage like height the rest should be inferred … The user should measure the bare minimum". Reverses UC1 b's ruler comparison. Done in the brief (draft-3). |
| U1 unsupported pieces (owner) | spec review 1.1; OV-3 (D18) | A: the brief stops before drawing, explains, and prepares a short issue (the piece, photos, the reason) labelled piece: unsupported; the one exception to C4 | B declined | approved | Owner, 2026-11-09, D7: "Post an \"unsupported\" issue (recommended)". |
| S1-1 old brief, newer repo (Section 1) | E2; a frozen download against a moving repo | A: after cloning, the brief's Claude compares versions; a newer brief in the clone is followed instead, said to the sender, and its version recorded in the issue | B, C declined | approved | Owner, 2026-11-09, D9: "Follow the clone's brief (recommended)". |
| S3-1 markings in public (Section 3) | AGENTS.md no-brand rule; pooling by variant | A: the brief's Claude copies markings into the issue with any maker's name replaced by "the maker"; numbers, years, "Made in", moulding stay | B, C declined | approved | Owner, 2026-11-09, D10: "Leave makers' names out (recommended)". |
| OV-1 when the form retires (outside review) | C7 (D6) timing; D19 | A: the brief, forms and preview ship with the brief unlinked; the photo form and CONTRIBUTING's photo path stay until one outside sender finishes the brief; then one PR retires the form and points CONTRIBUTING at the brief | B declined | approved | Owner, 2026-11-09, D11: "Retire after the pilot (recommended)". C7's retirement stands; only its timing moved. |
| OV-2 draft-brief pilot first (outside review) | E1 (D4) timing; fallback finding 4 | A: after the spike, one outsider runs a draft brief and posts the part data as plain text on the existing form; the preview, validator, codec and briefLink are built after, shaped by it; the gating pilot (C5, OV-1) still runs after the build | B declined | approved | Owner, 2026-11-09, D12: "Draft-brief pilot first (recommended)". E1 stays in scope; only its timing moved. |
| P-1 the gating pilot (owner) | D19, C5, OV-1: the link and the photo form's retirement waited on one outside sender finishing the brief | an outside pilot | the owner's own dry run (#231, bridge, 2026-11-09) counts as the pilot | approved | Owner, 2026-11-10: "we can consider this done via my own dry run." T6's gate is cleared; the link still waits on T3 to T5 being built. |
| P-2 the phone path (owner) | Spike item "photos uploaded from the Claude phone app", never run | to be tested before the pilot | not tested: the brief tells senders to take the photos with their phone's own camera app, then attach them in the chat | approved | Owner, 2026-11-10: "let's bypass this completely and instruct users to take the photos with their main camera app." |
| P-3 photos never on GitHub (owner) | C8 kept the brief's photos in the chat; the photo form, CONTRIBUTING, the photo guide and /draw-piece's download path still posted them | the photo form open until T6 | no photo goes on GitHub, from anyone: the photo form retires now, the review works from the issue's figures, points files, tool outputs and diff, and asks the sender whether the render matches | approved | Owner, 2026-11-10: "photos stay outside of github, reword everything needed." |
| P-4 Free plans (owner) | Spike item "whether a Free account can enable code execution …", never run | to be tested | assumed to work; not tested | approved | Owner, 2026-11-10: "let's not worry about this for now. a free plan should be able to handle this" |

## Answered: C1 (D1)
The record below is the question as asked. The answer changed it: the spike's
photos are not #204's (C1 row), and C7 later removed the fallback to B.

Commitment comparison:

```text
Commitment                          | Source/approval or pending | Current            | A (brief draws, spike first)            | B (brief as intake assistant)   | C (A + Claude Code door)
A downloadable brief for Claude     | C6 approved                | none               | yes                                     | yes                             | yes
Who asks the sender's questions     | the ask                    | issue comments     | the sender's Claude, in one sitting     | the sender's Claude             | the sender's Claude
Side photo and ruler figures        | C2 approved; AGENTS heights| asked later        | in the chat                             | in the chat                     | in the chat
Who measures                        | 0A                         | maintainer's tools | the repo's tools in the sender's sandbox| maintainer, after the issue     | sandbox, or local Claude Code
Who draws                           | the ask                    | maintainer         | the sender's Claude                     | maintainer                      | the sender's Claude
Issue opened after drawing          | C4 approved                | before             | yes                                     | no: before drawing              | yes (or a PR from Claude Code)
Maintainer's role                   | A2                         | draws              | reviews: /draw-piece checks a drawing   | draws, fewer rounds             | reviews
Feasibility proven before building  | P6 unverified              | n/a                | yes: a spike on the #204 photos         | not needed                      | yes
Effort                              | estimated                  | -                  | L (human ~2 weeks / CC ~5 h)            | M (human ~1 week / CC ~2 h)     | XL (human ~3 weeks / CC ~8 h)
```

Question: D1 — C1: How far does the contributor's own Claude go?
Project/branch/task: ChooChooCAD, contributor-brief-plan: replacing photo-issue intake with a brief the sender gives their Claude.
ELI10: Today a parent posts photos and you draw the piece, with days between each question. The brief hands that job to the parent's own Claude chat. The catch is accuracy: the library's figures come from this repo's measuring tools, which agree to half a millimetre. Claude's chat sandbox can probably download the repo and run those tools, but nobody has tried, and if it can't, its figures are guesses you would re-measure anyway.
Stakes if we pick wrong: either pieces arrive "drawn" with figures you can't trust and redo, or the parent's Claude stays a form-filler and you keep drawing every piece.
Recommendation: A because it is what you asked for, and the spike on the #204 photos proves the sandbox runs the measuring tools before anything is built; if it can't, the plan falls back to B with no work wasted.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: the parent's Claude draws (A), only gathers (B), or draws plus a developer door (C).
Header: Approach
A) Claude draws, spike first (recommended)
The brief has the sender's Claude download the repo in its sandbox, check and measure the photos with the repo's own tools, ask for the side photo and ruler figures in the chat, draw the piece, and prepare the issue; you review instead of draw. A spike on the #204 photos runs first and decides. Effort L (human ~2 weeks / CC ~5 h), risk medium. ✅ The sender answers every question in one sitting, not over days of comments. ✅ Figures come from the same tested tools you use, so a drawing is reviewable, not redone. ❌ Depends on the sandbox running the tools; the spike may send it back to B.
B) Claude gathers, you still draw
The brief has the sender's Claude ask the questions, check the photos and the side photo, take the ruler figures, and post a complete issue; drawing stays with /draw-piece. Effort M (human ~1 week / CC ~2 h), risk low. ✅ Works in any Claude chat with no sandbox tools at all. ✅ Issues arrive complete, so the comment rounds of the dry runs disappear. ❌ You still draw every piece, and it opens the issue before the drawing, not after as you asked.
C) A, plus a door for Claude Code users
Everything in A, and the brief tells someone who has Claude Code to clone the repo and run /draw-piece themselves, ending in a pull request. Effort XL (human ~3 weeks / CC ~8 h), risk medium. ✅ Developers skip the issue and send a finished pull request. ✅ Uses the skill that already exists for builders. ❌ Two paths to maintain and test, for an audience of parents who mostly don't have Claude Code.

## Answered: C5 (D2)
Commitment comparison:

```text
Commitment                         | Source/approval or pending        | Current               | A (built now, on after a pilot) | B (on when the brief merges)
A link on woodentrain.world        | the ask, 2026-11-09               | none (P3)             | yes                             | yes
When the public first sees it      | D19 (2026-11-08): pilot gates it  | after an outside pilot| after one outside sender finishes the brief | the day the brief merges
Who finds the rough edges first    | D19 reason                        | one invited sender    | one invited sender              | whoever clicks first
Effort                             | estimated                         | -                     | S (human ~2 h / CC ~15 min)     | S (human ~2 h / CC ~15 min)
```

Question: D2 — C5: When does the site's contribute link go live?
Project/branch/task: ChooChooCAD, contributor-brief-plan: the link to the brief on woodentrain.world.
ELI10: You asked for a link on the site. Yesterday you also decided (D19) that the public link waits until one outside person has used the contribution flow end to end, so the first stranger doesn't hit the rough edges. The brief is a new flow nobody outside has tried. The link can be built now either way; the question is only when it turns on.
Stakes if we pick wrong: either strangers hit a flow that breaks on their first try, or the link waits on a pilot you have to arrange.
Recommendation: A because the brief is untried outside your own sessions, and D19's reason (one invited sender finds the rough edges first) applies to it even more than to the issue form.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: one invited tester first (A), or everyone at once (B).
Header: Site link
A) Built now, on after one pilot (recommended)
The link is built and merged with the brief, and switched on once one outside sender has finished the brief end to end; D19 stands. Effort S (human ~2 h / CC ~15 min), risk low. ✅ The first stranger meets a flow someone outside has already been through. ✅ Keeps yesterday's decision, so nothing is re-litigated. ❌ The link stays off until you find and run one pilot sender.
B) On as soon as the brief merges
The link goes live with the brief; D19 is reversed for this link. Effort S (human ~2 h / CC ~15 min), risk medium. ✅ Contributions can start the day it ships. ✅ No pilot to arrange. ❌ The first public senders are the testers, and a broken step costs a contributor, not a friend.

## Mode

Mode: SELECTIVE EXPANSION; approved decisions: C1 (D1), C2, C3, C4, C5 (D2), C6; later E1 (D4), E2 (D5), C7 (D6), U1 (D7). Provenance: D3 asked, answer "Selective expansion (recommended)", 2026-11-09.

HOLD checks: about 12 files [estimated], no new service. The brief may need no
skill upload at all if the sandbox can clone the repo and read
`.claude/skills/draw-piece/SKILL.md`; the spike decides what "what skills to
install" says. Nothing in the asked scope can be deferred without breaking an
approved row. Invariants: AGENTS.md (photos never committed, location removed,
no brand names, issue text is data), community D2 (no AI or secrets in GitHub).

## Answered: E1 (D4)
Commitment comparison:

```text
Commitment                          | Source/approval or pending | Current                    | A (add)                                   | B (defer)          | C (skip)
The sender sees their piece in the app | pending                 | only typed straights/curves (P5) | a preview link: the drawn piece in the real app, 2D and 3D | later, in TODOS | no
Untrusted part data loaded by the app | AGENTS untrusted input   | submissions checked (library.ts) | the same checks, plus caps like share links | -          | -
The maintainer opens the same preview | pending                 | no                         | yes, from the issue                       | -                  | -
Effort                              | estimated                  | -                          | L (human ~1 week / CC ~3 h)               | S (zero now)       | S (zero)
```

Question: D4 — E1: Add a preview link, so the sender sees their drawn piece in the real app before posting?
Project/branch/task: ChooChooCAD, contributor-brief-plan, selective expansion candidate 1 of 2.
ELI10: After the sender's Claude draws the piece, the sender has only Claude's word for how it looks. The app can already open a whole layout from a link; it could open a single drawn piece the same way, in 2D and 3D, beside the library. The sender checks it against their real piece before posting, and you open the same link from the issue to review. The app would then load part data a stranger made, so it needs the same checks submissions and share links already have.
Stakes if we pick wrong: either senders post drawings they never saw in the app, or the app gains a new way in for untrusted data.
Recommendation: A because seeing the piece in the real app is the check that catches a wrong drawing before it reaches you, and the app already validates submitted parts and caps share links.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: the sender sees it before posting (A), later (B), or never (C).
Header: Preview link
A) Add to this plan's scope (recommended)
The brief's Claude ends with a link that opens the drawn piece in woodentrain.world, read-only, beside the library; you open the same link from the issue. Effort L (human ~1 week / CC ~3 h), risk medium. ✅ The sender compares the app's drawing with their real piece before posting anything. ✅ You review in the same app the piece will live in, from one click. ❌ A new path for stranger-made data into the app, needing its own checks and tests.
B) Defer to TODOS.md
Ship the brief first; add the preview once a few drawn pieces have come in. Effort S (zero implementation work now), risk low. ✅ Keeps the first build to what you asked for. ✅ Real submissions show what a preview must handle. ❌ Early senders post drawings they never saw in the app.
C) Skip
No preview; the issue carries the drawing and its pictures only. Effort S (zero implementation work), risk low. ✅ No new way for untrusted data into the app. ✅ Nothing extra to maintain. ❌ The sender can't check the drawing in the app, and you rebuild it to look.

## Answered: E2 (D5)
Commitment comparison:

```text
Commitment                          | Source/approval or pending | Current | A (add)                                         | B (defer)       | C (skip)
The issue says which brief drew it  | pending                    | n/a     | a version line in the brief, copied into the issue | later        | no
The maintainer can tell an old brief| pending                    | n/a     | yes: an outdated version is asked to redo the step that changed | -     | -
Effort                              | estimated                  | -       | S (human ~1 h / CC ~10 min)                     | S (zero now)    | S (zero)
```

Question: D5 — E2: Stamp a version on the brief, and have the issue carry it?
Project/branch/task: ChooChooCAD, contributor-brief-plan, selective expansion candidate 2 of 2.
ELI10: People download the brief once and may use an old copy for months. When you change the brief (a new photo rule, a fixed measuring step), you can't tell from an issue which rules drew it. A version line at the top of the brief, which its Claude copies into the issue, tells you at a glance, and an old one can be asked to redo the step that changed.
Stakes if we pick wrong: either you review drawings made under rules you've since fixed without knowing, or you add a line nobody needs.
Recommendation: A because the brief will change after the pilot and the spike, and one copied line is the cheapest way to know which rules a drawing followed.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: know which brief drew it (A), later (B), or never (C).
Header: Brief version
A) Add to this plan's scope (recommended)
The brief starts with a version and date; its Claude copies them into the issue, and a test keeps the version in step with the brief's changes. Effort S (human ~1 h / CC ~10 min), risk low. ✅ You see at once whether a drawing followed the current rules. ✅ An outdated sender is asked to redo only what changed. ❌ One more thing to bump whenever the brief changes.
B) Defer to TODOS.md
Add the version once the brief has changed for the first time. Effort S (zero implementation work now), risk low. ✅ Nothing extra in the first build. ✅ The first change shows what a version must capture. ❌ Issues from before it can't be told apart.
C) Skip
No version; the maintainer reads each drawing on its merits. Effort S (zero implementation work), risk low. ✅ Nothing to keep in step. ✅ The review checks the drawing anyway. ❌ An old copy's mistakes look like the sender's.

## Answered: C7 (D6)
Commitment comparison:

```text
Commitment                              | Source/approval or pending | Current                 | A (keep it, second door)                   | B (retire it)
The brief is the main way in            | C1 approved                | n/a                     | yes: first on CONTRIBUTING and the site     | yes: the only way in
Senders without Claude or code execution| pending                    | photo issue form        | photo issue form, side photo now required   | none
C1's fallback if the spike fails        | C1 approved                | -                       | ready: this form is plan B                 | must be rebuilt
/draw-piece draws from photos           | A2                         | yes                     | yes, plus the new review path              | review path only
Effort                                  | estimated                  | -                       | S (human ~2 h / CC ~15 min)                 | M (human ~1 day / CC ~30 min)
```

Question: D6 — C7: Does the photo-only issue form stay as a second way in?
Project/branch/task: ChooChooCAD, contributor-brief-plan, a scope choice the accepted scope raised.
ELI10: You said "completely rethink". The brief becomes the main way to contribute. The question is whether the old photo form stays as a second door for people who don't use Claude, or whose Claude has code execution off, or retires. It's also plan B if the spike shows Claude's sandbox can't run the measuring tools.
Stakes if we pick wrong: either some owners of a missing piece have no way to send it, or you keep a second path to maintain.
Recommendation: A because the form already exists and works, it is the spike's fallback, and the brief can't reach everyone (code execution can be off; plans differ on skills).
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: two doors with the brief first (A), or the brief only (B).
Header: Photo form
A) Keep it, as the second door (recommended)
The brief comes first everywhere; the photo form stays for anyone who can't use it, with the side photo now required, and /draw-piece keeps drawing from photos. Effort S (human ~2 h / CC ~15 min), risk low. ✅ Nobody with a missing piece is turned away. ✅ Plan B for the spike already exists and is tested. ❌ Two intake paths to keep in step.
B) Retire it
The brief is the only way to contribute; the photo form and /draw-piece's drawing-from-photos path go. Effort M (human ~1 day / CC ~30 min), risk medium. ✅ One path to explain, test and maintain. ✅ Every issue arrives drawn. ❌ Senders without Claude or code execution can't contribute, and the spike has no fallback.

## Working plan (accepted scope)

2026-11-10 (P-1 to P-4): the owner's dry run counts as the pilot; senders take
photos with the phone's own camera app (the phone path isn't tested); no photo
goes on GitHub, so the review never re-measures and the photo form retires
now; Free plans are assumed to work. Where the steps and review sections below
speak of re-measuring from issue attachments, the phone path, or the pilot
still to come, these decisions replace them.

```
  site link (C5, on after a pilot) ─┐
  CONTRIBUTING.md ──────────────────┼──▶ the brief (one .md, versioned, E2)
                                     ▼
  the sender's Claude (code execution on)
     clone the repo ──▶ location removed (photoExif) ──▶ photo check (photoCheck)
     ──▶ can the app hold it? ──▶ measure (photoMeasure, agreedFigure)
     ──▶ ruler figures and the side photo, asked in the chat, with a drawing
     ──▶ the piece drawn ──▶ preview link: the sender checks it in the app (E1)
     ──▶ the issue: a prefilled link + location-free photos to drag in (C4)
                                     ▼
  the maintainer: /draw-piece review path: re-measure, compare, render, pull request
```

0. **Spike (C1, before anything is built).** In a Claude app chat with code
   execution on, a draft of the brief, run by the owner:
   - clone `github.com/raduuuuu/ChooChooCAD` in the sandbox;
   - run the TypeScript photo tools (Bun from npm, or Node with a TypeScript
     loader) and decode JPEGs (ImageMagick or ffmpeg from the Ubuntu
     archive, which the allowlist names);
   - the 216 mm trial pair (84401, 84402) must read what it reads locally
     within 0.05 mm (216.57 and 216.85 mm, trial passing), and location must
     be found and removed on copies;
   - a new, non-straight piece the library already holds, measured with end
     points the chat Claude picks itself (looking at crops it makes in the
     sandbox): every figure within 0.5 mm of the library's. The trial pair is
     the one case the tools measure with no picked points, so it alone proves
     nothing about a new piece (outside review, fallback finding 1);
   - `photoCrop.ts` working without macOS's `sips` (it has no fallback
     today; Ubuntu's ImageMagick 6 ships `convert`, not `magick`), and the
     share-link codec running under the sandbox's Node;
   - photos uploaded from the Claude phone app: whether they arrive resized,
     re-encoded or converted from HEIC, and whether a parent on a phone can
     save the clean copies and drag them into GitHub;
   - each step's time against the sandbox's command limits;
   - one wooden library piece end to end, to its part data, judged on its
     figures against the library's, within 0.5 mm (the preview doesn't exist
     yet: it is checked after step 3);
   - one photo uploaded to a GitHub issue, downloaded back and re-measured:
     within 0.5 mm of the reading before upload (the maintainer re-measures
     from issue attachments, step 4);
   - whether a Free account can enable code execution, reach github.com from
     the sandbox, and upload a skill (P7);
   - whether a prefilled `issues/new` link survives GitHub's sign-in (not
     blocking: if not, the brief says to sign in first).
   The photos aren't in the repo (photos are never committed): the owner
   uploads them into the chat. Blocking: the clone, the tools running (crop
   included), the trial readings, the new piece's picked-point figures, the
   wooden piece's figures, the re-measure after upload, the phone path. Not blocking: Free plans (a fail narrows who can contribute, and
   CONTRIBUTING.md says which plans work). Timebox: one session, about 2
   hours. Outputs written into this plan: pass or fail per item, and what
   the brief's "skills to install" says (code execution only, or a skill ZIP).
   Pass: build. Fail: the plan returns to the owner (C7 removed the fallback),
   who is asked to choose between bringing the photo form back, waiting for
   the sandbox to allow it, or a brief for Claude Code users only.
   **Spike results (2026-11-09, run by the owner in a claude.ai chat,
   desktop; kit: the trial pair 84401/84402 and the T switch 84405, location
   removed; a made-up GPS photo for the location test).** Ubuntu 24.04, root,
   Node 22.23.4; clone of 7477f4e in 1.7 s; `npm install -g bun` gave Bun
   1.4.4; ImageMagick 6.9.12 (`convert`, no `magick`) and ffmpeg 6.1.1 already
   present; `bun install --frozen-lockfile` passed; every run under 7 s.

   | Item | Result | Pass |
   |---|---|---|
   | Location found and removed | exit 2, then 0; GPS block empty | yes |
   | Trial pair within 0.05 mm of local (216.57, 216.85) | 216.57, 216.89; TRIAL 216.73 | yes |
   | `photoCrop.ts` off macOS | failed: no `sips`; Claude cropped with ImageMagick instead | no (known; port it) |
   | T switch A, through road (library 216.46) | 216.38, 216.32 | yes |
   | T switch B, curved end along (108.50) | 108.26, 108.28 | yes |
   | T switch C, curved end out (105.53) | 105.17, 104.96 (0.57 off) | one pass over 0.5 |
   | Picks repeated from scratch | A, B within 0.06 mm; C within 0.21 | yes |
   | Phone path, GitHub re-upload, Free plan | not run | open |

   Reading: the sandbox runs the repo's tools and reproduces the Mac's
   readings; a chat Claude picks points well enough for A and B. C missed
   because `photoMeasure.ts` measures only point to point: Claude built a
   "foot" point on the straight road by hand (unrefined), and that pick is
   what moved. What a brief can't leave to Claude's own helper scripts, so
   the build adds before the brief:
   - `photoCrop.ts` falls back to ImageMagick 6 (`convert`) or ffmpeg off macOS;
   - `photoMeasure.ts` finds its grid itself (`findGridAuto`, as `photoCheck`
     does): today the seeds' millimetres are given by hand, and on a tilted
     sheet Claude counted lines by script to label them;
   - an "offset from a line" figure (a point's distance from the line through
     two refined ends), so no figure needs a hand-made foot point;
   - a figure that fails the across-the-middle rule is refused alone, with
     the other end suggested, not the whole run (B passed by 2 px);
   - the brief says points are full-resolution pixels (the chat shows a
     smaller preview) and that `pip` needs `--break-system-packages`.
   Still to run before the draft pilot: the phone path, the re-measure after
   a GitHub upload, and a Free plan.

1. **The brief** (C6, C3, E2): one Markdown file, in the repo and served by
   the site (`app/public/`, so the download and the repo copy are one file).
   It starts with a version and date. It tells the sender's Claude, in
   order: check code execution and the clone; what to ask (the piece, its
   markings, where it joins); the photos (two top views on grid paper with
   the medium straight, the side photo required (C2), and on a first
   contribution the long-straight trial photos); remove location and hand
   back clean copies; the photo check and its reshoot words; whether the app
   can hold it; measure; a first draft of the piece from the photo figures;
   the ruler figures the draft still lacks, each with a drawing of what to
   measure (an SVG drawn from the draft, in the calibration sheet's style:
   datum points, the line, the face, the unit; AGENTS.md) and a photo of the
   ruler against the piece (as `/draw-piece` asks readers today); the piece
   drawn in full; the preview link; then the issue.
   - **One source of the measuring rules.** `/draw-piece`'s measuring and
     drawing steps (today's steps 5 to 9) stay in the skill as a shared
     section; the brief points its Claude at that section in the clone, and
     the review path uses the same text. What "skills to install" says comes from
   the spike: code execution only, or a skill ZIP published from the repo.
   - **Stops.** At each it tells the sender plainly and ends: code execution
     off (how to turn it on, then start again); the repo won't download (try
     later); a reshoot (the check's words); the app can't hold the
     piece (U1: a short issue labelled `piece: unsupported`, not drawn).
     Every other stop opens no issue: the sender comes back when it's fixed.
     A photo carrying its location is not a stop: clean copies are made and
     the run carries on; the originals are never posted.
   - **Before the first upload** the brief says the photos go to Claude under
     the sender's own account, and asks them to keep people, faces,
     addresses and screens out; its Claude looks at each photo for them
     before preparing the issue (AGENTS.md photo rules).
   - **Markings (S3-1).** Copied into the issue with any maker's name
     replaced by "the maker".
   - **First contribution.** The brief asks for the trial pair unless the
     sender gives an earlier issue of theirs that a merged piece pull request
     closed (the rule `/draw-piece` uses); the maintainer checks it.
   - **The sender's check is the preview.** Rendering beside every photo
     stays with the maintainer (step 4).
   - **Old copies (S1-1).** After cloning, the brief's Claude compares its
     version with the brief in the clone; if the clone's is newer, it says so
     and follows that one; the issue records the version followed.
   - **Version rule (E2).** Any change to the brief's text bumps its version;
     the test in `app/test/contributing.test.ts` holds the version and a
     hash of the text, and fails when one changes without the other. The
     person changing the brief updates both in the same commit; a version
     bump without a text change also fails.
2. **The issue** (C4): a new form for a drawn piece: the drawing (the part
   data the preview reads), the preview link, every figure with its source
   (photo and line, or ruler), the brief's version, the markings, the
   checkboxes; no photos (C8, P-3: they stay in the sender's chat). The
   brief's Claude prepares the text and a prefilled `issues/new` link under
   8,192 bytes. The photo-only form is retired (C7; done 2026-11-10, P-1 and
   P-3).
   - **Forms and labels.** Two forms: `drawn-piece.yml` (label
     `piece: waiting`, reworded "a drawn piece sent; nobody is reviewing it
     yet") and `unsupported-piece.yml` (U1; label `piece: unsupported`); a
     form sets its labels even for outsiders. `piece: drawing` becomes
     `piece: reviewing`; `.github/piece-labels.json`, CONTRIBUTING.md, the
     skill and their test change together. `new-piece.yml` goes (C7). No
     photo issue is open today, so none is left without a path.
   - **U1's issue.** `unsupported-piece.yml` holds what the piece is, the
     reason the app can't hold it (the step 6 words), the brief's version,
     the clean photos and the three checkboxes. The location removal and
     photo check run first, so its photos are as safe as a drawn issue's.
   - **The links, by a script.** `engine/tools/briefLink.ts` builds the
     preview fragment (deflate and base64url, as `app/src/shareLink.ts`
     does) and both prefilled issue links, refusing any over its cap, and
     decodes a preview fragment back to its part data for the maintainer's
     review. The brief's Claude runs it in the sandbox.
   - **The part data.** JSON in the library's own shapes: a `Part`
     (`engine/src/parts/schema.ts`) of any kind the schema holds, with its
     own decoration when it has one (as the cargo crane, `CRANE_SEEDS`, whose
     collision boxes `decorBoxesOf` derives, `engine/data/library.ts:58`), or
     a `DecoratedSpec` (a built-in base plus its shapes, `deriveDecorated`).
     Anything else is U1's stop.
   - **Measuring inputs travel with it.** Each photo's points file (the
     `PhotoInput` `photoMeasure.ts` reads: grid seeds, reference ends, figure
     ends) and the tool's output, as attachments, so the maintainer re-runs
     the same inputs and tells a changed input from a wrong result.
   - **The commit.** The issue records the commit the sender's Claude cloned,
     beside the brief's version; the review derives against that commit's
     base pieces, so a base changed since doesn't silently change the piece.
   - **Size budget.** The preview fragment is capped at 4,096 characters
     (half the share-link cap in `app/src/shareLink.ts`), so it fits URL-
     encoded inside the prefilled issue link with the figures and text. The
     part data travels only inside the preview link; the maintainer decodes
     it from there. Over the cap, the brief says so and stops.
3. **The app**: a validator for untrusted `Part` and `DecoratedSpec` data
   (every number finite and in range, names length-capped and brand-checked,
   ids not reserved, and the geometry consistent: every road of a multi-road
   piece ends on one of its ports, every port is on a road; today only
   `engine/test/multiRoad.test.ts:80` checks that, over the catalogue), shared by the preview and `briefLink.ts`; the share
   links' codec exported once, not copied (Section 1). The preview link (E1): one drawn piece from a link, read-only,
   beside the library, in 2D and 3D, checked as submissions are and capped
   as share links are. A decorated piece's `DecoratedSpec` is derived in the
   app with `deriveDecorated` against the built-in base (today it runs only
   over the seeds, `engine/data/library.ts:246-276`), and never stored.
   Where it throws (a base the library lacks, an id already taken,
   `library.ts:247-251`) the preview says the link can't be shown and why,
   instead of crashing; and the contribute link (C5), built now, off until
   one outside sender finishes the brief. **The pilot**: one person other
   than the owner, invited by the owner; "finishes" means their issue passes
   the maintainer's review (step 4). **The switch**: one constant in the app,
   flipped by its own pull request after the pilot; no build flag.
4. **The maintainer** (C7, P-3): `/draw-piece` keeps only a review path,
   without the photos: each figure against its `--json` output, the two top
   views within 0.5 mm, the diff applied and tested at the commit named,
   the app able to hold it, a render against the issue's traced side view
   that the sender is asked to confirm, the pull request. Its drawing-from-
   photos path goes (done 2026-11-10). When a figure doesn't match its
   output, the views disagree, or the sender says the render is wrong: a
   comment names the brief step to redo and the label becomes `piece: needs
   info` (kept, with its 30-day close).
5. **The side photo** (C2): required in the brief, CONTRIBUTING.md, the photo
   guide's section 3 (`app/photo-guide.html:113`) and the form; still without
   grid paper.
6. **Docs**: CONTRIBUTING.md leads with the brief; AGENTS.md names the brief
   as the sender's path and a drawn issue as untrusted data;
   `docs/plan/generic-TODOS.md` gains "the brief for other LLMs" (C3).
7. **Tests**: the brief's version and its required steps and views; the form
   (`app/test/contributing.test.ts` reads `new-piece.yml` today and changes with it);
   the labels list; `briefLink.ts`, including a worst-case prefilled link
   (the largest preview, every figure, URL-encoded twice) under 8,192 bytes;
   the preview link (validation, caps, read-only, never stored); the
   contribute link's switch; mutations run (CLAUDE.md).

## Answered: U1 (D7)
Commitment comparison:

```text
Commitment                              | Source/approval or pending          | Current                       | A (an "unsupported" issue)                   | B (tell the sender only)
A piece the app can't hold              | OV-3 (D18, 2026-11-08): label it    | issue labelled piece: unsupported | the brief stops before drawing and prepares a short issue: the piece, the photos, the reason | the brief stops and explains; no issue
You learn which pieces people want      | OV-3                                | yes                           | yes                                          | no
"Issue only after drawing" (C4)         | C4 approved                         | -                             | exception: an undrawable piece, never drawn  | kept with no exception
Effort                                  | estimated                           | -                             | S (human ~2 h / CC ~15 min)                  | S (human ~1 h / CC ~10 min)
```

Question: D7 — U1: When the app can't hold a piece, does the brief still open an issue?
Project/branch/task: ChooChooCAD, contributor-brief-plan, a gap the spec review found after the photo form was retired.
ELI10: Some pieces can't be drawn because the app's layout check can't hold their shape (angles off its steps, ends it doesn't know). Yesterday you chose to label those issues "piece: unsupported", so you see which shapes people want. With the photo form gone, the brief is the only way in, and it only opens an issue after drawing. Either the brief makes an exception and posts a short "can't be drawn yet" issue, or it just tells the sender and nothing reaches you.
Stakes if we pick wrong: either you never learn which shapes people are asking for, or issue-after-drawing gets one exception.
Recommendation: A because yesterday's D18 exists so these requests reach you, and an undrawable piece can never satisfy "issue after drawing" anyway.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: requests for unsupported shapes reach you (A), or stay with the sender (B).
Header: Unsupported
A) Post an "unsupported" issue (recommended)
The brief stops before drawing, explains why to the sender, and prepares a short issue (the piece, its photos, the reason) labelled piece: unsupported, as decided on 2026-11-08. Effort S (human ~2 h / CC ~15 min), risk low. ✅ You keep seeing which shapes people want, as D18 intended. ✅ The sender's effort isn't lost if the app learns the shape later. ❌ One exception to "issue only after drawing".
B) Tell the sender only
The brief stops, explains, and names the closest piece the app has; no issue is opened. Effort S (human ~1 h / CC ~10 min), risk low. ✅ "Issue only after drawing" holds with no exception. ✅ No issues you can't act on. ❌ You never hear about these pieces, which D18 meant to collect.

## Document approval

Owner, 2026-11-09, D8: "Approve and continue (recommended)". Accepts these
versions of the plan and the CEO summary; implementation stays unapproved
until the review completes.

## 0I. Temporal interrogation

```
  HOUR 1 (foundations):  the spike, run by the owner in a Claude chat with the
                         photos uploaded; its result written into step 0. Nothing
                         else starts before it passes.
  HOUR 2-3 (core):       briefLink.ts (fragment, both issue links, decode) and its
                         caps; the part-data checks shared with submissions; the
                         brief's text pointing at /draw-piece's shared section
  HOUR 4-5 (integration):the preview route in the app (deriveDecorated at runtime,
                         read-only, never stored); the two forms and the label
                         rename; /draw-piece's review path
  HOUR 6+ (polish/tests):the worst-case link test, the version-hash test, docs,
                         the contribute link off behind its constant
```

Surprises the builder will meet: the sandbox may need Bun from npm and
ImageMagick from the Ubuntu archive (spike); `deriveDecorated` throws (3);
a nested link is URL-encoded twice (2). Pending choices for the eng review:
the preview's route and how it sits beside the library; where the shared
measuring section lives in the skill. Effort: human ~3 weeks / CC + gstack
~8 h [estimated], spike first.

## Review sections

### Current scope
Mode SELECTIVE EXPANSION (D3). Accepted: C1 (D1), C2, C3, C4, C5 (D2), C6,
E1 (D4), E2 (D5), C7 (D6), U1 (D7); documents approved (D8). Rejected: C1's
option C. Deferred: other LLMs (C3). Pending: none before Section 1.

### Section 1: Architecture

```
  woodentrain.world (Pages)                 the sender's Claude (their account)
  ┌──────────────────────────────┐          ┌─────────────────────────────────────┐
  │ app/public/<brief>.md ───────┼─download─▶ brief (versioned)                   │
  │ contribute link (off, C5)    │          │  git clone github.com/.../ChooChooCAD│
  │ preview route (E1) ◀─────────┼──link────┤  engine/tools/photo*.ts  (measure)  │
  │   decode ─▶ validate ─▶      │          │  engine/tools/briefLink.ts (links)  │
  │   derive ─▶ render, read-only│          │  /draw-piece shared section (rules) │
  └──────────────────────────────┘          └───────────────┬─────────────────────┘
                 ▲                                          │ prefilled issue link
                 │ preview link in the issue                ▼  + clean photos (by hand)
  ┌──────────────┴──────────────┐           ┌─────────────────────────────────────┐
  │ maintainer: /draw-piece     │◀──reads───┤ GitHub issue: drawn-piece.yml or    │
  │ review path (re-measure,    │           │ unsupported-piece.yml               │
  │ compare, render, PR)        │           └─────────────────────────────────────┘
  └─────────────────────────────┘
```

- **Preview data flow.** Happy: fragment ─▶ decode ─▶ validate ─▶ derive ─▶
  render. Nil: no fragment, the app opens as usual. Empty or corrupt: refused,
  with the share links' refusal wording. Error: `deriveDecorated` throws (base
  missing, id taken) ─▶ "can't be shown" with the reason (step 3).
- **Shared codec (finding, DRY).** `app/src/shareLink.ts` keeps deflate and
  base64url private (`toBase64Url`, `deflate`, lines 85-107). `briefLink.ts`
  and the preview must use the same code: export or move it once, not copy it.
  Inside E1's approved scope.
- **Version skew (finding, S1-1).** A downloaded brief is frozen; the repo it
  clones is not. Pending, below.
- **Single points of failure.** The sandbox's network allowlist and its
  tools (an outside policy): a change there stops every contribution (C7).
  Seen only when a sender reports it; Section 8.
- **Security boundary.** The preview is client-side: anyone with a link sees
  one piece; nothing is stored or sent. Section 3 covers the validator.
- **Rollback.** Revert the brief's PR (the old form returns from git); the
  link constant stays off; the preview route reverts with its PR. Minutes.
- **Value test.** The brief is agent-consumed product instructions, the
  owner's request: product, not a process artifact.
- **Platform.** `briefLink.ts` and the validator are what "other LLMs later"
  (C3) and any future piece-sharing reuse.

## Answered: S1-1 (D9)
Commitment comparison:

```text
Commitment                              | Source/approval or pending | Current | A (follow the clone's brief)                       | B (stop: download the new one)       | C (nothing)
An old downloaded brief meets a newer repo | E2 approved (version)   | n/a     | its Claude reads the brief in the clone and follows that, saying so | it stops and asks for the new file | it follows the old text
The issue records the version used      | E2                         | -       | the clone's version                                | the new file's version               | the old version
The sender's effort                     | pending                    | -       | none                                               | download and upload again            | none
Effort                                  | estimated                  | -       | S (human ~1 h / CC ~10 min)                        | S (human ~1 h / CC ~10 min)          | S (zero)
```

Question: D9 — S1-1: What happens when an old copy of the brief meets a newer repo?
Project/branch/task: ChooChooCAD, contributor-brief-plan, Section 1 (architecture): the brief and the repo can drift apart.
ELI10: A parent downloads the brief once and might use it months later. Their Claude then downloads the repo as it is that day, and the measuring tools or steps may have changed since. An old brief could tell Claude to run a step the repo no longer has. The repo always holds the newest brief, so Claude could just read that one, or it could stop and send the parent back to download it.
Stakes if we pick wrong: either old briefs give steps that no longer match the tools, or parents bounce back to download a file again.
Recommendation: A because the clone always has the brief that matches its tools, so Claude switching to it costs the parent nothing and keeps the issue's version honest (explicit over clever: one source of the steps).
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: Claude updates itself (A), the parent re-downloads (B), or drift is allowed (C).
Header: Old brief
A) Follow the clone's brief (recommended)
After cloning, the brief's Claude compares its version with the brief in the clone; if the clone's is newer, it says so and follows that one, and the issue records the newer version. Effort S (human ~1 h / CC ~10 min), risk low. ✅ An old download always ends up on the steps that match the tools. ✅ The parent does nothing extra. ❌ The downloaded file becomes mostly a starter; its own steps only run when the clone fails.
B) Stop and ask for the new file
On a newer version in the clone, Claude stops and asks the parent to download the current brief and start again. Effort S (human ~1 h / CC ~10 min), risk low. ✅ The file the parent holds always matches what runs. ✅ Easy to explain. ❌ A parent with an old copy restarts from scratch, for nothing they did wrong.
C) Nothing
The downloaded brief runs as written; E2's version line lets you spot an old one in review. Effort S (zero implementation work), risk medium. ✅ No extra step in the brief. ✅ Review still catches it from the version line. ❌ Old briefs run steps that may no longer match the tools, and fail in confusing ways.

### Section 2: Error & Rescue Map

```
  CODEPATH                         | WHAT CAN GO WRONG                          | CLASS
  ---------------------------------|--------------------------------------------|----------------------
  brief: environment check         | code execution off; github.com unreachable | Stop (no issue)
  brief: clone                     | network error, repo moved                  | Stop (no issue)
  brief: photo tools               | Bun or ImageMagick missing; a tool throws  | Stop (no issue), the error quoted
  brief: location                  | HEIC (can't strip)                         | Reshoot words (photoCheck FORMAT)
  brief: photo check               | reshoot (grid, warm paper, touching ...)   | Reshoot words (photoCheck)
  brief: measure                   | two views disagree past 0.5 mm             | Another top view, or a ruler (skill step 7)
  brief: ruler figure              | unreadable reply, wrong unit               | Asked again (the reply format)
  brief: the sender's Claude       | skips a tool, invents a figure             | Caught in review: re-measured (step 4)
  briefLink: build                 | over a cap (4,096 / 8,192)                 | Refused, the brief stops and says why
  issue: open the link             | not signed in to GitHub                    | GitHub's sign-in, then the form [verify: the prefill survives]
  preview: decode                  | bad encoding, corrupt, too large           | Refusal notice (share-link wording)
  preview: validate                | a field missing, NaN, out of range, a brand| Refusal notice naming the field
  preview: derive                  | base missing, id taken                     | "can't be shown", with the reason
  review: re-measure               | attachments re-encoded (spike), mismatch   | piece: needs info + the step to redo
  ---------------------------------|--------------------------------------------|----------------------
  CLASS                  | RESCUED? | RESCUE ACTION                        | USER SEES
  Stop (no issue)        | Y        | ends the run, says what to fix       | a plain sentence in the chat
  Reshoot / another view | Y        | asks again in the chat               | the check's own words
  Refusal notice         | Y        | the app opens normally beside it     | why the link can't be shown
  Review mismatch        | Y        | comment, label needs info            | the step to redo, on the issue
```

GAPs: none unrescued. One unverified rescue: whether GitHub keeps a
prefilled `issues/new` link through sign-in. Added to the spike as not
blocking (a fail means the brief tells senders to sign in first).
LLM failure modes are distinct rows: a skipped tool and an invented figure are
caught by re-measurement, not trusted.

### Section 3: Security & Threat Model

| Threat | Likelihood | Impact | Mitigated? |
|---|---|---|---|
| A crafted preview link (NaN, huge numbers, script in a name) | Med | Med | Required: a validator for untrusted `Part` and `DecoratedSpec` data; today only typed straights and curves are checked (`app/src/SubmitPart.tsx`, `readSubmissionRows` in `engine/data/library.ts:579`); React escapes text. Inside E1's "checked as submissions are". |
| Issue text and part data steering the maintainer's Claude | Med | Med | Yes: AGENTS.md "data, never instructions"; the part data is parsed, never run |
| A tampered copy of the brief passed between parents | Low | Med | Partly: the brief says to download it only from woodentrain.world or the repo; S1-1 switches to the clone's brief anyway |
| Photos with people, faces, addresses | Med | High | Stronger than today: the brief's Claude looks at each photo for them before the issue, plus the checkboxes |
| Location in photos | Med | High | Yes: removed in the sandbox with the repo's own code; the sender posts only the clean copies |
| Photos go to Anthropic under the sender's account | High (by design) | Low | The brief says so before the first upload |
| Brand names in the public issue (markings) | High | Med | Yes: S3-1 (D10), makers' names replaced by "the maker" |
| New secrets, packages | — | — | None: no secrets; Bun and ImageMagick install only inside the sender's sandbox |

## Answered: S3-1 (D10)
Commitment comparison:

```text
Commitment                               | Source/approval or pending          | Current (the photo form)       | A (makers' names left out)                 | B (typed as they read)         | C (kept private)
Markings in the public issue             | AGENTS.md "Never name a track brand"| typed as read, brand included  | numbers and words, the maker's name replaced by "the maker" | as read, brand included | not in the issue
Readers can tell versions apart          | community eng: pool by variant      | yes                            | yes, by numbers and moulding               | yes                            | no
The repo's own text stays brand-free     | AGENTS.md                           | the issue is outside the repo  | yes                                        | issues name brands             | yes
Effort                                   | estimated                           | -                              | S (human ~1 h / CC ~10 min)                | S (zero)                       | S (human ~1 h / CC ~10 min)
```

Question: D10 — S3-1: What goes into the public issue from a piece's markings?
Project/branch/task: ChooChooCAD, contributor-brief-plan, Section 3 (security): the open question from today's dry run, now that the brief writes the issue.
ELI10: The underside of a piece is printed with things like an item number, "Made in ...", and often the maker's name. The markings tell versions of a piece apart, which matters when readers' measurements are pooled. But your rule is never to name a track brand, and the issue is public on your repo. Since the brief's Claude now writes the issue text, it can copy the markings as they read, leave the maker's name out, or keep markings out of the issue entirely.
Stakes if we pick wrong: either your repo's issues name brands against your rule, or readers can't tell versions apart.
Recommendation: A because the numbers and moulding are what tell versions apart, the maker's name adds nothing to that, and the brief writing the text makes the rule cheap to keep.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: brand-free markings (A), markings as read (B), or none in public (C).
Header: Markings
A) Leave makers' names out (recommended)
The brief's Claude copies the markings into the issue with any maker's name replaced by "the maker": item numbers, years, "Made in", moulding stay. Effort S (human ~1 h / CC ~10 min), risk low. ✅ The repo's issues follow your no-brand rule. ✅ Versions stay distinguishable by their numbers and moulding. ❌ A reader can't search issues by maker name.
B) Copy them as they read
Markings go into the issue exactly as printed, brand and all; the rule applies to the repo's files, not issues. Effort S (zero implementation work), risk medium. ✅ Nothing lost from the markings. ✅ No rewriting to get wrong. ❌ Public issues on your repo name brands, against how you've applied the rule elsewhere.
C) Keep markings out of the issue
The brief uses the markings only inside the chat and the issue says "markings checked"; the maintainer asks for them privately if needed. Effort S (human ~1 h / CC ~10 min), risk low. ✅ Nothing brand-related is public. ✅ Simplest public text. ❌ Readers can't tell versions apart from the issue, which pooling needs.

### Section 4: Data flow and interaction edge cases

```
  PREVIEW:  fragment ─▶ decode (cap 4,096) ─▶ validate ─▶ derive ─▶ render (memory only)
            nil: app as usual │ too long: refused │ corrupt: refused │ NaN/huge: refused, field named
            stale base id: "can't be shown" │ never persisted, so no conflict or lock
  ISSUE:    figures + part ─▶ briefLink (caps) ─▶ prefilled URL ─▶ GitHub form ─▶ issue
            over cap: brief stops │ signed out: sign-in first [spike] │ double submit: two issues, one closed as a duplicate
  REVIEW:   issue ─▶ decode preview ─▶ re-measure attachments ─▶ compare ─▶ render ─▶ PR | needs info
```

| Interaction | Edge case | Handled? | How |
|---|---|---|---|
| Sender stops halfway | nothing posted | Yes | the chat keeps its history; uploads persist; the clone is re-made, measuring re-runs (idempotent) |
| Sender returns days later | the sandbox was reset | Yes | the brief says to re-clone and re-measure from the uploads; same figures |
| Sender posts twice | two issues | Yes | the maintainer closes one as a duplicate |
| Preview link on a phone | small screen | Section 11 | read-only view; layout reviewed in the design review |
| Library changes after the link was made | base renamed | Yes | "can't be shown" with the reason |

No shared mutable state between flows: the preview never writes storage, so
no ordering hazard.

### Section 5: Code quality

- `briefLink.ts` sits beside `photoCheck.ts` and `checkup.ts` (CLI shape,
  exit codes, header diagram). OK.
- Duplication to avoid: the share-link codec (Section 1) and the part checks
  (Section 3) each exist once, used by both the app and the tools.
- `/draw-piece` loses its drawing path but keeps one shared measuring section:
  smaller, not two copies.
- No over-engineering found: no new service, no runtime config, one constant.

### Section 6: Tests

```
  NEW THING                    | TEST                                   | HAPPY / FAILURE / EDGE
  briefLink encode/decode      | unit (node)                            | round trip / over cap refused / worst case under 8,192
  part validator               | unit (node)                            | a library piece passes / NaN, huge, brand name, reserved id refused / empty
  preview route                | dom                                    | shows a piece read-only, stores nothing / corrupt link notice / derive throws notice
  contribute link              | dom                                    | absent while the constant is off / present when on
  brief text                   | node, read as text                     | version + hash in step / required steps and views present (side photo) / old-copy rule present
  forms + labels               | node, read as text                     | two forms, labels from one list / no new-piece.yml / U1 form sets piece: unsupported
  /draw-piece review path      | node, read as text                     | names the 0.5 mm rule and needs-info outcome
  the brief, run for real      | manual: spike, then the pilot          | the only proof of the sender's side (no AI in CI, D2)
```

`no_claim` for the text tests: that a Claude following the brief behaves as
written; the spike and the pilot own that. Each pin's mutation is run and
recorded (CLAUDE.md). Test ambition: the 2am test is a worst-case link
decoded by the real preview; the hostile test is a fragment of NaNs and a
`<script>` name. Flakiness: none new (no clock, no network).

### Section 7: Performance

- Preview: one decode and one derive of a single piece: milliseconds.
- Sandbox: the photo tools took 39 s for two photos locally (wide search,
  2026-11-09); the spike measures the sandbox's time and any command limit.
- No new server, query or job. No issues found beyond the spike's timing.

### Section 8: Observability

- What the maintainer can see: issues by label (drawn, reviewing, needs info,
  unsupported) and the brief version in each. The checkup's report-only
  check already counts needs-info issues past 30 days.
- Blind spot: an abandoned or failed run in a sender's chat leaves no trace.
  Accepted for now: no telemetry in the brief (privacy, D14's Cloudflare-only
  analytics); the pilot and the spike are where failures are seen.
- Runbook: a sandbox policy change (Section 1) shows as senders reporting
  failed clones; the response is the spike's checklist, re-run.

### Section 9: Deployment and rollout

Order, one PR each, never stacked:
1. Spike (no code merged; its results written into this plan).
1b. Draft-brief pilot (OV-2): a draft brief (the brief's steps, the part data
   handed over as plain text, no preview) tried by one outsider, posting on
   the existing photo form; its findings written into this plan before step 2.
2. Codec export, validator, `briefLink.ts` (no user-visible change).
3. Preview route (Pages deploys it; unused until a brief exists).
4. Brief (unlinked), the two new forms, labels, the photo guide (side photo
   required), AGENTS.md, `/draw-piece` review path, the contribute link
   (constant off). The photo form and CONTRIBUTING's photo path stay (OV-1).
   GitHub's labels are renamed by hand (`gh label edit`) right after merge.
5. After one outside sender finishes the brief: one PR retires the photo form
   and `/draw-piece`'s drawing path, points CONTRIBUTING.md at the brief, and
   flips the link constant (C5, C7 by OV-1).
Rollback: revert step 4's PR; step 5's PR reverts to bring the form back;
steps 2-3 are inert alone. Post-deploy check: open a worst-case preview link on the live site.

### Section 10: Long-term trajectory

- Debt: the flow depends on an outside sandbox policy; the brief and the
  skill's shared section must stay in step (the version test guards the brief).
- Reversibility: 4/5 (the old form is one revert away; labels rename back).
- Next: other LLMs (C3, deferred) reuse the brief, `briefLink.ts` and the
  validator unchanged. The rejected Claude Code door stays rejected; nothing
  accepted depends on it.

### Section 11: Design and UX

```
  site ─▶ contribute link ─▶ download the brief ─▶ Claude chat
       ─▶ questions, photos (they stay in the chat), ruler ─▶ preview link
       ─▶ woodentrain.world/#p1.… ─▶ "looks like my piece", told to the chat
       ─▶ the issue file ─▶ posted as a new issue (no photos)
```

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Preview | the 3D chunk loads (existing) | no fragment: normal app | refusal notice naming why | the piece, read-only, beside the library | a 2D view while 3D loads |
| Contribute link | - | hidden while off | - | opens the brief's download | - |

- The preview is the one new screen: read-only, says it's a preview of a sent
  piece, and offers nothing that stores it (DESIGN.md, no screen directions).
- Phone: the brief runs in the Claude phone app; the preview must work on a
  phone. Recommendation: run /plan-design-review on the preview screen before
  building it, and /design-review after.

### The preview screen, designed (T4; /plan-design-review, 2026-11-10)

Each line is the owner's decision (D1 to D<n>); the review report at the end
counts them. Where Section 11 above differs, these replace it.

- **D1 Base: the shared-layout screen, no library.** The preview is built on
  the friend screen (`FriendScreen.tsx`, DESIGN.md rule 13), which already works
  on a phone; the library rail ("needs a larger screen" there) is not on it.
- **D2 The picture: the piece between two medium straights**, each straight at
  the height of the end it joins (floor or raised): the straights give the
  scale and show the joins; a ramp shows floor to raised; a mismatch between
  the drawing and its declared heights shows the existing level-mismatch mark.
- **D3 Order, top to bottom, phone and desktop alike:**

```
  ┌──────────────────────────────────────────────┐
  │ (1) identity line                            │
  │ (2) Piece preview · <name>                   │
  │ (3) standing line, never folded: not in the  │
  │     library, drawn by your chat, nothing     │
  │     here is saved                            │
  │ (4) the picture: straight · piece · straight │
  │     2D first                                 │
  │ (5) its sizes, .num mm: length or radius,    │
  │     ends, heights                            │
  │ (6) the next step                            │
  │ (7) details for review, folded               │
  │ (8) the way out                              │
  └──────────────────────────────────────────────┘
```

- **D4 A refused piece:** one sentence, "Your chat's drawing can't be shown
  yet.", then the validator's reasons (each names its field, in plain words,
  at most 20 listed), and a **Copy for your chat** button that copies them for
  the person to paste back. The way out as on the shared-layout screen.
- **D5 A cut-short link** (it fails to decode or inflate, rather than failing a
  check) gets its own sentence: "This link looks cut short. Ask your chat for it
  again, as a file or in one piece."
- **D6 Loading:** nothing for 300ms, then "Opening a piece preview…", as shared
  links do. The 2D picture shows as soon as it is ready; if 3D fails, one line
  says so and 2D stays usable.
- **D7 A possible duplicate:** when the piece's track matches a library
  piece's, one plain line: "Its track matches <code> <name>, already in the
  library. Is it the same piece?" No other heuristics.

| State | What the person sees |
|---|---|
| Loading | nothing for 300ms, then "Opening a piece preview…" (D6) |
| No fragment | the normal app (unchanged) |
| Refused by a check | the D4 sentence, the reasons, Copy for your chat, the way out |
| Cut short | the D5 sentence, the way out |
| Success | the D3 screen |
| Partial: 3D failed | the D3 screen, 2D only, one line saying 3D couldn't open (D6) |
| Valid, possible duplicate | the D3 screen with the D7 line under the sizes |
| Crash while drawing | the shared-link crash sentence and way out (`LinkBoundary`) |

- **D8 The next step is back in the chat.** Nothing on the screen submits or
  records an approval. Item 6 is two plain lines: "Looks like your piece? Tell
  your chat, and it gives you the issue to post." and "Something's wrong? Tell
  your chat what." The issue stays one file the chat writes (draft-7); the same
  screen serves the review with nothing to click.
- **D9 Details for review** (item 7, closed by default, the same for everyone):
  the checks the piece passed, in words; the piece's data as sent, read-only,
  monospace; a **Copy** button. The maintainer compares it with the issue
  without running `brief:link decode`.
- The way out is the shared-layout screen's (D1): "Back to my layout" or
  "Start your own" (`exitLabel`).

| Step | The person does | Feels | What the screen gives |
|---|---|---|---|
| 1 | taps the link in their chat | unsure what opens | the identity line and "Piece preview · <name>" (D3) |
| 2 | reads the standing line | wary: is this in the app now? | "not in the library, drawn by your chat, nothing saved" (D3) |
| 3 | looks at the picture | "is that my piece?" | the piece between two straights, at its heights (D2) |
| 4 | compares sizes with the piece | careful | its sizes in mm (D3); a possible duplicate said (D7) |
| 5 | decides | relieved, or annoyed | back to the chat, either way (D8) |
| 6 | (the maintainer) opens it from the issue | checking | the same screen; details folded (D9) |
| 7 | (refused) reads why | stuck | the reasons and Copy for your chat (D4); a cut link said apart (D5) |

- **D10 No verdict on this screen.** The straight · piece · straight row gets
  no verdict strip, no glyph and no "Checked with catalogue sizes.": colour and
  glyphs stay spent on whether a layout can be built (DESIGN.md rules 1, 3),
  and a pass beside an unverified drawing would read as approval.
- **D11 Ordinary wood.** The piece is drawn exactly as a placed piece, not as
  the translucent placement ghost; its paint shows in 3D. DESIGN.md rule 11
  gains one line: a piece preview draws solid wood; the ghost stays the
  placement cursor's.

- **D12 Paint: the app's colours only, and new ones asked for.** A paint
  already in `tokens.css` shows in 3D (DESIGN.md rule 1); one the app doesn't
  have draws plain beech, and the details say "Paint <name> isn't one the app
  has yet; drawn as wood." The brief's Claude names every colour the piece
  needs that the app lacks, in the issue under **Colours needed**: a plain
  name ("bridge orange"), a hex value sampled from the photo, and which parts
  wear it. The reviewer adds each to `tokens.css` with its measured contrast
  (rule 5: ΔE2000 20 from `--fail`, its line colour 3:1 on it), and the pull
  request lists them under **Colours added**. (Owner, 2026-11-10: "it needs to
  be marked in the PR that additional colors are needed and the chat should
  name what colors should be added".)

- **D13 3D on a phone:** the existing 3D view as it is (drag, pinch, arrows,
  + and –, 0 resets), plus one 44px button, **From the side**, that turns it
  level and side-on: the view the person holds against their side photo.
- **D14 Keyboard and screen readers:** focus lands on the heading on load; a
  polite announcement, "Piece preview, <name>."; the 2D picture's label reads
  its sizes ("Double-arch bridge, 240 mm long, socket and peg, between two
  medium straights"); the Copy buttons announce "Copied."; the details fold is a
  native disclosure; every control at least 44px (rule 10); a refusal's
  sentence takes focus as `role="alert"`, as shared links' do (design 20A).
  On a phone the column is the shared-layout screen's, the picture full width.

- **D15 The contribute link** sits beside the editor's **Add a part**
  button: "Missing a piece? Have your Claude draw it for the library", opening
  the brief's download. Built now, off by its constant until T6.

**Not in scope (considered, deferred):** the library beside the preview (D1:
it doesn't help judge one drawing, and doesn't fit a phone); a GitHub button on
the preview (D8: the issue is one file the chat writes); heuristics beyond the
duplicate line (D7: "unusual" needs thresholds and may alarm a genuine new
piece); named 3D views beyond **From the side** (D13); showing a colour the app
doesn't have (D12: unmeasured against rule 1).

**What already exists, reused:** `LinkRoute.tsx` (a lazy route before the
editor mounts, the read-only session, 300ms loading, `LinkMessage`,
`LinkBoundary`); `FriendScreen.tsx` (its column, identity line, the picture as
anchor, the 3D panel, `exitLabel`); `linkWords.ts` (every string in one place);
`engine/data/previewLink.ts` and `untrustedPart.ts` (#244: decode, check,
reasons); the 3D view's keys and gestures; the level-mismatch mark; the paint
tokens.

## Outside voice

- Codex (gpt-6-astra, plan-review): returned four findings but not the gate's
  required markers, so it is **unavailable coverage**, not a pass. Its four
  claims were checked against the code and are true (`trackDecorSeeds.ts:124`,
  `library.ts:58, 246-262`, `multiRoad.test.ts:80`, `photoMeasure.ts:1-12`);
  applied as corrections inside approved scope (the part-data kinds, geometric
  validation, measuring inputs in the issue, the commit recorded).
- Native fallback (Claude subagent, completed within the five-minute limit):
  10 findings. Applied as corrections: 1 (Critical, a picked-point gate in the
  spike), 2 (`photoCrop` without macOS), 6 (phone uploads), 9 (tolerances,
  step times), 10 (codec under Node). Asked: 3 and 8 (OV-1), 4 (OV-2).
  Recorded, not reopened: 5 (the review may save little time: D1 chose A with
  B on the table; the spike and the pilot measure it), 7 (E2 with S1-1 is more
  than needed: E2 approved as asked).

## Answered: OV-1 (D11)
Commitment comparison:

```text
Commitment                           | Source/approval or pending       | Current plan (Section 9)          | A (retire after the pilot)                    | B (retire at merge, as planned)
The photo form is retired            | C7 (D6)                          | yes                               | yes                                           | yes
When                                 | pending (timing)                 | in the brief's PR (step 4)        | after one outside sender finishes the brief   | in the brief's PR
CONTRIBUTING.md leads with the brief | accepted scope                   | at merge                          | after the pilot; the brief is published unlinked until then | at merge
A way in if the pilot fails          | C7 removed the fallback          | none                              | the photo form, until the pilot passes        | none
D19's gate means something           | D19                              | only the site link waits          | the whole public path waits                   | only the site link waits
Effort                               | estimated                        | -                                 | S (human ~1 h / CC ~10 min)                   | S (zero)
```

Question: D11 — OV-1: Retire the photo form at merge, or only after the pilot passes?
Project/branch/task: ChooChooCAD, contributor-brief-plan, outside review: sequencing of C7 (your D6 "Retire it" stands either way).
ELI10: You chose to retire the photo form. The plan retires it in the same pull request that adds the brief, before any outsider has tried the brief. If the pilot then fails, nobody has a way in. Also, CONTRIBUTING.md would point everyone at the brief from day one, so yesterday's "pilot first" rule (D19) would only hold back the site link. Moving the form's removal and CONTRIBUTING's switch to just after the pilot keeps the form until the brief is proven, and costs nothing.
Stakes if we pick wrong: either a failed pilot leaves no way to contribute, or the old form lives a few weeks longer.
Recommendation: A because it keeps your decision and D19's intent intact while removing the only window in which nobody can contribute (explicit over clever: one change at a time, each proven).
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: retire once proven (A), or retire at once (B).
Header: Retire when
A) Retire after the pilot (recommended)
The brief, forms and preview ship, the brief unlinked; the photo form and CONTRIBUTING's photo path stay until one outside sender finishes the brief, then one pull request retires the form and points CONTRIBUTING at the brief. Effort S (human ~1 h / CC ~10 min), risk low. ✅ There is always a way to contribute, even if the pilot fails. ✅ D19's "pilot first" covers the whole public path, not just a link. ❌ Two intake paths exist for a few weeks.
B) Retire at merge, as planned
The brief's pull request removes the photo form and points CONTRIBUTING at the brief immediately. Effort S (zero implementation work), risk medium. ✅ One path from day one. ✅ Fewer pull requests. ❌ If the pilot fails, nobody can contribute until you decide what to do.

## Answered: OV-2 (D12)
Commitment comparison:

```text
Commitment                              | Source/approval or pending | Current plan                    | A (draft-brief pilot first)                        | B (build, then pilot)
The spike (owner, in a chat)            | C1                         | first                           | first                                              | first
An outsider tries the flow              | D19, OV-1                  | after everything is built       | right after the spike, with a draft brief: the part data as plain text, no preview | after everything is built
Preview, validator, codec, briefLink (E1) | E1 (D4)                  | built before any outsider       | built after the draft pilot, shaped by what it found | built before any outsider
The gating pilot (link on, form retired)| C5, OV-1                   | after the build                 | still after the build (can be the same person)     | after the build
Effort before outside evidence          | estimated                  | ~3 weeks human / ~8 h CC        | spike + draft brief: ~3 days human / ~2 h CC       | ~3 weeks human / ~8 h CC
```

Question: D12 — OV-2: Should one outsider try a draft brief before the app work is built?
Project/branch/task: ChooChooCAD, contributor-brief-plan, outside review: sequencing of E1 (your D4 "Add" stands either way).
ELI10: The plan builds the preview link, its validator and the link tools (the biggest part, about three weeks) before any parent has tried the brief. Some things only a real parent shows: whether they'll measure with a ruler in a chat, whether a long chat with many photos holds up, whether Claude writes part data that survives your review. A draft brief can be tried right after the spike, with Claude handing over the part data as plain text and no preview. The preview still gets built, after, shaped by what the draft showed.
Stakes if we pick wrong: either three weeks go into tools tuned to a flow no parent has tried, or the draft pilot takes a friend's evening and a week of waiting.
Recommendation: A because the spike only proves the sandbox works; the draft pilot proves a parent works, before the largest piece is built (bias toward cheap evidence first).
Note: options differ in kind, not coverage — no completeness score.
Pros / cons: see each option.
Net: learn from a parent first (A), or build first (B).
Header: Draft pilot
A) Draft-brief pilot first (recommended)
After the spike, one outsider runs a draft brief; Claude gives them the part data as plain text to paste into an issue on the existing form. Then the preview, validator, codec and briefLink are built, and the gating pilot runs as planned. Effort S now (human ~3 days / CC ~2 h for the draft brief), risk low. ✅ A parent's real behaviour shapes the three weeks of building. ✅ If parents can't do it, you find out for days of work, not weeks. ❌ You need a pilot sender earlier, and building waits for them.
B) Build everything, then pilot
Build in the planned order; the first outsider meets the finished flow. Effort S now (zero extra work), risk medium. ✅ One pilot, one round, no draft to write. ✅ The pilot sees the real preview. ❌ Three weeks are spent before any parent has tried the flow.

## TODO choices

None left: "the brief for other LLMs" was deferred by the owner's own words
(C3) and is written into `docs/plan/generic-TODOS.md` by T5.

## Approval readiness

Approval readiness: PASS. Checked rows and their answers: C1 (D1), C2 (owner's
instruction), C3 (instruction), C4 (instruction), C5 (D2), C6 (instruction),
E1 (D4), E2 (D5), C7 (D6), U1 (D7), S1-1 (D9), S3-1 (D10), OV-1 (D11),
OV-2 (D12); documents (D8). Corrections applied inside approved scope:
spec reviews 1 to 3, Sections 1 to 3 (codec, validator, photo checks),
the outside review's verified findings. Nothing declined or unanswered is in
the accepted work.

## Reality rows (final)

REALITY: premise-table finding 7 claims, 2 unverified (P6 sandbox runs the tools, P7 Free plans), both owned by the spike (T1) docs/plan/2026-11-09-contributor-brief.md:90
REALITY: already-done pass nothing on main since 2026-11-09 builds a brief; side-photo text from 30ad7ed CONTRIBUTING.md:30
REALITY: surface-check finding sandbox commands (clone, Bun, ImageMagick, photoCrop without sips) unprobed; the spike probes each engine/tools/photoCrop.ts:1
REALITY: binding-decisions finding D19 kept (C5, OV-1 widens it to the whole public path); D2 kept (AI on the sender's account) docs/plan/2026-11-08-community-pieces.md:190
REALITY: numbers pass 8,192 [cited; LINK_MAX_CHARS app/src/shareLink.ts:32]; 4,096 [derived]; 0.5 mm [measured: photoReadings]; efforts [estimated] app/src/shareLink.ts:32
REALITY: deferred-asks pass other LLMs deferred by the owner (C3) docs/plan/2026-11-09-contributor-brief.md:12
REALITY: pr-count pass seven steps, one PR each, never stacked (Section 9) AGENTS.md:83

PLAN_REALITY: phase=ceo rows=7/7 missing=none verdict=complete

## NOT in scope

- Deferred: the brief for other LLMs (C3, the owner's own words); goes to
  `docs/plan/generic-TODOS.md`.
- Rejected: a Claude Code door (C1 option C, D1); markings copied as read or
  kept private (S3-1, D10); retiring the form at merge (OV-1, D11); building
  before a draft pilot (OV-2, D12); a fallback intake path after the pilot
  (C7, D6).

## What already exists

- Photo tools `engine/tools/photo*.ts`: reused in the sender's sandbox.
- `/draw-piece`: its measuring section shared; its review path kept.
- Share links (`app/src/shareLink.ts`): codec reused; caps the model.
- Submissions (`SubmitPart.tsx`, `readSubmissionRows`): the validator's model,
  widened to untrusted `Part` and `DecoratedSpec`.
- `deriveDecorated`, `decorBoxesOf` (`engine/data/library.ts`): reused at runtime.
- Labels list, the checkup's content checks, the photo guide: kept.

## Dream state delta

After this plan, a piece can arrive drawn and measured by the repo's own
tools, and the maintainer reviews rather than draws. Still short of the
ideal: one maintainer still reviews every piece, failed runs in senders'
chats are invisible, and only Claude can run the brief.

## Error & Rescue Registry

See Section 2: 14 codepaths, every failure class rescued, 0 GAPs; one
unverified rescue (the prefill through GitHub sign-in) owned by the spike.

## Failure Modes Registry

```
  CODEPATH              | FAILURE MODE                      | RESCUED? | TEST?        | USER SEES?                    | LOGGED?
  ----------------------|-----------------------------------|----------|--------------|-------------------------------|--------
  brief environment     | code execution off / no network   | Y        | spike, pilot | a stop sentence in the chat   | N (chat only)
  photo tools in sandbox| missing Bun, ImageMagick, sips    | Y        | spike        | a stop sentence               | N (chat only)
  picked end points     | Claude picks ends by eye, wrongly | Y        | spike gate   | review: needs info, step named| Y (issue)
  briefLink             | over a cap                        | Y        | unit         | the brief says why and stops  | N
  preview decode        | corrupt, too long                 | Y        | dom          | refusal notice                | N
  preview validate      | NaN, inconsistent roads, brand    | Y        | unit         | refusal notice naming field   | N
  preview derive        | base missing, id taken            | Y        | dom          | "can't be shown", reason      | N
  issue prefill         | lost on GitHub sign-in            | Y        | spike        | sign in first (brief)         | N
  review re-measure     | attachment re-encoded, mismatch   | Y        | spike        | needs info on the issue       | Y (issue)
  sandbox policy change | allowlist drops github.com        | Y        | none         | clone stop; senders report    | N
```

0 CRITICAL GAPS (no row is unrescued, untested and silent at once). The
sandbox-policy row has no automated test: an outside policy, seen when a
sender reports it (Section 8).

## Scope Expansion Decisions

- Accepted: E1 preview link (D4), E2 brief version (D5).
- Deferred: none from 0G (other LLMs deferred by the owner's ask, C3).
- Skipped: none from 0G; C1 option C rejected at D1.

## Diagrams

1. System architecture: Section 1. 2. Data flow with shadow paths: Section 4.
3. State: issue labels (`waiting` ─▶ `reviewing` ─▶ PR merged | `needs info`
   ─▶ 30 days ─▶ closed; `unsupported` stays open). 4. Error flow: Section 2.
5. Deployment sequence: Section 9. 6. Rollback: Section 9 (revert step 4's
   PR; revert step 5's to bring the form back).

## Stale Diagram Audit

Files this plan touches with diagrams: `.claude/skills/draw-piece/SKILL.md`
(its flow diagram shows the drawing path: changes in T5/T6),
`engine/tools/photoCheck.ts` header (unchanged), `app/src/shareLink.ts`
header (codec export, T3: still accurate). 1 to update, in its own task.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [x] **T1 (P1, human: ~2h / CC: owner-run)** — spike — run the brief's steps in a Claude chat on the best photos
  - Surfaced by: C1 (D1); P6, P7; outside review fallback 1, 2, 6, 9, 10
  - Files: none merged; results written into this plan's step 0
  - Verify: every blocking item passes within its tolerance; results and "skills to install" recorded
- [x] **T2 (P1, human: ~3 days / CC: ~2h)** — brief — a draft brief, tried by one outsider on the existing form
  - Surfaced by: OV-2 (D12)
  - Files: a draft of the brief (not linked anywhere): `docs/brief/draft.md`, draft-1 (2026-11-09).
    Built on the measuring tools (docs/plan/2026-11-09-measuring-tools.md, merged), with the
    ruler route for straights and plain curves the owner chose there (UC1 b). Draft-2: photos
    stay in the chat, the issue is a blank one (C8). Draft-3: the bare minimum measured (C9).
    Draft-4: the issue body handed over as a file, the licence box ticked before posting. Before the pilot, from the spike: the phone
    path and a Free plan (still open); the re-measure after a GitHub upload is dropped (C8).
  - Verify: the outsider's issue reviewed; findings written into this plan before T3
  - **Owner's own pilot run (2026-11-09, issue #231, a double-arch bridge).** Run in a
    claude.ai chat, desktop, started on draft-1 and pulled to draft-3 on the way. Results:
    - Reached a drawn piece and an issue with no ruler reading: length 240.01 and 240.22
      (agreed 240.11), the side view traced off the side photo, the clearance over the
      road (about 106) above the 70 mm bar, so inferred. The diff applies to the commit
      the issue names (7acc164); typecheck and the 757 engine tests pass, re-run by the
      maintainer.
    - 48 minutes from start to the first figure, with a reshoot and two brief updates in
      between.
    - Found and fixed during the run: evening-lamp photos refused as warm paper (#229,
      photos balanced on the paper); photos kept off GitHub (C8, #228); nine ruler
      readings asked for a bridge and a side drawing that didn't match its photo (C9,
      #230); the 2x zoom advice tried and dropped (#227 closed: not needed).
    - Found in the issue: the body pasted as HTML (text copied from the chat's reply),
      its folded sections shown as raw text: draft-4 hands the body over as a file. The
      licence box left empty: draft-4 says to tick it before posting. No label (a blank
      issue gets none): the maintainer adds `piece: waiting` until T4's forms.
    - Found in the drawing: the half arches at each end of each side not drawn, the
      truss shape drawing only whole arches: the shape is to stop at the piece's ends
      (owner, 2026-11-09).
    - The chat's own findings (its end-of-run list, 2026-11-09):
      - Done in draft-4: question 1 also asks what the piece does on a layout ("an
        unsupported bridge" collided with `piece: unsupported`); tall widths read
        on both sides, half their sum (one side swung 15.9 to 42.0 between photos);
        a side face nearer the camera than the scale's edge reads a few percent
        large; the issue lists each brief version and commit followed when the
        clone was pulled mid-run. The truss shape can be cut (#233), and its
        hangers' `0` is documented there.
      - Article numbers (103.200.63): kept under Markings in the issue (S3-1:
        numbers stay); AGENTS.md's names rule keeps them out of the part's data,
        and #231's `source` has none.
      - Follow-ups, not built: a road end whose side edges are hidden (side walls)
        could be centred from its socket notch or its end face's width, not left
        `end-not-centred`; a `photoTrace.ts` drawing a profile in millimetres onto
        the side photo, so the trace overlay that caught the missing half arches
        needs no hand-written ImageMagick; an elliptical chord for tall toy arches
        (a circular one can't rise past a semicircle, so #231 used parabolic);
        `--location-only` doesn't look in sub-folders (the skill's order keeps it
        safe; draft-2 dropped the step).
      - Owner, 2026-11-09: arches block track where they rise past the ramp's
        height ("arches should block track if their height exceeds the ramp
        height"): a truss arch's ribs are solid from one level up wherever its
        chord passes it. No train width ("train width is not needed"): draft-5
        drops step 7's clear-width check.
    - Draft-6 (2026-11-10): the scale comes from the camera (photo.ts, chooseScale), so
      the brief asks for each top view's 35mm-equivalent focal length from the phone's
      photo details (a chat attachment loses its Exif) and puts it in the points file.
      The phone path now also checks that number can be found on a phone.
    - Not yet run: an outsider's pilot, the phone path, a Free plan.
- [x] **T3 (P1, human: ~3 days / CC: ~1h)** — engine — export the share-link codec; the untrusted-part validator; `engine/tools/briefLink.ts`
  - Surfaced by: Section 1 (DRY codec), Section 3 (validator), spec review 2 (links by script), Codex 2 (geometry)
  - Files: app/src/shareLink.ts, engine/data/library.ts (or a new validator module beside it), engine/tools/briefLink.ts, their tests
  - Verify: unit tests incl. the worst-case link under 8,192 bytes and contradictory multi-road payloads refused; mutations run
  - **Built (2026-11-10).**
    - The codec moved once: `engine/src/io/linkCodec.ts` (base64url, deflate-raw, capped
      inflate); `app/src/shareLink.ts` imports it, its tests unchanged. The brand words moved
      to `engine/data/brandWords.ts` (free of Node, so the app can load the validator);
      `checkup.ts` re-exports them.
    - The validator: `engine/data/untrustedPart.ts`, `checkUntrustedPart(unknown)` →
      `{ ok, part }` or `{ ok: false, reasons }`, each reason naming its field. A `Part`
      ("kind": straight, curve, multi-road, buffer, its own `decor` allowed, boxes derived) or
      a `DecoratedSpec` ("base", derived with `deriveDecorated`; its throws become reasons).
      Bounds: 1,000mm for any length, position or height (the longest built-in is 527); port
      coefficients whole and within 4,000; slop 5mm / 5° and arcSteps 1..15 (looksLikePart's);
      up to 16 ends, 32 roads, 128 shapes, 64 items in any other list; strings at least twice
      the longest built-in's (id 24, name 60, source and note 1,000, nouns 40), no control or
      text-direction characters, no brand word. Every built-in piece but a structure passes
      as a submission (a test). Ids: letters, digits, dashes; not `__`; not a built-in's.
      `dimensions.status` must be 'unverified' and `slop.calibrationStatus` 'estimated'.
      Multi-road geometry with the engine's `portsOf`, `roadsOf`, `roadEnd`, both ways up.
      Unknown fields are **refused, not stripped**: an unbounded field could reach the
      renderer, and stripping would make the preview differ from what the maintainer
      decodes. Built-in-only fields (`partNumber`, `body`, `deck`, `hump`, `decoratedFrom`,
      `decorBody`) and blocks are refused with why; `rise: 1` is allowed. Reasons never
      repeat a brand word (the preview shows them).
    - The preview link: `engine/data/previewLink.ts`, `#p1.<deflate + base64url of the
      piece's JSON>` (`p` for piece, apart from layouts' `#v1.`), capped at 4,096 characters
      and 64 KB inflated; decode runs the same validator. The largest built-in, the metro
      station's spec, packs to 3,839.
    - `engine/tools/briefLink.ts` (`bun run brief:link`): `encode`, `issue --title
      --body-file [--template]` (refuses over 8,192 bytes, and a brand word in the title or
      body), `decode`. Exit 0 / 1 refused / 2 usage. The worst case (a 4,096-character
      preview, a 30-row figures table, the draft's step 9 body) is 7,983 bytes.
    - For the owner: the prefilled link carries the short body only; the points files,
      outputs and diff still go in by the body file (draft-4).
- [x] **T4 (P1, human: ~1 week / CC: ~2h)** — app — the preview route (E1), after /plan-design-review on its screen
  - Surfaced by: E1 (D4), Section 11
  - Files: app/src/ (preview route and view), its dom tests
  - Verify: dom tests (read-only, stores nothing, refusal and derive notices); a worst-case link opened on the live site
  - Design (2026-11-10, "The preview screen, designed", D1 to D15): the shared-layout screen's column, not the editor;
    straight · piece · straight at matched heights; the D3 order; no verdict; ordinary wood; known paints only; the
    D4 to D7 states and their words in `linkWords.ts`; Copy for your chat; details with checks, data and Copy;
    **From the side**; the D14 accessibility; DESIGN.md rule 11's one line (D11); the contribute link beside
    **Add a part**, off (D15). Run /design-review on the built screen.
  - **Built (2026-11-10).**
    - `#p<n>.` is routed in `main.tsx` before the editor mounts (`routeOf`, `linkFragment.ts`), to a lazy
      `PreviewRoute`, under a read-only session that allows no key; the counter counts it as `/piece-preview`.
      A `#p1.` pasted into an open editor reloads into it, as a layout link does.
    - `PreviewScreen.tsx` on the friend screen's column: medium straight (A) · piece · medium straight, each
      welded to an end by its opposite polarity, so placement gives each its end's level; a multi-road piece's
      straights join its entry and the end its first road reaches; a buffer stop gets one. The piece resolves
      against BUILT_IN plus itself for this screen only. 2D first, the 3D view after it with **From the side**
      (`sideSignal`: elevation 0 along +y, the tilt floor opened to level until Reset or 0).
    - States: D4 for any refusal that decoded (the validator's, the caps, a newer version), D5 for
      `bad-encoding`, `corrupt` and `not-json`, its own sentence for a browser without deflate; the crash path
      is the shared link's `LinkBoundary`, moved with `LinkMessage` to `LinkMessage.tsx` for both routes.
    - D7 "matches": the same system and kind, the same ends (position, heading, level, peg or socket, in
      order) and the same roads; a decorated spec is not compared with its own base.
    - D12 "a paint the app has": `PAINT_TOKENS`, the set the 3D view resolves; a paint with either token
      outside it comes off whole.
    - The 3D how-to's "Pick a part to place it in 2D." now shows only where picking does something (it was
      also wrong on the friend screen).
    - Words in `previewWords.ts`; the contribute link's in `linkWords.ts` (the editor shows it, and a word from
      the preview's table pulled the whole table into the editor's chunk: 154.43 kB, over budget).
    - The contribute link points at `docs/brief/draft.md` on GitHub until T5 serves the brief from the site.
    - Worst-case link on the live site (2026-11-10, after #246): the metro station sent as a new piece
      (`brief:link encode`, 3,861 characters) opened at 390×844 and 1440×900, in 2D and 3D, its sizes and next
      steps shown; a copy cut 120 characters short gave the cut-short sentence. It found one bug: the duplicate
      line never showed for a piece with computed decoration (the roof's sines differ in the last digit between
      the sandbox and a browser); figures are now compared to 0.01 mm.
    - Still to do: /design-review on the built screen.
- [x] **T5 (P1, human: ~2 days / CC: ~1h)** — docs and intake — brief (unlinked), two forms, labels, photo guide side photo, AGENTS.md, `/draw-piece` review path and shared section, link constant off, generic-TODOS entry
  - Surfaced by: C2, C4, C6, E2, U1, S1-1, S3-1, OV-1; spec reviews 1-3
  - Files: app/public/contributor-brief.md, .github/ISSUE_TEMPLATE/drawn-piece.yml, .github/ISSUE_TEMPLATE/unsupported-piece.yml, .github/piece-labels.json, app/photo-guide.html, AGENTS.md, .claude/skills/draw-piece/SKILL.md, app/src/ (link constant), docs/plan/generic-TODOS.md, app/test/contributing.test.ts
  - Verify: docs tests (version + hash, required steps and views, forms and labels), mutations run; `bun run checkup --content` clean; labels renamed by hand after merge
  - Design (D12): the brief asks for **Colours needed** (name, hex from the photo, parts) when a paint isn't in
    `tokens.css`; `/draw-piece` adds each with its measured contrast and lists them as **Colours added** in the PR.
  - **Built (2026-11-10).**
    - The brief moved to `app/public/contributor-brief.md` (served as woodentrain.world/contributor-brief.md),
      version **1, 2026-11-10** (draft-7 plus the steps below). `docs/brief/draft.md` was a stub pointing there, for
      a draft copy whose old-copy check (S1-1) still looked at that path; removed 2026-11-10 (owner: no draft copies
      in use). ContributeLink's `BRIEF_URL`,
      CONTRIBUTING.md, AGENTS.md and the skill point at the new file; the constant stays off.
    - E2: `app/test/contributing.test.ts` holds every version with a hash of the brief's text less its version
      line; the text changed without a new entry, a version line ahead of the list, and a new entry with the last
      one's hash (a bump without a change) each fail.
    - The brief's new steps: 8 its colours (`PAINT_TOKENS` and `tokens.css`; a colour the app lacks gets a
      `--paint-<name>` token and a line under **Colours needed**: name, hex sampled from a crop, parts); 9 draw
      it; 10 the preview link (`brief:link encode` in a worktree at the cloned commit, since in the sender's
      branch the piece's id is already a built-in's; the sender says "looks right" or what's wrong, D8); 11 the
      issue, on a form.
    - Two forms, no upload field: `drawn-piece.yml` (`piece: waiting`: what, joins, markings, preview, brief,
      figures, colours, details; the licence and no-photo boxes) and `unsupported-piece.yml`
      (`piece: unsupported`: what, reason, brief; no-photo and "the maker" boxes).
    - GitHub fills a form from a link by field id and ignores `body`, so `brief:link issue --template` now reads
      the form from `.github/ISSUE_TEMPLATE/` and fills each field from the body file's `### <label>` section
      (the way GitHub shows a sent form); a heading the form lacks is refused (`form-section`), an unknown form
      too (`template`). The points files, outputs and diff go in `details.md`, pasted into **Details for review**.
      The worst case through the form (largest preview, 30 figures) still fits under 8,192 bytes.
    - `piece: drawing` is `piece: reviewing` in the label list, CONTRIBUTING.md and the skill; the GitHub label
      itself is renamed by hand after merge.
    - `/draw-piece` reads the form's sections, opens the preview link (its data must be the diff's piece), adds
      each needed colour to `tokens.css` with its ΔE2000 and line contrast, and lists **Colours added** in the PR.
    - Not done here: the generic-TODOS entry "the brief for other LLMs" (another session holds that file).
- [x] **T6 (P1, human: ~2h / CC: ~15min)** — rollout — after the gating pilot: retire the photo form and the drawing path, point CONTRIBUTING.md at the brief, flip the link constant
  - Surfaced by: C5 (D2), C7 (D6), OV-1 (D11)
  - Files: .github/ISSUE_TEMPLATE/new-piece.yml (removed), CONTRIBUTING.md, .claude/skills/draw-piece/SKILL.md, app/src/ (constant), tests
  - Verify: the pilot's issue passed review; docs tests; the link visible on the live site
  - Done (2026-11-10): the photo form and the drawing path retired in #243 (P-1, P-3); CONTRIBUTING.md points
    at the brief since #250; `CONTRIBUTE_LINK_ON` flipped to true, the link beside Add a part opening
    woodentrain.world/contributor-brief.md. The pilot: the owner's dry run (#231), P-1.

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | no contribute link; D19 gate; submissions   |
  |                      | cover straights/curves only; photoCrop      |
  |                      | macOS-only; sandbox unprobed                |
  | Step 0               | C1 A (spike first); C5 A; E1, E2 added; C7  |
  |                      | retire; U1 unsupported issue                |
  | Section 1  (Arch)    | 2 issues found (codec, version skew)        |
  | Section 2  (Errors)  | 14 error paths mapped, 0 GAPS               |
  | Section 3  (Security)| 8 threats, 0 High unmitigated               |
  | Section 4  (Data/UX) | 5 edge cases mapped, 0 unhandled            |
  | Section 5  (Quality) | 2 issues found                              |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 1 issue found (sandbox timing, spike)       |
  | Section 8  (Observ)  | 1 gap found (abandoned runs unseen)         |
  | Section 9  (Deploy)  | 2 risks flagged                             |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 2           |
  | Section 11 (Design)  | 2 issues (preview screen, phone)            |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (6 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 14 rows, 0 CRITICAL GAPS                    |
  | Failure modes        | 10 total, 0 CRITICAL GAPS                   |
  | TODOS.md updates     | 0 items proposed (1 deferred by the owner)  |
  | Scope proposals      | 2 proposed, 2 accepted (SEL)                |
  | CEO plan             | written                                     |
  | Outside voice        | codex: unavailable (missing markers);       |
  |                      | native fallback: completed, 10 findings     |
  | Lake Score           | N/A (no coverage-scored questions)          |
  | Diagrams produced    | 6 (arch, data flow, state, error, deploy,   |
  |                      | rollback)                                   |
  | Stale diagrams found | 1 (draw-piece flow, updated in T5/T6)       |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows, 2 unverified                      |
  +====================================================================+
```

### Unresolved Decisions
None.

## Design Review Completion Summary

The preview screen (T4) and the contribute link, `/plan-design-review`,
2026-11-10. Outside voices: codex (completed, findings) and an independent
Claude subagent (completed, 16 findings). No mockups: the designer has no image
API key.

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (13 rules); UI: one screen|
  |                      | + one link                                  |
  | Step 0               | 3/10; all 7 passes                          |
  | Pass 1  (Info Arch)  | 2/10 → 8/10 after fixes (D1, D2, D3)       |
  | Pass 2  (States)     | 3/10 → 8/10 after fixes (D4 to D7)         |
  | Pass 3  (Journey)    | 2/10 → 8/10 after fixes (D8, D9)           |
  | Pass 4  (AI Slop)    | 6/10 → 8/10 after fixes (D10, D11)         |
  | Pass 5  (Design Sys) | 6/10 → 8/10 after fixes (D12)              |
  | Pass 6  (Responsive) | 3/10 → 8/10 after fixes (D13, D14)         |
  | Pass 7  (Decisions)  | 1 resolved (D15), 0 deferred               |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated, 0 approved (no image API key)  |
  | Decisions made       | 15 added to plan                            |
  | Decisions deferred   | 0                                           |
  | Overall design score | 2/10 → 8/10                                 |
  +====================================================================+
```

Each pass stops at 8 for want of a picture: with no mockups, the composition
is fixed in words and an ASCII frame, and /design-review on the built screen
finishes it.

### Unresolved Decisions
None.

## Eng review of the built code (/plan-eng-review, 2026-11-11)

Target: this plan, reviewed as built. Every task (T1 to T6) had shipped
(#244 to #254, live on woodentrain.world) before the eng review ran, so the
owner chose to review the code against the plan (D1: "Review the built code
(recommended)"). T1 to T5 are ticked above as a factual correction: they had
shipped but were never ticked.

Scope record: feature answers: D1 (review the built code); structure: A,
"Original arrangement (recommended)" (D2); accepted scope: the shipped
files as they are, findings fixed inside them; pending remedies: F1 to F5.

### Scope Challenge

- **What already solves it:** everything the plan asked for exists. One
  codec (`engine/src/io/linkCodec.ts`) serves layout links, preview links and
  the script; one checker (`engine/data/untrustedPart.ts`) serves the preview
  and `briefLink.ts`. The older `looksLikePart` (`engine/data/library.ts:463`)
  checks stored Add-a-part rows and repairs them on purpose (its comment,
  "COERCED, NOT REFUSED"); the new checker refuses strangers' data. Different
  contracts, so not a duplicate to merge.
- **Complexity:** 29 files, about 2,200 lines added [measured: `git diff
  --stat 72c5ada~1 6be286a`]; no new classes or services. D2 kept the layout.
- **Search:** no new pattern beyond what the plan's CEO review researched;
  the findings below are bugs in shipped code, found by reading and probing.
- **TODOs:** nothing in `docs/plan/generic-TODOS.md` blocks this; the
  other-LLMs entry (C3) is already there.
- **Result:** scope accepted as-is. Scope Challenge findings: no issues found.

Reality rows:

| Premise | Claim | Receipt | Verdict |
|---|---|---|---|
| R-1 | The plan's work has all shipped | `git log`: 88205ed (T3), bbd2b0d (T4), efa793a (T5), 528c21a (T6) | true |
| R-2 | The checker accepts inherited names as fields | probe: `toString`, `constructor`, `__proto__`, `valueOf`, `hasOwnProperty` ACCEPTED; `madeUp` refused | true |
| R-3 | A preview never re-reads a changed address | `app/src/main.tsx:31-39` reads `location.hash` once; `PreviewRoute.tsx` has no listener; `App.tsx:568-578` has one | true |
| R-4 | A zero-length vault draws NaN | probe: tunnel straight's vault at `lengthMm: 0` passes and puts 1,652 NaN values in the 3D scene; `library.ts:109` checks width, wall and spring only | true |
| R-5 | A failed screen download is uncaught | `main.tsx:33-48`: `Suspense` with no error boundary around either lazy route; no `vite:preloadError` handler | true |
| R-6 | What a person sees after R-4 and R-5 | inferred from how three.js and React treat NaN geometry and uncaught errors | unverified |

unverified=1

REALITY: premise-table finding 6 claims, 1 unverified (what a person sees after R-4, R-5) docs/plan/2026-11-09-contributor-brief.md:1
REALITY: already-done pass no fix for R-2 to R-5 on origin/main since 2026-11-10 engine/data/untrustedPart.ts:142
REALITY: surface-check pass `bun run brief:link` is in package.json:17, as the brief names it package.json:17
REALITY: binding-decisions pass the fixes keep P-3 (no photos on GitHub), S3-1 and E1's "same checks as submissions" engine/data/untrustedPart.ts:19
REALITY: numbers pass 2,200 lines, 1,652 NaN, 2,710 fuzzed pieces accepted [measured: git diff, probes in the session scratchpad] engine/data/library.ts:109
REALITY: deferred-asks pass no linked issue for this review docs/plan/2026-11-09-contributor-brief.md:6
REALITY: pr-count pass one small PR per accepted fix, never stacked (AGENTS.md) AGENTS.md:83

### Section 1: Architecture

```
  address ──main.tsx: routeOf(location.hash), once──▶ #p1.? ──▶ lazy PreviewRoute chunk ──▶ decodePreview
                                                         │            │ (download fails: uncaught, F4)
                                                         │            ▼
                                                         │      LinkBoundary ▶ PreviewScreen
  a new #p1. pasted into the same tab ──hashchange──▶ nobody listens: the old piece stays (F2)
```

- [INFORMATIONAL] (confidence: 8/10) `app/src/main.tsx:33-48` — F4: both
  link routes are lazy chunks inside `<Suspense fallback={null}>` with no
  error boundary around them. A chunk that fails to download (a phone on a
  weak signal, or a link opened in the minutes after a deploy replaced the
  chunk files) rejects the lazy import, nothing catches it, and React
  unmounts the page: a blank screen, no words, no way out. Also true of
  layout links since the share plan. No test, no handler, silent: a
  critical gap by this review's rule.
- [INFORMATIONAL] (confidence: 8/10) `app/src/main.tsx:36`,
  `app/src/PreviewRoute.tsx:41-59` — F2: the route reads the address once.
  Pasting another `#p1.` link into the same tab changes the address but not
  the screen: the maintainer or sender sees the previous piece under the new
  link. The editor already reloads on a pasted link (`App.tsx:560-578`);
  the link routes don't. Same for layout links.
- Design-twice: no new boundary in this review; skipped. Red flags: the
  piece-link pattern is copied in `app/src/linkFragment.ts:14` (flag 8, a
  hand-synced copy), held equal by `linkFragment.test.ts`, kept on purpose
  so the editor's chunk doesn't load the checker. No other flags.

### Section 2: Code quality

- [INFORMATIONAL] (confidence: 9/10) `engine/data/untrustedPart.ts:141-145`
  — F1: `obj()` tests field names with `in`, which also matches names every
  object inherits. Probe: `toString`, `constructor`, `__proto__`, `valueOf`
  and `hasOwnProperty` pass as fields on a piece; `madeUp` is refused.
  Breaks the file's own promise (lines 19-23).
- [INFORMATIONAL] (confidence: 7/10) `engine/data/library.ts:108-109` — F3:
  the vault check refuses no width, no wall and a top under the spring, but
  not a zero length. Probe: the tunnel straight's vault at `lengthMm: 0`
  passes both the checker and `decorBoxesOf`, and `buildScene` writes 1,652
  NaN values into the 3D scene (672 without its stone joints). Found by a
  fuzz of 20,000 in-bounds pieces (2,710 accepted, none threw, this was the
  one NaN). What the 3D view then shows is unverified (R-6).
- No other code-quality findings: the link script's refusals each carry a
  code and a fix; the preview's states each have a sentence; strangers' text
  renders through React only (no raw HTML anywhere in app/src).

### Section 3: Tests

Framework: Vitest (`bun run test`), with jsdom for `*.dom.test.tsx`.

```
CODE PATHS                                               USER FLOWS
[+] engine/data/untrustedPart.ts checkUntrustedPart       [+] Sender's Claude: encode, open, fix, encode
  ├── [★★★ TESTED] every built-in accepted — :37          ├── [★★★ TESTED] encode prints a link — briefLink.test.ts:59
  ├── [★★★ TESTED] numbers, strings, ids, brands — :87-152├── [★★★ TESTED] a refused piece: reasons, Copy — piecePreview.dom:142
  ├── [★★★ TESTED] unknown and built-in-only fields — :178├── [★★  TESTED] cut short (D5) — piecePreview.dom:163
  ├── [GAP]         inherited names (R3, approved)         └── [GAP]        a fixed link pasted into the same tab (R2)
  ├── [★★★ TESTED] multi-road geometry — :46-86           [+] Maintainer: decode from the issue
  └── [★★  TESTED] derive refusals — :200-226                ├── [★★★ TESTED] decode prints the JSON — briefLink.test.ts:59
      └── [GAP]     a zero-length vault (R4, approved)        └── [★★★ TESTED] a tampered link refused — :76
[+] engine/data/previewLink.ts decodePreview              [+] Anyone opening a link
  ├── [★★★ TESTED] version, bad-encoding, corrupt — :95    ├── [★★★ TESTED] opens, focuses, writes no key — piecePreview.dom:76
  ├── [★★  TESTED] too-long — :156                         ├── [★★  TESTED] a drawing crash shows a sentence — previewCrash.dom
  ├── [GAP]         too-large (unpack cap) — R5            └── [GAP] [→E2E] the screen's download fails (R1)
  └── [GAP]         not-json — R5
[+] engine/tools/briefLink.ts issueLink, formParams
  ├── [★★★ TESTED] caps, worst case, brand — :172-220
  └── [★★★ TESTED] form sections by id — :278-323
[+] app/src/previewPiece.ts
  └── [★★★ TESTED] graph, sizes, paint, duplicate — previewPiece.test.ts, piecePreview.dom

COVERAGE: 21/27 paths tested (78%)  |  Code paths: 17/21  |  User flows: 4/6
QUALITY: ★★★:15 ★★:6  |  GAPS: 6 (4 closed by R1 to R4's approved tests; R5 below; 1 marked E2E)
```

The [→E2E] mark: a failed chunk download is best proven in a real browser,
but R1's approved dom test (a lazy import that rejects) catches the
regression that matters, a route with no boundary. No LLM or prompt files
change in this review (the brief is text for a Claude, but no change to it
is proposed), so no eval.

Tests made obsolete by this review: none.

### Section 4: Performance

No issues found. Every list a link can carry is capped (128 shapes, 64
items per inner list, 16 ends, 32 roads); a link unpacks to at most 64 KB
and is at most 4,096 characters; the preview draws three pieces. The
duplicate check (`trackMatch`) stringifies every built-in once per piece,
memoised (`PreviewScreen.tsx:106`). The fuzz probe built 2,710 accepted
pieces' layouts and 3D scenes in about half a second in total [measured:
the session's fuzz probe, Bun on an M-series Mac], none over 2 s.

### Outside voice (Codex, gpt-6-astra, 2026-11-11)

Completed; five findings, each reproduced here before it was asked:

- OV-1 (High): a 756-character link with 128 band trusses passes and builds
  about 1.3 million floats of 3D geometry (3,200 bodies), under the 3D
  view's 10,000-segment ceiling, which counts bodies, not geometry.
  Reproduced [measured: session probe, 29 ms in Bun on a Mac; Codex measured
  2.1 s and 241 MB on its larger variant].
- OV-2 (Medium): an unknown field's NAME goes into the reason as written
  (`untrustedPart.ts:145`); `briefLink decode` prints reasons to the
  terminal. A field named with an OSC 52 escape reaches the reason raw.
  Reproduced.
- OV-3 (Medium): the 3D view draws a vault's crown at its spring plus half
  its width (`decor.ts:78-103`), ignoring `topMm`, while the sizes, the
  collision boxes and the tunnel clearance use `topMm`. A vault can say 21 mm
  and draw 70. Reproduced: Codex's vault is accepted; every built-in vault's
  stated top equals its drawn crown exactly (session probe).
- OV-4 (Medium): other shapes draw NaN too. A dome with `archMm: 0`: 176
  non-finite values, reproduced. A circular truss with its inner crown at
  its spring: not reproduced here (the seed tried had a deck); Codex reports
  320.
- OV-5 (Medium): `encodePreview` caps characters only; a 1,720-character
  link of 128 plain vaults unpacks to 90,845 bytes and the preview refuses it
  as too large. The script hands the sender a link the app won't open.
  Reproduced.

## Decision ledger (eng review, 2026-11-11)

### R1: what a failed screen download shows (F4)
Finding: F4, INFORMATIONAL, confidence 8/10, app/src/main.tsx:33-48, reviewer: Claude (this review)
Plan baseline: plan step 3 says the preview "says the link can't be shown and why, instead of crashing"; no decision covers a failed chunk download
Runtime evidence: no error boundary around either lazy route's Suspense (main.tsx:33-48); no preloadError handler; the blank page itself is inferred (R-6)
Comparison grid:

| Choice | Current | A (catch it) | B (leave it) |
|---|---|---|---|
| R1 a failed chunk download on a link | blank page, silent | the link's "couldn't be shown" sentence with Reload and the way out | blank page |
| R2 a pasted link in the same tab | pending | pending | pending |
| R3 to R5 | pending | pending | pending |

Question D3:
D3 — When a link's screen fails to download, show a sentence instead of a blank page?
Project/branch/task: ChooChooCAD, contributor-eng-review: main.tsx, the two link routes (layout and piece preview).
ELI10: A shared link or a piece preview opens a screen the browser downloads separately. If that download fails, on a weak phone signal or in the minutes after we deploy (the old files are gone), nothing catches the error and the page goes blank: no words, no button. The fix wraps both link screens in the boundary the app already has for crashes, so the person sees "This link couldn't be shown" with a Reload button and the way out.
Stakes if we pick wrong: a parent opening a link from a chat sees a white page and assumes the site is broken.
Recommendation: A because it is a few lines around code that already exists, and a blank page is the one failure with no way out.
Completeness: A=10/10, B=3/10
Pros / cons:
A) Catch it, say it (recommended)
  ✅ A failed download shows the link's existing crash sentence and a way out, not a white page
  ✅ Covers layout links and piece previews in one change, with a test that makes the download fail
  ❌ One more wrapper in main.tsx, and a new Reload word to keep in linkWords.ts
B) Leave it
  ✅ No change to the entry file, which every page load runs through
  ✅ The failure needs a bad network or a deploy at the wrong minute, so it is rare
  ❌ When it happens the page is blank and silent, with nothing to press
Net: a sentence and a way out (A) or a rare silent blank page (B).
Header: Failed load
Options:
A) Catch it, say it (recommended)
Wrap each lazy link route in an error boundary that shows the link's "couldn't be shown" sentence, a Reload button and the way out (as LinkBoundary does for a crash). Test: a dom test whose lazy import rejects, for each route. Effort: human ~2 h / CC ~15 min. Risk low.
B) Leave it
No change. A failed download keeps showing a blank page. Effort: none. Risk: a rare, silent dead end.

State: approved
Actual answer: A) Catch it, say it (recommended); owner, 2026-11-11, D3
Accepted scope: wrap each lazy link route (layout and piece preview) in an error boundary that shows the link's "couldn't be shown" sentence, a Reload button and the way out; a dom test per route whose lazy import rejects
History: none

### R2: a link pasted into a link screen's tab (F2)
Finding: F2, INFORMATIONAL, confidence 8/10, app/src/main.tsx:36 and app/src/PreviewRoute.tsx:41-59, reviewer: Claude (this review)
Plan baseline: share plan D8, D15, D34: a link pasted into the editor's tab reloads into that link (App.tsx:560-578); nothing decided for a link screen's own tab
Runtime evidence: main.tsx reads location.hash once (lines 30-36); no hashchange listener in PreviewRoute.tsx, LinkRoute.tsx or main.tsx
Comparison grid:

| Choice | Current | A (reload) | B (leave it) |
|---|---|---|---|
| R1 a failed chunk download on a link | approved (D3): sentence, Reload, way out | approved (D3), unchanged | approved (D3), unchanged |
| R2 a pasted link in a link screen's tab | old screen stays under the new address | the page reloads into the new link, as the editor does | old screen stays |
| R3 to R5 | pending | pending | pending |

Question D4:
D4 — When someone pastes a new link into a tab already showing a link, open the new one?
Project/branch/task: ChooChooCAD, contributor-eng-review: the piece preview and shared-layout screens.
ELI10: The browser doesn't reload when only the part after # changes. The editor knows this and reloads itself when a link is pasted in. The preview and shared-layout screens don't: paste the sender's fixed preview link into the same tab and the address changes, but the screen still shows the old piece. You reviewing issue after issue in one tab would be looking at the wrong drawing.
Stakes if we pick wrong: a reviewer or sender checks a piece that isn't the one in the address bar, and approves or posts the wrong drawing.
Recommendation: A because these screens hold nothing unsaved, so a reload is always safe, and the editor already does exactly this.
Completeness: A=10/10, B=4/10
Pros / cons:
A) Reload into the new link (recommended)
  ✅ The screen always matches the address, so a review never looks at the previous piece
  ✅ Same behaviour as the editor, from a few lines in one place, with a dom test per screen
  ❌ A reload re-downloads the link screen, a short blink on a slow phone
B) Leave it
  ✅ No change to screens that work today when opened from a click
  ✅ Clicking a link from a chat usually opens a fresh tab, which already works
  ❌ Pasting into the same tab shows the wrong piece with no warning
Net: the screen always matches its address (A) or a silent mismatch on paste (B).
Header: Pasted link
Options:
A) Reload into the new link (recommended)
On a hashchange in a link screen (piece preview or shared layout), reload the page so main.tsx routes the new address as a fresh visit; any other address (no link) also reloads into the editor. Test: a dom test per screen that changes the hash and expects a reload. Effort: human ~1 h / CC ~10 min. Risk low.
B) Leave it
No change: the screen keeps showing what it first opened until the person reloads by hand. Effort: none. Risk: a reviewer checks the wrong piece.

State: approved
Actual answer: A) Reload into the new link (recommended); owner, 2026-11-11, D4
Accepted scope: on a hashchange in the piece preview or shared-layout screen, reload so main.tsx routes the new address as a fresh visit; a dom test per screen that changes the hash and expects a reload
History: none

### R3: inherited names accepted as fields (F1)
Finding: F1, INFORMATIONAL, confidence 9/10, engine/data/untrustedPart.ts:141-145, reviewer: Claude (this review)
Plan baseline: the checker's own contract, untrustedPart.ts:19-23, "UNKNOWN FIELDS ARE REFUSED, NOT STRIPPED"; E1 (D4) "same checks as submissions"
Runtime evidence: probe in this session: a medium straight sent with an extra `toString`, `constructor`, `__proto__`, `valueOf` or `hasOwnProperty` field is ACCEPTED; `madeUp` is refused. Cause: `k in required` (line 142) and `k in optional` / `k in refused` (143-144) are true for names every object inherits, so the loop skips them. A Part keeps the field (it is passed on as the piece); a decorated spec drops it when derived.
Comparison grid:

| Choice | Current | A (own keys only) | B (leave it) |
|---|---|---|---|
| R1 failed chunk download | approved (D3) | approved (D3), unchanged | approved (D3), unchanged |
| R2 pasted link in a link screen | approved (D4) | approved (D4), unchanged | approved (D4), unchanged |
| R3 a field named like an inherited one | accepted, kept on the piece | refused, named, like any unknown field | accepted |
| R4, R5 | pending | pending | pending |

Question D5:
D5 — Make the piece checker refuse fields named like toString or constructor?
Project/branch/task: ChooChooCAD, contributor-eng-review: engine/data/untrustedPart.ts, the checker every preview link and briefLink.ts run.
ELI10: The checker promises to refuse any field it doesn't know, because a field nobody bounded could be read by the app tomorrow. I tried it: a piece with an extra field called "toString" or "constructor" passes, while "madeUp" is refused. The test it uses asks "is this name in my list?", and every list in JavaScript quietly "contains" a handful of built-in names. The fix asks "is it one of my own names?", one word changed in one place, plus a test.
Stakes if we pick wrong: a crafted link carries a field the checker never looked at into the app, where code that later reads that name gets a number instead of a function and can break.
Recommendation: A because it makes the checker keep its own promise with a one-line change, and the probe shows the hole is real.
Completeness: A=10/10, B=3/10
Pros / cons:
A) Check own names only (recommended)
  ✅ Every field the checker doesn't know is refused and named, toString and __proto__ included
  ✅ One change in obj() covers every object the checker reads: the piece, its shapes, its dimensions
  ❌ A test per inherited name to keep, so the hole can't come back
B) Leave it
  ✅ No change to a checker that every built-in piece passes today
  ✅ Nothing in the app reads these names off a piece today, so no crash is known
  ❌ The checker's "unknown fields are refused" promise stays false for five names
Net: the checker keeps its promise (A) or keeps a known hole (B).
Header: Field names
Options:
A) Check own names only (recommended)
In obj() (untrustedPart.ts:141-145), test field names with Object.hasOwn on the required, optional and refused lists instead of `in`. Test: an untrustedPart.test.ts row sending each of toString, constructor, __proto__, valueOf and hasOwnProperty on a piece and on a shape, each refused naming the field; mutation proof run. Effort: human ~1 h / CC ~10 min. Risk low.
B) Leave it
No change: five inherited names keep passing as fields. Effort: none. Risk: a crafted link carries an unchecked field.

State: approved
Actual answer: A) Check own names only (recommended); owner, 2026-11-11, D5
Accepted scope: obj() in untrustedPart.ts tests field names with Object.hasOwn on its required, optional and refused lists; an untrustedPart.test.ts row sends toString, constructor, __proto__, valueOf and hasOwnProperty on a piece and on a shape, each refused naming the field; mutation proof run
History: none

### R4: a zero-length vault (F3)
Finding: F3, INFORMATIONAL, confidence 7/10, engine/data/library.ts:108-109, reviewer: Claude (this review)
Plan baseline: plan step 3, the checker bounds every number and derives boxes with decorBoxesOf, refusing what it throws on; nothing decided on a shape's zero length
Runtime evidence: probe in this session: the tunnel straight's vault at lengthMm 0 passes the checker and decorBoxesOf; buildScene writes 1,652 NaN values (672 with no joints). library.ts:109 throws only for `!(t > 0 && 2 * t < w && spring < top)`. Fuzz: 20,000 in-bounds pieces, 2,710 accepted, none threw, one NaN (this). What the 3D view shows then is unverified.
Comparison grid:

| Choice | Current | A (refuse it in the shape check) | B (leave it) |
|---|---|---|---|
| R1 failed chunk download | approved (D3) | approved (D3), unchanged | approved (D3), unchanged |
| R2 pasted link in a link screen | approved (D4) | approved (D4), unchanged | approved (D4), unchanged |
| R3 inherited names as fields | approved (D5) | approved (D5), unchanged | approved (D5), unchanged |
| R4 a vault with no length | accepted; NaN in the 3D scene | refused with the vault's reason, in the shared shape check (built-ins and links alike) | accepted |
| R5 | pending | pending | pending |

Question D6:
D6 — Refuse a tunnel vault with no length, as it already refuses one with no width or wall?
Project/branch/task: ChooChooCAD, contributor-eng-review: engine/data/library.ts, the shape check every built-in and every sent piece goes through.
ELI10: A tunnel or arch is drawn from a "vault" shape. The shape check already refuses a vault with no width, no wall, or a roof below its springing. It forgets a vault with no length. I fed 20,000 random but in-bounds pieces through the app's drawing code: all drew, except one tunnel with length 0, which put 1,652 "not a number" values into the 3D picture. A sender's Claude typing 0 by mistake would get a broken 3D view instead of a clear message. The fix adds "length over 0" to the same check.
Stakes if we pick wrong: a mistyped tunnel shows a broken or empty 3D view with no reason, instead of a sentence the sender's Claude can fix.
Recommendation: A because it is one more condition in a check that exists for exactly this, and it turns a silent broken picture into a named refusal.
Completeness: A=10/10, B=4/10
Pros / cons:
A) Refuse it in the shape check (recommended)
  ✅ The sender's Claude gets "a vault needs ... a length" and fixes the number before posting
  ✅ Lives in the one shape check built-ins and sent pieces share, so no copy to drift
  ❌ The check's sentence grows a clause, and every built-in vault must still pass (a test already checks that)
B) Leave it
  ✅ No change to a shape check every built-in passes today
  ✅ Only a zero length does it, which a careful sender's Claude won't type
  ❌ The one input that breaks the 3D picture stays accepted, silently
Net: a named refusal (A) or a rare broken 3D view (B).
Header: Zero length
Options:
A) Refuse it in the shape check (recommended)
In decorBoxesOf's vault check (library.ts:109), also require lengthMm over 0, saying so in its error; the checker turns that into a refusal naming the piece. Test: an untrustedPart.test.ts row sending the tunnel straight's spec with its vault's lengthMm 0, refused with the vault's reason; mutation proof run. Effort: human ~30 min / CC ~10 min. Risk low.
B) Leave it
No change: a zero-length vault keeps passing and drawing NaN in 3D. Effort: none. Risk: a silent broken 3D view.

State: approved
Actual answer: A) Refuse it in the shape check (recommended); owner, 2026-11-11, D6
Accepted scope: decorBoxesOf's vault check (library.ts:109) also requires lengthMm over 0 and says so in its error; an untrustedPart.test.ts row sends the tunnel straight's spec with its vault's lengthMm 0, refused with the vault's reason; mutation proof run
History: none

### R5: the preview's own unpack cap and non-JSON refusals, untested (F5)
Finding: F5, INFORMATIONAL, confidence 9/10, engine/data/previewLink.ts:67-78, reviewer: Claude (this review)
Plan baseline: plan step 7, "the preview link (validation, caps, read-only, never stored)" tested; E1 (D4) "caps like share links"
Runtime evidence: briefLink.test.ts:95-100 covers version, bad-encoding and corrupt; :156 covers too-long. No test sends a preview link that unpacks past PREVIEW_MAX_INFLATED (64 KB) or one that unpacks to text that isn't JSON. shareLink.test.ts covers the shared inflate's cap for layout links only, so a preview passing the wrong cap would go unnoticed.
Comparison grid:

| Choice | Current | A (extend the test) | B (leave it) |
|---|---|---|---|
| R1 to R4 | approved (D3 to D6) | approved, unchanged | approved, unchanged |
| R5 the preview's too-large and not-json paths | untested | two rows in briefLink.test.ts:95's test: a crafted 70 KB unpack refused 'too-large', a non-JSON payload refused 'not-json' | untested |

Question D7:
D7 — Add the two missing refusals to the preview link's existing test?
Project/branch/task: ChooChooCAD, contributor-eng-review: engine/data/previewLink.ts and its test in engine/tools/briefLink.test.ts.
ELI10: A preview link is unpacked before it's read, and a crafted link could unpack a few kilobytes into gigabytes and freeze a phone. The code stops at 64 KB, and it refuses data that unpacks to something other than JSON. Both work today, but no test sends either kind of link through the preview's own reader: the layout links' tests cover the shared unpacker, not the preview's settings. If someone later changes the preview's cap, nothing fails.
Stakes if we pick wrong: a later edit loosens the preview's unpack limit and a crafted link can freeze the phone of whoever opens it, with every test still green.
Recommendation: A because it is two rows in a test that already checks the other refusals, and it pins the one setting that guards against a link-bomb.
Completeness: A=10/10, B=6/10
Pros / cons:
A) Extend the existing test (recommended)
  ✅ The preview's 64 KB unpack limit and its non-JSON refusal each fail a test if changed
  ✅ Two rows in the test that already covers version, encoding and corruption, no new file
  ❌ A crafted 70 KB payload to build inside the test, a few lines of setup
B) Leave it
  ✅ The shared unpacker's cap is already tested through layout links
  ✅ No change, and the code works today
  ❌ The preview's own limit can change without any test failing
Net: pin the preview's limits (A) or trust the shared tests (B).
Header: Test gap
Options:
A) Extend the existing test (recommended)
Add two rows to briefLink.test.ts's "a layout link, a later version, and a broken link are refused" test (line 95): '#p1.' plus a deflated 70 KB of zeros, refused 'too-large'; '#p1.' plus deflated plain text, refused 'not-json'. Mutation proof run (cap raised; JSON.parse skipped). Effort: human ~30 min / CC ~5 min. Risk none.
B) Leave it
No new rows; the shared unpacker's cap stays covered through layout links only. Effort: none. Risk: the preview's own limit is unpinned.

State: approved
Actual answer: A) Extend the existing test (recommended); owner, 2026-11-11, D7
Accepted scope: two rows in briefLink.test.ts's refusals test (line 95): '#p1.' plus a deflated 70 KB of zeros refused 'too-large'; '#p1.' plus deflated plain text refused 'not-json'; mutation proof run (cap raised; JSON.parse skipped)
History: none

### R6: a geometry budget for a sent piece (OV-1)
Finding: OV-1, High (Codex), confidence 9/10, app/src/PreviewScreen.tsx:122 and engine/data/untrustedPart.ts:407-434, reviewer: Codex, reproduced by Claude
Plan baseline: E1 (D4) "caps like share links"; the checker caps list lengths, the link caps characters and unpacked bytes; nothing caps the geometry a piece draws
Runtime evidence: probe: 128 band trusses on a straight, 756 characters, accepted; buildScene makes about 1.3 million floats, 3,200 bodies; the 3D view's ceiling (10,000) counts segments plus bodies (3,203). The largest built-in in the preview's scene: the metro station, 43,662 floats [measured: session probe]; 4x that is about 175,000, under the 1.33 million the crafted link makes
Comparison grid:

| Choice | Current | A (apply) | B (keep) | C (investigate) | D (defer) |
|---|---|---|---|---|---|
| R1 to R5 | approved (D3 to D7) | unchanged | unchanged | unchanged | unchanged |
| R6 geometry a sent piece may draw | unbounded within list caps | the checker builds the piece's 3D once and refuses it over a vertex budget (set from the largest built-in, with 4x headroom), naming the budget | unbounded | time a worst-case link on a mid-range phone first (one session), then ask again | unbounded; a TODO |
| R7 to R10 | pending | pending | pending | pending | pending |

Question D8:
D8 — Cap how much 3D drawing one sent piece can make?
Project/branch/task: ChooChooCAD, contributor-eng-review: the piece checker and the preview's 3D view.
ELI10: The checker limits how many shapes a piece can have, but not how much drawing those shapes make. Codex built a 756-character link, 128 arch trusses on one straight, that the checker accepts and that makes about 1.3 million numbers of 3D geometry. A phone opening that link from a chat could stall or run out of memory. The fix: the checker builds the piece's 3D once and refuses it past a budget a few times bigger than the largest real piece, so the script never makes such a link and the preview never draws one.
Stakes if we pick wrong: a crafted or careless link freezes the phone of whoever opens it, including you reviewing an issue.
Recommendation: A because the budget sits in the one checker both the script and the app run, and real pieces stay far under it.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Apply: a geometry budget (recommended)
  ✅ No link the script makes or the app opens can draw more than a few times the largest real piece
  ✅ One check in the shared checker, so the script refuses early and says why in the sender's chat
  ❌ The checker builds the 3D once per check, about 30 ms on a laptop for the worst case
B) Keep the current limits
  ✅ No extra work in the checker; list caps already bound the input's size
  ✅ No real piece comes close today, and a desktop draws 1.3 million floats fine
  ❌ A 756-character link can still stall a phone
C) Investigate first
  ✅ Times the worst link on a real mid-range phone before choosing a number
  ✅ Shows whether the risk is a stall, a crash or nothing on today's phones
  ❌ One more session before anything changes, and the question comes back
D) Defer to a TODO
  ✅ Keeps this review's fixes to the ones already approved
  ✅ The TODO keeps the reproduction for later
  ❌ The link that stalls a phone stays possible until someone picks it up
Net: bound the drawing now (A), trust the input caps (B), measure first (C), or later (D).
Header: Geometry cap
Options:
A) Apply: a geometry budget (recommended)
checkUntrustedPart builds the accepted piece's 3D scene once (engine/src/view3d/mesh.ts buildScene, the preview's graph) and refuses it when its vertex count passes a budget: 4x the largest built-in piece's, a named constant with its why; the reason names the budget. Tests: the 128-truss link refused; every built-in still accepted (the existing test); mutation proof run. Effort: human ~3 h / CC ~20 min. Risk low.
B) Keep the current limits
No change: list caps, the 4,096-character link and the 64 KB unpack stay the only bounds. Effort: none.
C) Investigate first
One bounded session: open the 756-character link on a mid-range phone and time the 3D view; record the result here and ask D8 again. No code change. Effort: human ~1 h / CC ~10 min.
D) Defer to a TODO
A generic-TODOS entry with the reproduction; nothing changes now. Other approved fixes unchanged. Effort: ~5 min.

State: approved
Actual answer: A) Apply: a geometry budget (recommended); owner, 2026-11-11, D8
Accepted scope: checkUntrustedPart builds the accepted piece's 3D scene once (buildScene over the preview's graph) and refuses it over a named vertex budget, 4x the largest built-in's (about 175,000 floats today, the metro station's 43,662 x 4), the reason naming the budget; tests: the 128-truss link refused, every built-in still accepted; mutation proof run
History: none

### R7: a field name with control characters reaches the terminal (OV-2)
Finding: OV-2, Medium (Codex), confidence 9/10, engine/data/untrustedPart.ts:136 and :145, reviewer: Codex, reproduced by Claude
Plan baseline: the checker's own rule, untrustedPart.ts:79-80 and :111, "Control characters (a terminal escape in the maintainer's decode)" are refused in VALUES; nothing covers field NAMES
Runtime evidence: reading: show() at untrustedPart.ts:160 replaces only the first unsafe character (UNSAFE_CHARS has no g flag), so a value with two direction overrides keeps the second. Probe: a piece with a field named ESC ] 52 ; c ; ... BEL is refused, and the reason holds the ESC byte raw; briefLink.ts:191 prints reasons to stderr, so `bun run brief:link decode` would hand the sequence to the maintainer's terminal (OSC 52 can write the clipboard in terminals that allow it)
Comparison grid:

| Choice | Current | A (apply) | B (keep) | C (investigate) | D (defer) |
|---|---|---|---|---|---|
| R1 to R6 | approved (D3 to D8) | unchanged | unchanged | unchanged | unchanged |
| R7 an unknown field's name in a reason | written raw | written as show() writes a value: quoted, cut at 24 characters, EVERY control and direction character replaced with ? (show() today replaces only the first: its pattern has no g flag) | raw | check which terminals act on OSC 52 first, then ask again | raw; a TODO |
| R8 to R10 | pending | pending | pending | pending | pending |

Question D9:
D9 — Make the checker's refusals safe to print, even when a field's name is hostile?
Project/branch/task: ChooChooCAD, contributor-eng-review: engine/data/untrustedPart.ts and `bun run brief:link decode`.
ELI10: When a link has a field the checker doesn't know, the refusal names that field. The checker already cleans field values of hidden control characters, because you run `brief:link decode` in your terminal and some terminals obey hidden codes (one can write to your clipboard). It forgot to clean field names. A crafted link can put such a code in a field's name, and decoding that link prints it straight into your terminal.
Stakes if we pick wrong: decoding a stranger's link in your terminal could quietly change your clipboard or fake what the output says.
Recommendation: A because it reuses the checker's own safe-printing helper for names, in one place, and the risk lands on you, the reviewer.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Apply: print names safely (recommended)
  ✅ No refusal can carry a control character to your terminal or the preview, names included
  ✅ Reuses show(), the helper that already cleans values, so names and values print one way
  ❌ A hostile name shows as a cut, quoted string, harder to read than the raw name
B) Keep it as is
  ✅ Field names print exactly as sent, easiest to match against the JSON
  ✅ Only crafted links hit this; a sender's Claude never names fields with control codes
  ❌ Decoding a crafted link can send hidden codes to your terminal
C) Investigate first
  ✅ Learns whether your terminal acts on clipboard codes before changing code
  ✅ Shows how far a fake diagnostic could go in practice
  ❌ The risk stays while you look, and the fix is one line either way
D) Defer to a TODO
  ✅ Keeps this review's fixes to the ones already approved
  ✅ The TODO keeps the reproduction
  ❌ Decoding stays unsafe on crafted links until someone picks it up
Net: safe names now (A), raw names (B), check terminals first (C), or later (D).
Header: Safe names
Options:
A) Apply: print names safely (recommended)
In obj() (untrustedPart.ts:136-145), a field name the checker doesn't know is written through show() (quoted, cut at 24 characters, control and direction characters as ?), as values already are; show() (line 160) replaces every unsafe character, not only the first (a global pattern). Test: an untrustedPart.test.ts row with a field named with an ESC sequence and one with a direction override, each refused with no control or direction character anywhere in the reasons; mutation proof run. Effort: human ~1 h / CC ~10 min. Risk low.
B) Keep it as is
No change: unknown field names print raw. Effort: none.
C) Investigate first
One bounded check: which common terminals (macOS Terminal, iTerm2, VS Code's) act on OSC 52 from program output; record here and ask D9 again. No code change. Effort: human ~30 min / CC ~10 min.
D) Defer to a TODO
A generic-TODOS entry with the reproduction; nothing changes now. Effort: ~5 min.

State: approved
Actual answer: A) Apply: print names safely (recommended); owner, 2026-11-11, D9
Accepted scope: an unknown field's name goes into reasons through show(); show() replaces every control and direction character (a global pattern); a test row with an ESC-sequence name and a direction-override name, no unsafe character anywhere in the reasons; mutation proof run
History: the question as sent added one sentence to the saved ELI10, "(Also: the cleaning helper only cleans the first bad character in a value; the fix makes it clean all of them.)", restating the option's own scope; options, labels and descriptions were sent as saved

### R8: a vault's stated top against its drawn crown (OV-3)
Finding: OV-3, Medium (Codex), confidence 8/10, engine/data/library.ts:108-109 and engine/src/view3d/decor.ts:78-103, reviewer: Codex, reproduced by Claude (reading)
Plan baseline: plan step 3, the checker derives boxes and refuses what decorBoxesOf throws on; the vault check (library.ts:109) holds walls and spring only
Runtime evidence: decor.ts draws the crown at springMm + widthMm / 2 (no bore, or a bore that isn't round) or bore.centreMm + widthMm / 2 (round), never reading topMm; the boxes, the sizes' "tallest" and the tunnel clearance (verdictView.ts:276, topMm - wallMm) read topMm. Built-ins agree: tunnel straight 60 + 25.5 = 85.5; metro tube 39 + 33 = 72; metro portal 40 + 40 = 80. Codex: width 100, spring 20, top 21 is accepted and draws to 70. Probe: that vault is accepted; all six built-in vaults (TT, MT, MS) are off by 0 mm.
Comparison grid:

| Choice | Current | A (apply) | B (keep) | C (investigate) | D (defer) |
|---|---|---|---|---|---|
| R1 to R7 | approved (D3 to D9) | unchanged | unchanged | unchanged | unchanged |
| R8 a vault whose topMm disagrees with its drawn crown | accepted; sizes and clearance say one height, the 3D another | refused in the vault check when topMm is more than 1 mm from the drawn crown, naming both | accepted | look at whether topMm could be derived instead, then ask again | accepted; a TODO |
| R9, R10 | pending | pending | pending | pending | pending |

Question D10:
D10 — Refuse a tunnel whose stated height doesn't match the arch it draws?
Project/branch/task: ChooChooCAD, contributor-eng-review: the vault check in engine/data/library.ts, used by built-ins and sent pieces.
ELI10: A tunnel's vault states its top height, and the app uses that number for the sizes list, the bumping check and the "your train fits through" sentence. But the 3D drawing works the arch's height out from its width and where the arch starts, ignoring the stated top. If the two disagree, the preview says one height and draws another. Codex sent a vault that says 21 mm and draws 70. Every built-in vault agrees with itself. The fix: the vault check refuses a vault whose stated top is more than 1 mm off its drawn arch.
Stakes if we pick wrong: you review a tunnel whose sizes and train-fit sentence describe a different shape from the one drawn, and merge wrong figures.
Recommendation: A because it adds one condition to the existing vault check, every built-in already passes it, and the preview's numbers then always match its drawing.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Apply: refuse a mismatch (recommended)
  ✅ A tunnel's sizes, bump check and train sentence always describe the arch actually drawn
  ✅ One condition in the vault check built-ins and sent pieces share, with the built-ins as its test
  ❌ A sender's Claude must state the top to within 1 mm of the arch it drew, one more refusal to fix
B) Keep it as is
  ✅ No change to the shape check every built-in passes today
  ✅ A careful sender's Claude derives the top from the same numbers anyway
  ❌ A careless or crafted vault shows sizes that contradict its drawing
C) Investigate first
  ✅ Looks at dropping topMm and deriving it, which would remove the mismatch for good
  ✅ Finds out how much code reads topMm before choosing
  ❌ A schema change touches every vault and the tunnel clearance; slower, and the question comes back
D) Defer to a TODO
  ✅ Keeps this review's fixes to the ones already approved
  ✅ The TODO keeps Codex's reproduction
  ❌ Contradicting vaults stay accepted until someone picks it up
Net: refuse mismatches now (A), keep trusting the stated top (B), look at deriving it (C), or later (D).
Header: Vault height
Options:
A) Apply: refuse a mismatch (recommended)
In decorBoxesOf's vault check (library.ts:109), refuse a vault whose topMm is more than 1 mm from its drawn crown (springMm + widthMm / 2, or bore.centreMm + widthMm / 2 when round), the error naming both heights. Tests: Codex's vault (width 100, spring 20, top 21) refused with both heights; every built-in still accepted (the existing test); mutation proof run. Effort: human ~1 h / CC ~15 min. Risk low.
B) Keep it as is
No change: a vault's stated top and its drawn crown may disagree. Effort: none.
C) Investigate first
One bounded look: every reader of a vault's topMm (boxes, sizes, clearance, collision) and what deriving it would change; record here and ask D10 again. No code change. Effort: human ~1 h / CC ~15 min.
D) Defer to a TODO
A generic-TODOS entry with Codex's reproduction; nothing changes now. Effort: ~5 min.

State: approved
Actual answer: A) Apply: refuse a mismatch (recommended); owner, 2026-11-11, D10
Accepted scope: the vault check (library.ts:109) refuses a vault whose topMm is more than 1 mm from its drawn crown (springMm + widthMm / 2, or bore.centreMm + widthMm / 2 when round), naming both heights; tests: Codex's vault refused, every built-in still accepted; mutation proof run
History: none

### R9: any shape that draws impossible numbers (OV-4)
Finding: OV-4, Medium (Codex), confidence 8/10 (dome reproduced; circular truss reported by Codex, not reproduced here), engine/data/library.ts:118 and the 3D shape code in engine/src/view3d/, reviewer: Codex, reproduced in part by Claude
Plan baseline: R4 (D6) refuses a zero-length vault, one shape; R6 (D8) has the checker build each accepted piece's 3D scene once
Runtime evidence: probe: a dome with archMm 0 is accepted and its scene holds 176 non-finite values; Codex reports 320 for a circular truss whose inner crown equals its spring (the seed tried here has a raised deck, refused for that, so not reproduced). The session fuzz (2,710 accepted pieces) found only the zero-length vault, so these are narrow.
Comparison grid:

| Choice | Current | A (apply) | B (keep) | C (investigate) | D (defer) |
|---|---|---|---|---|---|
| R1 to R8 | approved (D3 to D10) | unchanged | unchanged | unchanged | unchanged |
| R9 a piece whose 3D scene has a non-finite number | accepted; NaN in the scene | refused by the checker, using R6's one build: any non-finite number in the scene refuses the piece, the reason pointing at its decoration | accepted (except R4's vault) | find each shape's bad inputs first and guard them one by one, then ask again | accepted; a TODO |
| R10 | pending | pending | pending | pending | pending |

Question D11:
D11 — Refuse any sent piece whose 3D drawing comes out with impossible numbers?
Project/branch/task: ChooChooCAD, contributor-eng-review: the piece checker, using the 3D build D8 already added to it.
ELI10: D6 fixed one shape (a tunnel with no length) that draws "not a number" values. Codex found more: a dome with a zero arch, and a kind of arch truss with its inner and outer crown at the same height. Guarding each formula one at a time would chase these forever. Since D8 already has the checker build the piece's 3D once, it can also look at what came out: any "not a number" means the piece is refused, with a reason pointing at its decoration.
Stakes if we pick wrong: a piece with an impossible shape shows a broken or blank 3D view with no reason, and the sender's Claude doesn't know what to fix.
Recommendation: A because it reuses D8's build, catches every shape's bad inputs, including ones nobody has found yet, and costs one scan of the built numbers.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Apply: refuse impossible drawings (recommended)
  ✅ Every shape, today's and future ones, is covered by one scan of the numbers D8 already builds
  ✅ The sender's Claude gets a reason instead of a broken picture
  ❌ The reason can say "your decoration draws impossible numbers" but not which formula, less precise than a per-shape rule
B) Keep it as is
  ✅ No extra scan; D6's vault rule covers the case the fuzz found
  ✅ The other cases need exact, unlikely inputs
  ❌ A dome with a zero arch still draws a broken picture silently
C) Investigate first
  ✅ Finds each shape's exact bad inputs, for precise per-shape refusals
  ✅ Could fix the shape code itself so it never makes NaN
  ❌ Open-ended: every shape's maths, and new shapes add more
D) Defer to a TODO
  ✅ Keeps this review's fixes to the ones already approved
  ✅ The TODO keeps both reproductions
  ❌ The broken-picture inputs stay accepted until someone picks it up
Net: one catch-all scan (A), only the vault rule (B), per-shape guards (C), or later (D).
Header: NaN shapes
Options:
A) Apply: refuse impossible drawings (recommended)
checkUntrustedPart, after D8's one buildScene, refuses the piece if any number in the scene is not finite, the reason naming its decoration and asking the sender's Claude to check each shape's sizes. Tests: the dome with archMm 0 refused; every built-in still accepted; mutation proof run. D6's vault rule stays (it names the exact field). Effort: human ~1 h / CC ~10 min. Risk low.
B) Keep it as is
No change beyond D6's zero-length vault rule. Effort: none.
C) Investigate first
One bounded session: fuzz each shape kind for inputs that make non-finite numbers and list them; record here and ask D11 again. No code change. Effort: human ~2 h / CC ~20 min.
D) Defer to a TODO
A generic-TODOS entry with both reproductions; nothing changes now. Effort: ~5 min.

State: approved
Actual answer: A) Apply: refuse impossible drawings (recommended); owner, 2026-11-11, D11
Accepted scope: checkUntrustedPart, after D8's one buildScene, refuses a piece whose scene holds any non-finite number, the reason naming its decoration; tests: the dome with archMm 0 refused, every built-in still accepted; mutation proof run; D6's vault rule stays
History: none

### R10: the script makes links the preview refuses (OV-5)
Finding: OV-5, Medium (Codex), confidence 9/10, engine/data/previewLink.ts:49-56, reviewer: Codex, reproduced by Claude
Plan baseline: the checker's header, untrustedPart.ts:4-5, "a link the brief's script accepts is a link the preview opens, and the other way round"; plan step 2, "Size budget"
Runtime evidence: encodePreview caps the fragment's characters (4,096) but not the JSON's bytes; decodePreview refuses past 64 KB unpacked (PREVIEW_MAX_INFLATED). Probe: 128 plain vaults, 90,845 bytes of JSON, encode ok at 1,720 characters, decode 'too-large'.
Comparison grid:

| Choice | Current | A (apply) | B (keep) | C (investigate) | D (defer) |
|---|---|---|---|---|---|
| R1 to R9 | approved (D3 to D11) | unchanged | unchanged | unchanged | unchanged |
| R10 a piece whose JSON is over 64 KB | encoded; the preview refuses the link | refused by encode as 'too-large', with the same cap and words decode uses | encoded, then refused | probe every built-in's JSON size against 64 KB first, then ask again | encoded, then refused; a TODO |

Question D12:
D12 — Make the link script refuse what the preview would refuse?
Project/branch/task: ChooChooCAD, contributor-eng-review: engine/data/previewLink.ts, used by `bun run brief:link encode` in the sender's chat.
ELI10: The preview refuses a link whose piece unpacks to more than 64 KB, so a crafted link can't fill a phone's memory. The script that makes links only checks the packed size. A piece with lots of repeated shapes packs small but unpacks big: Codex made one that the script happily turned into a link, and the preview then refused it. The sender's Claude would hand over a link that only says "can't be shown". The fix: the script checks the unpacked size too, against the same 64 KB.
Stakes if we pick wrong: a sender posts an issue with a preview link that never opens, and neither of you knows why until you decode it.
Recommendation: A because it makes the script and the preview agree, as the checker's own header promises, with one size check.
Completeness: A=10/10, B=4/10
Pros / cons:
A) Apply: same cap in the script (recommended)
  ✅ Every link the script hands over opens in the preview; the sender's Claude hears why if not
  ✅ One check against the constant decode already uses, so the two can't drift
  ❌ A piece over 64 KB of JSON must be trimmed before it gets a link at all
B) Keep it as is
  ✅ No change; no real piece is anywhere near 64 KB of JSON
  ✅ The preview still refuses the big link safely
  ❌ The script can hand over a link the preview won't open
C) Investigate first
  ✅ Checks whether any real piece's JSON comes close to 64 KB
  ✅ Could show the cap is too tight for decorated pieces
  ❌ The probe already shows the mismatch; this mostly delays a one-line fix
D) Defer to a TODO
  ✅ Keeps this review's fixes to the ones already approved
  ✅ The TODO keeps the reproduction
  ❌ The script and the preview keep disagreeing until someone picks it up
Net: script and preview agree (A), or they can disagree (B, C, D).
Header: Encode cap
Options:
A) Apply: same cap in the script (recommended)
encodePreview refuses with 'too-large' when the piece's JSON is over PREVIEW_MAX_INFLATED bytes (UTF-8), before packing, with the words decode uses. Test: a briefLink.test.ts row, the 128-vault piece refused by encode as too-large; mutation proof run. Effort: human ~30 min / CC ~5 min. Risk none.
B) Keep it as is
No change: encode checks characters only. Effort: none.
C) Investigate first
One bounded probe: every built-in's JSON size against 64 KB; record here and ask D12 again. No code change. Effort: ~10 min.
D) Defer to a TODO
A generic-TODOS entry with the reproduction; nothing changes now. Effort: ~5 min.

State: approved
Actual answer: A) Apply: same cap in the script (recommended); owner, 2026-11-11, D12
Accepted scope: encodePreview refuses with 'too-large' when the piece's JSON is over PREVIEW_MAX_INFLATED bytes (UTF-8), before packing, with decode's words; a briefLink.test.ts row refusing an over-cap piece at encode; mutation proof run
History: none

Approval readiness: PASS. Checked R1 (D3), R2 (D4), R3 (D5), R4 (D6), R5 (D7), R6 (D8), R7 (D9), R8 (D10), R9 (D11), R10 (D12): each accepted remedy cites its own answer. No regression contract is at risk beyond what each record's tests pin (every built-in still accepted, the existing test).

## Eng review: outputs (2026-11-11)

### NOT in scope

- Merging `looksLikePart` (stored Add-a-part rows) into the new checker:
  different contracts on purpose (stored rows are repaired, strangers' links
  refused); merging would change one or the other.
- A real-browser test of a failed chunk download (R1 is proven by a dom test
  whose lazy import rejects).
- Fixing each 3D shape's maths so it can never make NaN: R9's scan refuses the
  result instead; a shape that NaNs on a built-in would fail the every-built-in
  test.
- The brief's text: no change proposed, so no version bump and no eval.

### What already exists

- One codec (`engine/src/io/linkCodec.ts`) and one checker
  (`engine/data/untrustedPart.ts`) shared by the app and the script; every fix
  lands in them, so the script and the preview keep agreeing.
- `decorBoxesOf`'s vault check (`library.ts:109`) is where R4 and R8 go,
  shared with every built-in, whose existing test (every built-in accepted)
  proves the new rules don't refuse real pieces.
- `buildScene` (`engine/src/view3d/mesh.ts`) is what R6 and R9 run once in
  the checker; the preview already runs it, so no new geometry code.
- `show()` (`untrustedPart.ts:158`) already cleans values; R7 reuses it.
- The editor's pasted-link reload (`App.tsx:560-578`) and `LinkBoundary`
  (`LinkMessage.tsx`) are the patterns R2 and R1 follow.

### Failure modes

| Path | Realistic failure | Test after the fixes | Handling | The person sees |
|---|---|---|---|---|
| A link's screen chunk | fails to download (weak signal, a deploy) | R1's dom test | R1's boundary | "couldn't be shown", Reload, the way out (today: blank page, the critical gap) |
| A link pasted into a link screen's tab | no reload | R2's dom test | R2's listener | the new link (today: the old piece) |
| A crafted piece | inherited field names, hostile names, too much geometry, NaN shapes, a lying vault top | R3, R7, R6, R9, R8 rows | the checker refuses, naming why | the refusal and Copy for your chat |
| The script | makes a link the preview refuses | R10's row | encode refuses 'too-large' | the sender's Claude hears why |
| The preview's own limits | loosened by a later edit | R5's rows | tests fail | nothing reaches a person |

Critical gaps flagged: 1 (the blank page, R1), approved for a fix.

### Worktree parallelization strategy

| Step | Modules touched | Depends on |
|------|----------------|------------|
| T7 checker fields | engine/data | — |
| T8 shape and geometry checks | engine/data, engine/src/view3d (read only) | T7 (same file) |
| T9 link caps | engine/data, engine/tools tests | T8 (same files) |
| T10 link routes | app/src | — |

Lane A: T7 → T8 → T9 (engine/data, one PR). Lane B: T10 (app/src, its own
PR). Launch A and B together; they touch no shared files; merge either first.
Conflict flags: none.

## Implementation Tasks (eng review, 2026-11-11)
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T7 (P1, human: ~2h / CC: ~15min)** — engine/data/untrustedPart.ts — refuse inherited names and print every name safely
  - Surfaced by: Section 2 F1 (R3, D5); outside voice OV-2 (R7, D9)
  - Files: engine/data/untrustedPart.ts (obj(), show()), engine/data/untrustedPart.test.ts
  - Verify: `bun run test`; mutation proofs (`in` restored; show() without g; a raw name)
- [ ] **T8 (P1, human: ~5h / CC: ~40min)** — engine/data — shape and geometry checks
  - Surfaced by: Section 2 F3 (R4, D6); outside voice OV-1 (R6, D8), OV-3 (R8, D10), OV-4 (R9, D11)
  - Files: engine/data/library.ts (the vault check: length over 0, top within 1 mm of the drawn crown), engine/data/untrustedPart.ts (one buildScene: a vertex budget, 4x the largest built-in's, and no non-finite number), engine/data/untrustedPart.test.ts
  - Verify: `bun run test` (every built-in still accepted); the 128-truss link, the zero-length vault, Codex's vault and the dome with archMm 0 each refused; mutation proofs
- [ ] **T9 (P1, human: ~1h / CC: ~10min)** — engine/data/previewLink.ts — the script and the preview agree on size
  - Surfaced by: Section 3 F5 (R5, D7); outside voice OV-5 (R10, D12)
  - Files: engine/data/previewLink.ts (encode's byte cap), engine/tools/briefLink.test.ts (too-large and not-json rows at decode; too-large at encode)
  - Verify: `bun run test`; mutation proofs (cap raised; JSON.parse skipped; encode's cap removed)
- [ ] **T10 (P1, human: ~3h / CC: ~25min)** — app/src — link routes: a failed download and a pasted link
  - Surfaced by: Section 1 F4 (R1, D3), F2 (R2, D4)
  - Files: app/src/main.tsx, app/src/LinkMessage.tsx (or the boundary it holds), app/src/linkWords.ts (Reload), a dom test per route
  - Verify: `bun run test`; dom tests: a lazy import that rejects shows the sentence and Reload; a hash change reloads; mutation proofs

_No new tasks from Performance._

### Unresolved decisions
None.

### Completion summary
- Step 0: Scope Challenge — scope accepted as-is (D1 built code; D2 original arrangement)
- Reality rows: 7/7 applicable rows emitted, 1 unverified premise (R-6, what a person sees after NaN geometry or an uncaught error)
- Architecture Review: 2 issues found (F2, F4)
- Code Quality Review: 2 issues found (F1, F3)
- Test Review: diagram produced, 6 gaps identified (4 closed by R1 to R4's tests; F5 decided as R5; 1 marked E2E, proven by a dom test)
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items proposed to user (every finding was fixed, none deferred)
- Failure modes: 1 critical gap flagged (the blank page, approved for a fix in R1)
- Unresolved decisions: 0 in this review
- Outside voice: codex (gpt-6-astra), completed; 5 findings (1 High, 4 Medium), all reproduced but one (the circular truss) and all approved for a fix (D8 to D12)
- Parallelization: 2 lanes, 2 parallel / 0 sequential between lanes (lane A sequential inside)
- Lake Score: 7/7 = answers picking a 10/10 option / answers scored for Completeness (D1, D3 to D7, D12)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 2 proposals, 2 accepted, 0 deferred |
| Outside Review | codex `/plan-eng-review` outside voice (2026-11-11); earlier codex design and plan phases | Independent 2nd opinion | 4 | eng: completed (findings); design: completed (findings); earlier plan review: unavailable | eng: 5 findings, all approved for a fix (D8 to D12); design: 7, all addressed; earlier plan review: native fallback, 10 resolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN | 5 issues, 1 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 2/10 → 8/10, 15 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex (gpt-6-astra), eng phase (plan-review, 2026-11-11): completed, 5 findings (1 High, 4 Medium), 4 reproduced in this session, all approved for a fix. Codex, design phase: completed, 7 findings, all addressed. Codex, earlier plan-review phase: unavailable (missing markers), native fallback only.
- **CROSS-MODEL:** Claude's eng review and Codex found disjoint holes in the same checker: Claude the inherited field names, the zero-length vault, the uncaught chunk failure and the stale pasted link; Codex the geometry budget, hostile field names, the vault's stated top, other NaN shapes and the encode/decode mismatch. Both point at one theme: the checker bounds each number but not what the numbers draw.
- **VERDICT:** CEO + DESIGN CLEARED; eng review ran with issues open as mapped work (T7 to T10, all approved); eng review required to clear once T7 to T10 ship.

NO UNRESOLVED DECISIONS
