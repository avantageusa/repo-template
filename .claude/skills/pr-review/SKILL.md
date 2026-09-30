---
name: pr-review
description: >
  Review a pull request or diff against the team's coding standards.
  Use when the user asks to review a PR, diff, or set of changes — even if
  they just say "review this" or "look at my changes". Output findings
  grouped by severity: blocker, warning, nit.
---

# PR Review

Review changed code against the team's coding standards. Read `.claude/rules/coding-standards.md` for the full ruleset before reviewing.

## Process

1. Read the entire diff before commenting on anything
2. Group findings by severity: **blocker** (must fix before merge), **warning** (should fix), **nit** (optional)
3. For each finding: state the location, the problem, and the concrete fix

## Checklist

**Reliability**
- [ ] No broad refactors mixed into a targeted change
- [ ] Existing runtime behavior preserved unless task explicitly requires change
- [ ] No removed logging or error handling without equivalent replacement
- [ ] No new dependencies without prior approval

**SOLID**
- [ ] Single responsibility — no module doing multiple jobs
- [ ] Extension used where modification of existing paths could be avoided
- [ ] No broken parent contracts in subtype overrides

**Clarity**
- [ ] No nested ternaries
- [ ] No tuple returns from functions (named objects used instead)
- [ ] No magic numbers or strings (constants named)
- [ ] No pyramid indentation (early returns used)
- [ ] Comments explain why, not what

**Functions**
- [ ] Functions fit on one screen
- [ ] More than 3–4 params → options object used
- [ ] No parameter mutation

**React**
- [ ] Function components only (no class components)
- [ ] Hooks only at top level — not inside conditions, loops, or after early returns
- [ ] Effect dependency arrays honest (no suppressed lint warnings)
- [ ] State not pre-emptively lifted to global store
- [ ] No derived state stored as state

**TypeScript**
- [ ] No `any` (or commented with justification + future fix)
- [ ] No type assertions silencing the compiler
- [ ] Discriminated unions used for state modeling

**Testing**
- [ ] External dependencies mocked
- [ ] Happy path, edge cases, and error paths covered
- [ ] `toEqual` used — not `toMatchObject`, `toContain`, or partial matchers
- [ ] Both return values AND side effects asserted in mock-heavy tests
- [ ] Tests are deterministic (no real time, randomness, live network)

**Plans / artifacts**
- [ ] New plan files have correct frontmatter schema (`name`, `overview`, `todos[]`)
- [ ] Code review artifacts include `agent` and `model` frontmatter

## Output format

```
## Blockers
- `src/foo.tsx:42` — nested ternary in render path. Extract to a named variable or early return.

## Warnings
- `src/bar.ts:17` — `any` with no comment. Narrow the type or document why it can't be typed.

## Nits
- `src/baz.ts:88` — single-letter variable `x`. Rename to `index` or `offset`.

## Summary
One paragraph: overall assessment, biggest risks, recommended action (merge / revise / reject).
```
