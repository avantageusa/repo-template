# Plans

AI-drafted plan documents for substantive PRs.

## When a plan is required

Every non-trivial PR. Length-scaled — a typo fix gets three lines of frontmatter and a paragraph; a feature gets a real plan with alternatives considered. For work estimated above ~3 days, multi-directory, or tagged `needs-plan` in Jira, the plan ships in its own PR before any code is written.

## Naming

`YYYY-MM-DD-<slug>.plan.md`

## Format

YAML frontmatter with `name`, `overview`, and a `todos` array (each todo has `id`, `content`, `status`), followed by markdown body sections (Problem, Reproduction, Approach, Alternatives, Blast radius, Notes). The full template lives in this repo's coding-standards rules file (`.cursor/rules/coding-standards.mdc` / `CLAUDE.md` / `AGENTS.md`).

## Workflow

1. Dev provides inputs to AI — at minimum the Jira ticket, often a Q&A or multi-turn refinement.
2. AI produces the plan in the standard format.
3. Dev reviews, edits, commits.
4. Don't delete plans for shipped work — they're institutional memory the next dev (and the next agent) reads first.

## Statuses

`pending` · `in-progress` · `completed` · `blocked`. Update inline as work proceeds; the plan is a living checklist during execution.
