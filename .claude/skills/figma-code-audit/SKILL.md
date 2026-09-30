---
name: figma-code-audit
description: Scans already-generated frontend code for Figma-to-code anti-patterns — raw hex colors that duplicate a known design token, absolute positioning standing in for layout, near-duplicate components that should be one component with instances/props, and empty spacer tags. Use when a designer or dev wants to check generated code for design-token drift, verify a Figma export before merging, or asks to audit, review, or lint code that came out of Figma.
---

# Figma code audit

Closes the loop on `figma-guided-build` / `figma-design-to-code`: reads the *output* code for the same four failure signatures the ENGR-6403 spike found by hand (unbound raw hex, hardcoded positioning, hand-duplicated components, blank-line spacing). These are deterministic pattern checks, so a script does them — not a model re-reading every file.

## Quick start

```bash
node .claude/skills/figma-code-audit/scripts/audit-code.mjs src
```

Pass `--json` for machine-readable output. Defaults to `src` if no path is given — say so out loud ("I'll scan `src/`") and offer to narrow it, rather than silently scanning the whole codebase when the designer meant one screen. The script auto-discovers any `tokens.ts`/`tokens.js` file under the scanned path and treats its `key: '#hex'` pairs as the known token set — everything else is checked against that set.

## What it checks

| Category | Signal |
|---|---|
| `unbound-token` (high) | A raw hex literal exactly matches a value already defined in the token file — it should be a variable reference, not a coincidence. |
| `raw-hex` (low) | A raw hex literal with no matching token — confirm it's intentional (one-off) or promote it to a named variable. |
| `absolute-position` | `position: absolute` used with no flex/grid in the file. Severity depends on context — see below. |
| `possible-duplicate` (high) | Two sibling files in the same directory have near-identical JSX tag structure — the "four sibling frames → four ~20-line duplicated blocks" pattern. Should be one component with instances/props. |
| `empty-spacer` (medium) | `<p></p>`, `<div></div>`, or stacked `<br/>`s — spacing that should come from padding/gap. |

## Reading the absolute-position findings — this one needs judgment

The script can't fully tell "hardcoded layout that won't reflow" from "a legitimate small composition." It uses this tiering, but always sanity-check before treating it as a confirmed bug:

- **high** — at least one `position: absolute` sits inside a `.map()` over repeated items: a strong sign of a hand-positioned list/grid. Still verify — a `.map()`-generated icon built from percentage-based offsets that scale with a size prop is a real example that trips this and is actually fine.
- **medium** — absolute positioning with no flex/grid anywhere in the file, not inside a `.map()`. Could be a genuine unreflowing layout, or could be a normal decorative composition (an icon drawn from stacked shapes, a progress-bar fill over its track, a badge floated over a background image) — all legitimate uses of absolute positioning that this check cannot distinguish from a real bug.
- **info** — absolute positioning alongside flex/grid elsewhere in the file: almost always an intentional overlay.

## Fixing what it finds

- `unbound-token` / `raw-hex`: bind the color to the existing variable, or — if genuinely new — go back to `figma-guided-build`'s "variables first" step rather than hand-editing the token file.
- `possible-duplicate`: the fix is in Figma, not in code — one component with an exposed property, instanced N times (see `figma-guided-build`). Re-generating the code after that fix is what actually resolves it.
- `absolute-position` (real ones) / `empty-spacer`: same — these come from the source frame missing auto-layout or using pressed-Enter spacing. Fix the frame, regenerate.

Run `figma-preflight-check` on the source frame before spending another generation pass on any file this flags as high-confidence broken.

## Known limitations, not just the absolute-position one

- **Hex detection** matches inside comments and unrelated strings too (a code comment that mentions a hex value for reference will show up as a "finding") — it isn't scoped to style props specifically.
- **Duplicate detection** only compares files within the *same directory*, and only ones with a default export — a duplicate split across two folders (e.g. a "detailed" variant living in a sibling directory) won't be caught. That's deliberate: this repo genuinely has different screen variants in sibling folders that are supposed to differ, not accidental copies, and same-directory scoping avoids flagging those.
- **The `.map()` proximity check** for absolute positioning only looks ~200 characters back from the match — a repeated-item pattern with a lot of JSX/props in between the `.map(` and the actual offending element can be missed and under-reported as medium/info instead of high.
