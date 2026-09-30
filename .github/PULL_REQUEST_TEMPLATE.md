<!--
Title format (same as commit format): <type>: [JIRA-ID] <description>
  - <type> is strictly feat or fix
  - Example: feat: [ENGR-5016] add git workflow rules and enforcement hooks
Squash merges inherit the PR title, so it must conform.
-->

**Ticket:** https://[org].atlassian.net/browse/JIRA-ID
**Plan:** docs/plans/YYYY-MM-DD-slug.plan.md

## Summary

<!--
What was done and why, for a reviewer who hasn't read the ticket.
Bullet the substantive changes — one bullet per meaningful change, not per file.
-->

## Alternatives considered

<!--
Optional — include when real decisions were made. One line each: what was
considered and why it wasn't picked. Usually carries over from the plan file.
-->

## Blast radius

<!--
What this touches. What could break that isn't obvious from the diff —
downstream consumers, migrations, config, behavior changes on existing data.
-->

## Test plan

<!-- Check off only what actually ran. Unverified paths get called out, not checked. -->

- [ ] Relevant tests for the touched areas
- [ ] Lint on modified files
- [ ] Happy path exercised manually
- [ ] Obvious failure path exercised manually
