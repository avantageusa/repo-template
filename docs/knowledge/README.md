# Knowledge

Living docs for humans onboarding *and* AI context. Anything you find yourself explaining to AI more than twice belongs in here.

## What goes here

- `ARCHITECTURE.md` — overview of the system: components, data flow, key invariants
- `GOTCHAS.md` — non-obvious traps, common bugs, "things that look weird but are correct"
- Decision records — short notes on choices that took real thought (one file per decision)
- Domain glossaries, key invariants, performance characteristics, anything an AI assistant would benefit from reading before touching the code

## Format

- Short headed sections — chunkable for AI context windows
- Concrete examples over abstract description
- Tables where they help (key enums, file locations, command reference)
- No marketing prose — every claim should be specific enough that an AI can act on it

## Living docs

These are not write-once. When a constraint changes or a gotcha goes away, update the doc. Stale knowledge docs are worse than no knowledge docs because they actively mislead.
