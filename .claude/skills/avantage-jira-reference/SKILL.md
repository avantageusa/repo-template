---
name: avantage-jira-reference
description: >
  Site-specific Avantage Jira facts read by the write-requirements, write-defects,
  jira-triage, deploy-epic and evaluate-epic skills — tooling (acli first, Atlassian MCP fallback,
  install steps for non-coders), workflows and exact status names, issue types and
  parenting, the ADF panel layout for ticket bodies, titles, priorities, sizing
  anchors, labels and squads, fields, config mechanisms, design sources, numbering,
  request origin, QA hand-off, delivery and the ticket payload format. Load it
  whenever a task creates, edits, reviews or reasons about an Avantage Jira ticket.
---

# Avantage Jira reference

Site `avantageusa.atlassian.net`, cloudId `51a56edb-e18e-459f-8f78-8c5507889827`. **Verified against live Jira on 2026-09-15.**

Two kinds of statement live here. **Facts about the system** — exact status and priority strings, panel types, field IDs, tool limits — are fixed because Jira makes them so; getting one wrong makes a ticket wrong. **Conventions** are what the team does today, with the reason attached, so you can tell when following them helps and when the work needs something else. Where this file and live Jira disagree, live Jira wins and this file gets corrected.

**People** (config, not lore — update when roles change):

| Role | Who |
|---|---|
| Decides what is forbidden in requirements | Jenna |
| Requirement owners who take over drafts | Ivan Vladić, Ivan Lazić, Jenna, engineers |
| Engineering reference voice | Steve Wolfe (`712020:427f314b-1008-46dc-942b-7ea24285e89f`), Filip Milinković |
| Lead dev / triage routing default | Stefan Vučić (`606c58b03e6ea000684e1a9c`) |

---

## Tooling — how to read and write Jira

**Use `acli` (the Atlassian CLI) when it is installed; use the Atlassian MCP connector when it is not.** Both reach the same site. `acli` is preferred because MCP calls are metered, return whole issue bodies regardless of `fields`, and page about five issues at a time — bulk work costs thousands of tokens per key. Never stop a task because `acli` is missing: fall back to the connector and, once, tell the user how to install `acli` for next time.

**Check which you have** — run `acli --version`. If it prints a version, use `acli`. If it errors, use the connector and offer the install below.

**Installing `acli`** (one-time, about two minutes; the user runs these, not you):

- **macOS** (Terminal): `brew tap atlassian/homebrew-acli && brew install acli`. No Homebrew? Download the binary: Apple Silicon `curl -LO https://acli.atlassian.com/darwin/latest/acli_darwin_arm64/acli`, Intel `…/acli_darwin_amd64/acli`, then `chmod +x ./acli && sudo mv ./acli /usr/local/bin/acli`.
- **Windows** (PowerShell): `Invoke-WebRequest -Uri https://acli.atlassian.com/windows/latest/acli_windows_amd64/acli.exe -OutFile acli.exe`, then move `acli.exe` somewhere on your PATH.
- **Linux**: Debian/Ubuntu — add the apt repo per https://developer.atlassian.com/cloud/acli/guides/install-linux/ then `sudo apt install -y acli`; or the binary `curl -LO https://acli.atlassian.com/linux/latest/acli_linux_amd64/acli && chmod +x acli && sudo install -m 0755 acli /usr/local/bin/acli`.
- **Log in once**: `acli jira auth login --web` — opens a browser, sign in with your Avantage Atlassian account. Verify with `acli jira auth status`.

Docs: https://developer.atlassian.com/cloud/acli/. Each release is supported for six months, so `brew upgrade acli` occasionally.

**The commands that matter:**

```sh
acli jira workitem search --jql '<jql>' --fields "key,status,priority,summary,labels" --paginate --csv
acli jira workitem view <KEY> --fields "key,summary,status,parent,labels,description,comment" --json
acli jira workitem create --project ENGR --type Story --parent <EPIC> --summary "<title>" \
  --description-file <body.adf.json> --label a,b --json
acli jira workitem edit --key <KEY> --description-file <body.adf.json> --labels "A,B" --yes
acli jira workitem transition --key <KEY> --status "<Status Name>" --yes
acli jira workitem edit --key <KEY> --assignee "@me" --yes
acli jira workitem link create --out <KEY-A> --in <KEY-B> --type "blocks" --yes   # A blocks B; `link type` lists names
acli jira workitem comment create --help
```

`--label` on create and `--labels` on edit are **additive**. `transition` takes the status **name**, so no numeric ids. `--description-file` accepts ADF JSON — that is how panels get in. **No priority flag on create or edit** — use `--from-json` (`additionalAttributes.priority.name`) or the connector's `editJiraIssue`.

**Traps that give wrong answers rather than errors:** the CSV `assignee` column is the user's email, which Jira privacy hides for many accounts, so it prints blank for tickets that *are* assigned — establish assignment with JQL (`assignee IS EMPTY`) or `view --json`. JQL search is eventually consistent — verify a write with `view`, not `search`. `parent` is rejected as a `--fields` value in `search` — query one parent at a time. `view` takes one key.

**Where the connector is still needed:** setting priority (until `--from-json` is proven), and comments that must render markdown (`addCommentToJiraIssue` with `contentFormat: "markdown"`). The connector's `createJiraIssue` / `editJiraIssue` accept ADF for `description` too, so the panel layout below works on both paths.

---

## House context

**Every ticket key is a markdown link** to `https://avantageusa.atlassian.net/browse/<KEY>` — in chat, documents and ticket bodies alike.

**Projects.** PO carries product requirements, ENGR carries engineering work, IHQ portal work runs under its own label across both. AIB has no new creations but ~146 open items. DEPLOY is release-process owned (see the `deploy-epic` skill). CAS, B2B, BO and PSN have had no new work in 180 days.

**Who writes a requirement does not decide where it lives.** Product owners routinely specify work that lands in ENGR; engineers write requirements too. Pick the project by where the work will be done and which board tracks it. When one requirement splits across projects, say which side holds the acceptance criteria — two copies drift and QA ends up with two truths.

**Hierarchy** (set via `parent`): 3 Novel · 2 Theme · **1 Epic** · **0 Story / Task / Defect / Spike / Execute Test Cases / DevOps** · −1 Sub-task. Novel and Theme are CAS-only and dormant; if work needs a level above Epic, raise it with Jenna rather than reviving them. Legacy `Epic Link` auto-mirrors `parent`, so setting `parent` alone is enough. `Execute Test Cases` is QA's own type — never create one. `DevOps` exists but is unused; put devops work in a Task with the `devops` label.

**Two different workflows.** Read the real transitions before writing a status anywhere.

*Story / Task / Defect:* `Discovered → Requirements → Review Requirements → To Do → Technical Discovery / Technical Requirements → In Development → Development Complete → Ready for QA → In QA → Pending Approval → Pending Deployment → QA / Demo / Staging / Hotfix Deployment Complete → Awaiting Production Deployment → Production Deployment Complete → Done`, plus `Reopened`, `Blocked - Cannot Start`, `Blocked - Untestable`, `Aborted 🤬`.

*Epic:* `Product Discovery → Discovered → Product Requirements → Requirements → UI Design → Review Requirements → Verified → To Do → Ready for Work → Technical Discovery / Technical Requirements → In Progress → Development Complete → Ready for QA → In QA - QA / Demo / Stage / Hotfix Env → QA Testing Complete → UAT Complete → Pending Approval → Pending Deployment → Production Deployed → Production Deployment Complete → Done`, plus `Reopened`, `On Hold`, `PO Rejected`, `Deprecated`, `Standalone Deploy`.

Epics use **In Progress**, stories **In Development** — different statuses. There is no "Ready for Dev"; epics have `Ready for Work`. `Discovered` is intake — the untriaged inbox. The readiness gate is `To Do` for stories and tasks; on an epic `Verified` and `Ready for Work` sit between requirements and build. `UI Design` is a real epic status. **`Pending Deployment` is after QA approval**, not "awaiting deploy to the test env" — never move a ticket there to mean the latter, and never move any ticket backwards (see `jira-triage`).

**Fields.** Only Summary, Issue Type, Project and Reporter are required on create. **There is no Acceptance Criteria field** — criteria live in `description`, inside the green panel described below. Story points are unused (0 of 3,928 in a year) and SWAG is 92% `TBD`, so leaving both empty matches the site.

**"Launch" means one named release, and naming it is what makes P1 mean anything** — the word covers a surface going live, a regulatory go-live and a marketing date. Name the launch and its date in the epic's Goal and in the reasoning of every P1; where it cannot be named, that is an OPEN QUESTION for the epic owner and the item probably is not P1 yet. The site's own definition of a production launch blocker, its entry criteria and the `[LAUNCH BLOCKER]` prefix live in [ENGR-4338](https://avantageusa.atlassian.net/browse/ENGR-4338).

Prior art in Confluence: *DoR for User Stories* (2023; **stale — cites a "Ready for DEV" status that does not exist**), *Story Writing Criteria INVEST*, *Kanban Rules of Engagement*.

---

## Ticket body layout — ADF panels, not bare headings

The house layout is the one [ENGR-5563](https://avantageusa.atlassian.net/browse/ENGR-5563) established and every epic since has followed. Bodies are ADF with coloured panels; a bare markdown `## Heading` is what you get when a tool could not do panels, not the standard. Jira text search is case-insensitive, so heading casing buys nothing — the panel colour is what a reader scans for.

| Type | Panels, in order |
|---|---|
| **Epic** | `info` **Goal** (context, repos, launch) · `success` **Expected Outcome** (bullets; on platform epics this is the index of children by key) · `note` **Designs / approach** (links, ordering, dependencies) · `warning` **Open questions / risks / links** |
| **Story** | plain intro paragraph(s) · `success` **Acceptance Criteria** (numbered `AC1`, `AC2` …) · `info` **QA test instructions** as **named scenarios** (Happy path, Duplicate, Unauthorized …), each with an `Expected:` line · optional `note` Design / data sources · optional `warning` Open questions |
| **Task** | `Repo: <name>.` first line · plain What changes · `success` **Done when** (numbered) · optional `note` Design / ordering · `warning` `DEPLOYMENT NOTE:` where deploy ordering or migration applies |
| **Defect** | plain Steps to Reproduce / Actual Result / Expected Result (see `write-defects`) · `info` Environment and build · optional `note` Evidence / analysis |
| **Spike** | `info` Question + time box · `success` Done when · `note` Method |

Rules that follow from this: **scenarios are named, not numbered** — QA cites AC numbers, and a scenario name ("Unauthorized") survives copy into TestRail where "Scenario 3" does not; **QA instructions verify via API or portal state**, never by watching video playback unless the story is about playback; **cross-cutting test knowledge lives in the story that owns the feature** (how to create a ban lives in the ban story; others link to it).

Build the ADF with `write-requirements/scripts/adf.py` (constrained markdown with `::: info` … `:::` fences → ADF JSON) or by hand following `deploy-epic/reference.md` §1. On markdown-only surfaces the same headings survive as `**bold**` lines, and the panels are added when someone next edits the ticket.

---

## Placement

**Issue type — the first match is usually right.** Observed behaviour contradicting a **written** requirement → **Defect** (`write-defects`); nothing written means a Story or a product decision. A design artefact someone must draw → **Design story** (`DSN-nn`). Answer genuinely unknown, output a finding → **Spike**, time-boxed. User-facing behaviour, independently testable, landing in days → **Story**. Technical work with no user-visible behaviour → **Task**. A shippable outcome a stakeholder would name, with two or more children → **Epic**. A slice of one story with no criteria of its own → **Sub-task**.

Platform work uses **Task** for the repo-level unit of change and **Story** for behaviour that has an observer but no UI; both are common here and the distinction is real. **Task is over-used** — 701 Tasks to 160 Stories in the last 180 days, including story-shaped work — so a Task carrying user-visible criteria is usually a Story.

**Stories are what QA and Product test; Tasks are direct dev work.** Many tasks clearly tied to one story → make them **sub-tasks of that story**. Tasks spanning several stories, or only a few tasks in total → **Tasks directly in the epic**. Tasks under a feature epic go to **Done** when deployed to QC and dev-validated; QA tests the epic's Stories, not its Tasks.

**Parent.** 78% of new items are parented at creation, and an unparented item is invisible in every rollup. An epic "In Progress" with zero open children is stalled rather than a home. Match by product area rather than project — a defect found against a PO story is raised in ENGR but usually parented to the PO epic. Where nothing fits, drafting the epic too and emitting it as a `NEW:` payload entry beats filing an orphan.

Catch-alls, each with its actual scope:

- [ENGR-1758](https://avantageusa.atlassian.net/browse/ENGR-1758) — **On-Call and Ad-hoc Tasks.** Singleton work that must ship on the weekly deploy train. Feature epics stall deployment, so ad-hoc fixes never go under one; link cross-epic dependencies with `blocks` instead.
- [ENGR-4338](https://avantageusa.atlassian.net/browse/ENGR-4338) — **Production Launch Readiness Defects.** Launch-blocking defects only; carries the `[LAUNCH BLOCKER]` definition.
- [ENGR-5836](https://avantageusa.atlassian.net/browse/ENGR-5836) — **Investigation On-Call: Marcus's Technical Spike Queue.** Spikes and investigations, not general ad-hoc work.
- [ENGR-845](https://avantageusa.atlassian.net/browse/ENGR-845) — Platform Tech Debt Epic. **On Hold** — parenting there parks the work; say so, or use ENGR-1758 with the `tech-debt` label.

**Links and ordering.** `Relates` carries 75% of all linking, which makes it close to meaningless. The precise ones: **blocks / is blocked by** · **causes / is caused by** (underused) · **duplicate** · **cloners** · **work item split** · **GLI Requirement** · **relates** when nothing else fits. **Links carry existence, never reason**: every ordering constraint on the site is in prose, so platform work wants both the links and an `Ordering:` paragraph saying why the sequence is what it is.

A dependency encoded only as a label — `BlockedOnPO-3153` — is invisible to every dependency view. The label is the current convention for the PO-3153 layout freeze and drives a queue, so **do both**: the `is blocked by` link *and* the label. Same for status: `Blocked - Cannot Start` plus the link plus the label.

---

## Titles

**Under a PO epic:** `FR-nn <Verb + object + context>` or `USn — <Title>`. Product epics take a plain descriptive title with an em-dash qualifier: *Create Challenges Modal — Rebrand, AI Coach & Intro Restructure*.

**In ENGR** — the patterns in use:

- **`[repo-name]` prefix** when the child belongs to one codebase: `[competition-engine] …`.
- **`service: action`** when the epic spans services and the child is one leg: `wowza-service: emit stream.state.changed …`.
- **`[Claude]` / `[Human]`** where work is split between them, which makes human decision gates first-class tickets rather than blocked comments.
- **`(no UI)`** when the phase deliberately ships none — repeated in the Goal and in the children.
- **`(Phase n)`** as a leading parenthetical on children; the phase in the epic title itself.
- **The finding in the title** where there is one: *…(~$1,000–1,800/mo saving)*, *…dead since 2023, superseded by custom logging/alerting*.

**Bracket prefixes in use**, stackable: `[LAUNCH BLOCKER]` (paired with P1), `[IHQ]`, `[Desktop]`, `[Mobile]`, `[Tablet]`, `[Automation]`, `[Spike]`, `[Suggestion]`, `[MK]`, `[Claude]`, `[Human]`, or a literal repo name. If the work needs a prefix that is not here, use it and say so.

**Titles that have caused trouble:** bare nouns (`Languages`, `Speed`) give the reader nothing to act on; a status in the title goes stale the moment the ticket moves; a person's name as a routing tag disappears when they change team.

---

## Numbering

`FR-nn` / `NFR-nn` / `DSN-nn` is a product requirement's identity; `AC1`, `AC2` … are the criteria inside a story. Epics that number requirements inline may suffix the epic letter (`FR-E1`) or use `USn` — follow whatever the parent already uses. **Platform work uses no FR/NFR/US series**: its children are named by repo or service and its criteria are numbered inside `Done when`.

QA cites **AC numbers** in defects and comments and works from **TestRail** (`avantage.testrail.io`), so AC numbers are what travel. Scenario names inside the QA panel are fine and expected; **child tickets titled `Scenario 1 - …`** (as [PO-3255](https://avantageusa.atlassian.net/browse/PO-3255) does) are not how the rest of the site works.

Number sequentially from 1. Renumbering something already published breaks every citation of it, so append or strike through with a reason instead. **One product criterion maps to one TestRail case**, tagged with a **Module** (matching TestRail's module tree) and a **Critical** flag. Before assigning `FR-nn`, read the epic's existing list and take the next free number. The epic owns that map, listing every child by key with title, state and criteria count.

---

## Request origin

A **Request origin** block: **Requested by** (the person who actually wants this, not the filer) · **Date of request** (YYYY-MM-DD) · **Channel** (Teams DM, Teams channel, Read AI meeting, email, Jira comment on KEY, verbal) · **Link** (URL, or "none") · **Filed by** (you, if different).

Where you cannot establish who asked, `Requested by: unknown` plus an OPEN QUESTION is the honest form. Only ~8% of tickets carry it and the reporter is systematically not the requester. Where the origin is a ticket, an incident or a spike — common in ENGR — use that with links: `Promoted from [ENGR-6556](https://avantageusa.atlassian.net/browse/ENGR-6556)`. Incident follow-up names the originating incident and the detection time it is meant to improve.

---

## Priority

Exact strings — P1 has **no space before the hyphen**. Shares are of ENGR items created in the last 60 days.

- `P1- Super Priority` — stops the named launch or breaks live play now. 13%.
- `P2 - Highest` — committed scope for the current push. 14%.
- `P3 - High` — real, not in the current push. 17%.
- `P4 - Medium` — the site-wide default; it carries half of all work, so on its own it signals nothing. 54%.
- `P5 - Low` / `P6 - Lowest` — rare (2%), mostly housekeeping and deprecation. Fine with a stated reason.

P1 is overwhelmingly launch-blocking defects rather than exec asks; P2 is where new requirement work sits when it is in current launch scope. `[LAUNCH BLOCKER]` and P1 travel together — the definition is in [ENGR-4338](https://avantageusa.atlassian.net/browse/ENGR-4338). **Write the reasoning and name the launch:** `P2 - Highest — in Bet 5 launch scope (go-live 2026-10-06), blocks AC3 sign-off; not P1 because live play is unaffected.`

---

## Sizing — hands-on dev effort

Anchors are wall-clock in `In Development`, so they include nights and weekends and run high against true effort. Match on **shape** rather than the number.

**XS** <0.5d one-icon CSS fix · **S** 0.5–1d trace one bad API field ([ENGR-4382](https://avantageusa.atlassian.net/browse/ENGR-4382) 0.9d) · **M** 1–3d layout rework to a Figma spec ([PO-2503](https://avantageusa.atlassian.net/browse/PO-2503) 2.2d) · **L** 3–5d opt-in with conditional validation ([PO-1732](https://avantageusa.atlassian.net/browse/PO-1732) 4.3d) · **XL** 5–10d cross-system OAuth/SSO ([ENGR-4277](https://avantageusa.atlassian.net/browse/ENGR-4277) 6.8d) · **XXL** 10+d new paginated API on a core service ([PO-1698](https://avantageusa.atlassian.net/browse/PO-1698) 24.7d).

Medians: Task 0.9d, Defect 2.3d, Story 4.8d. Every item carries **Size** with reasoning. **XXL usually means split** — propose the split and size the pieces. Size an Epic as the sum of its children; children unknown → `XXL — not yet decomposed`. Spanning two bands: quote the higher and raise an OPEN QUESTION. SWAG and story points are unused here — leave them empty.

---

## Labels and squads

Several labels are **squad names**, not categories — which is why they look cryptic, and why stripping one takes work off somebody's board:

- **`nameless`** — the squad **"The Nameless Things"**. On nearly every Bet 5 / Game Portal epic and story; drives the saved filter *Nameless Epics* and the dashboard gadget *Priorities for The Nameless Things*.
- **`IHQ`** — Influencer HQ portal work (the most-used label on the site: 527 items in 180 days).
- **`DWH`** — the squad **"Data Sages of Gondor (DWH)"**, which has its own dashboard gadget.

**Matching the parent epic's labels** is the reliable way to get the area right without guessing. When a label is unfamiliar, check whether a saved filter or dashboard gadget is named after it before assuming it is junk.

**Workflow labels written by the triage tooling** — leave them to it, never strip them: `ClaudeTriageTool` (every ticket the triage agent touched; 515 items), `NeedsHuman`, `NeedsProduct`, `NeedsDesign`, `NeedsEpic`, `BreakpointsRequired` (fix changes responsive breakpoints — parked until the breakpoint estate is fixed), `BlockedOnPO-3153` (layout freeze), `claude-ready`, `auto-close`, `bulk-closed-2026-08`.

**Labels the author sets on creation:** `devops` on anything about CI/CD, infrastructure, GitOps, deploy tooling, credential rotation, Tekton/ArgoCD/CodeBuild/Terraform (not app bugs that merely ship through CI). Others in use: `Backend`, `AvantageBaccarat`, `dependabot`, `cloudwatch`, `finops`, `observability`, `tech-debt`, `dead-code`, `stryker`, `security`, `terraform`, `accessibility`, `review`, `AI-LIVE`, `AI-QA`, `ai-agent`, and the AIB security set `AS_Security`, `Architecture`, `Neotech`, `Symphony`. `CSS-Responsiveness-Audit` is still the live spelling for responsiveness work. If nothing fits, leaving it unlabelled and saying so beats guessing; a genuinely new label gets proposed with its reason. **Components** are configured on AIB only.

---

## Fields — who sets what

**The author sets:** Summary, Description, Issue type, Project, Parent, Priority with reasoning, Labels, Issue links. **Assignee is left blank** on requirements — assignment is not the author's call. (The triage and auto-PR flows assign on *work start*; that is a different moment.)

**Owned by others, so flag rather than set:** Due date and Target Production Date (`customfield_10660`) belong to leads; Target Production Environment (`10665`) and Fix versions to the release process; QA Assigned (`10584`) to QA. *Field IDs carried over from the 2026-09-14 draft; unverified.*

**Barely used, so filling them in adds noise:** `10657` Test Case Required?, `10609` Signed, `10612` GLI, `10618` Defect Type, `10635` Testing Type. Work that needs GLI traceability or a sign-off is better served by saying so in the description.

---

## Designs and sources of truth

**Link the Figma design whenever one exists.** A node-level URL (`.../design/<file>?node-id=<node>`) with the frame's name and dimensions, one per breakpoint where the designs differ, plus a line naming which source wins if they disagree. A bare file link, the bare word "Figma", or a `blob:` staging URL resolves for nobody. **Put the design link on the child, not only on the epic** — that is how [ENGR-6607](https://avantageusa.atlassian.net/browse/ENGR-6607) stalled. Where there genuinely is no design, `Design: none — no UI change` says so plainly. Live files: `0AHxJw.../2026-Current-In-progress--Wolfe-` (master), `gjxSUMq.../Flows` (betting/game area), `01dUujC.../IHQ`.

**Design does not only mean Figma.** Platform work has its design in a **Confluence page** (AE space, under *Technical Initiatives*, title ending "(Design)"), a **repo plan** (`<service>/docs/plans/<date>-<name>.plan.md`) or a **pull request**, and the ticket names the section it relied on (`Design §7`). Link every source the work actually has; a platform ticket that says `Designs: N/A` has not looked.

**Resolve node identity before saying anything about a design** — for every Figma node cited, read its **name and dimensions** and write them down. Two nodes only conflict if they cover the same breakpoint. A node measured in tens of thousands of pixels is a board region, not a design — ask for a frame. Open the frame before writing a criterion about what it contains; breakpoint differences are usually designed and width-driven. Only then does a same-breakpoint contradiction count as a source conflict — name both nodes, rule, or raise an OPEN QUESTION and mark it BLOCKED.

**Figma tool limits:** the connector reads structure and renders frames but has **no comments tool**, so "the designer said so in a comment" is an OPEN QUESTION. Request screenshots with `enableBase64Response: true`; a bare image URL will not fetch.

---

## How things are configured

Three mechanisms, and naming the wrong one misdescribes the work:

- **GrowthBook** — the product feature flag and kill switch, kebab-case names (`multi-pool-fanout`, never SCREAMING_SNAKE). Carries tunable values on product surfaces; on platform work normally a boolean gate with a stated default, often "off in every environment until QA sign-off". **Environments differ**: player/portal (`sdk-b1Xn2yyIqvCEvYAM`), qcsocial (`sdk-ALgarZ5Ki6RJGCsg`), prod social (`sdk-BBLLoHcV6WIYwsLa`); back-office flags live in yet another. Values sit at `defaultValue` **or** `rules[].force`; rules win. Flags also get retired — say so when a change deprecates one.
- **SSM parameters** — the platform tuning mechanism, given as a path: `/logcontrol/<stage>/<service>/log-level`. An entire cost epic ([ENGR-6388](https://avantageusa.atlassian.net/browse/ENGR-6388)) turns on these.
- **Environment variables** — per-service switches and timings, named exactly: `PROBE_GATE_ENABLED`, `SESSION_PENDING_PROBE_TTL_SECONDS`.

For every configurable value give the name, the default, the bounds and what it controls. "Nothing is configurable" is a useful answer; silence is not.

**`DEPLOYMENT NOTE:`** — exact prefix, colon, on a Jira **comment** (and repeated in the body's warning panel) for anything a deploy needs beyond merge + deploy: flags, SSM params, migrations, secrets, infra, env vars, ordering. The `deploy-epic` skill greps comments for that exact prefix to build the release runbook; a dash or lowercase variant is missed.

---

## QA hand-off

User-facing work hands over the numbered criteria, the UNCHANGED regression row, the regression scope line, and a TestRail mapping table of `AC ref | Module | Critical | TestRail case`. Platform work hands over the `Done when` list, the invariant, and the `info` panel of named scenarios with an `Expected:` line each. State the verification method and its limits — [ENGR-6378](https://avantageusa.atlassian.net/browse/ENGR-6378) says plainly "Do not verify via video playback — all checks are API/portal state."

**Preconditions are the part QA cannot guess** — account type, entitlement, data state, environment, device class, logged-in or not, flag state. State them once, above the criteria. **Every criterion wants to be quotable as a pass condition:** if it cannot be lifted straight into a test's expected result, it is not yet testable. A criterion on a BLOCKED item is still written out and marked BLOCKED. A criterion with no requirement behind it is a gap — raise the missing requirement rather than inventing one.

---

## Delivering a requirements document

Where the draft goes before it becomes tickets:

- **Engineering / platform work** → a Confluence page in the **AE** space under **Technical Initiatives** (page id `3511418898`), title ending **"(Design)"**; or, for a single-repo change, the repo's `docs/plans/YYYY-MM-DD-<slug>.plan.md`.
- **Product work** → wherever the product owner drafts; Confluence in the product space, or Google Docs when the reviewer works there.
- **A single item under an existing parent** → chat, with the payload.

**Full form**: 1 Title, shape and one-line scope · 2 Request origin · 3 The epic · 4 One section per requirement or child, in number or ordering sequence · 5 Localisation table, or config, contracts and measurement · 6 QA hand-off · 7 Open questions with owner and gate · 8 Ticket links as full URLs · 9 Appendix: ticket payloads. **Short form** — Request origin, Summary, criteria, out of scope, priority, size.

**If the destination is Google Docs**, the markdown converter is lossy: indent code four spaces instead of fencing it, repeat a table's header as its first body row, put full URLs on their own line, and read the document back — the Drive connector silently creates an empty file above roughly 20KB (returns size 1, no error), so check the size and fall back to `.docx`. Always state what you could **not** determine.

---

## Ticket payload

In the appendix as plain indented text, four spaces deep. One block per item, parent-first; a parent that does not exist yet is a `NEW:` entry referenced by title. Platform items add `repos`, `ordering_note` and `deployment_note` where they apply.

    - project: PO
      issuetype: Story
      parent: PO-3087
      summary: "FR-01 Apply the Tablet Portrait layout to Mobile Portrait"
      body_file: fr-01.md            # constrained markdown → scripts/adf.py → ADF
      priority: "P2 - Highest"
      priority_basis: "Bet 5 launch scope; live play unaffected"
      labels: [nameless, CSS-Responsiveness-Audit]
      links: [{type: is blocked by, key: ENGR-6423}]
      design: {mobile_portrait: "<node URL> (<frame name>, <w>x<h>)"}
      repos: []
      tshirt: M
      tshirt_basis: "1-3 days; shape matches PO-2503"
      origin: {requested_by, request_date, channel}
      initial_status: Discovered
      readiness: blocked
      blocked_on: ["<the open question that must close first>"]

Fields the site does not use, so emitting them adds noise: SWAG, story points, `assignee`, `duedate`, `fixVersions`, and custom fields `10657`, `10609`, `10612`, `10618`, `10635`, `10660`.
