---
name: write-defects
description: >
  Write, review or create an Avantage Jira Defect the way QA, TestRail and the
  triage tooling expect it — observed-vs-written test, Steps / Actual / Expected,
  environment and build identification, duplicate and "is it deliberate" checks,
  priority with launch reasoning, correct parent and labels. Use when someone
  says "file a bug", "write this up as a defect", "raise a ticket for this
  broken thing", "is this a bug or a story", pastes a screenshot / console error /
  Teams complaint and wants a Jira ticket, or asks to review a defect for
  completeness. Not for requirements (write-requirements) or for diagnosing an
  existing defect against code (jira-triage).
---

# Writing defects (Avantage house standard)

A defect is **observed behaviour that contradicts a written requirement**. That definition does the routing: if nothing written says what should happen, you are looking at a Story or a product decision, not a Defect — say so and hand to `write-requirements`. If a written requirement exists and the build disagrees with it, it is a Defect, and this skill writes it so that a developer can reproduce it and QA can close it without a meeting.

**Three modes.** **DRAFT**: from an observation, a screenshot, a Teams message or a console log, produce the ticket text and payload. **REVIEW**: grade a defect draft or a live Defect against the rubric. **CREATE**: on explicit approval, create it. "Write it up" is not approval to create.

**Load `avantage-jira-reference` first** — tooling (acli or the MCP connector, and how a non-coder installs acli), statuses, priorities, labels, parents, the panel layout. Every site fact below is a pointer into it.

**Never assume. Check, or say you did not.** A defect asserts that a requirement exists and that the build breaks it. Both halves get cited or marked unchecked.

---

## What separates a defect that gets fixed from one that bounces

Read from the site's own history (triage of ~500 ENGR defects, 2026-06 → 2026-09):

1. **Reproducible from the ticket alone.** URL, account type, device or breakpoint, flag state, exact steps, exact actual result. The commonest bounce is "cannot reproduce" — usually a missing precondition, not a missing bug.
2. **The build is identified.** QA often tests a build that is several merges behind `main`; a defect reported against last week's build may already be fixed. Name the environment **and** the version it was running. Where to read it: the portal's `assets/env.js`, the app's about/version marker, or the SSM parameter `/GlobalPipeline/<stage>/Deployed/<repo>` (engineers). Where you cannot, write `Build: unknown — read from <where> next time` so the triager knows to check lag first.
3. **The requirement is cited.** The Story, AC number, Figma node (with frame name and dimensions) or Confluence line that says what should happen. "Expected: it should work" bounces; "Expected per [PO-3151](https://avantageusa.atlassian.net/browse/PO-3151) AC4: …" gets built.
4. **Regression or never-worked is stated.** A regression names the build or ticket that last had it right; a never-worked names the defining ticket. They get different priorities and different fixes.
5. **It is not deliberate.** Some reported "bugs" are the accepted side of a trade-off that a prior ticket chose on purpose ([ENGR-6147](https://avantageusa.atlassian.net/browse/ENGR-6147): sub-1280px scrolling was chosen over clipping the dealer stream by ENGR-5657). Search before filing; when you find the deciding ticket, the report is a product question, not a defect — file it as such, citing the decision.
6. **One defect per ticket.** A list of five things wrong on one screen is five tickets, or one Story to redo the screen. Bundled defects get half-fixed and reopened.

---

## Research protocol — before writing

1. **Is it already filed?** `project in (ENGR, PO) AND issuetype = Defect AND text ~ "<distinctive noun or string>" AND created >= -180d`, then the same with `status = Reopened` and with `issuetype != Defect` (it may be an open Story). Exact-string search on any quoted UI text or error message. A match → link `duplicate` and stop, or add your repro as a comment there.
2. **Was it deliberate?** Search the same noun across *closed* tickets; read the deciding ticket's comments; `git log -S` on the exact string if you have the repo. A prior decision → not a defect: file a `[Suggestion]` Story or a product question, citing the key.
3. **What defines the expected behaviour?** Find the Story / AC / design node / Confluence page. No source → stop and say "no written requirement — this is a Story or a product decision".
4. **Which build and environment?** Read the version marker (above). Then check whether the current default branch already differs on the relevant file — engineers: `git log origin/<default> -- <path>` since the tested tag; others: ask, and write `OPEN QUESTION - fixed on main already?`.
5. **Which repo?** Needed for the `[repo-name]` title prefix when it is obvious, and for triage. Check it is not archived (`gh repo view avantageusa/<repo> --json isArchived`). Unsure → leave the prefix off; the triage tool discovers it.
6. **Is it launch-blocking?** Read the entry criteria in [ENGR-4338](https://avantageusa.atlassian.net/browse/ENGR-4338). If it qualifies: `[LAUNCH BLOCKER]` prefix, `P1- Super Priority`, parent ENGR-4338, and the launch named in the reasoning.
7. **Who saw it, when, where?** Reporter is the filing channel; the observer may be a player, an influencer, QA, or a Teams thread. Capture it in the Request origin line.

---

## The ticket

### Title

`[Device] [repo-name] <what is wrong, as an observation>` — stackable bracket prefixes from the reference (`[Mobile]`, `[Tablet]`, `[Desktop]`, `[IHQ]`, `[LAUNCH BLOCKER]`, `[Suggestion]`, `[Automation]`, a literal repo name). Describe the symptom, not the guess at the cause, unless the cause is established: *"LOSS" and "PERCENTAGE" column headers overlap and render as "LOSSPERCENTAGE" on the League Standings table* is right; *"CSS broken on standings"* is not. If the mechanism is known and interesting, put it after a colon or dash, as [ENGR-6672](https://avantageusa.atlassian.net/browse/ENGR-6672) does.

### Body

QA and TestRail already use the Steps / Actual / Expected shape; keep it, add what the site's history shows is missing, and put environment in the blue panel so a triager finds it without reading prose. Written in the constrained markdown from `write-requirements/reference.md` §2 and converted with `write-requirements/scripts/adf.py`:

    **Request origin** — Observed by <who>, <YYYY-MM-DD>, via <channel/link>. Filed by <you>.

    **Requirement** — <Story/AC/design node/Confluence line that defines expected behaviour, as a link>. Regression since <build/ticket> | Never worked (defined by <KEY>).

    ::: info
    **Environment**
    - Instance: qc | qcsocial | smoke | prod — URL
    - Build: <version from env.js / SSM / about marker> (or: unknown — read from <where>)
    - Account: <type, entitlement, league/pool state, logged-in or not>
    - Device / breakpoint: <e.g. iPhone 15 Safari 17, 393×852> | Desktop Chrome 128, 1440×900
    - Flags: <GrowthBook flag = value, per env> | none relevant
    - Language: en | zh-CN | …
    :::

    **Steps to Reproduce**
    1. Open <URL>
    2. …
    3. …

    **Actual Result** — <exactly what is observed, verbatim strings quoted, numbers with units>

    **Expected Result** — <what the cited requirement says, quotable as a TestRail pass condition>

    **Frequency** — always | intermittent (<n> of <m> attempts) | once

    ::: note
    **Evidence / analysis**
    - Screenshot / recording: attached (<filename>) — note what it shows, since attachments are opaque to tooling
    - Console / network: <error text verbatim, request + status>
    - Suspected mechanism: <only if established; say how — read from repo at <commit>, measured, inferred>
    :::

    **Priority** — <P-string> — <reasoning; name the launch for P1/P2>. **Size** — <XS…XL> — <reasoning>, or `unsized — needs triage`.

    OPEN QUESTION - <anything unverified>. Owner: <name>.

Rules that follow: **quote strings verbatim** — a translation defect lists the untranslated strings, a layout defect names the elements; **attachments are opaque** — the triage tooling cannot read images, so the note panel says in words what the screenshot shows; **no cause in Actual Result** — observation there, hypothesis in the note panel, so a wrong guess does not mislead the fix.

### Placement and fields

- **Project** ENGR (engineering fixes it), unless the defect is product-owned in PO. **Parent**: the epic of the product area (a defect against a PO story is raised in ENGR, parented to the PO epic); launch-blocking → ENGR-4338; nothing fits → ENGR-1758. Never a feature epic that is mid-flight unless the defect is *in* that feature's scope — ad-hoc fixes under a feature epic stall the weekly deploy train.
- **Priority** with reasoning per the reference. Launch-blocking = P1 + `[LAUNCH BLOCKER]`; broken live play = P1; committed launch scope = P2; everything else starts P4 unless argued.
- **Labels**: match the parent epic's squad label (`nameless`, `IHQ`, `DWH`), device or area labels where used (`accessibility`, `CSS-Responsiveness-Audit`, `security`, `devops` for CI/infra defects). Never set the triage tooling's labels (`ClaudeTriageTool`, `Needs*`, `BreakpointsRequired`) yourself.
- **Links**: `is caused by` when the causing ticket is known (underused and valuable); `duplicate` when it is one; `relates` only when nothing else fits.
- **Assignee blank**, **status `Discovered`** — triage moves it.
- **Breakpoint / viewport / aspect-ratio defects**: until PO-3153 ships, these go to `Blocked - Cannot Start` with an `is blocked by` link to [PO-3153](https://avantageusa.atlassian.net/browse/PO-3153) and the `BlockedOnPO-3153` label. File them — the queue is real — but say in the body that they are parked.

---

## Not a defect — where it goes instead

| What you actually have | File as |
|---|---|
| No written requirement says what should happen | Story via `write-requirements`, or a product question to the epic owner |
| Behaviour was chosen by a prior ticket | `[Suggestion]` Story citing the decision, labelled `NeedsProduct`-style in prose; never a Defect |
| Works on `main`, broken on the tested build | Comment on the original fix ticket asking for a deploy; no new ticket unless the deploy itself is the problem |
| "It feels slow / looks wrong / could be nicer" | `[Suggestion]` Story with a measurable target, or nothing |
| Five things wrong on one screen | Five defects, or one Story to redo the screen |
| Vendor / infrastructure outage | Task in ENGR-1758 with `devops`; incident channel first |

---

## CREATE mode

Only on explicit approval. Dry-run first: print type, summary, parent, priority, labels, links. On a yes:

    python3 <write-requirements-dir>/scripts/adf.py defect.md > defect.adf.json
    acli jira workitem create --project ENGR --type Defect --parent <EPIC> \
      --summary "<title>" --description-file defect.adf.json --label <labels> --json | jq -r .key

Then priority (MCP `editJiraIssue`, or `--from-json` on create), links (`acli jira workitem link create --out <NEW> --in <KEY> --type "is caused by" --yes`, or the MCP `createIssueLink`), attachments (the user attaches through the Jira UI — say which files), and read the ticket back to confirm the panels survived. MCP path: `createJiraIssue` with the same ADF as `description`. Report the key as a link.

---

## REVIEW rubric

**Readiness** — a miss usually bounces the ticket: **D1** observed behaviour contradicts a *cited* written requirement · **D2** steps reproduce from the ticket alone, preconditions stated · **D3** environment, build and account identified, or marked unknown with where to read it · **D4** actual and expected are quotable and free of cause-guessing · **D5** regression vs never-worked stated with the key · **D6** duplicate search done, keys cited with verdicts · **D7** deliberate-behaviour check done · **D8** one defect per ticket · **D9** priority with reasoning, launch named for P1/P2 · **D10** parent is the product-area epic, ENGR-4338 or ENGR-1758, deliberately · **D11** attachments described in words.

**Quality**: title is an observation with the right prefixes · strings quoted verbatim · labels match the parent · `is caused by` used where the cause is known · breakpoint defects parked on PO-3153 correctly · frequency stated.

**Verdict:** `READY` / `NOT READY` with the misses and the rewrite for each. Reviewing a live Defect: read its comments — a "cannot reproduce" exchange in the thread is a D2/D3 miss, and the fix is to edit the body.
