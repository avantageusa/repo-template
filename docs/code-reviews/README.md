# Code reviews

AI-generated review artifacts with provenance.

## When to drop a review here

- Pre-merge review of a substantial change
- Post-incident review of what went wrong
- Multi-agent review of a high-risk merge — different agents catch different things; reconcile findings into a remediation plan in `docs/plans/`

## Naming

`YYYY-MM-DD-<subject-kebab-case>-<agent-slug>-review.md`

The `<agent-slug>` is the tool that produced the review (e.g. `cursor`, `claude-code`, `cline`). The date is the reviewer's local calendar date.

## Frontmatter (required)

```yaml
---
agent: <Cursor | Claude Code | Cline | etc.>
model: <model id, e.g. opus-4-7-20251101>
---
```

## Multi-agent reviews

For high-risk merges, run independent reviews from multiple tools and reconcile the findings into a single remediation plan. Different agents catch different things, and the reconciliation forces a level of rigor that no single review delivers.
