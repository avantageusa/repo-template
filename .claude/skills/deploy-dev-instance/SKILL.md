---
name: deploy-dev-instance
description: >
  Deploy a built version of a repo to a dev-account instance (smoke, qc, qcsocial)
  and verify it landed. Use when asked to "deploy X to qc", "push this to smoke",
  "get the fix onto qc so QA can test", "is X deployed?", "what version is on qc",
  or when a merged ticket needs to reach an environment before it can move forward.
  Checks the currently-deployed version, picks the right CodeBuild project, starts
  the build, and verifies the deployed marker actually changed. Also used by the
  jira-triage skill's post-merge step. Does NOT deploy to production.
---

# Deploy to a dev instance

Get a **built** version of a repo onto `smoke`, `qc` or `qcsocial`, and prove it arrived.

**Scope.** This skill deploys already-built artifacts. It never writes code, never bumps a version, never merges a PR, and never touches production. If the version you want does not exist as a build yet, that is a CI problem — stop and say so.

**The shape of it** — one CodeBuild start with three overrides:

```sh
aws codebuild start-build \
  --project-name smoke-nightly-deploy-multipurpose \
  --profile dev --region eu-west-2 \
  --no-cli-pager --output text \
  --environment-variables-override \
  '[{"name":"APP_NAME","value":"<repo>","type":"PLAINTEXT"},
    {"name":"APP_VERSION","value":"<version-no-v>","type":"PLAINTEXT"},
    {"name":"DEPLOY_STAGE","value":"<stage>","type":"PLAINTEXT"}]'
```

Everything below is about doing that safely: the right project, the right name, the right version, and confirming the result — because **a green build is not proof the deploy stuck.**

## Config

| Key | Value |
|-----|-------|
| AWS profile | `dev` — pass `--profile dev` on every call |
| AWS region | `eu-west-2` — pass `--region eu-west-2` on every call; the CLI default is not it |
| Account | `468872710644` (labelled "Dev"; every stage below lives here) |
| Stages | `smoke` · `qc` · `qcsocial` |
| CodeBuild — ECS/dockerized | `docker-nightly-deploy-multipurpose` |
| CodeBuild — everything else | `smoke-nightly-deploy-multipurpose` |
| Deployed marker | `/GlobalPipeline/<stage>/Deployed/<repo>` |
| Intended marker | `/GlobalPipeline/<stage>/ToBeDeployed/<repo>` |

**What the stages are for:**

- **`smoke`** — canary. Auto-deploys the most recent successful **prerelease** build of each repo, which means it can be running unmerged PR code. Fine for validating that a deploy *mechanism* works; do not trust it as a test environment.
- **`qc`** — the primary dev testing environment for real-money. This is where QA tests. A fix is not testable until it is here.
- **`qcsocial`** — primary dev testing for social. Lightly used, and lags: see the alert-service gap in `reference.md`.

`qc` and `qcsocial` both receive the latest **released** version via the nightly. So a change that services resolve at deploy time will arrive on its own by the next nightly — deploy manually only when you need it sooner, or when the nightly is blocked.

**`hotfix` is decommissioned.** Leftover `/GlobalPipeline/hotfix/Deployed/*` params and `dev_hotfix` terraform roots still exist and read as live-environment gaps during audits. Exclude `hotfix` from stage lists without asking.

## Step 0 — Preflight

**1. Auth.** Confirm you are in the dev account before doing anything else:

```sh
aws sts get-caller-identity --profile dev --region eu-west-2   # expect account 468872710644
```

**Pass `--profile dev --region eu-west-2` on every call in this skill.** The CodeBuild projects and SSM parameters live in `eu-west-2`, and the CLI's default region is not. Rely on exported environment instead and you get:

```
Project cannot be found: arn:aws:codebuild:us-east-1:468872710644:project/smoke-nightly-deploy-multipurpose
```

That error means the region, not the project or your permissions — `AWS_PROFILE=dev` on its own leaves you in `us-east-1`. Exporting `AWS_PROFILE=dev AWS_REGION=eu-west-2` works too, but the explicit flags survive being copied into a different shell.

On **any** authentication failure, stop and ask the user to run `aws sso login`. Never attempt to authenticate — SSO is an interactive browser flow only the user can complete.

**2. Is this repo even deployable?** Three cases that are not:

- **Package repos** (published to the npm registry, consumed via `package.json` — `AVBC-Packages`, `AV-Common-UI-Kit`, `wowza-service-client`, anything `@av-sym/*` or `@av-common/*`). They never deploy to an instance. `get-parameter` returns `ParameterNotFound`, which is the signal. A package reaches an environment only when a **consumer** bumps its dependency *and its lockfile* and that consumer deploys. See "Cross-repo package changes" below.
- **Hard-excluded terraform repos.** `smoke-nightly-deploy-multipurpose` refuses these outright — the build exits 1 during its INSTALL phase: `jargogle-tf`, `tf-importable-modules`, `neotech-mongo-tf`, `cognito-tf`, `monte-rosa-tf`, `jfrog-tf`, `authorizer-lambda`, `nightly-deploy-tf`, `tf-shared-infrastructure`. These need a manual `terraform apply` per env root — see `reference.md`.
- **`jargogle-dwh` is qc-only.** Any other stage exits 1 (an `AIB-5402` guard in the CodeBuild).

**3. Confirm the target stage with the user if it was not stated.** Deploying to the wrong stage is not destructive but wastes a build and can push a stale version — see Step 1.

## Step 1 — Establish current and target version

**Never skip this.** Deploying blind is how a stage gets pushed backwards.

```sh
aws ssm get-parameter --profile dev --region eu-west-2 \
  --name "/GlobalPipeline/<stage>/Deployed/<repo>"     --query Parameter.Value --output text
aws ssm get-parameter --profile dev --region eu-west-2 \
  --name "/GlobalPipeline/<stage>/ToBeDeployed/<repo>" --query Parameter.Value --output text
```

`Deployed` is what is running. `ToBeDeployed` is what the environment is **pinned** to.

**Read both before concluding anything.** A retrigger redeploys the pinned version, which is usually the version the stage already had — that looks like a rollback and is not one. On 2026-09-10, deploying `AVBC-FE-WebClient` and `competition-client` to qc each retriggered `game-portal-client` at v2.460.6 while the latest tag was v2.460.10. Both markers read v2.460.6: qc was pinned there, nothing had regressed, and "correcting" it to latest was the wrong call (it also failed, on a pre-existing peer conflict). **Latest tag is not the environment's intended version.**

**Find the target version from tags, never from a manifest** — CI sets versions, so a manifest is not authoritative:

```sh
sha=$(git log origin/<default> --grep="<TICKET-KEY>" --format=%H -1)
git tag --contains "$sha" | sort -V | head -1        # e.g. v2.109.0
```

Then compare:

- Deployed **≥** target → **already satisfied. Do not deploy.** A nightly may have lapped you; pushing your older tag would regress the stage. Treat this exactly as "deployed" and move on.
- Deployed **<** target → proceed.
- Prerelease tags (`X.Y.Z-prerelease.N`) sort **below** their release. Say so rather than guessing.

## Step 2 — Choose the CodeBuild project

**Look it up. Do not guess, and never probe by running one and falling back to the other** — see the warning at the end of this step.

The authoritative map is the deploy config both projects read at build time, so it cannot drift from what actually happens:

```sh
aws s3 cp s3://hotfix-deploy-tools-steps-tf-eu-west-2-dev-configs/defaultDeployConfig.json5 - \
  --profile dev --region eu-west-2 | grep -A3 '"<repo>"'
```

| Where the repo appears | `--project-name` |
|---|---|
| Listed under `deployableComponentsByName` | `smoke-nightly-deploy-multipurpose` |
| **Not** listed, and it runs on ECS | `docker-nightly-deploy-multipurpose` |

The config holds ~42 components, each with `deployArgs` naming its flavour — `--tf-root-dirs` (terraform), `--sls3-yamls` / `--sls4-yamls` (serverless). The `smoke-*` project resolves `deployArgs` for `APP_NAME` out of this file; a repo that is not in it has no deploy args and that project cannot deploy it.

**ECS repos are absent from the config on purpose** — the `docker-*` project does not need deploy args. It pulls `avantage.jfrog.io/platform-docker-<maturity>-local/<APP_NAME>:<APP_VERSION>`, then rewrites and rolls the ECS service, deriving names by convention:

```
TASK_FAMILY  = <stage>-<APP_NAME>-tf-api-td
SERVICE_NAME = <stage>-<APP_NAME>-tf-api-service
ECS_CLUSTER  = <stage>-<APP_NAME>-tf-api
```

Six repos break that convention and are special-cased in the buildspec — `vmix-stats-generator`, `av-bot-service`, `b2b-partner-harness`, `ledger-server`, `ps-strapi-cms`, `referral-api` (whose image is `referral`, not `referral-api`), `wowza-probe`. If you are deploying one of those, read the buildspec rather than assuming the pattern.

> **Never trial-and-error the project.** Running `docker-*` against a non-ECS repo is **not** a safe no-op: it writes `/GlobalPipeline/<stage>/ToBeDeployed/<APP_NAME>` **before** it calls `describe-task-definition`, so the run leaves that marker pointing at a version that was never deployed and then fails. `ToBeDeployed` is the marker Step 1 tells you to trust to tell a pinned retrigger from a rollback, and the nightly is gated on it — poisoning it corrupts the signal and can misdirect a later deploy. A wrong `APP_NAME` fails safely; a wrong **project** does not.

**`APP_NAME` is the repo name.** This matters most for terraform: **a `*-tf` repo publishes one artifact named after the repo**, even when it deploys several components. The per-component names (`account-api-tf-core`, `account-api-tf-api`) are deploy *outputs* that appear in SSM and the version tracker — which is exactly what makes the wrong name look plausible.

```
APP_NAME=account-api-tf-api    # WRONG — fails at the jf download step
APP_NAME=account-api-tf        # RIGHT — applies every component in the repo
```

A wrong name is **safe**: it fails at artifact download before any terraform runs, so probing costs nothing.

**`APP_VERSION` drops the leading `v`** — `2.109.0`, not `v2.109.0`.

## Step 3 — Deploy

```sh
aws codebuild start-build \
  --project-name <project-from-step-2> \
  --profile dev --region eu-west-2 \
  --no-cli-pager --output text \
  --environment-variables-override \
  '[{"name":"APP_NAME","value":"<repo>","type":"PLAINTEXT"},
    {"name":"APP_VERSION","value":"<version-no-v>","type":"PLAINTEXT"},
    {"name":"DEPLOY_STAGE","value":"<stage>","type":"PLAINTEXT"}]'
```

All three overrides are required and all are `PLAINTEXT`. Pass `--profile` and `--region` explicitly on the command rather than relying on exported environment — it is one less thing to get wrong, and it is what makes this runnable on any machine.

Success returns a `BUILD … IN_PROGRESS` ARN. Capture the build id — you need it to verify.

Deploying to `smoke` first to prove the mechanism is fine, but the change **must** reach `qc` before any ticket moves to Ready for QA.

**Ordering matters. Read "Deploy ordering" below before deploying more than one repo.**

## Step 4 — Verify — a green build is not proof

Three levels, in order.

**1. Did the build succeed?**

```sh
aws codebuild batch-get-builds --ids "<build-id>" \
  --profile dev --region eu-west-2 \
  --query 'builds[0].[buildStatus,currentPhase]' --output text
```

**2. Did the deployed marker actually change?** This is the real gate. On 2026-08-12 a `game-portal-client` build reported SUCCEEDED, its log showed the `put-parameter` succeeding, and the value was **overwritten seconds later** by three chained remote deploys.

```sh
aws ssm get-parameter --profile dev --region eu-west-2 \
  --name "/GlobalPipeline/<stage>/Deployed/<repo>" \
  --query 'Parameter.[Value,Version,LastModifiedDate]' --output text
```

Check the value **and** that the parameter version incremented. Re-check after every other in-flight deploy has settled, not immediately.

**3. Does the running thing serve it?** For front-ends, the served artifact is ground truth:

```sh
curl -s https://qc-game-portal-client-tf-b2c.dev.ae.games/assets/env.js | grep -oiE '"VERSION"[^,}]*'
```

Note `assets/env.js`, not `/env.js`.

For a terraform env-var change, verify **by name only** — never dump the whole object, it contains live secrets:

```sh
aws ecs describe-task-definition --task-definition qc-account-api-tf-api-td \
  --profile dev --region eu-west-2 \
  --query 'taskDefinition.containerDefinitions[0].environment[?contains(name,`TURNSTILE`)].name' \
  --output text
```

## Deploy ordering

Three orderings that break silently when ignored.

**1. `game-portal-client` goes LAST.** Deploying `account-client`, `competition-client`, `AVBC-FE-WebClient` or `rankings-client` **chain-triggers a `game-portal-client` redeploy at the portal's then-current version**. They are module-federation remotes and the host shell refreshes automatically, so a portal deploy done first or concurrently is silently reverted. Deploy every remote, wait for all builds to finish, then deploy the portal, then verify.

**2. `competition-engine` route changes need three steps, per environment.** Its API Gateways get routes from terraform importing an OpenAPI body at apply time, fetched over `data.http` from a **running** task — so terraform cannot read a route until a live task serves it:

1. Deploy `competition-engine` (ECS) with the new route
2. Apply `competition-engine-tf` — re-fetches the spec, re-imports the gateway body
3. Deploy `competition-engine` (ECS) again

Skip step 2 and the route is unreachable at the gateway while the service is perfectly healthy — green health checks, code demonstrably present, tests passing. The symptom is a 403/404 at the gateway, which sends you hunting auth instead of deploy ordering. This cost a week on PO-1698. Any repo using the same `data.http` → gateway-body pattern behaves the same way.

**3. Cross-repo package changes: package → consumer bump (with lockfile) → consumer deploy.** Publishing the package does not reach anyone: the consumer's `package-lock.json` pins the previously resolved version, so `npm ci` keeps installing the old one even when the caret range in `package.json` would allow the new one. Check the **lockfile**:

```sh
git show origin/master:package-lock.json | grep "avbc-packages-2\."
```

Green CI proves nothing here — builds are transpile-only, so neither an unresolvable type import nor a schema mismatch shows up. `AVBC-BE-GameEngine` fails hard at `serverless deploy` (its AppSync config reads the SDL straight out of `node_modules`); `AVBC-FE-WebClient` fails **silently**, the missing operation document simply being `undefined`.

## After a successful deploy

- If this deploy was for a Jira ticket, hand back to **`jira-triage`** for the transition — and read its *Never move a ticket backwards* rule first. Short version: the deploy check applies only to tickets at *In Development* / *Development Complete*; **Tasks under a feature epic go to Done** once deployed and dev-validated, because QA tests the epic's **Stories**, not its Tasks.
- If the change needed anything beyond merge + deploy — flags, SSM params, migrations, secrets, infra, env vars, ordering, one-off commands — post a Jira comment beginning exactly `DEPLOYMENT NOTE:`. The deploy tooling collects those into the epic's runbook, and a missing note means a manual step gets dropped at deploy time.

## Guardrails

- **Production is out of scope.** This skill deploys to `smoke`, `qc`, `qcsocial` and nothing else.
- **Never deploy a version older than what the stage holds.** Check `Deployed` first, every time.
- **Never hand-bump a version to make a deploy work.** CI sets versions; a version-only diff fights the tooling.
- **Never authenticate on the user's behalf.** On auth failure, ask them to run `aws sso login`.
- **Deploying a stale stage is a go/no-go, not a formality** — for terraform especially, it applies *all* drift accumulated since the version that stage holds. Say what the gap is and let the user decide.
- **Never echo secrets.** Query env vars and parameters by name; do not dump whole objects.
- Commands must run verbatim in **zsh** — quote globs and brackets, and remember zsh does **not** word-split unquoted variables, so `for k in $KEYS` iterates once. Use an explicit list or an array.
