---
name: install-skills
description: >
  Fetch and install all community skills listed in skills.yml into .claude/skills/.
  Run after npm install @av-neo/av-ai-infra or any time you want to refresh community skills from source.
  Trigger: /install-skills, "install skills", "fetch skills", "update community skills".
---

Read `skills.yml` from the project root.

For each skill in the `community` section:
1. Create directory `.claude/skills/<name>/`
2. WebFetch `source` URL → write content to `.claude/skills/<name>/SKILL.md`
3. For each URL in the `files` list (if present):
   - WebFetch the URL
   - Extract the filename from the last path segment of the URL
   - Write to `.claude/skills/<name>/<filename>`

If a fetch returns an error or non-200 status, log `✗ <name>: <status> <url>` and continue — do not abort.

After all fetches complete, print a summary:
- ✓ <name> — for each skill installed successfully
- ✗ <name>: <reason> — for each failure

Org skills (`plan`, `pr-review`, `code-review-save`, `jira-triage`) are installed by `postinstall` — skip them.
