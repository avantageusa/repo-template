---
name: write-requirements
description: >
  Draft requirements from a raw ask, review a draft or a live ticket against the
  Avantage house standard, and create the Jira tickets once approved. Use when
  someone says "write this up as a story", "draft the epic for X", "turn this
  into tickets", "review this requirement", "is this ticket ready", "make an
  epic/story/task for", or pastes a Teams thread / meeting note and asks for
  Jira work from it. Works for product, engineering, IHQ, design, data,
  infrastructure and anything else the team specifies — the shape adapts to the
  work. For bugs use write-defects; for a DEPLOY ticket use deploy-epic.
---

# Writing requirements (Avantage house standard)

This is a standard, not a rulebook: almost everything here is guidance with the reason attached, so you can tell when it applies and when it does not. The things stated as fixed are facts about the system — exact status and priority strings, panel types, tool limits — not preferences. **Jenna decides what is forbidden; nothing here is forbidden unless she has said so.**

**Three modes.** **DRAFT**: turn an ask into a document. **REVIEW**: grade a draft or a live ticket. **CREATE**: approved document → tickets. DRAFT ends by running the REVIEW rubric on its own output. Templates, the rubric, CREATE mode and delivery mechanics live in `reference.md`; the site facts live in the `avantage-jira-reference` skill.

**Who reads it.** Whoever owns the requirement will edit and take it over — often a product owner, sometimes an engineer, sometimes Jenna. Whoever builds and tests it works from it directly. No executive summary and no approval framing; an executive appears as a named requester or a named decider. The test for every line: **can the person who builds this build it, and the person who tests it test it, without attending a meeting?**

Given a bare ticket link and no other instruction: the work in plain English in three sentences or less, how long an average developer would take, the priority it should carry. Then the rubric.

**Never assume. Check, or say you did not.** Every claim about a status, field, label, design, data source, prior ticket or person is checked against the live system before it is written, or marked as unchecked. A check you cannot make is an OPEN QUESTION, never a confident sentence.

## Prerequisites

1. **Load `avantage-jira-reference` first.** It holds the tooling instructions (acli vs the Atlassian MCP connector, and how a non-coder installs acli), the workflows, issue types, the ADF panel layout, titles, priorities, sizing, labels, fields, design sources, numbering and the payload format. Without it, treat every site fact as unchecked.
2. **Jira access, one way or the other.** `acli --version` works → use acli. It does not → use the Atlassian MCP connector and, once, tell the user how to install acli for next time (the reference has the commands). **Neither** → you cannot check a parent, verify a data source or cite a prior ticket; say so and stop rather than drafting against guesses.
3. **Useful, not required:** Figma, Confluence, Teams, Read AI, TestRail, GitHub (`gh`). A missing one becomes an OPEN QUESTION, not a blocker.

---

## Read the work, then choose the shape

The same standard covers product features, platform services, IHQ portal work, design production, data and reporting, cost and infrastructure, security, tooling and research. What changes is which sections earn their place:

| If the work is about… | Pull in |
|---|---|
| Screens, copy, modals, flows, anything a player or influencer sees | Gap Summary · verbatim copy · localisation table · breakpoint designs · reference tables for combinatorial behaviour |
| A service, API, schema, migration, infrastructure, cost, tech debt, observability or streaming | Repos · Ordering with reasons · config and flags · measurement with a baseline and its instrument · the invariant · `DEPLOYMENT NOTE:` |
| The IHQ portal | Both of the above as they apply — IHQ work is user-facing *and* has its own services and integrations |
| Producing a design rather than building one | Deliverable, breakpoints, where in the file, source of truth, what counts as drawn |
| Answering a question rather than shipping a change | One question, a time box, a method, and what "answered" means |

**Nothing above is exclusive and the list is not closed.** Most real work touches more than one row; work will arrive matching none — take the nearest shape, add what it needs, and say what you added. A section carrying no information is noise: leave it out and say so rather than writing `N/A`.

**Who writes it is not where it lives.** Choose the project by where the work will be done and which board tracks it. When one requirement splits across projects, say which half holds the acceptance criteria so QA has one truth to test.

**Worth getting right.** [ENGR-5262](https://avantageusa.atlassian.net/browse/ENGR-5262) is a P1 in a shape that did not fit: a Performance Targets table whose Current column is empty, and user stories inline rather than as children. The sections were borrowed from product work that needed them; here they had nothing to hold.

---

## The benchmark

Match or beat the best work already on the site. Read the ones nearest your work before drafting anything of comparable scope.

**User-facing:** [PO-3151](https://avantageusa.atlassian.net/browse/PO-3151) (combinatorial reference tables, configurable values with defaults, an accepted limitation) · [PO-3137](https://avantageusa.atlassian.net/browse/PO-3137) (Gap Summary with an UNCHANGED row as the QA regression reference; numbered FR-E1…FR-E8; localisation table) · [PO-3168](https://avantageusa.atlassian.net/browse/PO-3168) (business and non-functional expectations split, boundary arithmetic to the second, a QA regression scope line).

**Services and platform:** [ENGR-6377](https://avantageusa.atlassian.net/browse/ENGR-6377) (phase scoping, flag-off invariant, dependencies and risks) · [ENGR-5834](https://avantageusa.atlassian.net/browse/ENGR-5834) (epic as an index of its children) · [ENGR-6388](https://avantageusa.atlassian.net/browse/ENGR-6388) (saving stated first, baseline and close-out as their own tickets, instruments named) · [ENGR-5947](https://avantageusa.atlassian.net/browse/ENGR-5947) (declarative criteria, Known limitations that explain the mechanism) · [ENGR-6346](https://avantageusa.atlassian.net/browse/ENGR-6346) (measured before/after with units and share, Key findings on record) · [ENGR-5563](https://avantageusa.atlassian.net/browse/ENGR-5563) (the panel layout every epic now follows).

**No word limit and no word target.** The best of these run well over a thousand words and are better for it. Write until the builder and the tester have no question left, then stop. Padding is a defect; so is brevity that leaves a decision unmade.

---

## The rules, ordered by evidence

Rules 1–5 are what measurably separated clean delivery from rework across 1,121 resolved Stories and Tasks (628 clean); point-gaps are the difference in presence rate between the groups.

1. **Name the data source for every acceptance criterion, and verify it exists.** Strongest separator, **+23 points**. *[PO-3013](https://avantageusa.atlassian.net/browse/PO-3013) specified three criteria against data that existed nowhere.* **Verified** means *found named in a ticket, Confluence page, schema, repo or design* — not confirmed against the running system. Write `found in <where>, not confirmed live` when that is the truth.
2. **Cite prior tickets with a verdict.** **+20 points.** Supersedes · differs because · already fixed there · unchanged and therefore in regression scope. A bare key is not a citation.
3. **State the non-happy path.** **+12 points.** Reload, back-navigation, empty, no permission, timeout, expired, zero results, off-air, slow network, not-logged-in, flag off, dependency unavailable — whichever exist here.
4. **State what is out of scope, and what is deliberately unchanged.** **+10 points.**
5. **Record where the request came from.** **+10 points**, and it decays — origin not captured within about a week is usually lost.

Then, not measured but structurally useful:

6. **Every quantity gets a number, a unit and a source,** with boundaries to the unit that matters — PO-3168 rules 10:00:00 PM HKT before the weekly boundary, 10:00:01 PM after. *[PO-3273](https://avantageusa.atlassian.net/browse/PO-3273)'s "within the platform's load target" left the developer nothing to build to.*
7. **One authoritative source; resolve conflicts before writing** — once you have established the conflict is real. *[ENGR-6607](https://avantageusa.atlassian.net/browse/ENGR-6607): a Figma frame contradicted an NFR, nobody ruled, QA filed the contradiction as a defect.*
8. **Decisions belong in the body, not only in a comment.** *[ENGR-6011](https://avantageusa.atlassian.net/browse/ENGR-6011) produced false defect [ENGR-6562](https://avantageusa.atlassian.net/browse/ENGR-6562) three weeks later.* When scope changes, stamp the change in place with its date — `**Scope change (2026-08-26):**`, as [ENGR-5816](https://avantageusa.atlassian.net/browse/ENGR-5816) does.
9. **Every item gets a real active parent, a priority with reasoning, and a size with reasoning.** Open questions carry an owner and name what they block. A TBD on a safety or compliance control needs an owner and a date.
10. **Get explicit approval before creating anything in Jira, and dry-run first.** Absolute: Jenna's rule, not a preference. "Draft this" is not approval.

**The epic is an index.** A good epic names its children by key with one line of scope each, so it reads as a routing table — in the green Expected Outcome panel on platform epics, in a Requirement map on product epics.

---

## Devices worth using — user-facing work

1. **Gap Summary, when the work changes something that exists.** Area | Current (with the keys that defined it) | New, ending with a row listing everything **explicitly unchanged**, marked as the QA regression reference.
2. **Reference tables for anything combinatorial** — user type × layout × scenario. Where behaviour varies across more than two dimensions, prose leaves a hole and a table does not.
3. **Quote user-facing copy verbatim, in bold, exactly as it must ship.** Copy not decided yet → an OPEN QUESTION with an owner.
4. **A localisation table for new or changed user-facing strings.** Columns: English (en) · Simplified Chinese 简体中文 [zh-CN] · Traditional Chinese 繁體中文 [zh-HK] · Japanese 日本語 [ja-JP] · Thai ไทย [th-TH] · Vietnamese Tiếng Việt [vi-VN] · Korean 한국어 [ko-KR]. Do not invent translations — fill English, mark the rest `pending translation`, and name who supplies them.
5. **Assert absence precisely.** [PO-3139](https://avantageusa.atlassian.net/browse/PO-3139): *"not rendered in the DOM at all — not shown disabled, simply absent."*
6. **Split Expected Outcome into business and non-functional expectations** when the work has both.
7. **State what is configurable without a release** — per value: the default, the bounds, what it controls. On product surfaces that is normally GrowthBook.
8. **A QA regression scope line** — tabs, filters, auth and role combinations, empty and unauthenticated states.
9. **Server-side authority wherever access is gated.**

## Devices worth using — services, platform and infrastructure

1. **`Repo:` — name every codebase touched**, on the epic and on each child; ENGR tasks open with a literal `Repo: <name>.` first line. It is what makes an engineering ticket assignable. Check the repo is not archived (`gh repo view avantageusa/<repo> --json isArchived`) — work scoped against an archived repo can never ship.
2. **`Ordering:` — the sequence with its reasons, in prose, alongside the issue links.** [ENGR-6302](https://avantageusa.atlassian.net/browse/ENGR-6302): the infra ticket "runs LAST — tf data-source lookups fail hard on missing params."
3. **`DEPLOYMENT NOTE:`** (colon, caps) on any child whose deploy has an ordering, flag, SSM, migration or infra constraint — in the body's warning panel *and* as a comment once the ticket exists, because `deploy-epic` builds the runbook from comments.
4. **Baseline ticket → change tickets → close-out comparison, instruments named.** An epic claiming an improvement without a baseline cannot settle the claim.
5. **`Done when` where Gherkin has nothing to say.** Numbered verifiable statements, each observable by someone other than the author.
6. **The invariant, rather than a list of areas.** [ENGR-6378](https://avantageusa.atlassian.net/browse/ENGR-6378): "with the flag off … behavior identical to today".
7. **`Known limitations` that explain the mechanism and the blast radius.**
8. **Measured before/after with units and share of total**, instrument named.
9. **`Key findings on record`** — durable conclusions that outlive the epic.
10. **Record what was tried and rejected, and what is still unexplained.**

---

## House voice

Minimal prose, clear language, technical terms where the plain word would lose meaning. Reference points: Steve Wolfe, Filip Milinković, and the benchmark epics nearest your work.

- Open with mechanism and consequence in one sentence; don't restate the title. **Put the finding in the title where there is one.**
- Say how a claim was obtained: measured, counted, checked by eye, read from the design, read from the repo at a named commit or date.
- A person's wish is not a requirement — *"Marcus wants the logos updated"* leaves nothing to build or test. Name him as the requester and write what must be true when it is done.
- Empty headings and bare `N/A` cost the reader a round trip. If a heading has no content, drop the heading and say why.
- Superseded text struck through with its reason keeps the decision visible; deleting it loses the decision.
- **Words that have cost this team time** — replace each with the specific thing it stands in for: `under`/`over` when positional, `properly`, `correctly`, `appropriately`, `as expected`, `similar to`, `etc.`, `fast`, `responsive`, `intuitive`, `clean`, `user-friendly`, `handle`, `support`, `optimize`. *[PO-3080](https://avantageusa.atlassian.net/browse/PO-3080): one "under" where "below" was meant, caught after development was complete.*
- Status markers read best as plain words in caps — they survive copy-paste into Jira, a doc or a chat, and they grep:

      OPEN QUESTION - <question> Owner: <name>. Needed by: <date or gate>.
      BLOCKED - <what blocks it, with the key or the missing artefact>
      CONSTRAINT - <the limit, and where it comes from>
      OUT OF SCOPE - <what is excluded>
      UNCHANGED - <what carries over as-is; the invariant QA re-tests>
      KNOWN LIMITATION - <what is not solved, and the mechanism>. Revisit: <trigger>.
      DEPLOYMENT NOTE: <ordering, flag, SSM or migration constraint>
      DECIDED - <YYYY-MM-DD> <decision>. Decided by: <name>. Source: <where>.
      REJECTED - <option>, because <reason>.

  (`DEPLOYMENT NOTE:` keeps its colon — a downstream skill greps for it.)

---

## Research protocol — before writing a word

0. **Load `avantage-jira-reference`**, and read the ask closely enough to know what shape it needs.
1. **Does this already exist?** `project in (ENGR,PO) AND text ~ "<key noun>" AND created >= -365d`, widened to other projects when the work could live there. Whole ask already open → report the key and stop. Part of it → narrow to the remainder and `relates to` it. Closed and **aborted** → read why; if the reason still holds, raise an OPEN QUESTION first. Closed and **shipped** → it regressed or never landed; route to `write-defects`. Several partial matches → list them with verdicts and propose amend-or-create.
2. **Candidate parents:** open epics ordered by updated, then open-child counts on the two or three that fit. Read the catch-all scopes in the reference before parking anything in one.
3. **Read the chosen parent's full description**, not its title — its goal, constraints and out-of-scope list frequently reshape the ask, and this produces more real findings than any other step.
4. **Siblings and predecessors:** `parent = <EPIC-KEY>`. Whatever the work modifies has a defining ticket — find it. It feeds the Gap Summary on user-facing work, and the ordering and the invariant on platform work. An aborted sibling may carry a fault the new work would inherit; one for a *different breakpoint or device* is not evidence about yours.
5. **The design. Open the Figma frame whenever there is one** — node names and dimensions are required reading. Where the design lives in a Confluence page, a repo plan or a PR, open that too and name the section you relied on.
6. **The data, contract or config.** Confirm each field, endpoint, event, SSM path, GrowthBook flag or env var exists and record how; if you cannot, it is an OPEN QUESTION rather than a criterion. For a flag, read its live value per environment — behaviour depends on the flag, not the code.
7. **The copy**, where the work has any. Find the exact current and new strings; quote both.
8. **The baseline**, wherever the work claims an improvement. No baseline → the first child is a baseline ticket, and the claim waits.
9. **Provenance.** Who actually asked, when, where — the reporter is usually the filing channel, not the requester.

Stop when these are answered or recorded as unanswerable. A couple of unresolved questions is ordinary; a long list usually means the ask is not ready, and saying so is more useful than guessing. **Fragmented asks** keep one Request origin block listing each fragment with its own date and channel, plus a DECIDED line when a later fragment overrides an earlier one.

**Then:** pick the template in `reference.md`, write, run the rubric on your own output, deliver per the reference's delivery section, and only on explicit approval enter CREATE mode.
