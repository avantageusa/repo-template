---
name: evaluate-epic
description: >
  Evaluate a Jira epic before (or during) build: gaps, contradictions and errors
  in the epic and its children, whether each Story is testable as written, the
  assumptions baked into the requirements, requirements that dictate design
  instead of stating outcomes, and the open questions Product must answer. Reads
  the code on origin to derive the work tasks the epic will really need, then
  checks how those tasks fit the stories as written. Writes the result to a
  Confluence design document. Use when someone says "evaluate this epic",
  "is ENGR-XXXX ready", "review the epic", "what's missing from this epic",
  "what questions does Product need to answer", "break this epic into tasks",
  or "sanity-check the stories against the code". For grading a single ticket
  use write-requirements REVIEW; for building a DEPLOY ticket use deploy-epic.
---

# Evaluate an epic

Take an epic and answer one question for the people who own it: **can this be built and tested as written, and if not, what has to be decided first?** The answer is a Confluence page Product and Engineering both work from.

**Load first:** `avantage-jira-reference` (tooling, statuses, panel layout, config mechanisms, QA hand-off). The per-ticket rubric this skill applies is `write-requirements` → `reference.md` §4 — reuse it, do not restate it. Checklists, the page template and commands live in this skill's `reference.md`.

## Scope — what this skill writes

| Writes | When |
|---|---|
| One Confluence page (create, or update in place on re-run) | Always — it is the deliverable |
| Jira comment on the epic linking the page | Only after the user says yes — it is visible to Product |
| New Tasks / Stories from the proposed breakdown | Only on explicit approval, via `write-requirements` CREATE mode (dry-run first) |

**Never** transition, re-parent, relabel or edit the body of the epic or any child. Findings go in the page; the owners decide what to change. **Never** check out, pull or reset a local repo — read code from `origin/<default>` (see the Git branch policy in the workspace `CLAUDE.md`).

## Verdicts

Every Story, and the epic overall, gets one:

- **READY** — builder and tester can start without a meeting.
- **READY WITH QUESTIONS** — can start; named questions must close before a named gate (usually QA).
- **NOT READY** — a question blocks the build itself, or the story cannot be tested as written.

A verdict always names what would move it up. "NOT READY" with no path is a complaint, not an evaluation.

## Process

### 1. Crawl the epic

Epic body + comments, every child (and grandchild sub-task) with body + comments, issue links in and out of the epic, linked Confluence pages, Figma links (open them — see `reference.md` §1 Design; never record Figma as unavailable without a `ToolSearch`), repo plans and PRs. Read **comments**, not just bodies — a requirement negotiated in a thread is a finding (write-requirements Rule 8). Record status and assignee of each child; a child already In Development changes which findings are actionable.

Also search for **prior and parallel work**: other open epics touching the same nouns or repos, closed epics this one supersedes, and aborted attempts (read why they aborted). See `reference.md` §1 for the JQL. Three checks that caught real problems on the PO-3168 trial:

- **An older epic with the same goal, still open.** Search by key nouns rather than an exact title, and compare intended outcomes rather than wording. PO-2808's goal happened to be identical to PO-3168's, but a reworded older epic counts too. If they match, closing the older one is a finding. List any of its stories this epic dropped: PO-2808's "Inline Error Handling" never made it into PO-3168, so the new epic had no error state.
- **"Done" is not "everywhere".** For any Done ticket the epic relies on that promised a config or rollout step across environments, check each environment live. PO-3167 changed the menu flag on QC only, and prod-social still had it forced on.
- **Active freezes.** If the epic has layout, breakpoint, viewport or responsive requirements, check whether a freeze covers them (Avantage: PO-3153, see `reference.md` §2 E11). Frame the design questions against the freeze, not against per-breakpoint layouts.

### 2. Read the requirements — epic and story level

Run the checklists in `reference.md` §2 against the epic and each Story, and report **misses only**, citing the check ID (R12, E5, S3 …). Do not list passes. What each looks for:

- **Gaps** — non-happy paths, NFRs (auth, server-side authority, privacy, responsible-gaming / geo / KYC where money or play is involved, observability, performance, localisation, accessibility, analytics events), rollout and kill switch, data migration and backfill, rollback, and the epic-level "how do we know it's done".
- **Errors and contradictions** — story vs story, story vs epic Goal, story vs design, comment vs body, quantity vs quantity. Establish a conflict is real before reporting it (two Figma nodes at different breakpoints are not a conflict).
- **Testability** — every AC quotable as a pass condition; preconditions stated; observable via API or portal state by someone other than the builder; boundaries precise and observable, numeric where the behaviour has a quantitative boundary; no weasel words (the list in `write-requirements`); **feasible in a real test environment** — the accounts, data, flags, vendor sandbox and env actually exist on QC/smoke.
- **Assumptions** — every unstated premise the requirement depends on. Each gets classified (§3 below): verified, contradicted, or unverifiable → open question.
- **Design dictation** — a Story or epic Goal that prescribes *how* ("add a column", "use a Lambda", "call X from Y", "store in Mongo", "poll every 5s") instead of *what must be true*. Report it with an outcome-shaped rewrite. **Not** design dictation: a genuine constraint with a stated source (regulatory, vendor limit, existing contract), and Tasks — Tasks are supposed to be about implementation.

### 3. Read the code

For each repo the epic touches — named in the epic, implied by the nouns, or found by search — check it is not archived, clone it into `CODE_ROOT` if missing, `git fetch`, and read `origin/<default>`. Record the **commit SHA** you read; every code claim in the page cites `repo/path:line @ sha`.

Answer, per repo:

- **What exists today** that the epic touches. Stories often ask for something that already exists, partly exists, or exists behind a flag in a different tree (e.g. `competition-client` v2/v3). Read the flag's live value before deciding which code is live.
- **What the stories assume about the code** — and whether it holds. "The existing endpoint returns X", "the user already has Y" — verify or contradict with a citation.
- **What has to change**, at the level of a task a dev would pick up.
- **In-flight collisions** — open PRs, long-lived feature branches (`git branch -r`), other open epics editing the same files.

For more than two repos, fan out read-only subagents (Explore) in the background, one per layer (e.g. front end, backend). Give each:
- the stories, quoted;
- the specific assumptions to confirm or refute;
- numbered questions;
- the no-checkout rule;
- a word cap;
- the instruction to return `path:line @ sha` findings only.

While they run, do the Jira and flag work. **Spot-check the one or two claims that carry the verdict yourself** before publishing. Subagent output is evidence to check, not the verdict.

### 4. Derive the work breakdown

Propose the Tasks the epic will actually need, in the house Task shape (`Repo:` line, What changes, Done when, ordering, DEPLOYMENT NOTE candidates) — see `reference.md` §4. Each task gets: repo, one-line scope, size with reasoning (sizing anchors in `avantage-jira-reference`), dependencies, and **the Story / AC it serves**.

Enablers (infra, tf, SSM, flags, migrations, baseline measurement) are tasks too; an epic missing them usually fails at deploy, not in QA. Name the **critical path**.

Where an unknown is too big to size, propose a **Spike** with a question, a time box and what "answered" means, rather than guessing a size.

### 5. Fit the tasks to the stories

Build the traceability matrix (`reference.md` §5): epic outcome → Story → AC → Task. Then report:

- **Outcomes no story delivers** — the epic promises it, nobody builds it.
- **Stories no task implements** — either already done in code (say where), or missing work.
- **Tasks no story justifies** — hidden scope. Either an enabler (fine — say so), or a requirement nobody wrote (needs a story, or QA will never test it).
- **Stories whose size is wildly off** what the code says — a one-line story that needs four repos is a scoping finding.
- **Existing tickets vs proposed tasks** — map children already in the epic to proposed tasks; flag duplicates and gaps.

### 6. Write the open questions

Every unresolved item that needs Product (or another owner) becomes a numbered question — format in `reference.md` §6. Each carries **the owner, what it blocks (story/AC keys), the gate it must close by, and engineering's proposed default**. A proposed default turns a meeting into a yes/no; without one, questions sit.

Separate **Product questions** from **engineering-internal** ones (which Engineering answers itself and records as DECIDED). Don't hand Product a question the code can answer.

### 7. Publish

Build the page from the template in `reference.md` §7, authored as Confluence HTML (not ADF — see §8 for why), and publish per §8: AE space, a child of the epic's existing design page if it has one, otherwise under *Technical Initiatives*. Re-run on an epic that already has an evaluation page → **update that page** with a "Changes since last evaluation" section; answered questions stay, struck through, with a `DECIDED` line.

Then report in chat: the page link, the epic verdict, story verdict counts, the top blockers, the number of open Product questions, and **what you could not verify**. Offer (one line each) to (a) post a comment on the epic linking the page, and (b) create the proposed tasks via `write-requirements` CREATE.

### 8. Collect answers and walk the open questions

Product often answers as inline comments on the evaluation page. Read those first (`reference.md` §8, "Product answers left as page comments"). Comments stay invisible until their author publishes the page, and republishing must keep their anchors in place.

Many "Product" questions turn out to be engineering calls, or to have context only the user has. Offer to go through them **one at a time**:
- show the question, the evidence, the proposed default and who it would go to;
- ask whether the user will answer it, add context, or send it on.

Record each answer as a `DECIDED - <date> <decision>. Decided by: <name>.` line. Anything still going to Product keeps its question with the user's suggestion attached as the proposed default.

An answer often changes a later question: merge or reframe the follow-on questions rather than asking them as written. When a statement contradicts what the page says, check the code before recording it. On the PO-3168 trial the page had % Gain wrong, and the user caught it.

Batch the edits: republish the page once at the end with a "Changes since last evaluation" section, not after every answer.

## Principles

- **Never assume. Check, or say you did not.** Every claim cites where it came from: ticket, comment, Figma node, `repo/path:line @ sha`, live flag value. What could not be checked is listed under "Method and limits", not dropped.
- **Trace a field before you describe it.** A formula's meaning depends on where its inputs come from. On the PO-3168 trial, a subagent read `100 × resolvedPoints / resolvedStake` as "net result, can be negative"; `resolvedPoints` is winnings. Follow the field to where it is written before stating what a number means.
- **Findings with rewrites.** A testability or dictation finding quotes the offending text and gives a rewrite. "Add more detail" is not a finding.
- **Severity over volume.** Lead with what blocks build or test. Quality nits go last, grouped; a 60-item page where 55 are nits hides the 5 that matter.
- **The epic may be right and the code wrong,** or vice versa. Report the divergence and let the owner rule; don't silently side with the code.
- **Behaviour may be deliberate.** Before calling a requirement a contradiction of current behaviour, check whether a prior ticket chose that behaviour (the verify-first rule in `jira-triage`).
- **Archived repos are out of scope** — an epic that scopes work to one is a NOT READY finding.
