---
name: figma-jira-spec
description: Generates a design spec (composition summary, token table, acceptance criteria) from a Figma frame and posts it to a Jira ticket, so QA/PM/dev get design-derived acceptance criteria instead of writing them from scratch or eyeballing the design. Use when a designer wants to write a Figma frame's spec into Jira, attach acceptance criteria to a ticket from a design, or asks to document a screen for a ticket.
---

# Figma → Jira spec

The same read that produces code can produce a ticket. Turns one Figma frame into a spec that QA can check acceptance criteria against, PM can use as a drafting base, and dev can use to seed render tests — generated from the actual frame, not written by hand afterward.

## Quick start

Needs two things from the designer: a Figma frame (link or node ID) and a Jira issue key to write to. Never guess the issue key — ask if it isn't given.

1. Load `figma-design-to-code` — its own mandatory prerequisite — before calling `Figma:get_design_context`; `Figma:get_variable_defs` doesn't need it. Use the fully-qualified `Figma:tool_name` form for every Figma MCP call, not the bare name. Run `figma-preflight-check` first if the frame hasn't already been validated — a messy frame produces a messy spec.
2. Load the Jira/Atlassian tools: `ToolSearch` with a query like `"jira issue comment edit"` to find the deferred tools for reading and updating an issue (e.g. get the issue, add a comment, edit the description) — don't hardcode a specific tool name, the exact tool set is environment-dependent.
3. `getJiraIssue`-equivalent first, to confirm the ticket exists and see its current description/format before writing anything.
4. Load `avantage-jira-reference` for the house ticket-body layout — acceptance criteria belong in the green panel, QA scenarios in the blue one — and `write-requirements` for how a criterion is worded (data source named, non-happy path, Module/Critical tags).

## Spec format

```
## Composition
[Plain-language structure of the frame: what contains what, in reading order —
not a node-id dump.]

## Tokens
| Role | Variable | Value |
|---|---|---|
| ... | ... | ... |
[Only variables actually bound in this frame — from get_variable_defs, not
every variable in the library.]

## Acceptance criteria
- [ ] Layout holds at [breakpoints stated by the designer, or ask]
- [ ] Every color in the checklist above renders via its token, not a raw value
- [ ] [One criterion per distinct interactive/stateful element in the frame]
```

## Ask first — don't guess

- Never guess the issue key or which frame — ask for both if either is missing.
- Ask whether target viewports/devices matter for the acceptance criteria if the designer hasn't said; don't invent breakpoint numbers.
- Ask comment vs. replace-description before writing (default to comment) — don't silently overwrite an existing ticket description.

## Posting it

- Show the drafted spec to the designer before posting — this is a "send a message on the user's behalf" action and needs explicit confirmation, same as any other Jira write.
- State the ticket key and a one-line summary of what's being posted when asking for confirmation.

## Known limitation

Diffing an already-shipped screen against its design for drift is not part of this skill — it only generates a spec at a point in time, it doesn't compare current code back to the frame. Use `figma-code-audit` for a code-side check instead.
