# evaluate-epic — reference

Site facts (statuses, panels, config mechanisms, acli traps) live in `avantage-jira-reference`. The per-ticket rubric (R1–R18 + quality checks) lives in `write-requirements/reference.md` §4. This file holds only what is specific to evaluating a whole epic.

## 1. Crawl commands

```sh
# Epic, full
acli jira workitem view <EPIC> --fields "key,summary,status,labels,priority,description,comment,issuelinks" --json

# Children (one parent per query — `parent` is rejected as a --fields value)
acli jira workitem search --jql "parent = <EPIC> ORDER BY key" --fields "key,issuetype,status,priority,summary,labels" --paginate --csv
# Then per child (view takes one key); repeat for any Sub-task grandchildren with `parent = <CHILD>`
acli jira workitem view <CHILD> --fields "key,summary,issuetype,status,assignee,labels,description,comment,issuelinks" --json

# Prior and parallel work
acli jira workitem search --jql 'project in (ENGR,PO) AND issuetype = Epic AND text ~ "<key noun>" AND key != <EPIC> ORDER BY updated DESC' --fields "key,status,summary" --csv
acli jira workitem search --jql 'issue in linkedIssues(<EPIC>)' --fields "key,issuetype,status,summary" --csv
# Older copies of this epic and tickets it depends on — search 2–3 key nouns across ALL statuses
# (unquoted, so different wording still matches); then judge candidates by intended outcome
acli jira workitem search --jql 'project in (ENGR,PO) AND issuetype = Epic AND (text ~ "<key noun 1>" OR text ~ "<key noun 2>") AND key != <EPIC> AND updated >= -365d ORDER BY updated DESC' --fields "key,status,summary" --csv
acli jira workitem search --jql 'project in (ENGR,PO) AND text ~ "<key noun 1>" AND updated >= -180d ORDER BY updated DESC' --fields "key,issuetype,status,summary" --csv

# Existing evaluation page (re-run detection) — Confluence has no acli create/search; use the MCP
#   searchConfluenceUsingCql: space = AE AND title ~ "<EPIC> Evaluation"
```

Assignee: never from CSV (privacy hides email → blank). Use `view --json`.

Code, per repo — read origin, never mutate the working tree:

```sh
gh repo view avantageusa/<repo> --json isArchived,defaultBranchRef --jq '.isArchived, .defaultBranchRef.name'
git -C <CODE_ROOT>/<repo> fetch origin --prune
git -C <CODE_ROOT>/<repo> rev-parse --short origin/<default>          # the SHA every citation uses
git -C <CODE_ROOT>/<repo> grep -n "<symbol>" origin/<default> -- <path>
git -C <CODE_ROOT>/<repo> show origin/<default>:<path>
git -C <CODE_ROOT>/<repo> branch -r --sort=-committerdate | head -20  # long-lived feature branches
gh pr list -R avantageusa/<repo> --state open --json number,title,headRefName,url
```

Always quote `"origin/${D}:${path}"` with braces — in zsh an unbraced `$D:src/...` is read as the `:s` history modifier and fails with `bad substitution`.

Missing repo → clone into `CODE_ROOT` first. Flags that pick a code path → read the live GrowthBook value for the right SDK key (`avantage-jira-reference` → How things are configured) before deciding which code is live. A flag missing from one SDK key usually lives in another environment: fetch each known key and `jq` for the flag name, and say which environment you read it from. If the environment that serves the epic's product (e.g. bet5) is not among the known keys, that is a limit to record, not a guess to make.

**Base currency before a "which balance" question.** Where an epic says "balance" and the platform is multi-currency, check `ledger-layer-config` per environment first. `paymentReportRealCurrencyIndicator` gives the real-money currency (USD); `defaultVirtualCurrency` gives the social one ("White Diamonds"). The default answer is the environment's base currency, and tokens (e.g. FET) are listed in their own currency. The question for Product is only what the config cannot settle: days where only tokens moved, and New Balance on token rows. Decided by Steve Wolfe 2026-09-28 on the PO-3296 trial.

Design — Figma:

- **Look before declaring it unavailable.** A Figma *plugin* server that needs auth is not the only route. Run `ToolSearch` for `figma get_metadata get_screenshot`; the claude.ai Figma connector (`mcp__<uuid>__get_metadata` …) is usually there. The PO-3296 trial wrongly recorded "no Figma" on its first pass.
- **Node too big:** `get_metadata` on a board region can overflow the response ("EOF while parsing"). Take `get_screenshot` with `enableBase64Response: true` and `maxDimension` up to ~4800 to read the layout and notes instead. Record that sub-frame IDs and dimensions were not resolved.
- **A node tens of thousands of pixels wide is a board, not a design.** Report which breakpoints actually have a frame of the *new* design; "update this design" or "proposal" in a frame title means it is not final.
- **Notes on the board are often the real request.** Compare them with the epic. Anything the requester asked for that no story carries (the PO-3296 notes asked for readable text on phone) is a finding. So is a stakeholder label list that the epic calls "existing values".

## 2. Requirement checklists

Apply the `write-requirements` rubric to every Story and the epic. On top of it:

### Epic-level (E)

- **E1 Goal is an outcome**, with a named launch if anything is P1, and an epic-level "done when" someone other than the author can observe.
- **E2 Expected Outcome indexes every child** — and every child appears in it. Stale index = finding.
- **E3 Coverage** — each promised outcome has ≥1 Story (§5 matrix).
- **E4 Scope boundary** — OUT OF SCOPE and UNCHANGED stated; UNCHANGED is QA's regression reference.
- **E5 Cross-cutting NFRs** decided once at epic level, not re-argued per story: authn/authz and server-side authority · privacy / PII retention · responsible gaming, geo-restriction, KYC, age where play or money is involved · observability (logs, metrics, alerts — who is paged) · performance with number + unit + source · localisation (7 locales) · accessibility · analytics / tracking events · rate limits and abuse.
- **E6 Rollout** — flag name (kebab-case), default per environment, kill switch, migration / backfill, rollback, `DEPLOYMENT NOTE:` candidates, deploy ordering across repos.
- **E7 Dependencies** — other teams, vendors (sandbox exists?), infra (tf, SSM, EventBridge), other epics; as links *and* an ordering paragraph with reasons.
- **E8 Parallel work** — open epics or long-lived branches touching the same repos or files.
- **E9 Baseline** — any claimed improvement has a baseline ticket and a named instrument.
- **E10 Status coherence** — epic status consistent with children (an epic in `Ready for Work` with NOT READY stories is a finding). Child priorities match the epic's; Jira automation is meant to cascade them, but on the PO-3168 trial it did not.
- **E11 Freezes and superseded work** — no older epic with the same goal is still open. Find candidates by key nouns (§1), then compare intended outcomes: same user, same capability, same entry point. Identical wording is a strong signal, but differently worded goals can still describe the same epic. For each match, list any requirement it had that this one dropped. Done tickets the epic depends on actually shipped to every environment they promised (check live config per environment). Any active freeze covers the epic's layout work — Avantage: until [PO-3153](https://avantageusa.atlassian.net/browse/PO-3153) (fixed-aspect game viewport) ships, layout targets its canvas. Interim named-breakpoint code must be isolated as throwaway, and no new breakpoints are allowed (decided by Steve Wolfe, 2026-09-29).

### Story-level (S)

- **S1 Testable** — every AC quotable as a pass condition, observable via API / portal / DB state by a tester, deterministic, boundaries to the unit that matters.
- **S2 Preconditions** — account type, entitlement, data state, environment, flag state, device class, logged in or not — stated once above the ACs.
- **S3 Test-env feasible** — the preconditions can actually be set up on QC / smoke / qcsocial: test accounts exist, vendor sandbox exists, flag exists in that GB environment, required infra is present in that env (e.g. wowza tf core is not on smoke). Infeasible → NOT READY or a named enabler task.
- **S4 Non-happy paths** that exist for this story are covered (write-requirements Rule 3 list).
- **S5 Outcome, not design** (§3).
- **S6 Assumptions** listed and classified (§3).
- **S7 Right-sized** — one story, one observable behaviour; a story whose tasks span many repos or whose ACs test unrelated things should split.
- **S8 Consistent** with the epic, sibling stories, the design, and its own comments.

### Findings format

Each finding: ID (`E3`, `S1`, …) · severity `BLOCKER | MAJOR | MINOR` · the ticket key · **quoted offending text** · why it fails · **rewrite or question**. BLOCKER = cannot build or cannot test. MAJOR = will cause rework or a false defect. MINOR = quality.

## 3. Assumptions and design dictation

**Assumptions** — unstated premises the requirement needs to be true. Hunt them in: "existing", "current", "already", "the user's X", "as today", "same as", definite articles pointing at things never defined, and any data an AC reads. Common families: data exists / is populated · a service already exposes it · the user has an entitlement or account type · a vendor supports it · a flag is on in that env · a timezone / currency / locale · ordering of events · single-tenant or single-region.

Classify each:

| Class | Meaning | Goes to |
|---|---|---|
| VERIFIED | Found, with citation (`repo/path:line @ sha`, ticket, schema, live flag) | Assumptions table only |
| CONTRADICTED | Evidence says it is false | BLOCKER or MAJOR finding + question |
| UNVERIFIABLE | No way to check from here (vendor behaviour, business rule, un-instrumented data) | Open question with an owner |

**Design dictation** — the requirement names a mechanism where an outcome would do.

| Dictates design | Outcome-shaped rewrite |
|---|---|
| "Add a `bannedUntil` column to the users table" | "A banned player cannot join a table until the ban expires; the expiry is visible in back office." |
| "Poll the API every 5 seconds for new odds" | "Odds shown to the player are no more than 5 s older than the source." |
| "Create a Lambda that sends the email" | "The player receives the confirmation email within 60 s of signup." |
| "Store the preference in localStorage" | "The preference persists across reloads on the same device." (then ask: across devices too?) |

Not dictation: a CONSTRAINT with its source ("must use Wowza `/real_time` — contracted vendor"), an existing contract other systems depend on, a regulatory mechanism, and anything in a Task. When dictation hides an unasked product question (the localStorage example), the question goes in §6 too.

## 4. Proposed task shape

One row per task in the page; full Task bodies only when the user asks to create them (then `write-requirements` DRAFT → CREATE).

| # | Repo | Task (one line) | Serves | Size | Depends on | Deploy |
|---|---|---|---|---|---|---|
| T1 | `referral` | Expose `isLive` on `GET /schedules` | S2 AC1–AC3 | S — one handler + test, mirrors `live-appearance` | — | — |
| T2 | `referral-tf` | Route for `/schedules` at the gateway | S2 | XS | T1 | DEPLOYMENT NOTE: ECS → tf apply → ECS |

Size with a reason tied to the code (files touched, a comparable past ticket). Mark tasks that are **enablers** (no story, needed anyway), **already done** (cite where), and **spikes**. Then one **Critical path** line and one **Ordering** paragraph with reasons.

## 5. Traceability matrix

| Epic outcome | Story | AC | Tasks | Status |
|---|---|---|---|---|
| Players see who is live | ENGR-1234 | AC1 | T1, T2 | Covered |
| Operators can end a stream | — | — | T5 | **No story** — hidden scope |
| Weekly live report | ENGR-1236 | AC1–AC2 | — | **No task** — `reporting-api` has it at `src/live.ts:40 @ a1b2c3d` (already done?) |

Rows with a gap in any column are findings; everything else is evidence of coverage.

## 6. Open question format

```
OQ<n> — <the question, answerable in one sentence>
Owner: <name / role>   Blocks: <keys + AC refs>   Needed by: <gate: build start | QA | launch>
Why it matters: <what goes wrong if unanswered — one line>
Proposed default: <what engineering will do if Product agrees> (or "none — genuine product choice")
Evidence: <where the ambiguity was found>
```

Owner defaults to the epic's reporter or product owner when nobody else is named; never leave it blank.

Order by what they block: build-start first, then QA, then launch. Engineering-internal questions go in a separate list and get resolved by Engineering, recorded as `DECIDED - <date> <decision>. Decided by: <name>.`

## 7. Page template

Title: `<EPIC-KEY> <Epic summary> — Evaluation (Design)`. Author the body as Confluence HTML directly (§8). The outline below is structural: a `::: <type>` block is a `<div data-type="panel-<type>">` panel, and every ticket key is linked explicitly as §8 shows.

```
::: info
**Verdict: <READY | READY WITH QUESTIONS | NOT READY>** — <one sentence why>.
Evaluated <YYYY-MM-DD> against Jira as read at that time and code at: `<repo>@<sha>`, …
Stories: <n> READY · <n> WITH QUESTIONS · <n> NOT READY. Open Product questions: <n> (<n> block build start).
To move up: <the 1–3 things that would change the verdict>.
:::

## Top blockers
(BLOCKER findings only, max ~7, each linking to its detail below)

::: warning
## Open questions for Product
(OQ list, §6 format, build-start first)
:::

## Epic at a glance
(Goal in one sentence; children table: Key | Type | Status | Verdict | One-line scope)

## Story-by-story evaluation
### <KEY> <summary> — <verdict>
- Testability: …
- Assumptions: (table: Assumption | Class | Evidence)
- Design dictation: (quote → rewrite)
- Gaps / contradictions: …
- Rubric misses (write-requirements R-checks): …

## Epic-level gaps
(E-checks: coverage, NFRs, rollout, dependencies, parallel work, baseline, status)

## What the code says
### <repo> @ <sha>
- Exists today: … (`path:line`)
- Assumed by the stories — holds / does not: …
- Must change: …
- In-flight: open PRs, long-lived branches, other epics

::: note
## Proposed work breakdown
(Critical path + Ordering paragraphs)
:::

(§4 table directly after the panel — tables cannot sit inside panels; enablers, already-done and spikes marked)

## Stories ↔ tasks fit
(§5 matrix; then the four lists: outcomes with no story · stories with no task · tasks with no story · size mismatches; existing children mapped to proposed tasks)

## Risks and dependencies
(Risk | Likelihood | Impact | Mitigation / owner; external vendors and teams)

## Engineering-internal questions
(resolved by Engineering; DECIDED lines as they close)

## Method and limits
What was read (tickets, comments, pages, Figma nodes, repos@sha, flags), what was **not** checked and why, and anything assumed.

## Changes since last evaluation
(re-runs only: new/closed findings, answered OQs struck through with DECIDED lines, verdict movement)
```

Leave out a section with nothing in it and say so in one line — no empty headings, no bare `N/A`.

## 8. Publishing

- **Where:** AE space (spaceId `3374317693`, cloudId `51a56edb-e18e-459f-8f78-8c5507889827`). Parent = the epic's existing design page if it links one; otherwise *Technical Initiatives* (`3511418898`). Not QA, AVANTAGE or PRO spaces.
- **Tool:** `acli confluence` has `page view` only — no create or update (checked 2026-09-28). Use the Atlassian MCP `createConfluencePage` / `updateConfluencePage`.
- **Body: author HTML directly, `contentFormat: "html"`.** The MCP takes the body inline, so size is paid in output tokens. On the PO-3296 trial the same page was 77 KB as minified ADF and about 30 KB as HTML (checked 2026-09-28). Do not route Confluence pages through `adf.py`; that script is for Jira bodies. Call `getContentFormatGuide` once per session. The patterns that matter:
  - panels: `<div data-type="panel-info|panel-warning|panel-note|panel-success">`, **not** `data-type="panel"` + `data-panel-type` (that errors);
  - **no tables inside panels**, so put the table directly after the panel;
  - verdict lozenges: `<span data-type="status" data-color="red|yellow|green">NOT READY</span>`;
  - dates: `<time datetime="YYYY-MM-DD">`;
  - every ticket key: `<a href="https://avantageusa.atlassian.net/browse/KEY">KEY</a>`.
- **Verify:** the create/update response echoes the stored body. Check that the panel macros, status macros and tables are present. `panel-warning` stores as Confluence's yellow `note` macro, which is expected.
- **Re-run:** find the prior page by CQL (§1); update it with `versionMessage: "Re-evaluation <YYYY-MM-DD>"`. Never create a second evaluation page for the same epic.
- **Comments that tag people:** markdown comments cannot mention anyone. Look up the account id (MCP `lookupJiraAccountId`, by name) and post with `contentFormat: "adf"` using `{"type":"mention","attrs":{"id":"<accountId>","text":"@Name"}}` nodes. An `inlineCard` node links the evaluation page.
- **Ticket bodies built with `adf.py`:** never put `` `code` `` inside `**bold**` or `*italic*`. ADF rejects `code` combined with any mark except `link`, and Jira refuses the whole body. The converter now drops the outer mark on code spans; keep the source clean anyway.
- **Product answers left as page comments:**
  - Read them with `getConfluencePageInlineComments` (check both `open` and `resolved`) and `getConfluencePageFooterComments`. Each inline comment's `inlineOriginalSelection` names the question it answers.
  - Comments added while someone is editing the page stay invisible until that person publishes (clicks Update). If Product says "I answered in the doc" and the API returns nothing, ask them to publish before concluding there are no answers. On the PO-3296 trial, 15 answers appeared only after the author clicked Update.
  - Record each answer as a `DECIDED` line in the commenter's name. Reply on the thread for anything that needs a follow-up; a reply takes `parentCommentId` only.
- **Republishing a page that has inline comments:**
  - A full-body update removes the comment anchors unless you keep them, and the threads come loose.
  - Get the current anchors from `getConfluencePage` with `contentFormat: "html"`. If the result is too large to return inline, extract them from the saved file with a script. Each anchor looks like `<span class="annotation" data-annotation-id="…" data-annotation-type="inlineComment">…</span>`.
  - Re-wrap exactly the same text in the same span, including a partial selection, and keep the entity escapes such as `&quot;` as they were.
  - Never reword a question title once it has comments; add the answer beneath it instead.
  - After publishing, check that `getConfluencePageInlineComments` with `resolutionStatus: "dangling"` returns nothing.
- **Epic comment (only on user approval):** one line + link — `Epic evaluation (<verdict>, <n> open Product questions): <page URL>` — via the MCP `addCommentToJiraIssue` with `contentFormat: "markdown"`.
