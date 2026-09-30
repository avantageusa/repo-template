# jira-triage — reference

Detailed mechanics for repo discovery, freshness, and reading current code. The main `SKILL.md` summarizes; this file holds the commands.

## 1. Discover which repo (works with zero local clones)

The ticket rarely names a repo. Pull the **distinctive tokens** out of it — error string, function name, endpoint path, unusual identifier, a UI label — and search the org:

```sh
gh search code '<distinctiveToken>' --owner "$GITHUB_ORG" --json repository,path,textMatches
# or the code-search API: GET /search/code?q=<token>+org:<GITHUB_ORG>
```

Results name the repo. Limits:
- Searches the **default branch only** (which is what triage wants).
- **Rate-limited** (~10 search req/min authenticated) — batch tokens, don't spray.
- Needs a **distinctive token**. Generic phrases ("payment fails") return noise — the same wall a local grep hits. With no code-ish token, fall back to reasoning from the architecture docs / repo map, and if still unclear, ask the user.

## 2. Freshness bootstrap (keep the likely repos current, cheaply)

Recently-active repos are the ones tickets are usually about. Refresh those; skip what's already fresh:

```sh
# list org repos, most-recently-pushed first, keep those pushed within FRESHNESS_DAYS
gh api "orgs/$GITHUB_ORG/repos?per_page=100&type=all&sort=pushed&direction=desc" --paginate \
  --jq ".[] | select(.pushed_at >= \"<cutoff ISO date = now - FRESHNESS_DAYS>\") | .name"

# for each recent repo:
#   present under CODE_ROOT?  -> git fetch <default>          (cheap; enough for triage)
#   absent + you need it?      -> gh repo clone <ORG>/<repo>
```

`git fetch` is enough — triage reads `origin/<default>`; it never needs the working tree switched.

## 3. Read current code without switching branches

Triage is read-only. Read the default branch directly — the local working-tree branch is irrelevant and **must never be grepped** for diagnosis:

```sh
git -C <repo> fetch <remote> --quiet
git -C <repo> show origin/<default>:<path>          # read a file at current default
git -C <repo> grep -n '<term>' origin/<default>     # search current default
```

## 4. Check GrowthBook flag values (flag-gated code paths)

When the code path in question is gated by a **feature flag**, the behavior depends on the flag's **live value**, not just the code. Read it via the GrowthBook SDK CDN — no auth beyond the public SDK client key:

```sh
curl -s "$GROWTHBOOK_API_HOST/api/features/$GROWTHBOOK_CLIENT_KEY" | jq '.features["<flag-key>"]'
```

Returns `{ features: { <key>: { defaultValue, rules } } }`. No `rules` (or empty) → `defaultValue` is unconditional. Notes:
- **Environments differ.** Each GrowthBook environment (player/portal, back-office, …) has its own SDK client key. A flag absent from one key's payload likely lives in another environment. Grep the consuming repo for the flag name to know which app/env owns it, then use that env's key.
- Use this to confirm which branch of flag-gated code actually runs in prod **before** asserting a root cause in the Jira comment.
- The SDK client key is public (embedded in clients); reading features is safe. The payload may be encrypted for some SDKs — if so, it needs the decryption key; most return plaintext.

## 5. Verify a merged fix reached QC (post-merge deploy check)

A merged PR is not testable until the build carrying it is **deployed**. Confirm the deployed version before moving any ticket forward on the strength of a merge.

```sh
# QC = account 468872710644, region eu-west-2
aws ssm get-parameter --profile dev --region eu-west-2 \
  --name "/GlobalPipeline/qc/Deployed/<repo>" \
  --query Parameter.Value --output text
```

Parameters are keyed by **repo name** (`competition-engine`, `AVBC-FE-WebClient`, …) and the value is the deployed git tag (`v2.109.0`). Swap `qc` for `smoke` / `qcsocial`.

**Do not use the version-tracker site** — since ~2026-08-31 its `retrieve` endpoint is behind an Okta OIDC authorizer, so unauthenticated calls return `{"message":"Unauthorized"}` and the SPA exposes no anonymous API. SSM is the same data one hop earlier.

Map the ticket to a tag before comparing:

```sh
sha=$(git log origin/<default> --grep="<TICKET-KEY>" --format=%H -1)
git tag --contains "$sha" | sort -V | head -1
```

- Deployed **≥** target → already satisfied (a nightly may have lapped you). Treat as deployed.
- Deployed **<** target → not testable yet.
- `ParameterNotFound` → usually a **package** repo (`AVBC-Packages`, `AV-Common-UI-Kit`, `@av-common/*`), which never deploys to an instance. It becomes testable only once a consumer bumps the dependency *and its lockfile* and that consumer deploys — judge the package ticket by the consumer's deployment.

**To actually deploy it, use the `deploy-dev-instance` skill.** It owns CodeBuild project selection, the `APP_NAME`/`APP_VERSION` rules, deploy ordering (portal last, competition-engine's three-step route dance, package→consumer order) and verification.

**Then transition — forwards only.** Re-read *Never move a ticket backwards* in `SKILL.md`. The deploy check applies only to tickets at *In Development* / *Development Complete*; anything at *Ready for QA* or later already implies everything the check could tell you, and promoting it erases a QA approval. **Tasks under a feature epic go to Done** once deployed and dev-validated — QA tests the epic's **Stories**, not its Tasks. Check `issuetype` before choosing. Then apply the QA gate in `SKILL.md`. For a change QA cannot see from the front end, validate it yourself, then send it to Pending Deployment (code still to ship) or Done (nothing left to deploy). The exception is a change that could break a player-facing feature: it gets a targeted QA regression check of that feature. Anything sent to QA gets the short RFQA test steps.

## Triage registry schema

Persist what's been triaged so repeat batches skip finished tickets. Location: `$CODE_ROOT/.claude/triage-registry.json` — **not committed** (local state, may hold ticket detail).

**Retention:** the registry tracks **only current children of the configured triage parent(s)** (`BACKLOG_PARENT`, plus any launch-blocker parent). Keep every ticket while it stays under those parents — including terminal **Done / Aborted** ones (never purge on close; the registry doubles as an audit trail).

**Graduation (the one removal case):** when a ticket's **parent moves off the triage parent(s)**, it has been pulled into a downstream epic (e.g. a weekly deploy epic) → promoted onward. Remove it from `tickets` and archive to `_graduated` (`{key, graduatedTo, statusAtGraduation, removedOn, classification, prUrl}`). It re-enters if reopened back under a triage parent. Also drop tickets re-parented to any unrelated epic.

**Sync must fetch `parent`, not just `status`.** For each registry ticket pull its current `parent` + `status`; update `jiraStatusLive`/`lastPolled`, then drop any whose parent ∉ the triage parent set. Batch via `key IN (...)` (~50/query, fields `key,parent,status`); results are large → save to host files and parse with `jq`. Note: MCP JQL `cursor` pagination is currently unreliable (can return page 1 repeatedly) — prefer `key IN` sharding over cursor paging.

```json
{
  "_meta": {
    "retentionRule": "never purge Done/Aborted while under a triage parent — history of the workflow",
    "graduationRule": "remove + archive to _graduated when parent moves off the triage parent(s); re-add if reopened back under one"
  },
  "tickets": {
    "ENGR-1234": {
      "classification": "code-defect | epic | product | vendor-infra",
      "repo": "<repo the fix belongs in, if known>",
      "parent": "<current parent key — checked each sync>",
      "action": "commented | PR-opened | transitioned | aborted",
      "statusTransition": "Technical Discovery",
      "jiraStatusLive": "<last-polled status>",
      "lastPolled": "<ISO8601 date>",
      "prUrl": "<url or null>",
      "assignee": "<display name or null — null means nobody has claimed it>",
      "autoPrEligible": "true | false — false when a blocker label is set or another dev is on it",
      "autoPrBlockedBy": "<null | 'blocker label' | 'assigned to another dev' | 'conflicting open PR #N'>",
      "timestamp": "<ISO8601, passed in — do not invent>"
    }
  },
  "_graduated": [
    { "key": "ENGR-5411", "graduatedTo": "<downstream epic>", "statusAtGraduation": "Pending Deployment", "removedOn": "<ISO8601 date>", "classification": "code-defect", "prUrl": "<url or null>" }
  ]
}
```
