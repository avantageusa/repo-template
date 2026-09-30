# av-ai-infra guide

Shared npm package that centralises Claude Code config — rules, skills, and doc templates — so every AV project inherits the same AI setup automatically.

---

## Package structure

```
av-ai-infra/
├── bin/sync.js          # postinstall: copies files into the consuming project
├── claude/
│   ├── CLAUDE.md        # Root instructions for Claude Code
│   └── rules/
│       └── coding-standards.md
├── skills/              # Org skills (one folder per skill, each has SKILL.md)
│   ├── plan/
│   ├── pr-review/
│   ├── code-review-save/
│   └── install-skills/
├── docs/                # Doc templates (created once in consumer, then skipped)
└── skills.yml           # Community skill registry (URLs fetched on demand)
```

---

## How it works

1. Consumer project runs `npm install --save-dev @av-neo/av-ai-infra`
2. `postinstall` runs `bin/sync.js`, which writes to the consumer project:
   - `claude/rules/` → `.claude/rules/` (overwritten every sync)
   - `skills/` → `.claude/skills/` (overwritten every sync)
   - `skills.yml` → project root (overwritten every sync)
   - `docs/` → `docs/knowledge/` (created once, then skipped)
   - `CLAUDE.md` → project root (marker split: everything above "## Project-specific overrides" overwritten every sync, everything below preserved verbatim)
3. Claude Code picks up rules and skills on next launch
4. Developer runs `/install-skills` once to fetch community skills from `skills.yml` into `.claude/skills/`

---

## What a consumer project looks like after install

```
my-project/
├── CLAUDE.md
├── skills.yml
├── .claude/
│   ├── rules/
│   │   └── coding-standards.md     # from package
│   └── skills/
│       ├── plan/                   # org — postinstall
│       ├── pr-review/              # org — postinstall
│       ├── code-review-save/       # org — postinstall
│       ├── install-skills/         # org — postinstall
│       ├── caveman/                # community — /install-skills
│       ├── tdd/                    # community — /install-skills
│       ├── diagnose/               # community — /install-skills
│       └── ...
├── .cursor/
│   └── rules/
│       └── coding-standards.mdc   # from package (rules synced as .mdc for Cursor)
└── docs/
    └── knowledge/
        ├── ARCHITECTURE.md
        ├── BUGS.md
        └── GOTCHAS.md
```

---

## Adding or updating a skill

1. Add or edit `skills/<name>/SKILL.md` in this repo
2. Bump the package version and publish
3. Consumer projects pick up the change on next `npm install`

For community skills, update `skills.yml` with the new source URL. Consumer developers re-run `/install-skills` to pull the latest.

---

## Project-level overrides

After sync, projects can extend `CLAUDE.md`:

```markdown
@.claude/rules/coding-standards.md

## Project overrides

- Uses Redux instead of Zustand — ignore Zustand rules above
```

A skill in `.claude/skills/<name>/` placed directly in the project takes precedence over the synced one.

---

## Developing this package

See the "Developing this package" section in [README.md](../../README.md) — `postinstall` skips self-install, so `.claude/skills/` needs to be bootstrapped manually when working in this repo.

---

## Publishing

```bash
npm publish --access restricted
```

Registry: `https://avantage.jfrog.io/artifactory/api/npm/baccarat-npm-int/`

Versioning:

- Breaking changes (removed/renamed skills, restructured rules) → major
- New skills → minor
- Rule fixes → patch
