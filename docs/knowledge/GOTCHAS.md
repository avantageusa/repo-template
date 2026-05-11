# Gotchas

### `CLAUDE.md` silently breaks if coding-standards.mdc moves

The `@.cursor/rules/coding-standards.mdc` import in `CLAUDE.md` is a path-relative reference. If the MDC file is renamed or relocated, Claude Code silently loses the entire standards document with no error — it just stops reading the rules.

**Why this exists:** Claude Code's `@` import syntax resolves paths relative to the CLAUDE.md location at session start. There is no validation or missing-file warning in the current harness.

---

### `dependabot.yml` is a shared source for two external scripts — edit here, not there

The file header explicitly states it is the default for `configure-dependabot.py` and `create-github-template.py` in the parent workspace (`/Users/steve/Syzygistic/projects/Avantage/code/`). Editing the copy in a downstream repo or in those scripts instead of this template will cause divergence.

**Why this exists:** Bootstrap scripts pull this file as a default when `--yml-file` is not supplied. The comment is the only enforcement.

---

### Mutation testing (`npm run stryker`) is mandated but not wired up here

`coding-standards.mdc` declares: "Mutation testing is the quality gate; run `npm run stryker` before completion." This template repo has no `package.json`, no Stryker config, and no CI pipeline. Downstream repos that copy the standards file inherit the mandate without the tooling. A dev following the standards in a repo that never had Stryker configured will either skip the gate silently or hit a missing-script error.

**Why this exists:** The template seeds process and conventions; per-repo tooling setup is a separate step not covered by this template.

---

### Plan frontmatter schema is a convention, not enforced by tooling

Plans in `docs/plans/` require YAML frontmatter with specific fields (`name`, `overview`, `todos[]` with `id`/`content`/`status`). Nothing validates this — no schema file, no CI lint, no pre-commit hook. AI agents producing plans with missing or wrong frontmatter will silently diverge from the contract, breaking any tooling that later parses the frontmatter.

**Why this exists:** The format is documented in `coding-standards.mdc` and `docs/plans/README.md` but relies entirely on humans and agents reading and following it voluntarily.

---

### Code-review artifacts require `agent` and `model` frontmatter — no fallback defined

`docs/code-reviews/README.md` specifies required frontmatter (`agent`, `model`). No default values are defined for cases where the reviewing tool doesn't expose its model ID (e.g., anonymous API calls, proxied tools). An artifact without this provenance defeats the stated purpose of multi-agent review traceability.

**Why this exists:** The format is aspirational — no tooling enforces it at write time.

---

### Stale knowledge docs described as "actively misleading" — no staleness detection exists

`docs/knowledge/README.md` explicitly warns: "Stale knowledge docs are worse than no knowledge docs because they actively mislead." There is no mechanism — no CI check, no last-updated frontmatter, no review cadence — to detect or flag stale content. Future `ARCHITECTURE.md` and `GOTCHAS.md` files written by `seed-knowledge-docs.sh` will drift silently.

**Why this exists:** The warning is correct but purely aspirational; enforcement is left to human discipline.

---

### `dependabot.yml` only covers npm — major version bumps are excluded

The config uses `update-types: ["minor", "patch"]` only. Major version upgrades (breaking changes) are silently excluded and will never receive Dependabot PRs. Teams expecting full coverage will miss major updates until they check manually.

**Why this exists:** Intentional — major bumps require human judgment. But it's non-obvious if you assume Dependabot covers all updates.

---

### Template has no CI pipeline — downstream repos do not inherit one

No `.github/workflows/` directory exists. Repos created from this template get Dependabot and standards docs but no CI. Any CI setup (lint, test, build) must be added separately per-repo. This is easy to miss when the template otherwise looks "complete."

**Why this exists:** CI is highly project-specific; a generic pipeline would be wrong for most repos. But the absence is not documented in the README.

---

*This file was AI-drafted as a starting point. Refine, correct, and expand. Add new traps as they bite — that's the compounding loop.*

