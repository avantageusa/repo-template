---
name: code-review-save
description: >
  Save a completed code review as a structured artifact to docs/code-reviews/.
  Use after finishing a review when the user wants to persist it, or when the
  review covers a high-risk change that should be traceable. Triggers on
  "save this review", "persist the review", or "write the review to docs".
---

# Code Review Save

Save the current review as a traceable artifact to `docs/code-reviews/`.

## Output location

`docs/code-reviews/YYYY-MM-DD-<subject>-<agent-slug>-review.md`

- `YYYY-MM-DD` — today's date
- `<subject>` — kebab-case description of what was reviewed (e.g. `checkout-flow`, `auth-middleware-refactor`)
- `<agent-slug>` — the tool doing the review (e.g. `claude-code`, `cursor`, `cline`)

## Required format

```markdown
---
agent: <tool — e.g. Claude Code, Cursor, Cline>
model: <model id — e.g. claude-sonnet-4-6, gpt-4o>
subject: <what was reviewed>
date: YYYY-MM-DD
---

# Code Review: <subject>

## Blockers
...

## Warnings
...

## Nits
...

## Summary
One paragraph: overall assessment, biggest risks, recommended action (merge / revise / reject).
```

## Rules

- `agent` and `model` frontmatter are **required** — they enable multi-agent review traceability
- If the model ID isn't known exactly, use the closest identifier available — do not omit the field
- For high-risk merges, save each independent agent's review separately; reconcile findings into a remediation plan before acting on any of them
- Do not merge review artifacts from different agents into a single file
