# deploy-dev-instance — reference

Repo-specific detail behind `SKILL.md`. Everything here was paid for by an incident.

## 1. The deploy call, exactly

One `aws codebuild start-build` with three PLAINTEXT environment-variable overrides — `APP_NAME`, `APP_VERSION`, `DEPLOY_STAGE`. That is the entire deploy interface.

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

| Repo shape | `--project-name` |
|---|---|
| ECS / dockerized service | `docker-nightly-deploy-multipurpose` |
| Everything else | `smoke-nightly-deploy-multipurpose` |

Both projects live in account `468872710644`, region **`eu-west-2`**. Always pass `--profile dev --region eu-west-2`; the CLI's default region is `us-east-1` and a missing region surfaces as `Project cannot be found`, which reads like a permissions or naming problem and is neither.

After `aws sso login`, `--profile dev` is sufficient. If some tool genuinely needs the credentials as the *default* profile, `npx cdk-sso-sync dev` materialises them — but prefer the explicit flags.

## 1a. The component map — `defaultDeployConfig.json5`

Both CodeBuild projects `aws s3 cp` this file in their INSTALL phase and resolve `APP_NAME` out of it, so it is the authoritative answer to "which project deploys this repo", not a copy that can drift.

```sh
aws s3 cp s3://hotfix-deploy-tools-steps-tf-eu-west-2-dev-configs/defaultDeployConfig.json5 . \
  --profile dev --region eu-west-2
```

Shape: `deployableComponentsByName` → per component `deployedVersionSsmNames`, `deployArgs`, and optionally `directDependencies`. ~42 components as of 2026-09-10.

The `smoke-*` project does:

```sh
export APP_DEPLOY_ARGS=$(json5 defaultDeployConfig.json5 \
  | jq -r --arg APP_NAME "$APP_NAME" '.deployableComponentsByName[$APP_NAME].deployArgs')
```

so a repo absent from the file has no deploy args and cannot be deployed by that project.

Flavours present, by `deployArgs` flag: `--tf-root-dirs` (terraform, 30), `--sls3-yamls` (9), `--sls4-yamls` (7), `--pre-deploy-cmd-string` (15, alongside another flag).

**`directDependencies` is the deploy-ordering hint** the portal chain rule describes from the other direction — e.g. `account-api-tf` declares `cognito-tf`, `marketplace-api-tf`, `game-portal-client-tf`. Worth reading before a multi-repo rollout.

**Note the `hotfix-` bucket prefix.** The environment is decommissioned but this bucket is still what the live builds read — do not "clean it up" on the strength of the name. The config is hand-edited in S3 and the deploy-tools repo copy has been stale since 2024-03 (ENGR-6342), so S3 is the only source worth reading.

**ECS repos are deliberately not in the file.** The `docker-*` project needs no deploy args; it derives everything by convention:

```
JF_IMAGE     = avantage.jfrog.io/platform-docker-<maturity>-local/<APP_NAME>:<APP_VERSION>
TASK_FAMILY  = <stage>-<APP_NAME>-tf-api-td
SERVICE_NAME = <stage>-<APP_NAME>-tf-api-service
ECS_CLUSTER  = <stage>-<APP_NAME>-tf-api
```

`<maturity>` is `dev` when `APP_VERSION` contains `-prerelease`, otherwise `int`.

Convention-breaking repos, special-cased in the buildspec:

| `APP_NAME` | Deviation |
|---|---|
| `vmix-stats-generator` | names use `vmix`, not the app name |
| `av-bot-service` | `-tf-mixed-*` instead of `-tf-api-*` |
| `b2b-partner-harness` | `-tf-mixed-*` |
| `ledger-server` | names use `ledger-tf-api-*` |
| `ps-strapi-cms` | `-tf-td` / `-tf-service` / `-tf`, no `api` segment |
| `referral-api` | cluster is `referral-tf-api-*`; **image is `referral`, not `referral-api`** |
| `wowza-probe` | `-tf-core-*` instead of `-tf-api-*` |

### Picking the wrong project is not a safe probe

The `docker-*` buildspec writes the intended-version marker **before** it touches ECS:

```
166:  put_ssm_param_globalpipeline_tobedeployed     # aws ssm put-parameter .../ToBeDeployed/$APP_NAME
212:  TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition "$TASK_FAMILY")
```

Run it against a repo with no such task family and the build leaves `/GlobalPipeline/<stage>/ToBeDeployed/<repo>` set to a version that was never deployed, then fails. That marker is what distinguishes a pinned retrigger from a rollback (§6) and what gates the nightly — corrupting it can misdirect a later deploy. A wrong `APP_NAME` fails safely at artifact download; a wrong **project** does not.

### The two exclusion lists differ

`smoke-*` refuses nine repos; `docker-*` refuses six. Only `smoke-*` carries the `authorizer-lambda`, `nightly-deploy-tf` and `tf-shared-infrastructure` entries, and only `smoke-*` has the `jargogle-dwh` qc-only guard (`AIB-5402`). Do not assume a repo excluded from one is excluded from the other.

## 2. SSM markers

```
/GlobalPipeline/<stage>/Deployed/<repo>        # what is running
/GlobalPipeline/<stage>/ToBeDeployed/<repo>    # what the stage is pinned to
```

Some pipelines write `/AvComponents/Deployed/<stage>/<repo>` instead — try that if the first path returns `ParameterNotFound` and you have reason to believe the repo is deployable.

For terraform repos the *outputs* are per component — `/GlobalPipeline/qc/Deployed/account-api-tf-core` **and** `…/account-api-tf-api` — while the deploy input is the single repo name. Do not confuse the two.

Data flow behind the version-tracker site: CI → SSM param → EventBridge → DynamoDB `main-deployed-versions-detail` → the site. Reading SSM is the same data one hop earlier.

**Do not use the version-tracker site.** Since ~2026-08-31 its `retrieve` endpoint sits behind an Okta OIDC lambda authorizer (ENGR-6216); unauthenticated calls return `{"message":"Unauthorized"}` and the SPA bundle exposes no anonymous data API. SSM needs no browser and is scriptable.

## 3. Terraform repos

**One artifact per repo, named after the repo.** See `SKILL.md` Step 2. A wrong name fails at the `jf rt dl` step with `No errors, but also no files affected (fail-no-op flag)` before any terraform executes — so probing is safe.

**`*-tf` repos ride the nightly.** Eight of nine ENGR-6396 tf PRs merged 2026-09-03 were on dev `qc` by the 19:35 -05:00 nightly. Stages lag independently and are gated by `ToBeDeployed` — `qcsocial` and `smoke` have held months-old tf versions. Check the `Deployed` dates before deploying manually; the nightly may already have done it.

**Deploying a stale stage applies all drift** since the version it holds, not just your change. Treat it as a go/no-go and tell the user what else is in the plan.

**Hard-excluded from the deploy CodeBuild** (rejected in the INSTALL phase; the build exits 1):

```
jargogle-tf | tf-importable-modules | neotech-mongo-tf | cognito-tf | monte-rosa-tf
jfrog-tf | authorizer-lambda | nightly-deploy-tf | tf-shared-infrastructure
```

**`tf-shared-infrastructure` is manual `terraform apply` per env root** (`tf/envs/{qa_main,prod_main,dev_main,…}`; S3 backends `avantage-qa-tf` / `avantage-tf-backend-prod`, key `main/tf-shared-infrastructure.tfstate`, lock table `avantage-tf-backend`). Its `/GlobalPipeline/main/Deployed/tf-shared-infrastructure` has read `unversioned` since 2023-12 — no pipeline ever writes it. Ask the user whether they or DevOps apply it.

**Terraform against a non-dev profile.** The shell may export `AWS_PROFILE=dev` globally, and terraform's S3 backend then fails with `InvalidToken: The provided token is malformed` even after `export AWS_PROFILE=qa`. Working recipe:

```sh
unset AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
eval "$(aws configure export-credentials --profile qa --format env)"
export AWS_REGION=eu-west-2
terraform init -reconfigure && terraform plan -lock=false -out=…
```

Always check the plan against the ticket's "only these resources" rule before any apply. tfsi `qa_main` carried unrelated drift on 2026-09-08 (alarm SNS topic destroy, guardrail lambda, CloudFront, VPN log group).

**`jargogle-dwh` is qc-only** — an `AIB-5402` guard exits 1 for any other stage.

## 4. Known blockers

**qcsocial: alert-service SSM gap.** As of 2026-09-09, deploying `account-api-tf`, `av-bot-service-tf`, `competition-engine-tf`, `ledger-tf` or `referral-tf` to **qcsocial** fails during terraform's data-source read:

```
Error: describing SSM parameter (/qcsocial/alert-service-api/API_URL): ParameterNotFound
  with module.<x>.data.aws_ssm_parameter.alert_service_api_url
```

The Centralized Alert Service wiring added an *unconditional* `data "aws_ssm_parameter" "alert_service_api_url"` to those modules, but `alert-service-tf` only has env roots for `bet5_main`, `dev_qc`, `dev_smoke`, `dev_workspace`, `prod_main`, `qa_main` — no `dev_qcsocial`. It fails before plan, so nothing is applied and the failure is safe, but it blocks **any** deploy of those repos to qcsocial including the nightly. Check first:

```sh
aws ssm get-parameter --name /<stage>/alert-service-api/API_URL
```

The same env-root gap plausibly affects `dev_dqa`, `dev_qa`, `b2b_*`, `demo_*`, `stage_gamma`, `stg_main` — unverified, other accounts. The fix belongs to the alert-service work, not the consuming repo. Ignore `hotfix`.

**Tekton allowlist.** A repo with no entry in the tekton-catalog webhook allowlist gets **no CI checks at all**. Its PRs show `mergeState=BLOCKED` with zero checks because a required check is configured that never reports. That is a CI gap, not a deploy gap — but it means no build exists to deploy.

## 5. Front-end verification endpoints

The served artifact is ground truth; a green build is not.

```sh
curl -s https://qc-game-portal-client-tf-b2c.dev.ae.games/assets/env.js | grep -oiE '"VERSION"[^,}]*'
```

`assets/env.js`, **not** `/env.js`.

## 6. The portal chain, evidenced

`/GlobalPipeline/qc/Deployed/game-portal-client`, 2026-08-12:

| Param version | Value | Time | Initiator |
|---|---|---|---|
| 1929 | **v2.436.2** | 16:50:54 | portal build |
| 1930 | v2.436.0 | 16:52:08 | *account-client* build |
| 1931 | v2.436.0 | 16:52:38 | *competition-client* build |
| 1932 | v2.436.0 | 16:52:53 | *AVBC-FE-WebClient* build |

The portal build reported SUCCEEDED and its log showed `put-parameter` succeeding. The revert happened afterwards. Deploy the portal **last**, then verify once everything has settled.

## 7. Cross-repo package changes

```sh
git show origin/master:package-lock.json | grep "avbc-packages-2\."   # the lockfile is the truth
npm install "@av-sym/avbc-packages@^<new>" --package-lock-only && npm ci
```

Verify the **installed artifact**, not the version string — grep the operation in `node_modules/@av-sym/avbc-packages/.../schema.graphql` and `mutations.js`. On a React repo also run `npx tsc --noEmit`, since a bump surfaces errors the entry-graph build never type-checks.

Evidenced 2026-09-10 on ENGR-6597: `AVBC-BE-GameEngine` and `AVBC-FE-WebClient` both merged work depending on `avbc-packages` 2.43.0 while their lockfiles pinned 2.42.0 / 2.41.1, with Tekton green on both.

Expect transitive churn — that bump moved 35 packages in AVBC-FE's lock (AWS SDK ranges). Compare major-version histograms before and after to prove nothing jumped a major.

## 8. Worked example — verifying an epic's tasks reached qc

```sh
for r in wowza-service competition-engine competition-client AVBC-BE-GameEngine AVBC-FE-WebClient; do
  v=$(aws ssm get-parameter --profile dev --region eu-west-2 \
        --name "/GlobalPipeline/qc/Deployed/$r" \
        --query 'Parameter.Value' --output text 2>&1 | tail -1)
  printf "%-22s %s\n" "$r" "$v"
done
```

Then map each ticket to its tag and compare:

```sh
sha=$(git log origin/main --grep="ENGR-6605" --format=%H -1)
git tag --contains "$sha" | sort -V | head -1
```

`ParameterNotFound` for `AVBC-Packages` is the expected answer for a package repo — judge it by its consumers' deployments instead.
