---
name: plan
description: >
  Generate an AI-assisted plan document in the team's standard format.
  Use when the user asks to plan a feature, fix, or refactor — even if they
  just say "plan this", "let's think through the approach", or "write a plan".
  Always output to docs/plans/YYYY-MM-DD-<slug>.plan.md.
---

# Plan Generator

Generate a plan file following the team's coding-standards format.

## Output location

`docs/plans/YYYY-MM-DD-<slug>.plan.md` — use today's date and a kebab-case slug derived from the task description.

## Required format

```markdown
---
name: <short title — what we're building or fixing>
overview: >
  2-4 sentence summary: what's the problem, what's the approach,
  what's explicitly out of scope. Tight prose, no marketing language.
todos:
  - id: <kebab-case-slug>
    content: <one concrete action — small enough to ship, large enough to matter>
    status: pending
  - id: verify
    content: Run tests, lint, and CI gate before merge
    status: pending
---

# [JIRA-ID] Short title

**Ticket:** https://avantageusa.atlassian.net/browse/JIRA-ID
**Drafted by:** <agent and model — e.g. Claude (claude-sonnet-4-6)>

## Problem
1–3 sentences. What's broken or what are we building, and for whom.

## Reproduction (bugs only)
Minimal repro steps. If the dev couldn't reproduce, say so explicitly.

## Approach
How we plan to fix it or build it. Reference specific files / functions / modules where useful.

## Alternatives considered
What else was considered, and why those weren't picked. One line each is fine.

## Blast radius
What this touches. What could break that isn't obvious from the diff.

## Notes
Open questions, follow-ups, links to related plans.
```

## Rules

- Ask for the Jira ticket ID before writing the plan if not provided
- `todos` is a structured handoff — statuses must be kept current during execution: `pending` | `in-progress` | `completed` | `blocked`
- Scale the plan to the work: a typo fix gets three lines of frontmatter and a paragraph; a feature gets a full plan with alternatives and blast radius
- `overview` is tight prose — no bullet points, no marketing language
- If no Jira ticket exists, omit the ticket line entirely
