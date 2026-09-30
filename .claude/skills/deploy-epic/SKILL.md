---
name: deploy-epic
description: >
  Build a deployment ticket for a Jira epic. Use when the user asks to "create a
  deploy ticket", "prep the deployment for <EPIC>", "what ships with this epic",
  or to collect module versions / DEPLOYMENT NOTEs for an epic. Crawls the epic
  and every descendant, derives the module versions being shipped (Development
  info / merged PRs / DEPLOYMENT NOTE overrides), collects DEPLOYMENT NOTE
  comments with links, sanity-checks versions against what is already deployed to
  QC, and creates a DEPLOY-project ticket from the canonical template with its
  Jira info panels intact. Ticket output is deliberately terse — one imperative
  line per item, links instead of explanations. Does NOT run deployments.
---

# Deploy Epic → DEPLOY ticket

Turn an epic into one deployment ticket a person who did not do the work can execute.

**Scope: authoring the ticket only.** This skill never deploys anything, never pushes code, never switches a working tree. It reads Jira, reads GitHub, reads the version tracker, and writes one Jira issue.

See `reference.md` for the ADF template, jq/gh recipes, and known name mappings. Site facts (statuses, priorities, the `DEPLOYMENT NOTE:` convention, acli vs MCP) are in the `avantage-jira-reference` skill.

## Output style — terse, or the ticket fails its job

**The reader is a deployer who did not do the work and does not want the story.** They need to know what to deploy, in what order, and what to set. Everything else is noise that hides the instructions.

Hard rules for every bullet in the ticket:

1. **One line per item.** Imperative. Target ~15 words, hard cap ~25. If it needs two sentences, the second one belongs behind a link.
2. **No rationale.** No "because", no mechanism, no discovery narrative, no history of what QC did last week, no who-found-what.
3. **No provenance.** How a version was derived, which PR dates were compared, what the tooling could not infer — none of it goes in the ticket. Report that to the *user* in chat instead.
4. **Link instead of explain.** Anything a deployer might need to understand rather than do becomes `see <link>`. Every ticket, flag, PR and comment is a full clickable URL.
5. **No non-actions.** Drop "not shipping", "aborted", "closed", "known but not blocking", "for a later ticket". They are not deploy steps. The single exception: a line that stops a deployer raising a false defect — one line, no backstory.
6. **Verification only if the deployer performs it.** Functional QA belongs to QA, not the runbook. Keep only post-deploy smoke checks a deployer runs.
7. **Unknowns are one line.** `referral — version TBD, dev to confirm before deploy (see <link>)`. Never a paragraph explaining why it is unknown.

Format each bullet as **action · object · env/timing · link**:

```
Create equity-earned-shared-filter-config OFF before account-client deploy — see PO-2942
Deploy referral before account-client — see PO-2978
account-api v2.101.0
referral — version TBD, dev to confirm (see PO-2978)
```

Not:

> **referral (backend)** — version NOT derivable from Jira, dev to supply the tag. Ships PO-2978 (`totalEquityShares` + `isInfluencer` on `GET /user/:userId/equity/totals`), the geography work from PO-2964 (PR referral#168), and BE defect fixes ENGR-5873, ENGR-5896 … so QC may report `dev-deploy` rather than a semver. Nikola Madic / Srecko Stojic to pin the version here before this moves to Ready For Deploy.

[DEPLOY-948](https://avantageusa.atlassian.net/browse/DEPLOY-948) is the worked example of what **not** to produce — accurate, and unusable as a runbook. Reduced to these rules it is roughly 12 lines.

Detail is not lost, it is **relocated**: the epic and its tickets already hold it, and every bullet links there. Richness belongs in your chat report to the user, never in the ticket.

## Config

| Var | Default *(Avantage)* | Meaning |
|-----|----------------------|---------|
| `ATLASSIAN_CLOUD_ID` | `51a56edb-e18e-459f-8f78-8c5507889827` | cloudId for the Jira site |
| `JIRA_BASE_URL` | `https://avantageusa.atlassian.net` | for browse/comment links |
| `DEPLOY_PROJECT` | `DEPLOY` | project the deployment ticket is created in |
| `DEPLOY_TEMPLATE` | `DEPLOY-872` | canonical template issue ("Deploy XX to QA - Template DO NOT CHANGE") |
| `GITHUB_ORG` | `avantageusa` | org searched for the epic's PRs |
| `CODE_ROOT` | `/Users/steve/Syzygistic/projects/Avantage/code` | local clones, used read-only |
| `VERSION_TRACKER_URL` | `https://26jcy45muh.execute-api.eu-west-2.amazonaws.com/main/retrieve` | unauthenticated deployed-version API |
| `QC_ACCOUNT` / `QC_INSTANCE` | `468872710644` / `qc` | where "already on QC" is checked |

Confirm the **target environment(s)** with the user before creating the ticket — the template offers `QA | Prod RMG | Prod Social | Singapore`. Default to QA only if the user says so.

## Step 1 — Crawl the epic

Recursive, breadth-first. Children of an epic, then subtasks of each child, until nothing new appears:

```
parent = <EPIC> ORDER BY key ASC        # then, per child: parent = <CHILD>
```

Fetch each issue with `getJiraIssue`, `fields` including `summary,status,issuetype,parent,description,comment,labels,fixVersions`.

- Record every descendant key + status. **Flag any descendant not in a done/merged state** — it may not be shippable; list those in the ticket's Special Instructions rather than silently omitting them.
- Large crawls: parse the saved tool-results file with a subagent instead of dumping every comment into context.

## Step 2 — Derive module versions

Three sources, in **precedence order** (highest wins):

1. **`DEPLOYMENT NOTE:` module-version override** — mandatory per team convention when Development info is incomplete or when several tickets shipped in one PR. Example: `DEPLOYMENT NOTE: [QA] Module version account-api:1.24.0 — …`. An override always beats what the tooling infers.
2. **Jira Development info** (branch/commit/PR links on the ticket). The MCP Jira tools do **not** expose the Development panel; reproduce the same signal from GitHub — Jira links work by ticket key in branch/commit/PR names, so:
   ```sh
   gh search prs --owner "$GITHUB_ORG" "ENGR-1234" --limit 20 \
     --json number,title,url,state,repository,closedAt
   ```
   Run per descendant key. Keep merged PRs; note open ones as "not yet merged".
3. **Tag correlation** — turn each merged PR into the released module version (`reference.md` §2). Semantic-release tags the merge commit, so `merge_commit_sha` usually equals a tag's commit sha exactly; fall back to a containment compare.

Result: a `component → version` map. Notes:

- **Version-tracker component names are not always repo names** (`referral` → also `referral-api`, `AVBC-BE-GameStateService` → `-private-api`/`-alt`, plus `*-tf-core` / `*-tf-api` infra components). Map explicitly; see `reference.md` §3.
- If two tickets resolve to the same repo, ship the **highest** version.
- If a ticket has no PR and no override, say so out loud — do not invent a version.

## Step 3 — Collect DEPLOYMENT NOTEs

Scan every comment on the epic and every descendant for a comment whose text starts with `DEPLOYMENT NOTE:` (case-insensitive). For each, capture the note text, the ticket key, and a **direct comment link**:

```
<JIRA_BASE_URL>/browse/<KEY>?focusedCommentId=<commentId>
```

Bucket each note into the template's sections by what it concerns:

| Note is about | Section |
|---|---|
| GrowthBook flag | **Growthbook Flags** |
| DB migration / seeder / backfill | **Seeders/Migrations** |
| module version override | folds into **Project Versions** |
| everything else (SSM, secrets, infra, env vars, ordering, rollback, vendor config, workers/cron, one-off scripts, DNS/CDN) | **Special Instructions** |

**Compress each note to one imperative line + its link.** A DEPLOYMENT NOTE is written by a developer explaining themselves; the ticket needs only the instruction inside it. Shape: **action · object · env/timing**, then the comment link.

The two failure modes, both real:

- **Too long** — pasting the note. The instruction drowns in its own justification.
- **Too vague** — compressing away *what to actually do*. "Set up the GrowthBook flag (see note)" is worse than the paragraph.

Keep every operative detail: flag keys, env names, ordering, exact values, on/off state. Drop only the reasoning. If the operative detail genuinely will not fit on a line — a JSON blob, a multi-step script — put the imperative on the line and point at the note for the payload: `Copy the equity-modal-content object from QC into the target env — see <link>`.

**Never drop a note.** Every one lands in exactly one section with its link.

## Step 4 — Sanity-check against QC

For every component in the map, confirm the version (or higher) is already deployed to QC — a deployment ticket that names a version QC never saw is a red flag.

```sh
aws ssm get-parameter --profile dev --region eu-west-2 \
  --name "/GlobalPipeline/qc/Deployed/<repo>" \
  --query Parameter.Value --output text
```

Parameters are keyed by **repo name**; the value is the deployed git tag. **Do not use the version-tracker `retrieve` endpoint** — since ~2026-08-31 it sits behind an Okta OIDC authorizer and returns `{"message":"Unauthorized"}` unauthenticated. SSM is the same data one hop earlier. See the `deploy-dev-instance` skill for the full deploy/verify contract.

- Deployed version **>= target** → OK (mark "on QC").
- Deployed version **< target**, or `ParameterNotFound` for a deployable repo → **flag it in the report to the user** and, if they still want the ticket, list it under Special Instructions as "not yet on QC at time of writing". Do not deploy it — out of scope for this skill; hand off to `deploy-dev-instance`.
- `ParameterNotFound` for a **package** repo is expected — packages never deploy to an instance (see Step 5). Judge them by their consumers.
- Prerelease tags (`X.Y.Z-prerelease.N`) sort below their release; call that out rather than guessing.

## Step 5 — Classify components

- **Deployable components** — apps/services that get deployed to the target env (each with its version).
- **Non-deployable components** — shared packages published to the npm registry and consumed via `package.json` (`@av-common/*`, UI kits, client libs). They ship as a *package update*, not a deploy; list them under Non-deployable so the deployer knows why the version appears.

## Step 6 — Create the DEPLOY ticket

Create a **new issue** in `DEPLOY_PROJECT` (issue type **Task**) modeled on `DEPLOY_TEMPLATE`. Create it fresh via `createJiraIssue` — do **not** use Jira's Clone action, which is what would add the "cloned from" link the user does not want.

- **Summary:** `Deploy <EPIC-KEY> <short epic name> to <ENV>` (template's placeholder is `Deploy XX to QA`).
- **Description: ADF with the five info panels preserved.** Markdown output loses the panels — build the description as ADF (`reference.md` §1) with these panel types, matching the template's colors:

| Section | Panel type | Template color |
|---|---|---|
| Deploy / Target Env(s) header | `warning` | `#fffae6` |
| Project Versions | `note` | `#eae6ff` |
| Growthbook Flags | `info` | `#deebff` |
| Seeders/Migrations | `warning` | `#fffae6` |
| Special Instructions | `error` | `#ffebe6` |

- Keep the section headings and their order exactly as the template has them.
- Empty section → `N/A` (as the template does for Seeders/Migrations). Never delete a section.
- Render the epic and every referenced ticket as a full clickable `browse` URL.
- After creating, link the new ticket to the epic (`createIssueLink`, "relates to") and report the new key + URL.

**Re-read the Output style rules before writing the description**, and check the draft against them:

- Any bullet over ~25 words → cut it or move the tail behind a link.
- Any bullet containing "because", "so that", "was found", "may report", "originally" → delete that clause.
- Any bullet naming something that is **not** being deployed and needs **no** action → delete the bullet.
- A whole ticket should read in well under a minute. If Project Versions alone is a screenful, it is wrong.

**Show the user the assembled content and get explicit approval before creating the issue.** Creating a DEPLOY ticket is outward-facing — it goes on someone else's runbook.

Give the user the full reasoning **in chat** at that point — derivation, ambiguity, what you could not confirm. That is where the detail belongs; the ticket gets the instructions.

## Guardrails

- Read-only on repos: `git fetch` and reading origin are fine; **never** checkout/pull/reset a working tree.
- Never execute a deployment, and never write to any env (no SSM, no flags, no scripts).
- Never invent a module version. Missing/ambiguous → full explanation to the user in chat, **one line** in the ticket (`<component> — version TBD, dev to confirm (see <link>)`).
- Never drop a `DEPLOYMENT NOTE:` — every collected note lands in exactly one section, with its comment link.
- One ticket per (epic, target env) unless the user asks otherwise.
- **Terseness never costs an instruction.** Cut reasoning, never an action, a flag key, an env, a value or an ordering constraint. A shorter ticket that omits a step is worse than the verbose one it replaced.
