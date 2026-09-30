# deploy-epic — reference

## 1. Description ADF (the template, structurally)

`DEPLOY-872` is five `panel` nodes. Posting markdown produces headings without panels, so build ADF and pass it to `createJiraIssue` as the description (ADF content format). Skeleton — replace the bullet content, keep the shape:

```json
{
  "type": "doc", "version": 1,
  "content": [
    { "type": "panel", "attrs": {"panelType": "warning"}, "content": [
      { "type": "paragraph", "content": [
        {"type":"text","text":"Deploy: "},
        {"type":"text","text":"ENGR-5563 Influencer streams",
         "marks":[{"type":"link","attrs":{"href":"https://avantageusa.atlassian.net/browse/ENGR-5563"}}]},
        {"type":"hardBreak"},
        {"type":"text","text":"Target Env(s): QA"}
      ]}
    ]},

    { "type": "panel", "attrs": {"panelType": "note"}, "content": [
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Project Versions"}]},
      {"type":"paragraph","content":[{"type":"text","text":"Deployable components:"}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[
          {"type":"text","text":"account-api v2.101.0"}]}]}
      ]},
      {"type":"paragraph","content":[{"type":"text","text":"Non-deployable components:"}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[
          {"type":"text","text":"@av-common/wowza-service-client 2.17.0 (package update)"}]}]}
      ]}
    ]},

    { "type": "panel", "attrs": {"panelType": "info"}, "content": [
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Growthbook Flags"}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[
          {"type":"text","text":"use-wowza-stream-placement — create OFF before deploy, enable after ("},
          {"type":"text","text":"ENGR-5607",
           "marks":[{"type":"link","attrs":{"href":"https://avantageusa.atlassian.net/browse/ENGR-5607?focusedCommentId=123456"}}]},
          {"type":"text","text":")"}]}]}
      ]}
    ]},

    { "type": "panel", "attrs": {"panelType": "warning"}, "content": [
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Seeders/Migrations"}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"N/A"}]}]}
      ]}
    ]},

    { "type": "panel", "attrs": {"panelType": "error"}, "content": [
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Special Instructions"}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[
          {"type":"text","text":"Deploy account-api before account-client — client depends on /v2/login."}]}]}
      ]}
    ]}
  ]
}
```

Panel type ⇄ color, for verifying against the rendered template:
`info` `#deebff` · `note` `#eae6ff` · `success` `#e3fcef` · `warning` `#fffae6` · `error` `#ffebe6`.

**Never let a `code`-marked text node start or end with a space** — e.g. `{"text": " POST /foo", "marks":[{"type":"code"}]}` renders as literal `{{ POST /foo}}` wiki markup. Put the space in the adjacent plain text node instead.

After creating, verify the panels survived: `getJiraIssue(<NEW-KEY>, fields=["description"], expand="renderedFields")` and confirm five `<div class="panel" style="background-color: …">` blocks in the template's colors.

Re-read the live template before authoring if it may have changed:

```
getJiraIssue(issueIdOrKey="DEPLOY-872", fields=["description"], expand="renderedFields")
```

`renderedFields.description` shows the panel divs + colors; `fields.description` (markdown) shows the section text.

## 2. PR → module version

```sh
# merged PRs for a ticket, org-wide (same key-matching Jira's Development panel uses)
gh search prs --owner avantageusa "ENGR-1234" --limit 20 \
  --json number,title,url,state,repository,closedAt

# merge commit for a PR
gh api repos/avantageusa/<repo>/pulls/<n> --jq '.merge_commit_sha'

# exact tag on that commit (semantic-release tags the merge commit — usual case)
# NOTE: gh's built-in --jq takes no --arg; pipe to real jq when you need variables.
gh api "repos/avantageusa/<repo>/tags?per_page=100" \
  | jq -r --arg sha "<sha>" '.[] | select(.commit.sha==$sha) | .name'

# fallback: which tag first contains the commit
gh api "repos/avantageusa/<repo>/compare/<sha>...<tag>" --jq '{status,ahead_by,behind_by}'
#   status "ahead" or "identical" ⇒ <tag> contains <sha>; "behind"/"diverged" ⇒ it does not.
#   Walk tags newest→oldest, keep the OLDEST tag that still contains the sha.

# local alternative when the repo is cloned under CODE_ROOT (fetch only, never checkout)
git -C "$CODE_ROOT/<repo>" fetch --tags --quiet
git -C "$CODE_ROOT/<repo>" tag --contains <sha> | sort -V | head -1
```

Version strings: tags carry a leading `v` (`v2.202.0`); prereleases look like `2.385.15-prerelease.2229` where the suffix is the CI build number. Quote versions in the ticket exactly as the tag reads.

## 3. Version tracker

`GET $VERSION_TRACKER_URL` (unauthenticated, full scan) returns:

```
[{ name: <awsAccountId>, deployments: [ { name: <instance>,
     components: [ { name: <component>, versions: [ {version, time} ] } ] } ] }]
```

`versions` is time-descending, so `[0]` is current. QC = account `468872710644`, instance `qc`. Other instances present: `smoke`, `qcsocial`, `hotfix`, plus per-dev instances; prod accounts are separate account ids with instance `main`.

```sh
# every component + current version on QC
curl -s "$VERSION_TRACKER_URL" | jq -r '.[] | select(.name=="468872710644")
  | .deployments[] | select(.name=="qc") | .components[]
  | "\(.name)\t\(.versions[0].version)"'

# was an exact tag ever on QC
curl -s "$VERSION_TRACKER_URL" | jq -r --arg c "<component>" --arg v "v1.2.3" \
  '.[]|select(.name=="468872710644")|.deployments[]|select(.name=="qc")
   |.components[]|select(.name==$c)|.versions[]|select(.version==$v)|.time'
```

**Component name ≠ repo name.** Confirm against the QC component list before declaring a version missing. Observed shapes:

| Repo | Tracker component(s) |
|---|---|
| `referral` | `referral`, `referral-api`, `referral-tf-core`, `referral-tf-api` |
| `AVBC-BE-GameStateService` | `AVBC-BE-GameStateService-private-api`, `-alt`, `-tf-core` |
| `AVBC-BE-GameEngine` | `AVBC-BE-GameEngine`, `-public-api`, `-tf-core` |
| `account-api` | `account-api`, `account-api-tf-api`, `account-api-tf-core` |
| `game-portal-client` | `game-portal-client`, `game-portal-client-tf-client` |
| any `*-tf` repo | `<name>-tf-core` / `-tf-api` / `-tf-client` (infra, deployed separately) |

Some components read `unversioned` or `dev-deploy` — those are not semver-comparable; report them verbatim.

Source of truth for the API: `version-tracker-site/back-end/src/functions/retrieve.ts`.

## 4. DEPLOYMENT NOTE convention (team mandate)

Any change needing more than merge+deploy gets a Jira comment starting exactly `DEPLOYMENT NOTE:`.

```
DEPLOYMENT NOTE: [<target env(s)>] <what changed/created> — <action the deployer must take> (<before/after deploy / ordering>)
```

Required for: GrowthBook flags · SSM parameters · DB migrations/seeding/backfills · secrets/API keys · infrastructure (Terraform/IAM/queues/buckets) · env vars/config · deploy ordering & cross-module deps · rollback specials · external/vendor config (webhooks, OAuth, callbacks) · workers/consumers/cron · one-off scripts, cache invalidation, manual commands · DNS/certs/CDN · **module version override** (mandatory when Development info is incomplete/inaccurate or several tickets shipped in one PR).

One comment per distinct action. Case-insensitive match, but the prefix is written exactly.

## 5. Crawl helper

```
searchJiraIssuesUsingJql(jql='parent = "ENGR-5563" ORDER BY key ASC',
  fields=["summary","status","issuetype","parent","labels","fixVersions"])
```

Repeat for each returned key to pick up subtasks (Jira `parent` covers epic→story and story→subtask alike). Then fetch comments per issue only where needed:

```
getJiraIssue(issueIdOrKey="<KEY>", fields=["comment"], responseContentFormat="markdown")
```

Comment link: `<JIRA_BASE_URL>/browse/<KEY>?focusedCommentId=<comment.id>`.

## 6. Worked example — DEPLOY-948 rewritten

[DEPLOY-948](https://avantageusa.atlassian.net/browse/DEPLOY-948) is the reference case for the Output style rules in `SKILL.md`. It is accurate and unusable: ~950 words of derivation, history and provenance around roughly a dozen actual instructions. Devops fed back that tickets in this shape are too verbose to execute.

The same content, obeying the rules:

**Project Versions**
```
referral — version TBD, dev to confirm before deploy (see PO-2978)
account-client — build cut after 2026-08-04 (see ENGR-5927)
game-portal-client — v2.411.0 or later, no bump if already deployed (see PO-2955)
Non-deployable: N/A
```

**Growthbook Flags**
```
Create equity-earned-shared-filter-config with geographicalFilters + dateFilters BEFORE account-client deploy — see PO-2942
Do NOT add competitionTypeFilters to that flag — see PO-2976
Copy the equity-modal-content object from QC into the target env — see PO-2940
Add geographicalLabel to equity-modal-content — non-blocking, see PO-2942
Confirm influencer-self-bonus is ON — see PO-2978
```

**Seeders/Migrations**
```
N/A
```

**Special Instructions**
```
Deploy order: referral → account-client → game-portal-client — see PO-2978
Competition-type filter row is intentionally absent — not a defect, see PO-2976
Test with a newly created influencer account — see ENGR-5896
```

12 lines against ~950 words. What was cut, and where it went:

| Cut | Why | Where it lives |
|---|---|---|
| How each version was derived (PR dates, QC heads, `dev-deploy`) | provenance, not an instruction | chat report to the user |
| What each PR changed, endpoint shapes, defect lists | rationale | the linked tickets |
| "Not shipping": PO-2965, PO-2966, ENGR-5887 | no action for a deployer | the epic |
| ENGR-6016 "known, not blocking" | not a deploy step | the epic |
| Per-user-type functional verification table | QA's job, not the runbook | the epic's test instructions |
| "Provenance:" paragraph | pure meta | chat report to the user |

Kept in full: every flag key, the on/off state, the env, the ordering constraint, the one line that stops a false defect report, and the data caveat that changes *how* a deployer smoke-tests.
