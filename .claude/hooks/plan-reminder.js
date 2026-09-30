#!/usr/bin/env node
/**
 * Plan Reminder - PreToolUse Hook for Edit|Write
 * Soft-enforces the plan-before-implementation mandate (coding-standards.md,
 * "Plans for AI-assisted work"): if the current branch carries a Jira ID and no
 * matching docs/plans/*<id>*.md file exists yet, injects a non-blocking warning.
 * Never blocks — this is a reminder, not a gate. Silent on non-Jira branches and
 * for edits to files already under docs/plans/ (the plan itself must stay writable).
 * Logs to: ~/.claude/hooks-logs/
 *
 * Setup in .claude/settings.json:
 * {
 *   "hooks": {
 *     "PreToolUse": [{
 *       "matcher": "Edit|Write",
 *       "hooks": [{ "type": "command", "command": "node /path/to/plan-reminder.js" }]
 *     }]
 *   }
 * }
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

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
        hook: "plan-reminder",
        ...data,
      }) + "\n",
    );
  } catch {}
}

// A Write may target a path whose directory doesn't exist yet; climb to the
// nearest existing ancestor so git commands have a real cwd to run in.
function nearestExistingDir(dir) {
  let current = dir;
  while (current && !fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

// The hook payload's cwd tracks the session shell, which routinely sits in a
// subdirectory (e.g. back-end/). docs/plans and the branch must be resolved
// against the repository root of the file being edited, or every edit made
// while cd'd into a subdir false-positives ("<subdir>/docs/plans" is absent).
function getRepoRoot(startDir) {
  const existingDir = nearestExistingDir(startDir);
  if (!existingDir) return null;
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd: existingDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function getCurrentBranch(cwd) {
  try {
    // symbolic-ref (not rev-parse --abbrev-ref) so this still resolves on a brand-new,
    // commit-less branch — rev-parse needs a HEAD commit to exist and fails on unborn branches.
    return execSync("git symbolic-ref --short HEAD", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function extractJiraId(branch) {
  if (!branch) return null;
  const match = branch.match(/([A-Za-z]+-\d+)/);
  return match ? match[1].toUpperCase() : null;
}

function isUnderPlansDir(filePath, cwd) {
  const resolved = path.resolve(cwd, filePath);
  const plansDir = path.join(cwd, "docs", "plans") + path.sep;
  return resolved.startsWith(plansDir);
}

function hasMatchingPlan(jiraId, cwd) {
  const plansDir = path.join(cwd, "docs", "plans");
  if (!fs.existsSync(plansDir)) return false;
  const needle = jiraId.toLowerCase();
  return fs
    .readdirSync(plansDir)
    .some((name) => name.toLowerCase().includes(needle));
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;

  try {
    const data = JSON.parse(input);
    const { tool_name, tool_input, cwd, session_id, permission_mode } = data;
    if (!["Edit", "Write"].includes(tool_name)) return console.log("{}");

    const filePath = tool_input?.file_path || "";
    const fileDir = filePath ? path.dirname(path.resolve(cwd, filePath)) : cwd;
    const repoRoot = getRepoRoot(fileDir) || getRepoRoot(cwd) || cwd;

    if (isUnderPlansDir(filePath, repoRoot)) return console.log("{}");

    const branch = getCurrentBranch(repoRoot);
    const jiraId = extractJiraId(branch);
    if (!jiraId) return console.log("{}");

    if (hasMatchingPlan(jiraId, repoRoot)) return console.log("{}");

    log({
      level: "WARN",
      jiraId,
      branch,
      filePath,
      session_id,
      cwd,
      permission_mode,
    });
    return console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext:
            `⚠ No plan file found for ${jiraId}. Per org convention, a plan is ` +
            `mandatory before or alongside the first implementation edit — create ` +
            `docs/plans/YYYY-MM-DD-<slug>.plan.md using the template in ` +
            `.claude/rules/coding-standards.md ("Plans for AI-assisted work") before continuing.`,
        },
      }),
    );
  } catch (e) {
    log({ level: "ERROR", error: e.message });
    console.log("{}");
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    extractJiraId,
    isUnderPlansDir,
    hasMatchingPlan,
    getCurrentBranch,
    getRepoRoot,
    nearestExistingDir,
  };
}
