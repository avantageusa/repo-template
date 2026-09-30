# Claude Code hooks

Scripts are from [karanb192/claude-code-hooks](https://github.com/karanb192/claude-code-hooks),
with a couple of local tweaks noted below.

## Shared hooks (already active, no setup needed)

`bin/sync.js` copies this whole folder to `.claude/hooks/` in the consuming project
(overwritten every install — the package owns these files) and merges the matching
`PreToolUse` entries into the project's `.claude/settings.json`:

- **`protect-secrets.js`** — blocks reading/editing/exfiltrating SSH keys, AWS/GCP/Azure
  credentials, `.env` files, `.npmrc`/`.pgpass`/`.netrc`, and similar. Wired to
  `Read|Edit|Write` and `Bash`. **Sole owner of every secrets rule**: reading `.env`/keys/
  credentials files via `cat`/`less`/`head`/`tail`, env dumps (`printenv`), echoing
  secret variables, copying/uploading/deleting secrets. Its Bash rules require the
  reader's own file argument, in the same pipeline segment, to be a secrets file.
- **`block-dangerous-commands.js`** — blocks catastrophic/risky Bash commands
  (`rm -rf ~`, fork bombs, `dd` to disk, force-push to main, `git reset --hard`,
  `curl | sh`, `chmod 777`, etc). Wired to `Bash`. Owns destructive and
  remote-execution rules only — **no secrets rules**. Its old loose copies (`cat-env`,
  `cat-secrets`, `env-dump`, `echo-secret`) were removed in ENGR-6882: they matched a
  reader word and a secrets word anywhere in the command, so `| tail -2` plus a jq
  `.key` path blocked read-only commands. Add secrets rules to `protect-secrets.js`.
- **`enforce-git-workflow.js`** — enforces the mechanically-checkable subset of
  `.claude/rules/git-workflow.md`: blocks any force-push (`--force`, `-f`,
  `--force-with-lease`) regardless of target branch, blocks branch creation
  (`checkout -b`, `switch -c`, `branch <name>`) whose name doesn't match
  `<type>/<JIRA-ID>-<snake_case>` (type strictly `feat`/`fix`), and blocks
  `git commit -m` messages that don't match `<type>: [JIRA-ID] <description>`.
  Existing branch names are never re-validated (creation-only); `Merge`/`Revert`
  commits are exempt; commits without `-m` (editor flow) pass through unchecked.
  Block messages always include the expected format and a worked example. Wired
  to `Bash`.
- **`plan-reminder.js`** — soft-enforces the "plan is mandatory before or alongside
  the first implementation edit" rule in `coding-standards.md`. Derives a Jira ID
  from the current branch name; if the branch has no Jira ID (e.g. `main`), it's
  silent. If an ID is found and no `docs/plans/*<jira-id>*` file exists yet, it
  injects a non-blocking warning telling the agent to create one before proceeding
  — it never blocks the edit, and it's silent for edits to files already under
  `docs/plans/` (the plan itself must stay writable without nagging). Wired to
  `Edit|Write`.

All four log matches to `~/.claude/hooks-logs/`.

`bin/test-hooks.js` (run by `node bin/validate.js`) replays known false positives, which
must pass both Bash hooks, and true positives, which `protect-secrets.js` must still
block. Add a fixture there when you change either hook's Bash rules.

The merge into `settings.json` is additive and idempotent: it adds a matcher group if
missing and skips any command that's already wired up, so a project's own hooks/permissions
in `settings.json` are left untouched. If `.claude/settings.json` contains invalid JSON, the
merge is skipped with a warning rather than overwriting the file. Each script's own header
comment documents its `SAFETY_LEVEL` in case you need to adjust it in a consuming project.

Nothing to install for these two — they run for every dev on every consuming project.

## Personal hooks (opt-in, per developer)

`optional/` holds workflow preferences, not team-enforced rules. `bin/sync.js` copies these
scripts into `.claude/hooks/optional/` (so you don't have to fetch them from upstream
yourself) but never wires them up — that's a deliberate per-developer choice via your own
gitignored `.claude/settings.local.json`.

- **`format-code.js`** — runs prettier (or ruff for `.py`) on modified files right after
  Claude writes or edits them, for faster feedback than waiting for a pre-commit hook.
- **`notify-permission.js`** — sends a Slack alert when Claude needs your input.
- **`notify-permission-pretooluse.js`** — local companion script (not from upstream).
  The `Notification` event's `permission_prompt`/`idle_prompt` matchers don't fire in
  the VSCode extension ([anthropics/claude-code#31285](https://github.com/anthropics/claude-code/issues/31285),
  [#16114](https://github.com/anthropics/claude-code/issues/16114)), so this reuses
  `notify-permission.js`'s Slack sender on `PreToolUse` instead (fires on
  `AskUserQuestion`/`ExitPlanMode` and risky Bash commands).

### Setup

1. **Copy the scripts to your home directory:**

   ```bash
   mkdir -p ~/.claude/hooks
   cp .claude/hooks/optional/*.js ~/.claude/hooks/
   ```

2. **Enable the hooks:** copy the `hooks` block from `.claude/settings.local.json.example`
   (synced to the project root of every consuming project) into your own
   `.claude/settings.local.json` (create it if you don't have one — it's gitignored, so
   it's yours alone).

3. **Set up the Slack webhook** (skip if you only want the formatter):

   1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** →
      **From scratch**. Name it (e.g. "Claude Code Alerts"), pick your workspace.
   2. In the app sidebar, click **Incoming Webhooks** → toggle it **On**.
   3. Click **Add New Webhook to Workspace**, pick a channel — a DM to yourself
      ("Messages to yourself") works fine, or create a private channel first
      (**+** next to Channels → **Create channel** → toggle **Make private**)
      if you'd rather keep alerts separate/mutable on their own. Authorize.
   4. Copy the generated URL — looks like `https://hooks.slack.com/services/T000/B000/xxxxxxxx`.
   5. Add it to your shell profile. **If you use zsh, put it in `~/.zshenv`, not `~/.zshrc`:**

      ```bash
      export CCH_SLA_WEBHOOK="https://hooks.slack.com/services/T000/B000/xxxxxxxx"
      ```

      `~/.zshrc` only loads for _interactive_ shells. The VSCode extension's hook
      runner spawns non-interactive subprocesses, so an env var set only in `.zshrc`
      works fine from a regular terminal but silently never reaches hooks fired from
      inside VSCode (no error — `sendSlack` just no-ops with "no webhook"). `~/.zshenv`
      loads for every zsh invocation and avoids this.

   6. Fully quit and reopen VSCode (a window reload isn't enough — the extension host
      only inherits environment variables set at process launch) so the env var is
      picked up. If you're using the terminal CLI instead, `source ~/.zshenv` or
      restart your terminal.

4. **Test it:**

   ```bash
   # Slack notification
   echo '{"hook_event_name":"Notification","notification_type":"permission_prompt","message":"test alert","cwd":"'"$PWD"'","session_id":"test123"}' | node ~/.claude/hooks/notify-permission.js

   # Formatter
   printf 'const   x = {a:1,   b:2}\n' > /tmp/fmt-test.ts
   echo '{"tool_name":"Write","tool_input":{"file_path":"/tmp/fmt-test.ts"},"session_id":"test","cwd":"'"$PWD"'"}' | node ~/.claude/hooks/format-code.js
   cat /tmp/fmt-test.ts && rm /tmp/fmt-test.ts
   ```

   A Slack message should land in your chosen channel, and the test file should
   come back prettier-formatted.
