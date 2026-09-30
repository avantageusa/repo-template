---
name: figma-guided-build
description: Builds or rebuilds a Figma screen/component in the correct order — variables first, one atomic auto-layout component with an exposed text property, composed upward via instances, assembled with auto-layout and fill-sized children — from a plain-language description, so a designer never writes the underlying technical prompt themselves. Use when a designer wants to build, create, rebuild, or fix up a screen or component in Figma from a description ("make me a pricing card with 4 tiers", "turn this into real components"), or after figma-preflight-check reports a file isn't code-ready.
---

# Figma guided build

Translates a plain-language design request into the file structure that actually produces good code, by always building in the same order — regardless of how the designer phrases the ask. Skipping this order is what turns "four pricing cards" into four ~20-line duplicated JSX blocks instead of one component called four times.

Load `figma-use` and `figma-generate-library` first (both are mandatory prerequisites for `use_figma` calls and for variable/component-library work). Refer to Figma MCP tools by their fully-qualified `Figma:tool_name` form throughout (e.g. `Figma:use_figma`, `Figma:get_variable_defs`), not the bare name.

One-time setup worth doing on a new repo: Figma exposes `create_design_system_rules` as an MCP *prompt*, not a callable tool — it likely surfaces as a slash command in whatever client is connected, not something to invoke mid-conversation the way a tool call works. If it's available, running it once to generate a rules file capturing this codebase's actual variable/component conventions is worth doing — every step below benefits from it existing — but don't assume the exact invocation without checking what the client exposes.

## Ask before building — don't infer the load-bearing details silently

A designer describing a screen in plain language has no reason to know that "does this repeat?" or "does it need to look different on phone?" are the exact questions that decide whether the output is one clean component or a pile of duplicated markup. Ask them plainly, don't guess and don't wait for a bad result to reveal the gap:

- **Scope:** "Is this a whole screen, or one reusable piece — like a single card or button?" This decides whether step 4 below (assembling a screen from instances) even applies, or whether the atomic component in step 2 is the whole deliverable.
- **Repeats:** "Does anything repeat here — like several cards, buttons, or rows that are basically the same but with different text or color?" → each repeat becomes one component with instances, never copies.
- **Varying text:** "Is any of the text something that changes depending on where this is used (a price, a name, a label), or is it always the same?" → varying text becomes an exposed TEXT property, not a baked-in layer.
- **Colors/style:** "Should this reuse colors and styles already in the file, or are there new ones involved that aren't in the library yet?" → check the existing variable collection via `figma-generate-library` first; only create what's genuinely missing, with correct scopes.
- **Responsive behavior:** "Does this need to look different on phone vs. tablet vs. desktop — and if so, what should actually change (stack vertically, hide something, rearrange), not just shrink?" Don't silently pick breakpoints if this isn't answered.

State assumptions you *did* infer out loud instead of asking, so it's easy to correct: e.g. "I'll build this as React + MUI to match the rest of the repo — say if that's wrong" (read from `package.json`/`figma.config.json` rather than asking).

## Build in this order — never skip ahead

1. **Variables first.** Confirm or create a small collection with correct scopes. Everything downstream binds to these — nothing gets a raw hex.
2. **One atomic component.** Auto-layout on, every fill/stroke/text bound to a variable, the varying label exposed as a real TEXT property at the component's top level (so it becomes a prop later).
3. **Compose upward.** Build any larger grouping from *instances* of that component — never copy/paste the layer.
4. **Assemble the screen.** Instances placed in an auto-layout frame (the outer frame too), children set to fill rather than fixed width. This is what stops a grid silently collapsing to one column at a slightly narrow width.
5. **Then generate code** — load `figma-design-to-code` (its own mandatory prerequisite before calling `Figma:get_design_context`) and hand off, auto-assembling the prompt so the designer never has to write it:
   - Point at the one node/selection just built, not a page
   - Name the target stack (read from the repo — e.g. React + MUI, existing breakpoint scale)
   - State explicitly: use bound variables for every color, never raw hex
   - Give layout as a rule ("two per row, each filling 50%"), not pixel measurements
   - Say to measure proportions from the node, not estimate them
   - State the target viewports up front

If the generated code ignores one of these constraints, don't just rephrase — name the specific tool to call (e.g. "call get_variable_defs on this node first, then use only those names"). Being that explicit is more reliable than a softer restatement.

## After code exists

Hand off to `figma-code-audit` to close the loop — verify the generated code actually reflects what was just built (no raw hex, no duplicated blocks, no absolute positioning standing in for layout).

If this component should be Code Connect-mapped, ask before publishing the mapping or touching any CI config — publishing changes what Figma points designers at, and CI changes are hard to reverse and visible to the rest of the team, so neither should happen without confirmation. If approved, wiring `npx figma connect publish --exit-on-unreadable-files` into CI (on merge to main) is more reliable than relying on someone remembering to manually republish — Figma does not auto-detect repo changes.

## If the file was already messy

Run `figma-preflight-check` first if it hasn't already flagged specific problems — fix only what's flagged rather than rebuilding everything from scratch.
