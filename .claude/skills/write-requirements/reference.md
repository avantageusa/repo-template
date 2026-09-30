# write-requirements — reference

Templates, the REVIEW rubric, CREATE mode and the ADF body format. Site facts (statuses, priorities, labels, panel layout, payload) are in `avantage-jira-reference`.

## 1. Templates

Headings in the order below. Use the ones that carry information for this work, add whatever else it needs, and say what you added. Every heading you keep gets real content. The panel each section lands in follows the layout table in `avantage-jira-reference` → "Ticket body layout".

**Epic, user-facing.** Goal (one sentence, naming the launch if there is one) · Request origin · Why now · Expected outcome (split business / non-functional when both apply) · **Gap Summary** · Reference tables for combinatorial behaviour · Functional Requirements (numbered, independently testable) · Non-Functional Requirements · Requirement map — every child by key with one line of scope · Configurable values (name, default, bounds, what it controls) · Out of scope · Known limitations · Designs (node URLs per breakpoint, each with frame name and dimensions, plus the authoritative source) · Localisation table · QA regression scope · Definition of Done · Priority · Size · Open questions · Decision log.

**Story, user-facing.** Summary (mechanism and consequence) · Request origin · User story · Context (what exists today, parent, related links with verdicts) · Design (this story's node URL with name and dimensions, or "none — no UI change") · Data sources (each with how it was verified) · Preconditions · **Acceptance Criteria** (`AC1`, `AC2` … Given/When/Then, tagged `Module:` and `Critical:`, including a non-happy path and an unchanged-behaviour criterion) — *green panel* · **QA test instructions** as named scenarios with `Expected:` lines — *blue panel* · Copy (verbatim strings) · Localisation table · Non-functional · Configurable values · Out of scope · Known limitations · Priority · Size · Open questions · Decision log.

**Epic, services and platform.** Goal (one sentence; say `(no UI)` when there is none) · Request origin (promoted from / spun out of / incident) · Context (what exists today and why it is a problem, with the measured number) · Expected outcome — **an index of children, each by key with one line of scope** — *green panel* · Repos · Design (Figma where there is one, plus the Confluence page, repo plan or PR, naming the section relied on) · Ordering, with the reason for the sequence · Dependencies and risks · Config and flags · Measurement — baseline, target, instrument · Blast radius and the invariant · Out of scope · Known limitations · Open items, including what has been ruled out · Key findings on record · Definition of Done · Priority · Size · Decision log.

**Task, services and platform.** `Repo: <name>.` first line · Request origin · What changes — the exact mechanism: class, method, field, file, parameter, resource · Measured (numbers, build version or commit, artefact paths, the instrument) · **Done when** — numbered verifiable statements, including the no-behaviour-change or flag-off invariant — *green panel* · `DEPLOYMENT NOTE:` where deploy ordering, flags, SSM or migration apply — *warning panel* · Test strategy (unit and integration separately) · Design: link or section reference · Out of scope · Priority · Size · Open questions.

**Story, services and platform** — behaviour with an observer but no UI. One-paragraph behaviour statement · Request origin · **Acceptance Criteria** as declarative bullets — *green panel* · **How QA tests** — Setup and preconditions, then named scenarios with imperative steps and an `Expected:` line each, including a negative or isolation case (flag off, dependency unavailable, single-tenant regression); verify via API or portal state, not video — *blue panel* · Known limitations · Out of scope · Priority · Size.

**Design story (`DSN-nn`).** A Story under the same epic as the feature it unblocks, with a `blocks` link to every story waiting on it. Summary · Request origin · Deliverable (Figma file and URL; breakpoints; where in the file) · Source of truth · **Acceptance Criteria** (a frame per breakpoint at the named location; empty, error and loading states drawn; design-system components and tokens; frames linked from the epic's Design block) · Blocks · Priority · Size · Open questions · Out of scope. Breakpoints when unstated: Desktop, Tablet Portrait/Landscape, Mobile Portrait.

**Spike.** Question (one) · Why it blocks · Time box · Method · Done when (answered in a comment; a follow-up ticket exists, or "no action needed" recorded) · Out of scope · Priority · Size. **Sub-task:** Slice · Done when — a sub-task that needs its own acceptance criteria is really a Story. **Defect:** use `write-defects`.

## 2. Body format — constrained markdown → ADF

Write each ticket body as a `.md` file in the subset below, then `python3 <skill-dir>/scripts/adf.py body.md > body.adf.json`. The JSON goes to `acli … --description-file body.adf.json` or to the MCP `createJiraIssue` / `editJiraIssue` `description` field. Panels are fenced:

    ::: success
    **Acceptance Criteria**

    1. AC1 — Given … When … Then … *Module: Leagues. Critical: yes.*
    2. AC2 — …
    :::

    ::: info
    **QA test instructions**

    **Happy path** — 1. Open … 2. … Expected: …
    **Unauthorized** — … Expected: 403 from `GET /leagues`, no modal.
    :::

Supported: paragraphs, `#`/`##`/`###` headings, `-` bullet lists, `1.` ordered lists, `|` tables with a header row, `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `[text](url)`, and bare `ENGR-1234` / `PO-1234` keys (auto-linked). Panel types: `info` (blue), `success` (green), `note` (purple), `warning` (yellow), `error` (red). Nested lists and images are not supported — flatten, and attach images after creation.

## 3. CREATE mode

Only after the owner has seen the document and explicitly approved creation. "Draft this" is not approval. The acli path has run against live Jira (ENGR-6516 and nine children, 2026-09-06); the MCP path has not — treat the dry run as the safety net either way and verify every write.

1. **Dry run — write nothing.** Print every item: type, summary, parent, priority, labels, size, readiness, links. Ask for confirmation of that exact list; proceed only on a yes.
2. **Re-read the document** — it may have been edited — and **re-check every parent** still exists and is open (`acli jira workitem view <KEY> --fields status --json`).
3. **Duplicate guard**, scoped and exact: `project = <P> AND summary ~ "<exact summary>"`. A match means report and skip rather than creating a silent second copy.
4. **Run stamp.** End every description with `Created by write-requirements run <YYYY-MM-DD-HHMM>` — one JQL then finds the batch, which makes a bad run recoverable.
5. **Parents first**, then children in the epic's stated ordering, mapping each `NEW:` title to the key it became; links last. Create everything, including blocked items, at `Discovered` with BLOCKED and OPEN QUESTION lines intact. Set summary, description, type, project, parent, priority and labels; leave assignee blank.

   acli, one ticket:

       python3 <skill-dir>/scripts/adf.py fr-01.md > fr-01.adf.json
       acli jira workitem create --project PO --type Story --parent PO-3087 \
         --summary "FR-01 Apply the Tablet Portrait layout to Mobile Portrait" \
         --description-file fr-01.adf.json --label nameless,CSS-Responsiveness-Audit --json | jq -r .key

   **Priority:** neither `acli … create` nor `… edit` has a priority flag (checked 2026-09-15). Set it with `--from-json` on create (`"additionalAttributes": {"priority": {"name": "P2 - Highest"}}` — untested; verify by reading back) or with the MCP `editJiraIssue` (`fields: {priority: {name: "P2 - Highest"}}`). **Links:** `acli jira workitem link create --out <KEY-A> --in <KEY-B> --type "blocks" --yes` (`link type` lists the names; `--type` takes the outward description, so A blocks B). Any `DEPLOYMENT NOTE:` in the body is also posted as a comment on the new key.

   MCP, one ticket: `createJiraIssue` with `projectKey`, `issueTypeName`, `summary`, `description` = the ADF object, `additional_fields` for `parent`, `priority`, `labels`.

6. **Verify each** by reading it back (`view … --fields description,parent,labels,priority`): parent set, description not truncated, panels and tables intact, links present, priority and labels correct.
7. **On partial failure, say so.** Report the keys created and the failure, and offer rollback: transition each to `Aborted 🤬`, resolution `Won't Do`, comment `Aborted - incomplete write-requirements run <id>`.
8. **Report** a table of created keys (as links) with type, parent, priority, size, readiness and the run id, then **hand over the source of truth**: put `Superseded by tickets on <date> — see <epic key>` at the top of the document. From that moment the tickets are authoritative; later changes go in the ticket body and Decision log.

Do not transition items beyond `initial_status`, and do not edit an existing ticket unless the document names an empty epic to fill — then only that epic.

## 4. REVIEW rubric

Report each miss with the exact offending text and a concrete rewrite rather than "add more detail", and skip any check the work does not raise — say which you skipped and why.

**Readiness checks** — a miss here usually means the builder or tester will come back with a question:

**R1** a real active parent, or a drafted new epic · **R2** issue type and project chosen deliberately, criteria on the side that owns them · **R3** every heading kept has content · **R4** criteria in the green panel (Acceptance Criteria on stories, Done when on tasks) and QA scenarios in the blue one · **R5** criteria numbered and independently verifiable, in the series the parent already uses · **R6** the non-happy paths that exist here are covered · **R7** data sources, contracts and config named, each with how it was verified · **R8** source of truth linked and specific — the Figma node with frame name and dimensions wherever a design exists, plus the design page, plan or PR with the section relied on · **R9** no TBD, placeholder or dead link left standing, and none at all on a safety or compliance control · **R10** open questions carry an owner and a named gate · **R11** priority with reasoning, any P1 naming its launch, size with reasoning · **R12** request origin complete · **R13** new or changed user-facing strings quoted verbatim and in the localisation table · **R14** a Gap Summary where the work changes something that exists, with an UNCHANGED row as the QA regression reference · **R15** nothing asserted without a check, or marked as unchecked · **R16** every repo touched named, at epic and child level, none archived · **R17** the invariant stated as a criterion · **R18** any claimed improvement backed by a baseline with its instrument, or a baseline ticket ahead of the change tickets.

**Quality checks** — worth fixing, rarely worth blocking on: title follows the convention in use and states the finding where there is one · dependencies as issue links *and* an ordering paragraph saying why · prior tickets cited with a verdict · quantities with number, unit and source · out-of-scope present · no person standing in for a requirement · user-facing criteria tagged Module and Critical · criteria on one side only across projects · NFRs for user-facing work, including server-side authority where access is gated · labels matching the parent's area, `devops` where it applies · configurable values with default and bounds, or "nothing configurable" stated · known limitations named with their mechanism · a reference table where behaviour varies across more than two dimensions · the epic reading as an index of its children · `DEPLOYMENT NOTE:` where deploy ordering or migration applies · decision log carrying post-creation changes, dated in place.

**Verdict:** `READY` when the applicable readiness checks pass. Otherwise `NOT READY` with the ones that missed and what would close them, then the quality list. The author decides what to act on. Reviewing a live ticket: read its comments — a requirement negotiated in the thread is a Rule 8 miss, and the fix is to edit the body.
