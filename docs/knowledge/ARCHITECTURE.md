# Architecture

This repository is a GitHub template — not a running service. Its sole purpose is to seed new repositories in the Avantage GitHub org (`avantageusa`) with a consistent set of AI-agent instructions, coding standards, Dependabot configuration, and documentation scaffolding. Developers click "Use this template" in GitHub, or the parent-directory bootstrap scripts (`add-ai-rules.sh`, `seed-knowledge-docs.sh`) clone and push it programmatically. There is no source code, no runtime, no build system, and no tests.

## Major Components

**Coding standards** (`.cursor/rules/coding-standards.mdc`) is the canonical rule file consumed by both Cursor (via MDC) and Claude Code (via the `@` import in `CLAUDE.md`). It defines reliability rules, SOLID principles, React and TypeScript conventions, a rigorous testing policy (mutation testing as the quality gate via `npm run stryker`), and the format for AI-drafted plans and code-review artifacts.

**AI agent entry points** (`CLAUDE.md`, `AGENTS.md`) are the files that Claude Code and Codex-class agents read automatically on startup. Both redirect agents to `.cursor/rules/coding-standards.mdc`. `CLAUDE.md` uses the `@` import syntax to inline the MDC file into Claude Code's context; `AGENTS.md` gives an explicit natural-language instruction to read it before doing any work.

**Dependabot configuration** (`.github/dependabot.yml`) enables weekly npm dependency updates (minor and patch only, grouped by `prod-non-urgent` / `dev-non-urgent`), scheduled Monday at 04:00 UTC. The file header notes it is also the default source for `configure-dependabot.py` and `create-github-template.py` in the parent workspace.

**Documentation scaffolding** (`docs/plans/`, `docs/code-reviews/`, `docs/knowledge/`) creates the directory contract that downstream coding standards reference. Each directory contains a `README.md` explaining naming conventions, frontmatter requirements, and workflow. No actual plans, reviews, or knowledge docs live here — those are generated per-repo after bootstrapping.

## Key File Locations

| Path | Purpose |
|------|---------|
| `.cursor/rules/coding-standards.mdc` | Canonical coding standards for humans and AI agents |
| `CLAUDE.md` | Claude Code entry point; imports coding-standards.mdc via `@` |
| `AGENTS.md` | Codex / generic agent entry point; plain-English redirect to standards |
| `.github/dependabot.yml` | Shared Dependabot config (npm, weekly, minor+patch) |
| `README.md` | Human-facing template usage instructions |
| `docs/plans/README.md` | Plan format contract (YAML frontmatter + markdown body) |
| `docs/code-reviews/README.md` | Review artifact format (agent/model provenance frontmatter) |
| `docs/knowledge/README.md` | Knowledge doc conventions (ARCHITECTURE.md, GOTCHAS.md, decisions) |

## Data Flow / Lifecycle

There is no request/data flow — this is a static template. The lifecycle is:

1. New repo created via GitHub "Use this template" or bootstrap scripts in the parent workspace.
2. Files are copied verbatim into the new repo.
3. Claude Code reads `CLAUDE.md` on session start → imports `.cursor/rules/coding-standards.mdc`.
4. Cursor reads `.cursor/rules/coding-standards.mdc` directly via MDC loader.
5. Codex-class agents read `AGENTS.md` → follow redirect to standards file.
6. Dependabot reads `.github/dependabot.yml` and opens weekly update PRs.
7. Humans and agents write plans to `docs/plans/`, reviews to `docs/code-reviews/`, and knowledge docs to `docs/knowledge/` as the repo accumulates work.

## Domain Objects

The only structured data format defined here is the plan document frontmatter (from `coding-standards.mdc`): a YAML block with `name` (string), `overview` (string), and `todos` array where each entry has `id`, `content`, and `status` (`pending` | `in-progress` | `completed` | `blocked`). Code-review artifacts require `agent` and `model` frontmatter fields.

---

*This file was AI-drafted as a starting point. Refine, correct, and expand — the goal is a living document, not a one-shot deliverable.*

