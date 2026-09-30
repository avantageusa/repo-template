---
name: figma-preflight-check
description: Audits a Figma frame or selection for code-readiness before extracting or generating code from it — checks node count/depth, layer naming, auto-layout usage, and variable-binding coverage against known failure patterns, then reports a go/no-go with concrete fixes. Use when a designer asks to check, audit, or preflight a Figma frame, asks "is this ready for code" or "can I build this yet", pastes a Figma link before any code-generation request, or before running figma-design-to-code / figma-generate-library on an unfamiliar or messy file.
---

# Figma preflight check

A cheap structural check that answers "will extracting this frame produce real code, or garbage?" — before spending a design-to-code pass on it. Based on lessons from a two-day Figma→code spike (ENGR-6403): a 4,910-node scratch frame with auto-named layers and no bound variables produced nothing usable, while the same content rebuilt with ~70 named, variable-bound nodes produced clean components on the first try.

`get_metadata`, `get_variable_defs`, and `get_screenshot` are plain read tools — call them directly, fully-qualified as `Figma:tool_name` (e.g. `Figma:get_metadata`), not the bare name. Don't call `Figma:get_design_context` yet — it's the expensive one, only useful once a frame passes this check, and if you do reach for it, load `figma-design-to-code` first (its actual mandatory prerequisite, not `figma-use` — that skill only gates the separate `use_figma` write tool, which this check never calls).

## Quick start

Designer gives a Figma link (copy from the frame/layer in Figma, paste it in). Most setups run Figma's *remote* MCP server, which is link-only — there's no "current selection" there. "Check my current selection" only works if you're specifically on the Figma desktop app's local MCP server; don't assume it's available, ask for a pasted link by default.

1. `Figma:get_metadata` on that node only — never a whole page. Structure only: node count, names, nesting depth.
2. Apply the stop-sign / green-light table below.
3. If it passes, `Figma:get_variable_defs` on the same node — but note this only returns variables actually bound, it says nothing about what *isn't*. To judge binding coverage, compare the count/variety it returns against what a `Figma:get_screenshot` of the same node visually shows (how many distinct colors are on screen vs. how many variables came back). A real gap between those two numbers is your signal — a full audit of exactly which fills are unbound needs `Figma:get_design_context` (via `figma-design-to-code`), which costs more, so reserve it for a frame that already looks promising.
4. Report the checklist as a scorecard, not a wall of text.

If output ever seems to ignore one of these checks, name the tool explicitly in the request (e.g. "call get_variable_defs and list what's actually bound") rather than a vaguer ask — Figma's own guidance is that naming the tool directly gets more reliable results than describing what you want indirectly.

## If something's missing, ask first — don't guess

- No frame, link, or selection given at all → ask which frame or component to check. Don't default to "whatever's currently open."
- If the report comes back with stop signs, don't unilaterally start fixing it — ask whether to hand off to `figma-guided-build` now, or stop at the report.

The thresholds below ("thousands of nodes," "tens to a few hundred") are heuristics from our own spike, not an official Figma rule — treat them as a rule of thumb, not a hard cutoff.

## Stop signs (fail fast, say so plainly)

- Thousands of nodes in one frame, or coordinate span in the tens of thousands of px
- Almost no component instances relative to node count
- Auto-names everywhere: `Group 2611`, `Frame 12`, `Rectangle 47`
- Multiple full screen/layout variants side by side in one frame

If any of these show up, tell the designer directly: this is a file-structure problem, not something a better prompt fixes. Point at `figma-guided-build` to rebuild it properly instead of extracting as-is.

## Green lights

- Tens to a few hundred nodes
- Real instances of real components (not raw shapes repeated)
- Names recognizable from the codebase or named by role

## Pre-flight checklist (report every item, ✅/❌/⚠️ with evidence)

1. Every repeated element is one component with instances — not hand-duplicated copies
2. Auto-layout on every frame, including the outermost one
3. Children set to fill rather than sitting at fixed widths
4. Every fill, stroke, and text color bound to a variable — flag any raw hex, *especially* one that happens to match an existing variable's value (that's a token that should have been bound, not a coincidence)
5. Labels/text that vary per instance exposed as a real top-level TEXT property (not baked into the layer)
6. Layers named by role (`Level Card`, `Price Button`) — zero auto-names left
7. Spacing from padding/gap, not blank lines or pressed-Enter spacing
8. One screen per frame, and the copy proofread

## Naming the fixes, not just the problem

For every ❌, give the specific action: which layer to rename to what, which fill to bind to which variable, which frame needs auto-layout turned on. A designer should be able to act on the report without knowing what `get_metadata` or "auto-layout" means as MCP concepts — just what to click.

## When it passes

Say so plainly and hand off: "This is ready — proceed with `figma-design-to-code`" (or the specific stack requested). Don't re-run checks that already passed.
