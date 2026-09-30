#!/usr/bin/env node
/**
 * Enforce Git Workflow - PreToolUse Hook for Bash
 * Blocks force-push, nonconforming branch creation, and nonconforming commit
 * messages. Full conventions are documented in .claude/rules/git-workflow.md —
 * this hook enforces only the mechanically-checkable subset.
 * Logs to: ~/.claude/hooks-logs/
 *
 * Setup in .claude/settings.json:
 * {
 *   "hooks": {
 *     "PreToolUse": [{
 *       "matcher": "Bash",
 *       "hooks": [{ "type": "command", "command": "node /path/to/enforce-git-workflow.js" }]
 *     }]
 *   }
 * }
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const BRANCH_FORMAT = /^(feat|fix)\/[A-Z]+-\d+-[a-z0-9_]+$/;
const COMMIT_FORMAT = /^(feat|fix): \[[A-Z]+-\d+\] .+/;
const COMMIT_EXEMPT = /^(Merge|Revert)\b/;

const BRANCH_EXAMPLE = "feat/ENGR-5016-git_workflow_rules";
const COMMIT_EXAMPLE =
  "feat: [ENGR-5016] add git workflow rule and enforcement hooks";

const LOG_DIR = path.join(os.homedir(), ".claude", "hooks-logs");

function log(data) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const file = path.join(
      LOG_DIR,
      `${new Date().toISOString().slice(0, 10)}.jsonl`,
    );
    fs.appendFileSync(
      file,
      JSON.stringify({
        ts: new Date().toISOString(),
        hook: "enforce-git-workflow",
        ...data,
      }) + "\n",
    );
  } catch {}
}

// Split on shell chain operators so each git invocation in a chained command is checked on its own
function splitSegments(cmd) {
  return cmd.split(/&&|\|\||[;|]/);
}

function isForcePush(segment) {
  if (!/\bgit\s+push\b/.test(segment)) return false;
  return /--force(-with-lease)?\b/.test(segment) || /(^|\s)-f\b/.test(segment);
}

// The (\S+) captures include any surrounding quote characters, which would
// make BRANCH_FORMAT reject a perfectly conforming quoted branch name.
function stripQuotes(value) {
  return value.replace(/^["']+|["']+$/g, "");
}

function findBranchCreation(segment) {
  let match = segment.match(/\bgit\s+checkout\s+-b\s+(\S+)/);
  if (match) return stripQuotes(match[1]);
  match = segment.match(/\bgit\s+switch\s+-c\s+(\S+)/);
  if (match) return stripQuotes(match[1]);
  match = segment.match(/\bgit\s+branch\s+(?!-)(\S+)/);
  if (match) return stripQuotes(match[1]);
  return null;
}

// A commit's -m argument is often "$(cat <<'EOF' ... EOF)" (see CLAUDE.md heredoc
// convention) — the literal flag value isn't the message, the heredoc body is.
function extractHeredocBody(raw) {
  const match = raw.match(
    /^\$\(cat\s+<<-?['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\s*\1\s*\)$/,
  );
  return match ? match[2] : null;
}

function findCommitMessage(segment) {
  if (!/\bgit\s+commit\b/.test(segment))
    return { hasCommit: false, hasFlag: false, subject: null };
  const match =
    segment.match(/-m\s+"([\s\S]*?)"/) || segment.match(/-m\s+'([\s\S]*?)'/);
  if (!match) return { hasCommit: true, hasFlag: false, subject: null };
  const raw = match[1];
  const body = extractHeredocBody(raw) || raw;
  const subject = body.split("\n")[0].trim();
  return { hasCommit: true, hasFlag: true, subject };
}

function checkCommand(cmd) {
  for (const segment of splitSegments(cmd)) {
    if (isForcePush(segment)) {
      return {
        blocked: true,
        reason:
          "Force-push is never allowed, under any flag (--force, -f, --force-with-lease). " +
          "If history on a shared branch needs to change, stop and ask the dev how to proceed.",
      };
    }

    const branchName = findBranchCreation(segment);
    if (branchName && !BRANCH_FORMAT.test(branchName)) {
      return {
        blocked: true,
        reason:
          `Branch name "${branchName}" doesn't match the required format ` +
          `<type>/<JIRA-ID>-<snake_case> (type is strictly feat|fix). ` +
          `Expected pattern: ${BRANCH_FORMAT}. Example: ${BRANCH_EXAMPLE}`,
      };
    }

    const { hasCommit, hasFlag, subject } = findCommitMessage(segment);
    if (hasCommit && hasFlag && subject !== null) {
      if (COMMIT_EXEMPT.test(subject)) continue;
      if (!COMMIT_FORMAT.test(subject)) {
        return {
          blocked: true,
          reason:
            `Commit message "${subject}" doesn't match the required format ` +
            `"<type>: [JIRA-ID] <description>" (type is strictly feat|fix). ` +
            `Expected pattern: ${COMMIT_FORMAT}. Example: ${COMMIT_EXAMPLE}`,
        };
      }
    }
  }
  return { blocked: false, reason: null };
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;

  try {
    const data = JSON.parse(input);
    const { tool_name, tool_input, session_id, cwd, permission_mode } = data;
    if (tool_name !== "Bash") return console.log("{}");

    const cmd = tool_input?.command || "";
    const result = checkCommand(cmd);

    if (result.blocked) {
      log({
        level: "BLOCKED",
        reason: result.reason,
        cmd,
        session_id,
        cwd,
        permission_mode,
      });
      return console.log(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: `🚫 ${result.reason}`,
          },
        }),
      );
    }
    console.log("{}");
  } catch (e) {
    log({ level: "ERROR", error: e.message });
    console.log("{}");
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    BRANCH_FORMAT,
    COMMIT_FORMAT,
    checkCommand,
    findBranchCreation,
    findCommitMessage,
    isForcePush,
  };
}
