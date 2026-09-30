---
description: Git workflow conventions — branch naming, commit message format, and git safety rules. Read before any git operation (branch creation, staging, committing, pushing).
alwaysApply: false
---

# Git Workflow

These conventions apply to every git operation AI performs in this repo. The
mechanically-checkable subset (branch names, commit message format, force-push) is
enforced by `enforce-git-workflow.js` — a `PreToolUse` hook wired to `Bash` — but the
rules below are the full spec; read them before any git action even where the hook
would let something through (e.g. it can't check whether a commit is scoped correctly).

## Git safety

- **Never take a git action unless explicitly requested.** Don't `git add`, `git commit`,
  or `git push` as a side effect of finishing a task unless the user asked for it in this
  turn. A user approving a git action once does not imply standing approval for future
  turns.
- **Never force-push.** Not `--force`, not `-f`, not `--force-with-lease`. If history
  needs to change on a shared branch, stop and ask the dev how they want to handle it.
- **Verify the branch before committing.** Run `git status` / `git branch --show-current`
  first. Never assume you're still on the branch you started the session on.
- **Show the planned commit message before committing.** State the branch you're on and
  the exact commit message you're about to use, so the dev can stop you before it lands.
- **Keep the branch up to date with main** before opening a PR — rebase or merge main in,
  don't let a long-lived branch drift silently.
- **No unrelated files in a commit.** Stage only what the current task touched. Don't
  `git add -A` or `git add .` — name files explicitly. If `git status` shows unexpected
  changes, investigate before staging; it may be another in-progress edit, not yours to
  bundle in.

## Branch naming

Format: `<type>/<JIRA-ID>-<snake_case-description>`

- `<type>` is strictly `feat` or `fix` — no other type is valid for a branch prefix.
- `<JIRA-ID>` is the uppercase ticket key, e.g. `ENGR-5016`.
- `<snake_case-description>` is a short, lowercase, underscore-separated summary.

Examples:

- `feat/ENGR-5016-git_workflow_rules`
- `fix/ENGR-4821-null_pointer_on_checkout`

Existing branches with nonconforming names are never retroactively flagged — the hook
only validates names at creation time (`checkout -b`, `switch -c`, `branch <name>`).

## Commit message format

Format: `<type>: [JIRA-ID] <description>`

- `<type>` is strictly `feat` or `fix`.
- `[JIRA-ID]` is the uppercase ticket key in square brackets.
- `<description>` is a plain-language summary of the change.

Examples:

- `feat: [ENGR-5016] add git workflow rule and enforcement hooks`
- `fix: [ENGR-4821] handle null customer id on checkout`

Exemptions: commit messages starting with `Merge` or `Revert` (produced by git itself,
not hand-authored) are exempt from the format check. Commits made without `-m` (i.e. the
editor flow) can't be validated pre-hoc and pass through — always commit with `-m` so the
message is checkable before it lands.

## Pull requests

Opening a PR is a git action — same rule as above, only when explicitly requested.

- **Title uses the commit message format**: `<type>: [JIRA-ID] <description>`, type
  strictly `feat` or `fix`. Squash merges inherit the PR title, so it must conform.
- **Description follows `.github/PULL_REQUEST_TEMPLATE.md`** (synced by this package).
  Sections, in order:
  - Ticket + plan-file links at the top.
  - **Summary** — what was done and why, for a reviewer who hasn't read the ticket.
    One bullet per meaningful change, not per file.
  - **Alternatives considered** — optional; include when real decisions were made,
    usually carried over from the plan file.
  - **Blast radius** — what this touches and what could break that isn't obvious
    from the diff.
  - **Test plan** — checkboxes ticked only for verification that actually ran;
    unverified paths get called out, not checked.
- **Base branch is `main`** unless the dev says otherwise, and the branch must be up
  to date with main before opening (see Git safety above).

## Why rules + a hook

Rules are advisory text a model can forget over a long session. The hook makes the
mechanically-checkable subset (force-push, branch/commit format) a hard block instead of
a suggestion — but it can't judge whether a commit is scoped to the right files or
whether the branch is actually up to date with main, so those parts of this document
still rely on the agent following them.
